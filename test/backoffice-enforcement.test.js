import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {load} from 'cheerio';
import {compileClass} from '../wydgine/wydbasic/index.js';
import {compileDefinitions} from '../wydgine/repository.js';
import {createApp} from '../app.js';
import {actionFixture} from '../test-support/backoffice.js';
import {twoResourceActionFixture,installedTaskboardFixture} from '../test-support/backoffice-preflight.js';
import {adoptionFixture} from '../test-support/backoffice-adoption.js';
import {reviewFixture} from '../test-support/backoffice-enforcement.js';
import {actionReference} from '../packages/wydgine/src/engine/packages/backoffice-preflight-contract.js';
import {executionPlacement} from '../wydgine/packages/index.js';
import {STATE} from '../wydgine/packages/state.js';
import {createBackOfficeActions} from 'wydgine/trusted/packages';
import {initializeHost} from '../wydgine/host.js';
import {configuration} from '../test-support/wydgate.js';
import {createGate} from '@wydgit/gate/client';
import {manifest as gateManifest} from '@wydgit/gate';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {reserveStoppedApp} from '../packages/wydgine/src/engine/execution/maintenance.js';
const fixture=async(t,p,options)=>adoptionFixture(await twoResourceActionFixture(t,p,options));
const copy=x=>structuredClone(x);
function binding(f,id,name=id,usage='intent',fixedInput={}){
  const e=f.entry(),a=e.manifest.backofficeActions.find(a=>a.id===id),consumer=f.pageFacts().nodes.find(n=>n.id===e.instance);
  return {name,consumer:e.instance,reference:actionReference(e,a,e.executionPlacement.app),usage,fixedInput,
    constraints:[{type:consumer.ancestors.at(-1),targets:[`${a.owner}/${a.id}`],effect:a.effect,input:a.input,output:a.output}]};
}
async function publishPage(f,bindings=[]){const p=f.proposal();p.bindings=bindings;await f.adopt(f.payload(undefined,[p]));return p;}
async function http(t,f){
  const app=createApp({root:f.root,libraries:f.libraries,localHostname:'127.0.0.1',execution:{verifiedPackages:f.verifiedPackages??{}},logger:{error(){}}});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');let closed=false;
  const stop=async()=>{if(!closed){closed=true;await app.shutdown(server);}};t.after(stop);
  const base='http://127.0.0.1:'+server.address().port,headers={Cookie:'wydgit-auth='+f.login.token};
  const get=(route='/backoffice/pages/administration',extra={})=>fetch(base+route,{headers:{...headers,...extra}});
  const shell=await get('/backoffice'),csrf=load(await shell.text())('meta[name="wydgit-backoffice-csrf"]').attr('content');
  const post=body=>fetch(base+'/backoffice/api/actions/invoke',{method:'POST',headers:{...headers,Origin:base,'Content-Type':'application/json','X-Wydgit-CSRF':csrf},body:JSON.stringify(body)});
  return {app,base,get,post,stop};
}
async function processApp(t,f){
  const child=spawn(process.execPath,['test-support/backoffice-enforcement-child.js',f.root,JSON.stringify(f.verifiedPackages??{})],{stdio:['ignore','pipe','pipe','ipc']});
  let errors='';child.stderr.on('data',v=>errors+=v);t.after(()=>child.kill('SIGKILL'));
  const [message]=await Promise.race([once(child,'message',{signal:AbortSignal.timeout(20000)}),once(child,'exit').then(()=>{throw Error(errors||'child exited');})]);
  return {child,message,base:message.port?'http://127.0.0.1:'+message.port:null,async stop(){const done=once(child,'exit');if(child.connected)child.send('stop');await done;assert.equal(errors,'');}};
}
for(const provider of ['json','sqlite']){
  test(`BOB4B-01 ${provider}: real installed startup refuses absent, partial, revoked and stale migration before lifecycle`,async t=>{
    const f=await fixture(t,provider);let started=0;
    const start=()=>createApp({root:f.root,libraries:f.libraries,lifecycle:{start(){started++;},async stop(){}}});
    assert.throws(start,{code:'BACKOFFICE.MIGRATION_REQUIRED'});assert.equal(started,0);
    const before=await fs.readFile(path.join(f.root,STATE));const failed=await processApp(t,f);
    assert.equal(failed.message.code,'BACKOFFICE.MIGRATION_REQUIRED');await once(failed.child,'exit');
    assert.deepEqual(await fs.readFile(path.join(f.root,STATE)),before);
    await f.adopt(f.payload(['get']));assert.throws(start,{code:'BACKOFFICE.MIGRATION_REQUIRED'});assert.deepEqual(f.inspect().backoffice.missingActions.length,5);
    await f.adopt(f.payload());const h=await http(t,f);assert.equal((await h.get('/backoffice')).status,200);await h.stop();
    await f.adopt({actions:[],pages:[]});assert.throws(start,{code:'BACKOFFICE.MIGRATION_REQUIRED'});
    await f.adopt(f.payload());const state=f.state(),e=f.entry();
    await executionPlacement({root:f.root,app:f.request.app,package:e.manifest.id,installation:e.receipt.id,revision:state.revision,action:'replace',context:'BackOffice',installationContext:f.operator});
    assert.throws(start,{code:'BACKOFFICE.MIGRATION_REQUIRED'});assert.equal(f.inspect().backoffice.status,'stale');
  });
  test(`BOB4B-02 ${provider}: restrictive native dispatch and all transaction members prevent archive mutation`,async t=>{
    const f=await fixture(t,provider);await f.adopt(f.payload());
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[...f.storePermissions,'archive.action.read','archive.records.read','archive.records.write']});
    const api=f.framework(),actions=await f.discover(api),ref=id=>actions.find(a=>a.name===id).reference;
    const invoke=(id,input)=>api.invoke({...f.request,reference:ref(id),input,confirmed:true});
    assert.equal((await invoke('create',{...f.recordInput,data:{text:'approved'}})).ok,true);
    assert.equal((await invoke('get',f.recordInput)).value.data.text,'approved');
    for(const input of [{...f.recordInput,collection:'archive'},{...f.recordInput,collection:'*'},{...f.recordInput,store:'foreign'}])assert.equal((await invoke('create',{...input,data:{text:'denied'}})).ok,false);
    assert.equal((await invoke('archive-get',f.recordInput)).ok,false);
    const batch=await invoke('transaction',{store:'records',collection:'records',operations:[{operation:'create',input:{id:'batch',data:{text:'first'}}},{operation:'create',input:{id:'batch',collection:'archive',data:{text:'second'}}}]});
    assert.equal(batch.ok,false);assert.equal((await invoke('get',{...f.recordInput,id:'batch'})).code,'STORE.NOT_FOUND');
    assert.equal((await invoke('archive-get',{store:'records',collection:'archive',id:'batch'})).code,'STORE.NOT_FOUND');
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:f.storePermissions.filter(p=>p!=='content.records.read')});assert.equal((await invoke('get',f.recordInput)).ok,false);
  });
  test(`BOB4B-03 ${provider}: canonical Page approval and live permission are independent; public/alternate routes remain closed`,async t=>{
    const f=await fixture(t,provider);await f.adopt(f.payload());let h=await http(t,f);
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.pages.view']});
    assert.equal((await h.get()).status,404);await h.stop();await publishPage(f);h=await http(t,f);
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[]});let response=await h.get();assert.equal(response.status,403);assert.doesNotMatch(await response.text(),/Administration|backoffice-members/);
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.pages.view']});response=await h.get();assert.equal(response.status,200,await response.clone().text());assert.match(await response.text(),/Administration/);assert.equal(response.headers.get('cache-control'),'no-store');
    for(const route of ['/administration/','/backoffice/administration','/backoffice/pages/administration/','/_transfer/wydstore/get/page-admin/backoffice-members'])assert.notEqual((await h.get(route)).status,200,route);
    assert.equal((await h.get('/backoffice/pages/unknown')).status,404);
    assert.equal((await fetch(h.base+'/backoffice/pages/administration')).status,401);
    for(const method of ['HEAD','POST','PUT'])assert.equal((await fetch(h.base+'/backoffice/pages/administration',{method,headers:{Cookie:'wydgit-auth='+f.login.token,Origin:h.base,'Content-Type':'application/json'}})).status,405);
    for(const extra of [{Origin:'https://foreign.test'},{'Sec-Fetch-Site':'same-site'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await h.get(undefined,extra)).status,403);
    assert.equal((await h.get('/backoffice/pages/administration?app=foreign')).status,400);
    await f.gate.logout(f.login.token);response=await h.get();assert.equal(response.status,401);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
  });
  test(`BOB4B-04 ${provider}: Page intents pin reviewed bindings, typed actual inputs, constants and independent action authority`,async t=>{
    const f=await fixture(t,provider);await publishPage(f,[binding(f,'create','save','intent',{store:'records',collection:'records'}),binding(f,'archive-get','archive')]);
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[...f.storePermissions,'content.pages.view']});
    const h=await http(t,f),response=await h.get(),html=await response.text();assert.equal(response.status,200,html);
    const descriptors=JSON.parse(load(html)('meta[name="wydgit-backoffice-bindings"]').attr('content'));assert.equal(descriptors.length,1,'Page admission does not reveal denied action metadata');
    const pageBinding=descriptors[0],body={pageBinding,input:{id:'bound',data:{text:'authorized'}},confirmed:true};
    let result=await h.post(body);assert.equal(result.status,200,await result.clone().text());
    for(const change of [b=>b.pageBinding.reference.package='foreign/package',b=>b.pageBinding.reference.installation='foreign',b=>b.pageBinding.reference.generation='stale',b=>b.pageBinding.page.revision='0'.repeat(64),b=>b.pageBinding.name='archive',b=>b.pageBinding.consumer='forged',b=>b.reference=b.pageBinding.reference,b=>b.input.collection='archive',b=>b.input.data.text='x'.repeat(129),b=>b.input.authority={trusted:true}]){
      const altered=copy(body);change(altered);altered.input.id='denied';result=await h.post(altered);assert.ok([400,403,409].includes(result.status),await result.text());
    }
    const api=f.framework(),get=(await f.discover(api)).find(a=>a.name==='get');assert.equal((await f.invoke(api,get.reference,{...f.recordInput,id:'denied'})).code,'STORE.NOT_FOUND');
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.pages.view']});result=await h.post({...body,input:{id:'unauthorized',data:{text:'denied'}}});assert.equal(result.status,403);
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:f.storePermissions});result=await h.post({...body,input:{id:'unauthorized',data:{text:'denied'}}});assert.equal(result.status,403);
    assert.equal((await f.invoke(api,get.reference,{...f.recordInput,id:'unauthorized'})).code,'STORE.NOT_FOUND');
  });
}
for(const provider of ['json','sqlite'])test(`BOB4B-05 ${provider}: canonical preparation uses named read bindings; direct provider calls and cleanup mutations deny`,async t=>{
  for(const mode of ['read','direct','write','substitution','method']){
    const f=await fixture(t,provider,{edit(m){m.resources.sources.prepare='prepare.bas';m.bindings.push({owner:'backoffice-members',event:'Page.PreRender',source:'prepare',kind:'handler'});
      m.permissions.capabilities.push('object.instances.edit');m.permissions.traversal=['children'];
      m.permissions.visible.push('backoffice-result');m.permissions.editable=['backoffice-result'];},async configure(f){
      f.operator=new ExecutionContext({...f.operator,visible:[...f.operator.visible,'backoffice-result'],editable:[...f.operator.editable,'backoffice-result']});
      const protoFile=path.join(f.candidate.packagePath,'prototypes.json'),prototypes=JSON.parse(await fs.readFile(protoFile));
      let output={id:'divdev/backoffice-output',publisher:'divdev',extends:'wydgit.core/block',properties:{},slots:{}};
      if(mode==='method'){
        const manifest=JSON.parse(await fs.readFile(path.join(f.candidate.packagePath,'manifest.json'))),definitions=compileDefinitions(JSON.parse(await fs.readFile('prototypes/objects.json')));
        output=compileClass('PUBLIC CLASS Output EXTENDS wydgit.core/block\nMETA Id = "divdev/backoffice-output"\nPUBLIC SUB ReadViaMethod()\nDIM result AS Object\nresult = SERVICES.Call("backoffice", "load", {"store":"records","collection":"records","id":"record"})\nCALL ME.Set("content", {"type":"markdown","value":result.value.data.text})\nEND SUB\nEND CLASS',{manifest,definitions,verifiedPackages:{[manifest.id]:manifest.publisher}}).definition;
      }
      prototypes.push(output);await fs.writeFile(protoFile,JSON.stringify(prototypes));
      const nodeFile=path.join(f.candidate.packagePath,'section.json'),node=JSON.parse(await fs.readFile(nodeFile));
      node.slots.blocks=[{schema:'wydgit/0.2',id:'backoffice-result',prototype:'divdev/backoffice-output',properties:{content:{type:'markdown',value:''}},slots:{},provenance:{}}];await fs.writeFile(nodeFile,JSON.stringify(node));
      const source=mode==='direct'?'SERVICES.Call("wydstore", "get", {"store":"records","collection":"records","id":"record"})':`SERVICES.Call("backoffice", "${mode==='write'?'save':'load'}", {"store":"records","collection":"records","id":"record"})`;
      await fs.writeFile(path.join(f.candidate.packagePath,'prepare.bas'),mode==='method'?'EVENT Page.PreRender\nFOR EACH child IN ME.related("children", "blocks")\nCALL child.ReadViaMethod()\nNEXT child\nEND EVENT':`EVENT Page.PreRender\nDIM result AS Object\nresult = ${source}\nFOR EACH child IN ME.related("children", "blocks")\nIF result.ok THEN\nCALL child.Set("content", {"type":"markdown","value":result.value.data.text})\nELSE\nCALL child.Set("content", {"type":"markdown","value":"unavailable"})\nEND IF\nNEXT child\nEND EVENT`);
    }});
    const read=binding(f,'get','load','prepare');if(mode==='substitution')read.consumer='backoffice-result';
    await publishPage(f,[read,binding(f,'create','save','intent')]);
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[...f.storePermissions,'content.pages.view']});
    const api=f.framework(),create=(await f.discover(api)).find(a=>a.name==='create');assert.equal((await api.invoke({...f.request,reference:create.reference,input:{...f.recordInput,data:{text:'reviewed-read-result'}},confirmed:true})).ok,true);
    const h=await http(t,f),response=await h.get(),html=await response.text();
    if(mode==='read'){assert.equal(response.status,200,html);assert.match(html,/reviewed-read-result/);}
    else {assert.notEqual(response.status,200,html);assert.doesNotMatch(html,/reviewed-read-result/);}
    await h.stop();
  }
});
for(const provider of ['json','sqlite'])test(`BOB4B-06 ${provider}: admitted real process prevents cross-process review/replacement; stop and SIGKILL release only process leases`,async t=>{
  const f=await fixture(t,provider);await publishPage(f);await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.pages.view']});
  const running=await processApp(t,f);assert.ok(running.message.port,JSON.stringify(running.message));
  const response=await fetch(running.base+'/backoffice/pages/administration',{headers:{Cookie:'wydgit-auth='+f.login.token}});assert.equal(response.status,200,await response.text());
  const plan=await f.plan(f.payload());await assert.rejects(f.review(plan),{code:'PACKAGE.RUNNING'});
  assert.throws(()=>reserveStoppedApp(f.root),{code:'PACKAGE.RUNNING'});
  const e=f.entry();await assert.rejects(executionPlacement({root:f.root,app:f.request.app,package:e.manifest.id,installation:e.receipt.id,revision:f.state().revision,action:'replace',context:'BackOffice',installationContext:f.operator}),{code:'PACKAGE.RUNNING'});
  await running.stop();const reserve=reserveStoppedApp(f.root);
  try{const refused=await processApp(t,f);assert.equal(refused.message.code,'PACKAGE.BUSY');await once(refused.child,'exit');}finally{reserve();}
  const crash=await processApp(t,f);crash.child.kill('SIGKILL');await once(crash.child,'exit');await f.adopt(f.payload());
  assert.equal(f.inspect().backoffice.status,'adopted');
});
for(const provider of ['json','sqlite'])test(`BOB4B-07 ${provider}: corrupt and foreign approval evidence never admits an installation`,async t=>{
  const f=await fixture(t,provider);await publishPage(f);
  const file=path.join(f.root,STATE),original=await fs.readFile(file,'utf8');
  for(const mutate of [s=>s.packages[0].backoffice.approval='forged',s=>s.packages[0].backoffice.binding.installation='foreign',s=>s.packages[0].backoffice.binding.generation='foreign',s=>s.packages[0].backoffice.actions[0].scope.wydstore.push({store:'foreign',collection:'records'}),s=>delete s.packages[0].backoffice]){
    const altered=JSON.parse(original);mutate(altered);await fs.writeFile(file,JSON.stringify(altered));
    try{assert.throws(()=>createApp({root:f.root,libraries:f.libraries}),/./);assert.equal(f.preflight().status,'blocked');}finally{await fs.writeFile(file,original);}
  }
  for(const context of [{...f.operator},new ExecutionContext({...f.operator,capabilities:[]}),new ExecutionContext({...f.operator,package:f.manifest.id})])assert.throws(()=>createBackOfficeActions({root:f.root,libraries:f.libraries,installationContext:context}));
});
test('BOB4B-08: installed Taskboard informational Page and runtime-created repeated children render through canonical HTTP',async t=>{
  const f=adoptionFixture(await installedTaskboardFixture(t,{async configure(f){
    const gateRoot=path.join(f.root,'gate');await fs.mkdir(gateRoot);f.config=configuration(gateRoot,'json',{registration:'open'});
    f.config.libraries[0].options.app='boilerplate';f.config.libraries[0].bindings[0].app='boilerplate';f.config.libraries[1].options.stores[0].app='boilerplate';
    await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify(f.config));
  }})),e=f.entry();
  await executionPlacement({root:f.root,app:f.app,package:f.manifest.id,installation:e.receipt.id,revision:f.state().revision,action:'relocate',context:'BackOffice',installationContext:f.operator,verifiedPackages:f.verifiedPackages});
  f.gate=createGate(f.libraries.bind(new ExecutionContext({context:'FrontEnd',publisher:'host',package:'host:gate',self:'home',app:f.app,capabilities:gateManifest.capabilities,scopes:{wydgate:[f.app],wydgateBootstrap:[f.app]}})));
  const password='Disposable-qualification-2026!',user=await f.gate.register({username:'taskboard-reader',password});
  await f.gate.manageMember({id:user.membership.id,role:'administrator'});await f.gate.assignUser({userId:user.account.id,roles:[],permissions:['content.pages.view']});
  f.login=await f.gate.login('taskboard-reader',password);f.request={app:f.app,session:f.login.token};
  await publishPage(f);const h=await http(t,f),response=await h.get(),html=await response.text();
  assert.equal(response.status,200,html);assert.match(html,/Verify lifecycle cleanup/);assert.doesNotMatch(html,/Write WBasic/);
  assert.deepEqual(JSON.parse(load(html)('meta[name="wydgit-backoffice-bindings"]').attr('content')),[]);
});
for(const provider of ['json','sqlite'])test(`BOB4B-09 ${provider}: in-flight Page permission revocation prevents private success publication`,async t=>{
  const f=await fixture(t,provider);await publishPage(f);await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.pages.view']});
  const real=f.libraries;let checked=0;
  f.libraries={...real,async authorizeSitePolicy(context,requirement){await real.authorizeSitePolicy(context,requirement);
    if(requirement.permission==='content.pages.view'&&++checked===1)await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[]});}};
  const h=await http(t,f),response=await h.get();assert.equal(response.status,403);assert.doesNotMatch(await response.text(),/Administration|backoffice-members/);assert.ok(checked>=1);
});
for(const provider of ['json','sqlite'])test(`BOB4B-10 ${provider}: revocation after action preflight but before service admission leaves no protected mutation`,async t=>{
  const f=await fixture(t,provider);await f.adopt(f.payload());const real=f.libraries;let entered,continueWork;
  const waiting=new Promise(resolve=>entered=resolve),barrier=new Promise(resolve=>continueWork=resolve);let armed=true;
  f.libraries={...real,bind(context,operation){const bound=real.bind(context,operation);return {...bound,async invoke(...args){if(armed&&args[0]==='wydstore'&&args[2]==='create'){armed=false;entered();await barrier;}return bound.invoke(...args);}};}};
  const api=f.framework(),actions=await f.discover(api),create=actions.find(a=>a.name==='create'),get=actions.find(a=>a.name==='get');
  const pending=api.invoke({...f.request,reference:create.reference,input:{...f.recordInput,data:{text:'denied'}},confirmed:true});
  await waiting;await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:f.storePermissions.filter(p=>p!=='content.records.write')});continueWork();assert.equal((await pending).ok,false);
  assert.equal((await f.invoke(api,get.reference,f.recordInput)).code,'STORE.NOT_FOUND');
});
for(const provider of ['json','sqlite'])test(`BOB4B-11 ${provider}: explicitly reviewed multi-resource transaction succeeds and every required policy remains live`,async t=>{
  const f=await fixture(t,provider,{edit(m){for(const a of m.backofficeActions.filter(a=>['get','transaction'].includes(a.id)))a.scopes.wydstore.push('archive');},configure(f){
    f.config.libraries.find(l=>l.id==='wydstore').options.stores.find(s=>s.id==='records').authorization.collections.archive.transaction={contexts:['BackOffice'],permission:'archive.records.write'};
  }});await f.adopt(f.payload());
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[...f.storePermissions,'archive.records.read','archive.records.write']});
  const api=f.framework(),actions=await f.discover(api),transaction=actions.find(a=>a.name==='transaction'),get=actions.find(a=>a.name==='get');
  const input={store:'records',collection:'records',operations:[{operation:'create',input:{id:'both',data:{text:'records'}}},{operation:'create',input:{id:'both',collection:'archive',data:{text:'archive'}}}]};
  const result=await api.invoke({...f.request,reference:transaction.reference,input,confirmed:true});assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.value.map(v=>v.version),[1,1]);
  for(const collection of ['records','archive'])assert.equal((await f.invoke(api,get.reference,{store:'records',collection,id:'both'})).value.data.text,collection);
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:f.storePermissions});assert.equal((await f.invoke(api,get.reference,{...f.recordInput,id:'both'})).ok,false,'all declared resources remain required');
});
for(const provider of ['json','sqlite'])test(`BOB4B-12 ${provider}: multiple Page entries and independently scoped actions cannot substitute bindings`,async t=>{
  const f=await fixture(t,provider),first=f.proposal(),second={...f.proposal(),key:'other',permission:'content.pages.other'};
  first.bindings=[binding(f,'get','records'),binding(f,'archive-get','archive')];second.bindings=[binding(f,'get','records')];
  const report=f.preflight({pageProposals:[first,second]}),payload=f.payload();payload.pages=[first,second].map((proposal,i)=>({proposal,contractHash:report.pages[i].contractHash}));await f.adopt(payload);
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[...f.storePermissions,'archive.action.read','archive.records.read','content.pages.view']});
  const api=f.framework(),create=(await f.discover(api)).find(a=>a.name==='create');await api.invoke({...f.request,reference:create.reference,input:{...f.recordInput,data:{text:'records'}},confirmed:true});
  const h=await http(t,f);let response=await h.get(),descriptors=JSON.parse(load(await response.text())('meta[name="wydgit-backoffice-bindings"]').attr('content'));assert.equal(descriptors.length,2);
  assert.equal((await h.get('/backoffice/pages/other')).status,403);
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[...f.storePermissions,'archive.action.read','archive.records.read','content.pages.view','content.pages.other']});
  response=await h.get('/backoffice/pages/other');const other=JSON.parse(load(await response.text())('meta[name="wydgit-backoffice-bindings"]').attr('content'))[0];
  assert.deepEqual(other.reference,descriptors.find(b=>b.name==='records').reference);
  response=await h.post({pageBinding:other,input:f.recordInput});assert.equal(response.status,200);
  response=await h.post({pageBinding:{...other,name:'archive',reference:descriptors.find(b=>b.name==='archive').reference},input:{store:'records',collection:'archive',id:'record'}});assert.equal(response.status,409);
  response=await h.post({pageBinding:descriptors.find(b=>b.name==='records'),input:{store:'records',collection:'archive',id:'record'}});assert.equal(response.status,403);
});
for(const provider of ['json','sqlite'])test(`BOB4B-13 ${provider}: an in-flight protected action drains before retirement and its old generation never resumes`,async t=>{
  const f=await fixture(t,provider);await f.adopt(f.payload());const real=f.libraries;let entered,continueWork;
  const waiting=new Promise(resolve=>entered=resolve),barrier=new Promise(resolve=>continueWork=resolve);let armed=true;
  f.libraries={...real,bind(context,operation){const bound=real.bind(context,operation);return {...bound,async invoke(...args){if(armed&&args[0]==='wydstore'&&args[2]==='create'){armed=false;entered();await barrier;}return bound.invoke(...args);}};}};
  const api=f.framework(),create=(await f.discover(api)).find(a=>a.name==='create');
  const pending=api.invoke({...f.request,reference:create.reference,input:{...f.recordInput,data:{text:'drained'}},confirmed:true});await waiting;
  await assert.rejects(f.place('retire'),{code:'PACKAGE.RUNNING'});continueWork();assert.equal((await pending).ok,true);
  await f.place('retire');assert.equal((await api.invoke({...f.request,reference:create.reference,input:{...f.recordInput,data:{text:'forbidden'}},confirmed:true})).ok,false);
  await f.place('replace');assert.throws(()=>f.framework(),{code:'BACKOFFICE.MIGRATION_REQUIRED'});await f.adopt(f.payload());
  const fresh=f.framework(),get=(await f.discover(fresh)).find(a=>a.name==='get');assert.equal((await f.invoke(fresh,get.reference,f.recordInput)).value.data.text,'drained');
});
test('BOB4B-14: corrupt, symlink and abandoned admission locks fail closed without deleting evidence',async t=>{
  const f=await fixture(t,'json');await f.adopt(f.payload());const file=path.join(f.root,'.wydgine-admission-mutex');
  for(const data of ['{}','{"schema":"wydgine.local-admission/1","pid":2147483647}']){
    await fs.writeFile(file,data);try{assert.throws(()=>createApp({root:f.root,libraries:f.libraries}));assert.equal(await fs.readFile(file,'utf8'),data);}finally{await fs.unlink(file);}
  }
  await fs.symlink(path.join(f.root,STATE),file);try{assert.throws(()=>createApp({root:f.root,libraries:f.libraries}));assert.equal((await fs.lstat(file)).isSymbolicLink(),true);}finally{await fs.unlink(file);}
  const h=await http(t,f);assert.equal((await h.get('/backoffice')).status,200);
});
