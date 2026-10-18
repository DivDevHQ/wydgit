import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { lifecycleFixture, writeJson } from '../test-support/package-lifecycle.js';
import { planPackageOperation, applyPackageOperation, packageOperation, createPackageBudget, recoverPackageOperation, inspectPackageOperation, planPackageInstall } from '../wydgine/packages/index.js';
import { readInstalledState, STATE } from '../wydgine/packages/state.js';
import { packageGraph, removalOrder } from '../packages/wydgine/src/engine/packages/graph.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createExecutionBudget, executionBudget } from '../wydgine/sewn/budget.js';
import { loadRepository } from '../wydgine/repository.js';
import { initializeHost } from '../wydgine/host.js';

const state=f=>readInstalledState(f.root),packages=f=>state(f).packages.map(p=>p.manifest.id).sort();
const readState=f=>fs.readFile(path.join(f.root,STATE),'utf8');
const rewriteManifest=async(candidate,change)=>{const file=path.join(candidate.packagePath,'manifest.json'),m=JSON.parse(await fs.readFile(file,'utf8'));change(m);await writeJson(file,m);return m;};

test('shared and transitive automatic dependencies survive until their last dependent is removed',async t=>{
  const f=await lifecycleFixture(t),store=await f.candidate('store'),profiles=await f.candidate('profiles',{dependencies:{'acme/store':'^1'}}),book=await f.candidate('book',{dependencies:{'acme/profiles':'^1'}}),forum=await f.candidate('forum',{dependencies:{'acme/profiles':'^1'}});
  const plan=await planPackageOperation(f.operation('install','acme/book',[book,profiles,store]));
  assert.equal(state(f),null);assert.deepEqual(plan.changes.map(c=>c.package),['acme/store','acme/profiles','acme/book']);
  await applyPackageOperation(plan);await packageOperation(f.operation('install','acme/forum',[forum]));
  assert.equal(state(f).packages.find(p=>p.manifest.id==='acme/store').reason,'automatic');
  await assert.rejects(packageOperation(f.operation('uninstall','acme/profiles')),{code:'PACKAGE.DEPENDENTS'});
  await packageOperation(f.operation('uninstall','acme/book'));assert.deepEqual(packages(f),['acme/forum','acme/profiles','acme/store']);
  await initializeHost({root:f.root});
  await packageOperation(f.operation('uninstall','acme/forum'));assert.deepEqual(packages(f),[]);
  assert.equal(state(f).retained.length,4);assert.equal(inspectPackageOperation(f.root).status,'COMPLETED');
});

for(const promote of ['promote','install'])test(`${promote} persists explicit retention without reinstalling an automatic dependency`,async t=>{
  const f=await lifecycleFixture(t),dep=await f.candidate('dep'),app=await f.candidate('app',{dependencies:{'acme/dep':'^1'}});
  await packageOperation(f.operation('install','acme/app',[app,dep]));const receipt=state(f).packages[0].receipt.id;
  await packageOperation(f.operation(promote,'acme/dep',promote==='install'?[dep]:[]));
  await packageOperation(f.operation('uninstall','acme/app'));assert.deepEqual(packages(f),['acme/dep']);
  assert.equal(state(f).packages[0].reason,'explicit');assert.equal(state(f).packages[0].receipt.id,receipt);
});

test('protected automatic dependencies and explicit dependencies are never pruned',async t=>{
  const f=await lifecycleFixture(t),dep=await f.candidate('dep'),app=await f.candidate('app',{dependencies:{'acme/dep':'^1'}});
  await packageOperation(f.operation('install','acme/app',[dep,app],{protectedPackages:['acme/dep']}));
  await packageOperation(f.operation('uninstall','acme/app'));assert.deepEqual(packages(f),['acme/dep']);
  await assert.rejects(packageOperation(f.operation('uninstall','acme/dep')),{code:'PACKAGE.PROTECTED'});
});

for(const defect of ['missing','cycle','conflict','identity','permission','cleanup'])test(`validation rejects ${defect} before any mutation`,async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a',{dependencies:{'acme/b':'^1'}}),b=await f.candidate('b');let expected;
  if(defect==='missing')expected='PACKAGE.CONFLICT';
  if(defect==='cycle'){await rewriteManifest(b,m=>m.dependencies={'acme/a':'^1'});expected='PACKAGE.CYCLE';}
  if(defect==='conflict'){await rewriteManifest(b,m=>m.version='2.0.0');expected='PACKAGE.CONFLICT';}
  if(defect==='identity'){await rewriteManifest(a,m=>m.publisher='other');expected='PACKAGE.MANIFEST';}
  if(defect==='permission'){a.approvals.capabilities=['store.records.delete'];expected='PACKAGE.DENIED';}
  if(defect==='cleanup'){await rewriteManifest(a,m=>m.uninstall={delete:['../content']});expected='LIBRARY.INVALID_CONFIG';}
  await assert.rejects(packageOperation(f.operation('install','acme/a',defect==='missing'?[a]:[a,b])),e=>{if(defect==='cleanup')return typeof e.code==='string';assert.equal(e.code,expected);return true;});
  assert.equal(state(f),null);assert.equal(inspectPackageOperation(f.root),null);
});

