import { formTree,publicProperties } from './forms.js';
import { validateEnvelope, resolveProperties } from './schema.js';
import { createEdit } from './mutation.js';
import { clean, freeze, jsonKeys, parse, record, requireThat as check, WydgitError } from './validation.js';
import { checkContext } from '../seam/context.js';
export { PrototypeRegistry } from './prototypes.js';
export { WydgitError } from './validation.js';
export { ExecutionContext } from '../seam/context.js';
const graphs = new WeakMap();
export function hydrate(input, registry, { revision = 0 } = {}) {
  check(Number.isSafeInteger(revision) && revision >= 0, 'OBJECT.REVISION', 'Revision must be a non-negative safe integer');
  if (typeof input === 'string') input = parse(input);
  const nodes = new Map(), parents = new Map(), positions = new Map(), active = new Set(), seen = new Set();
  function visit(raw, parent, slot, index, depth = 0) {
    check(depth <= 64 && nodes.size < 10000, 'OBJECT.LIMIT', 'Object tree limit exceeded');
    check(record(raw), 'OBJECT.ENVELOPE', 'Expected object envelope');
    check(!active.has(raw), 'OBJECT.CYCLE', 'Containment cycle');
    check(!seen.has(raw), 'OBJECT.MULTIPLE_PARENTS', 'Object occurs in multiple containment positions');
    active.add(raw); seen.add(raw);
    validateEnvelope(raw);
    check(!nodes.has(raw.id), 'OBJECT.DUPLICATE_ID', `Duplicate instance ID: ${raw.id}`);
    const definition = registry.get(raw.prototype);
    check(!definition.abstract, 'OBJECT.ABSTRACT', 'Cannot instantiate abstract prototype');
    check(parent ? !registry.isA(definition.id, 'wydgit.core/app') : registry.isA(definition.id, 'wydgit.core/app'), 'OBJECT.ROOT', 'Exactly one App must be the root');
    jsonKeys(raw.slots);
    const properties = resolveProperties(raw.properties, definition), provenance = clean(raw.provenance);
    const node = { id: raw.id, prototype: definition.id, properties: freeze(properties), provenance: freeze(provenance), slots: Object.create(null) };
    Object.defineProperty(node,'toJSON',{value:()=>({...node,properties:publicProperties(node,registry)})});
    nodes.set(node.id, node); parents.set(node.id, parent); positions.set(node.id, { slot, index });
    for (const key of Object.keys(raw.slots)) {
      check(!['__proto__','constructor','prototype'].includes(key), 'INPUT.DANGEROUS_KEY', 'Reserved slot key');
      check(Object.hasOwn(definition.slots, key), 'OBJECT.UNKNOWN_SLOT', `Unknown slot: ${key}`);
    }
    for (const key of Object.keys(definition.slots).sort()) {
      const rule = definition.slots[key], children = Object.hasOwn(raw.slots, key) ? raw.slots[key] : [];
      check(Array.isArray(children) && Object.getPrototypeOf(children) === Array.prototype, 'OBJECT.SLOT', 'Slot must be an array');
      jsonKeys(children);
      check(children.length >= (rule.min ?? 0) && children.length <= (rule.max ?? Infinity), 'OBJECT.CARDINALITY', `Invalid cardinality: ${key}`);
      node.slots[key] = Object.freeze(children.map((child, i) => {
        const result = visit(child, node.id, key, i, depth + 1);
        check(rule.accepts.some(base => registry.isA(result.prototype, base)), 'OBJECT.CHILD_TYPE', `Invalid child in slot: ${key}`);
        return result.id;
      }));
    }
    active.delete(raw); return freeze(node);
  }
  const root = visit(input, null, null, 0);
  const semantic=id=>{const n=nodes.get(id);return {prototype:n.prototype,properties:n.properties,slots:Object.fromEntries(Object.entries(n.slots).map(([key,ids])=>[key,ids.map(semantic)]))};};
  formTree(semantic(root.id),registry);
  const runtime = Object.freeze({
    // Host-only APIs: never hand this runtime or its context factory to package code.
    rootId: root.id,
    revision,
    edit(context) { return createEdit(runtime, context, registry, hydrate, dehydrate); },
    get(id) { check(nodes.has(id), 'OBJECT.UNKNOWN', 'Unknown object'); return nodes.get(id); },
    scope(context, startId = context.self) {
      checkContext(context); check(nodes.has(context.self), 'SEAM.CONTEXT', 'Unknown self object');
      const handles = new Map();
      const handle = id => {
        check(context.visible.includes(id), 'SEAM.VISIBILITY', 'Object is not visible');
        check(nodes.has(id), 'OBJECT.UNKNOWN', 'Unknown object');
        if (handles.has(id)) return handles.get(id);
        const node = nodes.get(id);
        const result = Object.freeze({ id, prototype: node.prototype, properties: freeze(clean(publicProperties(node,registry))), provenance: node.provenance,
          related(relation, slotName) {
            check(context.traversal.includes(relation), 'SEAM.TRAVERSAL', 'Traversal denied');
            let ids;
            if (relation === 'children') {
              check(slotName === undefined || Object.hasOwn(node.slots, slotName), 'OBJECT.UNKNOWN_SLOT', 'Unknown slot');
              ids = slotName === undefined ? Object.values(node.slots).flat() : node.slots[slotName];
              return Object.freeze(ids.filter(x => context.visible.includes(x)).map(handle));
            }
            let target;
            if (relation === 'root') target = root.id;
            else if (relation === 'parent') target = parents.get(id);
            else {
              const parentId = parents.get(id), position = positions.get(id);
              if (parentId) target = nodes.get(parentId).slots[position.slot][position.index + (relation === 'nextSibling' ? 1 : -1)];
            }
            return target == null ? null : handle(target);
          },
          requireCapability(capability) { check(context.capabilities.includes(capability), 'SEAM.DENIED', 'Capability denied'); return true; }
        });
        handles.set(id, result); return result;
      };
      return handle(startId);
    }
  });
  graphs.set(runtime, { nodes, root, registry }); return runtime;
}
export function dehydrate(runtime, { includeSensitive = false } = {}) {
  check(graphs.has(runtime), 'OBJECT.RUNTIME', 'Expected hydrated runtime');
  const { nodes, root, registry } = graphs.get(runtime);
  const emit = node => ({ schema: 'wydgit/0.2', id: node.id, prototype: node.prototype, properties: clean(includeSensitive?node.properties:publicProperties(node,registry)), slots: Object.fromEntries(Object.entries(node.slots).map(([key, ids]) => [key, ids.map(id => emit(nodes.get(id)))])), provenance: clean(node.provenance) });
  return emit(root);
}
export function serialize(runtime) { return JSON.stringify(dehydrate(runtime)); }
export function resultOf(operation) {
  try { return { ok: true, value: operation() }; }
  catch (error) { return error instanceof WydgitError ? error.toJSON() : { ok: false, code: 'RUNTIME.INTERNAL', message: 'Operation failed', details: {} }; }
}
