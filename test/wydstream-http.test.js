import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { load as html } from 'cheerio';
import { mediaFixture,png } from '../test-support/wydstream.js';
import { loadRepository } from '../wydgine/repository.js';
import { createHostApp } from '../app.js';
import { applyOperatorInstall } from '../scripts/package-infrastructure.js';
const start=async(f,t)=>{const app=await createHostApp({root:f.root,execution:{gateContext:f.gateContext}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});return {app,server,base:'http://127.0.0.1:'+server.address().port};};
for(const provider of ['JSON','SQLite'])test(`${provider}: existing App installs media, authenticated form uploads, Gallery/Player, HTTP ranges and restart`,async t=>{
 const f=await mediaFixture(t,provider,false),before=await fs.readFile(path.join(f.root,'content/pages/home.json'),'utf8');
 const appFile=path.join(f.root,'content/app.json'),document=JSON.parse(await fs.readFile(appFile));document.properties.themeMode=provider==='JSON'?'light':'dark';await fs.writeFile(appFile,JSON.stringify(document));
 await applyOperatorInstall(await f.plan());
 const {initializeHost}=await import('../wydgine/host.js'),{createGate}=await import('@wydgit/gate/client'),{ExecutionContext}=await import('../wydgine/seam/context.js');
 f.libraries=await initializeHost({root:f.root});f.gateContext=new ExecutionContext({publisher:'host',package:'host:gate',app:'boilerplate',self:'home',capabilities:['gate.users.create','gate.credentials.authenticate','gate.sessions.use','gate.sessions.manage'],scopes:{wydgate:['boilerplate']}});f.gate=createGate(f.libraries.bind(f.gateContext));await f.gate.createUser({username:'alice',password:'long media fixture passphrase'});const login=await f.gate.login('alice','long media fixture passphrase');f.token=login.token;
 const model=loadRepository(f.root);for(const name of ['upload','player','gallery'])assert.equal(model.registry.get('divdev/media-'+name).public,true);
 assert.equal(await fs.readFile(path.join(f.root,'content/pages/home.json'),'utf8'),before);assert.ok(model.runtime.get('home').slots.sections.length>1);
 const host=await start(f,t),headers={Cookie:'__Host-wydgit-auth='+f.token};
 const page=await fetch(host.base+'/',{headers}),text=await page.text(),view=html(text);assert.equal(page.status,200,text);assert.equal(view('html').attr('data-wyd-theme'),document.properties.themeMode);
 const form=view('#wydmedia-upload');assert.equal(form.attr('method'),'post');assert.equal(form.attr('enctype'),'multipart/form-data');assert.ok(form.find('input[type=file]').length);const action=form.attr('action');assert.ok(action?.includes('_csrf='),text);
 const uploadForm=new FormData();uploadForm.append('file',new Blob([png],{type:'text/html'}),'../../execute.js');uploadForm.append('title','HTTP image');uploadForm.append('description','Original content is preserved');
 const denied=await fetch(host.base+action,{method:'POST',body:uploadForm});assert.equal(denied.status,403);
 const bypass=await fetch(host.base+action.replace('wydstream/create-upload','wydstore/update'),{headers,method:'POST',body:uploadForm});assert.equal(bypass.status,403);
 const forged=await fetch(host.base+action.replace(/_csrf=[^&]*/,'_csrf=forged'),{headers,method:'POST',body:uploadForm});assert.equal(forged.status,403);
 const response=await fetch(host.base+action,{headers,method:'POST',body:uploadForm}),uploaded=await response.json();assert.equal(response.status,200,JSON.stringify(uploaded));const item=uploaded.value;assert.equal(item.mime,'image/png');assert.equal(item.title,'HTTP image');
 const listing=html(await(await fetch(host.base+'/',{headers})).text());assert.match(listing('#wydmedia-gallery').text(),/HTTP image/);const delivery=listing('#wydmedia-gallery a').filter((i,e)=>html(e).text()==='HTTP image').attr('href');assert.ok(delivery);
 const player=html(await(await fetch(host.base+'/?media='+item.id,{headers})).text());assert.equal(player('#wydmedia-player img').length,1);assert.ok(player('#wydmedia-player a').attr('href'));
 for(const method of ['GET','HEAD'])for(const extra of [{},{Range:'bytes=0-3'},{'If-None-Match':'"'+item.hash+'"'}]){const denied=await fetch(host.base+delivery,{method,headers:extra});assert.equal(denied.status,403);assert.equal(denied.headers.get('content-range'),null);assert.equal(denied.headers.get('etag'),null);}
 const delivered=await fetch(host.base+delivery,{headers});assert.equal(delivered.status,200);assert.equal(delivered.headers.get('cache-control'),'private, no-store');assert.equal(delivered.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await delivered.arrayBuffer()),png);
 for(const [range,start,end] of [['bytes=0-3',0,3],['bytes=4-',4,png.length-1],['bytes=-4',png.length-4,png.length-1]]){const part=await fetch(host.base+delivery,{headers:{...headers,Range:range}});assert.equal(part.status,206);assert.equal(part.headers.get('content-range'),`bytes ${start}-${end}/${png.length}`);assert.deepEqual(Buffer.from(await part.arrayBuffer()),png.subarray(start,end+1));}
 for(const range of ['bytes=9999-','bytes=0-1,4-5','bytes=-0','bytes=4-1','garbage']){const invalid=await fetch(host.base+delivery,{headers:{...headers,Range:range}});assert.equal(invalid.status,416);assert.equal(invalid.headers.get('content-range'),'bytes */'+png.length);}
 const head=await fetch(host.base+delivery,{method:'HEAD',headers});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(png.length));assert.equal((await head.text()).length,0);
 const conditional=await fetch(host.base+delivery,{headers:{...headers,'If-None-Match':'"'+item.hash+'"'}});assert.equal(conditional.status,304);
 for(const [filename,type,tag] of [['tone.wav','audio','audio'],['black.mp4','video','video']]){
  const bytes=await fs.readFile(new URL('../test-support/media/'+filename,import.meta.url)),form=new FormData();form.append('file',new Blob([bytes]),'spoofed.txt');
  const uploaded=await (await fetch(host.base+action,{headers,method:'POST',body:form})).json();assert.equal(uploaded.value.type,type);
  const player=html(await(await fetch(host.base+'/?media='+uploaded.value.id,{headers})).text());const element=player('#wydmedia-player '+tag);assert.equal(element.length,1);assert.ok(Object.hasOwn(element[0].attribs,'controls'));
  const part=await fetch(host.base+element.attr('src'),{headers:{...headers,Range:'bytes=0-15'}});assert.equal(part.status,206);assert.deepEqual(Buffer.from(await part.arrayBuffer()),bytes.subarray(0,16));
 }
 const {activatePackages}=await import('../wydgine/packages/index.js'),identity=await f.gate.resolveSession(f.token),caller=activatePackages(loadRepository(f.root),f.libraries,f.root).context({pageId:'home',session:{identity},ids:[]}),writer=new ExecutionContext({...caller,capabilities:[...caller.capabilities,'stream.media.write']});
 const change=visibility=>f.libraries.bind(writer).invoke('wydstream','1.0.0','update',{resource:'media',id:item.id,revision:currentRevision,metadata:{visibility}});let currentRevision=item.revision;
 const madePublic=await change('public');assert.equal(madePublic.ok,true);currentRevision=madePublic.value.revision;
 const publicFirst=await fetch(host.base+delivery);assert.equal(publicFirst.status,200);assert.equal(publicFirst.headers.get('cache-control'),'private, no-store');const anonymousCookie=publicFirst.headers.get('set-cookie').split(';')[0];await publicFirst.arrayBuffer();
 const publicCached=await fetch(host.base+delivery,{headers:{Cookie:anonymousCookie}});assert.equal(publicCached.status,200);assert.equal(publicCached.headers.get('cache-control'),'public, max-age=0, must-revalidate');await publicCached.arrayBuffer();
 const madePrivate=await change('private');assert.equal(madePrivate.ok,true);assert.equal((await fetch(host.base+delivery,{headers:{Cookie:anonymousCookie,Range:'bytes=0-3'}})).status,403);
 const browserForm=new FormData();browserForm.append('file',new Blob([png]),'browser.png');const feedback=await fetch(host.base+action,{headers:{...headers,Accept:'text/html'},method:'POST',body:browserForm});assert.equal(feedback.status,200);assert.match(await feedback.text(),/role="status"/);
 await host.app.shutdown(host.server);const restarted=await start(f,t),persisted=await fetch(restarted.base+delivery,{headers});assert.equal(persisted.status,200);assert.deepEqual(Buffer.from(await persisted.arrayBuffer()),png);
 await f.gate.logout(f.token);assert.equal((await fetch(restarted.base+delivery,{headers})).status,403);
});
for(const hook of ['beforeProviderSetup','beforeConfigReplace','beforeStateReplace'])test(`media installation ${hook} rollback preserves App and removes metadata/binary roots`,async t=>{
 const f=await mediaFixture(t,'JSON',false),before=await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8');
 await assert.rejects(applyOperatorInstall(await f.plan(),{[hook]:()=>{throw new Error('injected failure');}}),/injected failure/);
 assert.equal(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8'),before);assert.ok(!loadRepository(f.root).runtime.has?.('wydmedia'));
 for(const location of ['media-metadata','media-binary'])await assert.rejects(fs.stat(path.join(f.root,'.wydgit-data',location)),{code:'ENOENT'});
});
