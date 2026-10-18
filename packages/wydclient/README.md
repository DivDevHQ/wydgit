# WydClient — current alpha.11

WydClient **0.1.0-alpha.11**, WydSUB **0.1**, includes native semantic controls and
explicit CLIENT package authoring. See the [H4 contract](../../docs/milestones/0.3-H4/README.md)
and [verification](../../docs/milestones/0.3-H4/verification.md). Load the versioned
`dist/wydgit-client-0.1.0-alpha.11.min.js`. The [interactive Taskboard](examples/interactive.html)
and [embedded Taskboards](examples/interactive-embedded.html) use authored controls,
compiled SEWN and host policy only; they need no application-authored JavaScript.

Alpha.9 adds versioned trusted execution-meter diagnostics while preserving execution
limits and WydSUB 0.1. Earlier immutable distribution artifacts remain unchanged.

Alpha.8 corrects client-profile validation of inert SEWN literal records; real
server/service operations remain rejected. See the [H5 review](../../docs/milestones/0.3-H5/review.md).

Build the example from the repository root with
`node scripts/build-client-package.js examples/wbasic-taskboard/client/build.json packages/wydclient/examples/interactive divdev`.
Serve this directory over static HTTP. Third-party deployment requires independently
trusted publisher keys and exact package/version execution approval. Local sample
trust is an explicit development choice, never a production default.

The following sections retain H3 and earlier historical contracts; their deferrals
apply to those versions. H4 supersedes them only for its explicitly documented
control/profile subset. All historical versioned artifacts remain immutable.

## Historical H3 baseline — alpha.6

WydClient **0.1.0-alpha.6** executes a closed portable canonical SEWN component
profile on static websites. WydSUB remains **0.1**. See the [H3 contract](../../docs/milestones/0.3-H3/README.md)
for independent host execution approval, opaque references, methods, lifecycle,
typed events, shared budgets, scalar bindings and keyed repetition, and its
[verification](../../docs/milestones/0.3-H3/verification.md) for measurements and limits.

Load `dist/wydgit-client-0.1.0-alpha.6.min.js`. The runnable static examples are
[Taskboard](examples/taskboard.html) and [independent roots](examples/taskboard-embedded.html).
Publisher signatures authenticate provenance; a separate trusted host execution
policy grants authority. Neither the execution facade nor H2 `host()` may enter
ordinary SEWN scope. Runtime services, Server/Session, raw HTML/CSS, full Markdown,
Forms and general browser controls remain unsupported.

The following sections retain the historical H1/H2 bootstrap and immutable artifact
contracts. Statements there about deferred execution describe those earlier versions;
the H3 contract above defines executable alpha.6 behavior. Historical filenames
and size records remain unchanged.

# WydClient 0.1 — Standalone and container bootstrap

WydClient **0.1.0-alpha.5** is a standalone browser runtime bootstrap. It works on
static HTTP websites without Wydgine, a database, npm, module imports or build
tools on the consuming host. Wydgine is **0.3.0-alpha.8**. WydSUB compatibility
is independently declared as **0.1**, not derived from implementation SemVer.
No native runtime is implemented. The logical destination names and canonical
JSON Page snapshot are the renderer-independent contract for later adapters.

## Distribution and host API

Self-host `dist/wydgit-client-0.1.0-alpha.5.min.js` or upload the exact artifact to
your CDN under that immutable filename. Do not overwrite deployed version paths;
pin upgrades explicitly. A readable `.js` artifact accompanies it. CDN hosting is
a deployment approach, not an existing hosted CDN or published npm release. This
repository workspace is distributable with `npm pack --workspace @wydgit/client`;
publishing, tags and releases remain manual. Build tooling is repository-only.

```html
<script defer src="/wydgit/wydgit-client-0.1.0-alpha.5.min.js"></script>
```

