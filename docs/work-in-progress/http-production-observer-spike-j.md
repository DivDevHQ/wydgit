# HTTP reliability Spike J — production and observer effects

2026-10-20, `develop/0.3`, baseline
`d97b06c37c9363f9652e1eebd1879dfaf412a029` (completed Spike I).
**WYDGINE-0.3-HTTP-LIMIT remains OPEN. Production failures reproduce with optional
observers disabled.** No shipped runtime correction, version bump, deadline change,
client change, CIR, System execution, publication or deployment is retained.

The retained correction reduces **diagnostic label computation**, not installation
verification: reuse at most seven logical artifact labels within a request capture.
Every underlying filesystem operation still executes. It improves an alternating
observer-only control by 23.5–25.4%, but does not qualify an HTTP reliability fix.

## Reproduction, scope and evidence

[Machine-readable evidence](../../test-support/http-production-observer-spike-j-evidence-2026-10-20.json)
includes every configuration, distribution, process result and window summary. Its
SHA-256-pinned [source archive](../../test-support/http-production-observer-spike-j-source-2026-10-20.json.gz)
contains 95 raw windows, all 909 POSTs, calibration samples, before/after source
texts and hashes, and both preflight outcomes. Historical Spike D–I evidence is
unchanged. [Verification results](../../test-support/http-production-observer-spike-j-verification-2026-10-20.json)
record the actual commands, totals and log hashes.

Run alone with native local TCP/child-process access and new output directories:

```sh
node test-support/production-observer-probe.mjs --output /tmp/NEW-baseline baseline
node test-support/production-observer-calibration.mjs
node test-support/production-observer-label-control.mjs /tmp/ARCHIVED-observer.mjs
node test-support/production-observer-probe.mjs --output /tmp/NEW-repeat repeat
node test-support/production-observer-probe.mjs --output /tmp/NEW-serial serial
```

The reference label-control module is the exact `sourcesBefore` observer from the
archive, extracted to a trusted temporary file. Run each calibration in three
fresh processes. To reproduce the original HTTP baseline, use its archived
observer bytes in a disposable checkout. The production runtime is identical in
both series; only diagnostic labels change. The serial controls follow the
correction and are not before/after pairs.

Each primary series has ten dedicated SQLite observer-off windows, three JSON off
controls, and three rounds of seven SQLite modes plus a JSON extended control:
37 fresh server processes, 444 POSTs. Mode order is forward/reverse/forward, not
randomized. Each mode starts from an empty independently installed Contact fixture,
one setup GET, then the same twelve-way POST burst. Gate is disabled. A separate
client process uses the established HTTP/1.1 loopback, no keep-alive, maxSockets 12,
identical payloads and CSRF/session setup, no admission spacing and no write retry.
Native services settle before teardown. The Page deadline remains 1,000 ms.

Workers have 45-second/16 MiB output ceilings, series a ten-minute ceiling, bounded
stderr and parent-owned disposable scratch cleanup. All 95 workers exit 0, all
95 clients exit 0 and are reaped; all setup GETs, response receipts and cleanup
complete. No unexpected HTTP status, client timeout, observer error, dropped row
or fixture failure occurs in retained windows. The initial restricted-sandbox
preflight could not execute the fixture and is retained as a setup/cleanup failure,
not an HTTP sample. Native preflight passed 12/12 and is excluded from qualification
totals. Explicit monitor-only controls were finalized during the initial off-mode
captures; this changed no off-mode behavior. Captures identify processes by series
and unique file ordinal; labels alone are not globally unique.

Environment: Node 24.21.0, Linux 7.0.0-38-generic, Ryzen 7 7735HS, 16 logical CPUs,
default four-worker libuv pool and local temporary filesystem. Runtime/filesystem
configuration is retained per series. Captures and suites never overlap. CPU
frequency, GC, host load and OS preemption are uncontrolled. This is a local
sample, not a production tail bound, hostile-root guarantee or deployment test.

## Production baseline and native reconciliation

Dedicated SQLite samples, ten fresh windows of twelve, optional observers off.
Response durations are **client receipt** durations, in ms; nearest-rank quantiles.

