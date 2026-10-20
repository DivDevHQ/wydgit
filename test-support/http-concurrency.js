// Trusted, disposable Contact experiment. No URL/root/provider injection from CLI.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {Readable} from 'node:stream';
import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import {packageFixture} from './packages.js';
import {runInstaller} from '../scripts/install-package.js';
import {createHostApp} from '../app.js';
import {loadRepository} from '../wydgine/repository.js';
import {activatePackages} from '../wydgine/packages/index.js';
import {createExecutionBudget,executionBudget} from '../wydgine/sewn/budget.js';
import {createCompletion} from '../wydgine/execution/completion.js';
import {createStartBarrier,loopbackRequest,clientRecord,runContactClient} from './http-contact-client.js';
import {createFsreqpromiseProbe} from './fsreqpromise-correlation.js';
import {runSeparateClient} from './http-client-process.js';

export const LEVELS=Object.freeze([1,2,4,8,12]);
export const CONTROLS=Object.freeze([false,true,true,false]);
export {createStartBarrier,loopbackRequest,REQUEST_MS} from './http-contact-client.js';
// Same identifier shape as SEWN NewId(), including its required letter prefix.
export const fixtureRecordId=()=> 'w'+randomUUID().replaceAll('-','');

export function validateWindow({provider,concurrency,diagnosticsEnabled,admissionSpacingMs=0,workload='contact',clientPlacement='shared'}) {
  assert.ok(['JSON','SQLite'].includes(provider),'Unsupported fixture provider');
  assert.ok(LEVELS.includes(concurrency),'Unsupported concurrency');
  assert.equal(typeof diagnosticsEnabled,'boolean');
  assert.ok([0,20].includes(admissionSpacingMs),'Unsupported admission spacing');
  assert.ok(['contact','native-services'].includes(workload),'Unsupported workload');
  assert.ok(['shared','separate'].includes(clientPlacement),'Unsupported client placement');
  assert.ok(workload==='contact'||clientPlacement==='shared');
}

