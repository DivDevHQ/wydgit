import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { load as html } from 'cheerio';
import { packageFixture } from '../test-support/packages.js';
import { buildOperatorPolicy } from '../scripts/install-package.js';
import { planOperatorInstall,applyOperatorInstall } from '../scripts/package-infrastructure.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { loadRepository } from '../wydgine/repository.js';
import { initializeHost } from '../wydgine/host.js';
import { activatePackages } from '../wydgine/packages/index.js';
import { createHostApp } from '../app.js';
import { renderSite } from '../wydgine/index.js';
async function fixture(t,provider='JSON') {
 const f=await packageFixture(t);f.packagePath=path.resolve('examples/search');f.manifest=JSON.parse(await fs.readFile(path.join(f.packagePath,'manifest.json'),'utf8'));
 const model=loadRepository(f.root),pages=[...model.pages.keys()];
 const queue=['y','Create Search Results Page','','','term','2',pages.join(','),provider,'y','home','Find documentation','n'];
 const policy=await buildOperatorPolicy({...f,ask:async prompt=>{assert.ok(queue.length,'Unexpected '+prompt);return queue.shift();},write:()=>{}});
 return {...f,policy,pages};
}
const plan=f=>planOperatorInstall({...f,policy:f.policy,installationContext:new ExecutionContext(f.policy.installationContext)});
for(const provider of ['JSON','SQLite'])test(`${provider}: normal package installation adds reusable search to an unrelated existing site`,async t=>{
 const f=await fixture(t,provider),before=loadRepository(f.root),home=before.runtime.get('home'),originalContent=await fs.readFile(path.join(f.root,'content/pages/home.json'),'utf8');
 const appLocation=path.join(f.root,'content/app.json'),appDocument=JSON.parse(await fs.readFile(appLocation));appDocument.properties.themeMode=provider==='JSON'?'light':'dark';await fs.writeFile(appLocation,JSON.stringify(appDocument));
 const receipt=await applyOperatorInstall(await plan(f));
 assert.equal(receipt.package,'divdev/search');assert.equal(receipt.schema,'wydgit-install-receipt/0.1');assert.equal(receipt.additions.length,1);
 const model=loadRepository(f.root);assert.ok(model.registry.get('divdev/search-bar'));assert.ok(model.registry.get('divdev/search-results'));
 assert.deepEqual(renderSite(model,'/').diagnostics,[]);
 assert.equal(await fs.readFile(path.join(f.root,'content/pages/home.json'),'utf8'),originalContent);
 assert.deepEqual(model.runtime.get('home').properties,home.properties);assert.ok(model.runtime.get('home').slots.sections.includes(home.slots.sections[0]));
 assert.equal(model.runtime.get('wydsearch-bar-0').properties.placeholder,'Find documentation');
 assert.equal(model.runtime.get('wydsearch-bar').properties.placeholder,'Search this site');
 assert.equal(model.runtime.get('wydsearch-results').properties.queryParameter,'term');
 const libraries=await initializeHost({root:f.root}),active=activatePackages(model,libraries,f.root);
 const context=active.context({pageId:'search',session:{},ids:[]});
 assert.deepEqual(context.capabilities,['search.documents.read']);assert.deepEqual(context.scopes.wydstore,[]);
 assert.equal((await libraries.bind(context).invoke('wydsearch','1.0.0','metadata',{index:'site'})).ok,true);
 assert.equal((await libraries.bind(context).invoke('wydsearch','1.0.0','metadata',{index:'other'})).code,'SEARCH.DENIED');
 const app=await createHostApp({root:f.root}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port;
 const homeResponse=await fetch(base+'/'),homeText=await homeResponse.text();assert.equal(homeResponse.status,200,homeText);const barPage=html(homeText),bar=barPage('form[role=search]');assert.equal(bar.attr('action'),'/search/');assert.equal(bar.find('input').attr('name'),'term');
 const url=new URL(bar.attr('action'),base);url.search=new URLSearchParams({term:'Lorem'});
 const response=await fetch(url),results=html(await response.text());assert.equal(response.status,200);assert.equal(results('html').attr('data-wyd-theme'),provider==='JSON'?'light':'dark');assert.ok(results('.wyd-search-list li').length>0);assert.match(results('.wyd-search-results').text(),/Lorem/);
 const empty=html(await(await fetch(base+'/search/')).text());assert.match(empty('.wyd-search-results').text(),/Enter a search term/);
 assert.match(await(await fetch(base+'/css/skins.css')).text(),/data-wyd-theme="dark"/);
});
for(const hook of ['beforeProviderSetup','beforeConfigReplace','beforeStateReplace'])test(`search install ${hook} failure restores site/config and removes new storage`,async t=>{
 const f=await fixture(t),before=await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8');
 await assert.rejects(applyOperatorInstall(await plan(f),{[hook]:()=>{throw new Error('injected failure');}}),/injected failure/);
 assert.equal(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8'),before);
 assert.ok(!loadRepository(f.root).pages.has('search'));await assert.rejects(fs.stat(path.join(f.root,'content/installed-packages.json')),{code:'ENOENT'});
 await assert.rejects(fs.stat(path.join(f.root,'.wydgit-data/search-site')),{code:'ENOENT'});
});
test('search initial attachments reject undeclared prototypes, foreign Pages and receipt drift',async t=>{
 const f=await fixture(t);
 for(const change of [p=>p.additions[0].instance.prototype='wydgit.core/section',p=>p.additions[0].placement.parent='security',p=>p.approvals.scopes.wydsearch=['other']]){
  const policy=structuredClone(f.policy);change(policy);await assert.rejects(plan({...f,policy}));
 }
 await applyOperatorInstall(await plan(f));const location=path.join(f.root,'content/installed-packages.json'),state=JSON.parse(await fs.readFile(location));state.packages[0].additions[0].placement.page='other';await fs.writeFile(location,JSON.stringify(state));
 assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.CATALOG'});
});
test('existing Results Page supports independently configured Bars and Results without replacement',async t=>{
 const f=await fixture(t),model=loadRepository(f.root),page=model.runtime.get('about');
 delete f.policy.page;f.policy.placement={page:'about',parent:'about',slot:'sections',index:page.slots.sections.length};
 f.policy.properties['wydsearch-bar']={destination:'/about/',queryParameter:'lookup',submitLabel:'Find'};
 f.policy.properties['wydsearch-results']={queryParameter:'lookup',pageSize:1,showType:false,showSnippet:false,emptyMessage:'Start searching',noResultsMessage:'Nothing found'};
 f.policy.additions[0].instance.slots.blocks[0].properties.destination='/about/';
 f.policy.additions.push({placement:{page:'about',parent:'wydsearch',slot:'blocks',index:2},instance:{schema:'wydgit/0.2',id:'wydsearch-secondary-results',prototype:'divdev/search-results',properties:{index:'site',queryParameter:'secondary',emptyMessage:'Second independent search'},slots:{},provenance:{}}});
 f.policy.navigation={id:model.navigation[0].id,label:'Search'};
 const oldItems=model.runtime.get(model.navigation[0].id).properties.items;
 await applyOperatorInstall(await plan(f));const installed=loadRepository(f.root);
 assert.equal(installed.pages.size,model.pages.size);assert.deepEqual(installed.runtime.get(model.navigation[0].id).properties.items.slice(0,-1),oldItems);
 const app=await createHostApp({root:f.root}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});const base='http://127.0.0.1:'+server.address().port;
 const response=await fetch(base+'/about/'),body=html(await response.text());assert.equal(response.status,200);assert.match(body('#wydsearch-results').text(),/Start searching/);assert.match(body.text(),/Second independent search/);
 const result=html(await(await fetch(base+'/about/?lookup=Lorem')).text());assert.equal(result('#wydsearch-results .wyd-search-list li').length,1);assert.equal(result('#wydsearch-results .wyd-search-snippet').length,0);
 assert.equal(installed.runtime.get('wydsearch-bar').properties.submitLabel,'Find');assert.equal(installed.runtime.get('wydsearch-bar-0').properties.placeholder,'Find documentation');
});
