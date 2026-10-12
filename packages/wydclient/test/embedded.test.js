import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRuntime } from '../src/runtime.js';
const manifest = (prototypes = [], packages = []) => ({ schema: 'wydgit.registry/0.1', prototypes, packages });
const definition = (id = 'acme/profile', extra = {}) => ({ id, publisher: id.split('/')[0], extends: 'wydgit.core/page', ...extra });
function setup(t, configuration = {}) {
  const window = new Window({ url: 'https://site.example/profiles.html' });
  t.after(() => window.happyDOM.close());
  Object.defineProperty(window.document, 'readyState', { value: 'complete', configurable: true });
  window.document.title = 'Host document';
  window.document.body.innerHTML = '<header>Host header</header><main>Host content</main><footer>Host footer</footer>';
  const host = { document: window.document, location: window.location, crypto: webcrypto, fetch: async () => { throw new Error('secret failed fetch'); } };
  return { window, doc: window.document, host, api: createRuntime(host, configuration) };
}
function container(doc, parent = doc.body) {
  const root = doc.createElement('section'); root.setAttribute('data-wydgit-root', '');
  const content = doc.createElement('p'); content.textContent = 'Host-owned profile content'; root.append(content); parent.append(root); return root;
}
function inline(doc, root, value, { id = false } = {}) {
  const node = doc.createElement('script'); node.type = 'application/json'; node.setAttribute('data-wydgit-manifest', '');
  if (id) node.id = 'wydgit-manifest';
  node.textContent = typeof value === 'string' ? value : JSON.stringify(value); root.append(node); return node;
}
function external(doc, root, href = '/manifest.json') {
  const node = doc.createElement('link'); node.rel = 'wydgit-manifest'; node.setAttribute('href', href); root.append(node); return node;
}
function response(value, url = 'https://site.example/manifest.json') {
  const result = new Response(typeof value === 'string' ? value : JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
  Object.defineProperty(result, 'url', { value: url }); return result;
}
function ownRegions(root) { return [...root.children].filter(e => e.hasAttribute('data-wydclient-region')); }
test('three sibling roots coexist with unchanged standalone bootstrap and unique Page/destination contexts', async t => {
  const { doc, api } = setup(t);
  const roots = Array.from({ length: 3 }, () => container(doc));
  const content = roots.map(root => [...root.childNodes]);
  const html = doc.querySelector('main').outerHTML;
  const handles = roots.map(root => api.mount({ root }));
  const results = await Promise.all(handles.map(handle => handle.ready()));
  const standalone = await api.ready();
  assert.equal(standalone.page.id, 'WydClientPage'); assert.equal(standalone.page.properties.title, 'Host document');
  assert.equal(standalone.SUB.Page.Top.context, undefined); assert.equal(standalone.ok, true);
  assert.equal(new Set([...results, standalone].map(r => r.page.id)).size, 4);
  assert.equal(new Set(results.map(r => r.SUB.Page.Top.context)).size, 3);
  for (const [i, r] of results.entries()) {
    assert.equal(r.ok, true); assert.equal(r.page.prototype, 'wydgit.core/page'); assert.equal(r.page.schema, standalone.page.schema);
    assert.equal(r.page.properties.title, ''); assert.deepEqual(r.page.slots, { sections: [], navigation: [] });
    assert.equal(r.SUB.Page.Top.destination, 'SUB.Page.Top'); assert.equal(r.SUB.Page.Bottom.destination, 'SUB.Page.Bottom');
    assert.equal(r.SUB.Page.Top.context, r.page.id); assert.equal(r.SUB.Page.Bottom.context, r.page.id);
    assert.equal(r.SUB.Page.default, 'SUB.Page.Bottom'); assert.equal(ownRegions(roots[i]).length, 2);
    assert.equal(roots[i].firstChild.getAttribute('data-wydclient-region'), 'top');
    assert.equal(roots[i].lastChild.getAttribute('data-wydclient-region'), 'bottom');
    assert.equal(roots[i].childNodes[1], content[i][0]);
    assert.deepEqual(Object.keys(handles[i]), ['ready', 'state', 'unmount']);
    assert.equal(Object.isFrozen(handles[i]), true); assert.equal(Object.isFrozen(r), true);
    assert.doesNotMatch(JSON.stringify(r), /ownerDocument|trustedKeys|verifiedPrototypes|capabilities/);
  }
  assert.equal(doc.querySelector('main').outerHTML, html); assert.equal(ownRegions(doc.body).length, 2);
});
test('same-root concurrent mounting shares the handle, promise and first policy; duplicate HTML IDs do not merge roots', async t => {
  const { doc, api } = setup(t); const a = container(doc), b = container(doc); a.id = b.id = 'same';
  const calls = await Promise.all(Array.from({ length: 5 }, () => Promise.resolve(api.mount({ root: a }))));
  assert.ok(calls.every(h => h === calls[0])); assert.equal(calls[0].ready(), calls[1].ready());
  const first = await calls[0].ready();
  assert.equal(api.mount({ root: a, page: 'spoof/missing', policy: { unknown: true } }), calls[0]);
  assert.equal(await calls[0].ready(), first); assert.equal(ownRegions(a).length, 2);
  assert.notEqual((await api.mount({ root: b }).ready()).page.id, first.page.id);
});
test('root-local derived Pages and host property snapshots never inherit the document selection', async t => {
  const { doc, api } = setup(t); doc.documentElement.setAttribute('data-wydgit-page', 'host/page');
  inline(doc, doc.head, manifest([definition('host/page')]), { id: true });
  const a = container(doc), b = container(doc), c = container(doc);
  inline(doc, a, manifest([definition('acme/profile', { properties: { label: { type: 'string', default: 'Alex' } } })]));
  inline(doc, b, manifest([definition('orbit/profile', { properties: { label: { type: 'string', default: 'Sam' } } })]));
  a.setAttribute('data-wydgit-page', 'acme/profile'); a.setAttribute('data-wydgit-title', 'Alex title');
  const ra = await api.mount({ root: a }).ready();
  const rb = await api.mount({ root: b, page: 'orbit/profile', properties: { title: 'Sam title', slug: '/sam', label: 'Configured Sam' } }).ready();
  const rc = await api.mount({ root: c }).ready();
  assert.equal(ra.page.prototype, 'acme/profile'); assert.equal(ra.page.properties.title, 'Alex title');
  assert.equal(rb.page.prototype, 'orbit/profile'); assert.equal(rb.page.properties.label, 'Configured Sam'); assert.equal(rb.page.properties.slug, '/sam');
  assert.equal(rc.page.prototype, 'wydgit.core/page'); assert.equal((await api.ready()).page.prototype, 'host/page');
});
test('document discovery excludes predeclared and registered embedded boundaries, including legacy manifest IDs/links', async t => {
  const { doc, api, host } = setup(t); const a = container(doc), b = container(doc);
  inline(doc, a, manifest([definition()]), { id: true }); external(doc, b);
  host.fetch = async () => response(manifest());
  const docResult = await api.ready(); assert.equal(docResult.ok, true); assert.equal(docResult.page.prototype, 'wydgit.core/page');
  assert.equal((await api.mount({ root: a }).ready()).ok, true); assert.equal((await api.mount({ root: b }).ready()).ok, true);
  const { doc: doc2, api: api2 } = setup(t); const registered = container(doc2); registered.removeAttribute('data-wydgit-root');
  inline(doc2, registered, manifest(), { id: true }); api2.mount({ root: registered });
  assert.equal((await api2.ready()).ok, true);
});
test('only direct children are configuration; parent/nested/sibling manifests and prototype tables cannot be consumed', async t => {
  const { doc, api } = setup(t); const outer = container(doc), inner = container(doc, outer), sibling = container(doc);
  inline(doc, inner, manifest([definition('acme/inner')])); inner.setAttribute('data-wydgit-page', 'acme/inner');
  const wrapper = doc.createElement('div'); outer.append(wrapper); inline(doc, wrapper, '{bad');
  outer.setAttribute('data-wydgit-page', 'acme/inner'); sibling.setAttribute('data-wydgit-page', 'acme/inner');
  const [a, b, c] = await Promise.all([outer, inner, sibling].map(root => api.mount({ root }).ready()));
  assert.equal(a.diagnostics[0].code, 'PAGE.PROTOTYPE'); assert.equal(b.ok, true); assert.equal(c.diagnostics[0].code, 'PAGE.PROTOTYPE');
  assert.equal((await api.ready()).ok, true);
});
test('ambiguous inline/external sources fail closed within just that root', async t => {
  const { doc, api } = setup(t);
  for (const mode of ['inline', 'external', 'mixed']) {
    const root = container(doc);
    if (mode !== 'external') inline(doc, root, manifest());
    if (mode !== 'inline') external(doc, root);
    if (mode === 'inline') inline(doc, root, manifest());
    if (mode === 'external') external(doc, root, '/other.json');
    assert.equal((await api.mount({ root }).ready()).diagnostics[0].code, 'MANIFEST.DUPLICATE');
  }
  assert.equal((await api.mount({ root: container(doc) }).ready()).ok, true); assert.equal((await api.ready()).ok, true);
});
test('bad JSON, rejected Page and failed fetch cannot poison siblings or document state', async t => {
  const { doc, api } = setup(t);
  const bad = container(doc), invalidPage = container(doc), failedFetch = container(doc), good = container(doc);
  inline(doc, bad, '{secret'); invalidPage.setAttribute('data-wydgit-page', 'acme/missing'); external(doc, failedFetch);
  const results = await Promise.all([bad, invalidPage, failedFetch, good].map(root => api.mount({ root }).ready()));
  assert.deepEqual(results.slice(0, 3).map(r => r.diagnostics[0].code), ['MANIFEST.JSON', 'PAGE.PROTOTYPE', 'NETWORK.FAILED']);
  assert.ok(results.slice(0, 3).every(r => !r.registry.approved && r.page.prototype === 'wydgit.core/page'));
  assert.equal(results[3].ok, true); assert.equal((await api.ready()).ok, true);
});
test('local verified publisher bindings and configuration are per root, copied before async bootstrap', async t => {
  const { doc, api } = setup(t, { verifiedPrototypes: { 'acme/profile': 'acme' } });
  Object.defineProperty(doc, 'readyState', { value: 'loading', configurable: true });
  const a = container(doc), b = container(doc); const d = definition('acme/profile', { friends: ['acme/*'] });
  inline(doc, a, manifest([d])); inline(doc, b, manifest([d]));
  const policy = { verifiedPrototypes: { 'acme/profile': 'acme' } }, properties = { title: 'Original' };
  const h = api.mount({ root: a, policy, properties }); const other = api.mount({ root: b });
  policy.verifiedPrototypes['acme/profile'] = 'spoof'; properties.title = 'Changed';
  doc.dispatchEvent(new doc.defaultView.Event('DOMContentLoaded'));
  const result = await h.ready(); assert.equal(result.ok, true); assert.equal(result.page.properties.title, 'Original');
  assert.equal((await other.ready()).diagnostics[0].code, 'PROTOTYPE.FRIEND');
  assert.equal(Object.hasOwn(h, 'registry'), false); assert.equal(Object.hasOwn(h, 'root'), false);
});
test('signed package origin/key policy is isolated from siblings and global host policy; revoked/tampered roots fail independently', async t => {
  const refManifest = JSON.parse(await readFile(new URL('../examples/signed-manifest.json', import.meta.url)));
  refManifest.packages[0].url = '/package.json';
  const key = JSON.parse(await readFile(new URL('../examples/publisher/trusted-key.json', import.meta.url)));
  const bytes = await readFile(new URL('../examples/publisher/prototypes-1.0.0.json', import.meta.url), 'utf8');
  const { doc, api, host } = setup(t, { trustedKeys: [key] });
  host.fetch = async () => response(bytes, 'https://site.example/package.json');
  const roots = Array.from({ length: 4 }, () => container(doc));
  roots.forEach(root => { inline(doc, root, refManifest); root.setAttribute('data-wydgit-page', 'acme/home-page'); });
  const policies = [{ trustedKeys: [key] }, {}, { trustedKeys: [{ ...key, status: 'revoked' }] }, { trustedKeys: [key] }];
  roots[3].querySelector('script').textContent = JSON.stringify({ ...refManifest, packages: [{ ...refManifest.packages[0], signature: btoa('0'.repeat(64)) }] });
  const results = await Promise.all(roots.map((root, i) => api.mount({ root, policy: policies[i] }).ready()));
  assert.equal(results[0].ok, true);
  assert.deepEqual(results.slice(1).map(r => r.diagnostics[0].code), ['PACKAGE.UNTRUSTED_KEY', 'PACKAGE.UNTRUSTED_KEY', 'PACKAGE.SIGNATURE']);
  assert.doesNotMatch(JSON.stringify(results), /publicKey|verifiedPrototypes|trustedKeys|signature/);
  assert.equal((await api.ready()).ok, true);
});
test('manifest cannot smuggle peer registry, trusted keys, bindings or executable behavior', async t => {
  const { doc, api } = setup(t);
  for (const value of [ { ...manifest(), trustedKeys: [] }, { ...manifest(), verifiedPrototypes: { 'acme/profile': 'acme' } },
    { ...manifest(), registry: 'sibling' }, manifest([definition('acme/profile', { behaviorSource: 'globalThis.secret' })]) ]) {
    const root = container(doc); inline(doc, root, value); const result = await api.mount({ root }).ready(); assert.equal(result.ok, false); assert.equal(result.registry.approved, false);
  }
  assert.throws(() => api.mount({ root: container(doc), registry: api }), { code: 'MOUNT.CONFIG' });
});
test('external declarations remain unsigned site configuration; friendship still requires independent bindings', async t => {
  const { doc, api, host } = setup(t);
  host.fetch = async () => response(manifest([definition()]));
  const root = container(doc); external(doc, root); root.setAttribute('data-wydgit-page', 'acme/profile');
  assert.equal((await api.mount({ root }).ready()).ok, true);
  host.fetch = async () => response(manifest([definition('acme/profile', { friends: ['acme/*'] })]));
  const other = container(doc); external(doc, other);
  assert.equal((await api.mount({ root: other }).ready()).diagnostics[0].code, 'PROTOTYPE.FRIEND');
});
test('unmount is idempotent, preserves exact host nodes, leaves peers active and permits fresh remount', async t => {
  const { doc, api } = setup(t); const a = container(doc), b = container(doc), original = [...a.childNodes];
  const ah = api.mount({ root: a }), bh = api.mount({ root: b }); const before = await ah.ready(); await bh.ready(); await api.ready();
  const disposed = ah.unmount(); assert.equal(ah.state, 'disposed'); assert.equal(ah.unmount(), disposed); assert.equal(await ah.ready(), disposed);
  assert.equal(disposed.page, null); assert.equal(disposed.SUB, null); assert.equal(disposed.registry.approved, false);
  assert.deepEqual([...a.childNodes], original); assert.equal(bh.state, 'ready'); assert.equal(ownRegions(b).length, 2); assert.equal(api.state, 'ready');
  const replacement = api.mount({ root: a }); assert.notEqual(replacement, ah); assert.notEqual((await replacement.ready()).page.id, before.page.id); assert.equal(ownRegions(a).length, 2);
  assert.equal(ah.unmount(), disposed); assert.equal(replacement.state, 'ready'); assert.equal(ownRegions(a).length, 2);
});
test('nested roots have independent lifecycles in either registration order', async t => {
  for (const innerFirst of [true, false]) {
    const { doc, api } = setup(t); const outer = container(doc), inner = container(doc, outer);
    const order = innerFirst ? [inner, outer] : [outer, inner]; const handles = order.map(root => api.mount({ root })); await Promise.all(handles.map(h => h.ready()));
    const outerHandle = api.mount({ root: outer }), innerHandle = api.mount({ root: inner });
    outerHandle.unmount(); assert.equal(innerHandle.state, 'ready'); assert.equal(ownRegions(inner).length, 2); assert.equal(inner.parentElement, outer);
    const replacement = api.mount({ root: outer }); await replacement.ready();
    innerHandle.unmount(); assert.equal(replacement.state, 'ready'); assert.equal(ownRegions(outer).length, 2); assert.equal(ownRegions(inner).length, 0);
  }
});
test('unmount during DOM readiness releases listeners and cannot reactivate, even after remount', async t => {
  const { doc, api } = setup(t); Object.defineProperty(doc, 'readyState', { value: 'loading', configurable: true }); const root = container(doc);
  const old = api.mount({ root }), pending = old.ready(); assert.equal(old.state, 'initializing'); old.unmount();
  const current = api.mount({ root }); doc.dispatchEvent(new doc.defaultView.Event('DOMContentLoaded'));
  assert.equal((await pending).state, 'disposed'); assert.equal((await current.ready()).ok, true); assert.equal(ownRegions(root).length, 2);
});
test('unmount aborts pending fetch and settles immediately; a late response cannot claim remounted root', async t => {
  const { doc, api, host } = setup(t); const root = container(doc); external(doc, root);
  let finish, signal;
  host.fetch = async (_url, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); };
  const handle = api.mount({ root }), pending = handle.ready(); handle.unmount();
  assert.equal(signal.aborted, true); assert.equal((await pending).state, 'disposed'); assert.equal(ownRegions(root).length, 0);
  root.querySelector('link').remove(); const replacement = api.mount({ root }); assert.equal((await replacement.ready()).ok, true);
  finish(response(manifest([definition()]))); await new Promise(resolve => setImmediate(resolve));
  assert.equal(handle.state, 'disposed'); assert.equal(ownRegions(root).length, 2); assert.equal(replacement.state, 'ready');
});
test('unmount during signed verification cannot later activate a disposed Page', async t => {
  const signed = JSON.parse(await readFile(new URL('../examples/signed-manifest.json', import.meta.url)));
  signed.packages[0].url = '/package.json'; const key = JSON.parse(await readFile(new URL('../examples/publisher/trusted-key.json', import.meta.url)));
  const bytes = await readFile(new URL('../examples/publisher/prototypes-1.0.0.json', import.meta.url), 'utf8');
  const { doc, api, host } = setup(t); const root = container(doc); inline(doc, root, signed);
  let finish, entered; const started = new Promise(resolve => { entered = resolve; });
  host.fetch = async () => response(bytes, 'https://site.example/package.json');
  host.crypto = { subtle: { digest: (...args) => { entered(); return new Promise(resolve => { finish = async () => resolve(await webcrypto.subtle.digest(...args)); }); }, importKey: (...args) => webcrypto.subtle.importKey(...args), verify: (...args) => webcrypto.subtle.verify(...args) } };
  const handle = api.mount({ root, policy: { trustedKeys: [key] } }); await started; handle.unmount();
  assert.equal((await handle.ready()).state, 'disposed'); await finish(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(ownRegions(root).length, 0); assert.equal(handle.state, 'disposed');
});
test('detached roots require cleanup then reconnect/remount; pending roots cannot insert outside their container', async t => {
  const { doc, api, host } = setup(t); const root = container(doc); external(doc, root); let finish;
  host.fetch = async () => new Promise(resolve => { finish = resolve; });
  const handle = api.mount({ root }); root.remove(); finish(response(manifest()));
  assert.equal((await handle.ready()).diagnostics[0].code, 'BOOTSTRAP.BODY'); assert.equal(ownRegions(root).length, 0);
  handle.unmount(); assert.throws(() => api.mount({ root }), { code: 'MOUNT.ROOT' });
  root.querySelector('link').remove(); doc.body.append(root); assert.equal((await api.mount({ root }).ready()).ok, true);
});
test('roots cannot claim document/body, foreign elements, shadow roots or runtime-owned regions', async t => {
  const { doc, api } = setup(t); const foreign = new Window(); t.after(() => foreign.happyDOM.close());
  const h = api.mount({ root: container(doc) }); await h.ready();
  for (const root of [doc, doc.body, doc.documentElement, doc.head, doc.createElement('script'), foreign.document.body, null, {}, doc.querySelector('[data-wydclient-region]')]) assert.throws(() => api.mount({ root }), { code: 'MOUNT.ROOT' });
  const nested = doc.createElement('div'); doc.querySelector('[data-wydclient-region]').append(nested);
  assert.throws(() => api.mount({ root: nested }), { code: 'MOUNT.ROOT' });
});
test('host children and moved independent roots inside a region survive teardown', async t => {
  const { doc, api } = setup(t); const outer = container(doc), inner = container(doc);
  const a = api.mount({ root: outer }), b = api.mount({ root: inner }); await a.ready(); await b.ready();
  outer.firstChild.append(inner); a.unmount();
  assert.equal(inner.parentElement, outer); assert.equal(b.state, 'ready'); assert.equal(ownRegions(inner).length, 2);
});
test('native DOMException abort produces NETWORK.FAILED, not a secondary numeric-code TypeError', async t => {
  const { doc, api, host } = setup(t); const root = container(doc); external(doc, root);
  host.fetch = async () => { throw new DOMException('secret', 'AbortError'); };
  const result = await api.mount({ root }).ready(); assert.equal(result.diagnostics[0].code, 'NETWORK.FAILED');
  assert.doesNotMatch(JSON.stringify(result.diagnostics), /secret|TypeError/);
});
test('origin allowlists are per root and are not inherited from document or sibling policies', async t => {
  const { doc, api, host } = setup(t, { allowedOrigins: ['https://publisher.example'] });
  const a = container(doc), b = container(doc); external(doc, a, 'https://publisher.example/manifest.json'); external(doc, b, 'https://publisher.example/manifest.json');
  let requests = 0;
  host.fetch = async (_url, options) => { requests++; assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); return response(manifest(), 'https://publisher.example/manifest.json'); };
  const [first, second] = await Promise.all([api.mount({ root: a, policy: { allowedOrigins: ['https://publisher.example'] } }).ready(), api.mount({ root: b }).ready()]);
  assert.equal(first.ok, true); assert.equal(second.diagnostics[0].code, 'NETWORK.ORIGIN'); assert.equal(requests, 1);
});
test('failed document initialization leaves embedded roots independently mountable', async t => {
  const { doc, api } = setup(t); inline(doc, doc.head, '{bad', { id: true });
  assert.equal((await api.ready()).ok, false);
  const root = container(doc); inline(doc, root, manifest([definition()])); root.setAttribute('data-wydgit-page', 'acme/profile');
  const result = await api.mount({ root }).ready(); assert.equal(result.ok, true); assert.equal(result.page.prototype, 'acme/profile'); assert.equal(api.state, 'failed');
});
