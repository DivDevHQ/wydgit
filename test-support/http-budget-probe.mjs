// Controlled deadline/commit semantics; these forced waits do not establish historical causation.
// Run: node --test test-support/http-budget-probe.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';
import {once} from 'node:events';
import http from 'node:http';
import {packageFixture} from './packages.js';
import {runInstaller} from '../scripts/install-package.js';
import {createHostApp} from 'wydgine';

for(const [provider,boundary] of [['JSON','precommit'],['SQLite','precommit'],['JSON','submitted-commit'],['JSON','connection-loss'],['SQLite','connection-loss']])test(`${provider}: controlled Contact ${boundary} wait crosses unchanged Page deadline`,{timeout:15000},async t=>{
 const f=await packageFixture(t),diagnostics=[],meters=[],traces=[];
 await fs.writeFile(path.join(f.root,'wydgit.config.json'),await fs.readFile('wydgit.config.json'));
 await runInstaller({args:[f.packagePath,'--root',f.root,'--apply'],input:Readable.from(['y','y','contact','contact','sections','0',provider,'','y','y'].map(a=>a+'\n')),output:{write(){}}});
 const app=await createHostApp({root:f.root,execution:{observeHttp:value=>{traces.push(value);if(traces.length>8)traces.shift();if(provider==='SQLite')throw Error('private lifecycle observer');},observeBudget:value=>meters.push(value)},logger:{error:value=>{if(typeof value==='string'&&value.startsWith('{"schema":"wydgine.http-event/1"'))diagnostics.push(JSON.parse(value));}}});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>app.shutdown(server));
 const url=`http://127.0.0.1:${server.address().port}/contact/`,first=await fetch(url),html=await first.text();assert.equal(first.status,200);
 const cookie=first.headers.get('set-cookie').split(';')[0],csrf=/name="_csrf" value="([^"]+)"/.exec(html)[1];
 const body=new URLSearchParams({_target:'guestbook-form',_action:'Submit',_csrf:csrf,name:'Budget probe',message:'Public probe'});
 let disconnected,client;const closed=new Promise(r=>disconnected=r);
 if(boundary==='connection-loss')server.once('request',(_req,res)=>res.once('close',disconnected));
 const submit=()=>boundary==='connection-loss'?new Promise((resolve,reject)=>{
  client=http.request(url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(body.toString())}},resolve);
  client.on('error',reject);client.end(body.toString());
 }):fetch(url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body});
 let reached,release;const entered=new Promise(r=>reached=r),barrier=new Promise(r=>release=r);t.after(()=>release());
 const method=boundary==='submitted-commit'?'rename':provider==='JSON'?'open':'lstat',original=fs[method];let armed=true;
 // Pause after the actual adapter's read-open/inspection, holding its usual locks
 // and descriptors. No program, deadline, assertion or concurrency policy changes.
 const mocked=t.mock.method(fs,method,async(...args)=>{
  const value=await original(...args);
  if(armed&&typeof args[0]==='string'&&args[0].startsWith(f.root+path.sep)&&(boundary==='submitted-commit'||/[/\\][a-f0-9]{64}\.(json|sqlite)$/.test(args[0]))){
   armed=false;reached();await barrier;
  }
  return value;
 });syncBuiltinESMExports();
 t.after(()=>{mocked.mock.restore();syncBuiltinESMExports();});
 let completed=false;const pending=submit().then(async response=>{await response.clone().arrayBuffer();completed=true;return response;},error=>({aborted:error.code}));await entered;
 if(boundary==='connection-loss'){
  client.destroy();assert.equal((await pending).aborted,'ECONNRESET');
  // A real server-side close, rather than a client fetch rejection, proves the
  // cancellation boundary has been reached before storage is released.
  await closed;release();
  const until=Date.now()+3000;while(!diagnostics.some(e=>e.phase==='page')&&Date.now()<until)await new Promise(r=>setTimeout(r,10));
  // Store sanitizes the cancellation exception; the subsequent SEWN tick sees
  // the revoked ledger and reports LIMIT. This code alone is not timeout proof.
  assert.ok(diagnostics.some(e=>e.phase==='page'&&e.code==='SEWN.LIMIT'),JSON.stringify(diagnostics));
  const trace=traces.findLast(m=>m.meter?.exhaustion);assert.equal(trace.headersPublished,false);assert.equal(trace.disconnected,true);assert.ok(trace.services.nativeStarted>0);assert.equal(trace.operationOutcome,'not-committed');
  assert.equal(trace.meter.diagnostics.nativeStages.nativeHandler.completed,trace.services.nativeStarted);assert.ok(Object.values(trace.meter.diagnostics.nativeStages).every(stage=>stage.completed===stage.calls));
  const meter=meters.findLast(m=>m.exhaustion);assert.equal(meter.exhaustion.resource,'guard');assert.equal(meter.diagnostics.execution,'page');assert.ok(meter.diagnostics.spans.service.calls>0);
  mocked.mock.restore();syncBuiltinESMExports();
  const recovered=await fetch(url);assert.equal(recovered.status,200);assert.equal((await recovered.text()).includes('Budget probe'),false);
  console.log(JSON.stringify({provider,boundary,client:'ECONNRESET',serverCloseObserved:true,meter,trace,committed:false,recoveryStatus:200}));return;
 }
 await new Promise(r=>setTimeout(r,1100));const completedBeforeRelease=completed;release();
 const response=await pending;assert.equal(response.status,500);
 if(boundary==='submitted-commit')assert.match(await response.clone().text(),/outcome indeterminate/);
 assert.equal(completedBeforeRelease,false,'Page must retain admitted I/O until cancellation settles');
 assert.equal(response.headers.get('x-wydgit-operation-outcome'),boundary==='precommit'?'not-committed':'indeterminate');
 assert.ok(diagnostics.some(e=>e.phase==='page'&&e.code==='SEWN.LIMIT'),JSON.stringify(diagnostics));
 const trace=traces.findLast(m=>m.meter?.exhaustion);assert.equal(trace.pageAdmitted,true);assert.equal(trace.status,500);assert.equal(trace.headersPublished,true);assert.equal(trace.responseEnded,true);assert.equal(trace.services.pending,0);assert.equal(trace.operationOutcome,boundary==='precommit'?'not-committed':'indeterminate');
 assert.equal(trace.meter.diagnostics.nativeStages.nativeHandler.completed,trace.services.nativeStarted);assert.ok(Object.values(trace.meter.diagnostics.nativeStages).every(stage=>stage.completed===stage.calls));
 const meter=meters.findLast(m=>m.exhaustion);assert.equal(meter.exhaustion.resource,'timeMs');assert.equal(meter.timeLimitMs,1000);assert.equal(meter.diagnostics.phaseAtFailure,'action');assert.ok(meter.diagnostics.spans.service.elapsedMs>=1000);
 assert.deepEqual(meter.diagnostics.accountingPath,['page','events','components','workflow','services']);assert.equal(JSON.stringify(meter).includes(f.root),false);
 mocked.mock.restore();syncBuiltinESMExports();
 const recovered=await fetch(url);assert.equal(recovered.status,200);const recoveredBody=await recovered.text();assert.equal(recoveredBody.includes('Budget probe'),boundary==='submitted-commit','observable result must match the commit boundary');
 console.log(JSON.stringify({provider,boundary:method,controlledWaitMs:1100,status:response.status,diagnostics,meter,trace,recoveryStatus:recovered.status,completedBeforeRelease,committedRecordVisibleAfterFailure:recoveredBody.includes('Budget probe'),historicalAttribution:false}));
});

