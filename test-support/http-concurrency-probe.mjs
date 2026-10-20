// Run alone: node test-support/http-concurrency-probe.mjs --output /tmp/contact-alpha26
// Each window has a fresh process, installation, anonymous session and empty data.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {LEVELS,CONTROLS,runContactWindow} from './http-concurrency.js';

if(process.argv[2]==='--worker') {
  const result=await runContactWindow(JSON.parse(process.argv[3]));
  process.stdout.write(JSON.stringify(result)+'\n');
}else {
  const args=process.argv.slice(2);
  const isolation=args[2]==='--process-isolation';
  const counter=args[2]==='--admission-control',native=args[2]==='--provider-control',observer=args[2]==='--observer-control';
  if(![2,3].includes(args.length)||args[0]!=='--output'||args.length===3&&!counter&&!native&&!observer&&!isolation)throw Error('Usage: node test-support/http-concurrency-probe.mjs --output NEW_DIRECTORY [--admission-control|--provider-control|--observer-control|--process-isolation]');
  const directory=path.resolve(args[1]);
  // Refuse reuse: earlier failures cannot be overwritten by a passing rerun.
  await fs.mkdir(directory,{recursive:false});
  const digest=async roots=>{
    const hash=createHash('sha256');
    const visit=async file=>{const stat=await fs.stat(file);if(stat.isDirectory())for(const name of (await fs.readdir(file)).sort())await visit(path.join(file,name));
      else{const bytes=await fs.readFile(file);hash.update(file+'\0'+bytes.length+'\0');hash.update(bytes);}};
    for(const root of roots)await visit(root);return hash.digest('hex');
  };
  const fingerprints={fixture:await digest(['content','prototypes','examples/guestbook','wydgit.config.json']),
    implementation:await digest(['packages/wydgine/src','packages/wydstore/src'])};
  const versions={};for(const [name,file]of Object.entries({platform:'package.json',wydgine:'packages/wydgine/package.json',store:'packages/wydstore/package.json'}))versions[name]=JSON.parse(await fs.readFile(file)).version;
  const windows=[],failures=[],started=Date.now();let firstMatch=false;
  const summary={schema:'wydgine.http-concurrency-series/1',node:process.version,platform:process.platform,
    fingerprints,versions,
    configuration:{providers:isolation?['SQLite']:['JSON','SQLite'],levels:isolation?[12,8]:LEVELS,repetitions:3,controlConcurrency:observer?12:4,controlOrder:CONTROLS,
      maxWindows:isolation?14:native?6:counter||observer?8:38,maxPosts:isolation?160:native?0:counter||observer?96:194,maxSetupGets:isolation?14:native?6:counter||observer?8:38,
      maxNativeSequences:native?72:0,windowTimeoutMs:45000,totalTimeoutMs:12*60*1000,
      pageLedgerMs:1000,ledgerClock:'Date.now',diagnosticClock:'performance.now',samplerIntervalMs:50,
      topology:isolation?'one fresh server worker per window; shared or supervised separate client; one window at a time':'one fresh worker process per window; client and server share worker; one window at a time',
      processIsolation:isolation?{order:['A1','B1','A2','B2'],placements:['shared','separate','shared','separate'],repetitions:3,primaryConcurrency:12,secondaryConcurrency:8,clientStartupMs:5000,clientExecutionMs:25000}:null,
      transport:'Node HTTP/1.1 loopback, agent keepAlive=false (no forced Connection header), maxSockets=12, maxHeaderSize=8192, maxHeadersCount=64, requestTimeout=120000, headersTimeout=15000',
      requestTimeoutMs:10000,fixture:'interactive Contact guestbook install; fresh empty dataset per window; no retries',
      session:'one anonymous session from one setup GET per window; Gate disabled',
      barrier:'all clients prepared before burst release; no barrier inside Page or service execution',
      admissionControl:counter?{concurrency:12,spacingOrderMs:[0,20,20,0],placement:'client wait before HTTP request; never charged to Page ledger'}:null,
      providerControl:native?'12 concurrent canonical create/query sequences with installed package authority and 1000ms ledgers; Page adaptation omitted; no POST or client receipt claim':null,
      observerControl:observer?{concurrency:12,enabledOrder:CONTROLS}:null,
      externalNetwork:false,otherSuitesRunning:false},windows,failures};
  const write=async(name,value)=>fs.writeFile(path.join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  let activeChild,cancelled=false;
  const cancel=()=>{cancelled=true;activeChild?.kill('SIGTERM');};
  process.on('SIGTERM',cancel);process.on('SIGINT',cancel);
  const run=async configuration=>{
    if(cancelled)throw Error('Cancelled');
    if(Date.now()-started>summary.configuration.totalTimeoutMs)throw Error('Total experiment bound reached');
    const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-concurrency-worker-'));
    let result;
    try {
      result=await new Promise(resolve=>{
        const environment={...process.env,TMPDIR:scratch};delete environment.NODE_OPTIONS;delete environment.NODE_PATH;
        const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--worker',JSON.stringify(configuration)],
          {stdio:['ignore','pipe','pipe'],env:environment});
        activeChild=child;
        let output='',stderrBytes=0,timedOut=false,overflow=false,killTimer;
        const stop=()=>{child.kill('SIGTERM');killTimer??=setTimeout(()=>child.kill('SIGKILL'),3000);};
        const timer=setTimeout(()=>{timedOut=true;stop();},Math.min(45000,summary.configuration.totalTimeoutMs-(Date.now()-started)));
        child.stdout.on('data',chunk=>{if(output.length+chunk.length>512*1024){overflow=true;stop();}else output+=chunk;});
        child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;});
        child.once('error',()=>{clearTimeout(timer);resolve({configuration,workerFailure:'spawn',stderrBytes});});
        child.once('close',code=>{
          activeChild=null;clearTimeout(timer);clearTimeout(killTimer);
          try{if(code!==0||timedOut||overflow||cancelled)throw Error();resolve(JSON.parse(output));}
          catch{resolve({configuration,workerFailure:timedOut?'timeout':overflow?'output-bound':'exit-or-protocol',stderrBytes,
            clientOutcome:'unknown',traceCaptureIncomplete:true});}
        });
      });
    }finally{await fs.rm(scratch,{recursive:true,force:true});}
    const name=String(windows.length+1).padStart(2,'0')+'-'+configuration.provider.toLowerCase()+'-'+configuration.series+'-'+configuration.concurrency+'-'+configuration.repetition+'.json';
    await write(name,result);windows.push({file:name,...configuration});
    if(result.workerFailure||result.fixtureFailure)failures.push({file:name,type:result.workerFailure??result.fixtureFailure});
    const matching=result.traces?.filter(value=>value.matchingHistoricalSignature)??[];
    if(!firstMatch&&matching.length){await write('first-matching-trace.json',{configuration,window:name,trace:matching[0]});firstMatch=true;}
    console.log(JSON.stringify({file:name,actualConcurrency:result.actualConcurrency??null,
      completed:result.requests?.filter(value=>value.classification.completion==='completed').length??0,
      requests:result.requests?.length??0,deadlineExhaustions:configuration.diagnosticsEnabled?result.traces?.filter(({record})=>record.meter?.exhaustion?.resource==='timeMs').length??null:null,
      nativeSequences:result.nativeRequests?.length??0,
      matching:matching.length,fixtureFailure:result.fixtureFailure??result.workerFailure??null}));
    // Write a checkpoint without replacing any per-window evidence.
    await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');
    if(isolation&&(result.workerFailure||result.fixtureFailure||!result.cleanupComplete||result.requests?.length!==configuration.concurrency||!result.nativeStageTiming||['client','server','admitted','pageLedger'].some(key=>result.actualConcurrency?.[key]!==configuration.concurrency)))throw Error('Invalid isolation window');
  };
  try {
    for(const provider of summary.configuration.providers){
      if(isolation){
        for(const [index,clientPlacement]of ['shared','separate','shared','separate'].entries())
          for(let repetition=1;repetition<=3;repetition++)await run({provider,concurrency:12,repetition,series:['A1','B1','A2','B2'][index],clientPlacement,diagnosticsEnabled:true});
        for(const clientPlacement of ['shared','separate'])await run({provider,concurrency:8,repetition:1,series:'secondary-'+clientPlacement,clientPlacement,diagnosticsEnabled:true});
      }else if(native){
        for(let repetition=1;repetition<=3;repetition++)await run({provider,concurrency:12,repetition,series:'provider-control',diagnosticsEnabled:true,workload:'native-services'});
      }else if(observer){
        for(const [index,diagnosticsEnabled]of CONTROLS.entries())await run({provider,concurrency:12,repetition:index+1,series:'observer-control',diagnosticsEnabled});
      }else if(counter){
        for(const [index,admissionSpacingMs]of [0,20,20,0].entries())await run({provider,concurrency:12,repetition:index+1,series:'admission-control',diagnosticsEnabled:true,admissionSpacingMs});
      }else{
        for(const concurrency of LEVELS)for(let repetition=1;repetition<=3;repetition++)await run({provider,concurrency,repetition,series:'ladder',diagnosticsEnabled:true});
        for(let index=0;index<CONTROLS.length;index++)await run({provider,concurrency:4,repetition:index+1,series:'observer-control',diagnosticsEnabled:CONTROLS[index]});
      }
    }
  }catch{failures.push({type:'series-incomplete'});}
  process.off('SIGTERM',cancel);process.off('SIGINT',cancel);
  summary.complete=windows.length===summary.configuration.maxWindows;
  summary.elapsedMs=Date.now()-started;summary.matchingHistoricalSignatureCaptured=firstMatch;
  await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  if(!summary.complete||failures.length)process.exitCode=1;
}