The frozen global API is only `WydClient.version`, `WydClient.protocol`
(`{name:"WydSUB",version:"0.1"}`), `WydClient.state`, `WydClient.ready()` and the
trusted-host `WydClient.mount(options)` integration entry point.
`ready()` returns the same promise and frozen result on every call. It resolves
with `ok`, `state`, sanitized `diagnostics`, a generic public `page` snapshot,
logical `SUB` destinations and `registry.approved`. Failure is explicit through
`ok:false` and `state:"failed"`; callers must check them. There is no retry or
registry mutation API. Loading the artifact twice preserves the original global
and creates no additional Page or regions. The trusted factory in source is an
internal browser-adapter boundary, not a portable object constructor or public
package export. A preexisting global named WydClient belongs to the trusted host;
it is not overwritten.

## Embedded containers and ownership (H1b)

The document runtime still initializes automatically in `document.body`, with the
same H1 Page identity, manifest conventions and `WydClient.ready()` result. Existing
standalone HTML requires no change. The alpha.1 artifacts are retained unchanged;
new integrations pin alpha.4. One loaded global owns the runtime manager, and
loading its script twice never replaces it or adds another document context.

```html
<section id="profile" data-wydgit-root data-wydgit-page="acme/profile"
         data-wydgit-title="My profile">
  <script type="application/json" data-wydgit-manifest>
  {"schema":"wydgit.registry/0.1","prototypes":[{"id":"acme/profile","publisher":"acme","extends":"wydgit.core/page"}]}
  </script>
  <p>Existing host content</p>
</section>
```

```javascript
const profile = WydClient.mount({
  root: document.getElementById("profile"),
  // Optional, independent of WydClientConfig and every other root:
  policy: { allowedOrigins: [], trustedKeys: [], verifiedPrototypes: {} },
  // Optional overrides of root-local Page selection/properties:
  page: "acme/profile",
  properties: { title: "Configured title", slug: "/profile" }
});
const result = await profile.ready(); // inspect result.ok and diagnostics
profile.unmount();
```

`mount()` synchronously returns a frozen handle with only `ready()`, `state` and
`unmount()`, and starts initialization. This permits cleanup even while bootstrap
is pending. Invalid root/options throw sanitized `MOUNT.ROOT`/`MOUNT.CONFIG` errors;
manifest/policy/Page errors resolve through the normal failed readiness result.
Roots must be HTML container elements connected inside this document's body.
Body/document roots, head/configuration/void elements, foreign-document nodes and
roots inside runtime-owned regions are rejected. Shadow DOM and detached initial
mounts are not supported in H1b. No DOM ID is used as ownership evidence.

A private WeakMap keyed by the actual root owns one handle. Repeated and concurrent
calls for that root return that exact handle/promise; **the first request wins**,
and subsequent options do not replace its policy or Page. Root policies and
property inputs are copied on creation. Each root independently stages the
existing manifest, network, cryptographic, H0 registry and Page validations; no
trusted keys or exact publisher bindings are inherited from the document, parent
or sibling. Shared implementation code supplies no shared mutable registry.

Place `data-wydgit-root` on intended containers **before document bootstrap** to
declare configuration boundaries even before mounting. Registration also creates
a private boundary while mounted, but cannot retroactively change an already
completed document manifest discovery. The marker itself neither initializes the
root nor grants trust. Embedded inline configuration is a **direct child**
`script[type="application/json"][data-wydgit-manifest]`; alternatively use one
direct child `link[rel="wydgit-manifest"]`. Nested arbitrary descendants are not
configuration. One authoritative source is allowed per root; duplicate or mixed
sources fail closed. There is no implicit merging or trusted manifest-object API.
The document's existing manifest selectors exclude marked/registered boundaries,
including legacy manifest IDs and links located inside them. Embedded roots never
read the enclosing document's `data-wydgit-page` or manifest. Signature and origin
requirements are unchanged by placement, nesting or mounting.

Embedded Page selection comes from `page`, then the root's `data-wydgit-page`, then
`wydgit.core/page`. Embedded defaults use root-local `data-wydgit-title` (otherwise
empty) and `data-wydgit-slug` (otherwise URL pathname); explicit `properties`
override those values and use the existing H0 validator. Pages retain the same
canonical `wydgit/0.2` envelope, slots and export filtering. Their IDs are
`WydClientPage-1`, `WydClientPage-2`, etc., unique within the loaded runtime manager;
remount receives a new ID. IDs are not global persistent identities. There are no
cross-root Wydgit parent, child or sibling relationships.

