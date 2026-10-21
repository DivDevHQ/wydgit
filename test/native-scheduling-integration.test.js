import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
for(const provider of ['SQLite','JSON'])test('native scheduling: '+provider+' real separate-client boundaries, settlement and fresh metadata',async()=>{
  const {stdout}=await exec(process.execPath,['test-support/production-observer-worker.mjs',JSON.stringify({provider,concurrency:4,diagnosticsEnabled:true,clientPlacement:'separate',reconcile:true,nativeScheduling:true,deadlineLedger:true,nativeCosts:true,promiseObservation:true})],{timeout:30000,maxBuffer:8*1024*1024});
  const v=JSON.parse(stdout);assert.equal(v.fixtureFailure,null);assert.equal(v.cleanupComplete,true);assert.equal(v.reconciliation.records,4);
  assert.equal(v.clientProcess.reaped,true);
  for(const c of v.nativeSchedulingCaptures.filter(c=>c.request>0)){
    assert.equal(c.dropped+c.droppedSpans,0);assert.ok(c.spans.length>0);
    for(const operation of [1,2]){
      const rows=c.rows.filter(r=>r.operation===operation),at=name=>rows.find(r=>r.name===name)?.atMs;
      const names=['dispatch','workEntry','storeEntry','providerEntry','providerComplete','providerSettlement','taskSettlement','nativeContinuation','pageContinuation'];
      for(let i=0;i<names.length;i++){assert.ok(Number.isFinite(at(names[i])),names[i]);if(i)assert.ok(at(names[i])>=at(names[i-1]),names[i]);}
    }
  }
  assert.ok(v.traces.every(t=>t.record.services.pending===0));
  assert.ok(v.deadlineLedgers.filter(c=>c.request>0).every(c=>c.deadlineAtMs-c.startedAtMs===1000));
});
for(const mode of ['spin1100','workflow'])test('native scheduling: '+mode+' preserves shared deadlines and sibling outcome distinctions',async()=>{
  const {stdout}=await exec(process.execPath,['test-support/native-scheduling-contention.mjs',mode],{timeout:15000,maxBuffer:1024*1024});
  const v=JSON.parse(stdout);assert.equal(v.syntheticNativeReports,true);assert.equal(v.rows.length,4);
  for(const r of v.rows){assert.equal(r.meter.timeLimitMs,1000);assert.equal(r.services.pending,0);
    if(mode==='spin1100'){assert.equal(r.status,500);assert.equal(r.error,'SEWN.LIMIT');assert.equal(r.outcome,'indeterminate');assert.equal(r.meter.exhaustion.resource,'timeMs');}
    else{assert.equal(r.status,200);assert.equal(r.error,null);}
  }
  if(mode==='spin1100'){
    const pressure=v.events.find(e=>e.name==='pressureStart').atMs;
    assert.ok(v.events.filter(e=>e.name==='syntheticProviderComplete').every(e=>e.atMs<pressure));
    const pressureEnd=v.events.find(e=>e.name==='pressureEnd').atMs;
    assert.ok(v.events.filter(e=>e.name==='pageContinuation'&&e.request>1).every(e=>e.atMs>=pressureEnd));
    // Cooperative enforcement occurs at the next existing budget check; a setter
    // already reachable through a live facade is not forcibly interrupted.
  }else assert.ok(v.rows.find(r=>r.request===1).meter.charges.steps>2000);
});
test('native scheduling: active hooks preserve deterministic deadline/cancellation/provider/publication/handoff failures',async()=>{
  const captures=[];
  for(const script of ['post-commit-scenarios.mjs','native-scheduling-scenarios.mjs']){
    const {stdout}=await exec(process.execPath,['test-support/'+script,'candidate','on'],{timeout:30000,maxBuffer:1024*1024});
    captures.push(JSON.parse(stdout));
  }
  assert.deepEqual(captures[0].results.map(r=>r.outcome),captures[1].results.map(r=>r.outcome));
});
