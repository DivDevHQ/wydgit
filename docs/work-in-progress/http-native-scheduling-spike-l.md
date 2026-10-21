# HTTP reliability Spike L — native operation scheduling

2026-10-20, `develop/0.3`, baseline `9ddea3bc12cb1f3da0fdd3a27f0b8460d6fc5ea1`.
**WYDGINE-0.3-HTTP-LIMIT remains OPEN. No runtime correction is retained.**
The bounded investigation demonstrates shared-loop interference and distinguishes
SQLite preflight delay from its transaction, JSON queueing, and native Promise
continuations. It does not establish a safe scheduler correction or a production
tail bound. Versions, transaction semantics, the exact 1,000 ms Page deadline,
frozen WydClient and the WydData architecture documentation are unchanged.

[Machine-readable evidence](../../test-support/http-native-scheduling-spike-l-evidence-2026-10-20.json)
contains every window, operation partition, remaining-budget distribution and
completion ordering. The hash-pinned
[source archive](../../test-support/http-native-scheduling-spike-l-source-2026-10-20.json.gz)
contains raw captures, independent controls and source text. The
[verification record](../../test-support/http-native-scheduling-spike-l-verification-2026-10-20.json)
records exact final qualification results. Prior Spike F–K evidence is preserved.

## Scheduling topology and observation limits

Reviewed contracts: [development](../DEVELOPMENT.md),
[founding architecture](../FOUNDING-ARCHITECTURE.md), [SEAM](../seam.md),
[SEWN/budgets](../sewn.md), [HTTP reliability](../http-reliability-and-session-qualification.md),
[concurrency](../http-concurrency-qualification.md), [release status](../milestones/0.3-release-status.md),
[open issue](../milestones/0.3-reliability.md), and investigation reports
[F](http-scheduling-attribution-spike-f.md), [G](http-prerender-integrity-spike-g.md),
[J](http-production-observer-spike-j.md), [K](http-post-commit-critical-path-spike-k.md).
The implemented path is under `packages/wydgine/src/engine/` and
`packages/wydstore/src/`; root `wydgine/` modules are compatibility exports.

