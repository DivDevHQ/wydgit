// Cooperating local hosts share the existing stopped-App boundary. Short atomic
// admission serialization prevents review/apply and startup passing each other.
// These are process leases, not durable policy or a distributed drain protocol.
import path from 'node:path';
import { realpathSync,openSync,closeSync,writeFileSync,readFileSync,fstatSync,unlinkSync,readdirSync,constants } from 'node:fs';
import { requireThat as check } from '../object-model/validation.js';
const executions=new Map(),maintenance=new Set();
const prefix='.wydgine-admission-';
const removeLease=file=>{try{unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}};
const live=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}};
function readLease(file){
  const fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const stat=fstatSync(fd);check(stat.isFile()&&stat.nlink===1&&stat.size<=256,'PACKAGE.BUSY','Invalid local admission lease');
    const value=JSON.parse(readFileSync(fd,'utf8'));check(value.schema==='wydgine.local-admission/1'&&Number.isSafeInteger(value.pid)&&value.pid>0,'PACKAGE.BUSY','Invalid local admission lease');return value;
  }finally{closeSync(fd);}
}
function createLease(file){const fd=openSync(file,'wx',0o600);try{writeFileSync(fd,JSON.stringify({schema:'wydgine.local-admission/1',pid:process.pid}));}finally{closeSync(fd);}}
function serialized(root,work){
  const mutex=path.join(root,prefix+'mutex');
  // Never race to reclaim an abandoned mutex by unlinking it. A death inside
  // this synchronous critical section needs stopped-host inspection/removal;
  // runtime/maintenance leases can be reclaimed only under this exclusive lock.
  let owner;
  try{owner=readLease(mutex);}catch(e){
    if(e.code!=='ENOENT')check(false,'PACKAGE.BUSY','Invalid local App admission mutex (.wydgine-admission-mutex); stop all local App processes and inspect coordination evidence');
  }
  if(owner){const active=live(owner.pid);check(false,active?'PACKAGE.BUSY':'PACKAGE.RECOVERY',
    `Local App admission mutex (.wydgine-admission-mutex) is ${active?'potentially live':'abandoned'} (PID ${owner.pid}); stop all local App processes and inspect coordination evidence`);}
  try{createLease(mutex);}catch(e){check(e.code!=='EEXIST','PACKAGE.BUSY','Concurrent App admission');throw e;}
  try{return work();}finally{unlinkSync(mutex);}
}
function leases(root){
  const result=[],names=readdirSync(root).filter(n=>n.startsWith(prefix)&&n!==prefix+'mutex');
  check(names.length<=1024,'PACKAGE.BUSY','Local admission lease limit');
  for(const name of names){
    check(name===prefix+'maintenance'||new RegExp('^'+prefix+'runtime-[0-9]+$').test(name),'PACKAGE.BUSY','Unknown local admission evidence');
    const file=path.join(root,name),value=readLease(file);
    if(!live(value.pid))unlinkSync(file);else result.push(name);
  }return result;
}
export function registerAppExecution(root) {
  root=realpathSync(path.resolve(root));
  check(!maintenance.has(root),'PACKAGE.BUSY','App maintenance is in progress');
  if(!executions.has(root))serialized(root,()=>{check(!leases(root).includes(prefix+'maintenance'),'PACKAGE.BUSY','App maintenance is in progress');createLease(path.join(root,prefix+'runtime-'+process.pid));});
  executions.set(root,(executions.get(root)??0)+1);let live=true;
  return ()=>{if(live){live=false;const count=executions.get(root)-1;if(count)executions.set(root,count);else {executions.delete(root);removeLease(path.join(root,prefix+'runtime-'+process.pid));}}};
}
export function reserveStoppedApp(root) {
  root=realpathSync(path.resolve(root));
  check(!executions.has(root),'PACKAGE.RUNNING','App must be stopped and drained');
  check(!maintenance.has(root),'PACKAGE.BUSY','Conflicting App maintenance');
  serialized(root,()=>{check(!leases(root).some(n=>n.startsWith(prefix+'runtime-')),'PACKAGE.RUNNING','App must be stopped and drained in every local process');check(!leases(root).includes(prefix+'maintenance'),'PACKAGE.BUSY','Conflicting App maintenance');createLease(path.join(root,prefix+'maintenance'));});
  maintenance.add(root);return ()=>{maintenance.delete(root);removeLease(path.join(root,prefix+'maintenance'));};
}
