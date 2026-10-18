# I5.6 recovery and Debian-family feasibility — 2026-10-18

Recommendation **B**: Debian-family integration is useful as a bounded portability
experiment; managed WydHosting qualification should move to 0.4 **if the user elects
that deferral**. This report neither activates deferral nor changes the roadmap.
One Debian 13 VM experiment is worthwhile, but changing distribution does not remove
the manager authority, publication, handoff and recovery work.

## Preservation and review

Started on `develop/0.3`, HEAD `646d1740004d9598c21bc8232099fb31ad8f3c92`, exactly
as assigned: **13 modified tracked files, 10 untracked files, no staged changes**.
Read AGENTS.md, DEVELOPMENT, FOUNDING-ARCHITECTURE, I4 host-security/I5 plan and the
applicable I5.6 contracts, support matrix, manager, SELinux and verification records.
No branch switch, reset, clean, history rewrite or guest operation occurred.

Before edits, created the new mode-0700 directory
`/tmp/wydgit-i56-recovery-20261018T111944Z`. It contains `working.patch` (binary-capable
HEAD diff), `staged.patch`, status/HEAD, a size/SHA-256 inventory and
`overnight-files.tar.gz`: all 23 exact files, including untracked source, plus the
surviving `/tmp/wydgit-i56-overnight` directory. `archive.sha256` identifies the
archive. Existing evidence was not overwritten. The durable compact
[evidence record](../../../test-support/linux/evidence/2026-10-18-recovery.json)
contains the original inventory/hashes and fresh results; raw logs remain in that
local `/tmp` directory. `/tmp` is temporary storage, not a backup retention guarantee.
The local commit preserves all source and compact diagnostics independently of it.

All 23 files are text source, tests, documentation or intentional sanitized diagnostic
evidence. Review and private-key/AWS/GitHub-token/credential-assignment signature scans
found no secret, unrelated file, generated binary, cache or accidental temporary file
among them. A signature scan cannot prove absence of every possible secret. The old
JSON's absolute local log paths and synthetic identities are diagnostic metadata.
The four overnight package/milestone guide pairs match. A broader audit found
`continuation-2026-10-17.md` differs between its two locations already at HEAD;
both files are unchanged and outside this recovery. No additional source defect
was demonstrated.

The overnight source implements serialized final preparation checks, bounded candidate
responses, an independent-measurement contract, deterministic **review-only** artifacts
and an isolated descriptor-handoff prototype. It does not publish units, install a
live collector or transfer installed broker authority. Exact approval/history/release
bindings, default denial, post-publication uncertainty, retained reservations,
anti-replay and descriptor cleanup remain. No ordinary Wydgit runtime API changed;
SEAM, the sixteen-App ceiling and immutable execution closure are unaffected.

### Original inventory and disposition

M = modified at arrival; U = untracked at arrival. Every row was archived byte-for-byte
before edits and is retained in the local recovery commit. Source/test bytes were not
changed during recovery. Historical verification/evidence failures remain visible.

