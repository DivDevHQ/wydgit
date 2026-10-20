# HTTP reliability alpha.27 — increment 12 handoff

Started clean at `f285d4f1cc935df463d97d9868f3967665ffe6e4` on `develop/0.3`,
Node 24.21.0, Linux, 2026-10-19. Fetched origin matched. Platform/Wydgine/WydHosting
alpha.27, Store alpha.7 for actual SQLite changes, Gate alpha.7 and Client alpha.11
unchanged. No new dependency, runtime correction, deployment or publication.

**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** The instrumentation/evidence checkpoint is
complete; causal attribution remains partial. After inspection's provider-owned
completion marker, transaction resumption is fast on both successful and failed
requests. Long preflight intervals occur inside inspection and/or lifecycle.

The [qualification](../http-preflight-continuation-qualification.md) specifies the
real await chain, bounded representation, calibration and measurement limitations.
The [evidence](../../test-support/http-reliability-alpha27-evidence-2026-10-19.json)
retains every setup/POST outcome and full numeric trace. Raw local artifacts:
`/tmp/contact-alpha27-continuation`; log: `/tmp/alpha27-experiment.log`.

- One series: three fresh separate-client SQLite fixtures at actual twelve-way
  overlap, unchanged 1,000 ms deadline. **11/36 HTTP 200, 25/36 matching 500**;
  repetition success/failure: **4/8, 5/7, 2/10**. All failures first exhaust during
  prerender, after two settled natives and one reported commit, received indeterminate.
  All setup GETs and cleanup pass; no timeout/partial/unknown receipt, retry or rerun.
- All **72/72** inspection observations complete/resume; no missing/incomplete
  samples. Per-request two-call completion-to-resumption totals max **0.008246 ms**,
  max **0.004028 ms** among failures. This envelopes actual Promise settlement delay;
  it is not a direct Promise settlement hook. No Promise reaction or yield is added.
- Inspection totals max **857.199 ms**, full preflight **1,109.088 ms**, lifecycle
  **926.693 ms**, synchronous transaction **14.749 ms**. A failed request has just
  **3.547 ms** inspection but **926.693 ms** lifecycle. Inspection duration alone
  is not necessary for the failure. Do not sum nested timing envelopes.
- Server callback lateness max **391.605 ms**, pending lower bound **407.522 ms**;
  conservative zero-check interval **6.670 ms**. All sampler tails are incomplete.
  These observations establish no disk, threadpool, GC or CPU attribution.

No provider queue or wait-for-lock-availability loop exists in the SQLite path.
Lifecycle checks fail immediately on a present marker. Internal filesystem awaits
and continuation scheduling remain mixed within both inspection and lifecycle.
No runtime defect has been demonstrated and security/deadline/commit semantics
remain intact. No optional counter-experiment was needed to exclude the measured
outer continuation location; another load series would not resolve the internal
boundary. No claim about available weekly usage was made.

Next: instrument the existing lifecycle lstat ENOENT recovery callback just before
returning null, then the lifecycle await's own resumption. Keep separate client,
SQLite and twelve-way concurrency fixed; no added reaction or scheduling barrier.
That distinguishes recovery completion from internal lifecycle continuation delay,
while leaving raw filesystem completion timing explicitly unobserved.

Initial native deterministic tests **11/11**, focused selection **77/77**; zero
failures/skips. Restricted sandbox's aggregate file pass is not individual assertion
evidence. Historical alpha.23–.26 failures remain in their original artifacts.
Final verification and delivery identity follow after execution; no omitted check
is represented as passed.

Final focused checks pass **142/142**, zero skipped. Retained prior attempts:
**137/142** focused (three stale escaped banner assertions, two startup failures
from the exact Store fixture pin) and **272/302** installed integration (30 startup-
dependent failures from the staged old fixture pin). Corrected only the version
references; no runtime/security change. The installed command is repeated once
with the corrected fixture. Final required full suite is run only once after
these edits, with actual results recorded in the delivery commit/final report.


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
