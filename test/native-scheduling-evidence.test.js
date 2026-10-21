import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const stem='test-support/http-native-scheduling-spike-l';
test('Spike L evidence reconciles every bounded window and preserves optional-observer unknowns',async()=>{
 const e=JSON.parse(await fs.readFile(stem+'-evidence-2026-10-20.json'));
 const bytes=await fs.readFile(e.archive.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),e.archive.sha256);
 const source=JSON.parse(gunzipSync(bytes));assert.equal(e.runtimeCorrection,false);assert.equal(e.status,'OPEN');assert.equal(e.windows.length,61);
 let requests=0;
 for(const w of e.windows){const v=source.raw[w.file].value;assert.equal(w.status.code,0);assert.equal(w.status.reason,null);assert.equal(v.fixtureFailure,null);assert.equal(v.cleanupComplete,true);assert.equal(v.clientProcess.exitCode,0);assert.equal(v.clientProcess.reaped,true);assert.equal(v.reconciliation.records,w.concurrency);assert.equal(w.drops,0);requests+=v.requests.length;
  assert.equal(w.summary.http200+w.summary.http500,w.concurrency);
  if(w.mode.startsWith('off')){assert.equal(w.summary.reportedCommits,null);assert.equal(w.summary.completedNative,null);assert.equal(w.operations.length,0);}
  else{
   assert.equal(w.operations.length,2*w.concurrency);
   for(const c of v.deadlineLedgers.filter(c=>c.request>0))assert.equal(c.deadlineAtMs-c.startedAtMs,1000);
   for(const o of w.operations){assert.ok(o.nativeMs>=o.providerMs);assert.ok(o.providerMs>=0);assert.ok(o.peerStampOverlapMs===null||o.peerStampOverlapMs<=o.providerMs);assert.ok(o.peerCallbackOverlapMs===null||o.peerCallbackOverlapMs<=o.nativeMs);
    if(w.mode==='promise')assert.ok(o.producerToSettlementMs>=0&&o.settlementToNativeMs>=0);else assert.equal(o.settlementToNativeMs,null);
   }
  }
 }
 assert.equal(requests,528);
 for(const [file,hash]of Object.entries(e.sourceHashes)){
  assert.equal(createHash('sha256').update(source.sources[file]).digest('hex'),hash);
  assert.equal(createHash('sha256').update(await fs.readFile(file)).digest('hex'),hash,file);
 }
});
test('Spike L independent controls prove distinct syscall, scheduling and fairness observations',async()=>{
 const e=JSON.parse(await fs.readFile(stem+'-evidence-2026-10-20.json'));
 for(let r=1;r<=3;r++){
  for(const pressure of [0,120]){
   const c=e.extras[`isolated-${pressure}-${r}.json`];assert.equal(c.exitCode,0);assert.equal(c.value.syscallEvidence.rows.length,12);assert.equal(c.value.syscallEvidence.unmatched,0);
   // Structural/ordering checks only: no host-dependent performance threshold.
   assert.ok(c.value.syscallEvidence.rows.every(row=>row.durationMs>=0&&row.initToCallbackMs>=0));
  }
  const c=e.extras[`contention-spin1100-${r}.json`].value;
  assert.ok(c.rows.every(row=>row.status===500&&row.error==='SEWN.LIMIT'&&row.outcome==='indeterminate'&&row.meter.timeLimitMs===1000));
  const workflow=e.extras[`contention-workflow-${r}.json`].value;
  assert.ok(workflow.rows.every(row=>row.status===200));assert.equal(workflow.rows[0].meter.charges.steps,2704);
 }
});
