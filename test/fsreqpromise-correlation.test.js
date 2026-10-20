import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setImmediate} from 'node:timers/promises';
import {createFsreqpromiseProbe} from '../test-support/fsreqpromise-correlation.js';
import {checkLifecycleLock} from '../packages/wydstore/src/lifecycle-lock.js';

async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-fsreq-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.writeFile(path.join(root,'present.lifecycle'),'');return root;}
function probe(t,options={}){const p=createFsreqpromiseProbe({enabled:true,...options});t.after(()=>p.stop());return p;}
function correlated(row,recovery){
  assert.equal(row.correlation,'isolated-single-resource');assert.equal(row.candidates,1);
  const r=row.resources[0];assert.equal(r.type,'FSREQPROMISE');assert.equal(r.trigger,row.executionId);
  assert.ok(r.initMs>=row.invocationMs);assert.equal(r.beforeCount,1);assert.equal(r.afterCount,1);
  assert.ok(r.firstBeforeMs>=r.initMs);assert.ok(r.lastAfterMs>=r.firstBeforeMs);
  assert.ok(row.resumeMs>=r.lastAfterMs);
  if(recovery){assert.ok(row.recoveryMs>=r.lastAfterMs);assert.ok(row.producerMs>=row.recoveryMs);assert.ok(row.resumeMs>=row.producerMs);}
  else {assert.equal(row.recoveryMs,null);assert.equal(row.producerMs,null);}
}
for(const name of ['present','missing'])test(`real lifecycle ${name}: isolated attribution and existing boundaries`,async t=>{
  const root=await fixture(t),p=probe(t);
  const result=p.capture(c=>checkLifecycleLock(root,name,false,c));
  if(name==='present')await assert.rejects(result,{code:'STORE.BUSY'});else await result;
  await setImmediate();
  const row=p.snapshot().calls[0];correlated(row,name==='missing');
  // destroy is optional; when observed it is only a resource-lifetime boundary.
  const r=row.resources[0];if(r.destroyMs!==null)assert.ok(r.destroyMs>=r.lastAfterMs);
});
test('unrelated filesystem operations are excluded; concurrent pending helpers have distinct attribution',async t=>{
  const root=await fixture(t),p=probe(t);
  const unrelated=[fs.lstat(root),fs.readdir(root)];
  const pending=Array.from({length:12},()=>p.capture(c=>checkLifecycleLock(root,'missing',false,c)));
  await Promise.all([...unrelated,...pending]);await setImmediate();
  const s=p.snapshot();assert.equal(s.calls.length,12);assert.equal(s.seen,12);
  for(const row of s.calls)correlated(row,true);
  assert.equal(new Set(s.calls.map(row=>row.resources[0].id)).size,12);assert.equal(s.hookErrors,0);
});
test('multiple FSREQPROMISE candidates in one window are explicitly ambiguous',async t=>{
  const root=await fixture(t),p=probe(t);let extra;
  await p.capture(c=>{const result=checkLifecycleLock(root,'missing',false,c);extra=fs.lstat(root);return result;});await extra;
  const row=p.snapshot().calls[0];assert.equal(row.candidates,2);assert.equal(row.correlation,'ambiguous');
});
test('disabled probe neither reads markers nor tracks resources',async t=>{
  const root=await fixture(t),p=probe(t,{enabled:false});
  await p.capture(c=>{assert.equal(c,undefined);return checkLifecycleLock(root,'missing',false,c);});
  assert.deepEqual(p.snapshot().calls,[]);assert.equal(p.snapshot().seen,0);
});
test('stop disables hooks and releases tracking without discarding bounded evidence',async t=>{
  const root=await fixture(t),p=probe(t);
  await p.capture(c=>checkLifecycleLock(root,'missing',false,c));p.stop();
  const before=p.snapshot();assert.equal(before.tracked,0);assert.equal(before.stopped,true);
  await fs.lstat(root);await setImmediate();assert.deepEqual(p.snapshot(),before);
  await p.capture(c=>{assert.equal(c,undefined);return checkLifecycleLock(root,'missing',false,c);});
  assert.deepEqual(p.snapshot(),before);
});
test('cumulative resource and call caps are enforced; overflow cannot claim attribution',async t=>{
  const root=await fixture(t),p=probe(t,{maxCalls:2,maxResources:1});
  for(let i=0;i<4;i++)await p.capture(c=>checkLifecycleLock(root,'missing',false,c));
  const s=p.snapshot();assert.equal(s.calls.length,2);assert.equal(s.seen,1);assert.equal(s.droppedCalls,2);assert.equal(s.droppedResources,1);
  assert.equal(s.calls[1].correlation,'ambiguous');assert.ok(s.tracked<=1);
});
