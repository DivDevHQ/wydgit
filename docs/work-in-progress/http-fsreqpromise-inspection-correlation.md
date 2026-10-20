# SQLite inspection FSREQPROMISE attribution — increment 16

2026-10-19, Linux, Node v24.21.0. Started clean on `develop/0.3` at
`0c4ba084ec16c4df62d51f1c381d1ff2cdd03999`, tracking `origin/develop/0.3`.
Platform/Wydgine/WydHosting remain `0.3.0-alpha.28`, Store `0.1.0-alpha.8`;
Gate and Client unchanged. Diagnostic spike C establishes inspection correlation
for one bounded Contact window. **WYDGINE-0.3-HTTP-LIMIT remains OPEN.**

[Portable evidence](../../test-support/http-fsreqpromise-inspection-evidence-2026-10-19.json)
retains every request outcome, setup, full sanitized diagnostics, original runner
failure, artifact hashes, all resource mappings and per-native-call timelines.
The [previous Contact spike](http-fsreqpromise-contact-correlation.md),
[isolated spike](http-fsreqpromise-correlation-spike.md) and
[alpha.28 handoff](http-reliability-alpha28-handoff.md) are historical context;
observation conditions differ and their timings are not equivalent experiments.

## Capture boundary and identity

`inspectFiles` awaits `safeRoot`, then sequentially awaits the database, journal,
WAL and SHM `lstat` operations. `safeRoot` sequentially awaits each root path
segment's `lstat`, then `realpath`. This fixture has five root segments: each
inspection therefore contains **nine individual lstat operations**, not one.
Root and file validation still run in their existing order. `realpath` remains
unobserved inside an explicitly retained inspection gap.

Each `lstat` is split into invocation and its original await. Optional synchronous
`start` and `invoked` markers bracket the actual fs/promises invocation; the
FSREQPROMISE resource is initialized synchronously between these markers. A
`resume` marker in the existing await's finally observes both fulfillment and
rejection before existing validation/ENOENT handling. The same Promise is awaited;
no Promise reaction, timer, filesystem call or scheduling barrier is added.
This also covers ENOENT sidecars. Missing database still produces STORE.CORRUPT.

The host-only `execution.observeSqliteInspection` option is effective only with
existing diagnostic timing. It is absent by default and never enters canonical
inputs or public HTTP records. The test-only probe retains numeric request index,
Page-local native ordinal, distinct inspection ordinal, unique filesystem call
ordinal, and fixed `rootLstat`/`sqliteFileLstat` stage plus segment/sidecar ordinal.
Lifecycle observations keep their independent invocation identities. Native call
1 creates and call 2 queries; both belong to their original request. Async context
provides identity, never resource selection.

Acceptance reuses the lifecycle rule: exactly one FSREQPROMISE candidate initialized
within the synchronous invocation window, matching execution trigger, unique
resource mapping, exactly one before/after pair, and the same operation's existing
continuation after hook after. Inspection accepts fulfillment or rejection;
lifecycle still requires its existing recovery entry. Missing markers/resources
are missing; multiple candidates, resource overflow or hook error are ambiguous.
No timestamp-nearness matching is used. The final artifact audit additionally
checks all identities, nine operations per inspection, native/continuation counts,
transaction-entry counts and globally distinct resource IDs.

The hook is enabled only by explicit test/qualification opt-in. This Contact window
caps filesystem observations and cumulative resources at 512, and inspection
records at 512; probe absolute configuration limits remain enforced. Numeric
counters saturate at one million. Fields and stages are fixed, without paths,
SQL, payloads, credentials or unbounded runtime histories. Hook callbacks only
perform synchronous numeric bookkeeping, catch failures and stop safely. Inspection
call/resource exhaustion stops the hook. Observer failures cancel it without
changing Store behavior. Cancellation and harness finally stop it and release all
lookup state; shutdown drains native work before fixture removal. Offline event
lists are derived from the bounded retained records after the run.

## One Contact window and audit correction

