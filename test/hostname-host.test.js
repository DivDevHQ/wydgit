import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {provisionHostnameExample} from '../examples/hostname-host/setup.js';
import {createMultiAppHost} from '../wydgine/multi-app.js';
export function get(server,host,url='/',options={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:url,...options,headers:{Host:host,...options.headers}},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.end(options.body);});}
async function fixture(t,options={}){const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-hostname-'));let host,expectedCleanupFailure=false;t.after(async()=>{try{await host?.dispose();}catch(error){if(!expectedCleanupFailure||error.code!=='HOST.CLEANUP')throw error;}finally{await fs.rm(root,{recursive:true,force:true});}});const config=await provisionHostnameExample(root);return {root,config,expectCleanupFailure(){expectedCleanupFailure=true;},async start(extra={}){host=await createMultiAppHost(config,{root,...options,...extra});const tokens=await Promise.all(config.apps.map(a=>host.activate(a.id)));const server=await host.listenShared(0,'127.0.0.1');return {host,tokens,server};}};}
test('shared native HTTP listener routes two Apps and ordinary sessionless parking pages before auth/assets',async t=>{
 const f=await fixture(t),{host,server,tokens}=await f.start();
 const [a,b]=await Promise.all([get(server,'ALPHA.LOCALHOST.'),get(server,'beta.localhost')]);assert.equal(a.status,200,a.body);assert.equal(b.status,200,b.body);assert.equal(a.headers['referrer-policy'],'same-origin');assert.match(a.body,/Home app-alpha/);assert.match(b.body,/Home app-beta/);assert.match((await get(server,'alpha.localhost','/?app=app-beta&hostname=beta.localhost')).body,/Home app-alpha/);
 assert.match(a.headers['set-cookie'][0],/^wydgit-session=.*Path=\/; HttpOnly; SameSite=Lax$/);assert.doesNotMatch(a.headers['set-cookie'][0],/Domain|Secure/);
 const replay=await get(server,'beta.localhost','/',{headers:{Cookie:a.headers['set-cookie'][0].split(';')[0]}});assert.notEqual(replay.headers['set-cookie'][0],a.headers['set-cookie'][0]);
 const cssA=await get(server,'alpha.localhost','/css/site.css'),cssB=await get(server,'beta.localhost','/css/site.css');assert.match(cssA.body,/App asset: app-alpha/);assert.match(cssB.body,/App asset: app-beta/);
 for(const [name,title] of [['soon.localhost','Coming Soon'],['parked.localhost','Parked'],['new.sites.example.localhost','Parked']]){const r=await get(server,name,'/',{headers:{Cookie:'__Host-wydgit-auth=foreign; wydgit-auth=foreign'}});assert.equal(r.status,200,r.body);assert.match(r.body,new RegExp(title));assert.equal(r.headers['set-cookie'],undefined);assert.equal(r.headers['cache-control'],'no-store');}
 for(const name of ['foreign.test','evil-sites.example.localhost'])assert.equal((await get(server,name)).status,421);
 await host.stop(tokens[0]);assert.equal((await get(server,'alpha.localhost')).status,503);assert.equal((await get(server,'beta.localhost')).status,200);assert.equal((await get(server,'soon.localhost')).status,200);
});
test('real raw HTTP rejects duplicate Hosts, absolute-form mismatches and spoofed origin/proxy metadata',async t=>{
 const f=await fixture(t),{server}=await f.start();
 const raw=text=>new Promise((resolve,reject)=>{const socket=net.connect(server.address().port,'127.0.0.1');let result='';socket.on('connect',()=>socket.end(text));socket.on('data',b=>result+=b);socket.on('end',()=>resolve(result));socket.on('error',reject);});
 for(const text of ['GET / HTTP/1.1\r\nHost: alpha.localhost\r\nHost: beta.localhost\r\nConnection: close\r\n\r\n','GET http://beta.localhost/ HTTP/1.1\r\nHost: alpha.localhost\r\nConnection: close\r\n\r\n'])assert.match(await raw(text),/^HTTP\/1.1 400/);
 assert.equal((await get(server,'alpha.localhost','/',{headers:{'X-Forwarded-Host':'beta.localhost'}})).status,400);
 assert.equal((await get(server,'alpha.localhost','/',{method:'POST',headers:{Origin:'http://beta.localhost'}})).status,400);
 const r=await get(server,'soon.localhost','/',{method:'POST',headers:{Origin:'http://soon.localhost'}});assert.equal(r.status,405);assert.equal(r.headers['set-cookie'],undefined);
});
test('trusted peer HTTPS profile sets host-only Secure cookies; wrong peers/forwarded conflicts fail closed',async t=>{
 const f=await fixture(t);f.config.routing.transport={mode:'trusted-proxy',peers:['127.0.0.1']};const {server}=await f.start();
 const headers={'X-Forwarded-Host':'alpha.localhost','X-Forwarded-Proto':'https'};
 const r=await get(server,'internal.localhost','/',{headers});assert.equal(r.status,200,r.body);assert.match(r.headers['set-cookie'][0],/^__Host-wydgit-session=.*; Path=\/; Secure; HttpOnly; SameSite=Lax$/);
 assert.equal((await get(server,'internal.localhost','/',{headers:{...headers,Forwarded:'host=beta.localhost'}})).status,400);
 assert.equal((await get(server,'alpha.localhost')).status,400);
 assert.equal((await get(server,'internal.localhost','/',{localAddress:'127.0.0.2',headers})).status,400);
});
test('same installed WBasic Taskboard executes through shared hostnames with independent Gate and storage',async t=>{
 const {installTaskboards}=await import('../examples/hostname-host/taskboards.js'),{createGate}=await import('@wydgit/gate/client'),{manifest}=await import('@wydgit/gate'),{ExecutionContext}=await import('../wydgine/seam/context.js');
 const f=await fixture(t),execution=await installTaskboards(f.root);
 for(const id of ['app-alpha','app-beta'])execution[id].gateContext=new ExecutionContext({publisher:'host',package:'host:gate',app:id,self:'home',capabilities:manifest.capabilities,scopes:{wydgate:[id]}});
 const {host,server,tokens}=await f.start({execution});
 const gates=tokens.slice(0,2).map((token,i)=>createGate(host.bind(token,host.context(token,{publisher:'host',package:'host:gate',self:'home',capabilities:manifest.capabilities,scopes:{wydgate:[['app-alpha','app-beta'][i]]}}))));
 await Promise.all(gates.map(g=>g.register({username:'same-user',password:'isolated sufficiently long password'})));
 const logins=await Promise.all(gates.map(g=>g.login('same-user','isolated sufficiently long password')));
 const [a,b]=await Promise.all([get(server,'alpha.localhost','/',{headers:{Cookie:'wydgit-auth='+logins[0].token}}),get(server,'beta.localhost','/',{headers:{Cookie:'wydgit-auth='+logins[1].token}})]);
 assert.equal(a.status,200,a.body);assert.equal(b.status,200,b.body);assert.match(a.body,/Verify lifecycle cleanup/);assert.doesNotMatch(a.body,/Write WBasic/);assert.match(b.body,/Write WBasic/);
 assert.equal((await get(server,'beta.localhost','/',{headers:{Cookie:'wydgit-auth='+logins[0].token}})).status,403);
 const csrf=/name="_csrf" value="([^"]+)"/.exec(a.body)[1],body=new URLSearchParams({_target:'taskboard-routing-form',_action:'Submit',_csrf:csrf,Name:'Alpha submitted'}).toString();
 const headers={Origin:'http://alpha.localhost',Cookie:'wydgit-auth='+logins[0].token,'Content-Type':'application/x-www-form-urlencoded'};
 const post=await get(server,'alpha.localhost','/',{method:'POST',headers,body});assert.equal(post.status,200,post.body);assert.match(post.body,/Submitted through SEWN/);assert.match(post.body,/value="Alpha submitted"/);
 assert.equal((await get(server,'beta.localhost','/',{method:'POST',headers:{...headers,Origin:'http://beta.localhost',Cookie:'wydgit-auth='+logins[1].token},body})).status,403);
 assert.equal((await get(server,'alpha.localhost','/',{method:'POST',headers:{...headers,Origin:'http://beta.localhost'},body})).status,400);

 const storage=tokens.slice(0,2).map(token=>host.bind(token,host.context(token,{publisher:'acme',package:'acme/demo',self:'home',capabilities:['store.records.create','store.records.read'],scopes:{wydstore:[{store:'main',collection:'records'}]}})));
 await Promise.all(storage.map((s,i)=>s.invoke('wydstore','1.0.0','create',{store:'main',collection:'records',id:'same',data:{name:'private-'+i}})));
 for(const [i,s]of storage.entries())assert.equal((await s.invoke('wydstore','1.0.0','get',{store:'main',collection:'records',id:'same'})).value.data.name,'private-'+i);
 await host.stop(tokens[0]);assert.equal((await get(server,'alpha.localhost')).status,503);assert.equal((await get(server,'beta.localhost')).status,200);assert.equal((await get(server,'soon.localhost')).status,200);
});
test('shared dispatch drains accepted requests and isolates shutdown, asset validators and failed parking',async t=>{
 let enter,release;const entered=new Promise(r=>enter=r),pause=new Promise(r=>release=r);const f=await fixture(t);
 const {host,server,tokens}=await f.start({execution:{'app-alpha':{handlers:[{type:'Page.Load',owner:'home',run:async function(){enter();await pause;}}]}}});
 const pending=get(server,'alpha.localhost');await entered;const stopping=host.stop(tokens[0]);assert.equal((await get(server,'alpha.localhost')).status,503);
 const responses=await Promise.all(Array.from({length:12},()=>get(server,'beta.localhost')));assert.ok(responses.every(r=>r.status===200));release();assert.equal((await pending).status,200);await stopping;
 const a=await get(server,'beta.localhost','/css/site.css'),park=await get(server,'soon.localhost','/css/site.css',{headers:{'If-None-Match':a.headers.etag}});assert.equal(park.status,200);assert.notEqual(a.headers.etag,park.headers.etag);
 assert.equal((await get(server,'beta.localhost','/css/%2e%2e%2fwydgit.config.json')).status,404);
 await host.stop(tokens[2]);assert.equal((await get(server,'soon.localhost')).status,503);assert.equal((await get(server,'x.sites.example.localhost')).status,503);assert.equal((await get(server,'beta.localhost')).status,200);
});
test('parking configuration cannot load services or gain host execution; routing failure does not initialize Apps',async t=>{
 const f=await fixture(t);f.config.routing.routes[0].app='missing';await assert.rejects(f.start(),{code:'HOST.ROUTING'});f.config.routing.routes[0].app='app-alpha';
 await assert.rejects(f.start({execution:{'platform-parking':{context(){throw Error('must not run');}}}}),{code:'HOST.ROUTING'});
});

