#!/usr/bin/python3
"""Real kernel fixtures, explicitly separate from broker/production qualification."""
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

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('qualification', Path(__file__).with_name('qualify.py'))
q = importlib.util.module_from_spec(spec); spec.loader.exec_module(q)
ROOT = Path('/var/lib/wyd-i56-kernel')
CODE = Path('/opt/wyd-i56-kernel')
UIDS = (61061, 61062)
owned_users = []
owned_units = []
owned_paths = []

FIXTURE = '''import errno,json,os,socket,sys,time
from pathlib import Path
root=Path(sys.argv[1]);mode=sys.argv[2]
def report(name,value): (root/name).write_text(json.dumps(value))
def denial(f):
 try: f()
 except OSError as e:
  assert e.errno in (errno.EPERM,errno.EACCES,errno.EROFS,errno.EAFNOSUPPORT),e
  return errno.errorcode[e.errno]
 raise RuntimeError('operation unexpectedly allowed')
if mode=='normal':
 report('denials',dict(system=denial(lambda:open('/etc/wyd-i56-kernel-forbidden','w')),
  sibling=denial(lambda:open(str(root.parent/('b' if root.name=='a' else 'a')/'private'))),
  network=denial(lambda:socket.socket(socket.AF_INET)),
  cgroup=denial(lambda:open('/sys/fs/cgroup/cgroup.procs','w')),
  namespace=denial(lambda:os.unshare(os.CLONE_NEWUSER))))
 pid=os.fork()
 if pid==0:
  os.setsid();time.sleep(40);sys.exit(0)
 report('identity',dict(pid=os.getpid(),child=pid,uid=os.getuid(),gid=os.getgid(),groups=os.getgroups()))
 s=socket.socket(socket.AF_UNIX);s.bind(str(root/'private.sock'));s.listen(8)
 report('ready',True)
 while True:
  c,_=s.accept();c.sendall(b'same-tenant');c.close()
else:
 report('ready',True)
 while not (root/'go').exists():time.sleep(.05)
 if mode=='memory':
  blocks=[]
  for i in range(64): blocks.append(bytearray(8*1024*1024))
  raise RuntimeError('memory limit not enforced')
 if mode=='tasks':
  children=[]
  for i in range(64):
   try: pid=os.fork()
   except OSError as e:
    assert e.errno==errno.EAGAIN,e;report('exhaustion',dict(errno='EAGAIN',children=len(children)));break
   if pid==0:time.sleep(35);sys.exit(0)
   children.append(pid)
  else:raise RuntimeError('task limit not enforced')
  time.sleep(30)
 if mode=='cpu':
  end=time.monotonic()+4
  while time.monotonic()<end: pass
  report('cpu-done',True);time.sleep(20)
'''


def show(unit, field):
    return q.command(['/usr/bin/systemctl', 'show', unit, '-p', field, '--value']).stdout.strip()


def start(name, uid, mode):
    unit = 'wyd-i56-kernel-'+name+'.service'
    root = ROOT / name
    if not root.exists():
        root.mkdir(mode=0o700); os.chown(root, uid, uid)
        (root/'private').write_text('same-tenant'); os.chown(root/'private', uid, uid)
    args = ['/usr/bin/systemd-run', '--unit='+unit, '--service-type=exec']
    properties = [f'User={uid}', f'Group={uid}', 'SupplementaryGroups=', 'NoNewPrivileges=yes',
                  'CapabilityBoundingSet=', 'AmbientCapabilities=', 'ProtectSystem=strict', 'ProtectHome=yes',
                  'ProtectControlGroups=yes', 'PrivateDevices=yes', 'PrivateTmp=yes', 'RestrictNamespaces=yes',
                  'RestrictSUIDSGID=yes', 'RestrictAddressFamilies=AF_UNIX', 'IPAddressDeny=any',
                  'ProtectProc=invisible', 'ProcSubset=pid', 'KillMode=control-group', 'TimeoutStopSec=2s',
                  'RuntimeMaxSec=45s', 'MemoryMax=64M', 'MemorySwapMax=0', 'CPUQuota=25%', 'TasksMax=16',
                  'LimitNOFILE=64', 'LimitCORE=0', 'OOMPolicy=stop', 'ReadWritePaths='+str(root),
                  'TemporaryFileSystem=/tmp:rw,nosuid,nodev,noexec,size=1048576']
    for prop in properties: args += ['--property='+prop]
    args += ['/usr/bin/python3', '-I', str(CODE/'fixture.py'), str(root), mode]
    owned_units.append(unit)
    q.log('start-kernel-fixture', unit=unit, uid=uid, mode=mode, properties=properties)
    q.command(args)
    q.wait(lambda: (root/'ready').exists(), 10)
    return unit, root, Path('/sys/fs/cgroup'+show(unit, 'ControlGroup'))


def connect(uid, root):
    return q.must_ok(q.as_uid(uid, "import socket,sys;s=socket.socket(socket.AF_UNIX);s.settimeout(3);s.connect(sys.argv[1]);assert s.recv(32)==b'same-tenant';print('same-tenant socket OK')", root/'private.sock'))


