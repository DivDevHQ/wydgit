// Fixed Spike L matrix. Fresh workers, separate clients, no retry/search loop.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {summarizeProductionWindow} from './production-observer-probe.mjs';
const [directory]=process.argv.slice(2);if(!directory)throw Error('Usage: native-scheduling-probe.mjs NEW_DIRECTORY');
await fs.mkdir(directory,{recursive:false});
const started=performance.now(),windows=[];
const configs=[['SQLite',1],['SQLite',4],['SQLite',8],['SQLite',12],['JSON',12]],matrix=[];
for(let round=1;round<=3;round++)for(const [provider,concurrency]of configs)
  for(const mode of round%2?['off','timing']:['timing','off'])matrix.push({provider,concurrency,mode,round});
for(let round=1;round<=10;round++)matrix.push({provider:'SQLite',concurrency:12,mode:'off-tail',round});
for(let round=1;round<=3;round++)for(const [provider,concurrency]of [['SQLite',1],['SQLite',12],['JSON',12]])
  for(const mode of round%2?['costs','promise']:['promise','costs'])matrix.push({provider,concurrency,mode,round});
for(let round=1;round<=3;round++)matrix.push({provider:'SQLite',concurrency:12,mode:'callbacks',round});
for(const item of matrix){
  if(performance.now()-started>600000)throw Error('Series bound');
  const off=item.mode.startsWith('off');
  const config={provider:item.provider,concurrency:item.concurrency,clientPlacement:'separate',reconcile:true,diagnosticsEnabled:!off,
    ...(!off?{deadlineLedger:true,nativeScheduling:true,scheduling:true}:{}),nativeCosts:item.mode==='costs',promiseObservation:item.mode==='promise',
    ...(item.mode==='callbacks'?{resourceCorrelation:true,inspectionCorrelation:true,nativeGap:true}:{}),generation:windows.length+1};
  const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-spikel-'));let output='',stderr='';
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
    const file=String(windows.length+1).padStart(2,'0')+'-'+item.provider+'-'+item.concurrency+'-'+item.mode+'-'+item.round+'.json';
    const row={...item,config,status,file,summary:value?summarizeProductionWindow(value):null};
    await fs.writeFile(path.join(directory,file),JSON.stringify({status,value,stderr})+'\n',{flag:'wx'});windows.push(row);
    await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({complete:false,windows},null,2)+'\n');
    console.log(JSON.stringify({file,status,http200:row.summary?.http200,http500:row.summary?.http500,reconciled:row.summary?.reconciledRecords,failure:value?.fixtureFailure}));
    if(status.code!==0||status.reason||!value||value.fixtureFailure||!value.cleanupComplete||!value.reconciliation?.complete)throw Error('Worker failed; preserve and stop');
  }finally{await fs.rm(scratch,{recursive:true,force:true});}
}
await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({schema:'wydgine.native-scheduling-series/1',complete:true,
  baseline:'9ddea3bc12cb1f3da0fdd3a27f0b8460d6fc5ea1',runtimeCorrection:false,
  environment:{node:process.version,kernel:os.release(),cpu:os.cpus()[0].model,parallelism:os.availableParallelism(),uvThreadpoolSize:process.env.UV_THREADPOOL_SIZE??'default (4)'},
  elapsedMs:performance.now()-started,windows},null,2)+'\n');
