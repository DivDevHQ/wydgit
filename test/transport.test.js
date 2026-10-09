import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import { createApp, projectRoot } from '../app.js';
import { fixture, modelFixture } from '../test-support/events.js';
import { dehydrate } from '../wydgine/object-model/index.js';
import { temp } from '../test-support/wydstore.js';
import { fileCatalog } from '../wydgine/http/files.js';
import { ExecutionContext } from '../wydgine/seam/context.js';

async function start(t, options = {}) {
  const app = createApp(options), server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); if (server.listening) await app.shutdown(server); });
  return { app, server, url: `http://127.0.0.1:${server.address().port}` };
}
async function pageRoot(t) {
  const root = await temp(t);
  for (const dir of ['content', 'prototypes', 'public']) await fs.cp(path.join(projectRoot, dir), path.join(root, dir), { recursive: true });
  const raw = dehydrate(modelFixture().runtime);
  await fs.rm(path.join(root, 'content/pages'), { recursive: true });
  await fs.mkdir(path.join(root, 'content/pages'));
  await fs.writeFile(path.join(root, 'content/pages/home.json'), JSON.stringify(raw.slots.pages[0]));
  await fs.writeFile(path.join(root, 'content/navigation.json'), '[]');
  raw.slots.pages = []; raw.slots.navigation = [];
  await fs.writeFile(path.join(root, 'content/app.json'), JSON.stringify(raw));
  return root;
}
const security = response => {
  assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
};

test('Hono TCP host preserves routes, HEAD, security, asset cache and approved roots', async t => {
  const root = await pageRoot(t);
  await fs.writeFile(path.join(root, 'public/css/.private.css'), 'secret');
  await fs.symlink(path.join(projectRoot, 'package.json'), path.join(root, 'public/css/escape.css'));
  const { url } = await start(t, { root });
  for (const [route, status] of [['/', 200], ['/missing', 404], ['/package.json', 404], ['/css/.private.css', 404], ['/css/escape.css', 404], ['/css/%2e%2e%2fcontent%2fapp.json', 404], ['/runtime/server.js', 404]]) {
    const response = await fetch(url + route); assert.equal(response.status, status, route); security(response); await response.text();
  }
  const method = await fetch(url, { method: 'DELETE' }); assert.equal(method.status, 405); assert.match(method.headers.get('content-type'), /text\/html/); assert.equal(method.headers.get('allow'), 'GET, HEAD'); security(method);
  for (const route of ['/', '/missing', '/css/skins.css', '/css/site.css', '/runtime/wydclient/index.js']) {
    const head = await fetch(url + route, { method: 'HEAD' }); assert.equal(await head.text(), ''); security(head);
  }
  const skins = await fetch(url + '/css/skins.css'); assert.match(skins.headers.get('content-type'), /text\/css/); assert.equal(skins.headers.get('cache-control'), 'no-cache'); assert.match(await skins.text(), /data-skin/);
  const css = await fetch(url + '/css/site.css'); assert.match(css.headers.get('content-type'), /text\/css/); assert.equal(css.headers.get('cache-control'), 'public, max-age=0');
  const text = await css.text();
  const cached = await fetch(url + '/css/site.css', { headers: { 'if-none-match': css.headers.get('etag') } }); assert.equal(cached.status, 304); security(cached);
  assert.equal((await fetch(url + '/css/site.css', { headers: { 'if-modified-since': css.headers.get('last-modified') } })).status, 304);
  const partial = await fetch(url + '/css/site.css', { headers: { range: 'bytes=0-9' } }); assert.equal(partial.status, 206); assert.equal(await partial.text(), text.slice(0, 10));
  assert.equal((await fetch(url + '/css/site.css', { headers: { range: 'bytes=99999999-' } })).status, 416);
  for (const module of ['wydclient/index.js', 'wydgine/events/index.js', 'wydgine/object-model/validation.js', 'wydgine/seam/context.js', 'wydgine/seam/capabilities.js', 'wydgine/http/input.js']) {
    const response = await fetch(url + '/runtime/' + module); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /javascript/); security(response); assert.equal(await response.text(), await fs.readFile(path.join(projectRoot, module), 'utf8'));
  }
});

