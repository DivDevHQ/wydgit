import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import { createApp, projectRoot } from '../app.js';
import { loadRepository } from '../wydgine/repository.js';
import { renderSite, renderMarkdown, resolveLink, createRenderer } from '../wydgine/index.js';
const fixture = () => loadRepository(projectRoot);

test('HTML sanitizer rejects scripts, event handlers, embedded content and unsafe links', () => {
 const html = renderMarkdown('# Safe heading\n\n<script>alert(1)</script><img src=x onerror=alert(1)><iframe src="https://example.com"></iframe><svg><animate href="javascript:alert(1)"></animate></svg>\n\n[Bad](javascript:alert(1)) [Good](https://example.com)\n\n<textarea></textarea/><img src=x onerror=alert(1)>');
 const $ = load(html);
 assert.equal($('script,img,iframe,svg,textarea,[onerror]').length, 0);
 assert.equal($('a[href^="javascript:"]').length, 0);
 assert.equal($('h1').text(), 'Safe heading');
 assert.equal($('a[href="https://example.com"]').text(), 'Good');
});

test('navigation resolves pages, same-page anchors, cross-page anchors and external URLs', () => {
 const model = fixture(), home = model.pages.get('home');
 assert.equal(resolveLink({page:'about'},home,model), '/about/');
 assert.equal(resolveLink({section:'overview'},home,model), '#overview');
 assert.equal(resolveLink({page:'home',section:'overview'},model.pages.get('about'),model), '/#overview');
 assert.equal(resolveLink({url:'https://example.com'},home,model),'https://example.com/');
 for (const item of [{url:'javascript:alert(1)'},{url:'//example.com'},{page:'missing'},{section:'missing'},{}]) assert.throws(() => resolveLink(item,home,model));
});

test('unknown block prototype or content type degrades locally and preserves the page', () => {
 for (const change of [b => b.prototype='widget', b => b.content.type='html']) {
  const model = fixture(); change(model.pages.get('home').sections[0].blocks[0]);
  const result = renderSite(model);
  assert.equal(result.status,200); assert.equal(result.diagnostics.length,1);
  assert.match(result.html,/This content is temporarily unavailable/);
  assert.match(result.html,/Dolor Sit Amet/);
 }
});

test('unknown section and navigation prototypes degrade locally', () => {
 const model = fixture(); model.pages.get('home').sections[0].prototype='unknown'; model.navigation[0].prototype='unknown';
 const result = renderSite(model);
 assert.equal(result.status,200); assert.equal(result.diagnostics.length,2);
 assert.match(result.html,/Dolor Sit Amet/);
});

test('missing routes return complete 404 pages and invalid page/site definitions return 500', () => {
 const model = fixture();
 for (const route of ['/missing','/../../etc/passwd','/%2e%2e/private']) assert.equal(renderSite(model,route).status,404);
 assert.match(renderSite(model,'/missing').html,/<!doctype html>/);
 model.pages.get('home').prototype='unknown'; assert.equal(renderSite(model).status,500);
 model.site.prototype='unknown'; assert.equal(renderSite(model).status,500);
});

test('format and order properties apply without allowing arbitrary HTML or CSS injection', () => {
 const model = fixture();
 const page = model.pages.get('home');
 page.sections = [{id:'format-test',prototype:'section',format:{layout:'columns'},blocks:[
  {id:'second',prototype:'block',order:20,content:{type:'markdown',value:'SECOND'}},
  {id:'first',prototype:'block',order:10,position:'aside',format:{presentation:'pullquote',align:'center'},content:{type:'markdown',value:'FIRST'}}
 ]}];
 delete page.navigation; model.site.navigation=[];
 const result = renderSite(model);
 assert.equal(result.status,200); assert.deepEqual(result.diagnostics,[]);
 assert.ok(result.html.indexOf('FIRST') < result.html.indexOf('SECOND'));
 assert.match(result.html,/<aside id="first" class="wyd-presentation-pullquote wyd-align-center wyd-position-aside"/);
 page.sections[0].blocks[0].format={align:'"><script>alert(1)</script>'};
 const invalid = renderSite(model); assert.equal(invalid.diagnostics.length,1); assert.doesNotMatch(invalid.html,/<script>/);
});

test('resolved presentation properties are honored', () => {
 const model = fixture();
 model.pages.get('home').sections[0].blocks[0].position='aside';
 const result = renderSite(model); assert.deepEqual(result.diagnostics,[]);
 assert.match(result.html,/<aside id="hero-block-1"/);
});

