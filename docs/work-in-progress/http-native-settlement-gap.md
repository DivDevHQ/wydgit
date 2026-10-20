# Native completion → next inspection — increment 17, diagnostic spike D

Captured 2026-10-19; finalized after resumption 2026-10-20. Baseline verified clean
on `develop/0.3`, HEAD `45db1fbf31f19148a40021cb59966546a9dafe2c`, tracking
`origin/develop/0.3`, Node v24.21.0. The interrupted changes and single Contact
window were recovered intact. No load experiment was repeated. Package versions
remain unchanged (platform/Wydgine/WydHosting alpha.28, Store alpha.8).
**WYDGINE-0.3-HTTP-LIMIT remains OPEN. No alpha.29 release or runtime fix.**

[Portable evidence](../../test-support/http-native-settlement-gap-evidence-2026-10-19.json)
contains the full sanitized window, original series summary, artifact hashes,
exact boundaries, per-request partitions and existing scheduling/FS observations.
[Offline partitioner](../../test-support/native-settlement-gap.js) joins exact
request/native ordinals; it never matches by timestamp proximity.

## What the original 53 ms actually bounded

The [preceding inspection experiment](http-fsreqpromise-inspection-correlation.md)
measured request 1, call 1 (create) `inspections[].settledMs` at **1075.159464 ms**
to the same request's call 2 (query) `entryMs` at **1128.235526 ms**:
**53.076062 ms**, in the server worker's `performance.now` clock domain.

The first marker runs in `completion.run`'s existing `finally`, after its existing
`await task` resumes and pending bookkeeping completes. It establishes that the
awaited service task completed; it is **not an exact Promise settlement timestamp**.
The outer `completion.run` Promise has not yet returned to its awaiting Page.
The old experiment did not observe second dispatch or Store entry. Its evidence
alone could not partition the gap or classify all of it as scheduling/overhead.
It was not a filesystem producer marker either. The separate filesystem
`producerMs`, hook callback and inspection continuation markers remain distinct.

## Added boundaries and scope

A host-only `execution.observeNativeGap` callback requires existing diagnostic
timing plus explicit opt-in. It reuses the trusted bounded FSREQPROMISE collector.
Fixed synchronous markers record:

- `dispatchMs`: entry to `completion.run` after its existing admission check,
  before the existing Promise work dispatch. This is native dispatch initiation,
  after Page session authorization and logical storage mapping, not handler entry.
- `completeMs`: the same native completion `finally`, immediately after the
  existing inspection `settledMs` notification. It also exists when no inspection
  was entered. Existing `settledMs` remains the partition's start when available.
- `pageContinuationMs`: start of the existing Page-owned
  `diagnostics.measure('service')` await's `finally`, associated through that
  invocation's own operation closure. This is a Page service-await continuation,
  **not the later SEWN interpreter continuation**. Remaining wrappers and SEWN
  resumption belong to the following partition.
- `storeEntryMs`: synchronous entry to Store core `execute`, before Store
  validation and policy authorization. It implies neither authorization nor a
  transaction entry.
- `clearStartMs` / `clearEndMs`: the existing synchronous Page `FormState('clear')`
  body following an observed native return, including guards, field traversal,
  form calculation and runtime edit/commit. This does not bracket unrelated
  Page lifecycle execution. First markers only are retained per native call;
  this fixture has exactly one such Clear between calls.

The existing inspection `entryMs` remains the `sqliteInspectFiles` continuation
factory entry in SQLite `transaction`, just before `start` and `inspectFiles`.
It is a pre-inspection boundary, not a filesystem invocation or transaction start.

All boundaries use the same server monotonic clock. Request indexes come from the
existing trusted harness async context; operation ordinals are Page-local. The
collector holds at most **64 native records**, with fixed numeric/null fields,
request indexes 0–12 and operation ordinals 1–64. Existing FS/inspection limits for
this window stay 512; counters saturate at one million. Overflow/failure stops
observation and releases resource tracking. Observer errors are caught. No raw
payload, SQL, path or credential enters markers or public HTTP diagnostics.

