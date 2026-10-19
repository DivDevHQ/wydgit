# HTTP reliability alpha.23 — increment 8 handoff

2026-10-19; Node 24.21.0, npm 11.19.0, Linux. No deployment occurred.

## Git and versions

Started clean on `develop/0.3`, local/fetched remote
`2ca287deda07d7b4474ee45ab68771d626339da3` (alpha.22).
Verified A/B commit **2a74e5a555d876cd70a8778dd648c767a1af80d3** is pushed to
origin/develop/0.3 and was the current HEAD when this handoff was prepared.
The browser/integration completion commit follows it; use `git log --oneline
2ca287d..HEAD` and `git ls-remote origin refs/heads/develop/0.3` for its exact hash.
No reset/rebase/force push, production changes or deployment is authorized/performed.

Platform/Wydgine/WydHosting alpha.22 → **0.3.0-alpha.23**; Gate alpha.6 →
**0.1.0-alpha.7**. Store alpha.5, standalone Client alpha.11, Search/Stream alpha.2
and Files alpha.1 unchanged. Exact engine/hosting coupling, Search/Stream peers,
lockfile, example fixture pin/revision and version regressions are synchronized.
No dependency, service API, persisted schema or immutable artifact changes.

## Work delivered

A: Reconstructed Page HTTP/accounting/settlement/publication path. Added optional
bounded trusted `execution.observeHttp` with resource/phase meter, native admission,
commit evidence, uncertainty and publication state; one record, no queue/disk log,
request values, identities, credentials or public debug mode. Historical fixtures
retain eight snapshots on failure. **WYDGINE-0.3-HTTP-LIMIT remains OPEN.** Controlled
limits/abort/commit probes pass. Later concurrent qualification reproduced matching
Contact/held-request failures with timeMs traces (details below); no causal fix exists.

B: Qualified actual JSON/SQLite stale-CAS races and bounded transient recovery.
Proved and corrected resolution returning authenticated after a pending touch
crossed absolute/idle expiry. Conditional fresh read preserves newer durable
activity; failed persistence/read never becomes a successful authentication claim.
Existing touch frequency, three conflict attempts, ownership/site policy and
current membership checks remain. No cache, coalescing, mutex, queue or extra retry.
Contention can still produce sanitized 503 without cookie deletion; no all-sibling
success or cross-process atomic cancellation guarantee is made.