```sh
node test-support/http-concurrency-probe.mjs --output /tmp/contact-fsreq-increment16 --inspection-correlation
```

One fresh SQLite fixture, separate supervised client process, unchanged Contact
workload and 1,000 ms Page deadline, no concurrent suites or write retries.
Actual overlap: **12 client / 12 server / 12 admission / 12 Page**.

- **12 POSTs: 1 HTTP 200, 11 matching prerender deadline HTTP 500/indeterminate**.
  Successful request 11 has no ledger exhaustion. Every response is fully received
  and published. Setup GET is 200.
- **12 reported commits, 24 settled native calls, zero pending**. Reported commit
  does not establish successful client receipt.
- POSTs: **24 inspections / 216 individual inspection operations**, all uniquely
  correlated; **24/24 lifecycle mappings** unique. Setup adds one inspection/nine
  operations and one lifecycle invocation: **250/250 total mappings**, zero missing,
  ambiguous, dropped calls/resources or hook errors.
- **23 POST synchronous transactions entered**. Request 9's query (native call 2)
  exhausts at the pre-transaction guard; its transaction markers are correctly
  absent and its native call still settles. All twelve create transactions commit.
- Hook stopped, zero tracked resources. Client exits zero and is reaped; fixture
  cleanup succeeds. No workload rerun.

The original runner exits **1**, retaining `series-incomplete`: its new timeline
audit wrongly required transaction entry for every call. The raw window has no
fixture or correlation failure. The corrected audit permits paired absent
transaction markers and checks entered counts against existing native-stage
counts. The complete retained artifact passes an independent audit with that rule.
A controlled pre-transaction rejection regression verifies this case. Only the
runner audit and tests changed after the reproduction; capture/runtime code did
not. Original summary and hashes remain preserved, without rewriting failure.

## Per-operation timeline and overlap

All event timestamps below and in `timelines[].events` use the **server worker's
performance.now clock**, in milliseconds. Each event is `[timestamp, fixed stage,
filesystem-call identity or null]`. All 25 native calls, including setup, retain
inspection entry/start, every filesystem invocation/init/invoked/before/after/
continuation, inspection completion/continuation, lifecycle entry and each
lifecycle marker, transaction boundaries when entered, native settlement, and
first/last existing Page-ledger native checks. `window.resourceCorrelation.calls`
retains full hook counts and mappings. No raw monotonic client/server subtraction
is made. Client intervals stay in their separate process clock.

This compact table shows containing stage boundaries; the evidence expands each
inspection into its nine filesystem operations. Call 1 and call 2 remain related
by request identity. Inspection spans include their filesystem subspans, and
lifecycle columns start at invocation (the separate entry event is also retained).

