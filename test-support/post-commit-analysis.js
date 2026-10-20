import {distribution} from './scheduling-attribution.js';
export function classifyPostCommit(client,trace,ledger){
  const rows=ledger?.rows??[],commit=rows.some(r=>r.name==='nativeCommit')||trace?.services?.commitReported>0;
  if(client.complete&&client.status===200)return {class:7,evidence:'client completed HTTP 200'};
  if(!client.complete&&rows.some(r=>r.name==='responseHandoff'))return {class:6,evidence:'res.end returned; client response incomplete'};
  if(commit&&trace?.failure?.code==='SEWN.LIMIT'&&trace?.meter?.exhaustion?.resource==='timeMs')return {class:3,evidence:'reported native commit, Page SEWN.LIMIT failure and authoritative timeMs exhaustion'};
  // Absence of a commit report is not proof that a submitted write rolled back.
  if(trace?.services?.nativeStarted===0)return {class:1,evidence:'no native handler began'};
  return {class:'unknown',evidence:'insufficient per-request stage evidence'};
}
const first=(rows,name)=>rows.find(r=>r.name===name),last=(rows,name)=>rows.findLast(r=>r.name===name);
export function summarizePostCommit(windows){
  const requests=windows.flatMap(w=>w.value.requests.map(request=>{
    const trace=w.value.traces.find(t=>t.index===request.index)?.record,ledger=w.value.deadlineLedgers?.find(l=>l.request===request.index),rows=ledger?.rows??[];
    const start=first(rows,'budgetStart'),commit=first(rows,'nativeCommit'),settled=last(rows,'nativeSettlement'),clear=last(rows,'clearExit'),pub=last(rows,'canonicalPublication'),complete=last(rows,'pageComplete');
    const duration=(a,b)=>a&&b&&b.atMs>=a.atMs?b.atMs-a.atMs:null;
    return {window:w.file,index:request.index,classification:classifyPostCommit(request.client,trace,ledger),
      http:request.client.status,commits:trace?.services?.commitReported??null,completedNative:trace?trace.services.nativeStarted-trace.services.pending:null,
      exhausted:trace?trace.meter?.exhaustion?.resource==='timeMs':null,
      clientMs:request.client.end-request.client.start,pageMs:trace?.meter?.elapsedMs??null,
      firstCommitRemainingMs:commit?.remainingMs??null,finalSettlementRemainingMs:settled?.remainingMs??null,afterClearRemainingMs:clear?.remainingMs??null,
      lastPublicationRemainingMs:pub?.remainingMs??null,completedFinalPublicationRemainingMs:trace&&!trace.failure?pub?.remainingMs??null:null,pageCompletionRemainingMs:complete?.remainingMs??null,
      postCommitMs:duration(commit,complete),postCommitToFinalSettlementMs:duration(commit,settled),finalSettlementToPageCompletionMs:duration(settled,complete),
      commitToNextDispatchMs:duration(commit,rows.find(r=>r.name==='nativeDispatch'&&commit&&r.atMs>=commit.atMs)),
      finalNativeAwaitMs:duration(last(rows,'nativeDispatch'),settled),finalSettlementToLastPublicationMs:duration(settled,pub),lastPublicationToPageCompletionMs:duration(pub,complete),
      clearMs:duration(last(rows,'clearEntry'),clear),responsePreparationToHandoffMs:duration(first(rows,'responsePreparation'),first(rows,'responseHandoff')),
      constructionMs:duration(first(rows,'outputConstruction'),first(rows,'outputConstructed')),
      pageContinuationDelayMs:duration(first(rows,'nativeSettlement'),first(rows,'pageContinuation')),
      costs:ledger?.synchronous??null,
      failureTimeline:request.client.status===500&&start?rows.map(r=>({...r,offsetMs:r.atMs-start.atMs,atMs:undefined})):null,
      firstExhaustedCheck:ledger?.firstExhaustedCheck??null,lastCheck:ledger?.lastCheck??null,
      // These sampler/histogram maxima overlap and must never be added.
      scheduling:trace?.scheduling??null};
  }));
  const sum=key=>requests.reduce((n,r)=>n+(r[key]??0),0),dist=key=>distribution(requests.map(r=>r[key]));
  const metricKeys=['clientMs','pageMs','firstCommitRemainingMs','finalSettlementRemainingMs','afterClearRemainingMs','lastPublicationRemainingMs','completedFinalPublicationRemainingMs','pageCompletionRemainingMs',
    'postCommitMs','postCommitToFinalSettlementMs','finalSettlementToPageCompletionMs','commitToNextDispatchMs','finalNativeAwaitMs','finalSettlementToLastPublicationMs','lastPublicationToPageCompletionMs',
    'clearMs','responsePreparationToHandoffMs','constructionMs','pageContinuationDelayMs'];
  const stages=[...new Set(requests.flatMap(r=>Object.keys(r.costs??{})))];
  return {windows:windows.length,requests:requests.length,http200:requests.filter(r=>r.http===200).length,http500:requests.filter(r=>r.http===500).length,
    knownCommits:requests.some(r=>r.commits!==null)?sum('commits'):null,knownCompletedNative:requests.some(r=>r.completedNative!==null)?sum('completedNative'):null,
    observedDeadlineExhaustions:requests.some(r=>r.exhausted!==null)?sum('exhausted'):null,
    reconciledRecords:windows.reduce((n,w)=>n+(w.value.reconciliation?.records??0),0),
    classifications:Object.fromEntries([1,2,3,4,5,6,7,'unknown'].map(k=>[k,requests.filter(r=>r.classification.class===k).length])),
    distributions:Object.fromEntries(metricKeys.map(k=>[k,dist(k)])),
    synchronous:Object.fromEntries(stages.map(stage=>[stage,Object.fromEntries(['calls','elapsedMs','postCommitCalls','postCommitMs'].map(k=>[k,distribution(requests.map(r=>r.costs?.[stage]?.[k]))]))])),
    requestsDetail:requests};
}
