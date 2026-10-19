// Single local-filesystem publication boundary shared with the native installer.
// No package hook or storage mutation is executed here.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireThat as check, WydgitError } from '../object-model/validation.js';
import { STATE, digest, stateFingerprint, baseFingerprint, safeRead, validateInstalledState } from './state.js';
import { LIMITS } from './manifest.js';
import { reserveStoppedApp } from '../execution/maintenance.js';
import { authorizePolicy } from './policy-contract.js';
import { authorizeLifecycle } from './budget.js';
export const JOURNAL='content/package-operation.json';
const LOCK='content/.package-install.lock',RECOVERY='content/.package-recovery.lock';
async function syncDirectory(root){const h=await fs.open(path.join(root,'content'),constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await h.sync();}finally{await h.close();}}
async function writeExclusive(file,text){const h=await fs.open(file,'wx',0o600);try{await h.writeFile(text);await h.sync();}finally{await h.close();}}
async function readLock(root){
  const h=await fs.open(path.join(root,LOCK),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const stat=await h.stat();check(stat.isFile()&&stat.nlink===1&&stat.size<=LIMITS.manifest,'PACKAGE.RECOVERY','Invalid lifecycle lock');return await h.readFile('utf8');}finally{await h.close();}
}
async function journal(root,value){const file=path.join(root,'content',`.package-journal-${randomUUID()}.tmp`);try{await writeExclusive(file,JSON.stringify(value)+'\n');await fs.rename(file,path.join(root,JOURNAL));await syncDirectory(root);}finally{await fs.unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
export async function publishPackageState({root,plan,state,budget,atStage}){
  const text=JSON.stringify(state,null,2)+'\n';check(Buffer.byteLength(text)<=LIMITS.state,'PACKAGE.LIMIT','Installed state too large');
  const id=randomUUID(),temporary=`.package-${id}.tmp`,lock=path.join(root,LOCK);let handle,renamed=false,finalized=false,safeToUnlock=true,record;
  const current=()=>check(baseFingerprint(root)===plan.baseFingerprint&&stateFingerprint(root)===plan.catalogFingerprint,'PACKAGE.STALE','State changed; plan again');
  try{
    budget.take();
    try{handle=await fs.open(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw new WydgitError('PACKAGE.BUSY','Another lifecycle operation holds the lock');throw e;}
    await handle.writeFile(JSON.stringify({schema:'wydgit.package-lock/1',id,pid:process.pid}));await handle.sync();await syncDirectory(root);
    current();budget.take();
    record={schema:'wydgit.package-operation/1',id,pid:process.pid,action:plan.action,packages:plan.changes,status:'PLANNED',before:plan.catalogFingerprint,after:digest(text),baseFingerprint:plan.baseFingerprint,temporary};
    safeToUnlock=false;await journal(root,record);await atStage?.('PLANNED');budget.take();
    await writeExclusive(path.join(root,'content',temporary),text);
    record.status='APPLYING';await journal(root,record);await atStage?.('APPLYING');budget.take();current();
    await fs.rename(path.join(root,'content',temporary),path.join(root,STATE));renamed=true;
    await syncDirectory(root);await atStage?.('PUBLISHED');
    // Cancellation after publication cannot turn a committed catalog into a retry.
    record.status='COMPLETED';record.meter=budget.snapshot();await journal(root,record);finalized=true;
    return Object.freeze({schema:'wydgit.package-operation-result/1',id,status:'COMPLETED',revision:state.revision,changes:plan.changes,meter:record.meter});
  }catch(error){
    if(renamed)throw new WydgitError('PACKAGE.RECOVERY','Publication occurred; inspect and recover the durable operation');
    if(record){record.status='FAILED';record.code=error.code?.startsWith('PACKAGE.')?error.code:'PACKAGE.STORAGE';try{await journal(root,record);safeToUnlock=true;}catch{throw new WydgitError('PACKAGE.RECOVERY','Failure record could not be persisted; retain the operation lock');}}
    if(error instanceof WydgitError)throw error;
    throw new WydgitError('PACKAGE.STORAGE','Lifecycle storage operation failed');
  }finally{
    let cleanupFailed=false;
    if(handle&&!renamed){await fs.unlink(path.join(root,'content',temporary)).catch(e=>{if(e.code!=='ENOENT')cleanupFailed=true;});}
    // An indeterminate commit retains its lock and journal for explicit recovery.
    if(handle){try{await handle.close();if(!cleanupFailed&&(!renamed&&safeToUnlock||finalized)){await fs.unlink(lock);await syncDirectory(root);}}catch{cleanupFailed=true;}}
    if(cleanupFailed)throw new WydgitError('PACKAGE.RECOVERY','Lifecycle cleanup could not be completed; inspect the operation record');
  }
}
export function inspectPackageOperation(root){
  try{return JSON.parse(safeRead(root,JOURNAL,LIMITS.state));}catch(e){if(e.code==='ENOENT')return null;throw e;}
}
export async function recoverPackageOperation({root,installationContext}){
  const existing=JSON.parse(await readLock(root));
  if(existing?.type==='effects')return (await import('./effects.js')).recoverPackageEffects({root,installationContext});
  // The accepted App ID is validated below without bypassing catalog integrity.
  let state;try{state=JSON.parse(safeRead(root,STATE,LIMITS.state));}catch(e){if(e.code!=='ENOENT')throw e;}
  authorizeLifecycle(installationContext,state?JSON.parse(state.app).id:JSON.parse(safeRead(root,'content/app.json',LIMITS.state)).id);
  let recovery,release;
  try{
    if(inspectPackageOperation(root)?.action?.startsWith('policy-')){authorizePolicy(installationContext,JSON.parse(state.app).id,authorizeLifecycle);release=reserveStoppedApp(root);}
    try{recovery=await fs.open(path.join(root,RECOVERY),'wx',0o600);}catch(e){if(e.code==='EEXIST')throw new WydgitError('PACKAGE.BUSY','Recovery already in progress');throw e;}
    const lockText=await readLock(root),lock=JSON.parse(lockText),record=inspectPackageOperation(root);
    check(lock.schema==='wydgit.package-lock/1'&&record?.schema==='wydgit.package-operation/1'&&lock.id===record.id&&lock.pid===record.pid&&Number.isSafeInteger(lock.pid)&&lock.pid>0,'PACKAGE.RECOVERY','Unrecognized interrupted operation; manual inspection required');
    let live=true;try{process.kill(lock.pid,0);}catch(e){if(e.code==='ESRCH')live=false;}
    check(!live,'PACKAGE.BUSY','Operation process is still alive');
    check(baseFingerprint(root)===record.baseFingerprint,'PACKAGE.DRIFT','Base changed during interrupted operation');
    const head=stateFingerprint(root);
    check(head===record.before||head===record.after,'PACKAGE.RECOVERY','Catalog does not match either operation boundary');
    if(state)validateInstalledState(root,state);
    check(record.temporary===`.package-${record.id}.tmp`&&/^[a-f0-9-]{36}$/.test(record.id),'PACKAGE.RECOVERY','Invalid operation identity');
    record.status=head===record.after?'COMPLETED':'FAILED';record.code=head===record.after?'PACKAGE.RECOVERED_COMMIT':'PACKAGE.RECOVERED_ABORT';
    await journal(root,record);
    await fs.unlink(path.join(root,'content',record.temporary)).catch(e=>{if(e.code!=='ENOENT')throw e;});
    check(await readLock(root)===lockText,'PACKAGE.RECOVERY','Lock changed during recovery');
    await fs.unlink(path.join(root,LOCK));await syncDirectory(root);return record;
  }catch(error){if(error instanceof WydgitError)throw error;throw new WydgitError('PACKAGE.RECOVERY','Unrecognized or unreadable recovery evidence; manual inspection required');
  }finally{try{if(recovery){await recovery.close();await fs.unlink(path.join(root,RECOVERY));await syncDirectory(root);}}finally{release?.();}}
}