| State | File | Disposition |
| --- | --- | --- |
| M | `CHANGELOG.md` | Preserve continuation; add recovery note |
| M | `docs/milestones/0.3-I5.6/README.md` | Preserve offline-scope pointer |
| M | `docs/milestones/0.3-I5.6/manager-candidate.md` | Preserve authority-cutover limits |
| M | `docs/milestones/0.3-I5.6/verification.md` | Preserve history; append fresh verification |
| M | `packages/wydhosting/broker/lifecycle_authorization.py` | Verify protected fixed-record reader |
| M | `packages/wydhosting/broker/lifecycle_journal.py` | Verify locked veto and retained history |
| M | `packages/wydhosting/broker/lifecycle_manager.py` | Verify offline admission/transport contracts |
| M | `packages/wydhosting/docs/README.md` | Preserve matching packaged guide |
| M | `packages/wydhosting/docs/manager-candidate.md` | Preserve matching packaged guide |
| M | `packages/wydhosting/docs/verification.md` | Append matching fresh verification |
| M | `scripts/verify-packed-packages.js` | Retain stream-close wait and closure checks |
| M | `test-support/linux/verify_lifecycle_manager.py` | Real ordinary-user streams pass; authority simulated |
| M | `test/linux-isolation.test.js` | Real ordinary-user regression passes |
| U | `docs/milestones/0.3-I5.6/offline-manager-protocol.md` | Preserve offline/cutover design |
| U | `packages/wydhosting/broker/lifecycle_artifacts.py` | Verify review staging; publication blocked |
| U | `packages/wydhosting/broker/lifecycle_handoff.py` | Verify simulated transport/real FD ownership only |
| U | `packages/wydhosting/broker/lifecycle_verifier.py` | Verify default-deny collector contract; no live collector |
| U | `packages/wydhosting/docs/offline-manager-protocol.md` | Preserve matching packaged design |
| U | `test-support/linux/evidence/2026-10-18-offline-manager.json` | Preserve unchanged historical failures/hashes |
| U | `test-support/linux/node-async-repro.mjs` | Preserve minimal non-application reproducer |
| U | `test-support/linux/verify_lifecycle_artifacts.py` | Preserve staging/security regressions |
| U | `test-support/linux/verify_lifecycle_handoff.py` | Preserve explicitly simulated transport tests |
| U | `test-support/linux/verify_lifecycle_manager_portable.py` | Preserve portable checks and five explicit skips |

Recovery adds this report and `2026-10-18-recovery.json`. Version metadata, manifests,
lockfiles and roadmap are unchanged at platform/engine/hosting **0.3.0-alpha.15**.

## Verification and failure classification

Commands ran sequentially, with focused reproductions before full checks. Ordinary-user
comparison was allowed by execution review and ran as UID/GID 1000:1000, with
NoNewPrivs=0/Seccomp=0; sandbox controls had NoNewPrivs=1/Seccomp=2/one filter.
Both used `/home/brian/.nvm/versions/node/v24.21.0/bin/node`, no NODE_OPTIONS/NODE_PATH.
No root, OS changes or blanket permission changes were used.

| Command / boundary | Fresh result |
| --- | --- |
| Python `verify_lifecycle_contract.py` | 11/11 pass, sandbox |
| Python `verify_lifecycle_authorization.py` | 14/14 pass, sandbox |
| Python `verify_lifecycle_journal.py` | 52/52 pass, sandbox |
| Python `verify_lifecycle_manager.py` | Sandbox: 17 discovered, 16 errors; ordinary user: 17/17 pass |
| Python `verify_lifecycle_manager_portable.py` | 24 discovered, 19 pass, 5 explicit skips |
| Python `verify_lifecycle_artifacts.py` | 5/5 pass; administrator ownership simulated |
| Python `verify_lifecycle_handoff.py` | 5/5 pass; ancillary transport/domain identity simulated |
| `node --test test/linux-isolation.test.js` | Sandbox: native assertion/file failure; ordinary user: 25/25 pass |
| `npm test` | First two ordinary-user cycles: 944/944; subsequent post-audit cycle: exit 1, 942 pass / 2 fail, 0 cancel/skip |
| `npm run check` | Ordinary user: exit 0, 3 pages / 42 links |
| Local WydHosting pack, scripts disabled | Ordinary wrapper exit 0, 5,609 JSON bytes; broker sources match checkout |
| Extracted tarball Python suites | Same six sandbox successes/counts above; real manager ordinary user 17/17 |
| Full fresh packed JavaScript consumers | **Not executed**: runner performs npm installations, excluded by assignment |
| `git diff --check` | Pass |

The real manager suite uses actual current-user Unix streams/files/locking; root
ownership, session observers and SELinux contexts are simulated. Passing it cannot
establish a real manager domain, cross-UID isolation or compromise containment.
Likewise portable handoff success is not authenticated installed SCM_RIGHTS proof.

**Unix EPERM — demonstrated environmental restriction.** Independent Python
`socket.socketpair(); sendall(...)` returns errno 1 inside the sandbox and succeeds
outside it. The no-Wydgit Node Unix listener also fails EPERM inside and succeeds
outside. Manager stack traces stop at socket sends before manager admission.
These independent controls, matching failure sites and unchanged ordinary-user runs
support attribution beyond simply obtaining a green rerun. The precise enforcing
filter/rule was not identified. A narrow sandbox strace attempt was denied
PTRACE_TRACEME; no restriction was changed to enable it.