test('forced drain retires only the selected shared response and rejects late mutation',async t=>{
 let enter,release,late;const entered=new Promise(r=>enter=r),pause=new Promise(r=>release=r);const f=await fixture(t);f.config.shutdownMs=50;
 const {host,server,tokens}=await f.start({execution:{'app-alpha':{handlers:[{type:'Page.Load',owner:'home',run:async function(){enter();await pause;try{this.ME.Set('title','Late resurrection');}catch(error){late=error.code;}}}]}}});
 const pending=get(server,'alpha.localhost').then(()=>false,()=>true);await entered;f.expectCleanupFailure();await assert.rejects(host.stop(tokens[0]),{code:'HOST.CLEANUP'});assert.equal(await pending,true);release();
 for(let i=0;i<50&&!late;i++)await new Promise(r=>setTimeout(r,5));assert.ok(late);assert.equal((await get(server,'beta.localhost')).status,200);assert.equal((await get(server,'alpha.localhost')).status,503);await assert.rejects(host.dispose(),{code:'HOST.CLEANUP'});
});
test('shared route handles partial startup failure without tenant or parking fallback',async t=>{
 const f=await fixture(t),host=await createMultiAppHost(f.config,{root:f.root,execution:{'app-alpha':{lifecycleHandlers:[{type:'Server.Start',owner:'app-alpha',run:function(){throw Error('private startup');}}]}}});t.after(()=>host.dispose());
 await assert.rejects(host.activate('app-alpha'),{code:'HOST.STARTUP'});await host.activate('app-beta');const server=await host.listenShared(0,'127.0.0.1');
 assert.equal((await get(server,'alpha.localhost')).status,503);assert.equal((await get(server,'beta.localhost')).status,200);assert.equal((await get(server,'soon.localhost')).status,503);assert.equal((await get(server,'external.localhost')).status,421);await host.dispose();
});

test('shared listener honors the strictest App raw-header limit without truncating Host evidence',async t=>{
 const f=await fixture(t),file=path.join(f.root,'app-alpha/wydgit.config.json'),settings=JSON.parse(await fs.readFile(file));settings.runtime={http:{headerCount:4}};await fs.writeFile(file,JSON.stringify(settings));const {server}=await f.start();
 const r=await get(server,'beta.localhost','/',{headers:{One:'1',Two:'2',Three:'3',Four:'4'}});assert.equal(r.status,431);assert.equal(r.headers['set-cookie'],undefined);assert.equal((await get(server,'beta.localhost')).status,200);
});