// Half-open intervals. Ends at the same timestamp as another start do not overlap.
export function peakConcurrency(intervals) {
  const events=intervals.filter(value=>Number.isFinite(value.start)&&Number.isFinite(value.end)&&value.end>value.start)
    .flatMap(({start,end})=>[[start,1],[end,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let active=0,peak=0;for(const [,delta]of events){active+=delta;peak=Math.max(peak,active);}return peak;
}

export function classifyOutcome(client,trace) {
  const received=client.complete===true;
  const uncertain=client.outcome==='indeterminate'||trace?.operationOutcome==='indeterminate'||
    (!received&&(client.outcome==='committed'||trace?.operationOutcome==='committed'||trace?.services?.commitReported>0||trace?.services?.nativeStarted>0));
  return {completion:client.timedOut?'timed-out':received?(client.status>=200&&client.status<300?'completed':'failed'):'failed',
    writeOutcome:uncertain?'indeterminate':client.outcome??trace?.operationOutcome??'unknown',
    clientReceiptVerified:received};
}

export function matchesHistoricalContact(trace) {
  return trace?.pageAdmitted===true&&trace.status===500&&trace.meter?.exhaustion?.resource==='timeMs'&&
    trace.meter?.diagnostics?.phaseAtFailure==='prerender'&&trace.services?.nativeStarted===2&&
    trace.services?.pending===0&&trace.services?.commitReported===1&&trace.operationOutcome==='indeterminate'&&
    trace.headersPublished===true&&trace.responseEnded===true&&Boolean(trace.meter?.progress)&&Boolean(trace.scheduling);
}

export async function cleanupAll(callbacks) {
  let failed=0;
  for(const callback of [...callbacks].reverse())try{await callback();}catch{failed++;}
  return failed;
}

export async function runContactWindow(configuration,{signal}={}) {
  validateWindow(configuration);
  // Spike G workers install strict diagnostic-only source hooks before importing
  // this harness. Ordinary fixture/production execution installs no such hooks.
  const attribution=configuration.synchronousAttribution?await import('./prerender-integrity-attribution.js'):null;
  const synchronousCaptures=new Map();
  const deadlineModule=configuration.deadlineLedger?await import('./deadline-ledger.js'):null,deadlineCaptures=new Map();
  const {provider,concurrency,diagnosticsEnabled,admissionSpacingMs=0,clientPlacement='shared'}=configuration;
  const after=[],local=new AsyncLocalStorage(),records=new Map(),serverRequests=new Map(),admissions=new Map();
  const result={schema:'wydgine.http-concurrency-window/1',...configuration,clientPlacement,runtime:process.version,platform:process.platform,
    setup:null,requests:[],nativeRequests:[],traces:[],actualConcurrency:null,fixtureFailure:null,cleanupComplete:false};
  const clearRows=[];let droppedClears=0;
  const resourceProbe=createFsreqpromiseProbe({enabled:configuration.resourceCorrelation===true,maxCalls:configuration.inspectionCorrelation?512:32,maxResources:configuration.inspectionCorrelation?512:32,
    scheduling:configuration.scheduling===true,monitorOnly:configuration.scheduling===true&&configuration.resourceCorrelation!==true,request:()=>local.getStore(),generation:configuration.generation??1});
  let server,app,barrier;
  const agent=new http.Agent({keepAlive:false,maxSockets:12});
  try {
    const fixture=await packageFixture({after:callback=>after.push(callback)});
    await fs.writeFile(path.join(fixture.root,'wydgit.config.json'),await fs.readFile('wydgit.config.json'));
    await runInstaller({args:[fixture.packagePath,'--root',fixture.root,'--apply'],
      input:Readable.from(['y','y','contact','contact','sections','0',provider,'','y','y'].map(value=>value+'\n')),output:{write(){}}});
    app=await createHostApp({root:fixture.root,logger:{error(){}},
      admit(){const index=local.getStore(),span={start:performance.now(),end:null,...(configuration.scheduling?{wallMs:Date.now()}:{})};admissions.set(index,span);return ()=>{span.end=performance.now();};},
      execution:diagnosticsEnabled?{...(configuration.formClear?{observeFormClear:row=>{if(clearRows.length<64)clearRows.push({request:local.getStore(),...row});else droppedClears++;}}:{}),...(configuration.resourceCorrelation===true?{...(configuration.nativeGap?{observeNativeGap:({operation})=>resourceProbe.native({request:local.getStore(),operation})}:{}),observeLifecycleLstat:({operation})=>resourceProbe.observe({request:local.getStore(),operation}),...(configuration.inspectionCorrelation?{observeSqliteInspection:({operation})=>resourceProbe.inspect({request:local.getStore(),operation})}:{})}:{}),observeHttp:record=>{const index=local.getStore();if(Number.isInteger(index)&&index>=0&&index<=12&&!records.has(index))records.set(index,record);}}:{}});
    server=http.createServer({maxHeaderSize:8192},(req,res)=>{
      const index=Number(req.headers['x-fixture-sequence']),span={start:performance.now(),end:null};serverRequests.set(index,span);
      const end=()=>{span.end??=performance.now();};res.once('finish',end);res.once('close',end);
      local.run(index,()=>{
        const invoke=()=>{
        if(!attribution)return app.handle(req,res);
        const capture=attribution.createSynchronousAttribution({generation:configuration.generation??1,request:index});
        synchronousCaptures.set(index,capture);return capture.run(()=>app.handle(req,res));
        };
        if(!deadlineModule)return invoke();
        const capture=deadlineModule.createDeadlineLedger({request:index,generation:configuration.generation??1});
        deadlineCaptures.set(index,capture);return capture.run(invoke);
      });
    });
    server.requestTimeout=120000;server.headersTimeout=15000;server.maxHeadersCount=64;
    server.listen(0,'127.0.0.1');await once(server,'listening');
    if(configuration.workload!=='native-services'){
      resourceProbe.beginScheduling();
      const clientConfiguration={port:server.address().port,concurrency,admissionSpacingMs};
      const value=clientPlacement==='separate'?await runSeparateClient(clientConfiguration,{signal}):await runContactClient(clientConfiguration);
      resourceProbe.finishScheduling();
      result.setup={client:value.setup,trace:records.get(0)??null};result.requests=value.requests;
      result.clientProcess=value.supervision??null;
    }else{
      const initial=await loopbackRequest(server.address().port,{agent});
      result.setup={client:clientRecord(initial),trace:records.get(0)??null};
      assert.equal(initial.complete,true);assert.equal(initial.status,200);assert.match(initial.body,/Guestbook/);
      assert.doesNotMatch(initial.body,/id="guestbook-entry-/);
      assert.ok(initial.cookie);const csrf=/name="_csrf" value="([^"]+)"/.exec(initial.body)?.[1];assert.ok(csrf);
      const model=loadRepository(fixture.root),packages=activatePackages(model,app.locals.libraries,fixture.root);
      const native={context:packages.context({pageId:'contact',session:{identity:null},ids:[]}),mapping:packages.pages.get('contact').storageMappings.entries};
      barrier=createStartBarrier(concurrency);
      const pending=Array.from({length:concurrency},(_,offset)=>(async()=>{
        await barrier.wait();const index=offset+1;
        if(admissionSpacingMs&&offset)await new Promise(resolve=>setTimeout(resolve,offset*admissionSpacingMs));
        const start=performance.now(),token=createExecutionBudget(native.context),ledger=executionBudget(token,native.context);
        const completion=createCompletion(()=>ledger.check(),{diagnosticTiming:true});
        const call=(name,input)=>completion.run(operation=>app.locals.libraries.bind(native.context,operation).call('wydstore',name,input));
        try{
          const created=await call('create',{...native.mapping,id:fixtureRecordId(),data:{name:'Concurrency fixture',message:'Bounded Contact concurrency experiment'}});
          const queried=await call('query',{...native.mapping,limit:20});await completion.settle();
          return {index,start,end:performance.now(),createOk:created.ok,queryOk:queried.ok,queryRows:queried.ok?queried.value.length:null,
            meter:ledger.meter(),services:completion.snapshot(),nativeStages:completion.timing(),httpPublication:false};
        }finally{await completion.settle();ledger.close();}
      })());
      barrier.release();const completed=await Promise.all(pending);
      result.nativeRequests=completed;
    }
    if(result.nativeRequests.some(value=>!value.createOk||!value.queryOk))result.fixtureFailure='native-service-failure';
    if(result.requests.some(({client})=>client.complete&&client.status===200&&(!client.contactAcknowledged||client.outcome!=='committed')))result.fixtureFailure='unexpected-success-contract';
    // Independent read after ALL HTTP responses settle. This never runs on a
    // request's Page path and never retries a write or changes its HTTP outcome.
    if(configuration.reconcile===true&&result.requests.length){
      const model=loadRepository(fixture.root),packages=activatePackages(model,app.locals.libraries,fixture.root);
      const context=packages.context({pageId:'contact',session:{identity:null},ids:[]});
      const mapping=packages.pages.get('contact').storageMappings.entries;
      const rows=await app.locals.libraries.bind(context).call('wydstore','query',{...mapping,limit:20});
      assert.equal(rows.ok,true,'Post-window provider read');
      result.reconciliation={method:'fresh authorized provider query after all HTTP responses',records:rows.value.length,
        expected:concurrency,complete:rows.value.length===concurrency};
    }
  }catch(error){result.fixtureFailure=error.code?.startsWith('CLIENT.')?error.code:error.code==='FIXTURE.BARRIER'?'barrier':'setup-or-execution';}
  finally {
    barrier?.cancel();agent.destroy();
    // Drain admitted I/O before removing fixture data. The parent process watchdog
    // bounds native hangs and removes its exclusively owned scratch directory.
    const failed=await cleanupAll([...after,async()=>{
      if(server){server.closeAllConnections();await app.shutdown(server);}else await app?.stop();
    }]);
    resourceProbe.stop();
    if(configuration.resourceCorrelation===true||configuration.scheduling===true)result.resourceCorrelation=resourceProbe.snapshot();
    if(configuration.formClear)result.formClear={rows:clearRows,dropped:droppedClears};
    if(attribution)result.synchronousAttribution=[...synchronousCaptures.values()].map(capture=>capture.finish());
    if(deadlineModule)result.deadlineLedgers=[...deadlineCaptures.values()].map(capture=>capture.finish());
    result.cleanupComplete=failed===0;if(failed)result.fixtureFailure??='cleanup';
  }
  for(const request of result.requests){request.classification=classifyOutcome(request.client,records.get(request.index));
    request.server=serverRequests.get(request.index)??null;request.admission=admissions.get(request.index)??null;}
  result.traces=[...records].filter(([index])=>index>0).map(([index,record])=>({index,record,matchingHistoricalSignature:matchesHistoricalContact(record)}));
  result.nativeStageTiming=Boolean(result.setup?.trace?.meter?.diagnostics?.nativeStages);
  if(diagnosticsEnabled&&result.requests.length>0&&records.size!==concurrency+1)result.fixtureFailure??='incomplete-diagnostics';
  const pageIntervals=result.traces.map(({record})=>({start:record.meter?.timing?.startedAtMs,end:(record.meter?.timing?.startedAtMs??NaN)+(record.meter?.elapsedMs??NaN)}));
  result.actualConcurrency={client:peakConcurrency(result.requests.map(({client})=>client)),
    server:peakConcurrency([...serverRequests].filter(([index])=>index>0).map(([,span])=>span)),
    admitted:peakConcurrency([...admissions].filter(([index])=>index>0).map(([,span])=>span)),
    pageLedger:diagnosticsEnabled?peakConcurrency(pageIntervals):null,
    pageLedgerResolutionMs:diagnosticsEnabled?1:null};
  if(result.nativeRequests.length)result.actualConcurrency={nativeSequence:peakConcurrency(result.nativeRequests),pageLedger:null,client:null,server:null,admitted:null};
  return result;
}
