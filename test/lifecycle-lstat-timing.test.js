import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {createContinuationTiming} from '../packages/wydgine/src/engine/execution/continuation.js';
import {checkLifecycleLock} from '../packages/wydstore/src/lifecycle-lock.js';
import {createCompletion} from '../wydgine/execution/completion.js';
import {fixture,context} from '../test-support/wydstore.js';

const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};
const missing=()=>Object.assign(Error('private path and arguments'),{code:'ENOENT'});
function mockLstat(t,work){const mocked=t.mock.method(fs,'lstat',work);syncBuiltinESMExports();t.after(()=>{mocked.mock.restore();syncBuiltinESMExports();});return mocked;}

for(const mode of ['filesystem','continuation','immediate'])test(`lifecycle lstat: ${mode} delay is attributed at the existing recovery boundary`,async t=>{
  let time=0;const entered=deferred(),release=deferred();t.after(()=>release.resolve());
  const mock=mockLstat(t,()=>{entered.resolve();return mode==='filesystem'?release.promise:Promise.reject(missing());});
  const timing=createContinuationTiming(()=>time);
  const completion={continuation(name){const observation=timing.begin(name);return {...observation,
    complete(){observation.complete();if(mode==='continuation')queueMicrotask(()=>{time+=80;});}};}};
  const pending=checkLifecycleLock('/private-fixture','private-name',false,completion);
  await entered.promise;
  if(mode==='filesystem'){time=70;release.resolve(Promise.reject(missing()));}
  await pending;
  const row=timing.snapshot().sqliteLifecycleLstat;
  assert.equal(row.invocationToRecovery.totalMs,mode==='filesystem'?70:0);
  assert.equal(row.recoveryWork.totalMs,0);assert.equal(row.continuation.totalMs,mode==='continuation'?80:0);assert.equal(row.validation.totalMs,0);
  for(const key of ['calls','recoveryEntered','enoent','producerCompleted','resumed','validated'])assert.equal(row[key],1);
  assert.equal(row.missingCompletion,0);assert.equal(row.incomplete,0);assert.equal(mock.mock.callCount(),1);
  assert.doesNotMatch(JSON.stringify(row),/private|ENOENT|path|arguments/);
});

test('lifecycle lstat: rejection, present marker and lifecycle-owner bypass retain original decisions',async t=>{
  let mode='EIO';const error=Object.assign(Error('secret filename'),{code:'EIO'});
  const mock=mockLstat(t,()=>mode==='present'?Promise.resolve({}):Promise.reject(error));
  const timing=createContinuationTiming(()=>0),completion={continuation:name=>timing.begin(name)};
  await assert.rejects(checkLifecycleLock('/private','name',false,completion),value=>value===error);
  let row=timing.snapshot().sqliteLifecycleLstat;
  assert.equal(row.enoent,0);assert.equal(row.resumed,1);assert.equal(row.validated,0);assert.equal(row.producerCompleted,1);
  mode='present';await assert.rejects(checkLifecycleLock('/private','name',false,completion),{code:'STORE.BUSY'});
  row=timing.snapshot().sqliteLifecycleLstat;assert.equal(row.resumedWithoutRecovery,1);assert.equal(row.validation.samples,1);
  await checkLifecycleLock('/private','name',true,completion);assert.equal(mock.mock.callCount(),2);assert.equal(timing.snapshot().sqliteLifecycleLstat.calls,2);
  assert.doesNotMatch(JSON.stringify(row),/secret|filename|EIO|private/);
});

test('lifecycle lstat: overlapping operations use local timestamps and independent request collectors',async t=>{
  let time=0;const barriers=[deferred(),deferred()],entered=deferred();let calls=0;
  t.after(()=>barriers.forEach(b=>b.resolve()));
  mockLstat(t,()=>{const result=barriers[calls++].promise;if(calls===2)entered.resolve();return result;});
  const collectors=[createContinuationTiming(()=>time),createContinuationTiming(()=>time)];
  const one=checkLifecycleLock('/private','one',false,{continuation:name=>collectors[0].begin(name)});
  time=10;const two=checkLifecycleLock('/private','two',false,{continuation:name=>collectors[1].begin(name)});
  await entered.promise;time=30;barriers[1].resolve(Promise.reject(missing()));await two;
  assert.equal(collectors[0].snapshot().sqliteLifecycleLstat.incomplete,1);
  time=70;barriers[0].resolve(Promise.reject(missing()));await one;
  assert.equal(collectors[0].snapshot().sqliteLifecycleLstat.invocationToRecovery.totalMs,70);
  assert.equal(collectors[1].snapshot().sqliteLifecycleLstat.invocationToRecovery.totalMs,20);
  assert.equal(collectors[0].snapshot().sqliteLifecycleLstat.calls,1);assert.equal(collectors[1].snapshot().sqliteLifecycleLstat.calls,1);
});