Every root prepends/appends its own empty Top/Bottom containers without moving
host content. `SUB.Page.Top` and `.Bottom` keep the same semantic `destination`
strings; embedded descriptors additionally carry `context: <Page ID>`. The pair
of context and destination identifies one logical mounting destination.
`SUB.Page.default` continues to mean Bottom **within that environment**. No DOM
anchor or placement operation is exposed. Document descriptors retain their H1
shape. Regions are private runtime-owned nodes; outer containers never claim
inner destinations or inner registries.

Nested roots are supported with **independent lifecycles** in either mounting
order. Unmounting outer leaves inner active, connected in its host container;
unmounting inner leaves outer active. An HTML-contained Page is not a child Wydgit.
Unmount is synchronous/idempotent, aborts pending requests and DOM-ready waiting,
deactivates the Page, releases ownership/private runtime state, and removes only
that environment's region wrappers. H1 has no portable children, so any host-added
children inside those wrappers are preserved, including host-moved nested roots.
Pending native cryptographic operations may finish, but cannot activate a disposed
context. `ready()` after unmount resolves a frozen disposed result with null Page
and destinations. Already delivered readiness snapshots remain immutable historical
JSON; they are not live execution handles. `state` reports the current lifecycle.
An old handle cannot dispose its replacement. Hosts may reconnect a removed root,
unmount its old handle, and mount it cleanly again; no automatic removal observer
or hierarchy-wide disposal exists. A root detached during pending bootstrap fails
without inserting regions. Hosts are responsible for later DOM relocation/removal.

Container ownership is a logical runtime boundary, **not a JavaScript sandbox**.
Same-document host JavaScript can inspect its page and share globals. Executable
untrusted third-party code needs additional host isolation; H1b executes none.
The [embedded profiles example](examples/embedded.html) demonstrates two independent
Pages without AppCaboodle-specific services or a profile builder. Future H2/H3
construction, placement, rendering and execution must bind to an explicitly scoped
context and independently granted SEAM authority, never infer authority from HTML
containment, publisher signatures or these diagnostic descriptors.

## Initialization and Page semantics

1. Wait for DOMContentLoaded when needed; defer, end-of-body and already-ready
   loading work. Read trusted host policy and discover one authoritative source.
2. Parse bounded JSON, validate manifest protocol and fetch/verify pinned packages.
3. Validate the entire staged registry through the **existing H0 PrototypeRegistry**.
4. Resolve the selected concrete Page prototype and validate its properties/slots.
5. Create empty browser-owned Top and Bottom regions, then settle readiness.

The default identity is `wydgit.core/page`. The internal Page uses the canonical
`wydgit/0.2` envelope: `schema`, immutable per-document `id: "WydClientPage"`,
`prototype`, `properties`, `slots`, `provenance`. This is a standalone adapter
context, not a hydrated App graph: it supplies no synthetic App or parent, creates
no children and persists nothing. A new page load establishes a new context; the
ID is local, not a globally assigned identity. Required title comes from
`document.title` and slug from the page URL pathname (no query or credentials).
H0 defaults supply other values. `sections` and `navigation` slots are empty.

Select an approved derived Page with `<html data-wydgit-page="acme/home-page">`.
It must inherit from the official Page, be concrete, and have defaults for any
new required properties. Static bootstrap supports empty slots, so positive
minimum child cardinalities fail. `Top`, `Bottom` and `SUB` member/slot names are
reserved for Page adapter destinations (case-insensitive); prototypes cannot
redefine mounting authority. Public diagnostics filter private, protected,
friend, hidden and capability-requiring properties using H0 export semantics.
Definitions are published browser data; this filter is not confidentiality from
host JavaScript or someone downloading a manifest.

On manifest/package/Page failure no proposed registry is activated. A minimal
default Page and both regions still appear with a failed readiness result. A
missing manifest is a successful default bootstrap. Missing body fails bootstrap.

