// Paired control for the diagnostic label computation only. Reference is an
// explicitly supplied archived trusted observer module, never a runtime input.
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import * as candidate from './prerender-integrity-attribution.js';
const reference=await import(pathToFileURL(process.argv[2]).href);
const files=['content/installed-packages.json','wydgit.config.json','content/.package-install.lock','content/.package-recovery.lock',
  'content/.package-infrastructure.json','content/package-effects.json','content/package-operation.json'];
const rows=[];
for(let round=0;round<29;round++)for(const label of round%2?['candidate','reference']:['reference','candidate']){
  const module=label==='candidate'?candidate:reference,capture=module.createSynchronousAttribution(),start=performance.now();
  let calls=0;
  capture.run(()=>{for(let i=0;i<10000;i++)module.syncSpan('contextCheck',()=>{
    for(const file of files)module.observedFs('packages/index.js','lstatSync',()=>{calls++;},'/calibration/'+file);
  });});
  const elapsedMs=performance.now()-start,result=capture.finish();
  if(calls!==70000||result.metadata[0].calls!==70000||result.uniqueArtifacts!==7)throw Error('Control lost metadata observations');
  if(round>=20)rows.push({round:round-19,label,elapsedMs,calls,metadata:result.metadata.length,spans:result.spans.length});
}
console.log(JSON.stringify({schema:'wydgine.production-observer-label-control/1',warmupPairs:20,measuredPairs:9,rows}));
