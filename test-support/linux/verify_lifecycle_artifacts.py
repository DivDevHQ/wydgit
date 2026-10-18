"""Actual current-user review staging; root ownership is explicitly SIMULATED."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.dont_write_bytecode = True
broker = Path(sys.argv.pop(1)).resolve()
spec = importlib.util.spec_from_file_location('artifact_fixtures', Path(__file__).with_name('verify_lifecycle_journal.py'))
f = importlib.util.module_from_spec(spec)
sys.argv.insert(1, str(broker)); spec.loader.exec_module(f)
x = f.j.a._sibling('lifecycle_artifacts')
c = x.c


class ArtifactTests(unittest.TestCase):
    setUp = f.JournalTests.setUp
    write_auth = f.JournalTests.write_auth

    def setUp(self):
        f.JournalTests.setUp(self)
        owner = patch.multiple(x.a, _ADMIN_UID=os.getuid(), _ADMIN_GID=os.getgid())
        owner.start(); self.addCleanup(owner.stop)
        self.project = self.root/'projection'; self.project.mkdir(mode=0o700)
        self.stage = self.root/'stage'; self.stage.mkdir(mode=0o700)
        self.pfd = os.open(self.project, os.O_RDONLY | os.O_DIRECTORY)
        self.sfd = os.open(self.stage, os.O_RDONLY | os.O_DIRECTORY)
        self.addCleanup(os.close, self.pfd); self.addCleanup(os.close, self.sfd)
        self.binding = {k: f.f.approval()[k] for k in (*c.TUPLE_KEYS, 'policyRevision',
            'expectedSequence', 'uid', 'gid', 'category', 'limits', 'templateId',
            'templateDigest', 'releaseDigest')}
        self.binding.update(schema='wydhosting.lifecycle-offline-binding/1', operations=['start'],
            deployments=['app'], session='wydhosting-broker@19-32427-61050.service')
        self.projection = dict(schema='wydhosting.lifecycle-materialization/1',
            approvalDigest=x.j.digest(c._canonical(f.f.approval())), binding=c._canonical(self.binding).decode())
        self.write_projection()

    def write_projection(self):
        file = self.project/'materialization.json'
        file.write_bytes(c._canonical(self.projection)); file.chmod(0o600)

    def prepare(self):
        return x.prepare(c._canonical(f.f.request()), self.afd, self.pfd,
                         now=150, installed_release_digest='c'*64)

    def staging(self):
        return x.stage(c._canonical(f.f.request()), self.afd, self.pfd, self.sfd,
                       now=150, installed_release_digest='c'*64)

    def test_deterministic_pinned_exact_artifacts_and_no_lifecycle_write(self):
        first = self.prepare(); self.assertEqual(self.prepare(), first)
        self.assertEqual(self.staging(), first[1])
        self.assertEqual((self.stage/'unit.service').read_bytes(), first[0])
        manifest = json.loads(first[1])
        self.assertEqual(manifest['publication'], 'INSTALLED_LAYOUT_REQUIRED')
        self.assertEqual(manifest['state'], 'prepared-review-only')
        self.assertEqual(manifest['unitHash'], x.j.digest(first[0]))
        self.assertEqual(manifest['target'], '/run/systemd/system/'+f.f.approval()['service'])
        self.assertEqual(f.j._decode((self.store/'journal.json').read_bytes()), {})
        self.assertEqual(os.stat(self.stage/'unit.service').st_mode & 0o777, 0o600)

    def test_projection_cannot_override_approval_or_template(self):
        original = self.binding.copy()
        for key, val in dict(uid=62000, category=18, poolId='foreign', tenantId='foreign',
            templateDigest='f'*64, releaseDigest='f'*64, operations=['start','stop-and-retire'],
            deployments=['../escape'], session='broker\nExecStart=/bin/sh').items():
            self.projection['binding'] = c._canonical(dict(original, **{key:val})).decode()
            self.write_projection()
            with self.assertRaises(c.Refused): self.prepare()
        self.assertEqual(list(self.stage.iterdir()), [])

    def test_wrong_approval_projection_revocation_and_expiry(self):
        self.projection['approvalDigest'] = 'f'*64; self.write_projection()
        with self.assertRaises(c.Refused): self.prepare()
        self.projection['approvalDigest'] = x.j.digest(c._canonical(f.f.approval())); self.write_projection()
        for change in (dict(state='revoked'), dict(expiresAt=149)):
            self.write_auth('approval.json', dict(f.f.approval(), **change))
            with self.assertRaises(x.a._Denied): self.prepare()
        self.assertEqual(list(self.stage.iterdir()), [])

    def test_symlinks_hardlinks_existing_output_and_untrusted_directory(self):
        target = self.root/'target'; target.write_text('sentinel')
        (self.stage/'unit.service').symlink_to(target)
        with self.assertRaises(x.j.Refused): self.staging()
        self.assertEqual(target.read_text(), 'sentinel')
        (self.stage/'unit.service').unlink()
        self.stage.chmod(0o777)
        with self.assertRaises(x.a._Denied): self.staging()
        self.stage.chmod(0o700)
        proof = self.project/'materialization.json'; proof.rename(self.root/'projection-copy')
        proof.symlink_to(self.root/'projection-copy')
        with self.assertRaises(x.a.s.Refused): self.prepare()
        proof.unlink(); (self.root/'projection-copy').rename(proof)
        os.link(proof, self.root/'hardlink')
        with self.assertRaises(x.a._Denied): self.prepare()

    def test_partial_staging_is_retained_and_never_overwritten(self):
        real = os.write
        calls = 0
        def fail_second(fd, raw):
            nonlocal calls
            calls += 1
            if calls == 2: raise OSError('injected')
            return real(fd, raw)
        with patch.object(x.os, 'write', side_effect=fail_second):
            with self.assertRaises(OSError): self.staging()
        self.assertTrue((self.stage/'unit.service').is_file())
        self.assertEqual((self.stage/'manifest.json').read_bytes(), b'')
        with self.assertRaises(x.j.Refused): self.staging()

if __name__ == '__main__': unittest.main()
