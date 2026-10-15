import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createRuntime} from '../src/runtime.js';
import {controlRecord,validateControls} from '../../../wydgine/controls.js';
const registry=JSON.parse(await readFile(new URL('../examples/interactive/registry.json',import.meta.url)));
const approval={publisher:'divdev',package:'divdev/taskboard-client',installation:'reviewed-client',actions:['nextpage','submittask','cleartasks'],capabilities:['object.instances.edit','object.instances.construct','event.custom.raise'],traversal:['children'],visible:['taskboard','taskboard-*'],editable:['taskboard','taskboard-*'],scopes:{prototypes:['divdev/task-card'],events:['pagechanged']}};
export const policy={verifiedPrototypes:Object.fromEntries(registry.prototypes.map(d=>[d.id,d.publisher])),execution:approval};
const settle=()=>new Promise(r=>setTimeout(r,20));
function field(w,name){return w.document.querySelector(`[name="${name}"]`);}
async function setup(t,mutate=()=>{},config=policy){const w=new Window({url:'https://site.example/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});const m=structuredClone(registry);mutate(m);const s=w.document.createElement('script');s.type='application/json';s.id='wydgit-manifest';s.textContent=JSON.stringify(m);w.document.head.append(s);const r=createRuntime({document:w.document,location:w.location},config);const ready=await r.ready();return {w,r,ready};}
function edit(w,name,value){const el=field(w,name);if(typeof value==='boolean')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event(typeof value==='boolean'?'change':'input',{bubbles:true}));}
function submit(w){const form=w.document.querySelector('form');const event=new w.Event('submit',{bubbles:true,cancelable:true});form.dispatchEvent(event);assert.equal(event.defaultPrevented,true);}
test('CLIENT-built native form controls invoke actual SEWN navigation and submission without host application callbacks',async t=>{
 const {w,r,ready}=await setup(t);assert.equal(ready.ok,true,JSON.stringify(ready));const e=r.execution(),root=e.entry();assert.equal(w.document.querySelectorAll('form').length,1);assert.equal(w.document.querySelectorAll('textarea').length,1);assert.equal(field(w,'Complete').type,'checkbox');assert.ok(field(w,'Title').parentElement.tagName==='LABEL');
 w.document.querySelector('[data-wydclient-control="Next"]').click();await settle();assert.equal(e.snapshot(root).properties.CurrentPage,2);
 edit(w,'Title','Built from WBasic');edit(w,'Notes','Native controls');edit(w,'Complete',true);submit(w);await settle();assert.match(w.document.body.textContent,/Built from WBasic/);assert.match(w.document.body.textContent,/Native controls/);assert.equal(field(w,'Title').value,'');assert.equal(e.snapshot(e.children(root,'blocks')[1]).properties.Tasks.length,2);
});
test('invalid/extra/select/overlong/Unicode input fails before mutation and retains drafts; reset is explicit',async t=>{
 const {w,r,ready}=await setup(t);assert.equal(ready.ok,true);const e=r.execution(),root=e.entry(),before=e.snapshot(e.children(root,'blocks')[0]).properties.Added;
 for(const value of ['', 'x'.repeat(81),'\uD800']){edit(w,'Title',value);submit(w);await settle();assert.deepEqual(e.snapshot(e.children(root,'blocks')[0]).properties.Added,before);assert.equal(field(w,'Title').value,value);assert.match(w.document.querySelector('form [role="alert"]').textContent,/Check/);}
 edit(w,'Title','Valid');field(w,'State').value='Injected';submit(w);await settle();assert.deepEqual(e.snapshot(e.children(root,'blocks')[0]).properties.Added,before);
 const extra=w.document.createElement('input');extra.name='Evil';w.document.querySelector('form').append(extra);submit(w);await settle();assert.deepEqual(e.snapshot(e.children(root,'blocks')[0]).properties.Added,before);extra.remove();
 w.document.querySelector('form').dispatchEvent(new w.Event('reset',{cancelable:true}));assert.equal(field(w,'Title').value,'');
});
test('drafts survive state-driven rerender, old controls lose authority, and repeated submissions cannot run concurrently',async t=>{
 const {w,r}=await setup(t);const e=r.execution(),root=e.entry();edit(w,'Title','Unsaved');const old=w.document.querySelector('[data-wydclient-control="Next"]');old.click();await settle();assert.equal(field(w,'Title').value,'Unsaved');old.click();await settle();assert.equal(e.snapshot(root).properties.CurrentPage,2);
 submit(w);submit(w);await settle();assert.equal(e.snapshot(e.children(root,'blocks')[0]).properties.Added.length,1);assert.ok(!field(w,'Title').disabled);
 await e.unload();const button=w.document.querySelector('[data-wydclient-control="Next"]');assert.equal(button.disabled,true);button.dispatchEvent(new w.Event('click'));await e.activate();assert.equal(e.snapshot(root).properties.CurrentPage,2);
});
test('missing approval, private action and hostile metadata fail during registry staging',async t=>{
 const root=m=>m.prototypes.find(d=>d.id==='divdev/taskboard').presentation.template.children;
 for(const mutate of [m=>root(m).find(n=>n.control==='button').action.method='applypage',m=>root(m).find(n=>n.control==='form').children[1].name='Title',m=>root(m).find(n=>n.control==='form').action.method='constructor',m=>root(m).find(n=>n.control==='form').children[0].onclick='evil']){
  const {ready}=await setup(t,mutate);assert.equal(ready.ok,false);
 }
 const {ready}=await setup(t,()=>{},{...policy,execution:{...approval,actions:['nextpage']}});assert.equal(ready.ok,false);
});
test('canonical field conversion is narrow, atomic, bounded and independent of browser event objects',()=>{
 const form={control:'form',name:'Test',label:'Test',action:{method:'submit'},children:[{control:'text',name:'Count',label:'Count',type:'Integer',required:true,maxLength:40}]};
 validateControls({schema:'wydgit.presentation/0.2',target:'client',template:form});assert.deepEqual(JSON.parse(JSON.stringify(controlRecord(form,{Count:'42'}))),{Count:42});
 for(const value of ['1e999','9007199254740992','1.5',' 42','NaN',{},new Event('input')])assert.throws(()=>controlRecord(form,{Count:value}));assert.throws(()=>controlRecord(form,JSON.parse('{"Count":"1","__proto__":{}}')));
});
test('forged IDs, transplanted elements, raw Event payloads and detached controls confer no authority',async t=>{
 const {w,r}=await setup(t),e=r.execution(),root=e.entry(),original=w.document.querySelector('[data-wydclient-control="Next"]');
 const forged=original.cloneNode(true);forged.id='taskboard-Next';w.document.body.append(forged);forged.click();await settle();assert.equal(e.snapshot(root).properties.CurrentPage,1);
 original.dispatchEvent(new w.Event('click',{bubbles:true}));await settle();assert.equal(e.snapshot(root).properties.CurrentPage,2);
 const moved=w.document.querySelector('[data-wydclient-control="Next"]');w.document.querySelector('#wydgit-manifest').parentElement.append(moved);moved.click();await settle();assert.equal(e.snapshot(root).properties.CurrentPage,2);
});
test('Unload/reactivation does not duplicate handlers, and a keyed control loses authority when its owner is retired',async t=>{
 const mutate=m=>{const card=m.prototypes.find(d=>d.id==='divdev/task-card');card.properties.Clicks={type:'number',default:0,access:'public'};card.methodRules.mark={access:'public'};card.behavior.schema='sewn/0.5';card.behavior.procedures.mark={kind:'sub',params:[],body:[{op:'memberSet',target:{op:'context',name:'ME'},name:'Clicks',exact:true,value:{op:'binary',operator:'+',left:{op:'memberRead',target:{op:'context',name:'ME'},name:'Clicks',exact:true},right:{op:'literal',value:1}}}]};card.presentation={schema:'wydgit.presentation/0.2',target:'client',template:{tag:'section',children:[{control:'button',name:'Mark',label:'Mark',action:{method:'mark'}}]}};};
 const {w,r,ready}=await setup(t,mutate,{...policy,execution:{...approval,actions:[...approval.actions,'mark']}});assert.equal(ready.ok,true,JSON.stringify(ready));const e=r.execution(),root=e.entry(),list=e.children(root,'blocks')[1],card=e.children(list,'blocks')[0];
 for(let i=0;i<3;i++){await e.unload();await e.activate();}const old=w.document.querySelector('[data-wydclient-control="Mark"]');old.click();await settle();assert.equal(e.snapshot(card).properties.Clicks,1);
 w.document.querySelector('[data-wydclient-control="Next"]').click();await settle();assert.throws(()=>e.snapshot(card));old.click();await settle();assert.equal(e.snapshot(e.entry()).properties.CurrentPage,2);
});
test('native submissions canceled by root unmount cannot mutate a replacement or a sibling; nested events do not bubble into another form',async t=>{
 const w=new Window({url:'https://site.example/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});const manager=createRuntime({document:w.document,location:w.location});
 const mount=parent=>{const root=w.document.createElement('section');root.setAttribute('data-wydgit-root','');const s=w.document.createElement('script');s.type='application/json';s.setAttribute('data-wydgit-manifest','');s.textContent=JSON.stringify(registry);root.append(s);parent.append(root);return {root,handle:manager.mount({root,policy})};};
 const a=mount(w.document.body);await a.handle.ready();const b=mount(w.document.body);assert.equal((await b.handle.ready()).ok,true);a.root.querySelector('form').append(b.root);const ea=a.handle.execution(),eb=b.handle.execution();
 const input=b.root.querySelector('[name=Title]');input.value='Inner task';input.dispatchEvent(new w.Event('input',{bubbles:true}));b.root.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(eb.snapshot(eb.children(eb.entry(),'blocks')[0]).properties.Added.length,1);assert.equal(ea.snapshot(ea.children(ea.entry(),'blocks')[0]).properties.Added.length,0);
 const form=b.root.querySelector('form');b.root.querySelector('[name=Title]').value='Canceled';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));b.handle.unmount();await settle();assert.throws(()=>eb.entry());assert.equal(ea.snapshot(ea.children(ea.entry(),'blocks')[0]).properties.Added.length,0);a.handle.unmount();
});
test('an action exhausting an event-chain budget releases busy state without creating a fresh nested budget',async t=>{
 const {w,r,ready}=await setup(t,m=>{m.prototypes.find(d=>d.id==='divdev/task-navigation').component.subscriptions.push({source:'Me',event:'PageChanged',handler:'gotopage'});},{...policy,execution:{...approval,limits:{sewnSteps:350}}});assert.equal(ready.ok,true,JSON.stringify(ready));
 w.document.querySelector('[data-wydclient-control="Next"]').click();await settle();assert.ok(!field(w,'Title').disabled);assert.equal(r.state,'ready');
});
test('removing a native form during submission cancels later work through the same terminal ledger',async t=>{
 const {w,r,ready}=await setup(t);assert.equal(ready.ok,true);const e=r.execution(),root=e.entry(),model=e.children(root,'blocks')[0];edit(w,'Title','Removed form');const old=w.document.querySelector('form');old.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));old.remove();await settle();assert.equal(e.snapshot(model).properties.Added.length,0);await e.render();assert.equal(field(w,'Title').value,'Removed form');assert.ok(!field(w,'Title').disabled);
});
