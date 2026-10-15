// Trusted Node composition only. Never registered as a portable service.
import {createMultiAppHost,validateAppInventory} from './multi-app.js';
import {clean,freeze,requireThat as check,WydgitError} from './object-model/validation.js';
export async function createOperationalHost(input,options={}){
 const policy=clean(input);
 check(policy&&Object.keys(policy).every(k=>['schema','inventory','optional'].includes(k))&&policy.schema==='wydgit.operations/0.1'&&Array.isArray(policy.optional)&&policy.optional.length<=16&&Buffer.byteLength(JSON.stringify(policy))<=131072&&policy.optional.every(id=>typeof id==='string')&&new Set(policy.optional).size===policy.optional.length,'HOST.OPERATIONS','Invalid operational policy');
 const inventory=await validateAppInventory(policy.inventory,options);
 check(inventory.routing&&policy.optional.every(id=>inventory.apps.some(a=>a.id===id)&&!inventory.routing.parking.includes(id)),'HOST.OPERATIONS','Invalid optional App selection');
 const controller=await createMultiAppHost(policy.inventory,options);let state='configured',startupMs=null,closing;
 const snapshot=()=>{const health=controller.health(),required=health.apps.filter(a=>!policy.optional.includes(a.id));return freeze(clean({...health,state,startupMs,ready:state==='ready'&&required.every(a=>a.ready),required:required.map(a=>a.id)}));};
 const shutdown=()=>closing??=(async()=>{state='draining';try{await controller.dispose();state='stopped';}catch{state='failed';throw new WydgitError('HOST.CLEANUP','Host cleanup failed');}})();
 return Object.freeze({controller,snapshot,shutdown,
  start(...listen){check(state==='configured'&&!closing,'HOST.STATE','Host cannot start');state='starting';return (async()=>{const at=performance.now();try{
   for(const app of inventory.apps){try{await controller.activate(app.id);}catch{if(!policy.optional.includes(app.id))throw new Error();}if(closing)throw new Error();}
   const server=await controller.listenShared(...listen);if(closing){server.close();throw new Error();}startupMs=Math.floor(performance.now()-at);state='ready';server.once('close',()=>{if(state==='ready')state='unavailable';});server.on('error',()=>{if(state==='ready')state='unavailable';});return server;
  }catch{try{await shutdown();}catch{}state='failed';throw new WydgitError('HOST.STARTUP','Required hosting infrastructure unavailable');}})();},
  signals(target=process){const handler=()=>{shutdown().catch(()=>{target.exitCode=1;});};target.once('SIGINT',handler);target.once('SIGTERM',handler);return ()=>{target.removeListener('SIGINT',handler);target.removeListener('SIGTERM',handler);};}
 });
}
