# HTTP reliability alpha.26 — increment 11 handoff

Started clean on `develop/0.3` at `608b6f71e91a55c3f2c4a8e0354bd7cbb1aefcf3`,
matching fetched origin; Node 24.21.0, Linux, 2026-10-19.

**Shared client/server process placement is not necessary for the matching
Contact failure. WYDGINE-0.3-HTTP-LIMIT remains OPEN; no runtime correction.**
Platform/Wydgine/WydHosting alpha.26, Store alpha.6, Gate alpha.7, Client alpha.11.
No deployment, publication, new dependency, authority expansion or limit change.

The [qualification](../http-process-isolation-qualification.md) defines supervision,
transport parity, all repetitions, server measurements and causal limitations.
The [bounded evidence](../../test-support/http-reliability-alpha26-evidence-2026-10-19.json)
preserves every outcome, server numeric summary and first full match per placement.
Local raw artifacts: `/tmp/contact-alpha26-isolation`; command output:
`/tmp/alpha26-experiment.log`. No experiment was repeated or discarded.

- Primary A1/B1/A2/B2, three fresh fixtures per block, actual twelve-way overlap:
  shared **13 HTTP 200 + 59 HTTP 500 / 72**; separate **29 HTTP 200 + 43 HTTP 500 / 72**.
  Every 500 is prerender timeMs, two settled native calls, one reported commit,
  received indeterminate. Additional cleanup-only first exhaustions: shared 3,
  separate 2, all 200/committed. All POST responses complete; no timeout/partial.
- Secondary concurrency eight: **8/8** 200/committed per placement; no exhaustion.
  All **14/14** setup GETs pass. All seven separate clients exit zero and are reaped;
  every fixture cleans up. No other test suite ran during the 27.392 s comparison.
- Server maxima at twelve, shared/separate: callback lateness **150.930/480.414 ms**;
  conservative zero-check intervals **8.153/7.766 ms**; preflight two-call aggregates
  **938.920/1,158.550 ms**; synchronous transaction aggregates **14.805/15.151 ms**.
  Longer awaited/provider intervals do not establish CPU time or provider blame.
- Different client counts accompany different server scheduling observations;
  transport and client/server status pairs agree. There is no demonstrated simple
  client-stall-removal mechanism. No statistical significance, universal threshold,
  placement sufficiency or all-client-effects-eliminated claim.

Implementation: extract existing request/barrier logic into one shared client;
fixed supervised Node child with minimal configuration, bounded startup/execution,
SIGTERM/SIGKILL, awaited close, disconnect exit and sanitized schema validation;
add `--process-isolation` to the existing harness. Keep all runtime/provider code
unchanged. Metadata, lockfile, current version assertions, Search/Stream peer
compatibility, changelog, release status and installed test selection synchronize.

Focused final: **126/126**, `/tmp/alpha26-focused-final.log`. Includes deterministic
supervision failures/cancellation and wire parity, existing concurrency, scheduling,
progress, native stages, commit/deadline probes and package/version regressions.
Retained failed attempts: restricted-sandbox aggregate failure and **20/22** initial
native harness run due solely to an incorrect Connection-header test expectation.
No runtime behavior changed to make those tests pass.

Installed results are recorded below. Final required `npm test` /
`npm run check`, dependency/whitespace/doc-link results and final Git identity are
recorded in the delivery commit message and final report after final edits.
Browser/human assistive technology, privileged Linux/managed-hosting qualification
and production reliability closure remain incomplete and outside this increment.

Next: keep separate client + SQLite + twelve-way actual overlap fixed. Add bounded
server continuation checkpoints around preflight awaits to distinguish lifecycle /
filesystem completion from Page continuation scheduling. One controlled mechanism
at a time; no runtime refactor, ceiling increase or automatic mutation retry.
Weekly usage was not programmatically available; stop after this one bounded
comparison and verified delivery. No additional stress or speculative experiment.


Installed local tarball command `node scripts/verify-packed-packages.js` passes:
**296/296 integration, 35/35 provider, 20/20 process, 25/25 unprivileged Linux**,
plus service-free binary/HTTP/restart checks. Evidence directory:
`/tmp/wyd-i54-packed-USklNq`; each consumer has exactly one installed engine and
checkout runtime imports are rejected. The integration selection includes the new
process-isolation harness tests. No privileged Linux or production deployment test
was run. Dependency graph and whitespace checks pass before final required checks.
