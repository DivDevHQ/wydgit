// Offline packaging; never runs workloads or alters prior captures.
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {distribution,summarizeWindow,overlapMs} from './scheduling-attribution.js';
import {partitionNativeGaps} from './native-settlement-gap.js';
const [primary,attribution,exploratory,exploratoryAttribution,calibration,output]=process.argv.slice(2);
if(!output)throw Error('Usage: node test-support/scheduling-attribution-evidence.mjs PRIMARY ATTRIBUTION EXPLORATORY EXPLORATORY_ATTRIBUTION CALIBRATION NEW_OUTPUT');
const groups=[],sources=[];
for(const [label,directory] of Object.entries({primary,attribution,exploratory,exploratoryAttribution})){
  const series=JSON.parse(await fs.readFile(directory+'/summary.json')),windows=[];
  for(const entry of series.windows){
    const value=JSON.parse(await fs.readFile(directory+'/'+entry.file));sources.push({group:label,file:entry.file,value});
    const p=value.probe??value.resourceCorrelation;
    let summary=value.workerFailure?value:entry.config.kind==='isolated'?{
      initToBeforeMs:distribution(p.calls.map(row=>row.resources[0].firstBeforeMs-row.resources[0].initMs)),
      invocationToInitMs:distribution(p.calls.map(row=>row.resources[0].initMs-row.invocationMs)),
      beforeToAfterMs:distribution(p.calls.map(row=>row.resources[0].lastAfterMs-row.resources[0].firstBeforeMs)),
      afterToRecoveryMs:distribution(p.calls.map(row=>row.recoveryMs-row.resources[0].lastAfterMs)),
      scheduling:{...p.scheduling,spans:undefined},pressure:value.pressure,
      kernelToHookMs:value.syscallTrace?distribution(p.calls.map(row=>{
        const candidates=value.syscallTrace.syscalls.filter(sc=>sc.request===row.request);
        if(candidates.length!==1)throw Error('Nonunique isolated syscall identity');
        const sc=candidates[0];return row.resources[0].firstBeforeMs-(sc.startMs+sc.durationMs);
      })):null}:summarizeWindow(value);
    if(p?.nativeCalls?.length)summary.nativeGaps=partitionNativeGaps(p);
    if(value.cpuProfile)summary.cpuProfile={...value.cpuProfile,frames:value.cpuProfile.frames.map(row=>({frame:row.frame,leaf:row.leaf,inclusiveOccurrences:row.inclusiveOccurrences??row.inclusive}))};
    if(value.syscallTrace){
      const trace=value.syscallTrace,main=trace.syscalls.filter(row=>row.thread===value.clock.mainThread);
      summary.syscalls={bytes:trace.bytes,unmatchedSplitLines:trace.unmatchedSplitLines,count:trace.syscalls.length,
        mainThreadCount:main.length,byKind:Object.fromEntries([...new Set(trace.syscalls.map(row=>row.kind))].map(kind=>[kind,{
          count:trace.syscalls.filter(row=>row.kind===kind).length,elapsedMs:distribution(trace.syscalls.filter(row=>row.kind===kind).map(row=>row.durationMs))}])),
        guardFiles:Object.fromEntries([...new Set(main.filter(row=>row.guardFile).map(row=>row.guardFile))].map(file=>[file,main.filter(row=>row.guardFile===file).length]))};
    }
    windows.push({file:entry.file,label:entry.label,config:entry.config,trace:entry.trace,pool:entry.pool,summary});
  }
  sources.push({group:label,file:'summary.json',value:series});
  groups.push({label,environment:series.environment,complete:series.complete,failures:series.failures,elapsedMs:series.elapsedMs,windows});
}
const representative=sources.find(row=>row.group==='primary'&&row.file==='03-scheduled-1.json').value;
const request=12; // fixed request ordinal, not a favorable/outcome-selected sample
const trace=representative.traces.find(row=>row.index===request).record,p=representative.resourceCorrelation,
  natives=p.nativeCalls.filter(row=>row.request===request),inspections=p.inspections.filter(row=>row.request===request),files=p.calls.filter(row=>row.request===request),
  deadline=trace.meter.timing.deadlineAtMs;
