import {declaration} from '../execution/placement.js';
import { clean, jsonKeys, record, requireThat as check } from './validation.js';
export const SCHEMA = 'wydgit/0.2';
export const validId = id => typeof id === 'string' && /^[A-Za-z][\w.-]*$/.test(id);
export const envelopeFields = Object.freeze(['schema', 'id', 'prototype', 'properties', 'slots', 'provenance']);
export function validateEnvelope(raw) {
  check(record(raw), 'OBJECT.ENVELOPE', 'Expected object envelope');
  check([Object.prototype, null].includes(Object.getPrototypeOf(raw)), 'INPUT.JSON', 'Expected plain envelope');
  const keys = Reflect.ownKeys(raw);
  const schema = Object.getOwnPropertyDescriptor(raw, 'schema')?.value;
  const fields = schema === 'wydgit/0.3' && Object.hasOwn(raw, 'execution') ? [...envelopeFields, 'execution'] : envelopeFields;
  check(keys.length === fields.length && keys.every(k => fields.includes(k)), 'OBJECT.ENVELOPE', 'Expected exactly the canonical envelope fields');
  check(keys.every(k => { const d = Object.getOwnPropertyDescriptor(raw, k); return d.enumerable && Object.hasOwn(d, 'value'); }), 'INPUT.JSON', 'Expected enumerable JSON fields');
  check([SCHEMA, 'wydgit/0.3'].includes(raw.schema) && validId(raw.id) && typeof raw.prototype === 'string', 'OBJECT.ENVELOPE', 'Invalid schema or identity');
  if (Object.hasOwn(raw, 'execution')) declaration(raw.execution);
  check(record(raw.properties) && record(raw.slots) && record(raw.provenance), 'OBJECT.ENVELOPE', 'Properties, slots and provenance must be objects');
}
export function resolveProperties(input, definition, { incomplete = false } = {}) {
  const properties = clean(input);
  for (const key of Object.keys(properties)) check(Object.hasOwn(definition.properties, key), 'OBJECT.PROPERTY', 'Unknown property');
  for (const [key, rule] of Object.entries(definition.properties)) {
    if (!Object.hasOwn(properties, key) && Object.hasOwn(rule, 'default')) properties[key] = clean(rule.default);
    if (!Object.hasOwn(properties, key)) { check(incomplete || !rule.required, 'OBJECT.PROPERTY', 'Missing required property'); continue; }
    const v = properties[key], type = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    check((Array.isArray(rule.type)?rule.type:[rule.type]).includes(type) && (!rule.enum || rule.enum.includes(v)), 'OBJECT.PROPERTY', 'Invalid property value');
  }
  // Multi-select has an empty collection default; explicit authored values remain intact.
  if((definition.id==='wydgit.core/select'||definition.ancestors?.includes('wydgit.core/select'))&&properties.multiple&&!Object.hasOwn(input,'value')&&definition.properties.value.default===null)properties.value=[];
  return properties;
}

// Defensive copy for incoming mutation subtrees. Full prototype/tree validation
// follows in hydration; this pass checks shape before authorization reads IDs.
export function copyEnvelope(input, active = new Set(), seen = new Set(), depth = 0) {
  check(depth <= 64 && seen.size < 10000, 'OBJECT.LIMIT', 'Object tree limit exceeded');
  validateEnvelope(input);
  check(!active.has(input), 'OBJECT.CYCLE', 'Containment cycle');
  check(!seen.has(input), 'OBJECT.MULTIPLE_PARENTS', 'Repeated containment position');
  active.add(input); seen.add(input);
  const slots = Object.create(null);
  for (const key of jsonKeys(input.slots)) {
    check(!['__proto__','constructor','prototype'].includes(key), 'INPUT.DANGEROUS_KEY', 'Reserved slot key');
    const children = input.slots[key];
    check(Array.isArray(children), 'OBJECT.SLOT', 'Slot must be an array');
    jsonKeys(children);
    slots[key] = children.map(child => copyEnvelope(child, active, seen, depth + 1));
  }
  active.delete(input);
  return { ...(input.execution ? {execution: declaration(input.execution)} : {}), schema: input.schema, id: input.id, prototype: input.prototype, properties: clean(input.properties), slots, provenance: clean(input.provenance) };
}
