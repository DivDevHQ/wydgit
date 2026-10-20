// Trusted provider-owned completion point, not a generic Promise settlement hook.
// No Promise reactions, scheduler barriers, input data or per-call history.
export function createContinuationTiming(now) {
  const rows=Object.create(null),origin=now();
  const interval=()=>({totalMs:0,maxMs:0});
  const add=(row,ms)=>{row.totalMs+=ms;row.maxMs=Math.max(row.maxMs,ms);};
  return Object.freeze({
    begin(name) {
      if(name==='sqliteLifecycleLstat')return lifecycleObservation(rows,now,origin);
      if(name!=='sqliteInspectFiles')return undefined;
      const entry=now(),row=rows[name]??={calls:0,providerCompleted:0,resumed:0,completeBeforeAwait:0,missingCompletion:0,
        operation:interval(),continuation:interval(),preflightToResume:interval(),largestOperation:null};row.calls++;
      let start=null,completed=null,awaiting=false,resumed=false;
      return Object.freeze({
        start(){if(start===null)start=now();},
        // Called in the producer's final synchronous finally, before its async
        // function fulfills/rejects with no further await or Promise adoption.
        complete(){if(completed===null&&!resumed){completed=now();row.providerCompleted++;}},
        awaiting(){if(!awaiting){awaiting=true;if(completed!==null)row.completeBeforeAwait++;}},
        resume(){if(resumed)return;resumed=true;const at=now();row.resumed++;
          add(row.preflightToResume,Math.max(0,at-entry));
          if(start===null||completed===null){row.missingCompletion++;return;}
          add(row.operation,Math.max(0,completed-start));add(row.continuation,Math.max(0,at-completed));
          if(!row.largestOperation||completed-start>row.largestOperation.providerCompletionMs-row.largestOperation.operationStartMs)
            row.largestOperation=Object.freeze({preflightEntryMs:entry-origin,operationStartMs:start-origin,providerCompletionMs:completed-origin,resumptionMs:at-origin});
        }
      });
    },
    snapshot(){return Object.freeze(Object.fromEntries(Object.entries(rows).map(([name,row])=>[name,name==='sqliteLifecycleLstat'?lifecycleSnapshot(row):Object.freeze({...row,
      incomplete:row.calls-row.resumed,
      operation:Object.freeze({...row.operation}),continuation:Object.freeze({...row.continuation}),preflightToResume:Object.freeze({...row.preflightToResume})})])));}
  });
}

// The fs/promises API exposes only the existing rejection recovery reaction.
// No raw filesystem completion or Promise settlement timestamp is claimed.
const lifecycleIntervals=['invocationToRecovery','recoveryWork','classification','continuation','validation','entryToResume'];
function lifecycleObservation(rows,now,origin) {
  const entry=now(),row=rows.sqliteLifecycleLstat??={calls:0,recoveryEntered:0,enoent:0,producerCompleted:0,resumed:0,validated:0,
    resumedWithoutRecovery:0,missingCompletion:0,...Object.fromEntries(lifecycleIntervals.map(key=>[key,{samples:0,totalMs:0,maxMs:0}])),largestInvocation:null};
  row.calls++;
  let start=null,recovery=null,completed=null,resumed=null,classified=null,validated=false;
  const add=(key,from,to)=>{const value=Math.max(0,to-from),r=row[key];r.samples++;r.totalMs+=value;r.maxMs=Math.max(r.maxMs,value);};
  return Object.freeze({
    start(){if(start===null)start=now();},
    recoveryEntry(){if(recovery===null&&resumed===null){recovery=now();row.recoveryEntered++;}},
    enoent(){if(classified===null&&recovery!==null&&completed===null){classified=now();row.enoent++;add('classification',recovery,classified);}},
    // Producer-side completion marker before the existing catch returns/throws.
    complete(){if(completed===null&&recovery!==null&&resumed===null){completed=now();row.producerCompleted++;}},
    resume(){if(resumed!==null)return;resumed=now();row.resumed++;add('entryToResume',entry,resumed);
      if(recovery===null){row.resumedWithoutRecovery++;return;}
      if(start===null||completed===null){row.missingCompletion++;return;}
      add('invocationToRecovery',start,recovery);add('recoveryWork',recovery,completed);add('continuation',completed,resumed);
      if(!row.largestInvocation||recovery-start>row.largestInvocation.recoveryEntryMs-row.largestInvocation.invocationMs)
        row.largestInvocation=Object.freeze({entryMs:entry-origin,invocationMs:start-origin,recoveryEntryMs:recovery-origin,producerCompletionMs:completed-origin,enoentClassificationMs:classified===null?null:classified-origin,resumptionMs:resumed-origin});
    },
    validated(){if(validated||resumed===null)return;validated=true;row.validated++;add('validation',resumed,now());}
  });
}
function lifecycleSnapshot(row) {
  return Object.freeze({...row,incomplete:row.calls-row.resumed,
    ...Object.fromEntries(lifecycleIntervals.map(key=>[key,Object.freeze({...row[key]})]))});
}
