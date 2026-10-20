# HTTP reliability Spike K — post-commit critical path

2026-10-20, `develop/0.3`, starting at Spike J
`1277d456dcc600f076c88efc68a26e1f8fb7eec0`.
**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** A small server correction removes repeated
construction of seven immutable installation paths. It preserves every fresh
filesystem inspection. Deadline failures still occur in corrected attributed
Contact windows. No version, deadline, frozen client, native protocol, CIR,
deployment, package publication or release changes.

The [evidence JSON](../../test-support/http-post-commit-critical-path-spike-k-evidence-2026-10-20.json)
contains request classifications, distributions and failure timelines. Its
SHA-256-pinned [source archive](../../test-support/http-post-commit-critical-path-spike-k-source-2026-10-20.json.gz)
preserves every primary and exploratory window, process outcome, calibration,
source text and initial failure log. The
[verification record](../../test-support/http-post-commit-critical-path-spike-k-verification-2026-10-20.json)
records completed checks. Historical D–J evidence is unchanged.

## Request lifecycle and the actual deadline

Source locations below are under `packages/wydgine/src/engine`, except the
transport admission owner in `packages/wydgine/src/app.js` and providers in
`packages/wydstore/src`. These are the implemented Contact path, not proposed
package examples. Reviewed contracts include [SEAM](../seam.md),
[SEWN](../sewn.md), [Forms](../forms.md), [object model](../object-model.md),
[package lifecycle](../package-lifecycle.md), its 0.3 milestone/verification,
[founding architecture](../FOUNDING-ARCHITECTURE.md),
[HTTP reliability](../http-reliability-and-session-qualification.md),
[concurrency](../http-concurrency-qualification.md) and Spikes H/I/J/native gap.

| Order | Implemented boundary | Page budget |
| --- | --- | --- |
| 1 | App admission registers the request in the host drain set. Hono validates transport/routing and collects/decompresses the bounded form body. | Not started |
| 2 | `http/pipeline.js`: live host, ready lifecycle, catalog fingerprint, repository/installed source and receipt validation, route/method, Session and optional authentication, context policy and every Page node's placement. | Not started |
| 3 | `execution/page.js`: prepare handlers/actions; verify owning Session and identity; presentation ledger; `hydrate(dehydrate(model.runtime,{includeSensitive:true}))`. | Not started |
| 4 | `createObservedExecutionBudget` creates the existing SEWN ledger. `started=Date.now()`, `end=min(parentDeadline,started+effectiveTimeMs)`; Contact's effective limit is exactly 1,000 ms. | Starts here |
| 5 | Construct Page response/safe contexts/controller; delegated resolution if applicable; Start/Initialize, bind POST fields, Load, field/Form validation and Validate; action authorization and Submit dispatch. | Inside |
| 6 | `guestbook-form.SaveEntry`: Values and `SERVICES.Call("wydstore","create",...)`. Page session authorization and physical storage mapping precede `completion.run`. Service dispatch checks capability, current context, input/result limits and Store ownership/authorization. | Inside |
| 7 | Native provider preflight and write. SQLite validates within its synchronous transaction and checks the live Page ledger immediately before native COMMIT. JSON checks the ledger before submitting rename. | Inside, including awaits |
| 8 | Provider invokes `committed()` after successful SQLite `run.immediate()`, or JSON rename plus directory sync/close. Provider close/unlink cleanup, result cleaning and live library-context checks still precede `completion.run` settlement. | Inside |
| 9 | Service-await continuation, SEWN continuation and SaveEntry return. Submit calls Clear, then independently sets the acknowledgement content. Clear uses empty values and validation reset, **not initial-value restoration**. | Inside |
| 10 | Page initialization continues, then Page.PreRender calls RefreshEntries. A second native operation queries up to twenty entries. The workflow constructs each entry and publishes each Insert separately. | Inside |
| 11 | Continue SEWN, activate/reconcile instances, PreRender completion, controller Render hooks. Web projection, component preparation and HTML rendering construct the tree response. | Inside |
| 12 | Unload dispatches in reverse initialization order, instance Dispose, close the original budget and mark Page handles dead. Cleanup errors retain their existing separate treatment. | Live until close; original checks unchanged |
| 13 | Drain all admitted native tasks with `completion.settle()`. Format existing diagnostics, determine committed/indeterminate outcome, prepare failure output if needed; `executePage` returns. | Budget closed; no new package work allowed |
| 14 | Pipeline logs sanitized failures, sets operation-outcome header; response.send prepares headers and calls output-port end. | Outside Page execution |
| 15 | Native HTTP server accepts the end call; later kernel/TCP delivery and client response end. Admission is released after pipeline cleanup. | Outside Page execution |

