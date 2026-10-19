# HTTP deadline attribution — 0.3-J increment 9 / alpha.24

2026-10-19, Node **24.21.0**, npm **11.19.0**, Linux. Started clean on
`develop/0.3` at `a2213560ee0a4e2d1bd8fba07b9a4a11b4bca3b9`; fetched
origin matched. Platform/Wydgine/WydHosting advance to **0.3.0-alpha.24**.
Gate **0.1.0-alpha.7**, Store **0.1.0-alpha.5**, standalone Client
**0.1.0-alpha.11** and other library versions remain unchanged. Search/Stream
peer compatibility includes alpha.24. No new dependency or deployment.

**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** The small controlled experiments did not
reproduce alpha.23's unforced deadline failures. Forced waits validate attribution
and commit boundaries; they do not prove a historical cause. No corrective runtime
change, deadline increase, automatic retry or release waiver is claimed.

Read with the [alpha.23 qualification](http-reliability-and-session-qualification.md),
[reliability issue](milestones/0.3-reliability.md),
[bounded evidence](../test-support/http-reliability-alpha24-evidence-2026-10-19.json)
and [handoff](work-in-progress/http-reliability-alpha24-handoff.md).
The alpha.23 failing records are retained unchanged.

## Instrumentation and lifecycle

Trusted `execution.observeHttp` enables one **process-local shared sampler** across
active observed Page HTTP requests, including preadmission failures. There is one
50 ms `setTimeout`, unreferenced so diagnostics alone cannot keep Node alive.
No observed requests means no sampler timer. Every request owns only fixed numerical
aggregates; finishing removes its window, and the last finish clears the timer.
The pipeline's existing outer `finally` finishes on success, timeout, cancellation
and exceptional exits, after admitted work and response cleanup settle. It stops
sampling before reading final output-port properties or calling the observer.
Observer exceptions remain isolated from transport results. No public debug route,
queue, event history, callback registration API or execution authority was added.

`wydgine.scheduling/1` records callback count, maximum actual callback lateness,
offset of that maximum (including the first on-time callback when the maximum is
zero), monotonic duration and unsampled final tail. Lateness is
`actual - expected`, clamped to zero and the request's observation window. A shared
timer already overdue before a new window cannot attribute earlier delay to that
window. Late callbacks rearm from actual execution time, without catch-up bursts.
The final tail is always marked `incomplete`. `pendingLatenessMs` and its offset
record an overdue callback's **lower bound**, separately from executed callbacks.
Thus zero executed callbacks / zero observed lateness cannot silently be read as
zero scheduling delay. Sub-50 ms stalls and activity after observation are not
fully covered. Neither lateness nor existing process-wide active/idle deltas
identify CPU use, descheduling cause, provider blame or per-request execution time.

Trusted `execution.observeHttp` or `execution.observeBudget` opts the Page's existing
ledger into `wydgit.ledger-progress/1`. Governance's ordinary meter observation
alone does not enable it. Direct trusted `executePage({observe})` also opts in.
Disabled ledgers allocate no progress state and make no additional monotonic clock
reads. The opaque budget and diagnostic controls never enter Wydgit facades/JSON.

Progress retains fixed phase IDs and existing fixed counter names. Page phase,
dispatch/handler, authorization/service and settlement boundaries retain monotonic
intervals, counter snapshots, check counts and existing completion-state snapshots.
A Page-owned sidecar counts entries into the ledger's **existing guard**, without
per-operation clock reads or any modification to the portable budget/events code.
Terminal deadline/closed checks do not reach that guard and are excluded from this
count; the original meter still records their exact first exhaustion. Checkpoint
intervals retain their phase, fixed boundary, counter snapshots and guard-entry
count. A window containing checks is never labelled unchecked. The largest
**observed** unchecked interval has no intervening guard entry. It is conservative,
not the exact global maximum; `exactUncheckedMaximum:false` and
`checkObservations` make these limitations explicit. Normal SEWN counters can
advance within a sampled interval; that is progress evidence, not a CPU meter.
Only per-phase first/last counters and fixed maxima survive, regardless of the
number of checks or handler calls. No stack, input/output, SQL, credential,
Session/App identity or native handle is retained.

Native handler entry/exit checkpoints use the existing Page's trusted handler
adapter, and workflows use its existing executor adapter. The dispatcher's timer
race, scope proxy and revocation remain unchanged. These boundaries were added
after the first experiment showed that outer dispatch boundaries alone missed the
held interval's attribution. A finished sidecar is idempotent and ignores late
callback observations after a native handler's timer race has already ended.
Service snapshots use the existing completion control at safe boundaries, including
after settlement. Overlapping service/phase durations are never subtracted.

## Controlled calibration and unchanged semantics

The deterministic tests use injected sampler callbacks/clocks and controlled
Date/monotonic clocks; calibration does not rely on CPU saturation or real sleeps.

