export class WydgitError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; this.details = details; }
  toJSON() { return { ok: false, code: this.code, message: this.message, details: this.details }; }
}
export function requireThat(ok, code, message) { if (!ok) throw new WydgitError(code, message); }
export const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function freeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; }
// Inspect descriptors before reading values; accept exactly JSON's data surface.
export function jsonKeys(value) {
  requireThat(value && typeof value === 'object', 'INPUT.JSON', 'Expected JSON container');
  const array = Array.isArray(value);
  requireThat(array ? Object.getPrototypeOf(value) === Array.prototype : [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'INPUT.JSON', 'Expected plain JSON data');
  const keys = Reflect.ownKeys(value).filter(k => !(array && k === 'length'));
  requireThat(keys.every(k => typeof k === 'string'), 'INPUT.JSON', 'Symbol keys are not JSON');
  requireThat(!array || (keys.length === value.length && keys.every((k, i) => k === String(i))), 'INPUT.JSON', 'Expected dense JSON array');
  requireThat(keys.every(k => { const d = Object.getOwnPropertyDescriptor(value, k); return d.enumerable && Object.hasOwn(d, 'value'); }), 'INPUT.JSON', 'Expected enumerable JSON data');
  return keys;
}
export function clean(value, active = new Set(), depth = 0) {
  requireThat(depth <= 128, 'INPUT.LIMIT', 'JSON nesting limit exceeded');
  if (value === null || ['string','boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') { requireThat(Number.isFinite(value), 'INPUT.JSON', 'Non-finite number'); return Object.is(value, -0) ? 0 : value; }
  requireThat(value && typeof value === 'object', 'INPUT.JSON', 'Expected JSON data');
  requireThat(!active.has(value), 'OBJECT.CYCLE', 'Cyclic input');
  jsonKeys(value);
  active.add(value);
  const out = Array.isArray(value) ? [] : Object.create(null);
  for (const key of Object.keys(value).sort()) {
    requireThat(!['__proto__','constructor','prototype'].includes(key), 'INPUT.DANGEROUS_KEY', `Reserved key: ${key}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    requireThat(Object.hasOwn(descriptor, 'value'), 'INPUT.JSON', 'Accessors are not JSON');
    out[key] = clean(descriptor.value, active, depth + 1);
  }
  active.delete(value);
  return out;
}
export function parse(text) {
  try { return JSON.parse(text); } catch { throw new WydgitError('INPUT.JSON', 'Malformed JSON'); }
}
