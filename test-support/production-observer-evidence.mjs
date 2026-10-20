// Offline packaging only. Does not run/retry Contact or overwrite historical data.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {distribution} from './scheduling-attribution.js';
import {summarizeProductionWindow} from './production-observer-probe.mjs';
const root=process.argv[2];if(!root)throw Error('Supply completed Spike J directory');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const sourcesBefore=await read(path.join(root,'sources-before.json'));
const sourcesAfter=Object.fromEntries(await Promise.all([...Object.keys(sourcesBefore),
  'test-support/production-observer-label-control.mjs','test-support/production-observer-evidence.mjs','test/production-observer.test.js'
].map(async name=>[name,await fs.readFile(name,'utf8')])));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const series=[];
for(const name of ['baseline','repeat','serial']){
  const summary=await read(path.join(root,name,'summary.json'));
  if(!summary.complete)throw Error('Incomplete series: '+name);
  const captures=[];
  for(const window of summary.windows){
    const capture=await read(path.join(root,name,window.file));
    if(capture.status.code!==0||capture.status.reason||capture.value.fixtureFailure||!capture.value.cleanupComplete)throw Error('Invalid capture');
    captures.push({...window,...capture,summary:summarizeProductionWindow(capture.value)});
  }
  series.push({name,environment:summary.environment,elapsedMs:summary.elapsedMs,captures});
}
const calibrations={before:[],candidate:[],paired:[]};
for(let round=1;round<=3;round++){
  calibrations.before.push(await read(path.join(root,'calibration-'+round+'.json')));
  calibrations.candidate.push(await read(path.join(root,'calibration-candidate-'+round+'.json')));
  calibrations.paired.push(await read(path.join(root,'label-control-'+round+'.json')));
}
const archive={schema:'wydgine.production-observer-spike-j-source/1',baseline:'d97b06c37c9363f9652e1eebd1879dfaf412a029',
  sourcesBefore,sourcesAfter,hashesBefore:Object.fromEntries(Object.entries(sourcesBefore).map(([n,s])=>[n,hash(s)])),
  hashesAfter:Object.fromEntries(Object.entries(sourcesAfter).map(([n,s])=>[n,hash(s)])),series,calibrations,
  preflight:{restricted:await read(path.join(root,'smoke.json')),native:await read(path.join(root,'native-smoke.json'))}};
