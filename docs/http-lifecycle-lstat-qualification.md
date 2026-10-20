# SQLite lifecycle lstat recovery — alpha.28 / increment 13

2026-10-19, Linux, Node 24.21.0. Started clean on `develop/0.3` at
`034e7a868d6f0929b845fa63d0ddd539d2a948cc`; fetched origin matched.
Platform/Wydgine/WydHosting advance to **0.3.0-alpha.28**, Store to
**0.1.0-alpha.8** for provider instrumentation. Gate alpha.7 and standalone Client
alpha.11 retain their versions. Compatibility declarations and lockfile agree.

**The dominant measured lifecycle wait precedes the existing lstat Promise rejection
recovery callback. WYDGINE-0.3-HTTP-LIMIT remains OPEN.** No concrete runtime defect
or corrective change is demonstrated. Security, lifecycle, transaction, deadline,
commit uncertainty and HTTP behavior are unchanged.

Read with [alpha.27](http-preflight-continuation-qualification.md),
[process isolation](http-process-isolation-qualification.md), the
[complete evidence](../test-support/http-reliability-alpha28-evidence-2026-10-19.json)
and [handoff](work-in-progress/http-reliability-alpha28-handoff.md).

## Trace and truthful observation boundary

`packages/wydstore/src/lifecycle-lock.js::checkLifecycleLock` uses the named
`lstat` import from **node:fs/promises**. It awaits the Promise returned by the
existing `.catch(error => ...)` rejection reaction. That callback checks `error.code`,
rethrows non-ENOENT errors unchanged, and returns null for ENOENT. After the await,
the synchronous `check(!marker, 'STORE.BUSY')` rejects a present lifecycle marker.
There is no wait-for-unlock loop, retry, admission queue or lock acquisition here.

The raw filesystem completion callback is **not exposed by this implementation**.
Changing filesystem APIs or adding a `.then()` callback would change the scheduling
under investigation. Neither is done. Invocation-to-recovery-entry is the nearest
truthful interval; it includes filesystem/runtime work and Promise rejection delivery
before the existing callback executes. It is not invocation-to-filesystem-callback
latency and cannot distinguish physical I/O from scheduling.

Only SQLite transaction execution passes the existing trusted completion control
into this internal helper. Startup, maintenance and JSON callers retain their
existing unobserved call shape. The existing lifecycle-owner bypass still returns
before any filesystem operation or new observation. The SQLite path remains:
inspection (`safeRoot`, database/sidecar checks), lifecycle marker check, existing
ledger `completion.check()`, then database open/pragmas, metadata validation,
synchronous transaction, pre-COMMIT guard and close. Those later SQLite operations
retain their separate `sqliteTransaction` stage.

One Contact POST normally executes two native Store calls (create and query), each
with its own lifecycle observation. Concurrent requests use the same adapter/file
and immutable lifecycle setting, but have no shared lifecycle wait state or diagnostic
collector. Timestamps live in each operation closure; only numeric aggregates belong
to its Page. Existing SQLite/dispatch/Page spans overlap and are not additive CPU time.

## Markers and representation

The fixed `diagnostics.continuations.sqliteLifecycleLstat` row records:

| Point | Exact location |
| --- | --- |
| Entry | Observation creation after lifecycle-owner bypass |
| Invocation | Immediately before existing `lstat(path.join(...))`, including small argument-evaluation overhead |
| Recovery entry | First statement of existing rejection recovery callback; raw filesystem callback remains unobserved |
| ENOENT | Immediately after the unchanged error-code comparison accepts ENOENT |
| Producer completion | Synchronous finally at end of that callback, before returning null or throwing |
| Resumption | First finally statement around the existing lifecycle await, on success or rejection |
| Validation | Finally after the existing synchronous STORE.BUSY check; absent when lstat rejects |

The **producer-side completion marker is not a Promise settlement timestamp**.
Its continuation interval includes the final synchronous producer tail and existing
Promise/await scheduling. It makes no direct settlement-time assertion.

