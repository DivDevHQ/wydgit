// Offline Spike I packaging; no runtime writes, network or experiments.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {distribution,summarizeWindow} from './scheduling-attribution.js';
const [output,archive,beforeDir,afterDir,...captureFiles]=process.argv.slice(2);
const microFiles=captureFiles.slice(0,8),hotFiles=captureFiles.slice(8,11),visitsFile=captureFiles[11];
if(!output||!archive||!beforeDir||!afterDir||microFiles.length!==8||hotFiles.length!==3||!visitsFile)throw Error('Usage: incremental-validation-evidence.mjs NEW_JSON NEW_GZ BEFORE_HTTP_DIR AFTER_HTTP_DIR BEFORE_OFF_1 BEFORE_OFF_2 BEFORE_OFF_3 BEFORE_ON AFTER_OFF_1 AFTER_OFF_2 AFTER_OFF_3 AFTER_ON HOT_1 HOT_2 HOT_3 VISITS');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const micros=await Promise.all(microFiles.map(read));
for(const m of micros)for(const [name,source]of Object.entries(m.sources))assert.equal(createHash('sha256').update(source).digest('hex'),m.hashes[name]);
const stage=(c,name)=>c.spans.filter(s=>s.stage===name).reduce((n,s)=>n+s.calls,0);
const times=(c,name)=>c.spans.filter(s=>s.stage===name).reduce((n,s)=>n+s.inclusiveMs,0);
const key=c=>[c.tree,c.fields,c.mutations,c.changed,c.shape,c.individual].join('|');
const micro=[];
for(const label of ['before','after'])for(const mode of ['off','on']){
 const captures=micros.filter(m=>m.label===label&&m.mode===mode);assert.equal(captures.length,mode==='off'?3:1);
 for(const reference of captures[0].cases){
  const rows=captures.flatMap(m=>m.cases.find(c=>key(c)===key(reference)).rows),{tree,fields,nodes,canonicalBytes,mutations,changed,shape,individual}=reference;
  if(mode==='on')for(const row of rows){
   const expected=individual?(label==='before'?2:1)*mutations:mutations+(label==='before'?1:0);
   const serializations=individual?2*mutations:mutations+1;
   assert.equal(stage(row.attribution,'hydrate'),expected);assert.equal(stage(row.attribution,'dehydrate'),serializations);
   assert.equal(row.attribution.counts.hydratedNodes,expected*nodes);assert.equal(row.attribution.stackOverflow,0);assert.equal(row.attribution.droppedArtifacts,0);
  }
  micro.push({label,mode,tree,fields,nodes,canonicalBytes,mutations,changed,shape,individual,repetitions:rows.length,
   memory:{heapDelta:distribution(rows.map(r=>r.memoryAfter.heapUsed-r.memoryBefore.heapUsed)),rss:distribution(rows.map(r=>r.memoryAfter.rss))},
   editMs:distribution(rows.map(r=>r.editMs)),totalMs:distribution(rows.map(r=>r.totalMs)),processMedians:captures.map(m=>m.cases.find(c=>key(c)===key(reference)).metrics),
   ...(mode==='on'?{stages:Object.fromEntries(['candidateConstruction','candidateValidation','commitValidation','dehydrate','mutation','commit'].map(name=>[name,{calls:distribution(rows.map(r=>stage(r.attribution,name))),inclusiveMs:distribution(rows.map(r=>times(r.attribution,name)))}])),hydrations:distribution(rows.map(r=>stage(r.attribution,'hydrate'))),dehydrations:distribution(rows.map(r=>stage(r.attribution,'dehydrate'))),canonicalValidationNodeVisits:distribution(rows.map(r=>r.attribution.counts.hydratedNodes)),contextChecks:distribution(rows.map(r=>stage(r.attribution,'contextCheck'))),installedLifetimeChecks:distribution(rows.map(r=>r.attribution.counts.guardChecks??0))}:{})});
 }
}
for(const a of micro.filter(m=>m.label==='before'&&m.mode==='on'))assert.deepEqual(a.contextChecks,micro.find(m=>m.label==='after'&&m.mode==='on'&&key(m)===key(a)).contextChecks);
const clear=[];
for(const label of ['before','after'])for(const mode of ['off','on'])for(const fields of [2,24])for(const changed of [false,true]){
 const rows=micros.filter(m=>m.label===label&&m.mode===mode).flatMap(m=>m.clear.find(c=>c.fields===fields&&c.changed===changed).rows);
 clear.push({label,mode,fields,changed,repetitions:rows.length,metrics:Object.fromEntries(['totalMs','runtimeEditsMs','commitMs','runtimeEdits','propertyWrites'].map(k=>[k,distribution(rows.map(r=>r[k]))])),...(mode==='on'?{hydrations:distribution(rows.map(r=>stage(r.attribution,'hydrate'))),dehydrations:distribution(rows.map(r=>stage(r.attribution,'dehydrate'))),contextChecks:distribution(rows.map(r=>stage(r.attribution,'contextCheck')))}:{})});
}
const http=[],series=[];
for(const [label,dir]of [['before',beforeDir],['after',afterDir]]){
 const summary=await read(dir+'/summary.json'),sources=await read(dir+'/sources.json');assert.equal(summary.complete,true);assert.deepEqual(summary.failures,[]);
 for(const [name,source]of Object.entries(sources))assert.equal(createHash('sha256').update(source).digest('hex'),summary.hashes[name]);
 const captures=[];
 for(const w of summary.windows){
  const value=await read(dir+'/'+w.file);captures.push({file:w.file,value});if(w.label==='micro')continue;
  const post=Array.isArray(value.synchronousAttribution)?value.synchronousAttribution.filter(r=>r.request>0):[];
  assert.equal(value.cleanupComplete,true);assert.ok(!value.fixtureFailure);
  for(const c of post){assert.equal(c.stackOverflow,0);assert.equal(c.droppedArtifacts,0);}
  http.push({label,window:w.label,config:w.config,...summarizeWindow(value),
   ...(post.length?{canonical:Object.fromEntries(['hydrate','dehydrate','mutation','commit','systemSet','candidateConstruction','candidateValidation','commitValidation'].map(name=>[name,{callsPerPage:distribution(post.map(c=>stage(c,name))),inclusiveMsPerPage:distribution(post.map(c=>times(c,name)))}])),canonicalNodeVisitsPerPage:distribution(post.map(c=>c.counts.hydratedNodes??0)),lifetimeChecksPerPage:distribution(post.map(c=>c.counts.guardChecks??0))}:{})});
 }
 series.push({label,summary,sources,captures});
}
const exceptional=micros.flatMap(m=>m.exceptional.map(c=>({label:m.label,mode:m.mode,invalid:c.invalid,totalMs:distribution(c.rows.map(r=>r.totalMs)),...(m.mode==='on'?{hydrations:distribution(c.rows.map(r=>stage(r.attribution,'hydrate'))),nodes:distribution(c.rows.map(r=>r.attribution.counts.hydratedNodes??0)),contextChecks:distribution(c.rows.map(r=>stage(r.attribution,'contextCheck')))}:{})})));
const concurrent=micros.map(m=>({label:m.label,mode:m.mode,totalMs:distribution(m.concurrent.map(r=>r.totalMs))}));
const visits=await read(visitsFile);
for(const [name,source]of Object.entries(visits.sources))assert.equal(createHash('sha256').update(source).digest('hex'),visits.hashes[name]);
const hotControls=await Promise.all(hotFiles.map(read));
for(const capture of hotControls)for(const [name,source]of Object.entries(capture.sources))assert.equal(createHash('sha256').update(source).digest('hex'),capture.hashes[name]);
const hot=hotControls[0].rows.map(reference=>{
 const rows=hotControls.map(c=>c.rows.find(r=>r.fields===reference.fields&&r.individual===reference.individual));
 const samples=rows.flatMap(r=>r.samples);
 return {fields:reference.fields,nodes:reference.nodes,individual:reference.individual,warmups:20,processes:3,repetitions:samples.length,
  before:distribution(samples.map(s=>s.before)),after:distribution(samples.map(s=>s.after)),pairedDeltaMs:distribution(samples.map(s=>s.after-s.before)),processMedians:rows.map(r=>({before:r.before.median,after:r.after.median}))};
});
const exploratoryLogs=await Promise.all(['before-off-1.log','before-off-1-fixed.log'].map(async file=>({file,text:await fs.readFile(beforeDir+'/../'+file,'utf8').catch(()=>null)})));
const scripts=Object.fromEntries(await Promise.all(['test-support/incremental-validation-probe.mjs','test-support/incremental-validation-control.mjs','test-support/incremental-validation-visits.mjs','test-support/prerender-integrity-probe.mjs','test-support/incremental-validation-evidence.mjs','test/canonical-page-edit.test.js','test-support/prerender-integrity-hooks.mjs','test-support/prerender-integrity-attribution.js'].map(async p=>[p,await fs.readFile(p,'utf8')])));
const bytes=gzipSync(JSON.stringify({schema:'wydgine.spike-i-source/1',micros,series,scripts,hotControls,exploratoryLogs,visits}));
await fs.writeFile(archive,bytes,{flag:'wx'});
const evidence={schema:'wydgine.incremental-validation-spike-i-evidence/1',date:'2026-10-20',baseline:'b82a9809f72c9e99a1c733813f3864064f1a0221',issue:{id:'WYDGINE-0.3-HTTP-LIMIT',status:'OPEN'},node:process.version,
 archive:{file:archive.split('/').at(-1),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length},micro,clear,http,exceptional,concurrent,hot,validationVisits:visits.rows,
 methodology:{micro:'Three fresh off processes, three warmups and nine measured samples per case/process; one separately observed process, same cases, nine samples. Timings include performance.now brackets/assertions equally. No benchmark overlaps a suite or another experiment.',passes:'hydrate counts equal full canonical validation passes; hydratedNodes counts completed structural visits; validationVisits separately includes early rejection visits. dehydrate counts are canonical serialization-to-envelope passes, not JSON.stringify calls. Both perform M copyEnvelope shape/JSON copies per M edits and M+1 dehydrates (2M for M individual setters). After avoids only the last commit hydration when there is a successful candidate; zero-success commits still hydrate.',baseline:'Actual unmodified Spike H canonical adapter and Page at b82a980; candidate differs only in the server canonical adapter. Both captured under identical probe source and observer settings, in sequential fresh processes.',hotControl:'Three fresh processes; twenty alternating warmups and 27 measured pairs for each case. H helper body loaded from its archived source with import relocation only; both paths use the same runtime modules in the same process. No hooks.',http:'Three fresh windows per mode/provider; SQLite serial existing/attributed, concurrency-12 existing/attributed/off; JSON concurrency-12 attributed. Existing Spike G bounded supervisor/harness, separate client, 1,000 ms Page deadline. Sequential before/after, no reliability inference from micro speed.'},
 exclusions:['First extended fixture omitted required block content; fixed before retained captures.','Second extended attempt exhausted the existing deadline in the 69-node two-Page microcase; reduced concurrent semantic fixture to seven nodes. No limits changed. Aborted attempts emitted no complete timing capture; their failure logs are preserved.'],
 limitations:['No OS isolation proof from mocks; installed Linux boundary tests are separately recorded.','Host scheduling/load, filesystem, GC and warmup variance remain. Inclusive synchronous spans overlap and cannot be summed as CPU.','Micro contexts have no installed lifetime guard. Their live context checks are counted, not a package-integrity qualification.','Only the two server Page edit sites are optimized. Shared controller, systemSet, package mutation and portable/client edits retain their previous passes.','Observer overhead is reported separately; attributed HTTP absolute timings are perturbed. Failed Pages perform unequal work.','No production deployment, browser manual, hostile-root filesystem, power-loss or network-filesystem qualification.']};
await fs.writeFile(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,archive,bytes:bytes.length,micro:micro.length,http:http.length}));
