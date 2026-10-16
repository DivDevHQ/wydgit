// Disposable same-UID process supervision; no production isolation claim.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createChannel,revision,validateBootstrap,protocolError} from 'wydgine/trusted/protocol';
import {compilePool,safePath} from './adapter.js';
import {validateRegistry,check,integer,sealed,shape,id} from './contracts.js';
async function awaitExit(entry,ms){let timer;try{await Promise.race([entry.exit,new Promise(resolve=>{timer=setTimeout(resolve,ms);})]);}finally{clearTimeout(timer);}}
async function deadline(work,ms,code){let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(protocolError(code)),ms);})]);}finally{clearTimeout(timer);}}
const workerEntry=fileURLToPath(import.meta.resolve('wydgine/trusted/worker-entry'));
function placementRevision(r,poolId){
 const pool=r.pools.find(p=>p.poolId===poolId),apps=r.apps.filter(a=>a.placement.poolId===poolId);
 const customers=r.customers.filter(c=>apps.some(a=>a.customerId===c.customerId));
 return revision({providerId:r.providerId,pool,apps,domains:r.domains.filter(d=>apps.some(a=>a.appId===d.appId)),customers,plans:r.plans.filter(p=>customers.some(c=>c.planId===p.planId&&c.planRevision===p.revision)),accounts:r.accounts.filter(a=>a.accountId===pool?.accountId)});
}
export async function createSupervisor({registry,directory,fixtureRoot,startupMs=30000,shutdownMs=10000,controlMs=2000,healthMs=2000,maxRestarts=5,backoffMs=1000}={}){
 check(registry&&typeof registry.inspect==='function'&&typeof registry.reconcile==='function'&&path.isAbsolute(directory)&&directory===registry.supervisorStateDirectory,'HOSTING.SUPERVISOR');
 for(const v of [startupMs,shutdownMs])check(integer(v,100,120000),'HOSTING.SUPERVISOR');
 check(integer(controlMs,100,10000)&&integer(healthMs,100,10000)&&integer(maxRestarts,0,5)&&integer(backoffMs,100,30000),'HOSTING.SUPERVISOR');
 await safePath(directory);const stat=await fs.stat(directory);check(stat.uid===process.getuid()&&(stat.mode&0o077)===0,'HOSTING.PERMISSIONS');
 const lockPath=path.join(directory,'supervisor.lock'),statePath=path.join(directory,'supervisor.json');let lock;
 try{lock=await fs.open(lockPath,'wx',0o600);}catch{throw protocolError('HOSTING.OWNERSHIP_UNKNOWN');}
 let shutdownPromise;let durable={schema:'wydhosting.supervisor/1',pools:[]},closing=false,writeChain=Promise.resolve();const entries=new Map(),operations=new Map();
 async function save(ms=startupMs){const text=JSON.stringify(durable);writeChain=writeChain.then(async()=>{const temporary=path.join(directory,'supervisor-'+randomUUID()+'.tmp');const f=await fs.open(temporary,'wx',0o600);try{await f.writeFile(text);await f.sync();}finally{await f.close();}await fs.rename(temporary,statePath);const d=await fs.open(directory,'r');try{await d.sync();}finally{await d.close();}});return deadline(writeChain,ms,'HOSTING.STATE_TIMEOUT');}
 try{
  await lock.writeFile(JSON.stringify({pid:process.pid}));await lock.sync();
  try{if(!await safePath(statePath,{missing:true}))throw Object.assign(new Error(),{code:'ENOENT'});const s=await fs.stat(statePath);check(s.size<=262144&&s.uid===process.getuid()&&(s.mode&0o077)===0,'HOSTING.RECOVERY_REQUIRED');durable=JSON.parse(await fs.readFile(statePath,'utf8'));shape(durable,['schema','pools']);check(durable.schema==='wydhosting.supervisor/1'&&Array.isArray(durable.pools)&&durable.pools.length<=128,'HOSTING.RECOVERY_REQUIRED');const ids=new Set();for(const p of durable.pools){shape(p,['poolId','epoch','attempts','desired','worker']);check(id(p.poolId)&&!ids.has(p.poolId)&&integer(p.epoch)&&integer(p.attempts,0,5)&&['running','stopped'].includes(p.desired),'HOSTING.RECOVERY_REQUIRED');if(p.worker!==null){shape(p.worker,['pid','generation']);check(integer(p.worker.pid,1)&&id(p.worker.generation),'HOSTING.RECOVERY_REQUIRED');throw protocolError('HOSTING.OWNERSHIP_UNKNOWN');}ids.add(p.poolId);}}
  catch(e){if(e.code!=='ENOENT')throw e;}
 }catch(e){await lock.close();await fs.unlink(lockPath);throw e;}
 function policy(poolId){check(id(poolId),'HOSTING.INVALID');let p=durable.pools.find(p=>p.poolId===poolId);if(!p){check(durable.pools.length<128,'HOSTING.CAPACITY');p={poolId,epoch:0,attempts:0,desired:'stopped',worker:null};durable.pools.push(p);}return p;}
 function invalidate(e,state,code){e.ready=false;e.snapshot=null;e.port=null;e.state=state;e.code=code;clearInterval(e.heartbeat);clearTimeout(e.drainTimer);}
 function view(e){const fresh=e.initialized===true&&e.ready&&!e.expected&&!e.dead&&!closing&&policy(e.poolId).desired==='running'&&performance.now()-(e.observedAt??0)<=healthMs+controlMs;return sealed({poolId:e.poolId,generation:e.generation,epoch:e.epoch,pid:e.child?.pid??null,desired:policy(e.poolId).desired,state:e.ready&&!fresh?'unavailable':e.state,ready:fresh&&e.child?.exitCode===null&&e.child?.signalCode===null,attempts:policy(e.poolId).attempts,registryRevision:e.registryRevision,code:e.code,health:fresh?e.snapshot:null,port:fresh?e.port:null,productionReady:false});}
 function serial(poolId,fn){check(!closing,'HOSTING.CLOSED');check(!operations.has(poolId),'HOSTING.BUSY');const p=fn().finally(()=>operations.delete(poolId));operations.set(poolId,p);return p;}
 async function readRegistry(reconcile=false,budget=()=>startupMs){return deadline((async()=>{if(reconcile)check((await registry.reconcile()).state!=='recovery-required','HOSTING.RECOVERY_REQUIRED');return validateRegistry((await registry.inspect()).registry);})(),budget(),'HOSTING.REGISTRY_TIMEOUT');}
 async function approved(poolId,budget=()=>startupMs){const r=await readRegistry(true,budget);const inventory=await deadline(compilePool(r,poolId,{fixtureRoot,stateDirectory:directory}),budget(),'HOSTING.VALIDATION_TIMEOUT');check(inventory.routing,'HOSTING.ROUTING_REQUIRED');return {r,inventory,pool:r.pools.find(p=>p.poolId===poolId)};}
 async function killAndWait(e){
  if(e.dead)return;invalidate(e,'stopping',e.code);e.channel?.close();e.child.kill('SIGTERM');
  await awaitExit(e,shutdownMs);if(!e.dead){e.child.kill('SIGKILL');await awaitExit(e,5000);}
  check(e.dead,'HOSTING.OWNERSHIP_UNKNOWN');
 }
 async function launch(poolId,options){
  const stopAt=performance.now()+startupMs;const remaining=()=>{const ms=Math.floor(stopAt-performance.now());check(ms>0,'WORKER.TIMEOUT');return ms;};
  check(Object.keys(options).every(k=>['execution','optional','port'].includes(k)),'HOSTING.SUPERVISOR');
  const previous=entries.get(poolId);previous?.cancelRetry?.();check(!previous||previous.dead,'HOSTING.OWNERSHIP_UNKNOWN');
  const {r,inventory,pool}=await approved(poolId,remaining);check(!closing,'HOSTING.CLOSED');
  const p=policy(poolId);check(p.epoch<Number.MAX_SAFE_INTEGER,'HOSTING.GENERATION_EXHAUSTED');p.epoch++;p.desired='running';await save(remaining());check(!closing&&p.desired==='running','HOSTING.CLOSED');
  const snapshots=Object.fromEntries(r.apps.filter(a=>inventory.apps.some(x=>x.id===a.appId)).map(a=>[a.appId,a.snapshot]));
  const execution=structuredClone(options.execution??{}),optional=structuredClone(options.optional??[]),listener={host:'127.0.0.1',port:options.port??0};
  const b={providerId:r.providerId,poolId,workerId:randomUUID(),generation:randomUUID(),epoch:p.epoch,registryRevision:r.revision,configurationRevision:revision({root:pool.base,inventory,snapshots,execution,optional,listener}),root:pool.base,inventory,snapshots,execution,optional,listener,startupMs:remaining(),shutdownMs};validateBootstrap(b);
  const e={poolId,generation:b.generation,epoch:p.epoch,registryRevision:r.revision,state:'starting',ready:false,snapshot:null,port:null,code:null,dead:false,expected:false,pending:new Map(),count:0,options:{execution,optional,port:listener.port},registryDigest:placementRevision(r,poolId)};entries.set(poolId,e);
  let child;try{child=e.child=fork(workerEntry,[],{stdio:['ignore','ignore','ignore','ipc'],serialization:'json',execArgv:[],env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});}catch{e.dead=true;invalidate(e,'failed','WORKER.SPAWN');throw protocolError('WORKER.SPAWN');}
  let resolveExit;e.exit=new Promise(r=>resolveExit=r);
  function rejectPending(code){for(const q of e.pending.values()){clearTimeout(q.timer);q.reject(protocolError(code));}e.pending.clear();}
  function fail(code){invalidate(e,'unavailable',code);rejectPending(code);if(!e.dead&&!e.expected)killAndWait(e).catch(()=>invalidate(e,'failed','HOSTING.OWNERSHIP_UNKNOWN'));}
  e.channel=createChannel(child,{direction:'command',identity:()=>({poolId,workerId:b.workerId,generation:b.generation}),timeoutMs:controlMs,onClose:code=>{if(!e.dead&&!e.expected)fail(code);else rejectPending(code);},onMessage:m=>{
   const q=e.pending.get(m.requestId);if(!q||!q.types.includes(m.type))throw protocolError();
   if(q.seen.has(m.type))throw protocolError();q.seen.add(m.type);
   if(q.type==='bootstrap'&&!['failure','rejected'].includes(m.type)){const order=['accepted','starting',m.type==='not-ready'?'not-ready':'ready'];if(order[q.progress++]!==m.type)throw protocolError();}
   if(q.type==='shutdown'&&m.type==='stopped'&&!q.seen.has('draining'))throw protocolError();
   if(['accepted','starting','draining'].includes(m.type))return;
   if(['failure','rejected'].includes(m.type)){clearTimeout(q.timer);e.pending.delete(m.requestId);q.reject(protocolError(m.body.code));return;}
   if(m.type!=='stopped'){
    if(m.body.ready&&(m.body.state!=='ready'||m.body.port===0||m.body.apps.some(a=>!optional.includes(a.id)&&!a.ready)))throw protocolError();
    if(m.body.capacity.ready!==m.body.apps.filter(a=>a.ready).length||m.body.capacity.saturated!==m.body.apps.filter(a=>a.saturated).length)throw protocolError();
    if(m.body.configurationRevision!==b.configurationRevision||m.body.apps.some(a=>!inventory.apps.some(x=>x.id===a.id))||m.body.apps.length!==inventory.apps.length||new Set(m.body.apps.map(a=>a.id)).size!==inventory.apps.length||m.body.capacity.configured!==inventory.apps.length||listener.port&&m.body.port!==listener.port)throw protocolError();
    e.observedAt=performance.now();e.snapshot=m.body;e.ready=m.body.ready&&!e.expected;e.state=m.body.state;e.port=m.body.port;
   }
   clearTimeout(q.timer);e.pending.delete(m.requestId);q.resolve(m.body);
  }});
  e.request=(type,types,ms=controlMs)=>{
   if(e.dead||e.channel.closed)return Promise.reject(protocolError('WORKER.CLOSED'));
   if(e.pending.size>=32)return Promise.reject(protocolError('WORKER.BUSY'));
   const requestId='r'+(++e.count);
   return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{e.pending.delete(requestId);reject(protocolError('WORKER.TIMEOUT'));fail('WORKER.TIMEOUT');},ms);e.pending.set(requestId,{type,types,resolve,reject,timer,seen:new Set(),progress:0});e.channel.send(type,requestId,type==='bootstrap'?b:{}).catch(()=>fail('WORKER.CLOSED'));});
  };
  child.once('error',()=>{if(!child.pid){e.dead=true;resolveExit({code:null,signal:null});}fail('WORKER.SPAWN');});
  child.once('exit',(code,signal)=>{
   e.dead=true;if(p.worker?.generation===e.generation){p.worker=null;save().catch(()=>{});}invalidate(e,e.expected?'stopped':'unavailable',e.expected?null:e.code??'WORKER.EXIT');rejectPending('WORKER.CLOSED');e.channel.close();resolveExit({code,signal});
   if(entries.get(poolId)!==e||e.expected||closing)return;
   // Wait for startup or explicit operator operation to finish before recovery.
   void (async()=>{await operations.get(poolId)?.catch(()=>{});if(e.permanent)return;await retry(e);})().catch(()=>invalidate(e,'failed','HOSTING.RECOVERY_REQUIRED'));
  });
  try{
   check(integer(child.pid,1),'WORKER.SPAWN');p.worker={pid:child.pid,generation:e.generation};await save(remaining());check(!closing,'HOSTING.CLOSED');
   await e.request('bootstrap',['accepted','starting','ready','not-ready','rejected','failure'],remaining());
   const current=await approved(poolId,remaining);check(!closing,'HOSTING.CLOSED');check(placementRevision(current.r,poolId)===e.registryDigest,'HOSTING.STALE_REVISION');check(e.ready,'WORKER.NOT_READY');await e.request('readiness',['ready','not-ready','failure'],Math.min(controlMs,remaining()));remaining();check(!closing,'HOSTING.CLOSED');check(e.ready,'WORKER.NOT_READY');
   e.initialized=true;let checking=false;e.heartbeat=setInterval(()=>{if(checking||e.dead||e.expected)return;checking=true;e.request('health',['health','failure']).then(async()=>{const current=await readRegistry();if(placementRevision(current,poolId)!==e.registryDigest)throw protocolError('HOSTING.STALE_REVISION');if(!e.ready){if(e.state==='draining'){clearInterval(e.heartbeat);e.drainTimer=setTimeout(()=>{fail('WORKER.TIMEOUT');},shutdownMs);}else throw protocolError('WORKER.NOT_READY');}}).catch(error=>{e.permanent=error.code?.startsWith('HOSTING.')===true;fail(error.code??'WORKER.HEALTH');}).finally(()=>{checking=false;});},healthMs);
   return view(e);
  }catch(error){e.permanent=true;e.expected=true;await killAndWait(e);invalidate(e,'failed',error.code??'WORKER.STARTUP');throw protocolError(e.code);}
 }
 async function retry(e){
  if(closing||entries.get(e.poolId)!==e||policy(e.poolId).desired!=='running')return;
  const p=policy(e.poolId);if(p.attempts>=maxRestarts){invalidate(e,'failed','HOSTING.CRASH_LOOP');return;}
  p.attempts++;await save();if(closing||entries.get(e.poolId)!==e||p.desired!=='running')return;invalidate(e,'backoff','WORKER.EXIT');await new Promise(resolve=>{const timer=setTimeout(resolve,Math.min(30000,backoffMs*2**(p.attempts-1)));e.cancelRetry=()=>{clearTimeout(timer);resolve();};});e.cancelRetry=null;
  if(closing||entries.get(e.poolId)!==e||p.desired!=='running')return;
  try{await serial(e.poolId,()=>launch(e.poolId,e.options));}catch{invalidate(entries.get(e.poolId)??e,'failed','HOSTING.RECOVERY_REQUIRED');}
 }
 async function stop(e){e.expected=true;invalidate(e,'draining',null);try{await e.request('shutdown',['draining','stopped','failure'],shutdownMs);}catch{}await killAndWait(e);invalidate(e,'stopped',null);}
 return Object.freeze({
  startPool(poolId,options={}){return serial(poolId,async()=>{check(!entries.has(poolId)||entries.get(poolId).dead,'HOSTING.ALREADY_RUNNING');check(policy(poolId).attempts<maxRestarts||maxRestarts===0,'HOSTING.CRASH_LOOP');return launch(poolId,options);});},
  stopPool(poolId){return serial(poolId,async()=>{policy(poolId).desired='stopped';await save();const e=entries.get(poolId);e?.cancelRetry?.();if(e&&!e.dead)await stop(e);return e?view(e):null;});},
  async recoverPool(poolId){return serial(poolId,async()=>{check(!entries.has(poolId)||entries.get(poolId).dead,'HOSTING.OWNERSHIP_UNKNOWN');entries.get(poolId)?.cancelRetry?.();const p=policy(poolId);p.attempts=0;p.desired='stopped';await save();});},
  async readHealth(poolId){check(!closing,'HOSTING.CLOSED');const e=entries.get(poolId);check(e&&!e.dead&&!e.expected,'HOSTING.UNAVAILABLE');await e.request('health',['health','failure']);return view(e);},
  inspectPool(poolId){const e=entries.get(poolId);return e?view(e):sealed({poolId,desired:policy(poolId).desired,state:'not-observed',ready:false,productionReady:false});},
  health(){return sealed({productionReady:false,pools:[...entries.values()].map(view)});},
  shutdown(){return shutdownPromise??=(async()=>{closing=true;for(const e of entries.values())e.cancelRetry?.();for(const p of durable.pools)p.desired='stopped';let writeError;try{await save();}catch(e){writeError=e;}await Promise.allSettled([...operations.values()]);const results=await Promise.allSettled([...entries.values()].filter(e=>!e.dead).map(stop));check(results.every(r=>r.status==='fulfilled')&&[...entries.values()].every(e=>e.dead),'HOSTING.OWNERSHIP_UNKNOWN');if(writeError)throw writeError;await save();await lock.close();await fs.unlink(lockPath);})();}
 });
}