## Manifest contract

One inline source:

```html
<script type="application/json" id="wydgit-manifest">
{"schema":"wydgit.registry/0.1","protocol":"0.1","prototypes":[]}
</script>
```

Or one explicitly declared external source:

```html
<link rel="wydgit-manifest" href="/wydgit/manifest.json">
```

`schema` and `prototypes` are required; `protocol` defaults to `0.1`; `packages`
defaults to `[]`. `prototypes` is an array of H0 declarations, matching the
repository's authoritative prototype-file convention. The proposed map form
`prototypes:{}` is deliberately unsupported. Unknown manifest fields, duplicate
authoritative elements and mixed sources fail. No merging of separate manifests,
discovery services, remote installation or executable script URLs exists.

Limits: **256 KiB** UTF-8 per manifest/package response, JSON depth **32**, **16,384**
JSON value nodes per response, **128** total authored prototypes, **16** package
references. Unsafe keys (`__proto__`, `constructor`, `prototype`) are rejected
throughout. Invalid UTF-8/JSON, versions, declarations and defaults fail cleanly.
JSON parsing does not execute code. JSON object's repeated keys follow standard
JSON.parse last-value semantics; duplicate authoritative HTML sources and exact
prototype/package IDs are rejected.

External URLs resolve against the HTML page URL, including package URLs (not the
manifest URL or HTML `<base>`). HTTP(S) only, no URL credentials or fragments.
The runtime uses credentialless CORS fetch, a 10-second deadline per request,
streaming size checks and JSON Content-Type enforcement. Redirects are denied
entirely, including same-origin redirects. CSP and native CORS/network restrictions
remain enforced; there is no proxy or bypass. HTTPS/localhost secure contexts and
native Ed25519 Web Crypto are required for signed packages. Missing Web Crypto or
unsupported native algorithms fail closed; there is no cryptographic fallback.

Trusted host configuration before loading WydClient:

```javascript
globalThis.WydClientConfig = {
  allowedOrigins: ["https://publisher.example"], // same origin always allowed
  trustedKeys: [
    { publisher: "acme", keyId: "key-2026", publicKey: "<32-byte raw key, padded base64>", status: "active" }
  ],
  verifiedPrototypes: {} // optional independent host bindings for authored local data
};
```

External prototype packages require signatures and independently trusted publisher
keys. Manifest-authored declarations, whether inline or fetched, remain site-author
configuration. Fetching an unsigned JSON manifest does not authenticate its
publisher. Namespace claims alone cannot establish authenticated friendship or
grant SEAM execution authority. Only the trusted host may explicitly bind exact
local prototype IDs to their publisher with `verifiedPrototypes`; it must have
independent evidence. Portable manifests cannot set this field or supply keys.

## Signed external prototype packages

Each manifest `packages` entry requires exactly `id`, `publisher`, `version`,
`url`, `integrity`, `algorithm`, `keyId`, `signature`. Package identity follows H0's
qualified namespace grammar. Exact versions are `major.minor.patch` optionally
with a prerelease suffix; ranges and build metadata are unsupported. H1 pins a
whole definition package and thus every prototype within it to those exact bytes.
It does not resolve individual remote prototype references or version ranges.

The downloaded JSON envelope requires exactly:

```json
{
  "schema": "wydgit.prototype-package/0.1",
  "id": "acme/pages",
  "publisher": "acme",
  "version": "1.0.0",
  "prototypes": [{"id":"acme/home-page","publisher":"acme","extends":"wydgit.core/page"}]
}
```

`integrity` is `sha256-` followed by standard padded-base64 SHA-256 of the exact
downloaded bytes after HTTP content decoding. `algorithm` must be `Ed25519`.
`signature` is standard padded base64 of the 64-byte Ed25519 signature. Sign the
UTF-8 encoding of `JSON.stringify` of this fixed-order array, with no whitespace:

```javascript
["wydgit.prototype-signature/0.1", publisher, id, version, integrity, algorithm, keyId]
```

