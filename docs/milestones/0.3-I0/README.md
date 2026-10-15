# I0 — Trusted multi-App foundation

I0 composes independent existing Wydgine Apps in one trusted process. This is not
public domain routing or hard tenant isolation. The host/operator, implementation
libraries, adapters and host JavaScript are trusted. Portable publisher code remains
validated SEWN under SEAM. A shared publisher/package never shares App authority.

```text
Trusted process / shared implementation code
  Multi-App controller
    app-alpha → own config/catalog → SEAM/Page/Session → own service registry
    app-beta  → own config/catalog → SEAM/Page/Session → own service registry
```

## Identity and configuration

Use the existing canonical App object ID, unchanged and exact, as host inventory ID.
No second deployment identifier is needed in I0. IDs are not credentials; case-fold
collisions are rejected in one inventory. Each root must be a distinct nonoverlapping
real directory beneath the trusted base directory, with no symlink path components.
The complete explicit inventory is validated before initialization. No discovery.

Each App retains `wydgit.config.json`, `content/requirements.json`, canonical App,
package catalog/recovery state and independent library configuration. Canonical
service App owners and dependency bindings must match the App ID. Local resource
roots must remain inside that App directory; remote Files namespaces must not overlap.
Host implementation resolution (`node_modules`) is trusted infrastructure, not data ownership.

## Threat boundaries

| Boundary | Required behavior |
| --- | --- |
| Host inventory / App | Trusted explicit selection; no query/cookie/form/hostname selection or default fallback |
| Package / App | Provenance and installation identity are independent of App grants |
| Execution / services | Branded context, exact App, capability and resource scope; no union of grants |
| Objects / events | Existing context-bound live references and Page subtree/event ownership |
| Session / membership | Per-App resolver and Gate storage; equal-looking IDs/roles are not shared identity |
| Shutdown / late work | Reject new work, bounded drain, revoke bindings, child/runtime cleanup; no resurrection |
| Process resources | Existing bounded requests/SEWN/services; not hard CPU/memory/event-loop isolation |

Forged serialized tokens, foreign contexts, reused package names, stale bindings,
root traversal/symlinks and conflicting resource ownership must fail closed without
revealing configuration/secrets. Host-level arbitrary JavaScript is not sandboxed.

## Startup and lifecycle policy

Inventory validation is atomic before resource initialization. Activation is explicit
per App: a failed App is marked failed and cleaned up; already active siblings stay
active. Initialization/startup errors never publish an App token. Configured,
initializing, active, stopping, stopped and failed states are private host state.
No implicit restart: a new controller is required for a new App lifetime.

The controller reuses `createHostApp`, library loading, HTTP/Page execution and
Server/Session lifecycle. It owns listeners, active calls and library bindings.
Shutdown rejects new entry, drains accepted work within the configured deadline,
then invalidates bindings and stops lifecycle/libraries. It is idempotent. Physical
external operations may finish after timeout; committed work is not rolled back.
Cleanup is not durable exactly-once across process crashes.

Full hostname/domain/proxy/certificate/cookie-origin routing belongs to I1. I0 uses
host-only selection and explicitly bound listeners. Ordinary single-App startup is
retained. The implemented APIs and verification are documented below.

## Implemented host API

Import `createMultiAppHost` and `validateAppInventory` from
`wydgine/multi-app.js` in trusted Node host code. The inventory is closed JSON:

```json
{
  "schema": "wydgit.multi-host/0.1",
  "startupMs": 10000,
  "shutdownMs": 5000,
  "maxPending": 64,
  "apps": [
    {"id":"app-alpha", "root":"app-alpha", "limits":{"sewnSteps":5000}},
    {"id":"app-beta", "root":"app-beta"}
  ]
}
```

`root` in host options is the approved absolute base directory. Entry roots are
relative beneath it. They may not overlap, traverse, alias via symlinks/hardlinked
contracts, or point at missing directories. Each must contain the existing ordinary
App structure, configuration and requirements. Package recovery locks/catalog drift
reject startup. Library resources must declare that exact App owner; local resource
roots cannot be the App directory itself or source/public/configuration directories.
S3-compatible endpoint/bucket/namespace ownership cannot overlap across Apps.

```js
// Trusted host only: no part of this controller enters portable SEWN scope.
const host = await createMultiAppHost(inventory, {root: '/approved/apps'});
const alpha = await host.activate('app-alpha');
const beta = await host.activate('app-beta');
const server = await host.listen(alpha, 0, '127.0.0.1');
const context = host.context(beta, {
  publisher: 'acme', package: 'acme/demo', self: 'home',
  capabilities: ['store.records.read'],
  scopes: {wydstore: [{store: 'main', collection: 'records'}]}
});
const records = host.bind(beta, context);
await records.invoke('wydstore', '1.0.0', 'count', {
  store: 'main', collection: 'records'
});
await host.stop(alpha); // beta remains available
await host.dispose();
```

| API | Contract |
| --- | --- |
| `validateAppInventory(input, options)` | Validate all explicit entries before initializing any library; returns frozen trusted metadata, not execution authority |
| `createMultiAppHost(input, options)` | Own fixed inventory, private entries, tokens, provider claims, pending work and listener state |
| `activate(id)` | Initialize an explicitly configured App and await Server Start; concurrent duplicate activation shares one start, active activation returns the existing token; stopped/failed entries cannot restart |
| `select(id)` | Trusted exact selection of an active App; no default or fallback |
| `context(token, input)` | Trusted host factory using existing ExecutionContext; forbids caller `app`, binds exact App and lifetime, applies only limit reductions; not a publisher API |
| `bind(token, context)` | Caller-bound canonical `call`/`invoke` facade; context must have been issued by this controller for that token; capability/resource checks remain in services |
| `listen(token, ...args)` | One explicitly bound Node listener per App; selection fixed before cookies, authentication, Page execution and asset lookup; no hostname/query/cookie routing |
| `status()` | Frozen ID/state/pending counts only; no paths, secrets, registry or adapters |
| `stop(token)` / `dispose()` | Idempotent terminal cleanup; stop one App or all configured Apps; no implicit remount/restart |

