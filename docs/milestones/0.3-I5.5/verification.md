# I5.5 verification

Executed 2026-10-15, Linux x86_64, Node **24.21.0**, npm **11.19.0**, actual Chrome
**155.0.8059.79**. Starting branch develop/0.3, clean tree, HEAD and fetched origin
both **57ce43a240c25a80e915fef939ab50023b7a7997**. No legitimate commits were removed.
This is development qualification, not production Linux/multi-tenant certification.

## Executed checks

| Check | Actual result |
| --- | --- |
| Baseline `npm test`, normal isolation with process/socket access | 890 passed, no failures/skips/cancellations |
| Baseline `npm run check` | passed |
| Delivery full `npm test`, normal isolation | 910 passed, no failures/skips/cancellations |
| Focused I0–I5.3/controller/routing/governance/lifecycle/launcher/provider matrix | 118 passed, no failures/skips/cancellations |
| Final standalone worker/supervisor suite | 20 passed, no failures/skips/cancellations |
| `npm run test:client` | 90 passed, no failures/skips/cancellations |
| Actual Chrome smoke | 16/16 |
| Actual Chrome native controls/signing/embedded/quick-start | 4/4 |
| Actual Chrome routing/TLS/origin/cookie/parking | 5/5 |
| I4 architecture validation | 4 groups passed; historical npm mock remains labelled as such |
| Independent local tarball installs | three real consumers passed |
| Installed five-library regression | 148 passed |
| Installed I5.3 provider regression/CLI | 35 passed, actual CLI commands passed |
| Installed actual worker/supervisor regression | 20 passed |
| Actual installed worker bin without IPC | exit 64, no listener |
| Workspace package dry run | all 9 workspaces packed |
| Controlled hostname/hardening/Guestbook/operations repeats | 5 × 24 tests passed, 120 total |
| Short-policy diagnostic repetitions | 10 × 1 passed; does not erase the recorded reset below |
| `npm run check` | 3 complete pages, 42 internal links, unique anchors |
| `git diff --check` | passed |
| Historical browser distribution byte comparison | 23/23 identical to the baseline, including current build outputs |

The delivery matrix above passed after the implementation review. Required full tests
and content checks are rerun once more after this final report edit and before commit. No security assertion,
normal test isolation, existing App execution limit or historical browser byte is
weakened to obtain a passing result.

## Real process and canonical App evidence

Twenty worker tests use actual installed interfaces and real Node child processes,
canonical Apps, existing five canonical services and installed WBasic Taskboards.
Small EventEmitter tests cover queue/backpressure and malformed-response cases; they
are supplementary transport checks, not evidence of process supervision.

Coverage includes two simultaneous PIDs; unrelated free customers sharing two Apps;
a separate paid pool and a higher-tier dedicated App; actual Host-routed Taskboard
execution; unknown/foreign host rejection; independent canonical Store values with
the same record ID across fresh supervised lifetimes; per-App HTTP saturation with
an unaffected sibling and separate pool; accepted real submissions finishing on
SIGTERM; SIGKILL detection and fresh generation restart; persisted crash-loop budgets
across supervisor reconstruction; explicit operator recovery; startup/bind/required
failure; optional service initialization failure remaining 503; invalid inventories,
unapproved snapshots and stale configuration revisions never publishing ready;
malformed/oversized IPC, duplicate/stale generations, pending health rejected on EOF;
registry revision retirement; parent death/worker EOF cleanup; late registry reads that cannot create a generation after startup timed out; and
supervisor shutdown fencing of pending starts plus immediate cached-readiness removal.

Real SIGSTOP tests exercise an unresponsive trusted event loop with both the normal
control policy and a strict 100 ms policy; parent SIGKILL/death confirmation precedes
replacement. They model inability to run trusted work/control callbacks, without
adding an arbitrary native hook or code-evaluation escape to bootstrap. Existing I3
held canonical-service/drain regressions retain actual blocked-hook coverage. This is
not certification of every native blocking facility or of independent orphan cleanup.

PID/entry-path diagnostics in process-supervision logs prove the workers execute the
installed `node_modules/wydgine/bin/wydgine-worker.js`, not development-tree shims.
Fixtures install Taskboards through the real installer/compiler, and all accepted
work uses the original I0–I3 engine. Shutdown hooks run even after assertions fail;
tests assert owned PIDs have terminated. The parent-death case leaves an intentionally
ambiguous supervisor lock and verifies reconstruction refuses it rather than adopting
or killing a guessed numeric PID. Disposable files are removed only after cleanup.

## Package closure and retained evidence

Final independent consumer evidence: **/tmp/wyd-i54-packed-syviX3**. The historical
script/temp prefix is retained; these are fresh alpha.14 tarballs from this milestone.
The consumers are `service-free`, `five-library`, and `provider`, each with exactly
one real physical engine installation. Wydgine operates without WydHosting installed.
Provider workers resolve only declared supported engine exports. Canonical native
providers resolve from consumer ancestry, not repository hoisting; SQLite and Argon2
are actually exercised by the installed service regressions.

The synchronous ESM/CommonJS resolution guard refuses development repository imports
in consumer test graphs. The supervised child's fixed executable path resolves from
the installed package and it has no inherited NODE_OPTIONS/execArgv hooks. Fixture
source/data is separately staged; no copied alternate runtime or SEAM graph exists.
Tarballs include the worker executable, protocol, shared deployment fingerprint helper
and supervisor. Runtime/browser assets, standalone setup, compatibility imports and
canonical catalog/service-resolution checks remain covered by I5.4 regressions.

Retained files include all seven local tarballs, pack manifests/integrities, actual
npm dependency graphs, per-consumer resolution logs, provider CLI and installation
logs, five-library-tests.log, provider-tests.log, process-supervision.log and result.json.
Packages remain private. No npm publication, deployment, tag or release was performed.

