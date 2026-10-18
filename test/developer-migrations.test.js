import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { developerFixture, sealStep, approveRequest } from '../test-support/developer-migrations.js';
import { interruptedEffects } from '../test-support/package-effects.js';
import { writeJson } from '../test-support/package-lifecycle.js';
import { planPackageOperation, applyPackageOperation, packageOperation, recoverPackageEffects, rollbackPackageEffects, migrationContentHash, validateDeveloperMigrationDeclaration, inspectPackageMigrationArtifact, createPackageBudget } from '../wydgine/packages/index.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { STATE, readInstalledState } from '../wydgine/packages/state.js';
import { loadRepository } from '../wydgine/repository.js';
import { snapshotStore, checkpointHash } from '../packages/wydstore/src/lifecycle.js';

const fingerprint=async f=>({catalog:await fs.readFile(path.join(f.root,STATE),'utf8'),config:await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8'),data:checkpointHash(await snapshotStore(f.store))});

for(const provider of ['json','sqlite'])for(const chain of [false,true])test(`${provider}: developer ${chain?'adjacent':'direct'} path preserves customizations, full history and lineage; checked rollback`,async t=>{
  const f=await developerFixture(t,provider,{chain}),state=readInstalledState(f.root),app=JSON.parse(state.app);
  app.slots.pages.find(p=>p.id==='page-a').slots.sections[0].properties.setting='Owner customization';state.app=JSON.stringify(app);await writeJson(path.join(f.root,STATE),state);
  assert.equal((await (await f.binding()).call('wydstore','delete',{...f.input,version:2})).ok,true);
  const before=await fingerprint(f),sourceReceipt=state.packages[0].receipt.id,plan=await planPackageOperation(f.operation());
  assert.deepEqual(await fingerprint(f),before);assert.deepEqual(plan.developerMigration.path,f.request.path);
  assert.ok(Object.isFrozen(plan.developerMigration.declaration));assert.ok(plan.developerMigration.counts.history>0);
  await applyPackageOperation(plan);
  const accepted=readInstalledState(f.root),entry=accepted.packages[0],service=await f.binding();
  assert.equal(loadRepository(f.root).runtime.get('pkg-a').properties.setting,'Owner customization');
  assert.deepEqual(entry.instanceIds,['pkg-a']);assert.equal(entry.migrationLineage[0].sourceReceipt,sourceReceipt);assert.deepEqual(entry.receipt.migrationLineage,entry.migrationLineage);
  const history=await service.call('wydstore','history',f.input);assert.equal(history.ok,true);
  assert.deepEqual(history.value.map(h=>h.version),[1,2,3]);assert.deepEqual(history.value.slice(0,2).map(h=>h.data.body),['Original content','Customer edit']);assert.equal(history.value[2].deleted,true);
  if(chain)assert.deepEqual(history.value.slice(0,2).map(h=>h.data.label),['Imported','Imported']);
  await assert.rejects(applyPackageOperation(plan),{code:'PACKAGE.PLAN'});
  await rollbackPackageEffects({root:f.root,installationContext:f.context});
  const rolled=await fingerprint(f);assert.equal(rolled.data,before.data);assert.equal(rolled.config,before.config);assert.ok(readInstalledState(f.root).revision>accepted.revision);
});

const defects=['logic-hash','validator-hash','unknown-field','unknown-format','raw-code','destructive','inverse','foreign-store','foreign-instance','prototype-change','collision','validator-failure','history-validator','capability-escalation','approval-union','unused-approval','wrong-source','wrong-artifact','unsupported-source','duplicate-edge','cycle','empty-path','foreign-package','extra-artifact','mixed-host','wrong-action'];
for(const provider of ['json','sqlite'])for(const defect of defects)test(`${provider}: developer admission refuses ${defect} without effects`,async t=>{
  const f=await developerFixture(t,provider),before=await fingerprint(f),d=f.request.declaration,s=d.steps[0];let extra={};
  if(defect==='logic-hash')s.logicHash='0'.repeat(64);
  if(defect==='validator-hash')s.validatorsHash='0'.repeat(64);
  if(defect==='unknown-field')s.hook='shell';
  if(defect==='unknown-format')d.schema='wydgit.developer-migrations/2';
  if(defect==='raw-code')s.logic.storage[0].operations=[{op:'javascript',source:'process.exit()'}];
  if(defect==='destructive')s.logic.storage[0].operations=[{op:'drop',field:'text'}];
  if(defect==='inverse')s.inverse={op:'shell',command:'restore'};
  if(defect==='foreign-store')s.validators.before[0].name='foreign';
  if(defect==='foreign-instance'){s.validators.before=[{scope:'instance',name:'home',field:'title',op:'present'}];s.requiredCapabilities.unshift('object.instances.edit');}
  if(defect==='prototype-change')s.logic.instances=[{id:'pkg-a',fromPrototype:'acme/a',toPrototype:'acme/other',properties:[]}];
  if(defect==='collision')s.logic.storage[0].operations.unshift({op:'default',field:'body',value:'Occupied'});
  if(defect==='validator-failure')s.validators.after=[{scope:'storage',name:'entries',field:'body',op:'equals',value:'Incorrect semantic result'}];
  if(defect==='history-validator')s.validators.before=[{scope:'storage',name:'entries',field:'text',op:'equals',value:'Customer edit'}];
  if(defect==='capability-escalation')s.requiredCapabilities.push('packages.lifecycle.manage');
  if(defect==='approval-union')f.request.approvals[0].capabilities=['store.records.read'];
  if(defect==='unused-approval')f.request.approvals.push({...f.request.approvals[0],step:'unused'});
  if(defect==='wrong-source')s.from.version='0.9.0';
  if(defect==='wrong-artifact')s.from.artifact='0'.repeat(64);
  if(defect==='unsupported-source')d.supportedSources.push('0.9.0');
  if(defect==='duplicate-edge')d.steps.push({...s,id:'duplicate'});
  if(defect==='cycle')s.to.version=s.from.version;
  if(defect==='empty-path')f.request.path=[];
  if(defect==='foreign-package'){d.package='foreign/a';s.logic.package='foreign/a';}
  if(defect==='extra-artifact')f.request.artifacts=[f.candidate.packagePath];
  if(defect==='mixed-host')extra.migrations=[f.migration()];
  if(defect==='wrong-action')extra.action='install';
  if(!['logic-hash','validator-hash'].includes(defect))sealStep(s);
  if(!['approval-union','unused-approval','empty-path'].includes(defect))approveRequest(f.request);
  const expected=['logic-hash','validator-hash'].includes(defect)?'PACKAGE.DRIFT':['foreign-store','foreign-instance','foreign-package'].includes(defect)?'PACKAGE.OWNERSHIP':['validator-failure','history-validator'].includes(defect)?'PACKAGE.MIGRATION_VALIDATION':['wrong-artifact','unsupported-source'].includes(defect)?'PACKAGE.MIGRATION_ORDER':defect==='approval-union'?'PACKAGE.DENIED':defect==='collision'?'PACKAGE.MIGRATION_CONFLICT':'PACKAGE.MIGRATION';
  await assert.rejects(packageOperation(f.operation(extra)),{code:expected});
  assert.deepEqual(await fingerprint(f),before);
});

for(const provider of ['json','sqlite'])for(const bound of ['records','history','bytes','mappings','steps','stagingBytes','work','time'])test(`${provider}: developer ${bound} ceiling terminates without effects`,async t=>{
  const f=await developerFixture(t,provider,{chain:true}),before=await fingerprint(f);let extra={};
  if(bound==='work'||bound==='time')extra.installationContext=new ExecutionContext({...f.context,limits:{[bound==='work'?'packageWork':'packageTimeMs']:0}});
  else f.request.declaration.limits[bound]=1;
  if(bound==='mappings'){
    const step=f.request.declaration.steps[0];step.validators.before.push({scope:'instance',name:'pkg-a',field:'setting',op:'present'});step.validators.after.push({scope:'instance',name:'pkg-a',field:'setting',op:'present'});step.requiredCapabilities.unshift('object.instances.edit');sealStep(step);approveRequest(f.request);
  }
  await assert.rejects(packageOperation(f.operation(extra)),{code:'PACKAGE.LIMIT'});assert.deepEqual(await fingerprint(f),before);
});

for(const provider of ['json','sqlite'])test(`${provider}: developer plans reject forgery, wrong authority, stale content and changed artifacts`,async t=>{
  const f=await developerFixture(t,provider),before=await fingerprint(f);
  for(const context of [{...f.context},new ExecutionContext({...f.context,package:'acme/a'}),new ExecutionContext({...f.context,app:'other'}),new ExecutionContext({...f.context,capabilities:['packages.lifecycle.manage','object.instances.edit']})]){
    await assert.rejects(planPackageOperation(f.operation({installationContext:context})),e=>/^(PACKAGE|SEAM)\./.test(e.code));
  }
  const plan=await planPackageOperation(f.operation());await assert.rejects(applyPackageOperation({...plan}),{code:'PACKAGE.PLAN'});
  const prototype=path.join(f.candidate.packagePath,'prototypes.json'),text=await fs.readFile(prototype,'utf8');await fs.writeFile(prototype,text+' ');
  await assert.rejects(applyPackageOperation(plan),{code:'PACKAGE.STALE'});assert.deepEqual(await fingerprint(f),before);await fs.writeFile(prototype,text);
  const stale=await planPackageOperation(f.operation()),service=await f.binding();assert.equal((await service.call('wydstore','update',{...f.input,version:2,data:{text:'Newer owner content'}})).ok,true);
  await assert.rejects(applyPackageOperation(stale),{code:'PACKAGE.STALE'});assert.equal((await snapshotStore(f.store)).collections.records.records[0].data.text,'Newer owner content');
});

for(const provider of ['json','sqlite'])for(const stage of ['PLANNED','RESOURCE_0','CONFIG','CATALOG','COMPENSATING_RESOURCE_0'])test(`${provider}: developer SIGKILL ${stage} reconciles fixed after-images`,async t=>{
  const f=await developerFixture(t,provider,{chain:true}),before=await fingerprint(f);
  await interruptedEffects(t,f.root,{kind:'operation',options:f.operation(),pauseAt:stage,...(stage.startsWith('COMPENSATING')?{failAt:'BEFORE_CONFIG'}:{})});
  assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});
  // Recovery cannot execute logic: delete every supplied developer artifact.
  await fs.rm(f.candidate.packagePath,{recursive:true});for(const directory of f.request.artifacts)await fs.rm(directory,{recursive:true});
  const result=await recoverPackageEffects({root:f.root,installationContext:f.context,direction:stage==='RESOURCE_0'?'resume':undefined});
  const committed=['RESOURCE_0','CATALOG'].includes(stage);assert.equal(result.status,committed?'COMPLETED':'ROLLED_BACK');
  if(committed){assert.equal(readInstalledState(f.root).packages[0].manifest.version,'2.0.0');const history=await (await f.binding()).call('wydstore','history',f.input);assert.deepEqual(history.value.map(h=>h.data.body),['Original content','Customer edit']);}
  else assert.deepEqual(await fingerprint(f),before);
  const checkpoint=JSON.parse(await fs.readFile(path.join(f.root,'content/package-effects.json'),'utf8'));
  assert.equal((await fs.stat(path.join(f.root,'content',checkpoint.checkpoint))).mode&0o777,0o600);
});

