# SEAM foundation — 0.2-H

Authority belongs to an execution context, not to the target object.

The trusted host creates `ExecutionContext` with `publisher`, optional `package`,
optional `app` identity, `self` (instance ID), `capabilities`, `scopes`,
`visible` and `editable` (instance IDs),
`traversal`, and `limits`. Grants and metadata are copied and deeply frozen. Capability names must
have exactly the portable `domain.resource.action` shape. Matching is exact;
there are no wildcards or implicit grants. Limits are non-negative integer
metadata for future interpreters; no interpreter or execution budget is claimed.

`runtime.scope(context)` returns a context-bound handle for `self`. Handles expose
only immutable identity, properties and provenance, `related(relation, slot?)`,
and a capability guard `requireCapability(name)`. They do not expose the runtime,
context factory, child ID lists or private parent/sibling indexes.

Defaults are conservative: only self is visible and all traversal and capabilities
are denied. Even same-publisher descendants require explicit visibility and
`children` permission. Supported traversal names are `parent`, `root`, `children`,
`previousSibling` and `nextSibling`. Siblings are adjacent members of the same
named slot. A missing permitted relationship returns null. Invisible singular
targets are denied; children return only visible members, without revealing hidden
IDs. Unknown slots fail explicitly.

Both visibility and traversal permission are necessary. Neither permission grants
capabilities. Every handle reached by traversal remains bound to the original
caller context. A privileged host context for App does not transfer authority to
a child that can see App. Prototype ancestry, containment, publisher metadata and
provenance do not participate in capability checks.

```js
// Trusted host code only:
const context = new ExecutionContext({
  publisher: 'acme', self: 'card-1',
  visible: ['card-2'], traversal: ['nextSibling']
});
const card = runtime.scope(context);
const result = resultOf(() => card.related('nextSibling'));
```

Host code must keep the runtime, registry and context constructor private and pass
only scoped handles across a future package boundary. The constructor is a host
policy primitive, not a package-accessible grant API. This is not a sandbox for
arbitrary imported JavaScript. No arbitrary package code or SEWN is executed. The service dispatcher below
preserves context and enforces operation requirements for approved libraries.

Expected failures use `SEAM.CONTEXT`, `SEAM.CAPABILITY`, `SEAM.TRAVERSAL`,
`SEAM.VISIBILITY`, or `SEAM.DENIED`. Wrap synchronous host operations in `resultOf`
to emit safe structured errors without arbitrary internal exception details.
Async library dispatch has a separate JSON-only result/error boundary described below.

Security tests cover separate traversal/visibility grants, immutable grants,
forged contexts, sibling/root denial, and a confused-deputy fixture in which a
low-authority caller reaches App but cannot use App's separate privileged context.
These are foundation guarantees, not a claim that Wydgit is ready to run hostile
third-party executable packages.

## Mutation authority

`runtime.edit(context)` is a host-only API that requires `object.instances.edit`.
Its operations require every affected ID to be explicitly visible **and** editable;
self is visible by default but is not editable by default. No publisher, ancestry,
containment or provenance field contributes grants. Structural operations also
check affected parents, slot occupants and affected subtrees; prospective IDs for
new objects/clones require explicit grants before creation. Neither successful
mutation nor commit modifies the context or its traversal rights.

The edit session and commit's raw runtime result stay within trusted host code.
Future package dispatch must retain caller authority and expose only scoped handles
and safe results. See [mutation-model.md](mutation-model.md) for the exact operation
checks, conservative scope policy and revision hook. Storage dispatch does not
expose the object edit session or add any capability-grant API.


## Runtime library availability

0.2-C adds host-only library registration, separate from all context grants.
**Libraries provide capabilities. SEAM grants authority.** Registered capability
names do not become permissions on existing or future ExecutionContexts. Library
registration receives no policy/context mutation API. The host registry and raw
service implementations must remain private to trusted code; only caller-bound
facades cross a package boundary. See [library-model.md](library-model.md) for trust approval,
explicit loading, registration and startup failure boundaries.


## Caller-bound library services

0.2-D adds `registry.bind(context)`. Its only method is asynchronous
`call(library, service, input)`, returning `{ok:true,value}` or a structured failure.
Binding requires a branded host-issued context, not a structurally similar object.
Each call checks the service's declared capability and registered authorization
policy, then invokes it with the original context. Input cannot supply a different
caller. Both requests and successful results are copied, JSON-validated and deeply
frozen; implementation functions, adapters and raw Node values cannot cross this
boundary. Unexpected exceptions become `SERVICE.FAILED`, invalid request JSON
becomes `SERVICE.INVALID_REQUEST`, and missing permissions become `SEAM.DENIED`.
Libraries may produce safe codes through the host's `failure(code)` function.

The library policy checks resource scope. For WydStore, `scopes.wydstore` contains
exact `{store, collection}` grants. Capability means what action, scope means where.
The configured store also requires the caller's `app`, `publisher` and `package`
to match its ownership tuple. These host-issued identities are not copied from
untrusted provenance. Missing scopes deny by default; no wildcard or implicit
same-publisher access exists. The context's `scopes` are copied and frozen like
all other grants. Storage access never expands object visibility, traversal,
editable scope or capabilities. See [wydstore.md](wydstore.md) for exact operations.

The registry, context constructor, Node imports and trusted service handlers still
must not be given to ordinary packages. This is a narrow service boundary, not an
in-process sandbox for hostile JavaScript or a package execution environment.


## WydGate and private implementation resources

WydGate requires its declared Gate capability and an exact App grant in
`scopes.wydgate`, matching the caller's `app`. Reading, creating, updating,
authenticating and managing credentials have distinct capability checks. Session,
role and group operations also require explicit capabilities. Returned
users contain no hashes or persistence handles; `authenticate` creates no session,
while `login` creates a revocable session. Neither grants capabilities.

A trusted host can separately approve a runtime library's dependency binding.
The loader creates a private implementation context from that approval; for
WydGate its package identity is `library:wydgate`. WydStore ownership and collection
scope checks protect the credential directory even from ordinary callers that
have generic storage capabilities. This private resource credential never replaces
the caller context on public Gate calls and never crosses the portable boundary.
Libraries cannot mint or change bindings. See [library-model.md](library-model.md)
and [wydgate.md](wydgate.md) for the exact host configuration and limitations.


0.2-G adds optional frozen `ExecutionContext.identity` metadata from trusted host
session resolution. Gate roles/groups/permissions describe domain authorization;
they never populate capabilities, scopes, traversal or visibility. Even identical
permission/capability strings are independent grants. The host must resolve the
session again for each authenticated operation: identity metadata is a snapshot,
not a live revocation mechanism. The context constructor remains host-only and does
not verify an arbitrary supplied identity assertion. See [WydGate](wydgate.md).


## Events and request execution

**Dispatch carries authority. It never manufactures it.** The 0.2-H dispatcher uses
an existing branded ExecutionContext; handler registration and Session identity
cannot union grants or select another principal. Page execution rejects mismatched
App/Session identities. Handles are limited to the request-local Page subtree and
expire with their invocation/request. Local edit intent uses the existing capability
and visibility/edit checks; no snapshot is automatically persisted.

REQUEST/RESPONSE cookie and header methods, file delivery and custom event raises
require capabilities and exact resource scopes. Reserved credential cookies and
host security headers remain inaccessible even with ordinary matching name grants.
WydClient has separate authority and never sends it as proof of server authority.
See [events.md](events.md) for bounds, context lifetimes and the complete contract.
