# Events, lifecycle and HTTP execution — 0.2-H

**Dispatch carries authority. It never manufactures it.**

This implements the runtime contract in `docs/milestones/0.2-H`. Wydgine owns
transport and server execution (see the [0.2-I transport boundary](http-transport.md)); WydClient owns browser adaptation; SEAM owns
runtime authority. SEWN workflows execute through the shared bounded interpreter (see [SEWN](sewn.md)). [WydBASIC](wydbasic.md) source compiles to canonical SEWN before dispatch. The
parameterless JavaScript bridge below is trusted implementation/test code, not a
way to load arbitrary executable Wydgit packages.

## Integration map and ownership

| Concept | Implementation |
| --- | --- |
| Definitions, payloads, dispatcher, contextual handler bridge | `wydgine/events/index.js` |
| Request-local Page lifecycle and safe object handles | `wydgine/execution/page.js` |
| App lifecycle and anonymous Session ownership | `wydgine/execution/lifecycle.js` |
| Gate committed Session transitions | `packages/wydgate/src/core.js`, `sessions.js` |
| Bounded input, response intent, approved file catalog | `wydgine/http/` |
| Replaceable Hono HTTP adapter and startup/shutdown | `wydgine/http/transport/hono.js`, `app.js`, `server.js` |
| DOM adapter and client lifecycle | `wydclient/index.js` |

Canonical containment remains App → Page → content. Session ownership is an
execution relationship, not a serialized parent link or a second canonical root.
Each request hydrates an independent snapshot of canonical App data and restricts
all ordinary handles/edits to the selected Page subtree. App/navigation data outside
that subtree remains available only to the trusted renderer. There is no autosave.

The existing immutable edit API validates local changes and requires
`object.instances.edit`, visibility and edit scopes. These grants do not persist
anything. Durable operations go explicitly through `SERVICES.Call` and the existing
caller-bound library dispatcher. That boundary rechecks the live Session, preserves
the same ExecutionContext and checks library capability/scope/ownership. An already
committed service operation is not rolled back by a later cancelled event.

## Definitions and handlers

Registered types are `Server.Start/Stop`, `Session.Start/Authenticated/Logout/Timeout/End`,
`Page.Start/Initialize/Load/Validate/PreRender/Unload`, `Client.Mount/Ready/Unmount`,
and semantic `Activate`, `Change`, `Submit`. Request/Action/Render are pipeline
stages, not public event hooks. No bubbling or capture exists.

`EventRegistry.define(name,{family:'Custom',cancelable,fields})` registers custom
schemas. Field rules use `type` (JSON types or `json`) and optional `optional:true`.
Extra/missing fields, dangerous keys, non-JSON values and native handles fail before
invocation. Payloads are deeply frozen. Activate permits optional string `Command`;
Change requires `OldValue` and `NewValue`; Submit has an empty payload and reads
semantic field/validation state through scoped handles.

Host registrations use `{type,owner,source?,capability?,run}` or replace `run` with a validated SEWN `workflow` or WydBASIC `wydBasic` source
in declaration order. Exactly one implementation is required; source is compiled
before dispatch. HTTP registrations compile once during pipeline construction.
`source` selects named-source delivery; it defaults to owner. The optional capability
adds a requirement; it never grants authority. All handlers use the dispatch caller's
existing context. No privileged owner context is unioned into it.

```js
const handlers = [{type:'Page.Load', owner:'home', run:async function () {
  if (this.REQUEST.Query.Get('summary') === '1') {
    await this.RESPONSE.WriteMarkdown('# Summary');
    return;
  }
}}];
```