C: Real Firefox pointer/DOM subset plus Chrome native keyboard/tree journey.
Proved Firefox sent null Origin from the no-referrer shell; successful shell now
uses same-origin policy without accepting null/foreign Origin or weakening CSRF.
Discovery errors now use alert/assertive semantics. Native Firefox keyboard was
blocked by headless document focus and remains unqualified; human assistive
technology, zoom/forced-colors/touch remain manual. A practical checklist is in
[the browser document](../backoffice-browser-qualification.md#alpha23-firefox-and-accessibility-continuation).

D: Extended installed tarballs to include Gate contention/HTTP diagnostic tests,
retaining checkout-import denial and one engine per consumer. The expanded run
found an existing S3 deadline fixture's wall-sleep/call-count dependency; its
controlled monotonic clock retains every bound/sequence/no-PUT assertion. No Files
runtime change. Final full, installed, link/artifact/dependency checks follow below.

## Verification actually run before completion gate

| Verification | Result / log |
| --- | --- |
| Native focused alpha.22 baseline | 88/88, 14.104 s; `/tmp/alpha23-baseline-focused-native.log` |
| HTTP diagnostic/completion/shared-ledger + original probes | 22/22, 6.932 s; `/tmp/alpha23-http-diagnostics2.log` |
| Gate final contention/authentication/HTTP | 83/83, 13.202 s; `/tmp/alpha23-gate-final-focused.log` |
| A/B verified full suite | 1524/1524, 78.899 s; `/tmp/alpha23-ab-verified-full.log` |
| Earlier combined full runs | 1522/1522 twice, before two final newer-touch cases/refinement |
| Repeated original six deadline probes under integrated load | 6/6, 7.110 s; `/tmp/alpha23-deadline-repeat.log` |
| HTTP/UI/Files after browser/fixture fixes | 74/74, 12.434 s; `/tmp/alpha23-browser-focused.log` |
| S3 controlled-clock regression | 1/1; `/tmp/alpha23-s3-barrier.log` |
| First installed tarballs | 224 integration + 35 provider + 20 process + 25 Linux; `/tmp/wyd-i54-packed-yFgIE5` |
| Expanded installed run before S3 fixture correction | 245/246 integration; `/tmp/wyd-i54-packed-71H9ZQ` |
| Final Firefox pointer/DOM journey | pass incl. process/profile cleanup; `/tmp/alpha23-firefox-final.log`, `/tmp/wyd-backoffice-browser-Z2aj9R` |
| Final Chrome native keyboard/tree journey | pass incl. process/profile cleanup; `/tmp/alpha23-chrome-final.log`, `/tmp/wyd-backoffice-browser-5fl15C` |

Required content, dependency and whitespace checks passed at A/B checkpoint.
Browser images contain only disposable fixture data. Structured durable evidence:
[http-reliability-alpha23-evidence-2026-10-19.json](../../test-support/http-reliability-alpha23-evidence-2026-10-19.json).
Raw /tmp logs and images are local artifacts, not retention guarantees.

Failures are not erased: initial full run 1501/1504 had three stale escaped version
assertions. The next mutable-source run had 1511/1520: four expiry defects, two
new fixture projection errors and three process failures while version edits were
in progress; no supervisor fix/cause is claimed. Final fixed-source suites did not
repeat those process failures. Initial Gate expiry test 10/16 and timestamp-only
newer-touch test 0/2 established failing behavior before corrections. Browser null
Origin, announcement regressions, test-harness focus/expression/profile errors,
Chrome ENOTEMPTY cleanup and installed S3 fixture failure are documented in
[qualification](../http-reliability-and-session-qualification.md). Restricted sandbox
file-level/process-output failures are separate from native functional evidence.

## Files and boundaries

Runtime: Gate sessions/manifest; engine completion, Page and HTTP diagnostics,
output-port metadata, BackOffice shell header; trusted web adapter and packaged
mirror. Tests/support: diagnostic, Gate contention, real HTTP, historical probes,
hardening/hostname fixtures, S3 timing; browser BiDi bridge and tarball selection.
Metadata/docs: coupled manifests/lockfile, Gate version, peer compatibility,
example pins/revision, changelog, qualification, browser/manual checklist,
HTTP/UI contract, reliability/release status and this handoff/evidence.

SEAM/capability separation, Gate site binding/current permissions, Store ownership,
CSRF/Origin/cookies, PACKAGE.DRIFT/receipt integrity, generation fencing, stopped-App
lifecycle, bounded services/HTTP, no mutation replay and no native RPC are preserved.
No AccountAdmin/HostAdmin, managed-hosting expansion or cross-process drain claim.

## Remaining work and exact next steps

1. Keep historical HTTP issue open. Use the captured JSON/SQLite Contact and held-Load
   traces to design bounded per-service/scheduler-delay attribution. Distinguish provider
   wait from scheduling delay; event-loop utilization is process-wide, not causal proof.
2. Perform the documented focused graphical Firefox keyboard and human assistive
   technology checklist. The pointer/DOM subset is not full browser/accessibility
   certification. Record actual browser zoom, forced-colors and hardware touch.
3. Review any future touch scheduling as a separate bounded design: preserve durable
   idle activity, revocation/rotation/current policy and independent process semantics.
4. If source changes, rerun focused regressions, `npm test`, `npm run check`, browser
   journeys and `node scripts/verify-packed-packages.js` with native loopback/process
   access. Inspect status/diff, fetch, verify no divergence, commit/push only coherent
   verified changes. Do not deploy.

Working tree at preparation contained only this mission's browser/integration/docs
changes atop the pushed A/B checkpoint; no unrelated local work was present or
removed. Final completion is intended to leave a clean tree and matching local and
remote HEAD after independent verification. Completion results are appended below.


## Reproduced reliability failure — do not bury beneath later passing totals

Concurrent normal-concurrency full, focused and installed commands reproduced the
Contact/held-drain failure class: installed **239/246**, focused **182/184**, full
**1522/1524**. The [qualification trace table](../http-reliability-and-session-qualification.md#matching-historical-failures-reproduced--release-issue-still-open)
and durable JSON retain JSON/SQLite Contact prerender timeMs exhaustion at 1053/1000
and 1000/1000, after native service entry and one reported commit. Both published
500/indeterminate. Held Page.Load exhausted at 1169/1000 with no service calls.
A separate cleanup-only LIMIT published 200/committed, and is separately classified.

These are unforced matching failures, not deliberate clock/delay probes. The added
external qualification load is recorded; it is not proof that production scheduling
alone caused the original historical defect. No resource ceiling, test concurrency,
security assertion or application changed to erase it. Provider versus scheduling
attribution and mitigation remain open. Later qualification uses identical commands
sequentially and reports those passing/failing conditions separately. The historical
issue is a release concern regardless of later counts. Initial Contact GET now
also attaches bounded diagnostics to status assertions for future captures.

## Normal-schedule repeat

The same focused command passed **184/184** (42.054 s) after concurrent qualification
finished. The subsequent default-concurrency full suite passed **1524/1524**
(69.524 s), `/tmp/alpha23-normal-full.log`. The failing overlap experiment remains
retained and unresolved. Page admission observation is now independent of final
meter observation; no public execution semantics changed. Required content,
dependency and whitespace checks pass; 596 relative documentation file links have
no missing files, and all 32 tracked Client distribution files match starting HEAD.
Local package dry runs pass for engine/hosting/Gate (129/50/13 files). No publication.

Final installed counts are appended when the sequential installed command finishes.
After that documentation edit, repeat `npm test` and `npm run check`, inspect the
complete diff/status, fetch and verify no divergence, then commit/push the coherent
browser/integration/evidence checkpoint. Do not change limits, test concurrency or
security assertions to hide the retained failures. No deployment is authorized.

## Completion gate evidence

Final sequential tarballs `/tmp/wyd-i54-packed-FXzIwE`: **246 integration + 35
provider + 20 process + 25 unprivileged Linux**, all passed, plus service-free
acceptance, checkout-import denial and one installed engine per consumer. This
passes the original command with expanded tests, not a reduced-concurrency variant.
The concurrent 239/246 failures remain in the durable record and keep the historical
issue open. Normal focused/full source totals remain **184/184** and **1524/1524**.

The final required post-record rerun is logged at `/tmp/alpha23-completion-full.log`
and `/tmp/alpha23-completion-check.log`; inspect their actual completion before the
completion commit. No further implementation edits are planned. The final report
provides the resulting local/remote HEAD and clean-tree verification. All mission
work is either delivered or explicitly qualified as a remaining release/manual
review gap; no historical HTTP cause, load-reliability fix or release waiver is claimed.
