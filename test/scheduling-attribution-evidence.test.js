import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const e=JSON.parse(await fs.readFile(new URL('../test-support/http-scheduling-attribution-spike-f-evidence-2026-10-20.json',import.meta.url)));
const primary=e.groups.find(row=>row.label==='primary');
test('Spike F evidence preserves complete final and exploratory series without claiming a fix',()=>{
  assert.equal(e.issue.status,'OPEN');assert.equal(e.runtimeCorrection,false);assert.equal(e.versionsChanged,false);
  assert.equal(primary.windows.length,30);assert.equal(e.groups.length,4);
  for(const group of e.groups){assert.equal(group.complete,true);assert.deepEqual(group.failures,[]);}
});
test('Spike F archive content is pinned without inflating all captures in every full-suite worker',async()=>{
  const bytes=await fs.readFile(new URL('../test-support/'+e.archive.file,import.meta.url));
  assert.equal(bytes.length,e.archive.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),e.archive.sha256);
});
test('primary comparisons retain HTTP failures separately from reported native completion',()=>{
  for(const prefix of ['baseline-','scheduled-','json-','pool16-']){
    const rows=primary.windows.filter(row=>row.label.startsWith(prefix));assert.equal(rows.length,3);
    for(const {summary:s}of rows){assert.equal(s.http200+s.http500,12);assert.equal(s.indeterminate,s.http500);assert.equal(s.commits,12);assert.equal(s.completedNative,24);assert.equal(s.settledServiceCalls,24);assert.ok(s.exhausted>=s.http500);}
  }
  for(const {summary:s}of primary.windows.filter(row=>row.label.startsWith('observer-off-'))){assert.equal(s.commits,null);assert.equal(s.completedNative,null);assert.equal(s.exhausted,null);}
});
test('serial controls and pressure fixtures preserve their distinct observation scope',()=>{
  for(const {summary:s}of primary.windows.filter(row=>row.label.startsWith('serial-'))){assert.equal(s.http200,1);assert.equal(s.http500,0);assert.equal(s.exhausted,0);}
  for(const {summary:s}of primary.windows.filter(row=>row.label.startsWith('pressure-'))){
    assert.equal(s.syscalls.count,12);assert.equal(s.syscalls.unmatchedSplitLines,0);assert.equal(s.kernelToHookMs.count,12);assert.ok(s.kernelToHookMs.min>0);
    assert.equal(s.http200,undefined);assert.equal(s.scheduling.stackOverflow,0);assert.equal(s.scheduling.droppedSpans,0);
  }
});
test('representative timeline uses ordered same-operation hooks and unchanged deadline semantics',()=>{
  const r=e.representative;assert.equal(r.request,12);assert.equal(r.trace.meter.timeLimitMs,1000);assert.equal(r.trace.status,500);
  assert.equal(r.trace.operationOutcome,'indeterminate');assert.equal(r.trace.services.commitReported,1);assert.equal(r.trace.services.pending,0);
  assert.equal(r.files.length,20); // five ancestor + four SQLite file checks, twice, plus two lifecycle checks
  for(const row of r.files){const resource=row.resources[0];assert.equal(row.generation,3);assert.equal(row.candidates,1);assert.equal(resource.trigger,row.executionId);
    assert.ok(row.invocationMs<=resource.initMs&&resource.initMs<=resource.firstBeforeMs&&resource.firstBeforeMs<=resource.lastAfterMs&&resource.lastAfterMs<=row.resumeMs);}
  assert.ok(r.longestFilesystem.synchronousCallbackOverlapMs<=r.longestFilesystem.initToBeforeMs);
  assert.equal(r.clear[0].runtimeEdits,2);assert.equal(r.clear[0].propertyWrites,11);
  for(const row of r.boundaries)assert.equal(typeof row.remainingMs,'number');
});
