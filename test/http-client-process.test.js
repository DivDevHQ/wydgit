import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {fork} from 'node:child_process';
import {runContactClient} from '../test-support/http-contact-client.js';
import {runSeparateClient,validateClientResult} from '../test-support/http-client-process.js';
import {runContactWindow} from '../test-support/http-concurrency.js';
const configuration={port:12345,concurrency:2,admissionSpacingMs:0};
const fixture=new URL('../test-support/http-client-supervision-fixture.mjs',import.meta.url);
const launchMode=mode=>(_entry,_args,options)=>fork(fixture,[mode],options);

for(const placement of ['shared','separate'])test(`Contact client ${placement}: identical wire construction and sanitized results`,{timeout:10000},async t=>{
  const wire=[];
  const server=http.createServer((req,res)=>{
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
      wire.push({method:req.method,url:req.url,headers:req.headers,body});
      if(req.method==='GET'){res.setHeader('set-cookie','fixture=private; HttpOnly');res.end('Guestbook <input name="_csrf" value="private-token">');}
      else{res.setHeader('X-Wydgit-Operation-Outcome','committed');res.end('Thank you');}
    });
  });server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const run=placement==='shared'?runContactClient:runSeparateClient;
  const value=await run({...configuration,port:server.address().port});
  assert.equal(wire.length,3);assert.equal(wire[0].method,'GET');
  const expected=new URLSearchParams({_target:'guestbook-form',_action:'Submit',_csrf:'private-token',name:'Concurrency fixture',message:'Bounded Contact concurrency experiment'}).toString();
  for(const [i,req]of wire.slice(1).sort((a,b)=>Number(a.headers['x-fixture-sequence'])-Number(b.headers['x-fixture-sequence'])).entries()){
    assert.equal(req.method,'POST');assert.equal(req.url,'/contact/');assert.equal(req.body,expected);
    assert.equal(req.headers.cookie,'fixture=private');assert.equal(req.headers.connection,'keep-alive');
    assert.equal(req.headers['content-type'],'application/x-www-form-urlencoded');assert.equal(Number(req.headers['content-length']),Buffer.byteLength(expected));
    assert.equal(req.headers['x-fixture-sequence'],String(i+1));
  }
  assert.equal(value.requests.length,2);assert.ok(value.requests.every(r=>r.client.status===200&&r.client.complete));
  assert.doesNotMatch(JSON.stringify(value),/private|_csrf|set-cookie|node_modules/);
  if(placement==='separate')assert.equal(value.supervision.reaped,true);
});

test('separate client: installed SQLite Contact retains server diagnostics and cleanup',{timeout:15000},async()=>{
  const value=await runContactWindow({provider:'SQLite',concurrency:2,diagnosticsEnabled:true,clientPlacement:'separate'});
  assert.equal(value.fixtureFailure,null,JSON.stringify(value));assert.equal(value.cleanupComplete,true);assert.equal(value.clientProcess.reaped,true);
  assert.equal(value.actualConcurrency.server,2);assert.equal(value.actualConcurrency.pageLedger,2);
  for(const {record}of value.traces){assert.equal(record.status,200);assert.equal(record.services.commitReported,1);assert.equal(record.services.nativeStarted,2);assert.ok(record.scheduling);assert.ok(record.meter.progress);assert.ok(record.meter.diagnostics.nativeStages);}
});

for(const [mode,code,options]of [
  ['startup','CLIENT.STARTUP_TIMEOUT',{startupMs:100}],
  ['exit','CLIENT.EXIT',{}],
  ['hang','CLIENT.TIMEOUT',{executionMs:50,shutdownMs:25}],
  ['protocol','CLIENT.PROTOCOL',{}]
])test(`separate client: ${mode} fails closed and reaps child`,{timeout:10000},async()=>{
  let child,closed=false;
  await assert.rejects(runSeparateClient(configuration,{...options,launch:launchMode(mode),onSpawn:c=>{child=c;c.once('close',()=>closed=true);}}),{code});
  assert.equal(closed,true);assert.ok(child.exitCode!==null||child.signalCode!==null);assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
});

test('separate client: spawn failure is sanitized and closes resources',async()=>{
  await assert.rejects(runSeparateClient(configuration,{launch:(_e,_a,o)=>fork(fixture,[],{...o,execPath:'/missing-alpha26-node'})}),{code:'CLIENT.SPAWN'});
  await assert.rejects(runSeparateClient(configuration,{launch:()=>{throw Error('private command');}}),{message:'CLIENT.SPAWN'});
});

test('separate client: parent cancellation kills and reaps active child',{timeout:10000},async()=>{
  const controller=new AbortController();let child;
  await assert.rejects(runSeparateClient(configuration,{signal:controller.signal,launch:launchMode('hang'),shutdownMs:25,onSpawn:c=>{child=c;c.once('message',()=>controller.abort());}}),{code:'CLIENT.CANCELLED'});
  assert.ok(child.exitCode!==null||child.signalCode!==null);assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
  await assert.rejects(runSeparateClient(configuration,{signal:controller.signal}),{code:'CLIENT.CANCELLED'});
});

test('separate client: result schema rejects secrets and inconsistent counts',()=>{
  const record={start:1,end:2,status:500,outcome:'indeterminate',complete:true,timedOut:false,bytes:10,contactAcknowledged:false};
  const value={setup:record,requests:[{index:1,client:record}]};assert.equal(validateClientResult(value,1),value);
  for(const invalid of [{...value,cookie:'secret'},{...value,requests:[]},{...value,setup:{...record,body:'secret'}},{...value,requests:[{index:2,client:record}]}])assert.throws(()=>validateClientResult(invalid,1));
});


test('separate client: real parent SIGTERM supervises shutdown before exiting',{timeout:10000},async t=>{
  const parent=fork(fixture,['parent'],{stdio:['ignore','ignore','ignore','ipc'],execArgv:[]});
  t.after(async()=>{if(parent.exitCode===null&&parent.signalCode===null){parent.kill('SIGKILL');await once(parent,'close');}});
  const [{pid}]=await once(parent,'message');const result=once(parent,'message'),closed=once(parent,'close');
  parent.kill('SIGTERM');const [value]=await result;await closed;
  assert.deepEqual(value,{code:'CLIENT.CANCELLED',reaped:true});assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
});
