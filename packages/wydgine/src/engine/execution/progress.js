// Page-owned sidecar on the existing trusted ledger guard. No portable changes.
import {performance} from 'node:perf_hooks';
import {createExecutionBudget,executionBudget} from '../sewn/budget.js';
const observations=new WeakMap();
const boundaries=new Set(['boundary','phase','dispatch','authorization','service','handler','finish']);
const phases=new Set(['prepare','start','initialize','load','validate','action','prerender','render','cleanup','settle']);
export function createObservedExecutionBudget(context,{guard=()=>{},deadline=Infinity,progress=false}={}) {
  if(!progress)return createExecutionBudget(context,{guard,deadline});
  let observation;
  const token=createExecutionBudget(context,{deadline,guard:()=>{observation.check();guard();}}),ledger=executionBudget(token,context);
  observation=createLedgerProgress(()=>ledger.snapshot());observations.set(token,observation);return token;
}
export const budgetProgress=token=>observations.get(token)??null;
export function observedExecutionMeter(token,context){
  const meter=executionBudget(token,context).meter(),observation=budgetProgress(token);
  return observation?Object.freeze({...meter,progress:observation.finish()}):meter;
}
// Fixed-size, monotonic intervals at safe boundaries. These are not CPU time.
export function createLedgerProgress(counts,{now=()=>performance.now()}={}) {
  const started=now(),records=Object.create(null);let phase='prepare',last=started,checks=0,totalChecks=0,samples=0,maxCheckpointInterval=null,maxObservedUncheckedInterval=null,result=null;
  const snapshot=()=>Object.freeze({...(typeof counts==='function'?counts():counts)});
  let lastCharges=snapshot(),lastServices=null;
  const checkpoint=(services=lastServices,boundary='boundary')=>{
    if(result)return;
    const at=now(),elapsedMs=Math.max(0,at-last),interval=Object.freeze({elapsedMs,offsetMs:Math.max(0,last-started),phase,boundary,checks,chargesBefore:lastCharges,chargesAfter:snapshot(),servicesBefore:lastServices,servicesAfter:services});
    if(!maxCheckpointInterval||elapsedMs>maxCheckpointInterval.elapsedMs)maxCheckpointInterval=interval;
    // Guard entries are counted, never timed per instruction. Only a boundary
    // interval with zero entries is evidence of observed unchecked time.
    if(checks===0&&(!maxObservedUncheckedInterval||elapsedMs>maxObservedUncheckedInterval.elapsedMs))maxObservedUncheckedInterval=interval;
    const entry=records[phase]??={checkpoints:0,checks:0,elapsedMs:0,firstCharges:lastCharges,lastCharges:null,services:null};
    entry.checkpoints++;entry.checks+=checks;entry.elapsedMs+=elapsedMs;entry.lastCharges=interval.chargesAfter;entry.services=services;records[phase]=entry;
    samples++;last=at;checks=0;lastCharges=interval.chargesAfter;lastServices=services;
  };
  return Object.freeze({
    check(){if(!result){checks++;totalChecks++;}},
    checkpoint(services,boundary='boundary'){checkpoint(services,boundaries.has(boundary)?boundary:'boundary');},
    phase(name,services){if(!result&&phases.has(name)){checkpoint(services,'phase');phase=name;}},
    finish(){
      if(result)return result;
      checkpoint(lastServices,'finish');
      result=Object.freeze({schema:'wydgit.ledger-progress/1',durationMs:Math.max(0,last-started),checks:totalChecks,samples,
        checkObservations:'guard-entry; terminal deadline/closed checks excluded',maxCheckpointInterval,maxObservedUncheckedInterval,
        exactUncheckedMaximum:false,
        phases:Object.freeze(Object.fromEntries(Object.entries(records).map(([key,value])=>[key,Object.freeze({...value})])))});
      return result;
    }
  });
}
