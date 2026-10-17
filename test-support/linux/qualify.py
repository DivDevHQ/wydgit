#!/usr/bin/python3
"""Opt-in destructive fixture, ONLY on the disposable almond-lab guest.

Run after prepare-qualification.mjs. No mocks, package manager, firewall change
or host provisioning. --integrated explicitly installs/removes the experimental
SELinux policy and optionally runs loopback-only Caddy. Mutations are JSON events.
"""
import errno
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pwd
import grp
import shutil
import signal
import socket
import subprocess
import sys
import time
import uuid

sys.dont_write_bytecode = True
PROVIDER, A, B = 61050, 61051, 61052
ROOT = Path('/var/lib/wydhosting')
RELEASE = Path('/opt/wydhosting/release')
RUN = Path('/run/wydhosting')
ETC = Path('/etc/wydhosting')
passed = failed = 0
categories = {}
default_category = 'privileged-broker-dac'
created = []
users = []
units = []
connections = []
processes = []
finalizers = []
BUILD = None
AUDIT_OFFSET = 0
CAMPAIGN_SINCE = 0


def log(event, **values):
    print(json.dumps({'event': event, **values}), flush=True)


def command(args, check=True, **kwargs):
    r = subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True,
                       text=True, timeout=kwargs.pop('timeout', 30), **kwargs)
    if check and r.returncode:
        raise RuntimeError(f'{args[0:3]}: {r.returncode}: {r.stderr[:2000]}')
    return r


def check(name, function, category=None):
    global passed, failed
    category = category or default_category
    totals = categories.setdefault(category, {'passed':0, 'failed':0})
    try:
        result = function()
        assert result is not False, 'false result'
        passed += 1
        totals['passed'] += 1
        log('PASS', category=category, name=name, evidence=result)
    except Exception as e:
        failed += 1
        totals['failed'] += 1
        log('FAIL', category=category, name=name, error=str(e))


def wait(predicate, seconds=15):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        result = predicate()
        if result:
            return result
        time.sleep(.1)
    raise TimeoutError('bounded wait expired')


def as_uid(uid, code, *args, gid=None):
    return command(['/usr/bin/python3', '-I', '-c', code, *map(str, args)],
                   check=False, user=uid, group=gid or uid, extra_groups=[],
                   env={'PATH': '/usr/bin:/usr/sbin', 'LANG': 'C'}, timeout=15)


def must_ok(result):
    assert result.returncode == 0, result.stderr
    return result.stdout.strip() or 'exit 0'


def denied(uid, code, *args):
    r = as_uid(uid, 'import os,socket,sys,errno\ntry:\n ' + code +
               '\nexcept OSError as e:\n assert e.errno in (errno.EACCES,errno.EPERM,errno.EROFS), e\n print(errno.errorcode[e.errno])\nelse:\n sys.exit(99)', *args)
    return must_ok(r)


def mkdir(path, mode=0o755):
    path.mkdir(mode=mode)
    created.append(path)
    log('mkdir', path=str(path), mode=oct(mode), uid=0)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def write_policy(policy):
    policy['policyRevision'] = digest({k: v for k, v in policy.items() if k not in ('policyRevision', 'qualification', 'activation')})
    (ETC / 'approval.json').write_text(json.dumps(policy))
    (ETC / 'approval.json').chmod(0o600)


def request(policy, operation='stage', pool='i56-a', body=None, raw=None, uid=PROVIDER, gid=None):
    data = raw if raw is not None else json.dumps({'schema': 'wydhosting.broker/1', 'operation': operation,
        'poolId': pool, 'policyRevision': policy['policyRevision'], 'body': body or {}}, separators=(',', ':'))
    r = as_uid(uid, '''import socket,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(15);s.connect('/run/wydhosting/broker.sock')
s.sendall(sys.argv[1].encode()+b'\\n');data=b''
while not data.endswith(b'\\n'):
 c=s.recv(1)
 if not c: break
 data+=c
print(data.decode())''', data, gid=gid)
    return json.loads(must_ok(r))


def refused(value, code=None):
    assert value['ok'] is False and (code is None or value['code'] == code), value
    return value


def accepted(value):
    assert value.get('ok') is True, value
    return value