| Stage | Actual mechanism and observable boundary |
| --- | --- |
| SEAM/workflow dispatch | `events/runtime.js` and `sewn/execute.js` await sequential instructions/arguments/services. Already resolved awaits use Promise reactions; they do not guarantee an event-loop turn. Live context, placement, capability and ledger checks run synchronously. |
| Page service admission | `execution/page.js` authorizes the Session, maps storage input, and calls `completion.run`. These authorization/mapping steps precede the native dispatch marker. They remain inside the Page budget. |
| Native invocation | `execution/completion.js` checks the live Page ledger and schedules work with `Promise.resolve().then`. `dispatch` to `workEntry` observes that existing initial reaction. There is no separate native-operation queue. |
| Library entry | `libraries/index.js` and `libraries/dispatch.js` perform synchronous context/capability/input/result checks and awaited authorization/handler wrappers. Store entry is the first line of `core.js` execute. Store ownership/scope/site policy remain fresh. |
| Installed integrity | `seam/context.js` invokes `packages/index.js:guardInstalledExecution`. Each stamp performs the same seven synchronous BigInt `lstatSync` inspections. Changed metadata invokes existing validation/restamping. Spike K's immutable lexical paths remain resolved once per binding. |
| SQLite preflight | `sqlite-adapter.js:transaction` awaits ancestor/root, database/sidecar metadata and lifecycle-lock inspection. Node filesystem requests use the libuv filesystem worker pool. Worker submission-to-JavaScript callback includes unknown worker/OS time and delayed delivery. No SQLite JavaScript queue serializes these preflights. |
| SQLite execution | `better-sqlite3` opens/configures, validates metadata, runs deferred/immediate transactions, checks the ledger before commit and closes synchronously on the server event loop. Lock waits, if present, block that thread too. The per-operation transaction bracket includes these steps, not just SQL engine execution. |
| JSON execution | `json-adapter.js` chains cooperating handles through the existing per-file Promise queue. Work then awaits root/lifecycle/lock checks, document read/validation, temp write/fsync, atomic rename, directory sync and lock cleanup. Parsing, validation and serialization run synchronously. Queue duration includes delayed predecessor execution/cleanup and reaction delivery; work duration includes filesystem awaits and loop interference. |
| Provider completion | A test-only marker at each transaction's final existing `finally` follows database close or JSON cleanup/queue removal. It is producer completion, not disk completion. A wrapper tags the returned original Promise without adding a reaction. |
| Promise settlement | An independent opt-in `async_hooks.promiseResolve` observer tags only provider and completion-task Promises. These producers return plain data after their last await; a regression explicitly verifies the task's adopted pending Promise settles before recording the marker. This is not a general hook for arbitrary thenable readiness. |
| Callback delivery | Existing FSREQPROMISE `before/after` marks JavaScript callback entry/exit. Its init-to-before interval is **not filesystem execution time**. Existing recovery/resume reactions follow it; no worker-ready timestamp is inferred. |
| Native/Page continuation | `completion.run`'s existing await-finally, then `diagnostics.measure('service')`'s await-finally. Later interpreter ticks, result conversion, procedure return and event handling follow. Page continuation here is the service wrapper, not completion of all SEWN instructions. |
| Canonical publication | Clear, acknowledgment and each queried-entry Insert validate/publish independently through Page/controller canonical assignment. Later requests' synchronous validation/publication can occupy the loop while a peer awaits filesystem delivery. No setter is batched or deferred. |
| Remaining workflow/HTTP | PreRender reconstruction, activation/reconciliation, render, unload/dispose, ledger close and admitted-native drain precede response handoff. Provider commit is independent of Page success and client receipt. |

Directly observed: marker order/monotonic intervals, synchronous transaction and
fresh-stamp brackets, exact tagged Promise settlement in dedicated windows,
callback entry/reaction boundaries, authoritative remaining budget, client receipts,
aggregate provider reconciliation and request completion ordering. Unknown:
Contact's exact worker-ready times, physical storage latency, pool queue time,
individual GC/OS-preemption contributions and exclusive JavaScript CPU. Callback
spans and synchronous brackets measure wall elapsed; they can include preemption.
The isolated syscall experiment below supplies independent completion evidence,
not a replacement timestamp for any Contact filesystem call.

## Bounded attribution and independent overhead

Only test support changes. `native-scheduling-hooks.mjs` uses strict in-memory
module-load anchors; shipped modules never import the sidecar. Existing diagnostic
hooks supply the Date.now ledger and FS correlation. No await, Promise reaction,
timer, retry, filesystem inspection, authorization or deadline decision is added
to the observed source path. The small provider wrapper returns the original
Promise; its call/argument overhead is included in calibration and limitations.

Primary `timing` adds native boundaries and a monitor-only 10 ms histogram to
HTTP diagnostics and the existing deadline ledger. `costs` additionally brackets
fresh stamps. `promise` adds exact settlement observation; `callbacks` adds the
existing FS hook and callback spans. These expensive observers run in separate
windows. Off controls load none of the new hooks, ledgers or monitors.

Each capture accepts numeric request 0–12, operation 1–64, at most 128 rows and
4,096 synchronous spans (API ceilings 512/4,096). Exact Promise tracking retains
at most 1,664 tagged IDs; other Promise resources have weak keys only. Teardown
disables the hook and releases maps. No payloads, record IDs, SQL, credentials,
package paths, execution contexts or controls are captured. All retained primary
captures have zero dropped native/ledger/FS/callback rows and zero hook errors.
Unknown timing/commit fields stay null when the corresponding observer is off.