| Series | 200 / 500-indeterminate | Median | p90 | p99 | Maximum | Stored records |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before diagnostic correction | 119 / 1 | 945.539 | 1184.172 | 1260.983 | 1282.210 | 120 |
| After diagnostic correction | 119 / 1 | 939.451 | 1173.735 | 1231.434 | 1253.061 | 120 |

Including the three off windows interleaved with each observer matrix gives
**155/156 → 154/156** successes (309/312 combined), with all 312 stored records.
One additional repeat matrix off request fails. JSON off controls pass **36/36 →
36/36**, reconciling all 72 records. Neither a small failure count nor a clean JSON
control establishes reliability or exonerates provider-specific work.

Reconciliation is a new, opt-in **read after every HTTP response has settled**:
reload the accepted repository, acquire a fresh installed package context and query
the real provider through its existing authorized interface. The fixture starts
empty; limit 20 covers all twelve writes. It records only aggregate counts, never
payloads or write retries. It does not modify a request's execution path, Page
budget or response status. It is independent of optional request observers, but
is not a raw-disk forensic check or per-response record-ID mapping.

Across all 95 windows, **909/909 records** are present, including the writes behind
all 56 HTTP 500/indeterminate responses. Observed windows report **522 commits and
1,044 completed native operations**, zero pending; the remaining requests have no
native-operation counters. Off-mode commits, completed native operations, Page
elapsed time and exhaustion are **unknown**, never inferred from disabled observers.
Stored record counts are reported separately. Off failures have indeterminate
headers; their exact terminal error is not observable. Every observer-enabled HTTP
failure has `SEWN.LIMIT`. Already committed writes remain uncertain to their clients.

## Observer inventory and execution effects

Modes B–G share minimal HTTP diagnostics. C means event-loop **extension only**,
not that B's established sampler/progress diagnostics disappear. D adds filesystem
correlation without callback-span timing; E/F select disjoint source-hook groups.
G reproduces the established extended fixture. A disables all optional observers.

| Mechanism | Activation and synchronous work on the server event loop |
| --- | --- |
| Production Page diagnostics | `createPageDiagnostics()` runs even in A: clocks, phase/span maps, async `measure` wrappers and phase transitions remain. Final formatting is skipped without an observer. A is production with optional observers off, not zero diagnostic instructions. |
| Minimal HTTP diagnostics, B | `observeHttp` enables record construction, Page progress, native/continuation timing, ELU snapshots and the existing shared 50 ms scheduling sampler. Guard-entry counters, phase checkpoints, bounded snapshots and service counters execute synchronously. |
| HTTP lifecycle logging | Fixture logger discards errors; no text log formatting or disk writes per request. HTTP finish freezes a bounded record and the fixture retains at most thirteen request records. A finishing request can still delay peers whose budgets remain live. |
| Event-loop monitor, C | Existing probe starts a 10 ms `monitorEventLoopDelay` histogram plus window ELU/CPU snapshots with `monitorOnly`; **no async hook** or callback request-reader executes. Monitor setup/finish occur outside individual Page work. Histogram samples are sparse during long stalls. |
| Filesystem correlation, D | Global `createHook(init,before,after,destroy)` is enabled from fixture setup through cleanup. Init sees every async resource, though it retains only FSREQPROMISE created inside known helper brackets. Before/after/destroy map lookups run for all resources. Enabling hooks increases Promise tracking overhead even without retaining Promise records. |
| Scheduling callback spans, G | The same hook additionally clocks every callback, reads numeric request correlation, pushes/pops bounded frames and retains callbacks lasting at least .5 ms. Those callbacks include Promise continuations and supervisor/fixture work. This is synchronous wall time, not exclusive JavaScript CPU. |
| Canonical attribution, E | Explicit strict in-memory module hooks wrap hydration/dehydration, edit operations, construction and `systemSet`. Per-request AsyncLocalStorage, frames, maps, counters and clock reads add synchronous work to the same operations. No installed-stamp instrumentation is active in E. |
| Installed guard attribution, F | Strict hooks wrap context checks, binding, stamps, installed reads/validation and repository setup. Every observed metadata call constructs/looks up a row, identifies a path label and enters a nested timing span. No canonical hooks are active in F. |
| Extended attribution, G | All of the above, plus native-gap, SQLite inspection and Form Clear markers. They observe existing calls and add no metadata inspections. FS limits are 512 calls/resources, callback spans 2,048, nesting 32; synchronous nesting 128, artifacts 256 and boundaries 32 per request. |
| Request/operation correlation | The harness always uses one AsyncLocalStorage request ordinal for bookkeeping; optional synchronous attribution adds another scope. FS rows use request 0–12, native operation 1–64 and generation within a fresh worker. Bound-context ordinals use a WeakMap and grant no authority. |
| Aggregation and serialization | Page checkpoints/native timing and HTTP record projection allocate/freeze inside the server process and can delay peers. Synchronous capture finish, raw JSON serialization, archive compression and supervisor persistence happen after HTTP work, not inside a measured Page. No payload, credential, SQL, resource object or installation UUID is retained. |
| Performance observations | `performance.now`, ELU, CPU/memory snapshots and the histogram are used. No `PerformanceObserver`, GC observer, CPU profiler, inspector or strace is active in these windows. No direct GC-pause attribution is claimed. |

