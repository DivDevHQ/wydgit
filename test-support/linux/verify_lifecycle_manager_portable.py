"""Portable contract tests. Stream IO, peer/domain and observer are SIMULATED.

Run alongside, never instead of recording real Unix transport tests. This suite
exists to make progress where the managed sandbox denies sendall/SCM_RIGHTS.
"""
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch
sys.dont_write_bytecode = True
broker = Path(sys.argv.pop(1)).resolve()
spec = importlib.util.spec_from_file_location('manager_fixtures', Path(__file__).with_name('verify_lifecycle_manager.py'))
f = importlib.util.module_from_spec(spec)
sys.argv.insert(1, str(broker))
spec.loader.exec_module(f)
m, c, BOOT = f.m, f.c, f.BOOT


class PortableTests(f.ManagerTests):
    def call(self, raw=None, verifier=lambda *_: True, peer=None, boots=None,
             preparation=lambda *_: True, now=150):
        with patch.object(m, '_frame', return_value=c._canonical(f.f.request()) if raw is None else raw), \
             patch.object(m, '_peer', return_value=peer or self.peer), \
             patch.object(m, '_boot', side_effect=boots or [BOOT, BOOT, BOOT]):
            return json.loads(m.handle(Mock(), self.fd, self.afd, now=now,
                installed_release_digest='c'*64, broker_uid=os.getuid(), broker_gid=os.getgid(),
                verify_session=verifier, verify_preparation=preparation))

    @unittest.skip('requires actual kernel Unix peer credentials; see real suite diagnostics')
    def test_actual_kernel_peer_cannot_be_replaced_by_claims(self): pass
    @unittest.skip('requires actual Unix ancillary descriptor transport')
    def test_ancillary_descriptor_is_rejected(self): pass
    @unittest.skip('requires actual disconnected Unix stream')
    def test_response_loss_preserves_exact_preparation_for_retry(self): pass
    @unittest.skip('requires actual bidirectional Unix stream')
    def test_correlated_response_over_real_stream_and_manager_authentication(self): pass
    @unittest.skip('requires actual Unix EOF')
    def test_admission_capacity_closes_without_reading_or_writing_history(self): pass

    def test_absolute_deadline_and_trailing_data(self):
        stream = Mock()
        with patch.object(m.time, 'monotonic', side_effect=[0, 11]):
            with self.assertRaises(c.Refused): m._frame(stream)
        stream.recvmsg.assert_not_called()
        self.assertEqual(self.call(raw=c._canonical(f.f.request())+b'{}')['code'], 'REQUEST')

    def test_scripted_transport_bounds_and_disconnect(self):
        stream = Mock()
        stream.recvmsg.side_effect = [(b'x'*8193, [], 0, None)]
        with self.assertRaises(c.Refused): m._frame(stream)
        stream.recvmsg.side_effect = [(b'{}', [], m.socket.MSG_CTRUNC, None)]
        with self.assertRaises(c.Refused): m._frame(stream)
        gate = m.Admission(1)
        stream = Mock(); stream.__enter__ = Mock(return_value=stream); stream.__exit__ = Mock()
        with patch.object(m, 'handle', return_value=b'{}'):
            stream.sendall.side_effect = BrokenPipeError()
            self.assertFalse(m.serve(stream, gate))
        self.assertTrue(gate._slots.acquire(False)); gate._slots.release()
        self.assertTrue(stream.__exit__.called)

    def test_client_rejects_uncorrelated_or_completion_responses(self):
        raw = c._canonical(f.f.request())
        manager = m.Peer(123, os.getuid(), os.getgid(), 'system_u:system_r:wydhosting_manager_t:s0')
        good = self.call()
        for change in ({'operationId':'1'*32}, {'requestDigest':'f'*64}, {'outcome':'completed'},
                       {'recordedState':'completed'}, {'schema':'wydhosting.lifecycle/1'},
                       {'extra':1}, {'code':'secret/path'}, {'recordedState':'intent-recorded'}):
            with patch.object(m, '_peer', return_value=manager), patch.object(m, '_frame',
                    return_value=c._canonical(dict(good, **change))):
                with self.assertRaises(c.Refused):
                    m.exchange(Mock(), raw, manager_uid=os.getuid(), manager_gid=os.getgid())

    def test_escaping_io_after_durable_preparation_is_indeterminate(self):
        original = m.j.transition
        for failure in (OSError, RuntimeError):
            def publish_then_fail(*args, **kwargs):
                original(*args, **kwargs)
                raise failure('private cleanup detail')
            with patch.object(m.j, 'transition', side_effect=publish_then_fail):
                result = self.call()
            self.assertEqual((result['outcome'], result['code']), ('indeterminate', 'IO'))
            self.assertNotIn('private', str(result))
            before = (self.store/'journal.json').read_bytes()
            self.assertEqual(self.call()['recordedState'], 'prepared')
            self.assertEqual((self.store/'journal.json').read_bytes(), before)

    def test_verifier_cannot_reflect_unknown_exception_codes(self):
        def fail(*_): raise m.j.Refused('private/path')
        result = self.call(verifier=fail)
        self.assertEqual(result['code'], 'VERIFIER_FAILED')
        self.assertNotIn('private', str(result))
        self.assertEqual(m.j._decode((self.store/'journal.json').read_bytes()), {})


