import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createRuntime} from '../src/runtime.js';
const manifest=JSON.parse(await readFile(new URL('../examples/taskboard-manifest.json',import.meta.url)));
const golden=JSON.parse(await readFile(new URL('../../../test/fixtures/taskboard/golden.json',import.meta.url)));
const approval={publisher:'divdev',package:'divdev/wbasic-taskboard',installation:'reviewed-taskboard',actions:['SelectPage'],capabilities:['object.instances.edit','object.instances.construct','event.custom.raise'],traversal:['children'],visible:['taskboard','taskboard-*'],editable:['taskboard','taskboard-*'],scopes:{prototypes:['divdev/task-card'],events:['pagechanged']}};
const policy={verifiedPrototypes:Object.fromEntries(manifest.prototypes.map(d=>[d.id,d.publisher])),execution:approval};
function setup(t,change=()=>{},config=policy){
 const w=new Window({url:'https://example.test/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});
 const m=structuredClone(manifest);change(m);const script=w.document.createElement('script');script.id='wydgit-manifest';script.type='application/json';script.textContent=JSON.stringify(m);w.document.head.append(script);
 const runtime=createRuntime({document:w.document,location:w.location},config);return {runtime,w};
}
test('browser canonical fixture independently matches WBasic family; typed navigation executes hooks, events and presentation',async t=>{
 assert.deepEqual(manifest.prototypes,golden);
 const {runtime:r,w}=setup(t);const ready=await r.ready();assert.equal(ready.ok,true,JSON.stringify(ready));
 const e=r.execution(),root=e.entry();assert.match(w.document.body.textContent,/Write WBasic/);
 const list=e.children(root,'blocks')[1],cards=e.children(list,'blocks');assert.equal(cards.length,2);assert.ok(cards.every(c=>e.snapshot(c).properties.InitCount===1));
 await e.invoke(root,'SelectPage',[2]);assert.equal(e.snapshot(root).properties.CurrentPage,2);assert.match(w.document.body.textContent,/Verify lifecycle cleanup/);assert.doesNotMatch(w.document.body.textContent,/Write WBasic/);
 assert.throws(()=>e.snapshot(cards[0]));await e.unload();assert.throws(()=>e.snapshot(root));await e.activate();assert.equal(e.snapshot(e.children(list,'blocks')[0]).properties.InitCount,1);
});
test('browser execution rejects fake references, unapproved actions and wrong typed parameters',async t=>{
 const {runtime:r}=setup(t);assert.equal((await r.ready()).ok,true);const e=r.execution(),root=e.entry();
 for(const fake of [{},{id:'taskboard'},'taskboard'])await assert.rejects(e.invoke(fake,'SelectPage',[2]));
 await assert.rejects(e.invoke(root,'OnPageChanged',[2]));await assert.rejects(e.invoke(root,'Dispose'));await assert.rejects(e.invoke(root,'SelectPage',['2']));assert.throws(()=>r.host());
});
test('publisher verification does not authorize execution, mutation, construction or events',async t=>{
 for(const config of [{verifiedPrototypes:policy.verifiedPrototypes}, {...policy,execution:{...approval,capabilities:[]}}, {...policy,verifiedPrototypes:{}}]){
  const {runtime:r}=setup(t,()=>{},config);assert.equal((await r.ready()).ok,false);assert.throws(()=>r.execution());
 }
 const {runtime:r}=setup(t,()=>{},{...policy,execution:{...approval,capabilities:approval.capabilities.filter(c=>c!=='event.custom.raise')}});assert.equal((await r.ready()).ok,true);await assert.rejects(r.execution().invoke(r.execution().entry(),'SelectPage',[2]));
});
test('unsupported service/context/presentation and malformed component metadata fail before activation',async t=>{
 const changes=[m=>m.prototypes[0].presentation.template.attrs={onclick:'evil'},m=>m.prototypes[0].component={schema:'wydgit.component/0.20',children:[],subscriptions:[],repeaters:null},m=>m.prototypes.find(d=>d.id==='divdev/taskboard').behavior.procedures.selectpage.body.push({op:'service',library:'test',method:'read',input:{op:'literal',value:{}},into:'x'})];
 for(const change of changes){const {runtime:r,w}=setup(t,change);assert.equal((await r.ready()).ok,false);assert.equal(w.document.querySelectorAll('[data-wydclient-object]').length,0);}
});
function addMethod(m,name,body,params=[]){const d=m.prototypes.find(d=>d.id==='divdev/task-list');d.behavior.schema='sewn/0.5';d.behavior.procedures[name]={kind:'sub',params,body};d.methodRules[name]={access:'public'};d.methodContracts[name]={kind:'sub',params:params.map(p=>p.type),access:'public',abstract:false,virtual:false};}
const me={op:'context',name:'ME'};
const records=[{Key:'beta',Title:'Test canonical artifacts',Status:'Pending'},{Key:'alpha',Title:'Write WBasic',Status:'Complete'}];
const assign=rows=>({op:'memberSet',target:me,name:'Tasks',exact:true,value:{op:'literal',value:rows}});
test('keyed reorder retains live object identity and initialization; returning removed key has a fresh lifetime',async t=>{
 const {runtime:r}=setup(t,m=>{addMethod(m,'reorder',[assign(records)]);addMethod(m,'empty',[assign([])]);},{...policy,execution:{...approval,actions:['reorder','empty']}});
 assert.equal((await r.ready()).ok,true);const e=r.execution(),root=e.entry(),list=e.children(root,'blocks')[1],old=e.children(list,'blocks'),ids=old.map(c=>e.snapshot(c).id);
 await e.invoke(list,'reorder');assert.deepEqual(e.children(list,'blocks').map(c=>e.snapshot(c).id),ids.toReversed());assert.ok(old.every(c=>e.snapshot(c).properties.InitCount===1));
 await e.invoke(list,'empty');for(const c of old)assert.throws(()=>e.snapshot(c));await e.invoke(list,'reorder');assert.ok(e.children(list,'blocks').every(c=>!ids.includes(e.snapshot(c).id)));
});
test('duplicate/invalid record keys and typed values reject candidate composition without replacing live children',async t=>{
 for(const rows of [[records[0],records[0]],[{...records[0],Key:'../x'}],[{...records[0],Title:4}],[{...records[0],Status:'Injected'}]]){
  const {runtime:r}=setup(t,m=>addMethod(m,'invalid',[assign(rows)]),{...policy,execution:{...approval,actions:['invalid']}});assert.equal((await r.ready()).ok,true);
  const e=r.execution(),list=e.children(e.entry(),'blocks')[1],old=e.children(list,'blocks').map(c=>e.snapshot(c).id);await assert.rejects(e.invoke(list,'invalid'));assert.deepEqual(e.children(list,'blocks').map(c=>e.snapshot(c).id),old);
 }
});
test('unmount and remount invalidate all old receivers while an identical-ID sibling keeps executing',async t=>{
 const w=new Window({url:'https://example.test/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});
 const r=createRuntime({document:w.document,location:w.location});const roots=[0,1].map(()=>{const root=w.document.createElement('section');root.setAttribute('data-wydgit-root','');const s=w.document.createElement('script');s.type='application/json';s.setAttribute('data-wydgit-manifest','');s.textContent=JSON.stringify(manifest);root.append(s);w.document.body.append(root);return root;});
 const a=r.mount({root:roots[0],policy}),b=r.mount({root:roots[1],policy});assert.ok((await Promise.all([a.ready(),b.ready()])).every(r=>r.ok));
 const ea=a.execution(),eb=b.execution(),ra=ea.entry(),rb=eb.entry();await assert.rejects(eb.invoke(ra,'SelectPage',[2]));
 const pending=ea.invoke(ra,'SelectPage',[2]);a.unmount();await assert.rejects(pending);assert.throws(()=>ea.snapshot(ra));await eb.invoke(rb,'SelectPage',[2]);assert.equal(eb.snapshot(rb).properties.CurrentPage,2);
 const c=r.mount({root:roots[0],policy});assert.equal((await c.ready()).ok,true);await assert.rejects(c.execution().invoke(ra,'SelectPage',[2]));c.unmount();b.unmount();b.unmount();
});
test('hostile program schemas, pollution and forged declaration owners fail closed',async t=>{
 for(const change of [m=>m.prototypes[0].behavior.body=[{op:'eval',code:'alert(1)'}],m=>m.prototypes[0].component=JSON.parse('{"schema":"wydgit.component/0.20","children":[],"subscriptions":[],"__proto__":{}}'),m=>m.prototypes.find(d=>d.id==='divdev/taskboard').component.subscriptions[0].owner='wydgit.core/page']){
  const {runtime:r}=setup(t,change);assert.equal((await r.ready()).ok,false);assert.throws(()=>r.execution());
 }
});
test('private/protected handler and hook access cannot be enabled by host action strings',async t=>{
 const {runtime:r}=setup(t,()=>{},{...policy,execution:{...approval,actions:['onpagechanged','Init','Dispose']}});assert.equal((await r.ready()).ok,true);const e=r.execution(),root=e.entry();
 for(const name of ['onpagechanged','Init','Dispose'])await assert.rejects(e.invoke(root,name,name==='onpagechanged'?[2]:[]));
});
test('injection remains literal text and unsupported styling rejects presentation',async t=>{
 const {runtime:r,w}=setup(t,m=>addMethod(m,'inject',[assign([{...records[0],Title:'<img src=x onerror=alert(1)>'}])]),{...policy,execution:{...approval,actions:['inject']}});assert.equal((await r.ready()).ok,true);const e=r.execution();await e.invoke(e.children(e.entry(),'blocks')[1],'inject');assert.equal(w.document.querySelectorAll('img').length,0);assert.match(w.document.body.textContent,/<img src=x/);
 const denied=setup(t,m=>m.prototypes[0].presentation.template={tag:'script',text:'evil'});assert.equal((await denied.runtime.ready()).ok,false);
});
test('typed event storms terminate under the shared chain ledger and do not refresh handler budgets',async t=>{
 const {runtime:r}=setup(t,m=>{
  const d=m.prototypes.find(d=>d.id==='divdev/task-navigation');
  d.component.subscriptions.push({source:'Me',event:'PageChanged',handler:'gotopage'});
 },{...policy,execution:{...approval,limits:{sewnSteps:350}}});
 const ready=await r.ready();assert.equal(ready.ok,true,JSON.stringify(ready));const e=r.execution();await assert.rejects(e.invoke(e.entry(),'SelectPage',[2]),error=>['SEWN.LIMIT','EVENT.LIMIT'].includes(error.code));
});
test('restricted inherited content cannot leak through literal presentation',async t=>{
 const {runtime:r,w}=setup(t,m=>{const d=m.prototypes.find(d=>d.id==='divdev/task-model');d.properties.content={type:'object',access:'private',default:{type:'markdown',value:'private-marker'}};});assert.equal((await r.ready()).ok,false);assert.doesNotMatch(w.document.body.textContent,/private-marker/);
});
test('Init, Preload and Render failures prevent activation; teardown remains safe and repeatable',async t=>{
 for(const hook of ['Init','Preload','Render']){
  const {runtime:r,w}=setup(t,m=>{const d=m.prototypes[0];d.lifecycle[hook].procedures[hook.toLowerCase()].body.push({op:'memberSet',target:me,name:'InitCount',exact:true,value:{op:'literal',value:'wrong type'}});});
  assert.equal((await r.ready()).ok,false,hook);assert.throws(()=>r.execution());assert.equal(w.document.querySelectorAll('[data-wydclient-object]').length,0);
 }
});
test('throwing Unload/Dispose hooks cannot keep subscribers or references live after root teardown',async t=>{
 const w=new Window({url:'https://example.test/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});
 const root=w.document.createElement('section');root.setAttribute('data-wydgit-root','');const script=w.document.createElement('script');script.type='application/json';script.setAttribute('data-wydgit-manifest','');
 const m=structuredClone(manifest);for(const hook of ['Unload','Dispose'])m.prototypes[0].lifecycle[hook].procedures[hook.toLowerCase()].body.push({op:'memberSet',target:me,name:'InitCount',exact:true,value:{op:'literal',value:'wrong'}});
 script.textContent=JSON.stringify(m);root.append(script);w.document.body.append(root);const runtime=createRuntime({document:w.document,location:w.location}),h=runtime.mount({root,policy});assert.equal((await h.ready()).ok,true);const e=h.execution(),ref=e.entry();h.unmount();h.unmount();await assert.rejects(e.invoke(ref,'SelectPage',[2]));assert.equal(root.querySelectorAll('[data-wydclient-object]').length,0);
});
test('Unload cancels an in-flight method before allowing reactivation',async t=>{
 const {runtime:r}=setup(t);assert.equal((await r.ready()).ok,true);const e=r.execution(),root=e.entry(),running=e.invoke(root,'SelectPage',[2]);const unloading=e.unload();await assert.rejects(running);await unloading;assert.throws(()=>e.snapshot(root));await e.activate();assert.equal(e.snapshot(root).properties.CurrentPage,1);
});
test('signed executable package provenance still requires independent exact package-version execution approval',async t=>{
 const {webcrypto}=await import('node:crypto'),{signedPayload}=await import('../src/packages.js');
 const key=await webcrypto.subtle.generateKey('Ed25519',true,['sign','verify']),b64=v=>Buffer.from(v).toString('base64');
 const pkg={schema:'wydgit.prototype-package/0.1',id:'divdev/wbasic-taskboard',publisher:'divdev',version:'0.1.0',prototypes:manifest.prototypes},bytes=Buffer.from(JSON.stringify(pkg));
 const ref={id:pkg.id,publisher:'divdev',version:pkg.version,url:'/package.json',algorithm:'Ed25519',keyId:'reviewed',integrity:'sha256-'+b64(await webcrypto.subtle.digest('SHA-256',bytes))};ref.signature=b64(await webcrypto.subtle.sign('Ed25519',key.privateKey,signedPayload(ref)));
 const trustedKeys=[{publisher:'divdev',keyId:'reviewed',publicKey:b64(await webcrypto.subtle.exportKey('raw',key.publicKey)),status:'active'}];
 for(const execution of [undefined,approval,{...approval,packageVersion:'0.1.0'}]){
  const w=new Window({url:'https://example.test/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});
  const script=w.document.createElement('script');script.id='wydgit-manifest';script.type='application/json';script.textContent=JSON.stringify({schema:'wydgit.registry/0.1',prototypes:[],packages:[ref],entry:manifest.entry});w.document.head.append(script);
  const r=createRuntime({document:w.document,location:w.location,crypto:webcrypto,fetch:async()=>{const response=new Response(bytes,{headers:{'Content-Type':'application/json'}});Object.defineProperty(response,'url',{value:'https://example.test/package.json'});return response;}},{trustedKeys,...(execution?{execution}:{})});
  const ready=await r.ready();assert.equal(ready.ok,Boolean(execution?.packageVersion),JSON.stringify(ready));
  if(ready.ok){const e=r.execution();await e.invoke(e.entry(),'SelectPage',[2]);assert.equal(e.snapshot(e.entry()).properties.CurrentPage,2);}else assert.throws(()=>r.execution());
 }
});
test('a failed Page.Unload subscriber cannot keep an executable lifetime active',async t=>{
 const {runtime:r}=setup(t,m=>{const d=m.prototypes.find(d=>d.id==='divdev/taskboard');d.component.subscriptions.push({source:'Page',event:'Unload',handler:'onpageload'});d.behavior.procedures.onpageload.body=[{op:'memberSet',target:me,name:'LoadCount',exact:true,value:{op:'literal',value:'bad'}}];d.component.subscriptions=d.component.subscriptions.filter(b=>b.event!=='Load');});
 assert.equal((await r.ready()).ok,true);const e=r.execution(),ref=e.entry();await e.unload();assert.throws(()=>e.snapshot(ref));await e.activate();assert.equal(e.snapshot(ref).properties.LoadCount,0);
});
test('executable bootstrap stays staged and unmount during activation cannot publish a ready controller',async t=>{
 const w=new Window({url:'https://example.test/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});
 const root=w.document.createElement('section');root.setAttribute('data-wydgit-root','');const s=w.document.createElement('script');s.type='application/json';s.setAttribute('data-wydgit-manifest','');s.textContent=JSON.stringify(manifest);root.append(s);w.document.body.append(root);
 const runtime=createRuntime({document:w.document,location:w.location}),h=runtime.mount({root,policy});assert.equal(h.state,'initializing');assert.throws(()=>h.execution());h.unmount();assert.equal((await h.ready()).state,'disposed');await new Promise(resolve=>setTimeout(resolve,0));assert.equal(root.querySelectorAll('[data-wydclient-object]').length,0);assert.throws(()=>h.execution());
});