Observers do not perform additional filesystem checks: they wrap the existing
calls. They can nevertheless delay callback delivery by occupying the loop and
alter allocation, Promise tracking and GC pressure. Bounded retained state does
not imply low allocation rate. Memory-before/after and RSS samples include setup,
provider state and JIT and cannot prove an allocation reduction or absence of leaks.

## Independent overhead and controlled HTTP comparison

Observer-only calibration uses **no Contact, package validation, native storage or
Page work**. Three fresh processes, alternating order, one warmup and nine measured
rounds/process. 30,000 resolved Promises with thirty `setImmediate` boundaries:

| Mode | Independent process median elapsed, ms |
| --- | --- |
| Hooks/monitor off | 2.138 / 2.365 / 2.070 |
| Histogram/ELU only | 2.757 / 2.971 / 3.223 |
| Filesystem hook, no captured FS calls | 21.661 / 21.823 / 19.450 |
| Hook plus callback-span timing | 26.356 / 27.827 / 26.577 |

This demonstrates a real observer effect even when no FS record is retained.
It does not multiply into a Contact prediction: Contact has different async
resource counts, native work and scheduling. Setup/teardown median ms, pooled
baseline: off .007/.002; histogram .056/.026; hook .031/.023; hook+spans .071/.092.
Raw CPU, memory, callback/record counts and each setup/teardown bracket are archived.
Worker initialization additionally includes application module loading and must
not be interpreted as observer-only initialization.

The synchronous metadata-label calibration performs 70,000 **stub** calls inside
10,000 context spans. Stub execution cannot verify an installation. Before
independent medians are 91.224/88.079/89.416 ms, candidate
71.663/68.860/68.054 ms; corresponding off controls remain about 2.5 ms.
Three stronger same-process alternating controls use twenty warmup pairs and nine
measured pairs each, preserving all 70,000 calls and identical aggregate rows:

| Process | Original median ms | Corrected median ms | Reduction |
| --- | ---: | ---: | ---: |
| 1 | 91.950 | 70.379 | 23.5% |
| 2 | 92.847 | 69.234 | 25.4% |
| 3 | 89.089 | 67.320 | 24.4% |

Seven request-local path→logical-label entries avoid repeated suffix searches.
They contain no stats or success/failure result, do not suppress any function
invocation, and are cleared at finish. Unrecognized paths still use ephemeral
keyed digests; overflow does not expand retention. Path strings remain private
in-memory until finish; none are serialized. Exception identity, result values,
metadata counters, inclusive/exclusive timing semantics and resource bounds remain.
Tests invoke a changing function on every repeated path and propagate its thrown
exception unchanged. The change is entirely test support, absent from shipped
runtime/browser import closures. No security decision uses these labels.

Concurrency twelve, three fresh windows per mode. Off rows include the additional
ten dedicated windows. Response median/p90 and Page median are ms.

