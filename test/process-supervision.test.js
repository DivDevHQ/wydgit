import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createSupervisor} from 'wydhosting';
import {schema,bounds,boundedJSON,validateMessage,validateBootstrap,revision,createChannel} from 'wydgine/trusted/protocol';
import {provisionPools} from '../examples/process-supervision/setup.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000){const end=Date.now()+ms;while(Date.now()<end){const v=fn();if(v)return v;await sleep(25);}throw Error('Finite observation deadline');}
const request=(port,host,url='/')=>new Promise((resolve,reject)=>{const q=http.get({host:'127.0.0.1',port,path:url,headers:{Host:host},timeout:5000},r=>{let body='';r.on('data',c=>body+=c);r.on('end',()=>resolve({status:r.statusCode,body}));});q.on('timeout',()=>q.destroy(Error('HTTP deadline')));q.on('error',reject);});
async function fixture(t,options={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-workers-'));let supervisor;const owned=[];
 t.after(async()=>{await supervisor?.shutdown();for(const other of owned)await other.shutdown();await fs.rm(root,{recursive:true,force:true});});
 const f=await provisionPools(root,options);supervisor=await createSupervisor({...f,backoffMs:100,healthMs:200,controlMs:1000,...options});return {...f,root,supervisor,own:s=>owned.push(s)};
}
test('real workers: approved shared Taskboards, dedicated process, HTTP, crash/restart, independent liveness and cleanup',{timeout:60000},async t=>{
 const f=await fixture(t),s=f.supervisor,a=await s.startPool('shared',{execution:f.execution}),b=await s.startPool('dedicated');
 t.diagnostic(JSON.stringify({sharedPid:a.pid,dedicatedPid:b.pid,workerEntry:fileURLToPath(import.meta.resolve('wydgine/trusted/worker-entry'))}));assert.notEqual(a.pid,b.pid);assert.equal(a.health.apps.length,2);assert.equal(b.health.apps.length,1);
 assert.match((await request(a.port,'alpha.localhost')).body,/Verify lifecycle cleanup/);assert.equal((await request(a.port,'beta.localhost')).status,200);assert.equal((await request(b.port,'gamma.localhost')).status,200);
 assert.equal((await request(b.port,'alpha.localhost')).status,421);assert.equal((await request(a.port,'unknown.localhost')).status,421);
 process.kill(a.pid,'SIGKILL');await until(()=>s.inspectPool('shared').generation!==a.generation&&s.inspectPool('shared').ready);
 const replacement=s.inspectPool('shared');assert.notEqual(replacement.pid,a.pid);assert.equal(replacement.attempts,1);assert.equal((await request(b.port,'gamma.localhost')).status,200);assert.match((await request(replacement.port,'alpha.localhost')).body,/Verify lifecycle cleanup/);
 process.kill(replacement.pid,'SIGTERM');await until(()=>s.inspectPool('shared').ready&&s.inspectPool('shared').generation!==replacement.generation);
 await s.stopPool('shared');assert.equal(s.inspectPool('shared').ready,false);assert.equal((await request(b.port,'gamma.localhost')).status,200);
 await s.shutdown();for(const pid of [a.pid,b.pid,replacement.pid])assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
});
test('crash-loop budget is finite and persisted; explicit stopped recovery permits operator retry',{timeout:40000},async t=>{
 const f=await fixture(t,{maxRestarts:2});let s=f.supervisor;let current=await s.startPool('dedicated');
 for(let i=0;i<3;i++){process.kill(current.pid,'SIGKILL');if(i<2){await until(()=>s.inspectPool('dedicated').ready&&s.inspectPool('dedicated').generation!==current.generation);current=s.inspectPool('dedicated');}}
 await until(()=>s.inspectPool('dedicated').state==='failed');assert.equal(s.inspectPool('dedicated').code,'HOSTING.CRASH_LOOP');await assert.rejects(s.startPool('dedicated'),{code:'HOSTING.CRASH_LOOP'});
 assert.equal(JSON.parse(await fs.readFile(path.join(f.directory,'supervisor.json'))).pools[0].attempts,2);await s.shutdown();s=await createSupervisor({...f,maxRestarts:2,backoffMs:100});f.own(s);await assert.rejects(s.startPool('dedicated'),{code:'HOSTING.CRASH_LOOP'});await s.recoverPool('dedicated');assert.equal((await s.startPool('dedicated')).ready,true);
});
test('registry assignment, stale configuration and conflicting ownership fail before ready',{timeout:30000},async t=>{
 const f=await fixture(t),s=f.supervisor;await assert.rejects(s.startPool('not-approved'));await assert.rejects(createSupervisor(f),{code:'HOSTING.OWNERSHIP_UNKNOWN'});
 await assert.rejects(s.startPool('shared',{execution:{foreign:{verifiedPackages:{}}}}));assert.equal(s.inspectPool('shared').ready,false);
 await fs.appendFile(path.join(f.root,'shared/app-alpha/content/app.json'),' ');await assert.rejects(s.startPool('shared',{execution:f.execution}),{code:'HOSTING.CORRUPT'});
});
test('worker protocol closed schemas, bounds, version and generation validation',()=>{
 assert.throws(()=>boundedJSON({get secret(){throw Error('Accessor must never run');}}),{code:'WORKER.PROTOCOL'});
 const sparse=[];sparse.length=32769;assert.throws(()=>boundedJSON(sparse),{code:'WORKER.PROTOCOL'});
 const m={schema,type:'health',requestId:'r1',poolId:'pool',workerId:'worker',generation:'generation',sequence:1,body:{}};assert.equal(validateMessage(m,'command'),m);
 for(const change of [x=>x.schema='wrong',x=>x.type='eval',x=>x.body={source:'secret'},x=>x.sequence=0,x=>x.generation='',x=>x.extra=1,x=>x.body={x:'x'.repeat(bounds.messageBytes)}]){const x=structuredClone(m);change(x);assert.throws(()=>validateMessage(x,'command'));}
});
test('actual worker fails closed on malformed or oversized IPC and pre-bootstrap disconnect',{timeout:15000},async t=>{
 for(const payload of [{schema:'wrong'},{body:'x'.repeat(bounds.messageBytes+1)},null]){
  const child=fork(fileURLToPath(import.meta.resolve('wydgine/trusted/worker-entry')),[],{stdio:['ignore','ignore','ignore','ipc'],execArgv:[]});t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});
  const exit=new Promise(r=>child.once('exit',r));if(payload)child.send(payload);else child.disconnect();const code=await Promise.race([exit,sleep(5000).then(()=>{throw Error('Worker failed to exit');})]);assert.notEqual(code,0);
 }
});
async function rawWorker(t,f,{poolId='dedicated',mutate=x=>x}={}){
 const {compilePool}=await import('wydhosting');const {registry:r}=await f.registry.inspect(),pool=r.pools.find(p=>p.poolId===poolId),inventory=structuredClone(await compilePool(r,poolId,{fixtureRoot:f.root}));
 const snapshots=Object.fromEntries(r.apps.filter(a=>a.placement.poolId===poolId).map(a=>[a.appId,a.snapshot]));
 const execution=poolId==='shared'?f.execution:{},optional=[],listener={host:'127.0.0.1',port:0};
 const b=mutate({providerId:r.providerId,poolId,workerId:'test-worker',generation:'test-generation',epoch:1,registryRevision:r.revision,root:pool.base,inventory,snapshots,execution,optional,listener,startupMs:10000,shutdownMs:1000,configurationRevision:revision({root:pool.base,inventory,snapshots,execution,optional,listener})});
 const child=fork(fileURLToPath(import.meta.resolve('wydgine/trusted/worker-entry')),[],{stdio:['ignore','ignore','ignore','ipc'],execArgv:[]});let dead=false;const exit=new Promise(r=>child.once('exit',(code,signal)=>{dead=true;r({code,signal});}));
 t.after(async()=>{if(!dead){child.kill('SIGKILL');await exit;}});const messages=[];child.on('message',m=>messages.push(m));
 const message=(type='bootstrap',sequence=1,body=b)=>({schema,type,requestId:'r'+sequence,poolId,workerId:b.workerId,generation:b.generation,sequence,body});
 child.send(message());return {child,messages,exit,b,message,async ready(){return until(()=>messages.find(m=>m.type==='ready'));}};
}
test('real control channel: stale generation and duplicate request fail closed; EOF retires listener',{timeout:30000},async t=>{
 const f=await fixture(t);
 for(const variant of ['stale','duplicate','eof']){
  const w=await rawWorker(t,f);const ready=await w.ready();assert.equal((await request(ready.body.port,'gamma.localhost')).status,200);
  if(variant==='eof')w.child.disconnect();else{const m=w.message('health',variant==='duplicate'?1:2,{});if(variant==='stale')m.generation='retired-generation';w.child.send(m);}
  assert.notEqual((await w.exit).code,0);await assert.rejects(request(ready.body.port,'gamma.localhost'));
 }
});
test('worker rejects stale revisions, invalid canonical inventories and unapproved snapshots before listening',{timeout:15000},async t=>{
 const f=await fixture(t);
 for(const variant of ['revision','inventory','snapshot']){
  const w=await rawWorker(t,f,{mutate:b=>{if(variant==='revision')b.configurationRevision='0'.repeat(64);else{if(variant==='inventory')b.inventory.apps[0].root='../escape';else b.snapshots['app-gamma']='0'.repeat(64);b.configurationRevision=revision({root:b.root,inventory:b.inventory,snapshots:b.snapshots,execution:b.execution,optional:b.optional,listener:b.listener});}return b;}});
  await w.exit;assert.equal(w.messages.some(m=>m.type==='ready'),false);if(variant!=='revision')assert.equal(w.messages.find(m=>m.type==='rejected')?.body.code,'WORKER.STARTUP');
 }
});
test('pending control EOF rejects; finite queue backpressure, duplicate/stale responses close channel',async()=>{
 const {EventEmitter}=await import('node:events');
 for(const reason of ['eof','duplicate','stale','oversize']){
  const peer=new EventEmitter();peer.send=(_m,cb)=>cb();let closed;const identity={poolId:'pool',workerId:'worker',generation:'current'};
  const channel=createChannel(peer,{direction:'command',identity:()=>identity,onClose:c=>closed=c,onMessage:()=>{throw Error('Uncorrelated response');}});
  await channel.send('health','r1');if(reason==='eof')peer.emit('disconnect');else peer.emit('message',{schema,type:'stopped',requestId:'r1',...identity,generation:reason==='stale'?'old':'current',sequence:1,body:reason==='oversize'?{text:'x'.repeat(bounds.messageBytes)}:{}});
  assert.ok(closed);await assert.rejects(channel.send('health','r2'));
 }
 const peer=new EventEmitter();peer.send=()=>false;const channel=createChannel(peer,{direction:'command',identity:()=>({poolId:'p',workerId:'w',generation:'g'}),onMessage(){},timeoutMs:100});
 const queued=Array.from({length:33},(_,i)=>channel.send('health','r'+(i+1)));assert.equal((await Promise.allSettled(queued)).every(r=>r.status==='rejected'),true);
});
test('unresponsive real event loop is unavailable, killed before replacement; sibling serves',{timeout:30000},async t=>{
 // Use the documented control default: canonical Page work may validly exceed
 // 100 ms. The strict 100 ms failure policy is exercised separately below.
 const f=await fixture(t,{shutdownMs:100,healthMs:100,controlMs:2000}),s=f.supervisor,a=await s.startPool('dedicated'),b=await s.startPool('shared',{execution:f.execution});
 process.kill(a.pid,'SIGSTOP');await until(()=>s.inspectPool('dedicated').ready===false);assert.equal(s.inspectPool('dedicated').health,null);
 let canary;try{canary=await request(b.port,'beta.localhost');}catch(error){t.diagnostic(JSON.stringify(s.health()));throw error;}assert.equal(canary.status,200);await until(()=>s.inspectPool('dedicated').ready&&s.inspectPool('dedicated').generation!==a.generation);assert.throws(()=>process.kill(a.pid,0),{code:'ESRCH'});
});
test('real HTTP admission saturation stays App/pool scoped and SIGTERM drains accepted Taskboard submissions',{timeout:30000},async t=>{
 const f=await fixture(t),s=f.supervisor,a=await s.startPool('shared',{execution:f.execution}),b=await s.startPool('dedicated');
 const page=await new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port:a.port,headers:{Host:'alpha.localhost'}},r=>{let body='';r.on('data',c=>body+=c);r.on('end',()=>resolve({body,cookie:r.headers['set-cookie']?.map(c=>c.split(';')[0]).join('; ')}));}).on('error',reject);});
 const csrf=/name="_csrf" value="([^"]+)"/.exec(page.body)[1],body=new URLSearchParams({_target:'taskboard-routing-form',_action:'Submit',_csrf:csrf,Name:'Drained through worker'}).toString();
 const requests=[];
 for(let i=0;i<2;i++){
  let q;const response=new Promise((resolve,reject)=>{q=http.request({host:'127.0.0.1',port:a.port,path:'/',method:'POST',headers:{Host:'alpha.localhost',Origin:'http://alpha.localhost',Cookie:page.cookie,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)},timeout:5000},r=>{let text='';r.on('data',c=>text+=c);r.on('end',()=>resolve({status:r.statusCode,body:text}));});q.on('error',reject);q.on('timeout',()=>q.destroy(Error('HTTP deadline')));q.write(body.slice(0,10));});
  // Register a rejection handler immediately; assertions still observe failures.
  response.catch(()=>{});requests.push({q,response});t.after(()=>q.destroy());
 }
 await until(()=>s.inspectPool('shared').health?.apps.find(a=>a.id==='app-alpha').saturated);
 assert.equal((await request(a.port,'alpha.localhost')).status,503);assert.equal((await request(a.port,'beta.localhost')).status,200);assert.equal((await request(b.port,'gamma.localhost')).status,200);assert.equal(s.inspectPool('dedicated').health.capacity.saturated,0);
 process.kill(a.pid,'SIGTERM');await until(()=>!s.inspectPool('shared').ready);for(const {q}of requests)q.end(body.slice(10));
 for(const {response}of requests){const result=await response;assert.equal(result.status,200,result.body);assert.match(result.body,/Submitted through SEWN/);}
 await until(()=>s.inspectPool('shared').ready&&s.inspectPool('shared').generation!==a.generation);await s.stopPool('shared');assert.equal(s.inspectPool('shared').state,'stopped');assert.equal((await request(b.port,'gamma.localhost')).status,200);
});
test('optional canonical service initialization failure stays 503; required failure and bind collision never become ready',{timeout:30000},async t=>{
 const f=await fixture(t),s=f.supervisor;await fs.rmdir(path.join(f.root,'shared/app-alpha/data'));await fs.writeFile(path.join(f.root,'shared/app-alpha/data'),'not a service directory');
 const shared=await s.startPool('shared',{execution:f.execution,optional:['app-alpha']});assert.equal(shared.ready,true);assert.equal(shared.health.apps[0].failure,'APP.STARTUP');assert.equal((await request(shared.port,'alpha.localhost')).status,503);assert.equal((await request(shared.port,'beta.localhost')).status,200);await s.stopPool('shared');
 await assert.rejects(s.startPool('shared',{execution:f.execution}),{code:'WORKER.STARTUP'});assert.equal(s.inspectPool('shared').ready,false);assert.equal(s.inspectPool('shared').attempts,0);
 const occupied=http.createServer();await new Promise(r=>occupied.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>occupied.close(r)));await assert.rejects(s.startPool('dedicated',{port:occupied.address().port}),{code:'WORKER.STARTUP'});assert.equal(s.inspectPool('dedicated').ready,false);
});
test('startup deadline kills a stopped process before resources may be reused',{timeout:15000},async t=>{
 const f=await fixture(t,{startupMs:500,shutdownMs:100}),s=f.supervisor;let rejected=false;const starting=s.startPool('shared',{execution:f.execution});starting.catch(()=>{rejected=true;});
 const observed=await until(()=>s.inspectPool('shared').pid||rejected),pid=typeof observed==='number'?observed:null;if(pid)process.kill(pid,'SIGSTOP');await assert.rejects(starting);assert.equal(s.inspectPool('shared').ready,false);if(pid)assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
});
test('supervisor death closes inherited IPC; responsive worker retires its listener',{timeout:15000},async t=>{
 const f=await fixture(t);await f.supervisor.shutdown();
 const script=path.join(f.root,'supervisor.mjs');await fs.writeFile(script,`import {createRegistry,createSupervisor} from ${JSON.stringify(import.meta.resolve('wydhosting'))};\nconst root=process.argv[2];const registry=createRegistry({directory:root+'/registry',fixtureRoot:root});const supervisor=await createSupervisor({registry,directory:registry.supervisorStateDirectory,fixtureRoot:root});process.send(await supervisor.startPool('dedicated'));`);
 const parent=fork(script,[f.root],{stdio:['ignore','ignore','ignore','ipc'],execArgv:[]});let dead=false;const exit=new Promise(r=>parent.once('exit',()=>{dead=true;r();}));t.after(async()=>{if(!dead){parent.kill('SIGKILL');await exit;}});
 const worker=await new Promise((resolve,reject)=>{parent.once('message',resolve);parent.once('exit',()=>reject(Error('Supervisor startup failed')));});
 parent.kill('SIGKILL');await exit;
 await until(()=>{try{process.kill(worker.pid,0);return false;}catch{return true;}},5000).catch(async()=>{const status=await fs.readFile('/proc/'+worker.pid+'/stat','utf8');assert.equal(status.split(' ')[2],'Z');});
 await assert.rejects(request(worker.port,'gamma.localhost'));await assert.rejects(createSupervisor(f),{code:'HOSTING.OWNERSHIP_UNKNOWN'});
});
test('canonical Store state remains App scoped across supervised process lifetimes',{timeout:30000},async t=>{
 const f=await fixture(t),{createOperationalHost}=await import('wydgine/trusted/worker'),{compilePool}=await import('wydhosting');
 const inventory=await compilePool((await f.registry.inspect()).registry,'shared',{fixtureRoot:f.root});
 async function stores(write){
  const host=await createOperationalHost({schema:'wydgit.operations/0.1',inventory,optional:[]},{root:path.join(f.root,'shared'),execution:f.execution});
  try{await host.start(0,'127.0.0.1');for(const [index,id]of ['app-alpha','app-beta'].entries()){
   const token=host.controller.select(id),service=host.controller.bind(token,host.controller.context(token,{context:'FrontEnd',publisher:'acme',package:'acme/demo',self:'home',capabilities:['store.records.create','store.records.read'],scopes:{wydstore:[{store:'main',collection:'records'}]}}));
   if(write)assert.equal((await service.invoke('wydstore','1.0.0','create',{store:'main',collection:'records',id:'same-id',data:{name:'private-'+index}})).ok,true);
   assert.equal((await service.invoke('wydstore','1.0.0','get',{store:'main',collection:'records',id:'same-id'})).value.data.name,'private-'+index);
  }}finally{await host.shutdown();}
 }
 await stores(true);const worker=await f.supervisor.startPool('shared',{execution:f.execution});assert.equal((await request(worker.port,'alpha.localhost')).status,200);await f.supervisor.stopPool('shared');await stores(false);
});
test('approved registry revision changes retire fixed inventory and require explicit planned replacement',{timeout:15000},async t=>{
 const f=await fixture(t),s=f.supervisor,a=await s.startPool('dedicated');
 await f.registry.apply(await f.registry.plan({schema:'wydhosting.request/1',operationId:'revise-domain-evidence',expectedRevision:1,expiresAt:Date.now()+10000,actions:[{kind:'changeDomain',customerId:'gamma',hostname:'gamma.localhost',appId:'app-gamma',expectedRevision:1,evidence:'reviewed-again'}]}));
 await until(()=>!s.inspectPool('dedicated').ready);await until(()=>s.inspectPool('dedicated').state==='unavailable'||s.inspectPool('dedicated').state==='stopped');
 await s.stopPool('dedicated');assert.throws(()=>process.kill(a.pid,0),{code:'ESRCH'});const fresh=await s.startPool('dedicated');assert.notEqual(fresh.generation,a.generation);assert.equal(fresh.registryRevision,2);
});
test('real IPC EOF rejects pending health control; old process cannot own replacement metrics',{timeout:15000},async t=>{
 const f=await fixture(t,{healthMs:10000}),s=f.supervisor,a=await s.startPool('dedicated');process.kill(a.pid,'SIGSTOP');
 const pending=s.readHealth('dedicated');process.kill(a.pid,'SIGKILL');await assert.rejects(pending,{code:'WORKER.CLOSED'});
 await until(()=>s.inspectPool('dedicated').ready&&s.inspectPool('dedicated').generation!==a.generation);const fresh=await s.readHealth('dedicated');assert.notEqual(fresh.generation,a.generation);assert.equal(fresh.health.ready,true);
});
test('higher-tier dedicated App uses its own approved independent process',{timeout:15000},async t=>{
 const f=await fixture(t,{dedicatedApp:true}),s=f.supervisor;assert.equal((await f.registry.inspect()).registry.pools.find(p=>p.poolId==='dedicated').mode,'dedicated-app');const a=await s.startPool('dedicated'),b=await s.startPool('shared',{execution:f.execution});assert.notEqual(a.pid,b.pid);assert.equal(a.health.apps.length,1);assert.equal((await request(a.port,'gamma.localhost')).status,200);
});
test('registry read deadline cannot launch a late generation after the caller has failed',{timeout:10000},async t=>{
 const f=await fixture(t);await f.supervisor.shutdown();const inspected=await f.registry.inspect();let finishRead;
 const registry={...f.registry,inspect:()=>new Promise(resolve=>{finishRead=resolve;})};
 const s=await createSupervisor({...f,registry,startupMs:100});f.own(s);
 await assert.rejects(s.startPool('dedicated'),{code:'HOSTING.REGISTRY_TIMEOUT'});finishRead(inspected);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(s.inspectPool('dedicated').state,'not-observed');assert.equal(s.health().pools.length,0);
});
test('strict 100 ms control deadline retires an actual frozen worker before replacement',{timeout:15000},async t=>{
 const f=await fixture(t,{shutdownMs:100,healthMs:100,controlMs:100}),s=f.supervisor,a=await s.startPool('dedicated');process.kill(a.pid,'SIGSTOP');
 await until(()=>!s.inspectPool('dedicated').ready);await until(()=>s.inspectPool('dedicated').ready&&s.inspectPool('dedicated').generation!==a.generation);assert.throws(()=>process.kill(a.pid,0),{code:'ESRCH'});
});
test('supervisor shutdown fences a pending start and immediately removes cached readiness',{timeout:15000},async t=>{
 const f=await fixture(t),s=f.supervisor,b=await s.startPool('dedicated');const starting=s.startPool('shared',{execution:f.execution});starting.catch(()=>{});
 const pid=await until(()=>s.inspectPool('shared').pid);const stopping=s.shutdown();assert.equal(s.inspectPool('dedicated').ready,false);assert.equal(s.inspectPool('dedicated').health,null);
 await assert.rejects(starting,{code:'HOSTING.CLOSED'});await stopping;for(const owned of [pid,b.pid])assert.throws(()=>process.kill(owned,0),{code:'ESRCH'});
});