for(const provider of ['json','sqlite'])test(`${provider}: newer content refuses developer committed rollback`,async t=>{
  const f=await developerFixture(t,provider);await packageOperation(f.operation());
  assert.equal((await (await f.binding()).call('wydstore','update',{...f.input,version:2,data:{body:'Keep this'}})).ok,true);
  const config=await fs.readFile(path.join(f.root,'wydgit.config.json'),'utf8');
  await assert.rejects(rollbackPackageEffects({root:f.root,installationContext:f.context}),{code:'PACKAGE.STALE'});
  const targetStore=JSON.parse(config).libraries.find(l=>l.id==='wydstore').options.stores[0];assert.equal((await snapshotStore(targetStore)).collections.records.records[0].data.body,'Keep this');
});

test('declaration validation never evaluates accessors or accepts prototype pollution',()=>{
  let called=false;assert.throws(()=>validateDeveloperMigrationDeclaration({get schema(){called=true;return 'x';}}),{code:'INPUT.JSON'});assert.equal(called,false);
  assert.throws(()=>validateDeveloperMigrationDeclaration(JSON.parse('{"__proto__":{}}')),{code:'INPUT.DANGEROUS_KEY'});
  assert.equal(migrationContentHash({b:1,a:2}),migrationContentHash({a:2,b:1}));
});

