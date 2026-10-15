// Kernel-owned ledger. Tokens never enter canonical JSON or application facades.
import {MAXIMA} from './schema.js';
import {checkContext} from '../seam/context.js';
import {requireThat as check} from '../object-model/validation.js';
const ledgers=new WeakMap();
export function createExecutionBudget(context,{guard=()=>{},deadline=Infinity}={}) {
  checkContext(context);
  const bounds=Object.fromEntries(Object.entries({...MAXIMA,eventDispatches:256,eventHandlers:2048,eventRaises:256,eventDepth:16}).map(([key,value])=>[key,Math.min(value,context.limits[key.startsWith('event')?key:`sewn${key[0].toUpperCase()+key.slice(1)}`]??value)]));
  const end=Math.min(deadline,Date.now()+bounds.timeMs),counts=Object.create(null);let live=true,eventDepth=-1;
  const token=Object.freeze(Object.create(null));
  const assert=()=>{if(!live||Date.now()>=end){live=false;check(false,'SEWN.LIMIT','Execution budget exhausted');}try{guard();}catch(error){live=false;throw error;}};
  const ledger=Object.freeze({bounds:Object.freeze(bounds),deadline:end,
    check:assert,
    eventDepth:()=>eventDepth,
    enterEvent(depth){assert();if(!Number.isSafeInteger(depth)||depth<0||depth>bounds.eventDepth){live=false;check(false,'EVENT.LIMIT','Event depth exhausted');}const before=eventDepth;eventDepth=depth;return ()=>{eventDepth=before;};},
    take(key,count=1){assert();check(Object.hasOwn(bounds,key)&&Number.isSafeInteger(count)&&count>=0,'SEWN.LIMIT','Invalid resource accounting');counts[key]=(counts[key]??0)+count;if(counts[key]>bounds[key]){live=false;check(false,'SEWN.LIMIT','Execution budget exhausted');}},
    close(){live=false;},
    snapshot(){return Object.freeze({...counts});}
  });
  ledgers.set(token,{context,ledger});return token;
}
export function executionBudget(token,context) {
  checkContext(context);const entry=ledgers.get(token);
  check(entry&&entry.context===context,'SEAM.CONTEXT','Expected the owning execution budget');return entry.ledger;
}
