"""Private OFFLINE authorization; unused by broker, no CLI or systemd effects.

Only trusted manager code may supply the directory FD, installed release pin and
clock. An FD received from a broker is NOT trusted. See the Slice 2 design for
mandatory SELinux/mount writer exclusion, installer serialization and activation gates.
"""
from contextlib import contextmanager
from dataclasses import dataclass
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat

# Resolve private siblings from the trusted release, never sys.path/caller input.
def _sibling(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


c = _sibling('lifecycle_contract')
s = _sibling('security')
_ADMIN_UID = 0
_ADMIN_GID = 0
_NAMES = ('approval.json', 'reservations.json')
_APPROVAL_KEYS = (*c.REQUEST_KEYS, 'uid', 'gid', 'category', 'templateId',
                  'templateDigest', 'releaseDigest', 'service', 'limits',
                  'requestDigest', 'reservationDigest', 'notBefore', 'expiresAt', 'state')


@dataclass(frozen=True)
class Decision:
    allowed: bool
    code: str


class _Denied(Exception):
    def __init__(self, code):
        self.code = code


def _need(ok, code):
    if not ok:
        raise _Denied(code)


def _stamp(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_gid,
            info.st_nlink, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def _protected(info, directory=False):
    _need(info.st_uid == _ADMIN_UID and info.st_gid == _ADMIN_GID, 'PROTECTION')
    # No group/world access, special bits, writable-by-other-owner configurations.
    mode = stat.S_IMODE(info.st_mode)
    _need(mode in ((0o500, 0o700) if directory else (0o400, 0o600)), 'PROTECTION')
    _need(stat.S_ISDIR(info.st_mode) if directory else
          stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'PROTECTION')
    if not directory:
        _need(0 < info.st_size <= c.MAX_BYTES, 'PROTECTION')


@contextmanager
def _records(trusted_directory_fd):
    """Fixed basenames beneath an explicitly trusted, already opened directory.

    openat2 rejects symlinks, traversal and mount crossing, without fallback. No
    pathname is accepted by the authorization API. pread consumes the same inode
    inspected by fstat. Held descriptors and final name/metadata checks detect
    replacement or in-place drift; they cannot exclude hostile root writers.
    """
    held = []
    directory = None
    try:
        _need(type(trusted_directory_fd) is int and trusted_directory_fd >= 0, 'PROTECTION')
        directory = os.dup(trusted_directory_fd)
        baseline = os.fstat(directory)
        _protected(baseline, directory=True)
        data = []
        for name in _NAMES:
            fd = s.open_relative(directory, name, os.O_RDONLY | os.O_CLOEXEC | os.O_NONBLOCK)
            held.append((name, fd, os.fstat(fd)))
            before = held[-1][2]
            _protected(before)
            raw = os.pread(fd, c.MAX_BYTES + 1, 0)
            _need(len(raw) == before.st_size and _stamp(os.fstat(fd)) == _stamp(before), 'CHANGED')
            data.append(raw)
        yield data
        # Revalidate AFTER parsing and comparison, including both names and parent.
        for name, fd, before in held:
            _need(_stamp(os.fstat(fd)) == _stamp(before) and
                  _stamp(os.stat(name, dir_fd=directory, follow_symlinks=False)) == _stamp(before), 'CHANGED')
        _need(_stamp(os.fstat(directory)) == _stamp(baseline), 'CHANGED')
    finally:
        for _, fd, _ in held:
            os.close(fd)
        if directory is not None:
            os.close(directory)


def _approval(raw):
    value = c._decode(raw)
    c.closed(value, _APPROVAL_KEYS)
    c.require(value['schema'] == 'wydhosting.lifecycle-approval/1')
    request = {key: value[key] for key in c.REQUEST_KEYS}
    request['schema'] = 'wydhosting.lifecycle/1'
    canonical = c.canonical_request(c._canonical(request))
    c.require(all(c.matches(r'[0-9a-f]{64}', value[key]) for key in
                  ('templateDigest', 'releaseDigest', 'requestDigest', 'reservationDigest')))
    c.require(c.integer(value['uid'], 60000, 2147483647) and type(value['gid']) is int
              and value['uid'] == value['gid'] and c.integer(value['category'], 1, 1023))
    c.closed(value['limits'], c.LIMITS)
    c.require(all(c.integer(value['limits'][key], *bounds) for key, bounds in c.LIMITS.items()))
    c.require(value['state'] in ('active', 'revoked') and
              c.integer(value['notBefore'], 0) and c.integer(value['expiresAt']) and
              value['notBefore'] < value['expiresAt'])
    c.require(type(value['templateId']) is str and type(value['service']) is str)
    c.require(value['requestDigest'] == hashlib.sha256(canonical).hexdigest())
    return value, canonical


def _compare(request, approval_raw, reservations_raw, now, installed_release_digest):
    try:
        approval, approved_request = _approval(approval_raw)
    except c.Refused:
        raise _Denied('APPROVAL') from None
    _need(approval['state'] == 'active', 'REVOKED')
    _need(c.integer(now, 0) and approval['notBefore'] <= now < approval['expiresAt'], 'TIME')
    _need(request == approved_request, 'REQUEST_BINDING')
    _need(approval['templateId'] == c.TEMPLATE_ID and approval['templateDigest'] == c.TEMPLATE_DIGEST
          and hashlib.sha256((c.TEMPLATE_ID + '\n' + c._LAUNCHER + '\n' + c._FIXED).encode()).hexdigest()
          == c.TEMPLATE_DIGEST and approval['service'] == c._unit(json.loads(request)), 'TEMPLATE')
    _need(c.matches(r'[0-9a-f]{64}', installed_release_digest) and
          approval['releaseDigest'] == installed_release_digest, 'RELEASE')
    try:
        reservations = c.validate_reservations(reservations_raw)
    except c.Refused:
        raise _Denied('RESERVATION') from None
    _need(approval['reservationDigest'] == hashlib.sha256(c._canonical(reservations)).hexdigest()
          and {key: approval[key] for key in c.IDENTITY_KEYS} in reservations, 'RESERVATION')


def authorize(raw, trusted_directory_fd, *, now, installed_release_digest):
    """Return bounded decision only, never an execution/replay credential.

    Reads both protected records afresh. Exact one-operation approval: no wildcard,
    operation class, generation range, restart grant or cached revocation state.
    now is trusted UTC Unix seconds; release pin is independently installed, never
    broker-provided. This proves static authorization, NOT live account/session
    authentication, durable uniqueness, current lifecycle state or permission to act.
    """
    try:
        try:
            request = c.canonical_request(raw)
        except c.Refused:
            raise _Denied('REQUEST') from None
        with _records(trusted_directory_fd) as (approval, reservations):
            _compare(request, approval, reservations, now, installed_release_digest)
        return Decision(True, 'ALLOW')
    except _Denied as error:
        return Decision(False, error.code)
    except (OSError, s.Refused, ValueError, OverflowError):
        return Decision(False, 'PROTECTION')