Options `execution[id]` and `libraryAdapters[id]` are trusted host integrations,
never package metadata. Existing package principal resolution remains authoritative;
the App policy checks the resolved context and reduces budgets afterward, without
adding grants or bypassing the prohibition on mixing package and independent host
Page authority. Gate and lifecycle contexts must match the selected App. I0 rejects
external `lifecycleInstances` and legacy `files` adapters: Page-owned controllers
and canonical WydFiles remain the supported paths with demonstrable ownership.
Raw host callbacks, native listeners and implementation factories remain trusted.

## Service and Session ownership

Each App loads a separate library registry, dependency contexts and configured
provider state. Immutable implementation modules and provider factory functions may
be shared. Reusing the same mutable provider/source object across Apps is rejected.
This catches obvious aliasing; wrapping hidden shared native state cannot sandbox
malicious host JavaScript. The five canonical server libraries are the supported
I0 profile; a new implementation/profile needs an explicit ownership review.

WydStore checks exact App, publisher/package and store/collection scopes even when
logical names overlap. Gate has separate private directory records and App-bound
membership/session validation. Equal usernames, roles, package names or anonymous
cookie values do not authenticate another App. A foreign authenticated cookie is
rejected; it does not trigger anonymous fallback. Stopping an App invalidates its
in-memory Session owner, Page guards and service bindings. Persistent Gate sessions
are not globally revoked just because one host lifetime ends; a new authorized
runtime may reopen its own persisted sessions. No SSO or shared account directory.

Files retains logical path/action/installation grants, Search retains App/index
and trusted document ownership, and Stream retains App/resource/identity checks.
Private dependency bindings keep implementation identity, not a union of application
grants. An already bound facade is revoked on registry close. Library initialization
may return an optional trusted `stop` hook; close attempts every hook once, invoked
in reverse initialization order, and reports sanitized cleanup failure. Hook completion
may overlap so one rejecting hook does not prevent another from being attempted.

Configuration, requirements, canonical App identity and installation catalog are
pinned by a private startup snapshot. Change/recovery drift rejects execution and
requires a new controller. These checks are not a defense against a malicious OS
administrator swapping files between reads. Providers retain their own confinement
and corruption checks. Host code/package installation must not modify an active App.

## Resource and failure policy

At most **16 Apps**, **64 KiB inventory JSON**, and bounded source tree traversal
(**8192 entries per inspected tree, depth 32**) are accepted. `maxPending` is a
per-App admission bound, default 64, range 1–256. Additional requests fail 503 before
App-specific processing. Trusted direct service operations use that same counter.
No unlimited administrative operation queue is introduced.

`startupMs` defaults to 10000 and `shutdownMs` to 5000; each accepts 10–30000 ms.
Startup completion must win its deadline before a token can be published. A late
completion is cleaned up and cannot change failed state. Stop closes admission
immediately and drains accepted requests/service operations. Each drain/stop/close
phase has a shutdown deadline; stopping during initialization may first await the
bounded startup. On timeout, listeners disconnect, App authority retires and state
is failed. Late awaited Page work cannot mutate through its retired Session guard.
Physical I/O already committed is not undone. A stuck trusted cleanup hook may
remain unresolved after the controller deadline; no process-kill guarantee is implied.

Per-App `limits` accepts positive reductions of the existing enforced SEWN and event
bounds, never values above platform maxima. Program wire-size/node validation stays
at its existing fixed canonical bounds; those are not advertised as reducible knobs.
HTTP/presentation/service policies remain in each App's ordinary configuration.
Nested SEWN methods/hooks/events still share the existing terminal ledger. Independent
Apps have separate ledgers and queues; there is no event ordering guarantee between Apps.

**These are logical authorization, lifecycle and accounting boundaries in a shared
Node process. They are not hard tenant CPU, memory, event-loop or OS isolation.**
Trusted native adapters and process-global commodity facilities (including Argon2's
bounded job pool and module loading) can contend across Apps. Worker/process quotas,
scheduling and fleet operations remain later work.

## Compatibility, example and next phase

Wydgine/platform is **0.3.0-alpha.9**. Existing `createApp`, `createHostApp`, `server.js`
and single-App config stay supported through the same App composition and execution
kernel. SEWN, canonical object schemas and WydSUB 0.1 do not change. WydClient remains
alpha.8; no browser implementation/version change is required.

Run `node examples/multi-app/run.js` after dependency installation. It provisions
and serves two disposable Apps, prints independently bound loopback URLs, then
cleans up on Ctrl+C. See [example instructions](../../../examples/multi-app/README.md)
and [verification](verification.md). The tests also install the same existing WBasic
Taskboard package in both Apps and execute its navigation/event behavior over HTTP.

I1 must design exact hostname-to-App routing, origin/HTTPS and reverse-proxy policy,
assets and cookie-domain boundaries before public multi-site hosting. Unknown or
inactive explicit selection must keep failing closed. Domain ownership/provisioning,
SSO, dashboards, billing, orchestration and J/K/L work are not part of I0.
