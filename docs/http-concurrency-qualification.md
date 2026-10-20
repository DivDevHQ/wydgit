# HTTP concurrency qualification — alpha.25

The later [Spike K post-commit audit](work-in-progress/http-post-commit-critical-path-spike-k.md)
records exact Page-budget boundaries and repeated committed-write/deadline failure
timelines. Resolving immutable installation paths once reduces stamp cost while
preserving every fresh inspection. Corrected attributed windows still fail;
WYDGINE-0.3-HTTP-LIMIT remains OPEN.

The later [Spike J production/observer audit](work-in-progress/http-production-observer-spike-j.md)
repeats ten-window production samples and isolated observer controls with independent
post-window provider counts. Optional-observer-disabled HTTP failures still
reproduce; the issue remains OPEN. Its retained correction is diagnostic-only.

The later [Spike G attribution](work-in-progress/http-prerender-integrity-spike-g.md)
adds an opt-in synchronous sidecar to the same separate-client Contact fixture,
with source-pinned before/after, overhead, canonical-scaling and integrity-negative
captures. It retains every production metadata check and keeps the HTTP issue OPEN.

2026-10-19, 0.3-J increment 10. Node **24.21.0**, npm **11.19.0**, Linux.
Started clean on `develop/0.3` at `f6ce1590f60d0d6b13d18e8c6fbaf6cd7ae18a78`;
fetched origin matched. The local npm workspace metadata initially described older
packages; an offline lockfile-only refresh restored agreement with the unchanged
tracked alpha.24 manifests before measurement.

**Matching Contact failures reproduced. WYDGINE-0.3-HTTP-LIMIT remains OPEN.**
The experiment locates substantial awaited delay and preserves first failures,
but establishes neither the historical root cause nor a corrective runtime change.
The 1,000 ms Page ceiling, Date clock, authority, cancellation, generation fencing,
service settlement, commit uncertainty and HTTP contracts remain unchanged.

Platform/Wydgine/WydHosting advance to **0.3.0-alpha.25**. Store advances to
**0.1.0-alpha.6** because its actual JSON/SQLite provider implementations gain
private opt-in timing. Gate alpha.7 and standalone Client alpha.11 are unchanged.
All measured series ran before version synchronization: alpha.24 / Store alpha.5
metadata, first with ledger anchors, then with the described stage changes.

The [structured evidence](../test-support/http-reliability-alpha25-evidence-2026-10-19.json)
retains every measured request's classification, admission/publication/client
state, ledger anchors/counters, maximum progress intervals, callback samples and
stage aggregates. Full first matching and representative provider failures retain
all alpha.24 progress phase snapshots. Other request summaries preserve phase/span
durations and counter-progress indicators, rather than duplicating every snapshot.
The [alpha.23](http-reliability-and-session-qualification.md) and
[alpha.24](http-deadline-attribution-qualification.md) evidence remains historical.

## Reproduce alone

From the repository root with installed dependencies and native loopback access:

```sh
node test-support/http-concurrency-probe.mjs --output /tmp/contact-alpha25-new
node test-support/http-concurrency-probe.mjs --output /tmp/contact-alpha25-admission-new --admission-control
node test-support/http-concurrency-probe.mjs --output /tmp/contact-alpha25-observer-new --observer-control
node test-support/http-concurrency-probe.mjs --output /tmp/contact-alpha25-provider-new --provider-control
```

Run each command separately, without other test suites. Every output directory
must be new; reuse is rejected so a passing run cannot overwrite a failure.
The first command runs three repetitions at 1/2/4/8/12, then a four-request
disabled/enabled/enabled/disabled observer control. JSON runs separately before
SQLite. It has at most **38 windows, 194 POSTs and 38 setup GETs**. Counter modes
are separate experiments: admission changes only client spacing (0/20/20/0 ms,
eight windows / 96 POSTs); observer mode uses the same ABBA order at twelve
(eight windows / 96 POSTs); provider mode runs three native-only twelve-sequence
windows per provider (six windows / 72 create/query sequences / six setup GETs).

Each window starts one fresh child process containing its client and loopback
server, installs the existing guestbook into Contact using the interactive
installer, and begins with empty data. It performs exactly one setup GET to
establish an anonymous session and CSRF binding. Gate remains disabled. Payload
data is identical for every POST. The burst barrier releases prepared clients
before HTTP requests begin; there is no deliberate wait inside a Page or provider.
Every subsequent window gets a new installation, process, session and dataset.
Different burst sizes naturally produce different numbers of committed records;
this is part of the workload, not an independent dataset-size experiment.