def launch(policy, pool):
    generation = str(uuid.uuid4())
    expected_unit = 'wydhosting-pool-'+hashlib.sha256(pool['poolId'].encode()).hexdigest()[:32]+'-'+generation.replace('-', '')+'.service'
    units.append(expected_unit)  # Also own the exact unit on an interrupted launch.
    b = dict(providerId=policy['providerId'], poolId=pool['poolId'], workerId='qualification',
             generation=generation, epoch=1, registryRevision=1, root=pool['base'],
             inventory=pool['inventory'], snapshots={'boilerplate': pool['deployments'][0]['snapshot']},
             execution={}, optional=[], listener={'mode': 'private-unix', 'path': str(RUN / 'workers' / generation / 'http.sock'), 'uid': PROVIDER},
             startupMs=10000, shutdownMs=1000)
    # Wydgine revision preserves insertion order, unlike root approval canonical hashing.
    revision = {k: b[k] for k in ('root', 'inventory', 'snapshots', 'execution', 'optional', 'listener')}
    b['configurationRevision'] = hashlib.sha256(json.dumps(revision, separators=(',', ':')).encode()).hexdigest()
    # Keep the real provider process alive so SO_PEERCRED and socket lifetime are real.
    client = RELEASE / 'qualification-client.py'
    client.write_text('''import json,socket,sys,time
s=socket.socket(socket.AF_UNIX);s.settimeout(20);s.connect('/run/wydhosting/broker.sock')
def read():
 data=b''
 while not data.endswith(b'\\n'):
  c=s.recv(1)
  if not c: raise RuntimeError('closed')
  data+=c
 return json.loads(data)
p=json.loads(sys.argv[1]);b=json.loads(sys.argv[2]);s.sendall((json.dumps(p,separators=(',',':'))+'\\n').encode())
r=read();print(json.dumps(r),flush=True)
if not r.get('ok'): sys.exit(1)
m=dict(schema='wydgine.worker/2',type='bootstrap',requestId='r1',poolId=b['poolId'],workerId=b['workerId'],generation=b['generation'],sequence=1,body=b)
s.sendall((json.dumps(m,separators=(',',':'))+'\\n').encode())
while True:
 r=read();print(json.dumps(r),flush=True)
 if r.get('type') in ('rejected','failure'): sys.exit(2)
''')
    client.chmod(0o644)
    req = {'schema': 'wydhosting.broker/1', 'operation': 'launch', 'poolId': pool['poolId'], 'policyRevision': policy['policyRevision'], 'body': b}
    child = subprocess.Popen(['/usr/bin/python3', '-I', str(client), json.dumps(req), json.dumps(b)],
                             user=PROVIDER, group=PROVIDER, extra_groups=[], stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, bufsize=0)
    processes.append(child)
    # select supplies an independent watchdog even if broker/worker stops responding.
    import select
    def line():
        assert select.select([child.stdout], [], [], 25)[0], 'provider deadline'
        data = bytearray()
        deadline = time.monotonic() + 25
        while not data.endswith(b'\n'):
            assert time.monotonic() < deadline and select.select([child.stdout], [], [], max(.01, deadline-time.monotonic()))[0], 'provider deadline'
            byte = child.stdout.read(1)
            assert byte, child.stderr.read().decode() if child.poll() is not None else 'provider closed'
            data.extend(byte)
        return json.loads(data)
    reply = line()
    assert reply.get('ok'), reply
    assert reply['unit'] == expected_unit, reply
    while True:
        frame = line()
        assert frame.get('type') not in ('failure', 'rejected'), frame
        if frame.get('type') == 'ready':
            assert frame['body']['ready'], frame
            break
    log('worker', **reply)
    return child, reply, b


