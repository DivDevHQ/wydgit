// Isolated representation/I/O cost comparison, never an authorization path.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {sameInstallationStamp} from '../packages/wydgine/src/engine/packages/installation-stamp.js';
import {distribution} from './scheduling-attribution.js';
const output=process.argv[2];if(!output)throw Error('Usage: node test-support/installation-stamp-probe.mjs NEW_FILE');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'wyd-stamp-cost-'));
try{
  const files=Array.from({length:7},(_,i)=>path.join(root,'artifact-'+i));for(const i of [0,1,5])fs.writeFileSync(files[i],'fixture');
  const read=()=>files.map(file=>fs.lstatSync(file,{bigint:true,throwIfNoEntry:false}));
  const legacy=stats=>stats.map(s=>s?`${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`:'absent').join('|');
  const fixed=read(),acceptedLegacy=legacy(fixed),rows=[];
  for(const includeIo of [false,true]){
    const iterations=includeIo?1000:50000;
    const run=variant=>{const start=performance.now();let matched=0;for(let i=0;i<iterations;i++){
      const observed=includeIo?read():fixed;
      matched+=variant==='legacy'?legacy(observed)===acceptedLegacy:sameInstallationStamp(observed,fixed);
    }if(matched!==iterations)throw Error('Comparison mismatch');return performance.now()-start;};
    for(let i=0;i<3;i++){run('legacy');run('tuple');}
    for(let round=1;round<=9;round++)for(const variant of round%2?['legacy','tuple']:['tuple','legacy'])rows.push({includeIo,iterations,round,variant,elapsedMs:run(variant),metadataCalls:includeIo?iterations*7:0});
  }
  const groups=[];for(const includeIo of [false,true])for(const variant of ['legacy','tuple'])groups.push({includeIo,variant,elapsedMs:distribution(rows.filter(r=>r.includeIo===includeIo&&r.variant===variant).map(r=>r.elapsedMs))});
  fs.writeFileSync(output,JSON.stringify({schema:'wydgine.installation-stamp-cost/1',node:process.version,files:7,present:3,absent:4,clock:'performance.now',
    warmups:3,rounds:9,rows,groups,limitations:'Synthetic private fixture. Same seven fresh lstatSync calls in each I/O iteration; representation-only mode cannot authorize work. No Page/HTTP latency estimate.'},null,2)+'\n',{flag:'wx'});
}finally{fs.rmSync(root,{recursive:true,force:true});}