for(const provider of ['json','sqlite'])test(`${provider}: supported intermediate starting version uses only its exact selected edge`,async t=>{
  const f=await developerFixture(t,provider,{chain:true}),first=f.request.declaration.steps[0];
  await packageOperation(f.operation({action:'update',developerMigrations:undefined,candidates:[{...f.candidate,packagePath:f.request.artifacts[0]}],migrations:[first.logic]}));
  f.request.path=['rename-text'];f.request.artifacts=[];approveRequest(f.request);
  await packageOperation(f.operation());
  const history=await (await f.binding()).call('wydstore','history',f.input);assert.deepEqual(history.value.map(h=>h.data.body),['Original content','Customer edit']);assert.deepEqual(history.value.map(h=>h.data.label),['Imported','Imported']);
  assert.deepEqual(readInstalledState(f.root).packages[0].migrationLineage[0].steps.map(s=>s.id),['rename-text']);
});

for(const provider of ['json','sqlite'])test(`${provider}: accepted step IDs cannot be rewritten in a later declaration`,async t=>{
  const f=await developerFixture(t,provider);await packageOperation(f.operation());
  const before=readInstalledState(f.root).packages[0],candidate=await f.version('2.1.0',f.target),old=f.request.declaration.steps[0];
  const step=sealStep({...old,from:{version:'2.0.0',artifact:migrationContentHash({manifest:before.manifest,resources:before.resources})},to:{version:'2.1.0',artifact:inspectPackageMigrationArtifact(candidate.packagePath).artifact},logic:{schema:'wydgit.package-migration/1',package:'acme/a',from:'2.0.0',to:'2.1.0',storage:[],instances:[]},validators:{before:[],after:[]},requiredCapabilities:[]});
  f.request.declaration.steps=[step];f.request.declaration.supportedSources=['2.0.0'];approveRequest(f.request);
  await assert.rejects(packageOperation(f.operation({action:'update',candidates:[candidate]})),{code:'PACKAGE.DRIFT'});
});