The authoritative clock remains **Date.now**. Enforcement is cooperative:
`now >= end` is terminal at the next existing check; a synchronous setter already
in progress can finish publication across that instant. It is not interrupted by
a JavaScript timer. No final check is added, removed or moved. In particular,
cleanup-only exhaustion can coexist with an already constructed HTTP 200 under
the existing contract. It must not be recast as a failed Page response.

Native operation completion, provider commit, canonical publication, Page
completion, response construction and delivery are different boundaries.
`completion.run`'s finally is an **await continuation after task settlement**, not
the physical instant a native Promise settles. The Page service wrapper's finally
is another continuation, before remaining SEWN execution. Output-port `end`
returning proves server handoff, not client receipt. The separate client records
its own response `end` and complete flag; its monotonic clock is not subtracted
from a server clock.

## Irreversibility and every remaining deadline boundary

SQLite's last in-transaction check can still roll back. After native COMMIT
succeeds inside `run.immediate()`, the Page cannot roll that write back. Its
subsequent `committed()` is independently observable confirmation, slightly later
than that physical point. JSON becomes physically committed at successful atomic
rename; the Page loses the ability to cancel once rename is submitted. Between
submission and confirmation its result is unknown. A later directory-sync failure
can leave visible records with **no committed report**. Native `begin` is therefore
neither evidence of commit nor proof of failure; dispatch and Store may call it
more than once and clear the preliminary indeterminate marker before provider work.

After the first irreversible write, deadline enforcement remains in:

- Provider completion checks on any subsequent native operation: Store entry,
  queued JSON work and pre-rename begin, SQLite preflight/lifecycle return,
  pretransaction begin and the final in-transaction check.
- The Page completion check callback, through `executionBudget(...).check()`;
  it still checks the current installed context, live budget, Session and cancellation.
- Every SEWN tick/resource charge, service return tick, procedure/construction/
  iteration charge and invocation/member guard reaching that shared ledger.
  SEWN's existing timer race uses the same absolute deadline; it does not reset it.
- Dispatcher enterEvent/take calls for subsequent events/handlers/raises and
  controller invocation guards. The dispatcher's independent event deadline and
  timer race also remain; these do not extend the Page deadline.
- Remaining activation/reconciliation/Render/Unload/Dispose execution through
  those same dispatch, workflow and invocation paths, until the ledger closes.

Canonical edit's live context/conflict/revision guards are independently required;
not every canonical guard itself reads the Page deadline. The surrounding workflow
and invocation checks still do. Library post-handler context/result validation can
fail after commit without being a deadline failure. All of these failures preserve
indeterminate reporting when the Page has a reported commit. No successful native
write is retried, and commit alone never produces HTTP 200.

## Bounded deadline ledger

The existing qualification worker now accepts explicit `deadlineLedger`; default
production and the off/minimal controls do not install it. Like the existing
attribution tools, it uses strict in-memory module-load hooks in test support.
No source is overwritten, no observer enters portable code, and no ledger module
is imported by shipped runtime or browser artifacts.

An AsyncLocalStorage scope correlates one capture with generation and numeric
request 0–12. Each retains at most **192 rows** (API ceiling 512), one overwritten
last-check row, the first deadline-exhausted check, and fixed synchronous stage
counters. Unknown labels are discarded. It retains no native controls, context,
payload, record ID, secret, SQL, credentials or package paths. There are no added
awaits, timers, filesystem calls, authorization decisions or automatic retries.