| Request / call | Inspection entry–continuation | Lifecycle invocation–continuation | Synchronous transaction | Native settlement |
| --- | --- | --- | --- | --- |
| 1 / 1 | 629.489–1060.081 | 1060.171–1061.160 | 1061.237–1074.613 | 1075.159 |
| 1 / 2 | 1128.236–1545.844 | 1545.858–1546.288 | 1546.339–1548.365 | 1548.769 |
| 2 / 1 | 668.356–1060.256 | 1060.294–1128.392 | 1128.447–1131.195 | 1131.303 |
| 2 / 2 | 1166.611–1545.893 | 1545.901–1603.215 | 1603.275–1604.565 | 1604.820 |
| 3 / 1 | 705.631–1060.361 | 1060.386–1166.740 | 1166.792–1168.809 | 1168.935 |
| 3 / 2 | 1199.200–1545.930 | 1545.936–1646.869 | 1646.926–1647.904 | 1648.046 |
| 4 / 1 | 742.754–1060.435 | 1060.452–1199.344 | 1199.403–1201.445 | 1201.545 |
| 4 / 2 | 1236.870–1545.965 | 1545.971–1685.934 | 1685.988–1686.893 | 1687.059 |
| 5 / 1 | 778.181–1060.499 | 1060.525–1237.051 | 1237.151–1239.480 | 1239.608 |
| 5 / 2 | 1282.353–1546.000 | 1546.006–1723.340 | 1723.446–1724.714 | 1724.892 |
| 6 / 1 | 816.759–1060.588 | 1060.606–1282.489 | 1282.553–1284.637 | 1284.749 |
| 6 / 2 | 1323.326–1546.038 | 1546.045–1760.404 | 1760.481–1761.476 | 1761.635 |
| 7 / 1 | 863.337–1060.660 | 1060.677–1323.531 | 1323.586–1326.553 | 1326.805 |
| 7 / 2 | 1374.143–1546.072 | 1546.081–1798.621 | 1798.678–1799.681 | 1799.831 |
| 8 / 1 | 908.273–1060.752 | 1060.788–1374.334 | 1374.423–1376.775 | 1376.951 |
| 8 / 2 | 1409.149–1546.117 | 1546.123–1840.018 | 1840.152–1841.080 | 1841.217 |
| 9 / 1 | 946.969–1060.847 | 1060.871–1409.301 | 1409.360–1411.333 | 1411.429 |
| 9 / 2 | 1444.252–1546.218 | 1546.224–1969.024 | not entered | 1969.464 |
| 10 / 1 | 983.234–1060.915 | 1060.940–1444.380 | 1444.431–1446.507 | 1446.591 |
| 10 / 2 | 1473.901–1546.184 | 1546.190–1960.126 | 1960.245–1961.288 | 1961.449 |
| 11 / 1 | 1018.429–1060.993 | 1061.010–1474.020 | 1474.068–1476.668 | 1476.753 |
| 11 / 2 | 1510.957–1546.152 | 1546.159–1880.450 | 1880.539–1881.469 | 1881.604 |
| 12 / 1 | 1053.552–1061.061 | 1061.087–1511.076 | 1511.127–1513.207 | 1513.299 |
| 12 / 2 | 1543.457–1546.248 | 1546.253–1972.781 | 1972.873–1974.271 | 1974.454 |

Within an individual filesystem operation, invocation→before, before→after, and
after→continuation are disjoint measured intervals. The synchronous invocation
window nests inside invocation→before. Filesystem spans are sequential within one
inspection and nest in inspection's entry→completion. Inspection gaps are recorded
between those nonoverlapping filesystem spans; they include realpath, validation,
continuations and marker overhead. They are **not measured synchronous execution**.
The maximum total such gap within a POST inspection is **0.607457 ms**.

Across requests, both inspection and lifecycle reach **twelve overlapping spans**.
For example, request 2's first lifecycle interval overlaps request 1's measured
transaction at 1061.237–1074.613. That transaction accounts for only one directly
observed subinterval of the pending wait. Unpartitioned work and scheduling gaps
remain. Request 1's first settlement to its second inspection entry is another
unpartitioned **53.076062 ms** gap. Nothing in this evidence classifies it as CPU.
Do not add overlapping waits, containing/contained intervals, or maxima from
different operations to estimate total execution. Cross-operation totals in the
numeric summaries are sample aggregates, never elapsed request/runtime totals.

Native check events are immediately before existing completion.check calls into
the Page ledger; first/last plus bounded count are retained. The raw Page progress
record contains phase counts, charges, largest checkpoint and zero-check intervals.
Its separate monotonic origin was not exported, so its offsets cannot be exactly
aligned to this absolute timeline. Ledger deadline anchors use Date.now and are
not converted into monotonic events. First exhaustion phase is prerender for all
eleven failures; exact first-exhaustion timestamps and native entry before
inspection are unobserved. This is an explicit partial timeline at those boundaries.

## Findings and limits

POST per-filesystem-operation maxima in milliseconds:

| Same-run observation | Invocation→hook before | Hook before→after | Hook after→existing continuation |
| --- | ---: | ---: | ---: |
| Inspection (216) | 424.115782 | 0.023364 | 0.114215 |
| Lifecycle (24) | 449.949323 | 0.025819 | 0.121829 |

