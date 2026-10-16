#!/usr/bin/python3
"""Causal, reversible openat2 experiment in the disposable almond-lab VM only."""
import errno
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys

CODE = Path('/opt/wyd-i56-causal')
DATA = Path('/var/lib/wyd-i56-causal')
owned = []
units = []


def run(args, check=True):
    r = subprocess.run(args, capture_output=True, text=True, timeout=30)
    if check and r.returncode:
        raise RuntimeError(f'{args[:3]}: {r.returncode}: {r.stderr}')
    return r


PROBE = '''import ctypes,errno,json,os
from pathlib import Path
class How(ctypes.Structure):
 _fields_=[('flags',ctypes.c_uint64),('mode',ctypes.c_uint64),('resolve',ctypes.c_uint64)]
parent=os.open('/var/lib/wyd-i56-causal',os.O_RDONLY|os.O_DIRECTORY|os.O_CLOEXEC)
flags=os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK|os.O_CLOEXEC
fd=os.open('input',flags,dir_fd=parent);assert os.read(fd,16)==b'approved';os.close(fd)
how=How(flags,0,0x01|0x04|0x08)
libc=ctypes.CDLL(None,use_errno=True);libc.syscall.restype=ctypes.c_long
fd=libc.syscall(ctypes.c_long(437),ctypes.c_int(parent),ctypes.c_char_p(b'input'),ctypes.byref(how),ctypes.c_size_t(ctypes.sizeof(how)))
error=ctypes.get_errno() if fd<0 else 0
if fd>=0:assert os.read(fd,16)==b'approved';os.close(fd)
os.close(parent)
fields=dict(line.split(':',1) for line in Path('/proc/self/status').read_text().splitlines() if ':' in line)
print(json.dumps(dict(openat='success',openat2Errno=error,openat2Name=errno.errorcode.get(error,'success'),
 noNewPrivileges=fields['NoNewPrivs'].strip(),seccomp=fields['Seccomp'].strip(),
 capabilities={k:fields[k].strip() for k in ('CapEff','CapPrm','CapAmb')},
 selinux=Path('/proc/self/attr/current').read_text().strip('\\0\\n'))))
'''


def main():
    assert sys.argv[1] == '--target=almond-lab' and len(sys.argv) == 3
    assert socket.gethostname() == 'almond-lab' and os.geteuid() == 0
    assert Path('/sys/fs/selinux/enforce').read_text().strip() == '1'
    for p in (CODE, DATA): assert not os.path.lexists(p), p
    assert not run(['/usr/bin/systemctl', 'list-units', '--all', '--plain', '--no-legend', 'wyd-i56-causal*']).stdout.strip()
    template = Path(sys.argv[2]).read_text()
    assert template.count('RestrictSUIDSGID=yes\n') == 1
    for p in (CODE, DATA):
        p.mkdir(mode=0o755); owned.append(p); print(json.dumps(dict(event='mkdir', path=str(p))), flush=True)
    (CODE/'probe.py').write_text(PROBE); (CODE/'probe.py').chmod(0o644)
    (DATA/'input').write_bytes(b'approved'); (DATA/'input').chmod(0o600)
    baseline = json.loads(run(['/usr/bin/python3', '-I', str(CODE/'probe.py')]).stdout)
    assert baseline['openat2Errno'] == 0
    print(json.dumps(dict(event='baseline', result=baseline)), flush=True)
    # Only the identified directive differs among the three controlled service units.
    common = template.replace('Slice=wydhosting-broker.slice', 'Slice=system.slice')
    common = common.replace('ExecStart=/usr/bin/python3 -I /opt/wydhosting/release/node_modules/wydhosting/broker/broker.py', 'ExecStart=/usr/bin/python3 -I '+str(CODE/'probe.py'))
    common = common.replace('StandardInput=socket', 'StandardInput=null')
    common = common.replace('ReadWritePaths=/var/lib/wydhosting /run/wydhosting /run/systemd/system /etc', 'ReadWritePaths='+str(DATA))
    common += '\nRuntimeMaxSec=15s\n'
    results = []
    for name, enabled in [('on1', True), ('off', False), ('on2', True)]:
        unit = 'wyd-i56-causal-'+name+'.service'
        output = DATA/(name+'.json')
        text = common.replace('StandardOutput=null', 'StandardOutput=file:'+str(output))
        if not enabled: text = text.replace('RestrictSUIDSGID=yes', 'RestrictSUIDSGID=no')
        path = Path('/run/systemd/system')/unit
        assert not path.exists(); path.write_text(text); owned.append(path); units.append(unit)
    run(['/usr/bin/systemctl', 'daemon-reload'])
    for unit in units:
        run(['/usr/bin/systemctl', 'start', unit])
        # Type=exec start returns before the probe writes; bound the independent wait.
        import time
        output = DATA/(unit.removeprefix('wyd-i56-causal-').removesuffix('.service')+'.json')
        deadline = time.monotonic()+10
        while (not output.exists() or not output.read_text().strip()) and time.monotonic()<deadline: time.sleep(.05)
        result = json.loads(output.read_text())
        enabled = '-off.' not in unit
        assert result['openat2Errno'] == (errno.ENOSYS if enabled else 0), result
        assert result['openat'] == 'success' and result['noNewPrivileges'] == '1' and result['seccomp'] == '2', result
        effective = run(['/usr/bin/systemctl', 'show', unit, '--property=RestrictSUIDSGID,SystemCallFilter,NoNewPrivileges,CapabilityBoundingSet,ProtectSystem,ProtectControlGroups,RestrictNamespaces']).stdout
        results.append(result)
        print(json.dumps(dict(event='PASS', unit=unit, result=result, effective=effective)), flush=True)
    assert results[0] == results[2] and results[0]['capabilities'] == results[1]['capabilities']
    assert Path('/sys/fs/selinux/enforce').read_text().strip() == '1'
    print(json.dumps(dict(event='TOTAL', passed=4, failed=0, conclusion='single-variable on/off/on confirms RestrictSUIDSGID filter')), flush=True)


if __name__ == '__main__':
    try: main()
    finally:
        for unit in units:
            run(['/usr/bin/systemctl', 'stop', unit], check=False)
            run(['/usr/bin/systemctl', 'reset-failed', unit], check=False)
        for p in reversed(owned):
            if p.is_dir(): shutil.rmtree(p)
            else: p.unlink()
            print(json.dumps(dict(event='cleanup', path=str(p))), flush=True)
        if owned: run(['/usr/bin/systemctl', 'daemon-reload'])