Root evidence is `/tmp/i55-*`: baseline-native.log, full-1.log, full-2.log,
full-reviewed.log, focused-qualified.log, security-final.log, delivery-worker.log,
client.log, chrome-*.log, i4.log, pack-dry.log, pack-release-candidate.log,
verification-progress.log, verification-results.json, reliability-1..5.log, health-repeated.log,
content-check.log and browser-bytes.json. The matrix records runner PIDs, start times,
finite external deadlines and complete outputs. Delivery reruns use `*-delivery.log`.
Logs are disposable operator evidence, excluded from repository/package contents.

## Intermediate failures and reliability findings

- The first sandboxed baseline failed at restricted socket/subprocess boundaries;
  the normal authorized environment passed 890/890. Restricted failures are not
  counted as passing baseline evidence.
- Early implementation tests exposed first-run ledger handling and incompatibility
  with the engine's immutable null-prototype JSON; both were corrected. A readiness
  race exposed snapshots published before final registry validation, and short-policy
  startup exposed health expiring during validation. Publication now follows current
  approval plus a fresh correlated readiness request. No timeout was increased to
  hide those implementation defects.
- An expanded recovery test initially deleted the fixture before the reconstructed
  supervisor's cleanup hook; fixture ownership now includes every reconstructed
  supervisor and cleanup precedes deletion. A hostile-input fixture initially tried
  to mutate a frozen inventory; it now explicitly clones its attack input.
- First complete implementation run: 899/906, seven failures. Six were version/export
  assertions requiring alpha.14/trusted protocol updates; one returned an expired
  startup endpoint under the short test policy, fixed by the readiness round trip.
  The next full run passed 906/906; security-review additions passed 908/908.
- A legitimate concurrent I5.3 writer lock was initially treated as registry recovery
  failure during heartbeat, triggering unnecessary retirement/restart. Startup still
  reconciles the journal, while active heartbeats read the atomically approved state
  and compare the affected pool's pinned placement. Committed changes retire the
  affected inventory; unrelated approved pools are not reassigned or hot-mutated.
- Intermediate packed runs retained complete failures in
  `/tmp/wyd-i54-packed-9MqAEJ` and `/tmp/wyd-i54-packed-kwW6ms`. The latter captured a
  canary connection reset with shared-worker code **WORKER.TIMEOUT**, no ready snapshot,
  and observed stopping state, under a deliberately configured **100 ms** control
  deadline. This was supervisor retirement, not an App HTTP500. Ten controlled repeats
  had passed, so successful reruns alone did not establish a fix. The independent-
  serving test now uses the documented **2000 ms default** control budget, since a
  real canonical Page may legitimately occupy the event loop longer than 100 ms
  within its existing execution budget. A separate real frozen-worker regression
  preserves and verifies strict 100 ms timeout/death-before-replacement behavior.
  Existing SEWN/App limits and normal test isolation are unchanged. Exact scheduling/
  Page-work contributions to that short-policy missed deadline were not profiled;
  provider deadline/load qualification remains an I5.6 gate, not a new latency claim.
- Security review added monotonic startup/health freshness, one overall startup budget,
  finite registry/preflight/write waits, no late-start authority after timeout, response
  consistency checks, and cancellation of restart backoffs during shutdown. IPC size
  validation charges keys/values before complete serialization and rejects accessors
  and sparse arrays without invoking/expanding them. Final lifecycle review also fences
  startup after shutdown intent/ownership writes and suppresses every cached ready
  observation once shutdown begins; an actual pending-child regression verifies death.

No unexpected App HTTP500 occurred in the passing full, installed, browser or five
controlled repetition runs. Shared-host held work, Taskboard hostname GETs and concurrent
Contact/Guestbook JSON/SQLite POSTs were exercised. This **does not diagnose or resolve**
the previously recorded HTTP500 class. Keep that reliability investigation open as a
blocker to later production qualification; do not infer a fix from process separation.

## Security review and remaining gates

Only native trusted code can use these exports; no worker/supervisor/control capability
is registered with SEAM or exposed through HTTP. Original contexts/tokens/services stay
inside a worker. There is one inventory validator, one approved provider registry and
one canonical engine per worker, without Wydgine importing WydHosting. Old generations
cannot update replacement metrics/authority, but generation IDs are not physical writer
fencing. Actual owned-process death and exclusive fixture ownership precede replacement.
Ambiguous ownership/corrupt ledger refuses startup and requires manual inspection.

I4 refinements are explicit: native JSON IPC instead of a redundant raw binary decoder;
same-UID provenance without cryptographic/cross-UID authentication; a conservative
persisted lifetime restart budget without automatic rolling reset/jitter; no retry of
ambiguous mutating commands; JSON-only execution approval snapshots instead of functions
or contexts. Read the protocol and lifecycle contracts for exact bounds and outcomes.

Unimplemented and required for I5.6: real UID/account enforcement, broker/systemd and
independently enforced cleanup of blocked orphan workers, cgroups/OS quotas, private
worker ingress and authenticated cross-UID control, immutable race-safe staging,
filesystem/signal/network denial, qualified TLS/proxy/firewall rollback, kernel identity
and resource fencing, and the Linux attack/reboot/power-loss matrix. Loopback and a
separate PID do not establish those guarantees. Existing I5.4 dependency/advisory risks
are not remediated by this milestone; third-party dependency pins remain unchanged.

Resolve the delivery commit without a self-referential hash:

```sh
git log -1 --format=%H -- docs/milestones/0.3-I5.5/verification.md
```

Final delivery verifies local/origin SHA equality and a clean working tree. No main
merge, history rewrite, tag, publication or deployment is authorized or performed.
