import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import platform from '../package.json' with {type:'json'};
import { loadLibraries } from '../wydgine/libraries/index.js';
import { createStores } from '@wydgit/store/client';
import { manifest } from '@wydgit/store';
import {project, caps, context, reject, definition, config, load, temp, fixture} from '../test-support/wydstore.js';

for (const provider of ['json','sqlite']) {
test(`${provider}: record lifecycle preserves immutable identity, original/current values, dirty state and no-op save`,async t=>{
 const {collection,store}=await fixture(t,provider);const draft=collection.create('first',{name:'First',info:{a:1}});
 assert.equal(draft.state,'new');assert.equal(draft.original,null);assert.equal(draft.version,0);assert.equal(draft.dirty,true);
 assert.throws(()=>{draft.id='second';},TypeError);assert.throws(()=>{draft.current.info.a=2;},TypeError);
 await draft.save();assert.equal(draft.version,1);assert.equal(draft.state,'unchanged');assert.equal(draft.get('active'),true);
 const before=await collection.history('first');await draft.save();assert.deepEqual(await collection.history('first'),before);
 draft.set('name','Next');assert.equal(draft.original.name,'First');assert.equal(draft.current.name,'Next');assert.equal(draft.dirty,true);
 await draft.save();assert.equal(draft.version,2);assert.equal(draft.dirty,false);assert.equal(draft.original.name,'Next');
 const reopened=createStores((await load(store)).bind(context())).get('main').collection('users');assert.equal((await reopened.get('first')).get('name'),'Next');
 await reject(()=>collection.create('first',{name:'dup'}).save(),'STORE.DUPLICATE_ID');await reject(()=>collection.get('missing'),'STORE.NOT_FOUND');
 assert.throws(()=>draft.set('id','new'),e=>e.code==='STORE.INVALID_FIELD');
});

test(`${provider}: schema enforces types, required and unknown fields and applies defaults`,async t=>{
 const {collection}=await fixture(t,provider);
 for(const data of [{},{name:3},{name:'x',unknown:true},{name:'x',score:'1'},{name:'x',active:0},{name:'x',info:[]},{name:'x',tags:{}},{name:'x',nothing:false}])await reject(()=>collection.create('bad',data).save(),'STORE.INVALID_FIELD');
 const item=collection.create('valid',{name:'x',score:2,info:{a:true},tags:[1,'a'],nothing:null});await item.save();item.reset('name');await reject(()=>item.save(),'STORE.INVALID_FIELD');assert.equal((await collection.get('valid')).get('name'),'x');
 item.set('name','x');item.set('active',false);await item.save();item.reset('active');await item.save();assert.equal(item.get('active'),true);
});

test(`${provider}: optimistic concurrency serializes competing handles and preserves history including deletion`,async t=>{
 const {collection,store}=await fixture(t,provider);await collection.create('item',{name:'start'}).save();
 const other=createStores((await load(store)).bind(context())).get('main').collection('users');
 const a=await collection.get('item'),b=await other.get('item');a.set('name','a');b.set('name','b');
 const results=await Promise.allSettled([a.save(),b.save()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'STORE.CONFLICT');
 const current=await collection.get('item');assert.equal(current.version,2);const stale=a.version===1?a:b;await reject(()=>stale.delete(),'STORE.CONFLICT');
 await current.delete();assert.equal(current.state,'deleted');assert.equal(current.version,3);await reject(()=>current.save(),'STORE.DELETED');await reject(()=>collection.get('item'),'STORE.NOT_FOUND');
 await reject(()=>collection.create('item',{name:'reuse'}).save(),'STORE.DUPLICATE_ID');
 const history=await collection.history('item');assert.deepEqual(history.map(v=>v.version),[1,2,3]);assert.equal(history[0].data.name,'start');assert.equal(history[2].deleted,true);assert.equal(history[2].data,null);assert.ok(Object.isFrozen(history[0].data));
 assert.equal((await collection.query()).length,0);
});

test(`${provider}: query has portable equality filters, lexical ID ordering and limits`,async t=>{
 const {collection}=await fixture(t,provider);for(const id of ['z','a','m'])await collection.create(id,{name:id==='m'?'other':'same',info:{b:2,a:1}}).save();
 assert.deepEqual((await collection.query()).map(r=>r.id),['a','m','z']);assert.deepEqual((await collection.query({where:{name:'same'},limit:1})).map(r=>r.id),['a']);
 assert.equal((await collection.query({where:{info:{a:1,b:2}}})).length,3);assert.equal((await collection.query({limit:0})).length,0);
 await reject(()=>collection.query({where:{unknown:1}}),'STORE.INVALID_FIELD');await reject(()=>collection.query({where:{name:3}}),'STORE.INVALID_FIELD');await reject(()=>collection.query({limit:-1}),'STORE.INVALID_RECORD');
});

test(`${provider}: each operation requires caller capability and exact store/collection/App/publisher/package scope`,async t=>{
 const {registry,collection}=await fixture(t,provider);await collection.create('item',{name:'x'}).save();
 const requests={get:{id:'item'},query:{},history:{id:'item'},create:{id:'new',data:{name:'x'}},update:{id:'item',version:1,data:{name:'y'}},delete:{id:'item',version:1}};
 for(const service of manifest.services){const ctx=context({capabilities:caps.filter(c=>c!==service.capability)});assert.equal((await registry.bind(ctx).call('wydstore',service.name,{store:'main',collection:'users',...requests[service.name]})).code,'SEAM.DENIED');}
 for(const extra of [{scopes:{}},{scopes:{wydstore:[{store:'other',collection:'users'}]}},{scopes:{wydstore:[{store:'main',collection:'other'}]}},{app:'appB'},{publisher:'otherco'},{package:'acme/other'}])assert.equal((await registry.bind(context(extra)).call('wydstore','get',{store:'main',collection:'users',id:'item'})).code,'STORE.DENIED');
 const scope=context({scopes:{wydstore:[{store:'absent',collection:'users'},{store:'main',collection:'absent'}]}});
 assert.equal((await registry.bind(scope).call('wydstore','query',{store:'absent',collection:'users'})).code,'STORE.UNKNOWN_STORE');
 assert.equal((await registry.bind(scope).call('wydstore','query',{store:'main',collection:'absent'})).code,'STORE.UNKNOWN_COLLECTION');
 const ctx=context();await registry.bind(ctx).call('wydstore','get',{store:'main',collection:'users',id:'item'});assert.deepEqual(ctx.capabilities,caps);assert.deepEqual(ctx.visible,['card']);assert.deepEqual(ctx.traversal,[]);
 assert.throws(()=>ctx.scopes.wydstore.push({store:'other',collection:'users'}),TypeError);
 assert.throws(()=>registry.bind({...ctx}),e=>e.code==='SEAM.CONTEXT');
 const injected=await registry.bind(ctx).call('wydstore','get',{store:'main',collection:'users',id:'item',context:{publisher:'otherco'}});assert.equal(injected.code,'STORE.INVALID_RECORD');
});

test(`${provider}: host ownership separates files even with identical logical store and record names`,async t=>{
 const {root,collection,store}=await fixture(t,provider);await collection.create('same',{name:'A'}).save();
 const registry=await load({...store,app:'appB'}),b=createStores(registry.bind(context({app:'appB'}))).get('main').collection('users');await b.create('same',{name:'B'}).save();assert.equal((await collection.get('same')).get('name'),'A');assert.equal((await b.get('same')).get('name'),'B');assert.equal((await fs.readdir(root)).length,2);
});

test(`${provider}: configuration rejects unsafe roots, schemas, duplicate identities and unexpected values`,async t=>{
 const root=await temp(t),valid=definition(root,provider);
 for(const change of [{root:'../outside'},{root:root+'/../escape'},{root:'/'},{provider:'postgres'},{id:'../escape'},{collections:[{id:'users',fields:{x:{type:'date'}}}]},{collections:[{id:'users',fields:{id:{type:'string'}}}]},{extra:true}])await reject(()=>load({...valid,...change}),'STORE.INVALID_CONFIG');
 const configuration=config(valid);configuration.libraries[0].options.stores.push(valid);await reject(()=>loadLibraries({config:configuration,root:project,platformVersion:platform.version}),'STORE.INVALID_CONFIG');
 const link=path.join(root,'link');await fs.symlink(root,link);await reject(()=>load({...valid,root:link}),'STORE.INVALID_CONFIG');
});

test(`${provider}: hostile record inputs and path-shaped IDs are rejected through facade and dispatch`,async t=>{
 const {registry,collection}=await fixture(t,provider),dispatch=registry.bind(context());
 for(const key of ['__proto__','constructor','prototype']){
  const data=JSON.parse(`{"name":"x","info":{"${key}":true}}`);assert.throws(()=>collection.create('item',data),e=>e.code==='STORE.INVALID_RECORD');
  assert.equal((await dispatch.call('wydstore','create',{store:'main',collection:'users',id:'item',data})).code,'SERVICE.INVALID_REQUEST');
 }
 for(const id of ['../x','/tmp/x','x.json','a/b','constructor'])assert.throws(()=>collection.create(id,{name:'x'}),e=>e.code==='STORE.INVALID_RECORD');
 for(const value of [NaN,Infinity,()=>{},undefined,new Date()])assert.throws(()=>collection.create('item',{name:'x',info:{value}}),e=>e.code==='STORE.INVALID_RECORD');
 const accessor={};Object.defineProperty(accessor,'name',{enumerable:true,get(){assert.fail('must not evaluate getters');}});assert.throws(()=>collection.create('item',accessor));
 const cyclic={};cyclic.x=cyclic;assert.throws(()=>collection.create('item',cyclic));assert.equal({}.polluted,undefined);
});
}

for (const provider of ['json','sqlite']) {
 test(`${provider}: service snapshots, no-op CAS, and reopened tombstone history obey the adapter contract`,async t=>{
  const {store,registry,collection}=await fixture(t,provider),dispatch=registry.bind(context());
  const request={store:'main',collection:'users',id:'item',data:{name:'old'}};
  const created=await dispatch.call('wydstore','create',request);
  assert.deepEqual(JSON.parse(JSON.stringify(created)),{ok:true,value:{id:'item',version:1,data:{active:true,name:'old'}}});
  assert.equal((await dispatch.call('wydstore','update',{...request,version:1})).value.version,1);
  assert.equal((await collection.history('item')).length,1);
  const item=await collection.get('item');item.set('name','new');await item.save();
  assert.equal((await dispatch.call('wydstore','update',{...request,data:{name:'new'},version:1})).code,'STORE.CONFLICT');
  await item.delete();
  const reopened=createStores((await load(store)).bind(context())).get('main').collection('users');
  assert.deepEqual(JSON.parse(JSON.stringify(await reopened.history('item'))),[
   {version:1,data:{active:true,name:'old'},deleted:false},
   {version:2,data:{active:true,name:'new'},deleted:false},
   {version:3,data:null,deleted:true}
  ]);
  await reject(()=>reopened.create('item',{name:'reused'}).save(),'STORE.DUPLICATE_ID');
  await reject(()=>reopened.history('missing'),'STORE.NOT_FOUND');
 });
}

test('JSON and SQLite queries produce identical equality results for all JSON field types',async t=>{
 const stores=await Promise.all(['json','sqlite'].map(provider=>fixture(t,provider)));
 const rows=[
  ['z',{name:'1',score:0,active:false,nothing:null,tags:[1,'1',false,null],info:{a:1,b:{x:true}}}],
  ['A',{name:'1',score:-0,active:false,nothing:null,tags:[1,'1',false,null],info:{b:{x:true},a:1}}],
  ['a',{name:'other',score:1,active:true,tags:['1',1],info:{a:'1',b:{x:true}}}],
  ['m',{name:"'; DROP TABLE records; --",score:1.5,info:{unicode:'☃',nested:[null]}}]
 ];
 for(const {collection} of stores)for(const [id,data] of rows)await collection.create(id,data).save();
 const queries=[{}, {where:{name:'1'}},{where:{score:0}},{where:{score:1.5}},{where:{active:false}},{where:{nothing:null}},
  {where:{tags:[1,'1',false,null]}},{where:{info:{b:{x:true},a:1}}},{where:{score:0,name:'1'},limit:1},
  {where:{name:"'; DROP TABLE records; --"}},{limit:0}];
 for(const query of queries){const results=await Promise.all(stores.map(async ({collection})=>(await collection.query(query)).map(r=>({id:r.id,version:r.version,data:JSON.parse(JSON.stringify(r.current))}))));assert.deepEqual(results[0],results[1]);}
 assert.deepEqual((await stores[1].collection.query({where:{nothing:null}})).map(r=>r.id),['A','z']);
 assert.deepEqual((await stores[1].collection.query({where:{info:{a:1,b:{x:true}}}})).map(r=>r.id),['A','z']);
});

for(const provider of ['json','sqlite'])test(`${provider}: concurrent create collisions and distinct package physical stores remain isolated`,async t=>{
 const {store,collection}=await fixture(t,provider);
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>collection.create('same',{name:'writer'+i}).save()));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);for(const r of results.filter(r=>r.status==='rejected'))assert.equal(r.reason.code,'STORE.DUPLICATE_ID');
 assert.equal((await collection.history('same')).length,1);
 const otherRoot=await temp(t),otherStore={...store,root:otherRoot,package:'acme/other'};
 const otherRegistry=await load(otherStore),other=createStores(otherRegistry.bind(context({package:'acme/other'}))).get('main').collection('users');
 await other.create('same',{name:'private B'}).save();assert.notEqual((await collection.get('same')).get('name'),'private B');
 assert.equal((await otherRegistry.bind(context()).call('wydstore','get',{store:'main',collection:'users',id:'same'})).code,'STORE.DENIED');
});
