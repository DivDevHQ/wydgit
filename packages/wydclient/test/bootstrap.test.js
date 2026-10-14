import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { webcrypto, generateKeyPairSync, sign, createHash } from 'node:crypto';
import { createRuntime, VERSION, PROTOCOL } from '../src/runtime.js';
import { signedPayload } from '../src/packages.js';
import { approveRegistry } from '../src/registry.js';
import { parseJSON, LIMITS } from '../src/data.js';
import { PrototypeRegistry } from '../../../wydgine/object-model/prototypes.js';
const manifest = (prototypes = [], packages = []) => ({ schema: 'wydgit.registry/0.1', protocol: '0.1', prototypes, packages });
const definition = (extra = {}) => ({ id: 'acme/home-page', publisher: 'acme', extends: 'wydgit.core/page', ...extra });
function setup(t, { raw, external, selected, config = {}, loading = false, fetch } = {}) {
  const window = new Window({ url: 'https://site.example/demo.html' });
  t.after(() => window.happyDOM.close());
  const doc = window.document; doc.title = 'Static host';
  doc.body.innerHTML = '<main id="host"><h1>Existing content</h1></main>';
  const hostNode = doc.body.firstChild;
  if (raw !== undefined) { const script = doc.createElement('script'); script.id = 'wydgit-manifest'; script.type = 'application/json'; script.textContent = raw; doc.head.append(script); }
  if (external) { const link = doc.createElement('link'); link.rel = 'wydgit-manifest'; link.href = external; doc.head.append(link); }
  if (selected) doc.documentElement.setAttribute('data-wydgit-page', selected);
  Object.defineProperty(doc, 'readyState', { configurable: true, value: loading ? 'loading' : 'complete' });
  const host = { document: doc, location: window.location, crypto: webcrypto, fetch: fetch ?? (() => { throw new Error('Network secret'); }) };
  return { window, doc, hostNode, host, api: createRuntime(host, config) };
}
function response(raw, url = 'https://site.example/manifest.json', options = {}) {
  const value = new Response(typeof raw === 'string' ? raw : JSON.stringify(raw), { headers: { 'Content-Type': 'application/json' } });
  Object.defineProperty(value, 'url', { value: url, configurable: true });
  for (const [key, v] of Object.entries(options)) Object.defineProperty(value, key, { value: v });
  return value;
}
async function failure(t, options, code) {
  const { api } = setup(t, options); const result = await api.ready();
  assert.equal(result.ok, false); assert.equal(result.state, 'failed');
  assert.equal(result.diagnostics[0].code, code);
  assert.equal(result.page.prototype, 'wydgit.core/page');
  assert.equal(result.registry.approved, false);
  assert.doesNotMatch(JSON.stringify(result.diagnostics), /secret|https:\/\/|home-page|__proto__/);
  return result;
}
test('default bootstrap: canonical H0 Page, logical destinations, immutable API, exact host preservation and idempotence', async t => {
  const { api, doc, hostNode } = setup(t);
  assert.equal(api.state, 'idle'); const first = api.ready(); assert.equal(first, api.ready());
  const result = await first;
  assert.equal(result.ok, true); assert.equal(api.version, VERSION); assert.equal(api.protocol, PROTOCOL);
  assert.equal(result.page.schema, 'wydgit/0.2'); assert.equal(result.page.prototype, 'wydgit.core/page');
  assert.equal(result.page.properties.title, 'Static host'); assert.equal(result.page.properties.slug, '/demo.html');
  assert.deepEqual(result.page.slots, { sections: [], navigation: [] });
  assert.equal(result.SUB.Page.Top.destination, 'SUB.Page.Top'); assert.equal(result.SUB.Page.Bottom.destination, 'SUB.Page.Bottom');
  assert.equal(result.SUB.Page.default, 'SUB.Page.Bottom');
  assert.equal(doc.body.children.length, 3); assert.equal(doc.body.children[1], hostNode);
  assert.equal(hostNode.outerHTML, '<main id="host"><h1>Existing content</h1></main>');
  assert.equal(doc.body.firstChild.getAttribute('data-wydclient-region'), 'top');
  assert.equal(doc.body.lastChild.getAttribute('data-wydclient-region'), 'bottom');
  assert.equal(await api.ready(), result); assert.equal(doc.body.children.length, 3);
  assert.throws(() => { result.page.properties.title = 'Changed'; });
  assert.deepEqual(Object.keys(api), ['host', 'version', 'protocol', 'ready', 'state', 'mount']);
  assert.doesNotMatch(JSON.stringify(result), /ownerDocument|capabilities|trustedKeys/);
});
test('loading document waits before bootstrap', async t => {
  const { api, doc } = setup(t, { loading: true });
  const promise = api.ready(); assert.equal(doc.body.children.length, 1);
  doc.dispatchEvent(new (doc.defaultView.Event)('DOMContentLoaded'));
  assert.equal((await promise).ok, true); assert.equal(doc.body.children.length, 3);
});
test('inline manifest derives Page and applies H0 defaults/public export', async t => {
  const d = definition({ properties: { greeting: { type: 'string', default: 'Hello' }, privateValue: { type: 'string', default: 'secret', access: 'private' }, hiddenValue: { type: 'string', default: 'secret', hidden: true }, requiresValue: { type: 'string', default: 'secret', requires: ['store.records.read'] } } });
  const { api } = setup(t, { raw: JSON.stringify(manifest([d])), selected: d.id });
  const result = await api.ready(); assert.equal(result.ok, true); assert.equal(result.page.prototype, d.id);
  assert.equal(result.page.properties.greeting, 'Hello'); assert.doesNotMatch(JSON.stringify(result), /secret/);
  assert.equal(Object.hasOwn(result, 'capabilities'), false);
});
test('external authoritative manifest explicitly fetched without credentials or redirects', async t => {
  let calls = 0;
  const { api } = setup(t, { external: '/manifest.json', fetch: async (url, options) => {
    calls++; assert.equal(url, 'https://site.example/manifest.json'); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); assert.equal(options.mode, 'cors');
    return response(manifest());
  } });
  assert.equal((await api.ready()).ok, true); await api.ready(); assert.equal(calls, 1);
});
test('one authoritative source; rejects duplicate inline, external, and mixed', async t => {
  for (const kind of ['inline', 'external', 'mixed']) {
    const { api, doc } = setup(t, { raw: JSON.stringify(manifest()), external: kind === 'mixed' ? '/manifest.json' : undefined });
    if (kind === 'inline') doc.head.append(doc.querySelector('#wydgit-manifest').cloneNode(true));
    if (kind === 'external') { doc.querySelector('#wydgit-manifest').remove(); doc.head.innerHTML += '<link rel="wydgit-manifest" href="/a"><link rel="wydgit-manifest" href="/b">'; }
    assert.equal((await api.ready()).diagnostics[0].code, 'MANIFEST.DUPLICATE');
  }
});
test('invalid JSON, schema/protocol, unsafe keys, shape and manifest limits', async t => {
  for (const [raw, code] of [
    ['{secret', 'MANIFEST.JSON'],
    [JSON.stringify({ ...manifest(), schema: 'wydgit.registry/9.0' }), 'MANIFEST.VERSION'],
    [JSON.stringify({ ...manifest(), protocol: '9.0' }), 'MANIFEST.VERSION'],
    ['{"schema":"wydgit.registry/0.1","prototypes":[],"__proto__":{}}', 'MANIFEST.KEY'],
    [JSON.stringify({ ...manifest(), trustedKeys: [] }), 'MANIFEST.SHAPE'],
    [JSON.stringify({ ...manifest(), prototypes: {} }), 'MANIFEST.SHAPE'],
    [' '.repeat(LIMITS.bytes + 1), 'MANIFEST.LIMIT'],
    [JSON.stringify({ ...manifest(), prototypes: Array.from({ length: 40 }).reduce(v => [v], []) }), 'MANIFEST.LIMIT'],
    [JSON.stringify({ ...manifest(), prototypes: Array.from({ length: 20000 }, () => null) }), 'MANIFEST.LIMIT']
  ]) await failure(t, { raw }, code);
});
test('H0 identity, publisher namespace, inheritance, collision and property override validation', async t => {
  const cases = [
    [[definition({ id: 'Acme/Home' })], 'PROTOTYPE.IDENTITY'],
    [[definition({ publisher: 'spoof' })], 'PROTOTYPE.IDENTITY'],
    [[definition({ publisher: 'wydgit.core', id: 'wydgit.core/forged' })], 'PROTOTYPE.IDENTITY'],
    [[definition({ extends: ['wydgit.core/page'] })], 'PROTOTYPE.INHERITANCE'],
    [[definition({ extends: 'acme/other' }), definition({ id: 'acme/other', extends: 'acme/home-page' })], 'PROTOTYPE.CYCLE'],
    [[definition({ properties: { Title: { type: 'string' } } })], 'PROTOTYPE.CASE_COLLISION'],
    [[definition({ properties: { title: { type: 'number', required: true } } })], 'PROTOTYPE.ACCESS'],
    [[definition({ properties: { flag: { type: 'boolean', default: 'wrong' } } })], 'OBJECT.PROPERTY'],
    [[definition({ id: 'other/base', publisher: 'other' }), definition({ extends: 'other/base' })], 'PROTOTYPE.PUBLISHER'],
    [[definition({ properties: { title: { type: 'string' } } })], 'PROTOTYPE.ACCESS']
  ];
  for (const [definitions, code] of cases) {
    const result = await setup(t, { raw: JSON.stringify(manifest(definitions)) }).api.ready();
    assert.equal(result.ok, false); assert.equal(result.diagnostics[0].code, code);
  }
});
test('friend grants require independent trusted bindings, reject invalid/cross publisher patterns', async t => {
  const d = definition({ friends: ['acme/*'], properties: { shared: { type: 'string', default: 'secret', access: 'friend' } } });
  await failure(t, { raw: JSON.stringify(manifest([d])) }, 'PROTOTYPE.FRIEND');
  const result = await setup(t, { raw: JSON.stringify(manifest([d])), selected: d.id, config: { verifiedPrototypes: { [d.id]: 'acme' } } }).api.ready();
  assert.equal(result.ok, true); assert.equal(Object.hasOwn(result.page.properties, 'shared'), false);
  for (const friends of [['*'], ['other/*'], ['acme/ab*'], ['acme/*', 'acme/*']]) await failure(t, { raw: JSON.stringify(manifest([definition({ friends })])), config: { verifiedPrototypes: { [d.id]: 'acme' } } }, 'PROTOTYPE.FRIEND');
  await failure(t, { config: { verifiedPrototypes: { [d.id]: 'other' } } }, 'BOOTSTRAP.CONFIG');
});
test('derived Page resolution, abstract/non-Page, required defaults and reserved destinations', async t => {
  for (const d of [definition({ abstract: true }), definition({ extends: 'wydgit.core/block' }), definition({ properties: { missing: { type: 'string', required: true } } }), definition({ properties: { Top: { type: 'string', default: '' } } }), definition({ slots: { extra: { accepts: ['wydgit.core/block'], ordered: true, min: 1 } } })]) await failure(t, { raw: JSON.stringify(manifest([d])), selected: d.id }, 'PAGE.PROTOTYPE');
  await failure(t, { selected: 'acme/missing' }, 'PAGE.PROTOTYPE');
});
test('no portable execution or authority declarations', async t => {
  for (const extra of [{ capabilities: ['store.records.read'] }, { verifiedPrototypes: { 'acme/home-page': 'acme' } }, { behaviorSource: 'eval(secret)' }, { presentation: { tag: 'script' } }, { behavior: { schema: 'sewn/0.5', body: [], procedures: { run: { kind: 'sub', params: [], body: [{ op: 'set', name: 'x', value: { op: 'literal', value: 1 } }] } } } }]) {
    const { api } = setup(t, { raw: JSON.stringify(manifest([definition(extra)])) }); assert.equal((await api.ready()).ok, false);
  }
});
test('declaration validator uses H0 public defaults, inherited owners, exact method metadata and signature rules', () => {
  const base = { id: 'acme/base', publisher: 'acme', properties: { Exact: { type: 'string', default: '' } }, behavior: { schema: 'sewn/0.5', body: [], procedures: { Refresh: { kind: 'sub', params: [], body: [] } } }, methodRules: { Refresh: { access: 'protected', hidden: true } } };
  const derived = { id: 'acme/derived', publisher: 'acme', extends: base.id, properties: { Exact: { type: 'string', default: 'derived' } } };
  const client = approveRegistry([base, derived], {}), server = new PrototypeRegistry([base, derived]);
  assert.deepEqual(client.get(derived.id), server.get(derived.id));
  assert.equal(client.get(derived.id).propertyOwners.Exact, base.id);
  assert.equal(client.get(base.id).properties.Exact.access, undefined); // H0 omission means public.
  assert.equal(client.get(derived.id).methods.Refresh.owner, base.id);
  assert.throws(() => approveRegistry([base, { ...derived, properties: { refresh: { type: 'string' } } }], {}), { code: 'PROTOTYPE.CASE_COLLISION' });
  assert.throws(() => approveRegistry([base, { ...derived, overrides: ['Refresh'], behavior: base.behavior }], {}), { code: 'PROTOTYPE.ACCESS' });
});
test('network failures, origin and redirect policy, type and streaming response limits', async t => {
  await failure(t, { external: 'https://other.example/manifest.json' }, 'NETWORK.ORIGIN');
  await failure(t, { external: '/manifest.json' }, 'NETWORK.FAILED');
  for (const options of [{ redirected: true }, { url: 'https://other.example/manifest.json' }, { ok: false }]) await failure(t, { external: '/manifest.json', fetch: async () => response(manifest(), 'https://site.example/manifest.json', options) }, 'NETWORK.RESPONSE');
  await failure(t, { external: '/manifest.json', fetch: async () => response('x'.repeat(LIMITS.bytes + 1)) }, 'MANIFEST.LIMIT');
  await failure(t, { external: '/manifest.json', fetch: async () => { const r = response(manifest()); r.headers.set('content-type', 'text/html'); return r; } }, 'NETWORK.TYPE');
  const result = await setup(t, { external: 'https://other.example/manifest.json', config: { allowedOrigins: ['https://other.example'] }, fetch: async () => response(manifest(), 'https://other.example/manifest.json') }).api.ready(); assert.equal(result.ok, true);
});
function signedFixture() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pkg = { schema: 'wydgit.prototype-package/0.1', id: 'acme/pages', publisher: 'acme', version: '1.0.0', prototypes: [definition({ friends: ['acme/*'] })] };
  const bytes = Buffer.from(JSON.stringify(pkg));
  const ref = { id: pkg.id, publisher: pkg.publisher, version: pkg.version, url: '/package.json', integrity: 'sha256-' + createHash('sha256').update(bytes).digest('base64'), algorithm: 'Ed25519', keyId: 'key-1', signature: '' };
  ref.signature = sign(null, signedPayload(ref), privateKey).toString('base64');
  const binding = { publisher: 'acme', keyId: ref.keyId, publicKey: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64'), status: 'active' };
  return { ref, bytes, binding, privateKey, pkg };
}
test('signed pinned external prototype package establishes independently verified origin, not SEAM authority', async t => {
  const { ref, bytes, binding } = signedFixture();
  const result = await setup(t, { raw: JSON.stringify(manifest([], [ref])), selected: 'acme/home-page', config: { trustedKeys: [binding] }, fetch: async () => response(bytes.toString(), 'https://site.example/package.json') }).api.ready();
  assert.equal(result.ok, true); assert.equal(result.page.prototype, 'acme/home-page');
  assert.doesNotMatch(JSON.stringify(result), /publicKey|capabilities|signature|friends/);
});
test('signed package rejects tampering, bad signatures, unsupported algorithms, untrusted/revoked keys and version substitution', async t => {
  const { ref, bytes, binding } = signedFixture();
  for (const [changed, config, content, code] of [
    [ref, {}, bytes.toString(), 'PACKAGE.UNTRUSTED_KEY'],
    [ref, { trustedKeys: [{ ...binding, status: 'revoked' }] }, bytes.toString(), 'PACKAGE.UNTRUSTED_KEY'],
    [ref, { trustedKeys: [binding] }, bytes.toString() + ' ', 'PACKAGE.INTEGRITY'],
    [{ ...ref, signature: Buffer.alloc(64).toString('base64') }, { trustedKeys: [binding] }, bytes.toString(), 'PACKAGE.SIGNATURE'],
    [{ ...ref, algorithm: 'RSA' }, { trustedKeys: [binding] }, bytes.toString(), 'PACKAGE.ALGORITHM'],
    [{ ...ref, version: '1.0.1' }, { trustedKeys: [binding] }, bytes.toString(), 'PACKAGE.SIGNATURE'],
    [{ ...ref, signature: undefined }, { trustedKeys: [binding] }, bytes.toString(), 'MANIFEST.SHAPE'],
    [{ ...ref, publicKey: binding.publicKey }, { trustedKeys: [binding] }, bytes.toString(), 'MANIFEST.SHAPE']
  ]) await failure(t, { raw: JSON.stringify(manifest([], [changed])), config, fetch: async () => response(content, 'https://site.example/package.json') }, code);
});
test('verified signature still rejects wrong package metadata, namespace and mixed duplicate definitions', async t => {
  const fixture = signedFixture();
  for (const patch of [{ version: '2.0.0' }, { schema: 'bad' }, { prototypes: [definition({ id: 'other/page', publisher: 'other' })] }]) {
    const content = JSON.stringify({ ...fixture.pkg, ...patch });
    const ref = { ...fixture.ref, integrity: 'sha256-' + createHash('sha256').update(content).digest('base64') };
    ref.signature = sign(null, signedPayload(ref), fixture.privateKey).toString('base64');
    await failure(t, { raw: JSON.stringify(manifest([], [ref])), config: { trustedKeys: [fixture.binding] }, fetch: async () => response(content, 'https://site.example/package.json') }, 'PACKAGE.CONTENT');
  }
  await failure(t, { raw: JSON.stringify(manifest([definition()], [fixture.ref])), config: { trustedKeys: [fixture.binding] }, fetch: async () => response(fixture.bytes.toString(), 'https://site.example/package.json') }, 'PROTOTYPE.DUPLICATE');
});
test('JSON decoder rejects malformed UTF-8 and never evaluates source', () => {
  assert.throws(() => parseJSON(Uint8Array.of(0xff)), { code: 'MANIFEST.JSON' });
  assert.throws(() => parseJSON(new TextEncoder().encode('globalThis.compromised = true')), { code: 'MANIFEST.JSON' });
  assert.equal(globalThis.compromised, undefined);
});
test('Unicode byte limit, reserved nested keys, closed trusted policy and publisher binding checks', async t => {
  await failure(t, { raw: JSON.stringify(manifest([definition({ properties: { value: { type: 'string', default: 'é'.repeat(LIMITS.bytes / 2) } } })])) }, 'MANIFEST.LIMIT');
  await failure(t, { raw: '{"schema":"wydgit.registry/0.1","prototypes":[{"properties":{"value":{"default":{"constructor":1}}}}]}' }, 'MANIFEST.KEY');
  for (const config of [{ unknown: true }, { allowedOrigins: ['https://other.example/path'] }, { trustedKeys: [] , verifiedPrototypes: { 'acme/home-page': 'fake' } }]) await failure(t, { config }, config.unknown ? 'MANIFEST.SHAPE' : 'BOOTSTRAP.CONFIG');
});
test('unsupported native crypto fails closed; signed reference cannot trust a package-supplied key', async t => {
  const { ref, binding, bytes } = signedFixture();
  for (const crypto of [null, { subtle: { digest: async () => { throw new Error('secret unsupported crypto'); } } }]) {
    const { api, host } = setup(t, { raw: JSON.stringify(manifest([], [ref])), config: { trustedKeys: [binding] }, fetch: async () => response(bytes.toString(), 'https://site.example/package.json') });
    host.crypto = crypto;
    const result = await api.ready(); assert.equal(result.diagnostics[0].code, 'PACKAGE.CRYPTO'); assert.equal(result.registry.approved, false);
  }
});
test('external requests have bounded deadlines and abort without activating registry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requested = false;
  const { api } = setup(t, { external: '/manifest.json', fetch: async (_url, options) => {
    requested = true;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('secret network timeout')), { once: true }));
  } });
  const ready = api.ready(); assert.equal(requested, true);
  t.mock.timers.tick(LIMITS.timeout + 1);
  const result = await ready; assert.equal(result.diagnostics[0].code, 'NETWORK.FAILED'); assert.equal(result.registry.approved, false);
});