test('legacy single installer refuses unresolved graph edges',async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a',{dependencies:{'acme/b':'^1'}});
  await assert.rejects(planPackageInstall({...a,root:f.root,installationContext:f.context}),{code:'PACKAGE.DEPENDENCY'});
  assert.equal(state(f),null);
});

for(const action of ['install','update','upgrade','uninstall','purge','promote'])test(`unauthorized ${action} fails before planning package actions`,async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a');
  const denied=new ExecutionContext({publisher:'operator',self:'home',app:'boilerplate',capabilities:['object.instances.edit']});
  await assert.rejects(packageOperation(f.operation(action,'acme/a',[a],{installationContext:denied})),{code:'SEAM.DENIED'});
  const foreign=new ExecutionContext({publisher:'operator',self:'home',app:'foreign',capabilities:['packages.lifecycle.manage']});
  await assert.rejects(packageOperation(f.operation(action,'acme/a',[a],{installationContext:foreign})),{code:'PACKAGE.DENIED'});
  const packageContext=new ExecutionContext({publisher:'acme',package:'acme/a',self:'home',app:'boilerplate',capabilities:['packages.lifecycle.manage']});
  await assert.rejects(packageOperation(f.operation(action,'acme/a',[a],{installationContext:packageContext})),{code:'PACKAGE.DENIED'});
});

test('update preserves configuration, rejects implicit major upgrades and storage migrations, and is repeat-safe',async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a');await packageOperation(f.operation('install','acme/a',[a]));
  const customized=state(f);const app=JSON.parse(customized.app);app.slots.pages.find(p=>p.id==='page-a').slots.sections[0].properties.setting='administrator value';customized.app=JSON.stringify(app);await writeJson(path.join(f.root,STATE),customized);
  const updated=await f.candidate('a',{version:'1.1.0'});await packageOperation(f.operation('update','acme/a',[updated]));
  assert.equal(loadRepository(f.root).runtime.get('pkg-a').properties.setting,'administrator value');
  const before=state(f).packages[0].receipt.id;await packageOperation(f.operation('update','acme/a',[updated]));assert.equal(state(f).packages[0].receipt.id,before);
  const major=await f.candidate('a',{version:'2.0.0'});await assert.rejects(packageOperation(f.operation('update','acme/a',[major])),{code:'PACKAGE.UPGRADE_REQUIRED'});
  await packageOperation(f.operation('upgrade','acme/a',[major]));assert.equal(loadRepository(f.root).runtime.get('pkg-a').properties.setting,'administrator value');
  const schema=await f.candidate('a',{version:'2.1.0'});await rewriteManifest(schema,m=>m.storage=[{name:'data',fields:{text:{type:'string'}}}]);
  await assert.rejects(packageOperation(f.operation('update','acme/a',[schema])),{code:'PACKAGE.MIGRATION_REQUIRED'});assert.equal(state(f).packages[0].manifest.version,'2.0.0');
});

test('dependency addition, removal, shared upgrades and incompatible reverse constraints',async t=>{
  const f=await lifecycleFixture(t),dep=await f.candidate('dep'),a=await f.candidate('a'),b=await f.candidate('b',{dependencies:{'acme/dep':'^1'}});
  await packageOperation(f.operation('install','acme/a',[a]));
  const a11=await f.candidate('a',{version:'1.1.0',dependencies:{'acme/dep':'^1'}});await packageOperation(f.operation('update','acme/a',[a11,dep]));
  await packageOperation(f.operation('install','acme/b',[b]));
  const dep2=await f.candidate('dep',{version:'2.0.0'}),a2=await f.candidate('a',{version:'2.0.0',dependencies:{'acme/dep':'^2'}});
  await assert.rejects(packageOperation(f.operation('upgrade','acme/a',[a2,dep2])),{code:'PACKAGE.CONFLICT'});
  const dep11=await f.candidate('dep',{version:'1.1.0'});await packageOperation(f.operation('update','acme/dep',[dep11]));
  assert.equal(state(f).packages.find(p=>p.manifest.id==='acme/dep').reason,'automatic');
  const a12=await f.candidate('a',{version:'1.2.0'});await packageOperation(f.operation('update','acme/a',[a12]));
  await packageOperation(f.operation('uninstall','acme/b'));assert.deepEqual(packages(f),['acme/a']);
});

