#!/usr/bin/python3
"""Opt-in destructive fixture, ONLY on the disposable almond-lab guest.

Run after prepare-qualification.mjs. No mocks, package manager, firewall change,
SELinux policy change or host provisioning. Each mutation is logged as JSON.
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
created = []
users = []
units = []
connections = []
processes = []


def log(event, **values):
    print(json.dumps({'event': event, **values}), flush=True)


def command(args, check=True, **kwargs):
    r = subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True,
                       text=True, timeout=kwargs.pop('timeout', 30), **kwargs)
    if check and r.returncode:
        raise RuntimeError(f'{args[0:3]}: {r.returncode}: {r.stderr[:2000]}')
    return r


def check(name, function):
    global passed, failed
    try:
        result = function()
        assert result is not False, 'false result'
        passed += 1
        log('PASS', name=name, evidence=result)
    except Exception as e:
        failed += 1
        log('FAIL', name=name, error=str(e))


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


def launch(policy, pool):
    generation = str(uuid.uuid4())
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
    units.append(reply['unit'])
    while True:
        frame = line()
        assert frame.get('type') not in ('failure', 'rejected'), frame
        if frame.get('type') == 'ready':
            assert frame['body']['ready'], frame
            break
    log('worker', **reply)
    return child, reply, b


def main(build):
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
            p.chmod(0o755 if p == RELEASE / 'bin/node' else 0o644)
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
        account = dict(accountId=account_id, customerId=account_id, uid=uid, gid=uid, home=str(ROOT / 'accounts' / account_id), state='intended')
        pools.append(dict(poolId=account_id, account=account, base=str(ROOT / 'pools' / account_id / 'generations/1'), generation=1,
            inventory={'schema': 'wydgit.multi-host/0.1', 'apps': [{'id': 'boilerplate', 'root': 'app'}],
                       'routing': {'schema': 'wydgit.routing/0.1', 'transport': {'mode': 'private-unix', 'uid': PROVIDER},
                                   'routes': [{'hostname': letter + '.localhost', 'app': 'boilerplate', 'state': 'active', 'approval': 'local-development'}]}},
            deployments=[dict(appId='boilerplate', source=str(upload / 'deployment'), directory='app', **desc)],
            limits=dict(memoryBytes=268435456, cpuPercent=25, tasks=32, fileDescriptors=128, temporaryBytes=1048576), execution={}, optional=[]))
    policy = dict(schema='wydhosting.linux-approval/1', providerId='i56', registryRevision=1, registryDigest='a'*64,
                  providerUid=PROVIDER, providerGid=PROVIDER, pools=pools, qualification='unqualified', activation='manual-review-required')
    write_policy(policy)
    spec = importlib.util.spec_from_file_location('broker', RELEASE / 'node_modules/wydhosting/broker/broker.py')
    broker = importlib.util.module_from_spec(spec); spec.loader.exec_module(broker)
    broker.validate_policy(policy); broker.verify_platform()
    for pool in pools:
        name = broker.account_name(pool['account'])
        try: pwd.getpwnam(name)
        except KeyError: pass
        else: raise RuntimeError('preexisting account name')
    templates = RELEASE / 'node_modules/wydhosting/templates'
    for name in ('wydhosting-broker.socket', 'wydhosting-broker@.service', 'wydhosting-broker.slice'):
        text = (templates / name).read_text().replace('@PROVIDER_UID@', str(PROVIDER)).replace('@PROVIDER_GID@', str(PROVIDER))
        dest = Path('/run/systemd/system') / name
        assert not dest.exists()
        dest.write_text(text); created.append(dest); log('install-unit', path=str(dest))
    command(['/usr/bin/systemd-analyze', 'verify', '/run/systemd/system/wydhosting-broker.socket', '/run/systemd/system/wydhosting-broker@.service'])
    command(['/usr/bin/systemctl', 'daemon-reload'])
    command(['/usr/bin/systemctl', 'start', 'wydhosting-broker.socket'])
    for pool in pools:
        users.append((broker.account_name(pool['account']), pool['account']['uid']))
        check('real broker ensure-account ' + pool['poolId'], lambda p=pool: request(policy, 'ensure-account', p['poolId'])['ok'])
        name = broker.account_name(pool['account'])
        if pwd.getpwnam(name).pw_uid == pool['account']['uid']:
            log('broker-created-account', name=name, uid=pool['account']['uid'])
        check('real broker stage ' + pool['poolId'], lambda p=pool: request(policy, 'stage', p['poolId'])['ok'])
    check('same UID wrong primary GID kernel authorization', lambda: refused(request(policy, gid=A), 'BROKER.UNAUTHORIZED'))
    # Stale root approval vs existing socket owner exercises actual UID check, without opening socket permissions.
    policy['providerUid'] = B; write_policy(policy)
    check('wrong UID rejected using actual SO_PEERCRED', lambda: refused(request(policy), 'BROKER.UNAUTHORIZED'))
    policy['providerUid'] = PROVIDER; write_policy(policy)
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
    source = ROOT / 'uploads/i56-a/deployment'
    source.rename(source.with_name('saved'))
    source.symlink_to(ROOT / 'uploads/i56-b/deployment')
    pools[0]['generation'] = 2; pools[0]['base'] = str(ROOT / 'pools/i56-a/generations/2'); write_policy(policy)
    check('broker rejects symlinked approved source', lambda: refused(request(policy, 'stage')))
    source.unlink(); source.with_name('saved').rename(source)
    pools[0]['generation'] = 1; pools[0]['base'] = str(ROOT / 'pools/i56-a/generations/1'); write_policy(policy)
    # Separate same-tenant private Unix socket and live process under B.
    server = subprocess.Popen(['/usr/bin/python3', '-I', '-c', "import socket,sys,time;s=socket.socket(socket.AF_UNIX);s.bind(sys.argv[1]);s.listen();time.sleep(90)", str(home_b / 'private.sock')], user=B, group=B, extra_groups=[])
    processes.append(server); wait(lambda: (home_b / 'private.sock').exists())
    check('B authorized private socket connect', lambda: must_ok(as_uid(B, "import socket,sys;s=socket.socket(socket.AF_UNIX);s.connect(sys.argv[1])", home_b / 'private.sock')))
    check('A cannot connect B private socket', lambda: denied(A, "socket.socket(socket.AF_UNIX).connect(sys.argv[1])", home_b / 'private.sock'))
    check('A cannot signal B process', lambda: denied(A, "os.kill(int(sys.argv[1]),15)", server.pid))
    check('B authorized process signal 0', lambda: must_ok(as_uid(B, "import os,sys;os.kill(int(sys.argv[1]),0)", server.pid)))
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
        check('authorized provider private HTTP ' + bootstrap['poolId'], lambda b=bootstrap: http_probe(b))
        other = B if reply['uid'] == A else A
        check('cross UID worker socket denied ' + bootstrap['poolId'], lambda u=other, b=bootstrap: denied(u, "socket.socket(socket.AF_UNIX).connect(sys.argv[1])", b['listener']['path']))
    if len(live) == 2:
        child, reply, bootstrap = live[0]
        os.kill(reply['pid'], signal.SIGSTOP)
        child.terminate(); child.wait(timeout=5)
        check('frozen worker independently reaped by systemd', lambda: wait(lambda: not Path('/proc/'+str(reply['pid'])).exists(), 20))
        check('healthy sibling survives frozen peer cleanup', lambda: http_probe(live[1][2]))
    check('SELinux remains enforcing', lambda: Path('/sys/fs/selinux/enforce').read_text().strip() == '1')


def cgroup_limits(reply):
    path = Path('/sys/fs/cgroup' + reply['cgroup'])
    values = {name: (path / name).read_text().strip() for name in ('memory.max', 'memory.swap.max', 'cpu.max', 'pids.max', 'cgroup.procs')}
    assert values['memory.max'] == '268435456' and values['memory.swap.max'] == '0' and values['pids.max'] == '32'
    quota, period = map(int, values['cpu.max'].split()); assert quota / period == .25
    assert str(reply['pid']) in values['cgroup.procs'].split()
    return values


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


if __name__ == '__main__':
    armed = len(sys.argv) == 3 and sys.argv[1] == '--target=almond-lab' and socket.gethostname() == 'almond-lab' and os.geteuid() == 0
    if not armed: sys.exit('Refusing: explicit almond-lab root invocation required')
    try:
        main(Path(sys.argv[2]))
    except Exception as error:
        failed += 1; log('FATAL', error=str(error))
    finally:
        if created:
            try: cleanup()
            except Exception as error: failed += 1; log('CLEANUP-FAIL', error=str(error))
        log('TOTAL', passed=passed, failed=failed)
    sys.exit(bool(failed))
