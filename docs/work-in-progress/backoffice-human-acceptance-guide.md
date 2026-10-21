# BackOffice B6H — human acceptance guide

Start from this checkout on `develop/0.3`:

```sh
npm run backoffice:human-test
```

Wait for “BackOffice human test is ready.” A separate Firefox window opens with
**Let’s try BackOffice together**. If it does not, run
`npm run backoffice:human-test -- firefox`. The terminal also prints a clickable
`http://127.0.0.1:<port>/` guide URL. This address changes on restart; use the
newly printed address. The Firefox command always selects the disposable profile.

Start with **Firefox and your keyboard**, then use **Open focus check**. Read the
small set of instructions, try them in the test tab, and return with Ctrl+PageUp.
Choose **Pass**, **Fail**, or **Couldn’t Test**, add any notes, and select
**Save and Next Test**. Use **Save and stay** before taking a break. Saved answers
and installed sample edits survive shutdown and restart; the guide resumes at the
last saved position for the selected provider. Unsaved notes are not autosaved.
**Results and export** lets you revisit any test. Switching provider starts/resumes
that provider’s separate sequence; JSON and SQLite results never overwrite one another.

Orca **46.1** was available on the qualification machine (Linux Mint 22.2 Cinnamon,
Firefox 158.0). No installation was needed there; availability and versions are
checked again at each launch. Presence does not establish working speech. The guide
includes a separate speech readiness check before formal screen-reader tests.
If Orca is missing on Linux Mint, the launcher explains that you can approve and run
`sudo apt install orca`. It never installs a system package or invokes sudo itself.
Start speech by running `orca` in a spare terminal and keep it open. Exit with
Ctrl+C in that terminal or a working desktop toggle. The installed Orca 46.1 help
does not offer a `--quit` option, so the guide does not depend on it.

## Everyday commands

| Action | Command or control |
| --- | --- |
| Start or resume | `npm run backoffice:human-test` |
| Reopen the isolated Firefox window | `npm run backoffice:human-test -- firefox` |
| Start without opening a browser | `npm run backoffice:human-test -- --no-browser` |
| Save an answer | **Save and Next Test** or **Save and stay** |
| Export readable and machine reports | `npm run backoffice:human-test -- export` |
| Download the machine report | Guide → **Results and export** → **Export report** |
| Stop servers and their Firefox child safely | Ctrl+C in the launcher terminal, or `npm run backoffice:human-test -- stop` |
| Remove disposable runtime after stopping | `npm run backoffice:human-test -- cleanup` |

Export prints the exact paths to `report.md` and `report.json`. Inspect notes before
sharing: automatic removal of recognizable email addresses, local paths, URLs,
credential labels and long opaque strings is useful but cannot identify every
personal detail in free text. Export does not include browser profiles, credential
stores, cookies, tokens or screenshots. Do not share the entire private session tree.
Cleanup keeps **all evidence**, including failed attempts and existing exports.
Starting after cleanup creates a new session; older reports remain in their own
evidence directories. Cleanup can be repeated safely.

Node 24.21.0 or newer and the repository’s installed dependencies are prerequisites.
If dependencies are missing, run `npm ci` once; no database/configuration work is
needed. Firefox can be installed using Linux Mint Software Manager if unavailable.
The guide can still start for recording an environmental blocker when Firefox or
Orca is missing. A graphical desktop is required for manual native keyboard tests.

## What is installed, and why it is safe

Private resources live below the Git-ignored `.backoffice-human/` directory:

```text
.backoffice-human/
  owner.json                  disposable-root marker
  current.json                latest session identifier
  running.json                live owner, addresses and private per-launch token
  sessions/<session-id>/
    evidence/
      metadata.json           commit, OS/tool versions, installed approvals/providers
      events.jsonl            durable append-only observations and technical events
      report.md               readable, sanitized export
      report.json             sanitized report including every recorded attempt
    runtime/
      owner.json              exact session ownership marker
      apps/json/              installed JSON Workspace, Gate and Store data
      apps/sqlite/            installed SQLite Workspace and databases
      apps/modules/           installed Members/Notices, Gate and JSON Store data
      firefox/                disposable Firefox profile
```