| Ledger field/marker | Meaning |
| --- | --- |
| budgetStart | The next explicitly armed **Page** ledger's original started/end values; Session lifecycle budgets cannot capture its anchor. |
| lastCheck / firstExhaustedCheck | Immediately after the ledger's original Date.now read, including terminal assertions. Remaining budget uses that exact `end-now`, without a second clock read. A context rejection before the read is unobserved by this hook. |
| nativeDispatch / nativeBegin / nativeCancelled / nativeCommit | Existing completion dispatch and provider/control callbacks, with Page-local operation ordinal. Cancellation markers can precede a later begin for the same service. |
| nativeSettlement / pageContinuation | The two existing await-finally boundaries, never labeled physical native completion or producer-ready time. |
| clearEntry / clearExit | Entire synchronous Page FormState Clear, including guards; existing detailed Clear observation is retained. |
| canonicalPublication | After actual Page runtime assignment at each edit, Clear or controller publication site. The last row in a failed Page is only the last **reached** publication, not proof all required state was published. |
| outputConstruction / outputConstructed | Web projection/component/render/tree-response construction inside Page execution. |
| pageComplete | Immediately before executePage returns, after close, drain and any indeterminate response preparation. A negative remaining value here does not by itself prove a late successful Page. |
| responsePreparation / responsePrepared / responseHandoff / responseSendComplete | Pipeline send entry, headers prepared, output-port end returned, and send returned. These do not prove client receipt. Contact HTML bodies are covered; this is not a general file-stream protocol tracer. |

Every row also records performance.now, current phase and remaining wall budget.
Successful checks are counted without retaining their entire history. The terminal
check and bounded rows reconstruct failure chronology without adding unrelated
span maxima. Optional `deadlineCosts` adds synchronous brackets around tree walks,
fresh stamps, hydrate/dehydrate and edit setup. Its `mutation` label measures
**factory setup only**, not the entire mutation/commit. Nested stage spans overlap.
Existing extended observers independently retain mutation/commit and filesystem
callback timing. No span sum is called CPU time or exclusive request cost.

Three fresh alternating controls measure 10,000 check observations plus 101 rows:
off medians **.119/.097/.096 ms**, ledger on **.958/.874/.862 ms**. This is an
observer-only calibration, not an overhead subtraction or Contact latency estimate.
The extended hook/FS observers have their separately established, much larger
observer effects from Spike J. All primary ledger bounds hold with zero dropped
rows. No diagnostic failure is used to authorize work or manufacture success.

## Fixed reproduction and classification

Two final series each contain **31 fresh server processes, 339 POSTs**: ten SQLite
off windows; three each SQLite minimal, SQLite ledger, JSON ledger and SQLite
ledger-plus-costs; three extended-ledger windows per provider; three serial SQLite
cost controls. Concurrency is twelve except the serial controls. Each has a fresh
empty installation/provider, one setup GET, unchanged separate-client Contact
payload, CSRF and Session, HTTP/1.1 loopback without keep-alive, maxSockets 12, no
admission spacing, no retry and independent authorized provider query afterward.
All clients/workers exit 0, are reaped, and cleanup succeeds. All concurrent windows
reach twelve client/server/admitted requests. Observed Page overlap is recorded
separately. Requests and Page budgets are not identical client latency intervals.

The before hook exactly reverses the two-line path correction to restore the
SHA-256-pinned Spike J packages module. It does not emulate a different provider
or workload. No full source checkout is mutated. Primary captures run sequentially,
without overlapping calibration or suites. Environment: Node 24.21.0, Linux
7.0.0-38-generic, Ryzen 7 7735HS, 16 logical CPUs, default four libuv workers,
temporary local filesystem. Host load, CPU frequency, GC and OS preemption remain
uncontrolled. Order is fixed before then after, not randomized.

