import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Window} from 'happy-dom';
import {mountBackOffice,matchesValue} from '../wydclient/backoffice.js';
const string={type:'string',maxLength:128};
const action=(patch={})=>({id:'demo/module#roster/list',title:'Member roster',description:'Current site members',category:'members',effect:'read',input:{type:'object',fields:{limit:{type:'integer',min:1,max:50}},optional:['limit']},output:{type:'object',fields:{members:{type:'array',maxItems:50,items:{type:'object',fields:{name:string,active:{type:'boolean'}}}},total:{type:'integer',min:0,max:256}}},reference:{app:'site',generation:'one'},...patch});
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const discovery=actions=>({ok:true,csrf:'a'.repeat(64),value:{schema:'wydgit.backoffice-discovery/1',offset:0,limit:10,total:actions.length,actions}});
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
function setup(t,fetch){
 const w=new Window({url:'https://site.test/backoffice'});t.after(()=>w.happyDOM.close());
 w.document.body.innerHTML='<select id="bo-theme"><option>system</option><option>light</option><option>dark</option></select><button id="bo-refresh">Refresh</button><nav id="bo-navigation"></nav><p id="bo-status"></p><section id="bo-action"></section>';
 return {w,d:w.document,client:mountBackOffice({document:w.document,fetch})};
}
const submit=d=>d.querySelector('form').dispatchEvent(new d.defaultView.Event('submit',{cancelable:true}));
test('BOUI-01: dynamic category navigation, optional input, genuine table shape and read-only presentation',async t=>{
 const a=action(),calls=[],{d,client}=setup(t,async(url,options)=>{calls.push({url,options});return response(url.includes('invoke')?{ok:true,value:{members:[{name:'Alice',active:true}],total:1}}:discovery([a]));});
 await client.ready;assert.equal(d.querySelector('nav h3').textContent,'members');d.querySelector('nav button').click();
 assert.match(d.getElementById('bo-action').textContent,/Read only/);assert.equal(d.querySelector('.bo-confirm'),null);
 d.querySelector('[aria-label="Include limit"]').click();d.querySelector('[aria-label="limit"]').value='5';submit(d);await settle();
 assert.equal(d.querySelector('tbody tr td').textContent,'Alice');assert.equal(d.querySelectorAll('th[scope="col"]').length,2);
 const sent=JSON.parse(calls[1].options.body);assert.deepEqual(sent.input,{limit:5});assert.equal(sent.confirmed,undefined);assert.deepEqual(sent.reference,a.reference);
 for(const {options}of calls){assert.equal(options.credentials,'same-origin');assert.equal(options.mode,'same-origin');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');}
 assert.equal(calls[1].options.headers['X-Wydgit-CSRF'],'a'.repeat(64));
});
test('BOUI-02: untrusted action metadata and results stay text, including reflected errors',async t=>{
 const attack='<img src=x onerror=alert(1)><script>bad()</script>',a=action({title:attack,description:attack,category:attack});
 const {d,client}=setup(t,async url=>response(url.includes('invoke')?{ok:true,value:{members:[{name:attack,active:false}],total:1}}:discovery([a])));await client.ready;
 assert.equal(d.querySelector('nav button').textContent,attack);d.querySelector('nav button').click();assert.ok(d.getElementById('bo-action').textContent.includes(attack));
 submit(d);await settle();assert.equal(d.querySelector('td').textContent,attack);assert.equal(d.querySelectorAll('img,script').length,0);
});
test('BOUI-03: explicit per-attempt write confirmation, submission fencing and no uncertain-outcome retry',async t=>{
 let invocations=0,release;const pause=new Promise(r=>release=r),a=action({effect:'write',confirmation:'Confirm this change'});
 const {d,client}=setup(t,async url=>{if(url.includes('invoke')){invocations++;await pause;throw Error('<script>secret</script>');}return response(discovery([a]));});await client.ready;d.querySelector('nav button').click();
 submit(d);await settle();assert.equal(invocations,0);assert.match(d.getElementById('bo-action').textContent,/Confirm this change/);
 d.querySelector('[aria-label="Confirm action"]').click();submit(d);submit(d);await settle();assert.equal(invocations,1);assert.equal(d.getElementById('bo-refresh').disabled,true);assert.equal(d.querySelector('[aria-label="Confirm action"]').checked,false);
 release();await settle();assert.match(d.getElementById('bo-status').textContent,/may have taken effect/);assert.doesNotMatch(d.body.textContent,/secret/);assert.equal(invocations,1);
 submit(d);await settle();assert.equal(invocations,1);
});
test('BOUI-04: stale references clear selection and require explicit rediscovery; no replay',async t=>{
 let count=0,list=[action()];const {d,client}=setup(t,async url=>{if(url.includes('invoke')){count++;return response({ok:false,code:'ACTION.STALE',message:'<script>bad</script>'},409);}return response(discovery(list));});
 await client.ready;d.querySelector('nav button').click();submit(d);await settle();assert.equal(count,1);assert.equal(d.querySelector('form'),null);assert.match(d.getElementById('bo-status').textContent,/Refresh actions and select it again/);
 list=[];await client.refresh();assert.equal(d.querySelectorAll('nav button').length,0);assert.match(d.getElementById('bo-status').textContent,/No actions/);assert.equal(count,1);
});
test('BOUI-05: nested objects, required/optional fields, booleans, bounded arrays/null and invalid input',async t=>{
 const input={type:'object',fields:{title:string,nested:{type:'object',fields:{count:{type:'integer',min:1,max:3},enabled:{type:'boolean'}}},values:{type:'array',maxItems:2,items:string},empty:{type:'null'}}};
 const a=action({input,output:{type:'null'}});let sent;
 const {d,client}=setup(t,async(url,options)=>{if(url.includes('invoke')){sent=JSON.parse(options.body);return response({ok:true,value:null});}return response(discovery([a]));});await client.ready;d.querySelector('nav button').click();
 submit(d);await settle();assert.equal(sent,undefined);
 d.querySelector('[aria-label="title"]').value='Title';d.querySelector('[aria-label="count"]').value='2';d.querySelector('[aria-label="enabled"]').click();d.querySelector('[aria-label="Add item to values"]').click();d.querySelector('[aria-label="values item 1"]').value='a';d.querySelector('[aria-label="Add item to values"]').click();d.querySelector('[aria-label="values item 2"]').value='b';submit(d);await settle();
 assert.deepEqual(sent.input,{title:'Title',nested:{count:2,enabled:true},values:['a','b'],empty:null});assert.match(d.getElementById('bo-status').textContent,/completed/);
 assert.equal(matchesValue(JSON.parse('{"__proto__":{}}'),{type:'object',fields:{}}),false);assert.equal(matchesValue({extra:true},{type:'object',fields:{}}),false);assert.equal(matchesValue([1,2,3],{type:'array',maxItems:2,items:{type:'integer',min:0,max:3}}),false);
});
test('BOUI-06: discovery authorization/error states and bounded response rendering',async t=>{
 for(const status of [401,403,500]){const {d,client}=setup(t,async()=>response({ok:false,code:'ACTION.DENIED',message:'<script>private stack</script>'},status));await client.ready;assert.equal(d.querySelector('nav button'),null);assert.doesNotMatch(d.body.textContent,/private stack/);assert.match(d.getElementById('bo-status').textContent,status===401?/session has ended/:status===403?/Access denied/:/could not be loaded/);}
 const {d,client}=setup(t,async()=>new Response('x'.repeat(66561)));await client.ready;assert.match(d.getElementById('bo-status').textContent,/could not be loaded/);
});
test('BOUI-07: light/dark/system controls and responsive stylesheet use established conventions',async t=>{
 const {d,client}=setup(t,async()=>response(discovery([])));await client.ready;
 for(const value of ['light','dark','system']){const select=d.getElementById('bo-theme');select.value=value;select.dispatchEvent(new d.defaultView.Event('change'));assert.equal(d.documentElement.getAttribute('data-wyd-theme'),value);}
 const css=await fs.readFile('packages/wydgine/runtime/backoffice/shell.css','utf8');assert.match(css,/prefers-color-scheme:dark/);assert.match(css,/data-wyd-theme="dark"/);assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
 assert.equal(await fs.readFile('wydclient/backoffice.js','utf8'),await fs.readFile('packages/wydgine/runtime/wydclient/backoffice.js','utf8'));
});

test('BOUI-08: paginated discovery handles more than ten modules and clears inactive privilege displays',async t=>{
 const all=Array.from({length:12},(_,i)=>action({id:'module-'+i,title:'Action '+i,category:i%2?'second':'first'}));let pages=0;
 const {d,client}=setup(t,async url=>{pages++;const offset=Number(new URL(url,'https://site.test').searchParams.get('offset'));return response({ok:true,csrf:'a'.repeat(64),value:{schema:'wydgit.backoffice-discovery/1',offset,limit:10,total:12,actions:all.slice(offset,offset+10)}});});await client.ready;
 assert.equal(pages,2);assert.equal(d.querySelectorAll('nav button').length,12);assert.equal(d.querySelectorAll('nav h3').length,2);
 d.querySelector('nav button').click();Object.defineProperty(d,'hidden',{value:true,configurable:true});d.dispatchEvent(new d.defaultView.Event('visibilitychange'));assert.equal(d.querySelector('form'),null);assert.equal(d.querySelector('nav button'),null);assert.match(d.getElementById('bo-status').textContent,/inactive/);
});

test('BOUI-09: action/result focus, loading state and accessible stale-error recovery',async t=>{
 let stale=false;const {d,client}=setup(t,async url=>response(url.includes('invoke')?(stale?{ok:false,code:'ACTION.STALE'}:{ok:true,value:{members:[],total:0}}):discovery([action()]),url.includes('invoke')&&stale?409:200));
 await client.ready;d.querySelector('nav button').click();assert.equal(d.activeElement,d.querySelector('#bo-action h1'));
 submit(d);assert.equal(d.getElementById('bo-action').getAttribute('aria-busy'),'true');await settle();assert.equal(d.activeElement,d.querySelector('#bo-action h2'));assert.equal(d.getElementById('bo-action').getAttribute('aria-busy'),'false');
 d.getElementById('bo-refresh').focus();await client.refresh();assert.equal(d.activeElement,d.getElementById('bo-refresh'));d.querySelector('nav button').click();
 stale=true;submit(d);await settle();assert.equal(d.getElementById('bo-status').getAttribute('role'),'alert');assert.equal(d.getElementById('bo-status').getAttribute('aria-live'),'assertive');assert.equal(d.activeElement,d.getElementById('bo-refresh'));
});

async function formFixture(t,input,{effect='read',output={type:'null'},value=null}={}){
 let sent=[],fail;const a=action({input,output,effect,...(effect==='write'?{confirmation:'Confirm change'}:{})});
 const setupValue=setup(t,async(url,options)=>{if(!url.includes('invoke'))return response(discovery([a]));sent.push(JSON.parse(options.body));return fail?response({ok:false,code:fail,message:'private <script>details</script>',details:{private:true}},503):response({ok:true,value});});
 await setupValue.client.ready;setupValue.d.querySelector('nav button').click();return {...setupValue,sent,fail:code=>fail=code};
}
const object=fields=>({type:'object',fields});
const integer={type:'integer',min:-2,max:2};

test('BOUI-10: bounded array add/remove, stable values, item counts and focus restoration',async t=>{
 const {d,sent}=await formFixture(t,object({tags:{type:'array',items:{type:'string',maxLength:3},maxItems:2}}));
 const add=d.querySelector('[aria-label="Add item to tags"]');add.click();assert.equal(d.activeElement.getAttribute('aria-label'),'tags item 1');d.activeElement.value='one';
 add.click();d.activeElement.value='two';assert.equal(add.disabled,true);add.click();assert.equal(d.querySelectorAll('[aria-label^="Remove tags"]').length,2);assert.match(d.querySelector('.bo-array-count').textContent,/2 of 2/);
 d.querySelector('[aria-label="Remove tags item 1"]').click();assert.equal(add.disabled,false);assert.equal(d.querySelector('[aria-label="tags item 1"]').value,'two');assert.equal(d.activeElement.getAttribute('aria-label'),'Remove tags item 1');
 submit(d);await settle();assert.deepEqual(sent[0].input,{tags:['two']});
 d.querySelector('[aria-label="Remove tags item 1"]').click();assert.equal(d.activeElement,add);submit(d);await settle();assert.deepEqual(sent[1].input,{tags:[]});
});

test('BOUI-11: nested object/array editing, booleans and null use the same recursive controls',async t=>{
 const input=object({rows:{type:'array',maxItems:2,items:object({count:integer,enabled:{type:'boolean'},nothing:{type:'null'},tags:{type:'array',maxItems:1,items:{type:'string',maxLength:3}}})}});
 const {d,sent}=await formFixture(t,input);d.querySelector('[aria-label="Add item to rows"]').click();d.querySelector('[aria-label="count"]').value='-2';d.querySelector('[aria-label="enabled"]').click();d.querySelector('[aria-label="Add item to tags"]').click();d.querySelector('[aria-label="tags item 1"]').value='x';
 submit(d);await settle();assert.deepEqual(sent[0].input,{rows:[{count:-2,enabled:true,nothing:null,tags:['x']}]});assert.equal(d.querySelector('textarea'),null);
});

test('BOUI-12: optional inclusion is explicit and integer/string errors are described and focused',async t=>{
 const input={...object({count:integer,text:{type:'string',maxLength:3},optional:{type:'null'}}),optional:['optional']}, {d,sent}=await formFixture(t,input);
 const count=d.querySelector('[aria-label="count"]'),text=d.querySelector('[aria-label="text"]');
 for(const invalid of ['','1.5','-3','3']){count.value=invalid;submit(d);await settle();assert.equal(sent.length,0);assert.equal(d.activeElement,count);assert.equal(count.getAttribute('aria-invalid'),'true');const error=d.getElementById(count.getAttribute('aria-describedby').split(' ')[1]);assert.match(error.textContent,/whole number from -2 to 2/);assert.equal(d.getElementById('bo-status').getAttribute('role'),'alert');assert.equal(d.getElementById('bo-status').getAttribute('aria-live'),'assertive');}
 count.value='2';text.value='four';submit(d);await settle();assert.equal(sent.length,0);assert.equal(d.activeElement,text);assert.equal(text.getAttribute('aria-invalid'),'true');
 text.value='abc';d.querySelector('[aria-label="Include optional"]').click();submit(d);await settle();assert.deepEqual(sent[0].input,{count:2,text:'abc',optional:null});
 d.querySelector('[aria-label="Include optional"]').click();text.value='';count.value='-2';submit(d);await settle();assert.deepEqual(sent[1].input,{count:-2,text:''});
});

test('BOUI-13: edits including array changes consume write confirmation; failed attempts never replay',async t=>{
 const {d,sent,fail}=await formFixture(t,object({tags:{type:'array',items:integer,maxItems:1}}),{effect:'write'}),confirm=d.querySelector('[aria-label="Confirm action"]');
 confirm.click();d.querySelector('[aria-label="Add item to tags"]').click();assert.equal(confirm.checked,false);const input=d.querySelector('[aria-label="tags item 1"]');input.value='1';confirm.click();input.dispatchEvent(new d.defaultView.Event('input',{bubbles:true}));assert.equal(confirm.checked,false);
 confirm.click();fail('SEWN.LIMIT');submit(d);await settle();assert.equal(sent.length,1);assert.equal(confirm.checked,false);assert.match(d.getElementById('bo-status').textContent,/Inspect current state/);submit(d);await settle();assert.equal(sent.length,1);assert.doesNotMatch(d.body.textContent,/private|<script>/);
});

test('BOUI-14: large bounded results, long text disclosures, pagination, empty values and safe rendering',async t=>{
 const attack='<img src=x onerror=alert(1)>',row=object({title:{type:'string',maxLength:4096},nested:object({value:{type:'null'}})}),output=object({items:{type:'array',maxItems:256,items:row},offset:{type:'integer',min:0,max:256},limit:{type:'integer',min:1,max:256},total:{type:'integer',min:0,max:256}});
 const value={items:Array.from({length:128},(_,i)=>({title:i===0?attack.repeat(20):'',nested:{value:null}})),offset:0,limit:128,total:128};
 const {d}=await formFixture(t,object({}),{output,value});submit(d);await settle();assert.equal(d.querySelectorAll('tbody tr').length,128);assert.equal(d.querySelectorAll('th[scope=col]').length,2);assert.equal(d.querySelectorAll('img,script').length,0);assert.match(d.querySelector('summary').textContent,/Long text/);assert.equal(d.querySelector('details .bo-value').textContent,attack.repeat(20));assert.match(d.body.textContent,/Offset 0 · limit 128 · total 128/);assert.match(d.body.textContent,/Empty text/);assert.match(d.body.textContent,/No value \(null\)/);
 const empty=await formFixture(t,object({}),{output:{type:'array',items:row,maxItems:1},value:[]});submit(empty.d);await settle();assert.match(empty.d.body.textContent,/No results/);
});

test('BOUI-15: structured read errors are local text and unknown details stay private',async t=>{
 const {d,fail}=await formFixture(t,object({}));fail('SEWN.LIMIT');submit(d);await settle();assert.match(d.getElementById('bo-status').textContent,/execution budget/);assert.equal(d.activeElement,d.querySelector('button[type=submit]'));assert.doesNotMatch(d.body.textContent,/private|<script>/);
});