const boundaries=[];
for(const [kind,rows] of [['native',natives],['inspection',inspections]])for(const row of rows)for(const [key,value]of Object.entries(row)){
  if(!key.endsWith('WallMs'))continue;
  const monoKey=key.slice(0,-6);
  boundaries.push({kind,operation:row.operation,boundary:monoKey,monotonicMs:row[monoKey],remainingMs:deadline-value});
}
const longest=files.map(row=>({row,r:row.resources[0]})).sort((a,b)=>(b.r.firstBeforeMs-b.r.initMs)-(a.r.firstBeforeMs-a.r.initMs))[0];
const calibrationValue=JSON.parse(await fs.readFile(calibration));sources.push({group:'calibration',value:calibrationValue});
const archive=output.replace('-evidence-','-source-').replace(/\.json$/,'.json.gz'),bytes=gzipSync(Buffer.from(JSON.stringify({schema:'wydgine.spike-f-source/1',sources})),{level:9});
await fs.writeFile(archive,bytes,{flag:'wx'});
const result={schema:'wydgine.http-scheduling-attribution-spike-f/1',date:'2026-10-20',startingHead:'685d3eba1dfa35e64c9dc9fa9fcbeefa9326f331',branch:'develop/0.3',
  issue:{id:'WYDGINE-0.3-HTTP-LIMIT',status:'OPEN'},runtimeCorrection:false,versionsChanged:false,
  archive:{file:archive.split('/').at(-1),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length},
  interpretation:{clocks:'performance.now intervals within each process; Date.now ledger semantics unchanged; client and server monotonic origins must not be subtracted',
    hooks:'FSREQPROMISE before/after bracket callback execution, not physical completion or Promise continuation; init-to-before contains unresolved worker/OS/delivery components',
    eventLoop:'process-wide overlapping activity; ELU active includes synchronous native calls and preemption, not CPU; histogram covers setup GET + POSTs + client startup/exit, not installer/shutdown',
    spans:'>=0.5ms synchronous callback wall intervals; union overlap is a lower bound; short callbacks and work outside before/after are omitted',
    profiling:'leaf counts are exclusive statistical samples; inclusiveOccurrences count stack occurrences (including recursive duplicates), overlap and must not be summed or converted to disjoint percentages',
    syscall:'-T is traced syscall elapsed time, includes tracing/scheduling overhead, excludes libuv queue/delivery; realtime ordering bridge is approximate, no Contact syscall-to-request join',
    unknown:'observer-off native commits, calls, deadlines and Page elapsed are unobserved (null), never zero; HTTP headers/receipt still observed',
    exploratory:'first matrix omitted supervisor TMPDIR, one fewer inspected ancestor per operation; retained separately and excluded from primary comparisons; first exploratory traces lacked guard-file classification',
    scope:'diagnostic investigation, not production reliability/security qualification'},groups,
  representative:{group:'primary',file:'03-scheduled-1.json',request,trace,requestSpans:representative.requests.find(row=>row.index===request),natives,inspections,files,
    clear:representative.formClear.rows.filter(row=>row.request===request),boundaries:boundaries.sort((a,b)=>a.monotonicMs-b.monotonicMs),
    longestFilesystem:{call:longest.row.call,initToBeforeMs:longest.r.firstBeforeMs-longest.r.initMs,
      synchronousCallbackOverlapMs:overlapMs(longest.r.initMs,longest.r.firstBeforeMs,p.scheduling.spans)}},
  calibration:{...calibrationValue,distributions:Object.fromEntries(['off','hook','scheduling'].map(mode=>[mode,distribution(calibrationValue.rows.filter(row=>row.mode===mode).map(row=>row.elapsedMs))]))}};
await fs.writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
