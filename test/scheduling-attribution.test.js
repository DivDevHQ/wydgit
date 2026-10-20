import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
import {setImmediate} from 'node:timers/promises';
import {createFsreqpromiseProbe} from '../test-support/fsreqpromise-correlation.js';
import {checkLifecycleLock} from '../packages/wydstore/src/lifecycle-lock.js';
import {overlapMs,distribution} from '../test-support/scheduling-attribution.js';

test('offline callback union clips overlaps without adding independent maxima',()=>{
  assert.equal(overlapMs(10,30,[{startMs:0,endMs:15},{startMs:12,endMs:20},{startMs:22,endMs:40}]),18);
  assert.equal(overlapMs(10,30,[]),0);
  assert.deepEqual(distribution([null,NaN]),{count:0,min:null,median:null,p90:null,p99:null,max:null});
  assert.equal(distribution([1,2,3]).median,2);
});
test('disabled scheduling installs no observation or request-reader calls',async()=>{
  const p=createFsreqpromiseProbe({scheduling:true,request(){throw Error('must not read');}});
  p.beginScheduling();await setImmediate();p.finishScheduling();p.stop();
  assert.equal(p.snapshot().scheduling,null);assert.equal(p.snapshot().hookErrors,0);
});
test('scheduling is default-disabled even with resource observation enabled',async()=>{
  const p=createFsreqpromiseProbe({enabled:true,request(){throw Error('must not read');}});
  try{p.beginScheduling();await setImmediate();assert.equal(p.finishScheduling(),null);assert.equal(p.snapshot().scheduling,undefined);}
  finally{p.stop();}
});
test('concurrent lifecycle operations retain generation, resource ELU and wall deadline markers',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-scheduling-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const local=new AsyncLocalStorage(),p=createFsreqpromiseProbe({enabled:true,scheduling:true,request:()=>local.getStore(),generation:7});t.after(()=>p.stop());
  p.beginScheduling();
  await Promise.all(Array.from({length:12},(_,i)=>local.run(i+1,()=>checkLifecycleLock(root,'missing',false,{continuation:()=>p.observe({request:i+1,operation:1})}))));
  const result=p.finishScheduling();assert.equal(p.finishScheduling(),result);p.stop();
  const s=p.snapshot();assert.equal(s.calls.length,12);assert.equal(s.generation,7);assert.equal(s.tracked,0);assert.equal(s.hookErrors,0);
  for(const row of s.calls){
    const r=row.resources[0];assert.equal(row.generation,7);assert.equal(row.correlation,'lifecycle-single-resource');
    assert.ok(r.beforeElu.active>=r.initElu.active);assert.ok(r.beforeElu.idle>=r.initElu.idle);
    assert.equal(typeof row.resumeMsWallMs,'number');assert.equal(typeof row.recoveryMsWallMs,'number');
  }
  assert.ok(result.endMs>=result.startMs);assert.ok(result.callbackCount>0);assert.equal(result.stackOverflow,0);assert.equal(result.droppedSpans,0);
  assert.ok(result.eventLoop.utilization>=0&&result.eventLoop.utilization<=1);
});
test('span retention is bounded and reports overflow; stop freezes the capture',async()=>{
  let clock=0;const p=createFsreqpromiseProbe({enabled:true,scheduling:true,maxSpans:1,now:()=>++clock});
  try{
    p.beginScheduling();for(let i=0;i<4;i++)await setImmediate();p.stop();
    const before=p.snapshot();assert.equal(before.scheduling.spans.length,1);assert.ok(before.scheduling.droppedSpans>0);
    await setImmediate();assert.deepEqual(p.snapshot(),before);
  }finally{p.stop();}
});
test('failing numeric context observer stops safely without throwing into callbacks',async()=>{
  const p=createFsreqpromiseProbe({enabled:true,scheduling:true,request(){throw Error('private');}});
  p.beginScheduling();await setImmediate();p.stop();
  assert.equal(p.snapshot().hookErrors,1);assert.equal(p.snapshot().stopped,true);assert.equal(p.snapshot().tracked,0);
});
test('scheduling bounds reject malformed identities and allocation limits',()=>{
  for(const config of [{generation:0},{generation:Infinity},{maxSpans:0},{maxSpans:4097}])assert.throws(()=>createFsreqpromiseProbe(config),RangeError);
});