Only empty parameter lists are accepted, including for custom handlers. Contexts
are accessed through `this.ME`, `this.EVENT`, `this.PAGE`, `this.SESSION`,
`this.REQUEST`, `this.RESPONSE`, `this.SERVER` and `this.CLIENT` where available.
Missing contexts raise `EVENT.CONTEXT`. Async invocations get independent bindings;
retained bindings/handles reject after the invocation or request ends. Trusted
host adapters additionally have scoped `FILESYS.Get(id)` and `SERVICES.Call(...)`.
Neither exposes a registry, provider, context factory, native file or raw transport.

EVENT has Type, Source, Target, Payload, Cancelable, Cancelled, writable boolean
Handled, Cancel(), and Change-only OldValue/NewValue aliases. ME is the handler
owner, which may differ from Source/Target for named-source handlers. Source/Target
are scoped handles; Page lifecycle Source is Page and Target is each recipient.
`EVENT.Raise(type, ME, payload)` queues a custom event under `event.custom.raise`
and exact `scopes.events` type grants. Forged/foreign handles are rejected.

Host dispatch results include a safe `wydgit.event/0.1` envelope: runtime, App,
Session/Page IDs where applicable, type, source/target IDs, payload and cancellation
metadata. Authority stays outside it. HTTP clients cannot select these contexts.

Cancel stops subsequent semantic handlers and suppresses its default. Handled stops
subsequent semantic handlers but permits the default. Lifecycle Cancel fails;
Handled does not stop lifecycle traversal. Invalid Submit still invokes handlers,
but cannot execute its registered default. A successful default must explicitly
perform persistence and replace local content; validity alone is not success.

Raised custom events run FIFO after the current dispatch/default. Handlers are
awaited sequentially. Default limits per server dispatcher are 64 queued events,
256 dispatches, 2,048 handler calls, 16 raised-event generations, 16 KiB payload
characters/depth 16, and a five-second cooperative execution deadline. Context
`eventQueue`, `eventDispatches`, `eventHandlers`, `eventDepth`, `eventTimeMs` limits
may reduce these. Cleanup has a separate bounded dispatcher so a normal-phase
failure does not consume cleanup's budget. Client dispatch drains reset budgets
between native events and bound pending native inputs to 64.

Timeout invalidates contextual facades; it cannot forcibly interrupt synchronous
trusted JavaScript or undo an external operation already underway. This is not a
hostile-JavaScript sandbox. Unexpected errors become `EVENT.HANDLER_FAILED`; bounds,
invalid input and access failures retain structured codes without native details.

## Page pipeline and local mutation

Production HTTP requests now resolve the route and Session before content handlers.
Anonymous Sessions are valid. Every executed Page receives its Session safe view.
A host `execution.context` callback selects grants independently of identity;
the default has no capabilities and only visibility of the selected Page subtree.
A context from a different App or authenticated Session is rejected.

Pipeline: Request → root-only Start → Initialize → Load → Validate → Action →
PreRender → trusted Render → Unload. GET has no synthetic action. Normal phases
snapshot recipients in depth-first, parent-first order. Slot order follows the
existing canonical model's normalized lexical slot order; insertion order is
preserved inside slots. This uses the existing deterministic slot contract rather
than raw authored JavaScript property iteration.

A bounded initialization queue processes new objects exactly once. Added objects
join the next phase after initialization; removed objects are skipped in ordinary
phases but remain in the cleanup ledger. PreRender additions initialize/render
without hidden Load/Validate/Action replay. Unload reverses the initialization
ledger, including removed participants. It runs after early responses and failures;
cleanup errors are recorded separately from the primary error. Start owns the
constructed Page root, so even early Start completion cleans up that root.

Handles expose immutable identity/properties, mediated `related`, and scoped local
`Set`, `Insert`, `Remove`, `Replace`, `Move` operations. Cross-Page operations,
foreign handles, Page-root removal/reparenting, and render/Unload mutations fail.
Canonical state and concurrent request trees never alias these changes.

Minimal Form/Field prototypes support semantic value, required, valid, errors and
warnings. POST binding permits only declared field names; values bind before Load.
Required-field validation precedes Validate handlers and Submit. The renderer owns
HTML and error presentation; application validation data contains no CSS/DOM nodes.

