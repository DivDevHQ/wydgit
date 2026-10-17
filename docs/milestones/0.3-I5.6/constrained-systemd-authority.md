# I5.6 constrained systemd authority — Phase 1

Date: 2026-10-17. Baseline: `develop/0.3` at
`a0ff09f8a433e18ae82aad308cdfa105a94af23b`, clean, tracking ref and live
`origin/develop/0.3` equal. Version stays **0.3.0-alpha.15**.

**Offline contract/candidate renderer (Slice 1) and protected static authorization
(Slice 2) implemented below; no active
manager, installed protocol, policy or runtime change is implemented.**
The current broker remains experimental and is not fully compromise contained.
This document specifies an internal migration contract, not a new public API or
permission to deploy. A complete authority transition is the smallest safe runtime
slice: independently validating requests while retaining broker unit writes would
leave the demonstrated architecture gap open. Slice 1 supplies private offline
validation without presenting it as an authority transition.

## Observed authority and evidence

The source paths below are relative to `packages/wydhosting/` at the baseline.

| Path | Actual behavior and implication |
| --- | --- |
| `broker/broker.py`: `service_text`, `launch` | Renders a complete service containing User/Group, ExecStart, environment, SELinuxContext, writable paths and dependencies. Atomically publishes `/run/systemd/system/wydhosting-pool-<pool hash>-<lifetime>.service`, then executes `systemctl daemon-reload` and `start`. |
| `templates/wydhosting-broker@.service` | Runs as root in `wydhosting_broker_t`, with CHOWN/DAC_OVERRIDE/FOWNER, writable `/run/systemd/system`, `/run/wydhosting`, `/var/lib/wydhosting`. `/etc/systemd` and approval are read-only. NNP and capability bounds constrain the broker process, not the service definitions it can submit to PID 1. |
| `selinux/wydhosting_worker.cil`: broker rules | Allows `systemd_unit_file_t` directory write/add/remove; new files transition to `wydhosting_broker_unit_t`, whose file permissions include create/write/setattr/link/unlink/rename. Grants that type service start/stop/status, `init_t` system reload, systemctl execution and private manager socket access. Type enforcement does not validate unit names or directives. |
| `broker/broker.py`: `verify_unit`, `owned_status` | Checks exact FragmentPath, empty DropInPaths, selected effective service properties, unit hash, invocation, cgroup, PID/start-time. Useful against external drift in normal execution; checks and expected hashes are controlled by the same broker. |
| `broker/broker.py`: `launch`, `stop_owned`, `handle` | Writes starting/running/stopped leases in broker state; stops an exact recorded service, checks cgroup emptiness, reconciles on provider request. Per-pool flock and BindsTo bind normal session lifecycle. A compromised broker need not honor these Python checks. |
| `broker/broker.py`: `retire_job`, launch finally | Retires exact public job/socket names after stopped evidence; launch also unlinks its listener name in finally. Both are name-based cleanup in a broker-writable directory. Units/leases/categories/accounts/data are retained. |
| `broker/security.py` | Descriptor-held ancestry, openat2, regular-file/owner/link validation and durable atomic publication protect normal operations. They do not exclude another authorized directory writer between checks and unlink. |
| `broker/provision_accounts.py`, `ensure_account` | Administrator-only provisioning seals proof under `/etc/wydhosting/accounts`; broker reads it and live identities. Keep this separation; it does not defeat indirect execution via PID 1. |

The existing closed provider protocol accepts no raw unit or shell command. That
protects against malformed provider input, not compromise of the process holding
the above OS rights. A compromised broker can author different managed-type bytes
and ask PID 1 to interpret them. It need not execute a forbidden account tool in
its own domain. Direct exec/account/host-write denials and the historical installed
99/99 campaign therefore do not establish containment of this path. No new real
exploit or SELinux bypass is asserted here.

Preserve historical sections of [verification](verification.md), [broker security](broker-security.md),
[SELinux limits](selinux.md) and the complete
[artifact-replacement diagnostic](retirement-hardening-2026-10-17.json) unchanged
as historical evidence. The latter substituted artifacts during terminal callbacks:
both replacement sentinels were unlinked. Its manager/cgroup/root ownership were
simulated; filesystem replacements were real current-UID operations. It proves an
unresolved check/unlink window for an already authorized writer, not customer write
access or real systemd race safety. Passing 42 primitive tests does not reverse it.

## Chosen boundary

Introduce one administrator-installed **lifecycle manager**, in its own confined
SELinux domain and service. It alone renders/publishes approved generation units,
requests their lifecycle operations and owns lifecycle evidence. Publication is an
internal step of start, never an independently callable arbitrary-file operation.
Use a fixed administrator-owned rendering template with typed substitutions because
per-account limits, MCS categories and approved deployment write sets currently vary.
Do not accept template IDs or template bytes from the caller. Template/release/policy
revisions are pinned in administrator approval. Installing or changing a template
is an offline administrator action.