def main():
    assert sys.argv == [sys.argv[0], '--target=almond-lab'] and socket.gethostname() == 'almond-lab' and os.geteuid() == 0
    assert Path('/sys/fs/selinux/enforce').read_text().strip() == '1'
    assert not ROOT.exists() and not CODE.exists()
    assert not q.command(['/usr/bin/systemctl', 'list-unit-files', '--no-legend', 'wyd-i56-kernel*'], check=False).stdout.strip()
    assert not q.command(['/usr/bin/systemctl', 'list-units', '--all', '--plain', '--no-legend', 'wyd-i56-kernel*'], check=False).stdout.strip(), 'preexisting runtime units'
    for uid in UIDS:
        for lookup, key in [(pwd.getpwuid, uid), (grp.getgrgid, uid), (pwd.getpwnam, 'wyd-i56-k'+str(uid)), (grp.getgrnam, 'wyd-i56-k'+str(uid))]:
            try: lookup(key)
            except KeyError: pass
            else: raise RuntimeError('preexisting identity')
    for path in (ROOT, CODE):
        path.mkdir(mode=0o755); owned_paths.append(path); q.log('mkdir', path=str(path), mode='0755')
    (CODE/'fixture.py').write_text(FIXTURE); (CODE/'fixture.py').chmod(0o644)
    for uid in UIDS:
        name = 'wyd-i56-k'+str(uid); owned_users.append((name, uid))
        q.command(['/usr/sbin/groupadd', '--system', '--gid', str(uid), name])
        q.command(['/usr/sbin/useradd', '--system', '--uid', str(uid), '--gid', str(uid), '--no-create-home', '--no-log-init', '--shell', '/usr/sbin/nologin', '--password', '!', name])
        q.log('create-kernel-fixture-user', name=name, uid=uid, password='locked', shell='/usr/sbin/nologin')
    for name, uid in zip(('a', 'b'), UIDS):
        root = ROOT/name; root.mkdir(mode=0o700); os.chown(root, uid, uid)
        (root/'private').write_text('same-tenant'); os.chown(root/'private', uid, uid)
    a, ar, ac = start('a', UIDS[0], 'normal'); b, br, bc = start('b', UIDS[1], 'normal')
    ai = json.loads((ar/'identity').read_text()); bi = json.loads((br/'identity').read_text())
    for uid, root, identity, cg in ((UIDS[0], ar, ai, ac), (UIDS[1], br, bi, bc)):
        q.check(f'kernel fixture {uid} same-tenant file/socket', lambda u=uid, r=root: connect(u, r))
        q.check(f'kernel fixture {uid} sandbox forbidden operations', lambda r=root: json.loads((r/'denials').read_text()))
        q.check(f'kernel fixture {uid} numeric identity/no capabilities', lambda i=identity, u=uid: identity_check(i, u))
        q.check(f'kernel fixture {uid} setsid child stays in cgroup', lambda i=identity, c=cg: all(Path('/proc/'+str(i[k])+'/cgroup').read_text()=='0::'+str(c).removeprefix('/sys/fs/cgroup')+'\n' for k in ('pid', 'child')))
    for operation, code, args in [('read', 'open(sys.argv[1]).read()', [br/'private']), ('write', "open(sys.argv[1],'w')", [br/'private']), ('socket', 'socket.socket(socket.AF_UNIX).connect(sys.argv[1])', [br/'private.sock']), ('signal', 'os.kill(int(sys.argv[1]),15)', [bi['pid']]), ('proc-memory', "open(sys.argv[1],'rb')", ['/proc/'+str(bi['pid'])+'/mem'])]:
        q.check('kernel cross-UID '+operation+' denied', lambda c=code, a=args: q.denied(UIDS[0], c, *a))
    link = ar/'foreign'; link.symlink_to(br/'private'); os.lchown(link, UIDS[0], UIDS[0])
    q.check('kernel cross-UID symlink denied', lambda: q.denied(UIDS[0], 'open(sys.argv[1]).read()', link))
    q.check('kernel cross-UID traversal denied', lambda: q.denied(UIDS[0], 'open(sys.argv[1]).read()', ar/'../b/private'))
    q.check('kernel same-tenant private file write', lambda: q.must_ok(q.as_uid(UIDS[0], "import sys;open(sys.argv[1],'w').write('authorized')", ar/'private')))
    q.check('kernel cross-UID concurrent symlink replacement', lambda: symlink_race(ar, br))
    for name, mode in [('tasks', 'tasks'), ('cpu', 'cpu'), ('memory', 'memory')]:
        unit, root, cg = start(name, UIDS[0], mode)
        baseline = {p: (cg/p).read_text().strip() for p in ('memory.max', 'pids.max', 'cpu.max')}
        (root/'go').write_text('start')
        if mode == 'tasks':
            q.check('kernel TasksMax causes EAGAIN and pids.events max', lambda: tasks(root, cg))
        elif mode == 'cpu':
            q.wait(lambda: (root/'cpu-done').exists(), 10)
            q.check('kernel CPUQuota actually throttles', lambda: cpu_events(cg))
        else:
            q.wait(lambda: show(unit, 'ActiveState') in ('failed', 'inactive'), 15)
            q.check('kernel MemoryMax OOM contains allocation', lambda: show(unit, 'Result') == 'oom-kill')
        q.log('cgroup-enforcement', unit=unit, limits=baseline, result=show(unit, 'Result'))
        q.check(mode+' exhaustion healthy sibling', lambda: connect(UIDS[1], br))
        q.command(['/usr/bin/systemctl', 'stop', unit], check=False)
    os.kill(ai['pid'], signal.SIGSTOP)
    q.command(['/usr/bin/systemctl', 'stop', a])
    q.check('kernel stopped frozen main and setsid child reaped', lambda: q.wait(lambda: not Path('/proc/'+str(ai['pid'])).exists() and not Path('/proc/'+str(ai['child'])).exists(), 5))
    q.check('kernel healthy sibling after frozen service stop', lambda: connect(UIDS[1], br))
    q.check('kernel SELinux enforcing throughout', lambda: Path('/sys/fs/selinux/enforce').read_text().strip() == '1')


