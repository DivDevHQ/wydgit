# HTTP reliability alpha.28 — increment 13 handoff

Started clean at `034e7a868d6f0929b845fa63d0ddd539d2a948cc` on `develop/0.3`,
Node 24.21.0, Linux, 2026-10-19. Fetched origin matched. Platform/Wydgine/WydHosting
alpha.28 and Store alpha.8; Gate alpha.7 and standalone Client alpha.11 unchanged.
No dependency, runtime correction, authority/deadline change, deployment or publication.

**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** This is a verified attribution increment.
The long measured lifecycle interval ends at entry to the existing lstat Promise
rejection recovery callback. Post-marker continuation and subsequent validation
are small. The fs/promises implementation does not expose a raw filesystem callback;
no scheduling boundary was manufactured to claim one.

The [qualification](../http-lifecycle-lstat-qualification.md) documents exact marker
locations, overlap, calibration and limitations. The
[evidence](../../test-support/http-reliability-alpha28-evidence-2026-10-19.json)
retains all 36 POSTs, three setup GETs, full sanitized numeric diagnostics, first
exhaustions, ledger progress, cleanup/process results and raw artifact digests.
Local raw directory: `/tmp/contact-alpha28-lifecycle`; log: `/tmp/alpha28-experiment.log`.
These temporary paths are not a retention guarantee; portable records are committed.

- One series, three fresh SQLite fixtures, separate clients, actual twelve-way
  client/server/admission/Page overlap, unchanged Contact payloads and 1,000 ms
  deadline. **13/36 HTTP 200, 23/36 matching HTTP 500/indeterminate**, repetitions
  **6/6, 2/10, 5/7** success/failure. Every POST reports one commit and two settled
  native calls, zero pending; complete client receipt and publication agree.
  All setup GETs, client exit/reaping and fixture cleanup pass; no retry or rerun.
- All 23 failed requests first exhaust during prerender. Two successful requests
  first exhaust during cleanup; these remain 200/committed and are retained.
- All **72/72** lifecycle calls enter recovery, classify ENOENT, complete their
  producer marker, resume and validate; none incomplete or missing. Per-request
  two-call maxima: invocation-to-recovery **913.567554 ms**, recovery work
  **0.053651 ms**, marker-to-continuation **0.013045 ms**, subsequent STORE.BUSY
  validation **0.120637 ms**. The producer marker is not Promise settlement.
- Full lifecycle max **913.596828 ms**; residual after its contained entry-to-resume
  and validation max **0.016511 ms**, including outer continuation and instrumentation
  overhead. Inspection max **908.846987 ms**, preflight **1085.696054 ms**,
  synchronous transaction **14.959731 ms**. Do not add nested spans or unrelated maxima.
- Scheduling callback lateness max **390.454241 ms**, pending lower bound
  **355.307927 ms**; observed zero-check interval max **12.427234 ms**, checkpoint
  interval max **632.607158 ms** (can contain checks). All 36 sampler tails incomplete.
  No exclusive CPU, physical disk, thread-pool or OS attribution follows.

No optional counter-experiment was performed. Another load run would not distinguish
the hidden filesystem callback boundary. The strongest next narrow step is to
validate **test-only bounded async_hooks correlation of the lifecycle lstat
FSREQPROMISE resource**, then compare callback execution to existing recovery entry
without changing the API or adding reactions. First prove correct resource attribution;
callback execution would still not be kernel completion. Inspection's internal
filesystem awaits remain separately unresolved. No speculative runtime fix is justified.

Verification completed before the final normal suite:

- Calibration/native-stage tests **20/20**; initial focused **53/53**, preprobe
  **74/74**, final focused **153/153**, all zero failures/skips on those runs.
  Final selection includes six controlled HTTP deadline/commit/drain probes;
  SQLite trusted observers deliberately throw without changing existing outcomes.
  Existing ledger first-exhaustion and shared sampler cleanup tests pass.
- Retained intermediate native **19/20** and **7/8** calibration results: fixture
  teardown created unused rejected Promises, and nested mock restoration affected
  the next provider fixture. Isolating that provider case passes. Fixture-only
  corrections produce **20/20**. Restricted sandbox aggregate **1/2** file result
  is retained and is not individual assertion evidence. No failure is discarded.
- Installed local tarballs: **310/310 integration, 35/35 provider, 20/20 process,
  25/25 unprivileged Linux**, zero failures/skips. Service-free installed binary,
  validation, HTTP/assets/restart, repository-import rejection and one installed
  engine per consumer pass. Command `node scripts/verify-packed-packages.js`;
  directory `/tmp/wyd-i54-packed-AgClDP`, log `/tmp/alpha28-packed.log`.
- Initial `npm run check` passes three complete pages and 42 internal links/anchors.
  Dependency graph and whitespace checks pass. Evidence audit verifies five raw
  source artifact digests, 36 complete POST traces, 72 complete lifecycle observations
  and numeric-only lifecycle rows. All **648** relative documentation links resolve.
  Results and log digests are retained in the evidence.

After all tracked edits, run one normal `npm test` and final `npm run check`;
actual results and log digests belong to the delivery commit/final report, avoiding
predicted pass claims or repeated full suites for documentation-only updates.
Privileged managed-hosting/Linux and browser/human qualification are omitted.
Commit/push identity, independently verified remote HEAD and clean-tree status
are supplied in the final report. No force-push, release, deployment or publication.
