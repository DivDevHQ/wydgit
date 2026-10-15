# Wydgit 0.3-H3 — Authenticated portable browser components

WydClient **0.1.0-alpha.6**, WydSUB **0.1**, platform/server reference
**0.3.0-alpha.8**. H3 executes canonical SEWN on static websites. It shares the
SEWN executor, canonical validator, object mutation kernel, instance controller,
event dispatcher and resource ledger with Wydgine. There is no browser compiler,
publisher JavaScript loader, HTTP server or storage adapter in the distribution.
See [verification](verification.md) for measured support and limitations.

## Host approval and entry

The trusted host supplies `WydClientConfig` before document bootstrap, or `policy`
to an independent `mount`. This configuration is copied, JSON validated and frozen.
Publisher trust (`verifiedPrototypes` or independently trusted signing keys) and
execution approval (`execution`) are separate. A verified signature supplies no
capabilities. Signed executable entries additionally require the exact `package`
and `packageVersion` in host execution approval. Every executable declaration must have independently verified exact
publisher ownership. Origin, integrity, pinned package version, signature and
whole-registry validation retain the earlier bootstrap checks.

```js
// Trusted host integration only, never a portable package callback.
globalThis.WydClientConfig = {
  verifiedPrototypes: { 'acme/panel': 'acme' },
  execution: {
    publisher: 'acme', installation: 'reviewed-local-installation',
    actions: ['Advance'],
    capabilities: ['object.instances.edit'],
    visible: ['panel', 'panel-*'], editable: ['panel', 'panel-*'],
    traversal: ['children'], scopes: {}, limits: {}
  }
};
```

The existing `wydgit.registry/0.1` manifest adds an optional closed `entry` with
`{id,type,properties?}`. Executable approval requires an entry; an entry requires
approval. The entry must be a concrete verified Section descendant belonging to
the approved publisher. Declared composition is expanded and completely hydrated
before activation. Selected custom Page definitions cannot also declare initial
children/repeaters in this entry-based profile. Composition has limits of 256 initial nodes and 32 containment levels.
The host authorizes that initial installation; subsequent SEWN construction needs
`object.instances.construct`, exact prototype scope and normal mutation grants.
Signed prototype packages retain their original envelope. There is no new archive
installer or automatic conversion of server package manifests to client packages.

After successful readiness:

```js
const ready = await WydClient.ready();
if (!ready.ok) throw new Error('Bootstrap failed');
const execution = WydClient.execution(); // trusted host only
const panel = execution.entry();        // opaque local token
await execution.invoke(panel, 'Advance', []);
```

Mounted handles supply the same `execution()` accessor. The frozen facade supplies
`entry()`, `children(token,slot)`, `snapshot(token)`, `invoke(token,name,args?)`,
`render()`, `unload()` and `activate()`. Host action names must be independently
approved; normal public member checks still apply. JSON arguments cannot carry
object credentials. Snapshots are filtered historical JSON, never executable
references. This facade and H2 `host()` are trusted integration APIs; neither is
registered in SEWN. Executable environments reject `host()` access. Existing H2
environments keep their original host construction/rendering semantics.

## Definitions, methods and authority

The supported component schema is `wydgit.component/0.20`; canonical instances
remain `wydgit/0.2` and SEWN uses its existing closed schemas through `sewn/0.18`.
The browser consumes canonical definitions independently of their source language.
The Taskboard example contains the exact six compiled WBasic definitions, also
checked against independently authored canonical JSON.

The browser uses the same typed parameters/returns, procedure semantics, arithmetic,
Boolean, string, numeric, array/collection, regex, DateTime, errors, inheritance,
overrides, declaring frames, exact member access, interfaces and static linking
semantics as the shared executor. Linked SEWN libraries retain exact pinned IDs,
private helpers and caller authority. No JavaScript module can substitute for them.
Runtime service operations and browser persistence are unsupported in this profile.

Only branded host contexts and opaque execution entries can enter methods/hooks.
Entries bind the exact registry, caller context and live receiver. Invocation-local
member adapters authenticate their receiver and expire after execution. Public,
private, protected, friend, hidden and capability requirements use the canonical
member kernel. Declaring owners come from verified prototypes, never argument or
publisher labels. Caller SEAM remains unchanged across methods and static calls.

Construction uses canonical bounded drafts. Attachment requires complete validated
properties, slots, visibility/editability and prospective identity grants. Consumed
drafts, cycles, duplicate ownership, stale receivers and foreign references fail.
Every accepted mutation is rehydrated through the same root profile. Browser
hydration has a host-only Page-root option; the default server App-root rule stays
unchanged. No synthetic Server or Session is installed.

## Lifetime, events and cancellation

