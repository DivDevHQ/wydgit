# I5.6 offline manager protocol continuation — 2026-10-18

Starting branch `develop/0.3`, HEAD
`646d1740004d9598c21bc8232099fb31ad8f3c92`, clean; origin is
`DivDevHQ/wydgit`. Version stays **0.3.0-alpha.15**. No dependency, release criterion,
roadmap, installed policy, account, permission or service change. No guest contact.
This is a repository-only reference implementation, **not an installed manager or
production qualification**. The existing broker remains the deployed candidate;
none of these private modules is imported by its production path.

## Protocol and journal admission

`lifecycle_manager.handle` authenticates the accepted AF_UNIX stream using kernel
SO_PEERCRED and SO_PEERSEC before reading bytes. Exact configured broker UID/GID and
`system_u:system_r:wydhosting_broker_t:s0` are required; root alone is insufficient.
The request is one EOF-delimited JSON frame, at most 8192 bytes, with an absolute
10-second receive deadline. The writer half-closes. Ancillary data and truncation
refuse; lifecycle/1 continues rejecting unknown/duplicate/reserved fields, unsupported
versions/actions, invalid numeric types and ambiguous extra frames.

`serve` owns/closes one accepted stream and sends a bounded candidate response with
a two-second write timeout. An embedding-owned `Admission` instance allows at most
four active calls by default (configuration range 1–16); excess connections close
without reading, allocating a waiting work item or touching history. One instance
must cover the process. This is no listener/daemon: accept backlog, per-peer request
rate, total process/FD/memory bounds and worker/session integration remain installed
gates. Trusted verifier callbacks must themselves be bounded; arbitrary in-process
Python callbacks cannot be forcibly timed out safely by this synchronous adapter.

`exchange` authenticates the manager's exact configured UID/GID and
`system_u:system_r:wydhosting_manager_t:s0` before sending. It checks that identity
again after receiving the response, then checks the closed schema, string field
types, known result codes, request digest, operation ID and permissible candidate
states/outcomes. It rejects completion claims. It opens no paths and automatically
retries nothing. The embedding owns the client connection. Both sides still need
installed session/descriptor provenance: socket credentials identify their creator,
not every process that might subsequently possess an alias of the socket.

Operation ID is the existing explicit transaction identity. Canonical request digest
binds action, tenant/account/pool, policy, deployment, lifetime, epoch and sequence.
No parallel transaction database was added. Existing journal locking, history
validation, original approval/evidence, permanent lifetime tombstones, sequence/epoch
and predecessor rules remain authoritative. Same-ID different requests conflict;
identical requests observe durable history rather than append another preparation.
No intent, completion, retirement acceptance, successor grant or effect is exposed
by the candidate. A successful admission returns `indeterminate/INSTALLED_REQUIRED`
and `prepared`; possible-effect states and pending publication require reconciliation.
Lost response or interrupted response delivery cannot undo a reservation. Retry must
keep the original ID and exact bytes, revalidate current authorization and independently
measure the **current** history. A new ID is not a transport-recovery mechanism.

Preparation now requires a separate default-deny exact-scope verifier. The existing
journal calls its veto-only `prepare_guard` under the same directory lock as history
admission and publication, passing canonical original approval and original history.
The guard reobserves peer/boot/session, checks independent exact scope, then rereads
current approval, revocation and expiry. Use a trusted clock callable in an embedding;
fixed timestamps are supported only for offline fixtures. Verifier failure makes no
journal write. The guard cannot grant a transition or supply completion evidence.
An error after possible journal publication remains indeterminate; no automatic effect
retry or preparation rollback exists.

## Independent measurements: strict contract, no live collector

`lifecycle_verifier.ProtectedSessionVerifier` reads only fixed `session.json` through
a trusted preopened evidence directory. It reuses descriptor-relative openat2
NO_SYMLINKS/NO_XDEV/BENEATH, root owner/private mode/single-link checks and held-inode,
name and parent metadata revalidation from the authorization reader. The private
reader now accepts trusted fixed-name tuples for these additional internal records;
no broker request can choose a name, directory, release pin, clock or observer.

