# BackOffice HTTP transport and modular shell — 0.3-J increment 6

**B3 architecture ratification (2026-10-21):** the Project owner approved
[DEC-01 Page entry/bindings and DEC-02 action resource maxima](backoffice-page-and-action-contracts.md).
B3 adds read-only preflight/contract validation only. Historical implementation
checkpoints below retain their dates; production action dispatch remains receipt-wide
until reviewed migration and the later enforcing increment. No new Page HTTP entry
or caller/resource authority is activated by this ratification.

Implemented in platform/Wydgine/WydHosting **0.3.0-alpha.21**, from clean
`develop/0.3` at `25b7b8716b06aaeaa496c6edfe91869360634aae`.
Gate stays **0.1.0-alpha.6**, Store **0.1.0-alpha.5**, standalone WydClient
**0.1.0-alpha.11**. No new dependency, persisted schema, WBasic/SEWN protocol,
accepted package resource or historical generated artifact changes.

Read with the [action framework](backoffice-action-framework.md),
[site policy](backoffice-scoped-policy-and-store-authorization.md),
[placement lifecycle](backoffice-placement-lifecycle.md),
[HTTP transport](http-transport.md), [membership](wydgate-membership.md) and
[reviewed native policy](reviewed-package-policy-reconciliation.md).

## Routes and admission

| Route | Contract |
| --- | --- |
| `GET /backoffice` (also `/backoffice/`) | Authenticated HTML shell with site title/canonical App, navigation and scoped CSRF metadata; no action execution |
| `GET /backoffice/api/actions?offset=0&limit=10` | Existing discovery envelope plus top-level `csrf`; decimal offset 0–256, limit 1–10; unknown/repeated query keys reject |
| `POST /backoffice/api/actions/invoke` | JSON `{reference,input,confirmed?}` only; exact discovery reference; returns existing `{ok:true,value}` or sanitized failure |
| `GET /runtime/wydclient/backoffice.js` | Public, explicitly allowlisted trusted web presentation adapter; no server modules |
| `GET /backoffice/assets/shell.css` | Public platform layout, responsive rules and theme tokens |

Protected routes accept only the listed method; HEAD causes no invocation and has
no body. There is no generic RPC/export/path/service selector, credential endpoint,
host-policy bridge, AccountAdmin or HostAdmin. Static CSS/JS contains no private
metadata. Unknown BackOffice paths return 404. Existing public Pages and transfers
continue through their original pipeline.

Hono owns native HTTP; only bounded transport data crosses into the trusted
BackOffice adapter. The adapter calls **`createBackOfficeActions.discover/invoke`**.
It maintains no parallel registry, policy evaluator or dispatcher. Wydgine privately
constructs the native exact-App acquisition context required by that existing
factory. Its only capabilities are lifecycle/placement acquisition; it has no
object edit, policy-review or relocation capability. It never becomes an action's
caller, and no lifecycle operation is exposed through the adapter. Installed action
execution still receives only independently approved receipt grants and the
session's genuine initiating identity. No Gate user/package gains authority at boot.

## Authentication and credentials

The same site WydGate session and `createSessionResolver` authenticate public
membership forms and BackOffice. Native session resolution binds only
`gate.sessions.use` to this canonical App when no explicit legacy host session
binding is supplied. There is no new identity directory, password form, session
store, role bootstrap, elevated account or bearer-token login.

Only the existing reserved auth cookie authenticates HTTP. HTTPS routes use
`__Host-wydgit-auth`, `Secure; HttpOnly; SameSite=Lax; Path=/`, without Domain.
Explicit local HTTP routes use `wydgit-auth`, HttpOnly/SameSite/Path as above,
without Secure. Existing Gate login rotation, absolute/idle expiry, Max-Age and
logout deletion remain authoritative. BackOffice issues no new session credential;
invalid sessions receive the existing matching cookie deletion. Browser code uses
`credentials:'same-origin'`, `mode:'same-origin'`, no-store and `redirect:'error'`.
Passwords/tokens never enter URLs, HTML, discovery, results or diagnostics.