Exploration is preserved separately: 25 initial windows/267 requests with two
off-mode failures; a 22-window/264-request series followed by one strict-hook
composition failure; nine continuation windows/75 requests with seventeen
failures; two native preflight windows and one restricted-sandbox setup failure.
Early observer fields evolved before the final primary comparison. They are not
silently pooled with final before/after results. The hook-composition error was
fixed before primary extended captures. Restricted test-process failure and an
evidence assertion using `code` instead of the supervisor's `exitCode` are retained
in verification history; corrected native runs pass.

For every primary request, evidence stores one of the commissioned seven classes
or unknown. There are **30 → 3 class-3** requests: reported commit, top-level
`SEWN.LIMIT`, authoritative timeMs exhaustion. All remaining primary requests are
class 7, independently received HTTP 200. Classes 1/2/4/5/6 have zero observed
primary cases; this is not proof they are impossible. Both final off samples are
120/120, so no primary failure requires unknown classification. The two exploratory
off failures remain **unknown stage** with indeterminate headers; post-window counts
do not identify their per-request terminal cause. No missing commit report is
treated as proof of rollback, and a cancellation marker alone is insufficient.

Two unextended baseline SQLite ledger failures show different post-commit paths:

| Window/request | Commit | After Clear | Query settlement | Last reached publication | Page return / HTTP handoff |
| --- | ---: | ---: | ---: | ---: | ---: |
| ledger round 2 / request 2 | 517.134 ms, 483 left | 520.813, 479 left | 1100.055, −100 left | 527.528, 472 left; before query return | 1102.615 / 1103.018 |
| ledger round 3 / request 3 | 441.453 ms, 559 left | 444.660, 556 left | 960.100, 40 left | 995.357, 5 left | 1002.952 / 1003.552 |

Offsets use server performance.now from budgetStart; remaining values come from
Date.now and need not equal 1,000 minus the rounded monotonic offset. The first
fails at the late query continuation/check before entry insertion. The second
publishes all twelve query entries, then fails in the remaining PreRender
execution before constructing successful output. JSON ledger round 2/request 12
commits at 217.141 ms, settles its query at 965.445 with 35 ms left, publishes its
last entry at 997.987 with 2 ms left and returns indeterminate at 1002.439 ms.
These are successful writes followed by Page failure, not failed writes or lost
HTTP 200 responses. Clients completely receive the HTTP 500 warning.

Correction does not erase the boundary: corrected SQLite costs round 2/request 1
commits with 550 ms left, query settles at 1042.099 ms and Page fails. Corrected
costs round 3/request 4 has 27 ms at query settlement, publishes ten entries (the
last at 1000.329 ms), then its next unchanged check fails. Cooperative publication
across the instant of expiry is preserved, not normalized away.

## Largest post-commit costs and retained correction

SQLite ledger-plus-costs, 36 requests/series; median / p90 milliseconds. Failed
Pages can do less work, so these concurrent distributions are not equal-work CPU
speed ratios. The equal-count serial and alternating controls below establish
the specific removed computation.

| Post-commit interval/family | Before | Corrected |
| --- | ---: | ---: |
| Commit to next native dispatch | 9.187 / 14.503 | 8.424 / 13.307 |
| Final native dispatch to settlement | 423.579 / 631.292 | 365.165 / 568.495 |
| Final native settlement to Page return | 53.956 / 68.597 | 46.763 / 59.711 |
| Whole post-commit path | 486.639 / 701.439 | 415.414 / 596.220 |
| Synchronous fresh installation stamps after commit | 21.418 / 25.413 | 14.925 / 17.194 |
| Full candidate hydration after commit | 10.338 / 15.096 | 9.820 / 13.906 |
| Canonical envelope serialization/copy after commit | 7.545 / 10.634 | 6.475 / 9.941 |
| Whole Form Clear | 2.903 / 5.195 | 2.849 / 5.036 |
| Page-tree walks after commit | 1.595 / 2.191 | 1.465 / 1.817 |

