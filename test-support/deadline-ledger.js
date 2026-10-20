// Qualification-only sidecar. Never imported by shipped code. Fixed numeric
// request IDs, no payloads/paths/contexts; clocks cannot influence enforcement.
import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
const local=new AsyncLocalStorage();
const names=new Set(['budgetStart','nativeDispatch','nativeBegin','nativeCommit','nativeSettlement','pageContinuation',
  'nativeCancelled','clearEntry','clearExit','canonicalPublication','phase','pageComplete','outputConstruction','outputConstructed',
  'responsePreparation','responsePrepared','responseSendComplete','responseHandoff']);
const stages=new Set(['pageTree','installedStamp','hydrate','dehydrate','mutation','commit','clear']);
export function createDeadlineLedger({request=0,generation=1,maxRows=192,now=()=>performance.now(),wall=()=>Date.now()}={}){
  if(!Number.isInteger(request)||request<0||request>12||!Number.isSafeInteger(generation)||generation<1||!Number.isInteger(maxRows)||maxRows<1||maxRows>512)throw new RangeError('Ledger bounds');
  const state={request,generation,maxRows,now,wall,rows:[],dropped:0,deadline:null,started:null,phase:'prepare',operation:0,
    armed:false,committed:false,checks:0,lastCheck:null,firstExhaustedCheck:null,costs:Object.create(null),closed:false};let result;
  return Object.freeze({run:fn=>local.run(state,fn),finish(){
    if(result)return result;state.closed=true;
    result=Object.freeze({schema:'wydgine.deadline-ledger/1',request,generation,deadlineAtMs:state.deadline,startedAtMs:state.started,
      rows:Object.freeze(state.rows),dropped:state.dropped,checks:state.checks,lastCheck:state.lastCheck,firstExhaustedCheck:state.firstExhaustedCheck,
      synchronous:Object.freeze(state.costs)});return result;
  }});
}
function current(){const s=local.getStore();return s&&!s.closed?s:null;}
function row(s,name,at=s.now(),remaining=s.deadline===null?null:s.deadline-s.wall()){
  return Object.freeze({name,atMs:at,remainingMs:remaining,phase:s.phase,operation:s.operation});
}
export function deadlineArm(){const s=current();if(s)s.armed=true;}
export function deadlineStart(start,end){const s=current();if(!s||!s.armed||s.deadline!==null)return;s.armed=false;s.started=start;s.deadline=end;deadlineMark('budgetStart');}
export function deadlinePhase(name){const s=current();if(!s)return;if(['start','initialize','load','validate','action','prerender','render','cleanup','settle'].includes(name)){s.phase=name;deadlineMark('phase');}}
export function deadlineMark(name){const s=current();if(!s||!names.has(name))return;if(name==='nativeDispatch')s.operation++;
  if(name==='nativeCommit')s.committed=true;
  if(s.rows.length<s.maxRows)s.rows.push(row(s,name));else s.dropped++;
}
// Called immediately after the AUTHORITATIVE Date.now read, including terminal
// assertions. Do not perform a new check, close, extend or replace a deadline.
export function deadlineCheck(now,end,live){const s=current();if(!s||s.deadline!==end)return;s.checks++;
  s.lastCheck=row(s,'budgetCheck',s.now(),end-now);
  if(live&&now>=end)s.firstExhaustedCheck??=s.lastCheck;
}
export function deadlineSync(name,fn){const s=current();if(!s||!stages.has(name))return fn();const at=s.now(),post=s.committed;
  try{return fn();}finally{const entry=s.costs[name]??={calls:0,elapsedMs:0,postCommitCalls:0,postCommitMs:0};const elapsed=Math.max(0,s.now()-at);entry.calls++;entry.elapsedMs+=elapsed;if(post){entry.postCommitCalls++;entry.postCommitMs+=elapsed;}}
}
