import test from 'node:test';
import assert from 'node:assert/strict';
import {createHook,AsyncLocalStorage} from 'node:async_hooks';
import {createCompletion} from '../wydgine/execution/completion.js';
import {createPageDiagnostics} from '../packages/wydgine/src/engine/execution/diagnostics.js';
import {createFsreqpromiseProbe} from '../test-support/fsreqpromise-correlation.js';
import {fixture,context} from '../test-support/wydstore.js';

function setup(t,{enabled=true,work=0}={}){
  let clock=0;
  const probe=createFsreqpromiseProbe({enabled,now:()=>clock});t.after(()=>probe.stop());
  const make=request=>{
    const completion=createCompletion(()=>{},{diagnosticTiming:true,observeNativeGap:({operation})=>probe.native({request,operation})});
    const diagnostics=createPageDiagnostics();
    const call=()=>{let native;return diagnostics.measure('service',()=>completion.run(op=>{native=op;op.storeEntry?.();return 'unchanged';}),()=>native?.pageContinuation?.());};
    return {completion,call,clear(){const end=completion.pageClear();try{clock+=work;}finally{end?.();}}};
  };
  return {probe,make};
}
for(const work of [0,17])test(`sequential native identities and synchronous Page work (${work}) use disjoint boundaries`,async t=>{
  const {probe,make}=setup(t,{work}),page=make(1);
  assert.equal(await page.call(),'unchanged');if(work)page.clear();assert.equal(await page.call(),'unchanged');await page.completion.settle();
  const [a,b]=probe.snapshot().nativeCalls;
  assert.deepEqual([a.request,a.operation,b.request,b.operation],[1,1,1,2]);
  assert.ok(a.dispatchMs<=a.storeEntryMs&&a.storeEntryMs<=a.completeMs&&a.completeMs<=a.pageContinuationMs&&a.pageContinuationMs<=b.dispatchMs);
  assert.equal(b.dispatchMs-a.pageContinuationMs,work);
  assert.equal(a.completeMs-a.pageContinuationMs,0);
  if(work){assert.equal(a.clearStartMs,a.pageContinuationMs);assert.equal(a.clearEndMs-a.clearStartMs,17);assert.equal(a.clearEndMs,b.dispatchMs);}
  else{assert.equal(a.clearStartMs,null);assert.equal(a.clearEndMs,null);}
});
test('concurrent requests retain separate sequential native identities',async t=>{
  const {probe,make}=setup(t);
  await Promise.all(Array.from({length:12},async(_,i)=>{const p=make(i+1);await p.call();await p.call();await p.completion.settle();}));
  const rows=probe.snapshot().nativeCalls;assert.equal(rows.length,24);
  for(let request=1;request<=12;request++){
    const [a,b]=rows.filter(r=>r.request===request);assert.deepEqual([a.operation,b.operation],[1,2]);assert.ok(a.pageContinuationMs<=b.dispatchMs);
  }
});
test('early exhaustion before SQLite inspection retains only actual markers',async t=>{
  const f=await fixture(t,'sqlite'),probe=createFsreqpromiseProbe({enabled:true});t.after(()=>probe.stop());t.after(()=>f.registry.close());
  let checks=0;
  const c=createCompletion(()=>{if(++checks>=3)throw Error('deadline');},{diagnosticTiming:true,
    observeNativeGap:({operation})=>probe.native({request:1,operation}),observeSqliteInspection:({operation})=>probe.inspect({request:1,operation})});
  const result=await c.run(op=>f.registry.bind(context(),op).call('wydstore','query',{store:'main',collection:'users'}));await c.settle();
  assert.equal(result.ok,false);const s=probe.snapshot();assert.equal(s.inspections.length,0);assert.equal(s.nativeCalls.length,1);
  assert.ok(s.nativeCalls[0].storeEntryMs!==null&&s.nativeCalls[0].completeMs!==null);assert.equal(s.nativeCalls[0].pageContinuationMs,null);assert.equal(c.snapshot().pending,0);
});
test('real SQLite Store entry precedes inspection with matching native identity',async t=>{
  const f=await fixture(t,'sqlite'),probe=createFsreqpromiseProbe({enabled:true,maxCalls:64,maxResources:128});t.after(()=>probe.stop());t.after(()=>f.registry.close());
  const c=createCompletion(()=>{},{diagnosticTiming:true,observeNativeGap:({operation})=>probe.native({request:2,operation}),observeSqliteInspection:({operation})=>probe.inspect({request:2,operation})});
  for(let i=0;i<2;i++)assert.equal((await c.run(op=>f.registry.bind(context(),op).call('wydstore','query',{store:'main',collection:'users'}))).ok,true);
  const s=probe.snapshot();assert.equal(s.inspections.length,2);
  for(const n of s.nativeCalls){const inspection=s.inspections.find(r=>r.request===n.request&&r.operation===n.operation);assert.ok(n.dispatchMs<=n.storeEntryMs&&n.storeEntryMs<=inspection.entryMs&&inspection.settledMs<=n.completeMs);}
});
test('disabled/failing factory or markers preserve results and resource counts',async t=>{
  const counts=[];
  for(const mode of ['disabled','normal','factory','marker']){
    const probe=createFsreqpromiseProbe({enabled:true});t.after(()=>probe.stop());let calls=0;
    const c=createCompletion(()=>{},{diagnosticTiming:mode!=='disabled',observeNativeGap:({operation})=>{
      calls++;if(mode==='factory')throw Error('private');
      const observer=probe.native({request:1,operation});return mode==='marker'?{...observer,dispatch(){throw Error('private');}}:observer;
    }});
    const row={},local=new AsyncLocalStorage(),token=Object.freeze({}),hook=createHook({init(_id,type){if(local.getStore()===token&&['PROMISE','Timeout','Immediate','FSREQPROMISE'].includes(type))row[type]=(row[type]??0)+1;}});
    await Promise.resolve();
    // Count only resources created inside this measured operation's async scope;
    // unrelated test-runner reactions may otherwise arrive between modes.
    hook.enable();try{await local.run(token,async()=>{assert.equal(await c.run(op=>{op.storeEntry?.();return 'unchanged';}),'unchanged');await c.settle();});}finally{hook.disable();local.disable();}
    counts.push(row);if(mode==='disabled')assert.equal(calls,0);if(mode==='marker')assert.equal(probe.snapshot().stopped,true);
  }
  // Diagnostic continuation accounting is enabled in the three observed modes.
  assert.deepEqual(counts[1],counts[2]);assert.deepEqual(counts[1],counts[3]);assert.deepEqual(counts[0],counts[1]);
});
test('native collector is bounded and stops safely',async t=>{
  const {probe}=setup(t);
  for(let request=0;request<13;request++)for(let operation=1;operation<7;operation++)probe.native({request,operation});
  const s=probe.snapshot();assert.equal(s.nativeCalls.length,64);assert.equal(s.droppedCalls,1);assert.equal(s.stopped,true);assert.equal(s.tracked,0);
});