This binds identity, version, content, algorithm and signing-key ID unambiguously.
The URL is deliberately unsigned so identical signed content can be mirrored;
the independent host origin policy still controls each download. Hash verification
precedes signature verification; parsing definitions follows both. The signed
package envelope must match the reference and all prototypes must belong to the
verified publisher namespace. Official `wydgit.core` declarations cannot be
published/overridden through site manifests. New publisher names are conventions
until a host independently trusts a key binding; no enrollment authority exists.

See the [publisher README](examples/publisher/README.md) for an actual digest,
signature, key, signed payload and complete copyable manifest. That demo key is
not production publisher authentication. For rotation, independently provision a
new active key ID and a new pinned package version. For revocation, remove the
old binding or set its status to `revoked`, then reload affected pages. H1 supports
multiple active IDs and explicit revoked bindings, but no remote revocation feed,
automatic enrollment, expiry, live invalidation, anti-rollback service or package
upgrade lifecycle. Trust configuration must be retained and updated by each host.

## H0 compatibility and security boundary

The build bundles the existing H0 registry, member metadata, property resolution,
JSON validation and method-declaration validator; **no execution engine** is
bundled. Only the exact official Object, Page, Section, Block, Field and Navigation
definitions and their slot dependencies are included, selected from
`prototypes/objects.json` at build time. No sample or privileged server definitions
are shipped. No parallel inheritance/override/member validator is introduced.

H0 namespace checks, single inheritance, case collisions, declaring owners,
public defaults, access/hidden/requires metadata, same-publisher friends and exact
method override signatures are retained. Friends require independently trusted
prototype bindings; signed packages establish those bindings after verification.
The site may declare inert methods using H0 `behavior` with an empty workflow and
empty procedure bodies, with normal `methodRules`/`overrides`. Executable bodies,
behaviorSource, raw methods, presentation and server/library declarations are
rejected. H1 does not interpret SEWN or WydBASIC, dispatch methods, expose members,
mint SEAM capabilities or authenticate users. Cryptographically verified origin
is separate from host-granted execution authority.

Trusted browser internals own DOM and fetch. The public site-author API contains
only frozen JSON diagnostics and logical destinations; no document, nodes,
private state, mutable registry, constructor or execution handle crosses it.
Same-realm host JavaScript can inspect/change its own page and browser globals;
it is outside the WydSUB security boundary and is not sandboxed by this bootstrap.
There is no portable execution interface yet; later interpreters must introduce
scoped bindings rather than forwarding the host API or raw browser objects.

## Insertion regions and deferred H2 work

`result.SUB.Page.Top` and `.Bottom` are logical descriptors with destination names
`SUB.Page.Top` and `SUB.Page.Bottom`; `SUB.Page.default` is Bottom. Browser internals
prepend/append empty, runtime-owned `div[data-wydclient-region]` containers. They
hold future children in normal insertion order. Existing host nodes are neither
read as portable content nor moved, replaced or parsed. Host CSS may style regions;
the example uses CSS-generated labels, with no public content-injection helper.
Later host mutations remain host responsibility; H1 adds no DOM observer.

Deferred: instance/draft construction, lifecycle, WydSUB placement operations,
ordered insertion scheduling, declarative rendering, executable methods/SEWN,
WydBASIC, persistence, canonical-service calls, new libraries/registries, package
enrollment and management, Multi-App/CMS/consoles and native adapters.

## Examples and verification

From the repository root:

```sh
npm run build:client
python3 -m http.server 8765 --directory packages/wydclient
# Open http://localhost:8765/examples/index.html
npm run test:client
node packages/wydclient/browser-smoke.js  # installed google-chrome; WYDCLIENT_CHROME overrides executable
npm test
npm run check
```

Examples cover no-manifest defaults, inline derived Page, external manifests,
signed external definitions and container-scoped profiles. Tests use Happy DOM
plus actual headless Chrome
smoke cases; DOM emulation is not a claim of full browser compatibility. Build
dependencies (`esbuild`, Happy DOM) are development-only; distribution has no
runtime npm dependencies or module imports. Current byte measurements are in
`dist/sizes.json`; the minified budget exceeds 8–15 KB because the shared H0
validators are retained, including method signature/SEWN declaration validation.
No server execution, framework or Node builtins are bundled.

