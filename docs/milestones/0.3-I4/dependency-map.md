# Dependency and ownership audit

All paths below refer to inspected alpha.12 code. “Move” is a future responsibility
assignment, not an I4 file change. Trusted Node composition is not a portable SEAM API.

## Actual dependency and execution graph

```text
npm start → server.js → app.js:createHostApp
                         ├─ host.js → packages/state.js (recovery)
                         │            libraries/contracts.js → libraries/index.js
                         │              → node-package.js → approved @wydgit/* packages
                         ├─ repository.js → catalog/receipts + WBasic + object model
                         └─ createApp → index.js renderer
                                      → http/pipeline.js → packages activation
                                           → execution/lifecycle, Page, SEAM, SEWN
                                      → http/transport/hono.js → native HTTP listener

examples/hosting-operations/run.js → operations.js
  → multi-app.js → validateAppInventory → config/catalog/root/owner validation
       ├─ app.js:createHostApp (one independent lifetime per entry)
       ├─ governance.js (App-local meter)
       ├─ http/routing.js → native shared HTTP → App handle → Hono/pipeline
       └─ relocation.js:snapshotStoppedApp
relocation.js:restoreLocalApp --dynamic import→ multi-app.js:validateAppInventory
```

The last pair is an existing module cycle. `multi-app.js` also imports `../app.js`,
and `app.js`, `host.js`, and the renderer depend on root layout/assets/metadata.
`wydgine/index.js` is currently a web renderer, not the complete engine entry point.
Do not package just that directory and assume the engine is independently runnable.
`libraries/node-package.js` resolves approved implementation packages with
`createRequire(root/package.json)`; workspace hoisting currently hides installation
closure requirements. Native runtime modules and upload assets must ship together.

## Ownership decisions

| Modules / current facility | Recommendation | Security and migration consequences |
| --- | --- | --- |
| `app.js`, `server.js` single-App startup | Split behind an interface | Engine composition remains Wydgine; move composition under engine package with root compatibility re-exports/launcher. CLI selection separate from trusted initialization. Never activate after failed validation. |
| `wydgine/index.js`, `repository.js`, object-model, WBasic, SEWN, SEAM, events, execution | Remain in Wydgine | Canonical execution, principal resolution, contexts and lifecycle are kernel concerns. No second executor or provider-issued SEAM grants. |
| `host.js`, libraries contracts/index/dispatch/node-package | Remain in Wydgine | Per-App recovery check, dependency ordering, approved native resolution, scoped services and cleanup must work standalone. Dependency services retain their own identity, not caller grant unions. |
| `packages/*` canonical libraries | Remain unchanged initially, revisit later | Keep existing optional workspace libraries, exports, provider ownership and platform requirements. Review publication/private flags separately. No arbitrary npm extensions. |
| `multi-app.js` inventory validation | Split behind an interface | Keep full executable validation in engine; provider validates customer registry and compiles approved pool inventory. Extract validator from controller only after parity tests, breaking relocation cycle. Never relax confinement to accept provider paths. |
| `multi-app.js` tokens/context/bind/activation/stop/dispose | Remain in Wydgine | WeakMap/WeakSet provenance and exact App lifetime are local authority. Do not serialize tokens or export raw registries across IPC. |
| `multi-app.js` shared listener and App listener | Remain in Wydgine | Wydgine owns native transport and raw-request selection. WydHosting assigns approved private endpoints and configures the edge, not Page dispatch. |
| `http/routing.js` canonical authority/resolve/bind/requestRoute | Remain in Wydgine | Raw duplicate/proxy/origin checks precede Hono normalization. WeakMap request bindings remain private. Moving parser alone would split a security boundary. |
| Domain ownership/registry and edge route generation (new) | Move to WydHosting | Provider verifies assignments; compile exact immutable engine route policy. Existing approval labels are operator assertions, not DNS proof. |
| `http/pipeline.js`, Hono transport, credential cookies, submission authority, transfers, metered output | Remain in Wydgine | Bound App before cookie/Gate/CSRF/package/service/static handling. Preserve exact HTTPS origin, host-only cookies, request/output bounds and streaming. |
| `operations.js` required/optional policy + signals | Split behind an interface | Retain source compatibility and worker-local startup wrapper initially. Provider chooses required set and supervises process failures; worker enforces it through existing code. Optional never bypasses inventory validation; parking remains required. |
| `multi-app.js:health`, `governance.js` | Remain in Wydgine | Frozen App-local readiness, admission, lifetime payload/service/Page counters remain authoritative only for their stated scope. |
| Aggregated hardware health, placement capacity, restart/backoff (new) | Move to WydHosting | External OS observations plus worker snapshots; never infer spare RAM/CPU from summed logical slots. Never expose tenant snapshots publicly. |
| Package manifest/catalog/state and installer infrastructure | Split behind an interface | Verification, receipts, execution approval and recovery refusal stay engine. Provider stages approved deployment and invokes trusted install/recovery tooling under explicit policy. Never auto-clear locks or trust receipt hashes as source authentication. |
| `relocation.js` stopped snapshot/restore | Split behind an interface | Keep bounded engine format and validation initially; provider owns migration journal, data handoff and routing. Isolate inventory validator to remove restore/controller import cycle; retain old import path. |
| Persistent service adapters / roots | Remain in Wydgine | App/principal/resource checks stay in adapters. Provider assigns exclusive approved roots/namespaces and kernel permissions. Ownership must survive restart, not rely only on per-controller alias checks. |
| TLS/reverse proxy examples and `docs/hosting-operations.md` | Remain unchanged initially, revisit later | Current Caddy reference untested; trusted-proxy HTTP/1.1 contract stays. Production generation/verification belongs provider adapter. |
| Supervisor, privileged broker, account/cgroup/firewall/systemd setup (absent) | Move to WydHosting | New provider functions, not code to extract. No root supervisor or workers. |

## Proposed package graph and entry points

```text
consumer package.json:start → wydgine bin:start → selected canonical App
external process manager ─────────────────────→ same standalone CLI
consumer start:hosting → wydhosting bin:serve → nonroot provider supervisor
  → narrow provisioning broker (separate authorized channel)
  → restricted process + inherited authenticated control channel
      → wydgine trusted worker entry → operations/controller → Apps
public TLS edge → private worker HTTP → Wydgine raw routing → selected App

wydhosting ─dependency→ wydgine ─approved dependencies→ canonical libraries
                              └→ shared engine/compiler/kernel implementation
WydClient keeps its existing independent browser build closure.
```

Put versioned worker message codecs under Wydgine's trusted export so WydHosting
can consume them through its existing dependency. A neutral npm contracts package is
not justified initially: JSON wire data imports neither process implementation nor
provider code. Add one only for a demonstrated independent consumer. No circular
package dependency and no WydHosting/WydOS/Linux import in standalone closure.

Root-relative package/library resolution, upload asset paths, root metadata imports,
relocation cycle, private Files/Stream packages and browser build paths make immediate
physical extraction unsafe. I5 must first prove packed tarballs outside the monorepo.
