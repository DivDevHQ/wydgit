# HTTP reliability alpha.25 — increment 10 handoff

2026-10-19; started clean on `develop/0.3` at
`f6ce1590f60d0d6b13d18e8c6fbaf6cd7ae18a78`, matching fetched origin.
Node 24.21.0, npm 11.19.0, Linux. No deployment or package publication.

**Matching Contact failures reproduced; root cause and correction unresolved.**
WYDGINE-0.3-HTTP-LIMIT remains **OPEN**. Platform/Wydgine/WydHosting alpha.25,
Store alpha.6 (actual private provider timing changes), Gate alpha.7 and standalone
Client alpha.11. No ceiling, authority, cancellation, transaction, generation or
HTTP status change; uncertain writes are never replayed.

The [qualification](../http-concurrency-qualification.md) documents configuration,
all concurrency levels, native-stage semantics, attribution and operational cautions.
The [durable evidence](../../test-support/http-reliability-alpha25-evidence-2026-10-19.json)
contains every outcome and numeric trace summary plus full first matching failures.
Earlier alpha.23/24 evidence and historical changelog entries remain intact.

## Results that matter

- Initial isolated ladder: actual overlap equals 1/2/4/8/12 in every repetition
  and every measured layer. JSON fails 21/36 and SQLite 18/36 at twelve;
  all 90 lower-level POSTs pass. All failures are metered prerender timeMs,
  two settled native entries, one reported commit, client-received 500/indeterminate.
- All 38 setup GETs and all 32 separate four-request observer-control POSTs pass.
  A first JSON match records 1,000/1,000 ms, 15 callbacks, 43.009 ms maximum
  lateness; 536.380 ms service checkpoint with five checks and unchanged counters.
  Its true largest observed zero-check interval is only 2.597 ms.
- Admission 0/20/20/0 ms retains twelve-way overlap and failures. High-concurrency
  observer ABBA also fails with diagnostics off; those responses cannot be privately
  classified as timeMs. There is no proof instrumentation caused the failure class.
- Stage-enabled ladder: JSON 24/36 and SQLite 25/36 matching failures at twelve;
  two additional SQLite deadlines are cleanup-only 200/committed. No lower-level
  failures. Per-request aggregate maxima locate JSON queue 878.270 ms and SQLite
  preflight 941.335 ms; synchronous SQLite transaction maximum is 14.060 ms there.
- Corrected provider-only controls: 36/36 per provider, actual twelve-way native
  overlap, create plus query and one reported commit per sequence. Maximum duration
  62.334 ms JSON / 60.873 ms SQLite, no exhaustion. This changes surrounding Page
  work, not provider authority or transaction behavior; it is not an HTTP result.
- Bounded total: 580 POSTs, 104 setup GETs and 144 direct service sequences across
  six retained series (72 sequences belong to an invalid first provider comparison).
  A pre-ladder harness validation adds two POSTs and one GET. No full/installed
  qualification overlapped measurement; no unbounded stress search followed.

## Delivered source and regression boundaries

The reusable harness uses fresh worker/fixture/session/data per window, bounded
barriers/requests/workers/series, numeric correlation via fixture-local async context,
actual client/server/admission/Page overlap, explicit client end verification,
retained first matches and cleanup after failure. It refuses reused output
directories and has no external URL, customer data or hosting configuration input.
Source fingerprints/version metadata support future comparisons.

Observed server meters derive exact positive-allowance ledger wall anchors without
extra clock reads or portable ledger changes. An already-expired/clamped allowance
records unknown start rather than inventing it. Stage timing is available only on
trusted observed completion controls: fixed IDs, numerical sums/counts/maxima,
idempotent close, no per-operation history. JSON dequeue is the actual queue callback,
not operation.begin(). SQLite preflight and synchronous work have separate scopes.
Stages overlap Page/service spans and never imply exclusive CPU/disk time.

