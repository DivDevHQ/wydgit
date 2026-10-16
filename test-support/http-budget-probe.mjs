// Bounded diagnostic campaign, not a claim to attribute historical incidents.
// Run: node --test test-support/http-budget-probe.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';
import {once} from 'node:events';
import {packageFixture} from './packages.js';
import {runInstaller} from '../scripts/install-package.js';
import {createHostApp} from 'wydgine';

for(const provider of ['JSON','SQLite'])test(`${provider}: controlled Contact storage wait crosses unchanged Page deadline`,{timeout:15000},async t=>{
 const f=await packageFixture(t),diagnostics=[];
 await fs.writeFile(path.join(f.root,'wydgit.config.json'),await fs.readFile('wydgit.config.json'));
 await runInstaller({args:[f.packagePath,'--root',f.root,'--apply'],input:Readable.from(['y','y','contact','contact','sections','0',provider,'','y','y'].map(a=>a+'\n')),output:{write(){}}});
 const app=await createHostApp({root:f.root,logger:{error:value=>{if(typeof value==='string'&&value.startsWith('{"schema":"wydgine.http-event/1"'))diagnostics.push(JSON.parse(value));}}});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>app.shutdown(server));
 const url=`http://127.0.0.1:${server.address().port}/contact/`,first=await fetch(url),html=await first.text();assert.equal(first.status,200);
 const cookie=first.headers.get('set-cookie').split(';')[0],csrf=/name="_csrf" value="([^"]+)"/.exec(html)[1];
 const submit=()=>fetch(url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_target:'guestbook-form',_action:'Submit',_csrf:csrf,name:'Budget probe',message:'Public probe'})});
 let reached,release;const entered=new Promise(r=>reached=r),barrier=new Promise(r=>release=r);t.after(()=>release());
 const method=provider==='JSON'?'open':'lstat',original=fs[method];let armed=true;
 // Pause after the actual adapter's read-open/inspection, holding its usual locks
 // and descriptors. No program, deadline, assertion or concurrency policy changes.
 const mocked=t.mock.method(fs,method,async(...args)=>{
  const value=await original(...args);
  if(armed&&typeof args[0]==='string'&&args[0].startsWith(f.root+path.sep)&&/[/\\][a-f0-9]{64}\.(json|sqlite)$/.test(args[0])){
   armed=false;reached();await barrier;
  }
  return value;
 });syncBuiltinESMExports();
 t.after(()=>{mocked.mock.restore();syncBuiltinESMExports();});
 let completed=false;const pending=submit().then(async response=>{await response.arrayBuffer();completed=true;return response;});await entered;
 await new Promise(r=>setTimeout(r,1100));const completedBeforeRelease=completed;release();
 const response=await pending;assert.equal(response.status,500);
 assert.ok(diagnostics.some(e=>e.phase==='page'&&e.code==='SEWN.LIMIT'),JSON.stringify(diagnostics));
 mocked.mock.restore();syncBuiltinESMExports();
 const recovered=await fetch(url);assert.equal(recovered.status,200);const recoveredBody=await recovered.text();
 console.log(JSON.stringify({provider,boundary:method,controlledWaitMs:1100,status:response.status,diagnostics,recoveryStatus:recovered.status,completedBeforeRelease,committedRecordVisibleAfterFailure:recoveredBody.includes('Budget probe'),historicalAttribution:false}));
});

test('controlled held-request drain crosses unchanged Page deadline while siblings survive',{timeout:15000},async t=>{
 const os=await import('node:os'),http=await import('node:http');
 const {provisionHostnameExample}=await import('../examples/hostname-host/setup.js');
 const {createMultiAppHost}=await import('../wydgine/multi-app.js');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-held-budget-'));let host,release;
 t.after(async()=>{release?.();await host?.dispose();await fs.rm(root,{recursive:true,force:true});});
 const config=await provisionHostnameExample(root),diagnostics=[];
 let enter;const entered=new Promise(r=>enter=r),pause=new Promise(r=>release=r);
 host=await createMultiAppHost(config,{root,logger:{error:value=>{if(typeof value==='string'&&value.startsWith('{"schema":"wydgine.http-event/1"'))diagnostics.push(JSON.parse(value));}},execution:{'app-alpha':{handlers:[{type:'Page.Load',owner:'home',run:async function(){enter();await pause;}}]}}});
 const tokens=await Promise.all(config.apps.map(app=>host.activate(app.id))),server=await host.listenShared(0,'127.0.0.1');
 const get=hostname=>new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port:server.address().port,headers:{Host:hostname}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});
 const pending=get('alpha.localhost');await entered;const stopping=host.stop(tokens[0]);
 assert.equal(await get('alpha.localhost'),503);
 assert.ok((await Promise.all(Array.from({length:12},()=>get('beta.localhost')))).every(status=>status===200));
 await new Promise(r=>setTimeout(r,1100));release();assert.equal(await pending,500);await stopping;
 assert.ok(diagnostics.some(e=>e.phase==='page'&&e.code==='SEWN.LIMIT'),JSON.stringify(diagnostics));
 assert.equal(await get('beta.localhost'),200);
 console.log(JSON.stringify({boundary:'held Page.Load during drain',controlledWaitMs:1100,status:500,diagnostics,siblingStatus:200,historicalAttribution:false}));
});