const file='http-production-observer-spike-j-source-2026-10-20.json.gz',bytes=gzipSync(JSON.stringify(archive));
await fs.writeFile('test-support/'+file,bytes,{flag:'wx'});
const http=[];
for(const s of series)for(const provider of ['SQLite','JSON'])for(const observer of ['off','minimal','loop','filesystem','canonical','guard','extended']){
  const captures=s.captures.filter(c=>c.provider===provider&&c.observer===observer);if(!captures.length)continue;
  const traces=captures.flatMap(c=>c.value.traces.map(t=>t.record));
  const sum=key=>captures.reduce((n,c)=>n+c.summary[key],0);
  const post=captures.flatMap(c=>c.value.synchronousAttribution?.filter(a=>a.request>0)??[]);
  http.push({series:s.name,provider,observer,windows:captures.length,requests:captures.reduce((n,c)=>n+c.value.requests.length,0),
    http200:sum('http200'),http500:sum('http500'),indeterminate:sum('indeterminate'),unexpected:sum('unexpected'),
    reportedCommits:traces.length?sum('reportedCommits'):null,completedNative:traces.length?sum('completedNative'):null,
    exhausted:traces.length?sum('exhausted'):null,reconciledRecords:sum('reconciledRecords'),
    responseMs:distribution(captures.flatMap(c=>c.value.requests.map(r=>r.client.end-r.client.start))),
    pageMs:distribution(traces.map(t=>t.meter?.elapsedMs)),
    failuresByCode:Object.fromEntries([...new Set(traces.map(t=>t.failure?.code).filter(Boolean))].map(code=>[code,traces.filter(t=>t.failure?.code===code).length])),
    guardChecks:post.some(a=>a.counts.guardChecks)?distribution(post.map(a=>a.counts.guardChecks)):null,
    fsDeliveryMs:distribution(captures.flatMap(c=>(c.value.resourceCorrelation?.calls??[]).filter(f=>f.request>0&&f.correlation.endsWith('-single-resource')).map(f=>f.resources[0].firstBeforeMs-f.resources[0].initMs))),
    loopDelayMaxMs:distribution(captures.map(c=>c.summary.scheduling?.delay.maxMs)),
    memoryHeapDeltaBytes:distribution(captures.map(c=>c.value.worker.memoryAfter.heapUsed-c.value.worker.memoryBefore.heapUsed)),
    memoryRssBytes:distribution(captures.map(c=>c.value.worker.memoryAfter.rss)),
    workerInitializationMs:distribution(captures.map(c=>c.value.worker.initializationMs)),
    windowsRaw:captures.map(c=>({label:c.label,status:c.status,...c.summary}))});
}
const evidence={schema:'wydgine.production-observer-spike-j-evidence/1',date:'2026-10-20',baseline:archive.baseline,
  archive:{file,sha256:hash(bytes),bytes:bytes.length},issue:{id:'WYDGINE-0.3-HTTP-LIMIT',status:'OPEN'},
  retainedCorrection:'Diagnostic-only bounded reuse of seven logical artifact labels; all metadata operations execute. No shipped runtime correction.',
  methodology:{http:'Sequential fresh server processes, separate client, same Contact installer, empty dataset, no spacing, concurrency 12, unchanged 1000 ms Page deadline. Ten off windows plus seven-mode alternating three-round matrix per series; three JSON off and three extended controls. Separate serial equal-work controls.',
    off:'All optional observers disabled. Existing fixture request/admission bookkeeping and unconditional production Page diagnostics remain. Off native-operation counts, Page elapsed and exhaustion are unobserved, never zero.',
    modes:'Minimal HTTP diagnostics are the common base for loop/filesystem/canonical/guard/extended. Loop adds histogram/ELU only, no async hook. Filesystem adds async correlation only. Canonical and guard hooks select disjoint target groups; extended reproduces existing G attribution.',
    reconciliation:'Fresh authorized provider query after all responses, limit 20 > 12 writes, initially empty data. Aggregate records, not a per-response write-ID mapping or proof of exactly-once delivery.',
    calibration:'Three fresh processes per version; nine alternating measured rounds after one warmup, 30000 resolved Promises and 70000 stub metadata calls. No Contact/real filesystem cost. Paired label controls: three processes, twenty warmup pairs, nine measured pairs, identical 70000 invocations. Synchronous elapsed includes OS/native/GC, not exclusive CPU.',
    limits:'No statistical tail bound or causal reliability claim from success-count changes. Memory snapshots include fixture/JIT/provider state; no GC PerformanceObserver or allocation profile installed. Builtin Page diagnostics remain production overhead. Baseline monitor controls were finalized during off-mode captures; no off-mode behavior changed. Serial controls follow correction and are not before/after pairs.'},http,
  calibrationSummary:{
    before:calibrations.before.map(c=>Object.fromEntries(['off','loop','filesystem','scheduling'].map(m=>[m,distribution(c.rows.filter(r=>r.mode===m).map(r=>r.elapsedMs))]))),
    candidate:calibrations.candidate.map(c=>Object.fromEntries(['off','loop','filesystem','scheduling'].map(m=>[m,distribution(c.rows.filter(r=>r.mode===m).map(r=>r.elapsedMs))]))),
    labels:calibrations.paired.map(c=>Object.fromEntries(['reference','candidate'].map(m=>[m,distribution(c.rows.filter(r=>r.label===m).map(r=>r.elapsedMs))])))
  }};
await fs.writeFile('test-support/http-production-observer-spike-j-evidence-2026-10-20.json',JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file,sha256:hash(bytes),groups:http.length,windows:series.reduce((n,s)=>n+s.captures.length,0)}));
