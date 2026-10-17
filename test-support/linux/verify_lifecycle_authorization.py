"""Ordinary-user filesystem attacks; root ownership simulated ONLY in labelled tests.

Real openat2, descriptors, permissions and deterministic mutation barriers. No
privileged SELinux/mount/account/session/systemd qualification or guest connection.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('lifecycle_authorization', Path(sys.argv.pop(1)) / 'lifecycle_authorization.py')
a = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = a
spec.loader.exec_module(a)
c = a.c


def encode(value):
    return c._canonical(value)


def digest(value):
    return hashlib.sha256(encode(value)).hexdigest()


def request():
    return dict(schema='wydhosting.lifecycle/1', operationId='0' * 32, operation='start',
                policyRevision='a' * 64, tenantId='tenant', accountId='account', poolId='pool',
                deploymentGeneration=1, generation='12345678-1234-1234-1234-123456789abc',
                epoch=1, expectedSequence=0)


def reservations():
    return [dict(tenantId='tenant', accountId='account', uid=61000, gid=61000, category=17)]


def approval():
    return dict(request(), schema='wydhosting.lifecycle-approval/1', **{
        **reservations()[0], 'templateId': c.TEMPLATE_ID, 'templateDigest': c.TEMPLATE_DIGEST,
        'releaseDigest': 'c' * 64, 'service': c._unit(request()), 'requestDigest': digest(request()),
        'reservationDigest': digest(reservations()), 'notBefore': 100, 'expiresAt': 200,
        'state': 'active', 'limits': {key: low for key, (low, _) in c.LIMITS.items()}})


class AuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.fd = os.open(self.root, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
        self.addCleanup(os.close, self.fd)
        self.write('approval.json', approval())
        self.write('reservations.json', reservations())
        # Explicit ordinary-user simulation of root ownership, no API owner override.
        self.owner = patch.multiple(a, _ADMIN_UID=os.getuid(), _ADMIN_GID=os.getgid())
        self.owner.start()
        self.addCleanup(self.owner.stop)

    def write(self, name, value):
        path = self.root / name
        path.write_bytes(value if type(value) is bytes else encode(value))
        path.chmod(0o600)

    def decide(self, r=None, **kwargs):
        return a.authorize(encode(request() if r is None else r), self.fd,
                           **dict(dict(now=150, installed_release_digest='c' * 64), **kwargs))

    def denied(self, code=None, **kwargs):
        decision = self.decide(**kwargs)
        self.assertFalse(decision.allowed, decision)
        if code:
            self.assertEqual(decision.code, code)
        return decision

    def test_exact_approval_each_operation_and_canonical_order(self):
        for op in c.OPERATIONS:
            r = dict(request(), operation=op)
            self.write('approval.json', dict(approval(), operation=op, requestDigest=digest(r)))
            self.assertEqual(self.decide(r), a.Decision(True, 'ALLOW'))
        self.write('approval.json', approval())
        raw = json.dumps(dict(reversed(list(request().items()))), indent=2).encode()
        self.assertTrue(a.authorize(raw, self.fd, now=100, installed_release_digest='c'*64).allowed)
        self.assertEqual(self.decide(), self.decide())

    def test_broker_authored_owner_and_claims_rejected(self):
        self.owner.stop()  # Production root check, actual current-UID files.
        self.denied('PROTECTION')
        self.owner.start()
        for key in ['approved', 'adminAuthorized', 'uid', 'approvalPath', 'selinuxContext']:
            self.denied('REQUEST', r=dict(request(), **{key: True}))
        for key in ['approved', 'adminAuthorized', 'operations', 'generationScope', 'path']:
            self.write('approval.json', dict(approval(), **{key: 'anything'}))
            self.denied('APPROVAL')

    def test_all_request_fields_bound_even_with_recomputed_claimed_digest(self):
        for key, value in [('tenantId','foreign'), ('accountId','foreign'), ('poolId','foreign'),
                           ('operation','status'), ('operationId','1'*32), ('policyRevision','b'*64),
                           ('deploymentGeneration',2), ('generation','22345678-1234-1234-1234-123456789abc'),
                           ('epoch',2), ('expectedSequence',1)]:
            with self.subTest(key=key):
                self.write('approval.json', approval())
                self.denied('REQUEST_BINDING', r=dict(request(), **{key:value}))
                # Digest equality alone cannot hide conflicting underlying scope.
                self.write('approval.json', dict(approval(), **{key:value}, requestDigest=digest(request())))
                self.denied('APPROVAL')

    def test_wrong_identity_and_conflicting_reservations(self):
        for key, value in [('tenantId','foreign'), ('accountId','foreign'), ('uid',61001), ('gid',61001), ('category',18)]:
            bad = reservations(); bad[0][key] = value
            self.write('reservations.json', bad)
            self.write('approval.json', dict(approval(), reservationDigest=digest(bad)))
            self.denied('RESERVATION')
        for key in ['accountId','uid','category']:
            other = dict(tenantId='other',accountId='other',uid=62000,gid=62000,category=18)
            other[key] = reservations()[0][key]
            if key == 'uid': other['gid'] = other['uid']
            bad = reservations() + [other]
            self.write('reservations.json', bad)
            self.write('approval.json', dict(approval(), reservationDigest=digest(bad)))
            self.denied('RESERVATION')
        self.write('reservations.json', reservations())
        for change in [dict(uid=61001,gid=61001),dict(category=18)]:
            self.write('approval.json', dict(approval(), **change))
            self.denied('RESERVATION')

    def test_expiration_revocation_and_no_cached_allow(self):
        self.assertTrue(self.decide().allowed)
        for now in [99,200,201,True,'150',150.0,-1]:
            self.denied('TIME', now=now)
        self.assertTrue(self.decide(now=199).allowed)
        self.write('approval.json',dict(approval(),state='revoked'))
        self.denied('REVOKED')
        for change in [dict(notBefore=200),dict(expiresAt=100),dict(state='approved'),dict(expiresAt=True)]:
            self.write('approval.json',dict(approval(),**change)); self.denied('APPROVAL')
        (self.root/'approval.json').unlink()
        self.denied('PROTECTION')

    def test_template_release_service_substitution_and_integrity(self):
        for key, value, code in [('templateId','foreign/2','TEMPLATE'),('templateDigest','d'*64,'TEMPLATE'),
                                 ('service','sshd.service','TEMPLATE'),('releaseDigest','d'*64,'RELEASE')]:
            self.write('approval.json',dict(approval(),**{key:value})); self.denied(code)
        self.write('approval.json',approval())
        for pin in ['d'*64, None, '../release']:
            self.denied('RELEASE',installed_release_digest=pin)
        for key in ['_FIXED','_LAUNCHER']:
            with patch.object(c,key,getattr(c,key)+'changed'):
                self.denied('TEMPLATE')

    def test_same_operation_id_conflicting_digest_is_never_replay_permission(self):
        self.assertTrue(self.decide().allowed)
        changed=dict(request(),operation='stop-and-retire')
        self.assertEqual(changed['operationId'],request()['operationId'])
        self.denied('REQUEST_BINDING',r=changed)
        self.write('approval.json',dict(approval(),requestDigest=digest(changed)))
        self.denied('APPROVAL',r=changed)
        # A second identical allow is static eligibility only, not durable replay.
        self.write('approval.json',approval())
        self.assertTrue(self.decide().allowed)

    def test_resource_ceilings_and_scope_cannot_be_widened(self):
        for key, (low,high) in c.LIMITS.items():
            for value in [low-1,high+1,True,'64',64.0]:
                bad=approval(); bad['limits'][key]=value
                self.write('approval.json',bad); self.denied('APPROVAL')
            bad=approval(); bad['limits'][key]=high
            self.write('approval.json',bad); self.assertTrue(self.decide().allowed)
        for key,value in [('operation','*'),('generation','*'),('deploymentGeneration',[1,2]),('category',[1,1023])]:
            self.write('approval.json',dict(approval(),**{key:value})); self.denied('APPROVAL')
        bad=approval(); bad['limits']['extra']=1
        self.write('approval.json',bad); self.denied('APPROVAL')
        self.write('approval.json',approval())
        self.denied('REQUEST',r=dict(request(),limits={key:high for key,(_,high) in c.LIMITS.items()}))

    def test_missing_malformed_duplicate_and_oversized_records(self):
        good=encode(approval())
        for raw in [b'',good[:-1],b'x'*8193,b'\xff',b'\xef\xbb\xbf'+good,good+b'{}',b'null',b'[]',
                    b'['*3000+b']'*3000,b'{"x":NaN}',b'{"x":1e999}',
                    b'{"state":"revoked",'+good[1:],b'{"st\\u0061te":"revoked",'+good[1:]]:
            self.write('approval.json',raw); self.denied()
        for key in approval():
            bad=approval(); del bad[key]
            self.write('approval.json',bad); self.denied('APPROVAL')
        self.write('approval.json',approval())
        for raw in [b'',b'[]',b'null',encode(reservations())[:-1],b'x'*8193]:
            self.write('reservations.json',raw); self.denied()

    def test_symlink_hardlink_fifo_directory_permissions_and_missing(self):
        for name in a._NAMES:
            path=self.root/name; original=path.read_bytes()
            for mode in [0o644,0o660,0o620,0o666,0o000,0o4600]:
                path.chmod(mode); self.denied('PROTECTION')
            path.chmod(0o600)
            link=self.root/'other'; link.hardlink_to(path)
            self.denied('PROTECTION'); link.unlink()
            path.unlink(); path.symlink_to('/etc/passwd')
            self.denied('PROTECTION'); path.unlink()
            os.mkfifo(path,0o600); self.denied('PROTECTION'); path.unlink()
            path.mkdir(); path.chmod(0o600); self.denied('PROTECTION'); path.rmdir()
            self.denied('PROTECTION'); self.write(name,original)
        self.root.chmod(0o770); self.denied('PROTECTION'); self.root.chmod(0o700)

    def test_no_pathnames_or_untrusted_fd_interface(self):
        for value in [str(self.root), '../approval.json', '/etc/passwd', True, -1, None]:
            self.assertEqual(a.authorize(encode(request()),value,now=150,installed_release_digest='c'*64),
                             a.Decision(False,'PROTECTION'))
        for name in ['../approval.json','/etc/passwd','child/approval.json','.', '..']:
            with self.assertRaises(a.s.Refused):
                a.s.open_relative(self.fd,name,os.O_RDONLY)
        filefd=os.open(self.root/'approval.json',os.O_RDONLY)
        try:
            self.assertFalse(a.authorize(encode(request()),filefd,now=150,installed_release_digest='c'*64).allowed)
        finally: os.close(filefd)

    def test_deterministic_mutation_after_inspection_before_read(self):
        original=os.pread
        def mutate(fd,size,offset):
            # Same inode changed after fstat but before bytes are consumed.
            self.write('approval.json',dict(approval(),state='revoked'))
            return original(fd,size,offset)
        with patch.object(a.os,'pread',side_effect=mutate):
            self.denied('CHANGED')

    def test_deterministic_replacement_and_inplace_change_before_decision(self):
        compare=a._compare
        for name in a._NAMES:
            for replacement in ['rename','inplace','symlink']:
                self.write('approval.json',approval()); self.write('reservations.json',reservations())
                def mutate(*args):
                    compare(*args)
                    path=self.root/name
                    if replacement=='rename':
                        other=self.root/'new'; other.write_bytes(path.read_bytes()); other.chmod(0o600)
                        other.replace(path)
                    elif replacement=='inplace': path.write_bytes(path.read_bytes()+b' ')
                    else: path.unlink(); path.symlink_to('/etc/passwd')
                with self.subTest(name=name,replacement=replacement),patch.object(a,'_compare',side_effect=mutate):
                    self.denied('CHANGED')
                if (self.root/name).is_symlink(): (self.root/name).unlink()

    def test_reservation_digest_and_protection_independent_of_matching_request(self):
        self.write('approval.json',dict(approval(),reservationDigest='d'*64)); self.denied('RESERVATION')
        self.write('approval.json',approval())
        (self.root/'reservations.json').chmod(0o666); self.denied('PROTECTION')
        (self.root/'reservations.json').unlink(); self.denied('PROTECTION')


if __name__ == '__main__':
    unittest.main()
