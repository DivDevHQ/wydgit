import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import Database from 'better-sqlite3';
import { checkJsonBudget, serviceLimits } from '../wydgine/libraries/limits.js';
import { bindServices } from '../wydgine/libraries/dispatch.js';
import { validateConfig, validateManifest, loadLibraries } from '../wydgine/libraries/index.js';
import { createStores } from '@wydgit/store/client';
import platform from '../package.json' with {type:'json'};
import { project, temp, definition, config, context, reject, file } from '../test-support/wydstore.js';
const MiB=1024*1024,scope={store:'main',collection:'users'};
async function fixture(t,provider,limits={},servicePolicy={}) {
 const root=await temp(t),store={...definition(root,provider),limits},host=config(store);
 host.libraries[0].serviceLimits=servicePolicy;
 const registry=await loadLibraries({config:host,root:project,platformVersion:platform.version}),dispatch=registry.bind(context());
 const collection=createStores(dispatch).get('main').collection('users');
 return {root,store,host,registry,dispatch,collection};
}

test('JSON budget measures exact UTF-8 serialized bytes, escapes and structural nodes without invoking accessors',()=>{
 const generous={maxBytes:100000,maxNodes:1000,maxDepth:64};
 for(const value of ['ASCII','é','☃','😀','\ud800','\udfff','"\\\n\u0000',{nested:['☃',null,false,1e30,-0],é:'😀'}]) {
  const bytes=Buffer.byteLength(JSON.stringify(value));
  assert.equal(checkJsonBudget(value,generous).bytes,bytes);
  assert.doesNotThrow(()=>checkJsonBudget(value,{...generous,maxBytes:bytes}));
  assert.throws(()=>checkJsonBudget(value,{...generous,maxBytes:bytes-1}));
 }
 const units=['x','é','☃','😀','\ud800','\udfff','\n','\u0000','"','\\'];
 let seed=12345;
 for(let sample=0;sample<100;sample++){
  let text='';for(let i=0;i<30;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;text+=units[seed%units.length];}
  assert.equal(checkJsonBudget({[text]:[text]},generous).bytes,Buffer.byteLength(JSON.stringify({[text]:[text]})));
 }
 let accessed=false;assert.throws(()=>checkJsonBudget({get x(){accessed=true;return 'x';}},generous));assert.equal(accessed,false);
 const deep={child:{child:{child:1}}};assert.throws(()=>checkJsonBudget(deep,{...generous,maxDepth:2}));
 assert.throws(()=>checkJsonBudget(Array(10000).fill(0),{...generous,maxNodes:10}));
});

test('canonical request/response budgets are independent UTF-8 host policies with reductions only',async()=>{
 const manifest={id:'testservice',apiVersion:'1.0.0'},ctx=context(),limits=serviceLimits({requestBytes:20,responseBytes:40});
 let calls=0,result={text:'☃'.repeat(9)};
 const service={limits,capability:'store.records.read',authorize:()=>true,validate:()=>true,handler:()=>{calls++;return result;}};
 const invoke=(input={},caller=ctx)=>bindServices(caller,()=>service,()=>manifest).invoke('testservice','1.0.0','read',input);
 assert.equal((await invoke({text:'a'.repeat(9)})).ok,true); // 20 serialized bytes
 assert.equal((await invoke({text:'☃'.repeat(4)})).code,'SERVICE.INVALID_REQUEST');assert.equal(calls,1);
 result={text:'☃'.repeat(10)};assert.equal((await invoke()).code,'SERVICE.INVALID_RESULT');
 assert.equal((await invoke({text:'a'.repeat(10)},context({limits:{serviceRequestBytes:999999}}))).code,'SERVICE.INVALID_REQUEST');
 assert.equal((await invoke({},context({limits:{serviceResponseBytes:10}}))).code,'SERVICE.INVALID_RESULT');
 assert.equal((await invoke({},context({capabilities:[]}))).code,'SEAM.DENIED');
});

