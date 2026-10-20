# Contact FSREQPROMISE attribution — increment 15

2026-10-19, Linux, Node v24.21.0. Clean `develop/0.3` baseline
`02482a6002d1c127ff3ba0bb7c893ee6a1cc3b53`, tracking `origin/develop/0.3`.
Platform/Wydgine/WydHosting remain `0.3.0-alpha.28`, Store `0.1.0-alpha.8`;
Gate and Client unchanged. This is diagnostic spike B, not an alpha.29 release.
**WYDGINE-0.3-HTTP-LIMIT remains OPEN.**

Contact lifecycle resource correlation is established for this bounded run.
[Portable evidence](../../test-support/http-fsreqpromise-contact-evidence-2026-10-19.json)
retains every successful and failed request, all invocation/resource mappings,
existing trusted diagnostics, derived intervals, process cleanup and artifact hashes.
The prior [isolated spike](http-fsreqpromise-correlation-spike.md) remains historical.

## Capture boundary and identity

`checkLifecycleLock` calls its existing `observation.start()` immediately before
`lstat(path.join(...))`. A new optional synchronous `invoked()` marker runs in
`finally` immediately after that call returns or throws, before registration of
the existing rejection reaction. Splitting the expression preserves the original
filesystem Promise, catch reaction, await, call order and validation. No additional
filesystem calls, Promise reactions, timers or scheduler barriers are introduced.
The existing absent-observer scheduling regression passes.

The trusted host-only `execution.observeLifecycleLstat` option is threaded through
Page completion. It is effective only with existing diagnostic timing enabled,
and is absent by default. It never enters package inputs or public HTTP records.
Each existing native operation supplies its Page-local ordinal. Each call to its
continuation factory supplies a distinct lifecycle observation, even when a native
operation invokes the helper twice. The test-only probe allocates a bounded unique
invocation number for that observation. The harness reads its existing request
AsyncLocalStorage at this factory boundary and retains only its numeric index.
Async context supplies request identity; it does not select a filesystem resource.

The probe opens a synchronous invocation window at `start`, closes it at `invoked`,
and associates initialized FSREQPROMISE resources only within that window. No
mutable global current-request variable or request-wide filesystem matching is
used. The probe's closure-local active invocation exists only during the synchronous
call window; pending calls retain their own marker closures and resource IDs.

Acceptance requires exactly one resource candidate, matching execution trigger,
initialization between start and invoked, exactly one observed before/after pair,
and recovery entry on the same invocation after hook after. Multiple candidates
or overflow are ambiguous. Absent resources, markers, recovery or expected hook
activity are missing. No nearest-event selection is performed. A present lifecycle
marker retains STORE.BUSY and cannot satisfy this recovery-specific acceptance.

## Bounds and failure behavior

The hook remains default-disabled and is imported only by test-support code.
The one Contact window opts in explicitly with `--resource-correlation`, with caps
of 32 calls and 32 cumulative resources. Probe-level maximum caps remain enforced.
There are fixed numeric fields and counts, no event histories, paths, SQL,
credentials or payloads. Hook callbacks do synchronous bookkeeping, never log or
schedule work, catch errors and stop the hook on failure. Observer marker failures
are isolated from the existing trusted markers and cancel the probe. Completion,
error and cancellation paths stop the hook and clear resource lookup state.
Native work drains before fixture removal. Process supervision bounds hung workers.

The final audit additionally verifies per-request/native-call counts against
existing diagnostics and globally unique resource IDs. Those extra runner guards
were added after the run; the identical guards were independently applied to its
retained artifact without repeating load. No capture/runtime code changed after
this reproduction.

## One Contact reproduction

Command:

```sh
node test-support/http-concurrency-probe.mjs --output /tmp/contact-fsreq-increment15 --resource-correlation
```

One fresh SQLite fixture, one supervised separate client process, unchanged Contact
payloads, no retries, existing 1,000 ms Page execution deadline. Actual overlap is
**12 client / 12 server / 12 admission / 12 Page**. No test suite ran concurrently.
The raw directory and `/tmp/contact-fsreq-increment15.log` are temporary; hashes
and full sanitized records are retained in portable evidence.

- **12 POSTs: 1 HTTP 200 and 11 HTTP 500**, all eleven matching prerender timeMs
  deadline failures and indeterminate outcomes. Successful request 12 first exhausts
  during cleanup and remains 200/committed. Client receipt/publication is complete
  for all twelve. Setup GET is 200.
