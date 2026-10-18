import test from 'node:test';
import platform from '../package.json' with {type:'json'};
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {loadLibraries,validateManifest} from '../wydgine/libraries/index.js';
import {bindServices,failure} from '../wydgine/libraries/dispatch.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {execute} from '../wydgine/sewn/execute.js';
import {compile,compileModule,compilePrototype} from '../wydgine/wydbasic/index.js';
import {validate} from '../wydgine/sewn/validate.js';
import {manifest} from '../examples/canonical-diagnostic/index.js';
import {fixture,runPage} from '../test-support/events.js';
const ctx=(extra={})=>new ExecutionContext({context:'FrontEnd',publisher:'acme',package:'acme/example',principal:'acme/example',installation:'receipt-A',template:'panel',app:'site-A',self:'home',capabilities:['diagnostic.status.read'],...extra});
async function load(t, body, options={}) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-canonical-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const dir=path.join(root,'node_modules/@wydgit/diagnostic');await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(path.join(root,'package.json'),'{"type":"module"}');
 await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({name:'@wydgit/diagnostic',version:'1.0.0',type:'module',exports:{'.':'./index.js','./package.json':'./package.json'}}));
 const source=body ? `export const manifest=${JSON.stringify(manifest)};export function register({service,failure}){${body}}` : await fs.readFile(new URL('../examples/canonical-diagnostic/index.js',import.meta.url),'utf8');
 await fs.writeFile(path.join(dir,'index.js'),source);
 return loadLibraries({root,platformVersion:platform.version,config:{schema:'wydgit.host/0.1',libraries:[{id:manifest.id,package:'@wydgit/diagnostic',enabled:true,version:'1.0.0',publisher:'wydgit.core',trust:'canonical',options:{site:'site-A',principal:'acme/example',installation:'receipt-A',...options}}]}});
}
const invoke=(r,c=ctx(),input={})=>r.bind(c).invoke('wyddiagnostic','1.0.0','ping',input);
test('trusted registration, immutable discovery and explicit API resolution',async t=>{
 const r=await load(t);assert.equal(r.get('wyddiagnostic').apiVersion,'1.0.0');assert.equal(r.capabilities()[0].capability,'diagnostic.status.read');
 assert.equal(r.register,undefined);assert.equal(r.bind(ctx()).register,undefined);
 assert.equal((await invoke(r)).value.status,'ok');
 for(const [id,v,op,code] of [['missing','1.0.0','ping','SERVICE.UNAVAILABLE'],['wyddiagnostic','2.0.0','ping','SERVICE.VERSION_UNSUPPORTED'],['wyddiagnostic','1.0.0','missing','SERVICE.OPERATION_UNKNOWN'],['../fs','1.0.0','ping','SERVICE.INVALID_REQUEST'],['wyddiagnostic','^1','ping','SERVICE.INVALID_REQUEST']])assert.equal((await r.bind(ctx()).invoke(id,v,op,{})).code,code);
 assert.equal((await r.bind(ctx()).call('wyddiagnostic','ping',{})).code,'SERVICE.VERSION_REQUIRED');
 assert.throws(()=>r.bind({...ctx()}),e=>e.code==='SEAM.CONTEXT');
 assert.throws(()=>validateManifest({...manifest,apiVersion:'^1'}));
 for(const body of ["service('ping',()=>({}),{authorize:()=>true});", "service('ping',()=>({}),{validate:()=>true});", "service('other',()=>({}),{authorize:()=>true,validate:()=>true});"])await assert.rejects(()=>load(t,body),e=>e.code==='LIBRARY.REGISTRATION_FAILED');
});
test('site, principal, installation and capability isolation; identity arguments never confer authority',async t=>{
 const r=await load(t);
 for(const extra of [{app:'site-B'},{package:'other/pkg',principal:'other/pkg'},{installation:'receipt-B'},{capabilities:[]},{app:null}]) {
  const caller=ctx(extra);
  assert.equal((await invoke(r,caller)).code,'SEAM.DENIED');
  assert.equal((await invoke(r,caller,{site:'site-A',app:'site-A',package:'acme/example',principal:'acme/example',installation:'receipt-A',userId:'admin',sessionId:'admin',capabilities:['diagnostic.status.read']})).code,'SEAM.DENIED');
 }
 const identity={authenticated:true,app:'site-A',userId:'user-A',sessionId:'session-A',createdAt:1,expiresAt:2,roles:['admin'],groups:[],permissions:['all']};
 assert.equal((await invoke(r,ctx({identity,capabilities:[]}))).code,'SEAM.DENIED');
 assert.equal((await invoke(r,ctx(),{userId:'admin'})).code,'SERVICE.INVALID_REQUEST');
});
test('malformed data and result boundaries never execute accessors or expose internal failures',async t=>{
 const r=await load(t);let accessed=false;const accessor={get bad(){accessed=true;return 'secret';}};
 const cycle={};cycle.self=cycle;
 for(const input of [null,[],{extra:true},new Date(),cycle,accessor,{[Symbol('secret')]:1},Array(1),Array(4097).fill(null),JSON.parse('{"__proto__":{}}'),JSON.parse('{"nested":{"constructor":1}}'),{x:'x'.repeat(65537)}])assert.equal((await invoke(r,ctx(),input)).code,'SERVICE.INVALID_REQUEST');
 assert.equal(accessed,false);
 let deep={};for(let i=0;i<34;i++)deep={child:deep};assert.equal((await invoke(r,ctx(),deep)).code,'SERVICE.INVALID_REQUEST');
 for(const [handler,code] of [["throw Error('/private/credentials')",'SERVICE.FAILED'],["return Promise.reject(Error('/private/credentials'))",'SERVICE.FAILED'],["throw failure('DIAGNOSTIC.BUSY')",'DIAGNOSTIC.BUSY'],["return {secret:()=>{}}",'SERVICE.INVALID_RESULT'],["return {huge:'x'.repeat(65537)}",'SERVICE.INVALID_RESULT']]) {
  const registry=await load(t,`service('ping',async()=>{${handler}},{authorize:()=>true,validate:()=>true});`);
  const result=await invoke(registry);assert.equal(result.code,code);assert.doesNotMatch(JSON.stringify(result),/private|credentials|stack/);
 }
 assert.equal(failure('unsafe/path').code,'SERVICE.FAILED');
});
const workflow={schema:'sewn/0.4',procedures:{},body:[{op:'canonicalService',library:'wyddiagnostic',apiVersion:'1.0.0',method:'ping',input:{op:'literal',value:{}},into:'result'},{op:'return',value:{op:'variable',name:'result'}}]};
test('versioned SEWN execution uses the bound dispatcher and preserves limits and old closed schemas',async t=>{
 const r=await load(t),context=ctx();
 const run=c=>execute(workflow,{context:c,scope:{SERVICES:{Invoke:(...args)=>r.bind(c).invoke(...args)}}});
 assert.equal((await run(context)).value.value.status,'ok');assert.equal((await run(ctx({capabilities:[]}))).value.code,'SEAM.DENIED');
 await assert.rejects(()=>run(ctx({limits:{sewnServiceCalls:0}})),e=>e.code==='SEWN.LIMIT');
 for(const schema of ['sewn/0.1','sewn/0.2','sewn/0.3'])assert.throws(()=>validate({...workflow,schema}),e=>e.code==='SEWN.INVALID');
 const slow=bindServices(context,()=>({capability:'diagnostic.status.read',authorize:async()=>{throw Error('secret');},validate:()=>true,handler:()=>assert.fail('must not run')}),()=>manifest);
 assert.equal((await slow.invoke('wyddiagnostic','1.0.0','ping',{})).code,'SERVICE.FAILED');
 const limited=ctx({limits:{sewnTimeMs:5}});await assert.rejects(()=>execute(workflow,{context:limited,scope:{SERVICES:{Invoke:()=>new Promise(resolve=>setTimeout(()=>resolve({ok:true,value:null}),30))}}}),e=>e.code==='SEWN.LIMIT');
});
test('Page workflow uses trusted Page/session context, never operation-supplied identity',async t=>{
 const base=fixture({installation:'receipt-A',capabilities:['diagnostic.status.read']}),r=await load(t,null,{site:base.context.app});
 let observed,authorized=0;
 const libraries={bind(context){assert.equal(context,base.context);return {async invoke(...args){observed=await r.bind(context).invoke(...args);return observed;}};}};
 const result=await runPage({...base,session:{...base.session,authorize:async()=>{authorized++;}},libraries,handlers:[{owner:'home',type:'Page.Load',workflow}]});
 assert.equal(result.error,null);assert.equal(observed.value.status,'ok');assert.equal(authorized,1);
 const blocked=await runPage({...base,session:{...base.session,authorize:async()=>{throw failure('SEAM.DENIED');}},libraries,handlers:[{owner:'home',type:'Page.Load',workflow}]});assert.equal(blocked.error.code,'SEAM.DENIED');
});