Transport is fixed Node HTTP/1.1 at 127.0.0.1 with no keep-alive, maxSockets 12,
8,192 header bytes, 64 headers, 120,000 ms request timeout and 15,000 ms header
timeout. Each client has a separate 10,000 ms absolute bound. Preparation barriers
expire after 1,000 ms, each worker after 45 seconds, and a series after twelve
minutes. Request/window counts are fixed; there are no retries. A parent-owned
scratch directory is removed even if the worker must be killed. Ordinary cleanup
drains admitted services and attempts every cleanup callback despite failures.

Future runs also record fixture/runtime source fingerprints and package versions,
and remove NODE_OPTIONS/NODE_PATH from workers. These metadata additions followed
the retained experiments and do not retroactively supply hashes for those runs.
Per-window artifacts are saved before the next experiment, with the first matching
trace copied separately. Workers have bounded output; exit/timeout/protocol failure
records explicitly state that traces and client outcomes may be incomplete.

## Primary ladder: alpha.24 diagnostics with ledger anchors

Actual peak concurrency equaled the requested level in **all three repetitions**
at the client, server, host admission and Page ledger layers for both providers.
Page overlap is reconstructed from wall-clock start/final-meter intervals at 1 ms
resolution; client/server/admission intervals use monotonic fixture timing.
All client responses completed, including failures; no request timed out.
Failures below are 500/indeterminate, with two settled native entries and one
reported commit. Every failed POST matches the alpha.23 prerender signature.

| Provider | Actual concurrency | POSTs | 200 / 500 | Deadline / indeterminate | Max callback lateness ms | Largest observed unchecked ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| JSON | 1 | 3 | 3 / 0 | 0 / 0 | 29.427 | 4.485 |
| JSON | 2 | 6 | 6 / 0 | 0 / 0 | 27.021 | 5.962 |
| JSON | 4 | 12 | 12 / 0 | 0 / 0 | 28.780 | 4.895 |
| JSON | 8 | 24 | 24 / 0 | 0 / 0 | 47.331 | 6.260 |
| JSON | 12 | 36 | 15 / 21 | 21 / 21 | 43.065 | 8.602 |
| SQLite | 1 | 3 | 3 / 0 | 0 / 0 | 24.674 | 6.050 |
| SQLite | 2 | 6 | 6 / 0 | 0 / 0 | 24.933 | 5.901 |
| SQLite | 4 | 12 | 12 / 0 | 0 / 0 | 89.360 | 5.264 |
| SQLite | 8 | 24 | 24 / 0 | 0 / 0 | 86.320 | 6.416 |
| SQLite | 12 | 36 | 18 / 18 | 18 / 18 | 78.457 | 6.074 |

The primary ladder is **123 successful / 39 failed out of 162 POSTs**. Its
separate four-request ABBA control adds 32 successful POSTs and eight setup GETs;
all 38 setup GETs in the complete command succeeded. Maximum client durations at
twelve were JSON 1,400.320 ms and SQLite 1,418.341 ms. These include pre-ledger
admission and client scheduling and must not be compared directly to the Page limit.

The preserved first match is JSON window 13, request 6: timeMs **1,000/1,000**,
prerender, two native entries, no pending services, one reported commit,
500/indeterminate accepted by the server and completely received by the client.
Its sampler records **15 callbacks**, **43.009 ms** maximum lateness. Its largest
checkpoint is **536.380 ms** across a service interval containing **five guard
entries** with unchanged SEWN counters. This is not a zero-check interval. Its
largest observed zero-check gap is only **2.597 ms**. Progress resumes during
prerender, advancing steps from 79 to 532 before exhaustion. There is no evidence
here of a single uninterrupted one-second callback stall or counter exhaustion.

## Distinguishing experiments

Admission ABBA retains actual twelve-way overlap at all four layers. JSON burst
windows fail 15/24; spaced windows fail 14/24. SQLite burst fails 13/24; spaced
fails 12/24, with two additional successful responses reporting cleanup-only
deadline exhaustion. Spacing by 20 ms does not eliminate the failure class.
It is not a mitigation or evidence that all arrival patterns are equivalent.

