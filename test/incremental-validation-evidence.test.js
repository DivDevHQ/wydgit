import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../test-support/',import.meta.url);
const evidence=JSON.parse(fs.readFileSync(new URL('http-incremental-validation-spike-i-evidence-2026-10-20.json',root)));
const bytes=fs.readFileSync(new URL(evidence.archive.file,root)),archive=JSON.parse(gunzipSync(bytes));
const calls=(a,stage)=>a.spans.filter(s=>s.stage===stage).reduce((n,s)=>n+s.calls,0);
const key=c=>[c.tree,c.fields,c.mutations,c.changed,c.shape,c.individual].join('|');
test('Spike I preserves H baseline provenance, exact pass reductions and every live context check',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.archive.sha256);assert.equal(archive.micros.length,8);
 const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('http-canonical-mutation-spike-h-source-2026-10-20.json.gz',root))));
 assert.equal(archive.hotControls.length,3);
 for(const capture of archive.hotControls){for(const [name,source]of Object.entries(capture.sources))assert.equal(createHash('sha256').update(source).digest('hex'),capture.hashes[name]);for(const row of capture.rows){assert.equal(row.warmups,20);assert.equal(row.samples.length,27);}}
 for(const [name,source]of Object.entries(archive.visits.sources))assert.equal(createHash('sha256').update(source).digest('hex'),archive.visits.hashes[name]);
 assert.deepEqual(archive.visits.rows.map(r=>r.totalVisits),[1173,285,1104,285]);
 const helper='packages/wydgine/src/engine/execution/canonical-edit.js';
 const baseline=historical.micros.find(m=>m.label==='after').sources[helper];
 for(const m of archive.micros){
  assert.equal(m.cases.length,60);if(m.label==='before')assert.equal(m.sources[helper],baseline);
  for(const [name,source]of Object.entries(m.sources))assert.equal(createHash('sha256').update(source).digest('hex'),m.hashes[name]);
  for(const c of m.cases){assert.equal(c.rows.length,9);if(m.mode!=='on')continue;
   const expected=c.individual?(m.label==='before'?2:1)*c.mutations:c.mutations+(m.label==='before'?1:0);
   for(const row of c.rows){
    assert.equal(calls(row.attribution,'hydrate'),expected);assert.equal(row.attribution.counts.hydratedNodes,expected*c.nodes);
    assert.equal(calls(row.attribution,'dehydrate'),c.individual?2*c.mutations:c.mutations+1);
    assert.equal(calls(row.attribution,'candidateConstruction'),c.mutations);assert.equal(calls(row.attribution,'candidateValidation'),c.mutations);
    assert.equal(row.attribution.counts.guardChecks??0,0);assert.equal(row.attribution.stackOverflow,0);assert.equal(row.attribution.droppedArtifacts,0);
   }
  }
  if(m.mode==='on')for(const c of m.exceptional.filter(c=>c.invalid))for(const row of c.rows)assert.equal(calls(row.attribution,'hydrate'),17);
 }
 const before=archive.micros.find(m=>m.mode==='on'&&m.label==='before'),after=archive.micros.find(m=>m.mode==='on'&&m.label==='after');
 for(const c of before.cases){const other=after.cases.find(v=>key(v)===key(c));assert.ok(other);assert.deepEqual(other.rows.map(r=>calls(r.attribution,'contextCheck')),c.rows.map(r=>calls(r.attribution,'contextCheck')));}
});
test('Spike I retains all separate-client HTTP outcomes without closing the reliability issue',()=>{
 assert.equal(evidence.issue.status,'OPEN');assert.equal(evidence.http.length,36);assert.equal(archive.series.length,2);
 for(const series of archive.series){
  assert.equal(series.summary.complete,true);assert.deepEqual(series.summary.failures,[]);assert.equal(series.captures.length,19);
  for(const [name,source]of Object.entries(series.sources))assert.equal(createHash('sha256').update(source).digest('hex'),series.summary.hashes[name]);
  for(const w of evidence.http.filter(w=>w.label===series.label)){
   assert.equal(w.http200+w.http500,w.config.concurrency);
   if(w.config.diagnosticsEnabled){assert.equal(w.commits,w.config.concurrency);assert.equal(w.completedNative,2*w.config.concurrency);assert.equal(w.indeterminate,w.http500);}
  }
 }
});
