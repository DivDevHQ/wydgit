import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { developerFixture, sealStep, approveRequest } from '../test-support/developer-migrations.js';
import { manualReplacement, planManualReplacement, applyPackageOperation, inspectManualReplacement, packageOperation, recoverPackageEffects, rollbackPackageEffects } from '../wydgine/packages/index.js';
import { readInstalledState } from '../wydgine/packages/state.js';
import { loadRepository } from '../wydgine/repository.js';
import { snapshotStore } from '../packages/wydstore/src/trusted-lifecycle.js';
import { interruptedEffects } from '../test-support/package-effects.js';
const request=(f,action,extra={})=>({schema:'wydgit.manual-replacement-request/1',root:f.root,package:'acme/a',installationContext:f.context,action,...(['stage','references','migrate'].includes(action)?{candidates:[f.candidate],developerMigrations:f.request}:{}),...extra});
const inspect=f=>inspectManualReplacement({root:f.root,installationContext:f.context});
const run=(f,action,extra)=>manualReplacement(request(f,action,extra));
const refs=f=>inspect(f).pending.preview.references;
async function staged(f){await run(f,'retire');await run(f,'stage');}
const image=async f=>({state:readInstalledState(f.root),data:await snapshotStore(f.store),config:await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8')});

for(const provider of ['json','sqlite'])test(`${provider}: manual retire, stage, prepare, migrate, activate and rollback`,async t=>{
 const f=await developerFixture(t,provider,{chain:true}),before=await image(f);
 await run(f,'retire');const retired=readInstalledState(f.root);
 assert.equal(retired.app,before.state.app);assert.deepEqual(retired.packages,before.state.packages);assert.deepEqual(await snapshotStore(f.store),before.data);
 assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PENDING'});
 await run(f,'stage');assert.equal(inspect(f).pending.status,'STAGED');assert.equal(readInstalledState(f.root).app,before.state.app);
 await assert.rejects(run(f,'migrate'),{code:'PACKAGE.PENDING'});
 await run(f,'references',{references:refs(f)});assert.equal(inspect(f).pending.status,'REFERENCES_PREPARED');
 assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PENDING'});
 const plan=await planManualReplacement(request(f,'migrate'));assert.deepEqual(plan.manual.preview.references,[{id:'pkg-a',fromPrototype:'acme/a',toPrototype:'acme/a'}]);
 await applyPackageOperation(plan);assert.equal(inspect(f).pending,null);assert.equal(loadRepository(f.root).runtime.get('pkg-a').properties.setting,'package default');
 const state=readInstalledState(f.root);assert.equal(state.packages[0].manifest.version,'2.0.0');assert.equal(state.replacementHistory[0].sourceInstallation.id,before.state.packages[0].receipt.id);
 const service=await f.binding(),history=await service.call('wydstore','history',f.input);assert.deepEqual(history.value.map(h=>h.data.body),['Original content','Customer edit']);
 await assert.rejects(applyPackageOperation(plan),{code:'PACKAGE.PLAN'});
 await rollbackPackageEffects({root:f.root,installationContext:f.context});assert.deepEqual(await snapshotStore(f.store),before.data);assert.equal(inspect(f).pending.status,'REFERENCES_PREPARED');assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PENDING'});
 await run(f,'cancel');assert.equal(loadRepository(f.root).runtime.get('pkg-a').prototype,'acme/a');
});

for(const provider of ['json','sqlite'])for(const phase of ['retire','stage','references'])test(`${provider}: cancellation after ${phase} restores execution without changing source`,async t=>{
 const f=await developerFixture(t,provider),before=await image(f);await run(f,'retire');if(phase!=='retire')await run(f,'stage');if(phase==='references')await run(f,'references',{references:refs(f)});
 await run(f,'cancel');const after=await image(f);assert.equal(after.state.app,before.state.app);assert.deepEqual(after.state.packages,before.state.packages);assert.deepEqual(after.data,before.data);loadRepository(f.root);
});

for(const provider of ['json','sqlite'])for(const defect of ['mapping','forged','artifact','source','uninstall','purge','wrong-schema','extra-field','replay'])test(`${provider}: manual refuses ${defect} safely`,async t=>{
 const f=await developerFixture(t,provider);const service=await f.binding();await staged(f);const before=await image(f);
 if(defect==='mapping')await assert.rejects(run(f,'references',{references:[{id:'foreign',fromPrototype:'acme/a',toPrototype:'acme/a'}]}),{code:'PACKAGE.REFERENCE'});
 if(defect==='forged'){const plan=await planManualReplacement(request(f,'references',{references:refs(f)}));await assert.rejects(applyPackageOperation({...plan}),{code:'PACKAGE.PLAN'});}
 if(defect==='artifact'){const file=path.join(f.candidate.packagePath,'prototypes.json');await fs.appendFile(file,' ');await assert.rejects(run(f,'references',{references:refs(f)}),e=>['PACKAGE.MIGRATION_ORDER','PACKAGE.STALE'].includes(e.code));}
 if(defect==='source'){assert.equal((await service.call('wydstore','update',{...f.input,version:2,data:{text:'Newer content'}})).ok,true);await assert.rejects(run(f,'references',{references:refs(f)}),{code:'PACKAGE.STALE'});assert.equal((await snapshotStore(f.store)).collections.records.records[0].data.text,'Newer content');return;}
 if(['uninstall','purge'].includes(defect))await assert.rejects(packageOperation(f.operation({action:defect})),{code:'PACKAGE.PENDING'});
 if(defect==='wrong-schema')await assert.rejects(manualReplacement({...request(f,'references'),schema:'unknown'}),{code:'PACKAGE.MANUAL'});
 if(defect==='extra-field')await assert.rejects(manualReplacement({...request(f,'references'),shell:'no'}),{code:'PACKAGE.MANUAL'});
 if(defect==='replay')await assert.rejects(run(f,'retire'),{code:'PACKAGE.PENDING'});
 assert.deepEqual(await image(f),before);
});

for(const provider of ['json','sqlite'])for(const action of ['retire','stage','references','migrate','cancel'])for(const boundary of ['PLANNED','CATALOG'])test(`${provider}: SIGKILL manual ${action} ${boundary}`,async t=>{
 const f=await developerFixture(t,provider);
 if(action!=='retire')await run(f,'retire');
 if(['references','migrate','cancel'].includes(action))await run(f,'stage');
 if(action==='migrate')await run(f,'references',{references:refs(f)});
 const before=await image(f),options=request(f,action,action==='references'?{references:refs(f)}:{});
 await interruptedEffects(t,f.root,{kind:'manual',options,pauseAt:boundary});assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});
 await fs.rm(f.candidate.packagePath,{recursive:true});
 const result=await recoverPackageEffects({root:f.root,installationContext:f.context});assert.equal(result.status,boundary==='CATALOG'?'COMPLETED':'ROLLED_BACK');
 if(boundary==='PLANNED')assert.deepEqual(await image(f),before);
 else if(['migrate','cancel'].includes(action))loadRepository(f.root);
 else assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PENDING'});
});

