# HTTP reliability Spike F — scheduling and deadline attribution

2026-10-20. Clean starting branch `develop/0.3`, commit
`685d3eba1dfa35e64c9dc9fa9fcbeefa9326f331`. **WYDGINE-0.3-HTTP-LIMIT remains OPEN.**
No runtime correction, deadline change, version bump, client artifact change,
release, deployment or CIR work. This qualifies diagnostic observations, not
production reliability or security.

The strongest supported explanation is **competition for the server event loop
from bounded synchronous Page work**, including canonical tree mutation/validation
and repeated synchronous installation metadata checks. This delays delivery of
filesystem callbacks to other Pages while their deadlines continue advancing.
A filesystem wait label is therefore not evidence of slow storage. Independent
filesystem-worker/OS variability is not excluded, and no exact CPU partition or
single defective call is established.

The next intervention belongs in trusted Page mutation/validation and installed
execution validation, beginning with measured repeated work during Contact
PreRender. Changing the libuv pool size did not reliably improve this workload.
No evidence justifies removing integrity checks or caching authority across a
mutation/lifecycle boundary.

## Retained evidence and reproducibility

[Machine-readable evidence](../../test-support/http-scheduling-attribution-spike-f-evidence-2026-10-20.json)
contains every series summary, distributions, a fixed representative timeline,
calibration rows, sample counts and interpretation rules. Its SHA-256-pinned
[compressed source archive](../../test-support/http-scheduling-attribution-spike-f-source-2026-10-20.json.gz)
retains all sanitized per-window records, callback spans, resource identities,
syscall observations, profiles and failures. Earlier Spike D/E evidence is unchanged.

Run alone from the repository with installed dependencies, local TCP permission
and permission to trace disposable child processes:

```sh
node test-support/scheduling-attribution-probe.mjs --output /tmp/NEW-spike-f-primary
node test-support/scheduling-attribution-probe.mjs --attribution-output /tmp/NEW-spike-f-attribution
node test-support/scheduling-attribution-probe.mjs --calibration /tmp/NEW-spike-f-calibration.json
```

All output locations must be new. The first command runs 30 windows, the second
six, each in a fresh child and in sequence. The final captures took approximately
one minute for the primary matrix and under one minute for attribution. The
archive also preserves an earlier 30+6 exploratory matrix. Its supervisor omitted
TMPDIR, shortening inspection by one ancestor; it is excluded from final tables.
That mismatch was corrected and both matrices repeated. The first exploratory
trace parser had no guard-file classification; all parsed records remain retained.
The CPU profile field `inclusive` in those original captures means stack
occurrences, normalized to `inclusiveOccurrences` in the evidence summary.

Exact runtime/fixture sources are hashed in each series. Primary and attribution
captures use the same final collector, Contact harness and runtime. Later offline
packaging adds no workload changes. The collector does not load from production.

Environment: Node **v24.21.0**, Linux x64 kernel **7.0.0-38-generic**, AMD Ryzen 7
7735HS, 16 available logical CPUs; local `/tmp` filesystem statfs type 61267
(ext-family), 4,096-byte blocks. Default libuv pool is four; a separate control
sets `UV_THREADPOOL_SIZE=16` before server startup. No suites ran during captures.
OS load and host preemption outside this experiment were not controlled.

Contact uses the established interactive SQLite/JSON guestbook installation,
fresh empty dataset, disabled Gate, one setup GET/anonymous session and CSRF,
identical bounded POSTs, no retry, and a **supervised separate client process**.
Every final concurrent Contact window records actual client/server/host-admission
concurrency 12; observed Page ledgers also overlap at 12 (1 ms ledger resolution).
The observer-off windows cannot measure Page ledger overlap. Client processes
are reaped, fixtures removed, and every response is fully received, including
HTTP 500. Transport, client barrier and limits remain those in
[concurrency qualification](../http-concurrency-qualification.md).