def main(build, integrated=False):
    global BUILD, AUDIT_OFFSET, CAMPAIGN_SINCE
    AUDIT_OFFSET = Path('/var/log/audit/audit.log').stat().st_size
    CAMPAIGN_SINCE = int(time.time())
    BUILD = build
    assert sys.argv[1] == '--target=almond-lab' and socket.gethostname() == 'almond-lab'
    assert os.geteuid() == 0 and 'ID="almalinux"' in Path('/etc/os-release').read_text()
    assert Path('/sys/fs/selinux/enforce').read_text().strip() == '1'
    assert Path('/proc/1/comm').read_text().strip() == 'systemd'
    for name in ('firewalld', 'sshd'):
        assert command(['/usr/bin/systemctl', 'is-active', name]).stdout.strip() == 'active'
    # Refuse existing installations, identities and units before ANY mutation.
    for path in (ROOT, RELEASE.parent, RUN, ETC):
        assert not os.path.lexists(path), f'preexisting resource: {path}'
    assert not command(['/usr/bin/systemctl', 'list-unit-files', '--no-legend', 'wydhosting*'], check=False).stdout.strip()
    assert not command(['/usr/bin/systemctl', 'list-units', '--all', '--plain', '--no-legend', 'wydhosting*'], check=False).stdout.strip(), 'preexisting runtime units'
    for uid in (PROVIDER, A, B):
        for lookup in (pwd.getpwuid, grp.getgrgid):
            try: lookup(uid)
            except KeyError: pass
            else: raise RuntimeError('preexisting numeric identity')
    try: pwd.getpwnam('wyd-i56-provider')
    except KeyError: pass
    else: raise RuntimeError('preexisting provider')
    try: grp.getgrnam('wyd-i56-provider')
    except KeyError: pass
    else: raise RuntimeError('preexisting provider group')
    log('baseline', kernel=os.uname().release, boot=Path('/proc/sys/kernel/random/boot_id').read_text().strip(), selinux='enforcing')
    # Verify every unprivileged build artifact before installing the trusted closure.
    for filename, expected in json.loads((build / 'sha256.json').read_text()).items():
        file = build / filename
        assert file.is_file() and not file.is_symlink() and hashlib.sha256(file.read_bytes()).hexdigest() == expected
    mkdir(RELEASE.parent)
    shutil.copytree(build / 'release', RELEASE)
    log('copy-release', path=str(RELEASE), manifestSHA256=hashlib.sha256((build / 'sha256.json').read_bytes()).hexdigest())
    for current, dirs, files in os.walk(RELEASE):
        Path(current).chmod(0o755)
        for name in files:
            p = Path(current) / name
            assert not p.is_symlink() and p.stat().st_nlink == 1
            p.chmod(0o755 if p in (RELEASE / 'bin/node', RELEASE / 'bin/caddy') else 0o644)
    # copytree preserves source xattrs. Never execute a transferred user_tmp_t
    # binary as an installed service; restore the guest's existing path policy.
    command(['/usr/sbin/restorecon', '-RF', str(RELEASE.parent)])
    mkdir(ROOT); mkdir(ETC); mkdir(RUN)
    for name in ('accounts', 'uploads', 'pools', 'broker', 'provider'):
        mkdir(ROOT / name, 0o700 if name in ('broker', 'provider') else 0o755)
    mkdir(RUN / 'workers', 0o711)
    command(['/usr/sbin/groupadd', '--system', '--gid', str(PROVIDER), 'wyd-i56-provider'])
    users.append(('wyd-i56-provider', PROVIDER))
    command(['/usr/sbin/useradd', '--system', '--uid', str(PROVIDER), '--gid', str(PROVIDER), '--no-create-home', '--no-log-init', '--shell', '/usr/sbin/nologin', '--password', '!', 'wyd-i56-provider'])
    log('create-provider', name='wyd-i56-provider', uid=PROVIDER, gid=PROVIDER, shell='/usr/sbin/nologin', password='locked')
    os.chown(ROOT / 'provider', PROVIDER, PROVIDER)
    desc = json.loads((build / 'app-description.json').read_text())
    pools = []
    for letter, uid in (('a', A), ('b', B)):
        account_id = 'i56-' + letter
        upload = ROOT / 'uploads' / account_id
        mkdir(upload)
        shutil.copytree(build / 'app', upload / 'deployment')
        # Install the reviewed upload with protected ancestry, independent of builder umask.
        for current, dirs, files in os.walk(upload / 'deployment'):
            Path(current).chmod(0o755)
            for name in files: (Path(current)/name).chmod(0o644)
        account = dict(accountId=account_id, customerId=account_id, uid=uid, gid=uid, home=str(ROOT / 'accounts' / account_id), state='intended')
        pools.append(dict(poolId=account_id, account=account, base=str(ROOT / 'pools' / account_id / 'generations/1'), generation=1,
            inventory={'schema': 'wydgit.multi-host/0.1', 'apps': [{'id': 'boilerplate', 'root': 'app'}],
                       'routing': {'schema': 'wydgit.routing/0.1', 'transport': {'mode': 'private-unix', 'uid': PROVIDER},
                                   'routes': [{'hostname': letter + '.localhost', 'app': 'boilerplate', 'state': 'active', 'approval': 'local-development'}]}},
            deployments=[dict(appId='boilerplate', source=str(upload / 'deployment'), directory='app', **desc)],
            limits=dict(memoryBytes=268435456, cpuPercent=25, tasks=32, fileDescriptors=128, temporaryBytes=1048576), execution={}, optional=[]))
    policy = dict(schema='wydhosting.linux-approval/1', providerId='i56', registryRevision=1, registryDigest='a'*64,
                  providerUid=PROVIDER, providerGid=PROVIDER, pools=pools, qualification='unqualified', activation='manual-review-required')
    if integrated:
        spec = importlib.util.spec_from_file_location('integrated', Path(__file__).with_name('qualify-integrated.py'))
        integration = importlib.util.module_from_spec(spec); spec.loader.exec_module(integration)
        policy = integration.prepare(sys.modules[__name__], pools)
        pools = policy['pools']
    write_policy(policy)
    if integrated:
        command(['/usr/sbin/restorecon', '-F', str(ETC/'approval.json')])
    spec = importlib.util.spec_from_file_location('broker', RELEASE / 'node_modules/wydhosting/broker/broker.py')
    broker = importlib.util.module_from_spec(spec); spec.loader.exec_module(broker)
    broker.validate_policy(policy); broker.verify_platform()
    for pool in pools:
        name = broker.account_name(pool['account'])
        try: pwd.getpwnam(name)
        except KeyError: pass
        else: raise RuntimeError('preexisting account name')
        users.append((name, pool['account']['uid']))
    # Administrator fault injection before the first account-tool effect. This
    # proves durable intent/refusal, not recovery from power loss inside useradd.
    provisioner = RELEASE/'node_modules/wydhosting/broker/provision_accounts.py'
    inject = "import importlib.util; spec=importlib.util.spec_from_file_location('p',"+repr(str(provisioner))+"); p=importlib.util.module_from_spec(spec); spec.loader.exec_module(p); p.b.command=lambda *a,**k: (_ for _ in ()).throw(RuntimeError('injected before account tools')); p.main()"
    attempt = command(['/usr/bin/python3', '-I', '-c', inject], check=False)
    assert attempt.returncode != 0
    first = pools[0]['account']
    pending = ETC/'accounts'/(broker.key(first['accountId'])+'.pending.json')
    proof = ETC/'accounts'/(broker.key(first['accountId'])+'.json')
    assert json.loads(pending.read_text()) == first and not proof.exists()
    check('interrupted provisioning refuses retry', lambda: command(['/usr/bin/python3','-I',str(provisioner)],check=False).returncode == 70 or (_ for _ in ()).throw(AssertionError('adopted pending intent')), category='account-provisioning')
    # Exact fixture recovery: independently establish zero identity effects before
    # removing only this invocation's matching intent. Never delete/recycle a UID.
    for lookup, value in ((pwd.getpwnam,broker.account_name(first)),(pwd.getpwuid,first['uid']),(grp.getgrnam,broker.account_name(first)),(grp.getgrgid,first['gid'])):
        try: lookup(value)
        except KeyError: pass
        else: raise RuntimeError('unexpected partial account; administrator review required')
    pending.unlink()
    log('administrator-reviewed-empty-intent-recovery', accountId=first['accountId'])
    # Explicit offline administrator action, outside the broker's SELinux domain.
    command(['/usr/bin/python3', '-I', str(RELEASE/'node_modules/wydhosting/broker/provision_accounts.py')])
    if integrated:
        command(['/usr/sbin/restorecon', '-RF', str(ETC/'accounts')])
    check('verified account provisioning is repeatable', lambda: command(['/usr/bin/python3','-I',str(provisioner)]).returncode == 0, category='account-provisioning')
    log('administrator-provisioned-accounts', identities=[broker.account_name(p['account']) for p in pools])
    templates = RELEASE / 'node_modules/wydhosting/templates'
    for name in ('wydhosting-broker.socket', 'wydhosting-broker@.service', 'wydhosting-broker.slice'):
        text = (templates / name).read_text().replace('@PROVIDER_UID@', str(PROVIDER)).replace('@PROVIDER_GID@', str(PROVIDER))
        dest = Path('/run/systemd/system') / name
        assert not dest.exists()
        dest.write_text(text); created.append(dest); log('install-unit', path=str(dest))
    command(['/usr/bin/systemd-analyze', 'verify', '/run/systemd/system/wydhosting-broker.socket', '/run/systemd/system/wydhosting-broker@.service'])
    command(['/usr/bin/systemctl', 'daemon-reload'])
    command(['/usr/bin/systemctl', 'start', 'wydhosting-broker.socket'])
    if integrated:
        command(['/usr/sbin/restorecon', '-F', str(RUN/'broker.sock')])
    for pool in pools:
        check('real broker ensure-account ' + pool['poolId'], lambda p=pool: accepted(request(policy, 'ensure-account', p['poolId'])))
        name = broker.account_name(pool['account'])
        if pwd.getpwnam(name).pw_uid == pool['account']['uid']:
            log('broker-verified-administrator-account', name=name, uid=pool['account']['uid'])
        check('real broker stage ' + pool['poolId'], lambda p=pool: accepted(request(policy, 'stage', p['poolId'])))
    check('same UID wrong primary GID kernel authorization', lambda: refused(request(policy, gid=A), 'BROKER.UNAUTHORIZED'))
    # Stale root approval vs existing socket owner exercises actual UID check, without opening socket permissions.
    # Keep the replacement approval internally valid and distinct from tenant IDs.
    policy['providerUid'] = 61059
    for p in pools: p['inventory']['routing']['transport']['uid'] = 61059
    write_policy(policy)
    check('wrong UID rejected using actual SO_PEERCRED', lambda: refused(request(policy), 'BROKER.UNAUTHORIZED'))
    policy['providerUid'] = PROVIDER
    for p in pools: p['inventory']['routing']['transport']['uid'] = PROVIDER
    write_policy(policy)
    for uid in (A, B):
        check(f'tenant {uid} broker socket DAC denial', lambda u=uid: denied(u, "socket.socket(socket.AF_UNIX).connect(sys.argv[1])", RUN / 'broker.sock'))
    for operation, body in [('retire', {}), ('cleanup', {}), ('stage', {'path': '/etc'}), ('reconcile', {'unit': 'sshd.service'})]:
        check('broker rejects ' + operation + ' ' + str(body), lambda op=operation, b=body: refused(request(policy, op, body=b)))
    check('broker rejects foreign pool/traversal', lambda: refused(request(policy, pool='../i56-b'), 'BROKER.UNAUTHORIZED'))
    for raw in ('{"a":1,"a":2}', '{', '{"constructor":{}}'):
        check('broker malformed ' + raw, lambda r=raw: refused(request(policy, raw=r)))
    home_a, home_b = ROOT / 'accounts/i56-a', ROOT / 'accounts/i56-b'
    private = home_b / 'private'; private.write_text('qualification'); os.chown(private, B, B); private.chmod(0o600)
    check('B authorized file read/write', lambda: must_ok(as_uid(B, "from pathlib import Path;import sys;p=Path(sys.argv[1]);assert p.read_text()=='qualification';p.write_text('same-tenant')", private)))
    check('A cannot read B private file', lambda: denied(A, "open(sys.argv[1]).read()", private))
    check('A cannot modify B private file', lambda: denied(A, "open(sys.argv[1],'w').write('attack')", private))
    for uid in (A, B):
        check(f'tenant {uid} cannot read approval', lambda u=uid: denied(u, "open(sys.argv[1]).read()", ETC / 'approval.json'))
        check(f'tenant {uid} cannot write sealed code', lambda u=uid: denied(u, "open(sys.argv[1],'w')", ROOT / f'pools/i56-{"a" if u==A else "b"}/generations/1/app/wydgit.config.json'))
    link = home_a / 'foreign'; link.symlink_to(private); os.lchown(link, A, A)
    check('A symlink to B denied by kernel', lambda: denied(A, "open(sys.argv[1]).read()", link))
    check('A traversal to B denied by kernel', lambda: denied(A, "open(sys.argv[1]).read()", home_a / '../i56-b/private'))
    # Approved path swapped to attacker symlink; production stage must reject before copying.
    source = Path(pools[0]['deployments'][0]['source'])
    source.rename(source.with_name('saved'))
    source.symlink_to(Path(pools[1]['deployments'][0]['source']))
    pools[0]['generation'] = 2; pools[0]['base'] = str(ROOT / 'pools/i56-a/generations/2'); write_policy(policy)
    check('broker rejects symlinked approved source', lambda: refused(request(policy, 'stage')))
    source.unlink(); source.with_name('saved').rename(source)
    pools[0]['generation'] = 1; pools[0]['base'] = str(ROOT / 'pools/i56-a/generations/1'); write_policy(policy)
    if integrated:
        saved_categories = [p.pop('selinuxCategory') for p in pools]
        write_policy(policy)
        check('enforcing broker refuses a legacy unconfined launch', lambda: refused(request(policy, 'launch'), 'BROKER.SELINUX_POLICY'), category='selinux-mac')
        for pool, category in zip(pools, saved_categories): pool['selinuxCategory'] = category
        # Reservation writes are deliberately nonrecyclable, even after a failed
        # attempt to change an account's approved category. No account is created.
        pools[0]['selinuxCategory'] = 53; write_policy(policy)
        check('existing account category cannot change', lambda: refused(request(policy, 'ensure-account'), 'BROKER.SELINUX_POLICY'), category='selinux-broker-mac')
        pools[0]['selinuxCategory'] = saved_categories[0]
        pools[1]['selinuxCategory'] = 53; write_policy(policy)
        check('partially reserved category cannot be adopted by another account', lambda: refused(request(policy, 'ensure-account', pools[1]['poolId']), 'BROKER.SELINUX_POLICY'), category='selinux-broker-mac')
        pools[1]['selinuxCategory'] = saved_categories[1]
        saved_uid = pools[0]['account']['uid']; saved_gid = pools[0]['account']['gid']
        pools[0]['account']['uid'] = pools[0]['account']['gid'] = 61054; write_policy(policy)
        check('incorrect account UID category approval refuses before account tools', lambda: refused(request(policy, 'ensure-account'), 'BROKER.SELINUX_POLICY'), category='selinux-broker-mac')
        pools[0]['account']['uid'] = saved_uid; pools[0]['account']['gid'] = saved_gid
        write_policy(policy)
    # Separate same-tenant private Unix socket and live process under B.
    server = subprocess.Popen(['/usr/bin/python3', '-I', '-c', "import socket,sys,time;s=socket.socket(socket.AF_UNIX);s.bind(sys.argv[1]);s.listen();time.sleep(90)", str(home_b / 'private.sock')], user=B, group=B, extra_groups=[])
    processes.append(server); wait(lambda: (home_b / 'private.sock').exists())
    check('B authorized private socket connect', lambda: must_ok(as_uid(B, "import socket,sys;s=socket.socket(socket.AF_UNIX);s.connect(sys.argv[1])", home_b / 'private.sock')))
    check('A cannot connect B private socket', lambda: denied(A, "socket.socket(socket.AF_UNIX).connect(sys.argv[1])", home_b / 'private.sock'))
    check('A cannot signal B process', lambda: denied(A, "os.kill(int(sys.argv[1]),15)", server.pid))
    check('B authorized process signal 0', lambda: must_ok(as_uid(B, "import os,sys;os.kill(int(sys.argv[1]),0)", server.pid)))
    if integrated:
        integration.run(sys.modules[__name__], policy, broker)
        check('SELinux remains enforcing', lambda: Path('/sys/fs/selinux/enforce').read_text().strip() == '1')
        return
    live = []
    for pool in pools:
        try:
            child, reply, bootstrap = launch(policy, pool)
            live.append((child, reply, bootstrap))
            check('production service launch ' + pool['poolId'], lambda r=reply: r)
        except Exception as e:
            check('production service launch ' + pool['poolId'], lambda e=e: (_ for _ in ()).throw(e))
    for child, reply, bootstrap in live:
        check('actual service identity/capabilities ' + bootstrap['poolId'], lambda r=reply: broker.verify_process_identity(r['pid'], next(p['account'] for p in pools if p['poolId']==bootstrap['poolId'])) or 'numeric UID/GID, groups, NNP, CapEff/Prm/Amb checked')
        check('actual cgroup membership ' + bootstrap['poolId'], lambda r=reply: Path(f'/proc/{r["pid"]}/cgroup').read_text() == '0::'+r['cgroup']+'\n')
        check('actual cgroup limits ' + bootstrap['poolId'], lambda r=reply: cgroup_limits(r))
        check('effective worker and broker hardening ' + bootstrap['poolId'], lambda r=reply: effective_hardening(r))
        check('authorized provider private HTTP ' + bootstrap['poolId'], lambda b=bootstrap: http_probe(b))
        check('authenticated active service status ' + bootstrap['poolId'], lambda b=bootstrap: accepted(request(policy, 'status', b['poolId'])))
        check('active lease cannot be reconciled concurrently ' + bootstrap['poolId'], lambda b=bootstrap: refused(request(policy, 'reconcile', b['poolId']), 'BROKER.BUSY'))
        other = B if reply['uid'] == A else A
        check('cross UID worker socket denied ' + bootstrap['poolId'], lambda u=other, b=bootstrap: denied(u, "socket.socket(socket.AF_UNIX).connect(sys.argv[1])", b['listener']['path']))
    if len(live) == 2:
        child, reply, bootstrap = live[0]
        os.kill(reply['pid'], signal.SIGSTOP)
        child.terminate(); child.wait(timeout=5)
        check('frozen worker independently reaped by systemd', lambda: wait(lambda: not Path('/proc/'+str(reply['pid'])).exists(), 20))
        check('healthy sibling survives frozen peer cleanup', lambda: http_probe(live[1][2]))
        check('authenticated stopped service status', lambda: stopped_status(request(policy, 'status', bootstrap['poolId'])))
        check('authorized exact stopped lease reconciliation', lambda: accepted(request(policy, 'reconcile', bootstrap['poolId'])))
        # Independent manager binding must also survive an ungraceful root broker death.
        sibling, sibling_reply, sibling_bootstrap = live[1]
        session = bound_session(sibling_reply)
        command(['/usr/bin/systemctl', 'kill', '--kill-whom=main', '--signal=KILL', session])
        check('systemd BindsTo reaps worker after broker SIGKILL', lambda: wait(lambda: not Path('/proc/'+str(sibling_reply['pid'])).exists(), 20))
        check('dead broker cannot acknowledge successful cleanup', lambda: no_cleanup_ack(sibling))
        check('authorized interrupted lease reconciliation', lambda: accepted(request(policy, 'reconcile', sibling_bootstrap['poolId'])))
    check('SELinux remains enforcing', lambda: Path('/sys/fs/selinux/enforce').read_text().strip() == '1')


