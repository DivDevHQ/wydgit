import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createLedgerProgress,createObservedExecutionBudget,budgetProgress,observedExecutionMeter} from '../packages/wydgine/src/engine/execution/progress.js';
import {createPageDiagnostics} from '../packages/wydgine/src/engine/execution/diagnostics.js';
import {executionBudget} from '../wydgine/sewn/budget.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {execute} from '../wydgine/sewn/execute.js';
import {compile} from '../wydgine/wydbasic/index.js';
const context=()=>new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'page'});
function clocks(t){let wall=2000,mono=0;t.mock.method(Date,'now',()=>wall);t.mock.method(performance,'now',()=>mono);return {set(w,m){wall=2000+w;mono=m;}};}
function observed(ctx,options={}){const token=createObservedExecutionBudget(ctx,{progress:true,...options});return {token,ledger:executionBudget(token,ctx),progress:budgetProgress(token),meter:()=>observedExecutionMeter(token,ctx)};}
test('progress: responsive awaited work exhausts ledger without advancing counters',async t=>{
 const clock=clocks(t),{ledger,progress,meter}=observed(context());progress.phase('load');ledger.take('eventHandlers');progress.checkpoint();
 let release;const barrier=new Promise(resolve=>release=resolve),request=(async()=>{await barrier;progress.checkpoint();ledger.check();})();
 clock.set(1100,1100);release();await assert.rejects(request,{code:'SEWN.LIMIT'});
 const result=meter();assert.equal(result.exhaustion.resource,'timeMs');assert.equal(result.progress.maxObservedUncheckedInterval.elapsedMs,1100);assert.equal(result.progress.maxObservedUncheckedInterval.phase,'load');assert.equal(result.progress.maxObservedUncheckedInterval.checks,0);assert.deepEqual(result.progress.maxObservedUncheckedInterval.chargesBefore,result.progress.maxObservedUncheckedInterval.chargesAfter);
});
test('progress: normal SEWN work advances fixed counters across phase checkpoints',async t=>{
 const clock=clocks(t),ctx=context(),{token,progress,meter}=observed(ctx);
 progress.phase('load');await execute(compile('DIM x = 1\nRETURN x'),{context:ctx,budget:token,scope:{}});
 clock.set(20,20);progress.phase('prerender');await execute(compile('RETURN 2'),{context:ctx,budget:token,scope:{}});
 clock.set(30,30);const result=meter().progress;
 assert.ok(result.phases.load.lastCharges.steps>(result.phases.load.firstCharges.steps??0));assert.ok(result.phases.prerender.lastCharges.steps>result.phases.prerender.firstCharges.steps);assert.ok(result.checks>0);assert.equal(result.exactUncheckedMaximum,false);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.phases.load));
});
test('progress: windows containing many guard checks are not labelled unchecked',t=>{
 const clock=clocks(t),counts={steps:0},observation=createLedgerProgress(counts);observation.phase('load');
 for(let i=0;i<100;i++){counts.steps++;observation.check();}clock.set(30,30);const progress=observation.finish();
 assert.equal(progress.maxCheckpointInterval.checks,100);assert.equal(progress.maxCheckpointInterval.elapsedMs,30);assert.equal(progress.maxCheckpointInterval.chargesAfter.steps,100);assert.equal(progress.maxObservedUncheckedInterval.elapsedMs,0);
});
test('progress: monotonic intervals and Date deadline remain distinct at equality and after wall rollback',t=>{
 const clock=clocks(t),{ledger,progress,meter}=observed(context());progress.phase('action');
 clock.set(-500,400);ledger.check();assert.equal(ledger.meter().elapsedMs,0);progress.phase('load');
 clock.set(999,700);ledger.check();clock.set(1000,701);assert.throws(()=>ledger.take('serviceCalls'),{code:'SEWN.LIMIT'});
 const result=meter();assert.deepEqual(result.exhaustion,{resource:'timeMs',used:1000,limit:1000});assert.equal(result.charges.serviceCalls,undefined);assert.equal(result.progress.durationMs,701);assert.equal(result.progress.phases.action.elapsedMs,400);
 clock.set(2000,900);assert.throws(()=>ledger.check(),error=>error.details.used===1000);assert.deepEqual(ledger.meter().exhaustion,result.exhaustion);assert.equal(meter().progress,result.progress);
});
test('progress: disabled ledger uses the original path and guard/first-exhaustion are preserved',t=>{
 const clock=clocks(t),ctx=context();let reads=0;t.mock.method(performance,'now',()=>{reads++;return 0;});
 const token=createObservedExecutionBudget(ctx),ledger=executionBudget(token,ctx);for(let i=0;i<1000;i++)ledger.check();assert.equal(budgetProgress(token),null);assert.equal(observedExecutionMeter(token,ctx).progress,undefined);assert.equal(reads,0);
 const cancelled=observed(ctx,{guard:()=>{throw Error('cancelled');}});assert.throws(()=>cancelled.ledger.check(),/cancelled/);clock.set(2000,2000);assert.throws(()=>cancelled.ledger.check(),error=>error.details.resource==='guard');assert.equal(cancelled.meter().exhaustion.resource,'guard');
});
test('progress: bounded service snapshots finish idempotently and ignore late observations',t=>{
 clocks(t);const observation=createLedgerProgress({});observation.phase('action');observation.checkpoint(Object.freeze({admitted:1,nativeStarted:1,pending:1,commitReported:0}));observation.checkpoint(Object.freeze({admitted:1,nativeStarted:1,pending:0,commitReported:1}));
 const progress=observation.finish();assert.deepEqual(progress.phases.action.services,{admitted:1,nativeStarted:1,pending:0,commitReported:1});observation.phase('private-arbitrary-input');observation.check();observation.checkpoint();assert.equal(observation.finish(),progress);assert.equal(Object.hasOwn(progress.phases,'private-arbitrary-input'),false);
});
test('progress: native handler barrier has responsive scheduling and a measured unchecked Load interval',async t=>{
 const {createDispatcher}=await import('../wydgine/events/index.js');const {createSchedulingSampler}=await import('../packages/wydgine/src/engine/http/scheduling.js');
 const clock=clocks(t),ctx=context(),{token,ledger,progress,meter}=observed(ctx),diagnostics=createPageDiagnostics();diagnostics.budgetStarted(progress);
 let mono=0,callback,release,entered;const barrier=new Promise(resolve=>release=resolve),entry=new Promise(resolve=>entered=resolve);
 const sampler=createSchedulingSampler({now:()=>mono,schedule(fn){callback=fn;return {unref(){}};},cancel(){callback=null;}}),window=sampler.start();
 const dispatcher=createDispatcher({context:ctx,budget:token,handle:id=>({id}),handlers:diagnostics.handlers([{type:'Page.Load',owner:'page',run:async function(){entered();await barrier;}}])});
 progress.phase('load');const pending=dispatcher.dispatch({type:'Page.Load',source:'page',target:'page',payload:{}});await entry;
 for(let ms=50;ms<=1100;ms+=50){mono=ms;clock.set(ms,ms);callback();await Promise.resolve();}release();await pending;assert.throws(()=>ledger.check(),{code:'SEWN.LIMIT'});dispatcher.close();
 const scheduling=window.finish(),result=meter(),interval=result.progress.maxObservedUncheckedInterval;
 assert.equal(scheduling.callbacks,22);assert.equal(scheduling.maxLatenessMs,0);assert.equal(interval.elapsedMs,1100);assert.equal(interval.checks,0);assert.equal(interval.phase,'load');assert.equal(interval.boundary,'handler');assert.deepEqual(interval.chargesBefore,interval.chargesAfter);assert.equal(result.charges.serviceCalls,undefined);assert.equal(result.exhaustion.resource,'timeMs');
});
test('progress: no per-operation clock reads and trusted-handler timer revocation is unchanged',async t=>{
 const {createDispatcher}=await import('../wydgine/events/index.js');const clock=clocks(t);let reads=0;t.mock.method(performance,'now',()=>{reads++;return 0;});
 const {ledger}=observed(context()),atStart=reads;for(let i=0;i<1000;i++)ledger.check();clock.set(10,10);ledger.check();assert.equal(reads,atStart);
 t.mock.timers.enable({apis:['setTimeout']});let entered,release,lateDenied=false;const entry=new Promise(resolve=>entered=resolve),barrier=new Promise(resolve=>release=resolve);
 const ctx=new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'page',limits:{eventTimeMs:10}}),{token,progress}=observed(ctx),diagnostics=createPageDiagnostics();diagnostics.budgetStarted(progress);
 const dispatcher=createDispatcher({context:ctx,budget:token,handle:(id,guard)=>({get id(){guard();return id;}}),handlers:diagnostics.handlers([{type:'Page.Load',owner:'page',run:async function(){entered();await barrier;try{this.ME.id;}catch{lateDenied=true;}}}])});
 const pending=dispatcher.dispatch({type:'Page.Load',source:'page',target:'page',payload:{}});await entry;const rejected=assert.rejects(pending,{code:'EVENT.LIMIT'});t.mock.timers.tick(10);await rejected;release();await Promise.resolve();assert.equal(lateDenied,true);dispatcher.close();
});
