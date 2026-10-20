// Alternating observer and immutable-path controls. No installed authority is
// simulated: this measures ONLY path construction around real fresh lstats.
import {lstatSync,mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {createDeadlineLedger,deadlineArm,deadlineStart,deadlineCheck,deadlineMark} from './deadline-ledger.js';
const root=mkdtempSync(path.join(os.tmpdir(),'wyd-spikek-control-'));
const files=['content/installed-packages.json','wydgit.config.json','content/.package-install.lock','content/.package-recovery.lock','content/.package-infrastructure.json','content/package-effects.json','content/package-operation.json'];
const absolute=files.map(f=>path.join(root,f));
const rows=[],observer=[];
try{
  mkdirSync(path.join(root,'content'));for(const f of absolute.slice(0,2))writeFileSync(f,'fixed control');
  const old=()=>files.map(file=>lstatSync(path.join(root,file),{bigint:true,throwIfNoEntry:false}));
  const candidate=()=>absolute.map(file=>lstatSync(file,{bigint:true,throwIfNoEntry:false}));
  assert.deepEqual(old(),candidate());
  for(let round=0;round<25;round++)for(const mode of round%2?['candidate','reference']:['reference','candidate']){
    const fn=mode==='reference'?old:candidate,start=performance.now();let present=0;
    for(let i=0;i<1680;i++)for(const s of fn())present+=Boolean(s);
    const elapsedMs=performance.now()-start;assert.equal(present,3360);
    if(round>=7)rows.push({round,mode,elapsedMs,stamps:1680,metadataCalls:11760});
  }
  for(let round=0;round<15;round++)for(const enabled of round%2?[true,false]:[false,true]){
    const capture=enabled?createDeadlineLedger():null,start=performance.now();
    const work=()=>{deadlineArm();deadlineStart(1000,2000);for(let i=0;i<10000;i++){deadlineCheck(1500,2000,true);if(i%100===0)deadlineMark('canonicalPublication');}};
    if(capture)capture.run(work);else work();
    const elapsedMs=performance.now()-start,result=capture?.finish();
    if(round>=3)observer.push({round,enabled,elapsedMs,checks:result?.checks??0,rows:result?.rows.length??0,dropped:result?.dropped??0});
  }
  console.log(JSON.stringify({schema:'wydgine.post-commit-control/1',node:process.version,rows,observer}));
}finally{rmSync(root,{recursive:true,force:true});}