Lifecycle's continuation column ends at existing rejection recovery entry;
inspection's ends at its existing await continuation. Every inspection operation's
invocation→before exceeds its own after→continuation. Long observed inspection
and lifecycle waits therefore precede resource callback activity in this run.
This supports boundary **A**, with cross-request overlap **D** preserved. It does
not support a dominant post-hook continuation delay (**B**) or dominant synchronous
inspection work (**C**). Unpartitioned gaps (**E**) remain explicitly recorded.

The largest first inspection is request 1: its first root lstat is invoked at
629.544304, hook before at 1053.660086, hook after at 1053.665837, and existing
continuation at 1053.677288. Inspection completes at 1060.058263 and its outer
continuation runs at 1060.081497. Other operations remain distinct in evidence.

The 23 directly bracketed synchronous transactions range **0.904987–13.376077 ms**,
including open/setup, transaction execution and close, plus boundary overhead.
No await occurs inside these brackets; elapsed time still does not measure CPU
usage or distinguish OS scheduling. The long lifecycle delays in this run are
larger than the prior spike's, despite identical HTTP outcome counts. That is
contextual variability, not evidence of improvement or observer neutrality.

Maximum callback lateness is **438.285877 ms**, pending lateness lower bound
**240.439866 ms**, checkpoint interval **525.614410 ms**, observed zero-check
interval **5.850083 ms**. All twelve sampler tails are incomplete. Checkpoint
intervals can contain checks; these are not exact maximum unchecked times.

FSREQPROMISE hooks observe callback execution, not physical I/O completion,
thread-pool scheduling/execution, disk latency or exact Promise settlement.
Global hook dispatch, clock reads and marker overhead are uncalibrated. Controlled
resource-count equivalence finds no added Promise/timer/immediate/filesystem
resources; this does not prove timing neutrality. No specific material observer
interference is established by this single run. Deadlines, SEWN.LIMIT, authorization,
lifecycle validation, cancellation, commit/receipt distinction and isolation remain
unchanged. No runtime correction or alpha.29 release is justified.

One next experiment: add fixed synchronous start/end markers around the existing
Page action/prerender work between native settlement and the next inspection entry
in one otherwise identical bounded window, to partition the observed 53 ms gap.
Do not add Promise reactions or alter deadlines.

## Verification

Final focused selection:

```sh
node --test --test-isolation=none test/fsreqpromise-inspection-correlation.test.js test/fsreqpromise-contact-correlation.test.js test/fsreqpromise-correlation.test.js test/lifecycle-lstat-timing.test.js test/http-diagnostics.test.js test/wydstore-sqlite.test.js test/operation-completion.test.js test/native-stage-timing.test.js
```

**71/71 pass**, zero failures, cancellations or skips, including **14/14** new
inspection cases. Fourteen new cases cover unique/individual mappings, shared native
identity, twelve concurrent pairs, unrelated work, ENOENT, missing database,
disabled observation, factory/marker failure, cancellation, ambiguity, both
resource/call exhaustion, unchanged async-resource counts, and pre-transaction
budget rejection. Existing lifecycle/SQLite/HTTP/completion regressions are retained.

Intermediate results are preserved: initial new-test syntax failure (0/1 file),
then 0/10 from using `count` through the unsupported legacy service interface;
corrected to `query`, 10/10. Expanded restricted selection 66/70, four HTTP loopback
EPERM failures; authorized focused selection 70/70 before Contact. The later
fourteenth case validates the audit correction. Test-only fixture errors were
corrected; no correlation assertion failed on successful Store operations.
The first editing helper invocation also found no `python` alias; `python3` was
used. An offline helper syntax error was corrected before producing evidence.

`npm run check`, changed-JavaScript syntax, JSON structure, evidence hashes,
unchanged manifests and whitespace are checked for delivery. Full `npm test` and
installed qualification suites are explicitly omitted. No versions, lockfiles,
deadlines, dependency graph, publication, deployment or release changes.
