# Mutation model — 0.2-B

Hydrated Wydgits remain immutable. An explicit edit session holds the original
snapshot, a private working tree and a net change set. There is no writable
`runtime.get(id)` surface, and no detached-object staging area.

```js
import { ExecutionContext } from '../wydgine/object-model/index.js';

// Host policy establishes grants. Packages cannot mint execution contexts.
const context = new ExecutionContext({
  publisher: 'acme', self: 'card-1',
  capabilities: ['object.instances.edit'],
  visible: ['card-1'], editable: ['card-1']
});
const edit = runtime.edit(context);
edit.setProperty('card-1', 'title', 'Updated title');
const { runtime: nextRuntime, changes, baseRevision, revision } = edit.commit();
```

The runtime, session and commit's full runtime result are **host APIs**. A future
package dispatcher must forward requests using the original caller's context and
return scoped handles or safe results, never the raw runtime. No dispatcher or
package execution is introduced here. Holding a runtime alone does not authorize
its edit API: a genuine context and explicit grants are mandatory.

## Operations

| Operation | Behavior |
| --- | --- |
| `setProperty(id, name, value)` | Replace a declared property with JSON data; nested updates replace the whole value. |
| `resetProperty(id, name)` | Remove an optional property, or restore its prototype default. A required property without a default cannot be removed. |
| `insertChild(parentId, slot, index, envelope)` | Create and attach a fresh object/subtree in one operation. No separate unattached create operation. |
| `remove(id)` | Delete the object and its entire contained subtree. |
| `moveChild(id, parentId, slot, index)` | Reorder or move the subtree, preserving every ID and prototype. The index is measured in the destination **after** removal from the source. |
| `replaceChild(id, envelope)` | Atomically delete a subtree and insert a new one at the same position. Useful for required single-child slots. |
| `cloneChild(id, parentId, slot, index, idPairs)` | Copy a subtree with an explicit complete array of `[oldId, newId]` pairs. Every destination ID must be fresh. |
| `changes()` | Return a frozen net change report without exposing the working tree. |
| `commit({ currentRevision }?)` | Revalidate, check the base revision, close the session, and return a new immutable runtime plus changes/revisions. |
| `abort()` | Close the session without producing a new runtime. |

All operation return values except `changes()` and `commit()` are undefined.
Successful commit/abort closes the session; subsequent calls fail with
`MUTATION.CLOSED`. Failed operations and failed commits leave it open for repair
or retry. References to caller-supplied envelopes and property values are never
retained. There is no provenance, ID or prototype editing operation.

## Identity and lifecycle

IDs must satisfy the same rules as hydration; no IDs are generated. Titles, slugs
and moves do not affect identity. Every original ID and every successfully added
ID remains reserved for the entire session, even after deletion. Delete/recreate
or replace using that same ID fails. A failed insertion does not reserve IDs.
Cross-session historical ID reservation is a future host/persistence concern.

Cloning requires exactly one mapping for every source descendant and the source
root. Mapping IDs are JSON string values, so IDs such as `constructor` remain
usable without dangerous object keys. Cloning copies properties and provenance
but does not rewrite arbitrary ID-valued properties such as navigation targets.
Provenance stays inert. App cannot be removed, reparented, replaced, or inserted as
a second root. A descendant can be preserved by moving it out before deleting its
ancestor, provided both operations individually satisfy the containment rules.

Change reports contain sorted `added`, `modified`, `moved`, and `removed` ID arrays:

- `added`: IDs present only in the final working tree.
- `removed`: original IDs absent from that tree, including removed descendants.
- `modified`: surviving original objects whose properties or direct slot ID arrays
  differ. Structural edits therefore modify the affected parents.
- `moved`: surviving original IDs explicitly moved whose final parent, slot or
  index differs. Incidental sibling index shifts are not separate move records;
  the owning parent's modified slots represent them.

Unchanged objects appear in none of these arrays. An object can be both modified
and moved. Added then removed objects disappear from the net report, but their IDs
remain reserved. Reverting a change clears its net dirty state. Descendants moved
with their ancestor retain identity and do not acquire individual move records
unless explicitly moved. This is a net change set, not an audit/event log or a
field-level persistence tracker.

## Validation and atomicity

Each operation copies the accepted working tree, makes its candidate change, and
runs the same canonical hydration validation. The candidate replaces working state
only after validation succeeds. Minimum/maximum cardinality, child types,
properties, duplicate IDs, cycles and single-root/single-parent containment apply
immediately. Invalid intermediate states are deliberately unsupported. Use replace
for a required slot rather than remove followed by insert.

