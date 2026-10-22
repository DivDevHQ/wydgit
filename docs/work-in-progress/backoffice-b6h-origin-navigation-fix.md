# B6H — Firefox guide-to-Page origin blocker

Baseline: `60f45184f63fc705b1d973a6b261b6a4505dc5a2`, clean `develop/0.3`,
independently matched to origin. Human testing reported an unavailable **Load current
state** control and a Workspace `HTTP.ORIGIN` response. Existing human observations
are retained; this correction does not mark KEY-03/KEY-04 passed or promote BO-HTTP-12.

## Reproduction and cause

Graphical Firefox 158 reproduced the actual guide link on **both JSON and SQLite**,
in a separate disposable developer installation using the real membership login.
The guide used its `127.0.0.1` origin and a named test tab. Firefox sent:

```text
GET http://json.localhost:<port>/backoffice/pages/workspace
Origin: (header absent)
Sec-Fetch-Site: cross-site
Sec-Fetch-Mode: navigate
Sec-Fetch-Dest: document
Sec-Fetch-User: ?1
Response: 403, HTTP.ORIGIN, Request origin rejected.
```

SQLite sent the equivalent request to `sqlite.localhost`. The old HTTP adapter’s
`!isShell` Fetch Metadata condition applied the API isolation rule to canonical HTML
Pages as well. It rejected the request **before authentication, Page preparation or
production control mounting**. There was no mismatched supplied Origin, incorrect
hostname binding, missing reviewed approval or production client request at this stage.
The localhost hostnames correctly isolate host-only cookies between sample Apps.

The previous browser smoke test navigated directly through the browser protocol;
that did not exercise the guide’s cross-site link. This was a qualification gap.
Firefox’s built-in JSON viewer also means an error document cannot always be parsed
by treating the entire visible body as raw JSON; the new driver handles that display.

## Bounded correction and security argument

The native transport now passes the browser’s mode, destination and activation
metadata to the existing BackOffice adapter. Only a canonical Page **GET** with
`navigate`, `document`, and `?1` may enter from a cross-site/same-site context.
The exact supplied-Origin comparison always executes first. Literal `Origin: null`
and foreign Origins still reject. The change grants no API, credential or capability
access and adds no allowed-origin list or wildcard.

Discovery and invocation never qualify for this document-navigation path. Cross-site
fetches, missing activation, subframes and mismatched Origin reject. Every mutation
still requires the exact trusted routed Origin and the existing session/App/action
CSRF token. Authentication, independent approved Page entry, active placement,
installation lifetime, read-only preparation bindings, DEC-01 invocation checks,
DEC-02 capability/resource maxima and service authorization are unchanged. Browser
same-origin/CORS and frame protections remain unchanged. An anonymous link receives
401; a member without Page permission receives PAGE.DENIED after origin admission.

This follows the distinction between top-level activated navigation and resource/API
fetches in the [W3C Fetch Metadata specification](https://www.w3.org/TR/fetch-metadata/).
A nonbrowser client can supply metadata headers, just as it can supply Origin; these
headers never substitute for authentication, CSRF or installed authorization.

Origin rejections now emit only a fixed code and one of three fixed reasons through
the existing trusted diagnostic hook: `origin-mismatch`, `fetch-site`, or
`invocation-origin`. No request, cookie, CSRF value or session token is logged there.
B6H preserves the reason in its existing private technical evidence and export.
The developer browser driver separately captures only the affected method, URL,
Origin, Fetch Metadata and response status; it never dumps headers or credentials.

## Verification and guide correction

`test/backoffice-human.test.js` exercises the real HTTP transport on both providers:
activated Page navigation, cross-site/same-site API rejection, foreign/null Origin,
iframe/cors/missing-activation rejection, missing authentication, invalid CSRF,
independent Page denial and real bound load/save. Running the new regression against
the original adapter failed at the newly covered navigation; restoring the correction
passed. Existing binding/resource/security regressions remain intact.

Run the actual Firefox link regression with:

```sh
WYDCLIENT_HEADFUL=1 WYDCLIENT_FIREFOX_FOCUS_TESTMODE=0 node scripts/verify-backoffice-human-navigation.js
```

It clicks the actual guide anchors into the named sample tab, signs in normally,
asserts the production **Load current state** button, loads, edits ordinary/layout/
Markdown properties, confirms and saves through production Page bindings, reloads
and verifies persistence on both providers. It also verifies that a browser cross-origin fetch remains unreadable (the guide
CSP blocks it before HTTP), then separately probes the server with a foreign Origin
and confirms its rejection diagnostic. The trace distinguishes Firefox requests
from that HTTP security probe. No response interception or
B5 test-only adapter is used. This is developer pointer/DOM verification, **not**
human keyboard/Orca acceptance. The separate automation profile is removed afterward;
the human profile and App data are preserved.

The guide now names the enclosing **Load Workspace properties and content** heading,
explains that editing fields start disabled, and instructs the tester to record a
blocker if the load button is absent or an HTTP error replaces the Page. KEY-04
explicitly calls for loading again after reopening/reloading. Test identifiers and
previous recorded results stay unchanged.

Raw before/after Firefox traces, red/green regression logs and final required checks
are retained locally under `.backoffice-human/developer-verification/origin-fix/`.
Original human evidence has an additional private `origin-blocker-before-fix/`
snapshot inside its own evidence directory. Final check counts are recorded in the
commit/handoff after the required checks run; no outcome is predicted here.

## Resume the interrupted human session

The blocked server is stopped safely; **cleanup is not run on the human session**.
Its installed Apps, reviewed approvals, Firefox profile, saved results and failure
notes remain in place. Start with `npm run backoffice:human-test`; use the newly
printed guide URL, since ports change on restart. In **Results and export**, select
JSON **KEY-03** and repeat it, then KEY-04. Confirm that **Load current state** is
available and that editing becomes enabled after it succeeds. Save the actual new
observations; earlier failures remain in the attempt history. Do not assume a pass
from this developer correction. Use the provider switch to repeat the affected
SQLite workflow. Leave the original failed observations intact.

BO-HTTP-12 remains Partial. Native Firefox keyboard and human AT qualification still
require human review. HTTP-LIMIT remains OPEN; the 1000 ms deadline, 64 KiB review-plan
limit, versions and frozen standalone client artifacts are unchanged. No release,
tag, publication or deployment is performed.
