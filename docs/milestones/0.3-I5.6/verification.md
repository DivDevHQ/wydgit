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

**Overall: experimental partial implementation; not implementation complete; Linux
security qualification NOT EXECUTED.** No authorized disposable VM was available.
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

## Privileged matrix — all NOT EXECUTED

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