test('bounded forms, cookies, Change payload, explicit responses and concurrent isolation cross real Hono transport', async t => {
  const root = await pageRoot(t), base = fixture().context;
  const context = new ExecutionContext({ ...base, capabilities: [...base.capabilities, 'response.files.send', 'files.resources.read'], scopes: { ...base.scopes, files: ['report'] } });
  const fileRoot = await temp(t); await fs.writeFile(path.join(fileRoot, 'report.txt'), 'safe report');
  const files = await fileCatalog(fileRoot, [{ id: 'report', file: 'report.txt', type: 'text/plain' }]);
  const changes = [], loads = [], unloads = [];
  const handlers = [
    { type: 'Page.Load', owner: 'home', run: async function () {
      loads.push(this.SESSION.id);
      assert.equal(this.REQUEST.raw, undefined); assert.equal(this.REQUEST.req, undefined); assert.equal(this.REQUEST.headers, undefined);
      if (this.REQUEST.Cookies.Get('theme') === 'dark') this.RESPONSE.Cookies.Set('theme', 'light');
      assert.throws(() => this.RESPONSE.Headers.Set('Content-Security-Policy', 'unsafe'));
      if (this.REQUEST.Query.Get('markdown')) { this.RESPONSE.Headers.Set('Cache-Control', 'no-store'); await this.RESPONSE.WriteMarkdown('# Safe\n<script>evil()</script>'); }
      if (this.REQUEST.Query.Get('file')) await this.RESPONSE.SendFile(this.FILESYS.Get('report'));
      const label = this.REQUEST.Query.Get('label');
      if (label) { this.ME.Set('title', label); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(this.ME.properties.title, label); }
    } },
    { type: 'Change', owner: 'name', run: function () { changes.push([this.EVENT.OldValue, this.EVENT.NewValue]); } },
    { type: 'Page.Unload', owner: 'home', run: function () { unloads.push(this.SESSION.id); } }
  ];
  const actions = [{ page: 'home', target: 'name', type: 'Change', method: 'POST', capability: 'app.forms.submit', run: function () { this.ME.Set('value', this.EVENT.NewValue); } }];
  const { url } = await start(t, { root, logger: { error() {} }, execution: { context: () => context, handlers, actions, files } });
  const get = await fetch(url), html = await get.text(), cookie = get.headers.get('set-cookie').split(';')[0], csrf = /name="_csrf" value="([^"]+)"/.exec(html)[1];
  const form = `_target=name&_action=Change&_csrf=${csrf}&value=Alice`;
  const post = (body, extra = {}) => fetch(url, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded', ...extra }, body, duplex: 'half' });
  const ok = await post(form); assert.equal(ok.status, 200); assert.match(await ok.text(), /value="Alice"/); assert.deepEqual(changes, [['', 'Alice']]);
  for (const [encoding, compress] of [['gzip', gzipSync], ['deflate', deflateSync], ['br', brotliCompressSync]]) {
    const response = await post(compress(form), { 'content-encoding': encoding }); assert.equal(response.status, 200); await response.text();
  }
  for (const body of [form + '&name=%ZZ', form + '&_target=other', form.replace(csrf, 'wrong'), form + '&constructor=x']) {
    const response = await post(body); assert.ok([400, 403].includes(response.status)); security(response); await response.text();
  }
  for (const body of ['x=' + 'a'.repeat(32768), gzipSync('x=' + 'a'.repeat(32768)), Buffer.from([0xff])]) {
    const response = await post(body, Buffer.isBuffer(body) && body[0] === 0x1f ? { 'content-encoding': 'gzip' } : {}); assert.equal(response.status, 500); security(response); await response.text();
  }
  const brokenCompression = await post(Buffer.from('invalid gzip'), { 'content-encoding': 'gzip' }); assert.equal(brokenCompression.status, 500); security(brokenCompression); await brokenCompression.text();
  // Chunked body: enforce the bound while reading, without Content-Length.
  const chunked = await post((async function* () { yield 'x='; for (let i = 0; i < 40; i++) yield 'a'.repeat(1024); })(), {});
  assert.equal(chunked.status, 500);
  const markdown = await fetch(url + '?markdown=1', { headers: { cookie: cookie + '; theme=dark' } });
  assert.equal(await markdown.text(), '<h1>Safe</h1>\n'); assert.equal(markdown.headers.get('cache-control'), 'no-store'); assert.match(markdown.headers.get('set-cookie'), /theme=light; Path=\/; Secure; HttpOnly; SameSite=Lax/); security(markdown);
  const file = await fetch(url + '?file=1'); assert.equal(await file.text(), 'safe report'); assert.equal(file.headers.get('content-type'), 'text/plain'); assert.match(file.headers.get('content-disposition'), /^attachment/); security(file); assert.equal(file.headers.getSetCookie().length, 1);
  for (const route of ['?markdown=1', '?file=1']) { const head = await fetch(url + route, { method: 'HEAD', headers: { cookie } }); assert.equal(head.status, 200); assert.equal(await head.text(), ''); }
  const [one, two] = await Promise.all(['One', 'Two'].map(label => fetch(url + '?label=' + label, { headers: { cookie } }).then(response => response.text())));
  assert.match(one, /<title>One/); assert.match(two, /<title>Two/); assert.match(await (await fetch(url, { headers: { cookie } })).text(), /<title>Test/);
  assert.equal(loads.length, unloads.length);
});

