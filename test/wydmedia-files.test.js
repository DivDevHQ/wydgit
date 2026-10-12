import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {initializeHost} from '../wydgine/host.js';
import {localProvider} from '../packages/wydfiles/src/local.js';
import {s3Provider} from '../packages/wydfiles/src/s3.js';
import {simulatedS3} from '../test-support/s3.js';
import {mediaFixture,png} from '../test-support/wydstream.js';
const port=(bytes=png,size=bytes.length)=>{const form=new FormData();form.append('file',new Blob([bytes]),'../image.png');const r=new Request('http://localhost',{method:'POST',body:form});return {method:'POST',body:r.body,headers:{type:r.headers.get('content-type'),encoding:'identity',fileSize:String(size)},authorize:async()=>{}};};
for(const adapter of ['JSON','SQLite'])test(`${adapter}: WydFiles media publication, scoped streaming, gallery, deletion and limits`,async t=>{
 const f=await mediaFixture(t,adapter,true,true);
 const upload=async(bytes=png,size=bytes.length)=>JSON.parse((await f.libraries.transfer(f.caller,'wydstream','create-upload',{resource:'media'},port(bytes,size))).body).value;
 const pending=await f.invoke('create-upload');assert.ok(pending.ok);assert.equal((await f.invoke('list')).value.total,0);assert.equal((await f.invoke('get',{id:pending.value.id})).code,'STREAM.DENIED');
 const second=await f.invoke('create-upload');assert.ok(second.ok);assert.equal((await f.invoke('create-upload')).code,'STREAM.LIMIT');
 // Expire only these reservations through an authorized metadata write for bounded repair.
 const {ExecutionContext}=await import('../wydgine/seam/context.js');const settings=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'))).libraries.find(l=>l.id==='wydstream').options.apps[0];
 const storeCaller=new ExecutionContext({app:f.caller.app,publisher:'wydgit.core',package:'library:wydstream',self:'library-wydstream',capabilities:['store.records.read','store.records.write'],scopes:{wydstore:[{store:settings.store,collection:settings.collection}]}});
 const store=f.libraries.bind(storeCaller),saved=await store.invoke('wydstore','1.0.0','get',{store:settings.store,collection:settings.collection,id:'media-ledger'});const data=structuredClone(saved.value.data);data.items.forEach(i=>i.expiresAt=0);
 assert.ok((await store.invoke('wydstore','1.0.0','transaction',{store:settings.store,collection:settings.collection,operations:[{operation:'update',input:{id:'media-ledger',version:saved.value.version,data}}]})).ok);
 assert.ok((await f.invoke('reconcile',{},f.context({principal:'host:media-repair',capabilities:['stream.media.repair']}))).ok);
 const item=await upload();assert.equal(item.size,png.length);assert.equal(item.mime,'image/png');
 const config=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json')));
 assert.ok(config.libraries.find(l=>l.id==='wydstream').options.apps[0].storagePath==='/media');
 const mount=config.libraries.find(l=>l.id==='wydfiles').options.apps[0].mounts[0];assert.equal((await fs.readdir(mount.root)).length,1);
 assert.equal((await f.libraries.bind(f.caller).invoke('wydfiles','1.0.0','stat',{path:'/media/assets/'+item.id})).code,'SEAM.DENIED');
 const rawCaller=f.context({capabilities:['files.storage.read'],scopes:{wydfiles:[{path:'/media/assets'}]}});assert.equal((await f.libraries.bind(rawCaller).invoke('wydfiles','1.0.0','stat',{path:'/media/assets/'+item.id})).code,'FILES.DENIED');
 for(const extra of [{principal:'other'},{installation:'other'},{package:'other/pkg'},{identity:null},{app:'other',identity:null}])assert.equal((await f.invoke('get',{id:item.id},f.context(extra))).ok,false);
 const delivery=async(headers={},method='GET',caller=f.caller)=>f.libraries.transfer(caller,'wydstream','get-delivery',{resource:'media',id:item.id},{method,headers,authorize:async()=>{}});
 const r=await delivery({range:'bytes=2-8'});assert.equal(r.status,206);assert.equal(r.headers['Content-Range'],`bytes 2-8/${png.length}`);const chunks=[];for await(const c of r.stream)chunks.push(c);await r.close();assert.deepEqual(Buffer.concat(chunks),png.subarray(2,9));
 assert.equal((await delivery({},'HEAD')).headers['Content-Length'],String(png.length));assert.equal((await delivery({range:'bytes=9000-'})).status,416);
 await assert.rejects(upload(png,png.length+1));await assert.rejects(upload(png,png.length-1));assert.equal((await f.invoke('list')).value.total,1);
 await assert.rejects(f.libraries.transfer(f.context({limits:{filesFileBytes:2}}),'wydstream','create-upload',{resource:'media'},port()));
 await assert.rejects(f.libraries.transfer(f.context({limits:{filesQuotaBytes:png.length}}),'wydstream','create-upload',{resource:'media'},port()),{code:'STREAM.QUOTA'});
 const later=await upload();assert.deepEqual((await f.invoke('list',{offset:0,limit:1})).value.items.map(i=>i.id),[later.id]);assert.equal((await f.invoke('list',{offset:1,limit:1})).value.items[0].id,item.id);assert.equal((await f.invoke('list',{type:'audio'})).value.total,0);
 const changed=await f.invoke('update',{id:item.id,revision:item.revision,metadata:{visibility:'public'}});assert.ok(changed.ok);
 const anonymous=await delivery({},'GET',f.context({identity:null}));for await(const c of anonymous.stream){}await anonymous.close();
 assert.ok((await f.invoke('delete',{id:item.id,revision:changed.value.revision})).ok);assert.ok((await f.invoke('delete',{id:later.id,revision:later.revision})).ok);assert.equal((await fs.readdir(mount.root)).length,0);
});