- **12 reported commits, 24 settled native calls, zero pending**. A reported commit
  is not a successful client response. No uncertain write was retried.
- **24/24 POST lifecycle invocations uniquely correlated**, plus **1/1 setup**.
  Zero missing, ambiguous, overflow, dropped calls/resources or hook errors.
  Every resource has one before and one after. Hook stopped, zero tracked resources;
  client exited zero and was reaped, fixture cleanup succeeded.

Maximum per-invocation POST intervals (ms):

| HTTP outcome | Invocation to hook before | Hook after to recovery entry | Producer marker to await continuation |
| --- | ---: | ---: | ---: |
| 200 (two calls) | 6.915153 | 0.035257 | 0.004499 |
| 500 (22 calls) | 86.587927 | 0.124104 | 0.065413 |

Maxima may come from different invocations; do not add them. Maximum observed hook
before-to-after interval is 0.006172 ms. Maximum two-call lifecycle aggregate is
123.846093 ms. These scopes differ from alpha.28's two-call recovery aggregate.

Existing scheduling diagnostics retain maximum callback lateness **46.951014 ms**,
pending lateness lower bound **63.687681 ms**, maximum checkpoint interval
**512.913519 ms**, and maximum observed zero-check interval **13.155113 ms**.
Checkpoint intervals can contain checks. All twelve sampler tails are incomplete;
no exact unchecked maximum or exclusive CPU attribution follows. Full ledger
charges, phase checkpoints and first exhaustions remain in evidence.

## Interpretation and limits

Timing attribution improved: the longer observed lifecycle delay precedes the
resource callback boundary in this run. Hook after to existing recovery entry and
producer marker to awaiting continuation are small for successful and failed
requests. This supports investigating the earlier boundary; it does not identify
a dominant cause of the HTTP failures or explain inspection's filesystem awaits.

Neither hook activity nor destroy observes OS I/O completion, physical disk latency,
thread-pool queue/execution time, OS scheduling delay or Promise settlement. The
producer marker is not settlement. Destroy is optional lifetime evidence only.
Global hook dispatch, clock reads and marker overhead remain uncalibrated.
Potential observer effects remain unresolved; no specific material interference
was demonstrated. This single instrumented run cannot establish observer neutrality,
statistical equivalence or improvement relative to alpha.28. No follow-up load run
was performed and no deadline, ledger, SEWN.LIMIT, authority, isolation, cancellation
or transaction behavior was changed.

One next distinguishing experiment: instrument only the existing SQLite inspection
`lstat` awaits with the same per-invocation synchronous window in a separately
bounded run, to locate inspection delay relative to observed callback activity.
Do not change deadlines or add Promise reactions.

## Verification

Final focused selection:

```sh
node --test --test-isolation=none test/fsreqpromise-contact-correlation.test.js test/fsreqpromise-correlation.test.js test/lifecycle-lstat-timing.test.js test/http-diagnostics.test.js test/wydstore-sqlite.test.js test/operation-completion.test.js test/native-stage-timing.test.js
```

**57/57 pass**, zero failures/skips: nine new correlation tests, seven prior probe,
eight lifecycle, four HTTP diagnostics, ten SQLite, seven operation completion and
twelve native-stage/continuation tests. New cases verify invocation/resource/recovery
mapping, two calls in one request and one native call, twelve concurrent requests,
unrelated filesystem activity, ENOENT/present outcomes, disabled observation,
observer factory/marker failure, cancellation and deliberate ambiguity.

Intermediate results retained: restricted **33/37**, with four HTTP tests failing
only on loopback listen EPERM; authorized loopback run **37/37**; completed preprobe
selection **38/38**. No correlation assertion failed. Final focused logs and raw
artifact hashes are retained in evidence. `npm run check` passes three complete
pages and 42 links/anchors. Changed JavaScript syntax, JSON content, unchanged
manifests and `git diff --check` are verified before commit.

Full `npm test` and installed qualification suites were explicitly omitted for this
mission. No package version bump, publication, deployment, additional load experiment
or production correction. Changes comprise the optional trusted marker seam,
default-disabled probe/harness integration, focused tests, this report, evidence
and a concise new changelog entry; historical entries remain unchanged.
