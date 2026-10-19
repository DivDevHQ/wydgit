import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {createCompletion} from '../wydgine/execution/completion.js';
import {bindServices} from '../wydgine/libraries/dispatch.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {fixture,context} from '../test-support/wydstore.js';
import {createResponse} from '../wydgine/http/response.js';
import {createHttpDiagnostics} from '../packages/wydgine/src/engine/http/diagnostics.js';

const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};
const input=index=>({store:'main',collection:'users',id:'stage-fixture-'+index,data:{name:'fixture'}});

test('native stages: reported commit survives a later failed publication without claiming client receipt',async()=>{
  const completion=createCompletion(()=>{},{diagnosticTiming:true});
  await completion.run(operation=>{operation.begin();operation.committed();});await completion.settle();
  const response=createResponse(context());response.tree('fixture');
  const output={statusCode:200,headersSent:false,writableEnded:false,destroyed:false,setHeader(){},getHeader(){},end(){throw Error('private transport');},destroy(){this.destroyed=true;}};
  let record;const observation=createHttpDiagnostics(value=>record=value);observation.admit();observation.phase('publication');
  await assert.rejects(response.send(output),error=>{observation.failure(error);return error.code==='RESPONSE.IO';});
  observation.finish(output,{cleanupErrors:[],services:completion.snapshot(),outcome:completion.outcome()});
  assert.equal(record.failure.phase,'publication');assert.equal(record.failure.code,'RESPONSE.IO');assert.equal(record.services.commitReported,1);
  assert.equal(record.operationOutcome,'committed');assert.equal(record.headersPublished,false);assert.equal(record.responseEnded,false);assert.equal(record.disconnected,true);
  assert.doesNotMatch(JSON.stringify(record),/private transport/);
});

test('native stages: disabled controls allocate no stage function or clock reads; fixed names and idempotent ends',async()=>{
  let reads=0,time=0;
  const disabled=createCompletion(()=>{},{now:()=>{reads++;return time;}});
  await disabled.run(operation=>assert.equal(operation.stage,undefined));assert.equal(disabled.timing(),null);assert.equal(reads,0);
  const enabled=createCompletion(()=>{},{diagnosticTiming:true,now:()=>time});
  await enabled.run(operation=>{assert.equal(operation.stage('private-path-or-input'),undefined);const end=operation.stage('nativeHandler');time=25;end();time=100;end();});
  assert.deepEqual(enabled.timing(),{nativeHandler:{calls:1,completed:1,elapsedMs:25,maxMs:25}});assert.ok(Object.isFrozen(enabled.timing().nativeHandler));
});

test('native stages: failed validation/admission never claims native entry or completion',async()=>{
  const ctx=new ExecutionContext({context:'FrontEnd',publisher:'acme',app:'appA',self:'page',capabilities:['test.fixture.read']});
  for(const failure of ['authorization','validation','guard']){
    let expired=false,entered=0,time=0;
    const completion=createCompletion(()=>{if(expired)throw Error('cancelled');},{diagnosticTiming:true,now:()=>time});
    const service={capability:'test.fixture.read',authorize:async()=>{time+=20;if(failure==='guard')expired=true;return failure!=='authorization';},
      validate:async()=>false,handler:()=>{entered++;return null;}};
    // Legacy calls skip schema validation; a guard failure occurs at begin().
    const result=await completion.run(operation=>bindServices(ctx,()=>service,()=>({apiVersion:'1.0.0',legacyOperations:['read']}),operation)[failure==='guard'?'call':'invoke'](...(failure==='guard'?['fixture','read',{}]:['fixture','1.0.0','read',{}])));
    assert.equal(result.ok,false);assert.equal(entered,0);await completion.settle();
    assert.deepEqual(completion.snapshot(),{admitted:1,nativeStarted:0,pending:0,commitReported:0});assert.equal(completion.timing().nativeHandler,undefined);
    assert.equal(completion.timing().dispatchAuthorization.elapsedMs,20);assert.equal(completion.outcome(true),'not-committed');
  }
});