Authorization headers, duplicate cookies and simultaneous alternate-scheme auth
cookies reject. Body/query principal, site, session, context and service fields
reject. A public anonymous Session cookie alongside the auth cookie is normal and
does not supply a second authentication principal. Any authenticated site member
may open the shell; members with no authorized actions see an empty state, not
implied administrator authority. Discovery/invocation recheck current Gate policy,
SEAM, exact resource ownership and installation lifetime. Invalid/expired/revoked
sessions reject; a visible action grants no future admission.

## Origin, CSRF and standalone hosting

Use the existing trusted hostname routing boundary for HTTPS/proxy operation.
It selects the canonical App before credentials and validates exact effective
Origin, proxy peer and forwarded authority. No wildcard CORS or credential forwarding
is added. Protected GET rejects a supplied foreign Origin; APIs also reject
cross-site/same-site Fetch Metadata. POST additionally requires exact Origin and
`X-Wydgit-CSRF`. The CSRF token is the existing session-secret-derived HMAC binding
for this App and the BackOffice invocation operation. It is returned in shell meta
and authenticated discovery, never in URLs. It is not a session credential, package
grant or native approval. A foreign site's token cannot authorize this site.

The historical standalone entry point lacks a trusted hostname/origin binding.
BackOffice returns 503 there. A small **explicit native local-host option** enables
private browser development:

```js
const app = await createHostApp({root: appRoot, localHostname: 'localhost'});
const server = app.listen(3100, '127.0.0.1');
```

This uses the existing `validateRouting`/`resolveRoute` local-HTTP rules for all
requests, including login/logout transfers. It admits only loopback peers, the
configured local-development hostname, valid native Host/request targets and exact
Origin for unsafe methods. Forwarded headers reject. This fixes the browser-local
cookie/origin binding explicitly; legacy unconfigured standalone behavior remains
compatible. Never use this option for public proxy deployment; use existing trusted
routing. Give separate Apps different hostnames, including in local development:
cookies are host scoped, not TCP-port scoped. Parking routes have no BackOffice.

## Bounds and errors

Existing host header byte/count limits, HTTP request deadline, App admission/drain,
response metering and configured reductions still apply. Invocation accepts only
UTF-8 `application/json` (optional UTF-8 charset), uncompressed/identity encoding.
The collector limits raw bytes to **48,000**, enforces fatal UTF-8 decoding and a
body deadline of min(15 seconds, configured HTTP request deadline), then parses JSON.
The JSON envelope is bounded to depth 12 / 2,048 nodes before copying/access.
Prototype-pollution keys, unknown fields, malformed JSON, invalid references and
contract mismatches fail closed. The existing framework's 48 KiB outer request and
reducible service limits apply independently, including server-added App/session.

Discovery is ten actions/page, at most 256 actions/site and 64 KiB/native discovery.
HTTP adds only a small CSRF/envelope allowance: **66,560 bytes**, depth 24 / 10,000
nodes maximum; service results retain their stricter existing limits. The client
also bounds streamed response collection to 66,560 bytes and validates supported
result contracts before constructing DOM. No external CDN/framework is required.

| Status | Meaning |
| --- | --- |
| 200 | Authenticated shell, authorized discovery/result |
| 400 | Malformed/ambiguous request, invalid input/contract, missing confirmation |
| 401 | Missing, expired, revoked or foreign-site session |
| 403 | CSRF, API Origin/Fetch Metadata or current action authorization denial |
| 404 / 405 | Unknown route / unsupported method (Allow supplied) |
| 409 | Stale reference or Store revision conflict |
| 413 / 415 | Body/resource bound / unsupported media or encoding |
| 503 | Trusted-origin/Gate unavailable, action execution budget exhausted or service failure |

The outer native routing boundary rejects invalid Host/proxy/unsafe Origin with its
existing controlled 400, before action admission. Host quota/drain rejection retains
its existing response/disconnect behavior. Adapter failures contain only
`{ok:false,code,message,details:{}}`; no exceptions, stack traces, native paths or
request content. Unknown service failures receive a generic denial. Protected
responses use no-store, no-referrer and same-origin resource policy. Existing CSP
remains `script-src 'self'`, `style-src 'self'` with no inline executable script,
base URL, framing or foreign connection permission.