The session broker keeps approved staging, authenticated worker relay and required
categorized ingress adaptation. It may request `start`, `status` and
`stop-and-retire` for its authorized session only. It cannot publish/remove/relabel
units, directly contact PID 1, reload, stop/start foreign lifetimes, select service
properties or attest lifecycle success. Remove **all** direct broker manager rights,
including status, so ownership decisions have one authority. Preserve existing
provider operations through the internal adapter, without exposing a new public API.

The manager owns new separately typed protected directories for intent/results,
public launch jobs and handshake socket directory entries. Broker state is never
manager proof. Move lifecycle category/account reservation evidence to manager-owned
storage or independently administrator-sealed records; broker-writable reservation
markers are insufficient. Account creation stays exclusively offline, outside both
services. Neither service may write account databases or provisioning proofs.

Manager verifies sealed provisioning/live identity, exact administrator-approved
pool/deployment/limits/category and reserved tenant identity itself. A staged
`deployment.json` alone is not proof: broker controls it. Verify staged contents
against approval with held descriptors; no broker-writable input may become a
privileged executable, template, include or configuration source. The fixed launcher
and installed runtime run only as the approved nonroot UID/GID and worker domain;
customer code is never interpreted in the manager. Pin immutable runtime ancestry.
Broker staging remains a separate security surface, not a source of manager authority.

## Proposed closed wire contract

Internal Unix stream, one bounded request and bounded response, no passed FDs or
ancillary data in Phase 1. Suggested protocol name `wydhosting.lifecycle/1` is reserved
here only. All keys below are required and exclusive; body/extensions are forbidden:

```json
{
  "schema": "wydhosting.lifecycle/1",
  "operationId": "0123456789abcdef0123456789abcdef",
  "operation": "start",
  "policyRevision": "<64 lowercase hex>",
  "tenantId": "<approved customerId>",
  "accountId": "<approved accountId>",
  "poolId": "<approved poolId>",
  "deploymentGeneration": 1,
  "generation": "<canonical lowercase UUID lifetime>",
  "epoch": 1,
  "expectedSequence": 0
}
```

Operations are exactly `start`, `status`, `stop-and-retire`. Deployment generation
selects the approved base generation; UUID generation selects a distinct worker
lifetime. Never conflate these. Identifiers use the existing bounded identifier
grammar and exact approval equality; numeric fields are integers, not booleans,
floats or coerced strings, bounded to 1..9007199254740991 (sequence may be zero). Operation ID
is 32 lowercase hex, lifetime is canonical lowercase UUID; policy digest is 64
lowercase hex. Limit frame to 8 KiB, depth to 2, initial read to 10 seconds; reject
invalid UTF-8, duplicate/reserved/unknown keys, trailing data, embedded NUL/control
characters and unsupported schema before effects. Bound connections, request rate,
queued work, journal growth and result retention; exhaustion refuses new effects.
Manager-owned policy sets operation deadlines; a timed-out queued operation must
revalidate before effects and a timed-out in-flight operation becomes indeterminate.

UID/GID, SELinux category, unit/session/cgroup name, PID, executable, arguments,
environment, drop-ins, dependencies, filesystem paths and resource limits are absent
from requests. Derive them from independent installed approval and authenticated
session, never from opaque caller strings. Reject extra fields even if unused.
Status/stop require the exact manager-recorded tuple and current sequence. Start
requires no live or ambiguous predecessor, a never-used lifetime, increasing epoch
and matching current sequence; no adoption by name. Administrator approval separately
lists permitted operations, tuples, epoch range, active-count and start-rate bounds.
Approval alone is not an unlimited restart grant. A compromised broker can exercise
its exact allowed operations and disrupt its sessions; this is residual authorized
availability risk, not authority to select privileged programs.

Response is a tagged closed union: schema, operationId, requestDigest,
policyRevision, exact resource tuple, sequence, outcome and code. Outcomes are
`completed`, `refused`, `indeterminate`. Completed start/status additionally include
a closed ownership object: template/release digests, unit hash, unit, invocation,
cgroup, numeric UID/GID/PID, startTime, bootId and observed state. Completed retirement
includes terminal-state, empty-cgroup and artifact-removal evidence instead. Errors
use fixed codes and no payload/exception/path reflection. Refused/indeterminate
responses have no ownership or retirement object. Unknown response keys refuse.
Use the existing sorted-key compact UTF-8 JSON digest convention, with no Unicode
normalization or numeric coercion; freeze byte fixtures with the validator. Requests
are flat, so the digest has no nested-object ordering ambiguity.
Use the same 8 KiB response bound; strings use the exact identifier/hex/UUID
grammars above, generated unit/cgroup grammars and bounded decimal startTime.
Observed state is a closed running/stopped/unknown vocabulary. Status is explicitly
a snapshot, never an unlimited future authorization token.

