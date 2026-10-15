// Disposable technical capacity profiles, not billing plans or a production host.
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {provisionHostnameExample} from './setup.js';
import {installTaskboards} from './taskboards.js';
import {createMultiAppHost} from '../../wydgine/multi-app.js';
import {localProvider} from '../../packages/wydfiles/src/local.js';
import {keyFor} from '../../packages/wydfiles/src/contract.js';
const root=await fs.mkdtemp(path.join(tmpdir(),'wyd-resource-profiles-'));let host,release;
try{
 const inventory=await provisionHostnameExample(root),execution=await installTaskboards(root);
 inventory.apps[0].resources={maxPending:1,httpConcurrent:1,directConcurrent:1,payloadBytes:100000};
 inventory.apps[1].resources={maxPending:8,httpConcurrent:4,directConcurrent:4,payloadBytes:1000000};
 inventory.apps[2].resources={maxPending:2,payloadBytes:100000};
 await fs.writeFile(path.join(root,'app-alpha/files',keyFor('/held')),'App-owned bytes');
 await fs.writeFile(path.join(root,'app-alpha/public/css/quota.bin'),Buffer.alloc(250000));
 let enter;const entered=new Promise(r=>enter=r),pause=new Promise(r=>release=r);
 host=await createMultiAppHost(inventory,{root,execution,libraryAdapters:{'app-alpha':{wydfiles:{provider:async config=>{const real=await localProvider(config.root);return {...real,async stat(...args){enter();await pause;return real.stat(...args);}};}}}}});
 const tokens=await Promise.all(inventory.apps.map(app=>host.activate(app.id))),server=await host.listenShared(0,'127.0.0.1');
 const get=(name,url='/',headers={})=>new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:server.address().port,path:url,headers:{Host:name,...headers}},res=>{let bytes=0,text='';res.on('data',b=>{bytes+=b.length;if(bytes<32768)text+=b;});res.on('end',()=>resolve({status:res.statusCode,bytes,text}));res.on('aborted',()=>reject(Error('Unexpected interrupted example response')));}).on('error',reject);});
 assert.equal((await get('alpha.localhost')).status,200);assert.match((await get('beta.localhost')).text,/Write WBasic/);
 const caller=host.bind(tokens[0],host.context(tokens[0],{publisher:'acme',package:'acme/demo',installation:'same-installation',self:'home',capabilities:['files.storage.read'],scopes:{wydfiles:[{path:'/'}]}}));
 const held=caller.invoke('wydfiles','1.0.0','stat',{path:'/held'});await entered;
 assert.equal((await get('alpha.localhost')).status,503);assert.equal((await get('beta.localhost')).status,200);console.log('Limited App saturated; standard App still executes compiled Taskboard.');
 release();assert.equal((await held).ok,true);assert.equal((await get('alpha.localhost')).status,200);
 const remaining=host.usage(tokens[0])[0].usage.quota.remaining;
 assert.equal((await get('alpha.localhost','/css/quota.bin',{Range:`bytes=0-${remaining-1}`})).bytes,remaining);
 assert.equal((await get('alpha.localhost')).status,503);assert.equal((await get('beta.localhost')).status,200);assert.equal((await get('soon.localhost')).status,200);console.log('Limited App payload allowance exhausted; standard and parking Apps remain available.');
 console.log(JSON.stringify(host.usage(),null,2));
 await host.stop(tokens[0]);assert.throws(()=>host.usage(tokens[0]));assert.equal((await get('beta.localhost')).status,200);await host.dispose();console.log('Independent stop, stale-token rejection and final disposal passed.');
}finally{release?.();await host?.dispose();await fs.rm(root,{recursive:true,force:true});}
