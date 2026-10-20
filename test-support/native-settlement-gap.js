// Offline analysis only. Identity joins are exact; no timestamp-nearness matching.
export function partitionNativeGaps({nativeCalls,inspections}){
  const pairs=[];
  const unique=(rows,request,operation)=>{
    const found=rows.filter(row=>row.request===request&&row.operation===operation);
    return found.length===1?found[0]:null;
  };
  const duration=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&a<=b?b-a:null;
  for(const first of nativeCalls){
    if(first.request===0||unique(nativeCalls,first.request,first.operation)!==first)continue;
    const second=unique(nativeCalls,first.request,first.operation+1);
    // Eligibility requires observed native completion before the next dispatch.
    if(!second||duration(first.completeMs,second.dispatchMs)===null)continue;
    const previousInspection=unique(inspections,first.request,first.operation);
    const nextInspection=unique(inspections,first.request,second.operation);
    // Preserve the original experiment's completion boundary when available.
    const completion=previousInspection?.settledMs??first.completeMs;
    const bounds=[completion,first.pageContinuationMs,second.dispatchMs,second.storeEntryMs,nextInspection?.entryMs??null];
    const partitions=bounds.slice(1).map((end,i)=>duration(bounds[i],end));
    const observed=partitions.filter(value=>value!==null).length;
    const total=duration(bounds[0],bounds[4]);
    const clear=duration(first.clearStartMs,first.clearEndMs);
    const clearContained=clear!==null&&duration(bounds[1],first.clearStartMs)!==null&&duration(first.clearEndMs,bounds[2])!==null;
    pairs.push({request:first.request,firstOperation:first.operation,secondOperation:second.operation,
      boundariesMs:bounds,completionBoundary:previousInspection?.settledMs!=null?'existing-completion-finally':'native-completion-finally',
      partitionsMs:partitions,totalMs:total,status:observed===4?'complete':observed?'partial':'missing',
      clearMs:clearContained?clear:null,
      pageOutsideClearMs:clearContained&&partitions[1]!==null?partitions[1]-clear:null,
      residualMs:observed===4&&total!==null?total-partitions.reduce((a,b)=>a+b,0):null});
  }
  return {eligible:pairs.length,complete:pairs.filter(p=>p.status==='complete').length,
    partial:pairs.filter(p=>p.status==='partial').length,missing:pairs.filter(p=>p.status==='missing').length,pairs};
}