Broker checks manager endpoint peer identity/domain, response binding and current
sequence; provider retains independent worker peer/cgroup/start-time checks. Durable
result lookup uses the same authenticated tuple/operationId. No bearer result can
authorize another operation. Same ID plus same canonical request returns the durable
result; same ID plus different request refuses. Duplicate requests with missing or
ambiguous evidence cannot cause a second start.

## Independent authentication and authorization

Socket DAC is defense in depth. On each connection the manager obtains kernel
SO_PEERCRED and SO_PEERSEC; require exact installed broker UID/GID and enforcing
broker domain. UID 0 alone is insufficient. Independently resolve peer PID/start-time,
boot ID, invocation and exact active broker session cgroup through trusted manager/
proc evidence, with fresh verification before effects. Never accept a caller-supplied
session unit or PID. Deny wrong domain, vanished/reused peer or ambiguous metadata.
Bind the connection to that session until completion; copied identifiers cannot
transfer authority. Administrator approval maps that authenticated principal/session
class to the exact tenant/account/pool/generations and operations. Broker claims,
provider registry, WydGate roles and SEAM capabilities cannot expand this map.

The manager independently reads bounded root-owned approval and sealed identity
proofs through protected ancestry. Freeze the validated approval revision for an
operation; changes require serialized revalidation, never mixed revisions. A revoked
revision denies new starts; finishing an exact already-recorded stop is allowed only
under explicit administrator recovery policy. Missing recovery policy quarantines.
The manager is a privileged trusted deputy: its validator must remain effective even
when the broker's implementation is entirely bypassed.

## Template, publication and lifecycle mechanics

Template has fixed installed Python launcher/Node paths, environment allowlist,
empty capabilities, NNP, restricted nonroot UID/GID and worker SELinux context,
control-group killing, no restart, existing sandbox/resource restrictions. Values
come from validated approval, not request interpolation. Paths derive from canonical
IDs and approved deployment records using escape-free grammars; reject `%`, `$`,
whitespace, quotes, newlines and traversal rather than invent escaping. Validate
every substituted field, including approved data. Numeric limits are bounded.
Derive BindsTo/After only from verified broker session identity. No extra Exec*,
EnvironmentFile, transient units, aliases, shell, property setter or dependency API.

Use held protected directory descriptors, same-directory exclusive temporary files,
no symlinks/hardlinks/mount crossing, expected labels/owners/modes, fsync file,
no-replace publication and fsync directory. A collision refuses; never overwrite a
foreign or old unit. Manager alone requests reload after its own durable publication;
reload is not a wire operation. Serialize manager-wide publication/reload and per-pool
lifecycle; reload failure quarantines. Independently verify actual loaded FragmentPath,
empty DropInPaths, rendered bytes and effective command/identity/context/environment/
dependency/sandbox properties before start, and actual invocation afterward. Current
selected-field `verify_unit` checks are not the full new verification contract.

All unit lookup paths, aliases, global/service drop-ins, generators and transient
unit mechanisms must be administrator protected. Manager may neither alter its own
unit/policy nor invoke arbitrary systemd properties. MAC service rights apply only
to a dedicated managed unit type; filename patterns alone are insufficient. A fixed
renderer and narrow API prevent caller-selected execution; MAC/DAC protect renderer,
unit bytes and evidence from the broker. Manager compromise remains a distinct TCB
risk: SELinux is not a directive-content validator for manager-authored units.

Manager creates and owns the public job and handshake listener; it can pass only a
connected authenticated worker stream to the bound broker after independently
checking MainPID/UID/GID/domain/cgroup/start-time/challenge. This requires an internal
FD handoff implementation separate from the JSON request protocol, with exact FD
count/type/peer verification and CLOEXEC tests. Do not implement this by granting
broker write access to the manager's directory or accepting a broker socket path.
Worker launcher and relay adaptation must migrate together. Manager handles broker
death independently; BindsTo is supplemental, not completion evidence.

## Durable intent, recovery and retirement races

Persist authenticated request digest, full resource binding, template/policy/release
hashes, session identity, previous sequence and operation phase **before any effect**.
Fsync transitions: accepted → publication-intent → published → start-intent → running;
stop-intent → terminal-observed → retirement-intent → retired. Record manager job ID,
invocation/cgroup/PID/start-time and boot ID as they become known. Each record is
manager-owned, append-audited and durably sequenced; journal messages alone are not
completion proof. Disk-full/fsync failure stops further effects; loss after a manager
effect yields indeterminate, never speculative success or an automatic new start.

After crash, connection loss or timeout, return/recover exact durable results when
provable. Otherwise mark indeterminate/quarantined, block replacement and require
administrator review. Do not import broker leases as trusted history. Recovery may
stop only an independently proven exact owned invocation; inability to prove it
requires operator inspection, not numeric-PID kill or adoption. Reboot/boot-ID change
invalidates live process evidence and requires separately qualified recovery. No
automatic account/category reuse, data migration or broad cleanup.

