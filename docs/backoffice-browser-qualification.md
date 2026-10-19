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
