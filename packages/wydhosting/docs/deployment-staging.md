# Immutable execution staging

**Implemented helper, tested with real unprivileged files. Root/cross-UID integration,
mount attacks and power-loss durability have not executed.** No claim that Node
`realpath()` plus path strings closes a hostile filesystem race.

## Approval

`createLinuxPlan` takes the sole validated provider registry, explicit provider UID/GID,
separate OS limits and already approved per-pool package execution/optional policy.
It requires fixed destination and upload layout. Existing canonical config,
requirements, package catalog/namespace/publisher approvals and canonical App identity
are checked through Wydgine trusted exports. Existing approved fingerprint must match.

The plan adds a bounded sorted file manifest containing path, exact byte size and raw
SHA-256 for every regular execution file in `content`, `prototypes`, `public` and
`wydgit.config.json`, plus exact directories. Installed receipts/catalog live under
content and are included. This supplements the existing fingerprint with actual byte
coverage; it does not pretend that an arbitrary JSON digest seals filesystem bytes.
No alternative publisher signature trust is invented. Root installs the entire exact
reviewed projection; a provider-supplied digest alone cannot authorize staging.

Mutable uploads, `data`, `files`, `media`, caches, node_modules, private operator files
and arbitrary top-level material are not copied. Approved native runtime dependencies
must already be in the protected installed runtime. No npm or lifecycle script runs
from an upload, a worker or the broker. Only portable package content is staged.

## Copy and publication

1. Broker authenticates provider UID, exact policy revision/resource and takes its
   nonblocking pool lock. It verifies the assigned account/ownership marker.
2. Open approved source ancestry without following symlinks. Hold its root descriptor;
   directory names changing afterward cannot redirect the anchor.
3. Allocate a fresh unpredictable staging directory under the protected generation
   parent. Open each source file/directory relative to already held parent descriptors.
4. Check source owner/device/type/link count, exact manifest membership, depth/count/
   per-file/total byte limits (32 / 8192 / 16 MiB / 128 MiB). Reject symlinks, hardlinks,
   FIFOs, devices, sockets, missing and unapproved execution entries.
5. Copy opened bytes, verify size and SHA, compare opened source inode/device/size/
   mtime/ctime/link count before/after. Destination files are newly allocated, then
   fsynced, root-owned and worker-read-only. Destination directory descriptors are synced.
6. Allocate only the fixed mutable service children, worker-owned 0700, separately from
   sealed execution trees. Seal the root-owned deployment manifest including content,
   placement, pool generation and account identity.
7. Sync and rename the fresh tree to its unused numeric deployment generation on the
   same filesystem, then fsync the parent. An existing generation is refused. Pool
   locks serialize publication/launch/reconcile; no active snapshot is overwritten.
8. Before execution, broker compares the protected stored manifest to current root
   approval. Worker independently reruns canonical inventory/package checks and the
   approved fingerprint under its restricted UID before listener readiness.

A crash/failed copy leaves a private nonactive staging tree; prior generation/data is
untouched. No cleanup recursively follows an old customer path. Per-file/directory
fsync and rename describe implementation intent, **not tested sudden-power-loss
consistency**. Disk-full and interrupted-root-staging qualification are still pending.

New worker process generations may restart against the same sealed deployment base,
preserving mutable state. A changed snapshot root is staged separately; activation over
a prior lease refuses `BROKER.MIGRATION_REQUIRED`, preventing implicit empty-data
cutover. I5.7 must transfer/fence data and update the physical owner deliberately.

## Evidence and limits

The unprivileged Python suite actually copies files, creates links/FIFOs, replaces
source directories and swaps a source path after open. It verifies exact copied bytes,
rejection/quarantine and intact separate known-good data. Those tests use the test
operator's UID as destination owner; that UID can chmod its own files. They therefore
**do not prove root-owned immutability against a customer UID**. Fixed-template checks
and command mocks do not improve that claim.

No live private publisher/customer material was copied into a globally readable area.
No native publisher extension installation was added. Kernel, approved native libraries,
compiler/runtime bugs and administrator-controlled release installation remain trusted
execution surfaces requiring independent review and future integrated qualification.

Source descent additionally uses Linux amd64 `openat2` with RESOLVE_BENEATH,
RESOLVE_NO_SYMLINKS and RESOLVE_NO_XDEV. It refuses unavailable primitives rather
than falling back to path checks. This rejects same-device bind mounts as well as
ordinary device changes. The upload root itself must have protected root-owned
ancestry. Local tests exercise real openat2 symlink and existing proc-mount refusal;
privileged concurrent mount substitution remains unexecuted.
