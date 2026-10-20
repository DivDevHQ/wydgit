// Manual bounded Spike G matrix. Run alone, with local TCP permission.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {distribution,summarizeWindow} from './scheduling-attribution.js';
const [mode,argument]=process.argv.slice(2);
if(mode==='--worker'){
  const config=JSON.parse(argument);
  if(config.synchronousAttribution){const {installAttributionHooks}=await import('./prerender-integrity-hooks.mjs');installAttributionHooks({incrementalValidation:config.incrementalValidation===true});}
  const {runContactWindow}=await import('./http-concurrency.js');
  const value=await runContactWindow(config);
  value.clock={timeOriginMs:performance.timeOrigin,mainThread:process.pid};
  process.stdout.write(JSON.stringify(value)+'\n');
}else if(mode==='--micro-worker'){
  const {installAttributionHooks}=await import('./prerender-integrity-hooks.mjs');installAttributionHooks({incrementalValidation:JSON.parse(argument).incrementalValidation===true});
  const {createSynchronousAttribution}=await import('./prerender-integrity-attribution.js');
  const {clearFixture}=await import('./form-clear.js');
  const {dehydrate}=await import('../wydgine/object-model/index.js');
  const cases=[];
  for(const fields of [2,8,24,64])for(const mutations of [1,4,16])for(const changed of [false,true]){
    const f=clearFixture({count:fields}),raw=dehydrate(f.model.runtime);let treeNodes=0;
    const visit=n=>{treeNodes++;Object.values(n.slots).flat().forEach(visit);};visit(raw);
    const rows=[];
    function run(observed,round){
      const capture=observed?createSynchronousAttribution():null;
      const work=()=>{const edit=f.model.runtime.edit(f.context);for(let i=0;i<mutations;i++)edit.setProperty('field'+i%fields,'label',changed?'Changed '+i:'Field '+i%fields);return edit.commit();};
      const start=performance.now(),next=capture?capture.run(work):work(),elapsedMs=performance.now()-start;
      if(next.runtime.get('field0').id!=='field0'||next.revision!==f.model.runtime.revision+1)throw Error('Mutation identity');
      return {round,observed,elapsedMs,modifiedObjects:next.changes.modified.length,...(capture?{attribution:capture.finish()}:{})};
    }
    for(let i=0;i<4;i++){run(false,0);run(true,0);}
    for(let round=1;round<=9;round++)for(const observed of round%2?[false,true]:[true,false])rows.push(run(observed,round));
    cases.push({fields,treeNodes,mutations,changed,changedProperties:changed?mutations:0,unchangedProperties:changed?0:mutations,warmups:4,rows});
  }
  const installed=await installedExperiment(createSynchronousAttribution);
  process.stdout.write(JSON.stringify({schema:'wydgine.spike-g-micro/1',cases,installed})+'\n');
}else if(['--output','--trace-output','--incremental-output'].includes(mode)&&argument){
  const directory=path.resolve(argument);await fs.mkdir(directory,{recursive:false});const started=performance.now();
  const sources=['packages/wydgine/src/engine/execution/canonical-edit.js','test-support/prerender-integrity-probe.mjs','test-support/prerender-integrity-hooks.mjs','test-support/prerender-integrity-attribution.js','test-support/http-concurrency.js',
    'packages/wydgine/src/engine/execution/page.js','packages/wydgine/src/engine/object-model/index.js','packages/wydgine/src/engine/object-model/mutation.js',
    'packages/wydgine/src/engine/object-model/construction.js','packages/wydgine/src/engine/packages/index.js','packages/wydgine/src/engine/packages/state.js',
    'packages/wydgine/src/engine/packages/installation-stamp.js','packages/wydgine/src/engine/seam/context.js','packages/wydgine/src/engine/execution/diagnostics.js',
    'packages/wydgine/src/engine/execution/progress.js','packages/wydgine/src/engine/repository.js'];
  const sourceTexts=Object.fromEntries(await Promise.all(sources.map(async name=>[name,await fs.readFile(name,'utf8')])));
  const hashes=Object.fromEntries(sources.map(name=>[name,createHash('sha256').update(sourceTexts[name]).digest('hex')]));
  await fs.writeFile(path.join(directory,'sources.json'),JSON.stringify(sourceTexts,null,2)+'\n',{flag:'wx'});
  const windows=[],failures=[];let generation=0;
  async function run(label,config,micro=false){
    if(performance.now()-started>360000)throw Error('Spike G series ceiling');
    config={...config,generation:++generation,...(mode==='--incremental-output'?{incrementalValidation:true}:{})};const name=String(generation).padStart(2,'0')+'-'+label+'.json';
    const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-spikeg-worker-'));
    try{
      const env={...process.env,TMPDIR:scratch};delete env.NODE_OPTIONS;delete env.NODE_PATH;
      const value=await new Promise(resolve=>{
        const args=[fileURLToPath(import.meta.url),micro?'--micro-worker':'--worker',JSON.stringify(config)];
        const child=spawn(mode==='--trace-output'?'strace':process.execPath,mode==='--trace-output'?['-f','-qq','-ttt','-T','-s','4096','-e','trace=statx,newfstatat','-o',path.join(scratch,'trace'),process.execPath,...args]:args,{env,stdio:['ignore','pipe','pipe']});
        let output='',stderrBytes=0,reason=null,kill;
        const stop=()=>{child.kill('SIGTERM');kill??=setTimeout(()=>child.kill('SIGKILL'),2000);};
        const timer=setTimeout(()=>{reason='timeout';stop();},45000);
        child.stdout.on('data',chunk=>{if(output.length+chunk.length>16*1024*1024){reason='output-bound';stop();}else output+=chunk;});
        child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;});
        child.on('error',()=>{reason='spawn';});
        child.on('close',code=>{clearTimeout(timer);clearTimeout(kill);try{if(code||reason)throw Error();resolve(JSON.parse(output));}catch{resolve({workerFailure:reason??'exit-or-protocol',stderrBytes});}});
      });
      if(mode==='--trace-output'&&!value.workerFailure){
        const stat=await fs.stat(path.join(scratch,'trace'));if(stat.size>24*1024*1024)throw Error('Trace bound');
        value.syscalls=parseTrace(await fs.readFile(path.join(scratch,'trace'),'utf8'),value);value.syscalls.bytes=stat.size;
      }
      await fs.writeFile(path.join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
      const summary=value.workerFailure?value:micro?{cases:value.cases.length,installedCases:value.installed.length}:summarizeWindow(value);
      if(value.syscalls)summary.syscalls=value.syscalls;
      if(value.synchronousAttribution){
        const post=value.synchronousAttribution.filter(row=>row.request>0);
        summary.synchronous=attributeSummary(post);
      }
      windows.push({file:name,label,config,summary});
      if(value.workerFailure||value.fixtureFailure||value.cleanupComplete===false||Array.isArray(value.synchronousAttribution)&&value.synchronousAttribution.some(row=>row.stackOverflow||row.droppedArtifacts))failures.push(name);
      console.log(JSON.stringify({file:name,http200:summary.http200,http500:summary.http500,failures:failures.length}));
      await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({schema:'wydgine.spike-g-series/1',hashes,windows,failures,complete:false},null,2)+'\n');
    }finally{await fs.rm(scratch,{recursive:true,force:true});}
  }
  const base={provider:'SQLite',concurrency:12,diagnosticsEnabled:true,clientPlacement:'separate',resourceCorrelation:true,inspectionCorrelation:true,nativeGap:true,formClear:true,scheduling:true};
  if(mode==='--trace-output'){
    for(let round=1;round<=3;round++)await run('trace-'+round,{...base,synchronousAttribution:true});
  }else{
  for(let round=1;round<=3;round++){
    for(const enabled of round%2?[false,true]:[true,false])await run((enabled?'serial-attributed-':'serial-existing-')+round,{...base,concurrency:1,synchronousAttribution:enabled});
    for(const enabled of round%2?[false,true]:[true,false])await run((enabled?'attributed-':'existing-')+round,{...base,synchronousAttribution:enabled});
    await run('observer-off-'+round,{provider:'SQLite',concurrency:12,diagnosticsEnabled:false,clientPlacement:'separate'});
    await run('json-'+round,{...base,provider:'JSON',synchronousAttribution:true});
  }
  await run('micro',{},true);
  }
  for(const name of sources)if(createHash('sha256').update(await fs.readFile(name)).digest('hex')!==hashes[name])throw Error('Source changed during capture');
  await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({schema:'wydgine.spike-g-series/1',environment:{node:process.version,kernel:os.release(),cpu:os.cpus()[0].model,parallelism:os.availableParallelism(),
    uvThreadpoolSize:process.env.UV_THREADPOOL_SIZE??'default (4)',tmpFilesystem:await fs.statfs(os.tmpdir()).then(s=>({type:s.type,bsize:s.bsize})),bounds:{workerMs:45000,seriesMs:360000,stdoutBytes:16*1024*1024}},hashes,windows,failures,complete:true,elapsedMs:performance.now()-started},null,2)+'\n');
  if(failures.length)process.exitCode=1;
}else throw Error('Usage: node test-support/prerender-integrity-probe.mjs --output NEW_DIRECTORY');

