// Offline Spike H packaging; no runtime writes, network or experiments.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {distribution,summarizeWindow} from './scheduling-attribution.js';
const [output,archive,beforeDir,afterDir,...microFiles]=process.argv.slice(2);
if(!output||!archive||!beforeDir||!afterDir||microFiles.length!==8)throw Error('Usage: canonical-mutation-evidence.mjs NEW_JSON NEW_GZ BEFORE_HTTP_DIR AFTER_HTTP_DIR BEFORE_OFF_1 BEFORE_OFF_2 BEFORE_OFF_3 BEFORE_ON AFTER_OFF_1 AFTER_OFF_2 AFTER_OFF_3 AFTER_ON');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const micros=await Promise.all(microFiles.map(read));
for(const m of micros)for(const [name,source]of Object.entries(m.sources))assert.equal(createHash('sha256').update(source).digest('hex'),m.hashes[name]);
const stage=(c,name)=>c.spans.filter(s=>s.stage===name).reduce((n,s)=>n+s.calls,0);
const times=(c,name)=>c.spans.filter(s=>s.stage===name).reduce((n,s)=>n+s.inclusiveMs,0);
const key=c=>[c.fields,c.mutations,c.changed,c.shape,c.individual].join('|');
const micro=[];
for(const label of ['before','after'])for(const mode of ['off','on']){
 const captures=micros.filter(m=>m.label===label&&m.mode===mode);assert.equal(captures.length,mode==='off'?3:1);
 for(const reference of captures[0].cases){
  const rows=captures.flatMap(m=>m.cases.find(c=>key(c)===key(reference)).rows),{fields,nodes,canonicalBytes,mutations,changed,shape,individual}=reference;
  if(mode==='on')for(const row of rows){
   const expected=(individual?(label==='before'?3:2)*mutations:(label==='before'?2:1)*mutations+1);
   assert.equal(stage(row.attribution,'hydrate'),expected);assert.equal(stage(row.attribution,'dehydrate'),expected);
   assert.equal(row.attribution.counts.hydratedNodes,expected*nodes);assert.equal(row.attribution.stackOverflow,0);assert.equal(row.attribution.droppedArtifacts,0);
  }
  micro.push({label,mode,fields,nodes,canonicalBytes,mutations,changed,shape,individual,repetitions:rows.length,
   editMs:distribution(rows.map(r=>r.editMs)),totalMs:distribution(rows.map(r=>r.totalMs)),processMedians:captures.map(m=>m.cases.find(c=>key(c)===key(reference)).metrics),
   ...(mode==='on'?{hydrations:distribution(rows.map(r=>stage(r.attribution,'hydrate'))),dehydrations:distribution(rows.map(r=>stage(r.attribution,'dehydrate'))),canonicalValidationNodeVisits:distribution(rows.map(r=>r.attribution.counts.hydratedNodes)),contextChecks:distribution(rows.map(r=>stage(r.attribution,'contextCheck'))),installedLifetimeChecks:distribution(rows.map(r=>r.attribution.counts.guardChecks??0))}:{})});
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
   ...(post.length?{canonical:Object.fromEntries(['hydrate','dehydrate','mutation','commit','systemSet'].map(name=>[name,{callsPerPage:distribution(post.map(c=>stage(c,name))),inclusiveMsPerPage:distribution(post.map(c=>times(c,name)))}])),lifetimeChecksPerPage:distribution(post.map(c=>c.counts.guardChecks??0))}:{})});
 }
 series.push({label,summary,sources,captures});
}
const scripts=Object.fromEntries(await Promise.all(['test-support/canonical-mutation-probe.mjs','test-support/canonical-mutation-evidence.mjs','test/canonical-page-edit.test.js'].map(async p=>[p,await fs.readFile(p,'utf8')])));
const bytes=gzipSync(JSON.stringify({schema:'wydgine.spike-h-source/1',micros,series,scripts}));
await fs.writeFile(archive,bytes,{flag:'wx'});
const evidence={schema:'wydgine.canonical-mutation-spike-h-evidence/1',date:'2026-10-20',baseline:'d674f304a818cf589980cb192f8b979cd013c79d',issue:{id:'WYDGINE-0.3-HTTP-LIMIT',status:'OPEN'},node:process.version,
 archive:{file:archive.split('/').at(-1),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length},micro,clear,http,
 methodology:{micro:'Three fresh off processes, three warmups and nine measured samples per case/process; one separately observed process, same cases, nine samples. Timings include performance.now brackets/assertions equally. No benchmark overlaps a suite or another experiment.',passes:'hydrate counts equal full canonical validation passes; hydratedNodes equals property-validation visits. dehydrate counts are canonical serialization-to-envelope passes, not JSON.stringify calls. After also performs M copyEnvelope shape-validation/copy passes per M edits; copies are retained, not free.',baseline:'Current Spike G runtime; before helper delegates to runtime.edit. Page baseline has no adapter. Archived source texts and hashes establish both implementations.',http:'Three fresh windows per mode/provider; SQLite serial existing/attributed, concurrency-12 existing/attributed/off; JSON concurrency-12 attributed. Existing Spike G bounded supervisor/harness, separate client, 1,000 ms Page deadline. Sequential before/after, no reliability inference from micro speed.'},
 exclusions:['Initial benchmark fixture incorrectly compared normalized null-prototype JSON objects with ordinary objects; fixed before all captures.','Restricted-sandbox HTTP workers failed before usable request capture; excluded. Restricted-sandbox node:test produced no usable child results. Native runs replace these attempts.','Initial regression fixtures had two incorrect lifecycle expectations (spread contexts share a fence; ending context can reject Page finalization). Corrected without runtime changes.'],
 limitations:['No OS isolation proof from mocks; installed Linux boundary tests are separately recorded.','Host scheduling/load, filesystem, GC and warmup variance remain. Inclusive synchronous spans overlap and cannot be summed as CPU.','Micro contexts have no installed lifetime guard. Their live context checks are counted, not a package-integrity qualification.','Only the two server Page edit sites are optimized. Shared controller, systemSet, package mutation and portable/client edits retain their previous passes.','Observer overhead is reported separately; attributed HTTP absolute timings are perturbed. Failed Pages perform unequal work.','No production deployment, browser manual, hostile-root filesystem, power-loss or network-filesystem qualification.']};
await fs.writeFile(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,archive,bytes:bytes.length,micro:micro.length,http:http.length}));
