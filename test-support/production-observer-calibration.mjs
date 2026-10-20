// Observer-only calibration. No Contact, package guard, storage or Page work.
import {performance} from 'node:perf_hooks';
import {setImmediate} from 'node:timers/promises';
import {createFsreqpromiseProbe} from './fsreqpromise-correlation.js';
import {createSynchronousAttribution,syncSpan,observedFs} from './prerender-integrity-attribution.js';
const modes=['off','loop','filesystem','scheduling'];
const rows=[];
for(let round=0;round<10;round++){
  for(const mode of round%2?[...modes].reverse():modes){
    const initialized=performance.now(),probe=createFsreqpromiseProbe({enabled:['filesystem','scheduling'].includes(mode),
      scheduling:['loop','scheduling'].includes(mode),monitorOnly:mode==='loop',request:()=>1});
    probe.beginScheduling();const initializationMs=performance.now()-initialized;
    const before=process.memoryUsage(),cpu=process.cpuUsage(),start=performance.now();let sum=0;
    for(let i=0;i<30000;i++){sum+=await Promise.resolve(1);if(i%1000===0)await setImmediate();}
    const elapsedMs=performance.now()-start,used=process.cpuUsage(cpu),after=process.memoryUsage(),stop=performance.now();
    probe.stop();const teardownMs=performance.now()-stop,snapshot=probe.snapshot();
    if(round)rows.push({round,mode,elapsedMs,cpu:used,initializationMs,teardownMs,before,after,sum,
      callbacks:snapshot.scheduling?.callbackCount??0,spans:snapshot.scheduling?.spans.length??0,errors:snapshot.hookErrors});
  }
}
const synchronous=[];
for(let round=0;round<10;round++)for(const observed of round%2?[true,false]:[false,true]){
  const capture=observed?createSynchronousAttribution():null;
  const work=()=>{let sum=0;for(let i=0;i<10000;i++)sum+=syncSpan('contextCheck',()=>{
    let value=0;for(let file=0;file<7;file++)value+=observedFs('packages/index.js','lstatSync',()=>1,'/calibration/'+[
      'content/installed-packages.json','wydgit.config.json','content/.package-install.lock','content/.package-recovery.lock',
      'content/.package-infrastructure.json','content/package-effects.json','content/package-operation.json'][file]);return value;
  });return sum;};
  const cpu=process.cpuUsage(),start=performance.now(),sum=capture?capture.run(work):work(),elapsedMs=performance.now()-start,used=process.cpuUsage(cpu);
  const stop=performance.now(),result=capture?.finish(),teardownMs=performance.now()-stop;
  if(round)synchronous.push({round,observed,elapsedMs,cpu:used,sum,teardownMs,spans:result?.spans.length??0,metadata:result?.metadata.length??0});
}
console.log(JSON.stringify({schema:'wydgine.production-observer-calibration/1',promiseIterations:30000,metadataIterations:70000,warmupRounds:1,rows,synchronous}));
