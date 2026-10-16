#!/usr/bin/python3
"""Disposable VM only: real firewalld rollback after the applying process dies."""
import importlib.util
import json
import os
from pathlib import Path
import re
import select
import socket
import subprocess
import sys
import time

assert sys.argv[1] == '--target=almond-lab' and socket.gethostname() == 'almond-lab' and os.geteuid() == 0
spec = importlib.util.spec_from_file_location('probe', sys.argv[2])
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
assert Path('/sys/fs/selinux/enforce').read_text().strip() == '1'
before = p.firewall('--list-all-zones').stdout
permanent = p.firewall('--permanent', '--list-all-zones').stdout
child = subprocess.Popen(['/usr/bin/python3', '-B', sys.argv[2], '--unused-zone', 'block'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    assert select.select([child.stdout], [], [], 15)[0], 'probe startup timeout'
    applied = json.loads(child.stdout.readline())
    assert applied['state'] == 'applied' and re.fullmatch(r'wydhosting-firewall-probe-[a-f0-9]{32}\.timer', applied['timer'])
    assert applied['intent'] == '/run/'+applied['timer'].removesuffix('.timer')+'.json'
    print(json.dumps({'event': 'PASS', 'name': 'independent rollback armed before apply', **applied}), flush=True)
    rules = p.run(['/usr/sbin/nft', 'list', 'ruleset']).stdout
    # firewalld does not materialize an unbound zone's rules into active nft chains.
    assert '65431' not in rules, 'unused-zone probe unexpectedly affects active nft rules'
    p.firewall('--zone=block', '--query-rich-rule='+p.RULE)
    print(json.dumps({'event': 'PASS', 'name': 'runtime rule present; inactive zone does not affect active nft rules'}), flush=True)
    child.kill(); child.wait(timeout=5)
    print(json.dumps({'event': 'killed-only-applying-process', 'pid': child.pid}), flush=True)
    end = time.monotonic()+35
    while time.monotonic() < end:
        if p.firewall('--zone=block', '--query-rich-rule='+p.RULE, allowed=(0, 1)).returncode == 1: break
        time.sleep(.25)
    else: raise TimeoutError('independent rollback failed')
    unit = applied['timer'].removesuffix('.timer')+'.service'
    assert p.run(['/usr/bin/systemctl', 'show', unit, '-p', 'ExecMainStatus', '--value']).stdout.strip() == '0'
    assert p.firewall('--list-all-zones').stdout == before
    assert p.firewall('--permanent', '--list-all-zones').stdout == permanent
    assert '65431' not in p.run(['/usr/sbin/nft', 'list', 'ruleset']).stdout
    print(json.dumps({'event': 'PASS', 'name': 'independent timer restores runtime after SIGKILL; permanent unchanged'}), flush=True)
    intent = Path(applied['intent'])
    record = json.loads(intent.read_text())
    assert record == {'schema': 'wydhosting.firewall-probe/1', 'zone': 'block', 'rule': p.RULE, 'timer': applied['timer'], 'state': 'intent'}
    intent.unlink()
    p.run(['/usr/bin/systemctl', 'stop', applied['timer']], allowed=(0, 5))
    print(json.dumps({'event': 'cleanup', 'intent': str(intent), 'timer': applied['timer']}), flush=True)
    print(json.dumps({'event': 'TOTAL', 'passed': 3, 'failed': 0, 'packetEnforcement': 'not-tested'}), flush=True)
finally:
    if child.poll() is None:
        child.kill(); child.wait(timeout=5)
