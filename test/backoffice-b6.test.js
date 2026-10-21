import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {load} from 'cheerio';
import {b6Fixture} from '../test-support/backoffice-b6.js';
import {b5Http} from '../test-support/backoffice-b5.js';
import {initializeHost} from '../wydgine/host.js';
import {createGate} from '@wydgit/gate/client';
const meta=html=>{const $=load(html);return {csrf:$('meta[name="wydgit-backoffice-csrf"]').attr('content'),bindings:JSON.parse($('meta[name="wydgit-backoffice-bindings"]').attr('content')),controls:JSON.parse($('meta[name="wydgit-backoffice-controls"]').attr('content'))};};
for(const provider of ['json','sqlite'])test(`BOB6-01 ${provider}: installed reusable editor/dashboard, strict bindings, denied persistence and lifecycle`,async t=>{
 const f=await b6Fixture(t,provider),h=await b5Http(t,f);let response=await h.get('/backoffice/pages/workspace'),html=await response.text();assert.equal(response.status,200,html);
 assert.ok(f.reviewBytes<=65536);const m=meta(html);assert.match(html,/runtime\/wydclient\/backoffice-controls.js/);assert.match(html,/Welcome to the workspace/);
 assert.equal(m.controls.consumers.length,2);assert.deepEqual(m.controls.consumers[0].actions.map(a=>Object.keys(a.input.fields)),[[],['data','version']]);
 assert.equal((await h.get('/runtime/wydclient/backoffice-controls.js')).status,200);
 const invoke=async(name,input={},expected=200,binding=m.bindings.find(b=>b.name===name))=>{const r=await h.post({pageBinding:binding,input,confirmed:true},m.csrf),v=await r.json();assert.equal(r.status,expected,JSON.stringify(v));return v;};
 assert.equal((await invoke('load')).value.version,1);
 const data={title:'Edited layout',columns:true,body:'## Authored content\n\nSafe **Markdown**. <script>window.untrusted=true</script>'};
 assert.equal((await invoke('save',{version:1,data})).value.version,2);
 await invoke('save',{version:1,data:{...data,title:'Conflict'}},409);
 for(const input of [{version:2,data:{...data,columns:'yes'}},{version:2,data:{...data,body:'x'.repeat(2049)}},{version:2,data,collection:'foreign'},{version:2,data,id:'other'},{version:2,data:{...data,authority:true}}])await invoke('save',input,400);
 for(const mutate of [b=>b.name='not-reviewed',b=>b.reference.package='divdev/backoffice-notices',b=>b.page.generation='obsolete']){const b=structuredClone(m.bindings.find(b=>b.name==='save'));mutate(b);await invoke('save',{version:2,data},409,b);}
 await f.grant(['content.pages.view','content.workspace.read']);await invoke('save',{version:2,data:{...data,title:'Denied'}},403);
 const denied=meta(await (await h.get('/backoffice/pages/workspace')).text());assert.equal(denied.controls.consumers[0].actions.length,1);
 await f.grant(f.permissions);assert.equal((await invoke('load')).value.data.title,data.title);assert.equal((await invoke('dashboard')).value[0].version,2);
 html=await (await h.get('/backoffice/pages/workspace')).text();assert.match(html,/id="workspace-preview"[^>]*|wyd-layout-columns/);assert.match(html,/wyd-layout-columns/);assert.match(html,/<strong>Markdown<\/strong>/);assert.doesNotMatch(html,/<script>window.untrusted/);
 await f.grant(['content.workspace.read','content.workspace.write']);assert.equal((await h.get('/backoffice/pages/workspace')).status,403);await invoke('save',{version:2,data},403);await f.grant(f.permissions);
 await h.stop();await f.libraries.close();f.libraries=await initializeHost({root:f.root});f.gate=createGate(f.libraries.bind(f.gateContext));
 const restart=await b5Http(t,f),fresh=meta(await (await restart.get('/backoffice/pages/workspace')).text());
 const r=await restart.post({pageBinding:fresh.bindings.find(b=>b.name==='load'),input:{}},fresh.csrf);assert.equal((await r.json()).value.version,2);await restart.stop();
 await f.place('retire');const retired=await b5Http(t,f);assert.equal((await retired.get('/backoffice/pages/workspace')).status,404);await retired.stop();
 await f.place('replace');await f.publish();const replacement=await b5Http(t,f),latest=meta(await (await replacement.get('/backoffice/pages/workspace')).text());
 assert.equal((await replacement.post({pageBinding:m.bindings.find(b=>b.name==='save'),input:{version:2,data},confirmed:true},latest.csrf)).status,409);
 const final=await replacement.post({pageBinding:latest.bindings.find(b=>b.name==='load'),input:{}},latest.csrf);assert.equal((await final.json()).value.version,2);
});
test('BOB6-02: trusted adapter source and shipped runtime remain identical',async()=>{
 for(const name of ['backoffice.js','backoffice-controls.js'])assert.equal(await fs.readFile('wydclient/'+name,'utf8'),await fs.readFile('packages/wydgine/runtime/wydclient/'+name,'utf8'));
});