def cgroup_limits(reply):
    path = Path('/sys/fs/cgroup' + reply['cgroup'])
    values = {name: (path / name).read_text().strip() for name in ('memory.max', 'memory.swap.max', 'cpu.max', 'pids.max', 'cgroup.procs')}
    assert values['memory.max'] == '268435456' and values['memory.swap.max'] == '0' and values['pids.max'] == '32'
    quota, period = map(int, values['cpu.max'].split()); assert quota / period == .25
    assert str(reply['pid']) in values['cgroup.procs'].split()
    return values


def stopped_status(value):
    accepted(value)
    assert value['state'] == 'stopped' and value['service']['MainPID'] == '0', value
    return value


def effective_hardening(reply):
    fields = 'RestrictSUIDSGID,NoNewPrivileges,ProtectSystem,ProtectControlGroups,RestrictNamespaces,CapabilityBoundingSet'
    def show(unit):
        return dict(line.split('=', 1) for line in command(['/usr/bin/systemctl', 'show', unit, '--property='+fields]).stdout.splitlines())
    worker = show(reply['unit'])
    assert worker == dict(RestrictSUIDSGID='yes', NoNewPrivileges='yes', ProtectSystem='strict', ProtectControlGroups='yes', RestrictNamespaces='yes', CapabilityBoundingSet=''), worker
    session = bound_session(reply)
    broker = show(session)
    assert broker['RestrictSUIDSGID'] == 'no' and all(broker[k] == worker[k] for k in ('NoNewPrivileges', 'ProtectSystem', 'ProtectControlGroups', 'RestrictNamespaces'))
    assert set(broker['CapabilityBoundingSet'].split()) == {'cap_chown', 'cap_dac_override', 'cap_fowner'}
    readonly = command(['/usr/bin/systemctl', 'show', session, '-p', 'ReadOnlyPaths', '--value']).stdout.split()
    assert {'/etc/systemd', '/etc/wydhosting'} <= set(readonly), readonly
    broker['ReadOnlyPaths'] = readonly
    broker_pid = int(command(['/usr/bin/systemctl', 'show', session, '-p', 'MainPID', '--value']).stdout)
    actual_caps = dict(line.split(':', 1) for line in Path('/proc/'+str(broker_pid)+'/status').read_text().splitlines() if ':' in line)
    for field in ('CapEff', 'CapPrm', 'CapBnd'):
        assert int(actual_caps[field].strip(), 16) == 11, actual_caps[field]
    assert int(actual_caps['CapAmb'].strip(), 16) == 0
    broker['actualCapabilities'] = {k: actual_caps[k].strip() for k in ('CapEff','CapPrm','CapBnd','CapAmb')}
    broker_context = Path('/proc/'+str(broker_pid)+'/attr/current').read_text().strip('\0\n')
    assert broker_context == 'system_u:system_r:wydhosting_broker_t:s0', broker_context
    return dict(worker=worker, broker=broker, brokerSELinux=broker_context, workerSELinux=Path('/proc/'+str(reply['pid'])+'/attr/current').read_text().strip('\0\n'))