test('upgrade removing the last dependency recursively prunes automatic orphans',async t=>{
  const f=await lifecycleFixture(t),c=await f.candidate('c'),b=await f.candidate('b',{dependencies:{'acme/c':'^1'}}),a=await f.candidate('a',{dependencies:{'acme/b':'^1'}});
  await packageOperation(f.operation('install','acme/a',[a,b,c]));
  await packageOperation(f.operation('update','acme/a',[await f.candidate('a',{version:'1.1.0'})]));assert.deepEqual(packages(f),['acme/a']);assert.equal(state(f).retained.length,2);
});

test('retention, reinstall and explicitly authorized purge preserve App instances until purge',async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a');await packageOperation(f.operation('install','acme/a',[a]));
  const saved=state(f);const app=JSON.parse(saved.app);app.slots.pages.find(p=>p.id==='page-a').slots.sections[0].properties.setting='keep me';saved.app=JSON.stringify(app);await writeJson(path.join(f.root,STATE),saved);
  await packageOperation(f.operation('uninstall','acme/a'));assert.equal(JSON.parse(state(f).retained[0].attachments[0].instance).properties.setting,'keep me');assert.throws(()=>loadRepository(f.root).runtime.get('pkg-a'));
  await packageOperation(f.operation('install','acme/a',[a]));assert.equal(loadRepository(f.root).runtime.get('pkg-a').properties.setting,'keep me');assert.equal(state(f).retained.length,0);
  await assert.rejects(packageOperation(f.operation('purge','acme/a')),{code:'PACKAGE.INSTALLED'});
  await packageOperation(f.operation('uninstall','acme/a'));await packageOperation(f.operation('purge','acme/a'));assert.equal(state(f).retained.length,0);assert.equal(state(f).packages.length,0);
});

for(const stage of ['PLANNED','APPLYING'])test(`injected ${stage} failure retains old state and allows a fresh retry`,async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a');const plan=await planPackageOperation(f.operation('install','acme/a',[a]));
  await assert.rejects(applyPackageOperation(plan,{atStage:s=>{if(s===stage)throw Error('injected storage failure');}}),{code:'PACKAGE.STORAGE'});
  assert.equal(state(f),null);assert.equal(inspectPackageOperation(f.root).status,'FAILED');
  await assert.rejects(applyPackageOperation(plan),{code:'PACKAGE.PLAN'});
  await packageOperation(f.operation('install','acme/a',[a]));assert.deepEqual(packages(f),['acme/a']);
});

test('concurrent plans serialize, a competitor sees BUSY, and a stale plan cannot publish',async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a'),b=await f.candidate('b');
  const one=await planPackageOperation(f.operation('install','acme/a',[a])),two=await planPackageOperation(f.operation('install','acme/b',[b]));
  let enter,release;const ready=new Promise(r=>enter=r),hold=new Promise(r=>release=r);
  const running=applyPackageOperation(one,{atStage:async stage=>{if(stage==='APPLYING'){enter();await hold;}}});await ready;
  await assert.rejects(applyPackageOperation(two),{code:'PACKAGE.BUSY'});release();await running;assert.deepEqual(packages(f),['acme/a']);
  const stale=await planPackageOperation(f.operation('install','acme/b',[b]));await packageOperation(f.operation('uninstall','acme/a'));
  await assert.rejects(applyPackageOperation(stale),{code:'PACKAGE.STALE'});assert.deepEqual(packages(f),[]);
});

test('cancellation, shared work exhaustion and parent execution accounting cannot replenish budgets',async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a'),abort=new AbortController();abort.abort();
  await assert.rejects(packageOperation(f.operation('install','acme/a',[a],{signal:abort.signal})),{code:'PACKAGE.CANCELLED'});
  const context=new ExecutionContext({...f.context,limits:{packageWork:4}}),budget=createPackageBudget(context);
  await assert.rejects(packageOperation(f.operation('install','acme/a',[a],{installationContext:context,budget})),{code:'PACKAGE.LIMIT'});assert.equal(state(f),null);
  await assert.rejects(planPackageOperation(f.operation('install','acme/a',[a],{installationContext:context,budget})),{code:'PACKAGE.LIMIT'});
  const parent=createExecutionBudget(f.context),token=createPackageBudget(f.context,{parentBudget:parent});
  await packageOperation(f.operation('install','acme/a',[a],{budget:token}));assert.ok(executionBudget(parent,f.context).snapshot().steps>0);
});