async function prototypeFixture(t,provider,{multiple=true}={}) {
 const f=await developerFixture(t,provider,{multiple});
 const state=readInstalledState(f.root),app=JSON.parse(state.app),root=app.slots.pages.find(p=>p.id==='page-a').slots.sections[0];
 root.properties.setting='Site owner choice';
 root.slots.blocks.push({schema:'wydgit/0.2',id:'pkg-site-content',prototype:'wydgit.core/block',properties:{content:{type:'markdown',value:'Authored content'}},slots:{},provenance:{}});
 state.app=JSON.stringify(app);await fs.writeFile(path.join(f.root,'content/installed-packages.json'),JSON.stringify(state));
 const definitionsFile=path.join(f.candidate.packagePath,'prototypes.json'),templateFile=path.join(f.candidate.packagePath,'section.json');
 const definitions=JSON.parse(await fs.readFile(definitionsFile,'utf8'));definitions[0].id='acme/replacement';
 await fs.writeFile(definitionsFile,JSON.stringify(definitions));
 const template=JSON.parse(await fs.readFile(templateFile,'utf8'));template.prototype='acme/replacement';await fs.writeFile(templateFile,JSON.stringify(template));
 const step=f.request.declaration.steps[0];f.request.declaration.schema='wydgit.developer-migrations/2';
 step.to.artifact=(await import('../wydgine/packages/index.js')).inspectPackageMigrationArtifact(f.candidate.packagePath).artifact;
 step.logic.instances=[{id:'pkg-a',fromPrototype:'acme/a',toPrototype:'acme/replacement',properties:[]}];
 step.requiredCapabilities.unshift('object.instances.edit');sealStep(step);approveRequest(f.request);
 return f;
}
for(const provider of ['json','sqlite'])test(`${provider}: explicit prototype adoption retains multiple instances, owner properties, authored children and tombstones`,async t=>{
 const f=await prototypeFixture(t,provider);const service=await f.binding();assert.equal((await service.call('wydstore','delete',{...f.input,version:2})).ok,true);
 const before=await image(f);await staged(f);
 assert.equal(readInstalledState(f.root).app,before.state.app);assert.equal(refs(f).length,3);
 assert.equal(inspect(f).pending.preview.artifacts[0].manifest.version,'2.0.0');
 await run(f,'references',{references:refs(f)});assert.equal(readInstalledState(f.root).app,before.state.app);await run(f,'migrate');
 const runtime=loadRepository(f.root).runtime;assert.equal(runtime.get('pkg-a').prototype,'acme/replacement');assert.equal(runtime.get('pkg-a').properties.setting,'Site owner choice');
 assert.equal(runtime.get('pkg-item').properties.note,'Owner item');assert.equal(runtime.get('pkg-site-content').properties.content.value,'Authored content');
 const history=await (await f.binding()).call('wydstore','history',f.input);assert.deepEqual(history.value.map(h=>h.version),[1,2,3]);assert.equal(history.value[2].deleted,true);assert.deepEqual(history.value.slice(0,2).map(h=>h.data.body),['Original content','Customer edit']);
});
for(const provider of ['json','sqlite'])for(const defect of ['opaque','site-adoption','footprint','inheritance','split','merge','unauthorized','ordinary-upgrade','tampered-stage'])test(`${provider}: prototype transition refuses ${defect}`,async t=>{
 const f=await prototypeFixture(t,provider);let expected;
 if(['opaque','site-adoption'].includes(defect)){
  const state=readInstalledState(f.root),app=JSON.parse(state.app),root=app.slots.pages.find(p=>p.id==='page-a').slots.sections[0];
  if(defect==='opaque')root.properties.setting='acme/a';
  else root.slots.blocks.push({schema:'wydgit/0.2',id:'pkg-unowned',prototype:'acme/item',properties:{content:{type:'markdown',value:'Site item'}},slots:{},provenance:{}});
  // A site-owned use of an unchanged block prototype is safe; make its prototype
  // transition explicit only for the managed item, leaving this use unaccounted.
  if(defect==='site-adoption'){
   const file=path.join(f.candidate.packagePath,'prototypes.json'),defs=JSON.parse(await fs.readFile(file,'utf8'));defs.push({...defs[1],id:'acme/new-item'});await fs.writeFile(file,JSON.stringify(defs));
   const templateFile=path.join(f.candidate.packagePath,'section.json'),template=JSON.parse(await fs.readFile(templateFile,'utf8'));template.slots.blocks[0].prototype='acme/new-item';template.slots.blocks[1].prototype='acme/new-item';await fs.writeFile(templateFile,JSON.stringify(template));
   f.request.declaration.steps[0].logic.instances.push(...['pkg-item','pkg-item2'].map(id=>({id,fromPrototype:'acme/item',toPrototype:'acme/new-item',properties:[]})));
  }
  state.app=JSON.stringify(app);await fs.writeFile(path.join(f.root,'content/installed-packages.json'),JSON.stringify(state));expected='PACKAGE.MIGRATION_REQUIRED';
 }
 if(defect==='footprint'){
  const file=path.join(f.candidate.packagePath,'section.json'),template=JSON.parse(await fs.readFile(file,'utf8'));template.slots.blocks=[];await fs.writeFile(file,JSON.stringify(template));expected='PACKAGE.MIGRATION_REQUIRED';
 }
 if(defect==='inheritance'){
  const file=path.join(f.candidate.packagePath,'prototypes.json'),defs=JSON.parse(await fs.readFile(file,'utf8'));defs[1].extends='wydgit.core/section';await fs.writeFile(file,JSON.stringify(defs));expected='PACKAGE.MIGRATION_REQUIRED';
 }
 if(['split','merge'].includes(defect)){
  const file=path.join(f.candidate.packagePath,'prototypes.json'),defs=JSON.parse(await fs.readFile(file,'utf8'));
  const target=defect==='split'?'acme/new-item':'acme/item';if(defect==='split')defs.push({...defs[1],id:target});
  else { // Distinct source prototypes must never converge on one target.
   const state=readInstalledState(f.root),sourceDefs=JSON.parse(state.packages[0].resources['prototypes.json']);sourceDefs.push({...sourceDefs[1],id:'acme/other-item'});
   const entry=state.packages[0];entry.resources['prototypes.json']=JSON.stringify(sourceDefs);entry.receipt.resources['prototypes.json'].sha256=(await import('../wydgine/packages/state.js')).digest(entry.resources['prototypes.json']);
   const sourceTemplate=JSON.parse(entry.resources['section.json']);sourceTemplate.slots.blocks[1].prototype='acme/other-item';entry.resources['section.json']=JSON.stringify(sourceTemplate);entry.receipt.resources['section.json'].sha256=(await import('../wydgine/packages/state.js')).digest(entry.resources['section.json']);
   const app=JSON.parse(state.app);app.slots.pages.find(p=>p.id==='page-a').slots.sections[0].slots.blocks[1].prototype='acme/other-item';state.app=JSON.stringify(app);await fs.writeFile(path.join(f.root,'content/installed-packages.json'),JSON.stringify(state));
   f.request.declaration.steps[0].from.artifact=(await import('../wydgine/packages/index.js')).migrationContentHash({manifest:entry.manifest,resources:entry.resources});
  }
  await fs.writeFile(file,JSON.stringify(defs));
  const templateFile=path.join(f.candidate.packagePath,'section.json'),template=JSON.parse(await fs.readFile(templateFile,'utf8'));template.slots.blocks[0].prototype=target;await fs.writeFile(templateFile,JSON.stringify(template));
  f.request.declaration.steps[0].logic.instances.push({id:defect==='split'?'pkg-item':'pkg-item2',fromPrototype:defect==='split'?'acme/item':'acme/other-item',toPrototype:target,properties:[]});expected='PACKAGE.MIGRATION_REQUIRED';
 }
 if(defect==='unauthorized')f.request.approvals[0].capabilities=[];
 if(defect==='ordinary-upgrade'){await assert.rejects(packageOperation(f.operation()),{code:'PACKAGE.MIGRATION'});return;}
 if(!['unauthorized','tampered-stage'].includes(defect)){
  const step=f.request.declaration.steps[0];step.to.artifact=(await import('../wydgine/packages/index.js')).inspectPackageMigrationArtifact(f.candidate.packagePath).artifact;sealStep(step);approveRequest(f.request);
 }
 await run(f,'retire');const before=await image(f);
 if(defect==='tampered-stage'){
  await run(f,'stage');const state=readInstalledState(f.root);state.manualReplacement.preview.artifacts[0].resources['prototypes.json']+=' ';await fs.writeFile(path.join(f.root,'content/installed-packages.json'),JSON.stringify(state));
  assert.throws(()=>readInstalledState(f.root),{code:'PACKAGE.CATALOG'});return;
 }
 await assert.rejects(run(f,'stage'),e=>expected?e.code===expected:['PACKAGE.DENIED','SEAM.DENIED'].includes(e.code));assert.deepEqual(await image(f),before);
});

