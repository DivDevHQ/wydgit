// Manual, bounded Spike F experiments. Run alone. Existing Contact fixture only.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {setTimeout as pause} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {runContactWindow} from './http-concurrency.js';
import {createFsreqpromiseProbe} from './fsreqpromise-correlation.js';
import {checkLifecycleLock} from '../packages/wydstore/src/lifecycle-lock.js';
import {distribution,summarizeWindow} from './scheduling-attribution.js';
import {Session} from 'node:inspector/promises';

const [mode,argument]=process.argv.slice(2);
if(mode==='--worker'){
  const config=JSON.parse(argument);let result;
  let profiler,profileOffsetMs;
  if(config.cpuProfile){
    profiler=new Session();profiler.connect();await profiler.post('Profiler.enable');
    await profiler.post('Profiler.setSamplingInterval',{interval:1000});
    profileOffsetMs=performance.now()-Number(process.hrtime.bigint())/1e6;
    await profiler.post('Profiler.start');
  }
  if(config.kind==='isolated'){
    // Same local /tmp filesystem and directory depth as Contact's temporary
    // installation. Each absent lifecycle name uniquely joins strace to request.
    const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-spikef-'));
    const root=path.join(scratch,'state','stores');await fs.mkdir(root,{recursive:true});
    const p=createFsreqpromiseProbe({enabled:true,scheduling:true,generation:config.generation});
    try{
      p.beginScheduling();await pause(25); // let the histogram timer arm
      const pending=Array.from({length:config.concurrency},(_,i)=>{
        const observer=p.observe({request:i+1,operation:1});
        return checkLifecycleLock(root,'spikef-'+(i+1),false,{continuation:()=>observer});
      });
      const pressure={startMs:performance.now(),endMs:null,iterations:0};
      // Bounded test child only. The wall-clock ceiling prevents unbounded work.
      if(config.pressureMs)while(performance.now()-pressure.startMs<config.pressureMs)pressure.iterations++;
      pressure.endMs=performance.now();await Promise.all(pending);await pause(25);
      p.finishScheduling();p.stop();result={...config,clock:{timeOriginMs:performance.timeOrigin},pressure,probe:p.snapshot()};
    }finally{p.stop();await fs.rm(scratch,{recursive:true,force:true});}
  }else{
    result=await runContactWindow(config);result.clock={timeOriginMs:performance.timeOrigin};
  }
  result.clock.mainThread=process.pid;
  if(profiler){
    const {profile}=await profiler.post('Profiler.stop');profiler.disconnect();
    const scope=result.resourceCorrelation.scheduling,nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map(),counts=new Map();
    for(const n of profile.nodes)for(const id of n.children??[])parents.set(id,n.id);
    let at=profile.startTime/1000+profileOffsetMs,selected=0;
    for(let i=0;i<profile.samples.length;i++){
      at+=profile.timeDeltas[i]/1000;if(at<scope.startMs||at>scope.endMs)continue;selected++;
      for(let id=profile.samples[i],depth=0;id&&depth<128;id=parents.get(id),depth++){
        const n=nodes.get(id),frame=n.callFrame;
        const relative=frame.url.startsWith('file://'+process.cwd()+'/')?frame.url.slice(('file://'+process.cwd()+'/').length):frame.url.startsWith('node:')?frame.url:'external/native';
        const fn=/^[A-Za-z0-9_$ .()<>-]{0,128}$/.test(frame.functionName)?frame.functionName:'anonymous';
        const key=relative+':'+(frame.lineNumber+1)+' '+fn,row=counts.get(key)??{frame:key,leaf:0,inclusiveOccurrences:0};
        row.inclusiveOccurrences++;if(depth===0)row.leaf++;counts.set(key,row);
      }
    }
    result.cpuProfile={intervalUs:1000,startMs:scope.startMs,endMs:scope.endMs,selectedSamples:selected,
      clock:'V8 profiler monotonic microseconds bridged to performance.now by process.hrtime.bigint; sampling attribution only',
      frames:[...counts.values()].sort((a,b)=>b.inclusiveOccurrences-a.inclusiveOccurrences).slice(0,256)};
  }
  process.stdout.write(JSON.stringify(result)+'\n');
}else if(mode==='--calibration'&&argument){
  const iterations=10000,rows=[];
  async function measure(mode){
    const p=createFsreqpromiseProbe({enabled:mode!=='off',scheduling:mode==='scheduling'});
    try{
      p.beginScheduling();const start=performance.now();
      for(let i=0;i<iterations;i++)await Promise.resolve();
      const elapsedMs=performance.now()-start;p.stop();return {mode,elapsedMs,callbackCount:p.snapshot().scheduling?.callbackCount??null};
    }finally{p.stop();}
  }
  for(let i=0;i<4;i++)for(const mode of ['off','hook','scheduling'])await measure(mode);
  for(let round=1;round<=9;round++)for(const mode of round%2?['off','hook','scheduling']:['scheduling','hook','off'])rows.push({round,...await measure(mode)});
  await fs.writeFile(argument,JSON.stringify({schema:'wydgine.spike-f-calibration/1',node:process.version,iterations,warmups:4,rounds:9,rows,
    limitations:'Promise-only microbenchmark in one isolated process; no Contact/FS cost estimate and no timing pass threshold'},null,2)+'\n',{flag:'wx'});
}else if(['--output','--attribution-output'].includes(mode)&&argument){
  const directory=path.resolve(argument);await fs.mkdir(directory,{recursive:false});
  const started=performance.now(),windows=[],failures=[];let generation=0;
  const sourceFiles=['test-support/scheduling-attribution-probe.mjs','test-support/scheduling-attribution.js','test-support/fsreqpromise-correlation.js','test-support/http-concurrency.js',
    'packages/wydgine/src/engine/execution/page.js','packages/wydgine/src/engine/execution/completion.js','packages/wydgine/src/engine/sewn/budget.js',
    'packages/wydgine/src/engine/execution/form-clear-edit.js','packages/wydstore/src/sqlite-adapter.js','packages/wydstore/src/local-root.js','packages/wydstore/src/lifecycle-lock.js'];
  const hashes=Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,createHash('sha256').update(await fs.readFile(name)).digest('hex')])));
  const environment={node:process.version,platform:process.platform,arch:process.arch,kernel:os.release(),availableParallelism:os.availableParallelism(),
    cpuModel:os.cpus()[0].model,uvThreadpoolSize:process.env.UV_THREADPOOL_SIZE??'default (4)',tmpFilesystem:await fs.statfs(os.tmpdir()).then(row=>({type:row.type,bsize:row.bsize})),
    topology:'fresh server worker per window; supervised separate HTTP client; serial windows; no other test suite',
    instrumentation:'existing HTTP diagnostics + FSREQPROMISE/native-gap/Clear; scheduling adds 10ms monitorEventLoopDelay, ELU snapshots and >=0.5ms callback spans',
    bounds:{workerMs:45000,totalMs:720000,stdoutBytes:8*1024*1024,traceBytes:24*1024*1024},hashes};
  const write=(name,value)=>fs.writeFile(path.join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  async function run(label,config,{trace=false,pool}={}){
    if(performance.now()-started>720000)throw Error('Series bound');
    config={...config,generation:++generation};
    const name=String(generation).padStart(2,'0')+'-'+label;
    const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-spikef-worker-'));
    // Match the established supervisor's exclusive TMPDIR and root depth. Parent
    // cleanup also contains a killed worker's exclusively owned installation.
    const traceFile=path.join(scratch,'trace');
    try{
      const args=[fileURLToPath(import.meta.url),'--worker',JSON.stringify(config)];
      const env={...process.env,TMPDIR:scratch};delete env.NODE_OPTIONS;delete env.NODE_PATH;
      if(pool)env.UV_THREADPOOL_SIZE=String(pool);
      const value=await new Promise(resolve=>{
        const child=spawn(trace?'strace':process.execPath,trace?['-f','-qq','-ttt','-T','-s','4096','-e','trace=statx,newfstatat','-o',traceFile,process.execPath,...args]:args,{env,stdio:['ignore','pipe','pipe']});
        let output='',stderrBytes=0,reason=null,kill;
        const stop=()=>{child.kill('SIGTERM');kill??=setTimeout(()=>child.kill('SIGKILL'),2000);};
        const timer=setTimeout(()=>{reason='timeout';stop();},45000);
        child.stdout.on('data',chunk=>{if(output.length+chunk.length>8*1024*1024){reason='output-bound';stop();}else output+=chunk;});
        child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;});
        child.on('error',()=>{reason='spawn';});
        child.on('close',code=>{clearTimeout(timer);clearTimeout(kill);try{if(code||reason)throw Error();resolve(JSON.parse(output));}catch{resolve({workerFailure:reason??'exit-or-protocol',stderrBytes});}});
      });
      if(trace&&!value.workerFailure){
        const stat=await fs.stat(traceFile);if(stat.size>24*1024*1024)throw Error('Trace bound');
        const text=await fs.readFile(traceFile,'utf8'),probe=value.probe??value.resourceCorrelation;
        const lo=probe.scheduling.startMs,hi=probe.scheduling.endMs;
        // strace's -T syscall duration is a separate elapsed observation. The
        // external realtime timestamp is bridged by Node's timeOrigin only for
        // ordering (approximate); no nearest-timestamp request joins are made.
        const syscalls=[],pending=new Map();let unmatched=0;
        for(let line of text.split('\n')){
          const unfinished=/^(\d+)\s+.*<unfinished \.\.\.>$/.exec(line);
          if(unfinished){pending.set(unfinished[1],line.replace(/<unfinished \.\.\.>$/,''));continue;}
          const resumed=/^(\d+)\s+\d+\.\d+ <\.\.\. (?:statx|newfstatat) resumed>(.*)$/.exec(line);
          if(resumed){const prefix=pending.get(resumed[1]);pending.delete(resumed[1]);if(!prefix){unmatched++;continue;}line=prefix+resumed[2];}
          const match=/^(\d+)\s+(\d+\.\d+) (statx|newfstatat)\(.*?"([^"]+)".*?= (.*?) <([\d.]+)>$/.exec(line);
          if(!match){if(line.includes('<unfinished')||line.includes('resumed>'))unmatched++;continue;}
          const startMs=Number(match[2])*1000-value.clock.timeOriginMs;
          if(startMs<lo||startMs>hi)continue;
          const identity=/\/spikef-(\d+)\.lifecycle$/.exec(match[4]);
          const guardFiles=['installed-packages.json','wydgit.config.json','.package-install.lock','.package-recovery.lock','.package-infrastructure.json','package-effects.json','package-operation.json'];
          const basename=path.basename(match[4]),guardFile=guardFiles.includes(basename)?basename:null;
          const kind=identity?'isolatedLifecycle':/\.lifecycle$/.test(match[4])?'contactLifecycle':/\.sqlite(?:-journal|-wal|-shm)?$/.test(match[4])?'sqliteMetadata':guardFile?'installationGuardMetadata':'otherMetadata';
          syscalls.push({thread:Number(match[1]),syscall:match[3],kind,guardFile,request:identity?Number(identity[1]):null,startMs,durationMs:Number(match[6])*1000,
            result:match[5].startsWith('-1 ENOENT')?'ENOENT':match[5]==='0'?'ok':'other'});
        }
        unmatched+=pending.size;
        value.syscallTrace={bytes:stat.size,unmatchedSplitLines:unmatched,clock:'external realtime start bridged via performance.timeOrigin; approximate order only; -T elapsed syscall duration',syscalls};
      }
      await write(name+'.json',value);
      const summary=value.workerFailure?value:config.kind==='isolated'?{
        initToBeforeMs:distribution(value.probe.calls.map(row=>row.resources[0].firstBeforeMs-row.resources[0].initMs)),
        afterToRecoveryMs:distribution(value.probe.calls.map(row=>row.recoveryMs-row.resources[0].lastAfterMs)),
        scheduling:{...value.probe.scheduling,spans:undefined},pressure:value.pressure}:summarizeWindow(value);
      windows.push({file:name+'.json',label,config,trace,pool:pool??4,summary});
      const probe=value.probe??value.resourceCorrelation;
      if(value.workerFailure||value.fixtureFailure||value.cleanupComplete===false||probe&&(probe.hookErrors||probe.droppedCalls||probe.droppedResources||probe.scheduling?.droppedSpans||probe.scheduling?.stackOverflow||probe.calls.some(row=>row.correlation!=='lifecycle-single-resource'&&row.correlation!=='inspection-single-resource')))
        failures.push({file:name+'.json',reason:value.workerFailure??value.fixtureFailure??'incomplete-capture'});
      console.log(JSON.stringify({file:name+'.json',http200:summary.http200,http500:summary.http500,isolatedMaxMs:summary.initToBeforeMs?.max,failures:failures.length}));
      await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({environment,windows,failures,complete:false},null,2)+'\n');
    }finally{await fs.rm(scratch,{recursive:true,force:true});}
  }
  const base={provider:'SQLite',concurrency:12,diagnosticsEnabled:true,clientPlacement:'separate',resourceCorrelation:true,inspectionCorrelation:true,nativeGap:true,formClear:true};
  if(mode==='--attribution-output'){
    for(let r=1;r<=3;r++){
      await run('classified-trace-'+r,{...base,scheduling:true},{trace:true});
      await run('cpu-profile-'+r,{...base,scheduling:true,cpuProfile:true});
    }
  }else{
  // Alternate old/new instrumentation; preserve all windows, including failures.
  for(let r=1;r<=3;r++){
    await run('serial-'+r,{...base,concurrency:1,scheduling:true});
    for(const scheduling of r%2?[false,true]:[true,false])await run((scheduling?'scheduled-':'baseline-')+r,{...base,scheduling});
    await run('observer-off-'+r,{provider:'SQLite',concurrency:12,diagnosticsEnabled:false,clientPlacement:'separate'});
    await run('json-'+r,{...base,provider:'JSON',scheduling:true});
  }
  for(let r=1;r<=3;r++){
    for(const concurrency of [1,12])await run('isolated-'+concurrency+'-'+r,{kind:'isolated',concurrency,scheduling:true});
    await run('pressure-'+r,{kind:'isolated',concurrency:12,scheduling:true,pressureMs:120},{trace:true});
    await run('contact-trace-'+r,{...base,scheduling:true},{trace:true});
    await run('pool16-'+r,{...base,scheduling:true},{pool:16});
  }
  }
  await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({environment,windows,failures,complete:true,elapsedMs:performance.now()-started},null,2)+'\n');
  if(failures.length)process.exitCode=1;
}else throw Error('Usage: node test-support/scheduling-attribution-probe.mjs --output NEW_DIRECTORY');
