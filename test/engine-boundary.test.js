import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as worker from '../wydgine/trusted/worker.js';
import {createHostApp} from '../app.js';
import {createMultiAppHost,validateAppInventory as compatibilityValidator} from '../wydgine/multi-app.js';
import {validateAppInventory} from '../wydgine/inventory.js';
import {createOperationalHost} from '../wydgine/operations.js';
import {restoreLocalApp} from '../wydgine/relocation.js';
import {ExecutionContext,checkContext} from '../wydgine/seam/context.js';
import {ExecutionContext as objectModelContext} from '../wydgine/object-model/index.js';
import {provisionExample} from '../examples/multi-app/setup.js';

async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-i51-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 return {root,inventory:await provisionExample(root)};
}
test('trusted adapter preserves authoritative function identities and compatibility validator',()=>{
 assert.deepEqual(Object.keys(worker).sort(),['createHostApp','createMultiAppHost','createOperationalHost','restoreLocalApp','validateAppInventory'].sort());
 for(const [name,value] of Object.entries({createHostApp,createMultiAppHost,createOperationalHost,restoreLocalApp,validateAppInventory}))assert.equal(worker[name],value);
 assert.equal(compatibilityValidator,validateAppInventory);
 assert.equal(objectModelContext,ExecutionContext);
});
test('explicit-root standalone App renders and loads all approved services without controller authority',async t=>{
 const {root}=await fixture(t);
 const app=await worker.createHostApp({root:path.join(root,'app-alpha'),appId:'app-alpha'});
 let server;t.after(async()=>{if(server?.listening)await app.shutdown(server);else await app.stop();});
 const context=new ExecutionContext({context:'FrontEnd',publisher:'acme',package:'acme/demo',app:'app-alpha',self:'home',capabilities:['store.records.read'],scopes:{wydstore:[{store:'main',collection:'records'}]}});
 assert.ok(Object.isFrozen(context));checkContext(context);assert.throws(()=>checkContext({...context}),{code:'SEAM.CONTEXT'});
 const binding=app.locals.libraries.bind(context);
 assert.equal((await binding.invoke('wydstore','1.0.0','count',{store:'main',collection:'records'})).value,0);
 assert.throws(()=>app.locals.libraries.bind({...context}),{code:'SEAM.CONTEXT'});
 server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 const response=await fetch('http://127.0.0.1:'+server.address().port);assert.equal(response.status,200);assert.match(await response.text(),/app-alpha/);
 const asset=await fetch('http://127.0.0.1:'+server.address().port+'/runtime/wydclient/uploads.js');assert.equal(asset.status,200);assert.equal(await asset.text(),await fs.readFile(new URL('../wydclient/uploads.js',import.meta.url),'utf8'));
 await app.shutdown(server);assert.equal(server.listening,false);
 await assert.rejects(binding.invoke('wydstore','1.0.0','count',{store:'main',collection:'records'}));
});
test('inventory direct and compatibility paths retain ceiling, nested-root, hardlink and catalog rejection',async t=>{
 const {root,inventory}=await fixture(t);
 assert.deepEqual(await worker.validateAppInventory(inventory,{root}),await compatibilityValidator(inventory,{root}));
 const oversized={schema:inventory.schema,apps:Array.from({length:17},(_,i)=>({id:'app-'+i,root:'app-'+i}))};
 await assert.rejects(worker.validateAppInventory(oversized,{root}),{code:'HOST.INVALID'});
 const nested=structuredClone(inventory);nested.apps[1].root='app-alpha/public';await assert.rejects(validateAppInventory(nested,{root}),{code:'HOST.ROOT'});
 const alias=path.join(root,'app-alpha/public/alias');await fs.link(path.join(root,'app-beta/content/app.json'),alias);
 await assert.rejects(validateAppInventory(inventory,{root}),{code:'HOST.ROOT'});await fs.unlink(alias);
 await fs.writeFile(path.join(root,'app-alpha/content/installed-packages.json'),'{}');
 await assert.rejects(validateAppInventory(inventory,{root}),{code:'HOST.INVALID'});
});
test('standalone and relocation import closures exclude controller and provider orchestration',async()=>{
 // Follow local ESM edges, including literal dynamic imports. Node/npm imports
 // are separately audited; no alternate source copy is used by the adapter.
 async function closure(entry){const seen=new Set();async function visit(file){file=path.resolve(file);if(seen.has(file)||!file.endsWith('.js'))return;seen.add(file);const text=await fs.readFile(file,'utf8');for(const match of text.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g))await visit(path.resolve(path.dirname(file),match[1]));}await visit(entry);return seen;}
 for(const entry of ['app.js','wydgine/relocation.js','wydgine/inventory.js']){
  const files=await closure(entry);
  for(const file of files)assert.doesNotMatch(file,/\/(?:wydgine|engine)\/(?:multi-app|operations)\.js$|wydhosting/i);
  assert.ok(files.has(path.resolve('packages/wydgine/src/engine/seam/context.js')));
 }
});