Per-operation partitions join that request's ordered boundaries. Peer-stamp and
peer-callback occupancy use clipped interval **unions in the same process and
operation interval**; nested/overlapping spans count once. They are lower bounds
for the recorded family, never summed with each other, provider time, histogram
maxima, or independent quantiles. Histograms include setup GET/client supervision
and have sparse samples during stalls. No observer overhead is subtracted.

Independent controls: three fresh processes; one warmup per mode; nine measured
alternating rounds; identical 30,000 synthetic Promise operations and thirty
setImmediate boundaries, no Page or provider. Each observed operation creates and
finishes a bounded capture; this intentionally measures retention/allocation too.
Median elapsed ms by process:

| Observer | Process 1 | Process 2 | Process 3 |
| --- | ---: | ---: | ---: |
| Off | 6.527 | 6.718 | 7.106 |
| Boundary markers | 34.525 | 35.340 | 36.563 |
| Markers plus stamp bracket | 39.962 | 38.956 | 39.972 |
| Markers plus Promise hook | 83.194 | 83.872 | 89.013 |

The synthetic off mode retains no-op marker calls; the comparison measures
activation/retention overhead, not the entire cost of inserting source markers.
These are synthetic overhead measurements, not Contact cost estimates. Actual
serial client medians off/timing/costs/promise are 90.679/90.093/89.097/89.004 ms;
small differences do not establish a performance improvement. Prior Spike J's
independent filesystem-hook calibration remains applicable to callbacks mode.

## Fixed concurrency matrix

61 fresh server workers, 528 POSTs; no concurrent suites/calibration. The existing
separate-client Contact harness uses an empty installed store, setup GET, identical
CSRF/Session/payloads, loopback HTTP/1.1 without keep-alive, maxSockets 12, zero
admission spacing and no retries. Every window reconciles through a fresh authorized
provider query after all responses settle. All server/client workers exit 0,
clients are reaped, cleanup completes and no unexpected status occurs.

Three off and three timing windows per configuration, alternating off/timing order
by round; ten additional SQLite concurrency-12 off windows; three costs and three
promise windows each for SQLite 1, SQLite 12 and JSON 12, alternating costs/promise
order; finally three SQLite 12 callback windows. The runtime is the starting HEAD
throughout. There is **no candidate runtime and no before/after correction claim**.
The off/observed pairs qualify observation effects, not a fix. Prior K failure
counts are historical evidence, not a matched control for these windows.

Environment: Node 24.21.0, Linux 7.0.0-38-generic, Ryzen 7 7735HS, sixteen logical
CPUs, default four libuv workers, local temporary filesystem. Host load, frequency,
GC and OS preemption remain uncontrolled. Workers are bounded to 45 s and 16 MiB
stdout, stderr 64 KiB; series ceiling ten minutes with parent-owned scratch cleanup.
The raw archive preserves configurations, supervisor outcomes and each request's
provider/Page/client completion order. Ordinals identify requests, not admission
priority; unequal numbers of returned entries mean unequal Page work.

All values below are ms, nearest-rank quantiles. Each native distribution includes
both create and query; the archive preserves them separately by operation ordinal.

| Provider/concurrency | Off HTTP 200/500 | Timing HTTP 200/500 | Timing client median/p90/p99/max | Native median/p90/p99/max |
| --- | ---: | ---: | --- | --- |
| SQLite 1 | 3/0 | 3/0 | 90.093 / 94.694 / 94.694 / 94.694 | 2.879 / 13.764 / 13.764 / 13.764 |
| SQLite 4 | 12/0 | 12/0 | 307.493 / 359.919 / 370.218 / 370.218 | 82.990 / 120.982 / 160.614 / 160.614 |
| SQLite 8 | 24/0 | 24/0 | 656.290 / 782.594 / 834.670 / 834.670 | 211.166 / 295.603 / 360.774 / 360.774 |
| SQLite 12 | 36/0 | 36/0 | 1024.594 / 1287.651 / 1407.006 / 1407.006 | 328.319 / 597.852 / 719.127 / 719.127 |
| JSON 12 | 36/0 | 36/0 | 982.572 / 1236.580 / 1304.603 / 1304.603 | 318.859 / 559.358 / 649.328 / 649.328 |

