import test from 'node:test';
import assert from 'node:assert/strict';
import {createSchedulingSampler} from '../packages/wydgine/src/engine/http/scheduling.js';
import {createHttpDiagnostics} from '../packages/wydgine/src/engine/http/diagnostics.js';
function fixture(){
 let time=0,allocated=0,unrefs=0;const pending=new Set();
 const sampler=createSchedulingSampler({now:()=>time,schedule(callback,delay){allocated++;const timer={callback,delay,unref(){unrefs++;}};pending.add(timer);return timer;},cancel(timer){pending.delete(timer);}});
 return {sampler,pending,set(timeMs){time=timeMs;},fire(timeMs){time=timeMs;assert.equal(pending.size,1);const timer=[...pending][0];pending.delete(timer);timer.callback();},get allocated(){return allocated;},get unrefs(){return unrefs;}};
}
test('scheduling: responsive asynchronous barrier consumes time without callback lateness',async()=>{
 const f=fixture(),window=f.sampler.start();let release;
 const barrier=new Promise(resolve=>release=resolve);
 const request=(async()=>{await barrier;return window.finish();})();
 for(let ms=50;ms<=1100;ms+=50){f.fire(ms);await Promise.resolve();}
 release();const record=await request;
 assert.equal(record.durationMs,1100);assert.equal(record.callbacks,22);assert.equal(record.maxLatenessMs,0);assert.equal(record.maxLatenessOffsetMs,50);assert.equal(record.pendingLatenessMs,0);assert.equal(f.pending.size,0);
});
test('scheduling: withheld callbacks measure lateness and do not create catch-up bursts',()=>{
 const f=fixture(),window=f.sampler.start();f.fire(325);
 const record=window.finish();assert.equal(record.callbacks,1);assert.equal(record.maxLatenessMs,275);assert.equal(record.maxLatenessOffsetMs,325);assert.equal(f.allocated,2);assert.equal(f.unrefs,2);
});
test('scheduling: concurrent windows share one timer and retain their own observation window',()=>{
 const f=fixture(),first=f.sampler.start();f.set(10);const second=f.sampler.start();assert.equal(f.allocated,1);
 f.fire(55);f.set(60);assert.equal(first.finish().maxLatenessMs,5);assert.equal(f.pending.size,1);
 f.fire(110);f.set(115);const record=second.finish();assert.equal(record.callbacks,2);assert.equal(record.durationMs,105);assert.equal(f.pending.size,0);
 assert.equal(second.finish(),record,'removal is idempotent');
});
test('scheduling: a late final callback is incomplete evidence, never silently zero delay',()=>{
 const f=fixture(),window=f.sampler.start(),stale=[...f.pending][0];f.set(450);
 const record=window.finish();assert.equal(record.callbacks,0);assert.equal(record.maxLatenessOffsetMs,null);assert.equal(record.pendingLatenessMs,400);assert.equal(record.incomplete,true);
 const next=f.sampler.start();stale.callback();assert.equal(f.pending.size,1);assert.equal(next.finish().callbacks,0);
});
test('scheduling: joining an already overdue timer does not attribute pre-window delay',()=>{
 const f=fixture(),first=f.sampler.start();f.set(300);const second=f.sampler.start();f.fire(310);
 assert.equal(first.finish().maxLatenessMs,260);assert.equal(second.finish().maxLatenessMs,10);
});
test('scheduling: disabled observation allocates no resources; exceptional finish releases observation',()=>{
 const f=fixture();assert.equal(createHttpDiagnostics(undefined,{sampler:f.sampler}),null);assert.equal(f.allocated,0);
 const observation=createHttpDiagnostics(()=>{throw Error('observer');},{sampler:f.sampler});
 observation.finish({statusCode:200},null);assert.equal(f.pending.size,0);
 const exceptional=createHttpDiagnostics(()=>{},{sampler:f.sampler});
 assert.throws(()=>exceptional.finish({get statusCode(){throw Error('output');}},null),/output/);assert.equal(f.pending.size,0);
});
