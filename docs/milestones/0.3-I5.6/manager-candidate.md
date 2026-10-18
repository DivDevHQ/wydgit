# Minimal manager candidate and installation decision gate

2026-10-17; starting `develop/0.3` HEAD
`4c55bfb0b9d03b206062bca1a6f417b77ea1cdd1`, clean. Version remains
0.3.0-alpha.15. No dependencies, installed files, policy or services change.
This is an offline candidate, **not an installable lifecycle manager**. Nothing in
this document authorizes guest access, installation or qualification.

## Implemented boundary

Private `broker/lifecycle_manager.py` has no CLI, listener, subprocess, public export
or production caller. Its trusted embedding supplies an accepted Unix stream,
protected approval/journal directory descriptors, installed release pin, clock and
configured broker UID/GID. Request bytes can supply none of those. It reads exactly
one EOF-delimited request, maximum 8192 bytes and absolute 10-second deadline.
The sender must half-close its write side. Invalid UTF-8, duplicate/reserved/unknown
keys, trailing data, oversized or unsupported requests refuse through lifecycle/1.
recvmsg rejects truncation/ancillary data; no FD handoff is implemented. With zero
ancillary space Linux closes undisclosed SCM_RIGHTS FDs and reports MSG_CTRUNC.
There is no listener to exhaust: connection/rate/queue limits remain embedding gates.

Kernel SO_PEERCRED and SO_PEERSEC must match installed UID/GID and exactly
`system_u:system_r:wydhosting_broker_t:s0`; UID 0 alone grants nothing. A trusted
SessionVerifier must independently bind the observed PID/start time, active session
invocation/cgroup, sealed account/deployment and exact approved request to current
kernel boot. Its default refuses. A broker-provided verifier or peer object must
never enter this API. Kernel credentials authenticate the socket creator, not proof
that a passed connected descriptor has remained with that process; session/FD
provenance and confinement still require installed validation. Missing SO_PEERSEC,
wrong context, a vanished peer or unsupported host refuses. No unconfined fallback.

After fresh session/boot checks, existing authorization reads protected approval and
reservations. A second peer/boot/session check precedes existing serialized journal
preparation, which re-reads current approval. No competing authority or reservation
model is introduced. Exact request digest binds operation ID, policy, tenant/account,
pool, deployment, lifetime, epoch and sequence; protected approval additionally
binds UID/GID/category, template/release, limits and reservation digest. Existing
journal semantics bind predecessor history and evidence, globally unique lifetimes
and fixed cross-pool identities. This slice never writes intent or completion.

The bounded canonical response has exactly `schema`, `outcome`, `code`,
`requestDigest`, `operationId`, `recordedState`. Schema is
`wydhosting.lifecycle-candidate-result/1`, deliberately distinct from a completed
installed lifecycle response. Malformed input has empty digest/operation ID. A
successful rehearsal durably prepares/reserves and returns `indeterminate`,
`INSTALLED_REQUIRED`, `prepared`; it does not claim a launch or grant later effects.
An identical duplicate observes the existing state without republishing. Existing
intent/unknown/quarantine returns `RECONCILIATION_REQUIRED`; completed history cannot
be adopted because this entry supplies no independent evidence acceptor. Journal
IO/CHANGED yields indeterminate because publication might have happened. Other
refusals carry bounded existing codes and no exception/path reflection. This local
return value is not a signed receipt or independently authenticated broker response.
The eventual transport must check the manager's kernel identity on the same stream.

`ProtectedEffects.publish_and_verify(approval_digest, request_digest, boot_id)` is
only a typed obligation for protected publication plus actual effective systemd
verification. `OfflineEffects` deterministically raises INSTALLED_REQUIRED. The
entry point never calls an effect adapter. Caller-supplied unit bytes, paths,
commands, properties or template choices have no interface. Existing fixed candidate
renderer remains unused here because its broker-owned job layout is unsuitable for
manager publication. No mock is counted as artifact protection or systemd proof.

Rehearsals consume permanent preparation reservations. Use only a proven virgin,
isolated fixture namespace; never point this candidate at live lifecycle records.
There is no reset/cleanup/release operation. Interrupted publication leaves pending
markers and quarantines. Boot changes before preparation refuse; after preparation
there can be no effects. Installed effects will need durable boot/session records
through every phase; current journal receipts cannot establish cross-boot truth.
`accept-retirement-evidence` remains untouched: immutable acknowledgment, quarantine
and reservations retained, no completion, successor authorization or release.

## What the offline tests establish

