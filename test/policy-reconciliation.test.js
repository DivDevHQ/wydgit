import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {policyFixture} from '../test-support/policy-reconciliation.js';
import {ExecutionContext,checkContext} from '../wydgine/seam/context.js';
import {inspectPackagePolicy,planPackagePolicy,approvePackagePolicy,applyPackagePolicy,cancelPackagePolicy,packageOperation,executionPlacement,acquirePackageExecution,rollbackPackageEffects} from '../wydgine/packages/index.js';
import {loadRepository} from '../wydgine/repository.js';
import {STATE} from '../wydgine/packages/state.js';
import {createApp} from '../app.js';
const clone=value=>JSON.parse(JSON.stringify(value));
test('POL-01: deterministic planning is read-only; durable exact review applies equivalent authority',async t=>{
 const f=await policyFixture(t),before=await fs.readFile(path.join(f.root,STATE),'utf8');
 const a=await f.plan(),b=await f.plan();assert.deepEqual(a,b);assert.equal(a.authority,'equivalent');assert.ok(Object.isFrozen(a.policy));
 assert.equal(await fs.readFile(path.join(f.root,STATE),'utf8'),before);
 const approval=await f.review(a);
 const inspect={root:f.root,app:a.app,package:a.package,installation:a.installation,installationContext:f.operator};
 assert.equal(inspectPackagePolicy(inspect).approval.id,approval.id);
 assert.throws(()=>inspectPackagePolicy({...inspect,installationContext:f.context}),{code:'SEAM.DENIED'});
 assert.throws(()=>inspectPackagePolicy({...inspect,installation:'forged'}),{code:'PACKAGE.OWNERSHIP'});
 assert.equal(f.entry().policyRevision,undefined);assert.equal(f.state().policyReconciliation.id,approval.id);
 assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.PENDING'});
 await f.apply(approval);assert.equal(f.entry().policyRevision,1);assert.equal(f.state().policyHistory[0].plan.sha256,a.sha256);
 assert.equal(f.state().policyHistory[0].status,'APPLIED');assert.equal(f.entry().receipt.id,a.installation);assert.equal(f.entry().receipt.revision,a.packageRevision);
 await assert.rejects(f.apply(approval),{code:'PACKAGE.APPROVAL'});
 await assert.rejects(rollbackPackageEffects({root:f.root,installationContext:f.operator}),{code:'PACKAGE.ROLLBACK_UNSUPPORTED'});
});
test('POL-02: narrowing and explicitly reviewed expansion retain package requirements',async t=>{
 const f=await policyFixture(t,'json'),requested=clone(f.entry().manifest.permissions),narrow=clone(requested);narrow.capabilities=['store.records.read'];narrow.scopes.wydstore=[];
 const p=await f.plan(narrow);assert.equal(p.authority,'reduced');await f.apply(await f.review(p));assert.deepEqual(clone(f.entry().manifest.permissions),requested);
 const expansion=await f.plan(requested);assert.equal(expansion.expanded,true);
 await assert.rejects(f.review(expansion),{code:'PACKAGE.APPROVAL'});
 await f.reconcile(requested,[],true);assert.deepEqual(clone(f.entry().approved),requested);assert.equal(f.entry().policyRevision,2);
});
test('POL-03: native lifecycle AND policy capability, never package/context/Gate role authority',async t=>{
 const f=await policyFixture(t),request=f.request();
 const role={authenticated:true,app:'boilerplate',userId:'user',sessionId:'session',createdAt:0,expiresAt:Date.now()+100000,roles:['administrator'],groups:[],permissions:['packages.policy.manage'],membershipId:'member',membershipStatus:'active',membershipRole:'administrator'};
 for(const patch of [{package:'acme/a'},{installation:'forged'},{capabilities:[]},{capabilities:['packages.lifecycle.manage']},{capabilities:['packages.policy.manage']},{context:'FrontEnd',package:'acme/a'},{context:'BackOffice',capabilities:[]},{context:'BackOffice',identity:role,capabilities:[]}]) {
  const caller=new ExecutionContext({...f.operator,...patch});await assert.rejects(planPackagePolicy({...request,installationContext:caller}));
 }
 const original=await f.plan();await assert.rejects(approvePackagePolicy(clone(original),{installationContext:f.operator}),{code:'PACKAGE.PLAN'});
 await assert.rejects(approvePackagePolicy(original,{installationContext:f.context}),{code:'SEAM.DENIED'});
 const approved=await f.review(await f.plan());
 await assert.rejects(applyPackagePolicy({...f.finish(approved),installationContext:f.context}),{code:'SEAM.DENIED'});
 await assert.rejects(applyPackagePolicy({...f.finish(approved),installationContext:new ExecutionContext({...f.operator,package:'acme/a'})}),{code:'PACKAGE.DENIED'});
 await f.apply(approved);
});
test('POL-04: forged identity, stale revisions, ambiguous/modified policy and context escalation fail closed',async t=>{
 const f=await policyFixture(t),request=f.request();
 for(const patch of [{app:'foreign'},{package:'acme/foreign'},{installation:'forged'},{revision:0},{packageRevision:0},{policyRevision:1}])await assert.rejects(planPackagePolicy({...request,...patch}));
 for(const context of ['BackOffice','AccountAdmin','HostAdmin'])await assert.rejects(planPackagePolicy({...request,policy:{...request.policy,context}}),{code:'PACKAGE.POLICY'});
 const bad=clone(request.policy);bad.grants.capabilities=['packages.policy.manage'];await assert.rejects(planPackagePolicy({...request,policy:bad}),{code:'PACKAGE.DENIED'});
 const approved=await f.review(await f.plan());
 for(const patch of [{app:'foreign'},{package:'acme/b'},{installation:'foreign'},{revision:0},{packageRevision:0},{policyRevision:1},{planHash:'0'.repeat(64)},{approval:'forged'}])await assert.rejects(applyPackagePolicy({...f.finish(approved),...patch}));
 await assert.rejects(planPackagePolicy(request),{code:'PACKAGE.PENDING'});
 await assert.rejects(packageOperation(f.operation('uninstall','acme/a')),{code:'PACKAGE.PENDING'});
 await f.apply(approved);
});
test('POL-05: stale/unapproved original plans cannot apply; approved cancellation leaves source and fences cached authority',async t=>{
 const f=await policyFixture(t),p=await f.plan();
 await assert.rejects(applyPackagePolicy({...f.request(),approval:true}),{code:'PACKAGE.POLICY'});
 const approved=await f.review(p);await cancelPackagePolicy(f.finish(approved));assert.equal(f.entry().policyRevision,undefined);
 await assert.rejects(f.apply(approved),{code:'PACKAGE.APPROVAL'});
 await assert.rejects(f.review(await Promise.resolve(p)),{code:'PACKAGE.PLAN'});
 const stale=await f.plan();await f.reconcile();await assert.rejects(f.review(stale),{code:'PACKAGE.STALE'});
});
test('POL-06: running/draining App rejects approval and apply; pending review rejects startup',async t=>{
 const f=await policyFixture(t),p=await f.plan();let release;const stopped=new Promise(r=>release=r);
 const libraries=await (await import('../wydgine/host.js')).initializeHost({root:f.root});t.after(()=>libraries.close());
 const app=createApp({root:f.root,libraries,onStop:()=>stopped,logger:{error(){}}});await app.ready;
 await assert.rejects(f.review(p),{code:'PACKAGE.RUNNING'});
 const stopping=app.stop();await assert.rejects(f.review(await f.plan()),{code:'PACKAGE.RUNNING'});release();await stopping;
 const approved=await f.review(await f.plan());assert.throws(()=>createApp({root:f.root}),{code:'PACKAGE.PENDING'});await f.apply(approved);
});
for(const provider of ['json','sqlite'])test(`POL-07 ${provider}: storage policy, history, ownership, draft/public read, generation fences and update compatibility`,async t=>{
 const f=await policyFixture(t,provider),before=clone(f.entry()),service=await f.binding();
 const {snapshotStore,checkpointHash}=await import('../packages/wydstore/src/lifecycle.js');const hash=checkpointHash(await snapshotStore(f.store));
 const publicRead={schema:'wydstore.authorization/1',collections:{records:{get:{contexts:['FrontEnd','BackOffice'],public:true},query:{contexts:['FrontEnd','BackOffice'],public:true}}}};
 await f.reconcile(undefined,[{store:'store-a',authorization:publicRead}]);
 assert.equal(checkpointHash(await snapshotStore(f.store)),hash);
 await assert.rejects(service.call('wydstore','get',f.input),{code:'SEAM.CONTEXT'});
 const fresh=await f.binding();assert.equal((await fresh.call('wydstore','get',f.input)).value.data.text,'Customer edit');
 assert.equal((await fresh.call('wydstore','update',{...f.input,version:2,data:{text:'Denied'}})).code,'STORE.DENIED');
 const {createStores}=await import('@wydgit/store/client');const data=createStores(fresh).get('store-a').collection('records'),record=await data.get('content');record.set('text','Local draft');assert.equal(record.current.text,'Local draft');
 await assert.rejects(record.save(),{code:'STORE.DENIED'});
 assert.equal(f.entry().receipt.id,before.receipt.id);assert.deepEqual(clone(f.entry().storageMappings),before.storageMappings);
 const widen=await f.plan(undefined,[{store:'store-a',authorization:null}]);assert.equal(widen.expanded,true);await f.apply(await f.review(widen,true));
 const grant=clone(f.entry().approved);grant.capabilities=['store.records.read'];await f.reconcile(grant);
 const next=await f.version('1.1.0');await packageOperation(f.operation('update','acme/a',[next]));assert.deepEqual(clone(f.entry().approved),grant);assert.equal(f.entry().policyRevision,3);
 assert.equal(checkpointHash(await snapshotStore(f.store)),hash);
});

