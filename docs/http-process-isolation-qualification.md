# HTTP process isolation — alpha.26 / increment 11

2026-10-19; Node 24.21.0, Linux. Clean `develop/0.3` at
`608b6f71e91a55c3f2c4a8e0354bd7cbb1aefcf3`, matching fetched origin.
Platform/Wydgine/WydHosting advance to **0.3.0-alpha.26**. Store alpha.6,
Gate alpha.7 and standalone Client alpha.11 retain their versions. Search/Stream
peer alternatives include alpha.26. No new dependency, runtime correction,
execution-limit change, deployment or package publication.

**Shared client/server process placement is not necessary for the matching
Contact deadline failure. WYDGINE-0.3-HTTP-LIMIT remains OPEN.** Separation improves
the observed success count in this bounded series, but neither a specific
interference mechanism nor sufficiency is established. This is no fix or waiver.

Read with the [alpha.25 comparison](http-concurrency-qualification.md),
[deadline measurement semantics](http-deadline-attribution-qualification.md),
[complete bounded evidence](../test-support/http-reliability-alpha26-evidence-2026-10-19.json)
and [handoff](work-in-progress/http-reliability-alpha26-handoff.md).

## Controlled configuration and supervision

Run alone, from the repository root, with a new output directory:

```sh
node test-support/http-concurrency-probe.mjs --output /tmp/contact-alpha26-isolation --process-isolation > /tmp/alpha26-experiment.log 2>&1
```

The one command runs A1 shared / B1 separate / A2 shared / B2 separate, three fresh
SQLite fixtures each at concurrency twelve, then one fresh concurrency-eight
fixture per placement. There are **14 setup GETs and 160 POSTs**; no test suite ran
concurrently. All 14 windows are valid, cleanup succeeds, and all seven separate
clients exit zero and are reaped. The series takes 27,392 ms. No measurement was
discarded or repeated; no optional causal counter-experiment was justified.

One fresh server worker per window retains the same app configuration, empty
Contact guestbook data, installed authority, anonymous session from one GET,
1,000 ms Date-based cooperative Page deadline, enabled private diagnostics,
50 ms server sampler and Node executable. Server HTTP limits remain max header
8,192 bytes / 64 headers, 120,000 ms request timeout, 15,000 ms header timeout.
The shared `runContactClient` owns session setup, form serialization, barrier,
POST dispatch and result projection in both modes. Every participant reaches the
client preparation barrier before burst release. There is no server-side barrier,
spacing, retry or change to Page admission.

Both clients use `node:http`, HTTP/1.1 loopback, an agent with `keepAlive:false`
and `maxSockets:12`, and 10,000 ms request deadlines. This finite-socket Node agent
emits `Connection: keep-alive`; the existing alpha.25 description's “no keep-alive”
refers to its agent setting, not a forced `Connection: close` header. Wire tests
verify identical methods, path, payload, cookies, sequence, content headers and
connection policy. No HTTP library or serialization path changes.

The separate client receives only port, concurrency and admission spacing over
IPC, with no application roots, credentials, arbitrary command or shell. It reads
its own cookie/CSRF through the same GET. Fixed local entry point and current Node
executable use empty exec arguments and a minimal environment. Startup is bounded
at 5 s, execution at 25 s; failure/cancellation sends SIGTERM then SIGKILL after
1 s and awaits `close`. A further 5 s reap bound fails closed. Parent SIGINT /
SIGTERM and AbortSignal cancel the child; parent death closes IPC and the client
exits. No client descendants are created. The outer worker has a 45 s watchdog,
3 s kill escalation and exclusively owned scratch cleanup. The series stops on
worker/fixture/cleanup/count/diagnostic/actual-overlap failures and preserves the
failed window. Existing observer/provider/admission modes remain available.

Only fixed numeric/boolean/enumerated results cross back; exact schema and count /
sequence checks reject extra fields. Raw response bodies, cookies, tokens, error
messages, paths and child stderr are excluded (only stderr byte count is retained).
The harness is test infrastructure, with no Wydgit authority or public diagnostic API.

## Every repetition

All responses reach the client's end event; there are **zero client timeouts,
partial responses or unknown outcomes**. Every POST reports two admitted/settled
native entries, zero pending calls and one reported commit. All 500s are received
as indeterminate; all 200s are received as committed. Server publication records
headers published / response ended / no disconnect for all POSTs, independently
of the client receipt observation.

| Series / placement | POSTs per repetition | HTTP 200 per repetition | HTTP 500 per repetition | Actual client/server/admitted/Page overlap |
| --- | --- | --- | --- | --- |
| A1 shared | 12, 12, 12 | 1, 1, 2 | 11, 11, 10 | 12 in every layer/window |
| B1 separate | 12, 12, 12 | 5, 3, 5 | 7, 9, 7 | 12 in every layer/window |
| A2 shared | 12, 12, 12 | 3, 3, 3 | 9, 9, 9 | 12 in every layer/window |
| B2 separate | 12, 12, 12 | 5, 6, 5 | 7, 6, 7 | 12 in every layer/window |
| Secondary shared | 8 | 8 | 0 | 8 in every layer |
| Secondary separate | 8 | 8 | 0 | 8 in every layer |