def identity_check(identity, uid):
    assert identity['uid'] == identity['gid'] == uid and set(identity['groups']).issubset({uid})
    text = Path('/proc/'+str(identity['pid'])+'/status').read_text()
    fields = dict(line.split(':', 1) for line in text.splitlines() if ':' in line)
    assert fields['NoNewPrivs'].strip() == '1' and all(int(fields[name].strip(), 16) == 0 for name in ('CapEff', 'CapPrm', 'CapAmb'))
    return {'uid': uid, 'gid': uid, 'noNewPrivileges': True, 'capabilities': 'empty',
            'selinux': Path('/proc/'+str(identity['pid'])+'/attr/current').read_text().strip()}


def cpu_events(cg):
    result = dict(line.split() for line in (cg/'cpu.stat').read_text().splitlines())
    assert int(result['nr_throttled']) > 0 and (cg/'cpu.max').read_text().strip() == '25000 100000'
    return result


def tasks(root, cg):
    q.wait(lambda: (root/'exhaustion').exists(), 10)
    result = json.loads((root/'exhaustion').read_text())
    assert result['errno'] == 'EAGAIN' and 0 < result['children'] < 16
    assert int((cg/'pids.current').read_text()) <= 16
    assert int(dict(line.split() for line in (cg/'pids.events').read_text().splitlines())['max']) > 0
    return result


def symlink_race(ar, br):
    return q.must_ok(q.as_uid(UIDS[0], '''import errno,json,os,resource,sys,threading
from pathlib import Path
resource.setrlimit(resource.RLIMIT_CPU,(3,3));resource.setrlimit(resource.RLIMIT_AS,(67108864,67108864))
root=Path(sys.argv[1]);other=Path(sys.argv[2]);link=root/'race-link';pending=root/'race-pending'
link.symlink_to(other/'private')
denied=allowed=0
try:link.read_text()
except PermissionError:denied+=1
else:raise RuntimeError('foreign bytes readable')
def swap():
 for i in range(2000):
  pending.symlink_to((root if i%2 else other)/'private');os.replace(pending,link)
t=threading.Thread(target=swap);t.start()
for i in range(2000):
 try:
  assert link.read_text()=='authorized';allowed+=1
 except PermissionError:denied+=1
t.join();assert denied>0;print(json.dumps(dict(denied=denied,authorized=allowed,foreignReads=0)))
''', ar, br))


def cleanup():
    for unit in reversed(owned_units):
        q.command(['/usr/bin/systemctl', 'stop', unit], check=False)
        assert show(unit, 'MainPID') == '0'
        q.command(['/usr/bin/systemctl', 'reset-failed', unit], check=False)
        q.log('remove-kernel-unit', unit=unit)
    for name, uid in reversed(owned_users):
        try: actual = pwd.getpwnam(name)
        except KeyError: actual = None
        if actual:
            assert actual.pw_uid == uid and actual.pw_shell == '/usr/sbin/nologin'
            q.command(['/usr/sbin/userdel', name]); q.log('delete-kernel-user', name=name, uid=uid)
        try: group = grp.getgrnam(name)
        except KeyError: group = None
        if group:
            assert group.gr_gid == uid and not group.gr_mem
            q.command(['/usr/sbin/groupdel', name]); q.log('delete-kernel-group', name=name)
    for path in reversed(owned_paths):
        assert path.is_dir() and not path.is_symlink() and path.stat().st_uid == 0
        shutil.rmtree(path); q.log('remove-kernel-tree', path=str(path))


if __name__ == '__main__':
    try: main()
    except Exception as error: q.failed += 1; q.log('FATAL', error=str(error))
    finally:
        if owned_paths:
            try: cleanup()
            except Exception as error: q.failed += 1; q.log('CLEANUP-FAIL', error=str(error))
        q.log('KERNEL-TOTAL', passed=q.passed, failed=q.failed, productionBroker=False)
    sys.exit(bool(q.failed))
