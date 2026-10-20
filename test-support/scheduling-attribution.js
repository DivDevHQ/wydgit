// Offline helpers. Unions use intervals from the SAME process/observation only.
export function distribution(values){
  const v=values.filter(Number.isFinite).sort((a,b)=>a-b),at=p=>v[Math.ceil(p*v.length)-1]??null;
  return {count:v.length,min:v[0]??null,median:at(.5),p90:at(.9),p99:at(.99),max:v.at(-1)??null};
}
export function overlapMs(start,end,spans){
  const ranges=spans.map(row=>[Math.max(start,row.startMs),Math.min(end,row.endMs)])
    .filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  let total=0,last=-Infinity;
  for(const [a,b] of ranges){total+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b);}
  return total;
}
export function summarizeWindow(window){
  const traces=window.traces.map(({record})=>record),probe=window.resourceCorrelation;
  const post=probe?.calls.filter(row=>row.request>0)??[],spans=probe?.scheduling?.spans??[];
  const files=post.map(row=>{
    const r=row.resources[0],continuation=row.mode==='inspection'?row.resumeMs:row.recoveryMs;
    return {generation:row.generation,request:row.request,operation:row.operation,call:row.call,mode:row.mode,stage:row.stage,
      invocationToInitMs:r.initMs-row.invocationMs,initToBeforeMs:r.firstBeforeMs-r.initMs,
      beforeToAfterMs:r.lastAfterMs-r.firstBeforeMs,afterToContinuationMs:continuation-r.lastAfterMs,
      callbackOverlapMs:overlapMs(r.initMs,r.firstBeforeMs,spans),
      eventLoopActiveMs:r.beforeElu?r.beforeElu.active-r.initElu.active:null,
      eventLoopIdleMs:r.beforeElu?r.beforeElu.idle-r.initElu.idle:null};
  });
  const summarize=rows=>Object.fromEntries(['invocationToInitMs','initToBeforeMs','beforeToAfterMs','afterToContinuationMs','callbackOverlapMs','eventLoopActiveMs','eventLoopIdleMs'].map(key=>[key,distribution(rows.map(row=>row[key]))]));
  return {http200:window.requests.filter(row=>row.client.complete&&row.client.status===200).length,
    http500:window.requests.filter(row=>row.client.complete&&row.client.status===500).length,
    indeterminate:window.requests.filter(row=>row.classification.writeOutcome==='indeterminate').length,
    commits:traces.length?traces.reduce((n,row)=>n+(row.services?.commitReported??0),0):null,
    completedNative:traces.length?traces.reduce((n,row)=>n+(row.services?(row.services.nativeStarted-row.services.pending):0),0):null,
    settledServiceCalls:traces.length?traces.reduce((n,row)=>n+(row.services?(row.services.admitted-row.services.pending):0),0):null,
    exhausted:traces.length?traces.filter(row=>row.meter?.exhaustion?.resource==='timeMs').length:null,
    pageElapsedMs:distribution(traces.map(row=>row.meter?.elapsedMs)),
    httpElapsedMs:distribution(window.requests.map(row=>row.server.end-row.server.start)),
    requestEluActiveMs:distribution(traces.map(row=>row.eventLoop.activeMs)),
    requestSamplerLatenessMs:distribution(traces.map(row=>row.scheduling.maxLatenessMs)),
    scheduling:probe?.scheduling?{...probe.scheduling,spans:undefined,spanDurationMs:distribution(spans.map(row=>row.endMs-row.startMs))}:null,
    files:{inspection:summarize(files.filter(row=>row.mode==='inspection')),lifecycle:summarize(files.filter(row=>row.mode==='lifecycle'))},
    longestFiles:[...files].sort((a,b)=>b.initToBeforeMs-a.initToBeforeMs).slice(0,5),
    dropped:probe?{calls:probe.droppedCalls,resources:probe.droppedResources,hookErrors:probe.hookErrors,spans:probe.scheduling?.droppedSpans??0}:null};
}
