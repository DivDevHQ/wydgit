#!/usr/bin/python3
"""Socket-activated, root-owned administrative session. Never a generic command API."""
import fcntl
import grp
import hashlib
import json
import os
import pwd
import re
import secrets
import selectors
import socket
import stat
import subprocess
import sys
import time

# Python -I intentionally ignores script cwd/PYTHONPATH. Only this protected sibling is loaded.
import importlib.util
_spec = importlib.util.spec_from_file_location('wydhosting_security', os.path.join(os.path.dirname(os.path.realpath(__file__)), 'security.py'))
s = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s)
ROOT = '/var/lib/wydhosting'
RELEASE = '/opt/wydhosting/release'
RUN = '/run/wydhosting'
OPERATIONS = ('ensure-account', 'stage', 'launch', 'status', 'reconcile')


def key(value):
    return hashlib.sha256(value.encode()).hexdigest()[:32]


def command(args, timeout=20):
    # Every executable/argument is broker-generated. No shell, inherited env, stdin or FD.
    try:
        result = subprocess.run(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, env={'LANG': 'C', 'PATH': '/usr/sbin:/usr/bin'},
                                timeout=timeout, close_fds=True, check=False)
        s.require(result.returncode == 0 and len(result.stdout) <= 65536, 'BROKER.SYSTEMD')
        return result.stdout.decode('utf-8', 'strict')
    except (subprocess.SubprocessError, UnicodeError, OSError):
        raise s.Refused('BROKER.SYSTEMD') from None


