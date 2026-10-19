# BackOffice browser qualification — alpha.22

Run `node scripts/verify-backoffice-browser.js` from the checkout on Node 24.21.0.
The script uses the installed `google-chrome` executable (override with
`WYDCLIENT_CHROME`), Chrome DevTools Protocol and Node's built-in WebSocket client.
It adds no browser automation dependency or downloaded executable. Chrome runs
headless in a fresh disposable profile; all App, Gate and Store data are temporary,
with generated test passwords and explicit fixture-only membership/SEAM grants.
The HTTP listener and debugging endpoint bind loopback. The everyday browser
profile, live accounts and production infrastructure are never used.

Tooling observed: **Google Chrome 155.0.8059.84**, Node **24.21.0** on Linux.
Firefox **158.0** is installed but has not been qualified by this harness.

## Workflow evidence

The real installed membership package handles native browser form login and logout.
The generic shell discovers the independently installed member-roster action,
selects its category/action, includes a bounded limit, invokes the real Gate service
and renders two disposable memberships. Native Enter events activate navigation
and submit the action. Credentials remain HttpOnly and unavailable to page script.
Refresh clears selection, permission revocation rejects an already selected action,
and logout makes authenticated discovery return 401. A second valid account with
no administrative permission opens the shell but discovers zero actions.
No network interception or replacement roster response is used.

The harness queries Chrome's accessibility tree for landmarks and table semantics,
checks one main heading, accessible control names and status announcements, and
measures browser-resolved skin-token text contrast in light, dark and system modes.
This is supporting automated evidence, **not WCAG certification**. Actual screen
reader announcements, speech order and usability with human assistive technology
remain manual work. No axe dependency or full automated accessibility ruleset is
claimed.

## Corrections and limits

Action selection focuses its heading; successful results focus their heading.
Stale/authorization errors restore focus to Refresh after controls unlock. Loading
exposes `aria-busy`; failures use an alert role; normal progress uses status.
Scrollable result tables have named regions and visible keyboard focus, using
native table/caption/column-header semantics. The existing skip link, header,
main, navigation, fieldsets, labels and skin/theme convention are retained.
No new visual system, contributed HTML or arbitrary JSON Schema interpreter is added.

Responsive probes use 360×800, 768×1024, 1280×900 and 1920×1080 viewports, plus
320 CSS pixels for reflow. They measure document/main/navigation widths, and check
that wide roster tables scroll inside the result region without page-wide overflow.
320 CSS-pixel testing supports reflow assessment; it is not an OS/browser zoom or
mobile-device certification. Theme controls select explicit light/dark and system
appearance with emulated system preferences. Reduced-motion preference is enabled;
this shell adds no motion. Human keyboard, magnification, screen reader and real
mobile touch checks remain necessary before broader accessibility claims.

The script retains five small meaningful screenshots and sanitized JSON measurements
under the printed `/tmp/wyd-backoffice-browser-*` directory: desktop light/dark,
mobile, member roster, and access error. Profiles, passwords and authoritative
fixture data are removed on cleanup; screenshots contain only disposable test data.
Temporary evidence paths are local artifacts, not a durable retention guarantee.
Final observed paths and counts are recorded in the increment handoff.

ADM-01 remains **partial**: this qualifies the site-level generic action journey in
one desktop browser engine. AccountAdmin, HostAdmin, native policy review, managed
hosting, full administrative coverage, proxy/TLS deployment and human assistive
technology qualification remain outside this increment. Read with
[HTTP/UI contracts](backoffice-http-and-ui.md) and [reliability](milestones/0.3-reliability.md).

The rendered audit found that the existing skin made `table` itself a block scroll
container. This bypassed the named, keyboard-focusable wrapper. Shell CSS now
restores native table display and lets the wrapper own horizontal scrolling. The
browser asserts actual ArrowRight scrolling in that region at 360 pixels, not just
the presence of an overflow rule. Text color pairs measured at least **4.75:1** in
light mode and **8.30:1** in dark mode across the inspected shell tokens; input
borders also pass the harness's **3:1** token contrast check. These limited pairs
do not establish whole-page WCAG conformance, especially across arbitrary skins.

The first browser attempt failed while waiting for login completion. Navigation
now awaits complete document load and clicks await two animation frames before
measuring targets. Subsequent complete workflows passed. Intermediate responsive
assertions exposed the nested scrolling issue above; those failures were retained
in local `/tmp/alpha22-browser*.log` logs, corrected and rerun. The focused HTTP/UI
suite after focus changes passed **33/33**; final checkpoint totals appear in the
handoff. Screenshots were visually inspected for mobile layout and the actual
roster result as well as desktop appearance.

Checkpoint result: full `npm test` **1490/1490**, focused HTTP/UI **33/33**,
`npm run check` and whitespace checks passed. Final Chrome evidence:
`/tmp/wyd-backoffice-browser-YTFDpz/result.json` and its five PNGs. The actual
Tab/Enter journey, ArrowRight result scrolling, both system color preferences and
all measured viewports passed. Screenshot review includes the actual roster table;
no credentials or session tokens are stored in the evidence.

## Two-module and array workflow

The final harness installs both the member roster and
[operational notices](../examples/backoffice-notices/README.md), with explicit
independent receipt approvals and user permissions in a disposable App. It verifies
two navigation categories, invokes Gate's roster, then uses native keyboard/mouse
interaction to add two nested sort-object items, observe the array maximum,
remove an item, and query real package-owned notice records through WydStore.
Revoking only roster permission leaves notices discoverable. Login/logout and the
valid unprivileged member checks remain in the same genuine browser journey.
The fixture performs no live package cutover; removal/reinstall independence and
site isolation are separately exercised in BOMOD-01/02 on JSON and SQLite.

