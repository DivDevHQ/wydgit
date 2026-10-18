"""Private deterministic REVIEW staging of the existing pinned worker candidate.

No publication, installed-layout change, journal transition, systemd operation or
worker integration. The existing template still names a broker-owned launch job;
publication of these bytes is deliberately BLOCKED. A future manager-owned layout
requires a separately reviewed template pin and launcher/handoff migration.
"""
import importlib.util
import json
import os
from pathlib import Path

_spec = importlib.util.spec_from_file_location('lifecycle_journal', Path(__file__).with_name('lifecycle_journal.py'))
j = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(j)
a, c = j.a, j.c


def prepare(raw, approval_fd, projection_fd, *, now, installed_release_digest):
    """Return (unit, review manifest) from independently protected exact inputs.

    materialization.json is a protected administrator/collector projection, NOT
    another approval: it only adds sealed deployment names/session for rendering.
    It cannot change the exact lifecycle approval. Broker bytes cannot supply it.
    Directory ancestry/writer exclusions have the same installed prerequisites as
    authorization. Preparation grants no journal, publication or effect authority.
    """
    request = c.canonical_request(raw)
    with a._records(approval_fd) as (approval_raw, reservations_raw), \
         a._records(projection_fd, names=('materialization.json',)) as (projection_raw,):
        a._compare(request, approval_raw, reservations_raw, now, installed_release_digest)
        approval, _ = a._approval(approval_raw)
        c.require(approval['operation'] == 'start')
        projection = c._decode(projection_raw)
        c.closed(projection, ('schema', 'approvalDigest', 'binding'))
        c.require(projection_raw == c._canonical(projection) and
                  projection['schema'] == 'wydhosting.lifecycle-materialization/1' and
                  projection['approvalDigest'] == j.digest(c._canonical(approval)) and
                  type(projection['binding']) is str)
        binding_raw = projection['binding'].encode('utf-8')
        binding = c._authority(binding_raw, reservations_raw)
        c.require(binding_raw == c._canonical(binding))
        c.require(all(binding[k] == approval[k] for k in
            (*c.TUPLE_KEYS, 'policyRevision', 'expectedSequence', 'uid', 'gid', 'category',
             'limits', 'templateId', 'templateDigest', 'releaseDigest')) and
            binding['operations'] == ['start'])
        unit, reference_raw = c.render_candidate(request, binding_raw, reservations_raw)
        reference = json.loads(reference_raw)
        manifest = c._canonical(dict(schema='wydhosting.lifecycle-artifact-review/1',
            state='prepared-review-only', publication='INSTALLED_LAYOUT_REQUIRED',
            approvalDigest=j.digest(c._canonical(approval)),
            reservationDigest=approval['reservationDigest'],
            projectionDigest=j.digest(projection_raw),
            target='/run/systemd/system/'+approval['service'],
            targetUid=0, targetGid=0, targetMode='0644', **reference))
    return unit, manifest


def stage(raw, approval_fd, projection_fd, staging_fd, *, now, installed_release_digest):
    """Exclusive fixed filenames in a trusted EMPTY review directory, no overwrite.

    Not a protected publisher. Partial output is retained for inspection on IO
    failure and never treated as installed/effective. Caller handles disposal only
    in its isolated fixture namespace. No caller-supplied names or paths.
    """
    unit, manifest = prepare(raw, approval_fd, projection_fd, now=now,
                             installed_release_digest=installed_release_digest)
    directory = os.dup(staging_fd)
    try:
        a._protected(os.fstat(directory), directory=True)
        j.need(os.listdir(directory) == [], 'STAGING_NOT_EMPTY')
        for name, raw_bytes in (('unit.service', unit), ('manifest.json', manifest)):
            fd = os.open(name, os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW |
                         os.O_CLOEXEC | os.O_NONBLOCK, 0o600, dir_fd=directory)
            try:
                os.fchmod(fd, 0o600)
                offset = 0
                while offset < len(raw_bytes):
                    try:
                        written = os.write(fd, raw_bytes[offset:])
                    except InterruptedError:
                        continue
                    j.need(type(written) is int and 0 < written <= len(raw_bytes)-offset, 'IO')
                    offset += written
                os.fsync(fd)
                info = os.fstat(fd)
                j.need(info.st_nlink == 1 and info.st_size == len(raw_bytes) and
                    os.pread(fd, len(raw_bytes)+1, 0) == raw_bytes and
                    a._stamp(os.stat(name, dir_fd=directory, follow_symlinks=False)) == a._stamp(info), 'CHANGED')
            finally:
                os.close(fd)
        j.need(set(os.listdir(directory)) == {'unit.service', 'manifest.json'}, 'CHANGED')
        with a._records(directory, names=('unit.service', 'manifest.json')) as staged:
            j.need(staged == [unit, manifest], 'CHANGED')
            os.fsync(directory)
    finally:
        os.close(directory)
    return manifest
