import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createStores } from '@wydgit/store/client';
import { fixture, context, load, reject, file, temp } from '../test-support/wydstore.js';

for(const provider of ['json','sqlite']) {
 test(`${provider}: rejected schema/unique updates and batches preserve revisions and history`,async t=>{
  const base=await fixture(t,provider);
  const store={...base.store,root:await temp(t),collections:[{id:'users',fields:{name:{type:'string',required:true,unique:true}}}]};
  const registry=await load(store),dispatch=registry.bind(context());
  const users=createStores(dispatch).get('main').collection('users');
  await users.create('a',{name:'one'}).save();await users.create('b',{name:'two'}).save();
  const scope={store:'main',collection:'users'};
  const before=await users.history('a');
  for(const [data,code] of [[{},'STORE.INVALID_FIELD'],[{name:42},'STORE.INVALID_FIELD'],[{name:'two'},'STORE.UNIQUE']]) {
   assert.equal((await dispatch.invoke('wydstore','1.0.0','update',{...scope,id:'a',version:1,data})).code,code);
   await reject(()=>users.transaction([
    {operation:'update',input:{id:'b',version:1,data:{name:'three'}}},
    {operation:'update',input:{id:'a',version:1,data:code==='STORE.UNIQUE'?{name:'three'}:data}}
   ]),code);
   assert.deepEqual(await users.history('a'),before);
   assert.equal((await users.get('b')).version,1);assert.equal((await users.history('b')).length,1);
  }
  await users.transaction([
   {operation:'update',input:{id:'a',version:1,data:{name:'three'}}},
   {operation:'update',input:{id:'b',version:1,data:{name:'one'}}},
   {operation:'history',input:{id:'a'}}
  ]);
  assert.deepEqual((await users.history('a')).map(x=>x.data.name),['one','three']);
  const reopened=createStores((await load(store)).bind(context())).get('main').collection('users');
  assert.deepEqual(await reopened.history('a'),await users.history('a'));
  assert.equal((await reopened.get('b')).get('name'),'one');
 });
 test(`${provider}: filters, metadata and batch members cannot escape collection authority`,async t=>{
  const base=await fixture(t,provider),store={...base.store,root:await temp(t),collections:[...base.store.collections,{...base.store.collections[0],id:'private'}]};
  const registry=await load(store),dispatch=registry.bind(context());
  const scope={store:'main',collection:'users'};
  for(const extra of [{scopes:{}},{principal:'intruder'},{app:'other'},{package:'acme/other'}]) {
   const denied=registry.bind(context(extra));
   for(const operation of ['query','count','metadata','transaction']) {
    const input=operation==='transaction'?{...scope,operations:[{operation:'count',input:{}}]}:scope;
    assert.equal((await denied.invoke('wydstore','1.0.0',operation,input)).code,'STORE.DENIED');
   }
  }
  assert.equal((await dispatch.invoke('wydstore','1.0.0','metadata',{store:'main',collection:'private'})).code,'STORE.DENIED');
  assert.equal((await dispatch.invoke('wydstore','1.0.0','query',{...scope,filter:{field:'name',op:'eq',value:'x',collection:'private'}})).code,'STORE.INVALID_QUERY');
  assert.equal((await dispatch.invoke('wydstore','1.0.0','metadata',{...scope,principal:'owner'})).code,'STORE.INVALID_RECORD');
  for(const operation of ['query','count','get','history','create','update','delete']) {
   const result=await dispatch.invoke('wydstore','1.0.0','transaction',{...scope,operations:[
    {operation:'create',input:{id:'mustNotExist',data:{name:'x'}}},
    {operation,input:{collection:'private',id:'secret',data:{name:'x'},version:1}}
   ]});
   assert.equal(result.code,'STORE.DENIED');
  }
  assert.equal((await dispatch.invoke('wydstore','1.0.0','count',scope)).value,0);
 });
}

test('JSON respects an exclusive cooperating-process lock and resumes after release',async t=>{
 const {root,collection}=await fixture(t,'json');await collection.create('a',{name:'old'}).save();
 const lock=(await file(root)).replace(/\.json$/,'.lock');
 const child=fork(new URL('../test-support/json-lock-holder.js',import.meta.url),[],{stdio:['ignore','pipe','pipe','ipc']});
 t.after(()=>child.kill());
 const ready=once(child,'message');child.send({lock});assert.equal((await ready)[0].ready,true);
 await reject(()=>collection.get('a'),'STORE.BUSY');
 await reject(()=>collection.transaction([{operation:'update',input:{id:'a',version:1,data:{name:'blocked'}}}]),'STORE.BUSY');
 const exited=once(child,'exit');child.send({release:true});await exited;
 assert.equal((await collection.get('a')).get('name'),'old');
 const updated=await collection.get('a');updated.set('name','new');await updated.save();
 assert.deepEqual((await collection.history('a')).map(x=>x.version),[1,2]);
});
