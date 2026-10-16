# I5.6 verification and qualification record

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
security qualified. Real AlmaLinux kernel fixture and firewall rollback results are
recorded below; the production broker is blocked before dispatch.** At the original alpha.15 delivery no authorized disposable VM was available.
No root/sudo/account/systemd/cgroup/firewall/SSH/network/DNS/certificate provisioning
was performed on the operator's machine. Sandboxed test restrictions were bypassed
only for explicitly authorized ordinary-user subprocess/socket/browser/npm/Git work,
not by running customer code or provisioning as root.

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

## Fresh-baseline privileged campaign — 2026-10-16

Started clean at **a4b78a844b471c3fab7de6d72ffe40fc2f9b773b**, branch
`develop/0.3`. The operator restored `almond-lab` to its baseline. No previous test
identity, installation, policy, directory or service was reused. The initial sudo
probe required authentication; the operator subsequently supplied temporary VM-local
sudo access. This campaign did not edit sudoers or authentication policy. Mint was
used only for ordinary-user repository work, compilation, local tests, npm package
consumers and SSH. No privileged hosting command ran on Mint.

**Current decision: I5.6 remains experimental and NOT security qualified.** The real
kernel fixtures pass, but the production broker refuses startup before authorization
or account operations. Those fixture results do not qualify the integrated worker lane.

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