There are no added awaits, Promise reactions, timers, scheduling barriers or
filesystem operations. Existing guards, authorization, cancellation, lifecycle
checks, native settlement and the 1,000 ms deadline are unchanged. Resource-count
regression checks cover the new completion markers; they do not prove timing
neutrality. Synchronous marker/allocation overhead is uncalibrated.

## One retained Contact window

```sh
node test-support/http-concurrency-probe.mjs --output /tmp/contact-native-gap-increment17 --native-gap
```

One fresh SQLite Contact fixture, separate supervised client, no simultaneous
suites, no write retries. Actual client/server/admission/Page overlap is **12**.
Runner exits zero, series complete, fixture cleanup succeeds and client is reaped.
Original `/tmp` files were unavailable after resumption; all three original
artifact SHA-256 hashes reproduce exactly from the retained JSON, including the
reconstructed first-matching-trace envelope. The runtime source fingerprint also
reproduces. Capture/runtime code was not changed after this load window.

- **2 HTTP 200** (requests 5 and 9), **10 matching HTTP 500/indeterminate**.
  All twelve responses were fully received and published.
- **12 reported commits, 24 completed native calls, zero pending**. Commits do
  not establish client receipt; receipt is separately observed here.
- Ten failures first report exhaustion in `prerender`. Request **5 is HTTP 200 /
  committed**, has no top-level failure, but records time exhaustion during
  **cleanup**. Request 9 has no exhaustion. Eleven time-exhaustion records therefore
  do not mean eleven HTTP failures; no response behavior was corrected here.
- **22 entered POST transactions**. Two query calls exhaust before transaction
  entry and still complete. Transaction markers are absent rather than invented.
- **216/216 unique POST inspection FS mappings, 24/24 unique lifecycle mappings**.
  Including setup: 25 native records, 25 inspections, 250 resource mappings;
  zero missing/ambiguous mappings, dropped observations or hook errors. Hook is
  stopped with zero tracked resources.

## Per-request partition (milliseconds)

Eligibility requires unique consecutive call identities in one request and
observed first native completion before second dispatch. Setup request 0 is
excluded. All twelve POST create→query pairs qualify: **12 complete, 0 partial,
0 missing**. Each row uses the existing completion `settledMs` start, not its
adjacent new `completeMs` marker. All five boundaries are causally ordered.

| Request | Completion→Page | Page→dispatch | Dispatch→Store | Store→inspection | Total | Clear within Page |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0.036449 | 55.238447 | 0.374777 | 0.071084 | 55.720757 | 46.280820 |
| 2 | 0.007725 | 31.938251 | 0.563142 | 0.128963 | 32.638081 | 22.589467 |
| 3 | 0.009788 | 29.364540 | 0.332427 | 0.069240 | 29.775995 | 20.952570 |
| 4 | 0.009768 | 46.850906 | 0.366180 | 0.083087 | 47.309941 | 34.458843 |
| 5 | 0.009458 | 38.786882 | 0.399744 | 0.068890 | 39.264974 | 28.834881 |
| 6 | 0.009478 | 32.761763 | 0.421796 | 0.091232 | 33.284269 | 25.013727 |
| 7 | 0.006372 | 49.994812 | 0.390957 | 0.070563 | 50.462704 | 32.844400 |
| 8 | 0.013866 | 31.052432 | 0.289756 | 0.065694 | 31.421748 | 23.391719 |
| 9 | 0.011151 | 24.157323 | 0.299755 | 0.065153 | 24.533382 | 16.904128 |
| 10 | 0.014257 | 28.354215 | 0.311357 | 0.066445 | 28.746274 | 19.996819 |
| 11 | 0.008296 | 32.126927 | 0.277613 | 0.072647 | 32.485483 | 24.721386 |
| 12 | 0.020078 | 26.262251 | 0.295126 | 0.067978 | 26.645433 | 17.932457 |