**Empty stdout — isolated environment/runtime interaction, exact cause open.**
The existing repository-free Node child (`console.log('probe')`) exits 0 but delivers
empty stdout/stderr even after `close`. Fresh diagnostics show its fd 1 is a socket;
`process.stdout.write` even calls back successfully despite missing bytes. Synchronous
`fs.writeSync(1, ...)` arrives. A Python parent gives the child a pipe and asynchronous
output arrives. All corresponding ordinary-user Node controls deliver output. This
narrows the symptom to asynchronous socket-backed child stdio under the sandbox;
it does not prove which Node/libuv/security component loses the bytes. No output
substitution, assertion removal or runner workaround was made.

A first sandbox pack control also encountered an unwritable default npm cache (exit
226). With a dedicated writable `/tmp` cache, npm pack creates the tarball and exits
0 while the Node wrapper still receives empty JSON. Ordinary-user Node wrapping the
same pack returns valid JSON. This explains the observed parser input failure;
changing `exit` to `close` correctly drains streams but cannot repair this loss.
It does **not** establish that all downstream JavaScript consumers pass. Fresh packing
and extraction execute no install scripts; no fresh consumer installation was done.

**Native async-ID assertion — unresolved, not an overnight-specific regression.**
Current sandbox Linux test again aborts at callback.cc:165 with
`env_->execution_async_id() == 0`. A copy of `HEAD:test/linux-isolation.test.js`
with the unchanged current JS runtime also reproduces it. An offline-only name-filtered
run and repository-free plain/Unix probes do not reproduce the assertion; the Unix
probe reports normal EPERM instead. Current ordinary-user Linux suite passes 25/25
and full suite passes 944/944. This is evidence of a sandbox-dependent trigger that
predates the overnight test changes, not proof that Node, the peercred addon or
application callback behavior is fault-free. A full historical checkout comparison,
minimal assertion reproducer and exact native cause remain open under
`I5.6-NODE-ASYNC-SANDBOX`. No Node upgrade or dependency change was attempted.

### Additional ordinary-user HTTP failures retained

After two full 944/944 passes, the post-audit required run exits 1: **942/944 pass,
2 fail, zero cancellation/skip**. JSON Contact concurrent POST and shared dispatch
held-request drain return HTTP 500 instead of 200; both capture exactly `page` and
`cleanup` / `SEWN.LIMIT`. `npm run check` still passes. Raw output is
`post-audit-npm-test.log`, with command metadata in `post-audit-required-results.json`.
The two implicated test files then pass **14/14** in one focused run; the unchanged
controlled `http-budget-probe.mjs` passes **6/6**, exercising deadline 500s,
commit uncertainty, cancellation and sibling survival. These are diagnostic probes,
not a replacement passing full run. The engine, these HTTP tests and probe are all
unchanged from starting HEAD. A load/CPU-pressure snapshot is retained; it does not
prove that scheduling alone caused either failure or exclude a runtime defect.

Classify this as a **real intermittent HTTP reliability limitation with unresolved
causation**, distinct from sandbox EPERM/stdout loss. Page-budget exhaustion is
observed, but precise delay attribution and mitigation remain open. No budget,
assertion, concurrency policy or timeout was changed. No additional demonstrated
offline-manager defect was found. The local commit is justified for independently
verified non-effectful offline contracts and preservation; it does not certify the
broader HTTP reliability or installed security boundary. Final required checks after
this evidence update are logged separately as `delivery-npm-test.log`,
`delivery-npm-check.log` and `delivery-required-results.json` and reported in the
handoff, without erasing this failed run.

## Original distribution intent and present portability

History, rather than a remembered support claim, establishes the intent:

- `04f9da5` initial baseline uses standard Node/Express, Node >=22.12.0, no distribution
  installation contract. It supplies no Debian/Ubuntu managed-isolation certification.
