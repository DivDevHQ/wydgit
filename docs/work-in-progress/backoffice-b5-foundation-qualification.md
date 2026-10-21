# BackOffice B5 — installed foundation qualification

2026-10-21; `develop/0.3`; expected and observed starting HEAD
`0a869c68e5e55f390caee51a0c29d4e587e86340`, clean working tree.
DEC-01 and DEC-02 remain binding without amendment. No version bump is authorized.

## Initial gaps and qualification plan

The initial matrix has 64 in scope: 62 Implemented, two Partial, zero Missing and
zero Unverified; 12 deferred. Its exact two partial observable contracts are:

| ID | Observable contract | Existing evidence and outstanding acceptance | B5 qualification and security implications | Promotion condition |
| --- | --- | --- | --- | --- |
| BO-HTTP-12 | Browser/accessibility qualification covers the renderer's promised interactions | BOHTTP/BOREL/BOFOUND-01–02, body/UI tests and Chrome/Firefox subsets. Matrix gap: “Chrome/Firefox subsets exist; human AT and complete Firefox keyboard journey unverified”. | Real installed canonical Page navigation, named bound intent, negative mutation, Chrome native keyboard, names/landmarks/errors/focus/contrast/reflow, Firefox supported journey. Preserve exact Session, origin, CSRF and action admission. Automated trees cannot prove human announcements. | Full promised interaction evidence, including complete Firefox keyboard and the outstanding human assistive-technology evaluation; no promotion from automated checks alone. |
| BO-REU-06 | Modular layout/property editing/content editors/dashboard support is reusable | Object model, OOP, components, forms, Taskboard and execution-context tests. Matrix gap: “Generic action forms/tables/navigation exist; canonical Page composition and broader ADM-01 incomplete”. B4b now qualifies canonical composition under BO-REU-05. | Exercise existing installed Members, Notices, records/archive and informational Taskboard with reusable native composition/forms. Do not invent a new generic editor/product suite to satisfy a count. Ancestry, nesting and preparation must confer no service authority. | Executable evidence for the complete named layout/property editing, content editor and dashboard contract. Existing action forms and an informational Taskboard alone are insufficient. |

The [B2 contract](backoffice-b2-decision-package.md),
[B3 preflight](backoffice-b3-migration-preflight.md),
[B4a adoption](backoffice-b4a-reviewed-adoption.md) and
[B4b enforcement](backoffice-b4b-live-enforcement.md) distinguish implemented
facilities from future generic WydData controls and wider administrative domains.
Any unmet criterion remains partial. Human evaluation cannot be manufactured by an
automated agent. Broader editors require a separately bounded follow-up if absent.

## Installed applications and review

[B5 fixtures](../../test-support/backoffice-b5.js) extend the real installation
fixtures, using package installation, accepted artifacts/mappings, stopped-App
`planPackagePolicy` → `approvePackagePolicy` → `applyPackagePolicy`, and explicit
Page proposals. Native operator authority is fixture provisioning only. Ordinary
package behavior uses canonical Wydgits/WydBasic; no privileged package execution
shortcut, mock service, substituted Session or production migration is used.

- Members and Notices are separate installed packages. BOB5-03 publishes
  `/backoffice/pages/members` and `/backoffice/pages/notices`, invokes real Gate
  roster and protected notices query, rejects exchanged binding references, and
  denies both Pages when independent Page permission is removed. The existing
  browser shell separately exercises their native navigation/forms/tables.
- Records/archive uses the disposable Store fixture on JSON and SQLite. Seven
  actions provide bounded query, get, create, update, delete, transaction and
  archive read. `/backoffice/pages/records` uses canonical `executePage`, an exact
  reviewed read-preparation consumer, and a native semantic creation form with
  labelled fields/confirmation. Its finite intents are list/get/create; remaining
  operations use their independently authorized raw action HTTP envelopes.
- Taskboard is the actual installed neutral WydBasic example, relocated through
  native lifecycle to BackOffice, explicitly reviewed as informational
  `/backoffice/pages/taskboard`, with zero actions/bindings. Browser rendering
  includes runtime-created repeated children and the selected second task page.

All content/login installations precede adoption, so review pins the final accepted
tree. Startup never performs adoption. Early records proposals exceeded the existing
64 KiB policy-plan limit. The final fixture uses one Page and four bindings (one
prepare, three intent), preserving that limit. The shared test helper now calculates
each proposal's exact validation digest, including when multiple keys share a Page;
it no longer accidentally reuses the first Page candidate's digest. Authoritative
native review still independently validates every submitted digest.

## Canonical browser execution and client boundary

