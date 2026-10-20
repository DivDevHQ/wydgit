import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createFsreqpromiseProbe} from '../test-support/fsreqpromise-correlation.js';
import {observerModes,summarizeProductionWindow} from '../test-support/production-observer-probe.mjs';
import {runContactWindow} from '../test-support/http-concurrency.js';
import {createSynchronousAttribution,observedFs} from '../test-support/prerender-integrity-attribution.js';

test('histogram-only observation never enters async-hook request correlation and tears down',async()=>{
  const p=createFsreqpromiseProbe({monitorOnly:true,scheduling:true,request(){throw Error('must not enter hook');}});
  try{
    p.beginScheduling();await setImmediate();p.stop();
    const value=p.snapshot();assert.equal(value.enabled,false);assert.equal(value.scheduling.callbackCount,0);
    assert.deepEqual(value.scheduling.spans,[]);assert.equal(value.hookErrors,0);assert.equal(value.tracked,0);
    assert.equal(value.calls.length,0);assert.equal(value.stopped,true);
    await setImmediate();assert.deepEqual(p.snapshot(),value);assert.equal(p.finishScheduling(),p.finishScheduling());
  }finally{p.stop();}
});
test('monitor-only mode is explicit, validates configuration and defaults to no observer',()=>{
  for(const config of [{monitorOnly:1},{monitorOnly:true,enabled:true}])assert.throws(()=>createFsreqpromiseProbe(config),RangeError);
  const p=createFsreqpromiseProbe();p.beginScheduling();p.stop();assert.equal(p.snapshot().scheduling,undefined);assert.equal(p.snapshot().seen,0);
});
test('observer matrix separates extensions without silently enabling filesystem hooks',()=>{
  assert.equal(Object.keys(observerModes).length,7);assert.equal(observerModes.off.diagnosticsEnabled,false);
  assert.equal(observerModes.loop.resourceCorrelation,undefined);assert.equal(observerModes.loop.scheduling,true);
  assert.equal(observerModes.filesystem.scheduling,undefined);assert.equal(observerModes.canonical.attributionCategory,'canonical');
  assert.equal(observerModes.guard.attributionCategory,'guard');
});
test('off summaries keep unobserved native counters unknown independently of provider reconciliation',()=>{
  const value={traces:[],requests:[],reconciliation:{records:12},fixtureFailure:null,cleanupComplete:true};
  const r=summarizeProductionWindow(value);assert.equal(r.reportedCommits,null);assert.equal(r.completedNative,null);assert.equal(r.exhausted,null);
  assert.equal(r.reconciledRecords,12);assert.equal(r.pageMs.count,0);
});
test('diagnostic label reuse still invokes every metadata operation and propagates original exceptions',()=>{
  const c=createSynchronousAttribution(),error=new Error('original'),file='/private/site/content/installed-packages.json';let calls=0;
  c.run(()=>{
    for(let i=0;i<20;i++)assert.equal(observedFs('packages/index.js','lstatSync',()=>++calls,file),i+1);
    assert.throws(()=>observedFs('packages/index.js','lstatSync',()=>{calls++;throw error;},file),e=>e===error);
  });
  const result=c.finish();assert.equal(calls,21);assert.equal(result.metadata[0].calls,21);assert.equal(result.uniqueArtifacts,1);
  assert.equal(result.spans.find(s=>s.stage==='metadata').calls,21);assert.doesNotMatch(JSON.stringify(result),/private|installed-packages/);
  c.run(()=>observedFs('packages/index.js','lstatSync',()=>++calls,file));assert.equal(calls,22);assert.equal(c.finish(),result);
  assert.equal(result.metadata[0].calls,21);
});
test('path label retention cap does not lose counts, alias distinct artifacts or add inspections',()=>{
  const c=createSynchronousAttribution({maxArtifacts:2});let calls=0;
  c.run(()=>{
    for(let i=0;i<40;i++)observedFs('packages/index.js','lstatSync',()=>calls++,'/private/'+i+'/content/installed-packages.json');
    for(let i=0;i<40;i++)observedFs('packages/index.js','lstatSync',()=>calls++,'/private/'+i+'/wydgit.config.json');
    observedFs('packages/index.js','lstatSync',()=>calls++,'/private/other');
  });
  const r=c.finish();assert.equal(calls,81);assert.equal(r.metadata[0].calls,81);assert.equal(r.uniqueArtifacts,2);assert.equal(r.droppedArtifacts,1);
  assert.equal(r.stackOverflow,0);assert.doesNotMatch(JSON.stringify(r),/private/);
});
for(const provider of ['JSON','SQLite'])test(`post-window ${provider} reconciliation observes all concurrent writes with HTTP diagnostics disabled`,{timeout:20000},async()=>{
  const value=await runContactWindow({provider,concurrency:2,diagnosticsEnabled:false,reconcile:true,clientPlacement:'separate'});
  assert.equal(value.fixtureFailure,null,JSON.stringify(value));assert.equal(value.cleanupComplete,true);
  assert.equal(value.traces.length,0);assert.equal(value.requests.length,2);assert.equal(value.reconciliation.records,2);
  assert.equal(value.reconciliation.complete,true);assert.ok(value.requests.every(r=>r.client.complete&&r.client.status===200));
});
for(const category of ['canonical','guard'])test(`isolated ${category} hooks preserve real installed Contact and exclude unrelated attribution`,{timeout:20000},async()=>{
  const {stdout}=await promisify(execFile)(process.execPath,['test-support/production-observer-worker.mjs',JSON.stringify({provider:'SQLite',
    concurrency:1,clientPlacement:'separate',diagnosticsEnabled:true,synchronousAttribution:true,attributionCategory:category,reconcile:true})],{timeout:15000,maxBuffer:4*1024*1024});
  const value=JSON.parse(stdout);assert.equal(value.fixtureFailure,null);assert.equal(value.requests[0].client.status,200);
  assert.equal(value.reconciliation.records,1);const capture=value.synchronousAttribution.find(c=>c.request===1);
  assert.equal(capture.stackOverflow,0);assert.equal(capture.droppedArtifacts,0);
  const stages=new Set(capture.spans.map(s=>s.stage));
  if(category==='canonical'){assert.ok(stages.has('hydrate'));assert.equal(stages.has('installedStamp'),false);assert.equal(capture.metadata.length,0);}
  else{assert.ok(stages.has('installedStamp'));assert.equal(stages.has('hydrate'),false);assert.ok(capture.counts.guardChecks>0);}
});