test('shutdown waits for in-flight Page cleanup and async Server Stop exactly once', async t => {
  let enter, release; const entered = new Promise(resolve => enter = resolve), pending = new Promise(resolve => release = resolve), trace = [];
  const { app, server, url } = await start(t, { execution: {
    lifecycleHandlers: [{ type: 'Server.Start', owner: 'boilerplate', run: function () { trace.push('start'); } }, { type: 'Server.Stop', owner: 'boilerplate', run: async function () { await new Promise(resolve => setTimeout(resolve, 20)); trace.push('stop'); } }],
    handlers: [{ type: 'Page.Load', owner: 'home', run: async function () { enter(); await pending; } }, { type: 'Page.Unload', owner: 'home', run: function () { trace.push('unload'); } }]
  } });
  const response = fetch(url); await entered;
  const closing = app.shutdown(server); assert.deepEqual(trace, ['start']); release();
  assert.equal((await response).status, 200); await closing; assert.deepEqual(trace, ['start', 'unload', 'stop']);
  await app.locals.lifecycle.stop(); assert.deepEqual(trace, ['start', 'unload', 'stop']);
});

test('HTTP startup failure is observable and ends the Server lifecycle', async t => {
  const listener = await start(t); let stops = 0;
  const app = createApp({ execution: { lifecycleHandlers: [{ type: 'Server.Stop', owner: 'boilerplate', run: function () { stops++; } }] } });
  const server = app.listen(listener.server.address().port, '127.0.0.1');
  const [error] = await once(server, 'error'); assert.equal(error.code, 'EADDRINUSE');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(stops, 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) test(`server entrypoint gracefully exits on ${signal}`, async t => {
  const child = spawn(process.execPath, ['server.js'], { cwd: projectRoot, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const exited = once(child, 'exit');
  let output = '';
  await new Promise((resolve, reject) => { child.stdout.on('data', chunk => { output += chunk; if (/http:\/\/127\.0\.0\.1:\d+/.test(output)) resolve(); }); child.once('error', reject); child.once('exit', () => reject(new Error('Server exited before listen'))); });
  assert.match(output, /Wydgit 0\.2\.0-alpha\.11/); child.kill(signal);
  const [code, termination] = await exited; assert.equal(code, 0); assert.equal(termination, null);
});