Off client median/p90/p99/max: SQLite 1 90.679/95.228/95.228/95.228; SQLite 4 293.873/345.769/366.571/366.571; SQLite 8 624.986/742.040/817.497/817.497; SQLite 12 996.643/1244.827/1314.971/1314.971; JSON 12 973.165/1208.230/1284.389/1284.389. Exact unrounded values are authoritative in JSON.
Ten additional SQLite off windows pass **120/120**, client median **960.500 ms**.
Together SQLite off concurrency-12 controls are **156/156**, not proof rare failures
are absent. Total SQLite **384/384**, JSON **144/144**; all **528/528 records**
reconcile. Observed windows report **297 commits and 594 completed native operations**,
zero pending. Off commits/native counts are unknown and are not inferred from records.

Remaining Page budget at final native settlement, minimum/median/p90/max:
SQLite 1 **946/951/960/960**, SQLite 4 **692/797/839/860**, SQLite 8
**286/552/657/683**, SQLite 12 **65/238/390/465**, JSON 12
**162/275/409/453**. At Page return: **928/933/942/942**,
**671/755/799/835**, **237/512/615/633**, **11/183/319/402**,
**116/220/345/386**, respectively. These use the original authoritative Date.now
end; diagnostic offsets use performance.now. Client latency can exceed 1,000 ms
because HTTP admission/preparation precedes the Page ledger.

Timing histogram maxima by window: SQLite 1 **67.699/55.738/61.800**;
SQLite 4 **107.151/105.185/121.307**; SQLite 8 **235.536/273.154/283.902**;
SQLite 12 **607.126/585.630/365.167**; JSON 12 **392.954/396.362/360.710**.
They cannot be added to native latency or assigned to a particular request.

## Where the observed native interval goes

SQLite timing at concurrency 12: median provider entry-to-final-cleanup **327.611 ms**,
entry-to-transaction **325.133 ms**, synchronous transaction bracket **1.912 ms**
(p90 **2.719**, max **13.535**). The large interval grows before the transaction;
synchronous SQLite work does not explain hundreds of ms in these captures. External
lock contention remains possible elsewhere; no transaction/locking/durability change
is justified by this sample. Serial native median is **2.879 ms**.

Exact Promise windows independently confirm the small tail (72 operations/provider):

| Disjoint boundary | SQLite median/max | JSON median/max |
| --- | --- | --- |
| Invocation to initial work reaction | .0184 / .0372 | .0175 / .0352 |
| Work reaction to Store entry | .2972 / .6231 | .2720 / 4.6550 |
| Store entry to provider entry | .0535 / .1099 | .0516 / .1829 |
| Provider final producer to provider settlement | .00365 / .03803 | .00318 / .06738 |
| Provider settlement to completion-task settlement | .12294 / .38188 | .18526 / .36603 |
| Task settlement to native await-finally | .00260 / .01553 | .00297 / .01195 |
| Native await-finally to Page service-wrapper continuation | .00517 / .03282 | .00521 / .01485 |

Thus a delayed **native-operation continuation after settlement** is rejected as
the dominant Contact mechanism in these windows. This does not reject microtask
interference before callbacks, or claim bounded reaction delay under arbitrary work.

JSON timing provider median **318.334 ms** includes queue median **279.743 ms**
(p90 **507.440**, max **602.488**) and active work median **15.636 ms**
(p90 **66.875**, max **410.044**). These quantiles are not additive; each raw
operation has its own ordered queue/work boundaries. JSON has actual serialized
provider queueing, unlike SQLite's async preflight. Its work interval still includes
loop-delayed filesystem callbacks and cleanup, so it is not pure I/O or CPU time.