test('POL-08: direct config drift remains PACKAGE.DRIFT before plan, review, apply and startup',async t=>{
 const f=await policyFixture(t),request=f.request(),p=await f.plan(),file=path.join(f.root,'wydgit.config.json'),before=await fs.readFile(file,'utf8');
 const config=JSON.parse(before);config.libraries.find(l=>l.id==='wydstore').enabled=false;await fs.writeFile(file,JSON.stringify(config));
 await assert.rejects(planPackagePolicy(request),{code:'PACKAGE.DRIFT'});await assert.rejects(f.review(p),{code:'PACKAGE.DRIFT'});assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.DRIFT'});
 await fs.writeFile(file,before);const approval=await f.review(await f.plan());await fs.writeFile(file,JSON.stringify(config));await assert.rejects(f.apply(approval),{code:'PACKAGE.DRIFT'});await fs.writeFile(file,before);await f.apply(approval);
});
test('POL-09: conflicting plans/requests serialize; maintenance reservation prevents racing startup',async t=>{
 const f=await policyFixture(t),a=await f.plan(),b=await f.plan();let resume,entered;
 const gate=new Promise(r=>resume=r),ready=new Promise(r=>entered=r);
 const approving=approvePackagePolicy(a,{installationContext:f.operator},{atStage:async stage=>{if(stage==='PLANNED'){entered();await gate;}}});await ready;
 await assert.rejects(f.review(b),{code:'PACKAGE.BUSY'});assert.throws(()=>createApp({root:f.root}),{code:'PACKAGE.BUSY'});resume();const approval=await approving;
 const request=f.finish(approval);let resumeApply,enteredApply;
 const paused=new Promise(r=>resumeApply=r),atApply=new Promise(r=>enteredApply=r);
 const applying=applyPackagePolicy(request,{atStage:async stage=>{if(stage==='PLANNED'){enteredApply();await paused;}}});await atApply;
 await assert.rejects(applyPackagePolicy(request),{code:'PACKAGE.BUSY'});resumeApply();await applying;
});
for(const provider of ['json','sqlite'])test(`POL-10 ${provider}: staging failure compensates exact source policy; retries consume only current approval`,async t=>{
 const f=await policyFixture(t,provider),grants=clone(f.entry().approved);grants.capabilities=['store.records.read'];
 const approval=await f.review(await f.plan(grants)),before=await fs.readFile(path.join(f.root,STATE),'utf8');let failed=false;
 await assert.rejects(applyPackagePolicy(f.finish(approval),{atStage:async stage=>{if(stage==='CONFIG'&&!failed){failed=true;throw Error('staging failure');}}}),/staging failure/);
 assert.equal(await fs.readFile(path.join(f.root,STATE),'utf8'),before);assert.equal(f.entry().policyRevision,undefined);assert.equal(f.state().policyReconciliation.id,approval.id);
 await f.apply(approval);await assert.rejects(f.apply(approval),{code:'PACKAGE.APPROVAL'});assert.deepEqual(clone(f.entry().approved),grants);
});
async function killed(t,f,request,stage,action='apply') {
 const {spawn}=await import('node:child_process'),{once}=await import('node:events');
 const file=path.join(f.root,'policy-request.json');await fs.writeFile(file,JSON.stringify(request));
 const child=spawn(process.execPath,['test-support/policy-reconciliation-child.js',file,stage,action],{stdio:['ignore','ignore','pipe','ipc']});let errors='';child.stderr.on('data',b=>errors+=b);t.after(()=>child.kill('SIGKILL'));
 await Promise.race([once(child,'message',{signal:AbortSignal.timeout(15000)}),once(child,'exit').then(()=>{throw Error(errors||'child exited before '+stage);})]);const ended=once(child,'exit');child.kill('SIGKILL');await ended;
}
for(const stage of ['BEFORE_PLAN','REVIEW','PLANNED','APPLYING','PUBLISHED','APPROVED'])test(`POL-11: interrupted planning/approval ${stage} recovers durable exact decision`,async t=>{
 const f=await policyFixture(t),source=f.state();
 if(['BEFORE_PLAN','REVIEW'].includes(stage)){await killed(t,f,f.request(),stage,'plan');assert.deepEqual(f.state(),source);return;}
 await killed(t,f,f.request(),stage,'approve');
 if(stage==='APPROVED'){const approval=inspectPackagePolicy({root:f.root,app:'boilerplate',package:'acme/a',installation:f.entry().receipt.id,installationContext:f.operator}).approval;assert.ok(approval);await f.apply(approval);return;}
 const {recoverPackageOperation}=await import('../wydgine/packages/index.js');
 await assert.rejects(recoverPackageOperation({root:f.root,installationContext:f.context}),{code:'SEAM.DENIED'});
 await recoverPackageOperation({root:f.root,installationContext:f.operator});
 if(stage==='PUBLISHED') {
  const approval=f.state().policyReconciliation;assert.ok(approval);assert.equal(f.entry().policyRevision,undefined);
  await f.apply({...approval,revision:f.state().revision});
 } else assert.deepEqual(f.state(),source);
});
for(const provider of ['json','sqlite'])for(const stage of ['PLANNED','APPLYING','CONFIG','BEFORE_CATALOG','CATALOG'])test(`POL-12 ${provider}: killed apply ${stage} uses durable evidence; repeated recovery never restores committed broader grants`,async t=>{
 const f=await policyFixture(t,provider),oldService=await f.binding(),grants=clone(f.entry().approved);grants.capabilities=['store.records.read'];
 const {snapshotStore,checkpointHash}=await import('../packages/wydstore/src/lifecycle.js');const before=checkpointHash(await snapshotStore(f.store));
 const authorization={schema:'wydstore.authorization/1',collections:{records:{get:{contexts:['FrontEnd'],public:true}}}};
 const approval=await f.review(await f.plan(grants,[{store:'store-a',authorization}]));
 await killed(t,f,f.finish(approval),stage);
 const {recoverPackageEffects}=await import('../wydgine/packages/index.js');
 await assert.rejects(recoverPackageEffects({root:f.root,installationContext:f.context}),{code:'SEAM.DENIED'});
 const request={root:f.root,installationContext:f.operator};
 await recoverPackageEffects(request);await recoverPackageEffects(request);
 const committed=stage==='CATALOG';assert.equal(f.entry().policyRevision,committed?1:undefined);
 if(committed){assert.deepEqual(clone(f.entry().approved),grants);await assert.rejects(recoverPackageEffects({...request,direction:'rollback'}),{code:'PACKAGE.RECOVERY'});await assert.rejects(f.apply(approval),{code:'PACKAGE.APPROVAL'});}
 else await f.apply(approval);
 assert.equal(checkpointHash(await snapshotStore(f.store)),before);
 await assert.rejects(oldService.call('wydstore','get',f.input),{code:'SEAM.CONTEXT'});
 assert.equal((await (await f.binding()).call('wydstore','get',f.input)).value.data.text,'Customer edit');
});
for(const provider of ['json','sqlite'])test(`POL-13 ${provider}: interrupted resume/recovery remains idempotent`,async t=>{
 const f=await policyFixture(t,provider),grants=clone(f.entry().approved);grants.capabilities=[];
 const approval=await f.review(await f.plan(grants));await killed(t,f,f.finish(approval),'CONFIG');
 const request={root:f.root,installationContext:f.operator,direction:'resume'};
 await killed(t,f,request,'CATALOG','recover');
 const {recoverPackageEffects}=await import('../wydgine/packages/index.js');await recoverPackageEffects(request);await recoverPackageEffects(request);
 assert.equal(f.entry().policyRevision,1);assert.deepEqual(f.entry().approved.capabilities,[]);assert.equal(f.state().policyHistory.length,1);
});
for(const provider of ['json','sqlite'])test(`POL-14 ${provider}: scope/ownership migration and shared store policy reject; shared dependency and retained bindings survive`,async t=>{
 const f=await policyFixture(t,provider),request=f.request();
 for(const key of ['storageMappings','owner','publisher','installation','dependencies','context'])await assert.rejects(planPackagePolicy({...request,policy:{...request.policy,[key]:{}}}),{code:'PACKAGE.POLICY'});
 await assert.rejects(f.plan(undefined,[{store:'unknown',authorization:null}]),{code:'PACKAGE.OWNERSHIP'});
 const original=clone(f.entry()),b=await f.candidate('b',{dependencies:{'acme/a':'^1.0.0'}});await packageOperation(f.operation('install','acme/b',[b]));
 await f.reconcile();assert.equal(f.state().packages.find(e=>e.manifest.id==='acme/b').manifest.dependencies['acme/a'],'^1.0.0');assert.deepEqual(clone(f.entry().storageMappings),original.storageMappings);
 await assert.rejects(packageOperation(f.operation('uninstall','acme/a')),{code:'PACKAGE.DEPENDENTS'});
 await packageOperation(f.operation('uninstall','acme/b'));await packageOperation(f.operation('uninstall','acme/a'));const next=await f.version();await packageOperation(f.operation('install','acme/a',[next]));assert.deepEqual(clone(f.entry().approved),original.approved);assert.equal(f.entry().policyRevision,1);
});
test('POL-15: exact canonical site cannot be exchanged by roots or friendly identifiers',async t=>{
 const a=await policyFixture(t),b=await policyFixture(t),file=path.join(b.root,'content/app.json');
 // Even identical canonical App IDs never make independent installation receipts interchangeable.
 const pa=await a.plan();await assert.rejects(planPackagePolicy({...b.request(),installation:pa.installation}),{code:'PACKAGE.OWNERSHIP'});
 const approved=await a.review(pa);await assert.rejects(applyPackagePolicy({...a.finish(approved),root:b.root}),{code:'PACKAGE.APPROVAL'});await a.apply(approved);
 assert.equal(b.entry().policyRevision,undefined);assert.ok(await fs.stat(file));
});
test('POL-16: reviewed narrowing survives widened package declarations without approving added authority',async t=>{
 const f=await policyFixture(t,'json'),grant=clone(f.entry().approved);grant.capabilities=['store.records.read'];await f.reconcile(grant);
 const candidate=await f.version('1.1.0'),file=path.join(candidate.packagePath,'manifest.json'),manifest=JSON.parse(await fs.readFile(file));manifest.permissions.traversal=['children'];await fs.writeFile(file,JSON.stringify(manifest));candidate.approvals=manifest.permissions;
 await packageOperation(f.operation('update','acme/a',[candidate]));assert.deepEqual(f.entry().approved.traversal,[]);assert.deepEqual(clone(f.entry().approved),grant);
 const proposed=clone(grant);proposed.traversal=['children'];const plan=await f.plan(proposed);assert.equal(plan.expanded,true);await f.apply(await f.review(plan,true));assert.deepEqual(f.entry().approved.traversal,['children']);
});
for(const provider of ['json','sqlite'])test(`POL-17 ${provider}: BackOffice retained authority fences old contexts, object handles, derived callers and cached drafts`,async t=>{
 const f=await policyFixture(t,provider),e=f.entry();
 const request={root:f.root,app:'boilerplate',package:'acme/a',installation:e.receipt.id,revision:f.state().revision,action:'place',context:'BackOffice',installationContext:f.operator};
 await executionPlacement(request);
 const current=f.entry(),old=acquirePackageExecution({...request,generation:current.executionPlacement.generation,self:'pkg-a'}),derived=new ExecutionContext({...old}),handle=loadRepository(f.root).runtime.scope(old);
 const libraries=await (await import('../wydgine/host.js')).initializeHost({root:f.root});t.after(()=>libraries.close());const service=libraries.bind(old);
 const {createStores}=await import('@wydgit/store/client');const record=await createStores(service).get('store-a').collection('records').get('content');
 const grants=clone(current.approved);grants.capabilities=['store.records.read'];
 // Policy management does not need a placement grant to renew unchanged context.
 const policyOnly=new ExecutionContext({...f.operator,capabilities:['packages.lifecycle.manage','packages.policy.manage']});
 const p=await planPackagePolicy({...f.request(grants),installationContext:policyOnly});const approval=await approvePackagePolicy(p,{installationContext:policyOnly});
 await applyPackagePolicy({...f.finish(approval),installationContext:policyOnly});
 assert.equal(f.entry().executionPlacement.context,'BackOffice');
 assert.throws(()=>checkContext(old),{code:'SEAM.CONTEXT'});assert.throws(()=>checkContext(derived),{code:'SEAM.CONTEXT'});assert.throws(()=>handle.requireCapability('store.records.read'),{code:'SEAM.CONTEXT'});
 record.set('text','stale');await assert.rejects(record.save(),{code:'SEAM.CONTEXT'});await assert.rejects(service.call('wydstore','get',f.input),{code:'SEAM.CONTEXT'});
 await assert.rejects(f.apply(approval),{code:'PACKAGE.APPROVAL'});
});
for(const provider of ['json','sqlite'])test(`POL-18 ${provider}: interrupted compensation recovers; corrupt checkpoint cannot weaken accepted source`,async t=>{
 const f=await policyFixture(t,provider),grants=clone(f.entry().approved);grants.capabilities=[];const approval=await f.review(await f.plan(grants));
 await killed(t,f,f.finish(approval),'CONFIG');const request={root:f.root,installationContext:f.operator};
 await killed(t,f,request,'CONFIG','recover');
 const {recoverPackageEffects,inspectPackageEffects}=await import('../wydgine/packages/index.js');
 const record=inspectPackageEffects(f.root),file=path.join(f.root,'content',record.checkpoint),evidence=await fs.readFile(file);
 await fs.appendFile(file,'\n');await assert.rejects(recoverPackageEffects(request),{code:'PACKAGE.RECOVERY'});assert.throws(f.state,{code:'PACKAGE.RECOVERY'});
 await fs.writeFile(file,evidence);await recoverPackageEffects(request);await recoverPackageEffects(request);assert.equal(f.entry().policyRevision,undefined);await f.apply(approval);assert.equal(f.entry().policyRevision,1);
});
test('POL-19: modified reviewed plan and source revision are rejected by durable evidence',async t=>{
 const f=await policyFixture(t),approval=await f.review(await f.plan()),file=path.join(f.root,STATE),before=await fs.readFile(file,'utf8');
 const state=JSON.parse(before);state.policyReconciliation.plan.policy.grants.traversal=['children'];await fs.writeFile(file,JSON.stringify(state));
 await assert.rejects(f.apply(approval),{code:'PACKAGE.CATALOG'});await fs.writeFile(file,before);
 const changed=JSON.parse(before);changed.packages[0].receipt.revision++;await fs.writeFile(file,JSON.stringify(changed));await assert.rejects(f.apply(approval),{code:'PACKAGE.CATALOG'});await fs.writeFile(file,before);await f.apply(approval);
});
test('POL-20: foreign/private/shared and malformed store policies fail before durable approval',async t=>{
 const f=await policyFixture(t,'json'),configFile=path.join(f.root,'wydgit.config.json'),original=await fs.readFile(configFile,'utf8');
 const policies=[{schema:'wydstore.authorization/9',collections:{}},{schema:'wydstore.authorization/1',collections:{foreign:{get:{contexts:['FrontEnd'],public:true}}}},{schema:'wydstore.authorization/1',collections:{records:{get:{contexts:['HostAdmin'],public:true}}}}];
 for(const authorization of policies)await assert.rejects(f.plan(undefined,[{store:'store-a',authorization}]),{code:'STORE.INVALID_CONFIG'});
 // Shared private implementation binding exists before the installation in this fixture.
 const {storedFixture}=await import('../test-support/package-effects.js');const shared=await storedFixture(t,'json',{configure:async(config)=>{config.libraries.find(l=>l.id==='wydgate').bindings=[{library:'wydstore',app:'boilerplate',capabilities:['store.records.read'],scopes:{wydstore:[{store:'store-a',collection:'records'}]}}];return {};}});
 const operator=new ExecutionContext({...shared.context,capabilities:[...shared.context.capabilities,'packages.policy.manage']});const e=(await import('../wydgine/packages/state.js')).readInstalledState(shared.root);
 await assert.rejects(planPackagePolicy({root:shared.root,app:'boilerplate',package:'acme/a',installation:e.packages[0].receipt.id,revision:e.revision,packageRevision:e.packages[0].receipt.revision,policyRevision:0,policy:{grants:e.packages[0].approved,stores:[{store:'store-a',authorization:null}]},installationContext:operator}),{code:'PACKAGE.OWNERSHIP'});
 assert.equal(await fs.readFile(configFile,'utf8'),original);
});
test('POL-21: checkpoint size refuses approval before it can strand a large accepted App',async t=>{
 const f=await policyFixture(t),state=f.state(),app=JSON.parse(state.app);app.properties.title='x'.repeat(1100000);
 const visit=node=>{if(node.id==='pkg-a')node.properties.setting='y'.repeat(1100000);Object.values(node.slots).flat().forEach(visit);};visit(app);state.app=JSON.stringify(app);
 const file=path.join(f.root,STATE);await fs.writeFile(file,JSON.stringify(state));loadRepository(f.root);
 const before=await fs.readFile(file,'utf8'),plan=await f.plan();await assert.rejects(f.review(plan),{code:'PACKAGE.LIMIT'});
 assert.equal(await fs.readFile(file,'utf8'),before);assert.equal(f.state().policyReconciliation,undefined);loadRepository(f.root);
});
for(const provider of ['json','sqlite'])test(`POL-22 ${provider}: new permission names require explicit expansion review and never grant existing Gate users`,async t=>{
 const {configuration,gateContext,load}=await import('../test-support/wydgate.js'),{createGate}=await import('@wydgit/gate/client'),{storedFixture}=await import('../test-support/package-effects.js');
 const native=gateContext({app:'boilerplate',scopes:{wydgate:['boilerplate']}});let identity,user;
 const f=await storedFixture(t,provider,{configure:async(config,root)=>{
  const gateRoot=path.join(root,'gate');await fs.mkdir(gateRoot);const g=configuration(gateRoot,provider,{registration:'open'}),gate=g.libraries[0],store=g.libraries[1].options.stores[0];
  gate.options.app='boilerplate';gate.bindings[0].app='boilerplate';store.app='boilerplate';config.libraries=config.libraries.filter(l=>l.id!=='wydgate');config.libraries.push(gate);config.libraries.find(l=>l.id==='wydstore').options.stores.push(store);
  const registry=await load(config);try{const api=createGate(registry.bind(native));user=await api.register({username:'alice',password:'reviewed policy passphrase'});const login=await api.login('alice','reviewed policy passphrase');identity=await api.resolveSession(login.token);}finally{await registry.close();}return {};
 }});
 const {readInstalledState}=await import('../wydgine/packages/state.js');
 const operator=new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'packages.policy.manage','packages.placement.manage']});
 const entry=()=>readInstalledState(f.root).packages.find(e=>e.manifest.id==='acme/a');
 const reconcile=async(permission,expanded=false)=>{
  const e=entry(),s=readInstalledState(f.root),plan=await planPackagePolicy({root:f.root,app:'boilerplate',package:'acme/a',installation:e.receipt.id,revision:s.revision,packageRevision:e.receipt.revision,policyRevision:e.policyRevision??0,policy:{grants:e.approved,stores:[{store:'store-a',authorization:{schema:'wydstore.authorization/1',collections:{records:{get:{contexts:['FrontEnd'],permission}}}}}]},installationContext:operator});
  if(expanded)assert.equal(plan.expanded,true);
  const approval=await approvePackagePolicy(plan,{installationContext:operator,allowExpansion:expanded});await applyPackagePolicy({root:f.root,app:plan.app,package:plan.package,installation:plan.installation,revision:approval.revision,packageRevision:plan.packageRevision,policyRevision:plan.policyRevision,approval:approval.id,planHash:plan.sha256,installationContext:operator});
 };
 await reconcile('content.records.read');
 const bind=async()=>{const model=loadRepository(f.root),registry=await load(JSON.parse(await fs.readFile(path.join(f.root,'wydgit.config.json'))));t.after(()=>registry.close());const {activatePackages}=await import('../wydgine/packages/index.js');return {registry,services:registry.bind(activatePackages(model,registry,f.root).context({pageId:'page-a',session:{identity},ids:[]}))};};
 let current=await bind();assert.equal((await current.services.call('wydstore','get',f.input)).code,'STORE.DENIED');
 await createGate(current.registry.bind(native)).assignUser({userId:user.account.id,roles:[],permissions:['content.records.read']});assert.equal((await current.services.call('wydstore','get',f.input)).ok,true);await current.registry.close();
 await reconcile('content.future.read',true);current=await bind();assert.equal((await current.services.call('wydstore','get',f.input)).code,'STORE.DENIED');
 const gate=createGate(current.registry.bind(native));await gate.assignUser({userId:user.account.id,roles:[],permissions:['content.records.read','content.future.read']});assert.equal((await current.services.call('wydstore','get',f.input)).ok,true);
});
for(const competing of ['apply','cancel'])test(`POL-23: cross-process ${competing} completing during validation cannot be overwritten or replayed`,async t=>{
 const f=await policyFixture(t,'json'),grants=clone(f.entry().approved);grants.capabilities=['store.records.read'];const approval=await f.review(await f.plan(grants));
 const {spawn}=await import('node:child_process'),{once}=await import('node:events'),file=path.join(f.root,'race-request.json');await fs.writeFile(file,JSON.stringify(f.finish(approval)));
 const child=spawn(process.execPath,['test-support/policy-reconciliation-child.js',file,'POLICY_VALIDATED'],{stdio:['ignore','ignore','pipe','ipc']});let errors='';child.stderr.on('data',b=>errors+=b);t.after(()=>child.kill('SIGKILL'));
 await Promise.race([once(child,'message',{signal:AbortSignal.timeout(15000)}),once(child,'exit').then(()=>{throw Error(errors);})]);
 if(competing==='apply')await f.apply(approval);else await cancelPackagePolicy(f.finish(approval));
 const committed=await fs.readFile(path.join(f.root,STATE),'utf8'),closed=once(child,'close');child.send('continue');const [code]=await closed;assert.notEqual(code,0);assert.match(errors,/PACKAGE.STALE/);
 assert.equal(await fs.readFile(path.join(f.root,STATE),'utf8'),committed);assert.equal(f.state().policyHistory.length,1);assert.equal(f.entry().policyRevision,competing==='apply'?1:undefined);
});
test('POL-24: direct edits to mirrored approved subsets or concrete scopes remain PACKAGE.DRIFT',async t=>{
 const f=await policyFixture(t,'json'),grants=clone(f.entry().approved);grants.capabilities=['store.records.read'];await f.reconcile(grants);
 const file=path.join(f.root,STATE),before=await fs.readFile(file,'utf8'),request=f.request(grants);
 for(const edit of [e=>{e.approved.capabilities.push('store.records.write');e.receipt.approved.capabilities.push('store.records.write');},e=>e.storageScopes.push({store:'foreign-site',collection:'records'})]) {
  const state=JSON.parse(before);edit(state.packages.find(e=>e.manifest.id==='acme/a'));await fs.writeFile(file,JSON.stringify(state));
  assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.DRIFT'});await assert.rejects(planPackagePolicy(request),{code:'PACKAGE.DRIFT'});await fs.writeFile(file,before);
 }
 loadRepository(f.root);
});