Retirement checks exact manager-owned unit/tuple/hash/invocation, terminal manager
state, no pending job, zero MainPID and empty descendant cgroup before durable stopped
and removal of exact generation artifacts. Retain units, leases, approval/category/
account evidence and customer data. Record partial cleanup and retry only against
the same protected generation. Both ordinary retirement and every launch/failure
finally path must follow this rule; avoid the existing unconditional listener unlink.

Repeated pathname checks cannot defeat a sufficiently privileged concurrent writer.
The primary defense is **writer exclusion**: broker/provider/workers cannot write,
rename, unlink, relabel or replace entries in manager artifact/unit/state directories
or their ancestors; all legitimate lifecycle writers use the manager's shared locks.
Worker-owned ingress remains in a distinct subtree and is never lifecycle proof.
Bind listener descriptors and exact generation records, retain tombstones, and never
reuse names. Account for systemd RuntimeDirectory creation/removal and installation/
label tools as authorized writers; they must not manipulate manager evidence paths.
An independently running administrator installer must quiesce the manager and use
its offline maintenance gate. Audit every writer, including tmpfiles/recovery tools.

With these invariants, a compromised broker loses the ability to perform the recorded
replacement attack, and cannot race stop with an independent start via PID 1. This
is a design argument requiring installed adversarial verification, not proof already
obtained. Root-equivalent administrators, kernel compromise, policy replacement or
another domain granted equivalent directory/manager rights remain outside the
boundary. Such writers can invalidate all pathname evidence; quarantine on detected
drift, do not promise atomic deletion safety against hostile root. Filesystem deletion
and manager snapshots still are not a joint transaction.

## Enforcement and migration gates

1. Implement/test manager parser, authorization, fixed renderer and durable state
   machine privately; no production activation or public exports. Review exact
   bounded response grammar and FD handoff. Keep account provisioner unchanged.
2. Install dedicated manager domain and typed approval/template/state/control/unit
   resources. Broker must have no write/relabel/remove rights over them despite root
   UID and DAC_OVERRIDE. Deny direct manager socket access, system reload, managed
   service start/stop/status and systemctl execution to broker. Remove writable
   `/run/systemd/system` from broker service; verify mounts and effective policy.
   Restrict manager mount writes to its own exact trees/unit publication directory,
   capability set to demonstrably required minimum, AF_UNIX only, no account tools,
   shell, network, arbitrary bin execution or account-database writes.
3. In a stopped maintenance window inventory existing units/leases/artifacts. Refuse
   conflicting/ambiguous history; no automatic adoption or wildcard deletion. Install
   new template/policy/runtime atomically as an administrator-reviewed bundle. Move
   all lifecycle operations, artifact ownership, reservations and failure cleanup;
   migrate worker handoff and broker adapter together. No dual authorized writers.
4. Activate only after negative installed tests prove the old authority absent and
   all legitimate launch/status/stop/reconcile/provider flows work. No unconfined or
   old-broker fallback. Rollback requires offline quiescence/review; do not silently
   restore the insecure permission set. Existing deployment remains unqualified.

## Required adversarial evidence and open decisions

Ordinary-user tests must reject unknown/duplicate/reserved keys, invalid encodings,
unsafe numbers, schema confusion, commands/unit fragments/paths/env/drop-ins, foreign
identities/generations, stale sequence/revision, operation-ID collisions, replay,
peer/session substitution, unsealed identity, and symlink/hardlink/mount substitution.
Test malicious approved substitution values too. Inject failure at every durable
transition and every manager effect, full disk, disconnect, concurrent duplicates,
partial socket/job retirement, manager restart and newer-generation sentinels.
Keep the existing privileged-writer diagnostic as a known limitation, not a passing
new-architecture test or an xfail that hides a runtime defect.

Installed enforcing AlmaLinux qualification must bypass broker validation entirely:
from a deliberately compromised broker domain attempt raw unit writes/replacement/
relabel, private and bus manager calls, reload, transient/property APIs, foreign
starts/stops and all former cleanup paths. Demand actual AVC/manager refusals and
unchanged sentinels, alongside successful exact allowed operations. Exercise global
drop-ins/overrides, authenticated wrong sessions, FD spoofing, broker death during
start/stop, simultaneous tenant lifetimes, all authorized directory writers and late
artifact/manager mutations. Demonstrate independent account-proof/database denials.
Mock manager passes cannot establish these properties. Reboot/power-loss/destructive
recovery tests require established backup and independent console gates first.
Run repository and independent packed-consumer regressions after implementation.
No expensive guest campaign is warranted for this design-only delivery.

Open implementation decisions: exact socket activation/FD handoff plumbing; final
result grammar and audit retention quotas; minimum manager capabilities and distro
policy interfaces; administrator maintenance/revocation recovery tooling. Resolve
these in implementation review before activation, with testable failure semantics.
No decision permits caller-selected commands, paths or weaker enforcement.