The large final native interval is awaited wall time including dispatch,
provider/filesystem work and callback delivery while peers execute synchronously.
The minimal ledger does not observe worker-ready timestamps, so it cannot partition
that entire interval into physical I/O, libuv queue, OS scheduling and event-loop
delay. Its first settlement-to-Page-wrapper continuation is only median .0055 ms
in SQLite ledger baseline; remaining wrappers/interpreter work follows. Extended
SQLite resource init-to-callback maxima are **717.775/680.641/682.119 →
699.872/713.765/702.751 ms**. Resource init is not producer-ready time. Extended
histogram maxima are **472.383/653.263/489.947 → 457.179/540.541/481.296 ms**;
JSON **495.452/455.082/475.791 → 447.742/447.480/435.159 ms**. These overlap other
intervals, have sparse samples during stalls, and are never added together.

Final response construction is small: SQLite ledger baseline median **2.030 ms**
inside Page execution; pipeline preparation-to-handoff **.205 ms**. It does not
explain the hundreds of milliseconds before the query continuation. Page
completion still executes required workflow, instance reconciliation and teardown;
there is no evidence supporting moving these after successful HTTP delivery.

The only shipped correction is in `packages/index.js:guardInstalledExecution`:
resolve its seven fixed relative artifact names against its already fixed root
**once per binding**. The same ordered seven `lstatSync` calls with fresh BigInt
metadata and `throwIfNoEntry:false` remain at every stamp. There is no cache of
stats, realpaths, accepted filesystem decisions, receipts, capabilities, Gate
policy, generation, canonical state or successful verification. Changed metadata
still invokes the same validation and fresh restamp before acceptance. Paths do
not make current authority or integrity decisions. No guard is consolidated.

Three real-metadata, same-process alternating controls, 18 measured pairs/process
after seven warmup pairs, each executing **1,680 stamps / 11,760 inspections**:

| Fresh process | Repeated paths median | Resolved-once median | Reduction |
| --- | ---: | ---: | ---: |
| 1 | 22.324 ms | 16.470 ms | 26.2% |
| 2 | 22.670 ms | 16.516 ms | 27.1% |
| 3 | 22.987 ms | 16.470 ms | 28.4% |

These controls use real local metadata but do not pretend to validate an installed
package. Actual installed Contact controls independently retain **868 stamps /
6,076 inspections** for each equal-work serial request, with stamp median
**16.014 → 11.755 ms**, post-commit stamp median **8.253 → 6.368 ms**. All three
corrected serial stamp observations are below all three baseline observations.
Serial post-commit median falls **31.696 → 28.984 ms**, while total client median
regresses **76.282 → 81.285 ms**. Both facts are preserved. Concurrent median
stamps remain 1,682, with 1,289 after commit; measured stamp elapsed falls
27.906 → 19.728 ms. Required metadata checks are not discarded to obtain this gain.

Other audited work is retained: Clear's current empty-value semantics and single
Form operation boundary; H/I's private immutable candidate validation/reuse and
per-setter publication; live execution-handle guards; fresh installed checks;
SEWN result cleaning and continuation; package lifecycle reconciliation; render
projection and output validation. Snapshot publication is not deferred or batched.
Page-tree caching was considered but not retained: its cost is small relative to
the fresh stamp family. Controller render's discarded dehydration is a narrower
future candidate, but shared controller changes require a frozen-client contract
decision and are outside this correction.

## HTTP results, deadline distributions and reconciliation

HTTP 200 / HTTP 500-indeterminate, followed by client latency median / p90 / p99 ms.
Each non-off concurrency row has three fresh windows of twelve.

