"""Private offline lifecycle/1 contract. No authentication, persistence or OS effects.

Authority/reservation bytes MUST eventually come from independently protected manager
records, never from broker requests. Passing validation is not administrator proof.
This module is deliberately unused by broker.py and has no executable entry point.
"""
import hashlib
import json
import re

MAX_BYTES = 8192
MAX_INTEGER = 9007199254740991
OPERATIONS = ('start', 'status', 'stop-and-retire')
TEMPLATE_ID = 'wydhosting.worker/1'
RESERVED = {'__proto__', 'prototype', 'constructor'}
REQUEST_KEYS = ('schema', 'operationId', 'operation', 'policyRevision', 'tenantId',
                'accountId', 'poolId', 'deploymentGeneration', 'generation', 'epoch',
                'expectedSequence')
TUPLE_KEYS = ('tenantId', 'accountId', 'poolId', 'deploymentGeneration', 'generation', 'epoch')
IDENTITY_KEYS = ('tenantId', 'accountId', 'uid', 'gid', 'category')
LIMITS = {'memoryBytes': (64 * 1024**2, 64 * 1024**3), 'cpuPercent': (1, 6400),
          'tasks': (16, 4096), 'fileDescriptors': (64, 65536),
          'temporaryBytes': (1024**2, 1024**3)}


class Refused(Exception):
    def __init__(self):
        super().__init__('Lifecycle contract refused')


def require(condition):
    if not condition:
        raise Refused()


def closed(value, keys):
    require(type(value) is dict and set(value) == set(keys))


def integer(value, low=1, high=MAX_INTEGER):
    return type(value) is int and low <= value <= high


def matches(pattern, value):
    return type(value) is str and re.fullmatch(pattern, value) is not None


def identifier(value):
    return matches(r'[A-Za-z0-9_-]{1,128}', value) and value not in RESERVED


def _pairs(items):
    result = {}
    for key, value in items:
        require(key not in result and key not in RESERVED)
        result[key] = value
    return result


def _decode(raw):
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BYTES)
    try:
        value = json.loads(raw.decode('utf-8', 'strict'), object_pairs_hook=_pairs,
                           parse_constant=lambda _: require(False))
        def walk(item, depth=0):
            require(depth <= 2)
            if type(item) is dict:
                for key, child in item.items():
                    walk(key, depth + 1)
                    walk(child, depth + 1)
            elif type(item) is list:
                for child in item:
                    walk(child, depth + 1)
            elif type(item) is str:
                require(not any(ord(c) < 32 or ord(c) == 127 or 0xd800 <= ord(c) <= 0xdfff for c in item))
            else:
                require(integer(item, 0))
        walk(value)
        return value
    except (ValueError, UnicodeError, RecursionError):
        raise Refused() from None


def _canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')


