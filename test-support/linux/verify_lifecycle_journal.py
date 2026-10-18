"""Actual unprivileged filesystem tests; root owner checks explicitly simulated.

Faults/barriers are deterministic; no real power loss, SELinux or external effects.
"""
import errno
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.dont_write_bytecode = True
broker = Path(sys.argv.pop(1)).resolve()
spec = importlib.util.spec_from_file_location('lifecycle_journal', broker / 'lifecycle_journal.py')
j = importlib.util.module_from_spec(spec)
spec.loader.exec_module(j)
# Reuse Slice 2 fixtures, never imported runtime from the repository in packed tests.
spec = importlib.util.spec_from_file_location('fixtures', Path(__file__).with_name('verify_lifecycle_authorization.py'))
f = importlib.util.module_from_spec(spec)
sys.argv.insert(1, str(broker))
spec.loader.exec_module(f)
c = j.c


class JournalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = self.root/'store'; self.store.mkdir(mode=0o700)
        self.auth = self.root/'auth'; self.auth.mkdir(mode=0o700)
        self.fd = os.open(self.store, os.O_RDONLY | os.O_DIRECTORY)
        self.afd = os.open(self.auth, os.O_RDONLY | os.O_DIRECTORY)
        self.addCleanup(os.close, self.fd); self.addCleanup(os.close, self.afd)
        self.owner = patch.multiple(j.a, _ADMIN_UID=os.getuid(), _ADMIN_GID=os.getgid())
        self.owner.start(); self.addCleanup(self.owner.stop)
        self.write_auth('approval.json', f.approval())
        self.write_auth('reservations.json', f.reservations())
        j.initialize(self.fd)

    def write_auth(self, name, value):
        path = self.auth/name; path.write_bytes(c._canonical(value)); path.chmod(0o600)

    def call(self, change=None, request=None, **kw):
        args = (c._canonical(f.request() if request is None else request), self.fd, self.afd)
        opts = {**dict(now=150, installed_release_digest='c'*64), **kw}
        if change is None: return j.recover(*args, **opts)
        return j.transition(*args, expected_state=change[0], state=change[1], **opts)

    def prepare(self): return self.call((None, 'prepared'))
    def intent(self): self.prepare(); return self.call(('prepared', 'intent-recorded'))

    def approve(self, request, **identity):
        reservation = dict(f.reservations()[0], tenantId=request['tenantId'],
                           accountId=request['accountId'], **identity)
        self.write_auth('reservations.json', [reservation])
        self.write_auth('approval.json', dict(f.approval(), **{
            **request, **reservation, 'schema':'wydhosting.lifecycle-approval/1',
            'requestDigest':f.digest(request), 'reservationDigest':f.digest([reservation]),
            'service':c._unit(request)}))

    def evidence(self, **kw):
        value = dict(schema='wydhosting.lifecycle-evidence/1', approvalDigest=j.digest(c._canonical(f.approval())),
                     requestDigest=f.digest(f.request()), tenantId='tenant', generation=f.request()['generation'],
                     reservationDigest=f.digest(f.reservations()), postcondition='exact-invocation-running',
                     referenceDigest='d'*64)
        return c._canonical(dict(value, **kw))

    def refuses(self, action, code=None):
        with self.assertRaises(j.Refused) as caught: action()
        if code: self.assertEqual(caught.exception.code, code)

    def test_duplicate_conflict_and_recorded_state_no_republication(self):
        self.assertEqual(self.prepare(), 'prepared')
        before = (self.store/'journal.json').stat().st_ino
        self.assertEqual(self.prepare(), 'prepared')
        self.assertEqual((self.store/'journal.json').stat().st_ino, before)
        self.assertEqual(self.call(), j.Recovery('prepared','prepared'))
        self.refuses(lambda: self.call(request=dict(f.request(), operation='status')), 'CONFLICT')
        self.call(('prepared','intent-recorded'))
        self.assertEqual(self.prepare(), 'intent-recorded')
        self.assertEqual(self.call(), j.Recovery('intent-recorded','reconciliation-required'))

    def test_crash_boundaries_and_no_automatic_effects(self):
        self.refuses(lambda: self.call(), 'MISSING')  # before prepare/intent
        self.prepare()
        self.assertEqual(self.call().recorded_state, 'prepared')
        self.call(('prepared','intent-recorded'))  # crash before effect indistinguishable from after effect
        self.assertEqual(self.call().classification, 'reconciliation-required')
        self.call(('intent-recorded','outcome-unknown'))
        self.assertEqual(self.call(), j.Recovery('outcome-unknown','reconciliation-required'))
        self.call(('outcome-unknown','reconciliation-required'))
        self.refuses(lambda: self.call(('reconciliation-required','intent-recorded')), 'TRANSITION')

    def test_completion_requires_bound_evidence_and_independent_verifier(self):
        self.intent()
        self.refuses(lambda: self.call(('intent-recorded','completed'), evidence=self.evidence()), 'EVIDENCE')
        for key, value in [('tenantId','foreign'),('generation','22345678-1234-1234-1234-123456789abc'),
                           ('reservationDigest','f'*64),('approvalDigest','f'*64),
                           ('requestDigest','f'*64),('postcondition','exact-generation-retired')]:
            self.refuses(lambda: self.call(('intent-recorded','completed'), evidence=self.evidence(**{key:value}),
                                         verify_evidence=lambda *_: True), 'CORRUPT')
        for raw in [b'', b'{}', self.evidence()[:-1]]:
            self.refuses(lambda: self.call(('intent-recorded','completed'), evidence=raw,
                                         verify_evidence=lambda *_: True))
        self.refuses(lambda: self.call(('intent-recorded','completed'), evidence=self.evidence(),
                                     verify_evidence=lambda *_: False), 'EVIDENCE')
        seen=[]
        def verify(approval, evidence):
            seen.append((approval,evidence)); return evidence == self.evidence()
        self.assertEqual(self.call(('intent-recorded','completed'), evidence=self.evidence(),verify_evidence=verify), 'completed')
        self.assertEqual(len(seen),1)
        with patch.object(j.os,'fsync',side_effect=OSError(errno.EIO,'recovery sync')):
            self.refuses(lambda:self.call(verify_evidence=verify), 'IO')
        self.refuses(lambda: self.call(), 'EVIDENCE')
        self.assertEqual(self.call(verify_evidence=verify), j.Recovery('completed','completed'))
        self.refuses(lambda: self.call(verify_evidence=lambda *_: False), 'EVIDENCE')
        self.refuses(lambda: self.call(('completed','intent-recorded')), 'TRANSITION')

    def test_revoked_expired_changed_reservation_and_generation(self):
        self.intent()
        self.write_auth('approval.json', dict(f.approval(),state='revoked'))
        self.refuses(lambda:self.call(), 'REVOKED')
        self.write_auth('approval.json', f.approval())
        self.refuses(lambda:self.call(now=200), 'TIME')
        self.write_auth('reservations.json', [dict(f.reservations()[0],category=18)])
        self.refuses(lambda:self.call(), 'RESERVATION')
        self.write_auth('reservations.json', f.reservations())
        self.write_auth('approval.json', dict(f.approval(),expiresAt=201))
        self.refuses(lambda:self.call(), 'APPROVAL_CHANGED')
        self.refuses(lambda:self.call(request=dict(f.request(),generation='22345678-1234-1234-1234-123456789abc')), 'CONFLICT')

    def test_corrupt_torn_oversized_unknown_format_and_missing(self):
        path=self.store/'journal.json'; good=path.read_bytes()
        for raw in [b'',good[:-1],b'x'*(j.MAX_BYTES+1),b'\xff',good+b' ',b'{"schema":"x",'+good[1:]]:
            path.write_bytes(raw); self.refuses(lambda:self.call())
        bad=json.loads(good); bad['schema']='wydhosting.lifecycle-journal/2'
        path.write_bytes(c._canonical(bad)); self.refuses(lambda:self.call(), 'VERSION')
        bad=json.loads(good); bad['digest']='f'*64
        path.write_bytes(c._canonical(bad)); self.refuses(lambda:self.call(), 'CORRUPT')
        path.unlink(); self.refuses(lambda:self.prepare(), 'RECONCILIATION_REQUIRED')

    def test_invalid_state_history_even_with_recomputed_checksum(self):
        self.prepare(); path=self.store/'journal.json'
        entries=json.loads(json.loads(path.read_bytes())['payload'])
        entries[f.request()['operationId']]['transitions']=['prepared','completed','intent-recorded']
        payload=c._canonical(entries).decode()
        path.write_bytes(c._canonical(dict(schema=j.SCHEMA,payload=payload,digest=j.digest(payload.encode()))))
        self.refuses(lambda:self.call(), 'CORRUPT')

    def test_file_types_links_modes_and_untrusted_inputs(self):
        self.prepare(); path=self.store/'journal.json'; good=path.read_bytes()
        for mode in [0o644,0o400,0o000,0o4600]:
            path.chmod(mode); self.refuses(lambda:self.call(), 'PROTECTION')
        path.chmod(0o600)
        other=self.root/'outside'; other.write_bytes(good); other.chmod(0o600)
        path.unlink(); path.symlink_to(other); self.refuses(lambda:self.call())
        path.unlink(); os.link(other,path); self.refuses(lambda:self.call(), 'PROTECTION')
        path.unlink(); os.mkfifo(path,0o600); self.refuses(lambda:self.call(), 'PROTECTION')
        path.unlink(); path.mkdir(); self.refuses(lambda:self.call(), 'PROTECTION'); path.rmdir()
        path.write_bytes(good); path.chmod(0o600)
        self.store.chmod(0o770); self.refuses(lambda:self.call(), 'PROTECTION'); self.store.chmod(0o700)
        self.owner.stop(); self.refuses(lambda:self.call(), 'PROTECTION'); self.owner.start()
        for fd in [str(self.store),True,-1,None]:
            self.refuses(lambda:j.initialize(fd))
        self.refuses(lambda:j.initialize(self.fd), 'RECONCILIATION_REQUIRED')

    def test_inplace_mutation_and_path_replacement_at_consumption(self):
        self.prepare(); path=self.store/'journal.json'; good=path.read_bytes()
        read=j.os.pread
        def mutate(fd,size,offset):
            data=read(fd,size,offset); path.write_bytes(good); return data
        with patch.object(j.os,'pread',side_effect=mutate):
            self.refuses(lambda:self.call(), 'CHANGED')
        approved=j._approved
        for kind in ['inplace','rename','symlink','directory-mode']:
            if path.is_symlink(): path.unlink()
            path.write_bytes(good); path.chmod(0o600)
            def replace(*args):
                result=approved(*args)
                if kind=='inplace': path.write_bytes(good)
                elif kind=='rename':
                    other=self.root/'new'; other.write_bytes(good); other.chmod(0o600); other.replace(path)
                elif kind=='symlink': path.unlink(); path.symlink_to('/etc/passwd')
                else: self.store.chmod(0o770)
                return result
            with patch.object(j,'_approved',side_effect=replace):
                self.refuses(lambda:self.call(), 'CHANGED')
            self.store.chmod(0o700)

    def test_short_interrupted_and_zero_writes(self):
        write=j.os.write; calls=[]
        def short(fd,raw):
            calls.append(1)
            if len(calls)==1: raise InterruptedError(errno.EINTR,'injected')
            return write(fd,raw[:7])
        with patch.object(j.os,'write',side_effect=short): self.prepare()
        self.assertGreater(len(calls),2); self.assertEqual(self.call().recorded_state,'prepared')
        with patch.object(j.os,'write',return_value=0):
            self.refuses(lambda:self.call(('prepared','intent-recorded')), 'IO')
        self.refuses(lambda:self.call(), 'RECONCILIATION_REQUIRED')

    def test_enospc_eio_and_interrupted_failure_leave_quarantine(self):
        self.prepare()
        for error in [errno.ENOSPC,errno.EIO,errno.EINTR]:
            with self.subTest(error=error), patch.object(j.os,'fsync',side_effect=OSError(error,'injected')):
                self.refuses(lambda:self.call(('prepared','intent-recorded')), 'IO')
            self.refuses(lambda:self.call(), 'RECONCILIATION_REQUIRED')
            (self.store/'pending.json').unlink()  # test reset ONLY; no production repair API
        for error in [errno.ENOSPC,errno.EIO]:
            with patch.object(j.os,'write',side_effect=OSError(error,'injected')):
                self.refuses(lambda:self.call(('prepared','intent-recorded')), 'IO')
            self.refuses(lambda:self.call(), 'RECONCILIATION_REQUIRED'); (self.store/'pending.json').unlink()

    def test_each_completion_publication_crash_boundary(self):
        self.intent(); path=self.store/'journal.json'; original=path.read_bytes()
        sync=j.os.fsync
        for stop in [1,2,3]:
            path.write_bytes(original)
            pending=self.store/'pending.json'
            if pending.exists(): pending.unlink()
            calls=[]
            def fail(fd):
                calls.append(fd)
                if len(calls)==stop: raise OSError(errno.EIO,'injected')
                return sync(fd)
            with patch.object(j.os,'fsync',side_effect=fail):
                self.refuses(lambda:self.call(('intent-recorded','completed'),evidence=self.evidence(),
                                             verify_evidence=lambda *_: True), 'IO')
            if stop<3:
                self.refuses(lambda:self.call(verify_evidence=lambda *_: True), 'RECONCILIATION_REQUIRED')
            else:
                # rename occurred, last directory sync failed: visible completion is
                # recognized ONLY with independently reverified evidence, never replay.
                self.refuses(lambda:self.call(), 'EVIDENCE')
                self.assertEqual(self.call(verify_evidence=lambda *_: True).recorded_state,'completed')

    def test_pending_path_substitution_and_rename_failure(self):
        self.prepare(); outside=self.root/'outside'; outside.write_bytes(b'sentinel')
        pending=self.store/'pending.json'; pending.symlink_to(outside)
        self.refuses(lambda:self.call(('prepared','intent-recorded')), 'RECONCILIATION_REQUIRED')
        self.assertEqual(outside.read_bytes(),b'sentinel'); pending.unlink()
        with patch.object(j.os,'rename',side_effect=OSError(errno.EIO,'injected')):
            self.refuses(lambda:self.call(('prepared','intent-recorded')), 'IO')
        self.refuses(lambda:self.call(), 'RECONCILIATION_REQUIRED')

    def test_short_read_and_pending_mutation_before_atomic_publication(self):
        self.prepare()
        read=j.os.pread
        with patch.object(j.os,'pread',side_effect=lambda fd,n,offset:read(fd,n,offset)[:-1]):
            self.refuses(lambda:self.call(), 'CHANGED')
        sync=j.os.fsync
        for kind in ['inplace','replacement','symlink']:
            calls=[]
            def mutate(fd):
                sync(fd); calls.append(fd)
                if len(calls)==2:
                    pending=self.store/'pending.json'
                    if kind=='inplace': pending.write_bytes(b'corrupt')
                    elif kind=='replacement':
                        other=self.root/'new'; other.write_bytes(pending.read_bytes()); other.chmod(0o600); other.replace(pending)
                    else: pending.unlink(); pending.symlink_to('/etc/passwd')
            with patch.object(j.os,'fsync',side_effect=mutate):
                self.refuses(lambda:self.call(('prepared','intent-recorded')), 'CHANGED')
            self.refuses(lambda:self.call(), 'RECONCILIATION_REQUIRED')
            (self.store/'pending.json').unlink()  # isolated test reset, never automatic recovery

    def test_concurrent_independent_descriptions_process_and_crash_release(self):
        self.prepare()
        with j._locked(self.fd):
            self.refuses(lambda:self.prepare(), 'BUSY')  # catches dup-shared-flock bug
            code='import os,fcntl,sys; f=os.open(sys.argv[1],os.O_RDONLY|os.O_DIRECTORY); fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)'
            result=subprocess.run([sys.executable,'-c',code,str(self.store)],capture_output=True)
            self.assertNotEqual(result.returncode,0); self.assertIn(b'BlockingIOError',result.stderr)
        code='import os,fcntl,sys; f=os.open(sys.argv[1],os.O_RDONLY|os.O_DIRECTORY); fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB); os._exit(0)'
        self.assertEqual(subprocess.run([sys.executable,'-c',code,str(self.store)]).returncode,0)
        self.assertEqual(self.prepare(),'prepared')
        self.call(('prepared','intent-recorded'))
        self.refuses(lambda:self.call(('prepared','rejected')), 'TRANSITION')

    def test_rejected_is_terminal_and_capacity_is_bounded(self):
        self.prepare(); self.assertEqual(self.call(('prepared','rejected')),'rejected')
        self.assertEqual(self.call().recorded_state,'rejected')
        self.refuses(lambda:self.call(('rejected','intent-recorded')), 'TRANSITION')
        with patch.object(j,'MAX_BYTES',1): self.refuses(lambda:self.call(), 'PROTECTION')
        with patch.object(j,'MAX_OPERATIONS',0): self.refuses(lambda:self.call(), 'CORRUPT')
        other=dict(f.request(),operationId='1'*32,generation='22345678-1234-1234-1234-123456789abc')
        self.approve(other)
        with patch.object(j,'MAX_OPERATIONS',1):
            self.refuses(lambda:self.call((None,'prepared'),request=other), 'CAPACITY')
        self.assertEqual(self.call((None,'prepared'),request=other),'prepared')
        entries=json.loads(json.loads((self.store/'journal.json').read_bytes())['payload'])
        self.assertEqual(len(entries),2)
        self.assertEqual(entries[f.request()['operationId']]['transitions'],['prepared','rejected'])

    def test_start_lifetime_tombstone_survives_rejection_and_different_pool(self):
        self.prepare(); self.call(('prepared','rejected'))
        before=(self.store/'journal.json').read_bytes()
        for pool in ['pool','foreign-pool']:
            other=dict(f.request(),operationId='1'*32,poolId=pool,epoch=2)
            self.approve(other)
            self.refuses(lambda:self.call((None,'prepared'),request=other), 'LIFETIME_REUSED')
            self.assertEqual((self.store/'journal.json').read_bytes(),before)

    def test_completed_start_is_still_a_lifetime_tombstone(self):
        self.intent()
        self.call(('intent-recorded','completed'),evidence=self.evidence(),verify_evidence=lambda *_:True)
        other=dict(f.request(),operationId='1'*32)
        self.approve(other)
        self.refuses(lambda:self.call((None,'prepared'),request=other), 'LIFETIME_REUSED')
        # Completion releases only the unfinished-operation reservation. This is
        # explicitly NOT an active-worker limit or permission to start a new worker.
        other=dict(other,generation='22345678-1234-1234-1234-123456789abc')
        self.approve(other)
        self.assertEqual(self.call((None,'prepared'),request=other,verify_evidence=lambda *_:True),'prepared')

    def test_completed_reservation_requires_fresh_verification_to_release(self):
        self.intent()
        evidence=self.evidence()
        self.call(('intent-recorded','completed'),evidence=evidence,verify_evidence=lambda *_:True)
        old_approval=c._canonical(f.approval())
        other=dict(f.request(),operationId='1'*32,operation='status')
        self.approve(other); before=(self.store/'journal.json').read_bytes()
        for verifier in [None,lambda *_:False,lambda *_:1]:
            self.refuses(lambda:self.call((None,'prepared'),request=other,verify_evidence=verifier),'EVIDENCE')
            self.assertEqual((self.store/'journal.json').read_bytes(),before)
        def broken(*_): raise RuntimeError('unavailable evidence')
        self.refuses(lambda:self.call((None,'prepared'),request=other,verify_evidence=broken),'EVIDENCE')
        seen=[]
        def verify(approval,receipt):
            seen.append((approval,receipt)); return (approval,receipt)==(old_approval,evidence)
        self.assertEqual(self.call((None,'prepared'),request=other,verify_evidence=verify),'prepared')
        self.assertEqual(seen,[(old_approval,evidence)])

    def test_all_operations_block_on_unresolved_pool_or_reservation(self):
        self.prepare(); before=(self.store/'journal.json').read_bytes()
        # Disjoint tenant/account/pool and numeric reservation, except one dimension.
        for key in j.CONFLICT_KEYS:
            for operation in c.OPERATIONS:
                other=dict(f.request(),operationId='1'*32,operation=operation,
                           tenantId='other-tenant',accountId='other-account',poolId='other-pool',
                           generation='22345678-1234-1234-1234-123456789abc')
                identity=dict(uid=62000,gid=62000,category=18)
                if key in other: other[key]=f.request()[key]
                elif key in ('uid','gid'): identity.update(uid=61000,gid=61000)
                else: identity[key]=17
                self.approve(other,**identity)
                self.refuses(lambda:self.call((None,'prepared'),request=other), 'RESOURCE_BUSY')
                self.assertEqual((self.store/'journal.json').read_bytes(),before)

    def test_ambiguity_remains_reserved_and_new_approval_cannot_override_it(self):
        self.intent()
        other=dict(f.request(),operationId='1'*32,operation='stop-and-retire')
        for change in [None,('intent-recorded','outcome-unknown'),
                       ('outcome-unknown','reconciliation-required')]:
            self.approve(f.request())
            if change: self.call(change)
            self.approve(other)
            self.refuses(lambda:self.call((None,'prepared'),request=other), 'RESOURCE_BUSY')
        self.approve(f.request())
        self.assertEqual(self.prepare(),'reconciliation-required')  # duplicate, no reset

    def test_disjoint_operations_and_rejected_reservation_release(self):
        self.prepare()
        other=dict(f.request(),operationId='1'*32,tenantId='other-tenant',accountId='other-account',
                   poolId='other-pool',generation='22345678-1234-1234-1234-123456789abc')
        self.approve(other,uid=62000,gid=62000,category=18)
        self.assertEqual(self.call((None,'prepared'),request=other),'prepared')
        self.approve(f.request()); self.call(('prepared','rejected'))
        replacement=dict(f.request(),operationId='2'*32,operation='status')
        self.approve(replacement)
        self.assertEqual(self.call((None,'prepared'),request=replacement),'prepared')

    def test_conflicting_histories_quarantine_even_with_valid_checksum(self):
        self.prepare(); path=self.store/'journal.json'; good=path.read_bytes()
        for lifetime in [f.request()['generation'],'22345678-1234-1234-1234-123456789abc']:
            entries=json.loads(json.loads(good)['payload'])
            other=dict(f.request(),operationId='1'*32,generation=lifetime)
            self.approve(other)
            approval=(self.auth/'approval.json').read_bytes()
            entries[other['operationId']]=dict(approval=approval.decode(),approvalDigest=j.digest(approval),
                                               transitions=['prepared'],evidence='')
            # Bypass the production encoder to model incompatible/corrupted history.
            payload=c._canonical(entries)
            path.write_bytes(c._canonical(dict(schema=j.SCHEMA,payload=payload.decode(),digest=j.digest(payload))))
            self.refuses(lambda:self.call(request=other), 'CORRUPT')
            self.refuses(lambda:self.call((None,'prepared'),request=other), 'CORRUPT')

    def test_competing_admission_before_and_after_durable_publication(self):
        publish=j._publish; seen=[]
        other=dict(f.request(),operationId='1'*32,operation='status')
        def competing(*args):
            self.refuses(lambda:self.call((None,'prepared'),request=other), 'BUSY')
            seen.append(True)
            return publish(*args)
        with patch.object(j,'_publish',side_effect=competing): self.prepare()
        self.assertEqual(seen,[True])
        self.approve(other)
        self.refuses(lambda:self.call((None,'prepared'),request=other), 'RESOURCE_BUSY')

    def test_interrupted_prepare_cannot_admit_an_overlapping_successor(self):
        sync=j.os.fsync; calls=[]
        def fail(fd):
            calls.append(fd)
            if len(calls)==3: raise OSError(errno.EIO,'post-rename sync')
            sync(fd)
        with patch.object(j.os,'fsync',side_effect=fail):
            self.refuses(lambda:self.prepare(),'IO')
        for generation,code in [(f.request()['generation'],'LIFETIME_REUSED'),
                                ('22345678-1234-1234-1234-123456789abc','RESOURCE_BUSY')]:
            other=dict(f.request(),operationId='1'*32,generation=generation)
            self.approve(other)
            self.refuses(lambda:self.call((None,'prepared'),request=other),code)
        self.approve(f.request())
        self.assertEqual(self.prepare(),'prepared')  # sync/recover only; never effect permission


if __name__ == '__main__': unittest.main()
