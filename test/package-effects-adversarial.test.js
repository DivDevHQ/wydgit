import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { storedFixture } from '../test-support/package-effects.js';
import { planPackageOperation, applyPackageOperation, packageOperation } from '../wydgine/packages/index.js';
import { readInstalledState } from '../wydgine/packages/state.js';
import { snapshotStore, checkpointHash, storeFile } from '../packages/wydstore/src/lifecycle.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createExecutionBudget, executionBudget } from '../wydgine/sewn/budget.js';
import { loadRepository } from '../wydgine/repository.js';

for(const provider of ['json','sqlite'])test(`${provider}: content drift after migration planning refuses before publication and leaves the App usable`,async t=>{
  const f=await storedFixture(t,provider),candidate=await f.version('2.0.0',f.target);
  const plan=await planPackageOperation(f.operation('upgrade','acme/a',[candidate],{migrations:[f.migration()]}));
  const binding=await f.binding();assert.equal((await binding.call('wydstore','update',{...f.input,version:2,data:{text:'Concurrent content'}})).ok,true);
  await assert.rejects(applyPackageOperation(plan),{code:'PACKAGE.STALE'});
  assert.equal(loadRepository(f.root).installed.packages[0].manifest.version,'1.0.0');assert.equal((await snapshotStore(f.store)).collections.records.records[0].data.text,'Concurrent content');
});
for(const provider of ['json','sqlite'])test(`${provider}: migration and uninstall serialize without losing shared state`,async t=>{
  const f=await storedFixture(t,provider),candidate=await f.version('2.0.0',f.target);
  const one=await planPackageOperation(f.operation('upgrade','acme/a',[candidate],{migrations:[f.migration()]})),two=await planPackageOperation(f.operation('uninstall','acme/a'));
  let enter,release;const entered=new Promise(r=>enter=r),hold=new Promise(r=>release=r);
  const running=applyPackageOperation(one,{atStage:async stage=>{if(stage==='APPLYING'){enter();await hold;}}});await entered;
  try{await assert.rejects(applyPackageOperation(two),{code:'PACKAGE.BUSY'});}finally{release();}
  await running;assert.equal(readInstalledState(f.root).packages[0].manifest.version,'2.0.0');
  assert.equal((await (await f.binding()).call('wydstore','get',f.input)).value.data.body,'Customer edit');
});
for(const provider of ['json','sqlite'])test(`${provider}: cancellation after storage application compensates without resetting parent accounting`,async t=>{
  const f=await storedFixture(t,provider),candidate=await f.version('2.0.0',f.target),before=checkpointHash(await snapshotStore(f.store)),abort=new AbortController();
  const parent=createExecutionBudget(f.context),{createPackageBudget}=await import('../wydgine/packages/index.js'),budget=createPackageBudget(f.context,{parentBudget:parent,signal:abort.signal});
  const plan=await planPackageOperation(f.operation('upgrade','acme/a',[candidate],{migrations:[f.migration()],budget}));
  await assert.rejects(applyPackageOperation(plan,{atStage:stage=>{if(stage==='RESOURCE_0')abort.abort();}}),{code:'PACKAGE.CANCELLED'});
  assert.equal(checkpointHash(await snapshotStore(f.store)),before);assert.equal(readInstalledState(f.root).packages[0].manifest.version,'1.0.0');assert.ok(executionBudget(parent,f.context).snapshot().steps>0);
});
for(const provider of ['json','sqlite'])test(`${provider}: forged adapter ownership cannot authorize physical deletion`,async t=>{
  const f=await storedFixture(t,provider);await packageOperation(f.operation('uninstall','acme/a'));
  const file=storeFile(f.store);
  if(provider==='json'){const doc=JSON.parse(await fs.readFile(file,'utf8'));doc.owner.package='other/keep';await fs.writeFile(file,JSON.stringify(doc));}
  else{const {default:Database}=await import('better-sqlite3'),db=new Database(file);const owner=JSON.parse(db.prepare('SELECT owner FROM metadata').get().owner);owner.package='other/keep';db.prepare('UPDATE metadata SET owner = ?').run(JSON.stringify(owner));db.close();}
  const before=await fs.readFile(file);
  await assert.rejects(packageOperation(f.operation('purge','acme/a',[],{purgeAuthorization:{package:'acme/a',content:true}})),e=>e.code==='STORE.CORRUPT');assert.deepEqual(await fs.readFile(file),before);assert.equal(readInstalledState(f.root).retained.length,1);
});
for(const link of ['symlink','hardlink'])test(`${link}: purge refuses linked store files and preserves foreign data`,async t=>{
  const f=await storedFixture(t,'json');await packageOperation(f.operation('uninstall','acme/a'));
  const file=storeFile(f.store),foreign=path.join(f.root,'private-content');await fs.rename(file,foreign);
  if(link==='symlink')await fs.symlink(foreign,file);else await fs.link(foreign,file);
  const before=await fs.readFile(foreign);
  await assert.rejects(packageOperation(f.operation('purge','acme/a',[],{purgeAuthorization:{package:'acme/a',content:true}})),{code:'STORE.CORRUPT'});assert.deepEqual(await fs.readFile(foreign),before);
});
test('oversized migration approvals and package principals cannot reach adapter mutation',async t=>{
  const f=await storedFixture(t,'json'),candidate=await f.version('2.0.0',f.target),migration=f.migration();migration.storage[0].operations=[{op:'default',field:'large',value:'x'.repeat(65536)}];
  await assert.rejects(packageOperation(f.operation('upgrade','acme/a',[candidate],{migrations:[migration]})),{code:'PACKAGE.LIMIT'});
  const denied=new ExecutionContext({context:'FrontEnd',publisher:'acme',package:'acme/a',app:'boilerplate',self:'pkg-a',capabilities:['packages.lifecycle.manage']});
  await assert.rejects(packageOperation(f.operation('upgrade','acme/a',[candidate],{migrations:[f.migration()],installationContext:denied})),{code:'PACKAGE.DENIED'});
  assert.equal((await snapshotStore(f.store)).collections.records.records[0].data.text,'Customer edit');
});

for(const provider of ['json','sqlite'])test(`${provider}: even an unchanged schema cannot silently rebind an installation-owned store`,async t=>{
  const f=await storedFixture(t,provider),configFile=path.join(f.root,'wydgit.config.json'),stateFile=path.join(f.root,'content/installed-packages.json');
  const config=JSON.parse(await fs.readFile(configFile,'utf8')),state=readInstalledState(f.root),before=await fs.readFile(storeFile(f.store));
  // Simulate a host's explicit accepted installation-binding reconciliation.
  // An update must reject that identity transition before inspecting providers.
  config.libraries.find(l=>l.id==='wydstore').options.stores[0].installation=state.packages[0].receipt.id;await fs.writeFile(configFile,JSON.stringify(config));
  const {baseFingerprint}=await import('../wydgine/packages/state.js');state.baseFingerprint=baseFingerprint(f.root);await fs.writeFile(stateFile,JSON.stringify(state));
  await assert.rejects(packageOperation(f.operation('update','acme/a',[await f.version('1.1.0')])),{code:'PACKAGE.MIGRATION_REQUIRED'});
  assert.equal(readInstalledState(f.root).packages[0].manifest.version,'1.0.0');assert.deepEqual(await fs.readFile(storeFile(f.store)),before);
});