def validate_policy(p):
    s.closed(p, ('schema', 'providerId', 'registryRevision', 'registryDigest', 'providerUid', 'providerGid', 'pools', 'policyRevision', 'qualification', 'activation'))
    s.require(p['schema'] == 'wydhosting.linux-approval/1' and s.identifier(p['providerId']) and s.integer(p['registryRevision']) and re.fullmatch('[a-f0-9]{64}', p['registryDigest']))
    s.require(s.integer(p['providerUid'], 1000, 2147483647) and s.integer(p['providerGid'], 1000, 2147483647))
    body = {k: v for k, v in p.items() if k not in ('policyRevision', 'qualification', 'activation')}
    digest = hashlib.sha256(__import__('json').dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    s.require(digest == p['policyRevision'] and p['qualification'] == 'unqualified' and p['activation'] == 'manual-review-required', 'BROKER.APPROVAL')
    s.require(type(p['pools']) is list and 0 < len(p['pools']) <= 128)
    seen = set()
    accounts = {}
    for pool in p['pools']:
        s.closed(pool, ('poolId', 'account', 'base', 'generation', 'inventory', 'deployments', 'limits', 'execution', 'optional'))
        s.require(s.identifier(pool['poolId']) and pool['poolId'] not in seen and s.integer(pool['generation'], 1))
        seen.add(pool['poolId'])
        a = pool['account']
        s.closed(a, ('accountId', 'customerId', 'uid', 'gid', 'home', 'state'))
        s.require(s.identifier(a['accountId']) and a['state'] == 'intended' and s.integer(a['uid'], 60000, 2147483647) and a['uid'] == a['gid'] and a['uid'] not in (p['providerUid'], p['providerGid']))
        s.require(a['home'] == ROOT + '/accounts/' + a['accountId'] and pool['base'] == ROOT + '/pools/' + pool['poolId'] + '/generations/' + str(pool['generation']))
        for other in accounts.values():
            s.require(other == a or (other['uid'] != a['uid'] and other['accountId'] != a['accountId']), 'BROKER.OWNERSHIP')
        accounts[a['accountId']] = a
        s.closed(pool['limits'], ('memoryBytes', 'cpuPercent', 'tasks', 'fileDescriptors', 'temporaryBytes'))
        for field, low, high in [('memoryBytes', 64*1024**2, 64*1024**3), ('cpuPercent', 1, 6400), ('tasks', 16, 4096), ('fileDescriptors', 64, 65536), ('temporaryBytes', 1024**2, 1024**3)]:
            s.require(s.integer(pool['limits'][field], low, high))
        s.require(type(pool['deployments']) is list and 0 < len(pool['deployments']) <= 16)
        s.require(type(pool['inventory']) is dict and pool['inventory'].get('routing', {}).get('transport') == {'mode': 'private-unix', 'uid': p['providerUid']})
        destinations = []
        for deployment in pool['deployments']:
            s.closed(deployment, ('appId', 'source', 'directory', 'snapshot', 'descriptor'))
            s.relative(deployment['directory'])
            s.require(re.fullmatch('[a-f0-9]{64}', deployment['snapshot']) and type(deployment['source']) is str and deployment['source'].startswith(ROOT + '/uploads/' + a['accountId'] + '/') and len(deployment['source'].split('/')) == 7)
            for previous in destinations:
                s.require(not (deployment['directory'] == previous or deployment['directory'].startswith(previous + '/') or previous.startswith(deployment['directory'] + '/')))
            destinations.append(deployment['directory'])
    return p


def load_policy():
    fd = s.open_directory('/etc/wydhosting')
    try:
        return validate_policy(s.decode(s.read_file(fd, 'approval.json'), s.MAX_POLICY))
    finally:
        os.close(fd)


def account_name(account):
    return 'wyd-' + key(account['accountId'])[:20]


def ensure_account(account, state):
    name = account_name(account)
    marker = 'account-' + key(account['accountId']) + '.json'
    try:
        recorded = s.decode(s.read_file(state, marker))
        s.require(recorded == account, 'BROKER.OWNERSHIP')
    except FileNotFoundError:
        # Never adopt an existing user/group, even if the numeric/name fields match.
        for lookup, value in [(pwd.getpwnam, name), (pwd.getpwuid, account['uid']), (grp.getgrnam, name), (grp.getgrgid, account['gid'])]:
            try:
                lookup(value)
            except KeyError:
                continue
            raise s.Refused('BROKER.OWNERSHIP')
        # Interrupted creation is deliberately not repaired/adopted automatically.
        command(['/usr/sbin/groupadd', '--system', '--gid', str(account['gid']), name])
        command(['/usr/sbin/useradd', '--system', '--uid', str(account['uid']), '--gid', str(account['gid']), '--no-user-group', '--no-create-home', '--home-dir', account['home'], '--shell', '/usr/sbin/nologin', '--password', '!', '--no-log-init', name])
        homes = s.open_directory(ROOT + '/accounts')
        try:
            home = s.mkdir_owned(homes, account['accountId'], account['uid'], account['gid'], 0o700)
            os.close(home)
        finally:
            os.close(homes)
        s.atomic_file(state, marker, s.encode(account))
    actual = pwd.getpwnam(name)
    group = grp.getgrnam(name)
    s.require(actual.pw_uid == account['uid'] and actual.pw_gid == account['gid'] and actual.pw_dir == account['home'] and actual.pw_shell == '/usr/sbin/nologin' and group.gr_gid == account['gid'] and not group.gr_mem, 'BROKER.ACCOUNT')
    s.require(os.getgrouplist(name, actual.pw_gid) == [actual.pw_gid], 'BROKER.GROUPS')
    etc = s.open_directory('/etc')
    try:
        shadow = s.read_file(etc, 'shadow')
        matches = [row.split(b':')[1] for row in shadow.splitlines() if row.split(b':')[0] == name.encode()]
        s.require(len(matches) == 1 and matches[0].startswith((b'!', b'*')), 'BROKER.ACCOUNT')
    finally:
        os.close(etc)
    return name


def stage(pool, state):
    account = pool['account']
    ensure_account(account, state)
    pools = s.open_directory(ROOT + '/pools')
    parent = s.mkdir_owned(pools, pool['poolId'], 0, account['gid'], 0o710)
    os.close(pools)
    generations = s.mkdir_owned(parent, 'generations', 0, account['gid'], 0o710)
    os.close(parent)
    temporary = '.staging-' + secrets.token_hex(16)
    target = s.mkdir_owned(generations, temporary, 0, account['gid'])
    try:
        # Existing generations are never modified, recursively chowned or retired here.
        try:
            os.stat(str(pool['generation']), dir_fd=generations, follow_symlinks=False)
            raise s.Refused('BROKER.GENERATION_EXISTS')
        except FileNotFoundError:
            pass
        for app in pool['deployments']:
            uploads = s.open_directory(ROOT + '/uploads')
            try:
                source = s.open_beneath(uploads, '/'.join(app['source'].split('/')[-2:]), owners=(0, account['uid']))
            finally:
                os.close(uploads)
            current = os.dup(target)
            try:
                for part in s.relative(app['directory']):
                    child = s.mkdir_owned(current, part, 0, account['gid'])
                    os.close(current)
                    current = child
                s.stage_tree(source, current, app['descriptor'], account['uid'], account['gid'])
                # Canonical validator runs again in Wydgine. Broker only allocates the
                # three fixed service subtrees; code/config never becomes writable.
                for name in ('data', 'files', 'media'):
                    child = s.mkdir_owned(current, name, account['uid'], account['gid'], 0o700)
                    os.close(child)
                os.fchmod(current, 0o550)
                os.fsync(current)
            finally:
                os.close(source)
                os.close(current)
        # A protected manifest binds the complete bytes and placement, not just JSON config.
        s.atomic_file(target, 'deployment.json', s.encode(pool), mode=0o440)
        os.fchmod(target, 0o550)
        os.fsync(target)
        os.rename(temporary, str(pool['generation']), src_dir_fd=generations, dst_dir_fd=generations)
        os.fsync(generations)
    finally:
        # Failed trees remain private quarantine; no path-based recursive deletion.
        os.close(target)
        os.close(generations)


def show(unit):
    fields = ('Id', 'LoadState', 'ActiveState', 'MainPID', 'ControlGroup', 'InvocationID', 'Result', 'ExecMainCode', 'ExecMainStatus', 'MemoryCurrent', 'TasksCurrent', 'CPUUsageNSec', 'FragmentPath', 'DropInPaths', 'User', 'Group', 'Restart', 'NoNewPrivileges', 'KillMode')
    text = command(['/usr/bin/systemctl', 'show', '--no-pager', '--property=' + ','.join(fields), unit])
    values = dict(line.split('=', 1) for line in text.splitlines() if '=' in line)
    s.require(values.get('Id') == unit and values.get('LoadState') == 'loaded', 'BROKER.OWNERSHIP')
    return values


def verify_unit(values, unit, account=None, inactive=False):
    s.require(values.get('FragmentPath') == '/run/systemd/system/' + unit and values.get('DropInPaths') == '', 'BROKER.OWNERSHIP')
    if account is not None:
        s.require(values.get('User') == str(account['uid']) and values.get('Group') == str(account['gid']) and values.get('Restart') == 'no' and values.get('NoNewPrivileges') == 'yes' and values.get('KillMode') == 'control-group', 'BROKER.UNIT_POLICY')
    if inactive:
        s.require(values.get('ActiveState') == 'inactive' and values.get('MainPID') == '0', 'BROKER.OWNERSHIP')


def process_start(pid):
    s.require(s.integer(pid, 1), 'BROKER.PEER')
    with open('/proc/' + str(pid) + '/stat', encoding='ascii') as stream:
        text = stream.read(4097)
    s.require(len(text) <= 4096 and ') ' in text, 'BROKER.PEER')
    value = text.rsplit(') ', 1)[1].split()[19]
    s.require(value.isdecimal(), 'BROKER.PEER')
    return value


def owned_status(record):
    values = show(record['unit'])
    verify_unit(values, record['unit'])
    # The protected unit bytes plus invocation/cgroup bind ownership across restart.
    units = s.open_directory('/run/systemd/system')
    try:
        s.require(hashlib.sha256(s.read_file(units, record['unit'])).hexdigest() == record['unitHash'], 'BROKER.OWNERSHIP')
    finally:
        os.close(units)
    if values.get('ActiveState') in ('inactive', 'failed') and values.get('MainPID') == '0':
        s.require(cgroup_empty(record), 'BROKER.OWNERSHIP_UNKNOWN')
    else:
        s.require(values.get('InvocationID') == record['invocation'] and values.get('ControlGroup') == record['cgroup'] and values.get('MainPID') == str(record['pid']) and process_start(record['pid']) == record['startTime'], 'BROKER.OWNERSHIP')
    return values


def cgroup_empty(record):
    cgroup = record['cgroup']
    s.require(re.fullmatch(r'/system.slice/wydhosting-pool-[a-f0-9]{32}-[a-f0-9]{32}\.service', cgroup), 'BROKER.OWNERSHIP')
    try:
        fd = s.open_directory('/sys/fs/cgroup' + cgroup)
    except FileNotFoundError:
        return True
    try:
        # cgroup.events populated includes descendants, unlike cgroup.procs alone.
        raw = s.read_file(fd, 'cgroup.events', 4096)
        return b'populated 0\n' in raw
    finally:
        os.close(fd)


def stop_owned(record):
    status = owned_status(record)
    if status.get('ActiveState') not in ('inactive', 'failed'):
        command(['/usr/bin/systemctl', 'stop', record['unit']], timeout=30)
    s.require(cgroup_empty(record), 'BROKER.OWNERSHIP_UNKNOWN')


def service_text(pool, generation, session, job):
    a = pool['account']
    unit = 'wydhosting-pool-' + key(pool['poolId']) + '-' + generation.replace('-', '') + '.service'
    s.require(re.fullmatch(r'wydhosting-pool-[a-f0-9]{32}-[a-f0-9]{32}\.service', unit))
    s.require(re.fullmatch(r'wydhosting-broker@[^/\s]+\.service', session), 'BROKER.SESSION')
    # Escape-free arguments and paths are generated below, never publisher-selected.
    runtime = 'wydhosting/workers/' + generation
    limits = pool['limits']
    writes = []
    for app in pool['deployments']:
        # Unit path syntax must be a strict subset, including no %/$/quotes/whitespace.
        s.require(re.fullmatch(r'[A-Za-z0-9_/-]+', app['directory']))
        for name in ('data', 'files', 'media'):
            writes.append(pool['base'] + '/' + app['directory'] + '/' + name)
    text = f'''# WydHosting managed generation; never edit or adopt by name.
[Unit]
Description=WydHosting restricted pool
BindsTo={session}
After={session}
[Service]
Type=exec
User={a['uid']}
Group={a['gid']}
SupplementaryGroups=
ExecStart=/usr/bin/python3 -I {RELEASE}/node_modules/wydhosting/broker/worker.py {job}
WorkingDirectory={pool['base']}
Environment=LANG=C.UTF-8
UnsetEnvironment=NODE_OPTIONS NODE_PATH PYTHONPATH PYTHONHOME LD_PRELOAD LD_LIBRARY_PATH
UMask=0077
Restart=no
KillMode=control-group
TimeoutStartSec=130s
TimeoutStopSec=10s
SendSIGKILL=yes
OOMPolicy=stop
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ProtectHome=yes
PrivateDevices=yes
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ProtectKernelLogs=yes
ProtectClock=yes
RestrictSUIDSGID=yes
RestrictRealtime=yes
LockPersonality=yes
RestrictNamespaces=yes
RestrictAddressFamilies=AF_UNIX
IPAddressDeny=any
ProcSubset=pid
ProtectProc=invisible
RuntimeDirectory={runtime}
RuntimeDirectoryMode=0700
ReadWritePaths={' '.join(writes)} /run/{runtime}
InaccessiblePaths={ROOT}/provider {ROOT}/broker /etc/wydhosting /var/tmp
MemoryAccounting=yes
CPUAccounting=yes
TasksAccounting=yes
MemoryMax={limits['memoryBytes']}
MemorySwapMax=0
CPUQuota={limits['cpuPercent']}%
TasksMax={limits['tasks']}
LimitNOFILE={limits['fileDescriptors']}
LimitCORE=0
TemporaryFileSystem=/tmp:rw,nosuid,nodev,noexec,size={limits['temporaryBytes']},mode=0700,uid={a['uid']},gid={a['gid']}
StandardInput=null
StandardOutput=null
StandardError=null
'''
    return unit, text


def session_unit():
    lines = open('/proc/self/cgroup', encoding='ascii').read().splitlines()
    s.require(len(lines) == 1 and lines[0].startswith('0::/'), 'BROKER.SESSION')
    name = lines[0].rsplit('/', 1)[-1]
    s.require(re.fullmatch(r'wydhosting-broker@[^/\s]+\.service', name), 'BROKER.SESSION')
    return name


def validate_bootstrap(b, policy, pool):
    s.closed(b, ('providerId', 'poolId', 'workerId', 'generation', 'epoch', 'registryRevision', 'configurationRevision', 'root', 'inventory', 'snapshots', 'execution', 'optional', 'listener', 'startupMs', 'shutdownMs'))
    s.require(b['providerId'] == policy['providerId'] and b['poolId'] == pool['poolId'] and b['registryRevision'] == policy['registryRevision'], 'BROKER.APPROVAL')
    s.require(type(b['generation']) is str and re.fullmatch('[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}', b['generation']) and s.identifier(b['workerId']) and s.integer(b['epoch'], 1))
    for name, expected in [('root', pool['base']), ('inventory', pool['inventory']), ('execution', pool['execution']), ('optional', pool['optional']), ('snapshots', {a['appId']: a['snapshot'] for a in pool['deployments']})]:
        s.require(b[name] == expected, 'BROKER.APPROVAL')
    s.require(b['listener'] == {'mode': 'private-unix', 'path': RUN + '/workers/' + b['generation'] + '/http.sock', 'uid': policy['providerUid']}, 'BROKER.APPROVAL')
    s.require(all(s.integer(b[k], 100, 120000) for k in ('startupMs', 'shutdownMs')))
    # Wydgine independently checks configurationRevision with its canonical codec.
    s.require(type(b['configurationRevision']) is str and re.fullmatch('[a-f0-9]{64}', b['configurationRevision']))


def verify_process_identity(pid, account):
    with open('/proc/' + str(pid) + '/status', encoding='ascii') as stream:
        text = stream.read(65537)
    s.require(len(text) <= 65536, 'BROKER.PEER')
    fields = dict(line.split(':', 1) for line in text.splitlines() if ':' in line)
    s.require(fields.get('Uid', '').split() == [str(account['uid'])] * 4 and fields.get('Gid', '').split() == [str(account['gid'])] * 4, 'BROKER.PEER')
    s.require(set(fields.get('Groups', '').split()).issubset({str(account['gid'])}), 'BROKER.GROUPS')
    s.require(fields.get('NoNewPrivs', '').strip() == '1' and all(int(fields.get(name, '1').strip(), 16) == 0 for name in ('CapEff', 'CapPrm', 'CapAmb')), 'BROKER.PEER')


def validate_worker_frame(frame, binding, sequence):
    s.closed(frame, ('schema', 'type', 'requestId', 'poolId', 'workerId', 'generation', 'sequence', 'body'))
    s.require(frame['schema'] == 'wydgine.worker/2' and frame['type'] in ('accepted', 'starting', 'ready', 'not-ready', 'health', 'draining', 'stopped', 'rejected', 'failure'), 'BROKER.WORKER_FRAME')
    s.require(all(frame[k] == binding[k] for k in ('poolId', 'workerId', 'generation')) and s.identifier(frame['requestId']) and s.integer(frame['sequence'], 1) and frame['sequence'] == sequence + 1 and type(frame['body']) is dict, 'BROKER.WORKER_FRAME')
    return frame['sequence']


def relay(provider, worker, binding, on_worker_frame=lambda _: None):
    # Byte relay has no OS-operation dispatch. Each Node endpoint enforces closed worker/2.
    selector = selectors.DefaultSelector()
    buffers = {provider: bytearray(), worker: bytearray()}
    peers = {provider: worker, worker: provider}
    for sock in peers:
        sock.setblocking(False)
        selector.register(sock, selectors.EVENT_READ)
    worker_frame = bytearray()
    incoming_sequence = 0
    try:
        while True:
            for sock, mask in selector.select(1):
                if mask & selectors.EVENT_READ:
                    chunk = sock.fileobj.recv(65536)
                    if not chunk:
                        return
                    forwarding = bytearray() if sock.fileobj is worker else chunk
                    if sock.fileobj is worker:
                        for byte in chunk:
                            if byte == 10:
                                frame = s.decode(bytes(worker_frame))
                                incoming_sequence = validate_worker_frame(frame, binding, incoming_sequence)
                                on_worker_frame(frame)
                                forwarding.extend(worker_frame + b'\n')
                                worker_frame.clear()
                            else:
                                worker_frame.append(byte)
                                s.require(len(worker_frame) <= s.MAX_FRAME, 'BROKER.LIMIT')
                    target = peers[sock.fileobj]
                    buffers[target].extend(forwarding)
                    s.require(len(buffers[target]) <= 1048576, 'BROKER.BACKPRESSURE')
                if mask & selectors.EVENT_WRITE:
                    sent = sock.fileobj.send(buffers[sock.fileobj])
                    del buffers[sock.fileobj][:sent]
                for endpoint in peers:
                    selector.modify(endpoint, selectors.EVENT_READ | (selectors.EVENT_WRITE if buffers[endpoint] else 0))
    finally:
        selector.close()


def launch(provider, policy, pool, b, state):
    validate_bootstrap(b, policy, pool)
    ensure_account(pool['account'], state)
    sealed = s.open_directory(pool['base'])
    try:
        s.require(s.decode(s.read_file(sealed, 'deployment.json')) == pool, 'BROKER.STAGING_REQUIRED')
    finally:
        os.close(sealed)
    lease_name = 'lease-' + key(pool['poolId']) + '.json'
    try:
        previous = s.decode(s.read_file(state, lease_name))
        s.require(s.integer(previous.get('epoch'), 1), 'BROKER.OWNERSHIP_UNKNOWN')
        s.require(previous['state'] == 'stopped' and b['epoch'] > previous['epoch'], 'BROKER.RECONCILE_REQUIRED')
        s.require(previous.get('base') == pool['base'], 'BROKER.MIGRATION_REQUIRED')
    except FileNotFoundError:
        pass
    session = session_unit()
    runtime = s.open_directory(RUN)
    job_id = key(pool['poolId'] + b['generation'])
    listener_name = 'worker-' + job_id + '.sock'
    address = RUN + '/' + listener_name
    listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    worker = None
    record = None
    try:
        listener.bind(address)
        os.chmod(address, 0o666)
        listener.listen(4)
        listener.settimeout(10)
        # Public job contains no nonce, registry, key, customer data or execution code.
        job = {'schema': 'wydhosting.worker-launch/1', 'socket': address, 'poolId': pool['poolId'], 'generation': b['generation']}
        job_name = 'job-' + job_id + '.json'
        s.atomic_file(runtime, job_name, s.encode(job), mode=0o444)
        unit, text = service_text(pool, b['generation'], session, RUN + '/' + job_name)
        units = s.open_directory('/run/systemd/system')
        try:
            s.atomic_file(units, unit, text.encode(), mode=0o644)
        finally:
            os.close(units)
        # Persist an ambiguous starting intent before asking systemd to execute.
        intent = {'state': 'starting', 'epoch': b['epoch'], 'generation': b['generation'], 'unit': unit, 'base': pool['base']}
        s.atomic_file(state, lease_name, s.encode(intent), replace=True)
        command(['/usr/bin/systemctl', 'daemon-reload'])
        verify_unit(show(unit), unit, pool['account'], inactive=True)
        command(['/usr/bin/systemctl', 'start', unit])
        actual = show(unit)
        verify_unit(actual, unit, pool['account'])
        s.require(re.fullmatch('[a-f0-9]{32}', actual.get('InvocationID', '')) and actual.get('ControlGroup') == '/system.slice/' + unit, 'BROKER.OWNERSHIP')
        record = {**intent, 'state': 'running', 'invocation': actual['InvocationID'], 'cgroup': actual['ControlGroup'], 'unitHash': hashlib.sha256(text.encode()).hexdigest(), 'pid': int(actual['MainPID']), 'startTime': process_start(int(actual['MainPID']))}
        s.atomic_file(state, lease_name, s.encode(record), replace=True)
        expires = time.monotonic() + 10
        while time.monotonic() < expires:
            candidate, _ = listener.accept()
            candidate.settimeout(1)
            try:
                pid, uid, gid = s.peercred(candidate)
                s.require(uid == pool['account']['uid'] and gid == pool['account']['gid'] and str(pid) == actual['MainPID'], 'BROKER.PEER')
                verify_process_identity(pid, pool['account'])
                with open('/proc/' + str(pid) + '/cgroup', encoding='ascii') as cgroup_file:
                    cgroup = cgroup_file.read(4096)
                s.require(cgroup == '0::' + record['cgroup'] + '\n', 'BROKER.PEER')
                hello = s.read_frame(candidate, 1)
                s.require(hello == {'schema': 'wydhosting.worker-launch/1', 'poolId': pool['poolId'], 'generation': b['generation']}, 'BROKER.PEER')
                nonce = secrets.token_hex(32)
                s.write_frame(candidate, {'challenge': nonce})
                s.require(s.read_frame(candidate, 1) == {'challenge': nonce, 'poolId': pool['poolId'], 'generation': b['generation']}, 'BROKER.PEER')
                owned_status(record)
                worker = candidate
                break
            except (s.Refused, OSError):
                candidate.close()
        s.require(worker is not None, 'BROKER.PEER')
        s.write_frame(provider, {'ok': True, 'state': 'launched', 'pid': int(actual['MainPID']), 'unit': unit, 'invocation': record['invocation'], 'cgroup': record['cgroup'], 'generation': b['generation'], 'uid': pool['account']['uid'], 'startTime': record['startTime']})
        ingress_exposed = False
        def grant_ingress(frame):
            nonlocal ingress_exposed
            if ingress_exposed:
                return
            if frame.get('type') not in ('ready', 'health') or not frame.get('body', {}).get('ready'):
                return
            s.require(frame.get('generation') == b['generation'] and frame.get('poolId') == pool['poolId'], 'BROKER.PEER')
            # Parent ancestry is root-owned; RuntimeDirectory itself is service-owned.
            parent = s.open_directory(RUN + '/workers')
            try:
                runtime_fd = os.open(b['generation'], os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
                try:
                    info = os.fstat(runtime_fd)
                    s.require(info.st_uid == pool['account']['uid'], 'BROKER.OWNERSHIP')
                    s.expose_ingress(runtime_fd, pool['account']['uid'], policy['providerGid'], int(actual['MainPID']))
                    ingress_exposed = True
                finally:
                    os.close(runtime_fd)
            finally:
                os.close(parent)
        relay(provider, worker, b, grant_ingress)
    finally:
        if worker:
            worker.close()
        listener.close()
        # Manager owns kill and cgroup death. No kill(numeric_pid) anywhere.
        if record:
            stop_owned(record)
            status = owned_status(record)
            result = status.get('Result', 'unknown')
            if result not in ('success', 'exit-code', 'signal', 'core-dump', 'watchdog', 'timeout', 'start-limit-hit', 'oom-kill', 'resources', 'protocol'):
                result = 'unknown'
            raw_status = status.get('ExecMainStatus', '')
            exit_status = int(raw_status) if raw_status.isdecimal() and 0 <= int(raw_status) <= 255 else 0
            record.update(state='stopped', result=result, exitStatus=exit_status)
            s.atomic_file(state, lease_name, s.encode(record), replace=True)
            os.write(2, s.encode({'schema':'wydhosting.service-event/1', 'principal':'uid:'+str(policy['providerUid']), 'operation':'service-retired', 'poolId':pool['poolId'], 'generation':b['generation'], 'policyRevision':policy['policyRevision'], 'result':result, 'exitStatus':exit_status}) + b'\n')
            try:
                provider.setblocking(True)
                provider.settimeout(2)
                s.write_frame(provider, {'schema':'wydhosting.broker-result/1', 'ok': True, 'state': 'stopped', 'generation': b['generation'], 'result':result, 'exitStatus':exit_status})
            except OSError:
                pass
        try:
            os.unlink(listener_name, dir_fd=runtime)
        except FileNotFoundError:
            pass
        os.close(runtime)


def handle(provider, policy, state, audit=None):
    pid, uid, gid = s.peercred(provider)
    s.require(uid == policy['providerUid'] and gid == policy['providerGid'], 'BROKER.UNAUTHORIZED')
    request = s.read_frame(provider)
    s.closed(request, ('schema', 'operation', 'poolId', 'policyRevision', 'body'))
    s.require(request['schema'] == 'wydhosting.broker/1' and request['operation'] in OPERATIONS and request['policyRevision'] == policy['policyRevision'], 'BROKER.UNAUTHORIZED')
    pool = next((p for p in policy['pools'] if p['poolId'] == request['poolId']), None)
    s.require(pool is not None, 'BROKER.UNAUTHORIZED')
    operation = request['operation']
    if audit is not None:
        supplied_generation = request['body'].get('generation') if type(request['body']) is dict else None
        safe_generation = supplied_generation if type(supplied_generation) is str and re.fullmatch('[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}', supplied_generation) else None
        audit.update(operation=operation, resource=pool['poolId'], generation=safe_generation)
        os.write(2, s.encode({**audit, 'outcome': 'started', 'code': 'BROKER.STARTED'}) + b'\n')
    if operation != 'launch':
        s.closed(request['body'], ())
    lock = os.open('lock-' + key(pool['poolId']), os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=state)
    try:
        if operation != 'status':
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise s.Refused('BROKER.BUSY') from None
        if operation == 'ensure-account':
            ensure_account(pool['account'], state)
        elif operation == 'stage':
            stage(pool, state)
        elif operation == 'launch':
            launch(provider, policy, pool, request['body'], state)
            return request
        else:
            record = s.decode(s.read_file(state, 'lease-' + key(pool['poolId']) + '.json'))
            s.require(record.get('state') in ('running', 'stopped') and record.get('invocation') and record.get('cgroup'), 'BROKER.OWNERSHIP_UNKNOWN')
            status = owned_status(record)
            if operation == 'reconcile':
                stop_owned(record)
                record['state'] = 'stopped'
                s.atomic_file(state, 'lease-' + key(pool['poolId']) + '.json', s.encode(record), replace=True)
            else:
                s.write_frame(provider, {'ok': True, 'state': record['state'], 'generation': record['generation'], 'service': status})
                return request
        s.write_frame(provider, {'ok': True, 'state': 'verification-required'})
        return request
    finally:
        os.close(lock)


def platform_candidate(identity, version):
    # Never trust ID_LIKE or a caller-supplied distro/policy override.
    with open(os.path.join(os.path.dirname(os.path.realpath(__file__)), 'platforms.json'), encoding='utf-8') as stream:
        matrix = json.load(stream)
    s.require(matrix.get('schema') == 'wydhosting.linux-platforms/1', 'BROKER.PLATFORM')
    return next((lane for lane in matrix['candidates'] if lane['id'] == identity and
                 (version == lane['version'] if lane['match'] == 'exact' else
                  re.fullmatch(re.escape(lane['version']) + r'(?:\.[0-9]+)?', version))), None)


def verify_platform():
    import platform
    with open('/etc/os-release', encoding='utf-8') as stream:
        distro = dict(line.strip().split('=', 1) for line in stream if '=' in line)
    identity = distro.get('ID', '').strip('"')
    version = distro.get('VERSION_ID', '').strip('"')
    with open('/proc/1/comm', encoding='ascii') as stream:
        init = stream.read(64).strip()
    with open('/sys/fs/cgroup/cgroup.controllers', encoding='ascii') as stream:
        controllers = set(stream.read(4096).split())
    lane = platform_candidate(identity, version)
    s.require(platform.machine() == 'x86_64' and init == 'systemd' and lane is not None and {'memory', 'cpu', 'pids'}.issubset(controllers), 'BROKER.PLATFORM')
    if lane['selinuxRequired']:
        try:
            with open('/sys/fs/selinux/enforce', encoding='ascii') as stream:
                enforcing = stream.read(8).strip() == '1'
        except OSError:
            enforcing = False
        s.require(enforcing, 'BROKER.SELINUX')


def main():
    s.require(os.geteuid() == 0 and sys.argv == [sys.argv[0]], 'BROKER.PRIVILEGE')
    os.umask(0o077)
    verify_platform()
    release_fd = s.open_directory(RELEASE)
    try:
        s.verify_release(release_fd)
    finally:
        os.close(release_fd)
    policy = load_policy()
    provider = socket.socket(fileno=0)
    state = s.open_directory(ROOT + '/broker')
    request = None
    audit = {'schema': 'wydhosting.admin-event/1', 'operation': 'refused', 'resource': None, 'generation': None, 'policyRevision': policy['policyRevision']}
    principal = 'unknown'
    outcome = 'refused'
    code = 'BROKER.INVALID'
    try:
        principal = 'uid:' + str(s.peercred(provider)[1])
        audit['principal'] = principal
        request = handle(provider, policy, state, audit)
        outcome, code = 'completed', 'BROKER.OK'
    except Exception as error:
        code = error.code if isinstance(error, s.Refused) else 'BROKER.INTERNAL'
        try:
            s.write_frame(provider, {'ok': False, 'code': code})
        except OSError:
            pass
    finally:
        # Journald supplies bounded rotation; fixed fields, no payload/exception strings.
        event = {**audit, 'principal': principal, 'outcome': outcome, 'code': code}
        os.write(2, s.encode(event) + b'\n')
        os.close(state)
        provider.close()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.exit(70)