Remaining I5.6 production gates include the complete authority transition and
independent security review; real privileged retirement/interruption qualification;
account-tool partial-effect recovery; power-loss/reboot and backup/console restore;
storage quotas, external networking and remaining exact-image integration. Historical
99/99 guest checks and this design do not qualify the new architecture. I5.7, version
changes and WydOS implementation are excluded.

Future WydOS may request the same defined administrative operation through an
authenticated adapter. Administrator-installed policy must authorize its exact scope;
the separate helper independently verifies and executes it and emits a durable result.
WydOS identity/roles confer no implicit SEAM or host authority. No remote endpoint,
public contract, separate WydOS planning implementation or new delegation authority
is introduced in this phase.

## Implementation Slice 1 — offline foundation, 2026-10-17

Baseline `133ea40db7470902d54e86ac79ac446b1479e0b4`, `develop/0.3`, live
remote equal and clean. Version remains **0.3.0-alpha.15**.

`broker/lifecycle_contract.py` implements the exact flat `wydhosting.lifecycle/1`
request grammar above: 8 KiB strict UTF-8/JSON, duplicate/reserved/unknown field
rejection, bounded integers without coercion, canonical sorted compact bytes,
closed operations and exact tuple/revision/sequence binding. No public export,
CLI, socket, filesystem resolver, publisher or broker integration is added.

The private `wydhosting.lifecycle-offline-binding/1` fixture is deliberately **not**
an installed approval format or an authorization channel. It describes one already
selected lifetime, epoch and sequence, an allowed-operation subset, reserved nonroot
UID=GID/category, a bounded deployment-name list, the existing Linux resource bounds,
a verified-session placeholder and pinned template/release digests. Separate
reservation fixtures must match the exact tenant/account/UID/GID/category and reject
account, UID or category collisions. These records must eventually be obtained from
independent protected manager/administrator evidence; caller-supplied records or
claims of administrator authorization prove nothing. Peer authentication, sealed
record loading, freshness, epoch allocation, start-rate/active-count enforcement
and lifecycle-state decisions remain unimplemented.

`bind_request` produces a canonical request digest and complete resource/session/
identity/template/release reference suitable for future durable intent. It does not
persist or attest ownership. `replay_matches` compares validated stored request bytes:
same ID with changed content conflicts; missing/malformed history refuses. Equality
is not permission to repeat an effect. A future serialized durable store must return
the exact result or quarantine ambiguous evidence. No durable journal/recovery or
response grammar is implemented in this slice.

Candidate template identity is `wydhosting.worker/1`; its pinned definition digest is
`84d6687c30af853ff1ba75119704bf1ed78244698f2649c0b83424446fc6381c`.
The digest covers the version, fixed Python launcher and fixed service definition;
rendering checks it independently against the supplied pin. Release approval must
also independently pin the entire renderer/launcher/runtime closure, including all
derivation code. This is integrity comparison, not a signature or trusted installer.

`render_candidate` only returns bytes and a unit hash/reference. Executable and
security directives are fixed from the current broker service contract; only typed
numerics, hash-derived job paths, canonical deployment paths and independently
selected session identity vary. Candidate broker-session syntax follows the observed
Linux socket instance counter-PID-UID format; other platforms/instance formats need
explicit review. Request bytes cannot choose a template, service, executable, path,
environment or directive. Even offline fixture substitutions are validated. The
current job/runtime paths exist solely for offline parity: **do not install or
activate candidate output**. Manager-owned paths, worker authentication/FD handoff
and writer exclusion must migrate together first. The current launcher still
authenticates the old broker flow. No administrator-owned installation is claimed.

`test-support/linux/verify_lifecycle_contract.py` supplies hostile-input tests invoked
by the repository and independent packed Linux suites. Actual local symlinks are
presented as rejected strings; no path is resolved and this does not qualify
filesystem race resistance. Ordinary-user validation does not establish systemd or
SELinux confinement. Existing broker authority, unit generation, SELinux rules and
known retirement replacement window remain unchanged. Complete all migration gates
above before activating any manager or removing broker authority.

## Implementation Slice 2 — protected offline authorization, 2026-10-17

Baseline `2d4cc9525e97ea503262e86d4ab482e0643c6155`, clean `develop/0.3`,
tracking and live remote equal. Version remains **0.3.0-alpha.15**.
`broker/lifecycle_authorization.py` is a private offline consumer, unused by the
broker and without a CLI, socket, unit publication or privileged effect. Slice 1's
binding fixture remains a fixture; it is never accepted as administrator approval.

### Exact administrator contract

The closed `wydhosting.lifecycle-approval/1` object contains **all** lifecycle request
fields, with `schema` replaced by the approval schema, plus exactly these fields:

