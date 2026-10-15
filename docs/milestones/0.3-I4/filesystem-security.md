# Filesystem and ownership contract

Preferred managed production layout (future setup engine):

```text
/opt/wydhosting/releases/<version>/        root-owned trusted executable closure
/etc/wydhosting/                          root-owned configuration / secret references
/var/lib/wydhosting/provider/             supervisor-owned registry + operation journal
/var/lib/wydhosting/pools/<pool>/apps/      staged free Apps + confined service state
/run/wydhosting/<pool>/<generation>/       private sockets and transient control state
/home/customer1/brained.com/               approved paid source/deployment parent
/home/customer1/libundance.com/
/home/customer2/example.com/
```

Keep `/home/wydhosting/wydhosting/` as an explicit alternative installation prefix,
including `apps/brained.com -> /home/customer1/brained.com` convenience links if an
operator wants them. It receives the same permissions and checks; links are display
conveniences only. A developer install can use any approved local directory. No
existing App is moved automatically. `/opt` releases are immutable to supervisor,
workers and customers; release updates require a separately authorized operation.

## Registry and executable roots

Provider registry associates canonical App ID with customer, approved canonical
source, uid/gid, deployment digest, service roots/namespaces, pool and ownership epoch.
Neither domain spelling, directory name, matching UID name nor a symlink authorizes
execution. Resolve/validate each root and canonical `content/app.json` identity;
validate complete config, requirements, catalog/receipts and installation recovery.

Current I0 requires one canonical base with distinct relative nonoverlapping App
roots. It cannot directly use arbitrary paid home paths from a single provider base.
Use one pool base per customer or shared pool and stage all its Apps below it; never
set base `/` or `/home` merely to encompass unrelated customers. Never replace the
validator with “realpath succeeded”. Initially keep each App's mutable `data`, `files`,
`media` beneath its App root, because inventory and relocation require confinement.

Recommended snapshot shape is `<pool>/apps/<deploymentId>/` with provider-owned,
worker-read-only `content`, `prototypes`, `public` and trusted config; distinct
worker-writable `data`, `files`, `media` child directories. A top-level root containing
writable service children is not wholly immutable; execution inputs are. Deployment
metadata/config/requirements are generated and sealed by provider, never edited by
worker. Per-customer paid base may live beneath `/home/customer1/` only if provider
controls its ancestry and deployment subdirectories. Customer-writable source is a
separate upload area; never execute directly from it. If users control their home,
use `/var/lib/wydhosting` for execution snapshots and retain homes as source only.

## Permissions and races

- Broker creates accounts/bases with no login shell, no shared writable groups, umask
  077 and no customer access to provider state, control endpoints, other home roots
  or secrets. Supervisor state private 0700, sensitive files 0600; source inputs
  provider-owned and readable only by assigned worker. Service state owned by assigned
  worker, no access by other pool UIDs. Never chmod/chown recursively through links.
- Reject `..`, empty/dot segments, absolute unapproved resources, symlink ancestors,
  symlink files, hardlinked regular files (`nlink != 1`), devices/FIFOs/sockets and
  overlapping resource roots. Reject cross-App remote namespace overlap globally,
  including across different processes; I0 only checks its own inventory.
- Stage from an untrusted upload into a new provider-owned private directory. Walk
  without following links; open files no-follow, fstat type/link count/ownership,
  enforce byte/depth/count limits, copy bytes from opened descriptors, hash destination
  and revalidate. Use descriptor-relative Linux operations where needed; Node path
  lstat/read sequences alone cannot prove resistance to hostile concurrent replacement.
  A reviewed narrow helper or inaccessible frozen source is required for race-safe staging.
- Hardlinks and symlink switching are not fixed by checking realpath once. Recheck
  inode/device/type/ownership where security depends on a stable file; reject changes
  during staging. Atomically rename sealed destination on same filesystem, sync files
  and containing directories for the promised durability profile. Journal activation
  separately; never overwrite an active snapshot in place.
- Customer files cannot select arbitrary service roots or load native code. Trusted
  config maps logical services to approved descendants; external credentials are scoped
  to a provider-approved namespace. Customer/App identity does not authorize sibling
  root access. Full disk encryption/backups require separate operator policy.

Existing inventory checks and startup fingerprints are not race-proof against a
malicious OS writer. This proposal relies on OS ownership preventing writes to
execution inputs plus secure staging. I4 proves current symlink refusal, not the
future staging helper. A shared free pool UID still accesses its pool's mutable
resources; same-process/native compromise remains disclosed.

## I5 attack/acceptance matrix

| Attack | Required result |
| --- | --- |
| Traversal, symlinked root/ancestor, changed convenience link | Reject before registration; do not follow alias into execution |
| Hardlink to secret or another customer, special file | Reject; no copy of unauthorized bytes |
| Swap file/directory between check/open/copy | No-follow descriptor validation or sealed source makes attack fail; race harness required |
| Customer edits source after approval | Running snapshot unchanged; new staging requires reapproval and new digest |
| Worker edits executable config/catalog | OS denies; writable service data remains usable |
| Foreign paid UID reads service data/control socket | Actual kernel denial, not only a SEAM error |
| Two pools claim same local/external resource | Provider registry rejects before second activation |
| Interrupted staging/power loss | Incomplete destination quarantined; no route or grants until validated durable completion |

Installation receipts and relocation SHA-256 records detect drift but do not
independently authenticate a malicious source. Trusted package/publisher approval
and operator root approval remain separate required inputs.
