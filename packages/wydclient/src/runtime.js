import { SCHEMA, resolveProperties } from '../../../wydgine/object-model/schema.js';
import { clean, freeze, record, check, shape, parseJSON, LIMITS, decode64 } from './data.js';
import { download } from './network.js';
import { loadPackage, identityPattern, publisherPattern } from './packages.js';
import { approveRegistry } from './registry.js';
export const VERSION = '0.1.0-alpha.1';
export const PROTOCOL = Object.freeze({ name: 'WydSUB', version: '0.1' });
// Retain the approved read-only registry and canonical Page for later trusted adapters.
// There is intentionally no host/portable accessor for this private runtime state.
const runtimes = new WeakMap();
const messages = Object.freeze({
  manifest: 'Page manifest validation failed.', network: 'Page manifest request failed.',
  package: 'Publisher package verification failed.', page: 'Page prototype resolution failed.',
  bootstrap: 'Page initialization failed.'
});
function policyFrom(input = {}) {
  const config = clean(input);
  shape(config, ['allowedOrigins', 'trustedKeys', 'verifiedPrototypes']);
  const origins = config.allowedOrigins ?? [], keys = config.trustedKeys ?? [], bindings = config.verifiedPrototypes ?? {};
  check(Array.isArray(origins) && origins.length <= 16 && origins.every(x => typeof x === 'string' && new URL(x).origin === x && /^https?:/.test(x)), 'BOOTSTRAP.CONFIG', 'Invalid trusted origin policy');
  check(Array.isArray(keys) && keys.length <= 64 && record(bindings) && Object.keys(bindings).length <= LIMITS.prototypes, 'BOOTSTRAP.CONFIG', 'Invalid trusted publisher policy');
  const seen = new Set();
  for (const key of keys) {
    shape(key, ['publisher', 'keyId', 'publicKey', 'status'], ['publisher', 'keyId', 'publicKey', 'status']);
    check(publisherPattern.test(key.publisher) && key.publisher !== 'wydgit.core' && typeof key.keyId === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(key.keyId) && ['active', 'revoked'].includes(key.status), 'BOOTSTRAP.CONFIG', 'Invalid trusted key binding');
    decode64(key.publicKey, 32);
    const id = key.publisher + '/' + key.keyId;
    check(!seen.has(id), 'BOOTSTRAP.CONFIG', 'Duplicate trusted key binding'); seen.add(id);
  }
  for (const [id, publisher] of Object.entries(bindings)) check(identityPattern.test(id) && id.split('/')[0] === publisher && publisher !== 'wydgit.core', 'BOOTSTRAP.CONFIG', 'Invalid trusted publisher binding');
  return freeze({ allowedOrigins: origins, trustedKeys: keys, verifiedPrototypes: bindings });
}
// This factory is a trusted adapter implementation, excluded from the site-author global.
export function createRuntime(host, configuration = {}) {
  let promise, state = 'idle', result;
  const api = Object.freeze({ version: VERSION, protocol: PROTOCOL, ready, get state() { return state; } });
  function ready() {
    if (!promise) { state = 'initializing'; promise = initialize(); }
    return promise;
  }
  async function initialize() {
    const doc = host.document;
    if (doc.readyState === 'loading') await new Promise(resolve => doc.addEventListener('DOMContentLoaded', resolve, { once: true }));
    let registry, page, error = null;
    try {
      const policy = policyFrom(configuration);
      const inline = [...doc.querySelectorAll('[id="wydgit-manifest"]')];
      const external = [...doc.querySelectorAll('link[rel~="wydgit-manifest"]')];
      check(inline.length + external.length <= 1, 'MANIFEST.DUPLICATE', 'Multiple authoritative manifests');
      let manifest = { schema: 'wydgit.registry/0.1', protocol: '0.1', prototypes: [] };
      if (inline.length) {
        check(inline[0].tagName === 'SCRIPT' && inline[0].getAttribute('type') === 'application/json', 'MANIFEST.TYPE', 'Expected JSON manifest');
        check(inline[0].textContent.length <= LIMITS.bytes, 'MANIFEST.LIMIT', 'Manifest limit exceeded');
        manifest = parseJSON(new TextEncoder().encode(inline[0].textContent));
      } else if (external.length) {
        check(external[0].hasAttribute('href') && external[0].getAttribute('href').length > 0, 'NETWORK.URL', 'Missing manifest URL');
        manifest = parseJSON(await download(external[0].getAttribute('href'), host, policy));
      }
      shape(manifest, ['schema', 'protocol', 'prototypes', 'packages'], ['schema', 'prototypes']);
      check(manifest.schema === 'wydgit.registry/0.1' && (manifest.protocol ?? '0.1') === PROTOCOL.version, 'MANIFEST.VERSION', 'Unsupported manifest version');
      check(Array.isArray(manifest.prototypes) && Array.isArray(manifest.packages ?? []) && (manifest.packages ?? []).length <= LIMITS.packages, 'MANIFEST.SHAPE', 'Invalid manifest declarations');
      const declarations = [...manifest.prototypes], verified = { ...policy.verifiedPrototypes };
      check(declarations.length <= LIMITS.prototypes, 'MANIFEST.LIMIT', 'Prototype limit exceeded');
      const packages = new Set();
      for (const ref of manifest.packages ?? []) {
        check(!packages.has(ref.id), 'PACKAGE.DUPLICATE', 'Duplicate package reference'); packages.add(ref.id);
        const definitions = await loadPackage(ref, host, policy);
        check(declarations.length + definitions.length <= LIMITS.prototypes, 'MANIFEST.LIMIT', 'Prototype limit exceeded');
        declarations.push(...definitions);
        for (const d of definitions) verified[d.id] = ref.publisher;
      }
      registry = approveRegistry(declarations, verified);
      const selected = doc.documentElement.getAttribute('data-wydgit-page') ?? 'wydgit.core/page';
      let definition;
      try {
        definition = registry.get(selected);
        check(registry.isA(selected, 'wydgit.core/page') && !definition.abstract, 'PAGE.PROTOTYPE', 'Expected concrete Page prototype');
        // Top/Bottom are adapter-owned destinations, never class members or slots.
        check(![...Object.keys(definition.properties), ...Object.keys(definition.slots), ...Object.keys(definition.methods)].some(k => ['top', 'bottom', 'sub'].includes(k.toLowerCase())), 'PAGE.MOUNT', 'Reserved Page destination');
        const properties = resolveProperties({ title: String(doc.title), slug: host.location.pathname }, definition);
        const slots = Object.fromEntries(Object.entries(definition.slots).map(([k, rule]) => {
          check((rule.min ?? 0) === 0, 'PAGE.SLOT', 'Static Page requires empty slots'); return [k, []];
        }));
        page = freeze({ schema: SCHEMA, id: 'WydClientPage', prototype: selected, properties, slots, provenance: {} });
      } catch { check(false, 'PAGE.PROTOTYPE', 'Page prototype resolution failed'); }
    } catch (failure) {
      const code = typeof failure.code === 'string' && /^(MANIFEST|NETWORK|PACKAGE|PROTOTYPE|OBJECT|INPUT|PAGE|BOOTSTRAP)\.[A-Z_]+$/.test(failure.code) ? failure.code : 'BOOTSTRAP.FAILED';
      error = freeze({ code, message: code.startsWith('NETWORK.') ? messages.network : code.startsWith('PACKAGE.') ? messages.package : code.startsWith('PAGE.') ? messages.page : code.startsWith('BOOTSTRAP.') ? messages.bootstrap : messages.manifest });
      // Failed configuration never activates any declarations. A canonical base Page remains usable.
      registry = approveRegistry([], {});
      const definition = registry.get('wydgit.core/page');
      page = freeze({ schema: SCHEMA, id: 'WydClientPage', prototype: definition.id, properties: resolveProperties({ title: String(doc.title), slug: host.location.pathname }, definition), slots: { sections: [], navigation: [] }, provenance: {} });
    }
    const destinations = freeze({ Page: { default: 'SUB.Page.Bottom', Top: { destination: 'SUB.Page.Top' }, Bottom: { destination: 'SUB.Page.Bottom' } } });
    let regions = null;
    try {
      check(doc.body, 'BOOTSTRAP.BODY', 'Page body unavailable');
      const top = doc.createElement('div'), bottom = doc.createElement('div');
      top.setAttribute('data-wydclient-region', 'top'); bottom.setAttribute('data-wydclient-region', 'bottom');
      // Keep all host nodes intact. No selector matching of unrelated content or HTML parsing.
      doc.body.prepend(top); doc.body.append(bottom);
      regions = Object.freeze({ top, bottom });
    } catch { error = freeze({ code: 'BOOTSTRAP.BODY', message: messages.bootstrap }); }
    state = error ? 'failed' : 'ready';
    runtimes.set(api, Object.freeze({ registry, page, destinations, regions, approved: !error }));
    // Public diagnostics use the H0 generic export filter; registry remains closure-private.
    const properties = Object.fromEntries(Object.entries(page.properties).filter(([key]) => {
      const rule = registry.get(page.prototype).properties[key];
      return (rule.access ?? 'public') === 'public' && !rule.hidden && !rule.requires?.length;
    }));
    result = freeze({ ok: !error, state, page: { ...page, properties }, SUB: destinations, registry: { approved: !error }, diagnostics: error ? [error] : [] });
    return result;
  }
  return api;
}