- `583a43e` adds the platform vision: initial shortlist Ubuntu Server LTS/Debian Stable,
  support conditional on an actual tested matrix.
- `7df1350` I4 `host-security.md` explicitly selects **Ubuntu Server 24.04 LTS amd64**
  first and **Debian 13 amd64** next. It certifies neither and calls out native
  Argon2/SQLite, systemd/cgroup, firewall and recovery qualification.
- `a4b78a8` adds the shared explicit `platforms.json` and experimental EL10 lanes.
  Current matrix admits Ubuntu **24.04**, Debian **13**, Alma/RHEL major **10**;
  no `ID_LIKE` fallback. No privileged Debian/Ubuntu execution evidence was found in
  the reviewed history/docs. Mint development tests are not Ubuntu qualification.

Standalone Wydgine remains structurally portable: its package does not depend on
WydHosting; server transport and trusted library adapters remain separate from
SEAM/application authority. Current Node minimum is **24.21.0**; optional native
SQLite 13.0.3/Argon2 0.45.1 implementations require matching ABI/libc/toolchain.
The current host's ordinary-user success is useful runtime evidence, not a fresh
Debian/Ubuntu installation or Windows/macOS certification. The Linux N-API peercred
helper and managed service profile are Linux-specific optional boundaries.

### Current candidates, checked against primary sources