for(const metadata of ['JSON','SQLite'])test(`${metadata}: media through signed simulated S3, range corruption, missing objects and cleanup`,async t=>{
 const f=await mediaFixture(t,metadata,true,true),double=simulatedS3();
 const filename=path.join(f.root,'wydgit.config.json'),config=JSON.parse(await fs.readFile(filename));
 const mount=config.libraries.find(l=>l.id==='wydfiles').options.apps[0].mounts[0];delete mount.root;Object.assign(mount,{provider:'s3',endpoint:'https://storage.example',bucket:'media-test',namespace:'app-media',region:'us-east-1',credentials:{accessKeyId:'test-key',secretAccessKey:'test-secret'}});
 await fs.writeFile(filename,JSON.stringify(config));let corrupt=false,deleteFailure=false;
 const request=async(url,o)=>{if(deleteFailure&&o.method==='DELETE')return new Response('',{status:503});const response=await double.request(url,o);if(corrupt&&o.headers.Range){return new Response((corrupt==='oversized'?png:png.subarray(0,2)),{status:206,headers:response.headers});}return response;};
 f.libraries=await initializeHost({root:f.root,adapters:{wydfiles:{provider:(m,l)=>s3Provider(m,l,request)}}});
 const invoke=(op,input={},caller=f.editor)=>f.libraries.bind(caller).invoke('wydstream','1.0.0',op,{resource:'media',...input});
 const item=JSON.parse((await f.libraries.transfer(f.caller,'wydstream','create-upload',{resource:'media'},port())).body).value;
 assert.equal(double.objects.size,1);assert.equal((await invoke('list')).value.total,1);assert.match(double.calls.find(c=>c.method==='PUT').headers.Authorization,/AWS4-HMAC-SHA256/);
 const delivery=()=>f.libraries.transfer(f.caller,'wydstream','get-delivery',{resource:'media',id:item.id},{method:'GET',headers:{range:'bytes=0-8'},authorize:async()=>{}});
 const opened=await delivery();const chunks=[];for await(const c of opened.stream)chunks.push(c);await opened.close();assert.deepEqual(Buffer.concat(chunks),png.subarray(0,9));
 corrupt=true;const truncated=await delivery();await assert.rejects(async()=>{for await(const c of truncated.stream){} });await truncated.close();corrupt='oversized';const oversized=await delivery();await assert.rejects(async()=>{for await(const c of oversized.stream){} });await oversized.close();corrupt=false;
 const cancelled=await delivery();cancelled.stream.destroy();await cancelled.close();const next=await delivery();for await(const c of next.stream){}await next.close();
 deleteFailure=true;assert.equal((await invoke('delete',{id:item.id,revision:item.revision})).ok,false);assert.equal((await invoke('list')).value.total,0);deleteFailure=false;
 const repair=f.context({principal:'host:media-repair',capabilities:['stream.media.repair']});assert.equal((await invoke('reconcile',{},repair)).ok,true);assert.equal(double.objects.size,0);
 const missing=JSON.parse((await f.libraries.transfer(f.caller,'wydstream','create-upload',{resource:'media'},port())).body).value;double.objects.clear();assert.equal((await invoke('reconcile',{},repair)).ok,true);assert.equal((await invoke('get',{id:missing.id})).code,'STREAM.DENIED');
});