test('invalid navigation targets become placeholders, not dangerous links', () => {
 const model=fixture(); model.navigation[0].items=[{label:'Bad',url:'javascript:alert(1)'}];
 const result=renderSite(model); assert.equal(result.status,200); assert.equal(result.diagnostics.length,1);
 assert.doesNotMatch(result.html,/javascript:/);
});

test('duplicate anchors are reported and malformed sections do not remove healthy content', () => {
 const model=fixture();
 model.pages.get('home').sections[0].blocks[0].anchors=['main'];
 model.pages.get('home').sections[1].blocks='broken';
 const result=renderSite(model); assert.equal(result.status,200); assert.equal(result.diagnostics.length,2);
 assert.match(result.html,/Dolor Sit Amet/);
});

test('JSON edits are picked up on the next render; corrupt JSON fails gracefully', t => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wydgine-test-'));
 t.after(() => fs.rmSync(root,{recursive:true,force:true}));
 for (const dir of ['prototypes','content']) fs.cpSync(path.join(projectRoot,dir),path.join(root,dir),{recursive:true});
 const renderer=createRenderer({root});
 assert.equal(renderer.renderPage('/').status,200);
 const file=path.join(root,'content/pages/home.json');
 const page=JSON.parse(fs.readFileSync(file)); page.properties.title='A changed title'; fs.writeFileSync(file,JSON.stringify(page));
 assert.match(renderer.renderPage('/').html,/A changed title/);
 fs.writeFileSync(file,'{broken'); assert.equal(renderer.renderPage('/').status,500);
 assert.equal(renderer.renderPage('/about/').status,500);
 fs.writeFileSync(path.join(root,'content/app.json'),'{broken'); assert.equal(renderer.renderPage('/').status,500);
});

test('HTTP host serves HTML and CSS, returns HTTP errors and does not expose source files', async t => {
 const server=createApp({logger:{error(){}}}).listen(0,'127.0.0.1');
 await new Promise(resolve => server.once('listening',resolve));
 t.after(() => new Promise(resolve => {server.close(resolve);server.closeAllConnections();}));
 const base=`http://127.0.0.1:${server.address().port}`;
 for (const route of ['/','/about','/about/','/contact/','/?x=1']) {
  const res=await fetch(base+route); assert.equal(res.status,200,route); assert.match(res.headers.get('content-type'),/text\/html/); assert.match(await res.text(),/<!doctype html>/);
 }
 assert.equal((await fetch(base+'/css/site.css')).status,200);
 const skins = await fetch(base+'/css/skins.css');
 assert.equal(skins.status, 200);
 assert.match(skins.headers.get('content-type'), /text\/css/);
 assert.match(await skins.text(), /data-skin="default"/);
 for (const route of ['/missing/','/content/site.json','/import/home.html','/package.json']) assert.equal((await fetch(base+route)).status,404);
 const post=await fetch(base+'/',{method:'POST'}); assert.equal(post.status,405); assert.equal(post.headers.get('allow'),'GET, HEAD');
 const head=await fetch(base+'/',{method:'HEAD'}); assert.equal(head.status,200); assert.equal(await head.text(),'');
});

test('whole-card links use navigation page IDs, follow slug changes and avoid nested anchors', () => {
 const model = fixture(), page = model.pages.get('home');
 const card = page.sections.find(s => s.id === 'pages').blocks[2];
 card.content.value = '### [Heading](/test/)\n\nAn [inline link](https://example.com) remains readable.';
 model.pages.get(card.linkToPage).slug = 'renamed-path';
 const result = renderSite(model), $ = load(result.html);
 assert.deepEqual(result.diagnostics, []);
 assert.equal($(`#${card.id}`).prop('tagName'), 'A');
 assert.equal($(`#${card.id}`).attr('href'), '/renamed-path/');
 assert.equal($(`#${card.id} a`).length, 0);
 assert.match($(`#${card.id}`).text(), /inline link/);
 assert.equal($(`#${card.id} h3`).text(), 'Heading');
 card.linkToPage = 'home';
 assert.equal(load(renderSite(model).html)(`#${card.id}`).attr('href'), '/');
});