Costs windows directly identify competing requests' fresh integrity inspections:
clipped peer-stamp overlap inside provider intervals median/p90/max is SQLite
**54.763/128.923/155.324 ms**, JSON **50.912/129.393/157.763 ms**. This establishes
cross-request interference from mandatory synchronous work without removing a
single inspection. It is a measured family lower bound, not an attribution of the
whole remaining wait to filesystem workers.

Callback windows find peer request callbacks occupying **53.4–65.1%** of each
observed SQLite dispatch-to-native-continuation interval (median **60.8%**), using
same-operation unions of recorded callbacks lasting at least .5 ms. Median peer
occupancy is **214.058 ms**. These callbacks include workflow, canonical mutation,
installed guards and diagnostics; their wall span is not exclusive CPU or a reason
to discard one boundary. Callback init-to-before maxima are
**583.399/651.881/611.053 ms**. Callback-exit to existing recovery/resume reaction
maxima are **.0865/.0673/.0707 ms**. Resource init precedes worker completion;
there is no unsupported inference about when Contact I/O became ready.

Independent actual-filesystem control: the existing lifecycle-lock helper submits
twelve absent-name lstats, with and without 120 ms synchronous pressure, three
fresh processes each in alternating order. `strace -T` supplies actual metadata
syscall elapsed durations and request ordinals from fixed fixture names. All 72
syscalls reconcile without unmatched split lines. No-pressure syscall median/max
**.023/.084 ms**, pressure **.026/.066 ms**; resource-init-to-callback median/max
**1.300/1.928 → 121.854/122.332 ms**. The syscalls complete during the main-thread
pressure. Approximate syscall-end-to-callback median **1.201 → 121.691 ms** uses
strace realtime bridged by performance.timeOrigin; clock bridging is explicitly
approximate. The monotonic init/callback and syscall-duration observations are
independent. This demonstrates delayed filesystem delivery without increasing
actual metadata execution; it does not partition all Contact worker waits.

## Fairness, microtasks and adversarial semantics

Three fresh windows per pressure mode, four real concurrent Pages, one shared
release barrier. The test library supplies **synthetic native commit reports**,
not durable provider commits. All four producers finish before the long Page's
pressure starts. Every Page retains its original 1,000 ms ledger. Captures include
statuses, first exhaustion, pending counts and every continuation/completion order.
These fairness statuses are selected Page HTTP responses sent to an in-memory
test port; they are not additional loopback HTTP samples.

| Long Page work | Short Page continuation delay after producer completion | Result |
| --- | --- | --- |
| 120 ms synchronous pressure | 123.657–125.264 ms | All 12/12 Pages HTTP 200 |
| 1,100 ms synchronous pressure | 1103.869–1105.692 ms | All 12/12 Pages HTTP 500, timeMs exhaustion, indeterminate; zero pending |
| 250,000 resolved-Promise awaits | .096–4.208 ms | All 12/12 HTTP 200; runnable peers interleave |
| Actual Page.Load SEWN loop, 900 iterations / 2,704 shared-ledger steps | 1.780–3.640 ms | All 12/12 HTTP 200; short Pages complete while the long workflow progresses |

Pressure-mode timer delivery is delayed **56.680–64.492 ms** by the Promise chain
and **43.045–49.191 ms** by the workflow case, even though already runnable peers
can progress. Microtask chains therefore delay unrelated I/O/timer delivery without
necessarily monopolizing already queued Promise reactions. No arbitrary production
yield is added. The trusted synchronous pressure demonstrates temporary starvation
and collateral deadline exhaustion; it does not prove an ordinary single SEWN
instruction can run for 1,100 ms. Finite Contact samples show completion of every
request, not a scheduler fairness guarantee or absence of starvation under all work.

Enforcement remains cooperative. In the spin experiment, setters reachable from a
live facade can complete after the deadline before the next existing ledger check
rejects the Page. No success is returned for the later failing Page. This matches
K's documented publication/check distinction; the test does not add a new setter
budget check or roll back an already published local state. A new assertion that
incorrectly expected no late setter publication failed initially (213/214 focused);
it was corrected to assert delayed continuations and all authoritative deadline
failures. Existing security/publication assertions were not changed.

