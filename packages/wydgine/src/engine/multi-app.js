// Trusted Node host composition. Never imported by portable code or WydClient.
import {snapshotStoppedApp} from './relocation.js';
import {createGovernance} from './governance.js';
import {createServer} from 'node:http';
import {resolveRoute,bindRequestRoute,bindUnixPeer} from './http/routing.js';
import {createHostApp} from '../app.js';
import {validateAppInventory,snapshotAppConfiguration as snapshot,executionLimits as limits} from './inventory.js';
import {ExecutionContext,checkContext} from './seam/context.js';
import {clean,freeze,record,requireThat as check,WydgitError} from './object-model/validation.js';
export {validateAppInventory} from './inventory.js';
const fail=(code='HOST.INVALID')=>new WydgitError(code,'Multi-App host operation failed');
export async function createMultiAppHost(input,options={}){
 const declaration=typeof input==='string'?input:freeze(clean(input));
 const inventory=await validateAppInventory(declaration,options),entries=new Map(inventory.apps.map(a=>[a.id,{...a,meter:createGovernance(a.resources),state:'configured',pending:new Set(),servers:new Set(),responses:new Set()}])),tokens=new WeakMap(),contexts=new WeakMap(),providerOwners=new WeakMap();const sharedServers=new Set();let disposed=false,disposing,terminal=false,cleanupFailed=false;const created=performance.now();
 const get=id=>{check(!disposed&&entries.has(id),'HOST.UNKNOWN','Unknown App selection');return entries.get(id);};
 const active=token=>{const e=tokens.get(token);check(!disposed&&e?.state==='active'&&!e.stopRequested,'HOST.RETIRED','Invalid or retired App binding');return e;};
 const status=e=>Object.freeze({id:e.id,state:e.state,pending:e.pending.size});
 const setState=(e,state)=>{e.state=state;e.meter.transition(state);};
 const admit=(e,kind='http')=>{guard(e);check(e.state==='active'&&!e.stopRequested,'HOST.RETIRED','App unavailable');const release=e.meter.admit(kind);let done;const pending=new Promise(r=>done=r);e.pending.add(pending);let finished=false;return failed=>{if(!finished){finished=true;e.pending.delete(pending);release(failed);done();}};};
 const guard=e=>{
  check(['initializing','active','stopping'].includes(e.state)&&!e.retired,'HOST.RETIRED','App unavailable');
  let matches=false;try{matches=snapshot(e.root)===e.snapshot;}catch{}
  if(!matches){if(e.state==='active'){e.retired=true;e.failure='APP.STALE';stop(e).catch(()=>{});}throw fail('HOST.STALE');}
 };
 const bounded=async (work,ms=inventory.shutdownMs)=>{
  let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('HOST.TIMEOUT')),ms);})]);}finally{clearTimeout(timer);}
 };
 const adapters=id=>Object.fromEntries(Object.entries(options.libraryAdapters?.[id]??{}).map(([library,adapter])=>{
  const claim=value=>{check(value&&typeof value==='object'&&(!providerOwners.has(value)||providerOwners.get(value)===id),'HOST.OWNER','Shared mutable service adapter');providerOwners.set(value,id);return value;};
  const selected={...adapter};if(selected.source)selected.source=claim(selected.source);
  if(typeof selected.provider==='function'){const factory=selected.provider;selected.provider=async(...args)=>claim(await factory(...args));}
  return [library,selected];
 }));
 const stop=async e=>{
  if(e.stopping)return e.stopping;
  if(['stopped','failed','configured'].includes(e.state)){if(e.state==='configured')setState(e,'stopped');return;}
  e.stopRequested=true;if(e.state==='active')setState(e,'stopping');
  e.stopping=(async()=>{
   if(e.starting)try{await e.starting;}catch{}
   if(!['active','stopping'].includes(e.state))return;
   setState(e,'stopping');let failed=e.retired===true;const priorErrors=e.app.locals.lifecycle.errors().length;
   const closes=[...e.servers].map(server=>new Promise(r=>server.close(()=>r())));
   try{await bounded(Promise.all([...e.pending,...closes]));}catch{failed=true;e.failure='APP.DRAIN_TIMEOUT';for(const server of e.servers)server.closeAllConnections();for(const res of e.responses)res.destroy();}
   if(failed)e.retired=true;
   try{await bounded(e.app.stop());if(e.app.locals.lifecycle.errors().length>priorErrors)failed=true;}catch{failed=true;}
   e.retired=true;try{await bounded(e.app.locals.libraries.close());}catch{failed=true;}e.servers.clear();if(failed)e.failure??='APP.CLEANUP';setState(e,failed?'failed':'stopped');if(failed)throw fail('HOST.CLEANUP');
  })();return e.stopping;
 };
 return Object.freeze({
  async snapshotApp(id,target){const e=entries.get(id);check(e?.state==='stopped'&&e.pending.size===0&&!e.exporting,'HOST.RELOCATION','App must be cleanly stopped');check(snapshot(e.root)===e.snapshot,'HOST.STALE','Stopped App configuration changed');e.exporting=true;try{return await snapshotStoppedApp(e.root,id,target,options.execution?.[id]);}finally{e.exporting=false;}},
  health(){
   const apps=[...entries.values()].map(e=>{const usage=e.meter.snapshot(),saturated=usage.work.current>=e.resources.maxPending||usage.classes.http.current>=e.resources.httpConcurrent||usage.classes.direct.current>=e.resources.directConcurrent,ready=e.state==='active'&&!e.stopRequested&&!e.retired&&usage.quota.remaining>0;
    const warnings=[];if(e.state==='failed')warnings.push('APP.FAILED');if(e.failure==='APP.DRAIN_TIMEOUT')warnings.push('DRAIN.DEADLINE');if(!ready)warnings.push('APP.NOT_READY');if(usage.work.current*5>=e.resources.maxPending*4)warnings.push('ADMISSION.NEAR_LIMIT');if(usage.classes.http.overloadRejected+usage.classes.direct.overloadRejected>=3)warnings.push('ADMISSION.REJECTED');if(usage.quota.consumed*5>=usage.quota.allowance*4)warnings.push('PAYLOAD.NEAR_LIMIT');if(Object.values(usage.services).some(v=>v.failed>=3))warnings.push('SERVICE.FAILURES');if(usage.execution.pageLimitFailures)warnings.push('EXECUTION.LIMIT');
    return {id:e.id,state:e.state,ready,saturated,draining:e.state==='stopping',failure:e.state==='failed'?(e.failure??'APP.UNAVAILABLE'):null,pending:e.pending.size,activationMs:e.activationMs??null,executionLimits:e.limits,usage,warnings};});
   const sum=f=>Math.min(Number.MAX_SAFE_INTEGER,apps.reduce((n,a)=>n+f(a),0));
   return freeze(clean({live:true,state:disposed?(terminal?(cleanupFailed?'failed':'stopped'):'stopping'):'running',ready:!disposed&&apps.every(a=>a.ready),ageMs:Math.floor(performance.now()-created),apps,capacity:{scope:'configured-logical-capacity',configured:apps.length,active:apps.filter(a=>a.state==='active').length,ready:apps.filter(a=>a.ready).length,saturated:apps.filter(a=>a.saturated).length,current:sum(a=>a.usage.work.current),sumAppPeaks:sum(a=>a.usage.work.peak),acceptedPayloadBytes:sum(a=>a.usage.traffic.acceptedBytes),quotaRejections:sum(a=>a.usage.classes.http.quotaRejected+a.usage.traffic.quotaRejectedWrites),serviceFailures:sum(a=>Object.values(a.usage.services).reduce((n,v)=>n+v.failed,0)),executionLimitFailures:sum(a=>a.usage.execution.pageLimitFailures)}}));
  },
  status(){return Object.freeze([...entries.values()].map(status));},
  usage(...args){check(args.length<=1,'HOST.METER','Invalid usage selection');const selected=args.length?[active(args[0])]:[...entries.values()];return freeze(selected.map(e=>({...status(e),usage:e.meter.snapshot(),executionLimits:e.limits})));},
  async activate(id){
   const e=get(id);check(!e.stopRequested,'HOST.STATE','App stopping');if(['initializing','active'].includes(e.state))return e.starting;check(e.state==='configured','HOST.STATE','App cannot activate');setState(e,'initializing');
   e.starting=(async()=>{try{
    const activating=performance.now();const deadline=Date.now()+inventory.startupMs;const current=await bounded(validateAppInventory(declaration,options),inventory.startupMs);check(current.apps.find(a=>a.id===id)?.snapshot===e.snapshot,'HOST.STALE','Application configuration changed');
    // Apply reductions after ordinary package/context resolution; never union grants.
    const execution={...options.execution?.[id]};
    const contextPolicy=context=>{checkContext(context);check(context.app===id,'HOST.OWNER','Wrong App context');return new ExecutionContext({...context,limits:{...context.limits,...Object.fromEntries(Object.entries(e.limits).map(([k,v])=>[k,Math.min(v,context.limits[k]??v)]))}});};
    execution.lifecycleContext=contextPolicy(execution.lifecycleContext??new ExecutionContext({publisher:'wydgit.core',self:id,app:id}));
    check(Date.now()<deadline,'HOST.TIMEOUT','App startup deadline');
    const pending=createHostApp({root:e.root,implementationRoot:options.implementationRoot,appId:id,execution,contextPolicy,parking:inventory.routing?.parking.includes(id)??false,libraryAdapters:adapters(id),guard:()=>guard(e),strictStartup:true,logger:options.logger??{error(){}},admit:()=>admit(e),governance:e.meter});
    pending.then(app=>{if(e.retired)app.stop().catch(()=>{});},()=>{});
    e.app=await bounded(pending,Math.max(1,deadline-Date.now()));check(Date.now()<deadline,'HOST.TIMEOUT','App startup deadline');
    e.activationMs=Math.floor(performance.now()-activating);setState(e,'active');e.token=Object.freeze(Object.create(null));tokens.set(e.token,e);return e.token;
   }catch{e.retired=true;e.failure='APP.STARTUP';setState(e,'failed');if(e.app)try{await bounded(e.app.stop());}catch{}throw fail('HOST.STARTUP');}})();return e.starting;
  },
  select(id){const e=get(id);check(e.state==='active'&&!e.stopRequested,'HOST.RETIRED','App unavailable');return e.token;},
  context(token,input){const e=active(token);check(record(input)&&!Object.hasOwn(input,'app'),'HOST.OWNER','App identity is host-bound');const requested=limits(input.limits);const context=new ExecutionContext({...input,app:e.id,limits:{...requested,...Object.fromEntries(Object.entries(e.limits).map(([k,v])=>[k,Math.min(v,requested[k]??v)]))}});contexts.set(context,e);return context;},
  bind(token,context){const e=active(token);checkContext(context);check(context.app===e.id&&contexts.get(context)===e,'HOST.OWNER','Wrong App context');const dispatch=e.app.locals.libraries.bind(context);return Object.freeze(Object.fromEntries(['call','invoke'].map(name=>[name,async(...args)=>{active(token);const release=admit(e,'direct');let failed=true;try{const result=await dispatch[name](...args);failed=result?.ok!==true;return result;}finally{release(failed);}}])));},
  async listen(token,...args){
   const e=active(token);check(!e.servers.size,'HOST.STATE','App listener already configured');let server;
   try{
    server=e.app.listen(...args);e.servers.add(server);
    const retire=()=>{if(e.state==='active')stop(e).catch(()=>{});};server.once('close',retire);server.once('error',retire);
    await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});return server;
   }catch{if(server)e.servers.delete(server);try{await stop(e);}catch{}throw fail('HOST.LISTEN');}
  },
  async listenShared(...args){
   check(!disposed&&inventory.routing&&!sharedServers.size,'HOST.STATE','Shared routing unavailable');
   const unix=inventory.routing.transport.mode==='private-unix';
   check(!unix||(typeof options.peerCredentials==='function'&&args.length===1&&typeof args[0]==='string'&&args[0].startsWith('/')),'HOST.LISTEN','Private Unix transport unavailable');
   // Strict host policy runs on the original native request before App adaptation.
   const server=createServer({maxHeaderSize:inventory.http.headerBytes},(req,res)=>{
    const reject=status=>{res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Connection','close');res.end(status===503?'Application unavailable':'Request rejected');};
    if(disposed)return reject(503);
    if(req.rawHeaders.length/2>inventory.http.headerCount)return reject(431);
    let route;try{route=resolveRoute(inventory.routing,req);}catch{return reject(400);}
    if(!route)return reject(421);
    const e=entries.get(route.app);if(e.state!=='active'||e.stopRequested)return reject(503);
    bindRequestRoute(req,route);
    e.responses.add(res);const release=()=>e.responses.delete(res);res.once('finish',release);res.once('close',release);
    e.app.handle(req,res);
   });
   if(unix)server.on('connection',socket=>{try{const peer=options.peerCredentials(socket);check(peer.uid===inventory.routing.transport.uid,'HOST.PEER','Unauthorized ingress');bindUnixPeer(socket,peer);}catch{socket.destroy();}});
   server.requestTimeout=inventory.http.requestMs;server.headersTimeout=Math.min(15000,inventory.http.requestMs);server.maxHeadersCount=0;
   sharedServers.add(server);server.once('close',()=>sharedServers.delete(server));
   try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(...args,resolve);});return server;}
   catch{sharedServers.delete(server);server.close();throw fail('HOST.LISTEN');}
  },
  async stop(token){const e=tokens.get(token);check(e,'HOST.RETIRED','Unknown App binding');return stop(e);},
  dispose(){return disposing??=(async()=>{disposed=true;const closes=[...sharedServers].map(server=>new Promise(resolve=>server.close(()=>resolve())));const results=await Promise.allSettled([...entries.values()].map(stop));try{await bounded(Promise.all(closes));}catch{for(const server of sharedServers)server.closeAllConnections();results.push({status:'rejected'});}terminal=true;cleanupFailed=results.some(r=>r.status==='rejected');if(cleanupFailed)throw fail('HOST.CLEANUP');})();}
 });
}
