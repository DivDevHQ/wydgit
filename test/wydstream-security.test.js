import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mediaFixture,png } from '../test-support/wydstream.js';
import { initializeHost } from '../wydgine/host.js';
import { localProvider } from '../packages/wydstream/src/local-provider.js';
import { validatePresentation,renderComponent } from '../wydgine/components.js';
const form=(bytes=png)=>{const f=new FormData();f.append('file',new Blob([bytes]),'untrusted.php');const req=new Request('http://localhost',{method:'POST',body:f});return {method:'POST',body:req.body,headers:{type:req.headers.get('content-type'),encoding:'identity'},authorize:async()=>{}};};
const send=async(f,registry=f.libraries,input={})=>JSON.parse((await registry.transfer(f.caller,'wydstream','create-upload',{resource:'media',...input},form())).body).value;
const config=async f=>JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'))).libraries.find(l=>l.id==='wydstream').options.apps[0];
const repair=(f,registry=f.libraries)=>registry.bind(f.context({principal:'host:media-repair',capabilities:['stream.media.repair']})).invoke('wydstream','1.0.0','reconcile',{resource:'media'});
for(const provider of ['JSON','SQLite'])test(`${provider}: atomic finalization/deletion failures are recoverable, idempotent and scoped`,async t=>{
 const f=await mediaFixture(t,provider),settings=await config(f),storage=await localProvider(settings.root);
 let fail=true;
 const interrupted=await initializeHost({root:f.root,adapters:{wydstream:{provider:async()=>({...storage,finalize:async id=>{if(fail){fail=false;throw new Error('injected finalization');}return storage.finalize(id);}})}}});
 await assert.rejects(send(f,interrupted));assert.equal((await f.invoke('list')).value.total,0);
 assert.equal((await repair(f)).value.changed,1);assert.equal((await repair(f)).value.changed,0);
 const item=(await f.invoke('list')).value.items[0];assert.equal(item.size,png.length);
 let failure=true;
 const deleting=await initializeHost({root:f.root,adapters:{wydstream:{provider:async()=>({...storage,remove:async(id,staging)=>{if(!staging&&failure){failure=false;throw new Error('injected delete');}return storage.remove(id,staging);}})}}});
 const deleted=await deleting.bind(f.editor).invoke('wydstream','1.0.0','delete',{resource:'media',id:item.id,revision:item.revision});assert.equal(deleted.ok,false);
 assert.equal((await f.invoke('get',{id:item.id})).code,'STREAM.DENIED');assert.equal((await repair(f)).value.changed,1);assert.equal((await repair(f)).value.changed,0);
 await fs.writeFile(path.join(settings.root,'m-'+ 'f'.repeat(32)+'.bin'),png);assert.equal((await repair(f)).value.changed,1);
});
test('local provider denies traversal, symlinks, hard links and overwrite; no raw paths cross canonical boundary',async t=>{
 const f=await mediaFixture(t),item=await send(f),settings=await config(f),provider=await localProvider(settings.root),outside=path.join(f.root,'outside');await fs.writeFile(outside,'SECRET');
 await assert.rejects(provider.read('../outside'));const staged=await provider.stage(item.id);await staged.close();await assert.rejects(provider.finalize(item.id));await provider.remove(item.id,true);assert.deepEqual(await fs.readFile(path.join(settings.root,item.id+'.bin')),png);
});
test('finalized object symlinks and hardlinks cannot disclose outside bytes',async t=>{
 const f=await mediaFixture(t),item=await send(f),settings=await config(f),destination=path.join(settings.root,item.id+'.bin'),outside=path.join(f.root,'outside');await fs.writeFile(outside,'SECRET');await fs.unlink(destination);await fs.symlink(outside,destination);
 const port={method:'GET',headers:{},authorize:async()=>{}};
 await assert.rejects(f.libraries.transfer(f.caller,'wydstream','get-delivery',{resource:'media',id:item.id},port));await fs.unlink(destination);await fs.link(outside,destination);await assert.rejects(f.libraries.transfer(f.caller,'wydstream','get-delivery',{resource:'media',id:item.id},port));
 await assert.rejects(localProvider(path.join(f.root,'linked-media')).then(()=>{}));await fs.symlink(settings.root,path.join(f.root,'linked-media'));await assert.rejects(localProvider(path.join(f.root,'linked-media')));
 assert.equal(await fs.readFile(outside,'utf8'),'SECRET');
});
test('quota reservations, upload concurrency, reduced caller limits, timeout and interrupted input remain bounded',async t=>{
 const f=await mediaFixture(t),file=path.join(f.root,'wydgit.config.json'),host=JSON.parse(await fs.readFile(file));host.libraries.find(l=>l.id==='wydstream').options.limits={fileBytes:100,quotaBytes:150,stagingBytes:150,uploads:2,durationMs:10,retentionMs:1};await fs.writeFile(file,JSON.stringify(host));const registry=await initializeHost({root:f.root});
 const call=(name,input={},caller=f.caller)=>registry.bind(caller).invoke('wydstream','1.0.0',name,{resource:'media',...input});
 assert.equal((await call('create-upload',{maxBytes:100})).ok,true);assert.equal((await call('create-upload',{maxBytes:100})).code,'STREAM.QUOTA');await new Promise(resolve=>setTimeout(resolve,5));await repair(f,registry);
 const limited=f.context({limits:{mediaFileBytes:10}});await assert.rejects(registry.transfer(limited,'wydstream','create-upload',{resource:'media'},form()));
 const broken=new ReadableStream({start(controller){controller.enqueue(Buffer.from('--boundary\r\nContent-Disposition: form-data; name="file"; filename="x"\r\n\r\npartial'));controller.error(new Error('Disconnected'));}});
 await assert.rejects(registry.transfer(f.caller,'wydstream','create-upload',{resource:'media'},{method:'POST',headers:{type:'multipart/form-data; boundary=boundary',encoding:'identity'},body:broken,authorize:async()=>{}}));
 const slow=new ReadableStream({start(controller){controller.enqueue(Buffer.from('--boundary\r\nContent-Disposition: form-data; name="file"; filename="x"\r\n\r\npartial'));}});
 await assert.rejects(registry.transfer(f.caller,'wydstream','create-upload',{resource:'media'},{method:'POST',headers:{type:'multipart/form-data; boundary=boundary',encoding:'identity'},body:slow,authorize:async()=>{}}));
});
test('media elements cannot contain executable markup or unsafe URLs; write submissions do not change read bindings',()=>{
 for(const src of ['javascript:alert(1)','data:image/svg+xml,evil','//outside.test/a','/x%2fy']){const spec=validatePresentation({schema:'wydgit.presentation/0.1',template:{tag:'video',attrs:{src,controls:true}}});assert.throws(()=>renderComponent({id:'safe',presentation:spec},{}, {},'/',x=>x));}
 assert.throws(()=>validatePresentation({schema:'wydgit.presentation/0.1',template:{tag:'video',attrs:{onerror:'evil'}}}));assert.throws(()=>validatePresentation({schema:'wydgit.presentation/0.1',template:{tag:'script'}}));
});
for(const provider of ['JSON','SQLite'])test(`${provider}: metadata unavailable after binary publication recovers from committed intent`,async t=>{
 const f=await mediaFixture(t,provider),settings=await config(f),storage=await localProvider(settings.root),document=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'))),metadataRoot=document.libraries.find(l=>l.id==='wydstore').options.stores.find(s=>s.id===settings.store).root,saved=metadataRoot+'-saved';
 const registry=await initializeHost({root:f.root,adapters:{wydstream:{provider:async()=>({...storage,finalize:async id=>{await storage.finalize(id);await fs.rename(metadataRoot,saved);}})}}});
 await assert.rejects(send(f,registry));
 await fs.rename(saved,metadataRoot);assert.equal((await f.invoke('list')).value.total,0);assert.equal((await repair(f)).value.changed,1);assert.equal((await f.invoke('list')).value.total,1);assert.equal((await repair(f)).value.changed,0);
});
test('host policy validation rejects category/limit escalation before activation',async t=>{
 const f=await mediaFixture(t),file=path.join(f.root,'wydgit.config.json'),original=JSON.parse(await fs.readFile(file));
 for(const change of [c=>c.options.limits={fileBytes:65*1024*1024},c=>c.options.apps[0].categories=['unsafe'],c=>c.options.apps[0].root=path.join(f.root,'public')]){
  const config=structuredClone(original);change(config.libraries.find(l=>l.id==='wydstream'));await fs.writeFile(file,JSON.stringify(config));await assert.rejects(initializeHost({root:f.root}));
 }
 await fs.writeFile(file,JSON.stringify(original));
});
test('generic transfer output keeps host security headers and cookies locked and bounds metadata',async()=>{
 const {sendTransfer}=await import('../wydgine/http/transfers.js');const headers=new Map([['Content-Security-Policy','locked']]);const output={setHeader:(k,v)=>headers.set(k,v),end:()=>{}};
 await sendTransfer({headers:{'Content-Security-Policy':'unsafe','Set-Cookie':'forged','Content-Type':'text/plain'},body:'ok'},output,'GET');assert.equal(headers.get('Content-Security-Policy'),'locked');assert.equal(headers.has('Set-Cookie'),false);assert.equal(headers.get('Content-Type'),'text/plain');
 await assert.rejects(sendTransfer({body:'x'.repeat(65537)},output,'GET'),{code:'TRANSFER.LIMIT'});
});
test('repair completes publication interrupted between exclusive link and staging unlink',async t=>{
 const f=await mediaFixture(t),settings=await config(f),storage=await localProvider(settings.root);
 const registry=await initializeHost({root:f.root,adapters:{wydstream:{provider:async()=>({...storage,finalize:async id=>{await fs.link(path.join(settings.root,id+'.part'),path.join(settings.root,id+'.bin'));throw new Error('interrupted unlink');}})}}});
 await assert.rejects(send(f,registry));assert.equal((await f.invoke('list')).value.total,0);
 assert.equal((await repair(f)).value.changed,1);assert.equal((await repair(f)).value.changed,0);assert.equal((await f.invoke('list')).value.total,1);
 const names=await fs.readdir(settings.root);assert.equal(names.filter(n=>n.endsWith('.part')).length,0);
});
test('submission tokens bind App, Page, component, version and operation without exposing the session secret',async()=>{
 const {submissionToken}=await import('../wydgine/http/submission-authority.js'),secret='a'.repeat(64),binding={library:'wydstream',apiVersion:'1.0.0',operation:'create-upload'},token=submissionToken(secret,'app','page','upload',binding);
 assert.match(token,/^[a-f0-9]{64}$/);assert.notEqual(token,secret);
 for(const args of [['other','page','upload',binding],['app','other','upload',binding],['app','page','other',binding],['app','page','upload',{...binding,operation:'delete'}],['app','page','upload',{...binding,apiVersion:'2.0.0'}]])assert.notEqual(submissionToken(secret,...args),token);
 const presentation=validatePresentation({schema:'wydgit.presentation/0.1',submission:binding,template:{tag:'form',attrs:{method:'post',action:'/other-component'}}});assert.throws(()=>renderComponent({id:'evil',presentation},{},{},'/',x=>x,'',()=>{},undefined,{path:'/own-component',csrf:token}));
});
test('pending tickets cannot bypass lower current host/caller file ceilings after restart',async t=>{
 const f=await mediaFixture(t),ticket=await f.invoke('create-upload',{maxBytes:100}),file=path.join(f.root,'wydgit.config.json'),host=JSON.parse(await fs.readFile(file));assert.equal(ticket.ok,true);
 host.libraries.find(l=>l.id==='wydstream').options.limits={fileBytes:10};await fs.writeFile(file,JSON.stringify(host));const restarted=await initializeHost({root:f.root});
 await assert.rejects(restarted.transfer(f.caller,'wydstream','complete-upload',{resource:'media',id:ticket.value.id,token:ticket.value.token},form()),{code:'STREAM.LIMIT'});
 assert.equal((await f.invoke('list')).value.total,0);assert.equal((await repair(f,restarted)).value.changed,0);
});
test('ZIP containers remain opaque attachments and never inflate compressed MIME metadata',async t=>{
 const {deflateRawSync}=await import('node:zlib'),f=await mediaFixture(t),name=Buffer.from('[Content_Types].xml'),compressed=deflateRawSync(Buffer.from('x'.repeat(1024*1024))),header=Buffer.alloc(30);
 header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(8,8);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(1024*1024,22);header.writeUInt16LE(name.length,26);const zip=Buffer.concat([header,name,compressed]);
 const result=JSON.parse((await f.libraries.transfer(f.caller,'wydstream','create-upload',{resource:'media'},form(zip))).body).value;assert.equal(result.mime,'application/zip');assert.equal(result.type,'file');assert.equal(result.size,zip.length);
 const delivery=await f.libraries.transfer(f.caller,'wydstream','get-delivery',{resource:'media',id:result.id},{method:'HEAD',headers:{},authorize:async()=>{}});assert.match(delivery.headers['Content-Disposition'],/^attachment;/);
});