test('forged receipts and dependency records fail closed on restart',async t=>{
  const f=await lifecycleFixture(t),b=await f.candidate('b'),a=await f.candidate('a',{dependencies:{'acme/b':'^1'}});await packageOperation(f.operation('install','acme/a',[a,b]));
  const original=await readState(f);
  for(const mutate of [s=>s.packages[0].reason='explicit',s=>s.packages[0].protected=true,s=>s.packages[1].receipt.dependencies={},s=>s.packages.shift()]){
    const s=JSON.parse(original);mutate(s);await writeJson(path.join(f.root,STATE),s);assert.throws(()=>loadRepository(f.root));
  }
  await fs.writeFile(path.join(f.root,STATE),original);assert.equal(packages(f).length,2);
});

// Graph tests are independent of filesystem timing and use reproducible seeds.
test('deterministic randomized DAG removals preserve all graph invariants and installation-order equivalence',()=>{
  for(const seed of [1,17,3003,0xdeadbeef]){
    let rng=seed;const next=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/2**32);
    for(let trial=0;trial<100;trial++){
      let nodes=Array.from({length:20},(_,i)=>({manifest:{id:'acme/p'+i,publisher:'acme',version:'1.0.0',dependencies:Object.fromEntries(Array.from({length:i},(_,j)=>j).filter(()=>next()<0.12).map(j=>['acme/p'+j,'^1']))},reason:next()<0.3?'explicit':'automatic',protected:next()<0.1}));
      while(nodes.length){const graph=packageGraph(nodes),roots=nodes.filter(n=>!n.protected&&!graph.reverse.get(n.manifest.id).length);if(!roots.length)break;
        const root=roots[Math.floor(next()*roots.length)],removed=removalOrder(nodes,root.manifest.id),reverse=removalOrder([...nodes].reverse(),root.manifest.id);
        assert.deepEqual([...removed].sort(),[...reverse].sort(),`seed=${seed} trial=${trial}`);
        for(const id of removed.slice(1)){const entry=graph.nodes.get(id);assert.equal(entry.reason,'automatic');assert.equal(entry.protected,false);}
        nodes=nodes.filter(n=>!removed.includes(n.manifest.id));packageGraph(nodes);
      }
    }
  }
});

async function interruptOperation(t,f,request,stage){
  const requestFile=path.join(f.root,'crash-request.json');await writeJson(requestFile,request);
  const child=spawn(process.execPath,['test-support/package-lifecycle-child.js',requestFile,stage],{stdio:['ignore','pipe','pipe','ipc']});
  let diagnostics='';child.stderr.on('data',chunk=>diagnostics+=chunk);
  t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Crash harness did not reach '+stage+': '+diagnostics));},10000);
    child.once('message',()=>{clearTimeout(timeout);resolve();});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Crash harness exited '+code+': '+diagnostics));});
  });
  const ended=once(child,'close');child.kill('SIGKILL');await ended;
}
for(const action of ['install','update','uninstall'])for(const stage of ['PLANNED','APPLYING','PUBLISHED'])test(`process termination during ${action}/${stage} recovers the exact publication boundary`,async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a');
  if(action!=='install')await packageOperation(f.operation('install','acme/a',[a]));
  const update=action==='update'?await f.candidate('a',{version:'1.1.0'}):a;
  await interruptOperation(t,f,f.operation(action,'acme/a',action==='uninstall'?[]:[update]),stage);
  assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});
  const result=await recoverPackageOperation({root:f.root,installationContext:f.context});
  assert.equal(result.status,stage==='PUBLISHED'?'COMPLETED':'FAILED');
  if(stage!=='PUBLISHED')await packageOperation(f.operation(action,'acme/a',action==='uninstall'?[]:[update]));
  if(action==='uninstall')assert.deepEqual(packages(f),[]);else assert.equal(state(f).packages[0].manifest.version,action==='update'?'1.1.0':'1.0.0');
  assert.equal((await fs.readdir(path.join(f.root,'content'))).some(name=>/^\.package-.*(?:tmp|lock)$/.test(name)),false);
});

