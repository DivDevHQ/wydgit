// Trusted provider-owned completion point, not a generic Promise settlement hook.
// No Promise reactions, scheduler barriers, input data or per-call history.
export function createContinuationTiming(now) {
  const rows=Object.create(null),origin=now();
  const interval=()=>({totalMs:0,maxMs:0});
  const add=(row,ms)=>{row.totalMs+=ms;row.maxMs=Math.max(row.maxMs,ms);};
  return Object.freeze({
    begin(name) {
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
    snapshot(){return Object.freeze(Object.fromEntries(Object.entries(rows).map(([name,row])=>[name,Object.freeze({...row,
      incomplete:row.calls-row.resumed,
      operation:Object.freeze({...row.operation}),continuation:Object.freeze({...row.continuation}),preflightToResume:Object.freeze({...row.preflightToResume})})])));}
  });
}
