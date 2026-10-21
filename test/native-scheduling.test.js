import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeScheduling,schedulingMark,schedulingSync,schedulingPromise,startPromiseObservation} from '../test-support/native-scheduling.js';
import {overlapMs} from '../test-support/scheduling-attribution.js';
test('native scheduling: bounded private records, exception identity, closed scopes and request isolation',async()=>{
  let now=0;const a=createNativeScheduling({request:1,costs:true,now:()=>++now,maxRows:2,maxSpans:1}),b=createNativeScheduling({request:2});
  const error=Error('private');
  await a.run(async()=>{schedulingMark('untrusted');schedulingMark('dispatch');await Promise.resolve();
    b.run(()=>schedulingMark('dispatch'));schedulingMark('providerEntry');schedulingMark('providerComplete');
    assert.throws(()=>schedulingSync('installedStamp',()=>{throw error;}),e=>e===error);
    schedulingSync('installedStamp',()=>{});
  });
  const row=a.finish();assert.equal(row.dropped,1);assert.equal(row.droppedSpans,1);assert.equal(row.rows.length,2);assert.equal(row.spans.length,1);
  assert.equal(b.finish().rows.length,1);assert.equal(a.finish(),row);a.run(()=>schedulingMark('dispatch'));assert.equal(row.rows.length,2);
  assert.doesNotMatch(JSON.stringify(row),/private|context|capability|path/);assert.throws(()=>createNativeScheduling({request:13}),RangeError);
});
test('native scheduling: promiseResolve marker waits for adopted pending promise without adding a reaction',async()=>{
  const stop=startPromiseObservation(),capture=createNativeScheduling({request:1});let release;
  try{await capture.run(async()=>{
    schedulingMark('dispatch');const held=new Promise(resolve=>release=resolve),task=Promise.resolve().then(()=>held);
    schedulingPromise(task,'taskSettlement');await Promise.resolve();await Promise.resolve();
    // Snapshot cannot be taken until completion; use synchronous diagnostic clock to assert ordering below.
    schedulingMark('providerEntry');release(1);assert.equal(await task,1);schedulingMark('nativeContinuation');
  });}finally{stop();}
  const rows=capture.finish().rows;assert.deepEqual(rows.map(r=>r.name),['dispatch','providerEntry','taskSettlement','nativeContinuation']);
});
test('native scheduling: same-window interval unions count nested/overlapping peers once',()=>{
  assert.equal(overlapMs(0,10,[{startMs:1,endMs:8},{startMs:2,endMs:3},{startMs:7,endMs:12}]),9);
});