test('failure after publication blocks startup and cannot be retried or recovered while writer lives',async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a');
  await assert.rejects(applyPackageOperation(await planPackageOperation(f.operation('install','acme/a',[a])),{atStage:stage=>{if(stage==='PUBLISHED')throw Error('disk failure after rename');}}),{code:'PACKAGE.RECOVERY'});
  assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});
  await assert.rejects(recoverPackageOperation({root:f.root,installationContext:f.context}),{code:'PACKAGE.BUSY'});
  assert.equal(inspectPackageOperation(f.root).status,'APPLYING');
});

test('foreign App additions remain retained and veto purge; foreign package attachments veto uninstall',async t=>{
  const f=await lifecycleFixture(t),a=await f.candidate('a'),b=await f.candidate('b');
  await packageOperation(f.operation('install','acme/a',[a]));await packageOperation(f.operation('install','acme/b',[b]));
  let s=state(f),app=JSON.parse(s.app),parent=app.slots.pages.find(p=>p.id==='page-a').slots.sections[0];
  parent.slots.blocks.push({schema:'wydgit/0.2',id:'pkg-site-content',prototype:'wydgit.core/block',properties:{content:{type:'markdown',value:'Site content'}},slots:{},provenance:{}});
  s.app=JSON.stringify(app);await writeJson(path.join(f.root,STATE),s);
  await packageOperation(f.operation('uninstall','acme/a'));assert.match(state(f).retained[0].attachments[0].instance,/Site content/);
  await assert.rejects(packageOperation(f.operation('purge','acme/a')),{code:'PACKAGE.OWNERSHIP'});
  await packageOperation(f.operation('install','acme/a',[a]));assert.equal(loadRepository(f.root).runtime.get('pkg-site-content').properties.content.value,'Site content');
  s=state(f);app=JSON.parse(s.app);const sectionB=app.slots.pages.find(p=>p.id==='page-b').slots.sections.shift();app.slots.pages.find(p=>p.id==='page-a').slots.sections[0].slots.blocks.push(sectionB);s.app=JSON.stringify(app);await writeJson(path.join(f.root,STATE),s);
  await assert.rejects(packageOperation(f.operation('uninstall','acme/a')),{code:'PACKAGE.OWNERSHIP'});
});

for(const provider of ['json','sqlite'])test(`${provider}: Guestbook lifecycle preserves configuration, content, navigation, mappings and approved authority`,async t=>{
  const f=await lifecycleFixture(t),configPath=path.join(f.root,'wydgit.config.json'),config=JSON.parse(await fs.readFile(configPath,'utf8'));
  config.libraries.find(l=>l.id==='wydstore').options.stores[0].provider=provider;await writeJson(configPath,config);
  const context=new ExecutionContext({...f.context,visible:[...f.context.visible,...f.manifest.permissions.visible],editable:[...f.context.editable,...f.manifest.permissions.visible]});
  const dep=await f.candidate('dep');await rewriteManifest(f.options,m=>{m.dependencies={'acme/dep':'^1'};m.version='1.0.0';});
  const options={...f.options,navigation:{id:'main-navigation',label:'Guestbook'}};
  const operation=(action,candidates=[])=>f.operation(action,'divdev/guestbook',candidates,{installationContext:context});
  await packageOperation(operation('install',[options,dep]));
  const {activatePackages}=await import('../wydgine/packages/index.js');
  const bindings=async()=>{const model=loadRepository(f.root),libraries=await initializeHost({root:f.root}),active=activatePackages(model,libraries,f.root);return {model,libraries,context:active.context({pageId:'home',session:{},ids:['home']})};};
  let active=await bindings();
  const created=await active.libraries.bind(active.context).call('wydstore','create',{store:'host-book',collection:'host-entries',id:'real-content',data:{name:'Ada',message:'Customer content'}});assert.equal(created.ok,true);
  let saved=state(f),app=JSON.parse(saved.app);app.slots.pages.find(p=>p.id==='home').slots.sections.find(s=>s.id==='guestbook').slots.blocks.find(n=>n.id==='guestbook-form').properties.label='Custom signup';saved.app=JSON.stringify(app);await writeJson(path.join(f.root,STATE),saved);
  await rewriteManifest(options,m=>m.version='1.1.0');await packageOperation(operation('update',[options]));
  await rewriteManifest(options,m=>m.version='2.0.0');await packageOperation(operation('upgrade',[options]));
  assert.equal(loadRepository(f.root).runtime.get('guestbook-form').properties.label,'Custom signup');
  await packageOperation(operation('uninstall'));assert.deepEqual(packages(f),[]);assert.equal(state(f).retained.length,2);
  assert.equal(loadRepository(f.root).runtime.get('main-navigation').properties.items.some(i=>i.label==='Guestbook'),false);
  await packageOperation(operation('install',[options,dep]));active=await bindings();
  assert.equal(active.model.runtime.get('guestbook-form').properties.label,'Custom signup');
  assert.deepEqual(active.context.capabilities,f.manifest.permissions.capabilities);
  const content=await active.libraries.bind(active.context).call('wydstore','get',{store:'host-book',collection:'host-entries',id:'real-content'});assert.equal(content.ok,true);assert.equal(content.value.data.message,'Customer content');
  assert.equal(active.model.runtime.get('main-navigation').properties.items.filter(i=>i.label==='Guestbook').length,1);
  await packageOperation(operation('uninstall'));
  const before=await readState(f);await assert.rejects(packageOperation(operation('purge')),{code:'PACKAGE.PURGE_UNSUPPORTED'});assert.equal(await readState(f),before);
});

