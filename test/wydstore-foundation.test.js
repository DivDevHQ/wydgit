import test from 'node:test';
import assert from 'node:assert/strict';
import { createStores } from '@wydgit/store/client';
import { fixture, context, load, reject } from '../test-support/wydstore.js';

for (const provider of ['json','sqlite']) {
 test(`${provider}: portable comparison, Boolean filters, sorting, pagination and counting`,async t => {
  const {collection,registry}=await fixture(t,provider);
  for (const [id,score] of [['z',2],['a',2],['m',1]]) await collection.create(id,{name:id,score}).save();
  await collection.create('missing',{name:'missing'}).save();
  const filter={or:[{field:'score',op:'gte',value:2},{and:[{field:'name',op:'eq',value:'m'},{field:'score',op:'lt',value:2}]}]};
  assert.equal(await collection.count({filter}),3);
  assert.deepEqual((await collection.query({filter,sort:[{field:'score',direction:'desc'}],offset:1,limit:2})).map(x=>x.id),['z','m']);
  assert.deepEqual((await collection.query({sort:[{field:'score',direction:'asc'}]})).map(x=>x.id),['missing','m','a','z']);
  for (const options of [{filter:{or:[]}},{filter:{field:'score',op:'sql',value:1}},{sort:[{field:'info',direction:'asc'}]},{offset:-1}]) await assert.rejects(()=>collection.query(options));
  const dispatch=registry.bind(context());
  assert.equal((await dispatch.invoke('wydstore','1.0.0','count',{store:'main',collection:'users',filter})).value,3);
  assert.equal((await dispatch.invoke('wydstore','2.0.0','count',{})).code,'SERVICE.VERSION_UNSUPPORTED');
  assert.equal((await dispatch.invoke('wydstore','1.0.0','create',{store:'main',collection:'users',id:'large',data:{name:'x'.repeat(65537)}})).ok,true);
 });
 test(`${provider}: atomic batch commit, failure rollback, concurrency and restart`,async t => {
  const {collection,store}=await fixture(t,provider);
  const insert=id=>({operation:'create',input:{id,data:{name:id}}});
  const result=await collection.transaction([insert('a'),insert('b'),{operation:'count',input:{}}]);
  assert.equal(result[2],2);
  await reject(()=>collection.transaction([insert('c'),insert('a')]),'STORE.DUPLICATE_ID');
  await reject(()=>collection.get('c'),'STORE.NOT_FOUND');
  const competing=await Promise.allSettled([collection.transaction([insert('d'),insert('e')]),collection.transaction([insert('d'),insert('f')])]);
  assert.equal(competing.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(await collection.count(),4);
  const reopened=createStores((await load(store)).bind(context())).get('main').collection('users');
  assert.equal(await reopened.count(),4);
  await reject(()=>collection.transaction([{operation:'transaction',input:{}}]),'STORE.UNSUPPORTED');
  await reject(()=>collection.transaction([insert('g'),{operation:'create',input:{store:'other',id:'h',data:{name:'h'}}}]),'STORE.DENIED');
  await reject(()=>collection.get('g'),'STORE.NOT_FOUND');
 });
 test(`${provider}: schema identity, uniqueness, metadata and trusted principal isolation`,async t => {
  const {store}=await fixture(t,provider);
  // Opting in to a versioned schema creates a new host resource, never upgrades an existing schema.
  const configured={...store,id:'schemaStore',principal:'owner',installation:'receiptA',collections:[{id:'users',schemaId:'usersSchema',schemaVersion:1,fields:{name:{type:'string',required:true,unique:true,index:true}}}]};
  const registry=await load(configured);
  const ctx=context({principal:'owner',installation:'receiptA',scopes:{wydstore:[{store:'schemaStore',collection:'users'}]}});
  const collection=createStores(registry.bind(ctx)).get('schemaStore').collection('users');
  await collection.create('a',{name:'same'}).save();
  await reject(()=>collection.create('b',{name:'same'}).save(),'STORE.UNIQUE');
  await reject(()=>collection.transaction([{operation:'create',input:{id:'c',data:{name:'different'}}},{operation:'create',input:{id:'d',data:{name:'same'}}}]),'STORE.UNIQUE');
  assert.equal(await collection.count(),1);
  assert.equal((await collection.metadata()).schemaVersion,1);
  for (const extra of [{principal:'intruder'},{installation:'receiptB'},{installation:null},{app:'appB'}]) {
   const result=await registry.bind(context({...ctx,...extra})).invoke('wydstore','1.0.0','get',{store:'schemaStore',collection:'users',id:'a'});
   assert.equal(result.code,'STORE.DENIED'); assert.equal(result.details && Object.keys(result.details).length,0);
  }
  await reject(()=>load({...configured,collections:[{...configured.collections[0],schemaVersion:2}]}),'STORE.SCHEMA_INCOMPATIBLE');
 });
 test(`${provider}: every batch member requires its own capability`,async t => {
  const {registry,collection}=await fixture(t,provider);
  const ctx=context({capabilities:['store.records.write']});
  const result=await registry.bind(ctx).invoke('wydstore','1.0.0','transaction',{store:'main',collection:'users',operations:[{operation:'create',input:{id:'denied',data:{name:'x'}}}]});
  assert.equal(result.code,'SEAM.DENIED');assert.equal(await collection.count(),0);
 });
}

for (const provider of ['json','sqlite']) test(`${provider}: oversized batch responses roll back writes and unique updates are atomic`,async t => {
 const base=await fixture(t,provider),store={...base.store,limits:{transactionResultBytes:65536}};
 const collection=createStores((await load(store)).bind(context())).get('main').collection('users');
 await collection.create('large',{name:'x'.repeat(2000)}).save();
 const operations=[{operation:'create',input:{id:'rolledBack',data:{name:'x'}}},...Array.from({length:40},()=>({operation:'get',input:{id:'large'}}))];
 await reject(()=>collection.transaction(operations),'STORE.LIMIT');
 await reject(()=>collection.get('rolledBack'),'STORE.NOT_FOUND');
 const configured={...store,id:'uniqueStore',collections:[{id:'users',fields:{name:{type:'string',unique:true},nothing:{type:'null',unique:true}}}]};
 const registry=await load(configured),ctx=context({scopes:{wydstore:[{store:'uniqueStore',collection:'users'}]}});
 const users=createStores(registry.bind(ctx)).get('uniqueStore').collection('users');
 await users.create('a',{name:'a',nothing:null}).save();await users.create('b',{name:'b'}).save();
 const b=await users.get('b');b.set('name','a');await reject(()=>b.save(),'STORE.UNIQUE');assert.equal((await users.get('b')).version,1);
 await reject(()=>users.create('c',{nothing:null}).save(),'STORE.UNIQUE');
 await (await users.get('a')).delete();await users.create('c',{name:'a',nothing:null}).save();
});

import { demonstrateStore } from '../examples/store-portability/index.js';
for (const provider of ['json','sqlite']) test(`${provider}: identical application fixture demonstrates persistence portability`,async t => {
 const {registry}=await fixture(t,provider);
 assert.deepEqual(await demonstrateStore(registry.bind(context())),{count:2,names:['Grace','Ada']});
});

import fs from 'node:fs/promises';
import path from 'node:path';
import { file } from '../test-support/wydstore.js';
test('JSON ignores interrupted temporary writes, preserves committed state and requires stale-lock inspection',async t => {
 const {root,collection,store}=await fixture(t,'json');await collection.create('committed',{name:'old'}).save();
 const location=await file(root),temporary=path.join(root,'interrupted.tmp');
 await fs.writeFile(temporary,'{"partial":');
 const reopened=createStores((await load(store)).bind(context())).get('main').collection('users');
 assert.equal((await reopened.get('committed')).get('name'),'old');
 const lock=location.replace(/\.json$/,'.lock');await fs.writeFile(lock,'');
 await reject(()=>load(store),'STORE.BUSY');await reject(()=>reopened.transaction([{operation:'create',input:{id:'new',data:{name:'new'}}}]),'STORE.BUSY');
 await fs.unlink(lock);assert.equal(await collection.count(),1);
 assert.equal(await fs.readFile(temporary,'utf8'),'{"partial":');
});
test('legacy JSON metadata is not silently upgraded to an explicit schema',async t => {
 const {root,store,collection}=await fixture(t,'json');await collection.create('a',{name:'old'}).save();
 const location=await file(root),document=JSON.parse(await fs.readFile(location,'utf8'));delete document.collections.users.definition;
 await fs.writeFile(location,JSON.stringify(document));const before=await fs.readFile(location);
 assert.equal((await createStores((await load(store)).bind(context())).get('main').collection('users').get('a')).get('name'),'old');
 await reject(()=>load({...store,collections:[{...store.collections[0],schemaId:'usersSchema',schemaVersion:1}]}),'STORE.SCHEMA_INCOMPATIBLE');
 assert.deepEqual(await fs.readFile(location),before);
});

for (const provider of ['json','sqlite']) test(`${provider}: filter edge cases, query complexity and reduced operation budgets`,async t=>{
 const {collection,registry}=await fixture(t,provider);
 const rows=[['A',{name:"'; DROP TABLE records; --",active:false,score:0,nothing:null}],['b',{name:'b',active:true,score:1}],['c',{name:'c',active:false}]];
 for(const [id,data] of rows)await collection.create(id,data).save();
 for(const [filter,ids] of [
  [{field:'score',op:'ne',value:0},['b']],
  [{field:'score',op:'lte',value:0},['A']],
  [{field:'score',op:'gt',value:0},['b']],
  [{field:'nothing',op:'eq',value:null},['A']],
  [{field:'nothing',op:'ne',value:null},[]],
  [{field:'name',op:'eq',value:"'; DROP TABLE records; --"},['A']]
 ])assert.deepEqual((await collection.query({filter})).map(x=>x.id),ids);
 assert.deepEqual((await collection.query({sort:[{field:'active',direction:'asc'},{field:'name',direction:'desc'}]})).map(x=>x.id),['c','A','b']);
 await reject(()=>collection.query({where:null}),'STORE.INVALID_FIELD');
 let filter={field:'score',op:'eq',value:1};for(let i=0;i<10;i++)filter={and:[filter]};await reject(()=>collection.query({filter}),'STORE.LIMIT');
 const reduced=createStores(registry.bind(context({limits:{storeOperations:1}}))).get('main').collection('users');
 await reject(()=>reduced.transaction([{operation:'count',input:{}},{operation:'count',input:{}}]),'STORE.LIMIT');
 assert.equal(await collection.count(),3);
});

for (const provider of ['json','sqlite']) test(`${provider}: malformed batch inputs fail with normalized errors before writes`,async t=>{
 const {collection}=await fixture(t,provider);
 for(const input of [null,[],1,'sql']) await reject(()=>collection.transaction([{operation:'create',input}]),'STORE.INVALID_RECORD');
 assert.equal(await collection.count(),0);
});