test('host settings validate positive integers and hard ceilings; package manifests cannot carry service policies',()=>{
 const base={schema:'wydgit.host/0.1',libraries:[{id:'wydstore',package:'@wydgit/store',enabled:true,version:'^0.1.0-alpha.2',publisher:'wydgit.core',trust:'canonical'}]};
 for(const servicePolicy of [{requestBytes:0},{responseBytes:-1},{maxNodes:1048577},{maxDepth:65},{requestBytes:34*MiB},{responseBytes:66*MiB},{maxNodes:1.5},{requestBytes:'65536'},{unknown:1}]) {
  assert.throws(()=>validateConfig({...base,libraries:[{...base.libraries[0],serviceLimits:servicePolicy}]}),e=>e.code==='LIBRARY.INVALID_CONFIG');
 }
 assert.doesNotThrow(()=>validateConfig({...base,libraries:[{...base.libraries[0],serviceLimits:{requestBytes:33*MiB,responseBytes:65*MiB,maxNodes:1048576,maxDepth:64}}]}));
 const manifest={schema:'wydgit.library/0.1',id:'example',version:'1.0.0',publisher:'wydgit.core',trust:'canonical',platform:'*',targets:['server'],capabilities:['store.records.read'],services:[{name:'read',capability:'store.records.read'}]};
 assert.throws(()=>validateManifest({...manifest,serviceLimits:{responseBytes:65*MiB}}),e=>e.code==='LIBRARY.INVALID_MANIFEST');
});

for(const provider of ['json','sqlite']) {
 test(`${provider}: record UTF-8 budget counts defaults and both legacy/canonical paths agree`,async t=>{
  const {collection,dispatch}=await fixture(t,provider,{recordBytes:80});
  const valid={name:'☃'.repeat(17)}; // name/active defaults + 51 bytes = 76 bytes
  await collection.create('legacy',valid).save();
  assert.equal((await dispatch.invoke('wydstore','1.0.0','create',{...scope,id:'canonical',data:valid})).ok,true);
  for(const method of ['call','invoke']) {
   const args=method==='call'?['wydstore','create']:['wydstore','1.0.0','create'];
   assert.equal((await dispatch[method](...args,{...scope,id:'oversized',data:{name:'☃'.repeat(20)}})).code,'STORE.LIMIT');
  }
  assert.equal(await collection.count(),2);
  await collection.create('ASCII',{name:'x'.repeat(50)}).save();
  assert.equal(await collection.count(),3);
 });
 test(`${provider}: transaction rollback honors actual store, service, caller byte and node response budgets`,async t=>{
  for(const [storePolicy,servicePolicy,callerPolicy] of [
   [{transactionResultBytes:220},{},{}],
   [{},{responseBytes:220},{}],
   [{},{},{serviceResponseBytes:220}],
   [{},{},{serviceNodes:18}]
  ]) {
   const {registry,collection}=await fixture(t,provider,storePolicy,servicePolicy);
   const dispatch=registry.bind(context({limits:callerPolicy}));
   await collection.create('read',{name:'☃'.repeat(30)}).save();
   const result=await dispatch.invoke('wydstore','1.0.0','transaction',{...scope,operations:[
    {operation:'create',input:{id:'rolledBack',data:{name:'x'}}},
    {operation:'get',input:{id:'read'}},
    {operation:'get',input:{id:'read'}}
   ]});
   assert.equal(result.code,'STORE.LIMIT');await reject(()=>collection.get('rolledBack'),'STORE.NOT_FOUND');
   assert.equal((await collection.history('read')).length,1);
  }
 });
 test(`${provider}: structural limits precede writes, allow host tuning, and cannot be raised by a context or argument`,async t=>{
  const {collection,dispatch,registry}=await fixture(t,provider,{maxNodes:100});
  const data={name:'wide',tags:Array(100).fill(0)};
  const request={...scope,id:'wide',data};
  assert.equal((await dispatch.invoke('wydstore','1.0.0','create',request)).code,'STORE.LIMIT');
  const raised=registry.bind(context({limits:{serviceNodes:1048576}}));
  assert.equal((await raised.invoke('wydstore','1.0.0','create',request)).code,'STORE.LIMIT');
  assert.equal((await dispatch.invoke('wydstore','1.0.0','create',{...scope,id:'spoof',data:{name:'x'},limits:{recordBytes:99999999}})).code,'STORE.INVALID_RECORD');
  assert.throws(()=>registry.bind({...context(),limits:{serviceNodes:999999}}),e=>e.code==='SEAM.CONTEXT');
  await collection.create('small',{name:'x',tags:Array(20).fill(0)}).save();
  let info={};for(let i=0;i<65;i++)info={nested:info};
  assert.equal((await dispatch.invoke('wydstore','1.0.0','create',{...scope,id:'deep',data:{name:'x',info}})).code,'SERVICE.INVALID_REQUEST');
  assert.equal(await collection.count(),1);
 });
 test(`${provider}: record/query/history compatibility with 262144 nodes and multi-megabyte data`,async t=>{
  const {collection,dispatch}=await fixture(t,provider);
  const big=collection.create('large',{name:'☃'.repeat(700000)});await big.save();big.set('active',false);await big.save();
  const canonical=await dispatch.invoke('wydstore','1.0.0','get',{...scope,id:'large'});assert.equal(canonical.ok,true);
  assert.equal(canonical.value.data.name.length,700000);assert.equal((await collection.history('large')).length,2);
  assert.equal((await dispatch.invoke('wydstore','1.0.0','history',{...scope,id:'large'})).value.length,2);
  // One record with 250000 primitive values remains below the proposed default.
  await collection.create('manyNodes',{name:'x',tags:Array(250000).fill(0)}).save();
  assert.equal((await collection.query()).length,2);
  assert.equal((await dispatch.invoke('wydstore','1.0.0','query',scope)).value.length,2);
 });
 test(`${provider}: query and transaction-request budgets measure UTF-8 and expose identical results`,async t=>{
  const {collection,dispatch}=await fixture(t,provider,{queryResultBytes:200,transactionRequestBytes:200});
  for(const id of ['a','b','c'])await collection.create(id,{name:'☃'.repeat(15)}).save();
  await reject(()=>collection.query(),'STORE.LIMIT');
  assert.equal((await dispatch.invoke('wydstore','1.0.0','query',scope)).code,'STORE.LIMIT');
  assert.equal((await collection.query({limit:1})).length,1);
  await reject(()=>collection.transaction([{operation:'create',input:{id:'large',data:{name:'☃'.repeat(50)}}}]),'STORE.LIMIT');
  assert.equal(await collection.count(),3);
 });
 test(`${provider}: invalid store limits fail startup rather than allowing unbounded growth`,async t=>{
  const root=await temp(t),store=definition(root,provider);
  for(const limits of [{recordBytes:17*MiB},{queryResultBytes:65*MiB},{historyDataBytes:65*MiB},{transactionRequestBytes:34*MiB},{transactionResultBytes:66*MiB},{jsonDocumentBytes:65*MiB},{sqliteDatabaseBytes:4*1024*MiB+4096},{sqliteDatabaseBytes:12345},{maxNodes:1048577},{maxDepth:65},{maxOperations:65},{recordBytes:0},{unexpected:true}]) {
   const host=config({...store,limits});await reject(()=>loadLibraries({config:host,root:project,platformVersion:platform.version}),'STORE.INVALID_CONFIG');
  }
 });
}