The terminal names the session directory, evidence directory, server PID and exact
URLs. Databases are confined to the listed App roots; their `wydgit.config.json`
files name each provider directory. The launcher creates three Apps and four HTTP
listeners, all bound explicitly to **127.0.0.1**. The guide uses 127.0.0.1 and the
Apps use `json.localhost`, `sqlite.localhost` and `modules.localhost`; Firefox’s
localhost resolution reaches the loopback listeners without DNS/hosts-file setup.
Distinct hostnames isolate host-only authentication cookies, which do not otherwise
isolate by port. No LAN binding, certificate, reverse proxy or production service
is involved. Browser proxy/security preferences are not overridden.

The existing B6 fixtures install the ordinary BackOffice editors, membership login,
and Members/Notices applications. They use real package installation and stopped-App
`planPackagePolicy` → `approvePackagePolicy` → `applyPackagePolicy` with explicit
Page proposals and native expansion review. Only these exclusively created disposable
App roots receive the fixture operator’s authority. A marker or guide answer never
grants runtime authority. Before reopening providers on resume, the launcher checks
the original disposable host-configuration hash and confines provider roots to the
same canonical App directory. Startup validates current complete adoption; it does not
repair, refresh or bypass approvals. The Workspace review plan remains below 64 KiB.

The sample account is `alice` with the disposable credential shown in the guide;
no normal account is used. Sample record values are deterministic. Internal receipt,
account, session and approval identifiers remain generated by the real services.
The browser signs in through the actual installed membership form; the guide never
creates an authentication cookie. Actual Page interactions use the production
`wydclient/backoffice-controls.js` adapter and server-published reviewed Page
bindings. B5’s test-only binding adapter is neither mounted nor used as evidence.
Page entry, live Gate permissions, SEAM, owned resources and invocation-time binding
checks remain independent. The 1000 ms HTTP deadline and review-plan ceiling remain
unchanged. `WYDGINE-0.3-HTTP-LIMIT` stays OPEN: after an indeterminate write, load
current state; do not assume rollback or retry automatically.

The guide is a separate native HTML form interface. It remains available when the
App is denied or its JavaScript fails; result recording does not use BackOffice.
Every answer is validated, appended and synced before navigation. Later answers
change the latest summary but preserve earlier failures. Repeat attempts retain the
same test ID, provider, time and browser. Unanswered and Couldn’t Test are distinct.
No developer action is translated into a human pass.

Only narrowly defined sample permission controls are exposed by the guide: deny
sample writes, deny sample Page entry, and restore the sample’s original permissions.
They call the actual Gate API for the fixed disposable account and selected provider.
They cannot edit receipts, expand capability approval or select another account/root.
The guide validates Host, exact unsafe Origin, a per-launch CSRF token, bounded body
and closed action choices. It serves no arbitrary filesystem path. Its stop/open
controls act on the launcher’s own resources; the stop command never signals a PID
read from disk. Runtime cleanup refuses a running owner, an unrecognized marker or
a symlink substituted for its root. Descendant symlinks are removed, not followed.
No production installation, real account, firewall, SELinux state or global Firefox
preference is changed. Closing the launcher closes its own disposable Firefox child.

## Firefox focus investigation

The first test opens an independent plain document with a labelled field, button
and link. It loads no BackOffice code. Use real Ctrl+L, Escape, Tab, Shift+Tab,
Enter and Space; do not click into the document to qualify initial focus. If blocked,
try F6 as an explicitly recorded diagnostic workaround, then compare Workspace.
A pointer may be used to return and record a blocker; it does not pass keyboard testing.