| Field | Meaning / validation |
| --- | --- |
| `uid`, `gid`, `category` | Equal reserved UID/GID, 60000..2147483647; category 1..1023; exact protected reservation equality |
| `templateId`, `templateDigest` | Exactly `wydhosting.worker/1` and the Slice 1 pinned definition digest; recompute fixed definition integrity |
| `releaseDigest` | 64 lowercase hex; must equal the independently installed release pin passed by trusted code |
| `service` | Exact hash/lifetime-derived service name from the validated request, no template substitution |
| `limits` | All five Slice 1 limit keys, integer ceilings within the pinned hard bounds; no extra keys |
| `requestDigest` | SHA-256 of the strictly validated canonical lifecycle request reconstructed from approval |
| `reservationDigest` | SHA-256 of the canonical complete protected reservation array, preserving array order |
| `notBefore`, `expiresAt` | UTC Unix seconds, safe integers, 0 <= notBefore < expiresAt; validity is [notBefore, expiresAt) |
| `state` | Exactly `active` or `revoked`; revoked denies every operation, including stop |

There are no optional fields, operation classes, wildcard identities, allocation
ranges, generation ranges, implicit recovery grants or authority booleans. One
approval authorizes static eligibility for exactly one operation ID, operation,
tenant/account/pool, deployment generation, lifetime, epoch, sequence and policy
revision. A broader schema requires a separate review. Resource ceilings are selected
only by administrator approval; the request has no resource fields. This decision
API does not accept alternate resource values. Future execution must use the exact
approved values and revalidate before effects, never treat `ALLOW` as a bearer token.

`reservations.json` is a separate protected JSON array of 1..32 closed records,
each exactly `{tenantId, accountId, uid, gid, category}` using Slice 1's identity
validator. Account IDs, UIDs and categories must be unique across the entire snapshot.
Multiple accounts for a tenant are permitted. Approval pins that entire snapshot and
must match one full identity record. This is an administrator-sealed allocation
snapshot, **not** broker category markers, a provider registry or a live OS identity
attestation. The administrator must reconcile it with successful offline provisioning;
existing broker-writable reservations must not be imported as authoritative evidence.
Live passwd/group/provisioning and peer/session verification remain activation gates.

Approval and reservations each use the existing strict 8 KiB UTF-8 JSON parser:
unknown/missing/duplicate/escaped-duplicate/reserved fields, malformed/truncated data,
controls, deep structures, unsafe numerics and widened scopes deny. A digest is only
an integrity/binding comparison; the code checks full underlying request scope,
protected reservation provenance and identity, template and release independently.
A reused operation ID with another request conflicts. Repeated identical `ALLOW`
results do not grant reexecution: durable uniqueness/results remain unimplemented.

### Protected FD loading and trust boundary

`authorize(raw, trusted_directory_fd, *, now, installed_release_digest)` accepts **no
pathname**. The directory FD must be opened/retained by trusted administrator/manager
bootstrap from independently protected ancestry, never received over the broker
protocol or selected by broker input. `now` must come from the trusted host clock;
`installed_release_digest` must be installed independently of the broker, and the
trusted runtime/launcher/renderer closure must actually be verified against it.
Supplying an arbitrary digest does not verify installed release bytes.

The loader duplicates the trusted directory descriptor, checks root UID/GID and
0500/0700 directory mode, then opens only fixed basenames `approval.json` and
`reservations.json` with the existing Linux amd64 `openat2` primitive. BENEATH,
NO_SYMLINKS and NO_XDEV are required; no fallback. Each file must be regular,
root UID/GID, 0400/0600, single-linked, nonempty and at most 8192 bytes. NONBLOCK
avoids FIFO-open blocking; special files refuse. `fstat` and bounded `pread` operate
on the same held inode, with no check-then-reopen. Short reads deny. No caller offset
is consumed. Both descriptors remain held during validation. Before returning allow,
check file device/inode/mode/owner/group/link-count/size/mtime/ctime, both directory
entries without following links, and parent metadata against initial inspection.
Replacement or in-place drift denies. Missing, unsafe or unreadable records deny.
No approval cache survives a decision; revocation/deletion in the held tree denies
the next decision. Replacing the directory or its ancestry requires quiescence and
trusted bootstrap reacquisition of the FD; a held old directory is not a pathname
watcher and must not remain an authorization source after an administrator cutover.

**DAC and drift checks are not protection against a compromised privileged writer.**
Future installation must create a separate administrator-owned, separately typed
approval/reservation tree outside broker runtime state. Enforcing SELinux must deny
broker/provider/worker write, append, setattr, relabel, link, rename, unlink and
ancestor-entry replacement, even with broker UID 0/DAC_OVERRIDE. Trusted read-only
mount ancestry must prevent broker mount/bind-mount substitution; release, directory
FD provenance and all ancestors must be protected. Labels/mount provenance are
preconditions supplied by trusted bootstrap, not attested by this offline API.
These properties are **not installed or qualified in this slice**. Pointing this API
at current broker-writable state or accepting a broker-passed FD violates its contract.

Administrator updates must quiesce future execution or use its serialized maintenance
gate and publish a coherent approval/reservation pair. The loader detects observed
drift, but cannot make two files plus subsequent OS effects one atomic transaction,
guarantee revocation after its final check, or defeat hostile root/kernel writers.
No effect may be performed using a cached decision after maintenance/revocation.
The future manager needs a held serialized revision through effect admission and
fresh live identity/session/state verification. This slice supplies static independent
authorization only, not the complete manager authority transition.

