# I1 — Trusted hostname routing and parking Apps

I1 extends the [I0 controller](../0.3-I0/README.md), not the portable object model.
One native HTTP listener selects an existing active App before Hono adapts the
request and before cookies, Gate, CSRF, packages, Page execution, services or assets.
Routing chooses a destination; SEAM still governs all application operations.
This is an internally tested hosting foundation, not production certification.

```text
Native HTTP: raw authority + actual peer + transport policy
  → immutable operator routing registry
    → active tenant → existing App admission / HTTP pipeline
    → explicit parked state or approved zone → ordinary parking App pipeline
    → unknown / malformed / unavailable → no-store rejection
```

## Configuration and host API

Add the optional closed `routing` object to an ordinary `wydgit.multi-host/0.1`
inventory. Existing inventories and per-App `listen(token, ...)` remain supported.
A complete local example is provisioned by `examples/hostname-host/setup.js`:

```json
{
  "schema": "wydgit.multi-host/0.1",
  "apps": [
    {"id":"app-alpha","root":"app-alpha"},
    {"id":"app-beta","root":"app-beta"},
    {"id":"platform-parking","root":"platform-parking"}
  ],
  "routing": {
    "schema": "wydgit.routing/0.1",
    "transport": {"mode":"local-http"},
    "routes": [
      {"hostname":"alpha.localhost","app":"app-alpha","state":"active","approval":"local-development"},
      {"hostname":"beta.localhost","app":"app-beta","state":"active","approval":"local-development"},
      {"hostname":"soon.localhost","app":"platform-parking","state":"coming-soon","approval":"local-development"},
      {"hostname":"parked.localhost","app":"platform-parking","state":"parked","approval":"local-development"}
    ],
    "unknown": {"policy":"park-approved-zone","app":"platform-parking","zones":["sites.example.localhost"]}
  }
}
```

Trusted host code calls `createMultiAppHost(inventory, {root, execution})`, explicitly
`activate(id)` for each App, then `await host.listenShared(0, '127.0.0.1')`.
The returned native listener is host-only. No HTTP input activates Apps or changes
mappings. Existing opaque App tokens, exact App ownership, admission, library
registries and lifetime guards are reused. Controller disposal closes the shared
listener and all Apps; stopping one App leaves the listener and siblings running.
Closing the shared listener alone closes transport, not all App lifetimes; use
`dispose()` for complete cleanup. Only one shared listener per controller is allowed.

The complete registry is validated with the inventory before activation, cloned,
deeply frozen and bounded to 64 KiB, 256 exact routes and 16 zones/proxy peers.
All targets must be configured Apps. Duplicate normalized hostnames, unknown
fields, invalid profiles and conflicting tenant/parking ownership reject staging.
Multiple distinct exact hostnames may select one App; aliases do not share browser
cookies automatically. Reconfiguration requires a new controller.

## Hostname and deployment authority

`canonicalAuthority` is the single comparison parser. DNS is case insensitive,
IDNA is converted to ASCII, and one final dot is removed. Labels are 1–63 ASCII
letters/digits/hyphens without edge hyphens, total DNS name at most 253 characters.
Authorities are bounded to 512 characters. Request headers must use ASCII/punycode;
trusted JSON configuration may contain Unicode IDNA names.

IPv4 must be an exact four-part decimal address; shortened/octal/hex spellings
are rejected even when Node's URL/IDNA parser would expand them. IPv6 must be
bracketed, has no zone identifier and is canonicalized through the URL parser.
Ports are decimal 1–65535 without leading zeros. Registry names cannot include
ports; the transport profile governs effective ports. Credentials, slashes,
backslashes, whitespace, controls, query/fragments, percent encoding, wildcard
labels and empty authorities are invalid. No suffix matching selects tenant Apps.

Every route requires an operator assertion: `platform-domain`, `operator-domain`
(independently approved custom domain), or `local-development`. These are trusted
configuration assertions, **not DNS ownership verification**. Packages cannot supply
this registry. No DNS lookups, automated ownership checks or tenant self-service.
Operators must verify their right to assign every public hostname/zone before
configuration. A valid package signature is unrelated to hostname approval.

## Parking and unknown hosts

States are `active`, `parked`, `coming-soon`, `under-construction`, `unavailable`.
The latter four select an explicitly configured parking App, never the tenant's
retired runtime. No automatic failure fallback is implemented: unavailable active
tenants return 503. Unknown unrelated hosts return 421; malformed authorities or
proxy/origin claims return 400. All router rejections are plain sanitized no-store
responses without cookies. Explicit failed/stopped parking targets also return 503.

Unknown policy defaults to `{ "policy":"reject" }`. The only alternative is
`park-approved-zone` with an existing parking App and explicit zones of at least
three DNS labels. Zone equality or `.`-label descendant matching is required;
`evil-sites.example.test` cannot match `sites.example.test`. No arbitrary `*`,
`.com`, two-label registry-wide rule or automatic IP-pointing custom-domain claim.
The operator must choose owned hosting zones, not a public suffix; no maintained
public-suffix/ownership database is shipped. This policy is host configuration,
not an untrusted domain-registration API.

Parking Apps use the ordinary validated canonical App/Page/Section/Block renderer,
Server lifecycle and I0 ownership. Enabled services and host execution integrations
are forbidden for designated parking Apps. They cannot also be active tenant
routes. Requests are GET/HEAD only; incoming credentials/query are ignored, no
anonymous-session database or Session events are created, and no cookies are issued.
Each request has only an ephemeral anonymous Page view. No Gate/session/catalog
handle from a tenant is supplied. Static assets remain the parking App's own assets.

