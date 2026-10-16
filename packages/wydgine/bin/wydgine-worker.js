#!/usr/bin/env node
// Dedicated trusted entry. No CLI-selected source, env bootstrap or HTTP control.
import path from 'node:path';
import {fingerprintApprovedApp} from '../src/trusted/provider.js';
import {createOperationalHost,validateAppInventory} from '../src/trusted/worker.js';
import {createChannel,validateBootstrap} from '../src/trusted/protocol.js';
import {Socket} from 'node:net';
import {loadPeerCredentials} from '../src/trusted/unix-peer.js';
import {createStreamPeer} from '../src/trusted/stream-peer.js';
const linux=process.argv.length===3&&process.argv[2]==='--linux-service';
if(!linux&&(!process.send||!process.connected))process.exit(64);
const peer=linux?createStreamPeer(new Socket({fd:3,readable:true,writable:true})):process;
let initializationTimer;
let bootstrap,host,port=0,listening=false,stopping=false,busy=false,sequenceIdentity={},shutdownPromise;
const startupTimer=setTimeout(()=>finish(70),10000);
function finish(code){clearTimeout(startupTimer);clearTimeout(initializationTimer);process.exit(code);}
function shutdown(code=0){
 return shutdownPromise??=(async()=>{stopping=true;const force=setTimeout(()=>finish(71),bootstrap?.shutdownMs??5000);try{await host?.shutdown();clearTimeout(force);finish(code);}catch{clearTimeout(force);finish(71);}})();
}
const channel=createChannel(peer,{direction:'response',identity:()=>sequenceIdentity,onClose:()=>{shutdown(72);},onMessage:m=>{
 if(m.requestId===`r${m.sequence}`&&(port>0||listening)&&['health','readiness'].includes(m.type)){channel.send(m.type==='health'?'health':!stopping&&host.snapshot().ready?'ready':'not-ready',m.requestId,snapshot()).catch(()=>shutdown(72));return;}
 if(m.requestId!==`r${m.sequence}`||busy||stopping){channel.close('WORKER.PROTOCOL');return;}
 busy=true;handle(m).catch(async()=>{const initial=m.type==='bootstrap',code=initial?'WORKER.STARTUP':['drain','shutdown'].includes(m.type)?'WORKER.CLEANUP':'WORKER.PROTOCOL';try{await channel.send(initial?'rejected':'failure',m.requestId,{code});}catch{}shutdown(initial?70:71);}).finally(()=>{busy=false;});
}});
function snapshot(){const s=host.snapshot();return {ready:s.ready&&!stopping,state:stopping?'draining':s.state,apps:s.apps.map(({id,state,ready,saturated,draining,pending,failure})=>({id,state,ready:ready&&!stopping,saturated,draining,pending,failure})),capacity:Object.fromEntries(['configured','ready','saturated','current'].map(k=>[k,s.capacity[k]])),port,configurationRevision:bootstrap.configurationRevision};}
async function handle(m){
 if(!bootstrap){
  if(m.type!=='bootstrap')throw Error();bootstrap=validateBootstrap(m.body);sequenceIdentity={poolId:bootstrap.poolId,workerId:bootstrap.workerId,generation:bootstrap.generation};
  if(linux!==(bootstrap.listener.mode==='private-unix'))throw Error();
  clearTimeout(startupTimer);initializationTimer=setTimeout(()=>finish(70),bootstrap.startupMs);
  await channel.send('accepted',m.requestId);await channel.send('starting',m.requestId);
  await validateAppInventory(bootstrap.inventory,{root:bootstrap.root,execution:bootstrap.execution});
  for(const app of bootstrap.inventory.apps)if(await fingerprintApprovedApp(path.join(bootstrap.root,app.root))!==bootstrap.snapshots[app.id])throw Error();
  const peerCredentials=linux?loadPeerCredentials(process.env.WYD_PEERCRED_HELPER):undefined;
  host=await createOperationalHost({schema:'wydgit.operations/0.1',inventory:bootstrap.inventory,optional:bootstrap.optional},{root:bootstrap.root,execution:bootstrap.execution,peerCredentials,implementationRoot:linux?'/opt/wydhosting/release':undefined});
  if(stopping){await host.shutdown();return;}
  const server=linux?await host.start(bootstrap.listener.path):await host.start(bootstrap.listener.port,bootstrap.listener.host);port=linux?0:server.address().port;listening=true;clearTimeout(initializationTimer);
  // Startup watchdog is replaced after successful listener initialization.
  await channel.send(host.snapshot().ready?'ready':'not-ready',m.requestId,snapshot());return;
 }
 if(m.type==='bootstrap')throw Error();
 if(m.type==='health'||m.type==='readiness')return channel.send(m.type==='health'?'health':host.snapshot().ready?'ready':'not-ready',m.requestId,snapshot());
 if(m.type==='drain'||m.type==='shutdown'){
  stopping=true;const force=setTimeout(()=>finish(71),bootstrap.shutdownMs);
  const done=host.shutdown();await channel.send('draining',m.requestId);await done;
  await channel.send('stopped',m.requestId);clearTimeout(force);finish(0);
 }
}
process.once('SIGTERM',()=>shutdown());process.once('SIGINT',()=>shutdown());
process.once('uncaughtException',()=>shutdown(70));process.once('unhandledRejection',()=>shutdown(70));
