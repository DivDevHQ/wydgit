// Offline Spike G packaging. Reads captures, never executes a workload. Historical
// source validation uses the captured sources, never today's runtime source bytes.
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {distribution} from './scheduling-attribution.js';
const args=process.argv.slice(2);if(args.length!==8)throw Error('Usage: node test-support/prerender-integrity-evidence.mjs BEFORE AFTER BEFORE_TRACE AFTER_TRACE STAMP1 STAMP2 STAMP3 OUTPUT_PREFIX');
const hash=text=>createHash('sha256').update(text).digest('hex');
const archive={schema:'wydgine.spike-g-source/1',groups:[],stampCalibrations:[]};
for(let i=0;i<4;i++){
  const directory=args[i],summary=JSON.parse(await fs.readFile(directory+'/summary.json','utf8'));
  assert.equal(summary.complete,true);assert.deepEqual(summary.failures,[]);
  const sources=JSON.parse(await fs.readFile(directory+'/sources.json','utf8'));
  for(const [file,digest]of Object.entries(summary.hashes))assert.equal(hash(sources[file]),digest);
  const captures=Object.fromEntries(await Promise.all(summary.windows.map(async w=>[w.file,JSON.parse(await fs.readFile(directory+'/'+w.file,'utf8'))])));
  for(const capture of Object.values(captures))if(capture.requests){
    assert.equal(capture.fixtureFailure,null);assert.equal(capture.cleanupComplete,true);assert.equal(capture.clientProcess.reaped,true);
    for(const key of ['client','server','admitted','pageLedger'])if(capture.actualConcurrency[key]!==null)assert.equal(capture.actualConcurrency[key],capture.concurrency);
    for(const c of Array.isArray(capture.synchronousAttribution)?capture.synchronousAttribution:[]){assert.equal(c.droppedArtifacts,0);assert.equal(c.stackOverflow,0);}
    if(capture.resourceCorrelation){assert.equal(capture.resourceCorrelation.hookErrors,0);assert.equal(capture.resourceCorrelation.droppedCalls,0);assert.equal(capture.resourceCorrelation.droppedResources,0);assert.equal(capture.resourceCorrelation.scheduling.droppedSpans,0);assert.equal(capture.resourceCorrelation.scheduling.stackOverflow,0);}
    if(capture.syscalls)assert.equal(capture.syscalls.unmatchedSplitLines,0);
    for(const {record}of capture.traces)assert.equal(record.meter.timeLimitMs,1000);
  }
  archive.groups.push({label:['before','after','beforeTrace','afterTrace'][i],summary,sources,captures});
}
for(let i=4;i<7;i++)archive.stampCalibrations.push(JSON.parse(await fs.readFile(args[i],'utf8')));
archive.packager=await fs.readFile(new URL('./prerender-integrity-evidence.mjs',import.meta.url),'utf8');
archive.calibrationSource=await fs.readFile(new URL('./installation-stamp-probe.mjs',import.meta.url),'utf8');
const filename=args[7]+'-source-2026-10-20.json.gz',bytes=gzipSync(JSON.stringify(archive));
await fs.writeFile(filename,bytes,{flag:'wx'});
const primary=archive.groups.slice(0,2),http=[];
for(const group of archive.groups)for(const prefix of ['serial-existing-','serial-attributed-','existing-','attributed-','observer-off-','json-','trace-']){
  const rows=group.summary.windows.filter(w=>w.label.startsWith(prefix));if(!rows.length)continue;
  const sum=key=>rows.every(w=>w.summary[key]!==null)?rows.reduce((n,w)=>n+(w.summary[key]??0),0):null;
  http.push({group:group.label,mode:prefix.slice(0,-1),windows:rows.map(w=>({label:w.label,http200:w.summary.http200,http500:w.summary.http500,commits:w.summary.commits,completedNative:w.summary.completedNative,exhausted:w.summary.exhausted,pageMedianMs:w.summary.pageElapsedMs.median})),
    http200:sum('http200'),http500:sum('http500'),indeterminate:sum('indeterminate'),commits:sum('commits'),completedNative:sum('completedNative'),exhausted:sum('exhausted')});
}
function aggregate(captures){
  const spans=captures.flatMap(c=>c.spans),stages=[...new Set(spans.map(s=>s.stage))];
  const total=(capture,stage,key,inside)=>capture.spans.filter(s=>s.stage===stage&&(inside===undefined||s.insideBudget===inside)).reduce((n,s)=>n+s[key],0);
  const causes=new Map();
  for(const c of captures)for(const row of c.metadata){
    const key=[row.site,row.operation,row.caller,row.cause,row.insideBudget].join('|');
    const value=causes.get(key)??{site:row.site,operation:row.operation,caller:row.caller,cause:row.cause,insideBudget:row.insideBudget,calls:0,elapsedMs:0};
    value.calls+=row.calls;value.elapsedMs+=row.elapsedMs;causes.set(key,value);
  }
  return {requests:captures.length,stages:Object.fromEntries(stages.map(stage=>[stage,{calls:captures.reduce((n,c)=>n+total(c,stage,'calls'),0),
    perRequestCalls:distribution(captures.map(c=>total(c,stage,'calls'))),inclusiveMs:distribution(captures.map(c=>total(c,stage,'inclusiveMs'))),
    exclusiveMs:distribution(captures.map(c=>total(c,stage,'exclusiveMs'))),insideBudgetInclusiveMs:distribution(captures.map(c=>total(c,stage,'inclusiveMs',true)))}])),
    metadata:[...causes.values()],uniqueArtifacts:distribution(captures.map(c=>c.uniqueArtifacts)),
    guardChecks:distribution(captures.map(c=>c.counts.guardChecks)),repeatedGenerationChecks:distribution(captures.map(c=>c.counts.repeatedGenerationChecks)),
    hydratedNodes:distribution(captures.map(c=>c.counts.hydratedNodes)),copiedNodes:distribution(captures.map(c=>c.counts.copiedNodes))};
}
const attribution=[],scaling=[],installed=[],overhead=[];
for(const group of primary){
  for(const prefix of ['serial-attributed-','attributed-','json-']){
    const windows=group.summary.windows.filter(w=>w.label.startsWith(prefix));
    const captures=windows.flatMap(w=>group.captures[w.file].synchronousAttribution.filter(c=>c.request>0));
    attribution.push({group:group.label,mode:prefix.slice(0,-1),...aggregate(captures)});
  }
  const micro=Object.values(group.captures).find(c=>c.schema==='wydgine.spike-g-micro/1');
  scaling.push({group:group.label,cases:micro.cases.map(c=>{
    const observed=c.rows.filter(r=>r.observed),plain=c.rows.filter(r=>!r.observed);
    const span=(row,stage,key)=>row.attribution.spans.filter(s=>s.stage===stage).reduce((n,s)=>n+s[key],0);
    return {fields:c.fields,treeNodes:c.treeNodes,mutationIntents:c.mutations,changedIntents:c.changed?c.mutations:0,unchangedIntents:c.changed?0:c.mutations,
      uniqueProperties:Math.min(c.fields,c.mutations),changed:c.changed,warmups:c.warmups,repetitions:observed.length,
      elapsedMs:distribution(plain.map(r=>r.elapsedMs)),observedElapsedMs:distribution(observed.map(r=>r.elapsedMs)),
      hydrateCalls:distribution(observed.map(r=>span(r,'hydrate','calls'))),dehydrateCalls:distribution(observed.map(r=>span(r,'dehydrate','calls'))),
      validationMs:distribution(observed.map(r=>span(r,'hydrate','inclusiveMs'))),mutationMs:distribution(observed.map(r=>span(r,'mutation','inclusiveMs'))),
      commitMs:distribution(observed.map(r=>span(r,'commit','inclusiveMs')))};
  })});
  installed.push({group:group.label,rows:micro.installed});
  const rows=[];
  for(let round=1;round<=3;round++){
    const existing=group.summary.windows.find(w=>w.label==='serial-existing-'+round).summary;
    const attributed=group.summary.windows.find(w=>w.label==='serial-attributed-'+round).summary;
    rows.push({round,existingPageMs:existing.pageElapsedMs.median,attributedPageMs:attributed.pageElapsedMs.median,addedPageMs:attributed.pageElapsedMs.median-existing.pageElapsedMs.median});
  }
  overhead.push({group:group.label,serial:rows,interpretation:'Separate fresh children, alternating order; observed difference includes run variance, not a per-span overhead estimate. Concurrent failure counts are in HTTP table.'});
}
const representative=primary.map(group=>{
  const window=group.captures[group.summary.windows.find(w=>w.label==='serial-attributed-1').file];
  return {group:group.label,request:1,trace:window.traces.find(t=>t.index===1).record,attribution:window.synchronousAttribution.find(c=>c.request===1)};
});
const evidence={schema:'wydgine.http-prerender-integrity-spike-g/1',date:'2026-10-20',baseline:'3242934d328917395d6441e6fdd920e0b6292410',
  issue:{id:'WYDGINE-0.3-HTTP-LIMIT',status:'OPEN'},versionsChanged:false,
  runtimeCorrection:{retained:true,scope:'Compare the same freshly inspected dev/ino/size/mtimeNs/ctimeNs BigInts directly; no inspection, validation or authorization result is cached or skipped.',httpReliabilityCorrection:false},
  archive:{file:filename.split('/').at(-1),bytes:bytes.length,sha256:hash(bytes)},
  groups:archive.groups.map(g=>({label:g.label,...g.summary})),http,attribution,scaling,installed,overhead,representative,
  stampCalibrations:archive.stampCalibrations,
  limitations:['Synchronous bracket elapsed includes GC/native execution/descheduling, not measured exclusive CPU.',
    'Exclusive durations remove only nested spans in the same synchronous stack; uninstrumented work remains.',
    'Logical metadata API calls differ from syscalls. Trace windows include setup GET and are strongly perturbed.',
    'Fixture numeric generations and bound-context ordinals are diagnostic identities, not durable authorization tokens.',
    'Single-installation captures count seven fixed guard artifacts by logical identity and other artifacts by ephemeral keyed digest.',
    'JSON and SQLite share application intent but differ in provider queueing/commit semantics. No Gate in Contact fixture.',
    'Before and after are sequential series, not randomized trials or proof of HTTP improvement.'],
  excludedCaptures:'Initial sandbox Contact smoke failed before requests/cleanup; sandbox test process output was unavailable. An initial supervisor failed on a false configuration value. Exploratory pre-final captures are excluded; final sources are pinned and rechecked after each series.'};
await fs.writeFile(args[7]+'-evidence-2026-10-20.json',JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({archiveBytes:bytes.length,http,overhead},null,2));