New tests use actual current-user Unix streams, kernel peer credentials, recvmsg,
files and journal locking; root ownership and SELinux/session authority are explicitly
simulated. They demonstrate exact composition, malformed/oversized/extra/duplicate
request denial, confused-deputy tuple substitution, wrong peer UID/GID/domain,
missing/nonboolean/throwing session verification, boot/session change, revoked/expired
approval, identity/template drift, replay conflicts, lock contention, pending/corrupt
history, incomplete/tampered completion proof and ancillary-FD rejection. Existing
contract/authorization/journal regressions retain sequence/epoch/predecessor,
retirement, concurrent-process and crash-boundary coverage. None proves a live
confined manager, root writer exclusion, PID 1 state, publication race safety,
power-loss durability, independent account/deployment verification or FD relay.

## Reviewable almond-lab installed-test plan (NOT executed)

The guest must be independently confirmed as the existing AlmaLinux 10.2 guest,
SELinux enforcing, cgroup v2/systemd, with no customer workloads in the isolated test
namespace. Do not SSH even for inventory under this assignment. A later approval
must name the guest, paths, policy diff, services, identity/category, interruption
points and rollback inventory below. Start with read-only inventory and stop if it
differs from reviewed assumptions. Do not reuse the historical 99-test harness.

### Candidate inventory and destinations

| Source / prerequisite | Reviewed destination for a later test | State now |
| --- | --- | --- |
| broker/lifecycle_manager.py, lifecycle_journal.py, lifecycle_authorization.py, lifecycle_contract.py, security.py | `/opt/wydhosting/i56-manager-candidate/broker/` | Existing offline modules; no daemon entry |
| This guide and matching package copy | `/opt/wydhosting/i56-manager-candidate/docs/manager-candidate.md` | Plan only |
| Administrator-approved release manifest containing SHA256 of every above file and immutable launcher/runtime | `/etc/wydhosting/i56-manager/release.json` | Must generate/review after code freeze; not broker supplied |
| Exact existing-schema approval.json and reservations.json | `/etc/wydhosting/i56-manager/approval/` | Synthetic fixtures must be administrator generated; no shipped credentials |
| Existing sealed provision_accounts.py proof | `/etc/wydhosting/accounts/97bb1d1da9234defbcb6a5fc1de02064.json` | Existing accountId hash derivation; administrator provisioning only |
| Journal initialized only with proven virgin history | `/var/lib/wydhosting/i56-manager/journal/journal.json` | Never import broker lease as authority |
| Fixed unit + launch job + listener artifacts | `/run/systemd/system/wydhosting-pool-<pool hash>-<lifetime>.service`, `/run/wydhosting-i56-manager/artifacts/` | Publisher/worker adapter absent; renderer must migrate job path before use |
| Manager listener/service + broker adapter | `/etc/systemd/system/wydhosting-i56-manager.socket`, `wydhosting-i56-manager.service` | **Not implemented; do not invent executable installation commands** |
| Dedicated policy module | `/etc/selinux/targeted/wydhosting_i56_manager.cil` (review source; install through policy tooling) | Not implemented; compiled policy is a prerequisite |

Installation must use a separately reviewed staging manifest with exact hashes and
preexisting-file backups. No copying the whole writable checkout into a trusted
release. Modules/runtime/launcher: root:root, directories 0755, files 0644, no
broker/provider/worker writes, immutable installed ancestry and no writable Python
import path (`python3 -I`). Approval/release policy: root:root directories 0700,
files 0600; journal root:root 0700/0600 as required by existing loader. Manager runs
root:root in its own domain to preserve loader assumptions; it receives only the
capabilities actually needed by reviewed publication/worker labeling (not account
management). Broker remains root:root for this first migration, so **MAC exclusion
is essential**, not an optional DAC optimization. Removing broker root later is
separate work. Artifacts: root:root directory 0700 and files 0600; workers cannot
read it until a separately typed exact public-job view is implemented. Public jobs
may be 0444 under a searchable dedicated directory, with no secrets, no writable
entries and independent held descriptors. Unit bytes 0644, root:root. Worker data
remains owned only by the one disposable nonroot account; ingress is a distinct
subtree and never lifecycle evidence. No shared RuntimeDirectory may remove manager
history. No tmpfiles sweep or implicit directory cleanup.

Proposed identities/types (must first check guest collisions): manager root in
`wydhosting_manager_t`; broker `wydhosting_broker_t:s0`; synthetic account
`wyd-97bb1d1da9234defbcb6` (existing derivation for accountId `i56_mgr`),
candidate UID=GID 62056 and category c956 **only if unused and not
reserved in any history**. If occupied, stop and review a revised exact fixture;
never reallocate by guessing. Worker uses existing `wydhosting_worker_t:s0:c956`.
The no-login home is `/var/lib/wydhosting/accounts/i56_mgr`, mode 0700.
Do not run the all-pools provisioner against a live multi-pool approval: review a
synthetic-only administrator approval or provision the exact identity separately.
No new keys/certificates are required by this local design; trust comes from
administrator-only exact records plus bidirectional kernel credentials/domain and
independent evidence, not a shared broker secret. A future remotely signed approval
scheme is out of scope.