The original four-request observer comparison has eight POSTs per mode/provider.
Client medians, disabled/enabled: JSON **387.303/388.791 ms**, SQLite
**401.237/421.568 ms**. After adding stages, the identical control measures
**409.903/399.861 ms** and **449.255/445.752 ms**. The ranges overlap. These small
correlated samples do not establish a universal overhead bound or causation for
differences between independent runs. The twelve-request observer ABBA further
records JSON disabled **15/24** and enabled **16/24** failed responses; SQLite
disabled **14/24** and enabled **15/24**. Disabled responses still show
500/indeterminate, but have no private exhaustion/phase/sample records, so they
are not counted as instrumented matches. Instrumentation is not necessary for
the client-visible failure class. Enabled-only failure frequency differences
near the budget boundary are not a measured instrumentation cost.

The provider-only control keeps the installed package's exact authority, provider,
payload data, empty initial state, create-then-query sequence and 1,000 ms kernel
ledgers. It omits the HTTP POST/Page workflow and presentation, explicitly changing
one broad factor: surrounding Page work. All **36/36 JSON** and **36/36 SQLite**
sequences succeed, with actual native overlap twelve and one reported commit per
sequence. Maximum sequence duration is **62.334 / 60.873 ms**; neither provider
exhausts its ledger. These are native-service results, not HTTP/client receipts.
They support interaction with surrounding Page execution as a leading explanation;
they do not localize the responsible Page operation or measure CPU consumption.

## Conditional native-stage attribution

Only after matching failures and the admission counter-experiment, long service
intervals left a material dispatch/queue/preflight attribution gap. Private
`operation.stage` exists only on observed trusted completion controls. It accepts
seven fixed identifiers and retains bounded calls/completed/elapsed/max aggregates.
No arguments, SQL, paths, credentials, records, exception details or per-operation
history are retained. Ordinary Wydgit code gets no new API or authority. Disabled
controls have no stage function, aggregate object or stage clock reads.

| Stage | Actual boundaries |
| --- | --- |
| dispatchValidation | Request budget/canonical copying; additionally versioned schema validation when applicable |
| dispatchAuthorization | Awaited canonical service authorization |
| nativeHandler | Handler entry through promise settlement, including rejection |
| jsonQueue | Transaction enqueue through the actual predecessor-chain callback starting; never inferred from begin() |
| jsonWork | Dequeue through transaction checks, asynchronous storage and lock cleanup |
| sqlitePreflight | Awaited safe-root/file/lifecycle inspection through guarded admission |
| sqliteTransaction | Synchronous database open/setup/transaction/commit/close, including failure cleanup |

Stages nest and overlap Page/service spans. Completed means settlement, not service
success. Do not subtract overlapping aggregates to estimate CPU, exclusive work or
disk latency. JSON work and SQLite preflight include delay before async
continuations run; the sampler cannot identify the underlying JS/GC/OS cause.

The same ladder with stages again reaches every actual level. All 90 POSTs at
1/2/4/8 succeed. At twelve:

| Provider | POSTs | 200 / 500 | Matching failures | Total deadline exhaustions | Max lateness ms | Largest unchecked ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| JSON | 36 | 12 / 24 | 24 | 24 | 59.855 | 7.657 |
| SQLite | 36 | 11 / 25 | 25 | 27 | 91.459 | 9.058 |

SQLite's two extra deadlines are cleanup-only successful 200/committed responses.
The private native-stage sums per request reach JSON queue **878.270 ms** and
work **428.031 ms**, SQLite preflight **941.335 ms** and synchronous transaction
**14.060 ms** at level twelve. Dispatch validation reaches **0.067 / 0.143 ms**,
authorization **0.330 / 0.483 ms**. These independent maxima can belong to
different requests; adding them is invalid. In the corrected provider-only control,
maximum JSON queue sum is **52.850 ms**, SQLite preflight **52.669 ms**. The
measured SQLite synchronous transaction stages are not a one-second native block.
The evidence does not establish accidental queue serialization: JSON's queue is
intentional transaction protection, and SQLite has no corresponding JS queue.

The full first/second ladders, admission control and high observer control total
**580 POSTs and 92 setup GETs**. The initial invalid and corrected provider controls
add **144 native sequences and twelve setup GETs**. A separate pre-ladder harness
validation made one GET and two POSTs. All experiment counts are finite; full and
installed suites never overlapped them. No larger concurrency search was started.

## Hardening, qualification and retained failures

New tests cover barrier readiness/expiration/cancellation, actual overlap, strict
historical matching, partial client responses, timeouts, uncertainty, cleanup after
errors, both real Contact fixtures, native-only controls, identifier shape,
concurrent observer failure/removal, commit before publication failure, failed
native entry, successful/thrown settlement, disabled allocation/clock behavior,
actual JSON queue boundaries and SQLite preflight/transaction failure cleanup.
Ledger anchor tests preserve wall rollback, equality, clipped deadlines and null
start evidence when a clamped zero allowance cannot recover the original start.
The unchanged forced probes now require all observed stages to settle on deadline
or real disconnect. No regression/security assertion was weakened.

