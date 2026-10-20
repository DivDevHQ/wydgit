# FSREQPROMISE correlation spike — increment 14

2026-10-19, Node v24.21.0, Linux. Clean `develop/0.3` baseline
`b24d11e34382c95d74c4ced59773c3315ad7e8dd`; fetched origin matches.
All versions remain unchanged, including Platform/Wydgine alpha.28.
**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** No runtime correction or release.

Correlation is established for the real SQLite lifecycle helper in a controlled
fixture. It is not yet established inside the concurrent Contact harness.
The [portable evidence](../../test-support/http-fsreqpromise-correlation-evidence-2026-10-19.json)
retains all 14 captures and their numeric resource/marker observations.

## Attribution contract

`test-support/fsreqpromise-correlation.js` installs a hook only with explicit
`enabled:true`. Its synchronous `capture` invokes the existing
`checkLifecycleLock` directly and returns its original Promise. It inserts no
Promise wrapper, reaction, async resource, scheduling barrier, or runtime change.
The existing trusted completion control supplies invocation, recovery entry,
producer completion, await continuation and validation markers.

Source inspection establishes that this helper synchronously invokes exactly one
`fs/promises.lstat` before its first await, after its invocation marker. The caller
must invoke only that helper within the capture window. Initialization is captured
only within that synchronous window. Exactly one FSREQPROMISE candidate must have
an initialization timestamp after invocation and a trigger ID equal to the
captured `executionAsyncId`. Attribution therefore relies on controlled isolation,
source inspection, and the trigger relationship together, not temporal proximity
or a trigger ID alone. Other filesystem calls outside the window can share the
same trigger and are excluded. Multiple candidates, missing invocation/init,
trigger mismatch or resource overflow are explicitly ambiguous.

Twelve pending helper calls can coexist: their synchronous windows do not overlap,
and their resource IDs remain distinct. This does not prove that a whole HTTP
request context uniquely identifies its lifecycle operation. The Contact harness
exposes request-level context and final diagnostic snapshots, not a synchronous
per-lifecycle capture seam. A request-wide FSREQPROMISE match would mix inspection
and other filesystem operations. No such mapping is invented here.

## Observations

One fresh isolated fixture tests a present marker, an ENOENT marker, then twelve
concurrent missing-marker calls. All **14/14** captures correlate, with one
FSREQPROMISE init, one `before`, one `after`, and an observed `destroy` each.
All 13 ENOENT calls record recovery, producer completion, continuation and validation.
The present target preserves STORE.BUSY; it records continuation/validation and no
recovery or producer completion. No hook errors, resource drops or missing/ambiguous
correlations occurred in this fixture. Tests separately establish deliberate
ambiguity and overflow behavior.

Maximum invocation-to-first-`before`: **0.593559 ms**. Maximum last-`after`-to-recovery:
**0.084860 ms**, across the 13 recovery calls. These are separate observed intervals;
do not add their maxima. Exact per-call values and timestamps are retained.
There is no substantial delay in this small fixture and no HTTP load conclusion.
No Contact repetition was run: the optional run was omitted because transferring
this capture contract to that harness requires further instrumentation design.
The alpha.28 **913.568 ms** two-call-per-request recovery interval is a different
scope and workload; no equivalence or improvement is claimed.

`before`/`after` describe observed async resource callback execution. Their observed
one/one counts do not establish a universal one-to-one mapping to filesystem work.
Missing callbacks remain null and duplicated callbacks retain counts plus first
before/last after; such data cannot establish a single callback interval.
`destroy` is optional resource-lifetime evidence, never completion.
The existing producer marker is not Promise settlement. Actual OS completion,
thread-pool scheduling, physical I/O and Promise settlement remain unobserved.
Global hook dispatch, clock reads and synchronous marker overhead are uncalibrated;
these fixture measurements cannot establish production timing or observer neutrality.

## Bounds, cleanup and verification

Default-disabled helper, test-only imports, no dependencies added. Hook callbacks
perform only synchronous bookkeeping, do not log or retain resource objects, and
catch exceptions. Fixed-size per-resource fields retain counts and boundary times,
not event histories. Cumulative call/resource caps prevent growth even after
resources are destroyed; overflow is explicit. `stop()` disables the hook and
clears live lookup state; fixture/test cleanup invokes it even after errors.
No paths, payloads, SQL, credentials or request data are retained by the probe.

Fresh final focused command:

```sh
node --test --test-isolation=none test/fsreqpromise-correlation.test.js test/lifecycle-lstat-timing.test.js test/http-diagnostics.test.js test/wydstore-sqlite.test.js
```

**29/29 pass**, zero failures/skips: seven new probe tests, eight existing lifecycle
tests, four HTTP diagnostic tests and ten SQLite tests. The initial sandbox run of
three files was **15 pass / 4 fail** (all four HTTP tests failed on loopback listen
EPERM); the authorized unsandboxed selection above passes. The earlier default
isolated test invocation reported one file-level pass, not seven assertion results;
it is not used as the individual-test count.

`npm run check`, changed JavaScript syntax checks, dependency-manifest comparison,
and `git diff --check` pass. No full `npm test`, installed qualification suites,
Contact load reproduction, concurrency ladder, or deployment/publication was run.
Historical alpha.28 1,583/1,583 and installed 390/390 results are not fresh evidence.
Concurrency harness is unchanged. Changes are limited to this helper, its runner,
focused tests, evidence, this report and the changelog.

Next narrow step: design a test-only synchronous capture seam at the existing
lifecycle observation start, with an explicit end to its synchronous invocation
window, without modifying the production Promise chain. Prove that integration
before running a single twelve-way Contact window.