| Control | Observed / asserted result |
| --- | --- |
| Responsive native handler barrier | 1,100 monotonic ms, 22 on-time callbacks, zero lateness; Load handler interval 1,100 ms, zero checks/counter delta/services, then timeMs exhaustion |
| Deliberately withheld synthetic callback | Expected 50 ms, executed 325 ms: 275 ms lateness at offset 325 ms; one callback, no catch-up burst |
| Final callback never delivered | End at 450 ms: zero callbacks, 400 ms pending lower bound, incomplete sampling |
| Concurrent observations / removal | One timer shared; removing one window preserves others; last removal clears it; canceled stale callback cannot contaminate a new generation |
| Exceptional / disabled observation | Throwing observer and exceptional output read release resources; disabled HTTP diagnostics allocate no sampler window/timer |
| Normal SEWN work | Steps advance across Load and PreRender snapshots; no false claim of provider activity or unchecked CPU work |
| Native handler timer | Controlled timer fires at the unchanged 10 ms context limit; late handle use is revoked with progress enabled |
| Equality / first exhaustion | Ledger accepts 999 ms and rejects exactly 1,000 ms before a service charge; later checks preserve the first exhaustion |

The ledger still starts **after request-tree hydration**, uses `Date.now()`, and
expires at `now >= deadline`. Diagnostics use `performance.now()`. A controlled
wall rollback yields zero clamped ledger elapsed while monotonic elapsed is 400 ms;
a later exact wall-clock deadline expires at monotonic 701 ms. Wall-clock changes
can therefore shorten or extend the ledger's monotonic lifetime. The instrumentation
does not replace or compensate for that clock. Clock migration requires separate
safety evidence and is outside this increment.

The six original HTTP probes passed three times, including the final sidecar
implementation. JSON/SQLite
precommit waits still return 500/not-committed, retain admitted I/O until settlement
and show no record after recovery. JSON's held post-rename operation still returns
500/indeterminate with one visible durable record, without replay. Real JSON/SQLite
connection loss still records guard cancellation, no published response and no
mutation. Held Load still fails at the unchanged ledger deadline with no services,
while sibling requests survive. The final forced held trace observed 26 callbacks,
22.652 ms maximum lateness, and first exhaustion 1,422/1,000 ms in Load: the wait
includes completing twelve siblings before the explicit 1,100 ms hold. This is
expected wall-time exhaustion, not evidence of a defective deadline.

## Overhead observations

`node test-support/http-diagnostics-calibration.mjs` alternates nine enabled/disabled
rounds after warmup. The retained run measured:

- 100,000 ledger checks: disabled median **5.131 ms**, enabled **5.508 ms**;
  difference **0.377 ms**. Static-clock tests independently prove no additional clock
  read at ledger checks.
- 1,000 awaited dispatch boundaries: existing diagnostics **0.303 ms**, progress
  enabled **1.257 ms**; difference **0.953 ms**.
- Simulated 100 concurrent windows over one second: 20 callbacks per window,
  **21 total timer allocations** including the pending last timer, one cancellation,
  **0.613 ms** processing. There are not 100 independent timer streams.

The earlier checks-only microbenchmark had a negative median difference within
noise and is retained too. These are local microbenchmarks, not a latency guarantee
or proof of universal overhead. They bound the intended operations on this runtime
well below the 1,000 ms budget. No per-SEWN-operation timing or very short sampling
timer was introduced. The fresh-fixture application comparison below shows no
material enabled-only delay under the small measured workload; it does not estimate
production overhead or exclude interference on other machines.

## Historical scenarios, run alone

`node --test test-support/http-attribution-probe.mjs` uses the existing hostname
and interactive Contact installation fixtures. No other suite ran concurrently.
The first 4/4 run passed; its Contact dataset grew between windows, so it is retained
as an explicitly confounded performance comparison. Both subsequent 4/4 runs use a
fresh,
identical installed dataset for each Contact window, in disabled/enabled/enabled/
disabled order. The table reports the final Page-sidecar run. Each window makes
one baseline submission followed by four concurrent
submissions; all writes have fresh fixture records and none is retried.

| Scenario | Result and attribution |
| --- | --- |
| Held Load, no siblings | HTTP 200, ledger 31 ms; zero callbacks over 38.756 ms, explicitly incomplete evidence |
| Held Load, twelve siblings | HTTP 200, ledger 337 ms; largest unchecked Load/handler interval 315.290 ms, no counters advance or service calls; five callbacks, 22.927 ms maximum lateness and 10.982 ms pending lower bound |
| JSON Contact, enabled windows | All 200/committed; baseline 67.800–73.333 ms, four concurrent submissions 267.895–367.226 ms; maximum callback lateness across these windows 18.769 ms |
| SQLite Contact, enabled windows | All 200/committed; baseline 67.049–67.474 ms, four concurrent submissions 254.247–352.571 ms; maximum callback lateness 42.631 ms |
| Disabled Contact controls | All 200/committed; JSON baseline 69.793–95.106 ms, SQLite 68.043–69.808 ms; disabled controls have no scheduler/progress records |

