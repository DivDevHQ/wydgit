export class WydgitError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; this.details = details; }
  toJSON() { return { ok: false, code: this.code, message: this.message, details: this.details }; }
}
export function requireThat(ok, code, message) { if (!ok) throw new WydgitError(code, message); }
export const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function freeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; }
// The envelope's prototype field is the sole reserved-key exception.
export function clean(value, { envelope = false } = {}, active = new Set(), depth = 0) {
  requireThat(depth <= 128, 'INPUT.LIMIT', 'JSON nesting limit exceeded');
  if (value === null || ['string','boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') { requireThat(Number.isFinite(value), 'INPUT.JSON', 'Non-finite number'); return value; }
  requireThat(value && typeof value === 'object', 'INPUT.JSON', 'Expected JSON data');
  requireThat(!active.has(value), 'OBJECT.CYCLE', 'Cyclic input');
  requireThat(Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'INPUT.JSON', 'Expected plain JSON data');
  active.add(value);
  const out = Array.isArray(value) ? [] : Object.create(null);
  for (const key of Object.keys(value).sort()) {
    requireThat(!['__proto__','constructor','prototype'].includes(key) || (envelope && key === 'prototype'), 'INPUT.DANGEROUS_KEY', `Reserved key: ${key}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    requireThat(Object.hasOwn(descriptor, 'value'), 'INPUT.JSON', 'Accessors are not JSON');
    out[key] = clean(descriptor.value, {}, active, depth + 1);
  }
  active.delete(value);
  return out;
}
export function parse(text) {
  try { return JSON.parse(text); } catch { throw new WydgitError('INPUT.JSON', 'Malformed JSON'); }
}
