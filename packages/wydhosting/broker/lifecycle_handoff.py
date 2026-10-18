"""Private Linux SCM_RIGHTS mechanics prototype; no installed caller or authority.

Only an already connected worker-control AF_UNIX stream may move over a separately
kernel-authenticated AF_UNIX seqpacket channel. No filesystem opening, arbitrary FD
service or journal/effect operation. Independent expected identities and a fresh
live worker observer are mandatory; neither may come from the sender's packet.
Offline success would not establish descriptor provenance or SELinux confinement.
"""
import array
import importlib.util
import os
from pathlib import Path
import socket
import stat
import struct

_spec = importlib.util.spec_from_file_location('lifecycle_contract', Path(__file__).with_name('lifecycle_contract.py'))
c = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(c)
import hashlib
import json


def _identity(stream, kind):
    c.require(type(stream) is socket.socket and stream.family == socket.AF_UNIX and
              stream.getsockopt(socket.SOL_SOCKET, socket.SO_TYPE) == kind)
    pid, uid, gid = struct.unpack('3i', stream.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    context = stream.getsockopt(socket.SOL_SOCKET, socket.SO_PEERSEC, 256).rstrip(b'\0').decode('ascii')
    c.require(c.integer(pid, 1, 2147483647) and c.integer(uid, 0, 2147483647) and c.integer(gid, 0, 2147483647))
    stream.getpeername()  # unconnected and listening sockets are never a handoff
    return pid, uid, gid, context


def _binding(raw, boot):
    request = c.canonical_request(raw)
    value = json.loads(request)
    c.require(value['operation'] == 'start' and
              c.matches(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', boot))
    return c._canonical(dict(schema='wydhosting.worker-control-handoff/1', purpose='worker-control',
        requestDigest=hashlib.sha256(request).hexdigest(), operationId=value['operationId'],
        generation=value['generation'], bootId=boot))


def _unverified(*_):
    return False


def _worker(stream, expected, verify_live):
    # expected is embedding-owned independent identity, NOT packet metadata.
    c.closed(expected, ('device', 'inode', 'pid', 'uid', 'gid', 'context'))
    c.require(all(c.integer(expected[k], 0) for k in ('device', 'inode', 'pid', 'uid', 'gid')) and
              c.matches(r'system_u:system_r:wydhosting_worker_t:s0:c[1-9][0-9]{0,3}', expected['context']))
    c.require(c.integer(expected['pid'], 1, 2147483647) and c.integer(expected['inode']) and
              c.integer(expected['uid'], 60000, 2147483647) and expected['uid'] == expected['gid'] and
              c.integer(int(expected['context'].rsplit(':c', 1)[1]), 1, 1023))
    info = os.fstat(stream.fileno())
    c.require(stat.S_ISSOCK(info.st_mode) and (info.st_dev, info.st_ino) ==
              (expected['device'], expected['inode']))
    c.require(_identity(stream, socket.SOCK_STREAM) == tuple(expected[k] for k in ('pid','uid','gid','context')))
    c.require(not stream.getsockopt(socket.SOL_SOCKET, socket.SO_ACCEPTCONN))
    # Observer must independently match exact boot, PID start time, invocation,
    # cgroup, lifetime and approved request. Cached numeric PID is insufficient.
    c.require(verify_live(stream, expected) is True)


def send(channel, worker, raw, boot, *, expected_channel, expected_worker, verify_live=_unverified):
    """Consume/close worker AND handoff channel on EVERY exit, including interruption.

    SCM_RIGHTS duplicates a handle; it cannot revoke aliases. Manager must originate
    the channel, exclude broker inheritance and close EVERY other alias. Successful
    send is not receiver acknowledgment or lifecycle completion; never resend a
    control FD automatically after interruption. Journal recovery remains separate.
    """
    try:
        payload = _binding(raw, boot)
        c.require(_identity(channel, socket.SOCK_SEQPACKET) == expected_channel)
        _worker(worker, expected_worker, verify_live)
        channel.settimeout(2)
        sent = channel.sendmsg([payload], [(socket.SOL_SOCKET, socket.SCM_RIGHTS,
                                           array.array('i', [worker.fileno()]))])
        c.require(sent == len(payload))
    finally:
        worker.close()
        channel.close()


def receive(channel, raw, boot, *, expected_channel, expected_worker, verify_live=_unverified):
    """Return one owned non-inheritable worker socket or close ALL delivered FDs.

    recvmsg receives room for four FDs solely to close/reject extra descriptors.
    Linux closes undisclosed truncated SCM_RIGHTS; all visible rights are closed on
    malformed data, EOF, timeout, truncation, wrong identity or failed live check.
    One packet per owned handoff channel; close it on EVERY exit to discard queued
    ancillary rights too. The returned worker socket alone survives success.
    """
    fds = []
    worker = None
    try:
        payload = _binding(raw, boot)
        c.require(_identity(channel, socket.SOCK_SEQPACKET) == expected_channel)
        channel.settimeout(2)
        data, ancillary, flags, _ = channel.recvmsg(c.MAX_BYTES+1,
            socket.CMSG_SPACE(4 * array.array('i').itemsize), socket.MSG_CMSG_CLOEXEC)
        valid = True
        for level, kind, body in ancillary:
            if (level, kind) == (socket.SOL_SOCKET, socket.SCM_RIGHTS):
                rights = array.array('i')
                size = rights.itemsize
                rights.frombytes(body[:len(body) - len(body) % size])
                fds.extend(rights)
                valid = valid and len(body) % size == 0
            else:
                valid = False
        c.require(valid and len(ancillary) == 1 and len(fds) == 1 and
                  not flags & (socket.MSG_CTRUNC | socket.MSG_TRUNC) and data == payload)
        fd = fds[0]
        c.require(not os.get_inheritable(fd))
        worker = socket.socket(fileno=fd)
        fds.clear()  # worker now owns fd, including all failure paths below
        _worker(worker, expected_worker, verify_live)
        result, worker = worker, None
        return result
    finally:
        if worker is not None:
            worker.close()
        for fd in fds:
            os.close(fd)
        channel.close()
