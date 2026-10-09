import { clean, freeze, requireThat as check, WydgitError } from './validation.js';
import { validId, copyEnvelope } from './schema.js';
import { checkContext } from '../seam/context.js';

// This factory and commit result belong to the host. Never expose the raw runtime
// to packages; a future dispatcher can forward requests with the caller context.
export function createEdit(original, context, registry, hydrate, dehydrate) {
  checkContext(context);
  const authorize = ids => {
    check(context.capabilities.includes('object.instances.edit') && ids.every(id => context.visible.includes(id) && context.editable.includes(id)), 'MUTATION.DENIED', 'Mutation denied');
  };
  authorize([]);
  original.get(context.self);
  const baseRevision = original.revision;
  let working = dehydrate(original,{includeSensitive:true}), closed = false;
  const index = root => {
    const entries = new Map();
    const visit = (node, parent = null, slot = null, position = 0) => {
      entries.set(node.id, { node, parent, slot, position });
      for (const [key, children] of Object.entries(node.slots)) children.forEach((child, i) => visit(child, node.id, key, i));
    };
    visit(root); return entries;
  };
  const initial = index(working), reserved = new Set(initial.keys()), explicitMoves = new Set();
  const open = () => check(!closed, 'MUTATION.CLOSED', 'Edit session is closed');
  const get = (entries, id) => {
    authorize([id]);
    check(entries.has(id), 'MUTATION.NOT_FOUND', 'Object not found');
    return entries.get(id);
  };
  const subtree = node => {
    const ids = [node.id];
    for (const children of Object.values(node.slots)) for (const child of children) ids.push(...subtree(child));
    return ids;
  };
  const slotAt = (entries, parentId, name) => {
    const parent = get(entries, parentId).node;
    check(typeof name === 'string' && Object.hasOwn(parent.slots, name), 'MUTATION.INVALID_SLOT', 'Unknown slot');
    authorize(parent.slots[name].map(child => child.id));
    return parent.slots[name];
  };
  const positionAt = (children, position) => check(Number.isInteger(position) && position >= 0 && position <= children.length, 'MUTATION.INDEX', 'Invalid child position');
  const removable = (entries, id) => {
    const entry = get(entries, id);
    check(entry.parent !== null, 'MUTATION.IDENTITY', 'App root cannot be removed or reparented');
    slotAt(entries, entry.parent, entry.slot);
    authorize([entry.parent, ...subtree(entry.node)]);
    return entry;
  };
  const validated = root => {
    try { return hydrate(root, registry, { revision: baseRevision }); }
    catch (error) {
      const codes = { 'OBJECT.PROPERTY':'MUTATION.INVALID_PROPERTY', 'OBJECT.UNKNOWN_SLOT':'MUTATION.INVALID_SLOT', 'OBJECT.SLOT':'MUTATION.INVALID_SLOT', 'OBJECT.CHILD_TYPE':'MUTATION.CHILD_TYPE', 'OBJECT.CARDINALITY':'MUTATION.CARDINALITY', 'OBJECT.DUPLICATE_ID':'MUTATION.DUPLICATE_ID', 'OBJECT.CYCLE':'MUTATION.CYCLE' };
      if (error instanceof WydgitError && codes[error.code]) throw new WydgitError(codes[error.code], error.message);
      throw error;
    }
  };
  // Copy before each operation. Neither caller-owned inputs nor failed candidate
  // operations can alias or damage the accepted working snapshot.
  const apply = operation => {
    open();
    const candidate = dehydrate(validated(working),{includeSensitive:true});
    operation(candidate, index(candidate));
    const next = dehydrate(validated(candidate),{includeSensitive:true});
    const ids = [...index(next).keys()];
    working = next;
    ids.forEach(id => reserved.add(id));
  };
  const fresh = (entries, parentId, slot, position, envelope, replaceId) => {
    const children = slotAt(entries, parentId, slot);
    positionAt(children, position);
    const incoming = copyEnvelope(envelope);
    const ids = subtree(incoming);
    authorize(ids);
    for (const id of ids) check(!reserved.has(id), 'MUTATION.DUPLICATE_ID', 'Instance ID is reserved in this session');
    children.splice(position, replaceId ? 1 : 0, incoming);
  };
  const changes = () => {
    const current = index(working);
    const local = entry => JSON.stringify({ properties: entry.node.properties, slots: Object.fromEntries(Object.entries(entry.node.slots).map(([key, children]) => [key, children.map(c => c.id)])) });
    const result = { added: [], modified: [], moved: [], removed: [] };
    for (const [id, entry] of current) {
      if (!initial.has(id)) result.added.push(id);
      else {
        const before = initial.get(id);
        if (local(before) !== local(entry)) result.modified.push(id);
        if (explicitMoves.has(id) && (before.parent !== entry.parent || before.slot !== entry.slot || before.position !== entry.position)) result.moved.push(id);
      }
    }
    for (const id of initial.keys()) if (!current.has(id)) result.removed.push(id);
    Object.values(result).forEach(ids => ids.sort());
    return freeze(result);
  };
  const property = (id, name, value, remove) => apply((_root, entries) => {
    const node = get(entries, id).node;
    check(typeof name === 'string' && !['id','prototype','schema','provenance','slots'].includes(name), 'MUTATION.IDENTITY', 'Envelope identity and metadata are not editable properties');
    check(!['__proto__','constructor'].includes(name), 'INPUT.DANGEROUS_KEY', 'Reserved property key');
    check(Object.hasOwn(registry.get(node.prototype).properties, name), 'MUTATION.INVALID_PROPERTY', 'Unknown property');
    if (remove) delete node.properties[name]; else node.properties[name] = clean(value);
  });
  const edit = {
    baseRevision,
    setProperty(id, name, value) { property(id, name, value, false); },
    resetProperty(id, name) { property(id, name, undefined, true); },
    insertChild(parentId, slot, position, envelope) {
      apply((_root, entries) => { fresh(entries, parentId, slot, position, envelope); });
    },
    remove(id) {
      apply((_root, entries) => { const entry = removable(entries, id); entries.get(entry.parent).node.slots[entry.slot].splice(entry.position, 1); });
    },
    moveChild(id, parentId, slot, position) {
      apply((_root, entries) => {
        const entry = removable(entries, id);
        check(!subtree(entry.node).includes(parentId), 'MUTATION.CYCLE', 'Cannot move an object into its subtree');
        const children = slotAt(entries, parentId, slot);
        entries.get(entry.parent).node.slots[entry.slot].splice(entry.position, 1);
        positionAt(children, position); // index is in the destination after removal
        children.splice(position, 0, entry.node);
      });
      explicitMoves.add(id);
    },
    replaceChild(id, envelope) {
      apply((_root, entries) => { const entry = removable(entries, id); fresh(entries, entry.parent, entry.slot, entry.position, envelope, id); });
    },
    cloneChild(id, parentId, slot, position, idPairs) {
      open();
      const entry = get(index(working), id);
      authorize(subtree(entry.node));
      const pairs = clean(idPairs);
      check(Array.isArray(pairs) && pairs.every(pair => Array.isArray(pair) && pair.length === 2 && validId(pair[0]) && validId(pair[1])), 'MUTATION.IDENTITY', 'Expected old/new ID pairs');
      const mapping = new Map(pairs);
      const ids = subtree(entry.node);
      check(pairs.length === ids.length && mapping.size === ids.length && ids.every(old => mapping.has(old)), 'MUTATION.IDENTITY', 'Clone requires a complete valid ID map');
      // Internal canonical data is already validated and contains no executable values.
      const copy = JSON.parse(JSON.stringify(entry.node));
      for (const { node } of index(copy).values()) node.id = mapping.get(node.id);
      edit.insertChild(parentId, slot, position, copy);
    },
    changes() { open(); return changes(); },
    commit({ currentRevision = baseRevision } = {}) {
      open();
      check(currentRevision === baseRevision, 'MUTATION.CONFLICT', 'Base revision does not match current revision');
      check(baseRevision < Number.MAX_SAFE_INTEGER, 'MUTATION.CONFLICT', 'Revision exhausted');
      const runtime = hydrate(working, registry, { revision: baseRevision + 1 });
      const result = Object.freeze({ runtime, baseRevision, revision: runtime.revision, changes: changes() });
      closed = true; return result;
    },
    abort() { open(); closed = true; }
  };
  return Object.freeze(edit);
}
