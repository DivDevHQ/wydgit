// Kernel-owned ledger. Tokens never enter canonical JSON or application facades.
import {MAXIMA} from './schema.js';
import {checkContext} from '../seam/context.js';
import {WydgitError,requireThat as check} from '../object-model/validation.js';
const ledgers=new WeakMap();
export function createExecutionBudget(context,{guard=()=>{},deadline=Infinity}={}) {
  checkContext(context);
  const bounds=Object.fromEntries(Object.entries({...MAXIMA,eventDispatches:256,eventHandlers:2048,eventRaises:256,eventDepth:16}).map(([key,value])=>[key,Math.min(value,context.limits[key.startsWith('event')?key:`sewn${key[0].toUpperCase()+key.slice(1)}`]??value)]));
  const started=Date.now(),end=Math.min(deadline,started+bounds.timeMs),counts=Object.create(null);let live=true,eventDepth=-1,exhaustion=null;
  const token=Object.freeze(Object.create(null));
  const fail=(resource,used,limit,code='SEWN.LIMIT')=>{live=false;exhaustion??=Object.freeze({resource,used,limit});throw new WydgitError(code,'Execution budget exhausted',exhaustion);};
  const assert=()=>{checkContext(context);const now=Date.now();if(!live)fail(exhaustion?.resource??'closed',exhaustion?.used??0,exhaustion?.limit??0);if(now>=end)fail('timeMs',Math.max(0,now-started),Math.max(0,end-started));try{guard();}catch(error){live=false;exhaustion??=Object.freeze({resource:'guard',used:0,limit:0});throw error;}};
  const ledger=Object.freeze({bounds:Object.freeze(bounds),deadline:end,
    check:assert,
    eventDepth:()=>eventDepth,
    enterEvent(depth){assert();if(!Number.isSafeInteger(depth)||depth<0||depth>bounds.eventDepth){fail('eventDepth',depth,bounds.eventDepth,'EVENT.LIMIT');}const before=eventDepth;eventDepth=depth;return ()=>{eventDepth=before;};},
    take(key,count=1){assert();check(Object.hasOwn(bounds,key)&&Number.isSafeInteger(count)&&count>=0,'SEWN.LIMIT','Invalid resource accounting');counts[key]=(counts[key]??0)+count;if(counts[key]>bounds[key]){fail(key,counts[key],bounds[key]);}},
    close(){live=false;},
    snapshot(){return Object.freeze({...counts});},
    meter(){return Object.freeze({schema:'wydgit.execution-meter/1',elapsedMs:Math.max(0,Date.now()-started),timeLimitMs:Math.max(0,end-started),charges:Object.freeze({...counts}),exhaustion});}
  });
  ledgers.set(token,{context,ledger});return token;
}
export function executionBudget(token,context) {
  checkContext(context);const entry=ledgers.get(token);
  check(entry&&entry.context===context,'SEAM.CONTEXT','Expected the owning execution budget');return entry.ledger;
}
