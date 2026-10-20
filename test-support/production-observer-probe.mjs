// Manual Spike J supervisor. Sequential fresh workers, fixed counts, no retries.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {distribution} from './scheduling-attribution.js';

export const observerModes=Object.freeze({
  off:{diagnosticsEnabled:false},
  minimal:{diagnosticsEnabled:true},
  loop:{diagnosticsEnabled:true,scheduling:true},
  filesystem:{diagnosticsEnabled:true,resourceCorrelation:true,inspectionCorrelation:true},
  canonical:{diagnosticsEnabled:true,synchronousAttribution:true,attributionCategory:'canonical'},
  guard:{diagnosticsEnabled:true,synchronousAttribution:true,attributionCategory:'guard'},
  extended:{diagnosticsEnabled:true,resourceCorrelation:true,inspectionCorrelation:true,nativeGap:true,formClear:true,scheduling:true,synchronousAttribution:true}
});

export function summarizeProductionWindow(value){
  const traces=value.traces.map(t=>t.record),p=value.resourceCorrelation;
  const captures=value.synchronousAttribution?.filter(c=>c.request>0)??[];
  const spans=captures.flatMap(c=>c.spans),files=(p?.calls??[]).filter(c=>c.request>0&&c.correlation.endsWith('-single-resource'));
  return {
    http200:value.requests.filter(r=>r.client.complete&&r.client.status===200).length,
    http500:value.requests.filter(r=>r.client.complete&&r.client.status===500).length,
    indeterminate:value.requests.filter(r=>r.classification.writeOutcome==='indeterminate').length,
    unexpected:value.requests.filter(r=>!r.client.complete||![200,500].includes(r.client.status)).length,
    reportedCommits:traces.length?traces.reduce((n,t)=>n+t.services.commitReported,0):null,
    completedNative:traces.length?traces.reduce((n,t)=>n+t.services.nativeStarted-t.services.pending,0):null,
    exhausted:traces.length?traces.filter(t=>t.meter?.exhaustion?.resource==='timeMs').length:null,
    reconciledRecords:value.reconciliation?.records??null,
    responseMs:distribution(value.requests.map(r=>r.client.end-r.client.start)),
    pageMs:distribution(traces.map(t=>t.meter?.elapsedMs)),
    callbackDeliveryMs:distribution(files.map(c=>c.resources[0].firstBeforeMs-c.resources[0].initMs)),
    guardChecks:captures.some(c=>Object.hasOwn(c.counts,'guardChecks'))?captures.reduce((n,c)=>n+(c.counts.guardChecks??0),0):null,
    synchronousStages:Object.fromEntries([...new Set(spans.map(s=>s.stage))].map(stage=>[stage,{
      calls:spans.filter(s=>s.stage===stage).reduce((n,s)=>n+s.calls,0),
      inclusiveMs:spans.filter(s=>s.stage===stage).reduce((n,s)=>n+s.inclusiveMs,0),
      exclusiveMs:spans.filter(s=>s.stage===stage).reduce((n,s)=>n+s.exclusiveMs,0)}])),
    scheduling:p?.scheduling?{...p.scheduling,spans:undefined}:null,
    records:{http:traces.length,fsCalls:p?.calls.length??0,resources:p?.seen??0,callbackSpans:p?.scheduling?.spans.length??0,
      synchronousSpans:spans.length,metadataRows:captures.reduce((n,c)=>n+c.metadata.length,0)},
    observerErrors:p?.hookErrors??0,dropped:(p?.droppedCalls??0)+(p?.droppedResources??0)+(p?.scheduling?.droppedSpans??0),
    fixtureFailure:value.fixtureFailure,cleanupComplete:value.cleanupComplete,actualConcurrency:value.actualConcurrency
  };
}

