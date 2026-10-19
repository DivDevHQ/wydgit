// Trusted Page-owned service completion. No control object enters canonical data.
import {performance} from 'node:perf_hooks';
const stages=new Set(['dispatchValidation','dispatchAuthorization','nativeHandler','jsonQueue','jsonWork','sqlitePreflight','sqliteTransaction']);
export function createCompletion(check,{diagnosticTiming=false,now=()=>performance.now()}={}) {
  const pending=new Set(),effects=[];let closed=false;
  const timings=diagnosticTiming?Object.create(null):null;
  const stage=name=>{
    if(!stages.has(name))return undefined;
    const started=now(),row=timings[name]??={calls:0,completed:0,elapsedMs:0,maxMs:0};row.calls++;
    let finished=false;
    return ()=>{if(finished)return;finished=true;const elapsed=Math.max(0,now()-started);row.completed++;row.elapsedMs+=elapsed;row.maxMs=Math.max(row.maxMs,elapsed);};
  };
  return Object.freeze({
    async run(work) {
      check();if(closed)throw new Error('Execution closed');
      const effect={state:'none',started:false};effects.push(effect);
      const operation=Object.freeze({
        check,
        ...(diagnosticTiming?{stage}:{}),
        begin(){check();effect.started=true;effect.state='indeterminate';},
        cancelled(){if(effect.state==='indeterminate')effect.state='none';},
        committed(){effect.state='committed';}
      });
      const task=Promise.resolve().then(()=>work(operation));pending.add(task);
      try{return await task;}finally{pending.delete(task);}
    },
    async settle(){closed=true;await Promise.allSettled([...pending]);},
    // Fixed counters only; begin may run more than once for one service call.
    snapshot(){return Object.freeze({admitted:effects.length,nativeStarted:effects.filter(e=>e.started).length,pending:pending.size,commitReported:effects.filter(e=>e.state==='committed').length});},
    timing(){return timings?Object.freeze(Object.fromEntries(Object.entries(timings).map(([key,row])=>[key,Object.freeze({...row})]))):null;},
    outcome(failed=false){return effects.some(e=>e.state==='indeterminate')||failed&&effects.some(e=>e.state==='committed')?'indeterminate':effects.some(e=>e.state==='committed')?'committed':'not-committed';}
  });
}
