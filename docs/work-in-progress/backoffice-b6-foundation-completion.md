# BackOffice B6 — foundation completion qualification

2026-10-21, `develop/0.3`. Starting HEAD and independently queried remote:
`4f94474b1844c48385da777fd734ca64831a46c2`; working tree clean.

## Acceptance and bounded implementation plan

Authoritative sources: [matrix](backoffice-conformance-matrix.md),
[approved DEC-01/02](backoffice-b2-decision-package.md),
[founding architecture](../FOUNDING-ARCHITECTURE.md),
[administrative framework §8](../execution-contexts-and-administrative-domains.md#8-one-modular-backoffice-framework),
[B3](backoffice-b3-migration-preflight.md), [B4a](backoffice-b4a-reviewed-adoption.md),
[B4b](backoffice-b4b-live-enforcement.md), and
[B5 report](backoffice-b5-foundation-qualification.md) / [evidence](../../test-support/backoffice-b5-evidence-2026-10-21.json).

- BO-REU-06: reusable modular layout/property editing, content editors and dashboard
  presentation/interaction, exercised in installed canonical Pages with independent
  admission, action/service checks and persistence. Forms alone and informational
  Taskboard do not satisfy the missing editing/dashboard acceptance.
- BO-HTTP-12: qualify the renderer's promised interactions, including complete native
  Firefox keyboard journeys and human assistive-technology acceptance. Automated
  names, semantics, focus, contrast and reflow checks cannot satisfy human acceptance.

Plan recorded before implementation: reuse the existing trusted unbundled WydClient
web presentation adapter and typed fields/results for canonical Page intent controls;
add reusable record load/edit/save and explicit dashboard refresh; demonstrate layout
properties and bounded Markdown content in real installed applications. Keep exact
reviewed consumer/action references and invocation-time authority. Investigate Firefox
headless focus and protocol modifiers, then repeat native journeys. Qualify actual
packages, both providers, lifecycle/security and required checks; retain failed attempts.
No WydData, broader administrative domain, new authority model, frozen bundle rewrite,
version bump, deadline change, retry of uncertain mutations, release or deployment.

Human AT requires a qualified human and supported graphical environments. It cannot
be performed by this automated run. BO-HTTP-12 therefore remains Partial unless an
actual evaluation is supplied. Implementation alone does not promote BO-REU-06.

The results below distinguish completed implementation from the remaining acceptance blockers.

## Implemented facilities and trust boundary

[Shared typed presentation](../../wydclient/backoffice.js) is factored from the
existing shell; fields now support validated recursive prefill and multiline bounded
strings. [Production Page controls](../../wydclient/backoffice-controls.js) reuse it
for exact reviewed consumer groups. Compatible get/update pairs with identical
fixed targets initialize only after an explicit successful read, preserve entered
values on failure, consume confirmation per invocation and advance revisions on
success. Failed saves require a fresh read. Unpaired intents use typed forms/results;
read queries provide explicit dashboard refresh with native tables and disclosures.
There is no automatic refresh, reference rebinding or uncertain mutation retry.

The [installed ordinary example](../../examples/backoffice-editors/README.md) stores
title/column-layout/Markdown properties. Its portable preparation handler reads the
approved binding and projects persisted properties into existing semantic section
format and sanitized Markdown blocks. Reusable editing is in the platform adapter,
not package-specific JavaScript. Other typed schemas use the same editor/field
contracts; installed Members and Notices use the same production intent adapter.
This qualifies bounded site layout/property editing, content editing and dashboards;
it does not promise a drag designer, arbitrary graph/property mutation, rich HTML,
WydData, AccountAdmin, HostAdmin or System administration.

Trusted [Page publication](../../packages/wydgine/src/engine/packages/backoffice.js)
adds bounded escaped `wydgit.backoffice-controls/1` data, grouped by reviewed consumer,
with independently authorized action descriptions and original closed Page bindings.
It removes server-fixed top-level keys from editable input contracts and projects the
most-derived reviewed constraint. Operation labels and fixed-input metadata are
presentation only. The browser submits only `{pageBinding,input,confirmed?}` through
the unchanged protected endpoint. Browser-edited selectors/values cannot mint a
binding, resource grant, caller, principal or service operation. The server resolves
its own current reviewed binding, restores fixed values, validates all constraints
and separately checks Page/action/service access at invocation/publication.

Inheritance/nesting grant no authority. DEC-01/02, resource maxima, ownership,
capability intersections, transaction-member authorization, installed lifetime and
recovery guards remain in the original runtime. No approved receipt/catalog schema,
provider format, 64 KiB review-plan ceiling or 1,000 ms deadline is enlarged. The
example's actual review plan is **22,460 bytes** on both providers.

Production support is required to make Client/SUB intent usable outside B5's test
adapter. The established served adapter is `wydclient/`, mirrored under
`packages/wydgine/runtime/wydclient/`; it is separate from frozen versioned
`packages/wydclient/dist/` standalone bundles. B6 updates that existing adapter,
adds its new browser-safe asset to the explicit transport whitelist and packed
inventory, and verifies both mirrors. No frozen artifact is overwritten and no
versioned standalone artifact is rebuilt with changed source. Existing package
versions/manifests/lockfile remain unchanged; only the new ordinary example has its
own initial `0.1.0` manifest.

## Installed workflows, security and provider findings

BOB6-01 runs genuine installation, native reviewed adoption, startup admission,
canonical Page HTTP, load/update/query, content and semantic-layout readback on
JSON and SQLite. Both reach version 2 after one approved edit. Invalid property
shape, oversized content, unknown keys, attempted fixed-resource/ID overrides,
foreign package/stale binding, independent write denial and Page-permission denial
cannot overwrite it. A revision-1 conflict preserves version 2. Provider close/reopen,
retirement, replacement/fresh review and stale-generation rejection preserve the
same durable version. The production asset is fetched through actual HTTP.

Chrome production browser workflows use real membership form login/HttpOnly cookies,
explicit Page admission and the shipped module without injected client code or
response interception. Native Tab/Shift-Tab/Enter/Space and text input exercise
skip navigation, disabled-until-load editing, linked validation/error focus, visible
focus, Markdown/layout persistence, confirmation consumption, dashboard tables,
concurrent revision conflicts, reload, live revocation and real Session expiry.
A separate writer produces version 3; denied/stale editor content never replaces it.
Independent installed Members and Notices also produce real service results through
these production controls. Firefox repeats the explicitly labelled pointer/DOM
subset on both providers and both modules; it is not keyboard qualification.

B5's installed records/archive, Members/Notices, actual neutral Taskboard and mutex
regressions are preserved. Focused/full/packed suites retain malformed declarations,
stale approvals, cross-installation references, restrictive scope/ownership,
transaction envelope/member denials, killed writers, reviewed recovery and caller
preservation. Mutex diagnostics remain sanitized; ambiguous coordination files are
never automatically removed. B5's conservative operator-assisted stopped-host
recovery procedure remains authoritative. No production/external App was modified.

These are qualified pre-provider denials with explicit persisted-state inspection,
not a general rollback guarantee after indeterminate writes. JSON/SQLite observable
outcomes agree; this does not assert identical crash/durability guarantees.

## Firefox native keyboard investigation

Firefox 158.0 fails the unchanged real-document-focus prerequisite headless and
on the available graphical display. Activating the BiDi browsing context after
every navigation and focusing only the disposable process's own X window does not
resolve it. The plain-document probe has **no BackOffice code**: before input,
`hasFocus:false`, `hidden:false`, active BODY; after native Tab, active INPUT but
still `hasFocus:false`. X focus reports the disposable `B6-focus-probe` window.
Disabling `focusmanager.testmode` produces the same observation. The new production
journey fails before keyboard login rather than silently falling back to a pointer.

The BiDi bridge did have a test-harness defect: it ignored modifier bits, so
Shift-Tab and Ctrl-A could not be qualified correctly. It now sends native modifier
key-down/up actions, adds Escape/ArrowLeft mappings, and supports repeated native
context activation. This correction does not solve the document-focus prerequisite.

Conclusion: evidence points to a Firefox/BiDi/display environment interaction,
reproduced independently of BackOffice. The exact underlying browser/environment
cause remains unresolved; no BackOffice focus defect is established or ruled out
for every environment. Mozilla's [real-focus test guidance](https://firefox-source-docs.mozilla.org/testing/browser-chrome/index.html)
and [focus-manager issue](https://bugzilla.mozilla.org/show_bug.cgi?id=1943448)
provide context, not proof of this installation's root cause. Native Firefox
qualification remains **failed/incomplete**, not skipped or substituted.

Reproduce with:

```sh
WYDCLIENT_BROWSER=firefox node scripts/verify-backoffice-b5-browser.js
WYDCLIENT_HEADFUL=1 WYDCLIENT_BROWSER=firefox node scripts/verify-backoffice-b6-browser.js
WYDCLIENT_HEADFUL=1 node scripts/verify-firefox-focus.js
WYDCLIENT_HEADFUL=1 WYDCLIENT_FIREFOX_FOCUS_TESTMODE=0 node scripts/verify-firefox-focus.js
```

Graphical diagnostics require the available X display and `xdotool`; they select
only the newly spawned disposable Firefox process. The probe's zero exit means it
ran, not that keyboard acceptance passed. No DOM focus result is overridden.

## Automated accessibility and human AT protocol

Automated measurements cover named controls, one main landmark, native fieldsets,
linked errors, polite status/assertive error semantics, keyboard focus/order and
recovery, explicit confirmation, result tables and no page overflow at 320, 360,
768 and 1280 CSS pixels. Chrome observes a **3 px solid** result-focus indicator
and a named multiline textbox in its accessibility tree. Textarea contrast is
**13.32:1 light / 13.40:1 dark** on both providers. These are measured pairs in the
default skin, not whole-page/whole-skin conformance. Mobile and theme screenshots
are retained and visually reviewed. Firefox pointer focus has no outline in the
observed pointer state; no native-focus success is inferred from it.

No dialog or modal is introduced; inline per-attempt confirmation is used. Modal
focus trapping/return is therefore not an applicable new behavior. Native details,
forms and result regions preserve browser semantics. Human speech/order, actual
200%/400% zoom, OS forced colors, magnification and physical touch remain untested.
Automated semantics and accessibility-tree results do not prove announcements or
WCAG conformance.

**Human evaluation performed: NO.** Use this reproducible protocol before promoting
BO-HTTP-12; the earlier [full checklist](../backoffice-browser-qualification.md#human-review-checklist--not-yet-performed)
remains applicable to the shell's nested arrays and table scrolling.

1. Run `node scripts/serve-backoffice-b6-review.js json` (repeat with `sqlite`).
   Use only the disposable App and printed credentials. Record evaluator name/date,
   exact commit, OS/browser/AT versions, speech verbosity, input method, theme,
   viewport and zoom. Do not record passwords, cookies or session/CSRF tokens.
2. Evaluate both promised browser engines with a qualified human screen-reader
   user: NVDA/Firefox and NVDA/Chrome on Windows, or explicitly record an agreed
   supported alternative such as Orca/Firefox on Linux. No combination has passed
   in B6. Record which combinations are unavailable; do not infer one from another.
3. Using keyboard and screen-reader navigation, sign in, activate Skip to content,
   navigate headings/landmarks, reach editor/dashboard and inspect names, legends,
   bounds and disabled save state. Expect logical order, visible focus and no trap.
4. Load the record; expect completion announced once and focus at Result. Reach
   prefilled title/columns/body/version. Change Markdown using multiple lines,
   toggle layout, enter an invalid revision, submit and verify the focused field's
   linked error is spoken with bounds and entered content retained. Correct it.
5. Confirm and save; expect one completion, consumed confirmation, new revision
   and focus at Result. Edits must clear confirmation. Refresh the dashboard and
   navigate its caption/headers/cells; open/close long-text disclosures with the
   keyboard, then reload the Page to read persisted sanitized content and layout.
6. In the separate local operator console, use `deny-write`, `deny-read`,
   `deny-page` and `allow` one at a time. Retained intents must deny with clear
   recovery; disabled controls and focused Reload Page must be understandable.
   Use `expire` for Session expiry, `allow` to restore the clock, then sign in again.
   Confirm there is no automatic replay and durable records show only approved work.
7. Exercise stale/revision conflicts with a second browser session editing the same
   `home` record. Keep the first form's entered text, submit its old revision,
   expect an uncertain/failure alert and required fresh load, then inspect the
   latest durable revision. Do not retry an uncertain write to discover its outcome.
8. Repeat light/dark/system, actual 200%/400% zoom and OS forced colors with
   magnification; check reflow, focus, labels/errors and local table scrolling.
   Complete the existing Members/Notices shell checklist and real touch/orientation
   checks on supported hardware. No modal step is applicable to these inline controls.
9. Capture step-by-step pass/fail, exact expected/observed spoken phrases, focus
   target/order, sanitized screenshots or audio with consent, issue IDs and artifact
   hashes. Sign/date the human record and retain failures. A qualified reviewer must
   assess all supported combinations and unresolved findings before acceptance.

## Executed checks and evidence

[Machine-readable evidence](../../test-support/backoffice-b6-evidence-2026-10-21.json)
retains exact argv, outcomes, timestamps, environment, failure/correction notes,
log hashes, embedded sanitized browser results, screenshot hashes, tarball hashes
and installed-suite summaries. Local ignored `test-support/b6-logs/` and `/tmp/`
paths are diagnostic artifacts; embedded results/hashes survive their eventual
removal. Browser journeys are whole runs, not invented test-runner counts.

| Executed command / selection | Observed result |
| --- | --- |
| `npm test -- --test-reporter=tap` | 1,967 passed; immutable pretest build; final exact `npm test` repeat recorded in evidence/handoff |
| `npm run check` | Content/link check; final observed output recorded in evidence |
| Focused 14-file security/lifecycle selection in evidence | 317 passed, zero failed/cancelled/skipped/todo |
| `node --test --test-reporter=tap test/backoffice-b5.test.js` | 7 passed; existing installed records/archive/modules/mutex cases |
| `node --test --test-reporter=tap test/backoffice-b6.test.js` | 3 passed, both providers plus source/runtime mirror |
| `node --test --test-reporter=tap test/backoffice-controls.test.js test/backoffice-ui.test.js` | 18 passed; typed prefill, confirmation, uncertain/stale recovery and existing renderer |
| `node scripts/verify-packed-packages.js` | Final tarballs: 696 engine, 35 provider, 20 real process, 25 Linux passed; no checkout runtime imports |
| `node scripts/verify-backoffice-b6-browser.js` | Final Chrome native keyboard, both providers and independent installed Members/Notices passed |
| Same browser command under installed consumer `proof-register.mjs` | Passed again using shipped runtime only; exact cwd/environment/command in evidence |
| `WYDCLIENT_BROWSER=firefox WYDCLIENT_FIREFOX_POINTER_ONLY=1 node scripts/verify-backoffice-b6-browser.js` | Final Firefox pointer/DOM subset passed; no native-keyboard claim |
| `node scripts/verify-backoffice-b5-browser.js` | Existing Chrome records journeys and actual informational Taskboard passed; its historical custom form still uses the explicit test adapter |
| Graphical/headless Firefox native attempts and plain focus probe | Native prerequisite fails; plain probe reproduces false focus before/after Tab |
| Disposable AT server smoke on JSON/SQLite | Corrected startup, reviewed fixture, listener and quit/cleanup passed; no human evaluation |
| `verifyArtifacts` | 31 immutable client artifacts verified |
| Documentation/whitespace/version checks | 76 unique requirement IDs; only BO-REU-06 changes classification; relative targets/anchors valid; no version/lockfile/frozen-byte drift |

The final packed consumer is `/tmp/wyd-i54-packed-OHXOmh`. Browser harness files were
independently staged there; engine execution uses installed tarballs and the synchronous ESM/CommonJS import
guard rejects checkout imports. Two staged adapter-source copies are byte-comparison
witnesses only; they are never imported or served as runtime. The installed
browser run repeats both providers and both modules with real HTTP authentication,
not a fixture-only adapter. Shipped adapter/source hashes match the final checkout.

Failures remain in the record: sandbox loopback refusal and child commands without
observable test output (unqualified, never counted as passes); an early direct
renderer failure; invalid two-part fixture permission identifiers; missing trusted
asset-whitelist entry (404, corrected); independent writer using the browser's CSRF
instead of its own Session's token (403, correctly rejected); two module assertions
expecting a username that the privacy-preserving roster does not return; the human
review console retaining its own stdin on quit (corrected and smoke-tested); and
all native Firefox focus failures. Roster assertions now inspect actual public
membership output. The pointer subset's labels explicitly omit skipped native
navigation; earlier failed attempts' labels are not keyboard evidence. No correction
required weakening admission, expanding the plan limit or removing a regression.

## Conformance and residual work

**Foundation incomplete.** Final matrix: **64 in scope; 63 Implemented/verified,
1 Partial, 0 Missing, 0 Unverified; 12 deferred.** BO-REU-06 alone advances to
Implemented: reusable property/layout and content load/edit/save, dashboard refresh,
installed persistence/conflict/denial/lifecycle and production-client evidence now
cover the named bounded site contract. Wider designer/data products are not inferred.

**BO-HTTP-12 remains Partial.** A qualified human AT evaluation has not occurred,
and complete Firefox native keyboard acceptance is still blocked by genuine focus
prerequisite failure. Both must be resolved and evaluated before foundation completion.
No automated WCAG-conformance claim is made. Actual zoom, forced colors,
magnification/touch and arbitrary skins retain the stated qualification limits.

**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** The 1,000 ms deadline, indeterminate mutation
rules and conservative mutex recovery remain unchanged. Broader WydData,
AccountAdmin, HostAdmin, System, managed hosting/production deployment and release
qualification remain deferred. No production installation is migrated or modified.

## Files, versions and Git handoff

Implementation changes: trusted canonical Page metadata and browser-safe asset
allowlist; shared/source-mirrored web renderer and new controls module; existing
shell CSS; ordinary editor example; installed/browser/renderer fixtures and tests;
Firefox protocol/focus diagnostics; disposable human-review server; packed checks.
Documentation changes: this report, conformance matrix, usability/Page-contract
continuations, example guide, Unreleased changelog and machine evidence.

Existing root/Wydgine version stays **0.3.0-alpha.28** and standalone client stays
**0.1.0-alpha.11**. No existing manifest/lockfile/version, frozen distribution, tag,
release, publication or deployment change is made. Final review inspects status,
diff/stat, whitespace, artifact integrity and remote branch before committing.

As explicitly authorized, verified B6 work is committed on `develop/0.3` and pushed
without force to `origin/develop/0.3`. The final owner handoff reports the exact
commit, independently queried remote HEAD, final required-check outcomes and clean
working-tree verification. A commit cannot include its own hash; those post-commit
facts are delivered in the handoff rather than a fabricated self-referential hash
inside this report. If push/remote verification fails, that remains a handoff blocker.
