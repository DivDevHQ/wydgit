import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { interruptedEffects, provisionFixture } from '../test-support/package-effects.js';
import { planOperatorInstall, applyOperatorInstall } from '../scripts/package-infrastructure.js';
import { recoverPackageEffects, inspectPackageEffects } from '../wydgine/packages/index.js';
import { initializeHost } from '../wydgine/host.js';
import { loadRepository } from '../wydgine/repository.js';
import { snapshotStore } from '../packages/wydstore/src/lifecycle.js';

for(const provider of ['json','sqlite'])for(const stage of ['PLANNED','DIRECTORY','APPLYING','STORE_SCHEMA','STORE_STAGED','RESOURCE_0','CONFIG','CATALOG','COMPENSATING_RESOURCE_0'])test(`${provider}: provisioning SIGKILL at ${stage} reconciles resources and accepted App`,async t=>{
  const f=await provisionFixture(t,provider),before=await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8');
  await interruptedEffects(t,f.root,{kind:'provision',options:f.options,pauseAt:stage,...(stage.startsWith('COMPENSATING')?{failAt:'BEFORE_CONFIG'}:{})});
  assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});
  const result=await recoverPackageEffects({root:f.root,installationContext:f.context});
  assert.equal(result.status,stage==='CATALOG'?'COMPLETED':'ROLLED_BACK');
  if(stage!=='CATALOG'){
    assert.equal(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8'),before);
    await assert.rejects(fs.stat(path.join(f.root,'.wydgit-data')),{code:'ENOENT'});
    await applyOperatorInstall(await planOperatorInstall(f.options));
  }
  const model=loadRepository(f.root);assert.equal(model.runtime.get('guestbook-form').properties.label,'Configured form');
  assert.equal(model.runtime.get('main-navigation').properties.items.filter(i=>i.label==='Provisioned').length,1);
  assert.equal(model.runtime.get('page-book').slots.sections.length,1);
  await initializeHost({root:f.root});
  const config=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8')),store=config.libraries.find(l=>l.id==='wydstore').options.stores[0];
  assert.deepEqual((await snapshotStore(store)).collections.entries.records,[]);
  assert.equal(inspectPackageEffects(f.root).status,'COMPLETED');
});
for(const provider of ['json','sqlite'])test(`${provider}: interrupted recovery resumes idempotently after reclaiming its dead writer marker`,async t=>{
  const f=await provisionFixture(t,provider);
  await interruptedEffects(t,f.root,{kind:'provision',options:f.options,pauseAt:'RESOURCE_0'});
  await interruptedEffects(t,f.root,{kind:'recover',options:{root:f.root,installationContext:f.context,direction:'resume'},pauseAt:'UNLOCKED'});
  await recoverPackageEffects({root:f.root,installationContext:f.context,direction:'resume'});
  assert.equal(loadRepository(f.root).runtime.get('guestbook-form').properties.label,'Configured form');await initializeHost({root:f.root});
});
test('unknown contents during compensation are retained with durable recovery evidence',async t=>{
  const f=await provisionFixture(t,'json');
  await interruptedEffects(t,f.root,{kind:'provision',options:f.options,pauseAt:'RESOURCE_0'});
  const foreign=path.join(f.root,'.wydgit-data/book/site-content.txt');await fs.writeFile(foreign,'Preserve me');
  await assert.rejects(recoverPackageEffects({root:f.root,installationContext:f.context}),{code:'PACKAGE.OWNERSHIP'});
  assert.equal(await fs.readFile(foreign,'utf8'),'Preserve me');assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});
});
test('live writers and unauthorized callers cannot recover provisioning',async t=>{
  const f=await provisionFixture(t,'json');
  await assert.rejects(applyOperatorInstall(await planOperatorInstall(f.options),{atStage:stage=>{if(stage==='BEFORE_CONFIG'||stage==='COMPENSATING_RESOURCE_0')throw Error('Injected compensation failure');}}),{code:'PACKAGE.RECOVERY'});
  await assert.rejects(recoverPackageEffects({root:f.root,installationContext:f.options.installationContext}),{code:'PACKAGE.BUSY'});
  const {ExecutionContext}=await import('../wydgine/seam/context.js');
  const denied=new ExecutionContext({context:'FrontEnd',publisher:'acme',package:'acme/a',app:'boilerplate',self:'home',capabilities:['packages.lifecycle.manage']});
  await assert.rejects(recoverPackageEffects({root:f.root,installationContext:denied}),{code:'PACKAGE.DENIED'});
});

for(const provider of ['json','sqlite'])test(`${provider}: competing recovery calls serialize without stealing a live recovery marker`,async t=>{
  const f=await provisionFixture(t,provider);
  await interruptedEffects(t,f.root,{kind:'provision',options:f.options,pauseAt:'RESOURCE_0'});
  let enter,release;const entered=new Promise(r=>enter=r),hold=new Promise(r=>release=r);
  const running=recoverPackageEffects({root:f.root,installationContext:f.context,direction:'resume',atStage:async stage=>{if(stage==='APPLYING'){enter();await hold;}}});await entered;
  try{await assert.rejects(recoverPackageEffects({root:f.root,installationContext:f.context,direction:'resume'}),{code:'PACKAGE.BUSY'});}finally{release();}
  await running;assert.equal((await recoverPackageEffects({root:f.root,installationContext:f.context})).status,'COMPLETED');assert.equal(loadRepository(f.root).runtime.get('guestbook-form').properties.label,'Configured form');
});

test('a directory created after provisioning planning cannot be adopted or deleted',async t=>{
  const f=await provisionFixture(t,'json'),resolved=await planOperatorInstall(f.options),directory=resolved.roots[0];
  await fs.mkdir(directory,{recursive:true});
  await assert.rejects(applyOperatorInstall(resolved),{code:'PACKAGE.STALE'});
  assert.equal((await fs.stat(directory)).isDirectory(),true);assert.deepEqual(await fs.readdir(directory),[]);assert.equal(loadRepository(f.root).installed,null);
});

test('SQLite: SIGKILL inside native schema creation recovers the owned private scratch database',async t=>{
  const f=await provisionFixture(t,'sqlite');
  await interruptedEffects(t,f.root,{kind:'provision',options:f.options,pauseAt:'SQLITE_SCHEMA_TRANSACTION',nativeBoundary:'sqlite-schema'});
  await recoverPackageEffects({root:f.root,installationContext:f.context});
  await assert.rejects(fs.stat(path.join(f.root,'.wydgit-data')),{code:'ENOENT'});
  await applyOperatorInstall(await planOperatorInstall(f.options));await initializeHost({root:f.root});
});