| Provider / mode | Before | Corrected | Client before | Client corrected |
| --- | ---: | ---: | ---: | ---: |
| SQLite off, ten windows | 120 / 0 | 120 / 0 | 936.343 / 1168.783 / 1229.002 | 868.087 / 1088.428 / 1133.907 |
| SQLite minimal | 33 / 3 | 36 / 0 | 1005.306 / 1284.658 / 1445.168 | 877.013 / 1103.329 / 1146.307 |
| SQLite ledger | 34 / 2 | 36 / 0 | 997.797 / 1289.677 / 1414.950 | 878.979 / 1104.004 / 1150.848 |
| JSON ledger | 35 / 1 | 36 / 0 | 1021.762 / 1343.463 / 1486.131 | 892.936 / 1125.103 / 1175.637 |
| SQLite ledger + costs | 35 / 1 | 34 / 2 | 1005.265 / 1259.991 / 1329.182 | 879.862 / 1109.294 / 1158.217 |
| SQLite extended + ledger | 24 / 12 | 35 / 1 | 1242.931 / 1484.607 / 1528.643 | 1130.154 / 1421.239 / 1482.701 |
| JSON extended + ledger | 25 / 11 | 36 / 0 | 1217.741 / 1483.531 / 1528.815 | 1110.493 / 1403.104 / 1461.161 |
| SQLite serial costs, three | 3 / 0 | 3 / 0 | 76.282 / 86.204 / 86.204 | 81.285 / 81.693 / 81.693 |

Remaining budget, **min / median / p90 / max ms**, unextended ledger modes. These
are per-boundary distributions, not paired quantiles on one hypothetical request.

| Boundary | SQLite before | SQLite corrected | JSON before | JSON corrected |
| --- | ---: | ---: | ---: | ---: |
| First confirmed commit | 483 / 721 / 792 / 828 | 595 / 718 / 813 / 830 | 509 / 696 / 806 / 828 | 620 / 721 / 828 / 844 |
| After Clear | 479 / 718 / 788 / 825 | 591 / 714 / 810 / 827 | 503 / 692 / 802 / 824 | 616 / 718 / 824 / 840 |
| Final native settlement | −100 / 287 / 429 / 568 | 139 / 350 / 480 / 584 | 35 / 254 / 420 / 473 | 231 / 344 / 460 / 489 |
| Last actual canonical publication | 5 / 263 / 391 / 526 | 107 / 318 / 442 / 542 | 2 / 218 / 379 / 424 | 199 / 311 / 429 / 448 |
| Page return | −103 / 235 / 366 / 509 | 95 / 305 / 423 / 526 | −2 / 205 / 365 / 406 | 188 / 299 / 415 / 430 |

Evidence separately supplies successful-Page final-publication distributions and
all p99 values, individual windows and failures. A last publication in an incomplete
Page cannot certify successful canonical completion. Primary totals are
**309/339 → 336/339 HTTP 200**, **30 → 3 indeterminate 500**, **339 → 339 reconciled
records**, **219 → 219 reported commits**, **438 → 438 completed native operations**,
zero pending. Observers-off native-operation/commit/deadline counters are unknown,
not filled in from persisted records. Authoritative observed time exhaustions are
**34 → 4**, including **4 → 1 cleanup-only** cases accompanying successful HTTP 200.

The fresh authorized post-window provider query counts an initially empty store;
its limit twenty covers all twelve records. It never retries a write and changes
no request outcome. Aggregate reconciliation establishes all expected records are
present, not a durable per-operation receipt or per-client record-ID lookup.
SQLite totals are 249/267 → 264/267 successes, JSON 60/72 → 72/72; providers retain
all 267/267 and 72/72 records per series, respectively.

The correction has a repeatable **specific cost reduction**, supported by equal
work, identical metadata calls, three alternating controls and serial installed
controls. Sequential HTTP latency/count differences alone do not prove their full
change was caused by path construction. One corrected costs group actually has
more failures. Clean off samples do not refute Spike J's 2/240 production failures
or this spike's two exploratory off failures. This is not closure of the release
issue or a production tail bound.

## Safety, differential qualification and remaining work

Resolving fixed lexical strings cannot conceal a live filesystem change: every
old check still inspects the exact same path in the same order and performs the
same validation/restamp on change. No realpath/inode/stat decision is reused.
Symlink substitution, same-size restored-mtime tampering, source/receipt drift,
byte-identical catalog replacement, retirement, installation-generation fencing,
revocation and recovery barriers retain their existing checks. Independent Gate
membership and WydStore ownership/SEAM scope still execute at their original
boundaries. Authority does not derive from identity or membership labels.