function parseTrace(text,value){
  const pending=new Map(),groups=new Map();let unmatched=0;
  const scope=value.resourceCorrelation.scheduling;
  for(let line of text.split('\n')){
    const unfinished=/^(\d+)\s+.*<unfinished \.\.\.>$/.exec(line);
    if(unfinished){pending.set(unfinished[1],line.replace(/<unfinished \.\.\.>$/,''));continue;}
    const resumed=/^(\d+)\s+\d+\.\d+ <\.\.\. (?:statx|newfstatat) resumed>(.*)$/.exec(line);
    if(resumed){const prefix=pending.get(resumed[1]);pending.delete(resumed[1]);if(!prefix){unmatched++;continue;}line=prefix+resumed[2];}
    const m=/^(\d+)\s+(\d+\.\d+) (statx|newfstatat)\(.*?"([^"]+)".*?= (.*?) <([\d.]+)>$/.exec(line);
    if(!m)continue;
    const at=Number(m[2])*1000-value.clock.timeOriginMs;if(at<scope.startMs||at>scope.endMs)continue;
    const name=path.basename(m[4]),guardFiles=['installed-packages.json','wydgit.config.json','.package-install.lock','.package-recovery.lock','.package-infrastructure.json','package-effects.json','package-operation.json'];
    const kind=guardFiles.includes(name)?name:/\.sqlite(?:-journal|-wal|-shm)?$/.test(name)?'sqliteMetadata':/\.lifecycle$/.test(name)?'storeLifecycle':'other';
    const thread=Number(m[1])===value.clock.mainThread?'main':'worker',key=kind+'|'+thread;
    const row=groups.get(key)??{kind,thread,durations:[]};row.durations.push(Number(m[6])*1000);groups.set(key,row);
  }
  return {scope:'setup GET + POST scheduling window; approximate external realtime bridge; statx/newfstatat only',
    unmatchedSplitLines:unmatched+pending.size,groups:[...groups.values()].map(({kind,thread,durations})=>({kind,thread,durationMs:distribution(durations)}))};
}

