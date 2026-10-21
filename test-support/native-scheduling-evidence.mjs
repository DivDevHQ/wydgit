// Offline only. Same-request boundaries and same-process clipped interval unions.
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {distribution,overlapMs} from './scheduling-attribution.js';
const [directory,extrasDirectory]=process.argv.slice(2);if(!directory||!extrasDirectory)throw Error('Usage: native-scheduling-evidence.mjs MATRIX_DIRECTORY EXTRAS_DIRECTORY');
const summary=JSON.parse(await fs.readFile(directory+'/summary.json'));
const windows=[],raw={};
for(const w of summary.windows){
  const item=JSON.parse(await fs.readFile(directory+'/'+w.file)),v=item.value;raw[w.file]=item;
  const operations=[];
  const spans=(v.nativeSchedulingCaptures??[]).flatMap(c=>c.spans.map(s=>({...s,request:c.request})));
  for(const capture of v.nativeSchedulingCaptures??[]){if(!capture.request)continue;
    for(const operation of new Set(capture.rows.map(r=>r.operation))){
      const rows=capture.rows.filter(r=>r.operation===operation),at=name=>rows.find(r=>r.name===name)?.atMs??null;
      const delta=(a,b)=>at(a)!==null&&at(b)!==null?at(b)-at(a):null;
      const providerStart=at('providerEntry'),providerEnd=at('providerComplete'),dispatch=at('dispatch'),end=at('nativeContinuation');
      const peerStamps=spans.filter(s=>s.request>0&&s.request!==capture.request);
      operations.push({request:capture.request,operation,dispatchMs:dispatch,providerCompleteMs:providerEnd,continuationMs:at('pageContinuation'),
        nativeMs:delta('dispatch','nativeContinuation'),invocationToWorkMs:delta('dispatch','workEntry'),workToStoreMs:delta('workEntry','storeEntry'),storeToProviderMs:delta('storeEntry','providerEntry'),
        providerMs:delta('providerEntry','providerComplete'),producerToSettlementMs:delta('providerComplete','providerSettlement'),
        providerToTaskSettlementMs:delta('providerSettlement','taskSettlement'),settlementToNativeMs:delta('taskSettlement','nativeContinuation'),nativeToPageMs:delta('nativeContinuation','pageContinuation'),
        preflightMs:delta('providerEntry','sqliteTransactionStart'),sqliteTransactionMs:delta('sqliteTransactionStart','sqliteTransactionEnd'),
        jsonQueueMs:delta('jsonQueueStart','jsonQueueEnd'),jsonWorkMs:delta('jsonWorkStart','jsonWorkEnd'),
        peerStampOverlapMs:v.nativeCosts&&providerStart!==null&&providerEnd!==null?overlapMs(providerStart,providerEnd,peerStamps):null,
        peerCallbackOverlapMs:v.resourceCorrelation?.enabled&&dispatch!==null&&end!==null&&v.resourceCorrelation?.scheduling?.spans?overlapMs(dispatch,end,v.resourceCorrelation.scheduling.spans.filter(s=>s.request>0&&s.request!==capture.request)):null});
    }
  }
  const remaining={};
  for(const name of ['nativeDispatch','nativeCommit','nativeSettlement','pageContinuation','canonicalPublication','pageComplete'])
    remaining[name]=distribution((v.deadlineLedgers??[]).filter(c=>c.request>0).flatMap(c=>c.rows.filter(r=>r.name===name).map(r=>r.remainingMs)));
  const order=key=>operations.filter(o=>o[key]!==null).sort((a,b)=>a[key]-b[key]).map(o=>[o.request,o.operation]);
  const files=(v.resourceCorrelation?.calls??[]).filter(c=>c.request>0&&c.resources?.length===1);
  const callbackBoundaries={initToCallbackMs:distribution(files.map(c=>c.resources[0].firstBeforeMs-c.resources[0].initMs)),callbackToReactionMs:distribution(files.map(c=>(c.mode==='inspection'?c.resumeMs:c.recoveryMs)-c.resources[0].lastAfterMs))};
  windows.push({...w,operations,remaining,callbackBoundaries,completionOrdering:{provider:order('providerCompleteMs'),page:order('continuationMs'),client:v.requests.toSorted((a,b)=>a.client.end-b.client.end).map(r=>r.index)},
    drops:(v.nativeSchedulingCaptures??[]).reduce((n,c)=>n+c.dropped+c.droppedSpans,0)+(v.deadlineLedgers??[]).reduce((n,c)=>n+c.dropped,0),
    failures:v.traces.filter(t=>t.record.status===500).map(t=>({request:t.index,failure:t.record.failure,meter:t.record.meter})),
    cleanupExhaustions:v.traces.filter(t=>t.record.status===200&&t.record.meter?.exhaustion).map(t=>t.index)});
}
const groups={};
for(const w of windows){const key=[w.provider,w.concurrency,w.mode].join('/'),g=groups[key]??={windows:[],http200:0,http500:0,reconciled:0,reportedCommits:0,completedNative:0};
  g.windows.push(w);g.http200+=w.summary.http200;g.http500+=w.summary.http500;g.reconciled+=w.summary.reconciledRecords;
  g.reportedCommits=w.summary.reportedCommits===null?null:(g.reportedCommits??0)+w.summary.reportedCommits;
  g.completedNative=w.summary.completedNative===null?null:(g.completedNative??0)+w.summary.completedNative;}
