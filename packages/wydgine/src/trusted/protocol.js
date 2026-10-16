// Trusted Node IPC only. Never registered with SEAM or served over HTTP.
import {createHash} from 'node:crypto';
export const schema='wydgine.worker/2';
export const bounds=Object.freeze({messageBytes:262144,outstanding:32,queueBytes:1048576,depth:16});
export const protocolError=(code='WORKER.PROTOCOL')=>Object.assign(new Error('Worker control operation failed'),{code});
const check=v=>{if(!v)throw protocolError();};
export const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
const appIdentifier=v=>typeof v==='string'&&v.length<=128&&/^[A-Za-z][\w.-]*$/.test(v);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
export function closed(v,keys){check(record(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));}
export function boundedJSON(v){
 let count=0,bytes=0;
 const charge=n=>{bytes+=n;check(bytes<=bounds.messageBytes);};
 const string=x=>{check(x.length<=bounds.messageBytes);charge(Buffer.byteLength(JSON.stringify(x)));};
 function walk(x,d){
  check(d<=bounds.depth&&++count<=32768);
  if(x===null){charge(4);return;}
  if(typeof x==='boolean'){charge(x?4:5);return;}
  if(typeof x==='string'){string(x);return;}
  if(typeof x==='number'){check(Number.isSafeInteger(x));charge(String(x).length);return;}
  check(Array.isArray(x)||record(x));const keys=Object.keys(x);check(keys.length<=32768);
  if(Array.isArray(x))check(x.length<=32768&&keys.length===x.length&&keys.every((k,i)=>k===String(i)));
  charge(2+Math.max(0,keys.length-1));
  for(const k of keys){
   check(!['__proto__','prototype','constructor'].includes(k));
   const descriptor=Object.getOwnPropertyDescriptor(x,k);check(Object.hasOwn(descriptor,'value'));
   if(!Array.isArray(x)){string(k);charge(1);}
   walk(descriptor.value,d+1);
  }
 }
 walk(v,0);return JSON.stringify(v);
}

