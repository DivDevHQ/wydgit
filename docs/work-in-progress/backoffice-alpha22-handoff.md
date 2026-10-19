# BackOffice alpha.22 increment 7 — durable handoff

Recorded 2026-10-19 on `develop/0.3`, Node 24.21.0. No deployment occurred.

## Git and version record

Starting local/origin HEAD: `23821a39e8e629e3764cda399a9198e47aacb2a6`, clean.
HEAD at preparation: `9c6810ebc202a6b00becf148f7102011d47ebd88`.
The final module/qualification commit follows this checkpoint; use
`git log --oneline 23821a3..HEAD` and `git ls-remote origin refs/heads/develop/0.3`
for the completion commit, which cannot embed its own hash in this file.

Verified milestones already committed and pushed:

- `ed2ff2b0cf361916ecb8a6fe454849b2bd48b177`: deadline/disconnect admission,
  conservative action outcome headers and transient session error mapping.
- `b8f71d7429cc6a7b6d2d775a5c48322039d46360`: real Chrome workflow and
  accessibility/focus/table scroll qualification.
- `9c6810ebc202a6b00becf148f7102011d47ebd88`: bounded recursive array forms,
  linked field errors, safer results and confirmation reset.

Platform, Wydgine and WydHosting: alpha.21 → **0.3.0-alpha.22**.
Gate remains **0.1.0-alpha.6**, Store **0.1.0-alpha.5**, standalone Client
**0.1.0-alpha.11**. Search/Stream peer declarations add the approved alpha.22 engine
without implementation-version bumps. Lockfile, demo revision and exact-version
regression expectations are synchronized. No dependency or persisted schema added.
Historical client/regex artifacts are preserved.

## Completed behavior and boundaries

1. Bounded BackOffice repair carries HTTP deadline/disconnect controls into existing
   action/service admission. One service charge, unchanged execution ceilings,
   admitted native-work drain, zero automatic mutation retries. Transient session
   conflict/busy/I/O returns 503 without clearing valid credentials. Genuine invalid
   sessions retain 401 and cookie deletion. Outcome evidence distinguishes rejected,
   completed and uncertain publication; it never certifies rollback/exactly-once.
2. Actual Chrome Gate form login, roster, refresh, permission denial, logout and a
   valid non-admin account are exercised. Viewports 360/768/1280/1920 plus 320 CSS
   pixels; light/dark/system preferences; native Tab/Enter and result scrolling;
   accessibility-tree landmarks/control/table semantics and limited token contrast.
3. Recursive array add/remove/max/count/focus supports nested object/array items.
   Required/optional/null/boolean/string/integer controls retain server contracts.
   Errors link to fields; long text uses native disclosures; homogeneous arrays
   use safe tables, and empty/nested/pagination values are clearer. Confirmation
   resets after edits and attempts. No stale-reference rebinding or replay.
4. Independent `examples/backoffice-notices` uses canonical Store query with its own
   permission and read-only receipt. JSON/SQLite tests prove independent revocation,
   removal/reinstall, retained data/fresh references and site/resource isolation.
   Chrome invokes both modules and edits a genuine nested sort array. No shell
   registration change or native package-inventory bridge was needed.

Preserved: current Gate/SEAM intersection; receipt integrity and PACKAGE.DRIFT;
exact App/installation/generation fences; Store ownership/revisions; origin/CSRF;
stopped-App lifecycle rules; no AccountAdmin/HostAdmin or native RPC/SQL/filesystem
handles. Fixture provisioning is explicit disposable native test work, separate
from ordinary package grants. Nothing changes production, deployment, live package
cutover, policy approval authority or cross-process atomicity.

## Verification history (independent runs, not additive)

| Run | Result | Local log |
| --- | --- | --- |
| Focused native baseline | 103/103 | `/tmp/alpha22-baseline-focused-native.log` |
| Native full baseline | 1479/1479 | `/tmp/alpha22-baseline-full-native.log` |
| Initial reliability implementation | 1486/1488; two obsolete launcher version assertions | `/tmp/alpha22-reliability-full.log` |
| Corrected reliability full | 1488/1488 | `/tmp/alpha22-reliability-full2.log` |
| Reliability with final barrier | 1489/1489 | `/tmp/alpha22-reliability-final.log` |
| Browser checkpoint full | 1490/1490 | `/tmp/alpha22-browser-full.log` |
| Usability checkpoint full | 1496/1496 | `/tmp/alpha22-usability-full.log` |
| Module/source full | 1500/1500 | `/tmp/alpha22-final-full1.log` |
| Latest focused HTTP/action/UI/modules | 66/66 | `/tmp/alpha22-modules-focused.log` |
| New UI renderer | 15/15 | `/tmp/alpha22-final-focus.log` |
| Existing six HTTP probes, three separate runs | 6/6 each | `/tmp/alpha22-deadline-probes1.log`, `probes2.log`, `probes-final.log` |
| First installed tarballs | 222/222 integration; 35/35 provider; 19/20 process | `/tmp/wyd-i54-packed-BWfvLo` |
| Explicit process inspection barrier | 1/1 | `/tmp/alpha22-process-barrier.log` |

