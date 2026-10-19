# HTTP reliability alpha.24 — increment 9 handoff

2026-10-19; Node 24.21.0, npm 11.19.0, Linux. Started clean on `develop/0.3`
at `a2213560ee0a4e2d1bd8fba07b9a4a11b4bca3b9`; fetched origin matched.
No deployment, new service/dependency, credentials, authority expansion, automatic
mutation retry, deadline policy or provider implementation change.

## Delivered behavior and status

Platform/Wydgine/WydHosting **0.3.0-alpha.24**; Gate alpha.7, Store alpha.5 and
standalone Client alpha.11 unchanged. Exact engine/hosting dependency, Search/Stream
peer compatibility, lockfile, example revision and version tests are synchronized.

One shared opt-in 50 ms unreferenced sampler serves observed HTTP requests and
records bounded callback lateness, maximum offset, duration and incomplete/pending
tail evidence. Fixed ledger progress snapshots use monotonic safe boundaries,
guard-entry counts, counters and completion states; no execution history or
public diagnostics. Handler entry/exit anchors correctly localize the held await.
Disabled instrumentation allocates no timer/progress record or additional monotonic
clock reads in the ledger. The existing 1,000 ms Date clock ledger is unchanged.

**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** Small historical scenarios did not reproduce
alpha.23's unforced failure. No root cause or corrective runtime change is claimed.
Conditional provider stages were skipped because no new provider-associated
failure justified them. The alpha.23 matching failures remain release concerns.

Details, exact metrics, limitations and commands are in
[qualification](../http-deadline-attribution-qualification.md). Durable sanitized
[JSON evidence](../../test-support/http-reliability-alpha24-evidence-2026-10-19.json)
contains controlled and first/final small-run observations, representative full
records, every anomaly, microbenchmarks and forced deadline/commit traces.

## Completed experiments

- Deterministic controls: 1,100 ms awaited native handler, 22 on-time callbacks,
  zero counter progress/services, then timeMs exhaustion. Withheld callback yields
  275 ms lateness; never-delivered final callback retains 400 ms pending lower bound.
- Native held/twelve-sibling observation: HTTP 200, ledger 337 ms; 315.290 ms Load
  handler gap with no checks/counter changes, five sampler callbacks, max lateness
  22.927 ms. The no-sibling case also passed with an explicitly unsampled short tail.
- Fresh-fixture JSON/SQLite Contact ABBA comparison: all 40 POSTs and eight setup
  GETs succeed; providers each exercise baseline one and concurrent four, with
  diagnostics enabled/disabled. First growing-dataset run is retained as confounded.
- Original six forced probes pass three times: JSON/SQLite precommit cancellation,
  JSON reported commit/indeterminate response, real disconnect and held drain.
  No automatic replay or change to public statuses, cancellation or settlement.
- Clock control proves Date rollback and monotonic intervals differ; exact equality
  and first exhaustion remain intact. The existing guard counts progress without timing each instruction.

Focused instrumentation/completion/event/SEWN tests: **48/48**. First calibration
**20/21** exposed a new assertion's absent-counter comparison, corrected to zero;
this was a test error, not a runtime fix. Initial sandbox aggregate/output issues
are separate from native functional results. A first full command stopped in pretest
before tests because server instrumentation
entered the immutable Client build closure. Page-owned guard/handler adapters
preserve the original portable budget/events modules and immutable Client bytes;
the build now passes without a Client bump. All failures and earlier alpha.23
evidence remain retained. Completion evidence follows below.

## Boundaries and limitations

Progress's largest unchecked observation is conservative, not an exact global
maximum. Multiple-check sample windows retain their count rather than implying
CPU blocking. Scheduler final tails are always incomplete, and pending lateness is
a lower bound. Overlapping service/phase spans cannot yield provider CPU time.
Sampled lateness cannot identify its underlying process/OS cause. The ledger's
Date clock can diverge from monotonic elapsed; no clock migration is attempted.
Microbenchmarks and small ABBA experiments do not certify production overhead.

