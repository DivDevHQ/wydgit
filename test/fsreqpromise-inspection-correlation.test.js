import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {AsyncLocalStorage,createHook} from 'node:async_hooks';
import {fixture,context,file} from '../test-support/wydstore.js';
import {createCompletion} from '../wydgine/execution/completion.js';
import {createFsreqpromiseProbe} from '../test-support/fsreqpromise-correlation.js';

async function setup(t,options={}){
  const f=await fixture(t,'sqlite'),local=new AsyncLocalStorage();
  const p=createFsreqpromiseProbe({enabled:true,maxCalls:512,maxResources:512,...options});
  t.after(async()=>{p.stop();await f.registry.close();});
  const completion=()=>createCompletion(()=>{},{diagnosticTiming:true,
    observeSqliteInspection:({operation})=>p.inspect({request:local.getStore(),operation}),
    observeLifecycleLstat:({operation})=>p.observe({request:local.getStore(),operation})});
  const invoke=(request,count=1)=>local.run(request,async()=>{
    const c=completion();let result;
    for(let i=0;i<count;i++)result=await c.run(op=>f.registry.bind(context(),op).call('wydstore','query',{store:'main',collection:'users'}));
    await c.settle();assert.equal(c.snapshot().pending,0);return result;
  });
  return {...f,p,local,completion,invoke};
}
function mapped(row){
  assert.equal(row.correlation,'inspection-single-resource');assert.equal(row.candidates,1);
  const r=row.resources[0];assert.equal(r.trigger,row.executionId);
  assert.equal(r.beforeCount,1);assert.equal(r.afterCount,1);
  assert.ok(row.invocationMs<=r.initMs&&r.initMs<=row.invokedMs);
  assert.ok(row.invokedMs<=r.firstBeforeMs&&r.firstBeforeMs<=r.lastAfterMs&&r.lastAfterMs<=row.resumeMs);
}
test('one actual inspection filesystem operation uniquely maps its resource and existing continuation',async t=>{
  const f=await setup(t);assert.equal((await f.invoke(1)).ok,true);
  const row=f.p.snapshot().calls.find(r=>r.stage==='sqliteFileLstat'&&r.ordinal===1);mapped(row);
  assert.equal(row.request,1);assert.equal(row.operation,1);assert.equal(row.inspection,1);
});
test('multiple sequential root and sidecar operations retain individual identities and one inspection identity',async t=>{
  const f=await setup(t);await f.invoke(1);const s=f.p.snapshot(),rows=s.calls.filter(r=>r.mode==='inspection');
  assert.equal(rows.length,f.root.split('/').filter(Boolean).length+4);
  assert.equal(new Set(rows.map(r=>r.call)).size,rows.length);assert.equal(new Set(rows.map(r=>r.resources[0].id)).size,rows.length);
  rows.forEach(mapped);assert.equal(new Set(rows.map(r=>r.inspection)).size,1);
  for(let i=1;i<rows.length;i++)assert.ok(rows[i-1].resumeMs<=rows[i].invocationMs);
  const span=s.inspections[0];assert.ok(span.entryMs<=rows[0].invocationMs&&rows.at(-1).resumeMs<=span.completeMs);
  assert.ok(span.completeMs<=span.resumeMs&&span.resumeMs<=span.transactionStartMs&&span.transactionStartMs<=span.transactionEndMs&&span.transactionEndMs<=span.settledMs);
});
test('inspection and lifecycle in one native call keep identities and stage boundaries distinct',async t=>{
  const f=await setup(t);await f.invoke(1,2);const s=f.p.snapshot();assert.equal(s.inspections.length,2);
  for(const span of s.inspections){const lifecycle=s.calls.find(r=>r.mode==='lifecycle'&&r.operation===span.operation);
    assert.equal(lifecycle.correlation,'lifecycle-single-resource');assert.equal(lifecycle.inspection,null);
    assert.ok(span.resumeMs<=lifecycle.invocationMs&&lifecycle.validatedMs<=span.transactionStartMs);
  }
});
test('twelve concurrent Contact-like pairs exclude unrelated filesystem work and cross-call attribution',async t=>{
  const f=await setup(t);
  await Promise.all(Array.from({length:12},(_,i)=>f.local.run(i+1,async()=>{
    const unrelated=fs.lstat(f.root);assert.equal((await f.invoke(i+1,2)).ok,true);await unrelated;
  })));
  const s=f.p.snapshot();assert.equal(s.inspections.length,24);
  for(const span of s.inspections){const rows=s.calls.filter(r=>r.inspection===span.inspection);
    assert.equal(rows.length,f.root.split('/').filter(Boolean).length+4);rows.forEach(r=>{mapped(r);assert.equal(r.request,span.request);assert.equal(r.operation,span.operation);});}
  assert.equal(new Set(s.calls.map(r=>r.resources[0].id)).size,s.calls.length);assert.equal(s.seen,s.calls.length);
});
test('missing sidecars are accepted; missing database preserves STORE.CORRUPT and partial inspection',async t=>{
  const f=await setup(t);assert.equal((await f.invoke(1)).ok,true);
  await fs.unlink(await file(f.root,'.sqlite'));const result=await f.invoke(2);assert.equal(result.ok,false);assert.equal(result.code,'STORE.CORRUPT');
  const s=f.p.snapshot(),span=s.inspections[1],rows=s.calls.filter(r=>r.inspection===span.inspection);
  rows.forEach(mapped);assert.equal(rows.filter(r=>r.stage==='sqliteFileLstat').length,1);
  assert.equal(span.transactionStartMs,null);assert.ok(span.settledMs>=span.resumeMs);
});
test('disabled observer preserves Store outcome and captures no operations',async t=>{
  const f=await setup(t,{enabled:false});assert.equal((await f.invoke(1)).ok,true);
  assert.equal(f.p.snapshot().seen,0);assert.deepEqual(f.p.snapshot().inspections,[]);
  let reads=0;const c=createCompletion(()=>{},{observeSqliteInspection(){reads++;}});
  assert.equal((await c.run(op=>f.registry.bind(context(),op).call('wydstore','query',{store:'main',collection:'users'}))).ok,true);assert.equal(reads,0);
});
test('observer failure stops and releases hook without changing Store result',async t=>{
  const f=await setup(t),c=createCompletion(()=>{},{diagnosticTiming:true,observeSqliteInspection:({operation})=>{
    const observer=f.p.inspect({request:1,operation});return {...observer,filesystem(...args){const op=observer.filesystem(...args);return {...op,invoked(){op.invoked();throw Error('private observer');}};}};}});
  assert.equal((await c.run(op=>f.registry.bind(context(),op).call('wydstore','query',{store:'main',collection:'users'}))).ok,true);await c.settle();
  assert.equal(f.p.snapshot().stopped,true);assert.equal(f.p.snapshot().tracked,0);assert.equal(f.p.snapshot().calls[0].correlation,'missing');
});
test('multiple resources in an inspection invocation are explicitly ambiguous; teardown is safe',async t=>{
  const f=await setup(t),original=fs.lstat,pending=[];
  const mock=t.mock.method(fs,'lstat',(...args)=>{const value=original(...args);pending.push(original(f.root));return value;});syncBuiltinESMExports();
  t.after(()=>{mock.mock.restore();syncBuiltinESMExports();});
  assert.equal((await f.invoke(1)).ok,true);await Promise.all(pending);
  const rows=f.p.snapshot().calls.filter(r=>r.mode==='inspection');assert.ok(rows.length>1);rows.forEach(r=>{assert.equal(r.candidates,2);assert.equal(r.correlation,'ambiguous');});
  f.p.stop();assert.equal(f.p.snapshot().tracked,0);
});
test('cancellation releases pending inspection resources and marks incomplete attribution',async t=>{
  const f=await setup(t);let cancelled=false;
  const original=fs.lstat,mock=t.mock.method(fs,'lstat',(...args)=>{const value=original(...args);if(!cancelled){cancelled=true;f.p.stop();}return value;});syncBuiltinESMExports();
  t.after(()=>{mock.mock.restore();syncBuiltinESMExports();});
  assert.equal((await f.invoke(1)).ok,true);const s=f.p.snapshot();assert.equal(s.stopped,true);assert.equal(s.tracked,0);assert.equal(s.calls[0].correlation,'missing');
});
test('inspection call exhaustion stops hook and preserves explicit incomplete evidence',async t=>{
  const f=await setup(t,{maxCalls:1});assert.equal((await f.invoke(1)).ok,true);
  const s=f.p.snapshot();assert.equal(s.stopped,true);assert.equal(s.tracked,0);assert.equal(s.droppedCalls,1);assert.equal(s.inspections[0].settledMs,null);
});

