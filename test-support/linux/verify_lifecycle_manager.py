"""Offline candidate composition. Root ownership/session authority are SIMULATED.
Actual current-user Unix streams, kernel credentials, files and journal locking.
"""
import importlib.util
import json
import os
from pathlib import Path
import socket
import sys
import unittest
from unittest.mock import patch
sys.dont_write_bytecode = True
broker = Path(sys.argv.pop(1)).resolve()

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

m = load('manager', broker/'lifecycle_manager.py')
sys.argv.insert(1, str(broker))
fixtures = load('journal_fixtures', Path(__file__).with_name('verify_lifecycle_journal.py'))
f = fixtures.f
c = m.c
BOOT = '12345678-1234-1234-1234-123456789abc'

class ManagerTests(unittest.TestCase):
    setUp = fixtures.JournalTests.setUp
    write_auth = fixtures.JournalTests.write_auth
    approve = fixtures.JournalTests.approve

    def setUp(self):
        fixtures.JournalTests.setUp(self)
        # Candidate and fixture loaders intentionally have separate private modules.
        self.owner2 = patch.multiple(m.j.a, _ADMIN_UID=os.getuid(), _ADMIN_GID=os.getgid())
        self.owner2.start(); self.addCleanup(self.owner2.stop)
        self.peer = m.Peer(os.getpid(), os.getuid(), os.getgid(),
                           'system_u:system_r:wydhosting_broker_t:s0')

    def call(self, raw=None, verifier=lambda *_: True, peer=None, boots=None,
             preparation=lambda *_: True, now=150):
        left, right = socket.socketpair()
        try:
            left.sendall(c._canonical(f.request()) if raw is None else raw)
            left.shutdown(socket.SHUT_WR)
            with patch.object(m, '_peer', return_value=peer or self.peer), patch.object(
                    m, '_boot', side_effect=boots or [BOOT, BOOT, BOOT]):
                return json.loads(m.handle(right, self.fd, self.afd, now=now,
                    installed_release_digest='c'*64, broker_uid=os.getuid(),
                    broker_gid=os.getgid(), verify_session=verifier,
                    verify_preparation=preparation))
        finally:
            left.close(); right.close()

    def test_preparation_reserves_once_and_never_claims_completion(self):
        result = self.call()
        self.assertEqual((result['outcome'],result['code'],result['recordedState']),
                         ('indeterminate','INSTALLED_REQUIRED','prepared'))
        before = (self.store/'journal.json').read_bytes()
        self.assertEqual(self.call(), result)
        self.assertEqual((self.store/'journal.json').read_bytes(), before)
        entries = m.j._decode(before)
        self.assertEqual(entries['0'*32]['transitions'], ['prepared'])
        with self.assertRaises(m.j.Refused):
            m.OfflineEffects().publish_and_verify('a'*64,'b'*64,BOOT)

    def test_actual_kernel_peer_cannot_be_replaced_by_claims(self):
        left,right = socket.socketpair()
        try:
            with patch.object(m.socket, 'SO_PEERSEC', socket.SO_PEERSEC, create=True):
                try:
                    peer = m._peer(right)
                    self.assertEqual((peer.pid,peer.uid,peer.gid),(os.getpid(),os.getuid(),os.getgid()))
                except OSError:
                    # Host without peer security support: must refuse, never invent it.
                    pass
            with self.assertRaises(m.c.Refused): m._peer({'uid':0})
        finally: left.close();right.close()
        for field,val in [('uid',os.getuid()+1),('gid',os.getgid()+1),('context','unconfined')]:
            peer = m.Peer(**{**self.peer.__dict__,field:val})
            self.assertEqual(self.call(peer=peer)['code'],'PEER')
        self.assertEqual(self.call(raw=c._canonical(dict(f.request(),uid=0)))['code'],'REQUEST')

    def test_missing_forged_and_throwing_session_proof(self):
        for verifier in [m._unverified, lambda *_: False, lambda *_: 1]:
            self.assertEqual(self.call(verifier=verifier)['code'],'SESSION_UNVERIFIED')
        def throws(*_): raise RuntimeError('secret')
        result = self.call(verifier=throws)
        self.assertEqual(result['code'],'VERIFIER_FAILED')
        self.assertNotIn('secret',str(result))
        self.assertEqual(m.j._decode((self.store/'journal.json').read_bytes()),{})

    def test_boot_and_session_change_deny_before_reservation(self):
        self.assertEqual(self.call(boots=[BOOT,'22345678-1234-1234-1234-123456789abc'])['code'],'SESSION_CHANGED')
        answers = iter([True, False])
        self.assertEqual(self.call(verifier=lambda *_: next(answers))['code'],'SESSION_CHANGED')
        self.assertEqual(m.j._decode((self.store/'journal.json').read_bytes()),{})

    def test_substitution_revocation_expiry_and_template_tampering(self):
        for key,val in [('tenantId','foreign'),('poolId','foreign'),('accountId','foreign'),
                        ('epoch',2),('expectedSequence',1),('generation','22345678-1234-1234-1234-123456789abc')]:
            self.assertEqual(self.call(raw=c._canonical(dict(f.request(),**{key:val})))['code'],'REQUEST_BINDING')
        for key,val,code in [('state','revoked','REVOKED'),('expiresAt',149,'TIME'),
                             ('templateDigest','f'*64,'TEMPLATE'),('uid',60001,'RESERVATION')]:
            self.write_auth('approval.json',dict(f.approval(),**{key:val,**({'gid':val} if key=='uid' else {})}))
            self.assertEqual(self.call()['code'],code)

    def test_malformed_oversized_unknown_and_duplicate_frames(self):
        for raw in [b'',b'x'*8193,b'\xff',b'{}{}',b'{"x":1,"x":2}',
                    c._canonical(dict(f.request(),operation='exec')),
                    c._canonical(dict(f.request(),claim='approved'))]:
            self.assertEqual(self.call(raw=raw)['code'],'REQUEST')

    def test_pending_crash_marker_and_corrupt_history_refuse(self):
        (self.store/'pending.json').write_bytes(b'incomplete')
        self.assertEqual(self.call()['code'],'RECONCILIATION_REQUIRED')
        (self.store/'pending.json').unlink()
        (self.store/'journal.json').write_bytes(b'{}')
        self.assertEqual(self.call()['code'],'CORRUPT')

    def test_replay_conflict_and_concurrent_lock(self):
        with m.j._locked(self.fd):
            self.assertEqual(self.call()['code'],'BUSY')
        self.call()
        changed = dict(f.request(),poolId='foreign')
        self.approve(changed)
        self.assertEqual(self.call(raw=c._canonical(changed))['code'],'CONFLICT')

    def test_unverified_completed_evidence_cannot_be_adopted(self):
        self.call()
        # Candidate supplies no evidence acceptor: a forged completion always denies.
        entries = m.j._decode((self.store/'journal.json').read_bytes())
        entries['0'*32]['transitions'] += ['intent-recorded']
        (self.store/'journal.json').write_bytes(m.j._encode(entries))
        self.assertEqual(self.call()['code'],'RECONCILIATION_REQUIRED')
        self.assertEqual(self.call()['recordedState'],'intent-recorded')

    def test_incomplete_and_tampered_completed_artifact_proof_denied(self):
        self.call()
        entries = m.j._decode((self.store/'journal.json').read_bytes())
        record = entries['0'*32]
        record['transitions'] += ['intent-recorded','completed']
        record['evidence'] = fixtures.JournalTests.evidence(self).decode()
        (self.store/'journal.json').write_bytes(m.j._encode(entries))
        # Even structurally valid receipts have no installed independent verifier.
        self.assertEqual(self.call()['code'],'EVIDENCE')
        record['evidence'] = record['evidence'].replace('exact-invocation-running','forged')
        payload = c._canonical(entries).decode()
        (self.store/'journal.json').write_bytes(c._canonical(dict(schema=m.j.SCHEMA,
            payload=payload,digest=m.j.digest(payload.encode()))))
        self.assertEqual(self.call()['code'],'CORRUPT')

    def test_absolute_deadline_and_trailing_data(self):
        left,right = socket.socketpair()
        try:
            with patch.object(m.time,'monotonic',side_effect=[0,11]):
                with self.assertRaises(m.c.Refused): m._frame(right)
        finally: left.close();right.close()
        self.assertEqual(self.call(raw=c._canonical(f.request())+b'{}')['code'],'REQUEST')

    def test_ancillary_descriptor_is_rejected(self):
        import array
        left,right = socket.socketpair()
        try:
            left.sendmsg([b'{}'],[(socket.SOL_SOCKET,socket.SCM_RIGHTS,array.array('i',[self.fd]))])
            left.shutdown(socket.SHUT_WR)
            with self.assertRaises(m.c.Refused): m._frame(right)
        finally: left.close();right.close()

    def test_locked_exact_scope_check_is_mandatory_and_veto_only(self):
        for verifier in (None, lambda *_: False, lambda *_: 1):
            self.assertEqual(self.call(preparation=verifier)['code'], 'SESSION_CHANGED')
        def scoped(peer, request, boot, approval, history):
            self.assertEqual(peer, self.peer)
            self.assertEqual(boot, BOOT)
            self.assertEqual(approval, c._canonical(f.approval()))
            self.assertEqual(history, b'{}')
            with self.assertRaises(m.j.Refused):
                with m.j._locked(self.fd): pass
            return True
        self.assertEqual(self.call(preparation=scoped)['recordedState'], 'prepared')

    def test_expiry_and_revocation_during_verification_do_not_prepare(self):
        def revoke(*_):
            self.write_auth('approval.json', dict(f.approval(), state='revoked'))
            return True
        self.assertEqual(self.call(preparation=revoke)['code'], 'SESSION_CHANGED')
        self.write_auth('approval.json', f.approval())
        ticks = iter([150, 150, 201])
        self.assertEqual(self.call(now=lambda: next(ticks))['code'], 'SESSION_CHANGED')
        self.assertEqual(m.j._decode((self.store/'journal.json').read_bytes()), {})

    def test_response_loss_preserves_exact_preparation_for_retry(self):
        left, right = socket.socketpair()
        left.sendall(c._canonical(f.request())); left.shutdown(socket.SHUT_WR); left.close()
        with patch.object(m, '_peer', return_value=self.peer), patch.object(m, '_boot', return_value=BOOT):
            self.assertFalse(m.serve(right, m.Admission(), self.fd, self.afd, now=150,
                installed_release_digest='c'*64, broker_uid=os.getuid(), broker_gid=os.getgid(),
                verify_session=lambda *_: True, verify_preparation=lambda *_: True))
        before = (self.store/'journal.json').read_bytes()
        self.assertEqual(self.call()['recordedState'], 'prepared')
        self.assertEqual((self.store/'journal.json').read_bytes(), before)
        self.assertEqual(right.fileno(), -1)

    def test_admission_capacity_closes_without_reading_or_writing_history(self):
        gate = m.Admission(1)
        self.assertTrue(gate._slots.acquire(False))
        left, right = socket.socketpair()
        try:
            self.assertFalse(m.serve(right, gate, self.fd, self.afd))
            self.assertEqual(left.recv(1), b'')
            self.assertEqual(m.j._decode((self.store/'journal.json').read_bytes()), {})
        finally:
            left.close(); right.close(); gate._slots.release()

    def test_correlated_response_over_real_stream_and_manager_authentication(self):
        import threading
        left, right = socket.socketpair()
        manager = m.Peer(os.getpid(), os.getuid(), os.getgid(),
                         'system_u:system_r:wydhosting_manager_t:s0')
        def peers(connection): return manager if connection is left else self.peer
        with patch.object(m, '_peer', side_effect=peers), patch.object(m, '_boot', return_value=BOOT):
            task = threading.Thread(target=m.serve, args=(right, m.Admission(), self.fd, self.afd),
                kwargs=dict(now=150, installed_release_digest='c'*64,
                broker_uid=os.getuid(), broker_gid=os.getgid(), verify_session=lambda *_: True,
                verify_preparation=lambda *_: True))
            task.start()
            try:
                result = m.exchange(left, c._canonical(f.request()),
                    manager_uid=os.getuid(), manager_gid=os.getgid())
                self.assertEqual(result['recordedState'], 'prepared')
            finally:
                left.close(); task.join(3)
            self.assertFalse(task.is_alive())
        left, right = socket.socketpair()
        try:
            with patch.object(m, '_peer', return_value=self.peer):
                with self.assertRaises(m.c.Refused):
                    m.exchange(left, c._canonical(f.request()))
            right.setblocking(False)
            with self.assertRaises(BlockingIOError): right.recv(1)
        finally: left.close(); right.close()

if __name__ == '__main__': unittest.main()