Fixed sample/count/sum/max aggregates separate `invocationToRecovery`, `recoveryWork`,
`continuation` and `validation`. `classification` is a subset of recovery work;
`entryToResume` contains invocation/recovery/continuation. Never sum these overlapping
fields. A single largest-invocation tuple stores monotonic offsets relative to the
Page collector's creation, including accepted ENOENT classification. The existing
`sqliteLifecycle` envelope additionally includes outer caller resumption and collector
boundary overhead. Missing/incomplete counters expose unavailable observations;
a fulfilled lstat increments `resumedWithoutRecovery` without inventing a recovery
interval. Non-ENOENT failures preserve the same rejection and skip validation.

No timers, Promise wrappers, reactions, scheduling barriers, new filesystem operations solely for measurement,
SQL, paths, filenames, arguments, records, credentials, unbounded histories, public
endpoint or native authority are added. Disabled controls expose no continuation
method and read no diagnostic clock. Existing external observer exception isolation
and shared sampler cleanup are preserved; the collector registers no observer itself.

## Deterministic qualification

Focused final source selection passes **153/153**, zero failures/skips, including
all six controlled HTTP deadline/commit/drain probes. Calibration plus existing
native-stage tests passes **20/20**. New controlled cases establish:

- A held filesystem result produces **70 ms invocation-to-recovery / 0 ms continuation**.
- A test-only microtask queued after the producer marker produces **0 / 80 ms**;
  the filesystem operation is not claimed to remain pending during that delay.
- Immediate ENOENT produces valid zero intervals and exactly one lstat call.
- EIO preserves the original error object at the helper boundary and STORE.IO at
  the provider. A present marker preserves STORE.BUSY; lifecycle-owner bypass
  performs no lstat. Both failures prevent a reported commit.
- Overlapping operations finish out of order with correct **70 / 20 ms** attribution
  in independent request collectors. After 10,000 operations snapshots stay fixed
  in shape, frozen, idempotent and bounded; missing observations remain explicit.
- Enabled/disabled real-provider outcomes and filesystem counts agree. Existing
  cancellation/pre-COMMIT rollback, reported-commit uncertainty and first-exhaustion
  tests pass. Existing SQLite HTTP probes now deliberately throw from their trusted
  observer; success, precommit cancellation, disconnect and recovery assertions hold.
  Existing sampler tests preserve sibling observation and release the last timer.
- Async-resource calibration allocates no Promise, timer or immediate for either
  observation type; disabled scheduling order remains unchanged.

Initial native calibration was **19/20**, followed by **7/8** in its narrowed file:
fixture teardown constructed unused rejected Promises, and a nested filesystem mock
restoration leaked into the subsequent provider fixture. The isolated provider case
passed; correcting fixture cleanup/restoration yields **20/20**. Runtime logic was
not changed to resolve these failures. The sandbox's file-level 1/2 result is retained
but not counted as individual assertion verification. Initial focused selections
passed **53/53** and **74/74**. Every log digest remains in the evidence.

## One isolated reproduction

```sh
node test-support/http-concurrency-probe.mjs --output /tmp/contact-alpha28-lifecycle --lifecycle-lstat > /tmp/alpha28-experiment.log 2>&1
```

Exactly three fresh SQLite fixtures, fresh server workers and supervised separate
clients, actual client/server/admission/Page concurrency twelve in every window.
The Contact payloads, empty starting data, one anonymous setup GET, 1,000 ms
Date-based Page deadline, monotonic diagnostics, 50 ms sampler and transport match
alpha.27. No suite ran simultaneously, no request was retried and no window was
repeated or discarded. Measurement preceded metadata synchronization: measured
platform/engine alpha.27 and Store alpha.7; implementation fingerprints are retained.

| Repetition | POSTs | HTTP 200 | HTTP 500 / matching prerender deadline |
| --- | ---: | ---: | ---: |
| 1 | 12 | 6 | 6 |
| 2 | 12 | 2 | 10 |
| 3 | 12 | 5 | 7 |