for(const provider of ['json','sqlite'])test(`${provider}: instance defaults and semantic predicates preserve owner values and object scope`,async t=>{
  const f=await developerFixture(t,provider),step=f.request.declaration.steps[0];
  step.logic.instances=[{id:'pkg-a',fromPrototype:'acme/a',toPrototype:'acme/a',properties:[{op:'default',field:'setting',value:'Do not replace'}]}];
  step.validators.after.push({scope:'instance',name:'pkg-a',field:'setting',op:'equals',value:'package default'});step.requiredCapabilities.unshift('object.instances.edit');sealStep(step);approveRequest(f.request);
  const before=await fingerprint(f),unscoped=new ExecutionContext({...f.context,editable:['home']});
  await assert.rejects(packageOperation(f.operation({installationContext:unscoped})),{code:'SEAM.DENIED'});assert.deepEqual(await fingerprint(f),before);
  await packageOperation(f.operation());assert.equal(loadRepository(f.root).runtime.get('pkg-a').properties.setting,'package default');
});

for(const provider of ['json','sqlite'])for(const failure of ['missing-dependency','reverse-dependent','intermediate-schema','intermediate-hydration','missing-edge','ambiguous-selection','null-operation','null-validator'])test(`${provider}: ${failure} cannot bypass developer planning`,async t=>{
  const f=await developerFixture(t,provider,{chain:true}),steps=f.request.declaration.steps;let expected='PACKAGE.MIGRATION';
  if(failure==='reverse-dependent'){
    const b=await f.newCandidate('b',{dependencies:{'acme/a':'^1'}});
    await packageOperation({root:f.root,action:'install',package:'acme/b',candidates:[b],installationContext:f.context});expected='PACKAGE.CONFLICT';
  }
  if(failure==='missing-dependency'){
    const file=path.join(f.candidate.packagePath,'manifest.json'),manifest=JSON.parse(await fs.readFile(file,'utf8'));manifest.dependencies={'foreign/missing':'^1'};await writeJson(file,manifest);steps[1].to.artifact=inspectPackageMigrationArtifact(f.candidate.packagePath).artifact;expected='PACKAGE.CONFLICT';
  }
  if(failure==='intermediate-schema'){steps[0].logic.storage[0].fields={text:{type:'number'}};expected='STORE.INVALID_FIELD';}
  if(failure==='intermediate-hydration'){
    const file=path.join(f.request.artifacts[0],'prototypes.json'),definitions=JSON.parse(await fs.readFile(file,'utf8'));definitions[0].properties.setting.type='number';definitions[0].properties.setting.default=1;await writeJson(file,definitions);
    steps[0].to.artifact=steps[1].from.artifact=inspectPackageMigrationArtifact(f.request.artifacts[0]).artifact;expected='OBJECT.PROPERTY';
  }
  if(failure==='missing-edge'){f.request.path=['rename-text'];expected='PACKAGE.MIGRATION_ORDER';}
  if(failure==='ambiguous-selection')delete f.request.path;
  if(failure==='null-operation')steps[0].logic.storage[0].operations=[null];
  if(failure==='null-validator')steps[0].validators.before=[null];
  for(const step of steps)sealStep(step);if(f.request.path)approveRequest(f.request);
  const before=await fingerprint(f);await assert.rejects(packageOperation(f.operation()),{code:expected});assert.deepEqual(await fingerprint(f),before);
});

