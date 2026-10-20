import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const base='test-support/http-post-commit-critical-path-spike-k-';
test('Spike K pinned evidence preserves every primary request and separates commit, deadline and HTTP outcomes',async()=>{
  const evidence=JSON.parse(await fs.readFile(base+'evidence-2026-10-20.json'));
  const bytes=await fs.readFile('test-support/'+evidence.archive.file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.archive.sha256);
  const source=JSON.parse(gunzipSync(bytes));assert.equal(evidence.issue.status,'OPEN');
  for(const name of ['primary-before','primary-after']){
    const series=source.series[name];assert.equal(series.summary.complete,true);assert.equal(series.windows.length,31);
    const total=evidence.primary[name].total;assert.equal(total.requests,339);assert.equal(total.reconciledRecords,339);
    assert.equal(total.http200+total.http500,339);
    for(const w of series.windows){
      assert.equal(w.status.code,0);assert.equal(w.value.fixtureFailure,null);assert.equal(w.value.cleanupComplete,true);
      assert.equal(w.value.reconciliation.records,w.config.concurrency);
      assert.equal(w.value.clientProcess.exitCode,0);assert.equal(w.value.clientProcess.reaped,true);
      for(const l of w.value.deadlineLedgers??[]){
        assert.equal(l.dropped,0);assert.ok(l.rows.length<=192);assert.ok(l.checks>0);
        assert.ok(l.rows.every((r,i)=>i===0||r.atMs>=l.rows[i-1].atMs));
        const trace=l.request===0?w.value.setup.trace:w.value.traces.find(t=>t.index===l.request).record;
        assert.equal(l.deadlineAtMs,trace.meter.timing.deadlineAtMs);assert.equal(l.startedAtMs,trace.meter.timing.startedAtMs);
        assert.ok(l.lastCheck);assert.ok(l.rows.find(r=>r.name==='responseHandoff'));
      }
    }
  }
});
test('Spike K reference source is pinned to the actual J guard and retained correction changes no shared/client modules',async()=>{
  const evidence=JSON.parse(await fs.readFile(base+'evidence-2026-10-20.json'));
  const archive=JSON.parse(gunzipSync(await fs.readFile('test-support/'+evidence.archive.file)));
  const before=archive.artifacts['packages-before.js'];
  assert.equal(createHash('sha256').update(before).digest('hex'),'edd9577cb51a2a7c561e82c3742e0027845269bc3507bf3d564da4a227c7a3a5');
  for(const [name,value]of Object.entries(archive.sources)){
    assert.equal(createHash('sha256').update(value.text).digest('hex'),value.sha256,name);
    assert.equal(evidence.sources[name],value.sha256,name);
  }
  assert.equal(evidence.controlSummary.length,3);
  assert.ok(evidence.controlSummary.every(r=>r.candidate.median<r.reference.median));
});