As checked 2026-10-18, current [Debian Stable](https://www.debian.org/releases/) is
13 (trixie), point release 13.7. Current [Ubuntu LTS](https://ubuntu.com/about/release-cycle)
is 26.04; [its announcement](https://lists.ubuntu.com/archives/ubuntu-announce/2026-April/000323.html)
dates release to April 23, 2026. Ubuntu 24.04 is the older repository candidate,
not the current LTS. Package pages are observations, not frozen VM manifests.

| Property | Debian Stable 13 | Ubuntu LTS 26.04 |
| --- | --- | --- |
| Current repository admission | Explicit Debian 13 candidate | Refused: only Ubuntu 24.04 is admitted |
| systemd package observed | [257.13-1~deb13u1](https://packages.debian.org/trixie/systemd) | [259.5-0ubuntu3.4, amd64](https://packages.ubuntu.com/resolute/systemd) |
| Python default package | [3.13.5-1](https://packages.debian.org/trixie/python3) | [3.14.3-0ubuntu2](https://packages.ubuntu.com/resolute/python3) |
| Archive Node package observed | [20.19.2+dfsg-1+deb13u3](https://packages.debian.org/trixie/nodejs), below minimum | [22.22.1+dfsg+~cs22.19.15-1ubuntu1](https://packages.ubuntu.com/resolute/nodejs), below minimum |
| MAC candidate | [AppArmor 4.1.0-1 available](https://packages.debian.org/trixie/apparmor); hosting policy absent | [AppArmor enforcement documented](https://documentation.ubuntu.com/security/security-features/privilege-restriction/apparmor/); hosting policy absent |
| Immediate extra work | Approved Node closure and actual policy/platform qualification | Same, plus explicit new release admission/review and Python/systemd compatibility |

Recommend **Debian 13 amd64** for the smallest current-release trial: already admitted,
same systemd major as recorded Alma experiments, fewer release-policy changes. That
does not predict the same seccomp/openat2 behavior. Ubuntu 24.04 is a reasonable
separate historical-intent test, but cannot stand in for current Ubuntu LTS or Debian.
No assumption is made that installing archive `nodejs` satisfies the engine requirement.
Caddy/UFW/audit/compiler exact versions and image/kernel updates must be resolved and
recorded before a future trial; this report makes no unverified package-version claim.

## Architecture dependencies and barriers

| Existing assumption | Debian-family consequence |
| --- | --- |
| Real PID1 systemd, unified cgroup v2 cpu/memory/pids; numeric service identities, invocation/cgroup/MainPID checks | Available architecture, still requires real VM effective-state tests; rootless containers do not substitute |
| openat2 BENEATH/NO_SYMLINKS/NO_XDEV; descriptor-relative immutable deployment; fsync/rename/flock | Linux primitives remain; probe installed syscall filters and filesystem crash semantics independently |
| `/usr/bin/python3`, fixed systemctl/account tools, `/opt/wydhosting/release`, `/etc/wydhosting`, `/var/lib/wydhosting`, `/run/wydhosting`, `/run/systemd/system` | Validate exact tool paths, NSS/account semantics, ancestors, mount boundaries, ownership and writable overlays; do not use arbitrary distro command fallback |
| Root broker: CHOWN/DAC_OVERRIDE/FOWNER, writable managed state and `/run/systemd/system`, fixed systemctl access | Distro switch does not remove indirect root execution through unit writing/reload/start; root-owned DAC alone cannot exclude a compromised root broker |
| Worker empty capabilities, NNP, private devices/tmpfs, filesystem protections, AF_UNIX-only, RestrictNamespaces | Retain and verify effective settings and denials; no unprivileged user-namespace workaround is needed or authorized |
| SELinux domains, per-tenant MCS categories, SO_PEERSEC exact contexts, labeled resources | Current manager/verifier/handoff and pinned candidate renderer hardcode SELinux identities; cannot execute unchanged under AppArmor |
| UFW/firewalld preview, fail-closed live apply | Debian/UFW candidacy does not implement firewall transactions; native nftables remains separate. No firewall reduction credited |
| Durable reservations, approval freshness, no repeated effects after uncertainty, exact retirement | Distribution independent; reboot/rollback cannot erase lifetime history safely |

The original broker renderer conditionally emits a worker SELinux context, but shipped
broker/provider units have SELinuxContext directives and the new lifecycle contract is
explicitly SELinux-bound. The broader platform preflight permitting Debian without
SELinux therefore does not imply this manager can run there. AppArmor uses a
[path-based model](https://documentation.ubuntu.com/security/security-features/privilege-restriction/apparmor/),
not SELinux type/MCS semantics. A port needs separately reviewed per-role/per-tenant
profiles, executable transitions, kernel peer-profile authentication, inherited/open
FD and Unix descriptor transfer mediation, ptrace/signal/cross-tenant denial, mount/link
alias handling and broker exclusion from policy/units/collector/journals/PID1. Merely
removing context checks or allowing missing profiles would weaken the standard.
A Debian SELinux installation could instead preserve the model, but needs its own
loader/type/label/policy port and boot qualification; it is not a smaller proven path.
No such port or redesigned authority architecture is delivered here.

### Effect on the six remaining work packages

| Work package from manager-candidate.md | What Debian testing reduces |
| --- | --- |
| 1. Live verifier, independent session/account/deployment/boot history | Measures tool/runtime compatibility; no installed collector or anti-rollback implementation supplied |
| 2. Protected publisher and effective PID1 verifier with durable uncertainty | Can test systemd/openat2 behavior; publisher/serialization/verification still required |
| 3. Manager-owned launch/listener and worker-control handoff migration | Can test native socket/SCM_RIGHTS mechanics; broker/worker coordinated migration remains |
| 4. Bounded service/socket adapter, authentication, rate/work limits and recovery | Offline continuation addresses some framing/admission; installed adapter and MAC identity integration remain |
| 5. Manager confinement with simultaneous broker authority removal | Requires a new enforcing policy or SELinux port; Debian default policy does not solve it |
| 6. Recovery/backup and remaining integration gates | A new VM provides a test venue; restore/reboot/power loss, disk quotas, external ingress/firewall gates remain |

Thus a VM reduces uncertainty about functional portability and provides a usable
ordinary-user verification environment. It does not eliminate any whole work package
or establish that 0.3 qualification is bounded. Local installation success establishes
basic functionality only. Actual tenant isolation requires independent hostile OS
checks, including a compromised broker, plus remaining lifecycle/recovery evidence.

## Smallest useful disposable VM trial — plan only

### Boundaries, resources and threat model

Use a **new** Debian 13 amd64 VM, 2 vCPU, 4 GiB RAM, 24 GiB disposable disk (increase
to 8 GiB only if native compilation requires it). Pin official image/checksum, record
updated kernel/package manifest and assign a unique VM name/UUID. No reuse or access
to `almond-lab`; no host shared directories, agent socket, host credentials, bridged
network, production data or public DNS/TLS. Initial preparation may use approved NAT
egress for pinned downloads; disconnect afterward. Prefer console only. Any management
network must be explicitly scoped to the operator, with no public listener; trial HTTP
is guest loopback/private Unix only. No host firewall changes are part of this plan.

Trusted: hypervisor/kernel/PID1, administrator-installed immutable release/approvals,
and an independently protected collector/manager. Hostile: tenant package, native
worker compromise, other tenant and native session-broker compromise. Host root/kernel
compromise is outside this trial; root **inside the confined broker** is in scope.
Keep SEAM deny-by-default and test it separately from OS boundaries. A same-UID denial
must be produced by a native probe in the actual worker domain, not just Wydgit APIs.

### Approval-bound installation sequence

1. Inventory clean VM, console, snapshot/restore facility and network; record image
   hash, VM identity, boot, filesystem/mount options and baseline services. Verify a
   clone restore without duplicate network identity before any hostile installed test.
2. Approve an exact package manifest: Python3, systemd/systemd-sysv, libc/compiler/
   make and matching Node headers, CA tools, account tools, AppArmor parser/utilities
   and audit tooling. Caddy/UFW may be inventoried but need not be installed for the
   initial private trial. Resolve versions before approval, never install a floating
   third-party setup script. Archive Node is insufficient: approve a checksum-verified
   Node >=24.21.0 runtime/npm closure, initially matching the tested Node version;
   build existing pinned native SQLite/Argon2/peercred as an unprivileged staging UID.
   No dependency addition/version bump is required or authorized by this report.
3. In the VM only, stage exact release hashes under `/opt`, root-reviewed config in
   `/etc/wydhosting`, private persistent state in `/var/lib/wydhosting` and volatile
   endpoints in `/run/wydhosting`. Prove ancestry/mount and writer exclusions and
   native module closure. Accounts are administrator-created, locked/no-login,
   synthetic, nonroot, separately reserved; the session broker does not create them.
4. **First stop point:** run standalone Wydgine with a synthetic App, JSON then SQLite/
   Gate/Files fixtures, restart and persistence checks; execute ordinary-user focused
   manager/packed consumer checks with explicit installation approval. Run read-only
   hosting preflight and real openat2/cgroup/socket probes. This stage can pass while
   managed hosting remains blocked, which is a useful portability result.
5. Produce a separate reviewed enforcing confinement mapping before privileged
   hosting activation. Keep existing manager split/closed contracts; do not invent a
   generic command proxy. Session broker must have no unit/drop-in/reload/start/policy/
   collector/journal publication authority outside its closed manager channel. Remove
   its existing manager/artifact rights simultaneously with enabling the new path.
   Worker must retain empty capabilities, NNP, AF_UNIX-only, bounded private tmpfs,
   cgroup limits and restrictive filesystem/namespaces. Profile loading failure must
   prevent start. No complain/permissive/unconfined substitute or blanket allowance.
6. **Second stop point:** current publisher/live verifier/launcher migration are
   absent. Do not wire mocks into installed services. If step 5 cannot be implemented
   and independently reviewed within a separately approved bounded effort, stop with
   portability evidence and B; no managed-lifecycle pass is possible. The security
   discriminator may use fixed administrator-installed canary units to measure writer/
   PID1 exclusion, clearly labeled policy feasibility rather than WydHosting integration.

### Synthetic lifecycle and measurable criteria

After those prerequisites and separate approval, use tenant A and sibling B, one
synthetic App each, distinct nonroot identities and policy scopes; no customer data.
A canonical provider approval prepares exactly one generation, manager publishes fixed
verified bytes, launches once, authenticates worker control and obtains private HTTP
readiness. Observe PID/start time/UID/GID/boot/invocation/cgroup and all effective unit
properties independently. Restart only within existing budgets. Stop/retire the exact
invocation, require empty descendant cgroup/no job/no listener and retain all lifetime
reservations/tombstones. Sibling B must continue serving through A crash/OOM/stop.

| Test | Pass criterion |
| --- | --- |
| Positive runtime/lifecycle | Correct synthetic output/persistence; one approved invocation; private Unix ingress; bounded restart; exact stopped/retired state |
| Tenant hostility | Real reads/writes/signals/ptrace/socket access to B/provider/broker, host sensitive files and TCP/UDP denied; own approved operations succeed |
| Same-UID escape probe | An alternate process in A's actual confinement cannot access B's policy-separated sentinels, even where DAC is deliberately non-discriminating |
| Broker compromise canary | Direct and PID1-mediated replacement/start of arbitrary units/drop-ins, policy/collector/approval/journal rewrite and relabel/profile escape denied; sentinel hashes/inodes unchanged |
| Protocol/identity attacks | Wrong UID/profile/PID lifetime, stale boot/history, expired/revoked approval, unknown keys/actions, oversized/trailing/ancillary frames rejected with no effects |
| FD handoff | Actual seqpacket SCM_RIGHTS, noninheritable connected FD, exact independent peer/inode/lifetime; forged/file/listener/extra/truncated descriptors refused and all received FDs closed |
| Resource limits | Measured CPU/memory/pids/private-tmp limits bound A, preserve B; persistent-disk quota is separately absent unless implemented and tested |
| Crash uncertainty | Interrupt after durable intent/after publication/before receipt and during retirement: quarantine or exact recovery, no automatic duplicate start or reservation release |

For actual isolation evidence retain image/runtime/source/policy hashes, effective
LSM/profile and transitions, PID1 unit properties/FragmentPath/DropInPaths, capabilities,
NNP/seccomp/namespaces/cgroups/mounts, UID/GID and socket peer facts, positive controls,
raw hostile operations/errno/audit denials and independent sentinel observations.
Denials caused only by a malformed test or inaccessible fixture are not enforcement
proof. Passing tenant DAC tests alone does not prove same-UID MAC or broker containment.
The first trial excludes external IPv4/IPv6/firewall, reboot/power-loss, quotas and
production certification; keep each explicitly open, never lower the security gate.

### Backup, rollback, cleanup and approvals

Before installation record exact package/unit/policy/account/filesystem/network
baseline and VM disk/config/firmware coverage. Keep a verified snapshot and isolated
restore clone. Export logs, approvals, journals and tombstones outside the guest's
rollback domain before restore or deletion; never reuse rolled-back identities as
if no effects occurred. If recovery is unproven, stop before mutation.

Rollback denies new work, inventories exact owned invocations and jobs, stops only
proven trial cgroups/listeners and quarantines ambiguity. Preserve evidence before
removing only manifest-owned artifacts or restoring reviewed original units/policy.
Verify no candidate process/listener/job/cgroup remains and unrelated services and
network are unchanged. Prefer destroying the isolated VM after evidence export and
operator review rather than deleting/reusing host accounts. VM snapshot restoration,
clone creation and destruction each require approval; never overwrite a live backing
disk or fall back to an indirectly privileged active broker.

**Exact future approvals:** VM creation/resources/storage and image download; optional
NAT/management exposure; VM-local package/Node/native dependency installation; snapshot
and restore-clone drill; locked fixture accounts/directories; service/socket/unit
installation/start/reload; reviewed AppArmor or SELinux policy installation/activation;
bounded native hostile/resource/crash tests; evidence export and manifest cleanup;
VM rollback/destruction. Reboot/power-loss, public network/firewall/TLS/DNS tests require
separate later approvals and are excluded from the first trial. No approval is sought
or implied for any of these operations by this report.

## Local handoff

Commit scope is the verified **offline** continuation plus recovery documentation and
compact evidence; it is not installed qualification. Resolve the local delivery commit
without a self-referential hash using:

```sh
git log -1 --format=%H -- docs/milestones/0.3-I5.6/recovery-and-debian-feasibility.md
```

Required checks are rerun after the final document edits before committing; exact
final command results and HEAD/tree status are included in the handoff. Full fresh
packed JS consumers, exact native assertion cause and installed security gates remain
unverified. No version/dependency/roadmap change, installation, deployment, push,
merge, tag or release is included.
