import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {load as html} from 'cheerio';
import {prepareComponents,createPresentationLedger} from '../wydgine/components.js';
import {presentationPolicy} from '../wydgine/presentation-policy.js';
import {validateConfig} from '../wydgine/libraries/contracts.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {packageFixture} from '../test-support/packages.js';
import {installPackage} from '../wydgine/packages/index.js';
import {createHostApp} from '../app.js';
const presentation={schema:'wydgit.presentation/0.1',request:{library:'wydstore',apiVersion:'1.0.0',operation:'count',input:{store:'host-book',collection:'host-entries'}},template:{tag:'p',attrs:{id:{get:'id'}},text:{get:'data.state'}}};
function tree(count=20){let first={id:'widget-0',presentation,componentRequests:99999,children:[]},current=first;for(let i=1;i<count;i++){const next={id:'widget-'+i,presentation,limits:{componentRequests:99999},children:[]};current.children=[next];current=next;}return {pages:new Map([['page',{sections:[{blocks:[first]}]}]])};}
const context=limits=>new ExecutionContext({context:'FrontEnd',publisher:'example',app:'site',self:'page',visible:['widget-*'],limits});
const session={authorize:async()=>{}};
test('runtime configuration validates bounded integers and defaults without coercion',()=>{
 assert.equal(presentationPolicy().componentRequests,4);
 for(const componentRequests of [0,4,16])assert.equal(validateConfig({schema:'wydgit.host/0.1',libraries:[],runtime:{componentRequests}}).runtime.componentRequests,componentRequests);
 for(const runtime of [null,[],{componentRequests:-1},{componentRequests:17},{componentRequests:1.5},{componentRequests:'16'},{componentRequests:null},{componentRequests:true},{other:4}])assert.throws(()=>validateConfig({schema:'wydgit.host/0.1',libraries:[],runtime}),{code:'LIBRARY.INVALID_CONFIG'});
});
for(const limit of [0,4,16])test(`host limit ${limit} is cumulative across nesting, retries and failures`,async()=>{
 const caller=context({componentRequests:99999}),model=tree(),ledger=createPresentationLedger(caller,'page',{componentRequests:limit});let calls=0;
 const libraries={bindPresentation:()=>({invoke:async()=>{calls++;return {ok:false,value:{protected:'must never appear'},code:'PRIVATE.FAILURE'};}})};
 for(let retry=0;retry<3;retry++){const result=await prepareComponents(model,'page',{query:'componentRequests=99999'},caller,libraries,session,ledger);assert.equal(result.states.size,20);for(const state of result.states.values())assert.deepEqual(state,{state:'error'});assert.equal(calls,limit);}
 await prepareComponents(model,'page',{query:''},caller,libraries,session,createPresentationLedger(caller,'page',{componentRequests:limit}));assert.equal(calls,limit*2);
});
test('ledger is branded, bound to its owning context/Page and reductions cannot increase host policy',async()=>{
 const model=tree();let calls=0;const libraries={bindPresentation:()=>({invoke:async()=>{calls++;return {ok:true,value:1};}})};
 const caller=context({componentRequests:2}),ledger=createPresentationLedger(caller,'page',{componentRequests:16});await prepareComponents(model,'page',{query:''},caller,libraries,session,ledger);assert.equal(calls,2);
 for(const fake of [undefined,{},structuredClone(ledger)])await assert.rejects(prepareComponents(model,'page',{query:''},caller,libraries,session,fake),{code:'SEAM.CONTEXT'});
 await assert.rejects(prepareComponents(model,'page',{query:''},context({} ),libraries,session,ledger),{code:'SEAM.CONTEXT'});
 await assert.rejects(prepareComponents(model,'other',{query:''},caller,libraries,session,ledger),{code:'SEAM.CONTEXT'});
 await assert.rejects(prepareComponents(model,'page',{query:''},{...caller,limits:{componentRequests:16}},libraries,session,ledger),{code:'SEAM.CONTEXT'});
 assert.throws(()=>createPresentationLedger(caller,'page',{componentRequests:17}),{code:'LIBRARY.INVALID_CONFIG'});
});
test('authorization and validation failures consume eligible attempts without exposing data',async()=>{
 const caller=context({}),ledger=createPresentationLedger(caller,'page'),model=tree();let authorization=0,calls=0;
 const libraries={bindPresentation:()=>({invoke:async()=>{calls++;return {ok:true,value:{protected:'secret'}};}})};
 const failed={authorize:async()=>{authorization++;throw new Error('secret');}};
 const result=await prepareComponents(model,'page',{query:''},caller,libraries,failed,ledger);assert.equal(authorization,4);assert.equal(calls,0);
 await prepareComponents(model,'page',{query:''},caller,libraries,session,ledger);assert.equal(calls,0);for(const state of result.states.values())assert.deepEqual(state,{state:'error'});
});
for(const limit of [0,4,16])test(`installed Form-field presentation obeys host setting ${limit} on independent HTTP executions`,async t=>{
 const f=await packageFixture(t);f.manifest.bindings=[];f.manifest.resources.sources={};f.manifest.permissions.capabilities=['store.records.read'];f.manifest.permissions.visible=['guestbook','guestbook-form','guestbook-*'];f.manifest.permissions.editable=[];f.options.approvals=f.manifest.permissions;const operator=f.options.installationContext;f.options.installationContext=new ExecutionContext({context:'FrontEnd',...operator,visible:[...operator.visible,'guestbook-*'],editable:[...operator.editable,'guestbook-*']});
 await fs.writeFile(path.join(f.packagePath,'manifest.json'),JSON.stringify(f.manifest));
 const node=(id,prototype,slots={})=>({schema:'wydgit/0.2',id,prototype,properties:{},slots,provenance:{}});
 const definitions=[{id:'divdev/guestbook',publisher:'divdev',extends:'wydgit.core/section',properties:{},slots:{}},{id:'divdev/form',publisher:'divdev',extends:'wydgit.core/form',properties:{},slots:{fields:{accepts:['wydgit.core/field'],ordered:true,min:0,max:32}}},{id:'divdev/status-field',publisher:'divdev',extends:'wydgit.core/text-input',properties:{name:{type:'string',default:'status'},presentation:{type:'object',default:{request:{library:'wydstore',operation:'create'}}}},slots:{},presentation}];
 await fs.writeFile(path.join(f.packagePath,'prototypes.json'),JSON.stringify(definitions));await fs.writeFile(path.join(f.packagePath,'section.json'),JSON.stringify(node('guestbook','divdev/guestbook',{blocks:[node('guestbook-form','divdev/form',{fields:Array.from({length:18},(_,i)=>({...node('guestbook-status-'+i,'divdev/status-field'),properties:{name:'status-'+i}}))})]})));
 f.config.runtime={componentRequests:limit};await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify(f.config));await installPackage(f.options);
 const app=await createHostApp({root:f.root}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 for(let i=0;i<2;i++){const response=await fetch('http://127.0.0.1:'+server.address().port+'/?componentRequests=99999'),page=html(await response.text());assert.equal(response.status,200);assert.equal(page('p').filter((_,el)=>page(el).text()==='ready').length,limit);assert.equal(page('p').filter((_,el)=>page(el).text()==='error').length,18-limit);assert.doesNotMatch(page.text(),/secret|PRIVATE/);}
});
test('concurrent preparation attempts share reservations and malformed binding input is not refunded',async()=>{
 const caller=context({}),ledger=createPresentationLedger(caller,'page'),model=tree();let calls=0;
 const libraries={bindPresentation:()=>({invoke:async()=>{calls++;await Promise.resolve();return {ok:true,value:1};}})};
 await Promise.all([prepareComponents(model,'page',{query:''},caller,libraries,session,ledger),prepareComponents(model,'page',{query:''},caller,libraries,session,ledger)]);assert.equal(calls,4);
 const invalid=tree();invalid.pages.get('page').sections[0].blocks[0].presentation={...presentation,request:{...presentation.request,input:{op:'integer',value:'invalid'}}};const small=createPresentationLedger(caller,'page',{componentRequests:1});calls=0;
 await prepareComponents(invalid,'page',{query:''},caller,libraries,session,small);await prepareComponents(model,'page',{query:''},caller,libraries,session,small);assert.equal(calls,0);
});
test('package manifests cannot select runtime policy or execution-context limits',async t=>{const f=await packageFixture(t);const {validatePackageManifest}=await import('../wydgine/packages/manifest.js');for(const extra of [{runtime:{componentRequests:16}},{limits:{componentRequests:16}}])assert.throws(()=>validatePackageManifest({...f.manifest,...extra}),{code:'PACKAGE.MANIFEST'});});
