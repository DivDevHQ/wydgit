import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createStartBarrier,peakConcurrency,classifyOutcome,matchesHistoricalContact,loopbackRequest,cleanupAll,validateWindow,runContactWindow,fixtureRecordId} from '../test-support/http-concurrency.js';

test('concurrency fixture: release requires all clients and does not change work between levels',async()=>{
  const barrier=createStartBarrier(2);let released=0;
  const first=barrier.wait().then(()=>released++);assert.throws(()=>barrier.release());assert.equal(released,0);
  const second=barrier.wait().then(()=>released++);barrier.release();await Promise.all([first,second]);assert.equal(released,2);
  assert.throws(()=>barrier.wait());barrier.cancel();
  for(const provider of ['JSON','SQLite'])for(const concurrency of [1,2,4,8,12])validateWindow({provider,concurrency,diagnosticsEnabled:true});
  for(let index=0;index<100;index++)assert.match(fixtureRecordId(),/^w[a-f0-9]{32}$/);
  for(const configuration of [{provider:'remote',concurrency:1,diagnosticsEnabled:true},{provider:'JSON',concurrency:100,diagnosticsEnabled:true},{provider:'SQLite',concurrency:1},{provider:'SQLite',concurrency:1,diagnosticsEnabled:true,clientPlacement:'external'},{provider:'SQLite',concurrency:1,diagnosticsEnabled:true,clientPlacement:'separate',workload:'native-services'}])assert.throws(()=>validateWindow(configuration));
});

for(const provider of ['JSON','SQLite'])test(`concurrency fixture: ${provider} isolated native control performs the same two successful services`,{timeout:15000},async()=>{
  const result=await runContactWindow({provider,concurrency:2,diagnosticsEnabled:true,workload:'native-services'});
  assert.equal(result.fixtureFailure,null,JSON.stringify(result));assert.equal(result.cleanupComplete,true);assert.equal(result.requests.length,0);assert.equal(result.nativeRequests.length,2);
  assert.equal(result.actualConcurrency.nativeSequence,2);
  for(const record of result.nativeRequests){assert.equal(record.createOk,true);assert.equal(record.queryOk,true);assert.equal(record.services.nativeStarted,2);assert.equal(record.services.commitReported,1);assert.equal(record.services.pending,0);assert.equal(record.httpPublication,false);assert.equal(record.meter.exhaustion,null);}
});

for(const provider of ['JSON','SQLite'])test(`concurrency fixture: ${provider} real Contact responses correlate with private traces and cleanup`,{timeout:15000},async()=>{
  const result=await runContactWindow({provider,concurrency:2,diagnosticsEnabled:true});
  assert.equal(result.fixtureFailure,null,JSON.stringify(result));assert.equal(result.cleanupComplete,true);
  assert.equal(result.setup.client.status,200);assert.equal(result.requests.length,2);assert.equal(result.traces.length,2);
  assert.equal(result.actualConcurrency.client,2);assert.equal(result.actualConcurrency.admitted,2);
  for(const request of result.requests){
    assert.equal(request.client.status,200,JSON.stringify(result));assert.equal(request.client.complete,true);assert.equal(request.client.contactAcknowledged,true);
    const trace=result.traces.find(value=>value.index===request.index).record;assert.equal(trace.operationOutcome,'committed');assert.equal(trace.services.commitReported,1);
    assert.equal(trace.services.nativeStarted,2);assert.equal(trace.services.pending,0);assert.ok(trace.meter.timing.deadlineAtMs>trace.meter.timing.startedAtMs);
    assert.ok(request.admission.start<request.admission.end);assert.equal(trace.meter.diagnostics.nativeStages.nativeHandler.completed,2);
    if(provider==='SQLite'){
      const row=trace.meter.diagnostics.continuations.sqliteInspectFiles;
      assert.equal(row.calls,2);assert.equal(row.providerCompleted,2);assert.equal(row.resumed,2);
      assert.equal(row.incomplete,0);assert.equal(row.missingCompletion,0);assert.equal(row.completeBeforeAwait,0);
      assert.equal(trace.meter.diagnostics.nativeStages.sqliteLifecycle.completed,2);
    }else assert.deepEqual(trace.meter.diagnostics.continuations,{});
  }
  assert.doesNotMatch(JSON.stringify(result),/set-cookie|_csrf|wydpackage-|node_modules|Bounded Contact concurrency experiment/);
});

