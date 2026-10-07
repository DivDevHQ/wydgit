import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadLibraries } from '../wydgine/libraries/index.js';
import { bindServices, failure } from '../wydgine/libraries/dispatch.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createStores } from '@wydgit/store/client';
import { manifest } from '@wydgit/store';
import platform from '../package.json' with {type:'json'};
const project = path.resolve(import.meta.dirname,'..');
const caps = ['read','create','write','delete'].map(a=>`store.records.${a}`);
const context = (extra={}) => new ExecutionContext({publisher:'acme',package:'acme/demo',app:'appA',self:'card',capabilities:caps,scopes:{wydstore:[{store:'main',collection:'users'}]},...extra});
const reject = (fn,code) => assert.rejects(fn,e=>e.code===code,code);
const definition = root => ({id:'main',app:'appA',publisher:'acme',package:'acme/demo',provider:'json',root,collections:[{id:'users',fields:{name:{type:'string',required:true},active:{type:'boolean',default:true},score:{type:'number'},info:{type:'object'},tags:{type:'array'},nothing:{type:'null'}}}]});
const config = store => ({schema:'wydgit.host/0.1',libraries:[{id:'wydstore',package:'@wydgit/store',enabled:true,version:'^0.1.0-alpha.1',publisher:'wydgit.core',trust:'canonical',options:{stores:[store]}}]});
const load = store => loadLibraries({config:config(store),root:project,platformVersion:platform.version});
async function temp(t) { const root=await fs.mkdtemp(path.join(os.tmpdir(),'wydstore-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root; }
async function fixture(t) { const root=await temp(t),store=definition(root),registry=await load(store),ctx=context();return {root,store,registry,ctx,collection:createStores(registry.bind(ctx)).get('main').collection('users')}; }
async function file(root) { return path.join(root,(await fs.readdir(root)).find(n=>n.endsWith('.json'))); }

test('WydStore workspace loads independently through canonical loader without granting authority',async t=>{
 const {registry,root}=await fixture(t);const require=createRequire(import.meta.url),pkg=require('@wydgit/store/package.json');
 assert.equal(pkg.version,'0.1.0-alpha.1');assert.equal(pkg.version,manifest.version);assert.equal(registry.get('wydstore').id,'wydstore');
 assert.equal(await fs.realpath(path.dirname(require.resolve('@wydgit/store/package.json'))),path.join(project,'packages/wydstore'));
 const ctx=context({capabilities:[]});assert.equal((await registry.bind(ctx).call('wydstore','query',{store:'main',collection:'users'})).code,'SEAM.DENIED');assert.deepEqual(ctx.capabilities,[]);
 assert.deepEqual(await fs.readdir(root).then(x=>x.map(n=>path.extname(n))),['.json']);
 assert.equal((await fs.stat(await file(root))).mode & 0o777,0o600);
});

test('record lifecycle preserves immutable identity, original/current values, dirty state and no-op save',async t=>{
 const {collection,root,store}=await fixture(t);const draft=collection.create('first',{name:'First',info:{a:1}});
 assert.equal(draft.state,'new');assert.equal(draft.original,null);assert.equal(draft.version,0);assert.equal(draft.dirty,true);
 assert.throws(()=>{draft.id='second';},TypeError);assert.throws(()=>{draft.current.info.a=2;},TypeError);
 await draft.save();assert.equal(draft.version,1);assert.equal(draft.state,'unchanged');assert.equal(draft.get('active'),true);
 const before=await fs.readFile(await file(root),'utf8');await draft.save();assert.equal(await fs.readFile(await file(root),'utf8'),before);
 draft.set('name','Next');assert.equal(draft.original.name,'First');assert.equal(draft.current.name,'Next');assert.equal(draft.dirty,true);
 await draft.save();assert.equal(draft.version,2);assert.equal(draft.dirty,false);assert.equal(draft.original.name,'Next');
 const reopened=createStores((await load(store)).bind(context())).get('main').collection('users');assert.equal((await reopened.get('first')).get('name'),'Next');
 await reject(()=>collection.create('first',{name:'dup'}).save(),'STORE.DUPLICATE_ID');await reject(()=>collection.get('missing'),'STORE.NOT_FOUND');
 assert.throws(()=>draft.set('id','new'),e=>e.code==='STORE.INVALID_FIELD');
});

test('schema enforces types, required and unknown fields and applies defaults',async t=>{
 const {collection}=await fixture(t);
 for(const data of [{},{name:3},{name:'x',unknown:true},{name:'x',score:'1'},{name:'x',active:0},{name:'x',info:[]},{name:'x',tags:{}},{name:'x',nothing:false}])await reject(()=>collection.create('bad',data).save(),'STORE.INVALID_FIELD');
 const item=collection.create('valid',{name:'x',score:2,info:{a:true},tags:[1,'a'],nothing:null});await item.save();item.reset('name');await reject(()=>item.save(),'STORE.INVALID_FIELD');assert.equal((await collection.get('valid')).get('name'),'x');
 item.set('name','x');item.set('active',false);await item.save();item.reset('active');await item.save();assert.equal(item.get('active'),true);
});

test('optimistic concurrency serializes competing handles and preserves history including deletion',async t=>{
 const {collection,store}=await fixture(t);await collection.create('item',{name:'start'}).save();
 const other=createStores((await load(store)).bind(context())).get('main').collection('users');
 const a=await collection.get('item'),b=await other.get('item');a.set('name','a');b.set('name','b');
 const results=await Promise.allSettled([a.save(),b.save()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'STORE.CONFLICT');
 const current=await collection.get('item');assert.equal(current.version,2);await reject(()=>b.delete(),'STORE.CONFLICT');
 await current.delete();assert.equal(current.state,'deleted');assert.equal(current.version,3);await reject(()=>current.save(),'STORE.DELETED');await reject(()=>collection.get('item'),'STORE.NOT_FOUND');
 await reject(()=>collection.create('item',{name:'reuse'}).save(),'STORE.DUPLICATE_ID');
 const history=await collection.history('item');assert.deepEqual(history.map(v=>v.version),[1,2,3]);assert.equal(history[0].data.name,'start');assert.equal(history[2].deleted,true);assert.equal(history[2].data,null);assert.ok(Object.isFrozen(history[0].data));
 assert.equal((await collection.query()).length,0);
});

test('query has portable equality filters, lexical ID ordering and limits',async t=>{
 const {collection}=await fixture(t);for(const id of ['z','a','m'])await collection.create(id,{name:id==='m'?'other':'same',info:{b:2,a:1}}).save();
 assert.deepEqual((await collection.query()).map(r=>r.id),['a','m','z']);assert.deepEqual((await collection.query({where:{name:'same'},limit:1})).map(r=>r.id),['a']);
 assert.equal((await collection.query({where:{info:{a:1,b:2}}})).length,3);assert.equal((await collection.query({limit:0})).length,0);
 await reject(()=>collection.query({where:{unknown:1}}),'STORE.INVALID_FIELD');await reject(()=>collection.query({where:{name:3}}),'STORE.INVALID_FIELD');await reject(()=>collection.query({limit:-1}),'STORE.INVALID_RECORD');
});

test('each operation requires caller capability and exact store/collection/App/publisher/package scope',async t=>{
 const {registry,collection}=await fixture(t);await collection.create('item',{name:'x'}).save();
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

test('host ownership separates files even with identical logical store and record names',async t=>{
 const {root,collection,store}=await fixture(t);await collection.create('same',{name:'A'}).save();
 const registry=await load({...store,app:'appB'}),b=createStores(registry.bind(context({app:'appB'}))).get('main').collection('users');await b.create('same',{name:'B'}).save();assert.equal((await collection.get('same')).get('name'),'A');assert.equal((await b.get('same')).get('name'),'B');assert.equal((await fs.readdir(root)).length,2);
});

test('configuration rejects unsafe roots, schemas, duplicate identities and unexpected values',async t=>{
 const root=await temp(t),valid=definition(root);
 for(const change of [{root:'../outside'},{root:root+'/../escape'},{root:'/'},{provider:'sqlite'},{id:'../escape'},{collections:[{id:'users',fields:{x:{type:'date'}}}]},{collections:[{id:'users',fields:{id:{type:'string'}}}]},{extra:true}])await reject(()=>load({...valid,...change}),'STORE.INVALID_CONFIG');
 const configuration=config(valid);configuration.libraries[0].options.stores.push(valid);await reject(()=>loadLibraries({config:configuration,root:project,platformVersion:platform.version}),'STORE.INVALID_CONFIG');
 const link=path.join(root,'link');await fs.symlink(root,link);await reject(()=>load({...valid,root:link}),'STORE.INVALID_CONFIG');
});

test('corrupt JSON, wrong ownership and invalid history fail closed without overwrite',async t=>{
 const {root,collection,store}=await fixture(t);await collection.create('item',{name:'x'}).save();const location=await file(root),original=await fs.readFile(location,'utf8');
 const wrongOwner=JSON.parse(original);wrongOwner.owner.app='other';const wrongHistory=JSON.parse(original);wrongHistory.collections.users.records[0].version=9;
 for(const content of ['{',JSON.stringify(wrongOwner),JSON.stringify(wrongHistory),'{"__proto__":{}}']){await fs.writeFile(location,content);await reject(()=>collection.get('item'),'STORE.CORRUPT');await reject(()=>load(store),'STORE.CORRUPT');assert.equal(await fs.readFile(location,'utf8'),content);}
 await fs.unlink(location);await reject(()=>collection.query(),'STORE.CORRUPT');
});

test('filesystem links, busy locks and provider errors never expose paths',async t=>{
 const {root,collection}=await fixture(t);const location=await file(root),content=await fs.readFile(location),outside=path.join(await temp(t),'outside.json');await fs.writeFile(outside,content);await fs.unlink(location);await fs.symlink(outside,location);
 await assert.rejects(()=>collection.query(),e=>e.code==='STORE.IO'&&!JSON.stringify(e.toJSON()).includes(root));assert.deepEqual(await fs.readFile(outside),content);
 await fs.unlink(location);await fs.link(outside,location);await reject(()=>collection.query(),'STORE.CORRUPT');await fs.unlink(location);await fs.writeFile(location,content);
 const lock=location.replace(/\.json$/,'.lock');await fs.writeFile(lock,'');await reject(()=>collection.query(),'STORE.BUSY');await fs.unlink(lock);assert.deepEqual(await collection.query(),[]);
});

test('hostile record inputs and path-shaped IDs are rejected through facade and dispatch',async t=>{
 const {registry,collection}=await fixture(t),dispatch=registry.bind(context());
 for(const key of ['__proto__','constructor','prototype']){
  const data=JSON.parse(`{"name":"x","info":{"${key}":true}}`);assert.throws(()=>collection.create('item',data),e=>e.code==='STORE.INVALID_RECORD');
  assert.equal((await dispatch.call('wydstore','create',{store:'main',collection:'users',id:'item',data})).code,'SERVICE.INVALID_REQUEST');
 }
 for(const id of ['../x','/tmp/x','x.json','a/b','constructor'])assert.throws(()=>collection.create(id,{name:'x'}),e=>e.code==='STORE.INVALID_RECORD');
 for(const value of [NaN,Infinity,()=>{},undefined,new Date()])assert.throws(()=>collection.create('item',{name:'x',info:{value}}),e=>e.code==='STORE.INVALID_RECORD');
 const accessor={};Object.defineProperty(accessor,'name',{enumerable:true,get(){assert.fail('must not evaluate getters');}});assert.throws(()=>collection.create('item',accessor));
 const cyclic={};cyclic.x=cyclic;assert.throws(()=>collection.create('item',cyclic));assert.equal({}.polluted,undefined);
});

test('generic dispatcher retains context, requires authorization and sanitizes unexpected service errors',async()=>{
 const ctx=context();let seen;const service={capability:'store.records.read',authorize:(request,caller)=>{seen=caller;return true;},handler:()=>({answer:42})};
 const dispatch=bindServices(ctx,()=>service);assert.deepEqual(Object.keys(dispatch),['call']);assert.equal((await dispatch.call('x','y',{})).value.answer,42);assert.equal(seen,ctx);
 service.authorize=()=>false;assert.equal((await dispatch.call('x','y',{})).code,'SEAM.DENIED');delete service.authorize;assert.equal((await dispatch.call('x','y',{})).code,'SEAM.DENIED');
 service.authorize=()=>true;service.handler=()=>{throw new Error('/private/host/file');};assert.deepEqual((await dispatch.call('x','y',{})),{ok:false,code:'SERVICE.FAILED',message:'Service operation failed',details:{}});
 service.handler=()=>{throw failure('STORE.CONFLICT');};assert.equal((await dispatch.call('x','y',{})).code,'STORE.CONFLICT');service.handler=()=>({fn:()=>{}});assert.equal((await dispatch.call('x','y',{})).code,'SERVICE.FAILED');
});

test('platform metadata, workspace metadata and demo remain synchronized and portable',async()=>{
 const lock=JSON.parse(await fs.readFile(path.join(project,'package-lock.json'))),app=JSON.parse(await fs.readFile(path.join(project,'content/app.json')));
 assert.equal(platform.version,'0.2.0-alpha.4');assert.equal(lock.version,platform.version);assert.equal(lock.packages[''].version,platform.version);assert.equal(lock.packages[''].name,platform.name);assert.equal(lock.packages['packages/wydstore'].version,manifest.version);assert.equal(app.properties.revision,'Wydgit 0.2 alpha 4');assert.doesNotMatch(JSON.stringify(app),/node_modules|@wydgit\/store|filesystem|provider/);
});

test('equivalent record inputs persist deterministically and input aliases cannot change saved values',async t=>{
 const first=await fixture(t),second=await fixture(t);
 const data={name:'x',info:{b:2,a:1},tags:['a','b']};const draft=first.collection.create('item',data);data.info.a=9;await draft.save();
 await second.collection.create('item',{tags:['a','b'],info:{a:1,b:2},name:'x'}).save();
 assert.equal(await fs.readFile(await file(first.root),'utf8'),await fs.readFile(await file(second.root),'utf8'));
 draft.set('name','changed');draft.set('name','x');assert.equal(draft.dirty,false);assert.equal(draft.state,'unchanged');
 draft.set('name','discard');await draft.delete();assert.equal(draft.dirty,false);assert.equal(draft.current.name,'x');
});

test('failed provider write preserves the record and original revision and cleans temporary files',async t=>{
 const {collection,root}=await fixture(t);const item=collection.create('item',{name:'x'});await item.save();
 const before=await fs.readFile(await file(root),'utf8');
 // A bounded document overflow fails before replacing the authoritative file.
 item.set('name','x'.repeat(16*1024*1024));await reject(()=>item.save(),'STORE.LIMIT');
 assert.equal(item.version,1);assert.equal(item.original.name,'x');assert.equal(item.dirty,true);
 assert.equal(await fs.readFile(await file(root),'utf8'),before);assert.deepEqual((await fs.readdir(root)).map(n=>path.extname(n)),['.json']);
 item.set('name','repaired');await item.save();assert.equal(item.version,2);
});