test('controlled held-request drain crosses unchanged Page deadline while siblings survive',{timeout:15000},async t=>{
 const os=await import('node:os'),http=await import('node:http');
 const {provisionHostnameExample}=await import('../examples/hostname-host/setup.js');
 const {createMultiAppHost}=await import('../wydgine/multi-app.js');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-held-budget-'));let host,release;
 t.after(async()=>{release?.();await host?.dispose();await fs.rm(root,{recursive:true,force:true});});
 const config=await provisionHostnameExample(root),diagnostics=[],meters=[],traces=[];
 let enter;const entered=new Promise(r=>enter=r),pause=new Promise(r=>release=r);
 host=await createMultiAppHost(config,{root,logger:{error:value=>{if(typeof value==='string'&&value.startsWith('{"schema":"wydgine.http-event/1"'))diagnostics.push(JSON.parse(value));}},execution:{'app-alpha':{observeHttp:value=>{traces.push(value);if(traces.length>8)traces.shift();},observeBudget:value=>meters.push(value),handlers:[{type:'Page.Load',owner:'home',run:async function(){enter();await pause;}}]}}});
 const tokens=await Promise.all(config.apps.map(app=>host.activate(app.id))),server=await host.listenShared(0,'127.0.0.1');
 const get=hostname=>new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port:server.address().port,headers:{Host:hostname}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});
 const pending=get('alpha.localhost');await entered;const stopping=host.stop(tokens[0]);
 assert.equal(await get('alpha.localhost'),503);
 assert.ok((await Promise.all(Array.from({length:12},()=>get('beta.localhost')))).every(status=>status===200));
 await new Promise(r=>setTimeout(r,1100));release();assert.equal(await pending,500);await stopping;
 assert.ok(diagnostics.some(e=>e.phase==='page'&&e.code==='SEWN.LIMIT'),JSON.stringify(diagnostics));
 const meter=meters.findLast(m=>m.exhaustion);assert.equal(meter.exhaustion.resource,'timeMs');assert.equal(meter.timeLimitMs,1000);assert.equal(meter.diagnostics.phaseAtFailure,'load');assert.ok(meter.diagnostics.spans.dispatch.elapsedMs>=900);assert.equal(meter.progress.maxObservedUncheckedInterval.phase,'load');assert.equal(meter.progress.maxObservedUncheckedInterval.boundary,'handler');assert.ok(meter.progress.maxObservedUncheckedInterval.elapsedMs>=900);
 const trace=traces.findLast(record=>record.meter?.exhaustion);assert.equal(trace.scheduling.schema,'wydgine.scheduling/1');assert.equal(trace.services.nativeStarted,0);
 assert.equal(await get('beta.localhost'),200);
 console.log(JSON.stringify({boundary:'held Page.Load during drain',controlledWaitMs:1100,status:500,diagnostics,meter,trace,siblingStatus:200,historicalAttribution:false}));
});
