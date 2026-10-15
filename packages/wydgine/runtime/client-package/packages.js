import { check, shape, decode64, parseJSON } from './data.js';
import { download } from './network.js';
export const publisherPattern = /^[a-z][a-z0-9.-]*$/;
export const identityPattern = /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/;
export const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
// UTF-8 JSON array, fixed field order, no whitespace. Digest covers exact fetched bytes.
export function signedPayload(ref) {
  return new TextEncoder().encode(JSON.stringify(['wydgit.prototype-signature/0.1', ref.publisher, ref.id, ref.version, ref.integrity, ref.algorithm, ref.keyId]));
}
export async function loadPackage(ref, host, policy, signal) {
  shape(ref, ['id', 'publisher', 'version', 'url', 'integrity', 'algorithm', 'keyId', 'signature'], ['id', 'publisher', 'version', 'url', 'integrity', 'algorithm', 'keyId', 'signature']);
  check(identityPattern.test(ref.id) && ref.publisher === ref.id.split('/')[0] && ref.publisher !== 'wydgit.core' && versionPattern.test(ref.version), 'PACKAGE.IDENTITY', 'Invalid package identity');
  check(typeof ref.url === 'string' && typeof ref.keyId === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(ref.keyId), 'PACKAGE.IDENTITY', 'Invalid package identity');
  check(ref.algorithm === 'Ed25519' && typeof ref.integrity === 'string' && ref.integrity.startsWith('sha256-'), 'PACKAGE.ALGORITHM', 'Unsupported package algorithm');
  const expected = decode64(ref.integrity.slice(7), 32), signature = decode64(ref.signature, 64);
  const binding = policy.trustedKeys.find(k => k.publisher === ref.publisher && k.keyId === ref.keyId && k.status === 'active');
  check(binding, 'PACKAGE.UNTRUSTED_KEY', 'Publisher key is not trusted');
  check(host.crypto?.subtle, 'PACKAGE.CRYPTO', 'Package verification unavailable');
  const bytes = await download(ref.url, host, policy, signal);
  let digest, key, valid;
  try {
    digest = new Uint8Array(await host.crypto.subtle.digest('SHA-256', bytes));
    check(digest.every((b, i) => b === expected[i]), 'PACKAGE.INTEGRITY', 'Package integrity mismatch');
    key = await host.crypto.subtle.importKey('raw', decode64(binding.publicKey, 32), { name: 'Ed25519' }, false, ['verify']);
    valid = await host.crypto.subtle.verify('Ed25519', key, signature, signedPayload(ref));
  } catch (error) {
    if (error.code === 'PACKAGE.INTEGRITY') throw error;
    check(false, 'PACKAGE.CRYPTO', 'Package verification unavailable');
  }
  check(valid, 'PACKAGE.SIGNATURE', 'Invalid publisher signature');
  const pkg = parseJSON(bytes);
  shape(pkg, ['schema', 'id', 'publisher', 'version', 'prototypes'], ['schema', 'id', 'publisher', 'version', 'prototypes']);
  check(pkg.schema === 'wydgit.prototype-package/0.1' && pkg.id === ref.id && pkg.publisher === ref.publisher && pkg.version === ref.version && Array.isArray(pkg.prototypes), 'PACKAGE.CONTENT', 'Package declaration mismatch');
  check(pkg.prototypes.every(d => d.publisher === ref.publisher && identityPattern.test(d.id) && d.id.split('/')[0] === ref.publisher), 'PACKAGE.CONTENT', 'Package namespace mismatch');
  return pkg.prototypes;
}