The shared trusted controller runs Init once per live hydration, Preload on each
activation, Render initially and after browser method updates, Unload on explicit
deactivation, and child-first Dispose permanently on removal/unmount. Hooks are
compiled modules, not public application methods. Failed Init/Preload/initial
Render prevents bootstrap activation and triggers cleanup. Cleanup continues even
when hooks fail. Unload returns instances to initialized state; reactivation reruns
Preload and Render without rerunning Init. Dispose is idempotent and identities
are permanently retired. Removed keys appearing later receive new identities.

Typed events authenticate the live source, nominal declaring `prototype#Event`,
payload, event visibility, verified owner, `event.custom.raise` and exact lowercase
event scope. Legacy string raises cannot impersonate these identities. Declarative
Me/child subscriptions resolve actual canonical ownership and declaring handler
access. They run only while the recipient is active; there is no bubbling or
cross-root delivery. Handlers run sequentially in registration order. Queued raises
run FIFO after the remaining handlers/default boundary, using the shared dispatcher.
Cancellation and sanitized failures retain its canonical rules.

A single terminal ledger spans each host method entry, nested methods, hooks,
static calls, event handlers/chains, construction, reconciliation and its automatic
DOM presentation. Rendering charges SEWN steps and also limits DOM output to 4096
nodes, 262144 text characters and 32 containment/presentation levels. Invalid
budget/deadline state cannot be recovered by an event or nested call. Explicit
independent host invocations start independent chains. Pure data/schema validation
also retains its own canonical input limits.

Unload closes an in-flight ledger, waits for that operation to settle, then
unsubscribes and deactivates. Unmount synchronously invalidates the root facade,
removes owned DOM, and starts best-effort asynchronous child-first hook cleanup.
Pending work cannot mutate or reactivate the retired root. Browser termination has
no durable exactly-once cleanup guarantee. External service adapters are not exposed
in alpha.6; future adapters must retain the existing post-await ledger checks.

## Browser Page mapping

The canonical Page belongs to its exact WydSUB root. Bootstrap delivers Start,
Initialize, Load, then PreRender after successful instance activation. Start remains
eligible only for a Page declaration. Explicit browser unload delivers Page.Unload
before instance Unload hooks. These are host bootstrap/deactivation transitions,
not HTTP requests. Reactivation reruns instance hooks, not initial document events.
Page.Validate is unsupported because HTTP/form validation has no browser mapping
in this profile. Server/Session subscriptions and context reads fail staging.
There is no App event family, implicit DOM event subscription or Server emulation.

## Portable presentation and keyed records

Section/Block composition and H2 literal Markdown content remain supported.
A closed subset of `wydgit.presentation/0.1` accepts only `schema` and `template`.
Nodes accept only `tag`, optional `text` and optional ordered `children`. Approved
structural tags are section/div/p/span/h2/h3/strong/ul/ol/li; authors receive no DOM
handles. Text is a scalar literal or exact `properties.Name` binding to a public,
discoverable, unrestricted string/number/Boolean property. DOM `textContent` provides
escaping; no HTML interpretation or Markdown expansion occurs. All fallback content
uses the shared public-property export filter.

Fixed format hooks retain align start/center/end, width normal/wide/narrow and
tone plain/muted/hero. Skins, attributes, URLs, CSS, presentation expressions,
service/request/submission/delivery bindings and markup-local `each` are unsupported.
Supported records use the existing component templates/repeaters instead. No server
HTML renderer is bundled, and unsupported fields fail rather than disappear.

Templates use public typed record inputs, explicit binding contracts, dedicated
slots, limits 1–256 and unique bounded string keys. Complete candidate mutations
are validated before publishing composition. Retained keys preserve canonical
instance identity through reorder; removed subtrees are disposed child-first and
cannot recover their retired identity. Repeated rendering rebuilds owned DOM;
canonical instance stability does not promise DOM element stability.

## Roots, reproduction and limits

Every document/mounted root owns a separate registry, Page, context, controller,
event queue, ledger and opaque-token map. Identical local IDs, nested DOM placement
and publisher identity grant no cross-root access. Unmount/remount creates a new
lifetime. Existing generated-node preservation keeps independent embedded roots and
host additions intact. Same-realm host JavaScript is trusted, not sandboxed.

```sh
npm run build:client
node packages/wydclient/prepare-taskboard.js  # trusted development-time compilation
python3 -m http.server 8765 --directory packages/wydclient
# /examples/taskboard.html and /examples/taskboard-embedded.html
node packages/wydclient/browser-smoke.js
```

The consuming website needs only static files. It runs no Wydgine, Node, compiler
or database. The host fixture initiates approved navigation; application behavior
runs through compiled SEWN, typed subscriptions and property bindings.

Future work includes richer semantic controls, service adapters, browser persistence,
sanitized Markdown, approved skins, richer presentation, frontend client-target
package authoring and cross-origin isolation. No cross-root delegation, arbitrary
publisher JavaScript, raw HTML/CSS, Forms overhaul, OAuth, remote embed hosting,
release/tag/deployment or independent Barney audit is included.