At twelve, shared is **13/72 HTTP 200, 59/72 HTTP 500**; separate is
**29/72 HTTP 200, 43/72 HTTP 500**. All **102/144** failed POSTs match the
historical timeMs/prerender/two-settled-native/one-commit/500-indeterminate signature.
An additional **3 shared + 2 separate** 200s first exhaust timeMs during cleanup;
they retain 200/committed. Total primary first exhaustions: shared **62/72**,
separate **45/72**. Both lower-concurrency controls have **0/8** exhaustions.
All fourteen setup GETs pass. These counts establish no universal threshold.

## Server observations

Every measurement below is captured in the **server worker** in both modes.
Client monotonic timestamps use their own process origin: only within-client
interval overlap is computed. No client/server timestamp subtraction is performed.
Page overlap uses ledger Date anchors at 1 ms resolution.

| Maximum per-request observation (ms) | Shared, twelve | Separate, twelve | Shared, eight | Separate, eight |
| --- | ---: | ---: | ---: | ---: |
| Executed callback lateness | 150.930 | 480.414 | 67.634 | 269.458 |
| Pending callback lateness lower bound | 101.729 | 480.191 | 67.300 | 175.692 |
| Observed zero-check interval | 8.153 | 7.766 | 8.145 | 6.022 |
| Checkpoint interval (may contain checks) | 536.867 | 679.514 | 405.653 | 438.559 |
| SQLite preflight aggregate (two calls) | 938.920 | 1,158.550 | 679.390 | 828.877 |
| SQLite preflight largest individual call | 535.525 | 678.861 | 404.332 | 436.886 |
| SQLite synchronous transaction aggregate | 14.805 | 15.151 | 4.047 | 14.006 |
| SQLite synchronous transaction largest call | 13.104 | 13.491 | 2.705 | 12.658 |

At twelve, final step counts range **127–706**, guard entries **266–1,041** in
both modes; action ends at 79 steps and prerender advances counters before failed
requests exhaust. The full per-request native-stage aggregates, phase times,
first/last action/prerender/cleanup counters, maximum checkpoint and zero-check
intervals, service state, first exhaustion and publication are retained in the
evidence, with one full first matching trace per placement. Summary durations are
rounded to 0.001 ms; raw per-window SHA-256 digests identify local source artifacts.

A long checkpoint containing checks is not unchecked execution. The observed
zero-check maximum is conservative, not exact. The 50 ms sampler has incomplete
tails; missing callbacks do not imply zero delay. Preflight includes awaited
filesystem/lifecycle work and continuation delay; transaction includes synchronous
open/setup/transaction/close. These elapsed values are not CPU or disk measurements,
and overlapping phase/service/provider intervals must not be subtracted.

## Interpretation and remaining confounders

Matching failures survive the controlled placement change in every primary window.
Shared placement is therefore **not necessary**. Its sufficiency is untested;
alpha.25 lower-concurrency shared windows and these controls pass. The descriptive
16-response improvement under separation accompanies *larger* server lateness and
preflight maxima. The server/client status pairs agree throughout, so this is not
an observed receipt-classification discrepancy. These measurements do not support
a simple “moving the client removes server stalls” explanation.

The additional process, startup before setup GET, IPC outside the POST burst,
OS scheduling and differing process-local allocation/GC histories are inherent
placement confounders. The same logical burst does not force identical server
arrival or continuation ordering. This small single-host blocked alternating
series estimates neither statistical significance nor a universal improvement.
No specific provider defect, CPU bottleneck, client interference mechanism or
historical root cause has been demonstrated; no runtime correction is warranted.
Reported commit is not proof of successful publication, and server publication is
not proof of client receipt. Failed mutations remain uncertain and are not retried.

The smallest next experiment holds the separate client, SQLite, diagnostics and
twelve-way overlap fixed and adds bounded server continuation observations around
the measured preflight awaits. Distinguish filesystem/lifecycle completion from
Page continuation scheduling before changing Page or provider behavior. Preserve
transaction, authority, generation, cooperative deadlines and publication semantics.

## Verification and retained attempts

Final focused harness/deadline/commit/diagnostic/version/package checks pass
**126/126** (`/tmp/alpha26-focused-final.log`). This includes the original concurrency
and outcome-classification regressions, both placements, wire parity, real installed
SQLite Contact, startup failure, abnormal exit, timeout escalation, AbortSignal and
actual parent SIGTERM, process reaping and sanitized result rejection.

Restricted-sandbox invocation first produced an aggregate file failure without
individual assertions. Native invocation initially passed **20/22**; two new tests
incorrectly expected `Connection: close`. Observing both modes established the
existing behavior; correcting only those expectations yields passing verification.
These attempts are retained in the evidence. No measured series was invalidated.

Installed tarball results are retained in the handoff and evidence. After final
edits, required `npm test` and `npm run check` results, dependency/whitespace/link
checks and exact final Git identity are recorded in the delivery commit and final
report. No omitted or unavailable check is implied to pass. Browser/human and
privileged managed-hosting qualification remain outside this increment.


Installed local tarball command `node scripts/verify-packed-packages.js` passes:
**296/296 integration, 35/35 provider, 20/20 process, 25/25 unprivileged Linux**,
plus service-free binary/HTTP/restart checks. Evidence directory:
`/tmp/wyd-i54-packed-USklNq`; each consumer has exactly one installed engine and
checkout runtime imports are rejected. The integration selection includes the new
process-isolation harness tests. No privileged Linux or production deployment test
was run. Dependency graph and whitespace checks pass before final required checks.