Regression coverage includes actual JSON/SQLite queue/transaction stages, failed
native admission, successful/thrown settlement, cancellation/deadline stage closure,
observer sibling isolation/last-timer cleanup, commit before publication failure,
partial/timeout client handling, complete Contact correlation, cleanup failures,
barriers and native-only service completeness. Installed staging includes new tests.

## Retained unsuccessful attempts

The restricted initial harness run returned 2/3 aggregate file results; native
execution passed 22/22. The first native provider control used plain randomUUID,
which can begin with a digit; Store IDs require a letter. Only 9/36 JSON and
10/36 SQLite create/query pairs succeeded. That underloaded run is invalid for
performance comparison, retained in evidence and replaced by the exact SEWN `w`
prefix/UUID shape with regressions requiring both services and a reported commit.
The first version-focused command passed 61/64; three startup banner regexes still
expected alpha.24. Actual alpha.25 output was verified before synchronizing them.
No assertion or security/deadline contract was weakened.

Final review additionally found a harness-only edge case: an incomplete response
with a committed header but no private diagnostics was classified committed.
The regression failed 0/1 before correction; it now remains indeterminate.
All measured responses were complete, so none of the retained outcomes changes.
This correction is separate from the unresolved historical runtime failure.

## Completion qualification

| Check | Passed / total | Skipped |
| --- | ---: | ---: |
| Final harness/stages/HTTP/completion and six forced probes | 51 / 51 | 0 |
| Final version/package/launcher/transport focused | 64 / 64 | 0 |
| Source full checkpoint, before final partial-header regression | 1,557 / 1,557 | 0 |
| Final installed integration, including that regression | 285 / 285 | 0 |
| Final installed provider | 35 / 35 | 0 |
| Final installed actual process supervision | 20 / 20 | 0 |
| Final installed unprivileged Linux | 25 / 25 | 0 |

Native logs: `/tmp/alpha25-final-focused-2.log`,
`/tmp/alpha25-versions-focused-final.log`, `/tmp/alpha25-full-checkpoint.log`,
`/tmp/alpha25-installed-final.log`; installed evidence directory
`/tmp/wyd-i54-packed-PZgKJj`. These temporary paths are not retention guarantees;
sanitized exact results and all failed attempts are durable in the JSON evidence.
Service-free acceptance, checkout-import denial and one installed engine per
consumer pass. Packs contain Wydgine 131 / Hosting 50 / Gate 13 files; no publication.

Content check: three complete pages / 42 links/anchors. Dependency graph and
whitespace checks pass; 613 relative documentation file links have no missing
targets. All 32 tracked Client distribution files, engine runtime assets and portable
ledger/events implementation match starting HEAD. No JSON/SQLite, Gate/session,
BackOffice, cancellation, package, process or Linux security assertion was weakened.

After this final documentation/evidence update, rerun `npm test` and `npm run check`
serially before committing. The delivery commit and final report retain that actual
final count; the checkpoint above is an observed pass, not a prediction. Keep the
historical issue OPEN regardless of final qualification success.

## Next smallest evidence-based increment

Run the harness alone with a new directory:

```sh
node test-support/http-concurrency-probe.mjs --output /tmp/contact-alpha25-next
```

Use `--provider-control`, `--admission-control` or `--observer-control` as separate
commands with separate new directories, never concurrently. Full JSON records in
each directory are saved before the next window; first matching trace has its own
artifact. Disabled windows have unknown private deadline counts, not zero.

Keep SQLite, actual concurrency twelve, the same installation/data/limits/session/
transport and diagnostic settings fixed. Collect a bounded trusted CPU profile and
fixed Page adaptation/tree-mutation boundary aggregates in one matching window,
then inspect for independently demonstrated repeated work. Retain only sanitized
function-level aggregates. A separate one-factor client-process experiment can
exclude shared client/server scheduling effects. Do not infer a runtime defect from
aggregate utilization or long await spans, remove preflight security checks,
increase budgets, blindly retry uncertain writes or claim production limits.

Managed hosting/tenant isolation and full browser/human accessibility are deferred.
The delivery commit and final report record local/remote HEAD verification; no hash
is predicted inside its own commit.
