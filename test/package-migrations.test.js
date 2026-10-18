import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { storedFixture, interruptedEffects } from '../test-support/package-effects.js';
import { writeJson } from '../test-support/package-lifecycle.js';
import { planPackageOperation, applyPackageOperation, packageOperation, recoverPackageEffects, rollbackPackageEffects, inspectPackageEffects } from '../wydgine/packages/index.js';
import { STATE, readInstalledState } from '../wydgine/packages/state.js';
import { loadRepository } from '../wydgine/repository.js';
import { snapshotStore, checkpointHash, storeFile } from '../packages/wydstore/src/lifecycle.js';

for(const provider of ['json','sqlite'])test(`${provider}: ordered schema/data and incompatible property migrations retain records, history, settings and rollback`,async t=>{
  const f=await storedFixture(t,provider),original=await snapshotStore(f.store),s=readInstalledState(f.root),app=JSON.parse(s.app);
  app.slots.pages.find(p=>p.id==='page-a').slots.sections[0].properties.setting='Site owner choice';s.app=JSON.stringify(app);await writeJson(path.join(f.root,STATE),s);
  const candidate=await f.version('2.0.0',f.target,{renamedInstance:true}),migration=f.migration();
  migration.instances=[{id:'pkg-a',fromPrototype:'acme/a',toPrototype:'acme/a',properties:[{op:'rename',from:'setting',to:'setting2'}]}];
  const options=f.operation('upgrade','acme/a',[candidate],{migrations:[migration]}),plan=await planPackageOperation(options);
  assert.equal(plan.resources.length,1);assert.equal(plan.resources[0].before,checkpointHash(original));assert.equal(plan.migrations[0].schema,'wydgit.package-migration/1');
  assert.equal((await snapshotStore(f.store)).collections.records.records[0].data.text,'Customer edit');
  await applyPackageOperation(plan);
  const accepted=readInstalledState(f.root);assert.equal(accepted.packages[0].receipt.baseFingerprint,accepted.baseFingerprint);
  assert.equal(loadRepository(f.root).runtime.get('pkg-a').properties.setting2,'Site owner choice');
  const binding=await f.binding(),history=await binding.call('wydstore','history',f.input);
  assert.equal(history.ok,true);assert.deepEqual(history.value.map(h=>h.data.body),['Original content','Customer edit']);assert.deepEqual(history.value.map(h=>h.version),[1,2]);
  assert.equal(inspectPackageEffects(f.root).status,'COMPLETED');
  await rollbackPackageEffects({root:f.root,installationContext:f.context});
  assert.equal(readInstalledState(f.root).packages[0].manifest.version,'1.0.0');
  assert.equal(loadRepository(f.root).runtime.get('pkg-a').properties.setting,'Site owner choice');
  assert.equal(checkpointHash(await snapshotStore(f.store)),checkpointHash(original));
});
for(const provider of ['json','sqlite'])for(const stage of ['PLANNED','RESOURCE_0','CONFIG','CATALOG','COMPENSATING_RESOURCE_0'])test(`${provider}: migration SIGKILL at ${stage} restores or commits exactly once`,async t=>{
  const f=await storedFixture(t,provider),original=checkpointHash(await snapshotStore(f.store)),candidate=await f.version('2.0.0',f.target),migration=f.migration();
  const options=f.operation('upgrade','acme/a',[candidate],{migrations:[migration]});
  await interruptedEffects(t,f.root,{kind:'operation',options,pauseAt:stage,...(stage.startsWith('COMPENSATING')?{failAt:'BEFORE_CONFIG'}:{})});
  assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});
  const result=await recoverPackageEffects({root:f.root,installationContext:f.context});
  assert.equal(result.status,stage==='CATALOG'?'COMPLETED':'ROLLED_BACK');
  if(stage!=='CATALOG'){
    assert.equal(checkpointHash(await snapshotStore(f.store)),original);
    assert.equal(readInstalledState(f.root).packages[0].manifest.version,'1.0.0');
    await packageOperation(options);
  }
  const service=await f.binding(),history=await service.call('wydstore','history',f.input);
  assert.equal(history.ok,true);assert.deepEqual(history.value.map(h=>h.data.body),['Original content','Customer edit']);
});
for(const provider of ['json','sqlite'])test(`${provider}: multiple ordered transitions include defaults and preserve tombstones`,async t=>{
  const f=await storedFixture(t,provider),service=await f.binding();
  assert.equal((await service.call('wydstore','delete',{...f.input,version:2})).ok,true);
  const intermediate={text:{type:'string',required:true},label:{type:'string',default:'Imported'}};
  const fields={body:{type:'string',required:true},label:{type:'string',default:'Imported'}};
  const candidate=await f.version('2.0.0',{...f.target,schemaVersion:3,fields});
  const first={...f.migration('1.1.0'),storage:[{name:'entries',from:1,to:2,fields:intermediate,operations:[{op:'default',field:'label',value:'Imported'}]}]};
  const second={...f.migration(),from:'1.1.0',storage:[{name:'entries',from:2,to:3,fields,operations:[{op:'rename',from:'text',to:'body'}]}]};
  await packageOperation(f.operation('upgrade','acme/a',[candidate],{migrations:[first,second]}));
  const history=await (await f.binding()).call('wydstore','history',f.input);
  assert.equal(history.ok,true);assert.deepEqual(history.value.map(h=>h.version),[1,2,3]);assert.equal(history.value[2].deleted,true);assert.equal(history.value[2].data,null);assert.equal(history.value[0].data.label,'Imported');
});
for(const defect of ['order','gap','wrong-target','raw-hook','destructive','foreign-instance','collision','foreign-package','excess'])test(`migration rejects ${defect} without altering accepted records or configuration`,async t=>{
  const f=await storedFixture(t,'json'),before=checkpointHash(await snapshotStore(f.store)),config=await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8'),state=await fs.readFile(path.join(f.root,STATE),'utf8');
  const candidate=await f.version('2.0.0',f.target),migration=f.migration();
  if(defect==='order')migration.from='0.9.0';
  if(defect==='gap')migration.storage[0].to=3;
  if(defect==='wrong-target')migration.to='1.1.0';
  if(defect==='raw-hook')migration.storage[0].operations=[{op:'javascript',source:'process.exit()'}];
  if(defect==='destructive')migration.storage[0].operations=[{op:'drop',field:'text'}];
  if(defect==='foreign-instance')migration.instances=[{id:'home',fromPrototype:'wydgit.core/page',toPrototype:'acme/a',properties:[]}];
  if(defect==='collision')migration.storage[0].operations=[{op:'default',field:'body',value:'Do not overwrite'},{op:'rename',from:'text',to:'body'}];
  if(defect==='foreign-package')migration.package='foreign/a';
  const migrations=defect==='excess'?Array(33).fill(migration):[migration];
  await assert.rejects(packageOperation(f.operation('upgrade','acme/a',[candidate],{migrations})),e=>e.code.startsWith('PACKAGE.'));
  assert.equal(checkpointHash(await snapshotStore(f.store)),before);assert.equal(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8'),config);assert.equal(await fs.readFile(path.join(f.root,STATE),'utf8'),state);
});
for(const provider of ['json','sqlite'])test(`${provider}: rollback refuses to discard writes after the committed upgrade`,async t=>{
  const f=await storedFixture(t,provider),candidate=await f.version('2.0.0',f.target);
  await packageOperation(f.operation('upgrade','acme/a',[candidate],{migrations:[f.migration()]}));
  const service=await f.binding();assert.equal((await service.call('wydstore','update',{...f.input,version:2,data:{body:'New live content'}})).ok,true);
  await assert.rejects(rollbackPackageEffects({root:f.root,installationContext:f.context}),{code:'PACKAGE.STALE'});
  assert.equal(loadRepository(f.root).installed.packages[0].manifest.version,'2.0.0');
  // Drift is preserved behind the barrier for explicit reconciliation.
  const config=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8'));
  assert.equal((await snapshotStore(config.libraries.find(l=>l.id==='wydstore').options.stores[0])).collections.records.records[0].data.body,'New live content');
});

for(const provider of ['json','sqlite'])test(`${provider}: SIGKILL inside the adapter replacement restores history and removes only its named temporary file`,async t=>{
  const f=await storedFixture(t,provider),before=checkpointHash(await snapshotStore(f.store)),candidate=await f.version('2.0.0',f.target);
  const foreign=path.join(f.store.root,'host-owned.txt');await fs.writeFile(foreign,'Preserve');
  await interruptedEffects(t,f.root,{kind:'operation',options:f.operation('upgrade','acme/a',[candidate],{migrations:[f.migration()]}),pauseAt:'NATIVE_REPLACEMENT',nativeBoundary:provider==='json'?'json-replace':'sqlite-replace'});
  await recoverPackageEffects({root:f.root,installationContext:f.context});
  assert.equal(checkpointHash(await snapshotStore(f.store)),before);assert.equal(await fs.readFile(foreign,'utf8'),'Preserve');
  assert.equal((await fs.readdir(f.store.root)).some(n=>n.endsWith('.tmp')),false);
});
