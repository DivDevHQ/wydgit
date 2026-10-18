import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {lifecycleFixture,writeJson} from '../test-support/package-lifecycle.js';
import {ExecutionContext,checkContext} from '../wydgine/seam/context.js';
import {planExecutionPlacement,executionPlacement,acquirePackageExecution,packageOperation,applyPackageOperation,recoverPackageOperation,activatePackages} from '../wydgine/packages/index.js';
import {readInstalledState,STATE} from '../wydgine/packages/state.js';
import {loadRepository} from '../wydgine/repository.js';
import {bindServices} from '../wydgine/libraries/dispatch.js';
const state=f=>readInstalledState(f.root);
async function fixture(t){
 const f=await lifecycleFixture(t);
 f.context=new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'packages.placement.manage','packages.placement.relocate']});
 f.op=(action,candidates=[])=>({...f.operation(action,'acme/a',candidates),installationContext:f.context});
 f.request=(action,context='BackOffice')=>({root:f.root,package:'acme/a',installation:state(f).packages.find(p=>p.manifest.id==='acme/a').receipt.id,revision:state(f).revision,app:'boilerplate',action,context,installationContext:f.context});
 f.acquire=()=>{const e=state(f).packages.find(p=>p.manifest.id==='acme/a');return acquirePackageExecution({...f.request('place'),self:'pkg-a',generation:e.executionPlacement.generation});};
 f.a=await f.candidate('a');return f;
}
test('BOP-01 CTX-05: trusted placement, exact ownership, revision and independent grants',async t=>{
 const f=await fixture(t);await packageOperation(f.op('install',[f.a]));
 const request=f.request('place');
 for(const patch of [{app:'foreign'},{revision:0},{installation:'wrong'}])await assert.rejects(executionPlacement({...request,...patch}));
 for(const context of ['AccountAdmin','HostAdmin'])await assert.rejects(executionPlacement({...request,context}),{code:'EXECUTION.CONTEXT'});
 const low=new ExecutionContext({...f.context,package:'acme/a'});
 await assert.rejects(executionPlacement({...request,installationContext:low}),{code:'PACKAGE.DENIED'});
 const unapproved=new ExecutionContext({...f.context,capabilities:['packages.lifecycle.manage']});
 await assert.rejects(executionPlacement({...request,installationContext:unapproved}),{code:'SEAM.DENIED'});
 await executionPlacement(request);const ctx=f.acquire();assert.equal(ctx.context,'BackOffice');assert.deepEqual(ctx.capabilities,[]);
 const {createInstanceController}=await import('../wydgine/execution/instances.js');
 const loaded=loadRepository(f.root),controller=createInstanceController({runtime:loaded.runtime,registry:loaded.registry,context:ctx,rootId:'pkg-a'});
 await controller.activate();await controller.dispose();
 assert.throws(()=>ctx.require('store.records.write'),{code:'SEAM.DENIED'});
 await assert.rejects(executionPlacement(request),{code:'PACKAGE.STALE'});
 const model=loadRepository(f.root),bindings=activatePackages(model,{resolve(){},resolvePackageScopes(){}},f.root);
 assert.throws(()=>bindings.context({pageId:'page-a',session:{},ids:[]}),{code:'EXECUTION.PLACEMENT'});
});
test('BOP-02 CTX-06: replacement, relocation, retirement fence handles, callbacks and cached services',async t=>{
 const f=await fixture(t);await packageOperation(f.op('install',[f.a]));await executionPlacement(f.request('place'));
 const old=f.acquire(),derived=new ExecutionContext({...old}),handle=loadRepository(f.root).runtime.scope(old);
 const callback=()=>handle.requireCapability('store.records.read');
 const cached=bindServices(old,()=>({capability:'store.records.read',authorize:()=>true,handler:()=>assert.fail('obsolete service ran')}));
 const stale={...f.request('place'),generation:old.generation,self:'pkg-a'};
 await executionPlacement(f.request('replace'));
 for(const c of [old,derived])assert.throws(()=>checkContext(c),{code:'SEAM.CONTEXT'});
 await assert.rejects(Promise.resolve().then(callback),{code:'SEAM.CONTEXT'});
 assert.equal((await cached.call('store','get',{})).code,'SEAM.DENIED');
 assert.throws(()=>acquirePackageExecution(stale),{code:'PACKAGE.STALE'});
 const live=f.acquire(),request=f.request('relocate','FrontEnd');
 await assert.rejects(executionPlacement({...request,installationContext:new ExecutionContext({...f.context,capabilities:['packages.lifecycle.manage','packages.placement.manage']})}),{code:'SEAM.DENIED'});
 await assert.rejects(executionPlacement({...request,action:'replace'}),{code:'PACKAGE.DENIED'});
 await executionPlacement(request);assert.throws(()=>checkContext(live));assert.equal(f.acquire().context,'FrontEnd');
 const active=f.acquire();await executionPlacement(f.request('retire'));assert.throws(()=>checkContext(active));assert.throws(f.acquire);
 assert.equal(loadRepository(f.root).runtime.get('pkg-a').properties.setting,'package default');
});
test('BOP-03: compatible package update renews authority and preserves data; wider grants reject',async t=>{
 const f=await fixture(t);f.a.serverPlacement={app:'boilerplate',context:'BackOffice'};
 await packageOperation(f.op('install',[f.a]));const old=f.acquire();
 const next=await f.candidate('a',{version:'1.1.0'});await packageOperation(f.op('update',[next]));assert.throws(()=>checkContext(old));assert.equal(f.acquire().context,'BackOffice');
 const wider=await f.candidate('a',{version:'1.2.0'}),file=path.join(wider.packagePath,'manifest.json');
 const m=JSON.parse(await fs.readFile(file));m.permissions.traversal=['children'];wider.approvals=m.permissions;await writeJson(file,m);
 await assert.rejects(packageOperation(f.op('update',[wider])),{code:'PACKAGE.DENIED'});
});
test('BOP-04: inherited BackOffice restriction survives metadata and rejects weakened replacement',async t=>{
 const f=await fixture(t),file=path.join(f.a.packagePath,'prototypes.json');
 const defs=JSON.parse(await fs.readFile(file));defs[0].execution={schema:'wydgit.execution/1',runat:'Server',context:'BackOffice'};await writeJson(file,defs);
 const manifest=JSON.parse(await fs.readFile(path.join(f.a.packagePath,'manifest.json')));manifest.platform='>=0.3.0-alpha.16';await writeJson(path.join(f.a.packagePath,'manifest.json'),manifest);
 await assert.rejects(packageOperation(f.op('install',[f.a])),{code:'EXECUTION.PLACEMENT'});
 f.a.serverPlacement={app:'boilerplate',context:'BackOffice'};await packageOperation(f.op('install',[f.a]));
 await assert.rejects(executionPlacement(f.request('relocate','FrontEnd')),{code:'EXECUTION.PLACEMENT'});
 const next=await f.candidate('a',{version:'1.1.0'});await assert.rejects(packageOperation(f.op('update',[next])),{code:'EXECUTION.RESTRICTION'});
});
for(const action of ['replace','retire'])for(const stage of ['PLANNED','APPLYING','PUBLISHED'])test(`BOP-05 MIG-02: killed ${action} ${stage} reconciles durable placement without duplicates`,async t=>{
 const f=await fixture(t);await packageOperation(f.op('install',[f.a]));await executionPlacement(f.request('place'));const old=f.acquire();
 const request=f.request(action),file=path.join(f.root,'request.json');await writeJson(file,request);
 const child=spawn(process.execPath,['test-support/placement-child.js',file,stage],{stdio:['ignore','pipe','pipe','ipc']});
 let errors='';child.stderr.on('data',b=>errors+=b);t.after(()=>child.kill('SIGKILL'));
 await Promise.race([once(child,'message',{signal:AbortSignal.timeout(15000)}),once(child,'exit').then(()=>{throw Error(errors||'child exited');})]);
 child.kill('SIGKILL');await once(child,'exit');
 await recoverPackageOperation({root:f.root,installationContext:f.context});
 assert.equal(state(f).packages.length,1);
 await assert.rejects(recoverPackageOperation({root:f.root,installationContext:f.context}),{code:'ENOENT'});
 if(action==='retire'&&stage==='PUBLISHED')assert.throws(f.acquire,{code:'PACKAGE.STALE'});else checkContext(f.acquire());
 if(stage==='PUBLISHED')assert.throws(()=>checkContext(old));else checkContext(old);
 // A new retry uses the reconciled revision; the original request is stale after commit.
 if(stage==='PUBLISHED')await assert.rejects(executionPlacement(request),{code:'PACKAGE.STALE'});
 else await executionPlacement(request);
 assert.equal(state(f).packages.length,1);
});

