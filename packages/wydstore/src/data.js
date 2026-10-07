export class StoreError extends Error {
  constructor(code) { super(code); this.code = code; }
  toJSON() { return { ok: false, code: this.code, message: 'Store operation failed', details: {} }; }
}
export function check(ok, code = 'STORE.INVALID_RECORD') { if (!ok) throw new StoreError(code); }
export const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const idValid = id => typeof id === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(id) && !['constructor','prototype','__proto__'].includes(id);
export const frozen = value => { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
export function json(value, seen = new Set(), depth = 0) {
  check(depth <= 64);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { check(Number.isFinite(value)); return Object.is(value, -0) ? 0 : value; }
  check(value && typeof value === 'object' && !seen.has(value));
  const array = Array.isArray(value);
  check(array ? Object.getPrototypeOf(value) === Array.prototype : [Object.prototype, null].includes(Object.getPrototypeOf(value)));
  const keys = Reflect.ownKeys(value).filter(key => !(array && key === 'length'));
  check(keys.every(key => typeof key === 'string' && !['__proto__','constructor','prototype'].includes(key)));
  check(!array || (keys.length === value.length && keys.every((key,i) => key === String(i))));
  const output = array ? [] : Object.create(null);
  seen.add(value);
  for (const key of keys.sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(descriptor.enumerable && Object.hasOwn(descriptor, 'value'));
    output[key] = json(descriptor.value, seen, depth + 1);
  }
  seen.delete(value); return output;
}
export function fields(value, required, optional = [], code = 'STORE.INVALID_RECORD') {
  check(record(value) && required.every(key => Object.hasOwn(value,key)) && Object.keys(value).every(key => [...required,...optional].includes(key)), code);
}
export const equal = (a,b) => JSON.stringify(json(a)) === JSON.stringify(json(b));
export function schema(input) {
  check(record(input), 'STORE.INVALID_CONFIG');
  for (const [name,rule] of Object.entries(input)) {
    check(idValid(name) && name !== 'id', 'STORE.INVALID_CONFIG');
    fields(rule,['type'],['required','default'],'STORE.INVALID_CONFIG');
    check(['string','number','boolean','object','array','null'].includes(rule.type) && (rule.required === undefined || typeof rule.required === 'boolean'), 'STORE.INVALID_CONFIG');
    if (Object.hasOwn(rule,'default')) check(typeOf(rule.default) === rule.type, 'STORE.INVALID_CONFIG');
  }
  return input;
}
const typeOf = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
export function validateData(input, definitions) {
  const data = json(input); check(record(data));
  for (const name of Object.keys(data)) check(Object.hasOwn(definitions,name),'STORE.INVALID_FIELD');
  for (const [name,rule] of Object.entries(definitions)) {
    if (!Object.hasOwn(data,name) && Object.hasOwn(rule,'default')) data[name] = json(rule.default);
    if (!Object.hasOwn(data,name)) { check(!rule.required,'STORE.INVALID_FIELD'); continue; }
    check(typeOf(data[name]) === rule.type,'STORE.INVALID_FIELD');
  }
  return json(data);
}