test('inspection resource exhaustion stops safely and cannot claim a unique mapping',async t=>{
  const f=await setup(t,{maxResources:1});assert.equal((await f.invoke(1)).ok,true);
  const s=f.p.snapshot();assert.equal(s.stopped,true);assert.equal(s.tracked,0);assert.equal(s.droppedResources,1);
  assert.equal(s.calls[1].correlation,'ambiguous');assert.equal(s.inspections[0].settledMs,null);
});
test('observer factory failure preserves actual SQLite commit and settlement',async t=>{
  const f=await setup(t),c=createCompletion(()=>{},{diagnosticTiming:true,observeSqliteInspection(){throw Error('private observer');}});
  const result=await c.run(op=>f.registry.bind(context(),op).call('wydstore','create',{store:'main',collection:'users',id:'committed',data:{name:'fixture'}}));
  await c.settle();assert.equal(result.ok,true);assert.equal(c.snapshot().commitReported,1);assert.equal(c.snapshot().pending,0);
});
test('inspection observation adds no Promise, timer, immediate or filesystem resources',async t=>{
  const f=await setup(t),counts=[];
  for(const enabled of [false,true]){
    const row={},hook=createHook({init(_id,type){if(['PROMISE','Timeout','Immediate','FSREQPROMISE'].includes(type))row[type]=(row[type]??0)+1;}});
    const c=createCompletion(()=>{},{diagnosticTiming:true,...(enabled?{observeSqliteInspection:({operation})=>f.p.inspect({request:1,operation})}:{})});
    hook.enable();
    try{assert.equal((await c.run(op=>f.registry.bind(context(),op).call('wydstore','query',{store:'main',collection:'users'}))).ok,true);await c.settle();}
    finally{hook.disable();}
    counts.push(row);
  }
  assert.deepEqual(counts[1],counts[0]);
});

test('pre-transaction budget rejection settles with explicit absent transaction boundaries',async t=>{
  const f=await setup(t);let expired=false;
  const c=createCompletion(()=>{if(expired)throw Error('budget exhausted');},{diagnosticTiming:true,
    observeSqliteInspection:({operation})=>{const observer=f.p.inspect({request:1,operation});return {...observer,resume(){observer.resume();expired=true;}};},
    observeLifecycleLstat:({operation})=>f.p.observe({request:1,operation})});
  const result=await c.run(op=>f.registry.bind(context(),op).call('wydstore','query',{store:'main',collection:'users'}));
  await c.settle();assert.equal(result.ok,false);assert.equal(c.snapshot().pending,0);
  const s=f.p.snapshot(),span=s.inspections[0];assert.ok(span.resumeMs<=span.checkpointFirstMs&&span.checkpointFirstMs<=span.settledMs);
  assert.equal(span.checkpointCount,1);assert.equal(span.transactionStartMs,null);assert.equal(span.transactionEndMs,null);
  assert.equal(c.timing().sqliteTransaction,undefined);s.calls.filter(r=>r.mode==='inspection').forEach(mapped);
});
