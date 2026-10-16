"""Actual unprivileged Linux primitives; mocked OS administration is labelled below."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
broker_path = Path(sys.argv.pop(1))
spec = importlib.util.spec_from_file_location('broker', broker_path / 'broker.py')
broker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker)
s = broker.s


class BoundaryTests(unittest.TestCase):
    def test_real_launcher_control_fd_survives_exec_for_same_and_different_fd(self):
        import subprocess
        code = '''import importlib.util,os,socket,sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('worker',sys.argv[1]);w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
left,right=socket.socketpair();assert left.fileno()==3
if sys.argv[2]=='move':
 fd=os.dup(left.fileno());left.close();left=socket.socket(fileno=fd);assert os.open('/dev/null',os.O_RDONLY)==3
right.sendall(b'proof');w.inherit_control(left)
os.execve(sys.executable,[sys.executable,'-I','-c',"import os;assert os.read(3,5)==b'proof';print('inherited control verified')"],{'LANG':'C'})
'''
        for mode in ('same', 'move'):
            result = subprocess.run([sys.executable, '-I', '-c', code, str(broker_path/'worker.py'), mode], capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.strip(), 'inherited control verified')

    @unittest.skipIf(os.geteuid() == 0, 'requires an ordinary unprivileged test identity')
    def test_real_nonroot_startup_refusal_has_sanitized_phase_diagnostic(self):
        import subprocess
        result = subprocess.run([sys.executable, '-I', str(broker_path / 'broker.py')], capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 70)
        self.assertEqual(json.loads(result.stderr), {'schema': 'wydhosting.startup-event/1', 'outcome': 'refused', 'phase': 'privilege', 'code': 'BROKER.PRIVILEGE'})

    def test_platform_matrix_accepts_explicit_el10_candidates_not_lookalikes(self):
        for identity, version in [('almalinux', '10'), ('almalinux', '10.2'), ('rhel', '10.0'), ('ubuntu', '24.04'), ('debian', '13')]:
            self.assertIsNotNone(broker.platform_candidate(identity, version))
        for identity, version in [('almalinux', '9.6'), ('almalinux', '11'), ('almalinux', '10evil'), ('almalinux', '10.2.1'), ('rhel', '8'), ('rocky', '10'), ('fedora', '43'), ('mint', '24.04'), ('ubuntu', '24.04.1')]:
            self.assertIsNone(broker.platform_candidate(identity, version))

    def test_mocked_platform_guard_refuses_missing_kernel_or_selinux_prerequisites(self):
        real_open = open
        files = {'/etc/os-release':'ID="almalinux"\nVERSION_ID="10.2"\n', '/proc/1/comm':'systemd\n', '/sys/fs/cgroup/cgroup.controllers':'cpu memory pids\n', '/sys/fs/selinux/enforce':'1\n'}
        def read(filename, *args, **kwargs):
            if filename in files:
                if files[filename] is None: raise FileNotFoundError(filename)
                return io.StringIO(files[filename])
            return real_open(filename, *args, **kwargs)
        with patch('builtins.open', side_effect=read), patch('platform.machine', return_value='x86_64') as machine, patch.object(broker, 'command') as command:
            broker.verify_platform()
            for filename, bad in [('/sys/fs/selinux/enforce','0'), ('/sys/fs/selinux/enforce',None), ('/proc/1/comm','container-init'), ('/sys/fs/cgroup/cgroup.controllers','cpu memory'), ('/etc/os-release','ID=rocky\nID_LIKE="rhel"\nVERSION_ID=10\n')]:
                previous = files[filename]; files[filename] = bad
                try:
                    with self.assertRaises(s.Refused): broker.verify_platform()
                finally: files[filename] = previous
            machine.return_value = 'aarch64'
            with self.assertRaises(s.Refused): broker.verify_platform()
            command.assert_not_called()

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='wyd-i56-primitives-')
        self.root = Path(self.temporary.name)
        self.source = self.root / 'source'
        self.target = self.root / 'target'
        self.source.mkdir(mode=0o700)
        self.target.mkdir(mode=0o700)
        for name in ('content', 'prototypes', 'public'):
            (self.source / name).mkdir()
        (self.source / 'content' / 'app.json').write_bytes(b'{"id":"alpha"}')
        (self.source / 'wydgit.config.json').write_bytes(b'{}')
        self.descriptor = {'directories': ['content', 'prototypes', 'public'], 'files': [
            {'path': 'content/app.json', 'size': 14, 'sha256': hashlib.sha256(b'{"id":"alpha"}').hexdigest()},
            {'path': 'wydgit.config.json', 'size': 2, 'sha256': hashlib.sha256(b'{}').hexdigest()}]}
        self.addCleanup(self.temporary.cleanup)
        # Restore sealed test directories so the unprivileged test owner can clean up.
        self.addCleanup(self.unseal)

    def unseal(self):
        for directory, _, _ in os.walk(self.root):
            os.chmod(directory, 0o700)

    def copy(self, source=None, descriptor=None):
        a = os.open(source or self.source, os.O_RDONLY | os.O_DIRECTORY)
        b = os.open(self.target, os.O_RDONLY | os.O_DIRECTORY)
        try:
            s.stage_tree(a, b, descriptor or self.descriptor, os.getuid(), os.getgid(), owner=os.getuid())
        finally:
            os.close(a)
            os.close(b)

    def test_actual_sealed_copy_matches_exact_bytes_and_excludes_mutable_data(self):
        (self.source / 'data').mkdir()
        (self.source / 'data' / 'secret').write_text('private mutable state')
        self.copy()
        self.assertEqual((self.target / 'content' / 'app.json').read_bytes(), b'{"id":"alpha"}')
        self.assertEqual(stat.S_IMODE((self.target / 'content').stat().st_mode), 0o550)
        self.assertEqual(stat.S_IMODE((self.target / 'content' / 'app.json').stat().st_mode), 0o440)
        self.assertFalse((self.target / 'data').exists())
        # Same UID owns test output: this is not a cross-UID write-denial proof.

    def test_copy_preserves_reviewed_group_read_mode_under_broker_umask(self):
        old = os.umask(0o077)
        try:
            self.copy()
        finally: os.umask(old)
        self.assertEqual(stat.S_IMODE((self.target / 'content' / 'app.json').stat().st_mode), 0o440)

    def test_atomic_public_job_mode_is_exact_under_broker_umask(self):
        fd = os.open(self.target, os.O_RDONLY | os.O_DIRECTORY)
        old = os.umask(0o077)
        try:
            s.atomic_file(fd, 'job.json', b'{"schema":"public-metadata-only"}', mode=0o444)
        finally:
            os.umask(old); os.close(fd)
        self.assertEqual(stat.S_IMODE((self.target / 'job.json').stat().st_mode), 0o444)
        self.assertEqual((self.target / 'job.json').stat().st_nlink, 1)

    def test_traversal_descriptor_refused(self):
        self.descriptor['files'][0]['path'] = '../private'
        with self.assertRaises(s.Refused): self.copy()

    def test_symlink_file_refused(self):
        p = self.source / 'content' / 'app.json'
        p.unlink()
        p.symlink_to('/etc/passwd')
        with self.assertRaises((s.Refused, OSError)): self.copy()

    def test_symlink_directory_refused(self):
        (self.source / 'prototypes').rmdir()
        (self.source / 'prototypes').symlink_to(self.root)
        with self.assertRaises((s.Refused, OSError)): self.copy()

    def test_hardlink_refused(self):
        os.link(self.source / 'content' / 'app.json', self.root / 'other')
        with self.assertRaises(s.Refused): self.copy()

    def test_fifo_refused_without_blocking(self):
        (self.source / 'content' / 'app.json').unlink()
        os.mkfifo(self.source / 'content' / 'app.json')
        with self.assertRaises(s.Refused): self.copy()

    def test_corrupt_hash_refused(self):
        self.descriptor['files'][0]['sha256'] = '0' * 64
        with self.assertRaises(s.Refused): self.copy()

    def test_unapproved_content_refused(self):
        (self.source / 'public' / 'extra').write_text('unapproved')
        with self.assertRaises(s.Refused): self.copy()

    def test_missing_content_refused(self):
        (self.source / 'content' / 'app.json').unlink()
        with self.assertRaises(s.Refused): self.copy()

    def test_source_directory_replacement_cannot_redirect_held_root(self):
        fd = os.open(self.source, os.O_RDONLY | os.O_DIRECTORY)
        dst = os.open(self.target, os.O_RDONLY | os.O_DIRECTORY)
        held = self.root / 'renamed'
        self.source.rename(held)
        self.source.symlink_to('/etc')
        try:
            s.stage_tree(fd, dst, self.descriptor, os.getuid(), os.getgid(), owner=os.getuid())
            self.assertEqual((self.target / 'content' / 'app.json').read_bytes(), b'{"id":"alpha"}')
        finally:
            os.close(fd); os.close(dst)

    def test_symlink_swap_after_open_copies_only_the_held_approved_inode(self):
        original = s.open_relative
        swapped = False
        def swapping(parent, name, flags):
            nonlocal swapped
            fd = original(parent, name, flags)
            if name == 'app.json' and not swapped:
                swapped = True
                p = self.source / 'content' / 'app.json'
                p.rename(p.with_name('retained'))
                p.symlink_to('/etc/passwd')
            return fd
        # Metadata changes on rename may reject; successful copy must be approved bytes.
        try:
            with patch.object(s, 'open_relative', swapping): self.copy()
        except s.Refused:
            pass
        if (self.target / 'content' / 'app.json').exists():
            self.assertIn((self.target / 'content' / 'app.json').read_bytes(), (b'', b'{"id":"alpha"}'))

    def test_interrupted_copy_preserves_known_good_separate_generation(self):
        previous = self.root / 'known-good'
        previous.write_bytes(b'approved-generation')
        self.descriptor['files'][1]['sha256'] = '0' * 64
        with self.assertRaises(s.Refused): self.copy()
        self.assertEqual(previous.read_bytes(), b'approved-generation')

    def test_conflicting_owner_refused(self):
        with patch.object(os, 'fchown') as chown:
            fd = os.open(self.target, os.O_RDONLY | os.O_DIRECTORY)
            try:
                with self.assertRaises(s.Refused): s.mkdir_owned(fd, 'already-there', os.getuid()+1, os.getgid())
            except PermissionError:
                pass  # mock chown does not alter kernel ownership; check still fails.
            finally: os.close(fd)

    def test_strict_json_rejects_duplicate_keys_invalid_utf8_numbers_and_depth(self):
        for raw in (b'{"a":1,"a":2}', b'{"__proto__":{}}', b'\xff', b'{"n":NaN}', b'{"n":1.2}', b'['*34+b'0'+b']'*34, b'x'*(s.MAX_FRAME+1)):
            with self.assertRaises(s.Refused): s.decode(raw)

    def test_kernel_peer_credentials_are_real_not_submitted_uid(self):
        a,b = socket.socketpair()
        try:
            self.assertEqual(s.peercred(a), (os.getpid(), os.getuid(), os.getgid()))
            b.sendall(b'{"uid":0}\n')
            self.assertNotEqual(s.peercred(a)[1], 0)
        finally: a.close(); b.close()

    def test_unauthorized_principal_refused_before_any_account_command(self):
        a,b = socket.socketpair()
        try:
            with patch.object(broker, 'command') as command:
                with self.assertRaises(s.Refused): broker.handle(a, {'providerUid':os.getuid()+1, 'providerGid':os.getgid()}, -1)
                command.assert_not_called()
        finally: a.close(); b.close()

    def test_forged_unknown_or_stale_administrative_requests_refused(self):
        for change in ({'operation':'shell'}, {'policyRevision':'stale'}, {'poolId':'foreign'}, {'extra':'eval'}):
            a,b = socket.socketpair()
            request = {'schema':'wydhosting.broker/1','operation':'ensure-account','poolId':'pool','policyRevision':'approved','body':{}}
            request.update(change)
            s.write_frame(b,request)
            try:
                with patch.object(broker, 'command') as command:
                    with self.assertRaises(s.Refused): broker.handle(a, {'providerUid':os.getuid(),'providerGid':os.getgid(),'policyRevision':'approved','pools':[{'poolId':'pool'}]}, -1)
                    command.assert_not_called()
            finally: a.close(); b.close()

    def test_descriptor_relative_socket_permissions_and_real_peer_binding(self):
        listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        listener.bind(str(self.target / 'http.sock')); listener.listen(4)
        fd = os.open(self.target, os.O_RDONLY | os.O_DIRECTORY)
        try:
            s.expose_ingress(fd, os.getuid(), os.getgid(), os.getpid())
            self.assertEqual(stat.S_IMODE((self.target / 'http.sock').stat().st_mode), 0o660)
            with self.assertRaises(s.Refused): s.expose_ingress(fd, os.getuid(), os.getgid(), os.getpid()+1)
        finally: os.close(fd); listener.close()

    def test_socket_symlink_cannot_redirect_privileged_permission_change(self):
        (self.target / 'http.sock').symlink_to(self.source / 'wydgit.config.json')
        before = (self.source / 'wydgit.config.json').stat().st_mode
        fd = os.open(self.target, os.O_RDONLY | os.O_DIRECTORY)
        try:
            with self.assertRaises(s.Refused): s.expose_ingress(fd, os.getuid(), os.getgid(), os.getpid())
        finally: os.close(fd)
        self.assertEqual((self.source / 'wydgit.config.json').stat().st_mode, before)

    def test_openat2_rejects_symlink_ancestry_without_path_resolution_fallback(self):
        parent = os.open(self.root, os.O_RDONLY | os.O_DIRECTORY)
        (self.root / 'redirect').symlink_to(self.source)
        try:
            with self.assertRaises(s.Refused): s.open_beneath(parent, 'redirect', owners=(os.getuid(),))
            actual = s.open_beneath(parent, 'source', owners=(os.getuid(),))
            os.close(actual)
        finally: os.close(parent)

    def test_openat2_refuses_readonly_proc_mount_crossing(self):
        parent = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
        try:
            with self.assertRaises(s.Refused): s.open_relative(parent, 'proc', os.O_RDONLY | os.O_DIRECTORY)
        finally: os.close(parent)

    def test_unmanaged_effective_unit_or_dropin_refused_before_start(self):
        unit = 'wydhosting-pool-' + '1'*32 + '-' + '2'*32 + '.service'
        values = {'FragmentPath':'/run/systemd/system/'+unit, 'DropInPaths':'', 'User':'60000', 'Group':'60000', 'Restart':'no', 'NoNewPrivileges':'yes', 'KillMode':'control-group', 'ActiveState':'inactive', 'MainPID':'0'}
        broker.verify_unit(values, unit, {'uid':60000,'gid':60000}, inactive=True)
        for attack in ({'FragmentPath':'/etc/systemd/system/'+unit}, {'DropInPaths':'/etc/systemd/system/service.d/foreign.conf'}, {'User':'0'}, {'Restart':'always'}, {'MainPID':'42'}, {'NoNewPrivileges':'no'}):
            with self.assertRaises(s.Refused): broker.verify_unit({**values, **attack}, unit, {'uid':60000,'gid':60000}, inactive=True)

    def test_worker_cannot_forge_broker_cleanup_acknowledgement_on_actual_relay(self):
        import threading
        provider, provider_side = socket.socketpair()
        worker, worker_side = socket.socketpair()
        failures = []
        def run():
            try: broker.relay(provider_side, worker_side, {'poolId':'pool','workerId':'worker','generation':'generation'})
            except s.Refused as error: failures.append(error.code)
        thread = threading.Thread(target=run, daemon=True)
        thread.start()
        try:
            s.write_frame(worker, {'schema':'wydhosting.broker-result/1','ok':True,'state':'stopped','generation':'generation','result':'success','exitStatus':0})
            thread.join(2)
            self.assertFalse(thread.is_alive())
            self.assertTrue(failures)
            provider.settimeout(0.05)
            with self.assertRaises(TimeoutError): provider.recv(1)
            valid = {'schema':'wydgine.worker/2','type':'health','requestId':'r1','poolId':'pool','workerId':'worker','generation':'generation','sequence':1,'body':{}}
            self.assertEqual(broker.validate_worker_frame(valid, valid, 0), 1)
            with self.assertRaises(s.Refused): broker.validate_worker_frame(valid, valid, 1)
        finally:
            provider.close(); provider_side.close(); worker.close(); worker_side.close()

    def test_unit_template_has_closed_fixed_executable_resource_and_lifetime_policy(self):
        pool = {'poolId':'p','account':{'uid':60000,'gid':60000},'base':'/var/lib/wydhosting/pools/p/generations/1','deployments':[{'directory':'app'}], 'limits':{'memoryBytes':134217728,'cpuPercent':50,'tasks':32,'fileDescriptors':128,'temporaryBytes':1048576}}
        unit, text = broker.service_text(pool, '12345678-1234-1234-1234-123456789abc','wydhosting-broker@one.service','/run/wydhosting/job-'+'1'*32+'.json')
        for expected in ('User=60000','NoNewPrivileges=yes','RestrictSUIDSGID=yes','Restart=no','KillMode=control-group','MemorySwapMax=0','RestrictAddressFamilies=AF_UNIX','CPUQuota=50%','TasksMax=32','BindsTo=wydhosting-broker@one.service'):
            self.assertIn(expected,text)
        active = [line for line in (broker_path.parent/'templates/wydhosting-broker@.service').read_text().splitlines() if not line.startswith('#')]
        self.assertNotIn('RestrictSUIDSGID=yes', active)
        self.assertIn('NoNewPrivileges=yes', active)
        pool['selinuxCategory'] = 51
        _, confined = broker.service_text(pool, '12345678-1234-1234-1234-123456789abc','wydhosting-broker@one.service','/run/wydhosting/job-'+'1'*32+'.json')
        self.assertIn('SELinuxContext=system_u:system_r:wydhosting_worker_t:s0:c51\n', confined)
        self.assertNotIn('unconfined', confined)
        for category in (True, 0, 1024, '51\nUser=root'):
            pool['selinuxCategory'] = category
            with self.assertRaises(s.Refused): broker.service_text(pool, '12345678-1234-1234-1234-123456789abc','wydhosting-broker@one.service','/run/wydhosting/job-'+'1'*32+'.json')
        pool['selinuxCategory'] = 51
        pool['deployments'][0]['directory'] = 'app\nUser=root'
        with self.assertRaises(s.Refused): broker.service_text(pool,'1'*32,'wydhosting-broker@one.service','job')

    def test_selinux_label_walk_keeps_nested_content_data_read_only(self):
        (self.target/'app/content/data').mkdir(parents=True)
        (self.target/'app/content/data/file').write_text('sealed')
        (self.target/'app/data').mkdir()
        (self.target/'app/data/file').write_text('mutable')
        seen = {}
        def observe(fd, kind, category):
            seen[os.readlink('/proc/self/fd/'+str(fd))] = (kind, category)
        fd = os.open(self.target, os.O_RDONLY | os.O_DIRECTORY)
        try:
            with patch.object(broker, 'label', side_effect=observe):
                broker.label_staged_tree(fd, 51, ('app/data',))
            self.assertEqual(seen[str(self.target/'app/data/file')], ('data',51))
            self.assertEqual(seen[str(self.target/'app/content/data/file')], ('code',51))
            (self.target/'link').symlink_to(self.source)
            with patch.object(broker, 'label'), self.assertRaises(s.Refused):
                broker.label_staged_tree(fd, 51)
        finally:
            os.close(fd)

    def test_selinux_category_reservation_never_adopts_another_owner_or_category(self):
        pool = {'selinuxCategory':51, 'account':{'accountId':'a','uid':61051,'gid':61051}}
        records = {}
        def read(fd, name):
            if name not in records: raise FileNotFoundError(name)
            return records[name]
        def write(fd, name, value):
            self.assertNotIn(name, records)
            records[name] = value
        with patch.object(s, 'read_file', side_effect=read), patch.object(s, 'atomic_file', side_effect=write):
            broker.reserve_category(pool, -1)
            broker.reserve_category(pool, -1)
            self.assertEqual(len(records), 2)
            with self.assertRaises(s.Refused):
                broker.reserve_category({'selinuxCategory':51,'account':{'accountId':'b','uid':61052,'gid':61052}}, -1)
            with self.assertRaises(s.Refused):
                broker.reserve_category({**pool,'selinuxCategory':52}, -1)

    def test_enforcing_launch_refuses_missing_category_before_any_os_mutation(self):
        with patch('builtins.open', return_value=io.StringIO('1')), patch.object(broker, 'validate_bootstrap') as validate, patch.object(broker, 'ensure_account') as ensure:
            with self.assertRaises(s.Refused) as denied:
                broker.launch(None, {}, {}, {}, -1)
            self.assertEqual(denied.exception.code, 'BROKER.SELINUX_POLICY')
            validate.assert_not_called()
            ensure.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