The supervisor provides an exclusive temporary root, matching preceding probes;
SQLite inspection checks **five ancestors and four database/sidecar paths per
native operation**: 216 POST inspection resources and 24 lifecycle resources per
fully admitted 12-way window. `safeRoot` also awaits `realpath`; these existing
lstat seams do not cover its resources. Total provider preflight includes it.

Worker ceiling: 45 seconds, series ceiling: 12 minutes, worker stdout: 8 MiB,
trace artifact acceptance ceiling: 24 MiB. Timeout/exit/protocol failures cannot
be converted to passes. A sandbox-only strace smoke test first failed with
PTRACE permission errors, ran no workload, then passed with authorized tracing.
All final/exploratory matrix series completed with zero capture/cleanup failures.

## Timing model and contracts

Audit sources: `http/pipeline.js`, `execution/page.js`, `execution/progress.js`,
`execution/completion.js`, `sewn/budget.js`, `seam/context.js`,
`packages/index.js:guardInstalledExecution`, `object-model/mutation.js`,
Store `local-root.js`, `lifecycle-lock.js`, `sqlite-adapter.js` and `json-adapter.js`.
The [Form](../forms.md), [mutation](../mutation-model.md), [events](../events.md),
[SEAM](../seam.md) and [completion contracts](../milestones/0.3-I5.6/operation-completion.md)
remain authoritative.

1. The HTTP server receives a request; host admission starts before pipeline
   repository loading, session/context selection and Page hydration. These can
   delay other already admitted Pages, even before this request starts its ledger.
2. `executePage` prepares handlers and hydrates an independent canonical App.
   **Only then** it creates the Date-based execution budget. Preparation is outside
   this Page ledger; subsequent initialization, form adaptation/validation,
   actions, PreRender, cleanup and settlement are measured separately.
3. POST binding updates current fields. The installed Submit handler validates
   and dispatches the create service through session authorization, completion
   tracking, dispatcher validation/authorization and Store core entry.
4. SQLite preflight awaits sequential ancestor/sidecar checks and realpath,
   then the lifecycle-lock lstat. Resource `init` occurs during synchronous
   invocation. Hook `before`/`after` bracket resource callback execution.
   The existing await/recovery continuation follows. These markers do not expose
   worker submission/start/end, raw Promise settlement or physical I/O completion.
5. After preflight and a deadline check, better-sqlite3 executes synchronously:
   open/configuration, metadata validation, operation, precommit budget check,
   COMMIT and close. A reported commit is recorded at the existing committed
   marker after COMMIT. The diagnostic transaction-end marker is later and is
   not an exact COMMIT timestamp. A delayed callback can prevent transaction entry.
6. Native completion-finally and the Page service-await continuation are distinct
   from later SEWN resumption. Clear then empties fields under the optimized Spike E
   semantics (11 property intents, two changed candidates here), and acknowledgment
   changes continue. Page PreRender invokes query, repeats preflight/lifecycle,
   then constructs and inserts returned entry objects through ordinary validated
   edits. No Page-wide storage transaction spans this work.
7. Budget assertions use `Date.now() >= deadline`. They occur at existing
   interpreter, event, context, service and precommit boundaries, not as a
   preemptive CPU interrupt. Context checks can synchronously inspect metadata.
   A Promise/microtask chain can continue work for other requests while timers
   and filesystem callbacks wait for the next opportunity to run.
8. Exhaustion revokes new work. Cleanup and settlement retain existing behavior;
   admitted native I/O is drained. Failure after a commit produces an indeterminate
   document and HTTP 500. Server response end and **actual client receipt** are
   independently observed. A 200 can still record later cleanup exhaustion.

All diagnostic intervals use `performance.now()`. Date stamps at existing native
and inspection boundaries are subtracted only from that Page's existing Date
ledger deadline to report remaining budget. No CPU estimate subtracts maxima.
Client and server monotonic origins are different and are never subtracted.