class IndependentVerifierTests(PortableTests):
    # Avoid duplicating all portable tests in unittest discovery below.
    def setUp(self):
        super().setUp()
        self.v = m.j.a._sibling('lifecycle_verifier')
        self.owner3 = patch.multiple(self.v.a, _ADMIN_UID=os.getuid(), _ADMIN_GID=os.getgid())
        self.owner3.start(); self.addCleanup(self.owner3.stop)
        self.proofdir = self.root/'proof'; self.proofdir.mkdir(mode=0o700)
        self.pfd = os.open(self.proofdir, os.O_RDONLY | os.O_DIRECTORY); self.addCleanup(os.close, self.pfd)
        self.facts = dict(bootId=BOOT, pid=self.peer.pid, uid=self.peer.uid, gid=self.peer.gid,
            context=self.peer.context, startTime=1234, session='wydhosting-broker@19-32427-61050.service',
            invocation='b'*32, cgroup='/system.slice/broker.service', accountDigest='d'*64,
            deploymentDigest='e'*64, releaseDigest='c'*64)
        self.proof = dict(self.facts, schema='wydhosting.lifecycle-session/1',
            requestDigest=m.j.digest(c._canonical(f.f.request())),
            approvalDigest=m.j.digest(c._canonical(f.f.approval())), historyDigest=m.j.digest(b'{}'),
            observedAt=149, expiresAt=154)
        self.write_proof()
        self.verifier = self.v.ProtectedSessionVerifier(self.pfd, now=lambda:150,
            installed_release_digest='c'*64, observe=lambda _: self.facts)

    def write_proof(self):
        file = self.proofdir/'session.json'
        file.write_bytes(c._canonical(self.proof)); file.chmod(0o600)

    def test_exact_protected_scope_and_default_live_denial(self):
        args = (self.peer, c._canonical(f.f.request()), BOOT, c._canonical(f.f.approval()), b'{}')
        missing = self.v.ProtectedSessionVerifier(self.pfd, now=lambda:150, installed_release_digest='c'*64)
        self.assertFalse(missing.prepare(*args))
        self.assertTrue(self.verifier.prepare(*args))
        self.assertEqual(self.call(verifier=self.verifier,
            preparation=self.verifier.prepare)['recordedState'], 'prepared')
        # The previous history measurement is stale after the first preparation.
        self.assertEqual(self.call(verifier=self.verifier,
            preparation=self.verifier.prepare)['code'], 'SESSION_CHANGED')

    def test_forged_scope_and_observations_refuse(self):
        original = self.proof.copy()
        changes = dict(approvalDigest='f'*64, requestDigest='f'*64, historyDigest='f'*64,
            bootId='22345678-1234-1234-1234-123456789abc', pid=self.peer.pid+1,
            context='unconfined', expiresAt=150, observedAt=151, invocation='invalid',
            cgroup='/system.slice/../broker', releaseDigest='f'*64, extra='forged')
        for field, value in changes.items():
            self.proof = dict(original, **{field:value}); self.write_proof()
            self.assertEqual(self.call(verifier=self.verifier,
                preparation=self.verifier.prepare)['recordedState'], '', field)
        self.proof = original; self.write_proof()
        for field, value in dict(startTime=1235, invocation='f'*32, deploymentDigest='f'*64,
                                accountDigest='f'*64, uid=True).items():
            with patch.object(self.verifier, 'observe', return_value=dict(self.facts, **{field:value})):
                self.assertFalse(self.verifier(self.peer, c._canonical(f.f.request()), BOOT))
        self.assertEqual(m.j._decode((self.store/'journal.json').read_bytes()), {})

    def test_protected_path_and_record_substitution_refuse(self):
        file = self.proofdir/'session.json'; target = self.root/'substitute'
        file.rename(target); file.symlink_to(target)
        self.assertFalse(self.verifier(self.peer, c._canonical(f.f.request()), BOOT))
        file.unlink(); target.rename(file)
        def substitute(_):
            file.unlink(); self.write_proof()
            return self.facts
        with patch.object(self.verifier, 'observe', side_effect=substitute):
            self.assertFalse(self.verifier(self.peer, c._canonical(f.f.request()), BOOT))


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(PortableTests)
    suite.addTests(IndependentVerifierTests(name) for name in (
        'test_exact_protected_scope_and_default_live_denial', 'test_forged_scope_and_observations_refuse',
        'test_protected_path_and_record_substitution_refuse'))
    result = unittest.TextTestRunner().run(suite)
    sys.exit(not result.wasSuccessful())