The canonical closed measurement record includes exact request, original approval
and original journal-history digests, boot, peer PID/UID/GID/domain/start time,
broker session, systemd invocation, cgroup, account/deployment/release digests and a
maximum five-second observation interval. It is a measurement projection, not a
new approval or a replacement history. Protected lifecycle approval and reservation
checks still run independently. Fresh live observation must exactly match all
measurement facts. The default observer returns nothing, so even a structurally
perfect protected record refuses. Same-history substitution, stale prior authorization,
foreign boot, PID reuse, changed invocation/deployment/account and conflicting
histories cannot be accepted by supplying a broker's verification result.

**Installed prerequisites remain explicit:** administrator/independent-collector
ownership of measurement records; MAC exclusion of broker/provider/worker writes,
relabeling, descriptor injection and ancestor/mount replacement; independent live
PID 1/kernel, account and immutable deployment observation; bounded observer runtime;
and maintenance serialization. The current root broker's DAC capabilities make
root ownership alone insufficient. No live collector or anti-rollback anchor is
implemented. A protected record copied with an entire older journal snapshot cannot
prove freshness or defeat privileged storage rollback. New boot requires new exact
measurements; old receipts are not boot-independent evidence. Offline observer and
root-ownership substitutions are explicitly labeled in tests.

## Deterministic artifact review staging

`lifecycle_artifacts.prepare` independently rereads the current exact approval and
reservations plus fixed protected `materialization.json`. This projection binds its
canonical rendering input to the original approval digest, supplies only sealed
App names/session, and must exactly preserve approved identity, action, tuple,
sequence, limits and template/release pins. It cannot widen authorization. Only the
existing known start template is supported. No request accepts unit text, target
paths, executable directives, environment, arbitrary properties or template choice.

The existing fixed renderer produces deterministic unit bytes and a manifest with
request/approval/reservation/projection/template/release bindings, full target unit
identity, expected SHA256, root ownership and intended installed mode. `stage` writes
only exclusive `unit.service` and `manifest.json` files in an empty trusted review
directory, mode 0600, fsyncs and rereads them, and rejects symlinks, hardlinks,
unsafe directory modes, preexisting output and drift. Partial output stays visible
for inspection; it is never retried over, installed or treated as a durable effect.
No journal transition occurs during artifact review.

The manifest says `prepared-review-only` and
`publication=INSTALLED_LAYOUT_REQUIRED`. **Protected publication stops here.** The
pinned template still names the existing broker-owned job path; silently replacing
that path would change the approved template trust model. A manager-owned job layout,
launcher/worker adaptation and a separately reviewed template pin are prerequisites.
These staged bytes must never be copied into an installed unit by this candidate.

For future publication: derive all names from the exact approved lifetime; record
intent in the existing journal before any installed effect; render/revalidate through
held protected descriptors; create/fsync typed manager-owned temporary files in the
target filesystem; atomically publish without replacement; fsync the directory and
recheck ownership/type/inode/digest. Serialize reload and effects through the same
lifecycle transaction. An administrator must protect every unit/drop-in/alias/
generator ancestor and the installed release, not just the fragment file. Verify
PID 1 FragmentPath, empty DropInPaths, all effective commands/environment/identity/
SELinux/dependencies/sandbox/limits, load state, job, invocation, MainPID/start time,
actual credentials, boot and descendant cgroup membership independently. File bytes
or successful reload/start are not effective-state proof.

## Descriptor handoff prototype and feasibility

`lifecycle_handoff` is an isolated one-packet AF_UNIX SOCK_SEQPACKET/SCM_RIGHTS
prototype. It accepts one already connected worker-control AF_UNIX stream, exact
independently obtained device/inode/peer UID/GID/PID/domain, boot/request/lifetime
binding and a fresh live-worker verifier (default deny). It opens no paths. Both
sender and receiver check kernel channel identity; the receiver checks descriptor
socket type, connection, identity, non-listener state and close-on-exec. Extra FDs,
unknown ancillary types, malformed/truncated packets, wrong purpose/binding and
unverified workers refuse. All visible rejected descriptors are closed, including
constructor/verification failures. The owned one-use handoff channel closes on every
exit, discarding queued rights; the sender consumes/closes its owned worker socket
on success and failure. There is no automatic retry or lifecycle completion receipt.

SCM_RIGHTS **duplicates**, rather than revokes, authority. The future manager must
originate worker-control connections, prevent unintended inheritance, retain only
explicitly necessary aliases and give the broker no directory, approval, journal,
unit or PID 1 descriptor. A successful send cannot prove absence of retained aliases.
This prototype is not wired into the broker or worker and does not solve privilege
migration, durable handoff acknowledgment or crash adoption.