Run [verify-backoffice-b5-browser.js](../../scripts/verify-backoffice-b5-browser.js)
with the existing local Chrome/CDP or Firefox/BiDi infrastructure. Generated profiles,
App data and loopback listeners are disposable; no browser download, everyday profile,
network interception or response mocking occurs. Real installed membership forms
establish HttpOnly credentials; the driver does not fabricate an authentication cookie.

The **test-only trusted intent adapter** is
[backoffice-b5-browser-client.js](../../test-support/backoffice-b5-browser-client.js).
The driver explicitly mounts it on the canonical rendered document. It reads only
published Page-binding/CSRF metadata, attaches to the existing semantic form, and
submits the normal protected HTTP endpoint with explicit confirmation. It has no
native registry, operator context or credential token. This is supporting evidence
for the binding transport contract, **not production WydClient functionality** or
automatic binding integration shipped by B5. Frozen client artifacts remain unchanged.

Both providers exercise login, anonymous/unauthorized/missing/retired Pages, public
alternate ingress and forged query rejection; approved read preparation, creation,
retained intent after revocation, reload/readback, Session expiration, graceful stop,
retirement, replacement/fresh review and restart. The successful browser creation is
version 1 after restart; the denied record is absent. Detail data is read through
the approved get binding, while in-Page links navigate the list/creation sections.
No generic detail editor is claimed.

The existing shell browser script initially failed B4b startup admission because
it had not adopted its disposable installations. It now explicitly runs the
established test-only review helper **after** both module/login installations.
It changes no production startup or package authority.

Chrome's native journey includes keyboard-only login, skip-link activation,
required-field submission with no HTTP mutation, Tab/Shift-Tab order, Space
confirmation, visible focus and Enter submission. The driver must observe real
document focus. An initial stronger Chrome attempt failed this prerequisite; native
CDP tab activation fixes the harness without overriding the DOM's focus result.
Firefox headless still reports no document focus. Its native-keyboard attempt
**fails**, and the separately selected pointer/DOM subset passes. No skipped or
synthetic Firefox keyboard success is reported.

## Accessibility evidence and limits

The existing project conventions are used: DOM semantics and Chrome accessibility
tree, computed colors, measured layout, native keyboard events and screenshot review.
There is no axe/full-rule-engine or complete WCAG claim. Checks cover one main
landmark/heading, named native controls, linked field errors, instructions, normal
status versus alert feedback, keyboard order/visible outline, and no document-wide
overflow at 320/360/768/1280 CSS pixels. The records fixture contains no dialog;
dialog focus management is not claimed. Existing shell checks cover native table
caption/headers and keyboard scrolling in its named result region.

Records text/input/button contrast measured **13.32/13.32/6.70:1 light** and
**16.19/13.40/9.84:1 dark** under the default skin. These are limited measured pairs,
not all pixels/states/skins. Chrome screenshots include both themes, mobile and
Taskboard; Firefox uses pointer/DOM and actual computed styles without an AX-tree
claim. Native Form errors associate through `aria-describedby`; success/error
announcements in the test client are DOM semantics, not proof of speech.

