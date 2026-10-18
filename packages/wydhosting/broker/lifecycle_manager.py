"""Private non-effectful manager candidate; no listener, CLI or broker integration.

The trusted embedding owns socket acceptance, directory ancestry, installed pins,
clock and session verifier. None may come from request bytes. Default live session
verification refuses. Positive offline fixtures simulate that missing OS authority.
"""
from dataclasses import dataclass
import importlib.util
import json
from pathlib import Path
import socket
import struct
import time
from typing import Protocol

_spec = importlib.util.spec_from_file_location('lifecycle_journal', Path(__file__).with_name('lifecycle_journal.py'))
j = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(j)
c = j.c


@dataclass(frozen=True)
class Peer:
    pid: int
    uid: int
    gid: int
    context: str


class SessionVerifier(Protocol):
    def __call__(self, peer: Peer, request: bytes, boot_id: str) -> bool:
        """Independently prove live PID/start-time, invocation/cgroup, exact approval
        session/tuple mapping, sealed identity and deployment, and current boot.
        Must reobserve; never accept broker claims, digests alone or cached PID.
        """
        ...


class ProtectedEffects(Protocol):
    def publish_and_verify(self, approval_digest: str, request_digest: str, boot_id: str) -> None:
        """Installed-only: protected fixed rendering/publication AND effective PID 1
        verification. No caller paths, unit text, commands or properties accepted.
        """
        ...


class OfflineEffects:
    def publish_and_verify(self, approval_digest: str, request_digest: str, boot_id: str) -> None:
        raise j.Refused('INSTALLED_REQUIRED')


def _unverified(peer, request, boot_id):
    return False


def _boot():
    with open('/proc/sys/kernel/random/boot_id', encoding='ascii') as stream:
        value = stream.read(38).strip()
    c.require(c.matches(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', value))
    return value


def _peer(connection):
    c.require(type(connection) is socket.socket and connection.family == socket.AF_UNIX
              and connection.getsockopt(socket.SOL_SOCKET, socket.SO_TYPE) == socket.SOCK_STREAM)
    pid, uid, gid = struct.unpack('3i', connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    context = connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERSEC, 256).rstrip(b'\0').decode('ascii')
    c.require(c.integer(pid, 1, 2147483647))
    return Peer(pid, uid, gid, context)


def _frame(connection):
    # One frame terminated by write-half close. Absolute deadline defeats slow drip.
    # Zero ancillary buffer: Linux closes undisclosed SCM_RIGHTS descriptors and
    # signals MSG_CTRUNC; all ancillary/truncated messages refuse, no FD handoff.
    deadline = time.monotonic() + 10
    raw = bytearray()
    while True:
        remaining = deadline - time.monotonic()
        c.require(remaining > 0)
        connection.settimeout(remaining)
        data, ancillary, flags, _ = connection.recvmsg(c.MAX_BYTES + 1 - len(raw), 0)
        c.require(not ancillary and not flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC))
        if not data:
            return bytes(raw)
        raw.extend(data)
        c.require(len(raw) <= c.MAX_BYTES)


def handle(connection, journal_fd, approval_fd, *, now, installed_release_digest,
           broker_uid, broker_gid, verify_session: SessionVerifier = _unverified):
    """Return bounded canonical candidate response; NEVER perform lifecycle effects.

    After two independent session/boot observations and exact current authorization,
    reserve via existing serialized journal preparation. No intent/completion, effect
    retry, receipt acceptance or reservation release. Embedding closes the connection.
    Same request recovers its existing state; all possible-effect states quarantine.
    This is an offline rehearsal, not the installed lifecycle response protocol.
    """
    response = dict(schema='wydhosting.lifecycle-candidate-result/1', outcome='refused',
                    code='REQUEST', requestDigest='', operationId='', recordedState='')
    try:
        request = c.canonical_request(_frame(connection))
        value = json.loads(request)
        response.update(requestDigest=j.digest(request), operationId=value['operationId'])
        response['code'] = 'PEER'
        c.require(c.integer(broker_uid, 0, 2147483647) and c.integer(broker_gid, 0, 2147483647))
        peer = _peer(connection)
        c.require((peer.uid, peer.gid, peer.context) ==
                  (broker_uid, broker_gid, 'system_u:system_r:wydhosting_broker_t:s0'))
        boot = _boot()
        response['code'] = 'SESSION_UNVERIFIED'
        c.require(verify_session(peer, request, boot) is True)
        # Static authority is independently read again by journal admission.
        decision = j.a.authorize(request, approval_fd, now=now,
                                 installed_release_digest=installed_release_digest)
        if not decision.allowed:
            response['code'] = decision.code
            return c._canonical(response)
        response['code'] = 'SESSION_CHANGED'
        c.require(_peer(connection) == peer and _boot() == boot and
                  verify_session(peer, request, boot) is True)
        state = j.transition(request, journal_fd, approval_fd, now=now,
                             installed_release_digest=installed_release_digest,
                             expected_state=None, state='prepared')
        response.update(recordedState=state, outcome='indeterminate',
                        code='INSTALLED_REQUIRED' if state == 'prepared' else 'RECONCILIATION_REQUIRED')
    except j.Refused as error:
        # Journal codes are closed constants, never OS exception/path reflection.
        response['code'] = error.code
        if error.code in ('IO', 'CHANGED'):
            response['outcome'] = 'indeterminate'
    except (c.Refused, OSError, ValueError, UnicodeError):
        pass
    except Exception:
        response['code'] = 'VERIFIER_FAILED'
    return c._canonical(response)
