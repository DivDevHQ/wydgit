"""Private independent-measurement contract, NOT an installed live verifier.

The trusted embedding opens a writer-excluded evidence directory and installs a
live observer. The default observer refuses. DAC/root ownership alone does not
establish independence from the current root broker: SELinux, mount/ancestor and
installer writer exclusions are REQUIRED. No request can supply this FD/observer.
Measurement records never authorize lifecycle effects or replace the journal.
"""
import importlib.util
import hashlib
import json
from pathlib import Path

_spec = importlib.util.spec_from_file_location('lifecycle_authorization', Path(__file__).with_name('lifecycle_authorization.py'))
a = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(a)
c = a.c

# All fields come from an independent collector, never from broker assertions.
FACTS = ('bootId', 'pid', 'uid', 'gid', 'context', 'startTime', 'session',
         'invocation', 'cgroup', 'accountDigest', 'deploymentDigest', 'releaseDigest')
KEYS = ('schema', 'requestDigest', 'approvalDigest', 'historyDigest',
        'observedAt', 'expiresAt', *FACTS)


def _digest(raw):
    return hashlib.sha256(raw).hexdigest()


def _unobserved(peer):
    return None


class ProtectedSessionVerifier:
    """Compare fresh independently observed facts with exact protected scope.

    observe(peer) must independently read PID/start time, UID/GID/domain, systemd
    invocation and cgroup membership, boot, sealed account and immutable deployment
    bytes/release. It must return exactly FACTS or None. PID reuse and observation
    races must refuse. No such installed collector is supplied here. A protected
    record and matching digests alone NEVER suffice, even for preparation.
    """
    def __init__(self, directory_fd, *, now, installed_release_digest, observe=_unobserved):
        self.directory_fd = directory_fd
        self.now = now
        self.release = installed_release_digest
        self.observe = observe

    def _check(self, peer, request, boot, approval=None, history=None):
        try:
            request = c.canonical_request(request)
            with a._records(self.directory_fd, names=('session.json',)) as (raw,):
                proof = c._decode(raw)
                c.closed(proof, KEYS)
                c.require(raw == c._canonical(proof))
                c.require(proof['schema'] == 'wydhosting.lifecycle-session/1')
                c.require(all(c.matches(r'[0-9a-f]{64}', proof[key]) for key in
                    ('requestDigest', 'approvalDigest', 'historyDigest',
                     'accountDigest', 'deploymentDigest', 'releaseDigest')))
                c.require(c.matches(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', proof['bootId']))
                c.require(c.matches(r'[0-9a-f]{32}', proof['invocation']))
                c.require(c.matches(r'wydhosting-broker@[1-9][0-9]{0,9}-[1-9][0-9]{0,9}-[1-9][0-9]{0,9}\.service', proof['session']))
                c.require(c.matches(r'/[A-Za-z0-9_@.\\/-]{1,1024}', proof['cgroup']) and
                          all(part not in ('', '.', '..') for part in proof['cgroup'][1:].split('/')))
                c.require(c.integer(proof['startTime']) and c.integer(proof['pid'], 1, 2147483647) and
                          c.integer(proof['uid'], 0, 2147483647) and c.integer(proof['gid'], 0, 2147483647))
                tick = self.now()
                c.require(c.integer(tick, 0) and c.integer(proof['observedAt'], 0) and
                          c.integer(proof['expiresAt']) and
                          proof['observedAt'] <= tick < proof['expiresAt'] <= proof['observedAt'] + 5)
                c.require(proof['requestDigest'] == _digest(request) and proof['bootId'] == boot and
                          proof['releaseDigest'] == self.release and
                          (proof['pid'], proof['uid'], proof['gid'], proof['context']) ==
                          (peer.pid, peer.uid, peer.gid, peer.context) and
                          proof['context'] == 'system_u:system_r:wydhosting_broker_t:s0')
                if approval is not None:
                    approved, approved_request = a._approval(approval)
                    c.require(approved_request == request and proof['approvalDigest'] == _digest(approval) and
                              proof['historyDigest'] == _digest(history) and
                              proof['expiresAt'] <= approved['expiresAt'])
                observed = self.observe(peer)
                c.closed(observed, FACTS)
                # Canonical bytes preserve numeric types: True cannot impersonate 1.
                c.require(c._canonical(observed) == c._canonical({k: proof[k] for k in FACTS}))
                c.require(self.now() < proof['expiresAt'])
            return True
        except Exception:
            return False

    def __call__(self, peer, request, boot):
        return self._check(peer, request, boot)

    def prepare(self, peer, request, boot, approval, history):
        """Called only under existing journal lock, with original exact history."""
        return self._check(peer, request, boot, approval, history)
