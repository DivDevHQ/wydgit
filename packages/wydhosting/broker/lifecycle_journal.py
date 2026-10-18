"""Private offline journal. No effects, replay grants, CLI or broker integration.

Trusted directory FDs only. All writers/maintenance must take the directory flock;
ancestry and SELinux/mount writer exclusion are bootstrap preconditions. See design.
"""
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
import stat
from typing import NamedTuple

# Resolve only installed private siblings, as in the authorization loader.
import importlib.util
from pathlib import Path
_spec = importlib.util.spec_from_file_location('lifecycle_authorization', Path(__file__).with_name('lifecycle_authorization.py'))
a = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(a)
c, s = a.c, a.s
MAX_BYTES = 1024 * 1024
MAX_OPERATIONS = 128
SCHEMA = 'wydhosting.lifecycle-journal/1'
NEXT = {'prepared': ('intent-recorded', 'rejected'),
        'intent-recorded': ('outcome-unknown', 'completed', 'reconciliation-required'),
        'outcome-unknown': ('completed', 'reconciliation-required'),
        'completed': (), 'rejected': (), 'reconciliation-required': ()}
POSTCONDITIONS = {'start': 'exact-invocation-running', 'status': 'exact-state-observed',
                  'stop-and-retire': 'exact-generation-retired'}
# Reconciliation is terminal in NEXT, but still represents possible external effects.
UNRESOLVED = ('prepared', 'intent-recorded', 'outcome-unknown', 'reconciliation-required')
CONFLICT_KEYS = ('poolId', 'accountId', 'uid', 'gid', 'category')


class Recovery(NamedTuple):
    recorded_state: str
    classification: str