for(const provider of ['json','sqlite'])test(`${provider}: cancellation shares the original terminal ledger and compensates before commit`,async t=>{
  const f=await developerFixture(t,provider),before=await fingerprint(f),controller=new AbortController(),budget=createPackageBudget(f.context,{signal:controller.signal});
  const plan=await planPackageOperation(f.operation({budget}));
  await assert.rejects(applyPackageOperation(plan,{atStage:stage=>{if(stage==='RESOURCE_0')controller.abort();}}),{code:'PACKAGE.CANCELLED'});assert.deepEqual(await fingerprint(f),before);
  await assert.rejects(planPackageOperation(f.operation({budget})),{code:'PACKAGE.CANCELLED'});
  await packageOperation(f.operation());
});

for(const provider of ['json','sqlite'])test(`${provider}: corrupt checkpoint and forged receipt lineage retain recovery evidence`,async t=>{
  const f=await developerFixture(t,provider);await interruptedEffects(t,f.root,{kind:'operation',options:f.operation(),pauseAt:'RESOURCE_0'});
  const journal=JSON.parse(await fs.readFile(path.join(f.root,'content/package-effects.json'),'utf8')),file=path.join(f.root,'content',journal.checkpoint),text=await fs.readFile(file,'utf8');await fs.writeFile(file,text+' ');
  await assert.rejects(recoverPackageEffects({root:f.root,installationContext:f.context,direction:'resume'}),{code:'PACKAGE.RECOVERY'});assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});
  await fs.writeFile(file,text);await recoverPackageEffects({root:f.root,installationContext:f.context,direction:'resume'});
  const state=readInstalledState(f.root);state.packages[0].receipt.migrationLineage[0].steps[0].sha256='0'.repeat(64);await writeJson(path.join(f.root,STATE),state);assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.CATALOG'});
});