for(const adapter of ['JSON','SQLite'])test(`${adapter}: storage publication followed by metadata outage remains hidden and bounded repair removes bytes`,async t=>{
 const f=await mediaFixture(t,adapter,true,true),filename=path.join(f.root,'wydgit.config.json'),config=JSON.parse(await fs.readFile(filename));
 const stream=config.libraries.find(l=>l.id==='wydstream');stream.options.limits={retentionMs:1000};
 const metadata=config.libraries.find(l=>l.id==='wydstore').options.stores.find(s=>s.id===stream.options.apps[0].store).root,saved=metadata+'-saved';
 await fs.writeFile(filename,JSON.stringify(config));let outage=true;
 const registry=await initializeHost({root:f.root,adapters:{wydfiles:{provider:async m=>{const provider=await localProvider(m.root);return {...provider,write:async(...args)=>{await provider.write(...args);if(outage){outage=false;await fs.rename(metadata,saved);}}};}}}});
 await assert.rejects(registry.transfer(f.caller,'wydstream','create-upload',{resource:'media'},port()));await fs.rename(saved,metadata);
 const invoke=(op,caller=f.editor)=>registry.bind(caller).invoke('wydstream','1.0.0',op,{resource:'media'});
 assert.equal((await invoke('list')).value.total,0);await new Promise(resolve=>setTimeout(resolve,1100));
 const repair=f.context({principal:'host:media-repair',capabilities:['stream.media.repair']});assert.equal((await invoke('reconcile',repair)).value.changed,1);
 const mount=config.libraries.find(l=>l.id==='wydfiles').options.apps[0].mounts[0];assert.deepEqual(await fs.readdir(mount.root),[]);assert.equal((await invoke('reconcile',repair)).value.changed,0);
});

test('independent App registries isolate bytes and metadata even with identical package identities',async t=>{
 const a=await mediaFixture(t,'JSON',true,true),b=await mediaFixture(t,'JSON',true,true);
 const send=async f=>JSON.parse((await f.libraries.transfer(f.caller,'wydstream','create-upload',{resource:'media'},port())).body).value;
 const first=await send(a),second=await send(b);assert.notEqual(first.id,second.id);
 assert.equal((await a.invoke('get',{id:second.id})).code,'STREAM.DENIED');assert.equal((await b.invoke('get',{id:first.id})).code,'STREAM.DENIED');
 assert.deepEqual((await a.invoke('list')).value.items.map(i=>i.id),[first.id]);assert.deepEqual((await b.invoke('list')).value.items.map(i=>i.id),[second.id]);
 const file=path.join(a.root,'wydgit.config.json'),config=JSON.parse(await fs.readFile(file));config.libraries.find(l=>l.id==='wydstream').bindings.find(v=>v.library==='wydfiles').app='other-app';await fs.writeFile(file,JSON.stringify(config));await assert.rejects(initializeHost({root:a.root}),{code:'STREAM.INVALID_CONFIG'});
});