The route selects approved canonical Page variants: `/` for `parked`, and
`/coming-soon`, `/under-construction`, `/unavailable` for those states. The example
provides all four. Customize the ordinary trusted App content using its existing
canonical Markdown contracts. Hostnames never become HTML or filesystem paths.
There is no arbitrary per-domain scripting, theme editor or tenant-admin surface.

## Proxy trust, origins and HTTPS

`local-http` rejects all recognized Forwarded/X-Forwarded-* metadata and accepts
only `localhost`, descendants of `.localhost`/`.test`, `127.0.0.1`, or `[::1]`
mappings. It requires `local-development` approval. Valid request ports may vary
for disposable local listeners. This profile must not be used for public hosting.

Public HTTPS termination uses:

```json
{"mode":"trusted-proxy","peers":["127.0.0.1"],"port":443}
```

Peers are exact native `socket.remoteAddress` IP strings, not header claims or CIDR
rules. Explicit IPv4-mapped IPv6 spelling must match the actual listener peer.
The proxy must remove visitor forwarding headers and send exactly one
`X-Forwarded-Host` and one `X-Forwarded-Proto: https`. Effective authority must match
the configured external port (443 default). `Forwarded`, X-Forwarded-Port and
X-Forwarded-For are deliberately unsupported/rejected. Duplicate/multivalue or
conflicting claims fail closed. No hop-chain interpretation or client-IP API.
Bind the backend privately and firewall it so an untrusted local process cannot
impersonate the approved proxy; same-process/OS hostile JavaScript is not isolated.

The shared listener is HTTP/1.x; duplicate raw Host headers reject before Hono
normalization. Absolute-form request targets must agree with the wire Host and
wire scheme; the proxy's separately verified public authority is not substituted
into that comparison. HTTP/2 is terminated at external infrastructure and converted
to this sanitized HTTP/1 proxy contract. No native HTTP/2/TLS listener is added.

The immutable effective origin is constructed only from validated scheme, hostname
and port; default ports are omitted. Non-GET/HEAD requests require exactly this
Origin. Missing/null/foreign origins reject, including same-site sibling hosts.
API clients must supply the exact Origin as well as existing CSRF credentials.
Routed documents use `Referrer-Policy: same-origin` so native same-origin form POSTs
retain Origin while cross-origin referrers remain suppressed. Existing single-App
entry points retain their previous policy. There are no host-derived redirects,
canonical-domain redirects, CORS expansion or application override of origin trust.

TLS certificates, SNI, renewal, HTTPS enforcement at the edge and proxy sanitation
are operator/infrastructure responsibilities. Use established reverse proxies;
I1 does not issue certificates or verify production certificate chains.

## Cookies, CSRF, assets and lifetimes

HTTPS uses reserved `__Host-wydgit-session` and `__Host-wydgit-auth`; local HTTP uses
reserved `wydgit-session` and `wydgit-auth` so browser prefix requirements remain
valid. All are host-only (no Domain), Path=/, HttpOnly, SameSite=Lax; HTTPS adds
Secure. Issuance and deletion use the same host policy. Applications cannot set
reserved names or Domain attributes. Legacy single-App APIs retain Secure defaults.

Gate authentication is still exact-App; replay of another App's token is denied,
not anonymous fallback. Anonymous cookies are independently resolved per App.
SameSite is not used as a substitute for existing session-bound CSRF. Same-origin
POST with a foreign session's CSRF still fails. A host operator reassigning a
hostname must plan cookie clearing/credential rotation; dynamic reassignment and
cross-App SSO are not implemented.

The selected App determines CSS/skins, package Page content and canonical transfer
bindings. Shared runtime source remains an explicit platform allowlist. Assets
retain traversal/hidden-file/symlink checks, native streaming, HEAD/ranges, ETags and
conditional requests. ETags include an opaque root hash to distinguish App roots;
no private path is emitted. Generated CSS is no-cache; Page responses default to no-store and routing
failures are no-store. Existing explicitly granted response-header authority remains
subject to its canonical scopes; do not approve public caching of personalized pages. External caches must key by effective scheme/host/port/path, honor
Vary and private/no-store and must never cache credentials or personalized pages.
Do not cache different tenants under a backend-only hostname.

Shared listener header bytes/count and request duration use the strictest configured
App HTTP policy. Raw header count is rejected, not truncated before authority checks.
Existing per-App pending and nested SEWN budgets remain authoritative. Graceful stop
rejects new routing and drains accepted work; timeout retires the App and disconnects
its responses without stopping siblings. No unbounded App routing queue is added.
These are logical authority/accounting boundaries, not hard CPU/heap/event-loop or
OS resource isolation in a shared Node process.

## Example, verification and I2 handoff

After `npm ci`, run `node examples/hostname-host/run.js`. It installs the existing
WBasic Taskboard per tenant through plan/apply, starts one disposable loopback
listener and prints `.localhost` URLs. A small canonical routing-test form also
executes compiled SEWN. Ctrl+C disposes Apps and removes the temporary roots.
No Wydgine service or database outside this local process is needed.

See [verification](verification.md) and [example instructions](../../../examples/hostname-host/README.md).
Platform is alpha.10; WydClient alpha.8 and WydSUB 0.1 are unchanged. No browser
artifact changes, new SEWN grammar, second executor or second multi-App controller.
I2 may build controlled hosting lifecycle/provisioning on this boundary; automated
domain verification, certificates, dynamic registry updates, tenant administration,
hard process quotas, federation, billing and CMS remain explicitly separate work.