Host action registrations are `{page,target,type,method:'POST',capability,run}`;
`workflow` or `wydBasic` replaces `run` under the same exclusive implementation rule.
Server checks known action/target, owning Session, payload schema, method and grants.
POST uses `_target`, `_action`, `_csrf` plus named form values; Change additionally
uses `value`, with OldValue resolved by the server. Each action runs once per request;
there is no durable replay/deduplication queue. CSRF tokens are bound to the Session:
anonymous tokens are random, authenticated tokens are derived from the secret bearer
credential, which is never exposed. Missing/mismatched tokens fail before content
execution. Client claims cannot select capabilities or an ExecutionContext.

## Server and Session lifecycle

App activation emits Server.Start once. `server.js` graceful SIGINT/SIGTERM shutdown
closes the listener and emits Stop once. These handlers have SERVER/ME/EVENT only;
there are no fabricated Page/HTTP/Session contexts.

Gate 0.1.0-alpha.3 emits safe host notifications after successful WydStore CAS commits.
Login emits Start then Authenticated. Logout commits revocation before Logout then
End. Authoritative expiry is discovered by Gate on its next authorized service call,
commits revocation, then emits Timeout and End. Administrative revocation, disabling
and password changes emit End for newly revoked Sessions. Failed/retried CAS writes
cannot duplicate terminal notifications; persisted revoked markers make repeated
resolution inert. Observer failures cannot resurrect state or suppress later End.

The loader's optional host `lifecycle(libraryId,event)` callback receives copied,
frozen metadata, never tokens/hashes. Wydgine filters Gate notifications and dispatches
under a separately supplied lifecycle ExecutionContext. Identity grants nothing.
Delivery is local, post-commit, best effort—not a durable event queue. A crash between
commit and notification can lose a notification; no cross-server coordination or
replay is claimed. In-flight operations may finish, but later privileged facade
calls re-resolve authenticated Sessions before calling services.

When Gate is disabled, Wydgine maintains at most 1,024 anonymous Sessions in memory,
with one-hour absolute expiry and request-triggered expiry processing. It issues
reserved `__Host-wydgit-session` cookies with Secure, HttpOnly, SameSite=Lax, Path=/.
An explicitly supplied Gate resolver context can consume host-owned
`__Host-wydgit-auth`; forged, expired or revoked credentials fail closed rather than
falling back to anonymous. No login UI, auth-cookie issuance endpoint or browser
credential persistence feature was added. A trusted host owns that transport policy.

## REQUEST and RESPONSE

REQUEST is read-only: Method, Path, Route, Query, Form, Cookies, IsPost. Query/Form
Get returns null for missing, rejects ambiguous repeats; GetAll returns every value
in input order. Parsing rejects invalid percent encodings, dangerous keys and NULs.
Limits are 32 KiB text, 128 entries, 128-character keys, 8 KiB values, 2 KiB paths.
Cookie input is bounded to 8 KiB; no raw header bag, socket or parser object escapes.

Response intent follows Open → Committed → Complete. Normal rendering supplies one
body. WriteMarkdown/SendFile validate fully before committing explicit intent; denial
leaves Open. Remaining normal phases/rendering are skipped, Unload still runs, and
Wydgine transmits exactly one body. Nothing may write in Unload or after commitment.
Transport failure closes the resource/connection without a replacement body.

| Operation | SEAM requirement |
| --- | --- |
| Status (bounded 200/201/202/400/403/404/409/422/500) | `response.status.write` |
| WriteMarkdown | `response.markdown.write` |
| SendFile | `response.files.send` plus `files.resources.read` and file ID scope |
| Headers.Set/Remove | `response.headers.write`, exact lowercase `scopes.headers` |
| REQUEST.Cookies.Get | `request.cookies.read`, `scopes.cookies` name |
| RESPONSE.Cookies.Set/Delete | `response.cookies.write`, cookie name/path grant |
| CLIENT.Cookies.Get | `client.cookies.read`, cookie name grant |

