import { clean, freeze, parse, record, requireThat as check, WydgitError } from './validation.js';
import { checkContext } from '../seam/context.js';
export { PrototypeRegistry } from './prototypes.js';
export { WydgitError } from './validation.js';
export { ExecutionContext } from '../seam/context.js';
const graphs = new WeakMap();
export function hydrate(input, registry) {
  if (typeof input === 'string') input = parse(input);
  const nodes = new Map(), parents = new Map(), positions = new Map(), active = new Set(), seen = new Set();
  function visit(raw, parent, slot, index, depth = 0) {
    check(depth <= 64 && nodes.size < 10000, 'OBJECT.LIMIT', 'Object tree limit exceeded');
    check(record(raw), 'OBJECT.ENVELOPE', 'Expected object envelope');
    check(!active.has(raw), 'OBJECT.CYCLE', 'Containment cycle');
    check(!seen.has(raw), 'OBJECT.MULTIPLE_PARENTS', 'Object occurs in multiple containment positions');
    active.add(raw); seen.add(raw);
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    check(Object.values(descriptors).every(d => Object.hasOwn(d, 'value')), 'INPUT.JSON', 'Accessors are not JSON');
    check(Object.keys(raw).every(k => ['schema','id','prototype','properties','slots','provenance'].includes(k)), 'OBJECT.ENVELOPE', 'Unknown envelope field');
    check([Object.prototype, null].includes(Object.getPrototypeOf(raw)), 'INPUT.JSON', 'Expected plain envelope');
    check(raw.schema === 'wydgit/0.2' && typeof raw.id === 'string' && /^[A-Za-z][\w.-]*$/.test(raw.id) && typeof raw.prototype === 'string', 'OBJECT.ENVELOPE', 'Invalid schema or identity');
    check(!nodes.has(raw.id), 'OBJECT.DUPLICATE_ID', `Duplicate instance ID: ${raw.id}`);
    const definition = registry.get(raw.prototype);
    check(!definition.abstract, 'OBJECT.ABSTRACT', 'Cannot instantiate abstract prototype');
    check(parent ? !registry.isA(definition.id, 'wydgit.core/app') : registry.isA(definition.id, 'wydgit.core/app'), 'OBJECT.ROOT', 'Exactly one App must be the root');
    check(record(raw.properties) && record(raw.slots) && record(raw.provenance), 'OBJECT.ENVELOPE', 'Properties, slots and provenance must be objects');
    check([Object.prototype, null].includes(Object.getPrototypeOf(raw.slots)), 'INPUT.JSON', 'Expected plain slots');
    check(Reflect.ownKeys(raw.slots).every(k => typeof k === 'string' && Object.getOwnPropertyDescriptor(raw.slots, k).enumerable && Object.hasOwn(Object.getOwnPropertyDescriptor(raw.slots, k), 'value')), 'INPUT.JSON', 'Expected JSON slot fields');
    const properties = clean(raw.properties), provenance = clean(raw.provenance);
    for (const key of Object.keys(properties)) check(Object.hasOwn(definition.properties, key), 'OBJECT.PROPERTY', `Unknown property: ${key}`);
    for (const [key, rule] of Object.entries(definition.properties)) {
      if (!Object.hasOwn(properties, key) && Object.hasOwn(rule, 'default')) properties[key] = clean(rule.default);
      if (!Object.hasOwn(properties, key)) { check(!rule.required, 'OBJECT.PROPERTY', `Missing property: ${key}`); continue; }
      const v = properties[key], type = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
      check(type === rule.type && (!rule.enum || rule.enum.includes(v)), 'OBJECT.PROPERTY', `Invalid property: ${key}`);
    }
    const node = { id: raw.id, prototype: definition.id, properties: freeze(properties), provenance: freeze(provenance), slots: Object.create(null) };
    nodes.set(node.id, node); parents.set(node.id, parent); positions.set(node.id, { slot, index });
    for (const key of Object.keys(raw.slots)) {
      check(!['__proto__','constructor','prototype'].includes(key), 'INPUT.DANGEROUS_KEY', 'Reserved slot key');
      check(Object.hasOwn(definition.slots, key), 'OBJECT.UNKNOWN_SLOT', `Unknown slot: ${key}`);
      check(Object.hasOwn(Object.getOwnPropertyDescriptor(raw.slots, key), 'value'), 'INPUT.JSON', 'Slot accessor rejected');
    }
    for (const key of Object.keys(definition.slots).sort()) {
      const rule = definition.slots[key], children = Object.hasOwn(raw.slots, key) ? raw.slots[key] : [];
      check(Array.isArray(children) && Object.getPrototypeOf(children) === Array.prototype, 'OBJECT.SLOT', 'Slot must be an array');
      check(Reflect.ownKeys(children).length === children.length + 1 && Object.keys(children).length === children.length && Object.keys(children).every((k, i) => k === String(i) && Object.hasOwn(Object.getOwnPropertyDescriptor(children, k), 'value')), 'INPUT.JSON', 'Expected dense child array');
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
  const runtime = Object.freeze({
    // Host-only APIs: never hand this runtime or its context factory to package code.
    rootId: root.id,
    get(id) { check(nodes.has(id), 'OBJECT.UNKNOWN', 'Unknown object'); return nodes.get(id); },
    scope(context) {
      checkContext(context); check(nodes.has(context.self), 'SEAM.CONTEXT', 'Unknown self object');
      const handles = new Map();
      const handle = id => {
        check(context.visible.includes(id), 'SEAM.VISIBILITY', 'Object is not visible');
        check(nodes.has(id), 'OBJECT.UNKNOWN', 'Unknown object');
        if (handles.has(id)) return handles.get(id);
        const node = nodes.get(id);
        const result = Object.freeze({ id, prototype: node.prototype, properties: node.properties, provenance: node.provenance,
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
      return handle(context.self);
    }
  });
  graphs.set(runtime, { nodes, root }); return runtime;
}
export function dehydrate(runtime) {
  check(graphs.has(runtime), 'OBJECT.RUNTIME', 'Expected hydrated runtime');
  const { nodes, root } = graphs.get(runtime);
  const emit = node => ({ schema: 'wydgit/0.2', id: node.id, prototype: node.prototype, properties: clean(node.properties), slots: Object.fromEntries(Object.entries(node.slots).map(([key, ids]) => [key, ids.map(id => emit(nodes.get(id)))])), provenance: clean(node.provenance) });
  return emit(root);
}
export function serialize(runtime) { return JSON.stringify(dehydrate(runtime)); }
export function resultOf(operation) {
  try { return { ok: true, value: operation() }; }
  catch (error) { return error instanceof WydgitError ? error.toJSON() : { ok: false, code: 'RUNTIME.INTERNAL', message: 'Operation failed', details: {} }; }
}
