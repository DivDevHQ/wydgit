import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { storedFixture, interruptedEffects } from '../test-support/package-effects.js';
import { packageOperation, planPackageOperation, applyPackageOperation, recoverPackageEffects, inspectPackageEffects } from '../wydgine/packages/index.js';
import { readInstalledState } from '../wydgine/packages/state.js';
import { snapshotStore, checkpointHash, storeFile } from '../packages/wydstore/src/lifecycle.js';
const authorization={package:'acme/a',content:true};
for(const provider of ['json','sqlite'])test(`${provider}: full lifecycle ends in explicit owned-store purge with a private recovery checkpoint`,async t=>{
  const f=await storedFixture(t,provider);
  await packageOperation(f.operation('update','acme/a',[await f.version('1.1.0')]));
  await packageOperation(f.operation('upgrade','acme/a',[await f.version('2.0.0',f.target)],{migrations:[{...f.migration(),from:'1.1.0'}]}));
  await packageOperation(f.operation('uninstall','acme/a'));
  const retained=readInstalledState(f.root).retained[0];assert.equal(retained.entry.manifest.version,'2.0.0');
  await packageOperation(f.operation('install','acme/a',[await f.version('2.0.0',f.target)]));
  const service=await f.binding();assert.equal((await service.call('wydstore','get',f.input)).value.data.body,'Customer edit');
  await packageOperation(f.operation('uninstall','acme/a'));
  await assert.rejects(packageOperation(f.operation('purge','acme/a')),{code:'PACKAGE.PURGE_UNSUPPORTED'});
  const options=f.operation('purge','acme/a',[],{purgeAuthorization:authorization}),plan=await planPackageOperation(options);
  assert.equal(plan.resources[0].owner.package,'acme/a');assert.equal(plan.resources[0].after,null);
  const result=await applyPackageOperation(plan);
  assert.equal(readInstalledState(f.root).retained.length,0);await assert.rejects(fs.stat(storeFile(f.store)),{code:'ENOENT'});
  const config=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8'));assert.equal(config.libraries.find(l=>l.id==='wydstore').options.stores.length,0);
  const checkpoint=path.join(f.root,'content',result.checkpoint);assert.equal((await fs.stat(checkpoint)).mode&0o777,0o600);assert.match(await fs.readFile(checkpoint,'utf8'),/Customer edit/);
  assert.equal(inspectPackageEffects(f.root).status,'COMPLETED');assert.equal((await service.call('wydstore','get',f.input)).ok,false);
});
for(const provider of ['json','sqlite'])for(const stage of ['PLANNED','RESOURCE_0','CONFIG','CATALOG','COMPENSATING_RESOURCE_0'])test(`${provider}: purge SIGKILL at ${stage} preserves or deletes the complete owned store`,async t=>{
  const f=await storedFixture(t,provider),before=checkpointHash(await snapshotStore(f.store));
  await packageOperation(f.operation('uninstall','acme/a'));
  const options=f.operation('purge','acme/a',[],{purgeAuthorization:authorization});
  await interruptedEffects(t,f.root,{kind:'operation',options,pauseAt:stage,...(stage.startsWith('COMPENSATING')?{failAt:'BEFORE_CONFIG'}:{})});
  await recoverPackageEffects({root:f.root,installationContext:f.context});
  if(stage==='CATALOG'){assert.equal(readInstalledState(f.root).retained.length,0);await assert.rejects(fs.stat(storeFile(f.store)),{code:'ENOENT'});}
  else{assert.equal(readInstalledState(f.root).retained.length,1);assert.equal(checkpointHash(await snapshotStore(f.store)),before);await packageOperation(options);}
});
for(const provider of ['json','sqlite'])test(`${provider}: a package cannot purge an unmapped collection, even with content approval`,async t=>{
  const f=await storedFixture(t,provider,{extraCollection:true}),before=checkpointHash(await snapshotStore(f.store));
  await packageOperation(f.operation('uninstall','acme/a'));
  await assert.rejects(packageOperation(f.operation('purge','acme/a',[],{purgeAuthorization:authorization})),{code:'PACKAGE.OWNERSHIP'});
  assert.equal(checkpointHash(await snapshotStore(f.store)),before);
});
for(const approval of [{package:'other/a',content:true},{package:'acme/a',content:false},{package:'acme/a',content:true,force:true}])test('purge rejects ambiguous or mismatched content approval',async t=>{
  const f=await storedFixture(t,'json'),before=checkpointHash(await snapshotStore(f.store));await packageOperation(f.operation('uninstall','acme/a'));
  await assert.rejects(packageOperation(f.operation('purge','acme/a',[],{purgeAuthorization:approval})),{code:'PACKAGE.PURGE_UNSUPPORTED'});assert.equal(checkpointHash(await snapshotStore(f.store)),before);
});