test('actual Page SEWN service continuation brackets synchronous Clear between sequential calls',async t=>{
  const {runPage}=await import('../test-support/events.js');let clock=0;
  const probe=createFsreqpromiseProbe({enabled:true,now:()=>clock});t.after(()=>probe.stop());
  const result=await runPage({diagnosticProgress:true,observeNativeGap:({operation})=>{
    const observer=probe.native({request:1,operation});
    return {...observer,clearStart(){observer.clearStart();clock+=17;}};
  },libraries:{bind(_context,op){return {call(){op.storeEntry?.();return {ok:true,value:null};}};}},
  handlers:[{owner:'form',type:'Page.Load',wydBasic:'DIM first = SERVICES.Call("fixture","read",{})\nCALL Me.Clear()\nDIM second = SERVICES.Call("fixture","read",{})'}]});
  assert.equal(result.error,null);assert.equal(result.services.admitted,2);
  const [a,b]=probe.snapshot().nativeCalls;assert.equal(a.pageContinuationMs,0);assert.equal(a.clearStartMs,0);assert.equal(a.clearEndMs,17);assert.equal(b.dispatchMs,17);
});

test('offline partitions retain partial/missing boundaries and exclude overlapping calls',async()=>{
  const {partitionNativeGaps}=await import('../test-support/native-settlement-gap.js');
  const a={request:1,operation:1,completeMs:10,pageContinuationMs:12,clearStartMs:13,clearEndMs:20};
  const b={request:1,operation:2,dispatchMs:30,storeEntryMs:32,completeMs:50};
  const inspections=[{request:1,operation:1,settledMs:9},{request:1,operation:2,entryMs:35}];
  const full=partitionNativeGaps({nativeCalls:[a,b],inspections});assert.equal(full.eligible,1);assert.equal(full.complete,1);
  assert.deepEqual(full.pairs[0].partitionsMs,[3,18,2,3]);assert.equal(full.pairs[0].clearMs,7);assert.equal(full.pairs[0].pageOutsideClearMs,11);assert.equal(full.pairs[0].residualMs,0);
  const partial=partitionNativeGaps({nativeCalls:[a,b],inspections:[]});assert.equal(partial.partial,1);assert.equal(partial.pairs[0].partitionsMs[3],null);assert.equal(partial.pairs[0].residualMs,null);
  const missing=partitionNativeGaps({nativeCalls:[{...a,pageContinuationMs:null},{...b,storeEntryMs:null}],inspections:[]});assert.equal(missing.missing,1);
  assert.equal(partitionNativeGaps({nativeCalls:[a,{...b,request:2}],inspections}).eligible,0);
  assert.equal(partitionNativeGaps({nativeCalls:[a,{...b,dispatchMs:8}],inspections}).eligible,0);
});