Human screen-reader announcements/navigation, the complete Firefox keyboard journey,
actual 200%/400% zoom, forced colors, magnification and real touch remain unqualified.
Use the existing [human checklist](../backoffice-browser-qualification.md#human-review-checklist--not-yet-performed)
with the installed fixtures and record browser/OS/AT versions and findings. These
limits retain BO-HTTP-12 Partial. No confirmed platform accessibility defect was
demonstrated by the new bounded audits; no new UI framework is introduced.

## Authorization, mutations and provider parity

[BOB5-01–03](../../test/backoffice-b5.test.js) run equivalent installed requests on
both providers. Create/get/query-offset/update/delete, revision conflict, archive
transaction, fixed constants, invalid/extra/oversized input, foreign resource owner,
failed/stale/cross-package binding, independent Page/action/service permissions and
Session revocation have the same status and persisted-state assertions.

The archive transaction declares both resources. Its envelope requires
`content.records.write`; archive create independently requires
`archive.records.write`. Removing the latter therefore reaches denied **member**
authorization, rather than merely failing envelope preflight. Neither collection
contains the denied batch. A foreign second member also leaves no first-member
write. The approved transaction produces version 1 in both collections. Successful
update reaches version 2; stale version cannot replace it. After delete and real
provider close/reopen/restart, deleted/denied IDs remain absent and both approved
transaction records remain version 1. No failed HTTP response is treated as proof
of rollback; these rejection assertions concern qualified pre-provider denials and
explicit subsequent state inspection.

B4b/B4a/action/HTTP/placement/preflight/policy regressions remain intact. The focused
selection additionally reaches forged host/caller/approval/receipt input, scope
maxima, inherited/nested/method receiver substitution, runtime/typed input
substitution, live policy changes, final publication, alternate dispatch, real killed
writers and recovery barriers. Approved Page entry grants no general action power;
action permissions do not grant Page entry. Transaction capability checks remain
independent of resource declarations and Gate permissions.

## Lifecycle and admission-mutex diagnostics

The sole production correction is in
[maintenance.js](../../packages/wydgine/src/engine/execution/maintenance.js).
Malformed JSON, invalid schema/size, null, symlink, directory and hard-linked mutex
state now produces sanitized `PACKAGE.BUSY` diagnostics, naming the local admission
mutex and stopped-process inspection. A potentially live PID gives `PACKAGE.BUSY`;
a dead-PID mutex gives `PACKAGE.RECOVERY` and identifies the abandoned condition.
No raw parser text, supplied secret, Store contents or provider path is exposed.
No ambiguous mutex is deleted or overridden. The exclusive-create race remains
fail-closed. PID reuse continues to block conservatively.

BOB5-04 proves startup and maintenance refusal, unchanged mutex bytes/type and
catalog/configuration, and read-only migration/policy inspection that still
identifies the selected App/installation and current approval. Independent B4b
real-process tests retain live admission/drain exclusion and dead **process lease**
reclamation under the mutex; this is distinct from reclaiming an abandoned mutex.
Killed review/apply and interrupted journals retain their exact recovery barriers.

Operator-assisted mutex recovery remains necessary:

1. Identify the canonical App root using trusted native operator configuration.
   Inspect migration/policy evidence for its exact App/package/receipt/generation;
   inspection itself grants no execution authority or approval.
2. Stop and drain **every** cooperating local App/maintenance process and disable
   supervisor restarts. Establish exclusive offline control of the root. A missing
   PID alone does not prove safety; consider PID reuse, another host/process and
   ambiguous evidence. If quiescence cannot be proved, leave the mutex untouched.
3. Preserve the coordination file and accepted catalog/configuration/checkpoints
   for diagnosis/backup. Independently inspect owner/PID/type and the refusal reason.
   Resolve the stale coordination file only under that exclusive stopped-host
   control. There is no supported force-unlock command or automatic cleanup.
4. Inspect/recover any package writer/effects journal using the existing independently
   authorized native recovery APIs, selecting only the exact approved source/target.
   A mutex is never a reason to edit receipts, renew approval or restore an obsolete
   generation. Run preflight and current-complete adoption checks before restart.

This is a local trusted cooperating-filesystem procedure, not a distributed lock,
hostile-root defense or power-loss certification. Production recovery/deployment
needs its own operational evidence.

## Qualification record

[Machine-readable evidence](../../test-support/backoffice-b5-evidence-2026-10-21.json)
retains exact commands, executed counts, failure causes, log hashes and sanitized
browser results. Test-runner counts and whole browser journeys are distinguished.
Required final checks are repeated after the last edits; the commit/handoff records
their final outcomes rather than embedding a commit's own hash in its contents.

| Executed command/selection | Result |
| --- | --- |
| `node --test --test-isolation=none --test-reporter=tap test/backoffice-b5.test.js` | 7 passed; final fixture and same-Page/different-key digest regression |
| Focused 13-file installed/security/recovery command below | 318 passed |
| `npm test` before final report/evidence recording | 1,961 passed; includes immutable pretest build |
| `node scripts/verify-packed-packages.js` | 690 installed engine, 35 provider, 20 real process, 25 Linux; all passed |
| Installed consumer `node --import .../proof-register.mjs --test --test-reporter=tap test/backoffice-b5.test.js` | 7 passed again with final fixture/tests; checkout-runtime imports still rejected |
| `node scripts/verify-backoffice-b5-browser.js` | Chrome 156.0.8078.47: JSON and SQLite protected workflows plus informational Taskboard passed; native keyboard/AX and final 360 px captures |
| `WYDCLIENT_BROWSER=firefox WYDCLIENT_FIREFOX_POINTER_ONLY=1 node scripts/verify-backoffice-b5-browser.js` | Firefox 158.0: same three journeys passed in pointer/DOM mode |
| `WYDCLIENT_BROWSER=firefox node scripts/verify-backoffice-b5-browser.js` | Failed native-focus prerequisite; zero complete keyboard-qualified journeys |
| `node scripts/verify-backoffice-browser.js` | Existing Chrome Members/Notices shell journey passed after explicit fixture review |
| `WYDCLIENT_BROWSER=firefox WYDCLIENT_FIREFOX_POINTER_ONLY=1 node scripts/verify-backoffice-browser.js` | Existing Firefox shell pointer/DOM journey passed |
| `node scripts/verify-hostname-browser.js` | Five real Chrome HTTP/HTTPS/hostname fixtures passed |
| `node --test --test-isolation=none --test-reporter=tap test/native-scheduling-evidence.test.js` | 2 passed; archived source/archive hashes and entire installed guard remain pinned |
| `verifyArtifacts` from `packages/wydclient/artifact-policy.js` | 31 immutable artifacts verified |
| `npm run check` | Three Pages, 42 internal links, unique anchors |
| `python3 /tmp/b5-verify-docs.py` | 76 stable requirement IDs, unchanged statuses, valid relative files/anchors |
| `git diff --check` and frozen/runtime/version diff checks | Passed; no client/runtime-asset/manifest/lockfile/version drift |

The exact focused command is:

```sh
node --test --test-reporter=tap test/backoffice-b5.test.js test/backoffice-enforcement.test.js test/backoffice-adoption.test.js test/backoffice-preflight.test.js test/backoffice-action-scope.test.js test/backoffice-page-foundation.test.js test/backoffice-actions.test.js test/backoffice-http.test.js test/backoffice-modules.test.js test/backoffice-placement.test.js test/policy-reconciliation.test.js test/deadline-ledger.test.js test/native-scheduling-evidence.test.js
```

The packed consumer lives at `/tmp/wyd-i54-packed-nLH2FJ`. Runtime tarballs were
unchanged after this run. Only the final B5 **fixture/test** text was independently
restaged for its seven-test rerun (readable preparation text and two reviewed keys
on one Page); source/staged hashes and the exact consumer command/environment are
in the evidence. No checkout engine source was copied or allowed by the resolver.
The four packed selections have zero failures/cancellations/skips/todo. Browser
journeys are whole script runs, not invented test-runner counts.

Nine failed command attempts are preserved rather than overwritten: initial fixture
property/roster-envelope mistakes and sandbox listener refusal; wrong repeated-Page
digest selection and an incorrect first helper correction; two overlarge review
plans; the old vague mutex diagnostic; Firefox's native-focus failure; Chrome's
unfocused-tab prerequisite; and the existing shell's missing adoption. Exact grouping,
counts, commands and hashes are in the evidence. None required weakening authority,
removing a security regression or increasing limits.

Visual review additionally caught desktop-size “mobile” captures. The harness now
captures **inside** the 360 px viewport step with explicit clipping and checks the
PNG width. Earlier passing DOM layout measurements remain valid, but those earlier
PNGs are not mobile evidence. Final Chrome mobile/dark/Taskboard screenshots were
visually inspected. Fixture preparation now uses readable separators rather than
assuming C-style newline escapes in WydBasic strings. These are fixture/harness
corrections, not changes to canonical rendering or the production browser client.

Final `npm test` and `npm run check` run after this report and evidence snapshot.
Their actual outcomes are recorded in the commit message and final owner handoff;
this snapshot does not predict success. Temporary log/screenshot paths are local
artifacts with hashes, not a guarantee of indefinite `/tmp` retention. Sanitized
browser result data is embedded in the committed machine evidence.

## Foundation assessment and bounded follow-up

**Do not declare the approved BackOffice 0.3 foundation complete.** The final matrix
retains **62 implemented/verified, two partial, zero missing/unverified, 12 deferred**.
The installed canonical runtime/binding/security foundation has additional executable
evidence, but BO-HTTP-12 and BO-REU-06 still fail their complete exit criteria. No
remaining DEC-01/DEC-02 authority choice is invented or reopened to change this count.

The smallest justified follow-up is a bounded B6 acceptance package with two explicit
tracks: (1) focused graphical Firefox native keyboard plus human AT evaluation of
the existing installed journeys, correcting observed defects; (2) inventory existing
layout/property/content editing and dashboard facilities, define the small reusable
site-level contract still missing, then implement/qualify only that approved scope.
Any production bound-intent presentation integration needs its separately governed
client workflow; the B5 test adapter cannot stand in for it. Do not fold WydData,
DataTable/DataPager/DetailForm, cross-package bindings or wider domains into this work.

The 12 deferred requirements remain deferred. Foundation completion is also distinct
from production deployment readiness. No production/external installation is accessed
or migrated. A deployment still needs exact inventory/ownership/configuration,
backup and rollback/recovery evidence, stopped/drained explicit action/Page review,
supported engine/provider closure, independent origin/proxy/TLS configuration and
site-specific functionality/accessibility/security acceptance. Mixed older engines
must not run against the new coordination/adoption contract.

**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** Concurrent native Contact mutations may
commit and still return HTTP 500/indeterminate after the existing 1000 ms Page
deadline. B5 changes no deadline, transport retry or mutation-outcome guarantee.
Passing these bounded tests does not resolve or waive the archived failure.
No versions/manifests/lockfiles, immutable client artifacts, archived source pins,
release/tag/publication or deployment are changed.
