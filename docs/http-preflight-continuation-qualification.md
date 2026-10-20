# SQLite preflight continuation — alpha.27 / increment 12

2026-10-19, Node 24.21.0, Linux. Started clean on `develop/0.3` at
`f285d4f1cc935df463d97d9868f3967665ffe6e4`; fetched origin matched.
Platform/Wydgine/WydHosting advance to **0.3.0-alpha.27**, Store to
**0.1.0-alpha.7** for its actual provider instrumentation. Gate alpha.7 and
standalone Client alpha.11 retain their versions. Search/Stream peer alternatives
include alpha.27; manifests, lockfile, runtime descriptor and revision agree.
No dependency, execution limit, authority, publication or HTTP behavior changes.

**The dominant measured preflight delay occurs before inspection completes and/or
inside the lifecycle check. Resuming the transaction after inspection completion
is fast, including on failed requests. WYDGINE-0.3-HTTP-LIMIT remains OPEN.**
This is a verified instrumentation/evidence increment with partial causal
attribution, not a demonstrated root cause or runtime correction.

Read with the [alpha.26 comparison](http-process-isolation-qualification.md),
[alpha.25 stage semantics](http-concurrency-qualification.md),
[ledger/sampler semantics](http-deadline-attribution-qualification.md),
[complete evidence](../test-support/http-reliability-alpha27-evidence-2026-10-19.json)
and [handoff](work-in-progress/http-reliability-alpha27-handoff.md).

## Actual await chain and observation boundary

Page service execution enters `completion.run`, whose existing Promise microtask
invokes dispatch. Dispatch awaits authorization/validation, begins the native
operation, and awaits the Store handler. Store authorization/validation, lifecycle
and generation guards remain intact. The adapter's `transaction()` starts the
existing `sqlitePreflight` elapsed stage and the optional continuation observation.
It invokes async `inspectFiles()`, creating that function's native Promise, and
awaits that same Promise. There is no wrapping async function or added reaction.

Inspection awaits `safeRoot`: sequential ancestor `lstat` calls and `realpath`.
It then sequentially awaits database and `-journal`/`-wal`/`-shm` `lstat` calls.
Missing optional sidecars are handled by existing catch branches. File, link,
size and metadata checks are synchronous. Inspection has no queue or lock wait.
Its final synchronous `finally` calls `observation.complete()` after those checks,
on both success and rejection. There is no subsequent await, returned Promise
adoption, or application callback in that producer. The Promise fulfills with
undefined or rejects after this marker. `transaction()` records `resume()` as the
first statement in its existing await's `finally`, before lifecycle work begins.