| Provider / mode | Before 200/500 | After 200/500 | Response before median/p90 | Response after median/p90 | Page median before→after |
| --- | ---: | ---: | ---: | ---: | ---: |
| SQLite A off | 155/1 | 154/2 | 945.539/1184.172 | 941.101/1176.238 | unobserved |
| SQLite B minimal | 36/0 | 36/0 | 939.963/1192.539 | 933.897/1181.899 | 760→770 |
| SQLite C loop | 35/1 | 35/1 | 958.303/1182.815 | 929.527/1180.958 | 735→745 |
| SQLite D filesystem | 36/0 | 36/0 | 1000.858/1262.455 | 957.765/1218.896 | 791→751 |
| SQLite E canonical | 36/0 | 35/1 | 991.497/1249.936 | 948.278/1196.746 | 804→732 |
| SQLite F guard | 28/8 | 32/4 | 1185.465/1464.661 | 1129.731/1416.393 | 916→868 |
| SQLite G extended | 28/8 | 28/8 | 1201.245/1495.634 | 1209.469/1475.752 | 956→940 |
| JSON A off | 36/0 | 36/0 | 922.722/1175.557 | 923.726/1181.438 | unobserved |
| JSON G extended | 22/14 | 28/8 | 1248.533/1492.739 | 1196.536/1467.462 | 979→934 |

Every observed concurrent group reports 36 commits/72 completed native operations;
each reconciles 36 records. Guard/extended Page exhaustion counts are SQLite F
9→6, SQLite G 10→10, JSON G 16→10. Some successful Pages exhaust in cleanup,
so exhaustion need not equal HTTP failures. C has 1→1, E 0→1, B/D zero. All other
native counts, quantiles through p99/max, records and raw deadlines are in evidence.

Serial equal-work controls all pass (three requests/mode). Response medians A–G:
83.709, 84.366, 83.237, 87.513, 84.109, 100.486, 103.650 ms. Observed Page medians:
B–G 69, 66, 69, 65, 79, 83 ms. F/G are visibly more expensive; B/C/E small
differences are within these cold-process samples. No universal ranking follows
from a single median, nor does a passed three-window mode qualify production.

The lower-cost label computation repeats, but G's SQLite success count is unchanged
and its response median does not improve. F's four additional successes and JSON
G's six are not causal reliability evidence. The runtime is unchanged, A fails in
both series, and even E changes in the wrong direction despite no E code change.

## Remaining production work and scheduling

Equal-work serial extended controls still reproduce **866 guard calls, 868 stamps,
6,076 guard metadata inspections and 6,277 observed metadata calls overall** per
request. Concurrent attributed requests reaching more result entries have a median
1,680 guards. Unequal progress/failed Pages preclude equal-work concurrent speed
ratios. Full candidate validation and per-setter publication remain unchanged.

Serial extended medians, ms; rows overlap and **must not be summed**:

| Stage | Calls | Inclusive / exclusive |
| --- | ---: | ---: |
| Installed stamp | 868 | 25.905 / 13.166 |
| Metadata APIs, including non-guard setup | 6,277 | 14.132 / 14.132 |
| Context checks | 867 | 28.199 / 1.809 |
| Full hydration | 12 | 7.684 / 7.684 |
| Canonical dehydrate copies | 15 | 3.805 / 3.805 |
| Mutation | 4 | 6.311 / 1.631 |
| Commit | 3 | .755 / .645 |
| Trusted systemSet | 6 | 4.776 / .101 |
| Repository load before Page budget | 1 | 9.736 / .013 |

These are **instrumented** elapsed spans, not production CPU estimates. Guards are
the largest measured repeated synchronous family; attribution magnifies their
apparent absolute cost. Candidate validation, copying, Page membership walks and
mandatory diagnostics also consume production time. H/I already removed proven
duplicate hydration. Lifecycle dispatch constructs fresh safe scopes and invokes
live context/member/budget checks; it does not repeatedly reconstruct the full
installed ExecutionContext per setter. Installation binding validates bytes before
the Page and revalidates if fresh metadata changes. Independent Gate policy/store
authorization and provider root/lock checks are not substitutes for that binding.