test('WydBASIC compiles explicit Invoke calls and expressions without changing legacy output',async t=>{
 const r=await load(t),context=ctx();
 const source='DIM result AS Object = SERVICES.Invoke("wyddiagnostic", "1.0.0", "ping", {})\nRETURN result';
 const p=compile(source);assert.equal(p.schema,'sewn/0.4');
 assert.equal((await execute(p,{context,scope:{SERVICES:{Invoke:(...args)=>r.bind(context).invoke(...args)}}})).value.value.status,'ok');
 assert.equal(compile('DIM result AS Object = SERVICES.Call("wydstore", "get", {})').schema,'sewn/0.1');
 assert.throws(()=>compile(source.replace('"1.0.0"','"^1"')));
 const module=compileModule('EVENT Page.Load\nDIM result AS Object = SERVICES.Invoke("wyddiagnostic", "1.0.0", "ping", {})\nEND EVENT');assert.equal(module.events[0].workflow.schema,'sewn/0.4');
 const prototype=compilePrototype('FUNCTION Ping() AS Object\nRETURN SERVICES.Invoke("wyddiagnostic", "1.0.0", "ping", {})\nEND FUNCTION');assert.equal(prototype.schema,'sewn/0.4');
});

test('legacy operation declarations are closed, explicit and preserve default version enforcement',async t=>{
 for (const legacyOperations of [['missing'],['ping','ping'],'ping']) assert.throws(()=>validateManifest({...manifest,legacyOperations}),e=>e.code==='LIBRARY.INVALID_MANIFEST');
 const {apiVersion,...legacyManifest}=manifest;
 assert.throws(()=>validateManifest({...legacyManifest,legacyOperations:['ping']}),e=>e.code==='LIBRARY.INVALID_MANIFEST');
 const caller=ctx(),service={capability:'diagnostic.status.read',authorize:()=>true,validate:()=>true,handler:()=>({status:'ok'})};
 const allowed=bindServices(caller,()=>service,()=>({...manifest,legacyOperations:['ping']}));
 assert.equal((await allowed.call('wyddiagnostic','ping',{})).value.status,'ok');
 assert.equal((await allowed.call('wyddiagnostic','other',{})).code,'SERVICE.VERSION_REQUIRED');
 assert.equal((await bindServices(ctx({capabilities:[]}),()=>service,()=>({...manifest,legacyOperations:['ping']})).call('wyddiagnostic','ping',{})).code,'SEAM.DENIED');
});