Focused harness/stages/progress/sampler/HTTP/completion plus six forced probes:
**51/51**, zero skipped, `/tmp/alpha25-final-focused-2.log` (the preceding checkpoint
passed 50/50). The first version/package/
launcher/transport run was **61/64**: three startup-banner regexes still expected
alpha.24 while the actual banner correctly printed alpha.25. Those assertions were
synchronized after verifying the outputs; the failed log is retained at
`/tmp/alpha25-versions-focused.log`; its corrected repeat passed **64/64**.

Final review also demonstrated a harness-only classification defect: with diagnostics
disabled, an incomplete response carrying a committed header incorrectly reported
`writeOutcome=committed`. The new regression failed **0/1** before the correction
(`/tmp/alpha25-partial-header-before.log`) and passes in the 51/51 command. An
incomplete committed header now remains indeterminate. All measured POST responses
were complete, so this correction does not alter any retained experiment outcome
and does not fix the historical Page failure.

The first provider-only comparison is retained as **invalid for performance
comparison**: plain randomUUID identifiers may start with a digit, while Store
requires a letter and SEWN NewId prefixes `w`. Only 9/36 JSON and 10/36 SQLite
create/query sequences succeeded, so its smaller dataset cannot be compared to
Contact. The corrected generator matches SEWN exactly and both-service/commit
regressions prevent the same silent underload. The restricted sandbox's initial
aggregate-only 2/3-file result is separate from the native **22/22** harness check.
No matching failure or unsuccessful experiment was discarded.

Source `npm test` checkpoint: **1,557/1,557**, zero skipped, 70.184 seconds
(`/tmp/alpha25-full-checkpoint.log`), before the final partial-header regression.
Final installed tarballs at `/tmp/wyd-i54-packed-PZgKJj` include that regression:
**285/285 integration**, **35/35 provider**, **20/20 actual process supervision**,
**25/25 unprivileged Linux**, zero skipped. Service-free binary/HTTP/assets/restart,
checkout-import denial and exactly one installed engine per consumer pass.
Tarballs contain Wydgine **131**, Hosting **50**, Gate **13** files. No publication.

`npm run check` passes (three complete pages, 42 internal links/anchors), as do the
dependency graph, whitespace and **613 relative documentation file links** (zero
missing). All 32 tracked standalone Client distribution files, engine runtime
assets and portable ledger/events implementation match starting HEAD. These source
and installed tests cover Gate/session/authentication, JSON/SQLite, BackOffice
HTTP/UI, cancellation, fencing, package boundaries and existing security regressions.
The required full suite and content check run again after this documentation/evidence
update; the actual final outcome is recorded in the delivery commit and final report,
not predicted here. Passing qualification does not waive the captured failures.

Review of Contact handling confirms reported commits remain distinguishable from
rollback, unsuccessful Page responses remain indeterminate, and the response tells
the user to inspect current state before another submission. No write replay,
status remapping or success inferred solely from commit reporting was introduced.
The client records receipt only after its complete response end event. A server's
accepted headers/end or a native-stage completion does not establish client receipt.

## Operational interpretation and next increment

On failure, preserve the first full trace before another intervention. Inspect the
first resource/phase, reported commits, settled native calls, publication and actual
client completion before comparing timing. A generic 500 or an intentionally held
over-budget handler is not a historical Contact match. Do not retry uncertain writes.
Unsampled requests/tails and pending callback lateness are incomplete evidence;
zero callbacks never proves zero scheduling delay. Keep wall and monotonic clocks
distinct, and do not call a multi-check interval unchecked.

The next smallest increment should localize **surrounding Page work at fixed
SQLite concurrency twelve**, using the retained native-only control as its negative
control. First collect a bounded trusted CPU profile and fixed Page adaptation/tree
mutation boundaries in one matching window; retain only sanitized function-level
aggregates. Then change one demonstrated repeated-work mechanism, if one exists,
with failing-before/passing-after regression and the same request/data/authority
controls. Separately moving only the clients to another process can distinguish
shared client/server scheduling effects. Neither experiment is a license to raise
budgets, remove provider preflight checks or serialize away the workload.

Managed hosting, OS tenant isolation, broader administrative domains and complete
browser/human accessibility remain outside this qualification. No deployment or
package publication occurred.