Markdown uses the existing marked/sanitize-html pipeline, now with raw HTML tokens
disabled. Input is bounded to 64 KiB characters and rendered output to 256 KiB;
trusted content type is HTML. There is no raw HTML/body/JSON/redirect API.

Application headers are limited to Cache-Control, Content-Language and Vary, with
name scopes, case normalization and serialization checks. Framing, Set-Cookie,
Content-Type, Location and security headers cannot be set/removed by ordinary code.
CSP and nosniff stay host-owned. Form actions are permitted only to self; the demo
still runs no arbitrary scripts. Client ES modules are served through an explicit
allowlist under `/runtime/`, not an unrestricted source-directory route.

Cookie grants are `{name,path:'/'}`; Domain overrides and other paths are not
implemented. Server cookies require Secure and HttpOnly; SameSite is Lax or Strict,
MaxAge is bounded seconds. Delete uses the same fixed path and no domain. Names
starting with `wydgit-`, `__Host-wydgit-`, or `__Secure-wydgit-` are reserved regardless
of grants. Raw credential cookies never reach ordinary code. WydClient reads only
browser-visible, nonreserved, granted cookie names; it has no write API. Cookie
values remain untrusted input, never identity.

## Approved file responses

No WydFiles/FileSys package existed. `fileCatalog(root, entries)` is a deliberately
small **host-only** approved-resource adapter, not a general filesystem library.
Host entries map opaque IDs to local relative files and trusted media metadata.
Ordinary code only gets FILESYS.Get(id) handles; paths, streams and buffers are never
public inputs/results. Read and response permissions are independent and rechecked.

The catalog rejects path traversal/absolute inputs and symlinks; open uses NOFOLLOW,
regular/single-link checks and a 16 MiB maximum. Streaming uses trusted 64 KiB chunks
and handles backpressure/disconnect cleanup. Trusted plain text/PDF/PNG/JPEG metadata
is supported; unknown/active types become binary attachments. Inline/override types
are denied. Display filenames are bounded ASCII, not paths. nosniff is enforced.
As with WydStore, the approved local root must not be writable by an untrusted OS
actor; this is not protection against privileged pathname races or filesystem changes.

## WydClient

`mountClient({nodes,context,handlers,readCookies,submit})` is a trusted browser-adapter
entry point. Nodes contain renderer elements only at this host boundary. They are
normalized into deterministic depth-first order. Mount precedes Ready, both
parent-first; Unmount is reverse and releases listeners/handles, including failures.
Remount creates a fresh cycle. Server rendering alone does not mount anything.

Native click/change/submit map to Activate/Change/Submit with schema-safe payloads.
No native event, document/window/HTMLElement, selector or DOM writer reaches handlers.
Cancelled Change reconciles the element to its previous committed value. Submit is
intercepted with preventDefault before semantic dispatch, so native navigation and
registered submission do not both run. The trusted submit adapter requires
`client.actions.submit` plus target in `scopes.actions`; any server request still
crosses the normal Session/CSRF/SEAM checks. There is no automatic authority tunnel.

The existing demo has no client behavior declarations and is not redesigned to add
one. Tests use native EventTarget inputs for the adapter and real HTTP integration
for server forms. No browser automation framework was present or added.

## Compatibility, verification and deferred work

Platform is 0.2.0-alpha.16; Gate is independently 0.1.0-alpha.3. Gate's private
`wydgate.local/0.2` schema remains unchanged; expiry now records revocation/history.
The pre-existing 0.2-F→G storage incompatibility remains; no destructive migration.
There was no prior public event/handler/HTTP facade to migrate. Existing pure
renderer APIs remain, while createApp/createHostApp now use the Page pipeline.
Raw HTML tokens inside Markdown are deliberately disabled across both response and
content rendering. Default demo routes/appearance are otherwise retained.

