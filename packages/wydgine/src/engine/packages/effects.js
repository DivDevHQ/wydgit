// Recoverable host-only effects for stopped Apps. Catalog publication is the
// commit point; adapter checkpoints make precommit compensation repeatable.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { clean, WydgitError, requireThat as check } from '../object-model/validation.js';
import { STATE, digest, safeRead, baseFingerprint, stateFingerprint, validateInstalledState } from './state.js';
import { LIMITS } from './manifest.js';
import { authorizeLifecycle, createPackageBudget, packageBudget } from './budget.js';
import { repositoryFromState } from '../repository.js';
import { storeLifecycle } from './store-lifecycle.js';
import { claimRecovery } from './recovery-claim.js';

async function syncStoreDirectory(root){const h=await fs.open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await h.sync();}finally{await h.close();}}
export const EFFECTS='content/package-effects.json';
const LOCK='content/.package-install.lock',RECOVERY='content/.package-recovery.lock';
const serialized=value=>JSON.stringify(clean(value),null,2)+'\n';
const same=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
async function read(file,max=LIMITS.state) {
  let h;
  try{h=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const info=await h.stat();check(info.isFile()&&info.nlink===1&&info.size<=max,'PACKAGE.RECOVERY','Unsafe lifecycle evidence');return await h.readFile('utf8');}
  catch(e){if(e.code==='ENOENT')return null;throw e;}finally{await h?.close();}
}
async function atomic(file,text) {
  const temporary=file+'.'+randomUUID()+'.tmp';let h;
  try{
    if(text===null){if(await read(file)!==null)await fs.unlink(file);}
    else{h=await fs.open(temporary,'wx',0o600);await h.writeFile(text);await h.sync();await h.close();h=null;await fs.rename(temporary,file);}
    await syncStoreDirectory(path.dirname(file));
  }finally{await h?.close();await fs.unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function save(root,record){await atomic(path.join(root,EFFECTS),serialized(record));}
function alive(pid){check(Number.isSafeInteger(pid)&&pid>0,'PACKAGE.RECOVERY','Invalid writer identity');try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}}
const directoryClaim=(id,directory)=>JSON.stringify({schema:'wydgit.package-directory/1',id,directory});
const marker=(id,directory)=>path.join(directory,'.package-owner-'+id);
async function ensureDirectory(directory,id,root) {
  const {safeRoot}=await storeLifecycle(root);
  const claim=marker(id,directory),expected=directoryClaim(id,directory);
  const info=await fs.lstat(directory).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
  if(info){await safeRoot(directory);check(await read(claim,1024)===expected,'PACKAGE.OWNERSHIP','Provisioned directory is not owned by this operation');return;}
  const scratch=path.join(path.dirname(directory),'.package-directory-'+id+'-'+path.basename(directory));
  await fs.mkdir(scratch,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});await safeRoot(scratch);
  const contents=await fs.readdir(scratch);check(contents.length===0||contents.length===1&&contents[0]===path.basename(claim),'PACKAGE.OWNERSHIP','Unknown private provisioning contents');
  const scratchClaim=path.join(scratch,path.basename(claim));
  if(contents.length)check(await read(scratchClaim,1024)===expected,'PACKAGE.OWNERSHIP','Directory claim differs');
  else{const h=await fs.open(scratchClaim,'wx',0o600);try{await h.writeFile(expected);await h.sync();}finally{await h.close();}}
  await syncStoreDirectory(scratch);await fs.rename(scratch,directory);await syncStoreDirectory(path.dirname(directory));
}
async function directoryList(root,roots) {
  const directories=new Set();
  const safeRoot=roots.length?(await storeLifecycle(root)).safeRoot:null;
  for(const requested of roots){
    check(path.isAbsolute(requested)&&requested.startsWith(root+path.sep)&&!['content','prototypes','public','node_modules','packages','scripts','docs','test','wydgine','wydclient'].includes(path.relative(root,requested).split(path.sep)[0]),'PACKAGE.PATH','Invalid provisioning root');
    let cursor=requested;
    while(!await fs.lstat(cursor).catch(e=>{if(e.code!=='ENOENT')throw e;return null;})){directories.add(cursor);cursor=path.dirname(cursor);}
    await safeRoot(cursor);
  }
  return [...directories].sort((a,b)=>a.split(path.sep).length-b.split(path.sep).length||a.localeCompare(b));
}
export async function resourceSummary(resources,root){if(!resources.length)return [];const {checkpointHash,storeOwner}=await storeLifecycle(root);return resources.map(r=>({store:(r.afterDefinition??r.beforeDefinition).id,provider:(r.afterDefinition??r.beforeDefinition).provider,owner:storeOwner(r.afterDefinition??r.beforeDefinition),before:checkpointHash(r.before),after:checkpointHash(r.after),collections:(r.afterDefinition??r.beforeDefinition).collections}));}
async function currentResource(resource,root) {
  const {snapshotStore}=await storeLifecycle(root);
  const definitions=[resource.beforeDefinition,resource.afterDefinition].filter(Boolean);
  let last;
  for(const definition of definitions){try{return {definition,document:await snapshotStore(definition)};}catch(e){last=e;}}
  throw last;
}
async function transition(resource,forward,id,atStage,root) {
  const {snapshotStore,replaceStore,checkpointHash,discardStoreTemporary}=await storeLifecycle(root);
  const source=forward?resource.before:resource.after,target=forward?resource.after:resource.before;
  const targetDefinition=forward?resource.afterDefinition:resource.beforeDefinition;
  const current=await currentResource(resource,root),hash=checkpointHash(current.document);
  check(hash===checkpointHash(source)||hash===checkpointHash(target),'PACKAGE.DRIFT','Adapter content changed outside the operation');
  if(target===null||hash!==checkpointHash(target))await replaceStore(current.definition,targetDefinition,target,id,atStage);
  const accepted=target===null?await snapshotStore(resource.afterDefinition??resource.beforeDefinition):await snapshotStore(targetDefinition);
  check(checkpointHash(accepted)===checkpointHash(target),'PACKAGE.RECOVERY','Adapter did not reach its checkpoint');
  await discardStoreTemporary(resource.afterDefinition??resource.beforeDefinition,id);
}
async function validateState(root,text){if(text!==null){const state=JSON.parse(text);validateInstalledState(root,state);repositoryFromState(root,state);}}
async function cleanup(root,record,checkpoint,forward) {
  const unlockStore=checkpoint.resources.length?(await storeLifecycle(root)).unlockStore:null;
  for(const r of checkpoint.resources){const d=r.afterDefinition??r.beforeDefinition;if(await fs.lstat(d.root).catch(()=>null))await unlockStore(d,record.id);}
  for(const directory of [...checkpoint.directories].reverse()) {
    const claim=marker(record.id,directory),value=await read(claim,1024);
    if(value!==null){
      check(value===directoryClaim(record.id,directory),'PACKAGE.OWNERSHIP','Changed directory ownership');
      if(!forward){
        const contents=await fs.readdir(directory);check(contents.length===1&&contents[0]===path.basename(claim),'PACKAGE.OWNERSHIP','Preserve unknown contents in the owned directory');
        record.directoryCleanup??=[];if(!record.directoryCleanup.includes(directory)){record.directoryCleanup.push(directory);await save(root,record);}
      }
      await fs.unlink(claim);await syncStoreDirectory(directory);
    }
    if(!forward){
      const exists=await fs.lstat(directory).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
      if(exists){check(record.directoryCleanup?.includes(directory),'PACKAGE.OWNERSHIP','Unclaimed directory must be retained');await fs.rmdir(directory);await syncStoreDirectory(path.dirname(directory));}
      const scratch=path.join(path.dirname(directory),'.package-directory-'+record.id+'-'+path.basename(directory));
      if(await fs.lstat(scratch).catch(e=>{if(e.code!=='ENOENT')throw e;return null;})){
        await (await storeLifecycle(root)).safeRoot(scratch);const contents=await fs.readdir(scratch),scratchClaim=path.join(scratch,path.basename(claim));
        check(contents.length===0||contents.length===1&&contents[0]===path.basename(claim)&&await read(scratchClaim,1024)===directoryClaim(record.id,directory),'PACKAGE.OWNERSHIP','Unknown private directory contents');
        if(contents.length)await fs.unlink(scratchClaim);await fs.rmdir(scratch);await syncStoreDirectory(path.dirname(scratch));
      }
    }
  }
  const lock=JSON.parse(await read(path.join(root,LOCK),4096));check(lock.id===record.id&&lock.type==='effects','PACKAGE.RECOVERY','Writer lock changed');
  await fs.unlink(path.join(root,LOCK));await syncStoreDirectory(path.join(root,'content'));
}
async function reconcile(root,record,checkpoint,forward,atStage,budget) {
  const currentConfig=await read(path.join(root,'wydgit.config.json')),currentState=await read(path.join(root,STATE));
  const preserveExternalConfig=!forward&&!record.config&&currentState===checkpoint.stateBefore&&![checkpoint.configBefore,checkpoint.configAfter].includes(currentConfig);
  check((preserveExternalConfig||[checkpoint.configBefore,checkpoint.configAfter].includes(currentConfig))&&[checkpoint.stateBefore,checkpoint.stateAfter].includes(currentState),'PACKAGE.DRIFT','Configuration or catalog changed during the operation');
  check(baseFingerprint(root,checkpoint.configBefore)===checkpoint.baseBefore,'PACKAGE.DRIFT','Base resources changed');
  if(forward)for(const directory of checkpoint.directories){budget?.take();if(record.status!=='COMPLETED')await ensureDirectory(directory,record.id,root);else await (await storeLifecycle(root)).safeRoot(directory);await atStage?.('DIRECTORY');}
  const lockStore=checkpoint.resources.length?(await storeLifecycle(root)).lockStore:null;
  for(const r of checkpoint.resources){budget?.take();const d=r.afterDefinition??r.beforeDefinition;if(await fs.lstat(d.root).catch(()=>null))await lockStore(d,record.id);}
  record.status=forward?'APPLYING':'COMPENSATING';await save(root,record);await atStage?.(record.status);
  const ordered=forward?checkpoint.resources:[...checkpoint.resources].reverse();
  for(let i=0;i<ordered.length;i++) {
    budget?.take();await atStage?.((forward?'BEFORE_RESOURCE_':'COMPENSATING_RESOURCE_')+i);
    const resource=ordered[i],d=resource.afterDefinition??resource.beforeDefinition;
    if(await fs.lstat(d.root).catch(()=>null))await transition(resource,forward,record.id,atStage,root);
    else check(!forward&&resource.before===null,'PACKAGE.RECOVERY','Missing adapter root');
    record.resource=i+1;await save(root,record);await atStage?.((forward?'RESOURCE_':'COMPENSATED_RESOURCE_')+i);
  }
  await atStage?.('RESOURCES_APPLIED');budget?.take();
  const desiredConfig=forward?checkpoint.configAfter:checkpoint.configBefore;
  // Compare again after every await/hook so an operator edit is never replaced.
  await atStage?.('BEFORE_CONFIG');
  check(preserveExternalConfig||[checkpoint.configBefore,checkpoint.configAfter].includes(await read(path.join(root,'wydgit.config.json'))),forward?'PACKAGE.STALE':'PACKAGE.DRIFT','Configuration changed before replacement');
  if(!preserveExternalConfig)await atomic(path.join(root,'wydgit.config.json'),desiredConfig);record.config=forward?'after':'before';await save(root,record);await atStage?.('CONFIG');budget?.take();
  const desiredState=forward?checkpoint.stateAfter:checkpoint.stateBefore;
  await atStage?.('BEFORE_CATALOG');
  check([checkpoint.stateBefore,checkpoint.stateAfter].includes(await read(path.join(root,STATE)))&&(preserveExternalConfig||await read(path.join(root,'wydgit.config.json'))===desiredConfig),'PACKAGE.DRIFT','Accepted state changed before publication');
  if(!preserveExternalConfig)await validateState(root,desiredState);
  await atomic(path.join(root,STATE),desiredState);
  record.status=forward?'COMPLETED':'ROLLED_BACK';await save(root,record);await atStage?.('CATALOG');
  await cleanup(root,record,checkpoint,forward);await atStage?.('UNLOCKED');
  return record;
}
export async function publishPackageEffects({root,plan,state,configAfter,resources=[],roots=[],budget,atStage}) {
  root=path.resolve(root);
  const id=randomUUID(),checkpointName=`package-checkpoint-${id}.json`,configBefore=await read(path.join(root,'wydgit.config.json')),stateBefore=await read(path.join(root,STATE));
  const checkpoint={schema:'wydgit.package-checkpoint/1',id,app:JSON.parse(state.app).id,package:plan.package,action:plan.action,baseBefore:plan.baseFingerprint,configBefore,configAfter:configAfter??configBefore,stateBefore,stateAfter:serialized(state),resources:clean(resources),directories:await directoryList(root,roots)};
  const text=serialized(checkpoint);check(Buffer.byteLength(text)<=LIMITS.state,'PACKAGE.LIMIT','Lifecycle checkpoint exceeds the bounded recovery size');
  const provider=resources.length?await storeLifecycle(root):null;
  for(const r of resources)if(r.beforeDefinition&&r.afterDefinition)check(same(provider.storeOwner(r.beforeDefinition),provider.storeOwner(r.afterDefinition))&&r.beforeDefinition.root===r.afterDefinition.root&&r.beforeDefinition.provider===r.afterDefinition.provider,'PACKAGE.OWNERSHIP','Migration cannot change store ownership or adapter');
  budget.take();let handle,record;
  try{
    try{handle=await fs.open(path.join(root,LOCK),'wx',0o600);}catch(e){if(e.code==='EEXIST')throw new WydgitError('PACKAGE.BUSY','Another lifecycle operation holds the lock');throw e;}
    await handle.writeFile(JSON.stringify({schema:'wydgit.package-lock/1',type:'effects',id,pid:process.pid}));await handle.sync();await syncStoreDirectory(path.join(root,'content'));
    check(baseFingerprint(root)===plan.baseFingerprint&&stateFingerprint(root)===plan.catalogFingerprint,'PACKAGE.STALE','State changed; plan again');
    for(const requested of roots)check(!await fs.lstat(requested).catch(e=>{if(e.code!=='ENOENT')throw e;return null;}),'PACKAGE.STALE','A prospective provisioning root is no longer unused');
    for(const resource of resources){const definition=resource.beforeDefinition??resource.afterDefinition;if(await fs.lstat(definition.root).catch(()=>null)){const current=await currentResource(resource,root);check(provider.checkpointHash(current.document)===provider.checkpointHash(resource.before),'PACKAGE.STALE','Adapter content changed after planning');}}
    const h=await fs.open(path.join(root,'content',checkpointName),'wx',0o600);try{await h.writeFile(text);await h.sync();}finally{await h.close();}await syncStoreDirectory(path.join(root,'content'));
    record={schema:'wydgit.package-effects/1',id,pid:process.pid,checkpoint:checkpointName,sha256:digest(text),action:plan.action,package:plan.package,status:'PLANNED',resources:await resourceSummary(resources,root)};
    await save(root,record);await atStage?.('PLANNED');budget.take();
    const result=await reconcile(root,record,checkpoint,true,atStage,budget);
    return Object.freeze({schema:'wydgit.package-operation-result/1',id,status:'COMPLETED',revision:state.revision,changes:plan.changes,meter:budget.snapshot(),checkpoint:checkpointName,resources:result.resources});
  }catch(error){
    if(record){
      // Publication settles the operation even when its acknowledgement was lost.
      if(await read(path.join(root,STATE))===checkpoint.stateAfter)throw new WydgitError('PACKAGE.RECOVERY','Catalog committed; complete durable recovery before retrying');
      try{await reconcile(root,record,checkpoint,false,atStage);}catch{
        record.status='NEEDS_RECOVERY';await save(root,record).catch(()=>{});
        throw new WydgitError('PACKAGE.RECOVERY','Compensation incomplete; retain checkpoint and writer barriers');
      }
    }else if(handle){await fs.unlink(path.join(root,LOCK));await syncStoreDirectory(path.join(root,'content'));}
    throw error;
  }finally{await handle?.close();}
}
async function loadCheckpoint(root,record) {
  check(record?.schema==='wydgit.package-effects/1'&&/^[a-f0-9-]{36}$/.test(record.id)&&record.checkpoint===`package-checkpoint-${record.id}.json`,'PACKAGE.RECOVERY','Invalid recovery record');
  const text=await read(path.join(root,'content',record.checkpoint));check(text!==null&&digest(text)===record.sha256,'PACKAGE.RECOVERY','Checkpoint integrity failure');
  const checkpoint=JSON.parse(text);check(checkpoint.schema==='wydgit.package-checkpoint/1'&&checkpoint.id===record.id&&checkpoint.package===record.package,'PACKAGE.RECOVERY','Checkpoint identity mismatch');return checkpoint;
}
async function recoverEffects({root,installationContext,direction,atStage,budget:token}) {
  root=path.resolve(root);const record=JSON.parse(await read(path.join(root,EFFECTS))),checkpoint=await loadCheckpoint(root,record);
  authorizeLifecycle(installationContext,checkpoint.app);
  const lock=JSON.parse(await read(path.join(root,LOCK),4096));
  check(direction===undefined||['resume','rollback'].includes(direction),'PACKAGE.ACTION','Unknown recovery direction');
  if(lock===null){
    const forward=record.status==='COMPLETED';
    check(forward||record.status==='ROLLED_BACK','PACKAGE.RECOVERY','Nonterminal operation lost its writer barrier');
    check(!forward||direction!=='rollback','PACKAGE.RECOVERY','Committed rollback needs a new checked operation');
    check(await read(path.join(root,STATE))===(forward?checkpoint.stateAfter:checkpoint.stateBefore)&&await read(path.join(root,'wydgit.config.json'))===(forward?checkpoint.configAfter:checkpoint.configBefore),'PACKAGE.DRIFT','Terminal operation no longer matches its checkpoint');
    const provider=checkpoint.resources.length?await storeLifecycle(root):null;
    for(const resource of checkpoint.resources){const target=forward?resource.after:resource.before,definition=resource.afterDefinition??resource.beforeDefinition;if(await fs.lstat(definition.root).catch(()=>null)){const current=await currentResource(resource,root);check(provider.checkpointHash(current.document)===provider.checkpointHash(target),'PACKAGE.DRIFT','Terminal adapter content changed');}else check(target===null,'PACKAGE.DRIFT','Terminal adapter root is missing');}
    const previous=await read(path.join(root,RECOVERY),4096);
    if(previous!==null){const release=await claimRecovery(root,record.id);try{const old=JSON.parse(await read(path.join(root,RECOVERY),4096));check(old?.id===record.id&&!alive(old.pid),'PACKAGE.BUSY','Recovery is still running');await fs.unlink(path.join(root,RECOVERY));await syncStoreDirectory(path.join(root,'content'));}finally{await release();}}
    return record;
  }
  check(lock?.type==='effects'&&lock.id===record.id&&lock.pid===record.pid,'PACKAGE.RECOVERY','Recovery lock does not match the operation');
  check(!alive(lock.pid),'PACKAGE.BUSY','The lifecycle writer is still alive');
  let recovery,release;
  try{
    release=await claimRecovery(root,record.id);
    const previous=await read(path.join(root,RECOVERY),4096);
    if(previous!==null){const old=JSON.parse(previous);check(old.id===record.id&&!alive(old.pid),'PACKAGE.BUSY','Recovery is running or its ownership is unknown');await fs.unlink(path.join(root,RECOVERY));}
    recovery=await fs.open(path.join(root,RECOVERY),'wx',0o600);await recovery.writeFile(JSON.stringify({id:record.id,pid:process.pid}));await recovery.sync();await syncStoreDirectory(path.join(root,'content'));
    const committed=await read(path.join(root,STATE))===checkpoint.stateAfter;
    check(direction===undefined||['resume','rollback'].includes(direction),'PACKAGE.ACTION','Unknown recovery direction');
    check(!committed||direction!=='rollback','PACKAGE.RECOVERY','A committed operation requires a new, explicitly checked rollback plan');
    token??=createPackageBudget(installationContext);const budget=packageBudget(token,installationContext);budget.take();
    return await reconcile(root,record,checkpoint,committed||direction==='resume',atStage,budget);
  }catch(e){if(e instanceof WydgitError)throw e;throw new WydgitError('PACKAGE.RECOVERY','Adapter recovery could not be completed; evidence retained');}
  finally{try{if(recovery){await recovery.close();await fs.unlink(path.join(root,RECOVERY));await syncStoreDirectory(path.join(root,'content'));}}finally{await release?.();}}
}

