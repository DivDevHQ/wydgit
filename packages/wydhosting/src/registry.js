import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {check,fail,shape,id,integer,json,digest,sealed,validateRegistry,emptyRegistry} from './contracts.js';
import {safePath,inspectRegistry} from './adapter.js';
import {plan,validatePlan,verifyPlan} from './planning.js';

// Registry and operation journal share ONE atomic envelope. A prepared envelope
// contains the old registry and the exact authorized candidate, never two owners.
function validateEnvelope(input){
 const e=json(input);shape(e,['schema','generation','registry','journal']);check(e.schema==='wydhosting.state/1'&&id(e.generation));validateRegistry(e.registry);check(Array.isArray(e.journal)&&e.journal.length<=1024);const ids=new Set();
 let revision=0,previous=digest(emptyRegistry(e.registry.providerId));for(let i=0;i<e.journal.length;i++){
  const j=e.journal[i];shape(j,['operationId','actor','plan','state','resultRevision']);const p=validatePlan(j.plan);check(j.operationId===p.operationId&&id(j.actor)&&!ids.has(j.operationId)&&['prepared','committed'].includes(j.state)&&integer(j.resultRevision,1)&&j.resultRevision===revision+1&&p.expectedRevision===revision&&p.proposed.revision===j.resultRevision,'HOSTING.RECOVERY_REQUIRED');check(p.baseDigest===previous,'HOSTING.RECOVERY_REQUIRED');ids.add(j.operationId);previous=digest(p.proposed);
  if(j.state==='prepared')check(i===e.journal.length-1&&e.registry.revision===revision&&p.baseDigest===digest(e.registry),'HOSTING.RECOVERY_REQUIRED');else revision=j.resultRevision;
 }
 if(e.journal.length===0)check(digest(e.registry)===previous,'HOSTING.RECOVERY_REQUIRED');
 check(e.registry.revision===revision,'HOSTING.RECOVERY_REQUIRED');const last=e.journal.at(-1);if(last?.state==='committed')check(digest(last.plan.proposed)===digest(e.registry),'HOSTING.RECOVERY_REQUIRED');
 return sealed(e);
}
export function createRegistry({directory,fixtureRoot,authorize,checkpoint=async()=>{},deploymentInspection=inspectRegistry}){
 check(typeof directory==='string'&&path.resolve(directory)===directory,'HOSTING.ROOT');
 const file=path.join(directory,'state.json'),lockFile=path.join(directory,'writer.lock');
 async function boundary(){await safePath(directory);const s=await fs.stat(directory);check(s.isDirectory()&&s.uid===process.getuid()&&(s.mode&0o077)===0,'HOSTING.PERMISSIONS');}
 async function read(){
  await boundary();let handle;try{
   handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);const s=await handle.stat();check(s.isFile()&&s.nlink===1&&s.uid===process.getuid()&&(s.mode&0o077)===0&&s.size<=4*1024*1024,'HOSTING.CORRUPT');const e=validateEnvelope(await handle.readFile('utf8'));await deploymentInspection(e.registry,{stateDirectory:directory,fixtureRoot});return e;
  }catch(e){throw e.code?.startsWith('HOSTING.')?e:fail('HOSTING.CORRUPT');}finally{await handle?.close();}
 }
 async function syncDirectory(){const h=await fs.open(directory,'r');try{await h.sync();}finally{await h.close();}}
 async function replace(e){
  validateEnvelope(e);const temporary=path.join(directory,'pending-'+randomUUID()+'.tmp');let h;
  try{h=await fs.open(temporary,'wx',0o600);await h.writeFile(JSON.stringify(e)+'\n');await h.sync();await h.close();h=null;await fs.rename(temporary,file);await syncDirectory();}finally{await h?.close();await fs.rm(temporary,{force:true});}
 }
 async function exclusive(fn){
  await boundary();let lock;try{lock=await fs.open(lockFile,'wx',0o600);}catch{throw fail('HOSTING.LOCKED');}
  try{await lock.writeFile(JSON.stringify({schema:'wydhosting.writer/1',pid:process.pid})+'\n');await lock.sync();await syncDirectory();return await fn();}finally{await lock.close();await fs.unlink(lockFile);await syncDirectory();}
 }
 async function approve(p){check(typeof authorize==='function','HOSTING.UNAUTHORIZED');const actor=await authorize(sealed(p));check(id(actor),'HOSTING.UNAUTHORIZED');return actor;}
 const result=(e,j,replayed=false)=>sealed({ok:true,operationId:j.operationId,revision:j.resultRevision,generation:e.generation,state:'applied-registry-only',code:'HOSTING.REGISTRY_VERIFIED',replayed,productionReady:false,osStatus:'unsupported',requiredOperations:j.plan.requiredOperations});
 return Object.freeze({
  supervisorStateDirectory:path.join(directory,'supervisor'),
  async initialize(providerId){const request=sealed({schema:'wydhosting.initialize/1',operationId:'initialize',expectedRevision:null,providerId});await approve(request);return exclusive(async()=>{try{await fs.lstat(file);throw fail('HOSTING.CONFLICT');}catch(e){if(e.code!=='ENOENT')throw e;}const e={schema:'wydhosting.state/1',generation:randomUUID(),registry:emptyRegistry(providerId),journal:[]};await replace(e);return sealed(e.registry);});},
  async inspect(){const e=await read();return sealed({registry:e.registry,generation:e.generation,adapter:'local-fixture/1',productionReady:false});},
  async validate(){const e=await read();return deploymentInspection(e.registry,{stateDirectory:directory,fixtureRoot});},
  async plan(request,options={}){const e=await read();check(!e.journal.some(j=>j.state==='prepared'),'HOSTING.RECOVERY_REQUIRED');return plan(e.registry,request,{...options,stateDirectory:directory,fixtureRoot,deploymentInspection});},
  async apply(input,{now=Date.now()}={}){
   const p=validatePlan(input),actor=await approve(p);
   return exclusive(async()=>{
    let e=await read(),j=e.journal.find(j=>j.operationId===p.operationId);
    if(j){check(digest(j.plan)===digest(p),'HOSTING.OPERATION_CONFLICT');if(j.state==='committed')return result(e,j,true);}
    else {check(!e.journal.some(j=>j.state==='prepared'),'HOSTING.RECOVERY_REQUIRED');check(e.journal.length<1024,'HOSTING.JOURNAL_FULL');}
    // Expiration limits starting work. A durable prepare may be finished after
    // expiry only with fresh authorization and the same revision/content.
    await verifyPlan(e.registry,p,{now:j?Math.min(now,p.expiresAt-1):now,stateDirectory:directory,fixtureRoot,deploymentInspection});check(p.applicable,'HOSTING.QUALIFICATION_REQUIRED');
    if(!j){j={operationId:p.operationId,actor,plan:p,state:'prepared',resultRevision:p.proposed.revision};e={...e,generation:randomUUID(),journal:[...e.journal,j]};await replace(e);await checkpoint('prepared');}
    // No OS actions are run. This commit approves registry intent only.
    const committed={...j,state:'committed'};e={...e,generation:randomUUID(),registry:p.proposed,journal:e.journal.map(v=>v.operationId===p.operationId?committed:v)};await replace(e);await checkpoint('committed');
    const verified=await read();check(digest(verified)===digest(e),'HOSTING.RECOVERY_REQUIRED');return result(e,committed);
   });
  },
  async reconcile(input=null,{now=Date.now()}={}){
   const e=await read(),last=e.journal.at(-1);let locked=false;try{await fs.lstat(lockFile);locked=true;}catch(e){if(e.code!=='ENOENT')throw fail('HOSTING.RECOVERY_REQUIRED');}let state=last?.state==='prepared'?'recovery-required':last?'applied-registry-verified':'no-change';
   if(input){const p=validatePlan(input),j=e.journal.find(j=>j.operationId===p.operationId);if(j){state=digest(j.plan)!==digest(p)?'stale-or-conflicting':j.state==='prepared'?'recovery-required':'applied-registry-verified';}else{try{await verifyPlan(e.registry,p,{now,stateDirectory:directory,fixtureRoot,deploymentInspection});state=p.applicable?'planned-not-authorized':'awaiting-unsupported-provisioning';}catch{state='stale-or-conflicting';}}}
   if(locked||last?.state==='prepared')state='recovery-required';
   return sealed({state,revision:e.registry.revision,productionReady:false,osStatus:'unsupported',awaitingOperations:last?.plan.requiredOperations??[],code:state==='recovery-required'?'HOSTING.RECOVERY_REQUIRED':'HOSTING.RECONCILED'});
  }
 });
}