Commit validates again. Failed operations/commits cannot modify the original
runtime or previously accepted working state. Successful commit always produces a
new immutable snapshot, even for a no-op edit. Implementation uses whole-tree
copying/validation for simplicity; it is intended for small bounded trees, not
high-volume edits. There is no bulk editing, undo, merge or persistence engine.

Expected errors retain `INPUT.*`, `OBJECT.*`, and `PROTOTYPE.*` codes for malformed
canonical data and prototype failures. Mutation-specific failures use
`MUTATION.DENIED`, `NOT_FOUND`, `IDENTITY`, `INVALID_PROPERTY`, `INVALID_SLOT`,
`INDEX`, `CHILD_TYPE`, `CARDINALITY`, `DUPLICATE_ID`, `CYCLE`, `CONFLICT`, and
`CLOSED` (all with the `MUTATION.` prefix). Wrap host calls in `resultOf` at a
synchronous SEAM boundary to hide unexpected internal exceptions.

## Authority

The caller must have `object.instances.edit`, and every affected ID must be in
both its `visible` and `editable` scopes. Property changes require the target ID.
Structural edits require the affected parent(s), every direct child in the affected
slots, and every ID in a moved/deleted/replaced subtree. Cloning also requires its
complete source subtree. Requiring the existing slot occupants prevents index and
cardinality errors from exposing hidden sibling structure. This is intentionally
conservative; containment and publisher identity grant no implicit rights.

Every inserted/clone ID must already be explicitly visible and editable in the
host-issued context. Prospective grants do not create objects. Edits never extend
visibility, traversal, edit scope or capabilities. Traversal grants are independent:
editing a known authorized ID does not grant parent/root/sibling navigation.

## Revision hook

`hydrate(json, registry, { revision: 0 })` accepts a host-provided non-negative
safe integer; the default is zero. `runtime.revision` and `edit.baseRevision` are
immutable. `commit({currentRevision})` requires equality with the base and returns
revision `base + 1`. Exhausting the safe-integer range fails explicitly.

Omitting `currentRevision` compares against the base itself. The hook does **not**
fetch an authoritative head, lock, publish, or prevent concurrent branches. Two
sessions from the same base can independently produce the same numeric revision.
A future host must compare and publish atomically against its authoritative
revision; passing a stale value here provides no concurrency protection.

Revision is external snapshot metadata, not an object property and not serialized
in the six-field canonical envelope. A host must preserve it separately when
rehydrating. App's display `properties.revision` is project release text and is
unrelated to this concurrency hook. No WydStore coupling is introduced.


0.2-H wraps these host edit operations in scoped request-local Page handles. Each
operation still validates an immutable snapshot; request-wide retired IDs remain
reserved across operations. No commit publishes canonical state. Renderer/Unload
phases deny edits, and authoritative services require independent grants. See
[events.md](events.md) for the separate lifecycle initialization/cleanup ledger.


## 0.2-M construction consumption

SEWN may pass an opaque invocation-local draft to scoped `Insert` or `Replace` in
addition to the existing JSON descriptor. The executor materializes a complete
validated candidate subtree; the existing edit session remains the only runtime
attachment path. No mutation or prototype-resolution hierarchy is duplicated.
ID reservation, slot types/cardinality, permission checks and atomic commits are
unchanged. A denied/invalid insertion never consumes the draft or partially attaches
its data. Successful attachment consumes the token; aliases cannot insert or mutate
it again. The attached instance is reached with normal scoped handles and unchanged
caller grants. Request-local attachment does not modify persisted App state.

Draft-to-draft `Insert` is a private builder operation: it validates the complete
child, slot acceptance, maximum cardinality, graph IDs/depth/count and total size,
then copies it into the parent and consumes the child token atomically. The parent
can still be incomplete until final attachment. These are transient builders, not
detached runtime edit sessions. See [object model](object-model.md) for lifecycle,
construction authority and [SEWN](sewn.md) for hard bounds.


## 0.2-N portable Forms

Every accepted candidate also validates Form ancestry and unique descendant field names. Insert, Replace, Move and private draft assembly cannot conceal a Form beneath another Form, even through Blocks/Sections. Bind/Validate/Clear use existing atomic edit validation and authority; edits preserve transient sensitive state internally. See [forms.md](forms.md).
