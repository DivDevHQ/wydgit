# I5.1 executable dependency audit

Audited at I4 `7df135082197b9dfbcdc42efc06127990f527834` and after the
boundary refactor. All paths describe current executable source, not proposed npm
exports. No physical engine or browser asset move occurs here.

## Executable graph

```text
npm start -> server.js -> app.js:createHostApp
  -> host.js -> recovery/state + contracts + libraries/index -> node-package
  -> repository -> package catalog/manifest + WBasic + object-model
  -> createApp -> index renderer + pipeline + lifecycle + Hono transport

trusted/worker -> same app.js / inventory / multi-app / operations / relocation
operations -> multi-app -> inventory + governance + routing + app.js + relocation
relocation -> inventory -> repository + contracts + state + policies + routing
```

`wydgine/index.js` remains a renderer, not the complete engine composition entry.
`governance.js` depends only on object validation; `routing.js` depends on Node
URL/net parsing and object validation. Inventory imports these existing policies,
SEWN maxima and repository checks, but imports neither controller nor App startup.
Controller retains private entries/tokens/context ownership, native shared dispatch,
App admission, startup/drain deadlines and terminal cleanup. Operations retains I3
required/optional startup and sanitized observations. Relocation retains I3 bounded
stopped local copy/manifest/rebinding and now validates without a controller import.

## Root, metadata and working directory assumptions

| Source | Actual dependency / consequence for extraction |
| --- | --- |
| `app.js` | `projectRoot` is its own file directory; default App and server runtime assets use it. Moving file changes defaults unless legacy root is passed explicitly. |
| `server.js` | Imports root App and root metadata; retains HOST/PORT defaults and signal cleanup. Positional arguments do not select an App. |
| `host.js` | Imports `../package.json` for platform compatibility. |
| `packages/index.js`, `packages/manifest.js` under engine | Import `../../package.json`; installer and package validation need packaged platform metadata. |
| `repository.js` | Reads selected root's content/prototypes and canonical installed catalog; compiles WBasic, hydrates model, builds web model. No publisher npm imports. |
| `packages/state.js` | Recovery markers, bounded no-link reads, base fingerprints, catalog/receipt/resource hashes and accepted installation state. These belong in engine closure. |
| `inventory.js` | Resolves explicit base with `path.resolve(root)`; relative bases use cwd, App entries remain confined relative paths. Existing service roots use `path.resolve(resource.root)` and must be approved confined paths. No new cwd interpretation. |
| `relocation.js` | Imports repository/contracts/catalog and inventory; local format is pinned alpha.12, JSON/local only. Copies no node_modules or host routing. |
| Example provisioners | Source-relative repository content/prototypes/public copies and node_modules symlinks provide fixture dependencies; not evidence of standalone npm installability. |
| Build scripts | `build-regex.js` reads root node_modules/re2js metadata/license and uses cwd for build resolution/output; client build consumes shared source paths. Keep build-time paths separate from consumer execution. |

## Native runtime and browser asset closure

`http/transport/hono.js` serves App assets from selected root, but `/runtime/` files
from `projectRoot` through an explicit `clientModules` allowlist. That closure includes
`wydclient/uploads.js`, `wydclient/index.js`, events runtime/registry, object-model
contracts/validation/schema/construction/prototypes/forms/interfaces/members, SEAM
context/capabilities, input, SEWN execution/schema/validation/bindings/budgets/types/
operations/dates/numeric/regex and generated `sewn/vendor/re2js.js`. The complete
allowlist must remain coherent when packaged; copying just renderer source fails.
It is distinct from the classic versioned `packages/wydclient/dist` distributions.
`wydbasic/client-package.js` also imports `packages/wydclient/src/packages.js` for
signed payloads. Compiler and client build share engine modules and core definitions
(`prototypes/objects.json`); their source imports also require extraction review.
All 23 tracked distribution artifacts are compared against I4 during verification.

## npm dependencies and approved services

Root runtime imports require Hono **4.13.13**, @hono/node-server **2.1.4** (including
its utils/response export), marked **15.0.12**, sanitize-html **2.18.0**, semver
**7.8.5**, busboy **1.6.0** and the generated RE2JS **2.8.6** implementation/license.
Root declares caret ranges for marked/sanitize-html/semver; installed versions above
come from current `npm ls --depth=0`. Root dev tools include esbuild **0.25.12**,
cheerio **1.0.0**, happy-dom **20.8.4**; they are not automatically engine runtime
requirements. `http/pipeline.js` statically imports **@wydgit/gate/client**, so even
a service-free App currently has that package in its import closure. A future manifest
must account for this rather than assume every canonical library is load-time optional.

`libraries/node-package.js` uses `createRequire(resolve(appRoot,'package.json'))`
to resolve both the configured approved package and its `./package.json` export.
It checks package name/version then imports the resolved file URL. `libraries/index`
checks exported descriptors, manifest identity/publisher/trust/version/platform/target,
requirements, capability ownership, acyclic dependency ordering and explicitly approved
App-bound dependency bindings before publishing its registry. No scanning, network
fallback, runtime installation or arbitrary publisher dependency injection occurs.
Node ancestry/workspace hoisting and fixture node_modules links presently make those
implementations resolvable; packed consumers must install approved packages explicitly.

Canonical workspace dependencies remain separate: Store **alpha.3** uses
better-sqlite3 **13.0.3**; Gate **alpha.4** uses argon2 **0.45.1**; Search **alpha.1**
uses entities **4.5.0** and imports root-hoisted sanitize-html; Files **alpha.1** uses
aws4 **1.13.2** and fast-xml-parser **5.11.2**; Stream **alpha.1** uses file-type
**21.0.0**. Files requires Node >=24.21; root declares >=22.12. Files/Stream remain
private. Workspace dry runs alone prove neither closure nor release readiness.

Search imports engine `repository.js`, `index.js` and **the original SEAM context**
by relative `../../../wydgine` paths. Stream imports engine transfers/destination.
These cross-package imports must become deliberate packed dependencies/interfaces;
copying kernel files into each library would break authority identity.

## SEAM and remaining tarball gates

`seam/context.js` owns its private WeakSet brand. Library dispatch, registry,
object-model, lifecycle, Page execution and controller import the same resolved source
module. Controller WeakMaps additionally require the exact issuing controller and
App lifetime. Routing request WeakMaps and service failure brands also depend on
module identity. New adapters re-export existing functions, never instantiate copied
modules or create alternate query/URL module identities. Frozen contexts alone do
not prove provenance; copies remain denied. Same App name does not revive tokens.

I5.2 can build explicit selection over the existing trusted App composition. Before
I5.4 can claim a self-contained tarball it must move the complete execution/transport/
compiler/catalog closure together, preserve legacy defaults, ship required allowlisted
runtime assets/regex license, replace root metadata imports, declare actual runtime
npm dependencies (including Gate client), repair canonical-library cross-source imports
without duplicating SEAM, preserve approved consumer-root resolution and reconcile
workspace manifests/lockfiles/exports. Then install actual local tarballs in isolated
consumers with no sibling source or workspace links and exercise service-free plus
five-library JSON/SQLite profiles, recovery, HTTP assets and stopped relocation.
No WydHosting import is needed; provider supervision and OS policy remain future work.
