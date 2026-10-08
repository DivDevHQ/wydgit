import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { bindServices, failure } from '../wydgine/libraries/dispatch.js';
import { manifest } from '@wydgit/store';
import platform from '../package.json' with {type:'json'};
import {project, context, reject, load, temp, fixture, file} from '../test-support/wydstore.js';

test('WydStore workspace loads independently through canonical loader without granting authority',async t=>{
 const {registry,root}=await fixture(t);const require=createRequire(import.meta.url),pkg=require('@wydgit/store/package.json');
 assert.equal(pkg.version,'0.1.0-alpha.2');assert.equal(pkg.version,manifest.version);assert.equal(registry.get('wydstore').id,'wydstore');
 assert.equal(await fs.realpath(path.dirname(require.resolve('@wydgit/store/package.json'))),path.join(project,'packages/wydstore'));
 const ctx=context({capabilities:[]});assert.equal((await registry.bind(ctx).call('wydstore','query',{store:'main',collection:'users'})).code,'SEAM.DENIED');assert.deepEqual(ctx.capabilities,[]);
 assert.deepEqual(await fs.readdir(root).then(x=>x.map(n=>path.extname(n))),['.json']);
 assert.equal((await fs.stat(await file(root))).mode & 0o777,0o600);
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

test('generic dispatcher retains context, requires authorization and sanitizes unexpected service errors',async()=>{
 const ctx=context();let seen;const service={capability:'store.records.read',authorize:(request,caller)=>{seen=caller;return true;},handler:()=>({answer:42})};
 const dispatch=bindServices(ctx,()=>service);assert.deepEqual(Object.keys(dispatch),['call']);assert.equal((await dispatch.call('x','y',{})).value.answer,42);assert.equal(seen,ctx);
 service.authorize=()=>false;assert.equal((await dispatch.call('x','y',{})).code,'SEAM.DENIED');delete service.authorize;assert.equal((await dispatch.call('x','y',{})).code,'SEAM.DENIED');
 service.authorize=()=>true;service.handler=()=>{throw new Error('/private/host/file');};assert.deepEqual((await dispatch.call('x','y',{})),{ok:false,code:'SERVICE.FAILED',message:'Service operation failed',details:{}});
 service.handler=()=>{throw failure('STORE.CONFLICT');};assert.equal((await dispatch.call('x','y',{})).code,'STORE.CONFLICT');service.handler=()=>({fn:()=>{}});assert.equal((await dispatch.call('x','y',{})).code,'SERVICE.FAILED');
});

test('platform metadata, workspace metadata and demo remain synchronized and portable',async()=>{
 const lock=JSON.parse(await fs.readFile(path.join(project,'package-lock.json'))),app=JSON.parse(await fs.readFile(path.join(project,'content/app.json')));
 assert.equal(platform.version,'0.2.0-alpha.7');assert.equal(lock.version,platform.version);assert.equal(lock.packages[''].version,platform.version);assert.equal(lock.packages[''].name,platform.name);assert.equal(lock.packages['packages/wydstore'].version,manifest.version);assert.equal(app.properties.revision,'Wydgit 0.2 alpha 7');assert.doesNotMatch(JSON.stringify(app),/node_modules|@wydgit\/store|filesystem|provider|sqlite|pragma|SELECT/i);
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