Final two-module Chrome artifact directory from the completed qualification run:
`/tmp/wyd-backoffice-browser-OHlygc`. The generic shell source was unchanged when
the second package was added. No false native package inventory or privilege bridge
was introduced. UI renderers also passed the bounded deterministic tests described
in [usability](backoffice-ui-usability.md).

Completion rerun including refresh-focus preservation passed at
`/tmp/wyd-backoffice-browser-YNmZsT`. The final source's installed tarball integration
also passed **222/222**, including UI and module tests; provider/process/Linux
sets passed **35/35**, **20/20**, **25/25**. The combined repository suite passed
**1500/1500 twice** before the final documentation-only required rerun.

## Alpha.23 Firefox and accessibility continuation

The shared journey now supports the installed Firefox through a test-only
[WebDriver BiDi connection](https://developer.mozilla.org/en-US/docs/Web/WebDriver/How_to/Create_BiDi_connection).
No geckodriver, automation dependency or browser download is required. Use:

```sh
WYDCLIENT_BROWSER=firefox WYDCLIENT_FIREFOX_POINTER_ONLY=1 node scripts/verify-backoffice-browser.js
node scripts/verify-backoffice-browser.js
```

Firefox **158.0** passed the explicitly labelled pointer/DOM subset at
`/tmp/wyd-backoffice-browser-Z2aj9R`; Chrome **155.0.8059.84** passed the native
keyboard/accessibility-tree journey at `/tmp/wyd-backoffice-browser-5fl15C`.
Both process exits, including disposable profile cleanup, were successful. Five
screenshots and sanitized `result.json` measurements are retained per run. Firefox
mobile/roster and Chrome dark screenshots were visually inspected.

Firefox exercised real Gate form login, cookies unavailable to page script, shell
and discovery, both installed action modules, actual roster and notices, nested
array add/remove/max, light/dark/system appearance, refresh focus restoration,
permission denial and rediscovery, logout, unprivileged membership and controlled
session expiry. Widths 320/360/768/1280/1920 retain local table scrolling and no
page-wide overflow. Firefox uses native pointer/wheel and text entry; DOM focus
and semantic/label checks are supporting evidence. It does **not** qualify native
Tab/Enter/Arrow navigation or a Firefox accessibility tree. The headless window
reported `document.hasFocus() === false` despite activation and Mozilla's
[automation focus preference](https://firefox-source-docs.mozilla.org/python/marionette_driver.html),
confined to the disposable profile. Without the explicit pointer-only option the
harness still fails its keyboard prerequisite; it does not silently skip it.
System preference was observed, not emulated, in Firefox. Chrome retains both
emulated system schemes, reduced-motion preference and native table keyboard scroll.

Two demonstrated defects were corrected:

- Firefox supplied `Origin: null` on JSON POSTs from the `no-referrer` shell and
  the trusted hostname boundary rejected them with 400. Successful shell documents
  now use **Referrer-Policy: same-origin**. Protected API responses retain
  `no-referrer`. Foreign/null Origin is still rejected; CSRF, CSP and cookie checks
  are unchanged. Before/after real Firefox evidence is 400/null → 200/exact origin,
  and permission-revoked invocation still returns 403. Header regressions failed
  against the old implementation on JSON and SQLite before correction.
- Discovery/session-expiry errors used a polite status rather than an alert.
  They now use `role=alert` and `aria-live=assertive`, like invocation errors. The
  BOUI-06 regression failed before correction; Firefox now observes the alert on
  actual expired-session discovery. This is DOM semantics, not proof of speech.

Initial harness-only failures (required profile directory, BiDi expression syntax,
headless focus prerequisite) are retained in `/tmp/alpha23-firefox*.log`. A Chrome
journey initially passed its assertions but failed profile removal with ENOTEMPTY;
profile removal now has a bounded five-retry cleanup before fixture-root removal.
No product browser-specific layout hack, framework, raw contributed HTML or new
BackOffice functionality was introduced.

### Human review checklist — NOT YET PERFORMED

Use a disposable App with both documented modules and generated test accounts;
record browser/OS, assistive technology/version, viewport/zoom, result and issue IDs.
These unchecked steps are future work, not automated certification:

- [ ] In a focused graphical Firefox window, use only Tab/Shift-Tab/Enter/Space to
  log in, use the skip link, choose both modules and invoke each read action.
- [ ] With NVDA/Firefox or another supported human screen-reader combination,
  verify heading/landmark order, accessible names and focus visibility/order.
- [ ] Confirm optional Include, required bounds, nested fieldsets and array item
  names/counts are understandable; add/remove items and verify focus restoration.
- [ ] Submit invalid integers/required text; hear the error once, reach its field
  and read the linked error/bounds without losing entered values.
- [ ] Hear loading, success, empty result, discovery failure and session expiry;
  verify alerts do not duplicate speech or interrupt unrelated input unnecessarily.
- [ ] Navigate the real result table by row/column, hear captions/headers and scroll
  the named result region with a keyboard; verify focus escapes normally.
- [ ] Refresh, revoke permissions through the separate trusted fixture operator,
  invoke a stale selection and log out; verify clear recovery and no action replay.
- [ ] At actual 200% and 400% browser zoom, inspect reflow, clipped content, controls,
  scroll regions, focus indicators and browser text scaling; repeat at 320 CSS px.
- [ ] Check light/dark/system and OS high-contrast/forced-colors with magnification;
  inspect all states, error indicators and focus boundaries beyond measured tokens.
- [ ] On real touch hardware, verify target size, scrolling, nested forms and
  orientation changes. Record remaining usability defects independently of WCAG claims.

No human screen-reader, actual zoom, forced-colors or touch qualification, full WCAG
conformance, complete ADM-01, proxy/TLS deployment or privileged hosting claim follows.
