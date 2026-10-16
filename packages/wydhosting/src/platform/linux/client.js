// Host-only broker client. The privileged endpoint authenticates actual SO_PEERCRED.
import {Socket} from 'node:net';
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {EventEmitter} from 'node:events';
import {createStreamPeer} from 'wydgine/trusted/stream-peer';
import {loadPeerCredentials} from 'wydgine/trusted/unix-peer';
import {validateBootstrap,boundedJSON,protocolError} from 'wydgine/trusted/protocol';
import {digest,check,shape,sealed,integer,validateRegistry} from '../../contracts.js';
const requestSchema='wydhosting.broker/1';
async function procText(pid,name){const file=await fs.open('/proc/'+pid+'/'+name,constants.O_RDONLY|constants.O_NOFOLLOW);try{const bytes=Buffer.alloc(4097);const {bytesRead}=await file.read(bytes);check(bytesRead<=4096,'HOSTING.INGRESS_PEER');return bytes.subarray(0,bytesRead).toString('utf8');}finally{await file.close();}}
const brokerOperations=new Set(['ensure-account','stage','launch','status','reconcile']);
export function createLinuxBackend({approval,socketPath='/run/wydhosting/broker.sock',credentialHelper,timeoutMs=10000}={}) {
 check(approval?.schema==='wydhosting.linux-approval/1'&&approval.qualification==='unqualified'&&approval.activation==='manual-review-required','HOSTING.LINUX_APPROVAL');
 const {policyRevision,qualification,activation,...body}=approval;check(digest(body)===policyRevision&&integer(timeoutMs,100,120000),'HOSTING.LINUX_APPROVAL');
 approval=sealed(approval);const credentials=loadPeerCredentials(credentialHelper);
 function prepare(input,poolId){
  const registry=validateRegistry(input);check(digest(registry)===approval.registryDigest&&registry.revision===approval.registryRevision,'HOSTING.STALE_REVISION');
  const pool=registry.pools.find(p=>p.poolId===poolId),approved=approval.pools.find(p=>p.poolId===poolId);
  check(pool?.state==='active'&&approved&&pool.base===approved.base&&pool.accountId===approved.account.accountId,'HOSTING.PLACEMENT');
  return {r:registry,pool,inventory:approved.inventory,approved};
 }
 function connect(operation,poolId,body={}) {
  check(brokerOperations.has(operation)&&approval.pools.some(p=>p.poolId===poolId),'HOSTING.BROKER_OPERATION');
  return new Promise((resolve,reject)=>{
   const socket=new Socket();const stream=createStreamPeer(socket);let done=false;
   const timer=setTimeout(()=>fail('HOSTING.BROKER_TIMEOUT'),timeoutMs);
   function fail(code){if(done)return;done=true;clearTimeout(timer);socket.destroy();reject(protocolError(code));}
   stream.once('disconnect',()=>fail('HOSTING.BROKER_UNAVAILABLE'));
   stream.once('message',reply=>{
    if(done)return;done=true;clearTimeout(timer);
    if(reply?.ok!==true){socket.destroy();reject(protocolError(/^BROKER\.[A-Z_]+$/.test(reply?.code)?reply.code:'HOSTING.BROKER_REFUSED'));return;}
    resolve({reply,stream,socket});
   });
   socket.once('connect',()=>{try{check(credentials(socket).uid===0,'HOSTING.BROKER_PEER');socket.write(boundedJSON({schema:requestSchema,operation,poolId,policyRevision:approval.policyRevision,body})+'\n');}catch{fail('HOSTING.BROKER_PEER');}});
   socket.connect(socketPath);
  });
 }
 return Object.freeze({
  kind:'linux-systemd/1',prepare,
  async operation(operation,poolId){check(operation!=='launch','HOSTING.BROKER_OPERATION');const result=await connect(operation,poolId);result.socket.end();return sealed(result.reply);},
  listener(generation){return {mode:'private-unix',path:'/run/wydhosting/workers/'+generation+'/http.sock',uid:approval.providerUid};},
  async launch(bootstrap){
   validateBootstrap(bootstrap);const p=approval.pools.find(p=>p.poolId===bootstrap.poolId);check(p,'HOSTING.PLACEMENT');
   const {reply,stream,socket}=await connect('launch',bootstrap.poolId,bootstrap);
   try{
    shape(reply,['ok','state','pid','unit','invocation','cgroup','generation','uid','startTime']);
    const unit='wydhosting-pool-'+(await import('node:crypto')).createHash('sha256').update(bootstrap.poolId).digest('hex').slice(0,32)+'-'+bootstrap.generation.replaceAll('-','')+'.service';
    check(reply.state==='launched'&&reply.generation===bootstrap.generation&&reply.uid===p.account.uid&&integer(reply.pid,1)&&reply.unit===unit&&reply.cgroup==='/system.slice/'+unit&&typeof reply.startTime==='string'&&/^[0-9]{1,24}$/.test(reply.startTime)&&/^[a-f0-9]{32}$/.test(reply.invocation),'HOSTING.BROKER_PEER');
   }catch(error){socket.destroy();throw error;}
   // ChildProcess-compatible owned-service facade; kill is a typed retirement,
   // never a signal to a numeric PID. Exit means broker-confirmed cgroup death.
   const peer=new EventEmitter();peer.pid=reply.pid;peer.exitCode=null;peer.signalCode=null;peer.service=sealed(reply);peer.endpoint=bootstrap.listener.path;
   let dead=false;
   stream.on('message',message=>{
    if(message?.schema==='wydhosting.broker-result/1'){try{shape(message,['schema','ok','state','generation','result','exitStatus']);check(message.ok===true&&message.state==='stopped'&&message.generation===bootstrap.generation&&['success','exit-code','signal','core-dump','watchdog','timeout','start-limit-hit','oom-kill','resources','protocol','unknown'].includes(message.result)&&integer(message.exitStatus,0,255),'HOSTING.BROKER_PEER');}catch{socket.destroy();return;}dead=true;peer.serviceResult=sealed({result:message.result,exitStatus:message.exitStatus});peer.exitCode=message.exitStatus;peer.emit('exit',message.exitStatus,null);socket.end();return;}
    peer.emit('message',message);
   });
   stream.on('disconnect',()=>{peer.emit('disconnect');if(!dead)peer.emit('error',protocolError('HOSTING.OWNERSHIP_UNKNOWN'));});
   peer.send=stream.send;
   peer.kill=()=>{socket.end();return true;};
   return peer;
  },
  async connectIngress(view){
   check(view.ready&&view.service&&view.endpoint,'HOSTING.UNAVAILABLE');
   const socket=new Socket();
   return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.destroy();reject(protocolError('HOSTING.INGRESS_TIMEOUT'));},timeoutMs);socket.once('error',error=>{clearTimeout(timer);reject(protocolError(error.code==='EACCES'?'HOSTING.INGRESS_PERMISSION':'HOSTING.INGRESS_SOCKET'));});socket.once('connect',async()=>{try{const peer=credentials(socket);check(peer.uid===view.service.uid&&peer.pid===view.service.pid,'HOSTING.INGRESS_PEER');const [cgroup,status]=await Promise.all([procText(peer.pid,'cgroup'),procText(peer.pid,'stat')]);check(cgroup==='0::'+view.service.cgroup+'\n'&&status.slice(status.lastIndexOf(') ')+2).split(/\s+/)[19]===view.service.startTime&&!socket.destroyed,'HOSTING.INGRESS_PEER');clearTimeout(timer);resolve(socket);}catch{clearTimeout(timer);socket.destroy();reject(protocolError('HOSTING.INGRESS_PEER'));}});socket.connect(view.endpoint);});
  }
 });
}
