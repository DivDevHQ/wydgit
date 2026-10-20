// Fixed fresh-process Spike K matrix. No uncertain write is replayed.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {summarizeProductionWindow} from './production-observer-probe.mjs';
const [directory,series,part]=process.argv.slice(2);
if(!directory||!['baseline','corrected'].includes(series))throw Error('Usage: post-commit-probe.mjs NEW_DIRECTORY baseline|corrected');
await fs.mkdir(directory,{recursive:false});
const start=performance.now(),windows=[];
const configurations=[...Array.from({length:10},(_,i)=>['SQLite','off',i+1]),
  ...Array.from({length:3},(_,i)=>[['SQLite','minimal',i+1],['SQLite','ledger',i+1],['JSON','ledger',i+1],['SQLite','costs',i+1]]).flat(),
  ...Array.from({length:3},(_,i)=>[['SQLite','extended-ledger',i+1],['JSON','extended-ledger',i+1]]).flat(),
  ...Array.from({length:3},(_,i)=>['SQLite','serial-costs',i+1])];
for(const [provider,mode,round]of part==='tail'?configurations.slice(22):configurations){
  if(performance.now()-start>600000)throw Error('Series ceiling');
  const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-spikek-'));
  const config={provider,concurrency:mode==='serial-costs'?1:12,clientPlacement:'separate',reconcile:true,
    diagnosticsEnabled:mode!=='off',deadlineLedger:['ledger','costs','serial-costs','extended-ledger'].includes(mode),
    deadlineCosts:['costs','serial-costs'].includes(mode),formClear:['ledger','costs','serial-costs'].includes(mode),
    ...(mode==='extended-ledger'?{resourceCorrelation:true,inspectionCorrelation:true,nativeGap:true,formClear:true,scheduling:true,synchronousAttribution:true}:{}),
    spikeKBaseline:series==='baseline',generation:windows.length+1};
  let output='',stderr='';
  try{
    const env={...process.env,TMPDIR:scratch};delete env.NODE_OPTIONS;delete env.NODE_PATH;
    const status=await new Promise(resolve=>{
      const child=spawn(process.execPath,[fileURLToPath(new URL('./production-observer-worker.mjs',import.meta.url)),JSON.stringify(config)],{env,stdio:['ignore','pipe','pipe']});let reason=null,kill;
      const stop=()=>{child.kill('SIGTERM');kill??=setTimeout(()=>child.kill('SIGKILL'),2000);};
      const timer=setTimeout(()=>{reason='timeout';stop();},45000);
      child.stdout.on('data',c=>{if(output.length+c.length>16*1024*1024){reason='output-bound';stop();}else output+=c;});
      child.stderr.on('data',c=>{if(stderr.length<65536)stderr+=c;});child.once('error',()=>{reason='spawn';});
      child.once('close',(code,signal)=>{clearTimeout(timer);clearTimeout(kill);resolve({code,signal,reason});});
    });
    let value;try{value=JSON.parse(output);}catch{value=null;}
    const file=String(windows.length+1).padStart(2,'0')+'-'+provider+'-'+mode+'-'+round+'.json';
    const row={provider,mode,round,config,status,file,summary:value?summarizeProductionWindow(value):null};
    await fs.writeFile(path.join(directory,file),JSON.stringify({status,value,stderr})+'\n',{flag:'wx'});windows.push(row);
    await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({series,complete:false,windows},null,2)+'\n');
    console.log(JSON.stringify({series,provider,mode,round,status,http200:row.summary?.http200,http500:row.summary?.http500,reconciled:row.summary?.reconciledRecords,failure:value?.fixtureFailure}));
    if(status.code!==0||status.reason||!value||value.fixtureFailure||!value.cleanupComplete)throw Error('Worker/fixture failed; sample preserved');
  }finally{await fs.rm(scratch,{recursive:true,force:true});}
}
await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({schema:'wydgine.post-commit-series/1',series,complete:true,
  environment:{node:process.version,kernel:os.release(),cpu:os.cpus()[0].model,parallelism:os.availableParallelism(),uvThreadpoolSize:process.env.UV_THREADPOOL_SIZE??'default (4)'},
  elapsedMs:performance.now()-start,windows},null,2)+'\n');
