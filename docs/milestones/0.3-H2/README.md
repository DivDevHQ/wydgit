# 0.3-H2 — Scoped instances and rendering

WydClient 0.1.0-alpha.3, WydSUB 0.1. Wydgine remains 0.3.0-alpha.7.
H0 canonical inheritance, properties, visibility and ordered named slots remain
authoritative. This stage adds a trusted browser host adapter, not a SEWN executor.

After successful `ready()`, `WydClient.host()` (document) or `handle.host()`
(embedded) returns the frozen host adapter. Never pass this adapter to application
code. Same-realm host JavaScript is trusted; roots are ownership boundaries, not
JavaScript sandboxes. Signatures establish provenance only. Failed bootstrap and
disposed contexts cannot acquire adapters; retained adapters check live state.
Readiness result shape and immutable alpha.1/alpha.2 artifacts are preserved.

```js
const h = WydClient.host();
const draft = h.construct({type:'wydgit.core/block', properties:{
  content:{type:'markdown',value:'Literal text'}
}});
const placed = h.Insert('SUB.Page.default', undefined, 0, draft);
h.Set(placed, 'content', {type:'markdown',value:'Updated'});
h.Remove(placed);
```

`construct({type,properties?})` creates an opaque local draft with unique immutable
identity, inherited defaults and publisher/prototype-version provenance. Signed
package provenance also records package ID and version. Abstract/static and
unsupported semantic classes fail. Only Section/Block descendants are supported.
Incomplete required values and minimum cardinality are allowed in drafts;
attachment requires complete properties/subtrees. IDs are not credentials.

`Insert(parent,slot,index,draft)` uses a logical destination string or a placed/draft
parent token and exact canonical slot. It enforces accepts, cardinality, cycles,
indexes and unique ownership. Nested draft insertion consumes the child reference
and returns null. Final placement consumes the draft and returns a placed token;
`children(parent,slot?)` reacquires ordered child tokens. Draft navigation is denied.
Top/Bottom are adapter destinations; default aliases Bottom. They are not Page
members or arbitrary DOM selectors. Root destination children accept the supported
semantic subset; inner slots obey the canonical prototype contracts.

`Move(ref,index,sibling?,after=false)` reorders within the existing owning slot.
Optional sibling determines before/after position and must share the parent/slot.
There is no ownership-transfer operation. `Set(ref,name,value)` validates exact
properties via H0, through trusted host authority only. `Remove(ref)` disposes its
entire owned subtree and invalidates every alias. `snapshot(ref)` returns frozen
sanitized historical JSON; snapshots and IDs cannot serve as references. Disposed,
consumed, forged, cross-context and pre-remount tokens fail. Slots in host snapshots
contain local child IDs; tokens are obtained only through the trusted adapter.

Logical mutations stage copied state and freshly generated DOM before committing.
Validation and staging failures roll back accepted state and keep prior display.
Updates are synchronous and deterministic, including removal and reordering.
There are at most 256 live draft/owned nodes, 32 containment levels, 262144 JSON
characters of registry state and bounded JSON inputs. Removal reclaims capacity.
Rendering rebuilds the bounded display; no asynchronous application callbacks,
observers or event execution exist. Bootstrap cancellation retains H1b protections.

Rendering maps Section to a structural section and Block to a container, with
ordered canonical child composition. Existing `{type:'markdown',value:String}`
content is intentionally displayed literally, including Markdown syntax; no HTML
parser is used. Only public, discoverable properties without capability requirements
are rendered/exported. Fixed format hooks support align start/center/end, width
normal/wide/narrow, tone plain/muted/hero. Unknown format keys/values and malformed
content fail. No application attributes, URLs, scripts, inline styles, handlers,
HTML IDs or DOM handles are supported. Host CSS may style the fixed classes.
Private generated-node ownership preserves host nodes and independent nested roots
during rerender/removal/unmount, including host relocation into generated elements.
Host DOM containment never becomes Wydgit parentage.

## Examples and H3 boundary

Serve `packages/wydclient` over static HTTP and open `examples/instances.html` or
`examples/instances-embedded.html`. Both use the versioned alpha.3 classic script
without Wydgine/database/build tools on the consuming site. The standalone fixture
constructs nested objects, reorders/removes them and checks the resulting tree.
The embedded fixture additionally checks independent IDs, denied cross-root
references, and continued updates after one root unmounts.

H3 must authenticate a live execution context, bind opaque object references,
check member visibility and SEAM invocation/construction/mutation capabilities,
and share SEWN step/time/construction budgets and cancellation/disposal checks.
The host adapter must never be registered as an unrestricted SEWN facade.
No placeholder grants, general methods, language parser/interpreter, services,
persistence or cross-root references are implemented. This foundation leaves the
0.18 executor and WBasic readiness work unchanged. Firefox/Safari/native adapters,
full Markdown rendering, controls, actions and richer presentations remain deferred.
