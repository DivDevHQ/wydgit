import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {createCompletion} from '../wydgine/execution/completion.js';
import {context,fixture,load} from '../test-support/wydstore.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const request={store:'main',collection:'users',id:'stable-operation-record',data:{name:'public fixture'}};
const identity={store:request.store,collection:request.collection,id:request.id};
const check=expired=>()=>{if(expired())throw new Error('revoked');};
const invoke=(registry,completion,method='create',input=request)=>completion.run(op=>registry.bind(context(),op).call('wydstore',method,input));

for(const provider of ['json','sqlite']){
 test(`${provider}: completed commit, stable-ID duplicate retry and reopened reconciliation`,async t=>{
  const {registry,store}=await fixture(t,provider),completion=createCompletion(()=>{});
  assert.equal((await invoke(registry,completion)).ok,true);await completion.settle();
  assert.equal(completion.outcome(),'committed');assert.equal(completion.outcome(true),'indeterminate');
  const reopened=await load(store),dispatch=reopened.bind(context());
  assert.equal((await dispatch.call('wydstore','get',identity)).value.id,request.id);
  assert.equal((await dispatch.call('wydstore','create',request)).code,'STORE.DUPLICATE_ID');
  assert.equal((await dispatch.call('wydstore','history',identity)).value.length,1);
  await reopened.close();await registry.close();
 });
 test(`${provider}: held precommit I/O is cancelled, settles before teardown, and leaves no record`,async t=>{
  const {registry,root,store}=await fixture(t,provider);let expired=false;
  const completion=createCompletion(check(()=>expired)),entered=deferred(),release=deferred();t.after(()=>release.resolve());
  const method=provider==='json'?'open':'lstat',original=fs[method];let armed=true;
  const mock=t.mock.method(fs,method,async(...args)=>{const value=await original(...args);if(armed&&typeof args[0]==='string'&&args[0].startsWith(root+'/')&&args[0].endsWith(provider==='json'?'.json':'.sqlite')){armed=false;entered.resolve();await release.promise;}return value;});
  syncBuiltinESMExports();t.after(()=>{mock.mock.restore();syncBuiltinESMExports();});
  const pending=invoke(registry,completion);await entered.promise;expired=true;
  let settled=false;const stopping=completion.settle().then(()=>settled=true);
  await new Promise(r=>setImmediate(r));assert.equal(settled,false);
  release.resolve();assert.equal((await pending).ok,false);await stopping;
  assert.equal(completion.outcome(true),'not-committed');
  mock.mock.restore();syncBuiltinESMExports();
  const reopened=await load(store);assert.equal((await reopened.bind(context()).call('wydstore','get',identity)).code,'STORE.NOT_FOUND');
  await assert.rejects(()=>invoke(registry,completion));await reopened.close();await registry.close();
 });
}

test('JSON: rename already submitted at expiration settles as committed; never claim rollback',async t=>{
 const {registry,store}=await fixture(t,'json');let expired=false;
 const completion=createCompletion(check(()=>expired)),entered=deferred(),release=deferred();t.after(()=>release.resolve());
 const original=fs.rename;
 const mock=t.mock.method(fs,'rename',async(...args)=>{await original(...args);entered.resolve();await release.promise;});syncBuiltinESMExports();t.after(()=>{mock.mock.restore();syncBuiltinESMExports();});
 const pending=invoke(registry,completion);await entered.promise;expired=true;
 assert.equal(completion.outcome(true),'indeterminate');
 let settled=false;const stopping=completion.settle().then(()=>settled=true);await new Promise(r=>setImmediate(r));assert.equal(settled,false);
 release.resolve();assert.equal((await pending).ok,true);await stopping;assert.equal(completion.outcome(true),'indeterminate');
 mock.mock.restore();syncBuiltinESMExports();
 const reopened=await load(store);assert.equal((await reopened.bind(context()).call('wydstore','get',identity)).value.version,1);await reopened.close();await registry.close();
});

test('JSON: directory durability failure after rename is indeterminate and reconcilable',async t=>{
 const {registry,root,store}=await fixture(t,'json'),completion=createCompletion(()=>{}),original=fs.open;
 const mock=t.mock.method(fs,'open',async(file,...args)=>{if(file===root){const error=new Error('private path must not escape');error.code='EIO';throw error;}return original(file,...args);});syncBuiltinESMExports();t.after(()=>{mock.mock.restore();syncBuiltinESMExports();});
 const result=await invoke(registry,completion);assert.equal(result.ok,false);assert.equal(result.code,'STORE.IO');assert.ok(!JSON.stringify(result).includes('private path'));await completion.settle();assert.equal(completion.outcome(true),'indeterminate');
 mock.mock.restore();syncBuiltinESMExports();
 const reopened=await load(store);assert.equal((await reopened.bind(context()).call('wydstore','get',identity)).value.version,1);await reopened.close();await registry.close();
});

test('SQLite: revocation inside the transaction rolls back inserted data before COMMIT',async t=>{
 const {registry,store}=await fixture(t,'sqlite');let expired=false,begins=0,inTransaction=false;
 const completion=createCompletion(check(()=>expired));
 const result=await completion.run(operation=>registry.bind(context(),Object.freeze({
  ...operation,
  begin(){operation.begin();if(++begins===2)inTransaction=true;},
  check(){if(inTransaction)expired=true;operation.check();}
 })).call('wydstore','create',request));
 assert.equal(begins,2);assert.equal(result.ok,false);await completion.settle();assert.equal(completion.outcome(true),'not-committed');
 const reopened=await load(store);assert.equal((await reopened.bind(context()).call('wydstore','get',identity)).code,'STORE.NOT_FOUND');await reopened.close();await registry.close();
});