The HTTP deadline is checked around awaited operations; existing action SEWN
service-call/time reductions remain unchanged. Admitted native work is awaited,
not abandoned on a Promise timeout. Deadline/cancellation cannot undo a committed
side effect. Cooperative deadlines are not preemptive native-process containment.

## Shell, forms and results

The platform server renders a responsive shell: BackOffice header, current site,
appearance selector, refresh control, navigation and main content. The trusted
WydClient web adapter in `wydclient/backoffice.js` is mirrored in Wydgine's packaged
runtime, like the existing web adapters. The independent `@wydgit/client` package
and immutable historical bundles are unchanged. No portable Wydgit receives DOM
access or a general network API.

Discovery supplies all navigation. The client fetches pages of up to ten authorized
actions and groups them by category. Package/service/page names are not hard-coded.
Selecting an action renders its title, description, effect and closed contract.
String, bounded safe-integer, Boolean, nested object and null fields are supported;
optional fields have explicit Include controls. Bounded arrays use a JSON textarea
and the same small recursive value contract validation for usability. There is no
arbitrary JSON Schema interpreter, executable validator or contributed markup.
Server validation remains the security boundary.

Read-only results use labeled values, nested lists and simple tables for object
arrays, including understandable empty values/results. All contributed metadata,
keys and values use textContent/createTextNode, never innerHTML. CSS uses existing
skin tokens and `data-wyd-theme` light/dark/system conventions, keyboard focus styles
and a one-column layout below 700 px. Loading, empty, access-denied and generic
failure states are explicit. Actions are cleared when the tab becomes inactive and
rediscovered when it returns; previously disclosed data cannot be remotely erased.

Write actions display their exact confirmation text and require a checked control.
`confirmed:true` is sent only after explicit confirmation, consumed on every attempt.
The UI disables concurrent submission/navigation/refresh. It never automatically
retries, rebinds an old reference or replays a mutation. Failed/uncertain writes
instruct the user to inspect current state before another submission. Required
Store revisions remain ordinary required inputs; confirmation supplies no native
host approval or idempotency guarantee.

## Relationship to the WydData design direction

The [WydData architecture](architecture/wyddata.md) proposes reusable DataTable,
DataPager and DetailForm Wydgits over capability-based provider/resource contracts.
The shell's existing bounded forms, tables and pagination metadata are foundations,
not an implementation of those WydData contracts or a generic record editor.
Reusable presentation can serve FrontEnd and BackOffice with independent server
admission; a browser displaying either still executes Client/SUB.

WydStore continues to own persistence, including JSON/SQLite and planned SQL
engines. WydData would adapt Store-backed, REST or SEAM/computed resources without
moving credentials or authority into presentation. Its proposed revision,
idempotency and indeterminate-outcome rules do not add replay safety to these
action endpoints: confirmation and outcome headers are not durable deduplication
or provider commit receipts. Preserve the current no-automatic-replay behavior.
WydData controls, remote protocol and CIR integration remain deferred, with no
expansion of 0.3-J or the current release scope.

## Site isolation and lifecycle

App identity comes only from the hydrated server repository and trusted routing.
The browser never selects a site/session resolver. References retain exact site,
receipt, generation and contract/policy digest. Identical action IDs on two Apps do
not merge authority. Foreign cookies, references and CSRF tokens fail independently.

Package lifecycle remains **stopped-App**. Stop/drain, close old registries, perform
the existing native operation and restart. On a changed catalog the old HTTP adapter
returns controlled ACTION.STALE. A new host rebuilds discovery from accepted active
BackOffice installations. Replacement, update/upgrade, relocation to FrontEnd,
retirement, removal/reinstall and reviewed policy changes cannot revive old
references. The UI clears stale selection and requires explicit refresh/reselection.
No live registry watcher, silent rebinding, mutation replay or distributed drain is
introduced. Newly installed qualified modules become eligible without shell edits;
removed/retired/relocated modules disappear on subsequent discovery after restart.

