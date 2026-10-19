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
 d.querySelector('[aria-label="title"]').value='Title';d.querySelector('[aria-label="count"]').value='2';d.querySelector('[aria-label="enabled"]').click();d.querySelector('textarea').value='["a","b"]';submit(d);await settle();
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