for(const provider of ['json','sqlite'])test(`BOP-06 LIF-01 MIG-02 ${provider}: retained data/history and shared dependencies survive placement lifecycle`,async t=>{
 const {storedFixture}=await import('../test-support/package-effects.js');
 const {snapshotStore,checkpointHash}=await import('../packages/wydstore/src/lifecycle.js');
 const f=await storedFixture(t,provider);
 const operator=new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'packages.placement.manage','packages.placement.relocate']});
 const req=(action)=>{const s=state(f),e=s.packages.find(p=>p.manifest.id==='acme/a');return {root:f.root,app:'boilerplate',package:'acme/a',installation:e.receipt.id,revision:s.revision,action,context:'BackOffice',installationContext:operator};};
 const before=checkpointHash(await snapshotStore(f.store));
 const publicService=await f.binding();await executionPlacement(req('place'));
 await assert.rejects(publicService.call('wydstore','get',f.input),{code:'SEAM.CONTEXT'});
 const e=state(f).packages[0],context=acquirePackageExecution({...req('place'),generation:e.executionPlacement.generation,self:'pkg-a'});
 const libraries=await (await import('../wydgine/host.js')).initializeHost({root:f.root});
 const service=libraries.bind(context);assert.equal((await service.call('wydstore','get',f.input)).value.data.text,'Customer edit');
 await executionPlacement(req('replace'));await assert.rejects(service.call('wydstore','get',f.input),{code:'SEAM.CONTEXT'});
 const next=await f.version('1.1.0');await packageOperation(f.operation('update','acme/a',[next],{installationContext:operator}));
 await executionPlacement(req('retire'));assert.equal(checkpointHash(await snapshotStore(f.store)),before);
 await packageOperation(f.operation('uninstall','acme/a',[],{installationContext:operator}));
 assert.equal(state(f).retained[0].entry.executionPlacement.status,'retired');assert.equal(checkpointHash(await snapshotStore(f.store)),before);
});
test('BOP-07: neutral placements in separate sites cannot exchange canonical identity or receipts',async t=>{
 const a=await fixture(t),b=await fixture(t);
 // Change canonical App identity before installing: friendly names stay identical.
 const appFile=path.join(b.root,'content/app.json'),app=JSON.parse(await fs.readFile(appFile));app.id='second-site';await writeJson(appFile,app);
 b.context=new ExecutionContext({...b.context,app:'second-site',visible:[...b.context.visible,'second-site'],editable:[...b.context.editable,'second-site']});
 await packageOperation(a.op('install',[a.a]));await executionPlacement(a.request('place'));
 await packageOperation({...b.op('install',[b.a]),installationContext:b.context});
 const s=state(b),entry=s.packages[0];
 await assert.rejects(executionPlacement({...a.request('replace'),root:b.root,revision:s.revision,installation:entry.receipt.id}),{code:'PACKAGE.DENIED'});
 await assert.rejects(executionPlacement({...a.request('place'),root:b.root,installationContext:b.context,revision:s.revision,installation:entry.receipt.id}),{code:'PACKAGE.STALE'});
 const req={root:b.root,app:'second-site',package:'acme/a',installation:entry.receipt.id,revision:s.revision,action:'place',context:'FrontEnd',installationContext:b.context};
 await executionPlacement(req);assert.equal(state(b).packages[0].executionPlacement.context,'FrontEnd');assert.equal(a.acquire().context,'BackOffice');
});
test('BOP-08: instance declarations survive install copying and cannot authorize themselves',async t=>{
 const f=await fixture(t),file=path.join(f.a.packagePath,'section.json'),node=JSON.parse(await fs.readFile(file));
 node.schema='wydgit/0.3';node.execution={schema:'wydgit.execution/1',runat:'Server',context:'BackOffice'};await writeJson(file,node);
 await assert.rejects(packageOperation(f.op('install',[f.a])),{code:'EXECUTION.PLACEMENT'});
 f.a.serverPlacement={app:'boilerplate',context:'BackOffice'};await packageOperation(f.op('install',[f.a]));
 assert.equal(loadRepository(f.root).runtime.get('pkg-a').execution.context,'BackOffice');
 await assert.rejects(executionPlacement(f.request('relocate','FrontEnd')),{code:'EXECUTION.PLACEMENT'});
});
test('BOP-09: publication rechecks authority, stale plans and mirrored placement ownership',async t=>{
 const f=await fixture(t);await packageOperation(f.op('install',[f.a]));
 const plan=await planExecutionPlacement(f.request('place'));
 await executionPlacement(f.request('place'));await assert.rejects(applyPackageOperation(plan),{code:'PACKAGE.STALE'});
 const s=state(f);s.packages[0].executionPlacement.app='foreign';await writeJson(path.join(f.root,STATE),s);
 assert.throws(()=>readInstalledState(f.root),{code:'PACKAGE.CATALOG'});assert.throws(f.acquire,{code:'PACKAGE.CATALOG'});
});
test('BOP-10 LIF-01: retirement protects shared dependencies; reinstall issues a fresh generation',async t=>{
 const f=await fixture(t),dep=await f.candidate('dep'),a=await f.candidate('a',{dependencies:{'acme/dep':'^1'}}),b=await f.candidate('b',{dependencies:{'acme/dep':'^1'}});
 await packageOperation(f.op('install',[a,dep]));await packageOperation({...f.operation('install','acme/b',[b]),installationContext:f.context});
 await executionPlacement(f.request('place'));const old=f.acquire();await executionPlacement(f.request('retire'));
 await assert.rejects(packageOperation({...f.operation('uninstall','acme/dep'),installationContext:f.context}),{code:'PACKAGE.DEPENDENTS'});
 await packageOperation(f.op('uninstall'));assert.ok(state(f).packages.some(p=>p.manifest.id==='acme/dep'));
 await packageOperation(f.op('install',[a]));checkContext(f.acquire());assert.throws(()=>checkContext(old));
 assert.equal(state(f).packages.filter(p=>p.manifest.id==='acme/a').length,1);
});
test('BOP-11 CTX-06: manual cancellation cannot resurrect an unobserved old lifetime',async t=>{
 const {manualReplacement}=await import('../wydgine/packages/index.js');
 const f=await fixture(t);await packageOperation(f.op('install',[f.a]));
 const bindings=activatePackages(loadRepository(f.root),{resolve(){},resolvePackageScopes(){}},f.root);
 const old=bindings.context({pageId:'page-a',session:{},ids:[]});
 const request={schema:'wydgit.manual-replacement-request/1',root:f.root,package:'acme/a',installationContext:f.context};
 await manualReplacement({...request,action:'retire'});await manualReplacement({...request,action:'cancel'});
 // No old-context check occurred while the installation was quarantined.
 assert.throws(()=>checkContext(old),{code:'SEAM.CONTEXT'});
 const fresh=activatePackages(loadRepository(f.root),{resolve(){},resolvePackageScopes(){}},f.root).context({pageId:'page-a',session:{},ids:[]});checkContext(fresh);
});
for(const boundary of ['authorize','handler'])test(`BOP-12 CTX-06: asynchronous ${boundary} cannot resume obsolete authority`,async t=>{
 const {storedFixture}=await import('../test-support/package-effects.js');const f=await storedFixture(t,'json');
 const operator=new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'packages.placement.manage']});
 const req=action=>{const s=state(f),e=s.packages[0];return {root:f.root,package:'acme/a',app:'boilerplate',installation:e.receipt.id,revision:s.revision,context:'BackOffice',action,installationContext:operator};};
 await executionPlacement(req('place'));const entry=state(f).packages[0];
 const context=acquirePackageExecution({...req('place'),self:'pkg-a',generation:entry.executionPlacement.generation});
 let entered,release,calls=0;const started=new Promise(resolve=>entered=resolve),paused=new Promise(resolve=>release=resolve);
 const pause=async()=>{entered();await paused;};
 const dispatch=bindServices(context,()=>({capability:'store.records.read',authorize:async()=>{if(boundary==='authorize')await pause();return true;},handler:async()=>{calls++;if(boundary==='handler')await pause();return {};}}));
 const pending=dispatch.call('store','get',{});await started;await executionPlacement(req('replace'));release();
 assert.equal((await pending).ok,false);assert.equal(calls,boundary==='authorize'?0:1);assert.throws(()=>checkContext(context),{code:'SEAM.CONTEXT'});
});
for(const provider of ['json','sqlite'])test(`BOP-13 MIG-02 ${provider}: committed rollback restores data with fresh authority`,async t=>{
 const {storedFixture}=await import('../test-support/package-effects.js');
 const {rollbackPackageEffects}=await import('../wydgine/packages/index.js');
 const f=await storedFixture(t,provider),operator=new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'packages.placement.manage']});
 const request=action=>{const s=state(f),e=s.packages[0];return {root:f.root,app:'boilerplate',package:'acme/a',installation:e.receipt.id,revision:s.revision,action,context:'BackOffice',installationContext:operator};};
 await executionPlacement(request('place'));const e=state(f).packages[0],oldRequest={...request('place'),self:'pkg-a',generation:e.executionPlacement.generation},old=acquirePackageExecution(oldRequest);
 const candidate=await f.version('2.0.0',f.target);await packageOperation(f.operation('upgrade','acme/a',[candidate],{installationContext:operator,migrations:[f.migration()]}));
 await rollbackPackageEffects({root:f.root,installationContext:operator});
 assert.throws(()=>checkContext(old),{code:'SEAM.CONTEXT'});assert.throws(()=>acquirePackageExecution(oldRequest),{code:'PACKAGE.STALE'});
 const current=state(f).packages[0];checkContext(acquirePackageExecution({...request('place'),self:'pkg-a',generation:current.executionPlacement.generation}));
});
