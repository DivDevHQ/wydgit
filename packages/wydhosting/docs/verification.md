# I5.6 verification and qualification record

**Latest campaign:** [reliability diagnosis and broker domain](#reliability-diagnosis-and-broker-domain-campaign--2026-10-16)
and [SELinux policy](selinux.md). Earlier sections retain their original failures,
counts and limitations; they are historical evidence, not the current gate decision.

Branch **develop/0.3**, starting SHA
**35d7b54c43e98b8d78e0e2cf15826b997639ca66**, clean. Fetch confirmed exact
`origin/develop/0.3` equality; no intervening commit/history was removed. Read local
agent/development/founding instructions, I0–I5.5 reports, I4 architecture/process/
filesystem/customer/security/setup contracts and actual registry/protocol/supervisor/
worker/inventory/library/transport sources. This record distinguishes executable code
from qualified OS behavior. Delivery SHA is resolved without a self-referential hash:

```sh
git log -1 --format=%H -- docs/milestones/0.3-I5.6/verification.md
```

**Overall: experimental partial implementation; not implementation complete; NOT
security qualified. Real AlmaLinux broker/account/staging/worker, kernel fixture and
firewall rollback results are recorded below; integrated release gates remain open.** At the original alpha.15 delivery no authorized disposable VM was available.
No root/sudo/account/systemd/cgroup/firewall/SSH/network/DNS/certificate provisioning
was performed on the operator's machine. Sandboxed test restrictions were bypassed
only for explicitly authorized ordinary-user subprocess/socket/browser/npm/Git work,
not by running customer code or provisioning as root.

## Reliability diagnosis and broker domain campaign — 2026-10-16

Started clean at **14291e7d6a616643c7148bfbbcf2c94c85d517d9** on
`develop/0.3`, equal to freshly fetched `origin/develop/0.3`. Version remains
**0.3.0-alpha.15**. Reviewed that commit's actual relay/process-observation,
Caddy and private-tmpfs changes; none was reverted or credited with explaining an
older incident. Guest hostname `almond-lab`, machine ID
`97512ddd78234e5a97d2bb8ce8f446fe`, VM UUID
`a70c1f77-4f87-4042-a773-f17064524e4c` and boot ID
`c77a65af-95bc-480d-bbe3-47f613b6b005` matched the intended AlmaLinux 10.2 guest.
Initial hosting roots, units, module and four fixture identities were absent;
SELinux was enforcing and firewalld/sshd active. No Mint service, firewall, mount,
account or resource-pressure test was changed or run.

### HTTP500: a deterministic cause, historical attribution still unknown

The unchanged normal-policy baseline passed **932/932**. Inspection followed the
HTTP dispatch, returned `executePage` failures, shared Page/event/SEWN ledger,
Session authorization and drain, JSON's process queue/exclusive lock/atomic rename,
SQLite's synchronous transactions and asynchronous file inspection, response cleanup,
and worker/provider forwarding. No storage corruption, lock race or relay defect
was demonstrated as the cause of the historical Contact/held-request failures.

The new opt-in `test-support/http-budget-probe.mjs` instead pauses at precise trusted
boundaries: JSON document `open`, SQLite database `lstat`, and a held `Page.Load`
during shared-host drain. The real adapters, HTTP transport and existing one-second
Page budget remain unchanged. Each 1,100 ms bounded pause reproduces **HTTP 500** with
exactly `page/SEWN.LIMIT` and `cleanup/SEWN.LIMIT`; a subsequent request returns 200.
The held case retains twelve sibling requests and verifies sibling service during
and after the failure. **3/3 diagnostic cases passed** means the expected failures
were reproduced, not that three formerly failing application requests were fixed.

Causal sequence: Page execution creates one wall-clock ledger; an awaited handler or
service remains subject to it; elapsed time invalidates execution (SEWN's timer may
win its Promise race while storage is still pending); cleanup uses that same expired
ledger; the structured Page error becomes 500. This is distinct from transport EOF,
stream truncation, broker relay retirement and application shutdown ownership loss.

Both storage probes additionally observed **HTTP completion before barrier release
and the submitted record visible afterward**. An already admitted storage operation
can therefore commit after this Page has returned a timeout failure. There is no
claim that a 500 means rollback or that retry is safe. No cancellation/idempotency
contract or transaction behavior was silently changed to hide this observation.

The historical uninstrumented failures remain **unattributed and not fixed**. Their
missing error code/elapsed phase cannot be reconstructed. Narrow remaining hypotheses
are the demonstrated wall-clock budget path under I/O/scheduling delay versus an
independent storage/service or lifecycle failure; future genuine incidents must be
compared with the existing bounded phase/code diagnostic. No assertions, deadlines,
retry policy, suite concurrency or application resource allowance were relaxed.

### Dedicated broker MAC: demonstrated direct boundaries and residual authority

The installed socket-activated root broker now enters
`system_u:system_r:wydhosting_broker_t:s0` with NNP. Startup independently checks its
actual domain before reading the release/approval or using a control socket on an
EL lane. An actual unconfined invocation exits 70 with only the fixed
`selinux-domain/BROKER.SELINUX_DOMAIN` startup event; there is no fallback.
Actual active broker contexts and unchanged capability/hardening fields are recorded
alongside each worker's real context.

The policy introduces typed read-only approval/uploads, protected broker state,
managed account directories and generated unit files. New unit files (including
atomic temporary files) receive the managed unit type at creation. Existing host unit
files, provider state/configuration, installed runtime code and host files are not
writable by the broker. Account tools retain narrowly typed shared passwd/group/shadow
updates; the broker is intentionally not MCS constrained because approved staging
must label several tenant categories. Only fixed `systemctl`, `useradd` and `groupadd`
executable types have in-domain execution permission. Distro Python is an entrypoint;
`bin_t` has no `execute_no_trans`. No permissive/unconfined attribute, broad
`file_type` rule, TCP/UDP permission, generic process signaling/ptrace or new capability
was added. Optional NSS userdb, terminal ioctl, account-tool syslog and nologin
executable-check denials remain denied, rather than becoming indiscriminate allows.

The broker-only RestrictSUIDSGID exception and six-capability bound remain unchanged.
The service additionally mounts `/etc/systemd` and `/etc/wydhosting` read-only while
preserving account-tool atomic updates elsewhere in `/etc`. Workers retain their
original restrictions, categories and bounded private tmpfs.

A root-reviewed canary uses the broker domain with a DAC-readable foreign file,
a same-UID root process/socket in the provider domain, writable host mounts and
AF_INET permitted by its syscall filter. Its nine attempts fail: provider-tree read,
hostname write, shell exec, generic `/usr/bin/true` exec, TCP socket creation,
SIGCONT to the same-UID foreign process, foreign Unix socket connect, host-type
relabel, and start of a foreign disposable service. Current-probe AVCs show
`permissive=0`, including `execute_no_trans`, `signal`, `connectto`, `relabelfrom`
and the manager's userspace **system/start** denial. Process/socket conclusions are
therefore independent of different UIDs, CAP_KILL absence or AF_INET filtering.
The foreign socket inode is moved/retyped by the administrator solely for this test;
no such operation is exposed to an App or the broker protocol.

**Residual TCB authority is substantial.** Shared account-database access is not a
per-account MAC rule. More seriously, the broker can write new managed unit bytes
and request their start plus manager reload. A compromised broker could potentially
turn that combination into privileged execution through systemd; denying direct
shell execution does not prove containment of that route. No escape exploit or
qualified defense against it is claimed. The current domain is an experimental
direct-access improvement, **not complete containment of a malicious root broker**.
Production needs a separately confined, root-approved service publisher/launcher:
fixed administrator-installed templates, closed independently validated parameters,
independent durable ownership, and removal of unit-write/reload authority from the
session broker. Account creation should likewise move to a separate approved
provisioner. Do not resolve this architectural gate by granting generic unit/service,
filesystem, process or unconfined-transition permissions.

### Actual integrated, hostile and resource results

The fresh installed run and expanded repetition retain separate categories:

| Evidence category | Expanded run | Scope |
| --- | --- | --- |
| Real broker/accounts/staging/DAC | **30/30** | Closed operations, kernel credentials, sealed staging, foreign files and symlink/path refusals |
| Provider/worker services | **23/23** | Two tenants, real domains, inherited FD, cgroups and authenticated private HTTP |
| Worker/provider/edge MAC | **4/4** | Actual enforcing/category checks and retained same-UID hostile cases |
| Broker MAC/category approval | **5/5** | Nine hostile canary attempts nested in one case; actual no-fallback startup; category change, partial reservation adoption and incorrect UID refusals |
| Durable broker ownership | **2/2** | Conflicting unit hash and invocation refused by actual status; original bytes restored in finally |
| Loopback TLS proxy | **11/11** | Confined Caddy to provider to two tenants; no external network inference |
| Service recovery | **15/15** | Real SIGKILL/OOM/provider restart and stale ownership refusal |
| Retirement overlaps | **12/12** | Existing four concurrent replacements/retirements and successful audit completion; no new automatic deletion |
| Integrated resource probes | **5/5** | OOM; simultaneous private tmpfs ENOSPC; FD EMFILE; task EAGAIN; measured CPU throttling |

Resource injection is explicitly a trusted native administrator helper, not newly
exposed App code. Helpers join only the verified recorded guest worker cgroup and
are additionally bounded: 64 MiB address space, two CPU seconds, ten-second parent
deadline, 128 descriptors, at most forty forks; worker cgroup remains 256 MiB,
32 tasks and 25% CPU. EMFILE occurred after 125 extra opens; task pressure reached
EAGAIN with twenty children in the reviewed run. CPU counters prove throttling.
Both tenant 1 MiB tmpfs mounts were independently verified before writing and held
full together, then exact files were unlinked and original free-block counts restored.
The FD helper explicitly applies the main worker's verified 128-FD ceiling; it is not
a test of an ordinary App FD API or every native library under pressure.
Sibling HTTP and post-pressure recovery remained 200. Existing OOM limits are retained
separately. No host exhaustion, persistent storage quota or unbounded stress occurred.

Initial policy runs are retained, including fail-closed socket creation/interpreter
entry, read-only platform/label-database access, typed staging parent, systemd private
socket, new-type sandbox mountpoint and authenticated ingress socket denials. Only
necessary corresponding operations were permitted. One canary initially asserted a
process context before Type=exec completed; correcting that fixture race and using
same-UID controls did not relax the policy. Runs 10, 11 and 12 passed their respective
expanded matrices; earlier failures are not replaced with those successful totals.

An independent package campaign retained **148/149** canonical passes with an existing
`FILES.TIMEOUT` in `bounded transfer timeout and operation limits`. Its unchanged full
installed Files file then passed **33/33**. This is separate from Contact/held HTTP500;
no deadline, retry or assertion was changed. Final independent and required repository
results are retained in the campaign evidence; a passing repetition does not explain
the earlier timeout.

Final independent consumers in `/tmp/wyd-i54-packed-RSqrVO` passed canonical
**149/149**, provider **35/35**, real subprocess supervisor **20/20** and ordinary
Linux boundaries **20/20**, with one installed engine per consumer and repository
imports rejected. The three bounded HTTP probes also reproduced against that
installed five-library consumer. The first installed held probe used the wrong
TMPDIR and failed HOST.STARTUP before HTTP; using the same consumer-local fixture
TMPDIR as the canonical runner passed **3/3** without runtime changes. Ordinary guest
Python boundaries passed **36/36** from the packed broker; mocked firewall guards
passed **6/6** separately. Normal-policy repository checks passed **932/932** and
content validation **3 pages / 42 links**; required checks are repeated after this
final evidence sync. Normal broker/SELinux/unit bytes match both the reviewed
independent consumer and the final VM artifact. Final VM categories matched the
table above, with current-probe PID/interval AVC assertions.

Independent cleanup verified no fixture units/unit files, processes, four fixture
users/groups, hosting roots or policy module. Three staged build trees were verified
against pinned manifests and only the two exact newly owned staging roots were
removed. The first cleanup inspection stopped at systemctl's empty no-match exit 1
before deletion; corrected only that result handling, retaining strict empty-output
and ownership/hash checks. SELinux remains Enforcing, firewalld/sshd active; runtime
public zone remains enp1s0 with cockpit/dhcpv6-client/ssh, no extra ports/rich rules.
Only SSH/22 listens on IPv4/IPv6 TCP; existing loopback chronyd UDP remains. A fresh
nonmultiplexed SSH connection succeeded and boot ID is unchanged. Normal audit
suppression was restored. Account-tool standard backup/lock side effects and existing
journal/audit records remain under guest retention, as in earlier campaigns.

### Recovery gate and reproduction

Read-only inspection of the operator-supplied **Mint-host** backup
`/mnt/data/VM-Backups/almond-lab/baseline-0.1/` found parseable matching-UUID VM XML,
a standalone 40 GiB virtual qcow2 disk (42,956,488,704-byte file), and 540,672-byte
UEFI NVRAM. `qemu-img check` reported zero check errors and no repair was requested.
Fresh SHA-256 digests of all three are retained. A read-only hypervisor screenshot
also confirms display access (kernel policy-unload messages were visible), with no
console input or login. This establishes readability/current
structural disk integrity, not authentication against an earlier trusted digest or
proof that XML/disk/NVRAM were captured at one stopped checkpoint. An independent
console login/recovery path is still unverified. **No guest or host reboot occurred.**
External firewalld and disposable-filesystem quota proposals remain approval-gated;
see [firewall/recovery](firewall-and-recovery.md).

```sh
node --test test-support/http-budget-probe.mjs
npm test
npm run check
node scripts/verify-packed-packages.js
# Fresh ordinary-user tarball build, reusing the previously verified Caddy asset:
node test-support/linux/prepare-qualification.mjs /tmp/wyd-i56-new-build \
  /tmp/artifacts/wydgine-0.3.0-alpha.15.tgz /tmp/artifacts/wydhosting-0.3.0-alpha.15.tgz \
  /path/to/reviewed/caddy
# Transfer build and existing qualify*.py/qualification-registry.mjs into a new
# exclusively owned guest staging root; protect it as root, then on almond-lab:
sudo -n timeout 420s python3 -B /var/tmp/wyd-i56-new/qualify.py \
  --target=almond-lab /var/tmp/wyd-i56-new/build --integrated
```

Evidence: `test-support/linux/evidence/2026-10-16-broker-mac.json`; raw campaign logs
use `/tmp/wydgit-i56-rootcause-*`. Fresh candidate build/manifest and failed runs
remain retained. Fixture cleanup stops only owned units, checks stopped services,
removes only exclusively created trees/accounts/module and leaves audit/journal
retention untouched. No wildcard deletion, category recycling or cleanup based on
guessed generation names was added.

**Implementation complete: NO. Production security qualified: NO.** Remaining gates
include historical HTTP500 attribution and timeout/write completion semantics;
indirect broker manager/account authority; interrupted staging/publication/reconciliation
and durable cleanup recovery; automatic exact-resource retirement; reservation exhaustion;
persistent quotas; approved external packet paths; independently verified console and
backup consistency plus reboot. No I5.7, version bump, publication, release or inference
about RHEL/Rocky/Oracle/other distributions.

## Reliability and confinement continuation — 2026-10-16

Started clean at **852ee722bfefd3aa0b3f250d1c0603de22e21a25**, equal to
`origin/develop/0.3`; no intervening work was discarded. Version remains
**0.3.0-alpha.15**. Read the complete verification/SELinux records, architecture,
security contracts, actual implementation and retained failure logs before changes.
The same AlmaLinux **10.2**, kernel **6.12.0-211.65.1.el10_2.x86_64**, systemd
**257-23.el10_2.2.alma.1**, Node **24.21.0**, Python **3.12.15**, Caddy **2.11.7**
guest was verified. Previous hosting roots, policy modules, units and all six fixture
UID/GIDs were absent. Enforcing SELinux, active/enabled firewalld and SSH were verified.

### Demonstrated defects and corrections

**Relay retirement:** four bounded overlaps kill both actual worker main processes
while stopping their installed provider, then start fresh provider lifetimes and
verify both canonical App routes. The first expanded run reported 95 passing checks,
but independent broker journal inspection found three **BROKER.INTERNAL / relay / os**
events. Those passing assertions were insufficient. The fixture now requires each
exact broker session's completed administrative event as well as stopped leases and
empty cgroups. A pre-fix repetition failed **2/12 retirement checks**; its closed
`failureOs:reset` diagnostic identified **ECONNRESET**. A real socket-pair test also
failed with ConnectionResetError when a peer closed with unread reply data.

The relay now handles only connection reset/broken pipe as peer disconnects, just
like EOF. It still validates worker frames and runs the unchanged exact-service
retirement/final acknowledgement path; no retry, restart, ownership adoption or
successful cgroup-death claim follows merely from disconnect. Other OS faults and
malformed/forged frames still fail. Post-fix VM overlaps require successful broker
audit completion and pass. This fixes the **reproduced reset class**, not proof that
every earlier uninstrumented BROKER.INTERNAL had the same cause.

**Process observation race:** an actual child exit between a simulated active manager
snapshot and the real `/proc/<pid>/stat` read deterministically produced uncaught
FileNotFoundError. The broker now takes one fresh protected-unit snapshot only for
that disappearance, requiring terminal state, MainPID=0 and an empty recorded cgroup.
It revalidates unit bytes/path/drop-ins. Live invocation/cgroup/PID/start-time checks
remain; ambiguous, replaced or still-populated states refuse. This is a separately
demonstrated defect; the old campaign did not record enough detail to attribute it.
The fixture explicitly labels its manager snapshots as simulated, not privileged proof.

**Ineffective temporary-byte limit:** the actual integrated worker's `/tmp` was XFS,
not the advertised bounded tmpfs. The new stress guard refused to write and recorded
**96 passed / 1 failed**. Four read-only transient probes preserved the cause:
PrivateTmp=yes → host-backed XFS; no → 1 MiB tmpfs; `disconnected` was rejected by
this distribution's transient-property parser; yes again → XFS. This corroborates the
[systemd v257 mount implementation](https://github.com/systemd/systemd/blob/v257/src/core/namespace.c).
No unbounded filesystem was deliberately filled.

The worker uses `PrivateTmp=no` with its explicit per-unit, UID-owned **0700** tmpfs,
`nosuid,nodev,noexec,size=<approved temporaryBytes>`. `/var/tmp` stays inaccessible.
This corrects the conflicting mechanism while preserving private temporary storage;
NNP, RestrictSUIDSGID=yes, empty capabilities, namespace/network restrictions and
cgroups remain. Actual mount tables/statfs now prove separate 1 MiB tmpfs instances
for both workers. An administrator helper fills only A's held private mount to
**ENOSPC at 1,048,576 bytes**, with 64 MiB address space, 2 CPU seconds, 32 FDs,
10-second deadline and no spawned descendants. A/B still serve HTTP 200, B's mount
and capacity stay unchanged, and unlink restores A's free blocks. This proves the
actual mount capacity and cleanup, **not confined library tmp-file access**. Persistent
XFS storage remains `noquota`; FD/task/CPU exhaustion inside the integrated App and
runtime-directory/persistent-storage exhaustion are still separate gaps.

### MAC and ingress observations

The reproducibly installed `wydhosting_worker` CIL module now also defines
**wydhosting_edge_t:s0** and dedicated edge executable/configuration/state types.
The actual installed Caddy service enters it explicitly, validates shipped generated
configuration and serves both tenants over loopback IPv4/IPv6 TLS. Its only capability
is NET_BIND_SERVICE; it has 128 MiB memory/no swap, 32 tasks, 256 FDs and 25% CPU in
the bounded fixture. Legitimate creation of directories inside its own typed state
was added after the first confined run's Caddy log denied that operation. Explicit Go
runtime bounds avoid relying on denied cgroup auto-detection. A valid world-readable
config with tenant-data type succeeds outside confinement but fails in edge_t, with
an actual **edge_t → data_t:c52 read AVC, permissive=0**. No tenant-data read permission
was granted. See [selinux.md](selinux.md) for privileges and residual TCB.

The same UID 61051 is used for both hostile probe subjects. Same-category file
read/write, runtime-binary execution and SIGCONT succeed. Foreign-category file
read/write, Unix socket inode write, SIGCONT, proc-directory traversal and runtime
execution return EACCES, with current-probe AVC assertions. Relabel is also denied,
but workers have no relabel permission even within their category: that is TE, not
independent category proof. Proc inspection is denied at MAC directory traversal
before ptrace. Socket testing proves the categorized **sock_file boundary**; it does
not claim abstract-socket/connectto category qualification. The canary makes DAC
allow access and independently connects to the socket outside confinement. No raw
execution/socket/process capability is exposed to ordinary Wydgits.

An initial expanded signal-0 canary failed before writing its result; the exact
failing operation was not retained. The revised probe records bounded progress and
uses the already permitted SIGCONT with a successful own-category control. The
initial failure is retained rather than retrospectively diagnosed. Audit suppression is restored in
finally even if diagnostic collection fails; enforcing never changes.

The root broker remains **unconfined_service_t**. Its account tools modify shared
account databases and it controls systemd; a narrow policy/possibly privilege split
still needs design and actual qualification. No blanket filesystem/process allow or
unconfined transition was added to conceal this gate. A confined root broker would
still be a high-trust component; the six retained capabilities are unchanged.

### Reliability coverage and deferred authority

The unchanged baseline plus three normal-policy full repetitions each passed
**932/932**. Focused Contact JSON/SQLite concurrency/restart/cleanup and shared-host
held-request tests passed **14/14** together. Trusted phase/code capture stayed on.
The historical Contact/Guestbook/Taskboard HTTP500 **remains unresolved**: no new
failing request was captured, no application/storage fix is claimed, and no timeout,
resource allowance, assertion or normal suite concurrency was relaxed.

External TLS remains unexecuted. Read-only libvirt inspection confirms a NAT network,
host bridge **192.168.122.1**, guest **192.168.122.225**, no configured IPv6 subnet;
the guest has only link-local IPv6 beyond loopback. Its active/default public zone
has no HTTPS port/rich rule. No host interface/routing/firewall or guest active/public/
SSH rule was changed. The exact proposed narrow IPv4 test rule and rollback plan,
requiring separate operator approval, are in [firewall-and-recovery](firewall-and-recovery.md).
Loopback TLS is not external evidence. Public apply still refuses.

Reboot remains unexecuted. Read-only metadata confirms live disk
`/var/lib/libvirt/images/almond-lab.qcow2`, UEFI vars
`/var/lib/libvirt/qemu/nvram/almond-lab_VARS.fd`, serial `/dev/pts/2` and loopback SPICE
`spice://127.0.0.1:5900`. These are **live component references, not a verified backup**.
The backup location/readability/digests and disk/XML/NVRAM consistency are unknown;
serial getty is disabled and independent console login credentials are unverified.
SSH key and noninteractive guest sudo work, but do not substitute for console recovery.
No backup or host power state was changed. Operator recovery information is needed
before reboot qualification.

Stopped/failed generation units, lease/category markers, snapshots and accounts remain
retained until exact owned fixture cleanup. Repeated lifetimes demonstrate that these
can accumulate; automatic authenticated retirement is **not implemented**. Deleting
unit fragments would break the current lease ownership/status proof without a durable
retirement/tombstone design. Do not replace that proof with filename-based cleanup or
recycle categories. Interrupted staging/publication/cleanup, mount substitution,
category crash recovery and quota-backed storage remain open gates.

### Reproduction, evidence and decision

Use the earlier unprivileged fresh-tarball builder and **the same extended**
`qualify.py --integrated` fixture, with a fresh protected VM staging root and
`sudo -n timeout 420s ...`. The fixture automatically runs four retirement overlaps,
current-probe AVC checks, the confined edge and bounded actual-mount exhaustion.
It refuses a non-tmpfs or mount larger than 8 MiB before any stress write. No competing
installation harness or root npm was added. Source/artifact hashes, failed diagnostic
runs, final events and regression results are retained in
`test-support/linux/evidence/2026-10-16-continuation.json`; raw logs are
`/tmp/wydgit-i56-continued-*`. Earlier evidence files remain unchanged.

The reviewed actual VM run has separate results (not a security score): broker/DAC
**30/30**, installed integrated services **23/23**, SELinux gate/domain/MAC **4/4**
(two AVC-backed hostile probe cases plus enforcing/domain checks), loopback TLS
**11/11**, service recovery **15/15**, retirement race/restart/audit **12/12**, and
integrated resource outcomes **2/2** (OOM and private-mount ENOSPC). Final required
repository/independently packed/VM regression and cleanup results are recorded in
the durable evidence after review; no older count is substituted for a new run.

Final freshly packed VM delivery repeated those separate results successfully.
Fresh independent consumers in `/tmp/wyd-i54-packed-gbGHvN` passed canonical
**149/149**, provider **35/35**, real subprocess supervisor **20/20** and ordinary
installed Linux boundaries **20/20**, with repository imports rejected and one engine
per consumer. The actual packed Python boundary suite also passed **35/35** as the
ordinary VM user, including its explicitly simulated administrative cases; mocked
firewall guards passed **6/6** separately. These nested counts are not extra Node or
privileged tests. The separate kernel fixture repeated **26/26**; unused-zone
firewalld normal rollback and **3/3** independent caller-death checks passed with
runtime/permanent policy restored, without active packet-enforcement proof.
The reviewed required repository run passed **932/932**, and content validation
passed **3 pages / 42 links**. Final checks are repeated after this evidence sync.
Nine workspace package dry-runs contain the policy/guides and no keys/Python caches;
all 23 historical browser distribution blobs remain unchanged. No dependency change.

Independent final cleanup found no fixture units/unit files, tenant/provider/edge/
kernel users or groups, processes under the six fixture UIDs, hosting/kernel roots,
policy module or firewall intent/timer resources. Both campaign staging roots,
`/var/tmp/wyd-i56-continued` and `/var/tmp/wyd-i56-continued-final`, were verified
against known archives/manifests and their exclusive creation/ownership inventory,
then removed. Standard account-tool DB backup/lock side effects and existing journal/
audit records remain under VM retention; the baseline VM backup was untouched.
Normal dontaudit was restored, SELinux enforcing, firewalld/sshd active, public/SSH
policy unchanged, and only SSH/22 listening on IPv4/IPv6. A fresh nonmultiplexed
SSH connection succeeded. Boot ID remains `c77a65af-95bc-480d-bbe3-47f613b6b005`.

**Implementation complete: NO. Production security qualified: NO. I5.6 remains
experimental.** Broker MAC, the intermittent HTTP500, external ingress/live firewall,
verified backup/console and reboot, bounded persistent storage, automatic retirement
and the remaining hostile interruption/resource matrix still prevent qualification.
Only the exact AlmaLinux observations above are tested; no RHEL, Rocky, Oracle,
Debian or Ubuntu certification is inferred. No version bump, release or I5.7 work.

## Integrated Enterprise campaign — 2026-10-16

Started clean on **develop/0.3**, HEAD and remote both
**d08eda8897f0e26111e570a68e26434cfb56eb35**, version **0.3.0-alpha.15**.
No unrelated local changes existed. No version/dependency/protocol change is made:
this continues the experimental alpha.15 milestone rather than completing it.

Guest identity: `almond-lab`, libvirt UUID
`a70c1f77-4f87-4042-a773-f17064524e4c`, disk
`/var/lib/libvirt/images/almond-lab.qcow2`, 4 vCPUs / 8 GiB, AlmaLinux **10.2**,
kernel **6.12.0-211.65.1.el10_2.x86_64**, systemd **257**, Python **3.12.15**.
SELinux was enforcing; firewalld and SSH were active. No hosting installation,
test account or unit was assumed to survive the previous campaign. The VM lacked
Node, Caddy, OpenSSL CLI, auditctl, SELinux development tooling and filesystem quotas.
XFS remained mounted `noquota`. Installed Node is the independently prepared
**24.21.0** binary; no root npm or VM system-package installation was performed.

Read-only hypervisor inspection found console endpoint `/dev/pts/2`, but console
login/recovery and the baseline backup's location/integrity could not be independently
verified. Backup details were requested while independent work continued. No backup
was opened for writing, and **no reboot/power/storage interruption was attempted**.
The Mint host received no privileged service/network/account/policy mutation.

### Newly implemented and actually exercised

The existing `qualify.py` fixture now has `--integrated`; it retains the existing
account, staging, caller/operation/JSON and cross-UID attacks, then constructs the
**real canonical registry journal**, uses `createLinuxPlan` to derive its actual
digest/approval, and starts the **installed provider service**. Independent canonical
App IDs/titles identify tenants A/B; this is the Wydgine sample App, not a synthetic
socket responder. There are no mocked broker, service, HTTP or credential operations.

The path exercised is provider service → authenticated root broker → restricted
61051/61052 tenant → sealed categorized deployment → systemd-managed Python/Node
worker → private credential-checked Unix socket → provider ingress → separate-UID
Caddy → real TLS HTTP. UID 61050 is the provider; 61053 is the edge. Worker accounts
remain locked/nologin with restricted group membership. Effective capabilities,
NNP, RestrictSUIDSGID and other established restrictions are inspected unchanged.
FD 3 is a live socket after exec; both workers had 20 open descriptors and no leaked
regular files. Configured memory/swap/tasks/CPU limits are read from actual cgroups.

The packaged experimental `wydhosting_worker` CIL module confines the provider to
`wydhosting_provider_t:s0` and workers to `wydhosting_worker_t:s0:c51` / `s0:c52`.
Execution/data/runtime labels are applied through broker-held descriptors and pinned
to root-approved, nonrecyclable category/account ownership records. Enforcing systems
refuse a legacy launch without a category; provider startup verifies its domain and
enforcing mode. Full design, exact contexts, labels, residual privileges, installation
commands and category threat-model reasoning are in [selinux.md](selinux.md).

The same-UID canary deliberately permits DAC access to both files. Under the real
confined worker domain, same-category reads/writes succeed and foreign-category
read/write/relabel attempts return **EACCES**. Actual AVCs record c51 → c52 with
`permissive=0`. This establishes independent MAC for the tested file boundary;
cross-category socket/process/load and broader canonical-service closures remain
unqualified. Broker and edge are still `unconfined_service_t`, explicitly **not a
complete production MAC qualification**.

Caddy **2.11.7** was downloaded from the [official release](https://github.com/caddyserver/caddy/releases/tag/v2.11.7) and verified against its
GitHub SHA-256 asset digest and the release's SHA-512 checksum list. Archive SHA-256:
`727b91701a392de6ebc5027509f548bf39979e5216340d0faed8fa5e69c84f8b`.
Ephemeral self-signed certificates are generated unprivileged in the build and
verified by the TLS client. The generated shipped template validates and serves
both tenants over **127.0.0.1 and ::1 only**; admin API and redirect listeners are
disabled. Header spoofing is stripped/overwritten, unknown authorities receive 421,
and status/HEAD/method/body and proxy restart checks are separate cases. Worker TCP
listeners are checked absent. **These are loopback tests, not external IPv4/IPv6
vantage or public packet enforcement.** No interface/default-zone/SSH change occurred.

Real worker SIGKILL and cgroup-contained OOM produce a fresh authorized replacement
while the sibling canonical App continues serving. The root-owned hostile memory
helper joins only the recorded 256 MiB worker cgroup; its independent address-space
ceiling is 512 MiB, allocation ceiling 384 MiB, CPU ceiling 3 seconds and wall deadline
15 seconds. It adds no App capability. The real service reports `oom-kill`.
Graceful provider restart reuses stopped durable leases; daemon reload preserves
routing. Broker SIGKILL independently reaps its confined worker, refuses the stale
route, preserves the sibling and permits explicit exact-lease reconciliation.
Provider SIGKILL independently terminates both cgroups; restart refuses stale
supervisor ownership rather than adopting/resurrecting workers.

### Intermediate failures and unresolved observations

- The first registry fixture used a deployment ID inconsistent with its source
  basename; corrected the fixture to create unique canonical deployment IDs.
- Transferred Node retained `user_tmp_t`; systemd correctly refused it with
  `203/EXEC`. Installation now restores guest path labels before execution.
- Initial policy iterations correctly failed on new-type manager mountpoints,
  NNP domain transitions, OpenSSL configuration reads, broker socket labels and
  provider runtime cleanup. Only corresponding typed requirements were added;
  no permissive domain, system write, worker capability or network allowance was used.
- An automatic approval review rejected an experimental automatic transition to
  `unconfined_service_t`. That command did not execute. The safer implementation
  removes that transition and explicitly confines provider and workers.
- The first diagnostic attempt found auditctl absent; no audit rule was installed.
  The canary instead briefly exposes suppressed AVCs with `semodule -DB`, restoring
  normal logging with `-B` immediately. Access enforcement is unchanged throughout.
- Missing guest OpenSSL and a hard-coded `/usr/bin/ss` were fixture assumptions;
  certificates now come from the unprivileged builder and `ss` is discovered.
- Caddy returned an empty **HTTP 200** for unknown Host. The shipped configuration
  now has an explicit 421 reject site. The real proxy test verifies the correction.
- One expanded stress run passed SIGKILL/OOM replacement and sibling survival, then
  a sibling broker returned **BROKER.INTERNAL during graceful shutdown**; provider
  cleanup/restart refused ownership. The next unchanged-path run passed. Its root
  cause is **unresolved**, not declared fixed by a passing repetition. New broker
  diagnostics retain a closed failure-kind/phase vocabulary without exception text,
  paths, payloads or credentials. This is an additional reliability qualification gap.
- One installed-package run passed **147/148** canonical tests: an unchanged S3
  deadline fixture expected two calls but observed one under load. The full focused
  file passed afterward. No deadline, assertion, retry or concurrency policy changed.
  Preserve both logs; this is distinct from the historical Contact HTTP500 class.

The historical Contact/Guestbook/Taskboard HTTP500 remains **undiagnosed**. Five
bounded ordinary-user repetitions of the unchanged JSON/SQLite Contact concurrency/
restart suite passed **4/4 each**. A later full run reproduced JSON Contact POST
**500 instead of 200**, the shared held-request **500 instead of 200**, and the S3
call-count failure: **928/931**. These are retained as real failures, not dismissed
because independent runs passed. Inspection found that `executePage` returned
structured Page/cleanup errors which the HTTP pipeline silently discarded. The
trusted logger now receives at most two bounded phase/code events per request;
exception messages/details, request bodies, cookies, paths and credentials are
excluded. The Contact/held-request assertions retain up to eight such events for a
future failure. A real HTTP regression verifies 500 semantics and private-data
redaction. No time/resource budget or assertion was weakened.

The next normal full run passed **932/932**, including that added diagnostic test.
This does not establish a root cause or a fix for the intermittent 500. Worker
embedding still uses its existing silent logger unless a trusted logger is supplied;
per-App diagnostic forwarding over the worker protocol is not added here. MAC,
ingress, OOM/generation and broker-retirement observations remain separate boundaries.

### Qualification decision and gates still open

**Implementation complete: NO. Tested on AlmaLinux 10.2: the specific observations
above. Production security qualified: NO. I5.6 remains experimental.** No other
distribution is qualified and no I5.7 work is started.

Remaining gates include dedicated broker/edge MAC; cross-category socket/process
adversarial tests; actual external IPv4/IPv6 ingress/bypass tests; controlled live
production firewall integration/reconciliation; FD/tmp exhaustion and disk quotas;
interrupted staging/publication/cleanup and mount attacks; independently verified
backup/console plus reboot; automatic resource retirement; the intermittent broker
retirement failure and historical App HTTP500. Public firewall apply still fails
closed. The existing unused-zone probe is not upgraded into production enforcement.

No current/default/public zone or SSH rule was changed. No rule requiring separate
public-policy authorization was attempted. Reboot remains deferred until backup and
console recovery can be verified. Do not relabel a localhost check as external proof.

### Reproduction and disposable changes

Use fresh tarballs and an ordinary-user builder (verify the Caddy binary against
official release metadata/checksums before supplying it):

```sh
npm pack --workspace wydgine --workspace wydhosting --pack-destination /tmp/NEW-TARBALLS
node test-support/linux/prepare-qualification.mjs /tmp/NEW-BUILD /tmp/NEW-TARBALLS/wydgine-0.3.0-alpha.15.tgz /tmp/NEW-TARBALLS/wydhosting-0.3.0-alpha.15.tgz /path/to/verified/caddy
```

Transfer the build archive and `qualify.py`, `qualify-integrated.py`,
`qualification-registry.mjs` to a new protected VM staging directory. After root
ownership/mode review, extract the build and run only on the intended guest:

```sh
ssh almond-lab 'sudo -n timeout 300s python3 -B /var/tmp/NEW-STAGING/qualify.py --target=almond-lab /var/tmp/NEW-STAGING/build --integrated'
```

The fixture extends the original exclusive-installation guards and owns only new
`/opt/wydhosting`, `/etc/wydhosting`, `/var/lib/wydhosting`, `/run/wydhosting`, exact
generated units, the 61050–61053 disposable identities, the category module and
category canaries. It tracks worker unit names immediately on startup, including
later-failure paths. Two units left by an earlier fixture exception were independently
verified stopped/cgroup-absent and removed by exact recorded names; no wildcard
process/account deletion was used. The root memory helper is tracked and reaped.

All generated service/account/runtime/module resources are removed after each run;
the transfer/build directories are removed after final evidence collection. Standard
account-tool DB backup/lock side effects, audit and systemd journals remain retained
under the guest's existing policies. The baseline VM backup is never modified.
Sanitized campaign events and exact per-category results are retained under
`test-support/linux/evidence/2026-10-16-integrated.json`; raw logs use
`/tmp/wydgit-i56-integrated-*`. Final validation/cleanup results follow below.

### Final evidence by category

The reviewed freshly packed VM run and its predecessor both passed. The fixture's
82 total is only a runner summary, **not a combined security-qualification score**.
Its separate final categories are:

| Actual check category | Passing checks | Scope |
| --- | --- | --- |
| Privileged broker/accounts/staging/DAC | 30/30 | Actual installed broker operations, two identities and hostile selectors/filesystem access |
| Integrated installed services | 23/23 | Canonical registry/provider, confined identities, real responses, limits, FD inheritance, no worker TCP listener, edge-to-worker bypass denial |
| Real SELinux MAC | 2/2 | Enforcing legacy-launch refusal; same-UID categorized file canary with three denied operations and actual AVCs |
| Actual Caddy TLS proxy | 11/11 | VM loopback IPv4/IPv6, generated shipped config, routing, headers, explicit unknown-Host 421, method/body/status, retirement/restart |
| Service recovery and guards | 15/15 | Worker SIGKILL/OOM replacement, sibling survival, reload, graceful restart, broker/provider death, reconciliation and stale-lock refusal; includes final enforcing guard |
| Integrated resource outcome | 1/1 | Actual worker unit `oom-kill`, with independently bounded injected helper |
| Separate privileged kernel fixture | 26/26 | Existing bounded hostile kernel/resource campaign, separately repeated; not a confined production-App stress count |
| Limited firewalld recovery | Normal transaction + 3/3 caller-death checks | Exact inactive-zone rule rolled back; runtime/permanent policy restored; active packet enforcement not tested |
| External network / reboot | 0 executed | No external-vantage or reboot qualification inferred |

Ordinary-user regression/contract evidence remains separate:

| Check | Actual result |
| --- | --- |
| Complete normal repository suite with diagnostic addition | 932/932 passed, no failures/skips/cancellations in the successful run |
| Focused HTTP diagnostic/hostname/Linux suites | 34/34 passed |
| `npm run check` | 3 pages / 42 internal links / unique anchors passed |
| Fresh independent canonical-library consumer | 149/149 passed, repository imports refused |
| Fresh independent provider consumer | 35/35 passed |
| Installed real subprocess supervisor | 20/20 passed |
| Installed ordinary-user Linux boundaries | 20/20 passed; Python 33 cases and 6 mocked firewall guards are nested inside these fixtures |
| Ordinary VM user, actual packed Python boundary suite | 33/33 passed, no skips; explicitly mocked administrative cases remain labelled |
| Ordinary VM user, mocked firewall guard suite | 6/6 passed; no live firewall authority proved |
| Focused unchanged Files suite after timing failure | 33/33 passed |
| Historical browser distributions | All 23 tracked blobs byte-identical to starting commit |

Final independent consumer evidence is `/tmp/wyd-i54-packed-ev3jaz`. All three
consumers, including service-free CLI/HTTP, passed. A documentation-mirror assertion
also caught an intermediate documentation edit before its package mirror had been
resynchronized; final sync and required checks follow the completed edits. Browser/
client source and historical bundles are unchanged; no separate actual-browser
campaign was repeated. Versions and lockfiles remain alpha.15 with no dependency
change. No package publication, release, deployment or I5.7 advancement occurred.

Final VM cleanup independently proved absent test units, PIDs under all six disposable
UIDs, accounts/groups, hosting/kernel roots and the `wydhosting_worker` module. Every
transferred file was matched against its known hash or protected campaign source
before deletion, then `/var/tmp/wyd-i56-integrated` was removed. Normal dontaudit
logging was restored. SELinux remained **Enforcing**, firewalld/sshd **active**, with
default/active `public` on `enp1s0`. Only SSH TCP/22 remained listening on IPv4/IPv6.
A fresh nonmultiplexed SSH connection succeeded after cleanup. Boot ID stayed
`c77a65af-95bc-480d-bbe3-47f613b6b005`; no guest or host reboot occurred. The backup
was untouched. Logs retain original failures, passing repetitions and cleanup events;
the last required checks are rerun after final documentation synchronization.

## Actual environment

Linux Mint 22.2 x86_64, kernel **7.0.0-38-generic**, Node **v24.21.0**, npm
**11.19.0**, Python **3.12.3**, cc **13.3.0**, Chrome **155.0.8059.79**;
current test UID/GID **1000:1000**, supplementary groups **1000,65534**.
PID1 on the execution surface reported `codex`, not a disposable systemd VM. Docker
socket access denied; no usable QEMU/libvirt/KVM VM facility detected. No attempt to
change those permissions, launch a host daemon or treat the operator's host as a VM.
Exact cgroup observation and supported candidate distinctions are in the support matrix.

### AlmaLinux follow-up — 2026-10-16

An operator-provided AlmaLinux 10.2 KVM guest `almond-lab` is now reachable. The actual
updated broker platform guard passed there, as did all 28 unprivileged Python boundary
tests (including explicitly mocked administrative/platform cases). Temporary sudo
access was verified only with `id -u`; no privileged hosting attack test has run.
Exact guest properties and outstanding prerequisites are in the support matrix.
The shared candidate policy adds explicit AlmaLinux 10.x/RHEL 10.x identities and
requires enforcing SELinux for both. Node preflight now also checks architecture and
all required cgroup controllers. No firewalld transaction or SELinux policy is added.
The 929-test and package/browser counts below describe the original alpha.15 delivery;
follow-up validation is recorded separately and does not qualify the privileged gates.

Follow-up validation passed: **930/930** repository tests, `npm run check` (3 pages,
42 links), and three independently installed tarball consumers with repository imports
refused. Installed regressions passed **148** five-library cases, **35** provider
cases, **20** real subprocess supervisor cases and **19** Linux boundary cases
(the latter includes the 28 Python cases). The shared matrix ships in the actual
WydHosting tarball and is used by its installed Python/Node checks. Evidence for
this run is `/tmp/wyd-i54-packed-yYMM6d`; local/VM primitive logs are
`/tmp/wydgit-el10-test.log` and `/tmp/wydgit-almond-lab-primitives.log`.
Browser/client suites were not rerun for this follow-up; no browser/client source or
distribution changed. Versions remain alpha.15; this adds candidate platform policy
without changing worker/broker protocol or canonical library/client version axes.

## Authorized broker hardening follow-up — 2026-10-16

Started clean at **d2713754893dc56aafd3a79c492422f6a1427ca4** on `develop/0.3`.
The operator explicitly authorized a **conditional broker-only** RestrictSUIDSGID
adjustment, contingent on a causal reproduction, preserving worker restrictions,
SELinux enforcing and every other hardening control. The inspected proposal changes
only `templates/wydhosting-broker@.service`: one directive removed and explanatory
comments added. No additional hardening change was made. This section supersedes
the earlier startup-blocked status; earlier failures remain preserved below.

### Root cause confirmed before changing the broker

`test-support/linux/verify-openat2-systemd.py` executed **4/4** actual VM checks:
an unsandboxed prerequisite followed by otherwise identical broker-sandbox services
with the directive **on, off, on again**. It uses the same read-only openat2 flags,
zero mode and NO_XDEV/NO_SYMLINKS/BENEATH resolution as the broker. A legacy openat
read acts as the control. Execution/stdin/stdout and disposable write paths were
adapted consistently for this standalone probe; all security directives stayed
constant across the three services except the one variable under test.

| Real guest test | openat | openat2 | NNP / seccomp / effective capabilities |
| --- | --- | --- | --- |
| Ordinary root prerequisite, no service sandbox | success | success | baseline only |
| Full broker sandbox, RestrictSUIDSGID=yes | success | **ENOSYS (38)** | 1 / 2 / `000000002000004b` |
| Same sandbox, RestrictSUIDSGID=no | success | **success** | 1 / 2 / `000000002000004b` |
| Same sandbox, RestrictSUIDSGID=yes restored | success | **ENOSYS (38)** | 1 / 2 / `000000002000004b` |

Effective capability bounds, ProtectSystem=strict, ProtectControlGroups=yes,
RestrictNamespaces=yes, NoNewPrivileges=yes and SELinux service context were
identical. Seccomp remained active with the directive off. All three fixture units
and both fixture roots were removed. This reversal establishes causation rather
than merely observing a successful broker after removing a setting.

Systemd **v257** corroborates the observation: `seccomp_restrict_suid_sgid()` calls
`seccomp_restrict_sxid()`, which explicitly adds a blanket openat2 denial returning
ENOSYS because seccomp cannot inspect its indirect flags/mode structure. See the
[pinned v257 implementation](https://github.com/systemd/systemd/blob/v257/src/shared/seccomp-util.c#L2165-L2176).
This is the directive's implicit filter, not a separately configured SystemCallFilter
or an old guest kernel. Keeping that filter and adding a syscall allow entry cannot
override a denial in a stacked seccomp filter. A fallback to legacy path operations
would lose the required mount/symlink protections; a new privileged helper would
expand architecture and scope. Neither alternative was introduced.

### Authorized change and residual risk

Only the trusted root broker omits RestrictSUIDSGID. Its capability bound remains
exactly CHOWN, DAC_OVERRIDE, FOWNER, SETUID, SETGID and AUDIT_WRITE; no capabilities
were added. NoNewPrivileges, system write boundaries, namespace/address-family/
resource restrictions and SELinux mode are unchanged. **Actual production worker
services still report RestrictSUIDSGID=yes**, empty capabilities and NNP=1.

This is a real hardening tradeoff: the broker loses the extra filter against marking
files SUID/SGID. NoNewPrivileges prevents its own descendants acquiring privileges
through such executables, but is not an equivalent ban on creating those mode bits
for other processes. The fixed trusted broker only performs closed, root-approved
operations and uses reviewed modes; no publisher path, executable, shell, generic
chmod or arbitrary administrative command was added. Root compromise/MAC confinement
remain independent concerns. The adjustment does not certify the broker as production
safe; it restores its mandatory openat2 enforcement without weakening tenant workers.

### Additional real launcher defect fixed without relaxing restrictions

The initial post-adjustment launch authenticated the worker, then lost its control
stream at exec. Both host and guest ordinary-user reproductions showed that
`dup2(3, 3, inheritable=True)` leaves Python's existing **CLOEXEC** flag unchanged.
The launcher now explicitly sets only FD 3 inheritable after dup2, then closes the
original descriptor when different. Real socket/exec regressions cover both an
already-FD-3 socket and relocation from another FD. Worker identity, authentication,
challenge and service restrictions are unchanged. No raw API was exposed to Wydgits.

The first rerun also exposed a fixture setup error: builder umask left copied upload
ancestry mode 0775. Staging correctly returned BROKER.PATH. The fixture now installs
reviewed upload directories 0755/files 0644 before approval; the broker path guard
was not changed. Its wrong-UID test now uses an internally valid replacement root
approval with a distinct expected UID, so the refusal actually reaches SO_PEERCRED
rather than failing approval validation. It keeps the real socket at 0600.

### Before/after results and qualification limits

The final real production matrix passed **56/56**, **0 failed**. It uses the
shipped socket-activated root broker and Python launcher, independently installed
WydHosting/Wydgine packages, a vetted Node 24.21.0 binary/native credential helper,
and the existing authenticated broker protocol. No broker operation is mocked.

- Real broker `ensure-account` created two locked/nologin restricted users, UID/GID
  **61051** (`wyd-69816689df4526f12832`) and **61052** (`wyd-08f155da2e286dcb3a87`).
  Provider UID/GID **61050** is separate. No supplementary privileges were granted.
- Both exact byte manifests staged successfully into root-sealed generations. Both
  tenant writes to sealed code were denied; tenant approval-file reads were denied.
  A symlink substituted at the approved source path returned BROKER.PATH without
  publishing a redirected generation.
- Actual kernel wrong UID and wrong primary GID returned BROKER.UNAUTHORIZED.
  Tenants were denied the 0600 socket. Unsupported cleanup/retire operations,
  foreign/traversal pool selectors, injected paths/unit arguments, malformed JSON,
  duplicate and reserved keys failed closed through real broker sessions.
- Both production workers completed root-peer/MainPID/UID/GID/cgroup/challenge launch
  and served **HTTP 200** through private Unix sockets as the intended tenants.
  Cross-UID private file/socket/signal attacks were denied; same-tenant operations
  succeeded. No control/authentication shortcut was installed.
- Actual worker UID/GID/groups/NNP/capabilities, cgroup membership and limits were
  inspected: memory.max=268435456, swap.max=0, pids.max=32, cpu.max=`25000 100000`.
  Effective worker RestrictSUIDSGID=yes and broker RestrictSUIDSGID=no were checked,
  along with unchanged NNP, capabilities, system/cgroup and namespace restrictions.
- Authenticated active/stopped status succeeded. Concurrent reconciliation against
  the held active lease returned BROKER.BUSY. Exact stopped-lease reconciliation
  succeeded. A frozen worker was reaped after provider disconnect while a healthy
  sibling canonical App continued returning HTTP 200. SIGKILL of the exact sibling
  broker session then independently triggered systemd BindsTo worker termination;
  the dead broker issued no successful cleanup acknowledgement, and authenticated
  interrupted-lease reconciliation succeeded. Test cleanup verified stopped owned
  units before deleting their disposable files/accounts.

The separate real kernel stress matrix was repeated: **26/26**, **0 failed**,
including task exhaustion/EAGAIN, CPU throttling, cgroup-contained OOM, protected
filesystem/cgroup/network/namespace operations and cross-UID symlink races. These
remain separately labelled hostile fixtures, not arbitrary-code capabilities added
inside an App. The production matrix inspects configured limits and lifecycle;
resource exhaustion is exercised by those bounded fixtures.

Before correction, four original broker startups failed. In this follow-up the
initial matrix had **27 passed / 6 failed** (upload-mode failure and downstream missing
staging/launch); correcting the fixture yielded **31 passed / 2 failed** (CLOEXEC
handoff). The real FD fix yielded **45/45**; adding effective-hardening/status/lease
checks yielded **53/53**; adding actual broker SIGKILL/BindsTo, fail-closed cleanup
acknowledgement and interrupted-lease reconciliation yielded **56/56**. Earlier
failures are retained, not relabelled as passes.

SELinux remained **enforcing**, with **no AVC/USER_AVC matches** in the audit query.
Actual worker context is `system_u:system_r:unconfined_service_t:s0`. These results
establish DAC/systemd/cgroup/native-peer enforcement, **not per-tenant SELinux MAC**.
No SELinux module, permissive domain, boolean, label rule or additional allow was
installed. Firewalld/SSH remained active and unchanged; no firewall rule was modified
in this follow-up. The previous unused-zone rollback evidence still has its limited
manager/recovery scope and does not qualify public packet enforcement.

**I5.6 remains experimental and NOT security qualified.** Full canonical provider
registry/journal/setup-daemon integration is not established by this manually reviewed
fixture approval (its registry digest is a fixture selector). Caddy/TLS, external
IPv4/IPv6, production SELinux domains/labels, challenge replay/load, hostile mount
substitution, storage quotas, disk-full/startup/power-loss/reboot interruption and
automated destructive retirement remain unqualified. No RHEL or fresh Debian/Ubuntu
VM qualification is inferred. Next work is the remaining I5.6 integration/MAC/recovery
matrix, before I5.7/I5.8 release gates.

### Reproduction, VM mutations and regression record

Before applying the change, transfer the reviewed **original** broker template and
`verify-openat2-systemd.py` into a new root-protected `/var/tmp/wyd-i56-followup`, then:

```sh
ssh almond-lab 'sudo -n timeout 90s python3 -B /var/tmp/wyd-i56-followup/verify-openat2-systemd.py --target=almond-lab /var/tmp/wyd-i56-followup/wydhosting-broker@.service'
```

The causal runner requires that input still contain RestrictSUIDSGID=yes. Prepare and
transfer a fresh independent build using the build/transfer procedure in the initial
campaign below, then use the updated `qualify.py` and `qualify-kernel.py`. Every command
that creates privileged fixtures is targeted to `almond-lab`, never Mint. The updated
matrix is runnable with the adjusted shipped assets, without altering worker units.

Additional VM mutations: new `/opt/wyd-i56-causal/{probe.py}` and
`/var/lib/wyd-i56-causal/{input,on1.json,off.json,on2.json}`;
`/run/systemd/system/wyd-i56-causal-{on1,off,on2}.service`; all removed after the
causal experiment. New root-protected `/var/tmp/wyd-i56-followup` contains only
transferred scripts, reviewed original template, archive and extracted build; removed
at completion. Production test roots/unit templates are the same disposable layout
listed below, recreated only after proving absence, then removed. Two broker-created
tenants now genuinely exist during the campaign and are deleted after owned services
stop. Exact generated units/generations, provider and test account operations, cleanup
and before/after results are preserved in
`test-support/linux/evidence/2026-10-16-broker-followup.json`. Account-tool credential
DB backup/lock changes and journal/audit records remain documented side effects.
No existing account, baseline backup, SSH/firewall configuration, SELinux policy or
Mint service/configuration was changed.

Focused Linux passed **20/20**. The independently packed WydHosting tarball passed
**30/30** Python cases as the ordinary VM user (including explicit administrative/
platform mocks and the two real descriptor/exec variants inside one case), plus
**6/6 mocked** firewall guards. These are nested counts, not additional npm tests.
Fresh installed-package consumers passed service-free CLI/HTTP, **148/148** canonical-
library tests, **35/35** provider tests, **20/20** real subprocess-supervisor tests and
**20/20** Linux boundary tests, with repository imports refused. Package evidence is
`/tmp/wyd-i54-packed-1n49SD`; full logs use `/tmp/wydgit-i56-followup-*.log`.

The first complete follow-up `npm test` passed **930/931**, with one failure:
`JSON: clean interactive Contact install, concurrent HTTP submissions, restart and
explicit base-site cleanup` received HTTP 500 where 200 was expected. The unchanged
hardening file subsequently passed **4/4** in isolation. This resembles the historical
Contact/Guestbook HTTP500 observation; its cause remains **undiagnosed**. No HTTP
implementation, assertion, budget, normal test concurrency or resource policy was
changed, and successful repetitions are not described as a fix. The independently
installed canonical-library suite includes that fixture and passed all 148 cases.

The unchanged normal-policy full rerun passed **931/931**, **0 failed/skipped/
cancelled**. Required checks are repeated after final evidence/document synchronization
before commit/push. `npm run check` passed **3 pages / 42 links**. Version remains **0.3.0-alpha.15**; dependencies, platform
admissions and worker protocol remain unchanged. Debian/Ubuntu contract admissions
remain covered by Node/Python tests; no actual Debian/Ubuntu/RHEL guest was run.

## Initial fresh-baseline privileged campaign — 2026-10-16

Started clean at **a4b78a844b471c3fab7de6d72ffe40fc2f9b773b**, branch
`develop/0.3`. The operator restored `almond-lab` to its baseline. No previous test
identity, installation, policy, directory or service was reused. The initial sudo
probe required authentication; the operator subsequently supplied temporary VM-local
sudo access. This campaign did not edit sudoers or authentication policy. Mint was
used only for ordinary-user repository work, compilation, local tests, npm package
consumers and SSH. No privileged hosting command ran on Mint.

**Initial campaign decision (superseded by the authorized follow-up above): I5.6
remained experimental and NOT security qualified.** Kernel fixtures passed while the
production broker refused startup before authorization or account operations.

### Exact guest and enforcement scope

AlmaLinux **10.2**, x86_64 KVM, kernel **6.12.0-211.65.1.el10_2.x86_64**;
boot ID `c77a65af-95bc-480d-bbe3-47f613b6b005`; systemd
**257-23.el10_2.2.alma.1**, Python **3.12.15**, firewalld **2.4.3**.
PID 1 is systemd. Unified cgroup v2 exposes cpu/memory/pids (also cpuset/io/hugetlb/
rdma/misc/dmem). Root filesystem is XFS with **noquota**. SELinux stayed **enforcing**.
SSH and firewalld stayed active. The default/active zone was `public` on `enp1s0`,
with `cockpit dhcpv6-client ssh`; it was never modified. Node/npm/compiler were absent
from the guest baseline. A separately prepared runtime contained Node **24.21.0** and
the native credential helper; no guest package manager or root npm was used.

### Executed real kernel results

`test-support/linux/qualify-kernel.py` passed **26/26**, **0 failed**, with two locked,
no-login, supplementary-group-free fixture users **61061** and **61062**. These are
administrator-created kernel fixtures, **not broker-created production workers**.
Each service has a 45-second maximum lifetime, 2-second stop deadline, 64 MiB memory
limit, no swap, 16 tasks, 25% CPU, 64 file descriptors, empty capabilities,
NoNewPrivileges, strict system mounts, protected cgroups, AF_UNIX-only sockets,
restricted namespaces and `RestrictSUIDSGID=yes`.

| Actual operation | Required/observed result |
| --- | --- |
| A read or overwrite B private file | EACCES / EACCES |
| A connect to B private Unix socket | EACCES |
| A signal B live process | EPERM |
| A open B `/proc/<pid>/mem` | EACCES |
| A symlink or `../` traversal into B | EACCES / EACCES |
| Concurrent A symlink replacement between own and B private file | 2,001 reads: 1,210 denied, 791 authorized, **0 foreign reads** |
| Same-tenant private Unix socket and file writes | succeeded |
| Worker write `/etc`, sibling file, cgroup controller | EROFS, EACCES, EROFS |
| Worker create AF_INET socket or user namespace | EAFNOSUPPORT / EPERM |
| Actual UID/GID/groups/NNP/CapEff/CapPrm/CapAmb | exact intended identity; no extra groups; NNP=1; capabilities=0 |
| Child calls `setsid` | main and child remain in exact service cgroup |
| TasksMax=16 | fork 16th child refused EAGAIN; 15 children + main; pids.events `max` increased |
| CPUQuota=25% | cpu.max `25000 100000`; 40 throttled periods; 2,977,972 throttled microseconds |
| MemoryMax=64 MiB against bounded 512 MiB allocation attempt | systemd Result=`oom-kill`, SIGKILL; sibling still responsive |
| Frozen main + session-detached child stopped through systemd | both processes gone; healthy sibling remains responsive |

The resource tests inspect actual cgroup files and service results. They do not merely
assert rendered unit text. Sibling checks use a real private socket; a full canonical
App is not serving in this independent fixture lane. CPU/race counters are observations
of this run, not deterministic expected constants.

### Production broker blocker and authorization coverage

A separately installed, root-owned package closure and the **unchanged production
socket/service/slice assets** were installed only in the VM. Provider UID/GID 61050
was a new locked no-login account. The production socket remained **0600**. A real
provider connection started a root systemd broker session, which exited 70 before
request dispatch. Sanitized diagnostics identify `phase:release`, `BROKER.PATH`.
A temporary VM-only diagnostic identified `openat2` returning **ENOSYS** while opening
`node_modules` below the protected release. That diagnostic was removed from the
repository/runtime source after diagnosis; no path fallback was added.

Systemd's `RestrictSUIDSGID=yes` deliberately filters openat2, because its mode
argument is indirect. See the [systemd implementation](https://github.com/systemd/systemd/blob/main/src/shared/seccomp-util.c)
and [systemd execution contract](https://github.com/systemd/systemd/blob/main/man/systemd.exec.xml).
This is a real integration defect in the existing broker service hardening, not a
missing kernel feature or SELinux AVC. The broker's openat2 symlink/mount protections
continue to fail closed.

The proposed narrow fix removes that directive only from the trusted broker; worker
restrictions, NoNewPrivileges, capability bounds and path verification remain. Automatic
approval review rejected execution of that hardening change pending explicit operator
approval. **The shipped broker directive remains unchanged.** No rejected experiment
was executed indirectly. A separate openat/openat2 fallback or new privileged helper
was not introduced. Review the hardening tradeoff before further broker qualification.

Consequently real production **SO_PEERCRED authorization, impersonation, malformed
requests, staging races, cleanup/retirement rejection, root-sealed staging, main-PID/
challenge authentication, private ingress and broker-parent-death cleanup remain
UNQUALIFIED**. No successful broker `ensure-account`, `stage` or `launch` is claimed.
`qualify.py` contains the opt-in subsequent matrix, but its post-startup paths have
not executed. Existing mocked and ordinary-user credential tests remain separately
labelled and do not close this gate.

### SELinux observations and installer requirements

No SELinux module, permissive domain, boolean or file-context rule was installed.
`ausearch -m AVC,USER_AVC -ts boot --interpret` reported **no matches** before and
after the campaign. Both kernel fixture processes ran as
`system_u:system_r:unconfined_service_t:s0`. Thus the observed tenant denials establish
**DAC/systemd/cgroup/seccomp enforcement**, not an independent per-tenant SELinux
boundary. No new MAC confinement or MCS separation is claimed. Legitimate fixture
operations succeeded without AVCs; production worker operations remain blocked earlier.
An eventual installer needs reviewed service domains, labels for immutable/runtime/
private state and an exact AVC/negative matrix. Policy requirements cannot be inferred
from an unconfined service or solved with broad allow rules.

### Firewalld increment and exact limits

Both UFW and firewalld now have read-only preview support. `applyFirewall` still refuses
`HOSTING.FIREWALL_UNQUALIFIED`; there is no public hosting firewall activation or broker
firewall operation. The packaged administrator-only `broker/firewalld_probe.py` supplies
a deliberately small transaction primitive: a fixed IPv4 loopback/high-port rich rule,
only in an existing **nondefault, unbound zone**, no interface/source changes, no reload,
no permanent write. This campaign selected the unused `block` zone. The rule is:

```text
rule family="ipv4" source address="127.0.0.2/32" port port="65431" protocol="tcp" reject
```

Before adding it, the probe creates a root-only exclusive intent file and verifies an
independent systemd rollback timer is active. The timer runs firewall-cmd as a separate
root service after 15 seconds, with time/memory/task limits. A firewalld-native 60-second
expiry is an additional recovery bound. The probe has no commit or activation command.
The exact prior full runtime and permanent zone listings must match after rollback.
Firewalld documents [runtime expiry and rich rules](https://firewalld.org/documentation/man-pages/firewall-cmd.html).

The normal transaction completed and restored the exact listings. The separate caller-
death matrix passed **3/3**, **0 failed**: timer armed before apply; runtime rule
visible while active nft chains remained unchanged; SIGKILL of only the applying process
followed by successful independent rollback and exact runtime/permanent restoration.
No SSH shell/JavaScript timer supplied recovery. The existing `block` zone was not
bound to any source/interface; its rule did **not** enter active nft chains, so this
is real **manager transaction/recovery evidence, not packet-enforcement evidence**.
No IPv4/IPv6 external exposure, Caddy path, public allow/deny policy, persisted commit,
reboot/power-loss or cloud firewall result is claimed. Independent console/snapshot
recovery is not verified, so active/public firewall mutation remains deferred.

### Reproduction and all VM mutations

Run ordinary-user package preparation locally, then transfer only the disposable build
and reviewed scripts. Replace NEW with a fresh directory; never overwrite an existing
installation. All privileged commands below explicitly target `almond-lab`:

```sh
npm pack --workspace wydgine --pack-destination /tmp
npm pack --workspace wydhosting --pack-destination /tmp
node test-support/linux/prepare-qualification.mjs /tmp/NEW \
  /tmp/wydgine-0.3.0-alpha.15.tgz /tmp/wydhosting-0.3.0-alpha.15.tgz
tar -C /tmp/NEW -czf /tmp/NEW.tgz .
ssh almond-lab 'test ! -e /var/tmp/wyd-i56-campaign && mkdir -m 700 /var/tmp/wyd-i56-campaign'
ssh almond-lab 'cat > /var/tmp/wyd-i56-campaign/build.tgz' < /tmp/NEW.tgz
tar -C test-support/linux -cf - qualify.py qualify-kernel.py verify-firewalld.py verify.py verify_firewalld_guards.py | ssh almond-lab 'tar -C /var/tmp/wyd-i56-campaign -xf -'
ssh almond-lab 'cat > /var/tmp/wyd-i56-campaign/firewalld_probe.py' < packages/wydhosting/broker/firewalld_probe.py
ssh almond-lab 'cd /var/tmp/wyd-i56-campaign && mkdir build && tar -xzf build.tgz -C build && python3 -B verify.py build/release/node_modules/wydhosting/broker && python3 -B verify_firewalld_guards.py build/release/node_modules/wydhosting/broker'
# Independently review source/artifact hashes before root execution. No root npm.
ssh almond-lab 'sudo -n chown -R root:root /var/tmp/wyd-i56-campaign'
ssh almond-lab 'sudo -n timeout 180s python3 -B /var/tmp/wyd-i56-campaign/qualify-kernel.py --target=almond-lab'
ssh almond-lab 'sudo -n timeout 60s python3 -B /var/tmp/wyd-i56-campaign/firewalld_probe.py --unused-zone block'
ssh almond-lab 'sudo -n timeout 60s python3 -B /var/tmp/wyd-i56-campaign/verify-firewalld.py --target=almond-lab /var/tmp/wyd-i56-campaign/firewalld_probe.py'
# Broker path currently EXPECTS startup refusal; do not call it qualified:
ssh almond-lab 'sudo -n timeout 240s python3 -B /var/tmp/wyd-i56-campaign/qualify.py --target=almond-lab /var/tmp/wyd-i56-campaign/build'
# Save JSON events/audit evidence and inspect cleanup before removing this new staging root.
ssh almond-lab 'sudo -n rm -r -- /var/tmp/wyd-i56-campaign'
```

Both fixture runners refuse a different hostname, rootless invocation, preexisting
resource roots or colliding identities. The kernel runner also checks enforcing
SELinux. The production runner additionally requires AlmaLinux, systemd and active
SSH/firewalld. Every setup/start/delete is emitted as a JSON event. Cleanup stops only
known campaign units/processes, checks ownership and removes only roots proven absent
on entry. Do not run the production runner against an installed host. On interruption,
inspect retained events and actual unit state; do not blindly rerun or delete by PID/UID.

| VM mutation | Exact scope and cleanup |
| --- | --- |
| Transfer/build staging | `/var/tmp/wyd-i56-campaign`, archive, scripts, extracted build; root-protected after unprivileged transfer; removed after evidence collection |
| Candidate runtime install | new `/opt/wydhosting/release`, copied independently installed packages, Node binary/helper, manifest; removed |
| Candidate policy/state | new `/etc/wydhosting/approval.json`, `/var/lib/wydhosting/{accounts,uploads,pools,broker,provider}`, `/run/wydhosting/workers`; removed |
| Candidate provider account | `wyd-i56-provider`, UID/GID 61050, locked/nologin, no home; removed; tenant accounts 61051/61052 were **not** created |
| Candidate units | `/run/systemd/system/wydhosting-broker.socket`, `wydhosting-broker@.service`, `wydhosting-broker.slice`, implicit `wydhosting.slice`; installed, daemon-reloaded, stopped, removed/reset |
| Broker sessions | `wydhosting-broker@0-5815-61050.service`, `@0-6070-61050.service`, `@0-6289-61050.service`, `@0-6471-61050.service`; failed startup, exact units reset during cleanup |
| Kernel fixture accounts | `wyd-i56-k61061`, `wyd-i56-k61062`; locked/nologin system users/groups; removed after each run |
| Kernel fixture files | `/opt/wyd-i56-kernel/fixture.py`; `/var/lib/wyd-i56-kernel/{a,b,tasks,cpu,memory}` including private files/sockets/race links/results; removed |
| Kernel fixture services/cgroups | `wyd-i56-kernel-{a,b,tasks,cpu,memory}.service`; no enabled/boot units; bounded transient services stopped and reset; cgroups/processes removed |
| Firewall transaction intents/timers | `/run/wydhosting-firewall-probe-<uuid>.json` and corresponding `.timer`/`.service`; rule removed independently; completed timers stopped/collected; intents removed |
| Firewall-owned fragment | only the fixed rule above in unbound `block`; restored to original runtime; permanent configuration untouched |
| Account-tool side effects | passwd/group/shadow/gshadow databases and their standard backup/lock files touched by user/group creation/deletion; no existing identity changed; backups are not asserted byte-identical |
| Retained system evidence | systemd journal/audit records, including expected OOM/service refusals; retained under existing VM retention policy |

No baseline backup, existing account, personal data, SSH, sudoers, system package,
network interface, default firewall zone or SELinux policy was changed by the campaign.
Temporary privileged access itself was operator-provided. Account-tool backups and
journals are documented retained side effects, not silently called a pristine restore.

### Counts, failures and coverage separation

Repository regression passed **931/931**, focused Linux tests **20/20**, with no
failures/skips/cancellations. `npm run check` passed **3 pages / 42 links**. Final
checks are rerun after this documentation synchronization. Independent tarball
consumers passed: service-free CLI/HTTP, **148/148** canonical-library fixtures,
**35/35** provider fixtures, **20/20** real subprocess-supervisor fixtures and
**20/20** Linux boundary fixtures. These run as the ordinary local user, not root.
The installed Linux fixture includes the 29-case Python suite and 6 mocked firewall
guards; those counts are nested, not extra npm tests. The actual final WydHosting
tarball also passed **29/29** Python boundary cases and **6/6 mocked** firewall guards
as the ordinary VM user, with no skipped cases. The shared platform matrix ships in
and is loaded from that installed tarball. Fresh package evidence is
`/tmp/wyd-i54-packed-yS2m8t`; generated Python caches are now excluded and the broker/
launcher suppress bytecode writes. No dependencies or versions changed.

Debian/Ubuntu admissions, negative cases and existing regressions pass through the
shared Node/Python matrix tests. No new Debian/Ubuntu VM experiment was run; this
is contract/regression evidence, not a fresh OS qualification. Browser/client suites
were not separately rerun; no client source or historical distribution changed.

Kernel results are **26 real privileged checks**, not additions to npm's test count. Firewall
caller-death results are **3 real manager/recovery checks**, plus the successful normal
transaction. The ordinary-user Python suite has **29** cases (including explicitly
mocked administrative/platform cases); the separate firewall guard suite has **6 mocked**
precondition cases. Neither Python suite qualifies root operations.

Retained failures: the first production runner stopped before mutation because systemctl
returns 1 for no matching unit files; the harness now handles that status. Four actual
broker startup attempts refused (first silent, then phase/temporary syscall diagnostics);
no successful authorization occurred. The first kernel fixture started before the sibling
directory existed; it failed ENOENT, then cleaned up; corrected runs passed 25, then
26 after adding the real race. The first firewall probe rolled back but cleanup rejected
an already-collected timer; cleanup now accepts systemctl's absent-unit status. The first
caller-death verifier incorrectly expected an unbound zone rule in active nft chains;
that assertion failed, independent rollback still removed the rule, and the corrected
coverage explicitly verifies no active-chain change. No failure is relabelled a pass.

Evidence logs are `/tmp/wydgit-i56-{priv-vm-*,kernel-*,firewall*,priv-full,priv-local-focused,priv-packed}.log`.
Sanitized durable VM events are retained in `test-support/linux/evidence/2026-10-16.json`.
Version remains **0.3.0-alpha.15**. Debian/Ubuntu matrix admissions and existing worker
hardening remain unchanged; only AlmaLinux was actually exercised. **No RHEL
qualification is inferred.** Next work is the broker hardening/openat2 decision and
production broker/worker qualification, before I5.7 data migration or I5.8 release gates. Disk quotas (XFS noquota), FD/tmp
exhaustion, mount substitution, ptrace interfaces beyond the tested proc-memory denial,
reboot, startup/disk-full interruption, automated destructive resource retirement,
Caddy/TLS and external IPv4/IPv6 remain untested or unimplemented.

## Executed regression evidence

The first complete postimplementation matrix passed **925/925** before final
openat2, advisory-reproducer, packaging-guide and explicit implementation-root additions.
The reviewed final repository run passed **929/929**, including the final relay
provenance and restrictive-umask regressions. Required checks are rerun after the
final documentation synchronization before committing. No skipped privileged gate is included in these counts.

| Check | Actual executed result |
| --- | --- |
| Baseline ordinary `npm test`, normal isolation | 910 passed; 0 failed/skipped/cancelled |
| Baseline `npm run check` | passed, 3 pages / 42 links / unique anchors |
| Final reviewed `npm test` | 929 passed; 0 failed/skipped/cancelled |
| Focused supervisor + initial Linux boundaries | 33 passed; 0 failed/skipped/cancelled |
| Reviewed focused Linux/advisory/package boundaries | 21 passed; Python 26/26 inside the Linux fixture; no privileged operation |
| `npm run test:client` | 90 passed; no failures/skips/cancellations |
| Actual Chrome smoke | 16 cases passed |
| Actual Chrome controls | 4 fixtures passed |
| Actual Chrome hostname/TLS/origin/cookie/routing | 5 fixtures passed |
| I4 architecture fixture | 4 groups passed; original mocked npm-mechanics case remains labelled |
| Workspace npm dry runs | 9 packages passed |
| Actual independent tarball consumers | 3 passed: service-free, five-library, provider |
| Installed canonical five-library regressions | 148 passed |
| Installed provider CLI/registry regressions | 35 passed; real npm-bin commands passed |
| Installed real subprocess supervisor | 20 passed |
| Installed unprivileged Linux boundaries | 18 cases; Python 26 primitive/contract cases within one fixture |
| Historical browser distribution integrity | 23/23 baseline blobs byte-identical |
| `git diff --check` | passed |
| Targeted dependency audit after patches | 0 known advisories, exit 0 |

Delivery reruns full/check, the installed Linux boundary addition, packaging,
whitespace and all 23 historical distribution byte comparisons after final review.
No public npm package is published. Assets/guides are shipped inside WydHosting and
native source inside Wydgine, without undeclared repository runtime imports.

The full suite covers I0–I3 inventory, origins/routing, governance, lifecycle and stopped
relocation; I5.1 engine boundaries; I5.2 standalone/TTY/setup; I5.3 approvals/journal;
I5.4 physical isolated installations; I5.5 real subprocess workers; canonical JSON/
SQLite, Gate/Files/Stream/Search, package recovery, WBasic/SEWN, client and historical
browser regressions. Wydgine still runs with WydHosting absent in its service-free
consumer. Exact Search/Stream peer ranges include alpha.15 without changing their
version axes. There is only one physical engine per independent consumer.

## What the new tests actually prove

The **26-case** unprivileged Python suite performs real current-UID descriptor-relative copies,
link/FIFO/hash/unapproved/missing-content rejection, held-root parent replacement,
a source path swap after open, intact separate known-good data, actual Unix credentials,
held-socket permissions, openat2 symlink/existing proc-mount refusal and strict raw JSON.
A same-UID destination owner can chmod its own output: these tests are **not** evidence
of root-owned immutability or customer-to-customer denial. Conflicting-owner setup and
administrative-command observation use explicit mocks; they prove validation/control
flow, not Linux enforcement. Account/useradd/systemctl/firewall commands do not run.

Actual Node/Linux tests compile the shipped N-API helper and verify PID/UID/GID,
credential-checked Unix HTTP, exact HTTPS routing, unknown/foreign host rejection,
forwarded-header/scheme refusal, wrong expected UID closure, retirement, raw wire bounds,
duplicates/UTF-8, fake nonroot broker refusal, actual listener PID/UID checks and
read-only setup/firewall refusal. An explicit trusted library resolution root prevents
source-selected node_modules and supports separate runtime/App ancestry. It does not
create a new capability grant or publisher trust system.

These do not prove a real cross-UID successful launch, cgroup membership, kernel resource
quotas or Caddy deployment. Mocked generated-unit checks never count as those tests.
No rootless/container result is represented as a privileged VM pass.

## Original-delivery privileged matrix — all NOT EXECUTED (historical)

| Required actual property | Status / blocker |
| --- | --- |
| Paid restricted worker UID/GID/groups and no capabilities | VM/systemd/account operations unavailable |
| Customer A denied B code/data/process/sockets | Actual separate customer UIDs not provisioned |
| Real broker caller authorization and account tools | Root socket-activated broker not installed/run |
| Root-sealed staging against customer writes/mount races | Only current-UID primitives tested |
| Blocked orphan independently killed after provider/broker death | Actual systemd BindsTo/kill/cgroup not exercised |
| Memory/CPU/process/FD/tmp limits, OOM reason and healthy sibling | No privileged service/resource stress run |
| Service-bound control challenge, wrong UID/unit/replay | Protocol/code reviewed; actual systemd handshake absent |
| Separate-UID provider/worker private ingress and exact Caddy chain | Only unprivileged native socket boundaries tested |
| External IPv4/IPv6 worker denial | No exposed VM/network vantage |
| UFW conflict detection/apply/independent rollback/SSH recovery | Live adapter unimplemented and disabled |
| Interrupted root startup/staging/reboot/power loss | Not executed; ambiguous records fail closed |
| Automatic owned resource/account retirement | Unimplemented; manual review/quarantine only |

Follow the disposable VM procedure in service-and-cgroups.md. Preserve an independently
verified console before any live firewall experiment. The preview's console boolean
is not proof of recovery. Runtime parent recreation, native/system library compatibility,
MAC and filesystem durability need separate exact-image evidence.

## Intermediate failures and corrections

- Initial sandboxed baseline failed 27 file-level tests at restricted subprocess/socket
  boundaries; normal ordinary-user baseline passed 910/910. Restricted Python socket
  calls likewise failed EPERM; normal current-UID primitive tests passed. These failures
  are retained and not reclassified as successful security checks.
- Initial Linux test assertions incorrectly used synchronous `throws` for async methods;
  corrected to awaited rejection checks. Fake-broker fixture needed to handle its
  expected reset instead of creating an unhandled fixture socket error.
- The new listener path initially stopped responding to health during graceful drain,
  producing an expected-to-drain Taskboard connection reset. Restored health/readiness
  during drain and reran all 33 focused tests successfully. This was a new implementation
  defect, not a diagnosis of the historical HTTP500 class.
- First full implementation run passed 921/925: four old alpha.14 version assertions
  required the coordinated alpha.15 update. No execution policy was changed. The next
  full run passed 925/925 and the full browser/package matrix passed.
- Security review found that a multiplexed worker must not forge the broker cleanup acknowledgement. Root relay now forwards only closed, correctly bound/sequenced worker frames and emits cleanup under a separate broker-result schema after actual owned-cgroup death. A real unprivileged socket-pair attack verifies a forged acknowledgement is never forwarded. Root service outcomes preserve sanitized OOM/exit observations.
- Review found that umask 0077 would strip required group-read/job-read modes; publication now applies exact reviewed modes through held descriptors. Actual unprivileged regressions exercise that restrictive umask.
- The first installed Linux run used a missing explicit runtime root beneath an installation ancestor and exposed implicit package ancestry resolution. The importer now requires the selected root directory to exist; a fresh installed Linux run passes this regression.
- An openat2 fixture inherited group-writable developer umask; the test now explicitly
  creates protected 0700 source ancestry. Runtime refusal was correct and unchanged.
  The ASF patch rejects the malformed upstream sample as unknown rather than returning
  ASF; the regression asserts bounded termination and that rejection in a subprocess.

## Reliability investigation

The historical shared-host held-request, Taskboard hostname GET and concurrent
Contact/Guestbook JSON/SQLite HTTP500 observations remain **undiagnosed**. Successful
full, installed and browser runs did not reproduce unexpected App HTTP500, but successful
repetition is not a fix. I5.5's **100 ms** canary connection reset and **WORKER.TIMEOUT**
observation remains historical evidence: the independent-serving test uses the documented
**2000 ms** default, while a separate real frozen-worker test preserves strict 100 ms
retirement. No App budget, normal isolation, assertion or resource policy was weakened.

Supervisor code/generation/readiness, broker principal/operation/outcome/lease, controlled
systemd Result/accounting and ingress peer/routing failures provide distinct diagnostic
boundaries. The VM run must capture actual permission/resource/proxy/deadline outcomes;
this environment supplies no new UID/cgroup scheduling diagnosis. Journals/events omit
raw data, sessions, keys and exception strings. Production reliability is still open.

## Dependency review

Baseline npm audit reported runtime **file-type 21.0.0** (ASF zero-sized subheader
loop and ZIP decompression DoS) and dev-only **happy-dom 20.8.4** (cookie-origin and
module-compiler code injection). Runtime Stream calls file-type on untrusted uploads;
its existing ZIP opaque-attachment defense remains, but did not resolve the ASF risk.
Happy DOM is not in engine/provider runtime dependency graphs; developer execution
of hostile fixture content is still a relevant development threat.

Reviewed primary maintainer advisories:
[file-type ASF](https://github.com/sindresorhus/file-type/security/advisories/GHSA-5v7r-6r5c-r473),
[file-type ZIP](https://github.com/sindresorhus/file-type/security/advisories/GHSA-j47w-4g3g-c36v),
[Happy DOM cookies](https://github.com/capricorn86/happy-dom/security/advisories/GHSA-w4gp-fjgq-3q4g),
[Happy DOM compiler](https://github.com/capricorn86/happy-dom/security/advisories/GHSA-6q6h-j7hj-3r64).

Installed only verified compatible targeted patches **file-type 21.3.4** and
**happy-dom 20.8.9**, with lifecycle scripts disabled. file-type updates its required
@tokenizer/inflate dependency to 0.4.1 and removes fflate; no unrelated bulk upgrades.
The separate-process ASF reproducer enforces an external finite deadline. Existing
Stream ZIP/security, JSON/SQLite media tests, Happy DOM/client suite and installed
canonical services passed after the patch. `npm audit --json` then returned **zero
known vulnerabilities**. This is registry advisory status, not a passing independent
security audit or proof of unknown-vulnerability absence.

## Evidence and handoff

Disposable evidence uses `/tmp/wydgit-i56-*`: baseline logs, initial failing/passing
focused/full logs, Python/native boundary logs, dependency metadata/audits, full matrix
results, client/Chrome/I4/package dry-run output and final checks. Initial successful
installed closure is `/tmp/wyd-i54-packed-E50qdl`; the complete installed Linux extension
also passed in `/tmp/wyd-i54-packed-HmW92I`. The final relay-reviewed matrix retains
its fresh evidence directory in `/tmp/wydgit-i56-packed.log`. The historical i54 prefix is the unchanged verifier
name, not a claim to be testing old packages. Tarballs, integrity/file inventories,
dependency graphs and resolved-path logs prove installed execution without repository
imports. Evidence contains no publisher/private keys and is not shipped as runtime data.

Final review inspects status/full diff/stat, privilege boundaries, root-controlled
operations, export direction, package closure and all 23 browser blobs, then commits
and pushes only develop/0.3 as explicitly authorized. No main merge, tag, release,
publication, external deployment or host provisioning. I5.7 stopped migration/cutover
and I5.8 integrated Linux/release qualification remain outstanding.