test('cards can be plain or have a separate page link; invalid targets fail locally', () => {
 const model = fixture(), card = model.pages.get('home').sections.find(s => s.id === 'pages').blocks[2];
 card.format.presentation = 'card';
 assert.equal(load(renderSite(model).html)(`#${card.id} > a.card-page-link`).length, 1);
 delete card.linkToPage;
 assert.deepEqual(renderSite(model).diagnostics, []);
 card.format.presentation = 'whole-card-link';
 for (const target of [undefined, '', 'missing', 'javascript:alert(1)', '/about/']) {
  if (target === undefined) delete card.linkToPage; else card.linkToPage = target;
  const result = renderSite(model);
  assert.equal(result.status, 200);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(load(result.html)(`#${card.id}`).length, 0);
 }
 card.linkToPage = 'about';
 model.site.pages = model.site.pages.filter(id => id !== 'about');
 assert.ok(renderSite(model).diagnostics.some(d => d.includes('Unknown navigation page')));
});

test('site, page, section and block skins establish nested scopes with partial token overrides', async () => {
 const { renderSkinCss } = await import('../wydgine/skins.js');
 const model = fixture(), page = model.pages.get('home'), section = page.sections[0];
 for (const [id,tokens] of Object.entries({ pageSkin:{accent:'#112233'}, sectionSkin:{'card-columns':3}, blockSkin:{ink:'#445566'} })) {
  model.skins.set(id, {id,prototype:'skin',tokens});
 }
 page.skin = 'pageSkin'; section.skin = 'sectionSkin'; section.blocks[0].skin = 'blockSkin';
 const result = renderSite(model), $ = load(result.html);
 assert.deepEqual(result.diagnostics, []);
 assert.equal($('body').attr('data-skin'), 'default');
 assert.equal($('main').attr('data-skin'), 'pageSkin');
 assert.equal($('#hero').attr('data-skin'), 'sectionSkin');
 assert.equal($('#hero-block-1').attr('data-skin'), 'blockSkin');
 assert.equal($('#hero-block-2').attr('data-skin'), undefined);
 const css = renderSkinCss(model);
 assert.match(css, /\[data-skin="pageSkin"\]\{--accent:#112233\}/);
 assert.match(css, /\[data-skin="sectionSkin"\]\{--card-columns:3\}/);
 // No undeclared tokens are reset, so normal CSS inheritance supplies parent values.
 assert.match(css, /\[data-skin="blockSkin"\]\{--ink:#445566\}/);
});

test('missing and unsafe skins fail at their owner, without emitting unsafe CSS', async () => {
 const { renderSkinCss } = await import('../wydgine/skins.js');
 const model = fixture(), page = model.pages.get('home');
 model.skins.set('unsafe',{id:'unsafe',prototype:'skin',tokens:{accent:'#fff;}body{display:none}'}});
 page.sections[0].blocks[0].skin = 'unsafe';
 let result = renderSite(model);
 assert.equal(result.status,200); assert.equal(result.diagnostics.length,1);
 assert.doesNotMatch(renderSkinCss(model), /display:none/);
 delete page.sections[0].blocks[0].skin;
 page.sections[0].skin = 'missing';
 result = renderSite(model); assert.equal(result.status,200); assert.equal(result.diagnostics.length,1);
 delete page.sections[0].skin;
 page.skin = 'missing'; assert.equal(renderSite(model).status,500);
 delete page.skin; model.site.skin = 'missing'; assert.equal(renderSite(model).status,500);
});

test('explicit column groups preserve reading order and span section labels', () => {
 const result = renderSite(fixture()), $ = load(result.html);
 assert.equal($('#details > .wyd-column-left h2').text(), 'Consectetur Adipiscing');
 assert.equal($('#details > .wyd-column-right').length, 1);
 assert.ok(result.html.indexOf('details-heading') < result.html.indexOf('details-copy'));
});

test('page introductions precede the sidebar grid and header navigation marks only the current page', () => {
 const model = fixture();
 for (const page of model.pages.values()) {
  if (!page.navigation) continue;
  const route = page.id === model.site.home ? '/' : `/${page.slug}/`;
  const result = renderSite(model, route), $ = load(result.html);
  assert.deepEqual(result.diagnostics, []);
  assert.equal($('main > article > section.wyd-position-header h1').length, 1, route);
  assert.equal($('.reading-layout h1').length, 0, route);
  assert.equal($('.reading-layout > .toc').length, 1, route);
  assert.ok($('main > article').children().first().is('section.wyd-position-header'), route);
 }
 const $ = load(renderSite(model, '/about/').html);
 assert.equal($('.desktop-navigation a[aria-current="page"]').length, 1);
 assert.equal($('.desktop-navigation a[aria-current="page"]').attr('href'), '/about/');
 assert.equal($('.site-header .brand-mark').length, 0);
});