for(const g of Object.values(groups)){
  const ops=g.windows.flatMap(w=>w.operations),values=g.windows.flatMap(w=>raw[w.file].value.requests);
  g.clientMs=distribution(values.map(r=>r.client.end-r.client.start));
  g.latency=Object.fromEntries(['nativeMs','invocationToWorkMs','workToStoreMs','storeToProviderMs','providerMs','producerToSettlementMs','providerToTaskSettlementMs','settlementToNativeMs','nativeToPageMs','preflightMs','sqliteTransactionMs','jsonQueueMs','jsonWorkMs','peerStampOverlapMs','peerCallbackOverlapMs'].map(key=>[key,distribution(ops.map(o=>o[key]))]));
  g.eventLoopMaxMs=g.windows.map(w=>w.summary.scheduling?.delay?.maxMs??null);
  g.finalNativeRemainingMs=distribution(g.windows.flatMap(w=>(raw[w.file].value.deadlineLedgers??[]).filter(c=>c.request>0).map(c=>c.rows.filter(r=>r.name==='nativeSettlement').at(-1)?.remainingMs)));
  g.pageRemainingMs=distribution(g.windows.flatMap(w=>(raw[w.file].value.deadlineLedgers??[]).filter(c=>c.request>0).map(c=>c.rows.find(r=>r.name==='pageComplete')?.remainingMs)));
  g.windows=g.windows.map(w=>w.file);
}
const extras={};for(const name of (await fs.readdir(extrasDirectory)).filter(n=>n.endsWith('.json')))extras[name]=JSON.parse(await fs.readFile(extrasDirectory+'/'+name));
const sources={};
for(const file of ['test-support/native-scheduling.js','test-support/native-scheduling-hooks.mjs','test-support/native-scheduling-probe.mjs','test-support/native-scheduling-calibration.mjs','test-support/native-scheduling-contention.mjs','test-support/native-scheduling-evidence.mjs','test-support/native-scheduling-experiments.mjs','test-support/native-scheduling-scenarios.mjs','test-support/production-observer-worker.mjs','test-support/http-concurrency.js',
  'packages/wydstore/src/sqlite-adapter.js','packages/wydstore/src/json-adapter.js','packages/wydstore/src/core.js','packages/wydgine/src/engine/execution/completion.js','packages/wydgine/src/engine/execution/page.js','packages/wydgine/src/engine/packages/index.js','packages/wydgine/src/engine/sewn/execute.js'])sources[file]=await fs.readFile(file,'utf8');
const archive=gzipSync(JSON.stringify({schema:'wydgine.native-scheduling-source/1',summary,raw,extras,sources}),{level:9}),stem='test-support/http-native-scheduling-spike-l';
await fs.writeFile(stem+'-source-2026-10-20.json.gz',archive);
const evidence={schema:'wydgine.native-scheduling-evidence/1',baseline:summary.baseline,runtimeCorrection:false,issue:'WYDGINE-0.3-HTTP-LIMIT',status:'OPEN',environment:summary.environment,
  archive:{file:stem+'-source-2026-10-20.json.gz',sha256:createHash('sha256').update(archive).digest('hex')},
  sourceHashes:Object.fromEntries(Object.entries(sources).map(([f,s])=>[f,createHash('sha256').update(s).digest('hex')])),groups,windows,extras};
await fs.writeFile(stem+'-evidence-2026-10-20.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({windows:windows.length,requests:windows.reduce((n,w)=>n+w.summary.http200+w.summary.http500,0),groups:Object.keys(groups)}));