test('native stages: successful handler settlement and thrown handler retain separate entry/commit evidence',async()=>{
  const ctx=new ExecutionContext({context:'FrontEnd',publisher:'acme',app:'appA',self:'page',capabilities:['test.fixture.read']});
  for(const throws of [false,true]){
    let time=0;
    const completion=createCompletion(()=>{},{diagnosticTiming:true,now:()=>time});
    const result=await completion.run(operation=>bindServices(ctx,()=>({capability:'test.fixture.read',authorize:()=>true,
      handler:()=>{time=40;operation.committed();if(throws)throw Error('private');return {accepted:true};}}),()=>undefined,operation).call('fixture','read',{}));
    assert.equal(result.ok,!throws);await completion.settle();assert.deepEqual(completion.snapshot(),{admitted:1,nativeStarted:1,pending:0,commitReported:1});
    assert.deepEqual(completion.timing().nativeHandler,{calls:1,completed:1,elapsedMs:40,maxMs:40});
    assert.equal(completion.outcome(throws),throws?'indeterminate':'committed');assert.doesNotMatch(JSON.stringify(result)+JSON.stringify(completion.timing()),/private/);
  }
});

test('JSON stages: real transaction enqueue/dequeue separates a held predecessor from work',{timeout:10000},async t=>{
  const f=await fixture(t,'json'),entered=deferred(),release=deferred(),secondQueued=deferred();let time=0,armed=true;
  t.after(()=>release.resolve());
  const completion=createCompletion(()=>{},{diagnosticTiming:true,now:()=>time}),original=fs.open;
  const mocked=t.mock.method(fs,'open',async(...args)=>{const value=await original(...args);
    if(armed&&typeof args[0]==='string'&&args[0].startsWith(f.root+'/')&&args[0].endsWith('.json')){armed=false;entered.resolve();await release.promise;}return value;});
  syncBuiltinESMExports();t.after(()=>{mocked.mock.restore();syncBuiltinESMExports();});
  const first=completion.run(operation=>f.registry.bind(context(),operation).call('wydstore','create',input(1)));await entered.promise;
  time=10;
  const second=completion.run(operation=>f.registry.bind(context(),{...operation,stage(name){const end=operation.stage(name);if(name==='jsonQueue')secondQueued.resolve();return end;}}).call('wydstore','create',input(2)));
  await secondQueued.promise;assert.equal(completion.timing().jsonQueue.calls,2);assert.equal(completion.timing().jsonQueue.completed,1);
  time=100;release.resolve();assert.equal((await first).ok,true);assert.equal((await second).ok,true);await completion.settle();
  const stages=completion.timing();assert.deepEqual(stages.jsonQueue,{calls:2,completed:2,elapsedMs:90,maxMs:90});
  assert.deepEqual(stages.jsonWork,{calls:2,completed:2,elapsedMs:100,maxMs:100});assert.equal(stages.nativeHandler.completed,2);
  assert.equal(completion.snapshot().commitReported,2);await f.registry.close();
});

test('SQLite stages: actual async preflight and synchronous transaction are separate; failed preflight closes its stage',{timeout:10000},async t=>{
  const f=await fixture(t,'sqlite');let time=0,fail=false;
  const completion=createCompletion(()=>{},{diagnosticTiming:true,now:()=>time}),original=fs.lstat;
  const mocked=t.mock.method(fs,'lstat',async(...args)=>{
    if(typeof args[0]==='string'&&args[0].startsWith(f.root+'/')&&args[0].endsWith('.sqlite')){time+=70;if(fail)throw Object.assign(Error('private'),{code:'EIO'});}
    return original(...args);
  });syncBuiltinESMExports();t.after(()=>{mocked.mock.restore();syncBuiltinESMExports();});
  const invoke=index=>completion.run(operation=>f.registry.bind(context(),{...operation,stage(name){const end=operation.stage(name);return end&&(()=>{if(name==='sqliteTransaction')time+=5;end();});}}).call('wydstore','create',input(index)));
  assert.equal((await invoke(1)).ok,true);fail=true;assert.equal((await invoke(2)).ok,false);await completion.settle();
  const stages=completion.timing();assert.deepEqual(stages.sqlitePreflight,{calls:2,completed:2,elapsedMs:140,maxMs:70});
  assert.deepEqual(stages.sqliteTransaction,{calls:1,completed:1,elapsedMs:5,maxMs:5});assert.equal(completion.snapshot().commitReported,1);await f.registry.close();
});
