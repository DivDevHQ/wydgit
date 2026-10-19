// Manual bounded overhead calibration. No pass/fail timing threshold or runtime tuning.
import {performance} from 'node:perf_hooks';
import {createSchedulingSampler} from '../packages/wydgine/src/engine/http/scheduling.js';
import {executionBudget} from '../wydgine/sewn/budget.js';
import {createObservedExecutionBudget,budgetProgress} from '../packages/wydgine/src/engine/execution/progress.js';
import {createPageDiagnostics} from '../packages/wydgine/src/engine/execution/diagnostics.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
const ctx=new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'calibration'}),iterations=100000;
function checks(progress){const ledger=executionBudget(createObservedExecutionBudget(ctx,{progress}),ctx),start=performance.now();for(let i=0;i<iterations;i++)ledger.check();const elapsed=performance.now()-start;ledger.close();return elapsed;}
checks(false);checks(true);
const disabled=[],enabled=[];for(let i=0;i<9;i++){if(i%2){enabled.push(checks(true));disabled.push(checks(false));}else{disabled.push(checks(false));enabled.push(checks(true));}}
const boundaryCalls=1000,boundaryDisabled=[],boundaryEnabled=[];
async function boundaries(progress){
 const token=createObservedExecutionBudget(ctx,{progress}),ledger=executionBudget(token,ctx),diagnostics=createPageDiagnostics();
 diagnostics.budgetStarted(budgetProgress(token),{snapshot:()=>Object.freeze({admitted:0,nativeStarted:0,pending:0,commitReported:0})});
 diagnostics.phase('load');const started=performance.now();for(let i=0;i<boundaryCalls;i++)await diagnostics.measure('dispatch',()=>Promise.resolve());
 ledger.close();return performance.now()-started;
}
await boundaries(false);await boundaries(true);
for(let i=0;i<9;i++){if(i%2){boundaryEnabled.push(await boundaries(true));boundaryDisabled.push(await boundaries(false));}else{boundaryDisabled.push(await boundaries(false));boundaryEnabled.push(await boundaries(true));}}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
// Simulate 100 concurrently observed one-second windows, with on-time callbacks.
let now=0,callback,allocations=0,cancellations=0;
const sampler=createSchedulingSampler({now:()=>now,schedule(fn){callback=fn;allocations++;return {unref(){}};},cancel(){cancellations++;}});
const windows=Array.from({length:100},()=>sampler.start()),start=performance.now();
for(let i=1;i<=20;i++){now=i*50;callback();}const records=windows.map(window=>window.finish());
console.log(JSON.stringify({schema:'wydgine.http-calibration/1',runtime:process.version,platform:process.platform,iterations,rounds:9,
 disabledMedianMs:median(disabled),enabledMedianMs:median(enabled),addedMedianMs:median(enabled)-median(disabled),disabled,enabled,
 boundaries:{calls:boundaryCalls,disabledMedianMs:median(boundaryDisabled),enabledMedianMs:median(boundaryEnabled),addedMedianMs:median(boundaryEnabled)-median(boundaryDisabled),disabled:boundaryDisabled,enabled:boundaryEnabled},
 scheduling:{windows:100,callbacksPerWindow:records[0].callbacks,intervalMs:50,timerAllocations:allocations,timerCancellations:cancellations,processingMs:performance.now()-start},limitations:'Microbenchmark, not an application latency estimate; simulated timer callbacks do not measure process scheduling.'},null,2));