Initial restricted-sandbox runs could not qualify listener/process tests and had a
Node native async-ID assertion; native execution baselines above are separate.
Intermediate fixture/renderer failures were corrected and rerun, not treated as
passes. The installed process failure and narrow deterministic fixture repair are
recorded in [reliability](../milestones/0.3-reliability.md).

`npm run check`: three pages, 42 internal links, unique anchors. Relative
documentation-file links: **582 checked, zero missing** before this handoff was
added. `npm ls --all --json`, whitespace checks and **31 immutable client artifacts**
passed. Final totals and installed process/Linux/browser evidence are appended below
when the completion gate finishes.

## Remaining limitations and follow-up

Historical intermittent FrontEnd SEWN.LIMIT HTTP 500 remains **open**. None of the
native full runs above reproduced it; deliberately held provider/load probes still
produce the expected deadline responses and preserve commit uncertainty. Zero
observations in these runs does not establish a historical reproduction rate or
prove a fix. Keep trusted phase/span/resource traces and investigate provider wait
versus scheduling delay under a failing load before reviewing wall/CPU/I/O budget
policy. No blanket limit increase, paused charging, response suppression or retries.

Concurrent Gate session touches can still exceed the existing optimistic conflict
bound; availability failure is reported accurately instead of logging users out.
Native work is cooperative and can commit after a request fails; drain awaits it.
No forced cancellation, universal idempotency or distributed drain is provided.

Chrome **155.0.8059.84** is qualified only for the recorded workflow; Firefox
158.0 was detected but not exercised. Human screen-reader/assistive-technology,
actual browser zoom/mobile touch, arbitrary skins and deployment/TLS qualification
remain partial. No full WCAG, ADM-01, privileged Linux deployment or managed-hosting
claim is made. Further package inventory requires a separately reviewed canonical
facade; native lifecycle exports remain unavailable to ordinary Wydgits.

Recommended next increment: obtain an instrumented failing historical HTTP trace,
review bounded Gate session-touch scheduling, and perform human assistive-technology
and second-engine qualification. Do not expand privileged administration to hide
these remaining release concerns.

## Reproduction and completion commands

```sh
node --test test/backoffice-http.test.js test/backoffice-actions.test.js test/backoffice-ui.test.js test/backoffice-modules.test.js
node --test test-support/http-budget-probe.mjs
node scripts/verify-backoffice-browser.js
node scripts/verify-packed-packages.js
npm test
npm run check
npm ls --all --json
git diff --check
git status --short
git diff --stat
git diff
```

Use listener/subprocess access for native qualification. All services/profiles/data
are disposable and loopback only. Review the notices README for separately approved
interactive local setup and cleanup. Never deploy or publish from these commands.

## Completion gate

All four work packages are implemented and qualified within the limitations above.
The combined full suite passed **1500/1500 twice**, including both providers,
process/lifecycle/Linux suites. A final required full run after these release-record
edits is logged as `/tmp/alpha22-completion-full.log`; no further feature edits are
planned. Content checks, dependency graph, **583** relative documentation file links,
whitespace and **31** immutable client artifacts passed.

Final installed tarballs from the final source at
`/tmp/wyd-i54-packed-0NNBaN` passed **222 integration/UI/module + 35 provider +
20 process + 25 unprivileged Linux tests**, zero failures. The preceding corrected
installed run `/tmp/wyd-i54-packed-LBYuc1` passed the same counts. Service-free
binary/HTTP/assets/restart checks also passed. Runtime hooks refused checkout
imports; every consumer had one installed engine. The process inspection barrier
also passed five consecutive focused runs while other qualification was active.
The earlier installed 19/20 failure remains documented; no deadline was relaxed.

Final Chrome two-module/array/refresh-focus workflow passed. Its five screenshots
and sanitized measurements are at `/tmp/wyd-backoffice-browser-YNmZsT`; desktop
light/dark, mobile, actual roster and access-error images were inspected. The
committed structured evidence is
[backoffice-alpha22-evidence-2026-10-19.json](../../test-support/backoffice-alpha22-evidence-2026-10-19.json).

Files changed across the mission: kernel action/HTTP adapters and their tests;
trusted web adapter plus runtime mirror and shell CSS; ordinary notices manifest,
prototype/template and native example installation/configuration helpers; disposable
module/browser fixtures; browser/tarball qualification scripts; release metadata,
lockfile/demo revision and exact-version tests; changelog, action/HTTP/browser/UI
contracts, reliability/release records and this handoff. No unrelated local work
was present or discarded. Final completion will commit these verified files and
push the fourth checkpoint without rewriting history, then verify a clean tree and
matching local/origin HEAD. No implementation blocker remains; historical HTTP,
Gate contention and human/browser/privileged qualification limitations above remain
explicit follow-up work, not silently accepted release waivers.