def canonical_request(raw):
    """Validate exactly the design's flat request; return stable digestable bytes."""
    value = _decode(raw)
    closed(value, REQUEST_KEYS)
    require(value['schema'] == 'wydhosting.lifecycle/1' and value['operation'] in OPERATIONS)
    require(matches(r'[0-9a-f]{32}', value['operationId']))
    require(matches(r'[0-9a-f]{64}', value['policyRevision']))
    require(all(identifier(value[k]) for k in ('tenantId', 'accountId', 'poolId')))
    require(matches(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', value['generation']))
    require(all(integer(value[k]) for k in ('deploymentGeneration', 'epoch')))
    require(integer(value['expectedSequence'], 0))
    return _canonical(value)


def replay_matches(raw, recorded_raw):
    """Compare a previously persisted canonical request, never attest durability.

    Missing/malformed evidence or another operation ID refuses. False is a same-ID
    conflict; True means identical request only, NOT permission to repeat effects.
    The future manager must return its durable result or quarantine, never re-start.
    """
    current, recorded = canonical_request(raw), canonical_request(recorded_raw)
    require(json.loads(current)['operationId'] == json.loads(recorded)['operationId'])
    return current == recorded


def _authority(raw, reservations_raw):
    value = _decode(raw)
    closed(value, ('schema', 'policyRevision', *TUPLE_KEYS, 'expectedSequence', 'uid', 'gid',
                   'category', 'operations', 'limits', 'deployments', 'session',
                   'templateId', 'templateDigest', 'releaseDigest'))
    require(value['schema'] == 'wydhosting.lifecycle-offline-binding/1')
    # Reuse the exact request grammar for the shared identity and numeric fields.
    shared = {k: value[k] for k in REQUEST_KEYS if k not in ('schema', 'operation', 'operationId')}
    canonical_request(_canonical(dict(shared, schema='wydhosting.lifecycle/1',
                                      operation='start', operationId='0' * 32)))
    require(integer(value['uid'], 60000, 2147483647) and value['uid'] == value['gid']
            and type(value['gid']) is int and integer(value['category'], 1, 1023))
    require(type(value['operations']) is list and 0 < len(value['operations']) <= 3
            and all(type(op) is str and op in OPERATIONS for op in value['operations'])
            and len(set(value['operations'])) == len(value['operations']))
    closed(value['limits'], LIMITS)
    require(all(integer(value['limits'][key], *bounds) for key, bounds in LIMITS.items()))
    require(type(value['deployments']) is list and 0 < len(value['deployments']) <= 16
            and all(identifier(name) for name in value['deployments'])
            and len(set(value['deployments'])) == len(value['deployments']))
    # Observed socket-activated instance: connection counter, peer PID, peer UID.
    # This validates syntax only; the future manager must independently prove it.
    require(matches(r'wydhosting-broker@[1-9][0-9]{0,9}-[1-9][0-9]{0,9}-[1-9][0-9]{0,9}\.service', value['session']))
    require(all(integer(int(part), 1, 2147483647)
                for part in value['session'].removeprefix('wydhosting-broker@').removesuffix('.service').split('-')))
    require(value['templateId'] == TEMPLATE_ID and value['templateDigest'] == TEMPLATE_DIGEST)
    require(hashlib.sha256((TEMPLATE_ID + '\n' + _LAUNCHER + '\n' + _FIXED).encode()).hexdigest() == TEMPLATE_DIGEST)
    require(matches(r'[0-9a-f]{64}', value['releaseDigest']))
    reservations = validate_reservations(reservations_raw)
    require({k: value[k] for k in IDENTITY_KEYS} in reservations)
    return value


def validate_reservations(raw):
    """Validate a bounded identity allocation snapshot; provenance is external."""
    reservations = _decode(raw)
    require(type(reservations) is list and 0 < len(reservations) <= 32)
    seen = [set() for _ in range(3)]
    for record in reservations:
        closed(record, IDENTITY_KEYS)
        require(identifier(record['tenantId']) and identifier(record['accountId']))
        require(integer(record['uid'], 60000, 2147483647) and type(record['gid']) is int
                and record['uid'] == record['gid'] and integer(record['category'], 1, 1023))
        for used, key in zip(seen, ('accountId', 'uid', 'category')):
            require(record[key] not in used)
            used.add(record[key])
    return reservations


def bind_request(raw, authority_raw, reservations_raw):
    """Offline exact binding predicate; inputs are NOT an authorization channel.

    The private binding fixture is not the installed approval schema. Its single
    lifetime/epoch/sequence must be independently selected by the future manager.
    No start-state/rate/active-count decision or ownership observation is made here.
    """
    canonical = canonical_request(raw)
    request, authority = json.loads(canonical), _authority(authority_raw, reservations_raw)
    require(all(request[k] == authority[k] for k in (*TUPLE_KEYS, 'policyRevision', 'expectedSequence')))
    require(request['operation'] in authority['operations'])
    return _canonical({'operationId': request['operationId'],
                       'requestDigest': hashlib.sha256(canonical).hexdigest(),
                       'policyRevision': request['policyRevision'],
                       **{k: request[k] for k in TUPLE_KEYS},
                       'expectedSequence': request['expectedSequence'],
                       'templateId': TEMPLATE_ID, 'templateDigest': TEMPLATE_DIGEST,
                       'releaseDigest': authority['releaseDigest'],
                       'session': authority['session'],
                       **{k: authority[k] for k in ('uid', 'gid', 'category')},
                       'unit': _unit(request)})


def _key(value):
    return hashlib.sha256(value.encode('ascii')).hexdigest()[:32]


def _unit(value):
    return 'wydhosting-pool-' + _key(value['poolId']) + '-' + value['generation'].replace('-', '') + '.service'


# Candidate definition, not an installed systemd template. No caller bytes select
# executable fields. ExecStart is assembled separately from fixed paths and a hash.
# Only these explicit numeric/derived-path substitutions exist; no public templating.
_FIXED = '''[Unit]
Description=WydHosting restricted pool offline candidate
BindsTo={session}
After={session}
[Service]
Type=exec
SELinuxContext=system_u:system_r:wydhosting_worker_t:s0:c{category}
User={uid}
Group={gid}
SupplementaryGroups=
WorkingDirectory={base}
Environment=LANG=C.UTF-8
UnsetEnvironment=NODE_OPTIONS NODE_PATH PYTHONPATH PYTHONHOME LD_PRELOAD LD_LIBRARY_PATH
UMask=0077
Restart=no
KillMode=control-group
TimeoutStartSec=130s
TimeoutStopSec=10s
SendSIGKILL=yes
OOMPolicy=stop
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ProtectHome=yes
PrivateDevices=yes
PrivateTmp=no
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ProtectKernelLogs=yes
ProtectClock=yes
RestrictSUIDSGID=yes
RestrictRealtime=yes
LockPersonality=yes
RestrictNamespaces=yes
RestrictAddressFamilies=AF_UNIX
IPAddressDeny=any
ProcSubset=pid
ProtectProc=invisible
RuntimeDirectory={runtime}
RuntimeDirectoryMode=0700
ReadWritePaths={writes} /run/{runtime}
InaccessiblePaths=/var/lib/wydhosting/provider /var/lib/wydhosting/broker /etc/wydhosting /var/tmp
MemoryAccounting=yes
CPUAccounting=yes
TasksAccounting=yes
MemoryMax={memoryBytes}
MemorySwapMax=0
CPUQuota={cpuPercent}%
TasksMax={tasks}
LimitNOFILE={fileDescriptors}
LimitCORE=0
TemporaryFileSystem=/tmp:rw,nosuid,nodev,noexec,size={temporaryBytes},mode=0700,uid={uid},gid={gid}
StandardInput=null
StandardOutput=null
StandardError=null
'''
_LAUNCHER = '/usr/bin/python3 -I /opt/wydhosting/release/node_modules/wydhosting/broker/worker.py'
# Versioned definition digest covers fixed executable, template and derivation revision.
# Independent release verification must ALSO pin this whole module (derivation code).
TEMPLATE_DIGEST = '84d6687c30af853ff1ba75119704bf1ed78244698f2649c0b83424446fc6381c'


def render_candidate(raw, authority_raw, reservations_raw):
    """Return unit bytes + ownership references only; never open/publish/start anything.

    Uses current broker layout solely for offline parity. Manager protected layout,
    FD handoff and verified release ancestry are unresolved activation gates.
    """
    reference = json.loads(bind_request(raw, authority_raw, reservations_raw))
    require(json.loads(canonical_request(raw))['operation'] == 'start')
    value = _authority(authority_raw, reservations_raw)
    base = '/var/lib/wydhosting/pools/' + value['poolId'] + '/generations/' + str(value['deploymentGeneration'])
    runtime = 'wydhosting/workers/' + value['generation']
    job = '/run/wydhosting/job-' + _key(value['poolId'] + value['generation']) + '.json'
    # Hash-derived job argument; no interpolation mechanism accepts executable text.
    exec_start = 'ExecStart=' + _LAUNCHER + ' ' + job
    writes = ' '.join(base + '/' + name + '/' + child
                      for name in value['deployments'] for child in ('data', 'files', 'media'))
    # Generic formatting is restricted to NON-executable properties.
    properties = _FIXED.format(session=value['session'], category=value['category'], uid=value['uid'],
                               gid=value['gid'], base=base, runtime=runtime, writes=writes,
                               **value['limits'])
    before, separator, after = properties.partition('Type=exec\n')
    require(separator == 'Type=exec\n')
    unit = (before + separator + exec_start + '\n' + after).encode('ascii')
    return unit, _canonical({**reference, 'unitHash': hashlib.sha256(unit).hexdigest()})
