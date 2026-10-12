import { clean, freeze, record, requireThat as check } from '../../../wydgine/object-model/validation.js';
export { clean, freeze, record, check };
export const LIMITS = Object.freeze({ bytes: 262144, depth: 32, nodes: 16384, prototypes: 128, packages: 16, timeout: 10000 });
export function parseJSON(bytes) {
  check(bytes.byteLength <= LIMITS.bytes, 'MANIFEST.LIMIT', 'Manifest limit exceeded');
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { check(false, 'MANIFEST.JSON', 'Invalid manifest JSON'); }
  let nodes = 0;
  const walk = (v, depth = 0) => {
    check(depth <= LIMITS.depth && ++nodes <= LIMITS.nodes, 'MANIFEST.LIMIT', 'Manifest limit exceeded');
    if (v && typeof v === 'object') for (const [key, child] of Object.entries(v)) {
      check(!['__proto__', 'constructor', 'prototype'].includes(key), 'MANIFEST.KEY', 'Unsafe manifest key');
      walk(child, depth + 1);
    }
  };
  walk(value);
  return clean(value);
}
export function shape(value, allowed, required = []) {
  check(record(value) && Object.keys(value).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(value, k)), 'MANIFEST.SHAPE', 'Invalid manifest declaration');
}
export function decode64(value, length) {
  check(typeof value === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(value), 'PACKAGE.ENCODING', 'Invalid cryptographic encoding');
  let bytes;
  try { bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
  catch { check(false, 'PACKAGE.ENCODING', 'Invalid cryptographic encoding'); }
  check(bytes.length === length && btoa(String.fromCharCode(...bytes)) === value, 'PACKAGE.ENCODING', 'Invalid cryptographic encoding');
  return bytes;
}