def bound_session(reply):
    text = (Path('/run/systemd/system')/reply['unit']).read_text()
    return next(line.split('=', 1)[1] for line in text.splitlines() if line.startswith('BindsTo='))


def no_cleanup_ack(child):
    wait(lambda: child.poll() is not None, 5)
    remaining = child.stdout.read()
    assert b'wydhosting.broker-result/1' not in remaining, remaining
    return dict(providerExited=True, successfulCleanupAcknowledgement=False)


def http_probe(bootstrap):
    return must_ok(as_uid(PROVIDER, "import socket,sys;s=socket.socket(socket.AF_UNIX);s.settimeout(5);s.connect(sys.argv[1]);s.sendall(('GET / HTTP/1.1\\r\\nHost: '+sys.argv[2]+'\\r\\nX-Forwarded-Host: '+sys.argv[2]+'\\r\\nX-Forwarded-Proto: https\\r\\nConnection: close\\r\\n\\r\\n').encode());data=s.recv(4096);assert data.startswith(b'HTTP/1.1 200'),data[:100];print('HTTP 200')", bootstrap['listener']['path'], bootstrap['poolId'][-1]+'.localhost'))


def cleanup():
    # No wildcard kills, UID process sweeps, account adoption or deletion of preexisting trees.
    for child in processes:
        if child.poll() is None:
            child.terminate()
            try: child.wait(timeout=5)
            except subprocess.TimeoutExpired: child.kill(); child.wait(timeout=5)
    sessions = command(['/usr/bin/systemctl', 'list-units', '--all', '--plain', '--no-legend', 'wydhosting-broker@*.service'], check=False).stdout
    for row in sessions.splitlines():
        unit = row.split()[0]
        if unit.startswith('wydhosting-broker@') and unit.endswith('.service'):
            command(['/usr/bin/systemctl', 'stop', unit], check=False)
            command(['/usr/bin/systemctl', 'reset-failed', unit], check=False)
    for unit in units:
        command(['/usr/bin/systemctl', 'stop', unit], check=False)
        assert command(['/usr/bin/systemctl', 'show', unit, '-p', 'MainPID', '--value']).stdout.strip() == '0'
        path = Path('/run/systemd/system') / unit
        if path.exists(): path.unlink(); log('remove-unit', unit=unit)
    if RUN in created:
        command(['/usr/bin/systemctl', 'stop', 'wydhosting-broker.socket', 'wydhosting-broker.slice', 'wydhosting.slice'], check=False)
        command(['/usr/bin/systemctl', 'reset-failed', 'wydhosting-broker.socket'], check=False)
    for path in reversed(created):
        if path.is_file(): path.unlink(); log('unlink', path=str(path))
    command(['/usr/bin/systemctl', 'daemon-reload'])
    command(['/usr/bin/systemctl', 'reset-failed', *units], check=False) if units else None
    for name, uid in reversed(users):
        try: actual = pwd.getpwnam(name)
        except KeyError: actual = None
        if actual:
            assert actual.pw_uid == uid and actual.pw_shell == '/usr/sbin/nologin'
            command(['/usr/sbin/userdel', name]); log('delete-user', name=name, uid=uid)
        if command(['/usr/bin/getent', 'group', name], check=False).returncode == 0:
            assert grp.getgrnam(name).gr_gid == uid and not grp.getgrnam(name).gr_mem
            command(['/usr/sbin/groupdel', name]); log('delete-group', name=name)
    # Only top-level directories proven absent at entry and created by this invocation.
    for path in (RUN, ETC, ROOT, RELEASE.parent):
        if path in created and path.exists():
            assert path.is_dir() and not path.is_symlink() and path.stat().st_uid == 0
            shutil.rmtree(path); log('remove-disposable-tree', path=str(path))
    for finalize in reversed(finalizers):
        finalize()