### Decisions and verification

The immutable result has only `allowed` and a fixed bounded `code`:
`ALLOW`, `REQUEST`, `PROTECTION`, `CHANGED`, `APPROVAL`, `REVOKED`, `TIME`,
`REQUEST_BINDING`, `TEMPLATE`, `RELEASE`, `RESERVATION`. Invalid request denies first;
loading/protection checks precede approval, time/revocation, request, template/release
and reservation comparison. Final drift checks can override an otherwise successful
comparison. No exception, path or attacker text is reflected. Invalid trusted clock
or release inputs also deny. This is deterministic for the same inputs and unchanged
protected records, not an ownership, authentication or completion response.

Fourteen focused Python tests run within repository and packed Linux suites.
Ordinary-user tests explicitly patch only expected root ownership to the current
UID/GID for positive fixtures; the unpatched production root check rejects those
same broker-authored files. Real syscalls exercise permissions, symlinks, hardlinks,
FIFOs, missing/malformed/oversized data, held-descriptor reads and name replacement.
Deterministic hooks mutate after inspection/before read and after validation/before
final consumption, for both files. They test observed drift, not hostile-root immunity.
Protected-directory provenance, privileged SELinux/mount writer exclusion, actual
root-authored approval, live identities/sessions and systemd containment require
separate installed qualification. No guest was contacted or modified.

## Implementation Slice 3 — durable offline journal and recovery, 2026-10-17

Baseline `96ac409f8274efa24bc9afaf3b0ef37e7006a804`, clean `develop/0.3`,
tracking and independently queried live remote equal. Version stays alpha.15.
Private `broker/lifecycle_journal.py` is unused by the broker, has no CLI/socket,
and performs only journal filesystem operations. No systemd/account effects or
attempt/retry/reconciliation authority are returned by any API.

### Format and transitions

`wydhosting.lifecycle-journal/1` is a canonical compact sorted UTF-8 JSON envelope
with exactly `schema`, `payload` (canonical JSON string), and `digest` (SHA-256 of
payload bytes). Payload maps operation IDs to closed records containing exactly
`approval`, `approvalDigest`, `transitions`, and `evidence`. `approval` is the complete
canonical Slice 2 approval serialized as a string, validated again with the same
parser. This retains the exact canonical request/digest, tenant/account/pool,
UID/GID/category, reservation snapshot digest, both generations, epoch, policy
revision/sequence, operation, all five resource ceilings, template/release/service,
validity interval and original active approval state. Approval identity is the
SHA-256 of its full canonical bytes; no incompatible identity schema is introduced.

`transitions` is an ordered, bounded state sequence whose array indices are transition
sequence numbers starting at zero. The initial state is always `prepared`:

- `prepared` → `intent-recorded` or `rejected`.
- `intent-recorded` → `outcome-unknown`, `completed` or `reconciliation-required`.
- `outcome-unknown` → `completed` or `reconciliation-required`.
- `completed`, `rejected` and `reconciliation-required` are terminal.

Every transition uses expected-state compare-and-swap while holding the writer lock.
Duplicate prepare with identical content returns the existing state without rewriting
or resetting history. Changed content under the same ID rejects `CONFLICT` before
approval comparison. There is no reset, deletion, compaction, retry or repair API.
The store is bounded to 128 operations and 1 MiB; reaching capacity requires separately
reviewed administrator retention/namespace planning, never automatic history eviction.
Unknown versions, duplicate keys, noncanonical encoding, checksum mismatch, malformed
approval, invalid transitions and missing/inconsistent completion receipts refuse.
Checksums detect corruption, not privileged tampering, rollback or signed provenance.

`evidence` is empty except in completed records. Completion uses the strict flat
`wydhosting.lifecycle-evidence/1` receipt with exactly `schema`, `approvalDigest`,
`requestDigest`, `tenantId`, `generation`, `reservationDigest`, `postcondition`, and
`referenceDigest`. The reference is a SHA-256 identity of independently held external
evidence, never a caller pathname. All bindings must match the full approval.
Operation-specific postconditions are `exact-invocation-running`,
`exact-state-observed`, and `exact-generation-retired` for start, status, and
stop-and-retire respectively. These labels and receipt bytes are **not proof**.
A trusted `verify_evidence(approval_bytes, receipt_bytes)` callback must independently
load and verify authoritative evidence and return exactly True, both when completing
and every time recorded completion is recovered. No default verifier is provided;
without one completion refuses `EVIDENCE`. Verifier exceptions deny. Broker code must
never select this callback. Tests use labelled simulated evidence; no installed
systemd/account/boot-aware verifier is implemented or claimed.

### Persistence and serialization