test('concurrency fixture: missing participants expire and cancellation releases all waiters',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const expired=createStartBarrier(2),failure=assert.rejects(expired.wait(),{code:'FIXTURE.BARRIER'});
  t.mock.timers.tick(1000);await failure;expired.cancel();
  const cancelled=createStartBarrier(2),pending=assert.rejects(cancelled.wait(),{code:'FIXTURE.BARRIER'});cancelled.cancel();await pending;
  t.mock.timers.tick(1000);
});

test('concurrency fixture: actual overlap is independent of requested count and excludes adjacent intervals',()=>{
  assert.equal(peakConcurrency([{start:0,end:3},{start:1,end:2},{start:3,end:4}]),2);
  assert.equal(peakConcurrency([{start:0,end:1},{start:1,end:2},{start:2,end:3}]),1);
  assert.equal(peakConcurrency([{start:0,end:null},{start:2,end:2},{start:3,end:1}]),0);
});

test('concurrency fixture: commit, publication and actual client receipt remain distinct',()=>{
  assert.deepEqual(classifyOutcome({complete:true,status:200,outcome:'committed'}),{completion:'completed',writeOutcome:'committed',clientReceiptVerified:true});
  assert.equal(classifyOutcome({complete:true,status:500,outcome:'indeterminate'}).writeOutcome,'indeterminate');
  const committed={services:{nativeStarted:1,commitReported:1},operationOutcome:'committed',headersPublished:true,responseEnded:true};
  assert.deepEqual(classifyOutcome({complete:false,timedOut:true,status:null},committed),{completion:'timed-out',writeOutcome:'indeterminate',clientReceiptVerified:false});
  assert.equal(classifyOutcome({complete:false,status:200},committed).completion,'failed');
  assert.equal(classifyOutcome({complete:false},{operationOutcome:'not-committed',services:{nativeStarted:1,commitReported:0}}).writeOutcome,'indeterminate');
  assert.equal(classifyOutcome({complete:true,status:500,outcome:'not-committed'}).writeOutcome,'not-committed');
  assert.equal(classifyOutcome({complete:false}).writeOutcome,'unknown');
});

test('concurrency fixture: incomplete committed header without private diagnostics remains indeterminate',()=>{
  assert.deepEqual(classifyOutcome({complete:false,status:200,outcome:'committed'}),
    {completion:'failed',writeOutcome:'indeterminate',clientReceiptVerified:false});
});

test('concurrency fixture: generic 500, forced action wait and cleanup-only LIMIT are not historical matches',()=>{
  const trace={pageAdmitted:true,status:500,meter:{exhaustion:{resource:'timeMs'},diagnostics:{phaseAtFailure:'prerender'},progress:{}},
    scheduling:{},services:{nativeStarted:2,pending:0,commitReported:1},operationOutcome:'indeterminate',headersPublished:true,responseEnded:true};
  assert.equal(matchesHistoricalContact(trace),true);
  for(const altered of [{...trace,meter:null},{...trace,status:200},{...trace,operationOutcome:'not-committed'},
    {...trace,meter:{...trace.meter,diagnostics:{phaseAtFailure:'action'}}},{...trace,services:{...trace.services,commitReported:0}},
    {...trace,responseEnded:false}])assert.equal(matchesHistoricalContact(altered),false);
});

test('concurrency fixture: cleanup continues in reverse order after a failing resource',async()=>{
  const order=[];assert.equal(await cleanupAll([()=>order.push('fixture'),()=>{order.push('server');throw Error('private');},()=>order.push('barrier')]),1);
  assert.deepEqual(order,['barrier','server','fixture']);
});

test('concurrency fixture: response end verifies receipt; partial response and real timeout do not',{timeout:5000},async t=>{
  let mode='complete';
  const server=http.createServer((_req,res)=>{
    if(mode==='complete'){res.setHeader('X-Wydgit-Operation-Outcome','committed');res.end('fixture');}
    else if(mode==='partial'){res.writeHead(200,{'content-length':'100'});res.write('short');setImmediate(()=>res.destroy());}
    // timeout mode intentionally never publishes; fixture shutdown destroys it.
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const complete=await loopbackRequest(server.address().port);assert.equal(complete.complete,true);assert.equal(complete.outcome,'committed');assert.equal(complete.body,'fixture');
  mode='partial';const partial=await loopbackRequest(server.address().port);assert.equal(partial.status,200);assert.equal(partial.complete,false);assert.equal(partial.timedOut,false);
  mode='timeout';const timeout=await loopbackRequest(server.address().port,{timeoutMs:25});assert.equal(timeout.complete,false);assert.equal(timeout.timedOut,true);
});
