import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createSynchronousAttribution,syncSpan,count,phase,budgetDeadline,boundary,observedFs,lifetimeCheck,observeMethods} from '../test-support/prerender-integrity-attribution.js';

test('Spike G defaults have no active timing, counters or observers',()=>{
  assert.equal(syncSpan('not-a-stage',()=>42),42);
  assert.equal(observedFs('not-a-site','not-an-operation',()=>42,'private'),42);
  count('not-a-counter');phase('private');lifetimeCheck({});boundary('not-a-boundary');
});
test('synchronous exclusive accounting subtracts only its own nested children',()=>{
  let clock=0;const c=createSynchronousAttribution({now:()=>clock});
  c.run(()=>syncSpan('mutation',()=>{
    clock=2;syncSpan('hydrate',()=>{clock=5;});clock=7;
    syncSpan('dehydrate',()=>{clock=11;});clock=13;
  }));
  const r=c.finish(),by=Object.fromEntries(r.spans.map(row=>[row.stage,row]));
  assert.equal(by.mutation.inclusiveMs,13);assert.equal(by.mutation.exclusiveMs,6);
  assert.equal(by.hydrate.exclusiveMs,3);assert.equal(by.dehydrate.exclusiveMs,4);
  assert.equal(r.spans.reduce((n,row)=>n+row.exclusiveMs,0),13);
  assert.equal(c.finish(),r);
});
test('request captures survive awaits without mixing generations or synchronous stacks',async()=>{
  const captures=Array.from({length:12},(_,i)=>createSynchronousAttribution({generation:9,request:i+1}));
  await Promise.all(captures.map((c,i)=>c.run(async()=>{
    await setImmediate();phase('prerender');syncSpan('mutation',()=>count('hydratedNodes',i+1));
  })));
  for(let i=0;i<12;i++){const r=captures[i].finish();assert.equal(r.request,i+1);assert.equal(r.generation,9);assert.equal(r.counts.hydratedNodes,i+1);assert.equal(r.spans[0].phase,'prerender');}
});
test('metadata groups are static and artifact identities are bounded and path-free',()=>{
  const c=createSynchronousAttribution({maxArtifacts:1}),secret='/private/user/root/secret';
  c.run(()=>{
    for(const file of [secret,secret,secret+'2'])observedFs('packages/state.js','lstatSync',()=>undefined,file);
    assert.throws(()=>observedFs(secret,'lstatSync',()=>{},secret),RangeError);
  });
  const r=c.finish();assert.equal(r.uniqueArtifacts,1);assert.equal(r.droppedArtifacts,1);assert.equal(r.metadata[0].calls,3);
  assert.ok(!JSON.stringify(r).includes('private'));assert.ok(!JSON.stringify(r).includes('secret'));
});
test('deadline diagnostics observe the existing Date deadline without enforcing it',()=>{
  const c=createSynchronousAttribution(),deadline=Date.now()-100;
  c.run(()=>{syncSpan('hydrate',()=>{});budgetDeadline(deadline);boundary('budgetStarted');syncSpan('hydrate',()=>{});});
  const r=c.finish();assert.equal(r.spans.length,2);assert.equal(r.spans[0].insideBudget,false);assert.equal(r.spans[1].insideBudget,true);
  assert.ok(r.boundaries[0].remainingMs<=-100);
});
test('lifetime observations use bound context ordinals; ended captures retain no more work',()=>{
  const c=createSynchronousAttribution(),a={},b={};c.run(()=>{lifetimeCheck(a);lifetimeCheck(a);lifetimeCheck(b);});
  const r=c.finish();assert.equal(r.observedLifetimes,2);assert.equal(r.counts.repeatedGenerationChecks,1);
  c.run(()=>lifetimeCheck(a));assert.equal(c.finish(),r);assert.equal(r.counts.guardChecks,3);
});
test('host method wrappers preserve receiver, accessors, values and failures',()=>{
  const error=new Error('test'),value=Object.freeze({get answer(){return 42;},commit(){assert.equal(this,value);return 17;},changes(){throw error;}});
  const c=createSynchronousAttribution();c.run(()=>{
    const wrapped=observeMethods(value,{commit:'commit',changes:'changes'});assert.equal(wrapped.answer,42);assert.equal(wrapped.commit(),17);assert.throws(()=>wrapped.changes(),e=>e===error);
  });
  assert.equal(c.finish().spans.length,2);
});
test('strict diagnostic-only hooks count real canonical passes without changing serialized state',async()=>{
  const script=`
    const {installAttributionHooks}=await import('./test-support/prerender-integrity-hooks.mjs');installAttributionHooks();
    const {createSynchronousAttribution}=await import('./test-support/prerender-integrity-attribution.js');
    const {clearFixture}=await import('./test-support/form-clear.js');const {serialize}=await import('./wydgine/object-model/index.js');
    const f=clearFixture(),before=serialize(f.model.runtime),c=createSynchronousAttribution();
    const next=c.run(()=>{const e=f.model.runtime.edit(f.context);e.setProperty('field0','label','Field 0');return e.commit().runtime;});
    const r=c.finish();console.log(JSON.stringify({same:before===serialize(next),revision:next.revision,spans:r.spans}));`;
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),timeout:10000,maxBuffer:1024*1024});
  const r=JSON.parse(stdout);assert.equal(r.same,true);assert.equal(r.revision,1);
  assert.equal(r.spans.find(row=>row.stage==='hydrate').calls,3);
  assert.equal(r.spans.find(row=>row.stage==='dehydrate').calls,3);
});
