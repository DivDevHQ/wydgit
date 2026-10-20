import {performance} from 'node:perf_hooks';

// Host-only, opt-in, synchronous and bounded. Stages are disjoint; total also
// includes guards, bookkeeping and timing overhead. Never retain field data.
export function formClearObservation(enabled,observe,now=()=>performance.now()) {
  if(!enabled||typeof observe!=='function')return null;
  const start=now(),row={schema:'wydgit.form-clear/1',completed:false,fields:0,propertyWrites:0,runtimeEdits:0,
    traversalMs:0,calculationMs:0,editSetupMs:0,runtimeEditsMs:0,commitMs:0,totalMs:0};
  return {
    measure(stage,operation){const start=now();try{return operation();}finally{row[stage]+=Math.max(0,now()-start);}},
    fields(count){row.fields=count;},
    write(applied=true){row.propertyWrites++;if(applied)row.runtimeEdits++;},
    complete(){row.completed=true;},
    finish(){row.totalMs=Math.max(0,now()-start);try{observe(Object.freeze({...row}));}catch{/* Diagnostics cannot change Clear. */}}
  };
}
