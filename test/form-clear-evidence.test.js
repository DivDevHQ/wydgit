import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const evidence=JSON.parse(fs.readFileSync(new URL('../test-support/form-clear-evidence-2026-10-20.json',import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('Spike E paired serial captures preserve conditions, observations and final state',()=>{
  const {before,after}=evidence.benchmarks;
  assert.equal(before.length,3);assert.equal(after.length,3);
  for(let i=0;i<3;i++){
    for(const [file,digest]of Object.entries(before[i].hashes))if(!file.endsWith('/form-clear-edit.js'))assert.equal(after[i].hashes[file],digest);
    assert.notEqual(before[i].hashes['packages/wydgine/src/engine/execution/form-clear-edit.js'],after[i].hashes['packages/wydgine/src/engine/execution/form-clear-edit.js']);
    for(let c=0;c<8;c++){
      const a=before[i].cases[c],b=after[i].cases[c];assert.deepEqual(a.finalFields,b.finalFields);
      for(const capture of [a,b]){
        assert.equal(capture.rows.length,15);assert.equal(capture.warmups,4);
        for(const row of capture.rows){
          assert.equal(row.completed,true);assert.equal(row.fields,capture.count);assert.equal(row.propertyWrites,5*capture.count+1);
          const stages=['traversalMs','calculationMs','editSetupMs','runtimeEditsMs','commitMs'];
          assert.ok(stages.reduce((n,k)=>n+row[k],0)<=row.totalMs+1e-8);
        }
      }
      assert.ok(a.rows.every(row=>row.runtimeEdits===5*a.count+1));assert.ok(b.rows.every(row=>row.runtimeEdits===(b.changed?b.count:0)));
    }
  }
});
test('Spike E HTTP captures preserve artifacts, overlap, commits, completed calls and failures separately',()=>{
  const totals={};
  for(const stage of ['before','after']){
    totals[stage]=[0,0,0,0];assert.equal(evidence.http[stage].length,3);
    for(const run of evidence.http[stage]){
      for(const artifact of Object.values(run.artifacts))assert.equal(hash(JSON.stringify(artifact.data,null,2)+'\n'),artifact.sha256);
      const window=Object.entries(run.artifacts).find(([key])=>key.startsWith('01-'))[1].data;
      assert.equal(window.fixtureFailure,null);assert.equal(window.cleanupComplete,true);assert.equal(window.clientProcess.reaped,true);
      for(const key of ['client','server','admitted','pageLedger'])assert.equal(window.actualConcurrency[key],12);
      assert.equal(window.formClear.dropped,0);assert.equal(window.formClear.rows.length,12);
      assert.equal(window.resourceCorrelation.hookErrors,0);assert.equal(window.resourceCorrelation.tracked,0);
      for(const row of window.formClear.rows){assert.equal(row.fields,2);assert.equal(row.propertyWrites,11);assert.equal(row.runtimeEdits,stage==='before'?11:2);}
      const [ok,fail,commits,native]=[window.requests.filter(r=>r.client.status===200).length,window.requests.filter(r=>r.client.status===500).length,
        window.traces.reduce((n,r)=>n+r.record.services.commitReported,0),window.traces.reduce((n,r)=>n+r.record.services.nativeStarted-r.record.services.pending,0)];
      assert.equal(ok+fail,12);assert.equal(commits,12);assert.equal(native,24);
      assert.equal(fail,window.requests.filter(r=>r.classification.writeOutcome==='indeterminate').length);
      assert.equal(fail,window.traces.filter(r=>r.matchingHistoricalSignature).length);
      for(const row of window.traces)assert.equal(row.record.meter.timeLimitMs,1000);
      totals[stage]=totals[stage].map((n,i)=>n+[ok,fail,commits,native][i]);
    }
  }
  assert.deepEqual(totals.before,[11,25,36,72]);assert.deepEqual(totals.after,[16,20,36,72]);assert.equal(evidence.issueStatus,'OPEN');
});

test('captured server source and baseline adapter reproduce capture hashes; rejected shared candidate stays archived',()=>{
  for(const [file,digest] of Object.entries(evidence.benchmarks.after[0].hashes))assert.equal(hash(evidence.capturedSources[file]),digest);
  assert.equal(hash(evidence.baselineAdapterSource),evidence.benchmarks.before[0].hashes['packages/wydgine/src/engine/execution/form-clear-edit.js']);
  assert.equal(hash(fs.readFileSync(new URL('../test-support/'+evidence.excludedSharedCandidate.file,import.meta.url))),evidence.excludedSharedCandidate.sha256);
});