**The producer marker is not a direct Promise settlement timestamp.** The measured
completion-to-resumption interval includes the small final synchronous producer
tail and therefore envelopes actual settlement-to-resumption. No settlement time
is inferred from an await returning. This deliberately narrower provider-owned
point avoids `.then` measurement reactions, global Promise hooks and new scheduling
barriers. [Node's Promise hook documentation](https://nodejs.org/docs/latest-v24.x/api/v8.html#promise-hooks)
was considered; the provider-owned point suffices for this bounded distinction
without process-wide hooks. It cannot expose filesystem kernel completion or
scheduling before inspection's internal awaits resume.

After inspection resumes, `transaction()` separately awaits `checkLifecycleLock`,
now bracketed by fixed `sqliteLifecycle` elapsed timing. That function does one
asynchronous marker `lstat`, an existing `.catch` converting ENOENT to null, then
synchronously rejects a present marker with STORE.BUSY. It never waits for a marker
to disappear and has no provider-availability queue. Its elapsed stage includes
filesystem work, rejection recovery and internal/outer continuation delay; it
is **not** a settlement measurement. All measured calls pass this check.

The existing `completion.check()` then checks the shared ledger before SQLite
entry. Database open/pragmas, metadata checks, synchronous transaction, record
operations, pre-COMMIT guard and close occupy `sqliteTransaction`. The dispatch
and Page await chain subsequently resumes; this observation does not measure every
later Page continuation. Existing reported-commit, service settlement, ledger
progress checkpoints and first exhaustion remain independent evidence.

## Bounded representation and calibration

Only the existing trusted opt-in Page diagnostic path enables the new control.
Disabled operations have no continuation function or timing collector/clock reads.
`diagnostics.continuations.sqliteInspectFiles` holds fixed numeric counts and
sum/max intervals, plus one largest-operation tuple of monotonic offsets relative
to collector creation: preflight entry, operation start, provider completion and
transaction resumption. No per-operation history, SQL, paths, arguments, records,
credentials, public endpoint or new native authority is introduced. Existing
observer exception isolation and cleanup remain unchanged.

`operation` spans start to provider completion; `continuation` spans completion to
resumption; `preflightToResume` contains both plus small entry overhead. The latter
ends **before** lifecycle. These are nested elapsed intervals, not CPU time.
`sqlitePreflight` contains inspection and lifecycle; nativeHandler and Page service
spans contain still more work. Never add overlapping envelopes together. Per-request
interval totals below cover two calls; maxima are not all from the same request.

`completeBeforeAwait` records producer completion before the caller marks its
await. This distinguishes the deterministic immediately fulfilled producer from a
pending producer without a generic claim about arbitrary Promise state. Missing
completion increments `missingCompletion` and contributes no invented operation or
continuation duration; `incomplete` counts calls without resumption. Duplicate
completion/resumption notifications are idempotent. Snapshots are frozen and fixed
size even after 10,000 calls. No collector-owned timer, Promise or global lifecycle
registration exists; an async-resource test verifies zero such allocations.

Controlled-clock calibration proves a provider barrier yields **70 ms operation /
0 ms continuation**, a queued continuation delay yields **0 / 80 ms**, and immediate
completion yields **0 / 0 ms** with `completeBeforeAwait=1`. A real SQLite inspection
fixture combines a held filesystem result and a queued post-marker job, yielding
**70 / 80 / 150 ms** operation/continuation/envelope. Enabled and disabled cancellation
at the existing preflight guard have identical service/commit/outcome snapshots,
no transaction entry and no pending services. Existing pre-COMMIT rollback,
post-COMMIT uncertainty, deadline/publication and throwing-observer regressions
remain required. Concurrent Contact requests exercise separate Page collectors;
controlled ordering is identical with and without observation. The calibration
introduces fixture barriers only; production scheduling is unchanged.

## One controlled reproduction

Run alone with a new directory:

```sh
node test-support/http-concurrency-probe.mjs --output /tmp/contact-alpha27-continuation --preflight-continuation > /tmp/alpha27-experiment.log 2>&1
```

The mode runs exactly **three** fresh SQLite installations/server workers with the
existing supervised separate client at concurrency twelve. Contact payloads, one
anonymous setup GET, empty initial data, 1,000 ms Date-based Page deadline,
performance.now diagnostics, 50 ms server sampler and transport match alpha.26.
No suite ran concurrently, no request was retried, and no experiment was repeated
or discarded. Runtime fingerprints and measured versions are preserved: measurement
preceded metadata synchronization (platform/engine alpha.26, Store alpha.6).

| Repetition | POSTs | HTTP 200 | HTTP 500 / matching prerender deadline | Actual client/server/admission/Page overlap |
| --- | ---: | ---: | ---: | --- |
| 1 | 12 | 4 | 8 | 12 / 12 / 12 / 12 |
| 2 | 12 | 5 | 7 | 12 / 12 / 12 / 12 |
| 3 | 12 | 2 | 10 | 12 / 12 / 12 / 12 |

Total **11/36 HTTP 200, 25/36 HTTP 500**, all failed responses matching the historical
prerender/timeMs/two-settled-native/one-reported-commit/indeterminate signature.
Every POST reports one commit, two native entries, zero pending calls; server
publication and complete client receipt agree. All **3/3** setup GETs pass, all
three clients exit zero and are reaped, and every fixture cleans up. There are no
client timeouts, partial or unknown receipts. Total series duration: **6,015 ms**.
All 25 first exhaustions occur during prerender; successful requests do not exhaust.

| Per-request aggregate ms (two calls) | All: min / median / max | Failed: min / median / max |
| --- | --- | --- |
| Inspection start to provider completion | 3.547 / 451.090 / 857.199 | 3.547 / 296.701 / 857.199 |
| Provider completion to transaction resumption | 0.000972 / 0.001994 / 0.008246 | 0.000972 / 0.001953 / 0.004028 |
| Preflight entry to inspection resumption | 3.567 / 451.103 / 857.212 | 3.567 / 296.719 / 857.212 |
| Full SQLite preflight | 682.648 / 905.530 / 1,109.088 | 865.077 / 923.887 / 1,109.088 |
| Lifecycle await | 0.512 / 535.195 / 926.693 | 69.689 / 601.980 / 926.693 |
| Synchronous transaction | 1.992 / 3.362 / 14.749 | 1.992 / 3.227 / 12.619 |

All **72/72** inspection observations report provider completion and resumption;
none are incomplete, missing completion or complete before await. One failed
request's two inspection calls total only **3.547 ms** while lifecycle totals
**926.693 ms**. Long inspection is therefore not necessary for this reproduced
failure. Successful requests can also have long inspection (up to **760.643 ms**)
and lifecycle (up to **666.565 ms**); neither elapsed interval alone proves cause.

Executed callback lateness reaches **391.605 ms**; pending lateness lower bound
**407.522 ms**. Largest observed zero-check interval is **6.670 ms**; largest
checkpoint interval **668.854 ms** can contain checks. All 36 sampler tails are
incomplete. These are server observations; no subtraction of client process clocks
or claim of exact unchecked maxima is made. All successful and failed request
records, first exhaustion, existing progress counters, full numeric diagnostics,
setup results and raw artifact SHA-256 digests are retained in the evidence.

## Supported distinction and remaining uncertainty

A large delay **after inspection completion but before its caller resumes** is
excluded as the dominant preflight component in this measured failure series.
Elapsed time accumulates before that completion and/or in the separate lifecycle
await. There is no explicit SQLite admission queue, JSON-style serialization or
wait-until-unlocked lifecycle operation on this path. These facts narrow the
mechanism without identifying disk latency, libuv availability, OS descheduling,
GC, or internal continuation interference. Provider-only alpha.25 controls remain
historical evidence; they are not substituted for this Page workload.

The new boundary does not separate filesystem Promise completion from the internal
continuations in `safeRoot`, sidecar inspection or lifecycle recovery. Scheduling
lateness is compatible with interference there, but is not causal attribution.
No runtime defect is demonstrated; no HTTP correction, ceiling increase, suppressed
check, retry, authority or committed/indeterminate semantic change is justified.

No optional counter-experiment was performed. The primary run decisively excludes
one proposed location; another load run would not resolve the remaining internal
boundary. The next smallest experiment is a marker inside the **existing lifecycle
lstat ENOENT recovery callback**, immediately before it returns null, paired with
resumption of the awaiting lifecycle function. That adds no Promise reaction and
separates recovery-to-continuation delay within the long lifecycle interval. It
still would not timestamp the raw filesystem completion, which must remain explicit.

## Verification and delivery

Initial native calibration **11/11**; initial focused provider/deadline/diagnostic/
harness selection **77/77**, zero failures/skips. A restricted-sandbox calibration
reported only one aggregate file pass; it is retained but not counted as individual
assertion verification. No measured window failed validation. Alpha.23–.26 failures
and their original evidence are preserved unchanged.

Final focused, installed, required full-suite/content, dependency, whitespace and
relative-link checks are recorded in the handoff/evidence after execution. Omitted
privileged managed-hosting, browser/human and deployment checks imply no passing
claim. Commit/push identity and final tree status are supplied in the final report.

The first final focused selection passed **137/142**, with five failures: three
escaped startup-banner assertions still expected alpha.26, and two startup tests
used the multi-App example's exact Store alpha.6 pin. Correcting those version
references yields **142/142**, zero skipped. The first installed integration staged
the old exact fixture pin and passed **272/302** with 30 startup-dependent failures;
that attempt and every failed test name are retained in evidence. No provider or
HTTP behavior was changed to resolve these metadata failures.


Corrected installed local tarballs pass **302/302 integration, 35/35 provider,
20/20 process, 25/25 unprivileged Linux**, all zero skipped. Service-free binary,
HTTP/assets/restart, checkout-import rejection and exactly one installed engine per
consumer also pass. Command: `node scripts/verify-packed-packages.js`; directory:
`/tmp/wyd-i54-packed-0q4Qgd`, log `/tmp/alpha27-packed-corrected.log`. Earlier failed
installed results remain retained. Dependency graph, whitespace and **634** relative
documentation links (zero missing) pass. `npm run check` passes three complete pages
and 42 internal links/anchors. After these final tracked edits, one normal
`npm test` and final `npm run check` are executed; actual totals and log hashes are
recorded in the delivery commit message and final report, without predicting a pass.
Privileged Linux/managed hosting and browser/human checks are omitted; no deployment
or publication is performed.
