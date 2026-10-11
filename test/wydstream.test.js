import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mediaFixture,png } from '../test-support/wydstream.js';
import { initializeHost } from '../wydgine/host.js';
import { mediaSearchSource } from '../packages/wydstream/src/search-source.js';
const body=(bytes=png,type='image/png',filename='image.png')=>{const form=new FormData();form.append('file',new Blob([bytes],{type}),filename);form.append('title','A picture');form.append('description','Fixture');const request=new Request('http://localhost',{method:'POST',body:form});return {body:request.body,headers:{type:request.headers.get('content-type'),encoding:'identity'},method:'POST',authorize:async()=>{}};};
export const upload=async(f,bytes=png,metadata={})=>{
 const result=await f.libraries.transfer(f.caller,'wydstream','create-upload',{resource:'media',...metadata},body(bytes));return JSON.parse(result.body).value;
};
for(const provider of ['JSON','SQLite']){
 test(`${provider}: WydStream canonical metadata, scoped upload, revision conflicts, persistence, quota and repair`,async t=>{
  const f=await mediaFixture(t,provider);const item=await upload(f);assert.equal(item.mime,'image/png');assert.equal(item.type,'image');assert.equal(item.size,png.length);assert.equal(item.visibility,'private');assert.match(item.hash,/^[a-f0-9]{64}$/);assert.equal(item.creator,f.user.id);
  assert.doesNotMatch(JSON.stringify(item),/tokenHash|sessionId|\.part|\.bin|media-binary/);
  assert.equal((await f.invoke('get',{id:item.id})).value.title,'A picture');assert.equal((await f.invoke('list')).value.total,1);
  assert.equal((await f.invoke('get',{id:item.id},f.context({principal:'other'}))).code,'STREAM.DENIED');assert.equal((await f.invoke('get',{id:item.id},f.context({identity:null}))).code,'STREAM.DENIED');
  assert.equal((await f.invoke('get',{id:item.id},f.context({app:'other',identity:null}))).code,'STREAM.DENIED');assert.equal((await f.invoke('list',{},f.context({scopes:{}}))).code,'STREAM.DENIED');
  for(const name of ['get','list','create-upload','update','delete'])assert.equal((await f.invoke(name,{id:item.id},f.context({capabilities:[]}))).code,'SEAM.DENIED');
  assert.throws(()=>f.libraries.bind({...f.caller}),{code:'SEAM.CONTEXT'});
  const updates=await Promise.all([f.invoke('update',{id:item.id,revision:item.revision,metadata:{title:'Changed',visibility:'public'}}),f.invoke('update',{id:item.id,revision:item.revision,metadata:{title:'Other'}})]);assert.equal(updates.filter(r=>r.ok).length,1);assert.equal(updates.find(r=>!r.ok).code,'STREAM.CONFLICT');
  const latest=(await f.invoke('get',{id:item.id})).value;
  assert.equal((await f.invoke('delete',{id:item.id,revision:1})).code,'STREAM.CONFLICT');
  const restarted=await initializeHost({root:f.root});assert.equal((await restarted.bind(f.caller).invoke('wydstream','1.0.0','get',{resource:'media',id:item.id})).value.title,latest.title);
  const repairContext=f.context({principal:'host:media-repair',capabilities:['stream.media.repair']});assert.equal((await f.invoke('reconcile',{},repairContext)).value.changed,0);
  const config=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'))).libraries.find(l=>l.id==='wydstream').options.apps[0];await fs.unlink(path.join(config.root,item.id+'.bin'));
  assert.equal((await f.invoke('reconcile',{},repairContext)).value.changed,1);assert.equal((await f.invoke('get',{id:item.id})).code,'STREAM.DENIED');assert.equal((await f.invoke('reconcile',{},repairContext)).value.changed,0);
 });
 test(`${provider}: dangerous, spoofed, oversized and malformed uploads clean metadata/storage`,async t=>{
  const f=await mediaFixture(t,provider);
  for(const bytes of [Buffer.from('<svg onload="alert(1)"/>'),Buffer.from('<script>bad()</script>'),Buffer.from('#!/bin/sh\nexit'),Buffer.alloc(0)])await assert.rejects(upload(f,bytes));
  await assert.rejects(upload(f,png,{maxBytes:10}));assert.equal((await f.invoke('list')).value.total,0);
  const result=await f.libraries.transfer(f.caller,'wydstream','create-upload',{resource:'media'},body(png,'text/html','../../evil.js'));assert.equal(JSON.parse(result.body).value.mime,'image/png');
  for(const id of ['../../outside','m-../x','m-'+ 'a'.repeat(32)])assert.equal((await f.invoke('get',{id})).ok,false);
  const ticket=await f.invoke('create-upload');assert.equal(ticket.ok,true);assert.equal((await f.invoke('complete-upload',{id:ticket.value.id,token:'a'.repeat(64)})).code,'STREAM.DENIED');assert.equal((await f.invoke('complete-upload',{id:ticket.value.id,token:ticket.value.token})).code,'STREAM.STATE');
  assert.equal((await f.invoke('create-upload',{categories:['unsafe']})).code,'STREAM.DENIED');assert.equal((await f.invoke('list',{limit:10000})).code,'STREAM.LIMIT');
  assert.equal((await f.invoke('create-upload',{},f.context({identity:null}))).code,'STREAM.DENIED');
  assert.equal((await f.invoke('reconcile',{},f.context({capabilities:['stream.media.repair']}))).code,'STREAM.DENIED');
 });
}
test('trusted media source indexes only authorized supported metadata via canonical calls',async t=>{
 const f=await mediaFixture(t),item=await upload(f),source=mediaSearchSource({indexes:[{id:'media-index',app:f.caller.app,resource:'media',destination:'/_transfer/wydstream/get-delivery/home/wydmedia-gallery'}],dispatch:caller=>f.libraries.bind(caller)});
 assert.equal(await source.resolve('media-index',item.id,f.caller),null);
 const changed=await f.invoke('update',{id:item.id,revision:item.revision,metadata:{visibility:'authenticated',tags:['picture']}});assert.equal(changed.ok,true);
 const document=await source.resolve('media-index',item.id,f.caller);assert.equal(document.body,'Fixture');assert.deepEqual(document.categories,['picture']);assert.equal(document.allowed,true);
 assert.equal(await source.resolve('media-index',item.id,f.context({identity:null})),null);assert.equal(await source.resolve('media-index',item.id,f.context({capabilities:[]})),null);
 assert.doesNotMatch(JSON.stringify(document),/token|root|file:|data:/);
});
test('metadata writes and deletion require exact user, installation, package and principal ownership',async t=>{
 const f=await mediaFixture(t),item=await upload(f);
 for(const extra of [{principal:'foreign'},{package:'foreign/package'},{installation:'foreign-installation'},{identity:{...f.identity,userId:'other-user'}},{identity:null}]){
  const caller=f.context(extra);
  assert.equal((await f.invoke('update',{id:item.id,revision:item.revision,metadata:{visibility:'public'}},caller)).code,'STREAM.DENIED');
  assert.equal((await f.invoke('delete',{id:item.id,revision:item.revision},caller)).code,'STREAM.DENIED');
  assert.equal((await f.invoke('list',{},caller)).value.total,0);
 }
 assert.equal((await f.libraries.bindPresentation(f.caller).invoke('wydstream','1.0.0','create-upload',{resource:'media'})).code,'SERVICE.OPERATION_UNKNOWN');
 const limited=f.context({limits:{serviceResponseBytes:1}});
 assert.equal((await f.invoke('update',{id:item.id,revision:item.revision,metadata:{title:'Should not persist'}},limited)).code,'STREAM.LIMIT');assert.equal((await f.invoke('get',{id:item.id})).value.title,'A picture');
 assert.equal((await f.invoke('create-upload',{},limited)).code,'STREAM.LIMIT');
 assert.equal((await f.invoke('delete',{id:item.id,revision:item.revision})).ok,true);assert.equal((await f.invoke('get',{id:item.id})).code,'STREAM.NOT_FOUND');
});

test('concurrent binary uploads preserve hashes across ledger transaction retries',async t=>{
 const f=await mediaFixture(t),items=await Promise.all([upload(f),upload(f)]);assert.equal(items.length,2);assert.notEqual(items[0].id,items[1].id);assert.equal(items[0].hash,items[1].hash);assert.equal((await f.invoke('list')).value.total,2);
});
test('canonical upload tickets bind detached binary completion to session, owner and resource limits',async t=>{
 const f=await mediaFixture(t),ticket=await f.invoke('create-upload',{maxBytes:100,categories:['image']});assert.equal(ticket.ok,true);
 const input={resource:'media',id:ticket.value.id,token:ticket.value.token};
 await assert.rejects(f.libraries.transfer(f.context({identity:{...f.identity,sessionId:'different-session'}}),'wydstream','complete-upload',input,body()),{code:'STREAM.DENIED'});
 const result=JSON.parse((await f.libraries.transfer(f.caller,'wydstream','complete-upload',input,body())).body);assert.equal(result.value.id,ticket.value.id);assert.equal(result.value.state,'ready');
 await assert.rejects(f.libraries.transfer(f.caller,'wydstream','complete-upload',input,body()),{code:'STREAM.STATE'});
});