test('pre-1.0 incompatible versions require upgrade, and downgrades are rejected',async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a',{version:'0.1.0'});await packageOperation(f.operation('install','acme/a',[a]));
 const next=await f.candidate('a',{version:'0.2.0'});
 await assert.rejects(packageOperation(f.operation('update','acme/a',[next])),{code:'PACKAGE.UPGRADE_REQUIRED'});
 await packageOperation(f.operation('upgrade','acme/a',[next]));
 const old=await f.candidate('a',{version:'0.1.9'});await assert.rejects(packageOperation(f.operation('upgrade','acme/a',[old])),{code:'PACKAGE.VERSION'});
});

test('namespace confusion, capability escalation, changed same-version sources and incompatible instance changes fail closed',async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a');await packageOperation(f.operation('install','acme/a',[a]));const original=await readState(f);
 const changed=await f.candidate('a');await fs.appendFile(path.join(changed.packagePath,'section.json'),'\n');
 await assert.rejects(packageOperation(f.operation('update','acme/a',[changed])),{code:'PACKAGE.VERSION'});
 const updated=await f.candidate('a',{version:'1.1.0'});await rewriteManifest(updated,m=>m.permissions.capabilities=['packages.lifecycle.manage']);updated.approvals.capabilities=['packages.lifecycle.manage'];
 await assert.rejects(packageOperation(f.operation('update','acme/a',[updated])),{code:'PACKAGE.DENIED'});
 const confused=await f.candidate('b',{dependencies:{'other/a':'^1'}});await assert.rejects(packageOperation(f.operation('install','acme/b',[confused,a])),{code:'PACKAGE.CONFLICT'});
 const footprint=await f.candidate('a',{version:'1.1.0'});const template=JSON.parse(await fs.readFile(path.join(footprint.packagePath,'section.json'),'utf8'));template.id='pkg-renamed';await writeJson(path.join(footprint.packagePath,'section.json'),template);await rewriteManifest(footprint,m=>m.permissions.visible=['pkg-renamed']);footprint.approvals.visible=['pkg-renamed'];
 await assert.rejects(packageOperation(f.operation('update','acme/a',[footprint])),{code:'PACKAGE.MIGRATION_REQUIRED'});
 assert.equal(await readState(f),original);
});

for(const action of ['update','uninstall'])test(`failure during ${action} and recursive dependency cleanup preserves every accepted receipt`,async t=>{
 const f=await lifecycleFixture(t),b=await f.candidate('b'),a=await f.candidate('a',{dependencies:{'acme/b':'^1'}});await packageOperation(f.operation('install','acme/a',[a,b]));
 const before=await readState(f),candidate=await f.candidate('a',{version:'1.1.0'}),request=f.operation(action,'acme/a',action==='update'?[candidate]:[]);
 await assert.rejects(applyPackageOperation(await planPackageOperation(request),{atStage:s=>{if(s==='APPLYING')throw Error('receipt write failed');}}),{code:'PACKAGE.STORAGE'});
 assert.equal(await readState(f),before);assert.equal(inspectPackageOperation(f.root).status,'FAILED');
 await packageOperation(request);assert.deepEqual(packages(f),action==='update'?['acme/a']:[]);
});

test('cancellation while applying never publishes a partial graph',async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a'),abort=new AbortController();
 const plan=await planPackageOperation(f.operation('install','acme/a',[a],{signal:abort.signal}));
 await assert.rejects(applyPackageOperation(plan,{atStage:s=>{if(s==='APPLYING')abort.abort();}}),{code:'PACKAGE.CANCELLED'});
 assert.equal(state(f),null);assert.equal(inspectPackageOperation(f.root).status,'FAILED');
});