The active-hook differential reuses K's deterministic success, provider error,
precommit deadline, synthetic commit then late continuation, canonical rejection,
render failure, handoff failure and cancellation scenarios. Status/body/state/native
outcomes match observers-off source execution. Real Store uncertain rename/commit,
rollback and durability remain independently covered by operation-completion/provider
tests. Installed regressions exercise revoked authority, stale/retired bindings,
generation fences, tampering/restored timestamps/symlinks, receipt verification,
recovery barriers, concurrent isolation and intermediate canonical visibility.

## Retained work, semantic proof and next bounded step

Retained: default-disabled test-side native/Promise/provider markers, same-window
attribution, independent calibration, reproducible matrix/pressure tools, regression
and evidence validation. **No shipped runtime optimization or scheduler change.**
The measured native-continuation tail is too small to justify changing its ordering.
The large synchronous integrity family cannot be suppressed or cached safely merely
because it repeats. JSON's real queue preserves document atomicity and cleanup.
No bounded experiment here proves a redundant computation can be removed without
changing one of those boundaries. Stopping at verified diagnostics is the explicit
fallback allowed by this mission, not a claimed runtime fix.

All source security decisions and their order remain byte-identical to starting
HEAD: SEAM/Gate/Store ownership/scope, fresh metadata and receipt decisions,
cancellation, recovery/retirement/generation barriers, commit checks, native drain,
canonical validation and per-setter publication. There is no queue, batching,
operation detachment, parallel SEWN execution, live-decision cache, retry, budget
extension or success-on-commit rule. Test-side observers cannot grant authority;
no raw capability enters ordinary code. Frozen Client imports/artifacts, prior
Spikes and WydData/CIR/BackOffice behavior are untouched.

Recommended next bounded step: isolate one synchronous controller
activation/reconciliation operation on a fixed twelve-entry Page. Count repeated
immutable snapshot/placement/operation-descriptor derivations separately from live
context/metadata checks; test reuse only within that synchronous operation against
intermediate publication, tamper and cancellation adversaries. Do not remove live
checks or introduce fairness yields without a separate semantic proof. If those
derivations are immaterial, stop rather than redesigning scheduling. Physical
worker-ready attribution remains unknown for Contact; a future tracing effort must
correlate actual native completions instead of interpreting async-hooks entry as I/O.

This sample does not reproduce the historical indeterminate HTTP failure without
injected pressure. K's three corrected failures and J/K observer-disabled failures
remain valid. **WYDGINE-0.3-HTTP-LIMIT stays OPEN**; no before/after reliability
improvement, release waiver, deployment or version bump is claimed.

## Reproduction and verification

Run sequentially with local TCP/native process access, dependencies and strace;
all output directories must be new. No uncertain write is replayed.

```sh
node test-support/native-scheduling-probe.mjs /tmp/NEW-l-matrix
node test-support/native-scheduling-experiments.mjs /tmp/NEW-l-controls
node test-support/native-scheduling-evidence.mjs /tmp/NEW-l-matrix /tmp/NEW-l-controls
node --test test/native-scheduling.test.js test/native-scheduling-integration.test.js test/native-scheduling-evidence.test.js
npm run check
npm test
node scripts/verify-packed-packages.js
```

The source archive also records initial setup-only marker-anchor failures and
exploratory fairness limitations; they are not HTTP samples. The first final
workflow fixture used a rejected method-style trusted handler; correcting it to
the required parameterless function preserved the runtime rule. Final exact
verification counts and preserved initial failures are in the linked verification
record. Normal commit/push to origin/develop/0.3 is authorized; final commit and
remote/clean-tree proof are supplied in the delivery handoff. No publish/tag/release
or deployment is part of qualification.
