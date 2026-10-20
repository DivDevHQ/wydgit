import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../test-support/',import.meta.url);
const evidence=JSON.parse(fs.readFileSync(new URL('http-canonical-mutation-spike-h-evidence-2026-10-20.json',root)));
const bytes=fs.readFileSync(new URL(evidence.archive.file,root)),archive=JSON.parse(gunzipSync(bytes));
test('Spike H source archive preserves before/after provenance and every observed canonical pass',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.archive.sha256);assert.equal(archive.micros.length,8);
 for(const m of archive.micros){
  for(const [name,source]of Object.entries(m.sources))assert.equal(createHash('sha256').update(source).digest('hex'),m.hashes[name]);
  assert.equal(m.cases.length,48);
  for(const c of m.cases){assert.equal(c.rows.length,9);if(m.mode!=='on')continue;
   const expected=c.individual?(m.label==='before'?3:2)*c.mutations:(m.label==='before'?2:1)*c.mutations+1;
   for(const r of c.rows)for(const stage of ['hydrate','dehydrate'])assert.equal(r.attribution.spans.filter(s=>s.stage===stage).reduce((n,s)=>n+s.calls,0),expected);
  }
 }
 for(const before of evidence.micro.filter(m=>m.mode==='on'&&m.label==='before')){
  const after=evidence.micro.find(m=>m.mode==='on'&&m.label==='after'&&['fields','mutations','changed','shape','individual'].every(k=>m[k]===before[k]));assert.deepEqual(after.contextChecks,before.contextChecks);assert.equal(after.installedLifetimeChecks.max,0);
 }
});
test('Spike H retains all HTTP windows and failures with the reliability issue OPEN',()=>{
 assert.equal(evidence.issue.status,'OPEN');assert.equal(evidence.http.length,36);assert.equal(archive.series.length,2);
 for(const series of archive.series){assert.equal(series.summary.complete,true);assert.deepEqual(series.summary.failures,[]);assert.equal(series.captures.length,19);
  for(const [name,source]of Object.entries(series.sources))assert.equal(createHash('sha256').update(source).digest('hex'),series.summary.hashes[name]);
  for(const provider of ['SQLite','JSON'])assert.ok(evidence.http.filter(w=>w.label===series.label&&w.config.provider===provider).some(w=>w.http500>0));
 }
 const observed=evidence.http.filter(w=>w.config.diagnosticsEnabled&&w.config.concurrency===12);
 for(const w of observed){assert.equal(w.commits,12);assert.equal(w.completedNative,24);assert.equal(w.http200+w.http500,12);assert.equal(w.indeterminate,w.http500);}
});