for(const provider of ['json','sqlite'])for(const boundary of ['RESOURCE_0','CONFIG','COMPENSATING_RESOURCE_0','UNLOCKED'])test(`${provider}: manual migration crash ${boundary} reconciles without developer artifacts`,async t=>{
 const f=await developerFixture(t,provider);await staged(f);await run(f,'references',{references:refs(f)});const before=await image(f);
 await interruptedEffects(t,f.root,{kind:'manual',options:request(f,'migrate'),pauseAt:boundary,...(boundary.startsWith('COMPENSATING')?{failAt:'BEFORE_CONFIG'}:{})});
 await fs.rm(f.candidate.packagePath,{recursive:true});await recoverPackageEffects({root:f.root,installationContext:f.context});
 if(boundary==='UNLOCKED'){loadRepository(f.root);assert.equal(readInstalledState(f.root).packages[0].manifest.version,'2.0.0');}
 else {assert.deepEqual(await image(f),before);assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PENDING'});}
});

for(const provider of ['json','sqlite'])for(const step of [0,1])test(`${provider}: termination after private migration step ${step} leaves pending source unchanged`,async t=>{
 const f=await developerFixture(t,provider,{chain:true});await staged(f);await run(f,'references',{references:refs(f)});const before=await image(f);
 await interruptedEffects(t,f.root,{kind:'manual',options:request(f,'migrate'),pauseAt:'MIGRATION_STEP_'+step});
 assert.deepEqual(await image(f),before);assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PENDING'});
 await run(f,'migrate');assert.equal(readInstalledState(f.root).packages[0].manifest.version,'2.0.0');
});
for(const provider of ['json','sqlite'])test(`${provider}: manual preserves shared/transitive automatic dependency reservations without pruning`,async t=>{
 const f=await developerFixture(t,provider),c=await f.newCandidate('c'),b=await f.newCandidate('b',{dependencies:{'acme/c':'^1.0.0'}}),d=await f.newCandidate('d',{dependencies:{'acme/b':'^1.0.0'}});
 await packageOperation({root:f.root,action:'install',package:'acme/d',candidates:[d,b,c],installationContext:f.context});
 const state=readInstalledState(f.root),a=state.packages.find(p=>p.manifest.id==='acme/a');a.manifest.dependencies={'acme/b':'^1.0.0'};a.receipt.dependencies=a.manifest.dependencies;
 await fs.writeFile(path.join(f.root,'content/installed-packages.json'),JSON.stringify(state));
 const step=f.request.declaration.steps[0];step.from.artifact=(await import('../wydgine/packages/index.js')).migrationContentHash({manifest:a.manifest,resources:a.resources});sealStep(step);approveRequest(f.request);
 const before=readInstalledState(f.root).packages;await staged(f);assert.deepEqual(readInstalledState(f.root).packages,before);
 await run(f,'references',{references:refs(f)});await run(f,'migrate');
 const packages=readInstalledState(f.root).packages;for(const id of ['acme/b','acme/c'])assert.equal(packages.find(p=>p.manifest.id===id).reason,'automatic');assert.ok(packages.find(p=>p.manifest.id==='acme/d'));
 await packageOperation({root:f.root,action:'uninstall',package:'acme/d',installationContext:f.context});
 await assert.rejects(packageOperation({root:f.root,action:'uninstall',package:'acme/b',installationContext:f.context}),{code:'PACKAGE.RESERVED'});
 const newer=await f.newCandidate('b',{version:'1.1.0',dependencies:{'acme/c':'^1.0.0'}});
 await assert.rejects(packageOperation({root:f.root,action:'update',package:'acme/b',candidates:[newer],installationContext:f.context}),{code:'PACKAGE.RESERVED'});
});
for(const provider of ['json','sqlite'])test(`${provider}: manual serialization rejects stale plans and competing lifecycle operations`,async t=>{
 const f=await developerFixture(t,provider),first=await planManualReplacement(request(f,'retire')),second=await planManualReplacement(request(f,'retire'));
 await applyPackageOperation(first,{atStage:async stage=>{if(stage==='PLANNED'){
  await assert.rejects(run(f,'retire'),{code:'PACKAGE.RECOVERY'});
  await assert.rejects(packageOperation(f.operation({action:'uninstall'})),{code:'PACKAGE.RECOVERY'});
 }}});
 await assert.rejects(applyPackageOperation(second),{code:'PACKAGE.STALE'});assert.equal(inspect(f).pending.status,'RETIRED');await run(f,'cancel');loadRepository(f.root);
});
for(const provider of ['json','sqlite'])for(const phase of ['retire','stage','references','migrate','cancel'])test(`${provider}: ${phase} cancellation before publication preserves accepted pending state`,async t=>{
 const f=await developerFixture(t,provider);if(phase!=='retire')await run(f,'retire');if(['references','migrate','cancel'].includes(phase))await run(f,'stage');if(phase==='migrate')await run(f,'references',{references:refs(f)});
 const before=await image(f),controller=new AbortController(),plan=await planManualReplacement(request(f,phase,{signal:controller.signal,...(phase==='references'?{references:refs(f)}:{})}));
 await assert.rejects(applyPackageOperation(plan,{atStage:async stage=>{if(stage==='PLANNED')controller.abort();}}),{code:'PACKAGE.CANCELLED'});assert.deepEqual(await image(f),before);
});
for(const provider of ['json','sqlite'])test(`${provider}: manual postcommit cancellation stays committed and newer content blocks rollback`,async t=>{
 const f=await developerFixture(t,provider);await staged(f);await run(f,'references',{references:refs(f)});const controller=new AbortController();
 await applyPackageOperation(await planManualReplacement(request(f,'migrate',{signal:controller.signal})),{atStage:async stage=>{if(stage==='CATALOG')controller.abort();}});
 const service=await f.binding();assert.equal((await service.call('wydstore','update',{...f.input,version:2,data:{body:'Newest content'}})).ok,true);
 await assert.rejects(rollbackPackageEffects({root:f.root,installationContext:f.context}),{code:'PACKAGE.STALE'});
 assert.equal(inspect(f).pending,null);
});
for(const provider of ['json','sqlite'])test(`${provider}: manual rejects missing host authority and malformed, destructive approvals`,async t=>{
 const f=await developerFixture(t,provider),before=await image(f),{ExecutionContext}=await import('../wydgine/seam/context.js');
 for(const context of [new ExecutionContext({context:'FrontEnd',...f.context,package:'acme/a'}),new ExecutionContext({context:'FrontEnd',...f.context,app:'wrong'}),new ExecutionContext({context:'FrontEnd',...f.context,capabilities:['object.instances.edit']})])await assert.rejects(run(f,'retire',{installationContext:context}),e=>['PACKAGE.DENIED','SEAM.DENIED'].includes(e.code));
 let called=false;const malformed={...request(f,'retire'),get shell(){called=true;return 'x';}};await assert.rejects(manualReplacement(malformed),{code:'INPUT.JSON'});assert.equal(called,false);assert.deepEqual(await image(f),before);
 await run(f,'retire');const retired=await image(f),step=f.request.declaration.steps[0];step.logic.storage[0].operations=[{op:'drop',field:'text'}];sealStep(step);approveRequest(f.request);
 await assert.rejects(run(f,'stage'),{code:'PACKAGE.MIGRATION'});assert.deepEqual(await image(f),retired);
});

for(const provider of ['json','sqlite'])test(`${provider}: explicit no-op migration fingerprints untouched stores and refuses stale data`,async t=>{
 const f=await developerFixture(t,provider),source=readInstalledState(f.root).packages[0];f.candidate=await f.version('2.0.0',source.manifest.storage[0]);
 const step=f.request.declaration.steps[0];step.to.artifact=(await import('../wydgine/packages/index.js')).inspectPackageMigrationArtifact(f.candidate.packagePath).artifact;step.logic.storage=[];step.validators={before:[],after:[]};step.requiredCapabilities=[];sealStep(step);approveRequest(f.request);
 const service=await f.binding();await staged(f);assert.equal(inspect(f).pending.preview.resources.length,1);assert.equal(inspect(f).pending.preview.resources[0].before,inspect(f).pending.preview.resources[0].after);
 assert.equal((await service.call('wydstore','update',{...f.input,version:2,data:{text:'New after preview'}})).ok,true);
 await assert.rejects(run(f,'references',{references:refs(f)}),{code:'PACKAGE.STALE'});
 await fs.rm(f.candidate.packagePath,{recursive:true});await run(f,'cancel');assert.equal(inspect(f).pending,null);
 const current=await (await f.binding()).call('wydstore','get',f.input);assert.equal(current.value.data.text,'New after preview');
});
for(const provider of ['json','sqlite'])test(`${provider}: retirement preview cannot replace data written before apply`,async t=>{
 const f=await developerFixture(t,provider),service=await f.binding(),plan=await planManualReplacement(request(f,'retire'));
 assert.equal((await service.call('wydstore','update',{...f.input,version:2,data:{text:'Newest source'}})).ok,true);
 await assert.rejects(applyPackageOperation(plan),{code:'PACKAGE.STALE'});assert.equal(inspect(f).pending,null);assert.equal((await snapshotStore(f.store)).collections.records.records[0].data.text,'Newest source');
});

for(const provider of ['json','sqlite'])test(`${provider}: native adapter publication death restores the verified manual source`,async t=>{
 const f=await developerFixture(t,provider);await staged(f);await run(f,'references',{references:refs(f)});const before=await image(f);
 await interruptedEffects(t,f.root,{kind:'manual',options:request(f,'migrate'),pauseAt:'native',nativeBoundary:provider==='json'?'json-replace':'sqlite-replace'});
 await fs.rm(f.candidate.packagePath,{recursive:true});await recoverPackageEffects({root:f.root,installationContext:f.context});assert.deepEqual(await image(f),before);
});
for(const provider of ['json','sqlite'])test(`${provider}: interrupted manual compensation recovery remains resumable`,async t=>{
 const f=await developerFixture(t,provider);await staged(f);await run(f,'references',{references:refs(f)});const before=await image(f);
 await interruptedEffects(t,f.root,{kind:'manual',options:request(f,'migrate'),pauseAt:'RESOURCE_0'});
 await interruptedEffects(t,f.root,{kind:'recover',options:{root:f.root,installationContext:f.context},pauseAt:'CONFIG'});
 await fs.rm(f.candidate.packagePath,{recursive:true});await recoverPackageEffects({root:f.root,installationContext:f.context});assert.deepEqual(await image(f),before);
});
for(const provider of ['json','sqlite'])test(`${provider}: manual tampered checkpoint stays blocked with private evidence`,async t=>{
 const f=await developerFixture(t,provider);await staged(f);await run(f,'references',{references:refs(f)});
 await interruptedEffects(t,f.root,{kind:'manual',options:request(f,'migrate'),pauseAt:'PLANNED'});
 const record=JSON.parse(await fs.readFile(path.join(f.root,'content/package-effects.json'),'utf8')),file=path.join(f.root,'content',record.checkpoint);
 assert.equal((await fs.stat(file)).mode&0o777,0o600);await fs.appendFile(file,' ');
 await assert.rejects(recoverPackageEffects({root:f.root,installationContext:f.context}),{code:'PACKAGE.RECOVERY'});assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});assert.ok(await fs.stat(file));
});
for(const provider of ['json','sqlite'])test(`${provider}: manual committed rollback refuses newer host configuration`,async t=>{
 const f=await developerFixture(t,provider);await staged(f);await run(f,'references',{references:refs(f)});await run(f,'migrate');
 const file=path.join(f.root,'wydgit.config.json'),text=await fs.readFile(file,'utf8');await fs.writeFile(file,text+' ');
 await assert.rejects(rollbackPackageEffects({root:f.root,installationContext:f.context}),{code:'PACKAGE.STALE'});assert.equal(await fs.readFile(file,'utf8'),text+' ');
});
for(const provider of ['json','sqlite'])test(`${provider}: legacy install preserves catalog 0.2 and replacement evidence`,async t=>{
 const f=await developerFixture(t,provider);await staged(f);await run(f,'references',{references:refs(f)});await run(f,'migrate');
 const before=readInstalledState(f.root),candidate=await f.newCandidate('extra');const {installPackage}=await import('../wydgine/packages/index.js');
 await installPackage({...candidate,root:f.root,installationContext:f.context});const after=readInstalledState(f.root);
 assert.equal(after.schema,'wydgit-installed/0.2');assert.deepEqual(after.replacementHistory,before.replacementHistory);assert.equal(after.packages.length,before.packages.length+1);
});