In this managed sandbox, a real local seqpacket/SCM_RIGHTS probe **passes**, including
same device/inode and close-on-exec on the received descriptor. Actual Unix stream
sendall/shutdown and received socket reconstruction via `socket.socket(fileno=...)`
raise EPERM. The complete authenticated connected-worker transfer is therefore
**unverified**. Portable tests simulate packet IO, identities and socket reconstruction;
they exercise actual descriptor duplication/closure and filesystem/socket inode checks.
No restriction bypass or ordinary-user unsandboxed comparison was attempted.

## Coordinated installed authority transfer — not executed

| Boundary | Current broker candidate | Required cutover |
| --- | --- | --- |
| DAC/capabilities | root, CAP_CHOWN/CAP_DAC_OVERRIDE/CAP_FOWNER; `/var/lib/wydhosting`, `/run/wydhosting`, `/run/systemd/system` writable | Remove unit write path and all manager policy/state/artifact/ancestor access. Later nonroot broker migration is separate; root requires enforced MAC exclusions now. |
| Indirect PID 1 authority | `wydhosting_worker.cil` permits broker unit creation/rename/unlink, service start/stop/status, init_t reload and systemctl execution | Remove these grants, generic attribute/DBus/private-manager equivalents, broker unit type transitions and old launch/finally artifact deletion together. No account tools or account DB rights are reintroduced. |
| Manager rights | No installed manager | Dedicated manager_t/executable/control/policy/state/artifact/unit types. Read sealed policy/release and necessary kernel/cgroup data; write/fsync/rename only its own state/artifacts/approved fragments; reload and start/stop/status only approved unit type. No account management, arbitrary commands, own executable/service/policy writes, shadow writes, arbitrary host paths or generic privileged RPC. |
| Capabilities and labels | Broker currently owns worker staging/labeling | Prefer administrator-provisioned worker owners and fixed type transitions for new manager artifacts, with empty manager capability set. Any demonstrated need for CHOWN/FOWNER or relabel rights requires exact-path/type review; no SETUID/SETGID/SYS_ADMIN/SYS_PTRACE grant by assumption. PID 1 performs approved nonroot worker transition. |
| Approvals and evidence | Administrator protected approval/proof; root broker is still a residual trust risk | Root/private modes plus manager/independent-collector writer types, broker/provider/worker exclusion and protected ancestors. Installer quiesces and takes locks. No broker-generated record becomes authoritative by moving it. |
| Worker channels | Broker-created launch job and relay; BindsTo session lifetime | Manager-created approved job/listener and connected-worker channel, authenticated one-use handoff, audited close/inheritance inventory. Broker cannot retain a broad filesystem or service-manager FD. |

Use the detailed identities, destinations and backup/rollback inventory in
[manager candidate](manager-candidate.md), augmented with these new modules and
protected measurement/materialization projections. The modules are not a daemon
entrypoint or an installation recipe. No service/policy activation assets are added.

The cutover has one maintenance barrier: (1) deny new broker admissions and quiesce
all old writers, inventory current invocations and preserve journals/reservations;
(2) with broker and new manager disabled, install reviewed immutable code, exact
approvals/projections/labels and adapters; (3) remove every old broker lifecycle/
unit/PID 1 right and old cleanup path; (4) independently inspect effective systemd
sandbox, capabilities, DAC/MAC including inherited attributes, all writer exclusions
and descriptor inventory; (5) only then enable the constrained manager and adapted
broker. Until all checks pass, **both remain disabled**. Quiescence avoids an overlap
where sequential OS/policy changes would otherwise leave two active trust paths.
The offline handoff mock and current broker service are not acceptable adapters.

Publication followed by failed activation/observation leaves the exact artifact,
intent, identity and reservations quarantined. Stop only an independently proven
original invocation; never kill by reused numeric PID or adopt a service by name.
Missing/changed boot or conflicting history prevents completion and successor
admission. `accept-retirement-evidence` remains an immutable exact-history audit
acknowledgment, without retirement completion or reservation release. Rollback first
denies requests and preserves evidence, then removes only manifest-owned resources
with independently proven identity; it leaves the old broad broker disabled. A VM
restore cannot erase permanent lifetime history or authorize an earlier successor.
Installed crash, power-loss, restart, storage rollback and recovery/backup qualification
remain separate requirements needing explicit approval.

