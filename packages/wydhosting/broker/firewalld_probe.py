#!/usr/bin/python3
"""Administrator-only runtime transaction qualification; NOT a hosting firewall.

Adds one fixed, self-expiring rule to an explicitly unused existing zone. Never
binds a zone, changes default/management rules, reloads, or writes permanent policy.
An independent systemd timer must be active before mutation. The probe deliberately
has no commit/activation operation. Run only on a disposable, approved VM.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

RULE = 'rule family="ipv4" source address="127.0.0.2/32" port port="65431" protocol="tcp" reject'


def run(args, allowed=(0,)):
    result = subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True,
                            text=True, timeout=10, close_fds=True,
                            env={'PATH': '/usr/bin:/usr/sbin', 'LANG': 'C'})
    if result.returncode not in allowed:
        raise RuntimeError('FIREWALL.COMMAND')
    return result


def firewall(*args, allowed=(0,)):
    return run(['/usr/bin/firewall-cmd', *args], allowed)


def unused(zone):
    if not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_-]{0,16}', zone):
        raise RuntimeError('FIREWALL.ZONE')
    if zone == firewall('--get-default-zone').stdout.strip():
        raise RuntimeError('FIREWALL.ACTIVE_ZONE')
    for query in ('--list-interfaces', '--list-sources'):
        if firewall('--zone='+zone, query).stdout.strip():
            raise RuntimeError('FIREWALL.ACTIVE_ZONE')


def probe(zone):
    if os.geteuid() != 0:
        raise RuntimeError('FIREWALL.PRIVILEGE')
    unused(zone)
    zonearg = '--zone='+zone
    if firewall(zonearg, '--query-rich-rule='+RULE, allowed=(0, 1)).returncode != 1:
        raise RuntimeError('FIREWALL.PREEXISTING_RULE')
    before = firewall('--list-all-zones').stdout
    permanent = firewall('--permanent', '--list-all-zones').stdout
    token = uuid.uuid4().hex
    unit = 'wydhosting-firewall-probe-'+token
    intent = Path('/run/'+unit+'.json')
    # O_EXCL, no replace and no attacker-selected filename or rule text.
    fd = os.open(intent, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump({'schema': 'wydhosting.firewall-probe/1', 'zone': zone,
                   'rule': RULE, 'timer': unit+'.timer', 'state': 'intent'}, stream)
        stream.flush(); os.fsync(stream.fileno())
    timer_armed = False
    restored = False
    try:
        run(['/usr/bin/systemd-run', '--unit='+unit, '--on-active=15s',
             '--timer-property=AccuracySec=1s', '--property=Type=oneshot',
             '--property=TimeoutStartSec=10s', '--property=MemoryMax=64M',
             '--property=TasksMax=16', '/usr/bin/firewall-cmd', zonearg, '--remove-rich-rule='+RULE])
        timer_armed = True
        run(['/usr/bin/systemctl', 'is-active', unit+'.timer'])
        unused(zone)
        # Native timeout is a second recovery path if the independent timer fails.
        firewall(zonearg, '--add-rich-rule='+RULE, '--timeout=60s')
        firewall(zonearg, '--query-rich-rule='+RULE)
        print(json.dumps({'state': 'applied', 'zone': zone, 'timer': unit+'.timer', 'intent': str(intent)}), flush=True)
        deadline = time.monotonic()+35
        while time.monotonic() < deadline:
            if firewall(zonearg, '--query-rich-rule='+RULE, allowed=(0, 1)).returncode == 1:
                break
            time.sleep(.25)
        else:
            raise RuntimeError('FIREWALL.ROLLBACK_TIMEOUT')
        assert run(['/usr/bin/systemctl', 'show', unit+'.service', '-p', 'ExecMainStatus', '--value']).stdout.strip() == '0'
        assert firewall('--list-all-zones').stdout == before
        assert firewall('--permanent', '--list-all-zones').stdout == permanent
        restored = True
        return {'state': 'independently-rolled-back', 'zone': zone, 'runtimeRestored': True,
                'permanentUnchanged': True, 'hostingActivation': False}
    finally:
        # Always attempt precise rollback; retain independent recovery if unconfirmed.
        try:
            if firewall(zonearg, '--query-rich-rule='+RULE, allowed=(0, 1)).returncode == 0:
                firewall(zonearg, '--remove-rich-rule='+RULE)
            restored = firewall('--list-all-zones').stdout == before and firewall('--permanent', '--list-all-zones').stdout == permanent
        finally:
            if restored:
                if timer_armed:
                    # A completed transient timer may already be garbage-collected.
                    run(['/usr/bin/systemctl', 'stop', unit+'.timer'], allowed=(0, 5))
                intent.unlink()
            else:
                print(json.dumps({'state': 'recovery-retained', 'intent': str(intent), 'timer': unit+'.timer'}), flush=True)


if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] != '--unused-zone':
        sys.exit('Usage (approved disposable VM only): firewalld_probe.py --unused-zone ZONE')
    print(json.dumps(probe(sys.argv[2])), flush=True)
