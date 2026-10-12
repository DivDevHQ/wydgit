// Trusted development tooling; this is never included in the browser distribution.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
const run = promisify(execFile), root = fileURLToPath(new URL('./', import.meta.url));
const browser = process.env.WYDCLIENT_CHROME ?? 'google-chrome';
const bundle = '/dist/wydgit-client-0.1.0-alpha.2.min.js';
const report = '<script src="/examples/report.js"></script>';
const body = '<main id="host-content"><h1>Host fixture</h1><pre id="diagnostics">Initializing…</pre></main>';
const script = `<script src="${bundle}"></script>`;
const fixtures = {
  '/late.html': `<html><head><title>Late script</title></head><body>${body}${script}${script}${report}</body></html>`,
  '/already-ready.html': `<html><head><title>Already ready</title><script>addEventListener('load',()=>{const s=document.createElement('script');s.src='${bundle}';s.onload=()=>{const r=document.createElement('script');r.src='/examples/report.js';document.head.append(r)};document.head.append(s)})</script></head><body>${body}</body></html>`,
  '/duplicate.html': `<html><head><title>Duplicate</title><script type="application/json" id="wydgit-manifest">{}</script><link rel="wydgit-manifest" href="/examples/manifest.json"></head><body>${body}${script}${report}</body></html>`,
  '/redirect.html': `<html><head><title>Redirect</title><link rel="wydgit-manifest" href="/redirect.json"></head><body>${body}${script}${report}</body></html>`,
  '/bad-json.html': `<html><head><title>Bad JSON</title><script type="application/json" id="wydgit-manifest">{bad</script></head><body>${body}${script}${report}</body></html>`,
  '/csp.html': `<html><head><title>CSP</title><link rel="wydgit-manifest" href="/examples/manifest.json"></head><body>${body}${script}${report}</body></html>`,
  '/embedded-lifecycle.html': `<html><head><title>Embedded lifecycle</title></head><body>${body}${script}${report}<pre id="embedded-results">Pending</pre><script src="/examples/embedded-lifecycle-fixture.js"></script></body></html>`
};
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/redirect.json') { response.writeHead(302, { Location: 'https://example.invalid/manifest.json' }); response.end(); return; }
  if (Object.hasOwn(fixtures, path)) {
    response.setHeader('Content-Type', 'text/html');
    if (path === '/csp.html') response.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'none'");
    response.end(fixtures[path]); return;
  }
  const file = resolve(root, '.' + decodeURIComponent(path));
  if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(404); response.end(); return; }
  try { const data = await readFile(file); response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html' })[extname(file)] ?? 'text/plain'); response.end(data); }
  catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
try {
  const version = (await run(browser, ['--version'])).stdout.trim(); console.log(version);
  const cases = [
    ['/examples/index.html', true, 'acme/home-page'], ['/examples/default.html', true, 'wydgit.core/page'],
    ['/examples/external.html', true, 'acme/home-page'], ['/examples/signed.html', true, 'acme/home-page'],
    ['/late.html', true, 'wydgit.core/page'], ['/already-ready.html', true, 'wydgit.core/page'],
    ['/duplicate.html', false, 'wydgit.core/page', 'MANIFEST.DUPLICATE'],
    ['/redirect.html', false, 'wydgit.core/page', 'NETWORK.FAILED'],
    ['/bad-json.html', false, 'wydgit.core/page', 'MANIFEST.JSON'],
    ['/csp.html', false, 'wydgit.core/page', 'NETWORK.FAILED']
  ];
  for (const [path, ok, prototype, code] of cases) {
    const { stdout } = await run(browser, ['--headless', '--disable-gpu', `--user-data-dir=${tmpdir()}/wydclient-h1-smoke-${process.pid}`, '--dump-dom', '--virtual-time-budget=3000', `http://127.0.0.1:${server.address().port}${path}`], { maxBuffer: 1024 * 1024, timeout: 20000 });
    const $ = load(stdout); const result = JSON.parse($('#diagnostics').text());
    assert.equal(result.ok, ok, path); assert.equal(result.page.prototype, prototype, path);
    if (code) assert.equal(result.diagnostics[0].code, code, path);
    assert.equal($('[data-wydclient-region]').length, 2, path);
    assert.equal($('body').children().first().attr('data-wydclient-region'), 'top', path);
    assert.equal($('body').children().last().attr('data-wydclient-region'), 'bottom', path);
    assert.equal($('#host-content h1').length, 1, path);
    console.log(`PASS ${path}: ${result.state}, ${prototype}, two regions, preserved host`);
  }
  for (const path of ['/examples/embedded.html', '/embedded-lifecycle.html']) {
    const { stdout } = await run(browser, ['--headless', '--disable-gpu', `--user-data-dir=${tmpdir()}/wydclient-h1b-smoke-${process.pid}`, '--dump-dom', '--virtual-time-budget=5000', `http://127.0.0.1:${server.address().port}${path}`], { maxBuffer: 1024 * 1024, timeout: 20000 });
    const $ = load(stdout); assert.equal(JSON.parse($('#diagnostics').text()).ok, true, path);
    assert.equal($('#host-content h1').length, 1, path);
    if (path === '/examples/embedded.html') {
      const profiles = $('[data-profile-diagnostics]').map((_, node) => JSON.parse($(node).text())).get();
      assert.equal(profiles.length, 2); assert.ok(profiles.every(r => r.ok)); assert.equal(new Set(profiles.map(r => r.page.id)).size, 2);
      assert.deepEqual(profiles.map(r => r.page.prototype), ['acme/alex', 'orbit/sam']);
      for (const id of ['profile-alex', 'profile-sam']) { const root = $('#' + id); assert.equal(root.children().first().attr('data-wydclient-region'), 'top'); assert.equal(root.children().last().attr('data-wydclient-region'), 'bottom'); assert.equal(root.find('h2').length, 1); }
      assert.equal($('[data-wydclient-region]').length, 6);
    } else {
      const checks = JSON.parse($('#embedded-results').text()); assert.equal(Object.keys(checks).length, 7);
      assert.ok(Object.values(checks).every(v => v === true), JSON.stringify(checks));
    }
    console.log(`PASS ${path}: independent embedded Pages, trust and lifecycle, preserved host`);
  }
  console.log(`${cases.length + 2}/${cases.length + 2} real-browser smoke cases passed.`);
} finally { await new Promise(resolve => server.close(resolve)); }