export async function recoverPackageEffects(options){
  try{return await recoverEffects(options);}catch(e){if(e instanceof WydgitError)throw e;throw new WydgitError('PACKAGE.RECOVERY','Unrecognized recovery evidence; preserve markers for inspection');}
}

export function inspectPackageEffects(root) {
  try{return JSON.parse(safeRead(root,EFFECTS,LIMITS.state));}catch(e){if(e.code==='ENOENT')return null;throw e;}
}
export async function rollbackPackageEffects({root,installationContext,budget:token,atStage}) {
  root=path.resolve(root);const record=inspectPackageEffects(root),checkpoint=await loadCheckpoint(root,record);
  authorizeLifecycle(installationContext,checkpoint.app);
  check(record.status==='COMPLETED'&&['update','upgrade'].includes(checkpoint.action)&&checkpoint.stateBefore!==null,'PACKAGE.ROLLBACK_UNSUPPORTED','Only a completed checkpointed update or upgrade can be rolled back');
  check(await read(path.join(root,LOCK),4096)===null&&await read(path.join(root,RECOVERY),4096)===null,'PACKAGE.BUSY','Lifecycle recovery must finish first');
  check(await read(path.join(root,'wydgit.config.json'))===checkpoint.configAfter&&await read(path.join(root,STATE))===checkpoint.stateAfter,'PACKAGE.STALE','Committed state changed; rollback would replace newer configuration or content');
  const state=JSON.parse(checkpoint.stateBefore);state.revision=JSON.parse(checkpoint.stateAfter).revision+1;
  check(Number.isSafeInteger(state.revision),'PACKAGE.LIMIT','Catalog revision exhausted');
  const plan={action:'rollback',package:checkpoint.package,baseFingerprint:baseFingerprint(root),catalogFingerprint:stateFingerprint(root),changes:[{package:checkpoint.package,action:'rollback'}]};
  token??=createPackageBudget(installationContext);const budget=packageBudget(token,installationContext);budget.take();
  const resources=checkpoint.resources.map(r=>({beforeDefinition:r.afterDefinition,afterDefinition:r.beforeDefinition,before:r.after,after:r.before}));
  return publishPackageEffects({root,plan,state,configAfter:checkpoint.configBefore,resources,budget,atStage});
}