Required policy types: `wydhosting_manager_t`, `wydhosting_manager_exec_t`,
`wydhosting_manager_policy_t`, `wydhosting_manager_state_t`,
`wydhosting_manager_control_t`, `wydhosting_manager_artifact_t`,
`wydhosting_manager_unit_t`; public jobs need their own read-only worker type.
PID 1 must transition the fixed installed manager entry to manager_t (including
nnp_transition), create/listen/accept the typed AF_UNIX endpoint and pass its FD.
Only broker_t may connect to it; only manager_t handles requests. Socket unit:
ListenStream `/run/wydhosting-i56-manager/control.sock`, Accept=no,
SocketUser=root, SocketGroup=root, SocketMode=0600, RemoveOnStop=no.
Service must bound TasksMax/MemoryMax/LimitNOFILE, use AF_UNIX only, NNP,
ProtectSystem=strict, ProtectHome=yes, PrivateDevices=yes, empty ambient caps,
read-only release/policy/account proofs, and explicit write paths only for its
state/artifacts/managed units. Capacity exhaustion must deny rather than enqueue
unbounded requests. Exact limits and entrypoint await runnable adapter review.

Manager may read sealed policy/account/runtime, observe only required /proc and
cgroup state, create/fsync/rename own state/artifacts, label approved worker paths,
and request reload plus start/stop/status only for manager_unit_t. PID 1 may read
those unit bytes and transition approved nonroot worker contexts. All global/unit/
service drop-ins, aliases, generators and transient mechanisms stay administrator
protected. No manager writes to its own service, executable, policy, account DB,
shadow, sudoers or arbitrary host paths. Dynamic template content still belongs to
the manager TCB; SELinux does not validate directives. Label via exact reviewed
fcontext rules, verify matchpathcon/ls -Z, inspect effective sesearch rules including
attributes; no broad permissive domain or generic systemd rights.

**Enablement is one coordinated maintenance gate:** quiesce the experimental broker,
retain evidence, install reviewed manager + relay/worker adapters, remove broker
ReadWritePaths `/run/systemd/system`, broker unit creation/rename/unlink/relabel,
init_t system reload/private-manager connect, systemctl execution and managed service
start/stop/status. Remove authority over new manager state/artifacts/reservations and
all ancestors, including generic attributes and mount/namespace replacement routes.
Keep provider/worker denied too. Existing `wydhosting_worker.cil` lines around
289–297 and broker service ReadWritePaths are concrete removal sites. Old broker
launch/finally code must no longer publish or unlink manager artifacts. Never enable
a manager while those old lifecycle paths remain authorized. Account provisioning
stays offline. Verify all authorized writers, including systemd/tmpfiles/installers;
maintenance must quiesce and take the manager's locks.

### One synthetic lifecycle, observations and interruption

Before any start: audit exact peer PID/start-time/cgroup/session invocation and boot
from kernel/PID 1, exact administrator mapping and live sealed passwd/group/shadow
proof, release/template/content hashes through held protected descriptors. Broker
staging metadata cannot attest executable contents. Manager response must be checked
by the broker against root/manager_t peer, request digest, tuple and sequence on the
same connection. Independent observer runs outside broker domain and reads protected
records and PID 1, not broker-produced expected values.

Use one pool `i56_manager_probe`, tenant `i56_probe`, account `i56_mgr`, one deployment
generation, one canonical newly generated lifetime and epoch 1/sequence 0, one exact
short-lived approval. Synthetic fixed worker has no public listener/customer data,
no shell, no network except authenticated Unix relay and no arbitrary commands.
First exercise admission-only candidate in an isolated namespace: default verifier
must refuse; reviewed live verifier may prepare once and must report installed-required.
This test cannot launch a worker. **The lifecycle experiment below is blocked until
publication, actual effective-state verifier and connected-worker handoff exist.**
Do not turn a test mock into the installed verifier to bypass this prerequisite.

For the eventual lifecycle test, record exact unit bytes/hash, FragmentPath, empty
DropInPaths, all effective command/identity/environment/context/dependency/sandbox/
resource properties, invocation, PID/start time, cgroup and boot. Verify nonroot
execution and manager-owned artifacts independently. From the broker domain attempt
unit/job/socket/journal replacement, relabeling and PID 1 access: all must deny and
sentinel hashes/inodes remain unchanged. Forged domain/UID/session, cross-tenant/pool/
identity, revoked/expired approval, changed content, unknown action/keys, oversized
frames and ancillary FDs must refuse with no unit/job effects. Concurrent conflicting
requests must serialize/refuse; identical retries must return durable history,
never a second invocation. Stop only the exact recorded invocation; require no
pending job, terminal state, zero MainPID and empty descendant cgroup before exact
artifact retirement. Units/tombstones/account/category/data remain reserved.