The original gap's approximate magnitude recurs: request 1 totals **55.720757 ms**.
Its largest partition is **55.238447 ms Page→dispatch**, containing **46.280820 ms**
of synchronous Clear and **8.957627 ms** outside that bracket. Source inspection
shows expected work after SaveEntry returns: Clear, setting the acknowledgement
content, action completion/initialization, PreRender traversal and RefreshEntries
SEWN work, then Page session authorization/storage mapping before native dispatch.
Only Clear has an additional measured bracket; the rest is not individually
attributed. The largest Page-outside-Clear remainder is independently **17.150412
ms in request 7**. Do not add that maximum to request 1's Clear or other maxima.

The four adjacent partitions exactly cover the measured total: arithmetic residual
is zero for every pair. This does **not** mean all work inside them is explained.
Elapsed synchronous brackets are not CPU measurements; OS scheduling and marker
overhead remain possible contributors. Clear is expected application work and
occurs on successful and failed requests. No causal relationship to overall HTTP
failure, or general statistical correlation, follows from this one window.

## Existing observations and limitations

Independent POST filesystem maxima (ms), not additive request totals:

| Mode | Invocation→before | Before→after | After→continuation |
| --- | ---: | ---: | ---: |
| Inspection | 421.162464 | 0.009468 | 0.059021 |
| Lifecycle | 449.994690 | 0.004869 | 0.076765 |

Maximum sampler lateness **417.011791 ms**, pending lateness lower bound
**404.817452 ms**, checkpoint interval **502.530322 ms**, observed zero-check
interval **6.750246 ms**. All sampler tails are incomplete. Checkpoint intervals
can contain checks. Filesystem hooks do not expose physical I/O completion,
thread-pool execution, or exact Promise settlement. Client and server clocks are
not subtracted. Page progress has a different origin; deadline accounting uses
Date.now. No exact monotonic first-exhaustion time is claimed.

## Verification and handoff

Final focused command (no load reproduction):

```sh
node --test --test-isolation=none test/native-settlement-gap.test.js test/native-settlement-gap-evidence.test.js test/http-diagnostics.test.js test/operation-completion.test.js test/native-stage-timing.test.js test/fsreqpromise-inspection-correlation.test.js test/fsreqpromise-contact-correlation.test.js test/guestbook-package.test.js
```

Fresh final selection: **59/59 pass**, zero failures, cancellations or skips,
including **11/11 new marker/offline-audit cases**. `npm run check` passes (3
complete pages, 42 internal links and unique anchors). Changed JavaScript syntax,
JSON structure, whitespace and artifact/source hashes pass. The new cases cover sequential
identity, controlled synchronous Page work, zero invented delay, twelve concurrent
requests, early pre-inspection exhaustion, disabled/failing observers, resource
counts and bounds, actual Page/SEWN Clear, partial/missing/overlapping offline
boundaries, artifact/source hashes and the retained window audit.

Intermediate failures from the interrupted session are retained here: first new
selection **6/7**, failing async-resource count comparison (test-runner startup
reactions captured on the first measured await). A pre-measurement test-only await
corrected the capture; it adds nothing to runtime execution. Restricted focused
selection **50/55**, five HTTP loopback `EPERM` failures. The authorized loopback
selection subsequently passed **56/56**, and `npm run check` passed. Original
temporary logs did not survive resumption; counts and explanations come from the
retained session tool results. After resumption the marker plus offline-audit
selection passed **11/11**. No failing Contact run or workload rerun occurred.

A resumed validation helper initially hit sandbox `spawnSync git EPERM`; shell
file inventory replaced its nested Git invocation before final syntax/security checks.

Full `npm test` and installed qualification suites are intentionally omitted.
Versions, manifests, lockfiles, deadlines, SEAM/Gate/Store authorization, write
semantics and release state are unchanged. No publication, deployment or Spike E.

One next investigation: partition the existing synchronous Form Clear body into
field traversal/form calculation versus runtime edit/commit in a deterministic
single-request fixture. This would explain its measured elapsed span without
changing behavior or assuming it causes the HTTP limit failure.