Node's [async-hooks contract](https://nodejs.org/api/async_hooks.html#beforeasyncid)
defines callback boundaries. [ELU and monitorEventLoopDelay](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html#performanceeventlooputilizationutilization1-utilization2)
observe event-loop activity/delivery, not request CPU. ELU active includes time
outside the poll provider, including synchronous native work and descheduling.
A hook-before marker therefore establishes **callback delivery**, not when the
filesystem worker became ready. `destroy` is lifetime evidence, not completion.

## Representative final request: scheduled window 1, request 12

Fixed ordinal chosen for reproducibility, not by success or maximum. All times
below are server-process monotonic milliseconds. Date remaining values are
separate observations at the same named boundary, with millisecond quantization.

| Boundary | Monotonic ms | Page budget remaining ms |
| --- | ---: | ---: |
| Server request / host admission | 980.335 / 980.378 | Ledger not started |
| Budget start after preparation | approximately 990.4 | 1,000 |
| Create dispatch / inspection start | 1010.653 / 1011.113 | 980 / 979 |
| Inspection complete / caller resumes | 1015.751 / 1015.755 | 975 / 975 |
| Create lifecycle invoke / resource init | 1015.767 / 1015.773 | Not separately Date-stamped |
| Lifecycle hook before / after | 1215.510 / 1215.515 | Not separately Date-stamped |
| Recovery / existing await resumes | 1215.562 / 1215.575 | 775 at recovery |
| Synchronous create transaction bracket | 1215.664–1218.231 | 775 → 772 |
| Native completion / Page service continuation | 1218.322 / 1218.325 | 772 / 772 |
| Clear bracket | 1218.677–1223.238 | 772 → 767 |
| Query dispatch / inspection start | 1229.907 / 1230.348 | 760 / 760 |
| Inspection complete / caller resumes | 1256.637 / 1256.640 | 734 / 734 |
| Query lifecycle invoke / resource init | 1256.650 / 1256.656 | Not separately Date-stamped |
| Lifecycle hook before / after | 1933.120 / 1933.128 | Not separately Date-stamped |
| Recovery / existing await resumes | 1933.197 / 1933.216 | 57 at recovery |
| Synchronous query transaction bracket | 1933.307–1934.512 | 57 → 56 |
| Native completion / Page service continuation | 1934.743 / 1934.749 | 56 / 56 |
| PreRender exhaustion | No exact monotonic check marker | Used 1,001 / limit 1,000 |
| Final Page meter | 1,004 Date elapsed | Exhausted |
| Server response finishes | 1995.210 | HTTP 500 / indeterminate |

The approximate budget-start bridge uses the host admission Date/monotonic pair;
its precision is about 1 ms, unlike directly bracketed monotonic spans. The exact
Date ledger anchors remain in evidence. Client receipt completes in its own clock
at 1604.186 ms; its own start-to-end duration is about 1,441.096 ms.

The query's lifecycle **init→before is 676.464570 ms**. At least
**430.594423 ms** of that SAME interval intersects retained synchronous callback
spans; ELU idle is zero across it. These are union intersections, not added
independent maxima, and not 430 ms of proven JavaScript CPU. Short callbacks,
GC/native execution, preemption and uncovered work remain in the interval.
The hook runs for 0.007825 ms; after→recovery is 0.068869 ms. The native call then
returns with only 56 ms left for PreRender work and remaining publication phases.
There is one reported commit, two completed native calls and zero pending, yet
HTTP delivery is a fully received failure.

Clear itself takes 4.550011 ms in its inner observation (outer bracket includes
marker/guard overhead). Native completion→next inspection is 12.023384 ms, with
its Clear nested inside; those durations must not be added. Source inspection and
existing phase counters locate additional remaining work without calling it CPU.

## Controlled results

Three fresh windows per row, concurrency 12 except serial. HTTP columns show
per-window 200 / 500, followed by aggregate totals. Indeterminate is a separate
write-outcome classification, not another HTTP status.

| Mode | Window 1 / 2 / 3, 200:500 | Total 200 / 500 | Indeterminate | Reported commits / completed native calls | Date deadline exhaustions |
| --- | --- | ---: | ---: | ---: | ---: |
| Serial SQLite, extended observation | 1:0 / 1:0 / 1:0 | 3 / 0 | 0 | 3 / 6 | 0 |
| SQLite, existing diagnostics | 6:6 / 7:5 / 8:4 | 21 / 15 | 15 | 36 / 72 | 15 |
| SQLite, extended scheduling | 6:6 / 8:4 / 8:4 | 22 / 14 | 14 | 36 / 72 | 18 |
| SQLite, observers off | 9:3 / 10:2 / 10:2 | 29 / 7 | 7 | Unobserved | Unobserved |
| JSON, extended scheduling | 8:4 / 10:2 / 8:4 | 26 / 10 | 10 | 36 / 72 | 11 |
| SQLite, pool 16, extended scheduling | 7:5 / 8:4 / 4:8 | 19 / 17 | 17 | 36 / 72 | 19 |
| SQLite, syscall tracing, primary | 1:11 / 2:10 / 0:12 | 3 / 33 | 11 | 14 / 50 | 33 |
| SQLite, classified trace follow-up | 2:10 / 2:10 / 1:11 | 5 / 31 | 6 | 11 / 47 | 34 |
| SQLite, CPU sampling follow-up | 5:7 / 0:12 / 5:7 | 10 / 26 | 26 | 36 / 72 | 26 |

Completed native counts use `nativeStarted - pending`; all final pending counts
are zero. In traced windows some deadlines prevent handler admission, so neither
24 completed native calls nor 12 writes is assumed. Indeterminate counts can be
lower than HTTP 500 when a failed Page committed nothing. Evidence also reports
settled service calls separately. No correction exists for a before/after-fix table;
these are instrumentation/provider/pool comparisons, not a performance fix claim.

Existing/extended diagnostics alternate within rounds (off/on, on/off, off/on),
with fresh serial and observer-off/JSON controls. Pool and trace/pressure controls
follow in bounded rounds. Order is recorded; it is not randomized or a confidence
interval experiment. Provider comparison changes only provider configuration in
this harness, but inherently changes queueing, persistence and scheduling. It
supports a common server-workload bottleneck, not identical provider internals.

Serial Page elapsed is **63 / 74 / 76 ms**. Existing-observation concurrent Page
medians are **982 / 980 / 921 ms**; extended are **1002 / 953 / 988 ms**, with
maxima **1040 / 1043 / 1034 ms**. Some HTTP 200s exhaust during cleanup, explaining
why exhaustion totals can exceed failed responses. A final meter includes cleanup
and settlement and is not a transaction duration.

### Filesystem and event-loop distributions

Final extended SQLite POST observations, milliseconds; each inspection row has
216 samples, lifecycle row 24. Full min/median/p90/p99/max and raw rows are retained.

| Interval | Window 1 median / max | Window 2 median / max | Window 3 median / max |
| --- | ---: | ---: | ---: |
| Inspection invocation→init | .003266 / .030969 | .003376 / .022933 | .002866 / .025428 |
| Inspection init→before | .311608 / 407.574644 | .327428 / 364.819194 | .319944 / 716.888425 |
| Lifecycle invocation→init | .006322 / .011282 | .006062 / .008746 | .005380 / .017032 |
| Lifecycle init→before | 182.327793 / 738.510899 | 178.183437 / 712.555362 | 131.200705 / 688.467568 |
| Lifecycle before→after | .005120 / .012885 | .004017 / .007073 | .005310 / .012143 |
| Lifecycle after→recovery | .047169 / .096722 | .038984 / .061866 | .042350 / .091813 |

Inspection after→await-continuation maxima are **.033894 / .036639 / .053721 ms**;
inspection before→after maxima **.007404 / .005992 / .009759 ms**. Long waits occur
before hook delivery, not in these subsequent continuations. This does not prove
all Promise/microtask scheduling is cheap: unrelated chains can withhold the hook.

The longest waits in the three windows intersect **473.516 / 446.803 / 448.640 ms**
of retained synchronous callbacks inside respective **738.511 / 712.555 / 716.888 ms**
waits. The longest third-window wait moved from lifecycle to a SQLite file check;
the same signature is not confined to one absent lifecycle file.

ELU across each corresponding FS interval records zero poll idle time. Whole-window
ELU is **.960606 / .962060 / .967230**, with **1559.271 / 1496.461 / 1513.636 ms**
active and **63.945 / 59.014 / 51.283 ms** idle. Process CPU user/system readings
are respectively **1909.699/264.639**, **1862.927/275.142**, **1861.909/309.104 ms**.
These process-wide CPU counters include other Node threads and cannot be allocated
to requests or equated to ELU; they may exceed elapsed wall time.

10 ms histogram maxima are **422.838 / 662.700 / 430.703 ms**, from only
13 / 12 / 14 samples. These are sampled timer intervals/delays, not complete
per-operation queues or exact maximum starvation. Scope starts before the client
is launched and includes setup GET, client startup/exit and POSTs, ending after
client completion, before host shutdown. It excludes installer/host creation.
Serial histogram maxima include the setup GET; they do not describe a 73 ms
filesystem wait. Existing 50 ms request samplers remain separate and have
incomplete tails.

### Isolation and causal pressure control

The real `checkLifecycleLock` helper issues the same fs/promises `lstat` and
existing ENOENT recovery outside Page execution, on the same local filesystem in
a comparable temporary tree. Every concurrent operation has its own absent name;
no filesystem cache flushing or cold-storage equivalence is claimed.

Serial init→before: **.226648 / .236506 / .208533 ms**. Concurrency-12 maxima:
**.957215 / .931096 / .798776 ms**. Merely queuing twelve local metadata operations
does not reproduce Contact's hundreds of milliseconds.

In separate bounded pressure children, twelve operations are submitted, then a
120 ms synchronous loop runs with a monotonic hard bound. Three repetitions yield
init→before maxima **121.758659 / 121.593147 / 121.634775 ms** and histogram maxima
approximately **130 ms**. Each trace has exactly twelve uniquely named syscalls,
zero split-line losses, and no main-thread syscall in the measured interval.
Syscall-duration medians are **.016 / .014 / .027 ms**, maxima
**.033 / .039 / .033 ms**. Each syscall finishes before its own callback; the
kernel-return→hook intervals are approximately **121.15–121.66 ms**.

The syscall join uses the unique fixture name, not timestamp proximity. strace
uses external realtime stamps bridged approximately with `performance.timeOrigin`
for ordering, so these cross-clock numbers are approximate. The large margin
supports early kernel return despite sub-millisecond bridge uncertainty. `-T`
measures elapsed syscall time, including tracing/descheduling effects; it does
not measure exclusive kernel execution or libuv queue time. This control causally
establishes that event-loop contention alone can produce the pre-hook signature
**after the kernel returned**. Contact's shared filenames do not uniquely join
syscalls to individual resource IDs; its longest callback-ready timestamp remains
unobserved. No per-request ready-time claim is manufactured from that trace.

### Synchronous metadata and CPU sampling

Six final traced Contact windows record **54,157–62,388** metadata syscalls;
**53,981–62,192** run on the main thread. A closed filename classifier identifies
**49,022–57,177** calls to the seven files used by `guardInstalledExecution`:
installed catalog, host configuration, install/recovery/infrastructure barriers,
package effects and package operation. Counts include setup GET and early-ended
Pages and are not exact calls-per-successful-request. Some startup/repository
validation uses the same files. Counts and thread identity establish repeated
synchronous filesystem work, not a causal cost fraction for each guard.

Source shows the mechanism: every branded `checkContext` invokes its installed
lifetime validator; the unchanged validator calls `stamp`, performing seven
`lstatSync`s and bigint stamp serialization. These occur during ledger assertions,
SEAM checks, edits and handle operations. They are deliberate integrity checks,
not redundant writes that can simply be elided like Spike E Clear.

Three independent 1,000 μs V8 CPU-sampling windows retain 1541 / 1577 / 1469 selected
samples within the scheduling scope. Stack-occurrence counts repeatedly include
Page `edit` **384 / 388 / 361**, `Insert` **352 / 338 / 327**, mutation `apply`
**278 / 295 / 251**, and installation `stamp` **293 / 267 / 302**. Leaf samples in
`clean` are **140 / 138 / 124**, and `freeze` **113 / 135 / 110**. Recursive stack
occurrences overlap and are not disjoint CPU percentages. Sampling is statistical,
can miss native work, and changes execution timing. It supports these paths as
next measurement targets, not their sole responsibility for every delayed callback.

### Diagnostic overhead and limitations

Extended collection adds a monitor timer plus synchronous hook clock/context
reads, stack bookkeeping, bounded numeric rows and ELU snapshots. It does not add
Promise reactions or filesystem operations to the Page. Existing diagnostics are
already material observation, not a zero-overhead baseline.

Observer-off SQLite still fails **7/36**, so observation is not necessary for the
failure. Existing vs extended outcomes **21/36 vs 22/36** do not establish
neutrality. Traced windows are substantially slower and alter admission/commit
counts; their HTTP results cannot stand in for untraced performance. CPU-profile
windows range from 5 to 0 to 5 successes, retained without selecting favorable runs.

A separate 10,000-Promise-chain calibration has four warmups and nine alternating
rounds. Median elapsed: observation off **.451953 ms**, FS hook only **6.523442 ms**,
extended scheduling **4.929276 ms**, with maxima **3.382679 / 11.707408 / 15.964777 ms**.
Noise/JIT/GC and hook mode effects prevent treating the difference of those medians
as an application overhead estimate (the extended median being lower is not a
speedup claim). Every calibration row is retained. Contact comparisons, rather
than a microbenchmark subtraction, bound the practical interpretation.

## Hypothesis audit

| Candidate | Prediction | Evidence and disposition | Next discriminator |
| --- | --- | --- | --- |
| Event-loop starvation / synchronous work | Delayed timers and FS delivery with active loop, overlapping callback work | Supported by interval-specific ELU, direct callback unions, sampled Page/guard stacks and causal pressure control | Bracket unchanged Page insert/validation and installed-validator work by phase, preserving checks |
| Filesystem worker-pool contention | Isolated twelve-way metadata queues stay long; more workers help consistently | Weakened: isolated maxima <1 ms; pool 16 gives 19/36 vs default extended 22/36 successes | Direct libuv worker enqueue/start/end observation in one bounded fixture if server-work analysis leaves a gap |
| OS/filesystem variability | Long worker/kernel intervals even when loop responsive | Not dominant in isolated traces; unresolved in untraced Contact and synchronous metadata/native work | Worker/OS scheduling trace with exact operation identity and calibrated overhead |
| Promise/microtask continuation delays | Large hook-after→continuation gaps | Weakened for observed continuations (<.1 ms); pre-hook withholding by unrelated microtask chains remains supported | Count bounded chain work/phase boundaries without new yields |
| Repeated filesystem metadata | Many synchronous metadata checks block other requests | Supported work-count/source/profile evidence; exact savings and safe elimination unproven | Measure stamp/checkContext count and disjoint spans before proposing any invariant-preserving consolidation |
| Combined bounded Page work exhausts deadline | Serial passes; concurrent Pages spend budget waiting for peers and finishing construction | Supported: all serial pass, concurrent failures and only 56 ms left after representative query | Fixed-fixture per-entry mutation/validation work counts and phase spans |
| Instrumentation-induced changes | Observer modes change timing/outcomes | Supported for tracing, unresolved magnitude for extension; failure survives observers off | Repeat a smaller paired minimal/extended comparison after narrowing source spans |

No hypothesis requires every long wait to share a single cause. Nothing in this
investigation closes the HTTP issue or excuses failure under load as merely an
operating-system problem.

## Retained changes and next bounded investigation

Only test support, tests, this report, changelog and the reliability issue link
change. `fsreqpromise-correlation.js` extends the established hook with optional
scheduling, default off. It retains at most 512 FS rows in Contact (general existing
max 1024), at most 2048 resources generally, 2048 slow callback spans by default
(max 4096), and a 32-entry nesting stack. Contexts/payloads/resource objects are
never retained. Request ordinals are 0–12; operation ordinals 1–64. A numeric fresh
worker/installation generation scopes joins; it is a fixture lifetime identity,
not an authority grant or a fabricated durable package-generation UUID. Every
window owns a fresh installation and never changes its generation while active;
source files and per-window identities prevent cross-lifetime joins. Dynamic
replacement across generations is outside this test collector's claim.

Retention caps count dropped calls/resources; inspection/native/stack overflow
and observer errors stop safely and release hooks. Span overflow counts dropped
rows. Final captures have zero drops/errors. Stop
is idempotent and disables the monitor. No production module imports these tools;
default execution has no new timers, hooks or observer context reads. Numeric
callback async IDs only correlate within the same worker generation. Path-bearing
strace output stays in the private temporary worker directory and is removed;
retained output contains closed categories, bounded fixed filenames, durations
and numeric thread/request IDs. No request payload, credential, SQL or private
path is retained. CPU frame paths are repository-relative, Node builtins or the
fixed external/native label.

A safe next spike should count and bracket unchanged **Page PreRender entry
construction → edit.apply → hydrate/dehydrate/clean/freeze**, plus the installed
lifetime `stamp` invoked from those paths. Use a fixed twelve-entry result and
compare existing work counts before proposing anything. First determine whether
repeated canonical validation can be reduced within one trusted operation while
preserving failed-edit atomicity, context checks, every lifecycle fence and
package-integrity observation. Do not replace synchronous checks with a timer
cache, trust a stale generation, batch portable events speculatively or add yields
as an unqualified fix. If these measured paths leave substantial unexplained
time, pursue worker-ready/OS scheduling attribution with exact identity next.

## Verification and handoff

Focused scheduling/evidence tests cover default-off behavior, concurrent identity
and generation separation, resource ELU, Date markers, bounded retention,
idempotent teardown, observer failure, union arithmetic, artifact hash and
historical outcome/commit distinctions. Existing filesystem correlation,
completion/lifecycle/SQLite, Form Clear, HTTP/sampler/client process and engine
boundary tests are included in the focused run. No security regression is removed.

Focused command: `node --test --test-isolation=none` with the 17 scheduling,
correlation, settlement, Clear, HTTP, SQLite and engine-boundary files named in
the [retained verification record](../../test-support/http-scheduling-attribution-spike-f-verification-2026-10-20.json). **145/145 pass**, zero failures, cancellations
or skips. The earlier initial collector selection passed **37/37**. No focused
test failed during Spike F.

`npm run check` passes: 3 complete pages, 42 internal links and unique anchors.
Full `npm test`, including immutable client prebuild, passes **1665/1665**, zero
failures, cancellations or skips (81.084 seconds in the recorded first full run).
The required commands are rerun after final authored edits before commit.
Engine-boundary/client-process and existing JSON/SQLite installed-package tests
are included; standalone tarball installation is not repeated because shipped
runtime/package contents did not change.

Final review covers status, complete intended diff, evidence hash and unchanged
package/client/CIR paths. Work is committed and pushed normally to
`origin/develop/0.3` after fetching and checking divergence; the final handoff
reports the actual commit, remote HEAD and working-tree state. No release action
is included. Remaining blockers are the open HTTP reliability defect and exact
worker-ready/OS attribution for individual untraced Contact waits; no diagnosis
is promoted into a production fix.