Keep FrontEnd/BackOffice/SUB separation, reserved administrative domains, Gate versus
SEAM, independent Store authorization, generation/receipt fencing, native service
settlement, commit uncertainty and client publication boundaries intact. Managed
hosting and human/browser accessibility gaps from alpha.23 are not requalified here.

## Resume with the smallest evidence-driven experiment

1. Inspect `git status --short`, `git log -3 --oneline` and fetched
   `origin/develop/0.3`; the delivery commit contains this handoff. Never overwrite
   a diverged remote or unrelated local changes. Final local/remote hashes are
   verified after delivery and reported in the completion message.
2. Run `node --test test-support/http-attribution-probe.mjs` **alone**. Vary only
   bounded request concurrency in a follow-up fixture if necessary; preserve failed
   runs. Do not run multiple large suites to manufacture contention.
3. On a matching failure, retain actual/pending scheduling lateness, fixed counter
   progress/phase/check gaps, service entries/completions, first exhaustion and
   reported commit versus publication. Add provider stages only if these leave a
   specific material gap. Never infer dequeue from `operation.begin()`.
4. Correct only after intervention and counter-experiment establish the mechanism.
   Retain the 1,000 ms ceiling, no post-deadline admission, exact equality, admitted
   settlement, provider atomicity/fencing and uncertain-write no-replay semantics.
5. After source edits, run focused tests, `npm test`, `npm run check`,
   `npm ls --all --json`, `git diff --check`, and the installed qualification
   `node scripts/verify-packed-packages.js` sequentially. New calibration tests are
   staged into installed consumers; checkout imports remain rejected.


The first completed full suite was **1,537/1,538**, zero skipped. Its only failure
was the package-boundary negative version assertion still naming alpha.24 as the
next incompatible version. It now computes the next prerelease from the engine
version, preserving the exact engine/hosting compatibility assertion. No historical
HTTP deadline failure appeared in this run; the failed run is retained in evidence.


## Completion qualification

All commands below ran serially at normal repository concurrency with native
loopback/process access; no timing experiment overlapped a full or installed suite.

| Verification | Passed / total | Skipped |
| --- | --- | --- |
| Final instrumentation/completion/event/SEWN focused command | 48 / 48 | 0 |
| Version/package/launcher/transport focused command | 64 / 64 | 0 |
| Normal full `npm test` checkpoint | 1,538 / 1,538 | 0 |
| Final installed integration | 265 / 265 | 0 |
| Final installed provider | 35 / 35 | 0 |
| Final installed actual process supervision | 20 / 20 | 0 |
| Final installed unprivileged Linux | 25 / 25 | 0 |

`npm run check` passes: three complete pages, 42 internal links/anchors.
`npm ls --all --json` and `git diff --check` pass. Documentation relative file links:
**602**, zero missing. All **32 tracked Client distribution files**, engine runtime
assets and portable ledger/event implementation match starting HEAD. Final local
packs contain Wydgine **131**, Hosting **50** and Gate **13** files. No publication.

Two serial installed runs passed the same totals. The completion run includes the
last calibration refinement: an on-time callback records the offset of its zero
maximum, while a window with no callback retains null. Both installed runs prove
service-free acceptance, checkout-import denial and exactly one installed engine
per consumer. JSON/SQLite Store, Gate session lifecycle, BackOffice HTTP/UI,
authorization/cancellation and existing process/Linux boundaries are exercised.
These tests do not extend managed-hosting or browser/human accessibility claims.

The final required `npm test` and `npm run check` repeat follows this documentation
update. Its actual outcome is recorded in the delivery commit message and final
handoff response; the checkpoint above is an already completed passing run, not a
prediction. Earlier 20/21 calibration, pretest build failure and 1,537/1,538 version
failure remain explicitly retained. No unforced historical HTTP failure was found
in these source, installed or small controlled runs, and the issue stays OPEN.
