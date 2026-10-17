"""Extension of qualify.py, never an independently armed installation harness.

Canonical registry -> installed provider service -> real broker/systemd workers ->
separate edge UID -> provider Unix HTTP. Caddy/network qualification is separate.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal

EDGE = 61053


def prepare(q, pools):
    module = 'wydhosting_worker'
    assert module not in q.command(['/usr/sbin/semodule', '-l']).stdout.split(), 'preexisting SELinux module'
    q.command(['/usr/sbin/semodule', '-i', str(q.RELEASE / 'node_modules/wydhosting/selinux/wydhosting_worker.cil')], timeout=90)
    q.finalizers.append(lambda: q.command(['/usr/sbin/semodule', '-r', module], timeout=90))
    q.log('install-selinux-module', module=module, sha256=hashlib.sha256((q.RELEASE/'node_modules/wydhosting/selinux/wydhosting_worker.cil').read_bytes()).hexdigest())
    q.command(['/usr/bin/chcon', '-R', '-t', 'wydhosting_runtime_t', str(q.RELEASE)])
    for path in (q.ROOT, q.ROOT/'pools'):
        q.command(['/usr/bin/chcon', '-t', 'wydhosting_root_t', str(path)])
    q.command(['/usr/sbin/restorecon', '-RF', str(q.ROOT/'broker'), str(q.ROOT/'uploads'), str(q.ROOT/'accounts')])
    q.command(['/usr/bin/chcon', '-t', 'wydhosting_provider_state_t', str(q.ROOT/'provider')])
    q.command(['/usr/bin/chcon', '-t', 'wydhosting_control_t', str(q.RUN)])
    q.command(['/usr/bin/chcon', '-t', 'wydhosting_run_t', str(q.RUN/'workers')])
    # Do not reuse a preexisting identity. The primary runner owns all other guards.
    for lookup in (q.pwd.getpwuid, q.grp.getgrgid):
        try: lookup(EDGE)
        except KeyError: pass
        else: raise RuntimeError('preexisting edge identity')
    for lookup in (q.pwd.getpwnam, q.grp.getgrnam):
        try: lookup('wyd-i56-edge')
        except KeyError: pass
        else: raise RuntimeError('preexisting edge name')
    # Independent canonical App identities and visible response markers.
    for p in pools:
        source = Path(p['deployments'][0]['source'])
        destination = source.with_name('deployment-' + p['poolId'])
        source.rename(destination)
        p['deployments'][0]['source'] = str(destination)
        file = Path(p['deployments'][0]['source']) / 'content/app.json'
        app = json.loads(file.read_text())
        app['id'] = p['poolId']
        app['properties']['title'] = 'Qualification tenant ' + p['poolId']
        file.write_text(json.dumps(app))
    script = q.RELEASE / 'qualification-registry.mjs'
    shutil.copyfile(Path(__file__).with_name(script.name), script)
    script.chmod(0o644)
    result = q.command([str(q.RELEASE / 'bin/node'), str(script), json.dumps(pools)],
                       user=q.PROVIDER, group=q.PROVIDER, extra_groups=[], timeout=60)
    approval = json.loads(result.stdout)
    q.command(['/usr/bin/chcon', '-R', '-t', 'wydhosting_provider_state_t', str(q.ROOT/'provider')])
    q.log('canonical-registry-plan', revision=approval['registryRevision'], digest=approval['registryDigest'],
          policyRevision=approval['policyRevision'], apps=[p['inventory']['apps'][0]['id'] for p in approval['pools']])
    return approval


def run(q, policy, broker):
    q.default_category = 'integrated-service'
    q.command(['/usr/sbin/groupadd', '--system', '--gid', str(EDGE), 'wyd-i56-edge'])
    q.users.append(('wyd-i56-edge', EDGE))
    q.command(['/usr/sbin/useradd', '--system', '--uid', str(EDGE), '--gid', str(EDGE), '--no-create-home', '--no-log-init', '--shell', '/usr/sbin/nologin', '--password', '!', 'wyd-i56-edge'])
    q.log('create-edge', uid=EDGE, gid=EDGE)
    for name, value in [('provider-approval.json', policy), ('provider.json', dict(schema='wydhosting.linux-provider/1', registryDirectory=str(q.ROOT/'provider'), approval=str(q.ETC/'provider-approval.json'), edgeUid=EDGE))]:
        file = q.ETC / name
        file.write_text(json.dumps(value)); os.chown(file, 0, q.PROVIDER); file.chmod(0o640)
        q.command(['/usr/bin/chcon', '-t', 'wydhosting_provider_config_t', str(file)])
    name = 'wydhosting-provider.service'
    text = (q.RELEASE / 'node_modules/wydhosting/templates' / name).read_text().replace('@PROVIDER_UID@', str(q.PROVIDER)).replace('@PROVIDER_GID@', str(q.PROVIDER))
    file = Path('/run/systemd/system') / name
    assert not file.exists()
    file.write_text(text); q.created.append(file); q.units.append(name)
    q.log('install-unit', path=str(file))
    q.command(['/usr/bin/systemd-analyze', 'verify', str(file)])
    q.command(['/usr/bin/systemctl', 'daemon-reload'])
    endpoint = q.RUN / 'provider/edge.sock'

    def show(field):
        return q.command(['/usr/bin/systemctl', 'show', name, '-p', field, '--value']).stdout.strip()

    def start():
        q.command(['/usr/bin/systemctl', 'start', name])
        def ready():
            assert show('ActiveState') != 'failed', 'provider service failed; inspect journal'
            return endpoint.exists()
        try:
            q.wait(ready, 45)
        finally:
            # Track exact broker-created unit names even when a later gate fails.
            for pool in policy['pools']:
                lease = q.ROOT/'broker'/('lease-'+broker.key(pool['poolId'])+'.json')
                if lease.exists():
                    unit = json.loads(lease.read_text())['unit']
                    assert unit.startswith('wydhosting-pool-'+broker.key(pool['poolId'])+'-') and unit.endswith('.service')
                    if unit not in q.units: q.units.append(unit)
        # Explicit reviewed edge group traversal; no worker or broker group grant.
        os.chown(endpoint.parent, q.PROVIDER, EDGE)
        os.chown(endpoint, q.PROVIDER, EDGE)
        q.log('edge-socket-group', uid=q.PROVIDER, gid=EDGE, mode=oct(endpoint.stat().st_mode & 0o777))
        return dict(pid=show('MainPID'), context=Path('/proc/'+show('MainPID')+'/attr/current').read_text().strip('\0\n'))

    def http(host='a.localhost', path='/', method='GET', body='', headers=None, uid=EDGE):
        headers = {'Host':host, 'X-Forwarded-Host':host, 'X-Forwarded-Proto':'https', **(headers or {})}
        code = '''import http.client,json,sys
c=http.client.HTTPConnection('localhost',timeout=8)
import socket
c.sock=socket.socket(socket.AF_UNIX);c.sock.settimeout(8);c.sock.connect(sys.argv[1])
c.request(sys.argv[2],sys.argv[3],body=sys.argv[4],headers=json.loads(sys.argv[5]));r=c.getresponse();b=r.read(1048576)
print(json.dumps(dict(status=r.status,body=b.decode(),headers=dict(r.getheaders()))));c.close()'''
        return json.loads(q.must_ok(q.as_uid(uid, code, endpoint, method, path, body, json.dumps(headers))))

    def response(status=200, marker=None, **kwargs):
        result = http(**kwargs)
        assert result['status'] == status, dict(status=result['status'], expected=status)
        if marker: assert marker in result['body'], 'wrong tenant response'
        if kwargs.get('method') == 'HEAD': assert result['body'] == ''
        return dict(status=result['status'], tenantMarker=marker)

    q.check('unconfined broker invocation refuses before release and socket', lambda: broker_unconfined_refusal(q), category='selinux-broker-mac')
    q.check('installed canonical provider service starts', start)
    if not endpoint.exists():
        for file in (q.RUN/'broker.sock', q.RUN, q.RUN/'provider', q.ROOT/'provider/supervisor'):
            if file.exists(): q.log('diagnostic-label', path=str(file), context=os.getxattr(file, 'security.selinux').decode().rstrip('\0'))
        return
    for letter in ('a', 'b'):
        q.check('edge -> canonical provider -> worker tenant '+letter, lambda l=letter: response(host=l+'.localhost', marker='Qualification tenant i56-'+l))
    q.check('provider rejects unknown hostname', lambda: response(status=421, host='unknown.localhost'))
    for headers in ({'Forwarded':'host=b.localhost'}, {'X-Forwarded-For':'127.0.0.1'}, {'X-Forwarded-Port':'443'}, {'X-Forwarded-Host':'b.localhost'}, {'X-Forwarded-Proto':'http'}, {'Connection':'X-Forwarded-Host'}):
        q.check('provider rejects spoofed headers '+','.join(headers), lambda h=headers: response(status=400, headers=h))
    q.check('HEAD status and empty response', lambda: response(method='HEAD'))
    q.check('unknown application route preserves 404', lambda: response(status=404, path='/absent-qualification-route'))
    q.check('unauthorized local identity cannot reach provider socket', lambda: q.denied(q.A, 'socket.socket(socket.AF_UNIX).connect(sys.argv[1])', endpoint))
    # Read only protected leases; log precise service identities for later cleanup/recovery.
    def leases():
        return [json.loads((q.ROOT/'broker'/('lease-'+broker.key(p['poolId'])+'.json')).read_text()) for p in policy['pools']]
    live = leases()
    q.units.extend(r['unit'] for r in live)
    for r in live:
        pool = next(p for p in policy['pools'] if p['base']==r['base'])
        q.check('integrated service identity '+r['unit'], lambda r=r,p=pool: broker.verify_process_identity(r['pid'], p['account'], p['selinuxCategory']) or q.effective_hardening(r))
        q.check('integrated cgroup limits '+pool['poolId'], lambda r=r: q.cgroup_limits(r))
        q.check('inherited control descriptor and no leaked regular files '+pool['poolId'], lambda r=r: descriptors(r['pid']))
        q.check('worker has no TCP listener '+pool['poolId'], lambda r=r: 'pid='+str(r['pid'])+',' not in q.command([shutil.which('ss'), '-lntpH']).stdout)
        q.check('edge UID cannot bypass provider to worker '+pool['poolId'], lambda r=r: q.denied(EDGE, 'socket.socket(socket.AF_UNIX).connect(sys.argv[1])', q.RUN/'workers'/r['generation']/'http.sock'))
        q.log('integrated-worker', **r)
    for field in ('unitHash', 'invocation'):
        lease = q.ROOT/'broker'/('lease-'+broker.key(policy['pools'][0]['poolId'])+'.json')
        original = lease.read_bytes()
        try:
            stale = json.loads(original); stale[field] = '0'*len(stale[field]); lease.write_text(json.dumps(stale))
            q.check('broker refuses conflicting durable '+field, lambda: q.refused(q.request(policy, 'status'), 'BROKER.OWNERSHIP'), category='broker-ownership')
        finally: lease.write_bytes(original)
    q.check('broker actual confined hostile boundaries', lambda: broker_mac_probe(q), category='selinux-broker-mac')
    q.check('MAC same UID hostile category boundaries', lambda: mac_probe(q), category='selinux-mac')
    if (q.RELEASE/'bin/caddy').exists():
        proxy(q, response)
    q.check('actual worker private tmpfs ENOSPC and sibling survival', lambda: temporary_exhaustion(q, *leases(), response), category='integrated-resource')
    for resource in ('fd', 'tasks', 'cpu'):
        q.check('bounded worker cgroup native '+resource+' pressure and sibling survival', lambda resource=resource: bounded_resource_probe(q, *leases(), response, resource), category='integrated-resource')
    for mode in ('SIGKILL', 'OOM'):
        q.default_category = 'service-recovery'
        before = leases()
        if mode == 'SIGKILL':
            q.command(['/usr/bin/systemctl', 'kill', '--kill-whom=main', '--signal=KILL', before[0]['unit']])
        else:
            pressure(q, before[0])
        def replaced():
            current = leases()[0]
            if current['generation'] == before[0]['generation'] or current['state'] != 'running': return False
            if current['unit'] not in q.units: q.units.append(current['unit'])
            return http()['status'] == 200
        q.check('integrated worker '+mode+' replacement uses a fresh authorized lifetime', lambda: q.wait(replaced, 25))
        q.check('healthy canonical sibling survives '+mode, lambda: leases()[1]['generation'] == before[1]['generation'] and response(host='b.localhost', marker='Qualification tenant i56-b'))
        if mode == 'OOM':
            q.check('actual worker service records oom-kill', lambda: q.command(['/usr/bin/systemctl', 'show', before[0]['unit'], '-p', 'Result', '--value']).stdout.strip() == 'oom-kill', category='integrated-resource')
    live = leases(); q.units.extend(r['unit'] for r in live if r['unit'] not in q.units)
    q.check('manager daemon-reload preserves active routing', lambda: q.command(['/usr/bin/systemctl', 'daemon-reload']).returncode == 0 and response(host='b.localhost'))
    # Deliberate overlap, bounded to four fresh provider lifetimes. No retries
    # around stop/restart failures: every failure remains an individual result.
    for cycle in range(4):
        live = leases(); q.units.extend(r['unit'] for r in live if r['unit'] not in q.units)
        def overlap(records=live, cycle=cycle):
            import concurrent.futures
            sessions = [q.bound_session(r) for r in records]
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                actions = [lambda: q.command(['/usr/bin/systemctl', 'stop', name])]
                actions.extend(lambda r=r: q.command(['/usr/bin/systemctl', 'kill', '--kill-whom=main', '--signal=KILL', r['unit']], check=False) for r in records)
                results = list(executor.map(lambda action: action(), actions))
            assert results[0].returncode == 0
            assert all(broker.cgroup_empty(r) for r in records)
            current = leases()
            assert all(r['state'] == 'stopped' for r in current), [r['state'] for r in current]
            for session in sessions:
                journal = q.command(['/usr/bin/journalctl', '-u', session, '-n', '20', '--no-pager', '-o', 'cat']).stdout
                events = [json.loads(line) for line in journal.splitlines() if line.startswith('{"schema":"wydhosting.admin-event/1"')]
                q.log('retirement-audit', cycle=cycle, session=session, events=events)
                assert any(e.get('operation') == 'launch' and e.get('outcome') == 'completed' for e in events), 'broker did not complete retirement'
            q.log('retirement-overlap', cycle=cycle, states=[r['state'] for r in current], workerKillResults=[r.returncode for r in results[1:]])
            return True
        q.check('concurrent sibling termination and provider retirement '+str(cycle), overlap, category='retirement-race')
        q.check('fresh provider lifetime after overlapping retirement '+str(cycle), start, category='retirement-race')
        q.check('both tenant routes after overlapping retirement '+str(cycle), lambda: response() and response(host='b.localhost'), category='retirement-race')
    live = leases(); q.units.extend(r['unit'] for r in live if r['unit'] not in q.units)
    q.command(['/usr/bin/systemctl', 'stop', name])
    q.check('provider graceful stop empties both worker cgroups', lambda: all(broker.cgroup_empty(r) for r in live))
    def retired_jobs(records):
        for r in records:
            job_id = broker.key(('i56-a' if r['unit'].startswith('wydhosting-pool-'+broker.key('i56-a')+'-') else 'i56-b') + r['generation'])
            assert not (q.RUN/('job-'+job_id+'.json')).exists()
            assert not (q.RUN/('worker-'+job_id+'.sock')).exists()
        return True
    q.check('automatic exact job retirement after graceful provider stop', lambda: retired_jobs(live), category='resource-retirement')
    q.check('provider restart from durable stopped leases', start)
    q.check('provider restart restores correct tenant response', lambda: response(host='b.localhost', marker='Qualification tenant i56-b'))
    live = leases(); q.units.extend(r['unit'] for r in live)
    session = q.bound_session(live[0])
    q.command(['/usr/bin/systemctl', 'kill', '--kill-whom=main', '--signal=KILL', session])
    q.check('confined worker reaped independently after broker SIGKILL', lambda: q.wait(lambda: broker.cgroup_empty(live[0]), 20))
    q.check('sibling canonical route survives broker SIGKILL', lambda: response(host='b.localhost', marker='Qualification tenant i56-b'))
    q.check('lost broker authority refuses stale route', lambda: response(status=503))
    q.check('explicit interrupted confined lease reconciliation', lambda: q.accepted(q.request(policy, 'reconcile', 'i56-a')))
    q.check('broker death reconciliation retires exact job', lambda: retired_jobs([live[0]]), category='resource-retirement')
    q.check('repeated retirement reconciliation is idempotent', lambda: q.accepted(q.request(policy, 'reconcile', 'i56-a')) and retired_jobs([live[0]]), category='resource-retirement')
    q.command(['/usr/bin/systemctl', 'kill', '--kill-whom=main', '--signal=KILL', name])
    q.check('provider SIGKILL independently retires both workers', lambda: q.wait(lambda: all(broker.cgroup_empty(r) for r in live), 25))
    q.command(['/usr/bin/systemctl', 'stop', name], check=False)
    q.command(['/usr/bin/systemctl', 'reset-failed', name], check=False)
    # Stale lock must fail closed; no stale PID or registry may authorize adoption.
    q.command(['/usr/bin/systemctl', 'start', name], check=False)
    q.wait(lambda: show('ActiveState') == 'failed', 15)
    q.check('provider refuses stale supervisor ownership after SIGKILL', lambda: show('ExecMainStatus') == '1' and all(broker.cgroup_empty(r) for r in live))
    q.log('integrated-limitations', caddy='loopback-only' if (q.RELEASE/'bin/caddy').exists() else 'not-executed', externalNetwork='not-executed', reboot='not-executed', mac='provider-and-worker-MCS; edge-and-broker-confined; qualification-incomplete', recovery='stale-lock-requires-operator-review')


def descriptors(pid):
    fds = {int(p.name): os.readlink(p) for p in Path('/proc/'+str(pid)+'/fd').iterdir()}
    assert fds[3].startswith('socket:'), 'control FD missing'
    assert all(v.startswith(('socket:', 'pipe:', 'anon_inode:')) or v == '/dev/null' for v in fds.values()), 'unexpected open regular file'
    return dict(control=3, openDescriptors=len(fds), leakedRegularFiles=0)


def pressure(q, record):
    # Root-owned hostile helper joins ONLY this recorded worker cgroup. It is not
    # an App capability. The real 256 MiB cgroup bounds total worker/helper memory;
    # helper additionally has a 512 MiB address-space and 3 CPU-second ceiling.
    import subprocess
    code = '''import os,resource,signal
resource.setrlimit(resource.RLIMIT_AS,(536870912,536870912))
resource.setrlimit(resource.RLIMIT_CPU,(3,3))
os.kill(os.getpid(),signal.SIGSTOP)
blocks=[]
for i in range(48):blocks.append(bytearray(8388608))
raise RuntimeError('memory enforcement failed')
'''
    child = subprocess.Popen(['/usr/bin/python3','-I','-c',code],user=q.A,group=q.A,extra_groups=[],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    q.processes.append(child)
    try:
        q.wait(lambda: '\nState:\tT' in Path('/proc/'+str(child.pid)+'/status').read_text(), 5)
        cgroup = Path('/sys/fs/cgroup'+record['cgroup'])
        assert (cgroup/'memory.max').read_text().strip() == '268435456'
        (cgroup/'cgroup.procs').write_text(str(child.pid))
        assert Path('/proc/'+str(child.pid)+'/cgroup').read_text() == '0::'+record['cgroup']+'\n'
        child.send_signal(signal.SIGCONT)
        child.wait(timeout=15)
        assert child.returncode == -signal.SIGKILL, child.returncode
        q.log('bounded-integrated-memory-pressure', unit=record['unit'], cgroupMemoryMax=268435456, helperAddressSpaceMax=536870912, helperAllocationCeiling=402653184, helperCpuSeconds=3, deadlineSeconds=15, helperSignal='SIGKILL')
    finally:
        if child.poll() is None: child.kill(); child.wait(timeout=5)


def bounded_resource_probe(q, record, sibling, response, mode):
    """Native administrator injection into an exact live worker cgroup, never host."""
    import subprocess
    assert mode in ('fd', 'tasks', 'cpu')
    proc = Path('/proc/'+str(record['pid']))
    assert proc.joinpath('stat').read_text().rsplit(') ',1)[1].split()[19] == record['startTime']
    assert Path('/proc/'+str(sibling['pid'])+'/stat').read_text().rsplit(') ',1)[1].split()[19] == sibling['startTime']
    uid = proc.stat().st_uid
    assert uid in (q.A, q.B)
    cgroup = Path('/sys/fs/cgroup'+record['cgroup'])
    assert (cgroup/'pids.max').read_text().strip() == '32'
    assert (cgroup/'memory.max').read_text().strip() == '268435456'
    assert (cgroup/'cpu.max').read_text().strip() == '25000 100000'
    assert next(line.split()[3:5] for line in proc.joinpath('limits').read_text().splitlines() if line.startswith('Max open files')) == ['128', '128']
    def counters(name): return dict(line.split() for line in (cgroup/name).read_text().splitlines())
    before_tasks = int(counters('pids.events')['max'])
    before_cpu = int(counters('cpu.stat')['nr_throttled'])
    code = '''import errno,json,os,resource,signal,sys,time
resource.setrlimit(resource.RLIMIT_AS,(67108864,67108864))
resource.setrlimit(resource.RLIMIT_CPU,(2,2))
resource.setrlimit(resource.RLIMIT_NOFILE,(128,128))
os.kill(os.getpid(),signal.SIGSTOP)
mode=sys.argv[1];value={}
if mode=='fd':
 handles=[]
 try:
  for _ in range(160):
   try: handles.append(os.open('/dev/null',os.O_RDONLY))
   except OSError as error:
    assert error.errno==errno.EMFILE;value=dict(result='EMFILE',opened=len(handles));break
  assert value
 finally:
  for fd in handles:os.close(fd)
elif mode=='tasks':
 children=[]
 try:
  for _ in range(40):
   try: pid=os.fork()
   except OSError as error:
    assert error.errno==errno.EAGAIN;value=dict(result='EAGAIN',children=len(children));break
   if pid==0:time.sleep(2);os._exit(0)
   children.append(pid)
  assert value
 finally:
  for pid in children:os.waitpid(pid,0)
else:
 end=time.process_time()+.3
 while time.process_time()<end:pass
 value=dict(result='bounded CPU work',cpuSeconds=.3)
print(json.dumps(value))
'''
    child = subprocess.Popen(['/usr/bin/python3','-I','-c',code,mode],user=uid,group=uid,extra_groups=[],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    q.processes.append(child)
    try:
        q.wait(lambda: '\nState:\tT' in Path('/proc/'+str(child.pid)+'/status').read_text(),5)
        (cgroup/'cgroup.procs').write_text(str(child.pid))
        assert Path('/proc/'+str(child.pid)+'/cgroup').read_text() == '0::'+record['cgroup']+'\n'
        child.send_signal(signal.SIGCONT)
        response(host='b.localhost')
        out, err = child.communicate(timeout=10)
        assert child.returncode == 0, err
        value = json.loads(out)
        if mode=='tasks': assert int(counters('pids.events')['max']) > before_tasks
        if mode=='cpu': assert int(counters('cpu.stat')['nr_throttled']) > before_cpu
        response(); response(host='b.localhost')
        assert not (cgroup/'pids.current').read_text().strip() == '32'
        return dict(injection='administrator-native-helper', unit=record['unit'], **value,
            pidsDeniedDelta=int(counters('pids.events')['max'])-before_tasks,
            throttledPeriodsDelta=int(counters('cpu.stat')['nr_throttled'])-before_cpu,
            helperMemoryMax=67108864, helperCpuSeconds=2, helperDescriptorMax=128,
            helperForkCeiling=40, deadlineSeconds=10, sibling='HTTP 200', recovery='HTTP 200')
    finally:
        if child.poll() is None: child.kill(); child.wait(timeout=5)


def temporary_exhaustion(q, record, sibling, response):
    # Administrator fault injection into the actual private worker mount, not a
    # portable filesystem capability or a claim about confined library tmp use.
    import ctypes
    import errno
    for item in (record, sibling):
        assert Path('/proc/'+str(item['pid'])+'/stat').read_text().rsplit(') ',1)[1].split()[19] == item['startTime']
    descriptors = []
    name = '.wyd-i56-capacity-'+q.uuid.uuid4().hex
    created = []
    try:
        for item in (record, sibling):
            descriptors.append(os.open('/proc/'+str(item['pid'])+'/root/tmp', os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC))
        capacities = []
        for index, fd in enumerate(descriptors):
            buffer = ctypes.create_string_buffer(256)
            assert ctypes.CDLL(None, use_errno=True).fstatfs(fd, buffer) == 0
            item = (record,sibling)[index]
            mounts = [line for line in Path('/proc/'+str(item['pid'])+'/mountinfo').read_text().splitlines() if line.split()[4] == '/tmp']
            q.log('actual-worker-temporary-mount', unit=item['unit'], magic=hex(ctypes.c_long.from_buffer(buffer).value), mounts=mounts)
            assert ctypes.c_long.from_buffer(buffer).value == 0x01021994, 'refuse non-tmpfs'
            assert len(mounts) == 1 and {'nosuid','nodev','noexec'} <= set(mounts[0].split()[5].split(','))
            assert os.fstat(fd).st_uid == (q.A,q.B)[index] and os.fstat(fd).st_mode & 0o777 == 0o700
            stat = os.fstatvfs(fd); size = stat.f_blocks*stat.f_frsize
            assert 0 < size <= 8388608, 'refuse unbounded mount'
            capacities.append(size)
        assert os.fstat(descriptors[0]).st_dev != os.fstat(descriptors[1]).st_dev, 'shared temporary filesystem'
        before = [os.fstatvfs(fd).f_bavail for fd in descriptors]
        code = '''import errno,json,os,resource,sys
resource.setrlimit(resource.RLIMIT_CPU,(2,2));resource.setrlimit(resource.RLIMIT_AS,(67108864,67108864));resource.setrlimit(resource.RLIMIT_NOFILE,(32,32))
parent=int(sys.argv[1]);size=int(sys.argv[3]);resource.setrlimit(resource.RLIMIT_FSIZE,(size+65536,size+65536))
fd=os.open(sys.argv[2],os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent)
written=0;denied=None
try:
 while written<=size:
  try:written+=os.write(fd,b'x'*65536)
  except OSError as error:
   assert error.errno==errno.ENOSPC;denied='ENOSPC';break
finally:os.close(fd)
assert denied=='ENOSPC' and written<=size
print(json.dumps(dict(bytesWritten=written,result=denied)))
'''
        created.append((0, name))
        value = json.loads(q.command(['/usr/bin/python3','-I','-c',code,str(descriptors[0]),name,str(capacities[0])],pass_fds=(descriptors[0],),timeout=10).stdout)
        assert os.fstatvfs(descriptors[1]).f_bavail == before[1]
        try: os.stat(name, dir_fd=descriptors[1], follow_symlinks=False)
        except FileNotFoundError: pass
        else: raise AssertionError('sibling saw foreign temporary file')
        response(); response(host='b.localhost')
        other_name = name+'-sibling'; created.append((1, other_name))
        second = json.loads(q.command(['/usr/bin/python3','-I','-c',code,str(descriptors[1]),other_name,str(capacities[1])],pass_fds=(descriptors[1],),timeout=10).stdout)
        assert second['result'] == 'ENOSPC' and os.fstatvfs(descriptors[0]).f_bavail == 0
        response(); response(host='b.localhost')
        return dict(simultaneouslyExhaustedTenants=2, secondTenant=second, injection='administrator-held-private-mount', capacityBytes=capacities[0], **value, helperMemoryMax=67108864, helperCpuSeconds=2, helperDeadlineSeconds=10, sibling='HTTP 200; separate mount unchanged')
    finally:
        try:
            for index, filename in created:
                try: os.unlink(filename, dir_fd=descriptors[index])
                except FileNotFoundError: pass
                assert os.fstatvfs(descriptors[index]).f_bavail == before[index], 'temporary allocation not reclaimed'
        finally:
            for fd in descriptors: os.close(fd)


def broker_unconfined_refusal(q):
    result = q.command(['/usr/bin/python3', '-I', str(q.RELEASE/'node_modules/wydhosting/broker/broker.py')], check=False)
    assert result.returncode == 70, result.returncode
    event = json.loads(result.stderr)
    assert event == dict(schema='wydhosting.startup-event/1',outcome='refused',phase='selinux-domain',code='BROKER.SELINUX_DOMAIN'), event
    return event


def broker_mac_probe(q):
    """Root-reviewed hostile canary; no publisher/broker operation exposes this."""
    result = q.ROOT/'broker'/'mac-result.json'
    foreign = q.ROOT/'provider'/'broker-mac-canary'
    foreign.write_text('public qualification canary'); foreign.chmod(0o666)
    foreign_unit = 'wyd-i56-broker-foreign.service'; q.units.append(foreign_unit)
    foreign_dir = q.RUN/'broker-mac-socket'; q.mkdir(foreign_dir, 0o700)
    q.command(['/usr/bin/chcon', '-t', 'wydhosting_provider_run_t', str(foreign_dir)])
    q.command(['/usr/bin/systemd-run', '--quiet', '--unit='+foreign_unit,
        '--property=Type=exec', '--property=User=root', '--property=SELinuxContext=system_u:system_r:wydhosting_provider_t:s0',
        '--property=NoNewPrivileges=yes', '--property=CapabilityBoundingSet=', '--property=MemoryMax=64M',
        '--property=MemorySwapMax=0', '--property=TasksMax=16', '--property=CPUQuota=25%',
        '--property=RuntimeMaxSec=15s', '--property=TimeoutStopSec=2s',
        str(q.RELEASE/'bin/node'), '-e', "require('node:net').createServer().listen('/run/wydhosting/broker-mac-socket/foreign.sock');setTimeout(()=>process.exit(0),12000)"])
    q.wait(lambda: (foreign_dir/'foreign.sock').exists(), 5)
    os.rename(foreign_dir/'foreign.sock', q.RUN/'broker-foreign.sock')
    q.command(['/usr/bin/chcon', '-t', 'wydhosting_control_t', str(q.RUN/'broker-foreign.sock')])
    pid = int(q.command(['/usr/bin/systemctl', 'show', foreign_unit, '-p', 'MainPID', '--value']).stdout)
    assert pid > 0 and Path('/proc/'+str(pid)).stat().st_uid == 0
    assert Path('/proc/'+str(pid)+'/attr/current').read_text().strip('\0\n') == 'system_u:system_r:wydhosting_provider_t:s0'
    script = q.RELEASE/'broker-mac-canary.py'
    script.write_text('''import errno,json,os,socket,subprocess,sys
from pathlib import Path
context=Path('/proc/self/attr/current').read_text().strip('\\0\\n')
assert context=='system_u:system_r:wydhosting_broker_t:s0',context
outcomes={}
def denied(name,operation):
 try: operation()
 except OSError as error:
  assert error.errno in (errno.EACCES,errno.EPERM), (name,error.errno)
  outcomes[name]=errno.errorcode[error.errno]
 else: raise AssertionError(name+' unexpectedly allowed')
denied('foreign-provider-file',lambda:Path(sys.argv[2]).read_bytes())
denied('system-file-write',lambda:os.open('/etc/hostname',os.O_WRONLY))
denied('arbitrary-shell',lambda:subprocess.run(['/bin/sh','-c','exit 0'],check=True,timeout=2))
denied('generic-executable',lambda:subprocess.run(['/usr/bin/true'],check=True,timeout=2))
denied('account-tool-useradd',lambda:subprocess.run(['/usr/sbin/useradd','--help'],check=True,timeout=2))
denied('account-tool-groupadd',lambda:subprocess.run(['/usr/sbin/groupadd','--help'],check=True,timeout=2))
denied('shared-passwd-write',lambda:os.open('/etc/passwd',os.O_WRONLY))
denied('shared-shadow-read',lambda:Path('/etc/shadow').read_bytes())
denied('shared-shadow-write',lambda:os.open('/etc/shadow',os.O_WRONLY))
denied('provisioning-proof-write',lambda:os.open(next(Path('/etc/wydhosting/accounts').glob('*.json')),os.O_WRONLY))
denied('tcp-socket',lambda:socket.socket(socket.AF_INET))
denied('provider-signal',lambda:os.kill(int(sys.argv[3]),18))
s=socket.socket(socket.AF_UNIX)
denied('provider-socket',lambda:s.connect('/run/wydhosting/broker-foreign.sock'))
p=Path(sys.argv[1]);p.write_text('{}')
denied('foreign-relabel',lambda:os.setxattr(p,'security.selinux',b'system_u:object_r:etc_t:s0'))
attempt=subprocess.run(['/usr/bin/systemctl','start','wyd-i56-broker-foreign.service'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=2)
assert attempt.returncode!=0,'foreign service unexpectedly authorized'
outcomes['foreign-service']='refused'
p.write_text(json.dumps(dict(pid=os.getpid(),context=context,outcomes=outcomes)))
''')
    q.command(['/usr/sbin/restorecon', '-F', str(script)])
    unit = 'wyd-i56-broker-mac-probe.service'; q.units.append(unit)
    properties = ['SELinuxContext=system_u:system_r:wydhosting_broker_t:s0', 'NoNewPrivileges=yes',
        'CapabilityBoundingSet=CAP_CHOWN CAP_DAC_OVERRIDE CAP_FOWNER CAP_SETUID CAP_SETGID CAP_AUDIT_WRITE',
        'MemoryMax=64M', 'MemorySwapMax=0', 'TasksMax=8', 'CPUQuota=25%', 'RuntimeMaxSec=10s',
        'TimeoutStopSec=2s', 'LimitNOFILE=64', 'RestrictAddressFamilies=AF_UNIX AF_INET']
    # AF_INET deliberately permitted by the fixture's syscall filter, so its socket
    # denial measures MAC. Normal broker systemd restrictions remain unchanged.
    audit_offset = Path('/var/log/audit/audit.log').stat().st_size
    attempt = q.command(['/usr/bin/systemd-run', '--quiet', '--wait', '--unit='+unit,
        *['--property='+p for p in properties], '/usr/bin/python3', '-I', str(script), str(result), str(foreign), str(pid)], check=False)
    assert attempt.returncode == 0, q.command(['/usr/bin/journalctl', '-u', unit, '-n', '20', '--no-pager', '-o', 'cat']).stdout
    value = json.loads(result.read_text())
    assert len(value['outcomes']) == 15, value
    with open('/var/log/audit/audit.log') as audit:
        audit.seek(audit_offset); lines = audit.readlines()
    evidence = [line.strip() for line in lines if 'avc:' in line and 'denied' in line and 'scontext=system_u:system_r:wydhosting_broker_t:s0 ' in line and 'permissive=0' in line]
    for kind in ('file','process','tcp_socket','unix_stream_socket'):
        assert any('tclass='+kind in line and 'pid='+str(value['pid'])+' ' in line for line in evidence), (kind,evidence)
    for permission, target in (('execute_no_trans','bin_t'),('execute','shell_exec_t'),('start','init_t'),('relabelfrom','wydhosting_broker_state_t')):
        assert any('{ '+permission+' }' in line and ':'+target+':' in line for line in evidence), (permission,evidence)
    return dict(**value, avcs=evidence)


def mac_probe(q):
    # Deliberately make DAC allow both files to the SAME numeric UID. The denied
    # foreign category therefore demonstrates independent MAC, not UID isolation.
    root = q.ROOT/'mac-canary'
    root.mkdir(mode=0o777); root.chmod(0o777)
    q.command(['/usr/bin/chcon', '-t', 'wydhosting_run_t', '-l', 's0', str(root)])
    for name, category in (('own',51), ('foreign',52)):
        file = root/name; file.write_text('canary'); file.chmod(0o666); os.chown(file, q.A, q.A)
        q.command(['/usr/bin/chcon', '-t', 'wydhosting_data_t', '-l', 's0:c'+str(category), str(file)])
    output = root/'result'; output.write_text(''); output.chmod(0o666)
    q.command(['/usr/bin/chcon', '-t', 'wydhosting_data_t', '-l', 's0:c51', str(output)])
    for label, category in (('own-exec',51), ('foreign-exec',52)):
        file = root/label; shutil.copyfile('/usr/bin/true', file); file.chmod(0o755)
        q.command(['/usr/bin/chcon', '-t', 'wydhosting_runtime_t', '-l', 's0:c'+str(category), str(file)])
    unit = 'wyd-i56-mac-probe.service'; q.units.append(unit)
    code = '''import errno,json,os,signal,socket,subprocess,sys
from pathlib import Path
p=Path(sys.argv[1]);result={}
def mark(stage):
 result['stage']=stage;(p/'result').write_text(json.dumps(result))
result['context']=Path('/proc/self/attr/current').read_text().strip('\\0\\n')
result['pid']=os.getpid()
mark('own-file')
assert (p/'own').read_text()=='canary';(p/'own').write_text('same-category');result['own']='read/write'
mark('own-execute')
assert subprocess.run([str(p/'own-exec')],check=False).returncode==0;result['ownExecute']='success'
mark('own-signal')
os.kill(os.getpid(),signal.SIGCONT);result['ownSignal']='success'
for name,operation in [('read',lambda:(p/'foreign').read_text()),('write',lambda:(p/'foreign').write_text('attack')),('relabel',lambda:os.setxattr(p/'foreign','security.selinux',b'system_u:object_r:wydhosting_data_t:s0:c51')),('socket',lambda:socket.socket(socket.AF_UNIX).connect(str(p/'foreign.sock'))),('signal',lambda:os.kill(int(sys.argv[2]),signal.SIGCONT)),('inspect',lambda:open('/proc/'+sys.argv[2]+'/mem','rb')),('execute',lambda:subprocess.run([str(p/'foreign-exec')],check=False))]:
 mark(name)
 try:operation()
 except OSError as e:assert e.errno in (errno.EACCES,errno.EPERM);result[name]=errno.errorcode[e.errno]
 else:raise RuntimeError('foreign category permitted')
mark('complete')
'''
    properties = [f'User={q.A}',f'Group={q.A}','SELinuxContext=system_u:system_r:wydhosting_worker_t:s0:c51','NoNewPrivileges=yes','CapabilityBoundingSet=','RestrictSUIDSGID=yes','RestrictNamespaces=yes','RestrictAddressFamilies=AF_UNIX','ProtectSystem=strict','ProtectHome=yes','PrivateDevices=yes','PrivateTmp=yes','MemoryMax=64M','MemorySwapMax=0','TasksMax=16','CPUQuota=25%','RuntimeMaxSec=15s','TimeoutStopSec=2s','LimitNOFILE=64','ReadWritePaths='+str(root)]
    server_unit = 'wyd-i56-mac-sibling.service'; q.units.append(server_unit)
    server_code = '''import os,socket,sys,time
s=socket.socket(socket.AF_UNIX);s.bind(sys.argv[1]);os.chmod(sys.argv[1],0o666);s.listen(4);time.sleep(90)
'''
    server_properties = [p.replace('s0:c51','s0:c52').replace('RuntimeMaxSec=15s','RuntimeMaxSec=90s') for p in properties]
    q.command(['/usr/bin/systemd-run', '--unit='+server_unit, '--service-type=exec', *['--property='+p for p in server_properties], '/usr/bin/python3', '-I', '-c', server_code, str(root/'foreign.sock')])
    q.wait(lambda: (root/'foreign.sock').exists(), 5)
    q.command(['/usr/bin/chcon', '-l', 's0:c52', str(root/'foreign.sock')])
    q.must_ok(q.as_uid(q.A, 'import socket,sys;s=socket.socket(socket.AF_UNIX);s.connect(sys.argv[1]);s.close()', root/'foreign.sock'))
    foreign_pid = q.command(['/usr/bin/systemctl','show',server_unit,'-p','MainPID','--value']).stdout.strip()
    q.log('MAC-sibling', uid=q.A, context=Path('/proc/'+foreign_pid+'/attr/current').read_text().strip('\0\n'), socketContext=os.getxattr(root/'foreign.sock','security.selinux').decode().rstrip('\0'))
    # Temporarily expose policy-suppressed denials. This changes logging only;
    # enforcing mode and all access decisions remain intact. Restore immediately.
    assert not Path('/var/lib/selinux/targeted/active/disable_dontaudit').exists()
    q.command(['/usr/sbin/semodule', '-DB'], timeout=90)
    try:
        q.command(['/usr/bin/systemd-run', '--unit='+unit, '--wait', '--service-type=exec', *['--property='+p for p in properties], '/usr/bin/python3', '-I', '-c', code, str(root), foreign_pid])
    finally:
        try:
            if output.read_text(): q.log('MAC-progress', **json.loads(output.read_text()))
            audit = q.command(['/usr/sbin/ausearch', '-m', 'AVC,USER_AVC', '-ts', 'recent', '-i'], check=False).stdout
            evidence = [line for line in audit.splitlines() if 'avc:' in line and 'scontext=system_u:system_r:wydhosting_worker_t:s0:c51 ' in line and ':s0:c52 ' in line and 'permissive=0' in line]
            q.log('MAC-audit', lines=evidence[-16:])
            value = json.loads(output.read_text())
            own = [line for line in evidence if 'pid='+str(value['pid'])+' ' in line]
            for permission, target in (('read','name=foreign '),('write','name=foreign '),('relabelfrom','name=foreign '),('write','name=foreign.sock '),('signal','tclass=process'),('search','tclass=dir')):
                assert any('{ '+permission+' }' in line and target in line for line in own), 'missing current-probe AVC: '+permission+' '+target
            assert any('{ execute }' in line and 'name=foreign-exec ' in line and 'ino='+str((root/'foreign-exec').stat().st_ino)+' ' in line for line in evidence), 'missing execution AVC'
        finally:
            q.command(['/usr/sbin/semodule', '-B'], timeout=90)
            q.command(['/usr/bin/systemctl', 'stop', server_unit], check=False)
    def result():
        value = json.loads((root/'result').read_text())
        assert value['context'] == 'system_u:system_r:wydhosting_worker_t:s0:c51'
        assert (root/'foreign').read_text() == 'canary'
        return value
    return result()


def proxy(q, response):
    """Actual Caddy with the shipped routing template; loopback TLS only."""
    def check(name, function):
        q.check(name, function, category='proxy-loopback')
    cert, key, config = (q.ETC/name for name in ('edge.crt', 'edge.key', 'Caddyfile'))
    shutil.copyfile(q.BUILD/'proxy/edge.crt', cert)
    shutil.copyfile(q.BUILD/'proxy/edge.key', key)
    for file in (cert, key):
        file.chmod(0o640); os.chown(file, 0, EDGE)
    template = (q.RELEASE/'node_modules/wydhosting/templates/Caddyfile').read_text()
    block = template.replace('@HOSTNAME@', 'a.localhost, b.localhost').replace('@CERTIFICATE@', str(cert)).replace('@PRIVATE_KEY@', str(key))
    # Both named and reject sites bind only loopback. No public listener.
    for site in ('a.localhost, b.localhost', ':443'):
        block = block.replace(site+' {', site+' {\n    bind 127.0.0.1 ::1')
    config.write_text(block)
    config.chmod(0o640); os.chown(config, 0, EDGE)
    # Separate explicitly selected confined edge domain; no automatic transition.
    proxy_root = q.RELEASE.parent/'edge'
    proxy_root.mkdir(mode=0o755)
    shutil.copyfile(q.RELEASE/'bin/caddy', proxy_root/'caddy')
    (proxy_root/'caddy').chmod(0o755)
    q.command(['/usr/sbin/restorecon', '-RF', str(proxy_root)])
    state = q.ROOT/'edge'; state.mkdir(mode=0o700); os.chown(state, EDGE, EDGE)
    q.command(['/usr/sbin/restorecon', '-F', str(cert), str(key), str(config), str(state)])
    binary = str(proxy_root/'caddy')
    check('Caddy generated configuration validates', lambda: q.command([binary, 'validate', '--config', str(config), '--adapter', 'caddyfile'], user=EDGE, group=EDGE, extra_groups=[], env={'HOME':str(state), 'XDG_DATA_HOME':str(state), 'XDG_CONFIG_HOME':str(state)}).returncode == 0)
    unit = 'wyd-i56-edge.service'
    path = Path('/run/systemd/system')/unit
    assert not path.exists()
    path.write_text(f'''[Service]
Type=exec
User={EDGE}
Group={EDGE}
SELinuxContext=system_u:system_r:wydhosting_edge_t:s0
ExecStart={binary} run --config {config} --adapter caddyfile
Environment=HOME={state} XDG_DATA_HOME={state} XDG_CONFIG_HOME={state} GOMAXPROCS=1 GOMEMLIMIT=96MiB
NoNewPrivileges=yes
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
RestrictNamespaces=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
ReadWritePaths={state}
RuntimeMaxSec=180s
MemoryMax=128M
MemorySwapMax=0
CPUQuota=25%
TasksMax=32
LimitNOFILE=256
LimitCORE=0
TimeoutStopSec=3s
KillMode=control-group
''')
    q.created.append(path); q.units.append(unit)
    q.command(['/usr/bin/systemctl', 'daemon-reload'])
    q.command(['/usr/bin/systemctl', 'start', unit])
    def confined():
        pid = q.command(['/usr/bin/systemctl', 'show', unit, '-p', 'MainPID', '--value']).stdout.strip()
        context = Path('/proc/'+pid+'/attr/current').read_text().strip('\0\n')
        assert context == 'system_u:system_r:wydhosting_edge_t:s0', context
        return dict(context=context)
    q.check('Caddy actual confined domain', confined, category='selinux-mac')
    def edge_denial():
        # The exact same readable valid config succeeds outside the edge domain.
        # Under edge_t, a tenant-data label must deny it independently of DAC.
        canary = q.ETC/'edge-denied'; shutil.copyfile(config, canary); canary.chmod(0o444)
        q.command(['/usr/bin/chcon','-t','wydhosting_data_t','-l','s0:c52',str(canary)])
        q.command([binary,'validate','--config',str(canary),'--adapter','caddyfile'], user=EDGE,group=EDGE,extra_groups=[])
        probe = 'wyd-i56-edge-denial.service'; q.units.append(probe)
        properties = [f'User={EDGE}',f'Group={EDGE}','SELinuxContext=system_u:system_r:wydhosting_edge_t:s0','NoNewPrivileges=yes','CapabilityBoundingSet=','MemoryMax=64M','MemorySwapMax=0','TasksMax=16','CPUQuota=25%','RuntimeMaxSec=15s','TimeoutStopSec=2s','LimitNOFILE=64','Environment=GOMAXPROCS=1 GOMEMLIMIT=48MiB','RestrictAddressFamilies=AF_UNIX']
        result = q.command(['/usr/bin/systemd-run','--unit='+probe,'--wait','--service-type=exec',*['--property='+p for p in properties],binary,'validate','--config',str(canary),'--adapter','caddyfile'],check=False)
        status = q.command(['/usr/bin/systemctl','show',probe,'-p','ExecMainStatus','--value']).stdout.strip()
        assert result.returncode != 0 and status == '1', status
        audit = q.command(['/usr/sbin/ausearch','-m','AVC,USER_AVC','-ts','recent','-i'],check=False).stdout
        evidence = [line for line in audit.splitlines() if 'avc:' in line and 'wydhosting_edge_t' in line and 'wydhosting_data_t' in line and 'permissive=0' in line]
        q.log('edge-MAC-audit', lines=evidence[-4:])
        assert evidence, 'edge denial lacks actual AVC evidence'
        return dict(domain='wydhosting_edge_t', tenantData='EACCES', sameUidDacControl='success')
    q.check('confined edge cannot read DAC-readable tenant data', edge_denial, category='selinux-mac')

    def tls(host='a.localhost', address='127.0.0.1', headers=None, method='GET', path='/', body=None):
        import http.client
        import socket
        import ssl
        context = ssl.create_default_context(cafile=str(cert))
        connection = http.client.HTTPSConnection(host, timeout=8, context=context)
        connection.sock = context.wrap_socket(socket.create_connection((address, 443), 8), server_hostname=host)
        connection.request(method, path, body=body, headers={'Host':host, **(headers or {})})
        result = connection.getresponse(); content = result.read(1048576).decode()
        status = result.status; connection.close()
        return dict(status=status, body=content, headers=dict(result.getheaders()))

    q.wait(lambda: q.command([shutil.which('ss'), '-lntH', 'sport = :443']).stdout.strip(), 10)
    for letter in ('a', 'b'):
        for address in ('127.0.0.1', '::1'):
            def verify(l=letter, a=address):
                result = tls(host=l+'.localhost', address=a)
                assert result['status'] == 200 and 'Qualification tenant i56-'+l in result['body'], result['status']
                return dict(status=200, address=a, tenant=l)
            check('Caddy TLS -> provider -> confined worker '+letter+' '+address, verify)
    check('Caddy overwrites/strips forged forwarding headers', lambda: tls(headers={'Forwarded':'host=b.localhost','X-Forwarded-Host':'b.localhost','X-Forwarded-Proto':'http','X-Forwarded-For':'127.0.0.1','X-Forwarded-Port':'443'})['status'] == 200)
    check('Caddy rejects unknown HTTP hostname', lambda: tls(headers={'Host':'unknown.localhost'})['status'] == 421)
    check('Caddy preserves HEAD and 404 status', lambda: tls(method='HEAD')['status'] == 200 and tls(path='/absent-qualification-route')['status'] == 404)
    def methods():
        head = tls(method='HEAD')
        post = tls(method='POST', path='/contact/', body='qualification=bounded-body', headers={'Content-Type':'application/x-www-form-urlencoded','Origin':'https://a.localhost'})
        other = tls(method='PUT', body='bounded-body', headers={'Origin':'https://a.localhost'})
        assert head['status'] == 200 and head['body'] == ''
        assert post['status'] == other['status'] == 405, dict(POST=post['status'],PUT=other['status'])
        return dict(HEAD=200, headBytes=0, POST=405, PUT=405, postBodyBytes=26)
    check('Caddy forwards bounded bodies and preserves application method rejection', methods)
    q.command(['/usr/bin/systemctl', 'stop', unit])
    check('proxy retirement leaves canonical provider healthy', lambda: response(host='b.localhost'))
    q.command(['/usr/bin/systemctl', 'start', unit])
    q.wait(lambda: q.command([shutil.which('ss'), '-lntH', 'sport = :443']).stdout.strip(), 10)
    check('Caddy restart restores private routing', lambda: tls()['status'] == 200)
    q.command(['/usr/bin/systemctl', 'stop', unit])