The probe passively records `document.hasFocus()`, document visibility, active element
**tag only**, focus/blur/visibility transitions and selected trusted navigation key
events. It never calls focus(), dispatches keyboard events, logs typed characters,
reads browser history or instruments the production Page. Native product-focus
findings belong in the human’s notes, alongside the probe timeline. A client-supplied
trusted-event flag is supporting diagnostic data, not independent proof of a human test.
Browser name/version is parsed from the requesting browser; installed Firefox/Orca,
OS/kernel, desktop, session type, Node, repository commit and dirty flag are collected
without hostname, username, display address or arbitrary environment dumps.

Record “not reproduced manually” if appropriate. That observation does **not** erase
B6’s failed automation prerequisite or automatically qualify the complete Firefox
journey. The [B6 investigation](backoffice-b6-foundation-completion.md#firefox-native-keyboard-investigation)
and its automated focus scripts remain unchanged and unresolved.

## Orca on Cinnamon

Read-only checks inspect Cinnamon’s screen-reader shortcut and standard window/media
bindings that might intercept the guide’s Orca shortcuts. On the observed machine,
Cinnamon reports `Alt+Super+S`. Unknown settings or custom shortcuts still require
human confirmation; the launcher never rewrites them. Start with the terminal
`orca` command if a toggle is missing/conflicting, then confirm speech on the guide.
If speech fails, check output device, volume and Cinnamon Accessibility settings;
record an environmental blocker and leave formal AT cases incomplete.

The guide uses supported Orca commands: H/Shift+H for headings, M/Shift+M for
landmarks, Tab/Shift+Tab for controls, modifier+A for browse/focus mode, modifier+H
for Learn Mode (Escape exits), and modifier+Space for preferences. Desktop modifier
is Insert/keypad Insert; Laptop modifier is CapsLock. Check the configured layout
rather than assuming it. The table test offers Alt+Shift+arrow keys when a native
table exists. Shortcuts and behavior are based on the official
[Orca structural navigation](https://help.gnome.org/orca/commands_structural_navigation.html),
[forms](https://help.gnome.org/orca/howto_forms.html),
[table navigation](https://help.gnome.org/orca/commands_table.html), and
[Orca control](https://help.gnome.org/orca/commands_controlling_orca.html) documentation.
Only the tester can confirm what was spoken; executable presence, DOM roles and
accessibility-tree output do not establish announcements.

## Acceptance mapping and limits

The actual [BO-HTTP-12 matrix row](backoffice-conformance-matrix.md) requires browser/
accessibility qualification of the renderer’s promised interactions. The
[B5 promotion criterion](backoffice-b5-foundation-qualification.md#initial-gaps-and-qualification-plan)
requires the full Firefox keyboard journey and outstanding human AT evaluation.
Use the existing [HTTP/UI acceptance specification](../backoffice-http-and-ui.md),
[usability specification](../backoffice-ui-usability.md) and
[human checklist](../backoffice-browser-qualification.md#human-review-checklist--not-yet-performed)
as the governing scope. The guide records observations against BO-HTTP-12:

| Cases | Acceptance observations |
| --- | --- |
| ENV-01, KEY-01–02 | Native initial document focus, approved entry, skip link, Tab/Shift+Tab, visible order/focus, Enter |
| KEY-03–07 | Space, forms, ordinary/layout/Markdown editors, validation, announcements, dashboard, reload/persistence, previous Page and update focus |
| KEY-08–09 | Independent action/Page denials, no denied persistence, focused recovery |
| KEY-10 | Dialog focus/trapping/return **only if a product dialog exists**; default fixture has none |
| KEY-11 | Installed Members/Notices, optional fields, nested arrays, add/remove focus, empty results, native Firefox navigation |
| AT-00–02 | Speech readiness, headings/landmarks, accessible names, labels/descriptions, required fields and bounds |
| AT-03–06 | Actual error/success/denial speech, reusable editor/dashboard/table comprehension, optional and nested array controls |
| AT-07 | Session loss, discovery failure and actual speech; natural timed expiry is separately identified |
| VIEW-01, TOUCH-01 | Actual 200%/400% zoom, theme, magnification/high contrast and real touch limitations |
| REVIEW-01 | Reproduction steps, environmental blockers, qualified review and remaining work |

The readable report separates latest passes/failures/incomplete cases, all attempts,
notes, focus findings, screen-reader findings, reported product defects and blockers.
A reported defect is the tester’s classification, not an automated diagnosis.
The reviewer must examine partial observations within a case, qualifications, and
settings/hardware not actually tested. In particular, logout is not timed expiry;
AT-07 asks explicitly whether natural expiry after at least an hour was observed.
No clock is changed. No product modal is introduced just to test a dialog; record
Couldn’t Test with “No product dialog in scope” and let the reviewer judge applicability.

**BO-HTTP-12 remains Partial.** There is no automatic promotion, foundation-complete
declaration or WCAG claim, even if every result is Pass. B6 explicitly requires a
**qualified human** for AT evaluation. The governing B5/B6 protocol does not add a
separate independent-evaluator mandate; the owner/reviewer must determine whether
the tester’s qualifications and evidence meet the acceptance standard. This tool
neither establishes qualifications nor replaces independent evaluation where needed.
Human speech, actual zoom, high contrast, magnification, touch, complete Firefox
keyboard qualification and timed expiry remain unverified until actually observed.

## Interrupted sessions and conservative recovery

Normal stop/resume needs no recovery. Ctrl+C during first installation waits for
the current provisioning step to finish, then closes resources. Because that
installation is incomplete, use cleanup before starting it again; no answers could
have been recorded before readiness. An existing `running.json` blocks a second
launcher and cleanup. If startup fails, its diagnostic and incomplete session evidence
are preserved; stop any surviving launcher, export, then use cleanup and start again.

If the launcher was forcibly killed, do not signal a stored PID or delete an App
mutex. First establish that the launcher and its exact disposable Firefox profile
are stopped; PID reuse and ambiguous ownership must be treated conservatively.
Preserve the evidence. A developer can inspect the private `running.json` and its
session, remove **only that stale launcher ownership file after proving quiescence**,
and use the normal cleanup command. This is an exceptional manual recovery, not an
automatic force-unlock feature. B5’s [stopped-host recovery rules](backoffice-b5-foundation-qualification.md#lifecycle-and-admission-mutex-diagnostics)
still govern any App mutex or policy journal; no stale approval is silently renewed.

## Developer verification (not human acceptance)

`test/backoffice-human.test.js` checks guide semantics/escaping, append-only outcomes,
redaction, symlink refusal, loopback binding, reviewed installation, both-provider
production binding saves, live denials, no denied overwrite, independent Page denial,
restart/persistence, interruption during provisioning, export and runtime-only cleanup. Its results are explicitly
marked `developer-simulation` and do not enter the owner’s acceptance session.

Run `node scripts/verify-backoffice-human-browser.js` for a disposable Chrome
rendering/recording and actual membership/production-controls smoke test. It retains
screenshots and evidence in the printed `/tmp/wyd-b6h-browser-developer-*` directory;
it closes browsers/servers and removes only runtime. This script deliberately
records one developer failure to verify honest export. Add `--firefox` for an explicitly
labelled Firefox pointer/DOM smoke test, which uses a separate automation profile.
It performs no human Orca
or native Firefox acceptance. Failed developer runs remain in their log/artifact
paths. Required repository checks remain `npm test` and `npm run check`; focused
BackOffice authorization/adoption/body/deadline/security regressions remain intact.

The B6H qualification record is
[test-support/backoffice-b6h-evidence-2026-10-21.json](../../test-support/backoffice-b6h-evidence-2026-10-21.json).
No version metadata, frozen client artifact, approval contract or release process changes.