Dedicated regression tests count twenty-one fresh ordered inspections across
three installed checks, verify unchanged options, and retain the existing real
filesystem adversaries. Differential scenario processes compare identical status,
body, field values, native counters and errors against baseline and observer-off
execution for success, failed native operation, deadline before/after commit,
canonical validation rejection, output construction failure, handoff failure and
cancellation. They use explicitly synthetic native commit callbacks; real SQLite
rollback, JSON submitted-rename uncertainty, reopen/reconciliation and failed
directory sync remain independently exercised by operation-completion tests.
Existing Page tests cover intermediate setter reads, concurrent requests, stale
handles and expired authority; lifecycle suites cover retired/replaced installations,
recovery, forged receipts and cross-site/package denial. No contract is redefined
to fit the optimization. Full results and exact installed boundary counts are in
the verification record.

Recommended next bounded correction: measure the identical snapshot/placement
derivations rebuilt during **post-query controller activation/reconciliation** on
a fixed twelve-result fixture. Prove which immutable derived structures can be
reused within one synchronous operation while retaining every live context,
filesystem, authority, budget and publication boundary. Preserve full canonical
validation and intermediate state visibility. The present evidence does not support
dropping live guards, moving required work after handoff, changing clocks, extending
deadlines or introducing CIR. Even a complete performance correction cannot remove
the committed-side-effect/lost-response boundary below.

## Future native-operation reconciliation — analysis only

A separate design should let a client distinguish unknown from failed without
replaying an uncertain write. A client-generated operation ID can survive a lost
response; a server-issued ID needs a prior acknowledged issuance step or another
way for the client to recover it. An idempotency key must bind the exact authorized
App/package/installation/principal, operation and request digest; reusing it for
different input must conflict, and concurrent duplicate submissions need one
durable outcome rather than two native writes.

Durable receipts should distinguish admitted, submitted/unknown, committed,
failed-before-commit and any provider-qualified completion state. A receipt must
be atomically coupled to the write where the provider supports it: SQLite can
use the same transaction; a JSON provider needs a recoverable journal or a receipt
inside the same atomic document replacement. A separate receipt file written
afterward leaves another uncertain gap. Providers lacking atomic coupling cannot
honestly promise exactly-once effects. A commit receipt does not certify successful
Page completion, canonical Page output or HTTP delivery; those need separate facts.

An authorized result lookup would check current receipt ownership and SEAM/Gate
access independently of possession of an ID, redact retained results, deny cross-
site/package access and define behavior after retirement/replacement. Retention,
quotas, expiry, tombstones and data deletion must be explicit. Missing/expired
receipts mean unknown unless a provider can prove absence. Receipt settlement and
recovery cannot extend a Page deadline or let new package execution continue after
it closes. None of these IDs, keys, journals, receipt schemas or lookup endpoints
is implemented in Spike K.

## Reproduction and delivery

Run alone with dependencies installed and local TCP/process access; destinations
must be new. There is no indefinite failure search.

```sh
node test-support/post-commit-control.mjs > /tmp/NEW-control-1.json
node test-support/post-commit-probe.mjs /tmp/NEW-before baseline
node test-support/post-commit-probe.mjs /tmp/NEW-after corrected
node --test test/deadline-ledger.test.js test/post-commit-scenarios.test.js test/post-commit-evidence.test.js test/installation-stamp.test.js
node scripts/verify-packed-packages.js
npm run check
npm test
```

Repeat the alternating control in three fresh processes. Supervisor bounds are
45 seconds/16 MiB per worker, ten minutes/series, 64 KiB stderr; parent-owned
scratch directories are cleaned even after failure and all process outcomes are
preserved. Native hanging subtrees retain the existing supervised client boundary.
The optional `tail` argument exists only to preserve the exploratory interrupted
matrix continuation; final primary comparisons use the entire fixed matrix.

Normal commit/push to origin/develop/0.3 is authorized after final checks, fetch,
branch/divergence review and full intended-diff inspection. Commit and remote HEAD
are recorded in the final delivery handoff; an artifact cannot contain its own
future commit hash. No history rewrite, force push, tag, release or deployment.