if __name__ == '__main__':
    armed = len(sys.argv) in (3, 4) and sys.argv[1] == '--target=almond-lab' and (len(sys.argv) == 3 or sys.argv[3] == '--integrated') and socket.gethostname() == 'almond-lab' and os.geteuid() == 0
    if not armed: sys.exit('Refusing: explicit almond-lab root invocation required')
    try:
        main(Path(sys.argv[2]), integrated=len(sys.argv) == 4)
    except Exception as error:
        failed += 1; log('FATAL', error=str(error))
    finally:
        if created:
            try:
                with open('/var/log/audit/audit.log') as audit:
                    audit.seek(AUDIT_OFFSET)
                    denials = [line.strip() for line in audit if 'avc:' in line and 'denied' in line and 'wydhosting_' in line]
                seen = set(); distinct = []
                for line in denials:
                    signature = tuple(__import__('re').findall(r'\{[^}]+\}|comm=\"[^\"]+\"|tcontext=\S+|tclass=\S+', line))
                    if signature not in seen: seen.add(signature); distinct.append(line)
                log('campaign-avcs', count=len(denials), distinct=len(distinct), denials=distinct[:128], truncated=len(distinct)>128)
                journal = command(['/usr/bin/journalctl', '--since=@'+str(CAMPAIGN_SINCE), '--no-pager', '-o', 'cat', '-u', 'wydhosting-broker@*']).stdout
                events = [json.loads(line) for line in journal.splitlines() if line.startswith('{"schema":"wydhosting.')]
                log('broker-diagnostics', events=events[-64:])
            except Exception as error: log('diagnostic-failure', error=type(error).__name__)
            try: cleanup()
            except Exception as error: failed += 1; log('CLEANUP-FAIL', error=str(error))
        log('TOTAL', passed=passed, failed=failed, categories=categories, productionQualified=False)
    sys.exit(bool(failed))