test('retained malformed snapshots and a dangling operation-journal symlink fail closed',async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a');await packageOperation(f.operation('install','acme/a',[a]));await packageOperation(f.operation('uninstall','acme/a'));
 const original=await readState(f),invalid=JSON.parse(original);invalid.retained[0].attachments[0].instance='{}';await writeJson(path.join(f.root,STATE),invalid);assert.throws(()=>loadRepository(f.root));await fs.writeFile(path.join(f.root,STATE),original);
 const journal=path.join(f.root,'content/package-operation.json');await fs.unlink(journal);await fs.symlink(path.join(f.root,'missing'),journal);assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PATH'});
});

test('reviewable plans expose exact hashes, grants, mappings, retention and both graphs',async t=>{
 const f=await lifecycleFixture(t),b=await f.candidate('b'),a=await f.candidate('a',{dependencies:{'acme/b':'^1'}});
 const plan=await planPackageOperation(f.operation('install','acme/a',[a,b]));assert.equal(plan.installations.length,2);assert.equal(plan.beforeGraph.length,0);assert.equal(plan.afterGraph.length,2);
 assert.deepEqual(JSON.parse(JSON.stringify(plan.installations[1].approved)),a.approvals);assert.match(plan.installations[0].resources['section.json'].sha256,/^[a-f0-9]{64}$/);assert.equal(Object.isFrozen(plan.afterGraph),true);
 await applyPackageOperation(plan);const removal=await planPackageOperation(f.operation('uninstall','acme/a'));assert.equal(removal.retention.length,2);assert.equal(removal.afterGraph.length,0);
});

test('deterministic installed DAG sequences retain invariants across equivalent installation orders',async t=>{
 for(const seed of [7,109]){
  const f=await lifecycleFixture(t);let random=seed;const next=()=>((random=(Math.imul(random,1664525)+1013904223)>>>0)/2**32);
  const options=[];for(let i=0;i<8;i++){const dependencies=Object.fromEntries(Array.from({length:i},(_,j)=>j).filter(()=>next()<0.3).map(j=>['acme/p'+j,'^1']));options.push(await f.candidate('p'+i,{dependencies}));}
  const explicit=new Set();
  for(const i of [7,5,6,3]){await packageOperation(f.operation('install','acme/p'+i,options));explicit.add('acme/p'+i);const graph=packageGraph(state(f).packages);for(const id of explicit)assert.equal(graph.nodes.get(id).reason,'explicit',`seed ${seed}`);}
  for(const i of [7,6,5,3]){const id='acme/p'+i,graph=packageGraph(state(f).packages);if(graph.reverse.get(id)?.length)continue;await packageOperation(f.operation('uninstall',id));explicit.delete(id);packageGraph(state(f).packages);for(const kept of explicit)assert.ok(packages(f).includes(kept));}
  for(const entry of state(f).packages)assert.equal(entry.reason,'explicit',`seed ${seed}: no eligible reachable orphan remains`);
 }
});

test('reinstall cannot replace retained same-version artifacts with altered sources',async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a');await packageOperation(f.operation('install','acme/a',[a]));await packageOperation(f.operation('uninstall','acme/a'));
 const before=await readState(f);await fs.appendFile(path.join(a.packagePath,'section.json'),'\n');
 await assert.rejects(packageOperation(f.operation('install','acme/a',[a])),{code:'PACKAGE.VERSION'});assert.equal(await readState(f),before);
});

for(const failure of ['finalization','failure-record','temporary-cleanup'])test(`${failure} I/O failure retains recovery evidence and never reports success`,async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a'),plan=await planPackageOperation(f.operation('install','acme/a',[a]));
 const rename=fs.rename,unlink=fs.unlink;let journalWrites=0;
 t.mock.method(fs,'rename',async(...args)=>{if(args[1]===path.join(f.root,'content/package-operation.json')){journalWrites++;if(failure==='finalization'&&journalWrites===3||failure==='failure-record'&&journalWrites===2)throw Object.assign(Error('disk error'),{code:'EIO'});}return rename(...args);});
 t.mock.method(fs,'unlink',async(...args)=>{if(failure==='temporary-cleanup'&&/\.package-[a-f0-9-]+\.tmp$/.test(args[0]))throw Object.assign(Error('cleanup failed'),{code:'EIO'});return unlink(...args);});
 await assert.rejects(applyPackageOperation(plan,{atStage:stage=>{if(stage==='PLANNED'&&failure==='failure-record'||stage==='APPLYING'&&failure==='temporary-cleanup')throw Error('injected failure');}}),{code:'PACKAGE.RECOVERY'});
 assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});assert.ok(inspectPackageOperation(f.root));
 if(failure==='finalization')assert.equal(JSON.parse(await readState(f)).packages.length,1);
 else await assert.rejects(fs.stat(path.join(f.root,STATE)),{code:'ENOENT'});
});

