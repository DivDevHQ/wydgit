import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const e=JSON.parse(await fs.readFile(new URL('../test-support/http-prerender-integrity-spike-g-evidence-2026-10-20.json',import.meta.url)));
test('Spike G preserves source-pinned captures and OPEN issue without relying on current runtime bytes',async()=>{
  assert.equal(e.issue.status,'OPEN');assert.equal(e.versionsChanged,false);assert.equal(e.runtimeCorrection.httpReliabilityCorrection,false);
  assert.equal(e.groups.length,4);
  for(const g of e.groups){assert.equal(g.complete,true);assert.deepEqual(g.failures,[]);}
  const bytes=await fs.readFile(new URL('../test-support/'+e.archive.file,import.meta.url));
  assert.equal(bytes.length,e.archive.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),e.archive.sha256);
  const before=e.groups[0].hashes,after=e.groups[1].hashes;
  for(const name of Object.keys(before))if(name!=='packages/wydgine/src/engine/packages/index.js')assert.equal(before[name],after[name]);
  assert.notEqual(before['packages/wydgine/src/engine/packages/index.js'],after['packages/wydgine/src/engine/packages/index.js']);
});
test('HTTP outcomes and observed commits remain distinct across repeated windows',()=>{
  for(const g of ['before','after'])for(const mode of ['existing','attributed','json']){
    const row=e.http.find(r=>r.group===g&&r.mode===mode);
    assert.equal(row.windows.length,3);assert.equal(row.http200+row.http500,36);assert.equal(row.commits,36);assert.equal(row.completedNative,72);
    assert.equal(row.indeterminate,row.http500);assert.ok(row.exhausted>=row.http500);
  }
  for(const row of e.http.filter(r=>r.mode==='observer-off')){assert.equal(row.commits,null);assert.equal(row.completedNative,null);}
  assert.ok(e.http.find(r=>r.group==='after'&&r.mode==='existing').http500>0);
});
test('canonical scaling retains validation/copies for unchanged and changed property intents',()=>{
  for(const group of e.scaling){assert.equal(group.cases.length,24);for(const c of group.cases){
    assert.equal(c.repetitions,9);assert.equal(c.treeNodes,c.fields+5);
    assert.equal(c.hydrateCalls.min,2*c.mutationIntents+1);assert.equal(c.hydrateCalls.max,2*c.mutationIntents+1);
    assert.equal(c.dehydrateCalls.min,2*c.mutationIntents+1);assert.equal(c.dehydrateCalls.max,2*c.mutationIntents+1);
    assert.equal(c.changedIntents+c.unchangedIntents,c.mutationIntents);
  }}
});
test('installation repetition and real negative generations retain fresh inspections',()=>{
  for(const group of e.installed){
    const rows=Object.fromEntries(group.rows.map(r=>[r.label,r]));
    assert.equal(rows['repeated-read-20'].attribution.counts.guardChecks,20);
    assert.equal(rows['repeated-read-20'].attribution.counts.repeatedGenerationChecks,19);
    for(const name of ['changed-write-8','unchanged-write-8'])assert.equal(rows[name].attribution.counts.guardChecks,40);
    for(const [label,row]of Object.entries(rows))assert.equal(row.code,['repeated-read-20','changed-write-8','unchanged-write-8','same-bytes-catalog-replacement','fresh-generation-after-cancellation'].includes(label)?null:'SEAM.CONTEXT');
    assert.equal(rows['same-bytes-catalog-replacement'].attribution.spans.find(r=>r.stage==='installedValidate').calls,1);
  }
  for(const r of e.representative){
    assert.equal(r.trace.meter.timeLimitMs,1000);assert.equal(r.attribution.counts.guardChecks,866);
    const stamps=r.attribution.spans.filter(s=>s.stage==='installedStamp').reduce((n,s)=>n+s.calls,0);
    const fs=r.attribution.metadata.filter(s=>s.site==='packages/index.js').reduce((n,s)=>n+s.calls,0);
    assert.equal(stamps,868);assert.equal(fs,7*stamps);
  }
});
test('trace summaries preserve counts without claiming equal work or syscall CPU',()=>{
  for(const group of e.groups.filter(g=>g.label.endsWith('Trace')))for(const w of group.windows){
    const s=w.summary.syscalls;assert.equal(s.unmatchedSplitLines,0);assert.ok(s.groups.reduce((n,g)=>n+g.durationMs.count,0)>0);
  }
  assert.equal(e.stampCalibrations.length,3);
  for(const c of e.stampCalibrations){assert.equal(c.rows.length,36);for(const r of c.rows)assert.equal(r.metadataCalls,r.includeIo?r.iterations*7:0);}
});