No additional WydStitch dialect, WydFiles package, distributed event transport,
WebSockets, new renderer, arbitrary HTTP client, uploads, cookie login UI, cache,
redirect/JSON response API, capture/bubbling, or unrestricted host execution is added.

Browser manual verification could not run in the supplied environment: the UI tool
reported no browsers and opening the in-app browser failed. HTTP startup/navigation,
request flows and native EventTarget adapter tests are separate verification; they
are not represented as visual browser results. This leaves manual browser acceptance
unverified, even when the automated repository checks pass.

## 0.2-L source-declared event modules

Handler records now select exactly one of `run`, `workflow`, `wydBasic`, or
`wydBasicModule`. A module record is `{owner:'home', wydBasicModule:source}` and
contains parameterless `EVENT Page.Load ... END EVENT` (or other registered events)
plus shared SUB/FUNCTION declarations. Modules omit the registration `type`, because
the source declares it. `prepareHandlers(records, registry)` expands these at setup
into ordinary `{owner,type,workflow}` records; canonical `sewn/0.2` or `sewn/0.3` executes.
HTTP setup, direct Page preparation, server lifecycle construction and WydClient
construction compile before dispatch. The HTTP runtime module allowlist includes
the browser-safe compiler/executor dependency closure; host/provider modules stay
private. Existing body-source, workflow and trusted JS
registrations continue working. See [WydBASIC](wydbasic.md) for syntax.

Registry `resolve(name)` requires exactly one case-insensitive match. Unknown custom
events must be defined first; ambiguous case variants fail, as do duplicate EVENT
blocks within one module. Lifecycle owner/source selection, FIFO order, cancellation,
defaults and cleanup are unchanged. ME remains the owner; EVENT.Source and Target
remain dispatch metadata. Procedures reuse the exact caller contexts and authority.
Registration does not fabricate client/server contexts or cause events to dispatch.

For an HTTP action, `{page,target,type,method,capability,wydBasicModule}` can declare
exactly the one routed EVENT (e.g. Submit), with any shared procedures. Its ME is the
routed target; an explicit different owner is rejected. `prepareAction` selects that
validated workflow. Page/target/HTTP method, Session authorization, required SEAM
capabilities, anti-forgery and semantic validation still belong to trusted action
metadata and the existing Page pipeline. Source cannot weaken these gates.
A multi-event handler module and action metadata remain distinct registration forms.

The real HTTP proof in `test/wydbasic-module-integration.test.js` uses only portable
module source for Submit behavior: FUNCTIONs validate/save a form value through
WydStore and a SUB replaces the request-local form with rendered Thank you.


0.2-M Page dispatch supplies the model's trusted prototype registry to SEWN,
including action/default/cleanup dispatch. Methods preserve the invocation guard
and caller context. Modules using NEW/prototype calls select `sewn/0.3`; older
modules retain `sewn/0.2`. WydClient can explicitly supply `prototypeRegistry` and
portable prototype/property projections for read-only method dispatch, without
server mutation/service facades. See [object model](object-model.md) for transient
draft consumption and [WydBASIC](wydbasic.md) for the source API. The real HTTP
construction proof is `test/wydbasic-construction-http.test.js`.


## 0.2-N portable Forms

POST population now discovers every descendant Field of the target Form and adapts input into typed semantic values. Validation precedes Submit; invalid submission preserves ordinary values and validation messages while suppressing the action default. PasswordInput is never echoed in web output. WydClient uses the same semantic rules and validates before Submit. See [forms.md](forms.md).


## 0.2-P local packages

Normal startup activates cataloged declarative Page lifecycle and semantic action bindings through existing WydBASIC/SEWN event machinery. No package JavaScript runs. One package principal per Page is enforced. See [packages](packages.md).