Only an explicitly trusted administrator/manager directory FD is accepted; no broker
path or broker-passed FD is valid. Dedicated protected ancestry, read-only mount
provenance and enforcing SELinux writer exclusion have the same mandatory bootstrap
requirements as Slice 2. Directory UID/GID must be root with 0500/0700 mode. All
writers, administrator maintenance, backup restore and future effect admission must
participate in the same quiescence/serialization protocol. Held FDs must be reacquired
after administrator tree cutover. DAC/drift checks cannot exclude a compromised root
broker or hostile administrator; these protections remain uninstalled/unqualified.

Each call independently opens `.` relative to the trusted FD (fixed internal name),
checks inode identity and obtains a nonblocking exclusive Linux directory `flock`.
An independent open file description is essential: dup would share flock ownership
and permit overlapping calls. Contention returns `BUSY`. The descriptor remains held
through loading, authorization, verification, publication and final directory fsync;
close/process death releases the lock without a stale lock file. This is advisory
local-filesystem serialization, not a distributed lock. No operation holds it across
external effects because no external execution is implemented; future integration
must extend the serialized admission/maintenance protocol through effects.

Only `journal.json` is accepted in an initialized directory. It must be regular,
single-linked, root UID/GID, exactly 0600, nonempty and at most 1 MiB. The existing
Linux amd64 openat2 primitive enforces BENEATH/NO_SYMLINKS/NO_XDEV without fallback;
NONBLOCK prevents FIFO blocking. Same-inode bounded pread, size, metadata and final
name comparisons detect observed short reads, in-place changes and replacement.
Source metadata is checked again after authorization/evidence consumption.

Publication creates the fixed `pending.json` exclusively with NOFOLLOW, sets 0600,
loops over short writes, retries interrupted writes, refuses zero writes and propagates
ENOSPC/EIO. It fsyncs the complete file, verifies readback and name/inode metadata,
then fsyncs the directory to retain the pending marker. Source and pending names and
metadata are checked before an atomic same-directory rename over `journal.json`,
followed by another directory fsync. No failed stage is silently cleaned up. Any
pending marker or unexpected entry quarantines the entire store. Sync failures,
including EINTR, refuse; there is no success return until all syncs finish. A failure
after rename may leave the new record visible; the caller must treat publication as
indeterminate. Recovery and duplicate lookups re-sync the directory before recognizing
visible history; recovery independently verifies any visible completion. A crash
may recover the old snapshot, the new snapshot or a pending marker according to the
actual filesystem's persistence behavior; none is permission to repeat effects.

`initialize(fd)` is an explicit administrator bootstrap for a **proven virgin** empty
namespace only. It durably publishes the empty initial snapshot using the same path.
It never runs implicitly, refuses an existing store and is not a recovery tool.
Emptiness cannot prove absence of deleted history: administrator provenance and
creation/ancestor fsync belong to bootstrap. Missing/corrupt history requires operator
reconciliation, never initialization to permit old operations. There is no protection
against administrator rollback to a complete older valid snapshot; trusted retention,
backup provenance and future external reconciliation must address that gate.

### Recovery and qualification limits

`recover` returns `(recorded_state, classification)`, never an allow decision. Durable
intent and outcome-unknown both classify `reconciliation-required`; prepared/rejected
remain recorded states without an attempt grant. Missing operation/history refuses;
foreign request/generation conflicts. Every call reloads current protected approval
and reservations, clock and release pin. Expired/revoked approvals deny even historical
completion; changing any approval bytes or reservation snapshot also denies. Separate
fresh scoped administrator reconciliation/retry authorization is still unimplemented.
No automatic replay of useradd, publication, start/stop, deletion or cleanup exists.

Fifteen deterministic ordinary-user tests exercise actual local file/descriptor/
rename/fsync/flock calls and injected write/read/sync/rename failures. Expected root
ownership is explicitly simulated for positive fixtures; unmodified ownership rejects
current-user storage. Tests cover duplicates/conflicts, pre-intent and post-intent
interruption, possible-effect ambiguity, each completion sync boundary, invalid/torn/
oversized/corrupt/versioned history, invalid state sequences, absent/foreign evidence,
revocation/expiration/stale reservation, links/FIFO/types/modes, source and pending
mutation/replacement, partial/EINTR/zero writes, ENOSPC/EIO/sync EINTR, competing
independent descriptors/processes, process-exit lock release and stale transitions.
No test executes an external lifecycle effect or actual power interruption.

Atomic rename, successful file/directory fsync persistence, advisory directory flock,
mount behavior, storage hardware/cache honesty and crash/power-loss ordering require
actual target filesystem and mount qualification. This slice is an offline durable
foundation under stated trusted-writer assumptions, **not production crash consistency**.
Installed protected directories, SELinux/mount exclusion, boot-aware authoritative
postcondition verifiers, independent provisioning/live sessions, rate/active-count
admission, reconciliation authority, effect integration, retention/recovery tooling,
complete broker authority removal and enforcing installed adversarial qualification
remain activation gates. No guest or privileged configuration was touched.