A single-file host (the immutable runtime remains an external script):

```html
<!doctype html>
<html lang="en" data-wydgit-page="acme/home-page">
<head><meta charset="utf-8"><title>My static Page</title>
<script type="application/json" id="wydgit-manifest">
{"schema":"wydgit.registry/0.1","prototypes":[{"id":"acme/home-page","publisher":"acme","extends":"wydgit.core/page"}]}
</script>
<script defer src="/wydgit/wydgit-client-0.1.0-alpha.5.min.js"></script>
<script>addEventListener('DOMContentLoaded', async () => {
  const result = await WydClient.ready();
  document.getElementById('status').textContent = JSON.stringify(result, null, 2);
});</script></head>
<body><h1>Existing website</h1><pre id="status">Initializing…</pre></body>
</html>
```

## H2 trusted instance adapter (introduced in alpha.3)

New integrations use `dist/wydgit-client-0.1.0-alpha.5.min.js` (or readable `.js`).
Alpha.1, alpha.2 and restored alpha.3 distributions remain immutable compatibility artifacts.
`ready()` retains its result shape. The global and mounted handles add `host()`
for trusted host construction, ordered canonical placement, text rendering and
cleanup. This adapter must never be exposed to portable application code.
See the [H2 contract](../../docs/milestones/0.3-H2/README.md) for exact APIs,
draft consumption, limits, rendering restrictions and H3 authority requirements.
Static examples: `examples/instances.html` and `examples/instances-embedded.html`.
Earlier sections describe the retained H1/H1b APIs and alpha.2 baseline.


## Alpha.4 validation and immutable builds

Current integrations and every static/Chrome example pin **0.1.0-alpha.4**. This
independent client version records functional changes pulled in through shared
canonical prototype validation by WBasic 0.19. It adds no browser compiler,
portable event execution or lifecycle controller; H2/H3 boundaries remain unchanged.
No rule reserves implementation version increments for dedicated client milestones.
Publishing, tags and deployment remain separate, manual operations.

The accidentally rebuilt alpha.3 files from `bb0af8e` are restored byte-for-byte
from pre-0.19 H2 commit `15905895489e8db54cf3620d0d1ce1c0b5570fc1`.
`dist/sizes-0.1.0-alpha.3.json` preserves that commit's exact size metadata.
`dist/sizes.json` describes the current build, now snapshotted in
`dist/sizes-0.1.0-alpha.11.json`. The alpha.4 snapshot remains historical. Do not treat the unversioned current
size pointer as a historical artifact.

`build.js` builds both forms in memory, verifies history with `artifact-policy.js`,
and only then writes distributions and size reports. Existing committed versioned
artifacts must reproduce their canonical bytes; otherwise increment the package
and runtime implementation version and update current examples/docs before building.
The guard checks every historical artifact, including deletions, so building a
new version does not permit edits to old files. Node tests run the same check.

The approved legacy baseline is the pre-0.19 H2 commit above. After that baseline,
every newly introduced `wydgit-client-VERSION[.min].js` and `sizes-VERSION.json`
filename is pinned to its first committed bytes, even if later commits modify,
delete or re-add it. The one authorized alpha.3 restoration overrides the bad
0.19 rebuild; it does not create a general repair bypass. Full Git history must
be available for repository builds/tests; missing history fails closed with a
fetch-history diagnostic. Build tooling stays outside the distributed browser code.

See [the correction verification](../../docs/milestones/sewn-0.19/distribution-correction.md)
for byte hashes, functional comparison and final test/browser results.

## 0.20 server contract validation artifact

Alpha.5 updates the shared registry dependency closure with explicit rejection
of server component metadata. H2 still rejects these executable component definitions before mounting;
there is no H3 execution adapter. Alpha.1–alpha.4 artifacts and versioned size
reports are immutable and unchanged. Current examples pin alpha.5. This is an
implementation artifact update, not a publication or release.