## Reliability and verification scope

Node is v24.21.0; Python 3.12.3; UID/GID 1000/1000; managed workspace-write sandbox,
NoNewPrivs=1, Seccomp=2, one filter; kernel 7.0.0-38-generic. No alternate Node,
host permission change, guest access or unsandboxed comparison was attempted.
`node-async-repro.mjs` provides plain, Python-child, Node-child and Unix-listen controls,
with no Wydgit imports or native addon. Plain and child controls each pass 1/1;
the Python child reports stream sendall EPERM. Unix listen fails EPERM, **without**
the native async-ID assertion. A Node child running only `console.log("probe")`
exits 0 but delivers empty stdout/stderr to its Node parent, even when the parent
waits for `close`; that control fails its expected-output assertion. No Wydgit import
or native addon is involved. This is a minimal subprocess-output reproducer,
**not** a minimal native async-ID-assertion reproducer. These controls do not isolate
the native assertion's cause. The full Linux suite remains the reproduction path; historical ordinary-user
passes and sandbox assertion failures remain in [verification](verification.md).
No timeout/assertion/async-hook protection was relaxed. The next investigation needs
an authorized same-binary syscall-context comparison and native/async-path minimization,
not repeated expensive full-suite attempts.

Focused filesystem/portable results and exact diagnostic paths are recorded in
[overnight evidence](../../../test-support/linux/evidence/2026-10-18-offline-manager.json).
Final sequential contract/authorization/journal/manager/Linux/full/content/packed
attempts are logged in `/tmp/wydgit-i56-overnight/final-*.log` and `results.json`.
The first required npm test exits 1 (runner reports 96 tests, 67 pass, 29 fail;
child-file summaries lack valid individual-case counts); content check passes
3 pages/42 links. Packed JS verification fails on empty npm JSON despite a created
tarball. Waiting for child `close` instead of `exit` preserves the failure, so no
subprocess-output fix is claimed. Direct `npm pack` succeeds; extracted-tarball
Python contract/authorization/journal/portable-manager/artifact/handoff suites pass
with the same 11/14/52/17/5/5 passing counts and 5 portable transport skips. This
proves Python package closure, not the unexecuted broader JS installed consumers.
Failures are retained alongside corrected fixture runs; no offline success is counted
as installed enforcement. Package mirrors and tarball asset checks include all new
private modules and this guide. No dependency or version change is necessary.

## Decision evidence

Protocol correlation, under-lock exact admission, independent-measurement rejection,
deterministic inspectable preparation and descriptor-cleanup contracts reduce offline
uncertainty. The kernel FD probe narrows the mechanics question. Live independent
observation, protected installed publication/effective state, complete FD/launcher/
broker migration, installed bounded scheduling, coordinated MAC/systemd transfer and
recovery qualification remain unproved. Additional generic offline modeling has
little decision value until those OS facts can be tested.

Recommendation remains **defer managed WydHosting qualification to 0.4**, for the
user's decision; this does not approve or activate deferral. Standalone Wydgine does
not require qualified managed hosting. If the user chooses continued I5.6 work,
first authorize a specifically scoped enforcing-guest writer-exclusion canary using
the review/backup/rollback prerequisites, before funding a full runnable manager.
That canary must prove broker-denied unit/approval/journal replacement and direct
PID 1 access under the proposed policy, with both old and new lifecycle services
otherwise disabled. It will not by itself qualify launch, handoff or recovery.
The next explicit user decision is whether to approve deferral or continue toward
that separately reviewed canary; no guest mutation is authorized by this document.

Final failure-classification review adds two portable regressions: errors escaping
AFTER durable preparation return `indeterminate/IO`, retain the reservation and
permit only exact-history observation on retry; unknown verifier exception codes
cannot reflect private strings. The portable suite now discovers **24 cases:
19 pass, 5 explicit real-transport skips**. Previous 17-pass/5-skip results above
are retained as earlier checkpoints. Final verification after this source fix is
recorded separately in `last-results.json`, `last-*.log` and the compact evidence;
required npm reruns correspond to actual diagnostic/source edits, never a search
for a passing environment. All changes remain uncommitted for review because real
transport/full-suite qualification is blocked. No privileged operation is attempted.
