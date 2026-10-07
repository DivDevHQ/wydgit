import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { loadRepository } from '../wydgine/repository.js';
import { renderSite, pagePath } from '../wydgine/index.js';
import { projectRoot } from '../app.js';

const model = loadRepository(projectRoot);
const rendered = new Map();
for (const page of model.pages.values()) {
 const route = pagePath(page, model.site);
 const result = renderSite(model, route);
 assert.equal(result.status, 200, route);
 assert.deepEqual(result.diagnostics, [], `${route}: ${result.diagnostics.join('; ')}`);
 const $ = load(result.html);
 assert.equal($('main h1').length, 1, `${route}: exactly one main heading`);
 const ids = $('[id]').map((_,el) => $(el).attr('id')).get();
 assert.equal(new Set(ids).size, ids.length, `${route}: duplicate anchors`);
 assert.equal($('script,iframe,style,[onclick]').length, 0);
 rendered.set(route, $);
}
let links = 0;
for (const [route, $] of rendered) {
 for (const el of $('a[href]').toArray()) {
  const href = $(el).attr('href');
  const url = new URL(href, 'http://local' + route);
  if (url.origin !== 'http://local') continue;
  const destination = rendered.get(url.pathname) || rendered.get(url.pathname.replace(/\/$/, '') + '/');
  assert.ok(destination, `${route}: missing page ${href}`);
  if (url.hash) assert.ok(destination('[id]').toArray().some(e => destination(e).attr('id') === decodeURIComponent(url.hash.slice(1))), `${route}: missing anchor ${href}`);
  links++;
 }
}
console.log(`Verified ${rendered.size} complete pages, ${links} internal links and unique anchors.`);