Across the final Contact comparison there were **40 successful POSTs** and eight
successful setup GETs, split equally by provider and diagnostic enabled/disabled
mode. Both held requests and all twelve siblings succeeded. No new unforced
first-exhaustion or cleanup-only LIMIT was observed in these small runs. Native
entries/completions, one reported commit per successful POST and publication states
are retained in bounded trace summaries and representative full records. Fixture
sequence numbers are local and carry no request identity.

These results do not reproduce alpha.23's Contact prerender/indeterminate or held
Load failures. They support the negative control: substantial request waiting can
coexist with callback opportunities and unchanged counters. They do not prove the
original four observations share a mechanism or that one provider is responsible.
**Checkpoint E is skipped:** there is no newly captured provider-associated failure
that justifies adding queue/transaction stages. `operation.begin()` has not been
reinterpreted as dequeue, and providers/dispatcher authority are unchanged.

## Qualification and retained failures

Focused instrumentation/completion/events/SEWN: **48/48**, zero skipped.
Original deadline/commit/disconnect/drain probes: **6/6 three times**, zero skipped.
Small historical observations: **4/4 three times**, no matching deadline failure.
Full and installed completion results are recorded below.

The initial calibration ran **20/21**: a new test compared an absent initial steps
counter against a number instead of the ledger's zero default. Correcting that
assertion yielded passing calibration; no runtime defect was hidden. An initial
sandbox run returned only aggregate file-level failures, while native tests exposed
actual results; sandbox output restrictions are not HTTP reliability evidence.
The first `npm test` attempt stopped in pretest before any tests: importing server
progress from the shared ledger reached the standalone Client closure. Moving
observation onto the Page's existing guard/handler adapters restored the original
portable budget/events code and all immutable Client bytes. The Client build then
passed; no published artifact or Client version was changed. This instrumentation
build regression is separate from the historical HTTP defect.
All alpha.23 failures and earlier comparisons remain retained.

The smallest next task is one isolated, bounded Contact workload with concurrency
as the only varied factor, using these observations. If a matching failure returns,
retain its scheduler tail, largest progress intervals, native completion and HTTP
publication before selecting provider stages or a correction. Do not overlap large
qualification suites, raise budgets or replay uncertain writes to force a result.


The first completed full suite was **1,537/1,538**, zero skipped. Its only failure
was the package-boundary negative version assertion still naming alpha.24 as the
next incompatible version. It now computes the next prerelease from the engine
version, preserving the exact engine/hosting compatibility assertion. No historical
HTTP deadline failure appeared in this run; the failed run is retained in evidence.


## Completion qualification

All commands below ran serially at normal repository concurrency with native
loopback/process access; no timing experiment overlapped a full or installed suite.

| Verification | Passed / total | Skipped |
| --- | --- | --- |
| Final instrumentation/completion/event/SEWN focused command | 48 / 48 | 0 |
| Version/package/launcher/transport focused command | 64 / 64 | 0 |
| Normal full `npm test` checkpoint | 1,538 / 1,538 | 0 |
| Final installed integration | 265 / 265 | 0 |
| Final installed provider | 35 / 35 | 0 |
| Final installed actual process supervision | 20 / 20 | 0 |
| Final installed unprivileged Linux | 25 / 25 | 0 |

`npm run check` passes: three complete pages, 42 internal links/anchors.
`npm ls --all --json` and `git diff --check` pass. Documentation relative file links:
**602**, zero missing. All **32 tracked Client distribution files**, engine runtime
assets and portable ledger/event implementation match starting HEAD. Final local
packs contain Wydgine **131**, Hosting **50** and Gate **13** files. No publication.

Two serial installed runs passed the same totals. The completion run includes the
last calibration refinement: an on-time callback records the offset of its zero
maximum, while a window with no callback retains null. Both installed runs prove
service-free acceptance, checkout-import denial and exactly one installed engine
per consumer. JSON/SQLite Store, Gate session lifecycle, BackOffice HTTP/UI,
authorization/cancellation and existing process/Linux boundaries are exercised.
These tests do not extend managed-hosting or browser/human accessibility claims.

The final required `npm test` and `npm run check` repeat follows this documentation
update. Its actual outcome is recorded in the delivery commit message and final
handoff response; the checkpoint above is an already completed passing run, not a
prediction. Earlier 20/21 calibration, pretest build failure and 1,537/1,538 version
failure remain explicitly retained. No unforced historical HTTP failure was found
in these source, installed or small controlled runs, and the issue stays OPEN.
