import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { createHostApp } from '../app.js';
import { planPackageInstall, applyPackageInstall, activatePackages } from '../wydgine/packages/index.js';
import { loadRepository } from '../wydgine/repository.js';
import { initializeHost } from '../wydgine/host.js';
import { executePage } from '../wydgine/execution/page.js';
import { renderSite } from '../wydgine/index.js';
import { matchesObjectGrant } from '../wydgine/seam/context.js';
import { packageFixture } from '../test-support/packages.js';

test('ordinary Guestbook: uninstalled → plan → install → normal host → POST → restart persistence',async t=>{
 const {root,options}=await packageFixture(t);assert.throws(()=>loadRepository(root).runtime.get('guestbook'));
 const plan=await planPackageInstall(options);assert.equal(plan.instanceIds.some(id=>/^guestbook-entry-/.test(id)),false);assert.deepEqual(await fs.readdir(path.join(root,'data')),[]);
 await applyPackageInstall(plan);
 const start=async()=>{const app=await createHostApp({root});const server=app.listen(0,'127.0.0.1');await once(server,'listening');return {app,server,url:`http://127.0.0.1:${server.address().port}`};};
 let host=await start();t.after(()=>host.app.shutdown(host.server));
 const first=await fetch(host.url),html=await first.text();assert.equal(first.status,200);assert.match(html,/Guestbook/);assert.match(html,/class="wyd-form /);assert.match(html,/class="wyd-textarea wyd-input"/);assert.match(html,/class="wyd-submit"/);
 const cookie=first.headers.get('set-cookie').split(';')[0],csrf=/name="_csrf" value="([^"]+)"/.exec(html)[1];
 const post=async(name,message,token=csrf)=>{const r=await fetch(host.url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_target:'guestbook-form',_action:'Submit',_csrf:token,name,message})});return {status:r.status,html:await r.text()};};
 assert.equal((await post('Alice','bad','forged')).status,403);
 const invalid=await post(' ','keep this');assert.match(invalid.html,/aria-invalid="true"/);assert.match(invalid.html,/keep this/);
 const long=await post('Ada','x'.repeat(2001));assert.match(long.html,/aria-invalid="true"/);
 for(let i=0;i<2;i++){const saved=await post('Alice','Hello guestbook');assert.equal(saved.status,200);assert.match(saved.html,/Thank you/);assert.match(saved.html,/Alice — Hello guestbook/);assert.match(saved.html,/<textarea[^>]*><\/textarea>/);}
 for(const result of await Promise.all([post('Bob','Second'),post('Carol','Third')]))assert.match(result.html,/Thank you/);
 await host.app.shutdown(host.server);host=await start();const persisted=await (await fetch(host.url)).text();for(const value of ['Alice — Hello guestbook','Bob — Second','Carol — Third'])assert.ok(persisted.includes(value));
 assert.equal(persisted.split('Alice — Hello guestbook').length-1,2);
 for(const file of ['install.js','host.js','server.js'])await assert.rejects(fs.stat(new URL('../examples/guestbook/'+file,import.meta.url)),{code:'ENOENT'});
});


test('Guestbook renders two portable drafts, clears prior request children and never persists rendering',async t=>{
 const {root,packagePath,options}=await packageFixture(t);
 const template=JSON.parse(await fs.readFile(path.join(packagePath,'section.json'),'utf8'));
 assert.deepEqual(template.slots.blocks.find(n=>n.id==='guestbook-entries').slots.blocks,[]);
 await applyPackageInstall(await planPackageInstall(options));
 const accepted=await fs.readFile(path.join(root,'content/installed-packages.json'),'utf8');
 const model=loadRepository(root),libraries=await initializeHost({root}),active=activatePackages(model,libraries,root);
 const session={view:{id:'test-session',app:'boilerplate',authenticated:false},identity:null,active:()=>true,authorize:async()=>{}};
 const context=active.context({pageId:'home',session:session.view,ids:[]});
 for(const [id,name] of [['record-a','Ada'],['record-b','Grace']])assert.equal((await libraries.bind(context).call('wydstore','create',{store:'host-book',collection:'host-entries',id,data:{name,message:'Hello'}})).ok,true);
 assert.deepEqual(context.scopes.prototypes,['divdev/guestbook-entry']);
 const seen=[];
 for(let request=0;request<2;request++){
  const result=await executePage({model,pageId:'home',session,context,input:{method:'GET',path:'/'},libraries,
   serviceMappings:model.installed.packages[0].storageMappings,
   handlers:[...active.handlers,{type:'Page.Load',owner:'guestbook',wydBasic:'CALL Me.RefreshEntries()'}],
   render:(web,url,options)=>{const ids=web.runtime.get('guestbook-entries').slots.blocks;assert.equal(ids.length,2);for(const id of ids){assert.match(id,/^guestbook-entry-w[0-9a-f]{32}$/);assert.equal(matchesObjectGrant(context.editable,id),true);assert.equal(web.runtime.get(id).prototype,'divdev/guestbook-entry');assert.match(web.runtime.get(id).properties.content.value,/Ada|Grace/);}seen.push(...ids);return renderSite(web,url,options);}});
  assert.equal(result.error,null);assert.deepEqual(model.runtime.get('guestbook-entries').slots.blocks,[]);
 }
 assert.equal(new Set(seen).size,4);
 assert.equal(await fs.readFile(path.join(root,'content/installed-packages.json'),'utf8'),accepted);
 assert.deepEqual(loadRepository(root).runtime.get('guestbook-entries').slots.blocks,[]);
});
