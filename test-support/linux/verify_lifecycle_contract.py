"""Offline contract attacks only. No systemd, privileged service or MAC evidence."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('lifecycle_contract', Path(sys.argv.pop(1)) / 'lifecycle_contract.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def encode(value):
    return json.dumps(value, separators=(',', ':')).encode()


def request():
    return dict(schema='wydhosting.lifecycle/1', operationId='0' * 32, operation='start',
                policyRevision='a' * 64, tenantId='tenant', accountId='account', poolId='pool',
                deploymentGeneration=1, generation='12345678-1234-1234-1234-123456789abc',
                epoch=1, expectedSequence=0)


def authority():
    value = request()
    del value['operationId'], value['operation']
    return dict(value, schema='wydhosting.lifecycle-offline-binding/1', uid=61000, gid=61000,
                category=17, operations=list(c.OPERATIONS), deployments=['app'],
                limits=dict(memoryBytes=268435456, cpuPercent=50, tasks=64,
                            fileDescriptors=512, temporaryBytes=16777216),
                session='wydhosting-broker@19-32427-61050.service',
                templateId=c.TEMPLATE_ID, templateDigest=c.TEMPLATE_DIGEST, releaseDigest='c' * 64)


def reservations():
    return [{k: authority()[k] for k in c.IDENTITY_KEYS}]


class ContractTests(unittest.TestCase):
    def bind(self, r=None, a=None, slots=None):
        return c.bind_request(encode(request() if r is None else r),
                              encode(authority() if a is None else a),
                              encode(reservations() if slots is None else slots))

    def test_canonical_fixture_and_digest(self):
        expected = ('{"accountId":"account","deploymentGeneration":1,"epoch":1,"expectedSequence":0,'
                    '"generation":"12345678-1234-1234-1234-123456789abc","operation":"start",'
                    '"operationId":"00000000000000000000000000000000","policyRevision":"' + 'a' * 64 +
                    '","poolId":"pool","schema":"wydhosting.lifecycle/1","tenantId":"tenant"}').encode()
        self.assertEqual(c.canonical_request(encode(request())), expected)
        reversed_keys = dict(reversed(list(request().items())))
        self.assertEqual(c.canonical_request(json.dumps(reversed_keys, indent=2).encode()), expected)
        ref = json.loads(self.bind())
        self.assertEqual(ref['requestDigest'], hashlib.sha256(expected).hexdigest())
        self.assertEqual(ref['unit'], 'wydhosting-pool-27cac5503836765cd10751d27ab4a6e1-12345678123412341234123456789abc.service')

    def test_only_exact_operations_and_fields(self):
        for op in c.OPERATIONS:
            self.bind(dict(request(), operation=op))
        for op in ['launch', 'restart', 'daemon-reload', 'publish', 'set-property', '', None, {}, []]:
            with self.subTest(op=op), self.assertRaises(c.Refused):
                self.bind(dict(request(), operation=op))
        for key in request():
            bad = request(); del bad[key]
            with self.subTest(missing=key), self.assertRaises(c.Refused): self.bind(bad)
        for key in ['uid', 'gid', 'category', 'unit', 'session', 'cgroup', 'pid', 'path', 'command',
                    'executable', 'environment', 'dropIns', 'limits', 'templateId', 'template',
                    'adminAuthorized', 'authorization', 'body', '__proto__', 'prototype', 'constructor']:
            with self.subTest(extra=key), self.assertRaises(c.Refused): self.bind(dict(request(), **{key: '/etc/passwd'}))

    def test_duplicate_escaped_duplicate_and_malformed_frames(self):
        raw = encode(request())
        for payload in [b'{"operation":"status",' + raw[1:],
                        b'{"operat\\u0069on":"status",' + raw[1:], raw + b'{}', b'\xff',
                        b'\xef\xbb\xbf' + raw, raw[:-1], b'[]', b'null', b'"' + b'x' * 8192 + b'"',
                        b'[' * 3000 + b']' * 3000, b'{"constructor":{}}',
                        b'{"x":NaN}', b'{"x":Infinity}', b'{"x":1e999}',
                        raw.replace(b'"epoch":1', b'"epoch":' + b'9' * 4500)]:
            with self.subTest(payload=payload[:40]), self.assertRaises(c.Refused): c.canonical_request(payload)
        for raw_type in [None, {}, 'text', bytearray(raw)]:
            with self.assertRaises(c.Refused): c.canonical_request(raw_type)

    def test_numeric_bounds_without_coercion(self):
        for key, low in [('epoch', 1), ('deploymentGeneration', 1), ('expectedSequence', 0)]:
            for value in [True, False, None, '1', 1.0, -1, c.MAX_INTEGER + 1, low - 1]:
                with self.subTest(key=key, value=value), self.assertRaises(c.Refused):
                    c.canonical_request(encode(dict(request(), **{key: value})))
            for value in [low, c.MAX_INTEGER]:
                c.canonical_request(encode(dict(request(), **{key: value})))

    def test_identity_grammar_and_injections(self):
        hostile = ['../app', '/etc/passwd', 'a/b', 'a\\b', '.', '..', 'a\x00b', 'a\nb', 'a\x7fb',
                   'app\nExecStart=/bin/sh', '$(id)', '`id`', '${PATH}', '%i', 'a b', 'a;id',
                   'a"b', 'é', '\ud800', '__proto__', 'constructor', 'prototype', '', 'a' * 129]
        for key in ['tenantId', 'accountId', 'poolId', 'generation', 'operationId', 'policyRevision']:
            for value in hostile:
                with self.subTest(key=key, value=repr(value)), self.assertRaises(c.Refused):
                    self.bind(dict(request(), **{key: value}))
        for key in ['generation', 'operationId', 'policyRevision']:
            with self.assertRaises(c.Refused): self.bind(dict(request(), **{key: ('A' * 32 if key == 'operationId' else request()[key].upper())}))
        with self.assertRaises(c.Refused): self.bind(dict(request(), schema='wydhosting.broker/1'))

    def test_forged_tuple_sequence_revision_and_disallowed_operation(self):
        for key, value in [('tenantId', 'other'), ('accountId', 'other'), ('poolId', 'other'),
                           ('generation', '22345678-1234-1234-1234-123456789abc'),
                           ('deploymentGeneration', 2), ('epoch', 2), ('expectedSequence', 1),
                           ('policyRevision', 'b' * 64)]:
            with self.subTest(key=key), self.assertRaises(c.Refused): self.bind(dict(request(), **{key: value}))
        with self.assertRaises(c.Refused): self.bind(a=dict(authority(), operations=['status']))

    def test_reservations_are_exact_and_nonconflicting(self):
        for key, value in [('tenantId', 'foreign'), ('accountId', 'foreign'), ('uid', 61001),
                           ('gid', 61001), ('category', 18)]:
            with self.subTest(key=key), self.assertRaises(c.Refused):
                self.bind(slots=[dict(reservations()[0], **{key: value})])
        for key in ['accountId', 'uid', 'category']:
            other = dict(tenantId='other', accountId='other', uid=62000, gid=62000, category=18)
            other[key] = reservations()[0][key]
            if key == 'uid': other['gid'] = other['uid']
            with self.subTest(conflict=key), self.assertRaises(c.Refused): self.bind(slots=reservations() + [other])
        for slots in [[], {}, reservations() * 33, [dict(reservations()[0], authorized=True)]]:
            with self.assertRaises(c.Refused): self.bind(slots=slots)

    def test_authority_values_also_are_hostile_input(self):
        for key, values in [('uid', [0, 59999, 2147483648, True]), ('gid', [0, 61001]),
                            ('category', [0, 1024, True]), ('operations', [[], ['start', 'start'], ['restart']]),
                            ('deployments', [[], ['../app'], ['a/b'], ['x\nExecStart=/bin/sh'], ['app', 'app']]),
                            ('session', ['sshd.service', 'wydhosting-broker@../x.service', 'wydhosting-broker@%i.service', 'wydhosting-broker@01-2-3.service',
                                         'wydhosting-broker@2147483648-2-3.service',
                                         'wydhosting-broker@' + 'b' * 32 + '.service\nEnvironment=LD_PRELOAD=x']),
                            ('templateId', ['foreign/1', c.TEMPLATE_ID + '\n']),
                            ('templateDigest', ['d' * 64]), ('releaseDigest', ['../release'])]:
            for value in values:
                with self.subTest(key=key, value=value), self.assertRaises(c.Refused): self.bind(a=dict(authority(), **{key: value}))
        for key in ['path', 'template', 'ExecStart', 'environment', 'unit', 'adminAuthorized']:
            with self.assertRaises(c.Refused): self.bind(a=dict(authority(), **{key: 'anything'}))
        for key, (low, high) in c.LIMITS.items():
            for number in [low - 1, high + 1, True, '64', 64.0]:
                bad = authority(); bad['limits'][key] = number
                with self.subTest(limit=key, number=number), self.assertRaises(c.Refused): self.bind(a=bad)
            for number in [low, high]:
                good = authority(); good['limits'][key] = number; self.bind(a=good)
        bad = authority(); bad['limits']['extra'] = 1
        with self.assertRaises(c.Refused): self.bind(a=bad)

    def test_operation_id_replay_references_do_not_authorize_reexecution(self):
        raw = encode(request())
        self.assertTrue(c.replay_matches(raw, json.dumps(request(), indent=2).encode()))
        self.assertFalse(c.replay_matches(raw, encode(dict(request(), operation='stop-and-retire'))))
        self.assertFalse(c.replay_matches(raw, encode(dict(request(), generation='22345678-1234-1234-1234-123456789abc'))))
        for stored in [b'', encode(dict(request(), operationId='1' * 32))]:
            with self.assertRaises(c.Refused): c.replay_matches(raw, stored)

    def test_fixed_candidate_template_and_integrity(self):
        unit, raw_ref = c.render_candidate(encode(request()), encode(authority()), encode(reservations()))
        text, ref = unit.decode(), json.loads(raw_ref)
        self.assertEqual(ref['unitHash'], hashlib.sha256(unit).hexdigest())
        self.assertEqual(c.TEMPLATE_DIGEST, hashlib.sha256((c.TEMPLATE_ID + '\n' + c._LAUNCHER + '\n' + c._FIXED).encode()).hexdigest())
        self.assertEqual([line for line in text.splitlines() if line.startswith('Exec')],
                         ['ExecStart=/usr/bin/python3 -I /opt/wydhosting/release/node_modules/wydhosting/broker/worker.py /run/wydhosting/job-' + c._key('pool' + request()['generation']) + '.json'])
        for line in ['NoNewPrivileges=yes', 'Restart=no', 'KillMode=control-group', 'CapabilityBoundingSet=',
                     'AmbientCapabilities=', 'RestrictSUIDSGID=yes', 'PrivateTmp=no', 'User=61000',
                     'SELinuxContext=system_u:system_r:wydhosting_worker_t:s0:c17']:
            self.assertIn(line, text.splitlines())
        self.assertNotIn('EnvironmentFile=', text)
        for name, replacement in [('_FIXED', c._FIXED + 'ExecStartPost=/bin/sh\n'),
                                  ('_LAUNCHER', '/bin/sh')]:
            with patch.object(c, name, replacement), self.assertRaises(c.Refused):
                c.render_candidate(encode(request()), encode(authority()), encode(reservations()))
        for op in ['status', 'stop-and-retire']:
            with self.assertRaises(c.Refused):
                c.render_candidate(encode(dict(request(), operation=op)), encode(authority()), encode(reservations()))

    def test_paths_and_symlink_substitutions_never_resolve(self):
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / 'foreign.service'; target.write_text('ExecStart=/bin/sh\n')
            link = Path(root) / 'template'; link.symlink_to(target)
            for key in ['templateId', 'session', 'poolId', 'deployments']:
                bad = authority(); bad[key] = [str(link)] if key == 'deployments' else str(link)
                with self.subTest(key=key), self.assertRaises(c.Refused): self.bind(a=bad)
            self.assertEqual(target.read_text(), 'ExecStart=/bin/sh\n')
            self.assertTrue(link.is_symlink())


if __name__ == '__main__':
    unittest.main()
