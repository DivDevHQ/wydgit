# WydClient H3 handoff — executable component contracts

0.20 supplies working **server** contracts and independent canonical conformance
fixtures, not a browser implementation. H2 alpha.5 adds explicit fail-closed component
validation while preserving H2 literal rendering and root isolation. Alpha.1–alpha.4
versioned artifacts remain immutable. No H3, release, deployment or browser compiler
is included.

## Enforcement points before enabling browser execution

| Responsibility | Server reference / required browser boundary |
| --- | --- |
| Validate definitions | `object-model/component-contracts.js`, `class-contracts.js`, `prototypes.js`; closed metadata, exact dependencies, verified installation/publisher, slot contracts, finite defaults |
| Authenticate entry | `sewn/entry.js`; opaque tokens bound to exact registry, ExecutionContext and live receiver; no JSON/DOM/ID credentials |
| Resolve live references | `execution/instances.js` bound adapters; ownership, declared containing slot/type, visibility, traversal, lifetime, root isolation |
| Methods and libraries | Shared SEWN executor and member authorization; preserve caller SEAM through declaring frames and static helpers |
| Lifecycle | Host-only controller: Init once per live hydration, Preload activation, repeated Render, Unload reactivation, permanent/idempotent child-first Dispose |
| Typed emission | Verify declaring owner, actual receiver, payload, live source, event capability/scope; nominal `prototype#Event` identity cannot be raised by legacy string façade |
| Subscriptions | Validated declarative metadata, original declaring handler access, authentic root-local Page/child source; active lifetime only, detach before teardown |
| Event ordering | Existing sequential registration-order/FIFO queue after remaining handlers/default; cancellation, sanitized exceptions, stale recipient checks, no bubbling |
| Shared accounting | `sewn/budget.js` exact-context ledger across methods, hooks, handlers, nested raises, libraries, service calls and construction; terminal exhaustion/deadline |
| Presentation | Explicit portable canonical capability profile/lowering; one-way public exact-property reads, fixed format/skin hooks, no executable markup or hidden coercion |
| Repeaters | Typed plain records, explicit limits/key validation, stable reorder, new lifetime for removed/reappearing keys, complete candidate edits and bounded cleanup |
| Unmount/cancellation | Invalidate adapters/subscriptions first; late awaited results cannot mutate/resurrect; no host adapter enters application code |

H2's public bootstrap normalization and standalone prototype-validation closure
currently **reject component metadata**. Package build/installation reject client
runtime claims for these contracts (`PACKAGE.RUNTIME`); `PRESENTATION CLIENT` fails
capability validation. H2 has no authenticated application entry/controller, callback
wiring or executable binding capability. These are precise missing enforcement
points, not a rendering option to bypass. The trusted H2 `host()` stays private.

SERVER presentation trees remain validated `wydgit.presentation/0.1` artifacts,
but are HTML-oriented and are not claimed portable to H2. The scalar values, typed
property/event/slot/composition contracts and independent fixtures are language-neutral;
a browser-capable presentation profile must be separately validated. Unsupported
features must fail before activation. Preserve H2 Markdown-as-literal behavior until
a separately implemented sanitized Markdown capability. Do not silently omit content,
execute server markup or infer Wydgit relationships from DOM containment.

Server/Session sources cannot exist in browser application scope. App has no invented
canonical event family. Page browser lifecycle sources need their own verified host
eligibility and documented delivery points. Embedded WydSUB roots remain independent;
no nesting, shared publisher label or serialized child ID delegates authority.

## Reusable acceptance and adversarial fixtures

- `test/fixtures/taskboard/golden.json`: independently authored six-class canonical
  JSON/SEWN equivalent of `examples/wbasic-taskboard/*.bas`.
- `test/wbasic-taskboard.test.js`: package build/install/reload, real Page execution,
  queued typed navigation, updated rendering, all hooks, removal/disposal, stable keys,
  cancellation, authority denials, nominal event identities and hostile metadata.
- `test/sewn-shared-budget.test.js`: exact-context ledger, cumulative steps/services/
  construction, fatal exhaustion and nested-event budget sharing.
- Retain `test/wbasic-classes.test.js`, `wbasic-families.test.js`, `events.test.js`,
  object-model/SEAM/static-library tests, and all H2 browser/root isolation fixtures.

H3 must reproduce these observable results in Chrome with authentic browser
contexts. Add cross-root forged-handle, root-removal during awaited work, event-storm,
handler-cancellation and teardown tests. Current 14 Chrome H2 tests prove only H2
compatibility, rejection and distribution loading; they do **not** prove browser
methods, hooks, typed events, templates or property-bound presentation execution.

Use a new immutable WydClient version for actual H3 changes, reproducibly build it,
update references/size metadata and run actual artifact fixtures. Shared server code
must never silently rewrite committed artifacts. Git-history guards fail closed when
required history is unavailable. No release/tag/main merge is implied by this handoff.

Cleanup/session termination is best effort at process crash, network loss and browser
close. There is no durable exactly-once delivery promise or authority transfer from
an official event source.