export function attributeSummary(captures){
  const spans=captures.flatMap(c=>c.spans),stages=[...new Set(spans.map(s=>s.stage))];
  return {requests:captures.length,uniqueArtifacts:distribution(captures.map(c=>c.uniqueArtifacts)),
    stages:Object.fromEntries(stages.map(stage=>[stage,{calls:spans.filter(s=>s.stage===stage).reduce((n,s)=>n+s.calls,0),
      inclusiveMs:spans.filter(s=>s.stage===stage).reduce((n,s)=>n+s.inclusiveMs,0),exclusiveMs:spans.filter(s=>s.stage===stage).reduce((n,s)=>n+s.exclusiveMs,0)}])),
    metadataCalls:captures.flatMap(c=>c.metadata).reduce((n,s)=>n+s.calls,0),
    guardChecks:captures.reduce((n,c)=>n+(c.counts.guardChecks??0),0),repeatedGenerationChecks:captures.reduce((n,c)=>n+(c.counts.repeatedGenerationChecks??0),0)};
}

async function installedExperiment(createCapture){
  const {lifecycleFixture,writeJson}=await import('./package-lifecycle.js');
  const {packageOperation,activatePackages,manualReplacement}=await import('../wydgine/packages/index.js');
  const {loadRepository}=await import('../wydgine/repository.js');
  const {checkContext}=await import('../wydgine/seam/context.js');
  const {STATE}=await import('../packages/wydgine/src/engine/packages/state.js');
  const rows=[],cleanup=[];
  const f=await lifecycleFixture({after:fn=>cleanup.push(fn)});
  try{
    const a=await f.candidate('a');a.approvals.capabilities=['object.instances.edit'];a.approvals.editable=['pkg-a'];
    const manifest=JSON.parse(await fs.readFile(path.join(a.packagePath,'manifest.json')));manifest.permissions=a.approvals;
    await writeJson(path.join(a.packagePath,'manifest.json'),manifest);await packageOperation(f.operation('install','acme/a',[a]));
    const bind=()=>{const model=loadRepository(f.root);return {model,context:activatePackages(model,{resolve(){},resolvePackageScopes(){}},f.root).context({pageId:'page-a',session:{},ids:[]})};};
    let {model,context}=bind();
    function capture(label,work){const c=createCapture();let code=null;try{c.run(work);}catch(error){code=error.code??'UNEXPECTED';}rows.push({label,code,attribution:c.finish()});return code;}
    capture('repeated-read-20',()=>{for(let i=0;i<20;i++)model.runtime.scope(context,'pkg-a').properties;});
    for(const changed of [false,true])capture(changed?'changed-write-8':'unchanged-write-8',()=>{
      let runtime=model.runtime;for(let i=0;i<8;i++){const edit=runtime.edit(context);edit.setProperty('pkg-a','setting',changed?'Changed '+i:'package default');runtime=edit.commit().runtime;}
    });
    // Same metadata bytes at a different inode: the guard must revalidate.
    const catalog=path.join(f.root,STATE),original=await fs.readFile(catalog);
    await fs.writeFile(catalog+'.replacement',original);await fs.rename(catalog+'.replacement',catalog);
    capture('same-bytes-catalog-replacement',()=>checkContext(context));
    const corrupt=JSON.parse(original);const entry=corrupt.packages[0];entry.resources[entry.manifest.resources.prototypes]+=' ';
    await writeJson(catalog,corrupt);capture('source-changed-after-validation',()=>checkContext(context));
    await fs.writeFile(catalog,original);capture('revoked-context-after-repair',()=>checkContext(context));
    ({model,context}=bind());await fs.rename(catalog,catalog+'.held');capture('removed-catalog',()=>checkContext(context));await fs.rename(catalog+'.held',catalog);
    ({model,context}=bind());await fs.writeFile(catalog,'{');capture('malformed-catalog',()=>checkContext(context));await fs.writeFile(catalog,original);
    ({model,context}=bind());const lock=path.join(f.root,'content/.package-install.lock');await fs.writeFile(lock,'');capture('installation-barrier',()=>checkContext(context));await fs.unlink(lock);
    ({model,context}=bind());await manualReplacement({schema:'wydgit.manual-replacement-request/1',root:f.root,package:'acme/a',action:'retire',installationContext:f.context});
    capture('retirement-stale-generation',()=>checkContext(context));
    await manualReplacement({schema:'wydgit.manual-replacement-request/1',root:f.root,package:'acme/a',action:'cancel',installationContext:f.context});
    capture('retirement-cancellation-does-not-revive',()=>checkContext(context));
    ({model,context}=bind());capture('fresh-generation-after-cancellation',()=>checkContext(context));
    return rows;
  }finally{for(const fn of cleanup.reverse())await fn();}
}