class Refused(Exception):
    """Bounded failures; IO failures may mean publication happened. Never retry effects."""
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def need(ok, code='CORRUPT'):
    if not ok:
        raise Refused(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def _evidence(raw, approval):
    value = c._decode(raw)
    extra = ('predecessorApprovalDigest', 'predecessorEvidenceDigest') if approval['operation'] == 'stop-and-retire' else ()
    c.closed(value, ('schema', 'approvalDigest', 'requestDigest', 'tenantId', 'generation',
                     'reservationDigest', 'postcondition', 'referenceDigest', *extra))
    c.require(all(c.matches(r'[0-9a-f]{64}', value[key]) for key in extra))
    c.require(value['schema'] == 'wydhosting.lifecycle-evidence/1')
    c.require(value['approvalDigest'] == digest(c._canonical(approval)))
    c.require(all(value[k] == approval[k] for k in
                  ('requestDigest', 'tenantId', 'generation', 'reservationDigest')))
    c.require(value['postcondition'] == POSTCONDITIONS[approval['operation']])
    c.require(c.matches(r'[0-9a-f]{64}', value['referenceDigest']))
    return value


def _validate(entries):
    c.require(type(entries) is dict and len(entries) <= MAX_OPERATIONS)
    bindings = []
    for op, record in entries.items():
        c.closed(record, ('approval', 'approvalDigest', 'transitions', 'evidence',
                          *(('reconciliation',) if 'reconciliation' in record else ())))
        c.require(type(record['approval']) is str)
        raw = record['approval'].encode('utf-8')
        approval, _ = a._approval(raw)
        c.require(raw == c._canonical(approval) and approval['state'] == 'active')
        c.require(op == approval['operationId'] and record['approvalDigest'] == digest(raw))
        states = record['transitions']
        c.require(type(states) is list and 1 <= len(states) <= 5 and states[0] == 'prepared')
        c.require(all(type(state) is str and state in NEXT for state in states))
        c.require(all(new in NEXT[old] for old, new in zip(states, states[1:])))
        c.require(type(record['evidence']) is str)
        if states[-1] == 'completed':
            _evidence(record['evidence'].encode('utf-8'), approval)
        else:
            c.require(record['evidence'] == '')
        bindings.append((approval, states[-1]))
    # Recheck the entire snapshot on read, including self-consistently checksummed
    # histories created before admission checks existed. Never silently repair them.
    for index, binding in enumerate(bindings):
        c.require(all(_conflict(binding, other) is None for other in bindings[:index]))
    _history(entries)
    reconciliation_ids = set()
    for op, record in entries.items():
        if 'reconciliation' in record:
            try:
                approved = _reconciliation_binding(entries, op, record['reconciliation'])
            except Refused:
                raise c.Refused() from None
            c.require(approved['reconciliationId'] not in reconciliation_ids)
            reconciliation_ids.add(approved['reconciliationId'])


def _shares_resource(approval, other):
    return (any(approval[key] == other[key] for key in CONFLICT_KEYS) or
            c._key(approval['poolId']) == c._key(other['poolId']))


def _conflict(left, right):
    approval, state = left
    other, other_state = right
    # Runtime paths contain the UUID alone: lifetimes are globally never reused,
    # even across pools, rejected requests, or independently approved operation IDs.
    if approval['operation'] == other['operation'] == 'start' and approval['generation'] == other['generation']:
        return 'LIFETIME_REUSED'
    if state in UNRESOLVED and other_state in UNRESOLVED and _shares_resource(approval, other):
        return 'RESOURCE_BUSY'
    return None


# A retirement inherits the exact start identity, not merely a pool/service name.
LIFETIME_KEYS = (*c.TUPLE_KEYS, 'uid', 'gid', 'category', 'service',
                 'templateId', 'templateDigest', 'releaseDigest')


def _history(entries, *, admission=False):
    """Reconstruct a unique contiguous pool chain; dictionary order is irrelevant.

    Each durable preparation consumes one sequence, including rejected operations.
    Every start consumes the next epoch, including a rejected start tombstone.
    No persisted pointer or checksum is treated as external retirement proof.
    """
    def check(ok, code):
        need(ok, code if admission else 'CORRUPT')
    pools = {}
    for record in entries.values():
        approval, _ = a._approval(record['approval'].encode())
        pools.setdefault(approval['poolId'], []).append((approval, record))
    retired = {}
    starts, retirement_attempts = [], set()
    for chain in pools.values():
        chain.sort(key=lambda pair: pair[0]['expectedSequence'])
        start = previous = None
        epoch = 0
        for sequence, (approval, record) in enumerate(chain):
            check(approval['expectedSequence'] == sequence, 'SEQUENCE')
            check(previous is None or previous['transitions'][-1] in ('completed', 'rejected'), 'RESOURCE_BUSY')
            if approval['operation'] == 'start':
                for original in starts:
                    if original['poolId'] == approval['poolId']:
                        check(all(original[key] == approval[key] for key in c.IDENTITY_KEYS), 'PREDECESSOR')
                    else:
                        check(not _shares_resource(original, approval), 'RESOURCE_BUSY')
                starts.append(approval)
                check(start is None or start['transitions'][-1] == 'rejected' or
                      start['approvalDigest'] in retired, 'ACTIVE_START')
                epoch += 1
                check(approval['epoch'] == epoch, 'EPOCH')
                start = record
            else:
                check(start is not None and start['transitions'][-1] == 'completed' and
                      start['approvalDigest'] not in retired, 'PREDECESSOR')
                original, _ = a._approval(start['approval'].encode())
                check(all(approval[key] == original[key] for key in LIFETIME_KEYS), 'PREDECESSOR')
                if approval['operation'] == 'stop-and-retire':
                    check(start['approvalDigest'] not in retirement_attempts, 'RETIREMENT_REUSED')
                    retirement_attempts.add(start['approvalDigest'])
                if approval['operation'] == 'stop-and-retire' and record['transitions'][-1] == 'completed':
                    receipt = _evidence(record['evidence'].encode(), approval)
                    check(receipt['predecessorApprovalDigest'] == start['approvalDigest'] and
                          receipt['predecessorEvidenceDigest'] == digest(start['evidence'].encode()), 'PREDECESSOR')
                    retired[start['approvalDigest']] = record
            previous = record
    return retired


def _admit(entries, approval, verifier):
    for record in entries.values():
        other, _ = a._approval(record['approval'].encode())
        code = _conflict((approval, 'prepared'), (other, record['transitions'][-1]))
        need(code is None, code)
    candidate = dict(approval=c._canonical(approval).decode(),
                     approvalDigest=digest(c._canonical(approval)),
                     transitions=['prepared'], evidence='')
    _history({**entries, approval['operationId']: candidate}, admission=True)
    retired = _history(entries)
    for record in entries.values():
        other, _ = a._approval(record['approval'].encode())
        if _shares_resource(approval, other) and record['approvalDigest'] not in retired:
            _verify(record, verifier, entries)


def _encode(entries):
    _validate(entries)
    payload = c._canonical(entries).decode('utf-8')
    raw = c._canonical(dict(schema=SCHEMA, payload=payload, digest=digest(payload.encode())))
    need(len(raw) <= MAX_BYTES, 'CAPACITY')
    return raw


def _decode(raw):
    try:
        envelope = json.loads(raw.decode('utf-8'), object_pairs_hook=c._pairs)
        c.closed(envelope, ('schema', 'payload', 'digest'))
        need(envelope['schema'] == SCHEMA, 'VERSION')
        c.require(type(envelope['payload']) is str)
        c.require(envelope['digest'] == digest(envelope['payload'].encode('utf-8')))
        entries = json.loads(envelope['payload'], object_pairs_hook=c._pairs)
        _validate(entries)
        c.require(raw == _encode(entries))
        return entries
    except (c.Refused, ValueError, UnicodeError, RecursionError, TypeError, KeyError):
        raise Refused('CORRUPT') from None


@contextmanager
def _locked(trusted_directory_fd):
    directory = None
    try:
        need(type(trusted_directory_fd) is int and trusted_directory_fd >= 0, 'PROTECTION')
        a._protected(os.fstat(trusted_directory_fd), directory=True)
        # Independent open file description: dup alone would share flock ownership.
        directory = os.open('.', os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW,
                            dir_fd=trusted_directory_fd)
        before = os.fstat(directory)
        need((before.st_dev, before.st_ino) ==
             (os.fstat(trusted_directory_fd).st_dev, os.fstat(trusted_directory_fd).st_ino), 'CHANGED')
        a._protected(before, directory=True)
        try:
            fcntl.flock(directory, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Refused('BUSY') from None
        yield directory
    except a._Denied as error:
        raise Refused(error.code) from None
    except s.Refused:
        raise Refused('PROTECTION') from None
    except OSError:
        raise Refused('IO') from None
    finally:
        if directory is not None:
            os.close(directory)  # releases flock, also on process death; no stale lock file


def _names(directory, *, virgin=False):
    names = set(os.listdir(directory))
    need(names == (set() if virgin else {'journal.json'}), 'RECONCILIATION_REQUIRED')


def _read(directory):
    _names(directory)
    fd = s.open_relative(directory, 'journal.json', os.O_RDONLY | os.O_CLOEXEC | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
             before.st_uid == a._ADMIN_UID and before.st_gid == a._ADMIN_GID and
             stat.S_IMODE(before.st_mode) == 0o600 and 0 < before.st_size <= MAX_BYTES, 'PROTECTION')
        raw = os.pread(fd, MAX_BYTES + 1, 0)
        need(len(raw) == before.st_size, 'CHANGED')
        entries = _decode(raw)
        _unchanged(directory, fd, before)
        return entries, before
    finally:
        os.close(fd)


def _unchanged(directory, fd, before):
    need(a._stamp(os.fstat(fd)) == a._stamp(before) and
         a._stamp(os.stat('journal.json', dir_fd=directory, follow_symlinks=False)) == a._stamp(before), 'CHANGED')


def _publish(directory, entries, before=None):
    raw = _encode(entries)
    # Never remove a failed pending publication: its existence quarantines the store.
    fd = os.open('pending.json', os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW |
                 os.O_CLOEXEC | os.O_NONBLOCK, 0o600, dir_fd=directory)
    try:
        os.fchmod(fd, 0o600)
        offset = 0
        while offset < len(raw):
            try:
                written = os.write(fd, raw[offset:])
            except InterruptedError:
                continue
            need(type(written) is int and 0 < written <= len(raw) - offset, 'IO')
            offset += written
        os.fsync(fd)
        info = os.fstat(fd)
        need(os.pread(fd, MAX_BYTES + 1, 0) == raw and info.st_size == len(raw) and info.st_nlink == 1 and
             a._stamp(os.stat('pending.json', dir_fd=directory, follow_symlinks=False)) == a._stamp(info), 'CHANGED')
        os.fsync(directory)  # make the pending marker durable BEFORE publication
        need(set(os.listdir(directory)) == ({'pending.json'} if before is None else
                                             {'journal.json', 'pending.json'}), 'CHANGED')
        if before is not None:
            need(a._stamp(os.stat('journal.json', dir_fd=directory, follow_symlinks=False)) == a._stamp(before), 'CHANGED')
        need(a._stamp(os.fstat(fd)) == a._stamp(info) and
             a._stamp(os.stat('pending.json', dir_fd=directory, follow_symlinks=False)) == a._stamp(info), 'CHANGED')
        os.rename('pending.json', 'journal.json', src_dir_fd=directory, dst_dir_fd=directory)
        os.fsync(directory)
    finally:
        os.close(fd)


def initialize(trusted_directory_fd):
    """Administrator bootstrap ONLY for a proven virgin namespace, never repair/reset.

    Empty directory does not prove no prior effects/history. That proof is external.
    Directory creation/ancestry durability belongs to trusted bootstrap.
    """
    with _locked(trusted_directory_fd) as directory:
        _names(directory, virgin=True)
        _publish(directory, {})


def _approved(raw, approval_fd, now, release):
    request = c.canonical_request(raw)
    with a._records(approval_fd) as (approval_raw, reservations_raw):
        a._compare(request, approval_raw, reservations_raw, now, release)
        approval, _ = a._approval(approval_raw)
    return approval


def _verify(record, verifier, entries):
    if record['transitions'][-1] == 'completed':
        # Trusted verifier must independently load authoritative reference and prove
        # operation-specific external postcondition. Receipt/digest alone proves none.
        try:
            approval, _ = a._approval(record['approval'].encode())
            args = (record['approval'].encode(), record['evidence'].encode())
            if approval['operation'] == 'stop-and-retire':
                receipt = _evidence(args[1], approval)
                starts = [item for item in entries.values()
                          if item['approvalDigest'] == receipt['predecessorApprovalDigest']]
                need(len(starts) == 1, 'EVIDENCE')
                start = starts[0]
                args = (start['approval'].encode(), start['evidence'].encode(), *args)
            verified = callable(verifier) and verifier(*args) is True
        except Exception:
            verified = False
        need(verified, 'EVIDENCE')


def recover(raw, trusted_directory_fd, approval_fd, *, now, installed_release_digest,
            verify_evidence=None):
    """Recorded state only. No return value grants attempt, retry or reconciliation."""
    return _operate(raw, trusted_directory_fd, approval_fd, now, installed_release_digest,
                    None, b'', verify_evidence)


def transition(raw, trusted_directory_fd, approval_fd, *, now, installed_release_digest,
               expected_state, state, evidence=b'', verify_evidence=None):
    """CAS transition; state='prepared', expected_state=None creates once.

    New preparations reserve conflicting unfinished work across operation IDs and
    never reuse start lifetimes. Completion release needs fresh trusted evidence.
    Pool history consumes exact sequences/epochs and retains active starts until
    independent exact retirement verification. No rate or execution admission.
    Trusted offline callers only. No effects may be attached to successful return.
    Completion requires an independent trusted verifier, with no default acceptor.
    """
    need(type(state) is str and state in NEXT and (expected_state is None or
         type(expected_state) is str and expected_state in NEXT), 'TRANSITION')
    return _operate(raw, trusted_directory_fd, approval_fd, now, installed_release_digest,
                    (expected_state, state), evidence, verify_evidence)


def _operate(raw, trusted_directory_fd, approval_fd, now, release, change, evidence, verifier):
    try:
        request = c.canonical_request(raw)
        op = json.loads(request)['operationId']
        with _locked(trusted_directory_fd) as directory:
            directory_before = os.fstat(directory)
            entries, before = _read(directory)
            record = entries.get(op)
            if record is not None:
                _, old_request = a._approval(record['approval'].encode())
                need(request == old_request, 'CONFLICT')
            approval = _approved(raw, approval_fd, now, release)  # no cached authorization
            dirty = record is None or (change is not None and change != (None, 'prepared'))
            if record is None:
                need(change == (None, 'prepared') and evidence == b'', 'MISSING')
                need(len(entries) < MAX_OPERATIONS, 'CAPACITY')
                _admit(entries, approval, verifier)
                record = dict(approval=c._canonical(approval).decode(),
                              approvalDigest=digest(c._canonical(approval)),
                              transitions=['prepared'], evidence='')
                entries[op] = record
            else:
                need(record['approval'] == c._canonical(approval).decode(), 'APPROVAL_CHANGED')
                if change is not None:
                    expected, state = change
                    # Identical duplicate prepare returns recorded state, never resets it.
                    if change != (None, 'prepared'):
                        need(expected == record['transitions'][-1] and
                             state in NEXT[expected], 'TRANSITION')
                        record['transitions'].append(state)
                        need(type(evidence) is bytes, 'EVIDENCE')
                        record['evidence'] = evidence.decode('utf-8')
                    else:
                        need(evidence == b'', 'EVIDENCE')
            _validate(entries)
            _verify(record, verifier, entries)
            for retirement in _history(entries).values():
                if retirement is not record:
                    _verify(retirement, verifier, entries)
            # Verify source did not drift while authorization/evidence were checked.
            need(a._stamp(os.stat('journal.json', dir_fd=directory, follow_symlinks=False)) == a._stamp(before), 'CHANGED')
            _names(directory)
            need(a._stamp(os.fstat(directory)) == a._stamp(directory_before), 'CHANGED')
            if dirty:
                _publish(directory, entries, before)
            else:
                # A previous rename may have succeeded before its final sync failed.
                # Reestablish directory durability before recognizing visible history.
                os.fsync(directory)
            state = record['transitions'][-1]
            if change is None:
                return Recovery(state, 'reconciliation-required' if state in (
                    'intent-recorded', 'outcome-unknown') else state)
            return state
    except a._Denied as error:
        raise Refused(error.code) from None
    except (c.Refused, ValueError, UnicodeError, TypeError, KeyError, RecursionError):
        raise Refused('CORRUPT') from None


# This slice authorizes evidence acceptance only. Quarantine remains terminal and
# reserved: this audit is neither completion nor permission to perform retirement.
_RECON_KEYS = ('schema', 'reconciliationId', 'action', 'operationId', 'bootId',
               'historyDigest', 'startApprovalDigest', 'startEvidenceDigest',
               'retirementApprovalDigest', 'evidenceDigest', *LIFETIME_KEYS,
               'expectedSequence', 'policyRevision', 'reservationDigest')
_RECON_KEYS = tuple(dict.fromkeys(_RECON_KEYS))


def _reconciliation_approval(raw):
    value = c._decode(raw)
    c.closed(value, (*_RECON_KEYS, 'notBefore', 'expiresAt', 'state'))
    c.require(value['schema'] == 'wydhosting.lifecycle-reconciliation/1')
    c.require(value['action'] == 'accept-retirement-evidence')
    c.require(c.matches(r'[0-9a-f]{32}', value['reconciliationId']))
    c.require(c.matches(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', value['bootId']))
    c.require(all(c.matches(r'[0-9a-f]{64}', value[key]) for key in
                  ('historyDigest', 'startApprovalDigest', 'startEvidenceDigest',
                   'retirementApprovalDigest', 'evidenceDigest')))
    c.require(value['state'] in ('active', 'revoked') and
              c.integer(value['notBefore'], 0) and c.integer(value['expiresAt']) and
              value['notBefore'] < value['expiresAt'])
    return value


def _reconciliation_scope(entries, op, evidence, boot_id, reconciliation_id):
    record = entries[op]
    retirement, _ = a._approval(record['approval'].encode())
    need(retirement['operation'] == 'stop-and-retire' and
         record['transitions'][-1] == 'reconciliation-required', 'SCOPE')
    starts = [item for item in entries.values() if
              item['approvalDigest'] == _evidence(evidence, retirement)['predecessorApprovalDigest']]
    need(len(starts) == 1, 'EVIDENCE')
    start = starts[0]
    original, _ = a._approval(start['approval'].encode())
    need(original['operation'] == 'start' and start['transitions'][-1] == 'completed' and
         all(original[key] == retirement[key] for key in LIFETIME_KEYS) and
         _evidence(evidence, retirement)['predecessorEvidenceDigest'] == digest(start['evidence'].encode()),
         'EVIDENCE')
    # Exact affected pool prefix, including status history. Other pools cannot be
    # changed by this operation. Strip only this target's write-once audit.
    history = {}
    for key, item in entries.items():
        approved, _ = a._approval(item['approval'].encode())
        if approved['poolId'] == retirement['poolId']:
            history[key] = {k: v for k, v in item.items() if k != 'reconciliation' or key != op}
    return dict(schema='wydhosting.lifecycle-reconciliation/1', reconciliationId=reconciliation_id,
                action='accept-retirement-evidence', operationId=op, bootId=boot_id,
                historyDigest=digest(c._canonical(history)), startApprovalDigest=start['approvalDigest'],
                startEvidenceDigest=digest(start['evidence'].encode()),
                retirementApprovalDigest=record['approvalDigest'], evidenceDigest=digest(evidence),
                **{key: retirement[key] for key in (*LIFETIME_KEYS, 'expectedSequence',
                                                   'policyRevision', 'reservationDigest')})


def _reconciliation_binding(entries, op, audit):
    c.closed(audit, ('approval', 'evidence'))
    c.require(type(audit['approval']) is str and type(audit['evidence']) is str)
    approval = _reconciliation_approval(audit['approval'].encode())
    c.require(approval['state'] == 'active' and c._canonical(approval).decode() == audit['approval'])
    scope = _reconciliation_scope(entries, op, audit['evidence'].encode(),
                                  approval['bootId'], approval['reconciliationId'])
    c.require(c._canonical({key: approval[key] for key in _RECON_KEYS}) == c._canonical(scope))
    return approval


def reconcile(raw, trusted_directory_fd, approval_fd, *, now, installed_release_digest,
              current_boot_id, evidence, verify_evidence=None, recover=False):
    """Accept exact independently verified retirement evidence, retaining quarantine.

    Private trusted offline callers only. Uses the SAME protected administrator
    approval/reservation loader and directory lock as normal lifecycle operations.
    No retry, completion, release, history rewrite or OS effect is authorized.
    Recovery revalidates current approval/evidence/boot and syncs; it never reapplies.
    current_boot_id comes from trusted kernel observation, never broker input.
    The verifier receives start approval/receipt, retirement approval/receipt,
    reconciliation approval and current boot. It must prove cross-boot continuity
    independently or refuse; a new receipt/reference digest is not that proof.
    """
    try:
        request = c._decode(raw)
        c.closed(request, _RECON_KEYS)
        with _locked(trusted_directory_fd) as directory:
            directory_before = os.fstat(directory)
            entries, before = _read(directory)
            op = request['operationId']
            need(op in entries and type(evidence) is bytes, 'SCOPE')
            record = entries[op]
            scope = _reconciliation_scope(entries, op, evidence, current_boot_id,
                                          request['reconciliationId'])
            need(c._canonical(request) == c._canonical(scope), 'SCOPE')
            # Keep descriptors held through proof validation/publication. Serialized
            # administrator maintenance/writer exclusion remains a precondition.
            with a._records(approval_fd) as (approval_raw, reservations_raw):
                approval = _reconciliation_approval(approval_raw)
                need(approval['state'] == 'active', 'REVOKED')
                need(c.integer(now, 0) and approval['notBefore'] <= now < approval['expiresAt'], 'TIME')
                need(c._canonical({key: approval[key] for key in _RECON_KEYS}) == c._canonical(scope), 'APPROVAL_CHANGED')
                need(c.matches(r'[0-9a-f]{64}', installed_release_digest) and
                     approval['releaseDigest'] == installed_release_digest, 'RELEASE')
                reservations = c.validate_reservations(reservations_raw)
                need(digest(c._canonical(reservations)) == approval['reservationDigest'] and
                     {key: approval[key] for key in c.IDENTITY_KEYS} in reservations, 'RESERVATION')
                audit = dict(approval=c._canonical(approval).decode(), evidence=evidence.decode())
                need(not any(item.get('reconciliation') and key != op and
                             _reconciliation_approval(item['reconciliation']['approval'].encode())['reconciliationId']
                             == request['reconciliationId'] for key, item in entries.items()), 'REPLAY')
                existing = record.get('reconciliation')
                need((existing == audit) if recover else existing is None, 'REPLAY')
                start = next(item for item in entries.values() if
                             item['approvalDigest'] == scope['startApprovalDigest'])
                try:
                    verified = callable(verify_evidence) and verify_evidence(
                        start['approval'].encode(), start['evidence'].encode(),
                        record['approval'].encode(), evidence, c._canonical(approval), current_boot_id) is True
                except Exception:
                    verified = False
                need(verified, 'EVIDENCE')
            need(a._stamp(os.stat('journal.json', dir_fd=directory, follow_symlinks=False)) ==
                 a._stamp(before) and a._stamp(os.fstat(directory)) == a._stamp(directory_before), 'CHANGED')
            _names(directory)
            if recover:
                os.fsync(directory)
            else:
                record['reconciliation'] = audit
                _publish(directory, entries, before)
            return Recovery('reconciliation-required', 'retirement-evidence-accepted')
    except a._Denied as error:
        raise Refused(error.code) from None
    except (c.Refused, ValueError, UnicodeError, TypeError, KeyError, RecursionError):
        raise Refused('CORRUPT') from None
