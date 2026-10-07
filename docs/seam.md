# SEAM foundation — 0.2-A

Authority belongs to an execution context, not to the target object.

The trusted host creates `ExecutionContext` with `publisher`, optional `package`,
`self` (instance ID), `capabilities`, `visible` (instance IDs), `traversal`, and
`limits`. Grants and metadata are copied and deeply frozen. Capability names must
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
arbitrary imported JavaScript. No package code, SEWN, method dispatcher or service
provider is executed in this milestone. The capability guard proves context
retention; future dispatch must preserve it and enforce operation requirements.

Expected failures use `SEAM.CONTEXT`, `SEAM.CAPABILITY`, `SEAM.TRAVERSAL`,
`SEAM.VISIBILITY`, or `SEAM.DENIED`. Wrap synchronous host operations in `resultOf`
to emit safe structured errors without arbitrary internal exception details.
Async dispatch and its error boundary remain deferred with execution itself.

Security tests cover separate traversal/visibility grants, immutable grants,
forged contexts, sibling/root denial, and a confused-deputy fixture in which a
low-authority caller reaches App but cannot use App's separate privileged context.
These are foundation guarantees, not a claim that Wydgit is ready to run hostile
third-party executable packages.