## Reproducible local member-roster setup

Use a disposable or already reviewed development App with configured canonical Gate
alpha.6 and Store alpha.5, independent private identity storage and membership
schema, and its existing membership login package. JSON and SQLite both work. Follow
[Gate configuration and operator provisioning](wydgate-membership.md#host-configuration-and-storage)
and [membership package setup](wydgate-membership.md#installation-bootstrap-and-demonstration).
Do not edit accepted configuration/receipts in place or use production data.

1. Stop the App. Inspect `examples/backoffice-members/manifest.json`. Save the
   **reviewed** `permissions` object to a separate local JSON file. Its capability
   is `gate.members.manage`, visible instance `backoffice-members`, exact logical
   Gate scope `current-app`, no editing/traversal. This explicitly approves the
   package requirement; it does not grant a user permission.
2. Run the native operator command from the checkout:
   `node examples/backoffice-members/install.js APP_ROOT REVIEWED_PERMISSIONS_JSON`.
   It uses the existing installer, a dedicated canonical Page placement and trusted
   BackOffice selection. No Gate accounts/assignments are created or changed.
3. Ensure the intended **existing** account has active site owner/administrator
   membership and an explicit current `gate.members.manage` permission assigned
   through independently authorized existing operator procedures. Owner/admin role
   alone is insufficient. Obtain credentials from the owner; none are supplied here.
4. Start the private loopback host:
   `node examples/backoffice-members/serve.js APP_ROOT 3100`.
5. Open the site's existing membership login Page at `http://localhost:3100`, sign
   in normally, then open `http://localhost:3100/backoffice` using the same hostname.
6. Choose **membership → Site members**. Optionally include offset/limit and press
   **Run action**. The table comes from the real installed action's fixed WydGate
   list-members operation. No roster fixture or privileged shortcut is in the shell.

The helper scripts are native checkout examples, not executable package resources,
a new bootstrap flow, or an independently managed administration product.
Tests create their own disposable accounts/grants solely inside temporary fixtures.
For repeatable automated evidence, run `node --test test/backoffice-http.test.js
 test/backoffice-ui.test.js test/backoffice-actions.test.js` from the checkout.

## Qualification and remaining work

`test/backoffice-http.test.js` uses real HTTP listeners, installed packages,
WydGate and JSON/SQLite stores. It covers anonymous/authenticated access, expired
and revoked sessions, site/session/reference/CSRF isolation, current permission and
approved-policy narrowing, malformed/oversized/unsupported/polluting input, methods,
CSP and credential containment, lifecycle/reference changes, genuine roster results,
public FrontEnd routing and inaccessible native/wider-domain paths. A complete
browser-form login is followed by the **actual served shell mounted in happy-dom**,
fetching real discovery and invoking the real service through the generic UI;
hostile site title/action metadata/member display names stay text.

`test/backoffice-ui.test.js` deterministically tests navigation, supported fields,
read-only tables, XSS containment, confirmation consumption, repeated submissions,
no uncertain-write retry, stale/removed selections, error/empty states, appearance
controls and responsive CSS rules. The existing action, scoped-policy, placement,
reviewed-policy and installed-package suites retain their deeper service ownership,
revision, multi-module, upgrade/recovery and AccountAdmin/HostAdmin coverage.

These are HTTP and DOM tests, **not full visual browser automation**. Actual browser
mobile layout, screen-reader behavior, OS theme switching and proxy/TLS deployment
still need manual qualification. Arrays use JSON entry; there are no custom widgets,
record editor, user/role manager, installer UI, native review bridge, CSRF-protected
arbitrary RPC, full administrative coverage or AccountAdmin/HostAdmin activation.
ADM-01 now qualifies the **site-level action transport/generic UI subset only**.

The [HTTP reliability issue](milestones/0.3-reliability.md) remains open. Controlled
BackOffice testing establishes that the unchanged 1,000 ms action ledger can reject
a response after the actual Gate mutation committed. The new path returns sanitized
503 SEWN.LIMIT and the UI supplies no replay. Existing controlled Contact/held-Page
probes still exercise their original 500, cancellation, drain and commit semantics.
This demonstrates bounded behavior, not historical delay attribution or a fix.
A passing suite alone cannot resolve the release risk.

Verification results are recorded below after the final run. Recommended next
increment: qualify real browsers/accessibility and richer contract presentation,
then add further separately reviewed installed administrative modules. Keep native
policy reconciliation and future hosting domains behind their existing independent
boundaries.

### Mission qualification mapping

| Mission cases | Evidence and scope |
| --- | --- |
| 1–6 | BOHTTP-01/02/05/10: anonymous/authenticated access, absolute expiry, revoked membership/session, exact App cookie/reference/CSRF and HTTPS origin binding |
| 7–13 | BOHTTP-01/02/04/06, ACT-02/06: private discovery, real invocation, live Gate permission, independent approved capability/scope, forged and stale references |
| 14–19 | BOHTTP-03/04, BOBODY-01/02: retired/relocated/reinstalled actions, methods, content type/encoding, chunked byte/deadline bounds, malformed JSON, closed input |
| 20–25 | BOHTTP-04/05/09/10, BOUI-02: session CSRF, origin and alternate credential denial, HTTPS/local cookie attributes, no reflected credentials, hostile metadata/results and pollution-key rejection |
| 26–30 | BOUI-01/03/04/08, BOHTTP-03/07: read effect, explicit per-attempt write confirmation, duplicate-submit fencing, no retry after a committed-but-timed-out mutation, metadata-driven paginated navigation and removal after rediscovery |
| 31–33 | BOUI-07: light/dark/system state and responsive CSS rules; actual visual/mobile and accessibility checks remain manual/unperformed |
| 34–36 | BOHTTP-01/03/09/11: real Gate roster through HTTP/generic DOM UI, reviewed demo installer, real JSON and SQLite providers |
| 37–40 | BOHTTP-01/08 and existing transport, ACT-04/05/07/09/12, placement, policy, lifecycle and Linux suites: FrontEnd retained, native host-policy operations inaccessible, AccountAdmin/HostAdmin rejected and package recovery/fencing unchanged |


### Verification record (Node 24.21.0, 2026-10-19)

- Complete `npm test`, including pretest client/regex build: **1,479 passed,
  zero failures/cancellations/skips/todo**. The earlier alpha.21 run had **1,469
  passed / 5 failed / 1,474 total**, all obsolete release-version assertions; the
  exact compatibility checks now select alpha.21 and reject alpha.22. No security,
  concurrency or timing assertion was relaxed.
- Dedicated new HTTP/body/DOM suite: **24/24 passed**. Broader focused
  HTTP/UI/body/launcher/package/transport run: **49/49 passed**.
- Six unchanged controlled HTTP deadline/cancellation/drain probes: **6/6 passed**.
  BOHTTP-07 separately proves a real committed mutation can return SEWN.LIMIT.
  Historical failure attribution remains unresolved.
- Local-tarball qualification: installed five-library integration **193/193**,
  provider **35/35**, actual independent process supervision **20/20**, Linux
  boundary tests **25/25**, all passing, plus service-free binary/HTTP/assets
  acceptance. Runtime import hooks reject checkout imports; each disposable
  consumer has exactly one installed engine. New server modules and CSS/JS assets
  are explicitly checked in the packed inventory.
- `npm run check`: **passed**, three complete pages, 42 internal links, unique
  anchors. Relative documentation file-link check: **200 checked / zero missing**.
- `npm ls --all --json`, `git diff --check` and **31 immutable client artifacts**:
  passed. Existing versioned client/regex distribution bytes remain unchanged.

Completed commands run with the local listener/subprocess access required by the
repository. Initial restricted-sandbox file-level failures are not treated as
functional qualification. Early fixture/UI failures were corrected and rerun;
actual browser visual automation and privileged Linux deployment were not performed.
The final required checks are repeated after this documentation update before
commit/push. No deployment, production data change or elevated account creation
is part of this increment.

## Alpha.22 reliability amendment

The HTTP adapter now passes its remaining deadline and disconnect guard through
private native action options and the existing service completion control. Admission
is checked again after authorization and at actual service-handler entry. Admitted
I/O remains in the drain set until it settles. The unchanged SEWN budget is reduced
by the parent deadline; no client field can supply or extend it. A request deadline
returns sanitized 503 `HTTP.DEADLINE`; body bounds retain 413.

Invocation JSON responses include `X-Wydgit-Action-Outcome`: `rejected` (no handler
began), `completed` (validated success published), or `uncertain` (handler began,
success unavailable). Unknown/missing delivery is always uncertain to the caller.
This is not a provider commit receipt or rollback guarantee. Explicit confirmation
and inspection before retrying remain necessary. See the
[reliability investigation](milestones/0.3-reliability.md).

Transient Gate session-resolution conflict/busy/I/O failures return 503
`SERVICE.FAILED` and preserve the auth cookie. Only genuinely invalid sessions
return 401 with cookie deletion. Concurrent session touches can still reach Gate's
existing optimistic-conflict bound; the transport does not retry an action.

### Alpha.22 browser qualification

The [real-browser record](backoffice-browser-qualification.md) supersedes the
increment-6 unperformed-browser limitation for the explicitly listed Chrome,
viewport, theme, keyboard and accessibility-tree cases. Focus handling and the
named result scroll region are corrected. Human assistive-technology checks,
Firefox and full ADM-01 remain unqualified.

### Alpha.22 bounded form and result controls

The [usability record](backoffice-ui-usability.md) supersedes increment-6 JSON-array
entry with recursive Add/Remove controls, per-field linked errors and clearer
bounds. Results add homogeneous tables, explicit empty/null text, long-text
native disclosures and pagination metadata. Confirmation resets on edits and on
every attempt; all original server authority and no-replay boundaries remain.

### Alpha.23 portability/accessibility amendment

Real Firefox qualification demonstrated null-Origin rejection caused by the shell's
`no-referrer` document policy. Successful shell documents now send
**Referrer-Policy: same-origin**, suppressing cross-origin referrers while preserving
exact Origin on their own JSON POSTs. API/error responses retain `no-referrer`;
foreign/null Origin, CSRF and Fetch Metadata checks remain unchanged. Discovery
failures now use the same alert/assertive announcement semantics as invocation
failures. See the [Firefox subset and manual checklist](backoffice-browser-qualification.md#alpha23-firefox-and-accessibility-continuation).

### Foundation conformance: service error classification

The adapter normalizes an action failure before selecting both its public code and
HTTP status. Independent SEAM/Store/Gate denials become 403 `ACTION.DENIED`;
canonical request validation becomes 400 `ACTION.INVALID_REQUEST`, and Store input
or constraint failures become 400 `ACTION.INVALID_INPUT`. `STORE.CONFLICT` retains
409. Unrecognized service failures, including Store I/O/busy/corruption and service
unavailability or invalid output, become sanitized 503 `SERVICE.FAILED`. This
clarifies the earlier generic-denial wording using the status table's distinction
between authorization, malformed requests and service failure.

The underlying native action facade retains safe service codes. HTTP exposes no
provider exception or details. Failure classification neither proves rollback nor
changes `X-Wydgit-Action-Outcome`; an admitted failure remains uncertain. It never
triggers an action retry or credential deletion. See the
[foundation conformance report](work-in-progress/backoffice-foundation-implementation.md).


### B1 final Session authorization

The existing invalid-session cookie deletion rule also applies when the final
HTTP Session check observes expiry or revocation after action completion. Return
401 `HTTP.AUTHENTICATION` with matching auth-cookie deletion (including Secure
host-cookie attributes for HTTPS). An admitted native mutation may already have
committed: its outcome remains `uncertain`, never success or a rollback claim,
and the adapter never retries it. Transient session-service failure still preserves
the cookie and returns service unavailability. BOB1-01 qualifies real logout at
this boundary after installed Store writes on JSON/SQLite and both ingress schemes.
See the [B1 decision record](work-in-progress/backoffice-page-admission-decisions.md).