test('SQLite database capacity is a bounded trusted host policy, including the 4 GiB v0.3 ceiling',async t=>{
 const {root,collection,store}=await fixture(t,'sqlite',{sqliteDatabaseBytes:64*1024});
 await collection.create('small',{name:'x'}).save();
 await reject(()=>collection.create('full',{name:'x'.repeat(128*1024)}).save(),'STORE.LIMIT');
 assert.equal(await collection.count(),1);
 const host=config({...store,limits:{sqliteDatabaseBytes:512*MiB}}),registry=await loadLibraries({config:host,root:project,platformVersion:platform.version});
 await createStores(registry.bind(context())).get('main').collection('users').create('larger',{name:'x'.repeat(128*1024)}).save();
 assert.ok((await fs.stat(await file(root,'.sqlite'))).size>64*1024);
 const db=new Database(await file(root,'.sqlite'),{readonly:true});try{assert.equal(db.pragma('page_size',{simple:true}),4096);}finally{db.close();}
});

for(const provider of ['json','sqlite'])test(`${provider}: full 10000-record query and 10000-version history fit the smaller default node budget`,async t=>{
 const {root,dispatch,collection}=await fixture(t,provider),data={active:true,name:'x'};
 if(provider==='json') {
  const location=await file(root),document=JSON.parse(await fs.readFile(location,'utf8'));
  document.collections.users.records=Array.from({length:10000},(_,i)=>({id:`r${i}`,version:i===0?10000:1,data,deleted:false,
   history:i===0?Array.from({length:9999},(_,j)=>({version:j+1,data,deleted:false})):[]}));
  await fs.writeFile(location,JSON.stringify(document));
 } else {
  const db=new Database(await file(root,'.sqlite'));
  try {db.transaction(()=>{
   const insert=db.prepare('INSERT INTO records (collection,id,version,data,deleted) VALUES (?,?,?,?,0)');
   for(let i=0;i<10000;i++)insert.run('users',`r${i}`,i===0?10000:1,JSON.stringify(data));
   const history=db.prepare('INSERT INTO history (collection,id,version,data) VALUES (?,?,?,?)');
   for(let version=1;version<10000;version++)history.run('users','r0',version,JSON.stringify(data));
  })();}finally{db.close();}
 }
 const query=await dispatch.invoke('wydstore','1.0.0','query',scope);assert.equal(query.ok,true);assert.equal(query.value.length,10000);
 const history=await dispatch.invoke('wydstore','1.0.0','history',{...scope,id:'r0'});assert.equal(history.ok,true);assert.equal(history.value.length,10000);
 assert.equal((await collection.query()).length,10000);assert.equal((await collection.history('r0')).length,10000);
 assert.ok(checkJsonBudget(query.value,{maxBytes:33*MiB,maxNodes:262144,maxDepth:64}).nodes<262144);
});