test('lifecycle lstat: fixed aggregates, idempotent markers, missing observations, and frozen snapshots stay bounded',()=>{
  let time=0;const timing=createContinuationTiming(()=>time);
  timing.begin('sqliteLifecycleLstat');const missing=timing.begin('sqliteLifecycleLstat');missing.start();missing.recoveryEntry();missing.resume();
  for(let i=0;i<10000;i++){
    const o=timing.begin('sqliteLifecycleLstat');o.start();time++;o.recoveryEntry();o.recoveryEntry();o.enoent();o.enoent();time+=2;o.complete();o.complete();time+=3;o.resume();o.resume();time+=4;o.validated();o.validated();
  }
  const snapshot=timing.snapshot(),row=snapshot.sqliteLifecycleLstat;
  assert.equal(row.calls,10002);assert.equal(row.incomplete,1);assert.equal(row.missingCompletion,1);
  assert.equal(row.enoent,10000);assert.equal(row.producerCompleted,10000);assert.equal(row.validated,10000);
  assert.equal(row.invocationToRecovery.totalMs,10000);assert.equal(row.recoveryWork.totalMs,20000);assert.equal(row.continuation.totalMs,30000);assert.equal(row.validation.totalMs,40000);
  assert.ok(Object.isFrozen(row));assert.ok(Object.isFrozen(row.validation));assert.ok(Object.isFrozen(row.largestInvocation));assert.ok(JSON.stringify(snapshot).length<1400);
});

test('lifecycle lstat: absent diagnostics preserve filesystem calls, scheduling order and failures',async t=>{
  let reads=0;mockLstat(t,()=>Promise.reject(missing()));
  const disabled=createCompletion(()=>{},{now:()=>{reads++;return 0;}});
  await disabled.run(operation=>checkLifecycleLock('/private','name',false,operation));await disabled.settle();
  assert.equal(reads,0);assert.equal(disabled.continuations(),null);assert.equal(disabled.snapshot().pending,0);
  const order=[];
  // Any additional reaction in the implementation would change this sequence.
  for(const enabled of [false,true]){
    const timing=createContinuationTiming(()=>0);
    const completion=enabled?{continuation(name){const o=timing.begin(name);return {...o,complete(){o.complete();queueMicrotask(()=>order.push('queued'));}};}}:undefined;
    const task=checkLifecycleLock('/private','name',false,completion);queueMicrotask(()=>order.push('caller'));
    await task;order.push('done');
  }
  assert.deepEqual(order,['caller','done','caller','queued','done']);
});

test('SQLite lifecycle lstat: real provider recovery, EIO and busy marker preserve transaction outcomes',{timeout:10000},async t=>{
  const f=await fixture(t,'sqlite'),original=fs.lstat;let mode='ENOENT',calls=0;
  mockLstat(t,(...args)=>{
    if(typeof args[0]==='string'&&args[0].endsWith('.lifecycle')){calls++;if(mode==='present')return Promise.resolve({});if(mode==='EIO')return Promise.reject(Object.assign(Error('secret'),{code:'EIO'}));}
    return original(...args);
  });
  for(const diagnosticTiming of [false,true])for(const outcome of ['ENOENT','EIO','present']){
    mode=outcome;const before=calls,completion=createCompletion(()=>{},{diagnosticTiming});
    const result=await completion.run(operation=>f.registry.bind(context(),operation).call('wydstore','create',{store:'main',collection:'users',id:`lifecycle-${diagnosticTiming}-${outcome}`,data:{name:'fixture'}}));
    await completion.settle();assert.equal(result.ok,outcome==='ENOENT',JSON.stringify(result));assert.equal(calls-before,1);
    if(outcome!=='ENOENT')assert.equal(result.code,outcome==='EIO'?'STORE.IO':'STORE.BUSY');
    assert.equal(completion.snapshot().commitReported,outcome==='ENOENT'?1:0);assert.equal(completion.snapshot().pending,0);
    if(diagnosticTiming){const row=completion.continuations().sqliteLifecycleLstat;assert.equal(row.calls,1);assert.equal(row.resumed,1);assert.equal(row.incomplete,0);assert.equal(row.enoent,outcome==='ENOENT'?1:0);}
    assert.doesNotMatch(JSON.stringify(result)+JSON.stringify(completion.continuations()),/secret/);
  }
  await f.registry.close();
});
