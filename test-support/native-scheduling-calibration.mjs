// Observer-only controls: identical synthetic Promise work, no Page/provider.
import {performance} from 'node:perf_hooks';
import {createNativeScheduling,startPromiseObservation,schedulingMark,schedulingPromise,schedulingSync} from './native-scheduling.js';
const rows=[];
async function measure(mode){
  const capture=mode==='off'?null:createNativeScheduling({request:1,costs:mode==='costs'}),stop=mode==='promise'?startPromiseObservation():null;
  const start=performance.now();
  const work=async()=>{for(let i=0;i<30000;i++){
    // A fresh bounded capture per operation avoids benchmarking overflow.
    const c=capture?createNativeScheduling({request:1,costs:mode==='costs'}):null;
    const run=async()=>{schedulingMark('dispatch');const promise=Promise.resolve().then(()=>{schedulingMark('providerEntry');schedulingSync('installedStamp',()=>1);schedulingMark('providerComplete');return 1;});schedulingPromise(promise,'taskSettlement');await promise;schedulingMark('nativeContinuation');};
    if(c){await c.run(run);c.finish();}else await run();
    if(i%1000===999)await new Promise(resolve=>setImmediate(resolve));
  }};
  try{await work();return {mode,elapsedMs:performance.now()-start};}finally{stop?.();}
}
for(const mode of ['off','markers','costs','promise'])await measure(mode);
for(let round=1;round<=9;round++)for(const mode of round%2?['off','markers','costs','promise']:['promise','costs','markers','off'])rows.push({round,...await measure(mode)});
console.log(JSON.stringify({schema:'wydgine.native-scheduling-calibration/1',operations:30000,synthetic:true,rows}));