**13/36 HTTP 200; 23/36 HTTP 500**, all failures received indeterminate and matching
the established signature. Every POST reports one commit, two settled native calls,
zero pending calls and complete client receipt. Publication/response-end observations
agree; a reported commit remains distinct from client receipt. All three setup GETs,
client exits/reaping and fixture cleanups pass. No timeout, partial or unknown receipt.
All 23 failed requests first exhaust during prerender. Two successful 200/committed
requests first exhaust only in cleanup; these are retained and not classified as
matching failed responses. Total series duration **6,107 ms**.

| Per-request two-call aggregate, ms | All min / median / max | Failed min / median / max |
| --- | --- | --- |
| Invocation to existing recovery entry | 0.669182 / 483.721669 / 913.567554 | 0.972625 / 509.176375 / 913.567554 |
| Recovery entry to producer marker | 0.003557 / 0.006963 / 0.053651 | 0.003557 / 0.006543 / 0.022633 |
| Producer marker to lifecycle continuation | 0.001162 / 0.002925 / 0.013045 | 0.001162 / 0.002535 / 0.013045 |
| Subsequent lifecycle validation | 0.005161 / 0.014357 / 0.120637 | 0.005161 / 0.013134 / 0.120637 |
| Full lifecycle envelope | 0.729516 / 483.798324 / 913.596828 | 1.002421 / 509.208957 / 913.596828 |
| Inspection | 4.771050 / 475.537159 / 908.846987 | 65.903948 / 505.045763 / 908.846987 |
| Full preflight | 656.989887 / 908.842834 / 1085.696054 | 857.936325 / 956.346326 / 1085.696054 |
| Synchronous transaction | 2.032705 / 3.267358 / 14.959731 | 2.032705 / 2.982387 / 14.959731 |

All **72/72** lifecycle operations enter recovery, classify ENOENT, reach the producer
marker, resume and validate. No missing/incomplete observations. Existing inspection
observations also complete. Lifecycle envelope residual after its contained
entry-to-resume and validation intervals is **0.004990 / 0.007157 / 0.016511 ms**
(min/median/max), including outer continuation and observer overhead. No large
unexplained lifecycle residual remains within these measured boundaries. Inspection's
internal awaits remain unresolved. Maxima in different rows need not share a request.

Executed scheduling callback lateness peaks at **390.454 ms**, pending lateness lower
bound **355.308 ms**. Largest observed zero-check interval is **12.427 ms**; largest
checkpoint interval **632.607 ms** can contain checks. All 36 sampler tails are
incomplete; these are conservative server observations, not exact unchecked maxima
or client/server clock subtraction. Full progress counters, first exhaustion,
successes/failures and source-artifact digests are retained in portable evidence.

## Attribution and next distinguishing step

Within this measured lifecycle path, recovery work, post-marker continuation and
subsequent STORE.BUSY validation are small. The long interval ends when the existing
Promise rejection recovery reaction begins. This excludes dominant delay after that
producer marker, but **does not locate native filesystem callback execution**.
Physical filesystem latency, thread-pool scheduling, event-loop delivery, Promise
rejection delivery and OS/runtime contention remain hypotheses. Scheduling lateness
is compatible with interference and does not establish its cause. These results
do not generalize to exclusive CPU time or all SQLite transactions.

No optional counter-experiment was run: another load series would not reveal the
hidden callback boundary. The next smallest distinguishing step is to validate a
**test-only bounded async_hooks correlation for the lifecycle lstat FSREQPROMISE
resource**, then compare its callback execution boundary with existing recovery
entry, retaining the same filesystem API and Promise chain. Resource attribution
must be proven before interpreting it; even a callback-execution timestamp would
not timestamp kernel completion or prove physical disk latency. No generic native
bridge or production scheduling change is authorized by this finding.

Installed tarballs pass **310/310 integration, 35/35 provider, 20/20 process and
25/25 unprivileged Linux**, zero failures/skips. Service-free HTTP/assets/restart,
repository-import rejection and one engine per consumer also pass; see handoff/evidence. The normal
full-suite and final content-check results after all tracked edits are recorded in
the delivery commit and final report. Privileged managed-hosting/Linux and browser/
human checks are omitted. No deployment or package publication occurs.
