#!/usr/bin/python3
"""Offline administrator provisioning; never executed by the session broker.

Only the installed immutable root approval supplies identities. No command, path,
unit property or account argument is accepted on stdin, argv or a socket.
Interrupted account creation refuses adoption and requires administrator review.
"""
import fcntl
import grp
import importlib.util
import os
import pwd
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('broker', os.path.join(os.path.dirname(os.path.realpath(__file__)), 'broker.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
s = b.s


def provision(account, records):
    name = b.account_name(account)
    marker = b.key(account['accountId']) + '.json'
    fresh = False
    pending = b.key(account['accountId']) + '.pending.json'
    try:
        s.require(s.decode(s.read_file(records, marker)) == account, 'BROKER.OWNERSHIP')
    except FileNotFoundError:
        # Durable intent precedes any account-tool effect. An interrupted attempt
        # requires explicit administrator reconciliation, even if no user exists.
        try:
            s.read_file(records, pending)
        except FileNotFoundError:
            pass
        else:
            raise s.Refused('BROKER.OWNERSHIP')
        for lookup, value in ((pwd.getpwnam, name), (pwd.getpwuid, account['uid']), (grp.getgrnam, name), (grp.getgrgid, account['gid'])):
            try:
                lookup(value)
            except KeyError:
                continue
            raise s.Refused('BROKER.OWNERSHIP')
        s.atomic_file(records, pending, s.encode(account))
        fresh = True
        b.command(['/usr/sbin/groupadd', '--system', '--gid', str(account['gid']), name])
        b.command(['/usr/sbin/useradd', '--system', '--uid', str(account['uid']), '--gid', str(account['gid']), '--no-user-group', '--no-create-home', '--home-dir', account['home'], '--shell', '/usr/sbin/nologin', '--password', '!', '--no-log-init', name])
        homes = s.open_directory(b.ROOT + '/accounts')
        try:
            os.close(s.mkdir_owned(homes, account['accountId'], account['uid'], account['gid'], 0o700))
        finally:
            os.close(homes)
    b.verify_account(account)
    etc = s.open_directory('/etc')
    try:
        matches = [row.split(b':')[1] for row in s.read_file(etc, 'shadow').splitlines() if row.split(b':')[0] == name.encode()]
        s.require(len(matches) == 1 and matches[0].startswith((b'!', b'*')), 'BROKER.ACCOUNT')
    finally:
        os.close(etc)
    # Only verified identity, groups, home creation and shadow lock can seal success.
    if fresh:
        s.atomic_file(records, marker, s.encode(account))
    try:
        os.unlink(pending, dir_fd=records)
        os.fsync(records)
    except FileNotFoundError:
        pass


def main():
    s.require(os.geteuid() == 0 and len(sys.argv) == 1, 'BROKER.PRIVILEGE')
    # Refuse even an accidental in-domain invocation on SELinux hosts.
    try:
        with open('/proc/self/attr/current', encoding='ascii') as current:
            s.require(':wydhosting_broker_t:' not in current.read(), 'BROKER.PRIVILEGE')
    except OSError:
        pass
    policy = b.load_policy()
    etc = s.open_directory('/etc/wydhosting')
    try:
        records = s.mkdir_owned(etc, 'accounts', 0, 0)
    finally:
        os.close(etc)
    try:
        fcntl.flock(records, fcntl.LOCK_EX | fcntl.LOCK_NB)
        for account in {p['account']['accountId']:p['account'] for p in policy['pools']}.values():
            provision(account, records)
    finally:
        os.close(records)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.stderr.write('Account provisioning refused; administrator review required\n')
        sys.exit(70)
