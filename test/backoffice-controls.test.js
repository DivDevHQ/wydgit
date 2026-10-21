import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {mountBackOfficeControls} from '../wydclient/backoffice-controls.js';
import {backOfficePresentation} from '../wydclient/backoffice.js';
const data={type:'object',fields:{title:{type:'string',maxLength:80},body:{type:'string',maxLength:2048},columns:{type:'boolean'}}},version={type:'integer',min:1,max:100},record={type:'object',fields:{id:{type:'string',maxLength:64},data,version}};
const binding=name=>({schema:'wydgit.backoffice-page-binding/1',page:{key:'workspace'},name,reference:{action:name}});
const action=(operation,input)=>({operation,title:'Workspace',effect:operation==='update'?'write':'read',confirmation:'Confirm workspace change',input,output:record,fixedInput:{store:'workspace',collection:'workspace',id:'home'},binding:binding(operation)});
const actions=[action('get',{type:'object',fields:{}}),action('update',{type:'object',fields:{data,version}})];
const settle=()=>new Promise(r=>setTimeout(r,0));
function setup(t,request,list=actions){const w=new Window({url:'https://site.test/backoffice/pages/workspace'});t.after(()=>w.happyDOM.close());const d=w.document;d.head.innerHTML='<meta name="wydgit-backoffice-csrf" content="token">';const metadata=d.createElement('meta');metadata.name='wydgit-backoffice-controls';metadata.content=JSON.stringify({schema:'wydgit.backoffice-controls/1',consumers:[{id:'editor',actions:list}]});d.head.append(metadata);d.body.innerHTML='<main><section id="editor"></section></main>';mountBackOfficeControls({document:d,fetch:request});return d;}
const response=(value,status=200,outcome='completed')=>new Response(JSON.stringify(value),{status,headers:{'X-Wydgit-Action-Outcome':outcome}});
const submit=form=>form.dispatchEvent(new form.ownerDocument.defaultView.Event('submit',{cancelable:true}));
test('BOB6-03: production editor load, typed prefill, multiline content, confirmation, revision advancement and conflict recovery',async t=>{
 const calls=[];let revision=1,conflict=false;
 const d=setup(t,async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);if(conflict)return response({ok:false,code:'STORE.CONFLICT'},409,'uncertain');if(body.pageBinding.name==='update')revision++;return response({ok:true,value:{id:'home',version:revision,data:{title:'Workspace',columns:false,body:'<script>never executes</script>\nBody'}}});});
 const [load,save]=d.querySelectorAll('form');assert.equal(save.querySelector('fieldset').disabled,true);submit(save);await settle();assert.equal(calls.length,0);
 submit(load);await settle();assert.equal(save.querySelector('fieldset').disabled,false);assert.equal(save.querySelector('textarea').value,'<script>never executes</script>\nBody');assert.equal(d.querySelectorAll('script').length,0);assert.equal(save.querySelector('[aria-label="version"]').value,'1');
 submit(save);await settle();assert.equal(calls.length,1);assert.equal(d.activeElement,save.querySelector('[type=checkbox][aria-label^=Confirm]'));
 save.querySelector('[aria-label^=Confirm]').click();save.querySelector('textarea').dispatchEvent(new d.defaultView.Event('input',{bubbles:true}));assert.equal(save.querySelector('[aria-label^=Confirm]').checked,false);
 save.querySelector('[aria-label^=Confirm]').click();submit(save);submit(save);await settle();assert.equal(calls.length,2);assert.deepEqual(Object.keys(calls[1]).sort(),['confirmed','input','pageBinding']);assert.deepEqual(Object.keys(calls[1].input).sort(),['data','version']);assert.equal(save.querySelector('[aria-label="version"]').value,'2');assert.equal(save.querySelector('[aria-label^=Confirm]').checked,false);
 conflict=true;save.querySelector('[aria-label^=Confirm]').click();submit(save);await settle();assert.equal(calls.length,3);assert.match(d.querySelector('[role=alert]').textContent,/may have taken effect/);assert.equal(save.querySelector('fieldset').disabled,true);assert.equal(save.querySelector('[aria-label="version"]').value,'2');submit(save);await settle();assert.equal(calls.length,3);
 conflict=false;submit(load);await settle();assert.equal(save.querySelector('fieldset').disabled,false);
});
test('BOB6-04: stale/denied/expired controls disable and focus reload without replay or raw error text',async t=>{
 for(const status of [401,403,409]){let calls=0;const d=setup(t,async()=>{calls++;return response({ok:false,code:status===409?'ACTION.STALE':'ACTION.DENIED',message:'secret <script>bad</script>'},status,'rejected');});submit(d.querySelector('form'));await settle();assert.equal(d.querySelector('fieldset').disabled,true);assert.equal(d.activeElement.textContent,'Reload Page');assert.equal(d.querySelector('[role=alert]').getAttribute('aria-live'),'assertive');assert.doesNotMatch(d.body.textContent,/secret/);assert.equal(calls,1);}
});
test('BOB6-05: typed editor prefill handles recursive arrays/optional values and rejects incompatible state before edits',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.close());const d=w.document,{field}=backOfficePresentation({document:d,fetch:()=>{}});
 const c={type:'object',fields:{rows:{type:'array',maxItems:2,items:{type:'object',fields:{text:{type:'string',maxLength:8},active:{type:'boolean'}}}},note:{type:'null'}},optional:['note']};
 const f=field(c,'Properties');d.body.append(f.element);const value={rows:[{text:'one',active:true},{text:'two',active:false}],note:null};f.write(value);assert.deepEqual(f.read(),value);assert.throws(()=>f.write({...value,rows:[...value.rows,value.rows[0]]}));assert.deepEqual(f.read(),value);f.write({rows:[]});assert.deepEqual(f.read(),{rows:[]});
});
