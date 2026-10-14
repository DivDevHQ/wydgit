import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { Window } from 'happy-dom';
const root = new URL('../', import.meta.url);
test('both standalone classic browser artifacts bootstrap without imports; loading twice reuses canonical context', async t => {
  for (const suffix of ['', '.min']) {
    const code = await readFile(new URL(`dist/wydgit-client-0.1.0-alpha.3${suffix}.js`, root), 'utf8');
    assert.doesNotMatch(code, /\bimport\s|(?<![\w.])require\s*\(|\beval\s*\(|new Function\s*\(|node:|innerHTML\s*=/);
    assert.doesNotMatch(code, /acme\/message-panel|wydgit\.core\/app/);
    const window = new Window({ url: 'https://site.example/' });
    t.after(() => window.happyDOM.close());
    Object.defineProperty(window.document, 'readyState', { value: 'complete' });
    window.document.title = 'Classic script';
    window.eval(code); // Test harness executes the trusted distribution, never package JSON.
    const api = window.WydClient, first = api.ready();
    window.eval(code); assert.equal(window.WydClient, api); assert.equal(api.ready(), first);
    const result = await first; assert.equal(result.ok, true); assert.equal(result.page.prototype, 'wydgit.core/page');
    assert.equal(window.document.querySelectorAll('[data-wydclient-region]').length, 2);
    assert.equal(Object.isFrozen(api), true);
  }
});
test('measured sizes and package/runtime metadata match checked-in versioned distribution', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root)));
  const sizes = JSON.parse(await readFile(new URL('dist/sizes.json', root)));
  const code = await readFile(new URL(`dist/wydgit-client-${pkg.version}.min.js`, root));
  assert.equal(pkg.wydsub, sizes.protocol); assert.equal(pkg.version, sizes.version);
  assert.equal(code.length, sizes.minified); assert.equal(gzipSync(code).length, sizes.gzip); assert.equal(brotliCompressSync(code).length, sizes.brotli);
});
test('published signed sample is verifiable with the independently declared example key', async () => {
  const { webcrypto } = await import('node:crypto');
  const { signedPayload, loadPackage } = await import('../src/packages.js');
  const { parseJSON } = await import('../src/data.js');
  const bytes = await readFile(new URL('examples/publisher/prototypes-1.0.0.json', root));
  const manifest = parseJSON(await readFile(new URL('examples/signed-manifest.json', root)));
  const config = JSON.parse(await readFile(new URL('examples/publisher/trusted-key.json', root)));
  assert.ok(signedPayload(manifest.packages[0]).length > 0);
  const url = 'https://site.example/examples/publisher/prototypes-1.0.0.json';
  const result = await loadPackage(manifest.packages[0], { location: { href: 'https://site.example/examples/signed.html', origin: 'https://site.example' }, crypto: webcrypto, fetch: async () => { const response = new Response(bytes, { headers: { 'Content-Type': 'application/json' } }); Object.defineProperty(response, 'url', { value: url }); return response; } }, { trustedKeys: [config], allowedOrigins: [] });
  assert.equal(result[0].id, 'acme/home-page');
});