for(const provider of ['json','sqlite'])test(`${provider}: explicit host tuning permits a record above the default structural budget`,async t=>{
 const {dispatch,collection}=await fixture(t,provider,{maxNodes:1048576},{maxNodes:1048576});
 const data={name:'wide',tags:Array(270000).fill(false)};
 assert.equal((await dispatch.invoke('wydstore','1.0.0','create',{...scope,id:'wide',data})).ok,true);
 assert.equal((await collection.get('wide')).get('tags').length,270000);
 assert.equal((await collection.query()).length,1);
});

for(const provider of ['json','sqlite'])test(`${provider}: sorting bounds candidate memory consistently and transaction overflow stops before later members`,async t=>{
 const {collection}=await fixture(t,provider,{queryResultBytes:200,transactionResultBytes:200});
 for(const id of ['a','b','c'])await collection.create(id,{name:'☃'.repeat(15)}).save();
 // Unsorted pagination streams/bounds selected results; field sorting bounds its
 // matched candidate set before materializing an arbitrarily large working set.
 assert.equal((await collection.query({limit:1})).length,1);
 await reject(()=>collection.query({sort:[{field:'name',direction:'asc'}],limit:1}),'STORE.LIMIT');
 const result=()=>collection.transaction([
  {operation:'create',input:{id:'rolledBack',data:{name:'x'}}},
  {operation:'get',input:{id:'a'}},{operation:'get',input:{id:'b'}},
  {operation:'create',input:{id:'a',data:{name:'duplicate'}}}
 ]);
 await reject(result,'STORE.LIMIT'); // overflow occurs before the duplicate member
 await reject(()=>collection.get('rolledBack'),'STORE.NOT_FOUND');
 assert.equal(await collection.count(),3);
});

test('real loader captures frozen service policies and canonical boundaries use the host overrides',async t=>{
 const {dispatch,host,collection}=await fixture(t,'json',{}, {requestBytes:200,responseBytes:300});
 host.libraries[0].serviceLimits.requestBytes=999999;
 const oversized={...scope,id:'tooLarge',data:{name:'☃'.repeat(60)}};
 assert.equal((await dispatch.invoke('wydstore','1.0.0','create',oversized)).code,'SERVICE.INVALID_REQUEST');
 assert.equal((await dispatch.call('wydstore','create',oversized)).code,'SERVICE.INVALID_REQUEST');
 await collection.create('valid',{name:'x'}).save();assert.equal(await collection.count(),1);
});

test('JSON document byte capacity remains 16 MiB by default and trusted lowering never overwrites data',async t=>{
 const {root,collection,store}=await fixture(t,'json');await collection.create('a',{name:'☃'.repeat(100)}).save();
 const location=await file(root),before=await fs.readFile(location),host=config({...store,limits:{jsonDocumentBytes:before.length-1}});
 await reject(()=>loadLibraries({config:host,root:project,platformVersion:platform.version}),'STORE.LIMIT');
 assert.deepEqual(await fs.readFile(location),before);
});