Interrupt once after durable launch intent before observed invocation; reconnect
must quarantine with no automatic second start. Interrupt retirement after terminal
observation but before removal; artifacts/reservations must remain or exact partial
progress be recorded. Recovery must reverify the same protected identity/hash/
invocation/boot and cannot adopt by name, kill a numeric PID or release a reservation.
Changed boot invalidates old live evidence; keep quarantine and stop for operator
inspection. Boot testing requires **additional explicit reboot approval**; this plan
does not require or imply it. Power-loss/backup restoration remain separate gates.
Retirement acknowledgment alone can never complete this experiment's retirement.

### Rollback and backup preconditions

Before installation, record checksums/content/ownership/modes/labels of every exact
replaced unit, policy source/module inventory, active jobs/services, capability/DAC/
SELinux effective rights, approval and complete journals. Obtain an independently
working console/recovery path and verified SSH/admin connectivity/firewall baseline.
Check the existing VM backup's identity, date, integrity and coverage (disks,
firmware/NVRAM and VM configuration); determine the actual supported restore command
and destination with the operator. Backup existence is **not** a tested restore path.
A restore drill requires a separate isolated clone, no duplicate guest IP/identity,
no live backing-disk overwrite, operator-approved storage and a verified boot/console.
Never assume reverting a VM may erase lifetime history safely: export all new
journal/tombstone evidence outside its rollback scope and reconcile before reuse.
If backup recovery cannot be demonstrated, do not start mutation/interruption tests.

Rollback is bounded to the manifest: deny new requests, independently inventory exact
owned worker invocation/cgroup, stop only that proven invocation under the approved
maintenance procedure, quarantine ambiguous ones, then stop the named candidate
socket/service. Preserve all artifacts/journals before disabling/removing policy.
Restore exact reviewed original service/policy bytes/labels and reload only under
the explicit installed-test approval; remove only manifest-created files proven
unchanged and not evidence. Keep identity/category reservations and synthetic data
until a separate administrator disposition, no account deletion/reuse by this plan.
Do not restore the old indirectly privileged broker as an active managed-hosting
service: return it to its recorded disabled/quiesced state unless separately
approved. Confirm no candidate listener, manager process, pending job or populated
owned worker cgroup, unchanged unrelated service/firewall state, enforcing SELinux,
expected module/label/hash inventory and retained evidence; independently recheck
console and SSH. If any ownership is uncertain, leave quarantined and report it;
VM restore is a separate operator-approved recovery, never an automatic cleanup.

## Decision gate (recommendation only)

**Recommend B: defer managed WydHosting qualification to 0.4**, for user decision.
No new SELinux impossibility was discovered, but the implemented useful subset is
admission rehearsal; it is not yet a bounded runnable lifecycle test. Existing broker
still has indirect root execution through PID 1. The concrete dependency chain is:

1. Implement live session/account/deployment verifier and protected boot/session
   history, with installed provenance and fail-closed anti-rollback policy.
2. Implement fixed protected publisher and complete effective PID 1 verifier;
   serialize publication/reload/effects with durable intent and uncertain outcomes.
3. Implement manager-owned launch job/listener plus authenticated connected-worker
   FD handoff; migrate broker and worker finally/retirement paths together.
4. Implement bounded service/socket adapter, mutual kernel authentication and result
   validation; enforce queue/rate/active-work bounds and durable result recovery.
5. Produce and review manager policy/service/label assets with simultaneous removal
   of every broker lifecycle and artifact right, then the single-identity installed
   campaign above, including interrupted launch/retirement and writer attacks.
6. Qualify recovery/backup and subsequent integration gates without confusing ordinary
   offline passes with installed enforcement or full I5.8 release qualification.

These are six bounded engineering/qualification work packages, not calendar estimates.
They span the entire active lifecycle rather than a missing parser. Relative to the
0.3 Alpha goals, that is substantial remaining work after six prior offline slices.
A remains plausible if the user elects to fund these explicit tasks; no evidence
currently proves its installed boundary. C would be appropriate if the decision
hinged only on writer exclusion: the smallest discriminator would be one separately
approved enforcing guest canary testing broker-denied replacement/PID 1 access under
the proposed manager policy. That experiment alone would not resolve FD migration,
effective-state verification or recovery effort, so it does not erase B's scope basis.
The five real website migrations are 0.3 Alpha release criteria, not I5.6 criteria.
No fallback is activated and no decision log/roadmap is changed. Standalone Wydgine
security/portability remain unchanged.

**Single next approval:** decide whether to authorize deferring managed WydHosting
qualification to 0.4. That decision would precede any separately scoped fallback or
guest-test authorization. No installation approval is requested for this non-runnable
candidate, and no existing permission is treated as authorizing installed tests.