for(const provider of ['json','sqlite'])for(const boundary of ['store-unlock','catalog-rename','config-rename'])test(`${provider}: manual death inside ${boundary} reconciles the commit boundary`,async t=>{
 const f=await developerFixture(t,provider);await staged(f);await run(f,'references',{references:refs(f)});const before=await image(f);
 await interruptedEffects(t,f.root,{kind:'manual',options:request(f,'migrate'),pauseAt:'native',nativeBoundary:boundary});
 await fs.rm(f.candidate.packagePath,{recursive:true});await recoverPackageEffects({root:f.root,installationContext:f.context});
 if(boundary==='config-rename'){assert.deepEqual(await image(f),before);assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PENDING'});}
 else {loadRepository(f.root);assert.equal(inspect(f).pending,null);assert.equal(readInstalledState(f.root).packages[0].manifest.version,'2.0.0');}
});

for(const provider of ['json','sqlite'])test(`${provider}: manual migration resolves an actual 1.1.0 receipt and schema`,async t=>{
 const f=await developerFixture(t,provider,{chain:true}),first=f.request.declaration.steps[0],last=f.request.declaration.steps[1],intermediate=f.request.artifacts[0];
 const initialRequest={...f.request,declaration:{...f.request.declaration,supportedSources:['1.0.0'],steps:[first]},path:[first.id],artifacts:[]};approveRequest(initialRequest);
 await packageOperation(f.operation({action:'update',candidates:[{...f.candidate,packagePath:intermediate}],developerMigrations:initialRequest}));
 f.store=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8')).libraries.find(l=>l.id==='wydstore').options.stores[0];
 f.request={...f.request,declaration:{...f.request.declaration,supportedSources:['1.1.0'],steps:[last]},path:[last.id],artifacts:[]};approveRequest(f.request);
 assert.equal(readInstalledState(f.root).packages[0].manifest.version,'1.1.0');await staged(f);assert.equal(inspect(f).pending.preview.lineage.steps[0].from,'1.1.0');await run(f,'references',{references:refs(f)});await run(f,'migrate');
 assert.equal(readInstalledState(f.root).packages[0].manifest.version,'2.0.0');const history=await (await f.binding()).call('wydstore','history',f.input);assert.deepEqual(history.value.map(h=>h.data.body),['Original content','Customer edit']);
});
for(const provider of ['json','sqlite'])test(`${provider}: manual composition matches the ordinary approved migration preview`,async t=>{
 const f=await developerFixture(t,provider),{planPackageOperation}=await import('../wydgine/packages/index.js'),{checkpointHash}=await import('../packages/wydstore/src/lifecycle.js');
 const ordinary=await planPackageOperation(f.operation());await staged(f);const pending=inspect(f).pending;
 const canonical=v=>JSON.parse(JSON.stringify(v));assert.deepEqual(canonical(pending.preview.lineage),canonical(ordinary.developerMigration.lineage));assert.deepEqual(canonical(pending.preview.resources),canonical(ordinary.resources));assert.deepEqual(canonical(pending.preview.afterGraph),canonical(ordinary.afterGraph));
 await run(f,'references',{references:refs(f)});await run(f,'migrate');const config=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8')),store=config.libraries.find(l=>l.id==='wydstore').options.stores[0];
 assert.equal(checkpointHash(await snapshotStore(store)),ordinary.resources[0].after);await assert.rejects(applyPackageOperation(ordinary),{code:'PACKAGE.STALE'});
});

async function twoStoreFixture(t,provider){
 const f=await developerFixture(t,provider),state=readInstalledState(f.root),entry=state.packages[0],configFile=path.join(f.root,'wydgit.config.json'),config=JSON.parse(await fs.readFile(configFile,'utf8'));
 const second={...f.store,id:'store-second',root:path.join(f.root,'data-second')};await fs.mkdir(second.root);config.libraries.find(l=>l.id==='wydstore').options.stores.push(second);await fs.writeFile(configFile,JSON.stringify(config));
 entry.manifest.storage.push({...entry.manifest.storage[0],name:'second'});entry.manifest.permissions.scopes.wydstore.push('second');entry.approved.scopes.wydstore.push('second');entry.storageMappings.second={store:second.id,collection:'records'};entry.storageScopes.push(entry.storageMappings.second);
 for(const key of ['approved','storageMappings'])entry.receipt[key]=entry[key];
 const {baseFingerprint}=await import('../wydgine/packages/state.js');state.baseFingerprint=baseFingerprint(f.root);entry.receipt.baseFingerprint=state.baseFingerprint;await fs.writeFile(path.join(f.root,'content/installed-packages.json'),JSON.stringify(state));
 const service=await f.binding();assert.equal((await service.call('wydstore','create',{...f.input,store:second.id,data:{text:'Second store content'}})).ok,true);
 const manifestFile=path.join(f.candidate.packagePath,'manifest.json'),manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));manifest.storage.push({...manifest.storage[0],name:'second'});manifest.permissions.scopes.wydstore.push('second');await fs.writeFile(manifestFile,JSON.stringify(manifest));f.candidate.approvals=manifest.permissions;
 const step=f.request.declaration.steps[0],{migrationContentHash,inspectPackageMigrationArtifact}=await import('../wydgine/packages/index.js');step.from.artifact=migrationContentHash({manifest:entry.manifest,resources:entry.resources});step.to.artifact=inspectPackageMigrationArtifact(f.candidate.packagePath).artifact;step.logic.storage.push({...step.logic.storage[0],name:'second'});sealStep(step);approveRequest(f.request);
 return {...f,second};
}
for(const provider of ['json','sqlite'])for(const boundary of ['RESOURCE_0','RESOURCE_1','CONFIG','CATALOG'])test(`${provider}: two-store manual migration SIGKILL ${boundary} never exposes partial target`,async t=>{
 const f=await twoStoreFixture(t,provider),before=[await snapshotStore(f.store),await snapshotStore(f.second)];await staged(f);await run(f,'references',{references:refs(f)});
 await interruptedEffects(t,f.root,{kind:'manual',options:request(f,'migrate'),pauseAt:boundary});assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});
 await fs.rm(f.candidate.packagePath,{recursive:true});await recoverPackageEffects({root:f.root,installationContext:f.context});
 if(boundary==='CATALOG'){
  loadRepository(f.root);const stores=JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8')).libraries.find(l=>l.id==='wydstore').options.stores;
  for(const store of stores)assert.equal(typeof (await snapshotStore(store)).collections.records.records[0].data.body,'string');
 }else {assert.deepEqual([await snapshotStore(f.store),await snapshotStore(f.second)],before);assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PENDING'});}
});
