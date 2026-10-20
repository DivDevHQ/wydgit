import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
import {syncBuiltinESMExports} from 'node:module';
import {fixture as storeFixture,context} from '../test-support/wydstore.js';
import {createCompletion} from '../wydgine/execution/completion.js';
import {checkLifecycleLock} from '../packages/wydstore/src/lifecycle-lock.js';
import {createFsreqpromiseProbe} from '../test-support/fsreqpromise-correlation.js';

async function fixture(t,enabled=true){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-contact-fsreq-'));
  const probe=createFsreqpromiseProbe({enabled});
  t.after(async()=>{probe.stop();await fs.rm(root,{recursive:true,force:true});});
  const local=new AsyncLocalStorage();
  const completion=()=>createCompletion(()=>{},{diagnosticTiming:true,
    observeLifecycleLstat:({operation})=>probe.observe({request:local.getStore(),operation})});
  return {root,probe,local,completion};
}
function mapped(row,request,operation){
  assert.equal(row.correlation,'lifecycle-single-resource');
  assert.equal(row.request,request);assert.equal(row.operation,operation);assert.equal(row.candidates,1);
  const r=row.resources[0];assert.equal(r.trigger,row.executionId);
  assert.equal(r.beforeCount,1);assert.equal(r.afterCount,1);
  assert.ok(row.invocationMs<=r.initMs&&r.initMs<=r.firstBeforeMs);
  assert.ok(r.firstBeforeMs<=r.lastAfterMs&&r.lastAfterMs<=row.recoveryMs);
  assert.ok(row.recoveryMs<=row.producerMs&&row.producerMs<=row.resumeMs&&row.resumeMs<=row.validatedMs);
}
async function invoke(f,request,count=1){
  return f.local.run(request,async()=>{
    const c=f.completion();
    for(let i=0;i<count;i++)await c.run(operation=>checkLifecycleLock(f.root,'missing',false,operation));
    await c.settle();assert.equal(c.snapshot().pending,0);
    assert.equal(c.continuations().sqliteLifecycleLstat.recoveryEntered,count);
  });
}
test('Contact-like invocation maps native identity, resource and existing recovery',async t=>{
  const f=await fixture(t);await invoke(f,1);mapped(f.probe.snapshot().calls[0],1,1);
});
test('two lifecycle operations in one request retain distinct identities and resources',async t=>{
  const f=await fixture(t);await invoke(f,1,2);
  const rows=f.probe.snapshot().calls;assert.equal(rows.length,2);
  rows.forEach((r,i)=>mapped(r,1,i+1));assert.notEqual(rows[0].resources[0].id,rows[1].resources[0].id);
  // Even two invocations within the SAME native call must remain distinct.
  await f.local.run(2,()=>f.completion().run(op=>Promise.all([
    checkLifecycleLock(f.root,'missing',false,op),checkLifecycleLock(f.root,'missing',false,op)])));
  const same=f.probe.snapshot().calls.slice(2);same.forEach(r=>mapped(r,2,1));
  assert.notEqual(same[0].call,same[1].call);assert.notEqual(same[0].resources[0].id,same[1].resources[0].id);
});
test('twelve concurrent requests exclude unrelated filesystem activity in the same context',async t=>{
  const f=await fixture(t);
  await Promise.all(Array.from({length:12},(_,i)=>f.local.run(i+1,async()=>{
    const unrelated=fs.lstat(f.root);await invoke(f,i+1,2);await unrelated;
  })));
  const rows=f.probe.snapshot().calls;assert.equal(rows.length,24);
  for(let request=1;request<=12;request++){
    const own=rows.filter(r=>r.request===request);assert.equal(own.length,2);own.forEach((r,i)=>mapped(r,request,i+1));
  }
  assert.equal(new Set(rows.map(r=>r.resources[0].id)).size,24);assert.equal(f.probe.snapshot().seen,24);
});
test('ENOENT recovery preserves Store busy decision for a present lifecycle marker',async t=>{
  const f=await fixture(t);await invoke(f,1);
  await fs.writeFile(path.join(f.root,'present.lifecycle'),'');
  await f.local.run(2,()=>assert.rejects(f.completion().run(op=>checkLifecycleLock(f.root,'present',false,op)),{code:'STORE.BUSY'}));
  mapped(f.probe.snapshot().calls[0],1,1);
  const present=f.probe.snapshot().calls[1];assert.equal(present.recoveryMs,null);assert.equal(present.correlation,'missing');
});
test('disabled observer captures nothing and preserves outcome',async t=>{
  const f=await fixture(t,false);await invoke(f,1,2);
  assert.deepEqual(f.probe.snapshot().calls,[]);assert.equal(f.probe.snapshot().seen,0);
  let observed=0;
  const c=createCompletion(()=>{},{observeLifecycleLstat(){observed++;}});
  await c.run(op=>checkLifecycleLock(f.root,'missing',false,op));await c.settle();
  assert.equal(observed,0);assert.equal(c.continuations(),null);
});
test('observer marker failure safely cancels hook without changing Store result',async t=>{
  const f=await fixture(t);
  const c=createCompletion(()=>{},{diagnosticTiming:true,observeLifecycleLstat:({operation})=>{
    const o=f.probe.observe({request:1,operation});return {...o,invoked(){o.invoked();throw Error('private observer failure');}};
  }});
  await c.run(op=>checkLifecycleLock(f.root,'missing',false,op));await c.settle();
  assert.equal(c.continuations().sqliteLifecycleLstat.validated,1);
  assert.equal(f.probe.snapshot().stopped,true);assert.equal(f.probe.snapshot().tracked,0);
  const before=f.probe.snapshot();await fs.lstat(f.root);assert.deepEqual(f.probe.snapshot(),before);
});
test('cancellation during pending lifecycle work releases tracking and preserves outcome',async t=>{
  const f=await fixture(t);
  const task=f.local.run(1,()=>f.completion().run(op=>checkLifecycleLock(f.root,'missing',false,op)));
  // run() already schedules the native call; cancel before its resource callback.
  await Promise.resolve();f.probe.stop();await task;
  assert.equal(f.probe.snapshot().tracked,0);assert.equal(f.probe.snapshot().stopped,true);
  assert.equal(f.probe.snapshot().calls[0].correlation,'missing');
});
test('multiple resources inside the exact synchronous invocation window are ambiguous',async t=>{
  const f=await fixture(t),original=fs.lstat;let unrelated;
  const mock=t.mock.method(fs,'lstat',(...args)=>{const result=original(...args);unrelated=original(f.root);return result;});
  syncBuiltinESMExports();t.after(()=>{mock.mock.restore();syncBuiltinESMExports();});
  await invoke(f,1);await unrelated;
  const row=f.probe.snapshot().calls[0];assert.equal(row.candidates,2);assert.equal(row.correlation,'ambiguous');
  assert.ok(row.recoveryMs!==null);assert.equal(f.probe.snapshot().hookErrors,0);
});

test('throwing observer factory preserves real SQLite commit and native settlement',async t=>{
  const f=await storeFixture(t,'sqlite');t.after(()=>f.registry.close());
  const c=createCompletion(()=>{},{diagnosticTiming:true,observeLifecycleLstat(){throw Error('private observer');}});
  const result=await c.run(op=>f.registry.bind(context(),op).call('wydstore','create',{
    store:'main',collection:'users',id:'observer-failure',data:{name:'fixture'}}));
  await c.settle();assert.equal(result.ok,true);
  assert.equal(c.snapshot().commitReported,1);assert.equal(c.snapshot().pending,0);
  assert.equal(c.continuations().sqliteLifecycleLstat.validated,1);
});
