// Small serial experiments using the alpha.23 Contact and hostname/drain fixtures.
// Run alone: node --test test-support/http-attribution-probe.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {Readable} from 'node:stream';
import {performance} from 'node:perf_hooks';
import {provisionHostnameExample} from '../examples/hostname-host/setup.js';
import {createMultiAppHost} from '../wydgine/multi-app.js';
import {createHostApp} from '../app.js';
import {packageFixture} from './packages.js';
import {runInstaller} from '../scripts/install-package.js';
const evidence=value=>console.log('HTTP_ATTRIBUTION '+JSON.stringify({runtime:process.version,platform:process.platform,budgetMs:1000,otherSuitesRunning:false,...value}));
const get=(server,host)=>new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port:server.address().port,headers:{Host:host}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});
for(const siblings of [0,12])test(`attribution: held Load with ${siblings} siblings`,{timeout:15000},async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-attribution-'));let host,release,entered;const barrier=new Promise(r=>release=r),entry=new Promise(r=>entered=r),records=[];
 t.after(async()=>{release();await host?.dispose();await fs.rm(root,{recursive:true,force:true});});
 const config=await provisionHostnameExample(root);
 host=await createMultiAppHost(config,{root,logger:{error(){}},execution:{'app-alpha':{observeHttp:record=>records.push({fixture:'held',record}),handlers:[{type:'Page.Load',owner:'home',run:async function(){entered();await barrier;}}]},'app-beta':{observeHttp:record=>{if(records.length<16)records.push({fixture:'sibling',record});}}}});
 const tokens=await Promise.all(config.apps.map(app=>host.activate(app.id))),server=await host.listenShared(0,'127.0.0.1');
 const pending=get(server,'alpha.localhost');await entry;const stopping=host.stop(tokens[0]),siblingStatuses=await Promise.all(Array.from({length:siblings},()=>get(server,'beta.localhost')));release();
 const status=await pending;await stopping;
 evidence({scenario:'held Page.Load',siblings,diagnosticsEnabled:true,status,siblingStatuses,matchedAlpha23:status===500&&records.some(({fixture,record})=>fixture==='held'&&record.meter?.exhaustion?.resource==='timeMs'),records});
 assert.ok(siblingStatuses.every(value=>value===200));assert.ok([200,500].includes(status));
});
for(const provider of ['JSON','SQLite'])test(`attribution: ${provider} Contact baseline and four concurrent submissions`,{timeout:30000},async t=>{
 // ABBA order with a fresh, identical installed dataset per window. No failed
 // or uncertain mutation is retried; each window writes five fixture records.
 for(const diagnosticsEnabled of [false,true,true,false]){
  const f=await packageFixture(t);await fs.writeFile(path.join(f.root,'wydgit.config.json'),await fs.readFile('wydgit.config.json'));
  await runInstaller({args:[f.packagePath,'--root',f.root,'--apply'],input:Readable.from(['y','y','contact','contact','sections','0',provider,'','y','y'].map(value=>value+'\n')),output:{write(){}}});
  const records=[],app=await createHostApp({root:f.root,logger:{error(){}},execution:diagnosticsEnabled?{observeHttp:record=>{if(records.length<8)records.push(record);}}:{}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try{
   const url=`http://127.0.0.1:${server.address().port}/contact/`,initial=await fetch(url),html=await initial.text();
   if(initial.status!==200){evidence({scenario:'Contact GET',provider,diagnosticsEnabled,status:initial.status,records});assert.fail('Fixture initial GET failed; evidence retained');}
   const cookie=initial.headers.get('set-cookie').split(';')[0],csrf=/name="_csrf" value="([^"]+)"/.exec(html)[1];
   const post=async index=>{const started=performance.now(),response=await fetch(url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_target:'guestbook-form',_action:'Submit',_csrf:csrf,name:'Fixture '+index,message:'Bounded attribution fixture'})});await response.text();return {status:response.status,elapsedMs:performance.now()-started,outcome:response.headers.get('x-wydgit-operation-outcome')};};
   const baseline=await post('baseline'),concurrent=await Promise.all(Array.from({length:4},(_,index)=>post(index)));
   evidence({scenario:'Contact POST',provider,diagnosticsEnabled,baselineConcurrency:1,concurrency:4,baseline,concurrent,matchedAlpha23:records.some(record=>record.status===500&&record.meter?.exhaustion?.resource==='timeMs'),records});
   assert.ok([baseline,...concurrent].every(value=>[200,500].includes(value.status)));
  }finally{await app.shutdown(server);}
 }
});
