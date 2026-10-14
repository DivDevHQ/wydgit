import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { Window } from 'happy-dom';
const root = new URL('../', import.meta.url);
test('both standalone classic browser artifacts bootstrap without imports; loading twice reuses canonical context', async t => {
  const pkg=JSON.parse(await readFile(new URL('package.json',root)));
  for (const suffix of ['', '.min']) {
    const code = await readFile(new URL(`dist/wydgit-client-${pkg.version}${suffix}.js`, root), 'utf8');
    assert.doesNotMatch(code, /\bimport\s|(?<![\w.])require\s*\(|\beval\s*\(|new Function\s*\(|node:|innerHTML\s*=/);
    assert.doesNotMatch(code, /acme\/message-panel|wydgit\.core\/app/);
    const window = new Window({ url: 'https://site.example/' });
    t.after(() => window.happyDOM.close());
    Object.defineProperty(window.document, 'readyState', { value: 'complete' });
    window.document.title = 'Classic script';
    window.eval(code); // Test harness executes the trusted distribution, never package JSON.
    const api = window.WydClient, first = api.ready(); assert.equal(api.version,pkg.version);
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

test('alpha.4 contains the intended updated validation while restored alpha.3 retains H2 behavior', async t => {
  const definition = { id:'acme/home-page',publisher:'acme',extends:'wydgit.core/page',
    methodRules:{lib0:{access:'public'}},
    behavior:{schema:'sewn/0.14',body:[],procedures:{lib0:{kind:'sub',params:[],body:[]}},
      libraries:[{id:'acme/library',version:'1.0.0',alias:'Helpers',methods:{lib0:{name:'helper',access:'public',requires:[]}}}]} };
  for (const [version, ok] of [['0.1.0-alpha.3',true],['0.1.0-alpha.4',false]]) for (const suffix of ['', '.min']) {
    const window = new Window({ url:'https://site.example/' }); t.after(()=>window.happyDOM.close());
    Object.defineProperty(window.document,'readyState',{value:'complete'});
    window.document.documentElement.setAttribute('data-wydgit-page',definition.id);
    const manifest = window.document.createElement('script'); manifest.id='wydgit-manifest'; manifest.type='application/json';
    manifest.textContent=JSON.stringify({schema:'wydgit.registry/0.1',protocol:'0.1',prototypes:[definition]}); window.document.head.append(manifest);
    window.eval(await readFile(new URL(`dist/wydgit-client-${version}${suffix}.js`,root),'utf8'));
    assert.equal(window.WydClient.version,version);
    const result=await window.WydClient.ready();assert.equal(result.ok,ok,version+suffix);
    if(!ok)assert.equal(result.diagnostics[0].code,'PROTOTYPE.STATIC');
  }
});

test('all current static examples pin the package artifact and versioned size report matches current metadata', async () => {
  const pkg=JSON.parse(await readFile(new URL('package.json',root)));
  for(const name of ['index','default','external','signed','embedded','instances','instances-embedded']) {
    const html=await readFile(new URL(`examples/${name}.html`,root),'utf8');
    assert.ok(html.includes(`wydgit-client-${pkg.version}.min.js`),name);
  }
  assert.deepEqual(await readFile(new URL(`dist/sizes-${pkg.version}.json`,root)),await readFile(new URL('dist/sizes.json',root)));
});