const [mode,directory,series='baseline']=process.argv.slice(2);
if(mode==='--output'){
  if(!directory||!['baseline','repeat','serial'].includes(series))throw Error('Usage: --output NEW_DIRECTORY [baseline|repeat|serial]');
  await fs.mkdir(directory,{recursive:false});
  const start=performance.now(),windows=[];
  async function run(label,provider,observer,round){
    if(performance.now()-start>600000)throw Error('Series ceiling');
    const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-spikej-'));
    const config={provider,concurrency:series==='serial'?1:12,clientPlacement:'separate',reconcile:true,...observerModes[observer],generation:windows.length+1};
    let output='',stderr='';
    try{
      const env={...process.env,TMPDIR:scratch};delete env.NODE_OPTIONS;delete env.NODE_PATH;
      const status=await new Promise(resolve=>{
        const child=spawn(process.execPath,[fileURLToPath(new URL('./production-observer-worker.mjs',import.meta.url)),JSON.stringify(config)],{env,stdio:['ignore','pipe','pipe']});
        let reason=null,kill;
        const stop=()=>{child.kill('SIGTERM');kill??=setTimeout(()=>child.kill('SIGKILL'),2000);};
        const timer=setTimeout(()=>{reason='timeout';stop();},45000);
        child.stdout.on('data',c=>{if(output.length+c.length>16*1024*1024){reason='output-bound';stop();}else output+=c;});
        child.stderr.on('data',c=>{if(stderr.length<65536)stderr+=c;});
        child.once('error',()=>{reason='spawn';});
        child.once('close',(code,signal)=>{clearTimeout(timer);clearTimeout(kill);resolve({code,signal,reason});});
      });
      let value;try{value=JSON.parse(output);}catch{value=null;}
      const file=String(windows.length+1).padStart(2,'0')+'-'+label+'.json';
      const row={label,provider,observer,round,config,status,stderrBytes:stderr.length,file,
        summary:value?summarizeProductionWindow(value):null};
      await fs.writeFile(path.join(directory,file),JSON.stringify({status,value,stderr},null,2)+'\n',{flag:'wx'});
      windows.push(row);
      await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({series,complete:false,windows},null,2)+'\n');
      console.log(JSON.stringify({label,status,http200:row.summary?.http200,http500:row.summary?.http500,reconciled:row.summary?.reconciledRecords,failure:row.summary?.fixtureFailure}));
      if(status.code!==0||status.reason||!value||value.fixtureFailure||!value.cleanupComplete)throw Error('Worker/fixture failure; preserve sample and stop');
    }finally{await fs.rm(scratch,{recursive:true,force:true});}
  }
  if(series==='serial'){
    for(let round=1;round<=3;round++){
      const modes=Object.keys(observerModes);if(round%2===0)modes.reverse();
      for(const observer of modes)await run('serial-'+observer+'-'+round,'SQLite',observer,round);
    }
  }else{
  // Production baseline first, not a search for a clean series.
  for(let round=1;round<=10;round++)await run('sqlite-off-'+round,'SQLite','off',round);
  for(let round=1;round<=3;round++)await run('json-off-'+round,'JSON','off',round);
  for(let round=1;round<=3;round++){
    const modes=Object.keys(observerModes);if(round%2===0)modes.reverse();
    for(const observer of modes)await run('sqlite-'+observer+'-'+round,'SQLite',observer,round);
    await run('json-extended-'+round,'JSON','extended',round);
  }
  }
  await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({schema:'wydgine.production-observer-series/1',series,complete:true,
    environment:{node:process.version,kernel:os.release(),cpu:os.cpus()[0].model,parallelism:os.availableParallelism(),uvThreadpoolSize:process.env.UV_THREADPOOL_SIZE??'default (4)',
      tmpFilesystem:await fs.statfs(os.tmpdir()).then(s=>({type:s.type,bsize:s.bsize})),bounds:{workerMs:45000,seriesMs:600000,stdoutBytes:16*1024*1024}},
    elapsedMs:performance.now()-start,windows},null,2)+'\n');
}