for(const first of ['update','uninstall'])test(`shared dependency upgrade racing uninstall: ${first} publishes, competitor is stale`,async t=>{
 const f=await lifecycleFixture(t),b=await f.candidate('b'),a=await f.candidate('a',{dependencies:{'acme/b':'^1'}});await packageOperation(f.operation('install','acme/a',[a,b]));
 const update=await planPackageOperation(f.operation('update','acme/b',[await f.candidate('b',{version:'1.1.0'})])),uninstall=await planPackageOperation(f.operation('uninstall','acme/a'));
 await applyPackageOperation(first==='update'?update:uninstall);await assert.rejects(applyPackageOperation(first==='update'?uninstall:update),{code:'PACKAGE.STALE'});packageGraph(state(f).packages);
});

test('zero elapsed budget fails distinctly before any lifecycle write',async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a'),context=new ExecutionContext({...f.context,limits:{packageTimeMs:0}});
 await assert.rejects(packageOperation(f.operation('install','acme/a',[a],{installationContext:context})),{code:'PACKAGE.LIMIT'});assert.equal(state(f),null);assert.equal(inspectPackageOperation(f.root),null);
});

test('unreadable package sources and malformed retained metadata fail with structured errors',async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a');
 await assert.rejects(packageOperation(f.operation('install','acme/a',[{...a,packagePath:path.join(f.root,'absent')}])),{code:'PACKAGE.SOURCE'});
 await packageOperation(f.operation('install','acme/a',[a]));await packageOperation(f.operation('uninstall','acme/a'));const before=await readState(f);
 for(const retained of [[null],[{}],[{entry:{},attachments:[]}]]){const s=JSON.parse(before);s.retained=retained;await writeJson(path.join(f.root,STATE),s);assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.CATALOG'});}
});

test('competing installs and uninstalls of a shared dependency reconcile without duplicate or premature removal',async t=>{
 const f=await lifecycleFixture(t),c=await f.candidate('c'),a=await f.candidate('a',{dependencies:{'acme/c':'^1'}}),b=await f.candidate('b',{dependencies:{'acme/c':'^1'}});
 const first=await planPackageOperation(f.operation('install','acme/a',[a,c])),competing=await planPackageOperation(f.operation('install','acme/b',[b,c]));
 let enter,release;const ready=new Promise(r=>enter=r),hold=new Promise(r=>release=r);
 const running=applyPackageOperation(first,{atStage:async s=>{if(s==='APPLYING'){enter();await hold;}}});await ready;
 try{await assert.rejects(applyPackageOperation(competing),{code:'PACKAGE.BUSY'});}finally{release();}await running;
 const receipt=state(f).packages.find(p=>p.manifest.id==='acme/c').receipt.id;
 await packageOperation(f.operation('install','acme/b',[b]));assert.deepEqual(packages(f),['acme/a','acme/b','acme/c']);assert.equal(state(f).packages.find(p=>p.manifest.id==='acme/c').receipt.id,receipt);
 const removeA=await planPackageOperation(f.operation('uninstall','acme/a')),removeB=await planPackageOperation(f.operation('uninstall','acme/b'));
 await applyPackageOperation(removeA);assert.deepEqual(packages(f),['acme/b','acme/c']);await assert.rejects(applyPackageOperation(removeB),{code:'PACKAGE.STALE'});
 await packageOperation(f.operation('uninstall','acme/b'));assert.deepEqual(packages(f),[]);assert.equal(state(f).retained.length,3);
});

test('dependency ranges retain standard semver prerelease exclusion unless explicitly requested',async t=>{
 const f=await lifecycleFixture(t),b=await f.candidate('b',{version:'1.1.0-alpha.2'}),a=await f.candidate('a',{dependencies:{'acme/b':'^1'}});
 await assert.rejects(packageOperation(f.operation('install','acme/a',[a,b])),{code:'PACKAGE.CONFLICT'});assert.equal(state(f),null);
 await rewriteManifest(a,m=>m.dependencies={'acme/b':'^1.1.0-alpha.1'});await packageOperation(f.operation('install','acme/a',[a,b]));
 assert.equal(state(f).packages.find(p=>p.manifest.id==='acme/b').manifest.version,'1.1.0-alpha.2');packageGraph(state(f).packages);
});
