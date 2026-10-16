"""Mocked precondition tests. These do NOT establish firewall enforcement."""
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('probe', Path(sys.argv.pop(1)) / 'firewalld_probe.py')
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)


class GuardTests(unittest.TestCase):
    def test_nonroot_never_runs_a_command(self):
        with patch.object(p.os, 'geteuid', return_value=1000), patch.object(p, 'firewall') as fw:
            with self.assertRaisesRegex(RuntimeError, 'PRIVILEGE'): p.probe('block')
            fw.assert_not_called()

    def test_invalid_zone_never_runs_a_command(self):
        for zone in ('--help', '../public', 'public\n', 'a'*18):
            with patch.object(p, 'firewall') as fw:
                with self.assertRaisesRegex(RuntimeError, 'ZONE'): p.unused(zone)
                fw.assert_not_called()

    def test_default_zone_refused(self):
        with patch.object(p, 'firewall', return_value=SimpleNamespace(stdout='public\n')) as fw:
            with self.assertRaisesRegex(RuntimeError, 'ACTIVE_ZONE'): p.unused('public')
            self.assertEqual(fw.call_count, 1)

    def test_bound_interface_refused(self):
        with patch.object(p, 'firewall', side_effect=[SimpleNamespace(stdout='public\n'), SimpleNamespace(stdout='enp1s0\n')]):
            with self.assertRaisesRegex(RuntimeError, 'ACTIVE_ZONE'): p.unused('block')

    def test_bound_source_refused(self):
        with patch.object(p, 'firewall', side_effect=[SimpleNamespace(stdout='public\n'), SimpleNamespace(stdout=''), SimpleNamespace(stdout='192.0.2.1\n')]):
            with self.assertRaisesRegex(RuntimeError, 'ACTIVE_ZONE'): p.unused('block')

    def test_preexisting_rule_never_schedules_or_mutates(self):
        with patch.object(p.os, 'geteuid', return_value=0), patch.object(p, 'unused'), patch.object(p, 'firewall', return_value=SimpleNamespace(returncode=0)), patch.object(p, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'PREEXISTING_RULE'): p.probe('block')
            run.assert_not_called()


unittest.main(verbosity=2)
