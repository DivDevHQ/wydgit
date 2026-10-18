"""Portable SCM_RIGHTS contract tests; ancillary transport and identities SIMULATED.
Actual local descriptor duplication/closure, socket types and inode checks. Optional
--kernel-probe records real seqpacket/SCM_RIGHTS feasibility without policy bypass.
"""
import array
import importlib.util
import os
from pathlib import Path
import socket
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
sys.dont_write_bytecode = True
broker = Path(sys.argv.pop(1)).resolve()
spec = importlib.util.spec_from_file_location('handoff', broker/'lifecycle_handoff.py')
h = importlib.util.module_from_spec(spec); spec.loader.exec_module(h)
spec = importlib.util.spec_from_file_location('fixtures', Path(__file__).with_name('verify_lifecycle_authorization.py'))
f = importlib.util.module_from_spec(spec); sys.argv.insert(1, str(broker)); spec.loader.exec_module(f)
raw = h.c._canonical(f.request())
BOOT = '12345678-1234-1234-1234-123456789abc'
PEER = (123, 0, 0, 'system_u:system_r:wydhosting_manager_t:s0')
WORKER = (456, 61000, 61000, 'system_u:system_r:wydhosting_worker_t:s0:c17')


class OwnedHandle:
    """SIMULATED socket wrapper; actual descriptor ownership/closure."""
    def __init__(self, fileno): self.fd = fileno
    def fileno(self): return self.fd
    def getsockopt(self, *_): return 0
    def close(self):
        if self.fd >= 0: os.close(self.fd); self.fd = -1


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.left, self.right = socket.socketpair()
        self.addCleanup(self.left.close); self.addCleanup(self.right.close)
        self.channel = Mock()
        info = os.fstat(self.right.fileno())
        self.expected = dict(device=info.st_dev, inode=info.st_ino,
            **dict(zip(('pid','uid','gid','context'), WORKER)))
        self.identity = patch.object(h, '_identity', side_effect=lambda stream, _: PEER if stream is self.channel else WORKER)
        self.identity.start(); self.addCleanup(self.identity.stop)

    def receive(self, fds, *, data=None, flags=0, extra=(), verifier=lambda *_:True):
        self.channel.recvmsg.return_value = (h._binding(raw, BOOT) if data is None else data,
            [(socket.SOL_SOCKET, socket.SCM_RIGHTS, array.array('i', fds).tobytes()), *extra], flags, None)
        with patch.object(h.socket, 'socket', side_effect=lambda *, fileno: OwnedHandle(fileno)):
            return h.receive(self.channel, raw, BOOT, expected_channel=PEER,
                             expected_worker=self.expected, verify_live=verifier)

    def assert_closed(self, fds):
        for fd in fds:
            with self.assertRaises(OSError): os.fstat(fd)

    def test_accept_exact_connected_socket_and_transfer_ownership(self):
        fd = os.dup(self.right.fileno())
        stream = self.receive([fd])
        self.assertEqual(stream.fileno(), fd)
        self.assertFalse(os.get_inheritable(fd))
        stream.close(); self.assert_closed([fd])

    def test_close_all_extra_truncated_and_substituted_descriptors(self):
        for count, data, flags, extra in [(2,None,0,()),(1,None,socket.MSG_CTRUNC,()),
            (1,b'forged',0,()),(1,None,0,[(socket.SOL_SOCKET, 0, b'unknown')]),
            (1,b'',0,()),(0,None,0,())]:
            fds = [os.dup(self.right.fileno()) for _ in range(count)]
            with self.assertRaises(h.c.Refused): self.receive(fds, data=data, flags=flags, extra=extra)
            self.assert_closed(fds)

    def test_reject_regular_file_and_wrong_inode_and_missing_live_proof(self):
        with tempfile.TemporaryFile() as file:
            fd = os.dup(file.fileno())
            with self.assertRaises(h.c.Refused): self.receive([fd])
            self.assert_closed([fd])
        for change in ({'inode':self.expected['inode']+1}, {'context':'unconfined'}, {'category':17}):
            fd = os.dup(self.right.fileno())
            with patch.dict(self.expected, change):
                with self.assertRaises(h.c.Refused): self.receive([fd])
            self.assert_closed([fd])
        for verifier in (h._unverified, lambda *_:1):
            fd = os.dup(self.right.fileno())
            with self.assertRaises(h.c.Refused): self.receive([fd], verifier=verifier)
            self.assert_closed([fd])

    def test_sender_closes_owned_socket_on_disconnect_or_failed_verification(self):
        for failure in (BrokenPipeError(), InterruptedError()):
            source = OwnedHandle(os.dup(self.right.fileno()))
            self.channel.sendmsg.side_effect = failure
            with self.assertRaises(OSError):
                h.send(self.channel, source, raw, BOOT, expected_channel=PEER,
                       expected_worker=self.expected, verify_live=lambda *_:True)
            self.assertEqual(source.fileno(), -1)
        source = OwnedHandle(os.dup(self.right.fileno()))
        self.channel.sendmsg.reset_mock()
        with self.assertRaises(h.c.Refused):
            h.send(self.channel, source, raw, BOOT, expected_channel=PEER, expected_worker=self.expected)
        self.channel.sendmsg.assert_not_called(); self.assertEqual(source.fileno(), -1)

    def test_binding_unknown_purpose_boot_and_request_changes(self):
        first = h._binding(raw, BOOT)
        self.assertNotEqual(first, h._binding(h.c._canonical(dict(f.request(),operationId='1'*32)), BOOT))
        with self.assertRaises(h.c.Refused): h._binding(raw, 'forged')
        with self.assertRaises(h.c.Refused): h._binding(h.c._canonical(dict(f.request(),operation='status')), BOOT)
        self.channel.recvmsg.assert_not_called()


def kernel_probe():
    import platform
    print(dict(context='managed workspace-write sandbox; no escalation', python=platform.python_version(),
               kernel=platform.release(), uid=os.getuid(), gid=os.getgid()))
    left, right = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
    try:
        print('sendmsg SCM_RIGHTS on local seqpacket:')
        left.sendmsg([b'probe'],[(socket.SOL_SOCKET,socket.SCM_RIGHTS,array.array('i',[right.fileno()]))])
        data, ancillary, flags, _ = right.recvmsg(16, socket.CMSG_SPACE(4), socket.MSG_CMSG_CLOEXEC)
        for level, kind, body in ancillary:
            if (level,kind) == (socket.SOL_SOCKET,socket.SCM_RIGHTS):
                fds=array.array('i'); fds.frombytes(body)
                for fd in fds:
                    before, after = os.fstat(right.fileno()), os.fstat(fd)
                    print(dict(sameDeviceInode=(before.st_dev,before.st_ino)==(after.st_dev,after.st_ino),
                               closeOnExec=not os.get_inheritable(fd)))
                    os.close(fd)
        print(dict(data=data.decode(),flags=flags))
    finally: left.close(); right.close()

if __name__ == '__main__':
    if '--kernel-probe' in sys.argv:
        kernel_probe()
    else: unittest.main()