export const revision=v=>createHash('sha256').update(boundedJSON(v)).digest('hex');
export function validateBootstrap(v){
 closed(v,['providerId','poolId','workerId','generation','epoch','registryRevision','configurationRevision','root','inventory','snapshots','execution','optional','listener','startupMs','shutdownMs']);
 check([v.providerId,v.poolId,v.workerId,v.generation].every(identifier)&&Number.isSafeInteger(v.epoch)&&v.epoch>0&&Number.isSafeInteger(v.registryRevision)&&v.registryRevision>=0);
 check(typeof v.root==='string'&&v.root.startsWith('/')&&v.root.length<=4096&&!/[\x00-\x1f]/.test(v.root));
 if(v.listener?.mode==='private-unix'){closed(v.listener,['mode','path','uid']);check(typeof v.listener.path==='string'&&/^\/run\/wydhosting\/workers\/[a-z0-9-]{1,64}\/http.sock$/.test(v.listener.path)&&Number.isSafeInteger(v.listener.uid)&&v.listener.uid>0&&v.inventory?.routing?.transport?.mode==='private-unix'&&v.inventory.routing.transport.uid===v.listener.uid);}
 else {closed(v.listener,['host','port']);check(v.listener.host==='127.0.0.1'&&Number.isInteger(v.listener.port)&&v.listener.port>=0&&v.listener.port<=65535&&v.inventory?.routing?.transport?.mode!=='private-unix');}
 check([v.startupMs,v.shutdownMs].every(n=>Number.isInteger(n)&&n>=100&&n<=120000));
 check(Array.isArray(v.optional)&&v.optional.length<=16&&v.optional.every(appIdentifier)&&new Set(v.optional).size===v.optional.length);
 check(record(v.snapshots)&&Object.keys(v.snapshots).length===v.inventory?.apps?.length&&v.inventory.apps.every(a=>/^[a-f0-9]{64}$/.test(v.snapshots[a.id])));check(record(v.execution));const apps=v.inventory?.apps;check(Array.isArray(apps)&&apps.length>0&&apps.length<=16);
 for(const [app,policy] of Object.entries(v.execution)){
  check(apps.some(a=>a.id===app));closed(policy,['verifiedPackages']);check(record(policy.verifiedPackages)&&Object.keys(policy.verifiedPackages).length<=128);
  for(const [pkg,publisher] of Object.entries(policy.verifiedPackages))check(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(pkg)&&typeof publisher==='string'&&/^[a-z0-9][a-z0-9._-]{0,127}$/.test(publisher));
 }
 check(v.configurationRevision===revision({root:v.root,inventory:v.inventory,snapshots:v.snapshots,execution:v.execution,optional:v.optional,listener:v.listener}));boundedJSON(v);return v;
}
const commands=new Set(['bootstrap','readiness','health','drain','shutdown']);
const responses=new Set(['accepted','starting','ready','not-ready','health','draining','stopped','rejected','failure']);
export function validateMessage(v,direction){
 boundedJSON(v);closed(v,['schema','type','requestId','poolId','workerId','generation','sequence','body']);
 check(v.schema===schema&&[v.requestId,v.poolId,v.workerId,v.generation].every(identifier)&&Number.isSafeInteger(v.sequence)&&v.sequence>0&&(direction==='command'?commands:responses).has(v.type));
 if(direction==='command'){
  if(v.type==='bootstrap'){validateBootstrap(v.body);check(['poolId','workerId','generation'].every(k=>v[k]===v.body[k]));}
  else closed(v.body,[]);
 }else{
  if(['rejected','failure'].includes(v.type)){closed(v.body,['code']);check(['WORKER.STARTUP','WORKER.PROTOCOL','WORKER.CLEANUP','WORKER.NOT_READY'].includes(v.body.code));}
  else if(['ready','not-ready','health'].includes(v.type)){
   closed(v.body,['ready','state','apps','capacity','port','configurationRevision']);check(typeof v.body.ready==='boolean'&&['starting','ready','draining','stopped','failed','unavailable'].includes(v.body.state)&&Number.isInteger(v.body.port)&&v.body.port>=0&&v.body.port<=65535&&/^[a-f0-9]{64}$/.test(v.body.configurationRevision));
   check(Array.isArray(v.body.apps)&&v.body.apps.length<=16);for(const a of v.body.apps){closed(a,['id','state','ready','saturated','draining','pending','failure']);check(appIdentifier(a.id)&&['configured','initializing','active','stopping','stopped','failed'].includes(a.state)&&[a.ready,a.saturated,a.draining].every(x=>typeof x==='boolean')&&Number.isSafeInteger(a.pending)&&a.pending>=0&&(a.failure===null||['APP.STARTUP','APP.STALE','APP.DRAIN_TIMEOUT','APP.CLEANUP','APP.UNAVAILABLE'].includes(a.failure)));}
   closed(v.body.capacity,['configured','ready','saturated','current']);check(Object.values(v.body.capacity).every(n=>Number.isSafeInteger(n)&&n>=0));
  }else closed(v.body,[]);
 }
 return v;
}
// Native IPC supplies framing. Keep at most one native send active; no hidden
// user-space unbounded queue. A false send result means backpressure, not failure.
export function createChannel(peer,{direction,identity,onMessage,onClose,timeoutMs=10000}){
 let outgoing=0,incoming=0,closedFlag=false,active=false,bytes=0;const queue=[];
 function close(code='WORKER.CLOSED'){
  if(closedFlag)return;closedFlag=true;for(const q of queue.splice(0)){clearTimeout(q.timer);q.reject(protocolError(code));}bytes=0;peer.removeListener('message',receive);peer.removeListener('disconnect',disconnect);peer.removeListener('error',error);onClose?.(code);
 }
 const disconnect=()=>close();const error=()=>close();
 function pump(){if(active||closedFlag||!queue.length)return;active=true;const q=queue[0];try{peer.send(q.message,e=>{active=false;if(closedFlag)return;if(e)return close();queue.shift();bytes-=q.size;clearTimeout(q.timer);q.resolve();pump();});}catch{close();}}
 function send(type,requestId,body={}){
  if(closedFlag)return Promise.reject(protocolError('WORKER.CLOSED'));
  let message,size;try{message={schema,type,requestId,...identity(),sequence:++outgoing,body};validateMessage(message,direction==='command'?'command':'response');size=Buffer.byteLength(JSON.stringify(message));check(queue.length<bounds.outstanding&&bytes+size<=bounds.queueBytes);}catch{close('WORKER.PROTOCOL');return Promise.reject(protocolError());}
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>close('WORKER.TIMEOUT'),timeoutMs);queue.push({message,size,resolve,reject,timer});bytes+=size;pump();});
 }
 function receive(raw){
  if(closedFlag)return;try{const m=validateMessage(raw,direction==='command'?'response':'command');const expected=identity();check(Object.keys(expected).every(k=>expected[k]===m[k])&&m.sequence===incoming+1);incoming=m.sequence;onMessage(m);}catch{close('WORKER.PROTOCOL');}
 }
 peer.on('message',receive);peer.once('disconnect',disconnect);peer.on('error',error);
 return Object.freeze({send,close,get closed(){return closedFlag;}});
}