test('versioned Page storage calls and transaction members use approved logical mappings',async()=>{
 const base=fixture({capabilities:['store.records.read','store.records.write']}),seen=[];
 const libraries={bind(context){assert.equal(context,base.context);return {async invoke(...args){seen.push(args);return {ok:true,value:0};}};}};
 const request={store:'users',collection:'users',operations:[{operation:'count',input:{}},{operation:'count',input:{store:'other',collection:'other'}}]};
 const workflow={schema:'sewn/0.4',procedures:{},body:[{op:'canonicalService',library:'wydstore',apiVersion:'1.0.0',method:'transaction',input:{op:'literal',value:request}}]};
 const serviceMappings={users:{store:'physical',collection:'first'},other:{store:'physical',collection:'second'}};
 const result=await runPage({...base,libraries,serviceMappings,handlers:[{owner:'home',type:'Page.Load',workflow}]});
 assert.equal(result.error,null);assert.equal(seen.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(seen[0][3])),{...request,store:'physical',collection:'first',operations:[{operation:'count',input:{store:'physical',collection:'first'}},{operation:'count',input:{store:'physical',collection:'second'}}]});
 const hostile={...request,operations:[{operation:'count',input:{store:'physical',collection:'second'}}]};
 const denied=await runPage({...base,libraries,serviceMappings,handlers:[{owner:'home',type:'Page.Load',workflow:{...workflow,body:[{...workflow.body[0],input:{op:'literal',value:hostile}}]}}]});
 assert.equal(denied.error.code,'PACKAGE.STORAGE');assert.equal(seen.length,1);
});