| Boundary / computation | Classification and retention decision |
| --- | --- |
| External/member/event/service entry | Preserve caller, invocation, SEAM, Page ownership, current membership and service ownership checks. Awaited native work can return after revocation; prior success is insufficient. |
| Mutation/candidate/publication | Preserve candidate global identity/Form/schema/placement validation and every context/conflict/deadline/publication guard. Immutable content reuse does not certify authority. |
| Live installation guard | Preserve seven fresh BigInt metadata inspections, source/receipt validation on change, pre-existing validate/restamp sequence, barriers and stale-generation fencing. Same generation cannot prove current bytes. |
| Nested ledger wrapper | `executionBudget(token,context).check()` invokes context validation at lookup and again inside ledger assertion. This is a plausible internal consolidation target, but one must distinguish `.bounds/.snapshot/.close` from `.check/.take`, mutable controller budget selection, revocation and async entries. No lookup guard is removed here. |
| Safe context construction | Scope facades/copies are repeated per invocation; they preserve revocation, current response state and caller identity. Hoisting them across invocations would need a distinct proof. |
| Identical non-authoritative work | Diagnostic path labels can be reused locally without suppressing an inspection or granting access. This is the only retained correction. |

There is no production timing/security proof yet for a **material** safe boundary
consolidation. The audit identifies candidates, not permission to discard duplicate-
looking checks. No successful installation result, policy decision, canonical
snapshot, native write or unchecked handle is cached across operations.

Event-loop contention persists. SQLite D filesystem init→callback maxima are
671.003→631.574 ms; G maxima 752.203→763.264 ms. Histogram-only C sees maximum
469.762→596.115 ms; G 484.966→596.115 ms. Serial D/G FS maxima are .154/.184 ms.
These intervals include worker/native/OS and loop-delivery delay; FSREQPROMISE init
is not worker-ready time. Histograms include setup GET/client-supervision time and
have few samples during stalls. F's prior early-kernel-return experiment remains
separate causal scheduling evidence. J does not localize every unobserved wait.

The supported explanation is **interaction**: real repeated synchronous production
work consumes a shared event loop under twelve live deadlines; optional hook and
guard attribution adds measurable work and changes scheduling pressure. Diagnostics
alone cannot explain A failures. Pool expansion, implicit batching, timeouts,
generation-only caches and optimistic HTTP status changes are not supported fixes.

## Security, verification and next bounded correction

The new tests cover explicit/default-disabled monitoring, unchanged metadata calls
and exceptions, bounded private labels, request/operation separation, isolated
canonical/guard hooks, teardown and concurrent JSON/SQLite post-window reconciliation.
Evidence tests verify the archive hash, source hashes, all process/HTTP/provider
counts, off-mode unknowns and equal calibration work. Existing security assertions
are preserved, including source tampering/restored mtime/symlinks, catalog
replacement, recovery barriers, retired/revoked/stale handles, cross-site/package
denial, canonical failure atomicity, cancellation/deadlines and commits preceding
HTTP failure. No shipped security path changes. The initial focused selection
passes **165/165**, zero failures/cancellations/skips.

Final focused/evidence/frozen-client, content, full-suite and private installed
tarball qualification totals are recorded in the linked verification artifact and
delivery report. Installed qualification exercises real provider and process
supervision, Linux boundaries, installed-engine integration, service-free restart,
checkout-import rejection and one-engine-per-consumer proofs. These do not establish
hostile-root resistance, network filesystem correctness or managed hosting readiness.

The next bounded **production** investigation should isolate the Page-owned native
completion callback's `executionBudget(token,context).check()` path. Count its exact
contribution without per-metadata timing; compare retaining an exact owner-bound
ledger whose `.check()` still performs fresh live integrity, cancellation and
deadline checks at every callback. Prove no unchecked `.snapshot/.close` use, foreign
token acceptance, mutable budget substitution or changed failure order. Keep other
boundaries unchanged; run the full installed adversary matrix before retaining any
change. If this small path is immaterial, stop that experiment and separately count
repeated Page membership traversals within one synchronous setter. No cross-operation
authorization cache, wider canonical redesign or CIR is justified by these results.

Normal commit/push is authorized only after required verification and complete diff
review. Leave versions, frozen clients and historical artifacts unchanged. The
HTTP issue remains OPEN regardless of this diagnostic correction's calibration win.
