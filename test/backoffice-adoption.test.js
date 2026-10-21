import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import * as trusted from 'wydgine/trusted/packages';
import {ExecutionContext,checkContext} from '../wydgine/seam/context.js';
import {twoResourceActionFixture,installedTaskboardFixture} from '../test-support/backoffice-preflight.js';
import {modulesFixture} from '../test-support/backoffice-modules.js';
import {adoptionFixture} from '../test-support/backoffice-adoption.js';
import {actionReference} from '../packages/wydgine/src/engine/packages/backoffice-preflight-contract.js';
import {STATE} from '../wydgine/packages/state.js';
const copy=x=>structuredClone(x);
const fixture=async(t,p)=>adoptionFixture(await twoResourceActionFixture(t,p));
const status=f=>f.inspect().backoffice;
const bytes=f=>fs.readFile(path.join(f.root,STATE),'utf8');
const rejected=promise=>assert.rejects(promise);
function boundPage(f){
  const p=f.proposal(),e=f.entry(),a=e.manifest.backofficeActions.find(a=>a.id==='get'),consumer=f.pageFacts().nodes.find(n=>n.id===e.instance);
  p.bindings=[{name:'load',consumer:consumer.id,reference:actionReference(e,a,p.app),usage:'prepare',fixedInput:{},constraints:[{
    type:consumer.ancestors.at(-1),targets:[`${a.owner}/${a.id}`],effect:a.effect,input:a.input,output:a.output}]}];return p;
}
for(const provider of ['json','sqlite'])test(`BOB4A-01 ${provider}: explicit reviewed adoption is durable, bounded, inspectable and inert`,async t=>{
  const f=await fixture(t,provider),source=f.entry(),p=boundPage(f),payload=f.payload(undefined,[p]),before=await bytes(f);
  const plan=await f.plan(payload);assert.equal(await bytes(f),before);assert.equal(plan.backoffice.actions.length,6);
  assert.equal(status(f).status,'proposed');
  assert.equal(plan.backoffice.actions.find(a=>a.reference.action==='get').scope.wydstore.length,1);
  assert.equal(source.storageScopes.length,2);
  const approval=await f.review(plan);assert.equal(f.inspect().approval.id,approval.id);assert.equal(status(f).durablyAdopted,false);
  await f.apply(approval);const e=f.entry(),adopted=status(f);
  assert.equal(e.executionPlacement.generation,approval.id);assert.equal(e.policyRevision,1);
  assert.equal(adopted.status,'adopted');assert.equal(adopted.eligibleForEnforcement,true);assert.equal(adopted.enforcementReady,false);
  assert.equal(adopted.actions.length,6);assert.equal(adopted.pages.length,1);assert.equal(adopted.pages[0].proposal.generation,e.executionPlacement.generation);
  assert.equal(adopted.reviewer.self,f.operator.self);assert.deepEqual(e.approved,source.approved);
  const persisted=await bytes(f),inspection=f.preflight();assert.equal(inspection.actions.every(a=>a.durablyAdopted&&a.eligibleForEnforcement),true,JSON.stringify(inspection));
  assert.equal(inspection.pages[0].pageEntryApproved,true);assert.equal(inspection.enforcementActive,false);
  assert.equal(await bytes(f),persisted);assert.deepEqual(f.preflight(),inspection);
  // Ordinary restart is independent of native plan identities; inspect from fresh
  // imported state, then deliberately use the unchanged production action path.
  const framework=f.framework(),get=(await f.discover(framework)).find(a=>a.name==='get');
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[...f.storePermissions,'archive.records.read']});
  const result=await f.invoke(framework,get.reference,{store:'records',collection:'archive',id:'absent'});
  assert.equal(result.code,'STORE.DENIED','B4b restricts the reviewed maximum; the B4a receipt-wide result is archived');
  await rejected(f.apply(approval));assert.equal(await bytes(f),persisted);
  // Fresh explicit repetition is permitted but is a new review/generation.
  const again=await f.adopt(f.payload(undefined,[boundPage(f)]));assert.notEqual(again.id,approval.id);assert.equal(status(f).status,'adopted');
  await f.adopt({actions:[],pages:[]});assert.equal(status(f).status,'revoked');assert.equal(status(f).eligibleForEnforcement,false);
  assert.equal(f.preflight().actions.every(a=>a.adoptionStatus==='revoked'),true);
  assert.equal(status(f).revokedSubjects.length,7);
});
for(const provider of ['json','sqlite'])test(`BOB4A-02 ${provider}: authentication, exact identities, fresh scopes and reviewed chains reject forgery`,async t=>{
  const f=await fixture(t,provider),payload=f.payload(undefined,[boundPage(f)]),request=f.policyRequest(payload),before=await bytes(f);
  const contexts=[undefined,{...f.operator},new ExecutionContext({...f.operator,capabilities:[]}),new ExecutionContext({...f.operator,package:f.manifest.id}),
    new ExecutionContext({...f.operator,installation:f.entry().receipt.id}),new ExecutionContext({...f.operator,app:'foreign'})];
  for(const installationContext of contexts)await rejected(trusted.planPackagePolicy({...request,installationContext}));
  for(const [key,value] of [['trusted',true],['isAdmin',true],['approved',true],['reviewer',{self:'host'}]])await rejected(trusted.planPackagePolicy({...request,[key]:value}));
  for(const patch of [{app:'foreign'},{package:'foreign/package'},{installation:'foreign'},{policyRevision:9},{packageRevision:9},{revision:9}])await rejected(trusted.planPackagePolicy({...request,...patch}));
  const changes=[
    x=>{x.actions[0].reference.app='foreign';},x=>{x.actions[0].reference.package='foreign/package';},x=>{x.actions[0].reference.installation='foreign';},
    x=>{x.actions[0].reference.action='forged';},x=>{x.actions[0].reference.instance='forged';},x=>{x.actions[0].reference.generation='stale';},
    x=>{x.actions[0].contractHash='0'.repeat(64);},x=>{x.actions[0].scope.wydstore=[];},x=>{x.actions[0].scope.wydstore.push({store:'foreign',collection:'records'});},
    x=>{x.actions.push(x.actions[0]);},x=>{x.pages[0].proposal.app='foreign';},x=>{x.pages[0].proposal.package='foreign/package';},
    x=>{x.pages[0].proposal.installation='foreign';},x=>{x.pages[0].proposal.owner='forged';},x=>{x.pages[0].proposal.page='forged';},
    x=>{x.pages[0].proposal.bindings[0].reference.generation='stale';},x=>{x.pages[0].proposal.bindings[0].capabilities=['store.records.write'];},
    x=>{x.actions=x.actions.filter(a=>a.reference.action!=='get');}
  ];
  for(const mutate of changes){const x=copy(payload);mutate(x);await rejected(f.plan(x));}
  const plan=await f.plan(payload);await rejected(f.review(copy(plan)));await rejected(trusted.approvePackagePolicy(plan,{installationContext:{...f.operator},trusted:true}));
  assert.equal(await bytes(f),before);
});
for(const provider of ['json','sqlite'])test(`BOB4A-03 ${provider}: receipt, policy, manifest and evidence drift fail closed without mtime trust`,async t=>{
  const f=await fixture(t,provider);await f.adopt(f.payload());const file=path.join(f.root,STATE),original=await bytes(f),stat=await fs.stat(file);
  for(const mutate of [s=>{s.packages[0].backoffice.actions[0].scope.wydstore=[];},s=>{s.packages[0].receipt.backofficeHash='0'.repeat(64);},
    s=>{s.packages[0].manifest.backofficeActions[0].permission='forged.action.read';},s=>{s.packages[0].receipt.approved.scopes.wydstore=[];},
    s=>{s.packages[0].backoffice.reviewer.self='forged';}]){
    const s=JSON.parse(original);mutate(s);await fs.writeFile(file,JSON.stringify(s));await fs.utimes(file,stat.atime,stat.mtime);
    const report=f.preflight();assert.ok(report.status==='blocked'||report.installations[0].adoption.status==='stale',JSON.stringify(report));
    if(report.installations[0]?.adoption.status==='stale')await rejected(f.plan(f.payload()));
    await fs.writeFile(file,original);
  }
  const saved=file+'.saved';await fs.rename(file,saved);await fs.symlink(saved,file);assert.equal(f.preflight().status,'blocked');await fs.unlink(file);await fs.rename(saved,file);
  const oldPayload=f.payload();await f.adopt({actions:[],pages:[]});await rejected(f.plan(oldPayload));assert.equal(status(f).status,'revoked');
  await f.adopt(f.payload());await f.adopt(undefined);assert.equal(status(f).status,'stale','ordinary policy revisions cannot silently renew approval');
  await f.adopt(f.payload());await f.place('retire');assert.equal(status(f).status,'stale');assert.equal(status(f).eligibleForEnforcement,false);
});
for(const provider of ['json','sqlite'])test(`BOB4A-04 ${provider}: partial migration, pending conflicts and policy/retirement races preserve one reviewed outcome`,async t=>{
  const f=await fixture(t,provider);await f.adopt(f.payload(['get']));assert.equal(status(f).eligibleForEnforcement,false);assert.equal(status(f).missingActions.length,5);
  const payload=f.payload(),first=await f.plan(payload),second=await f.plan(payload);
  const approval=await f.review(first);await rejected(f.review(second));await rejected(f.place('retire'));
  await trusted.cancelPackagePolicy(f.finish(approval));assert.equal(status(f).status,'stale');
  // A retirement after a read-only plan wins. The reviewed source cannot publish.
  const stale=await f.plan(f.payload());await f.place('retire');await rejected(f.review(stale));
  assert.equal(status(f).eligibleForEnforcement,false);
});
async function childAt(t,f,request,stage,action='apply'){
  const file=path.join(f.root,'adoption-request.json');await fs.writeFile(file,JSON.stringify(request));
  const child=spawn(process.execPath,['test-support/policy-reconciliation-child.js',file,stage,action],{stdio:['ignore','ignore','pipe','ipc']});
  let errors='';child.stderr.on('data',b=>errors+=b);t.after(()=>child.kill('SIGKILL'));
  await Promise.race([once(child,'message',{signal:AbortSignal.timeout(15000)}),once(child,'exit').then(()=>{throw Error(errors||`Exited before ${stage}`);})]);
  return {child,errors:()=>errors,kill:async()=>{const ended=once(child,'exit');child.kill('SIGKILL');await ended;}};
}
for(const provider of ['json','sqlite'])for(const stage of ['PLANNED','CONFIG','CATALOG'])test(`BOB4A-05 ${provider} ${stage}: real killed apply recovers exact evidence and never resurrects revoked approvals`,async t=>{
  const f=await fixture(t,provider);await f.adopt(f.payload());
  const approval=await f.review(await f.plan({actions:[],pages:[]}));
  await (await childAt(t,f,f.finish(approval),stage)).kill();
  assert.equal(f.preflight().status,'blocked');
  await rejected(trusted.recoverPackageEffects({root:f.root,installationContext:new ExecutionContext({...f.operator,capabilities:['packages.lifecycle.manage']})}));
  const recovery={root:f.root,installationContext:f.operator};
  await trusted.recoverPackageEffects(recovery);await trusted.recoverPackageEffects(recovery);
  if(stage==='CATALOG'){
    assert.equal(status(f).status,'revoked');await rejected(trusted.recoverPackageEffects({...recovery,direction:'rollback'}));await rejected(f.apply(approval));
  }else{
    assert.equal(status(f).status,'adopted');assert.equal(f.inspect().approval.id,approval.id);await f.apply(approval);assert.equal(status(f).status,'revoked');
  }
});
for(const stage of ['APPLYING','PUBLISHED'])test(`BOB4A-06 ${stage}: killed approval publication reconciles before apply after restart`,async t=>{
  const f=await fixture(t,'json');await (await childAt(t,f,f.policyRequest(f.payload()),stage,'approve')).kill();
  assert.equal(f.preflight().status,'blocked');await trusted.recoverPackageOperation({root:f.root,installationContext:f.operator});
  if(stage==='PUBLISHED'){
    const approval=f.inspect().approval;assert.ok(approval);assert.equal(status(f).status,'proposed');await f.apply(approval);assert.equal(status(f).status,'adopted');
  }else assert.equal(f.inspect().approval,null);
});
for(const provider of ['json','sqlite'])test(`BOB4A-07 ${provider}: handled partial failure, indeterminate commit and corrupt recovery evidence`,async t=>{
  const f=await fixture(t,provider),approval=await f.review(await f.plan(f.payload())),before=await bytes(f);
  let failed=false;
  await rejected(f.apply(approval,{atStage:stage=>{if(stage==='CONFIG'&&!failed){failed=true;throw Error('test staging fault');}}}));
  assert.equal(await bytes(f),before);assert.equal(status(f).status,'proposed');
  const paused=await childAt(t,f,f.finish(approval),'CATALOG'),closed=once(paused.child,'close');paused.child.send('fail');const [exit]=await closed;
  assert.notEqual(exit,0);assert.match(paused.errors(),/PACKAGE.RECOVERY/);
  assert.equal(f.preflight().status,'blocked');
  const journal=trusted.inspectPackageEffects(f.root),file=path.join(f.root,'content',journal.checkpoint),original=await fs.readFile(file);
  await fs.appendFile(file,' ');await rejected(trusted.recoverPackageEffects({root:f.root,installationContext:f.operator}));assert.equal(f.preflight().status,'blocked');
  await fs.writeFile(file,original);await trusted.recoverPackageEffects({root:f.root,installationContext:f.operator});
  assert.equal(status(f).status,'adopted');await rejected(f.apply(approval));
});
for(const competing of ['apply','cancel'])test(`BOB4A-08 ${competing}: another process completing review during validation cannot be overwritten`,async t=>{
  const f=await fixture(t,'json');await f.adopt(f.payload());const approval=await f.review(await f.plan({actions:[],pages:[]}));
  const paused=await childAt(t,f,f.finish(approval),'POLICY_VALIDATED');
  const source=await bytes(f);
  await assert.rejects(competing==='apply'?f.apply(approval):trusted.cancelPackagePolicy(f.finish(approval)),{code:'PACKAGE.BUSY'});
  assert.equal(await bytes(f),source);
  const closed=once(paused.child,'close');paused.child.send('continue');const [code]=await closed;
  assert.equal(code,0,paused.errors());assert.equal(status(f).status,'revoked');

});
test('BOB4A-09: two actual legacy modules are reviewed independently; other installation cannot borrow approval',async t=>{
  const f=adoptionFixture(await modulesFixture(t,'json'));
  await f.adopt(f.payload());let report=f.preflight();
  assert.equal(report.installations.find(i=>i.package===f.manifest.id).adoption.status,'adopted');
  assert.equal(report.actions.find(a=>a.action==='list-notices').durablyAdopted,false);
  const membersPayload=f.payload();const {noticeManifest}=await import('../test-support/backoffice-modules.js');f.manifest=noticeManifest;
  await rejected(f.plan(membersPayload));await f.adopt(f.payload());report=f.preflight();
  assert.equal(report.actions.every(a=>a.durablyAdopted),true);assert.equal(report.actions.length,2);
});
test('BOB4A-10: installed Taskboard informational Page adopts without granting live Page permission',async t=>{
  const f=adoptionFixture(await installedTaskboardFixture(t)),s=f.state(),e=f.entry();
  await trusted.executionPlacement({root:f.root,app:f.app,package:f.manifest.id,installation:e.receipt.id,revision:s.revision,action:'relocate',context:'BackOffice',installationContext:f.operator,verifiedPackages:f.verifiedPackages});
  await f.adopt(f.payload([],[f.proposal()]));assert.equal(status(f).pages.length,1);assert.equal(status(f).actions.length,0);
  assert.equal(status(f).eligibleForEnforcement,true);assert.equal(f.preflight().pages[0].pageEntryApproved,true);
});
for(const provider of ['json','sqlite'])test(`BOB4A-11 ${provider}: real multi-resource action and transaction approval never clips required resources`,async t=>{
  const f=adoptionFixture(await twoResourceActionFixture(t,provider,{edit(m){for(const a of m.backofficeActions.filter(a=>['get','transaction'].includes(a.id)))a.scopes.wydstore.push('archive');},configure(f){
    f.config.libraries.find(l=>l.id==='wydstore').options.stores.find(s=>s.id==='records').authorization.collections.archive.transaction={contexts:['BackOffice'],permission:'archive.records.write'};
  }}));
  const payload=f.payload();for(const name of ['get','transaction'])assert.equal(payload.actions.find(a=>a.reference.action===name).scope.wydstore.length,2);
  const narrowed=copy(payload);narrowed.actions.find(a=>a.reference.action==='get').scope.wydstore.pop();await rejected(f.plan(narrowed));
  await f.adopt(payload);assert.equal(status(f).eligibleForEnforcement,true);assert.equal(status(f).actions.find(a=>a.reference.action==='get').scope.wydstore.length,2);
});
for(const provider of ['json','sqlite'])test(`BOB4A-12 ${provider}: accepted upgrade, replacement and removal fence adoption; reinstall cannot transfer it`,async t=>{
  const f=await fixture(t,provider);await f.adopt(f.payload(undefined,[boundPage(f)]));const old=f.entry(),oldPayload=f.payload(),stalePlan=await f.plan(oldPayload);
  const file=path.join(f.candidate.packagePath,'manifest.json'),m=JSON.parse(await fs.readFile(file));m.version='0.1.1';await fs.writeFile(file,JSON.stringify(m));
  await trusted.packageOperation(f.operation('update',[f.candidate]));assert.notEqual(f.entry().receipt.id,old.receipt.id);assert.equal(status(f).status,'stale');await rejected(f.plan(oldPayload));await rejected(f.review(stalePlan));
  await f.adopt(f.payload());await f.place('replace');assert.equal(status(f).status,'stale');
  await f.adopt(f.payload());await trusted.packageOperation(f.operation('uninstall'));
  const retained=f.state().retained.find(r=>r.entry.manifest.id===f.manifest.id);assert.ok(retained.entry.backoffice);assert.equal(f.preflight().installations[0].adoption.eligibleForEnforcement,false);
  await trusted.packageOperation(f.operation('install',[f.candidate]));assert.equal(status(f).status,'stale');assert.equal(status(f).eligibleForEnforcement,false);
});
for(const provider of ['json','sqlite'])test(`BOB4A-13 ${provider}: invalid installed declarations, foreign resources and operations reject before adoption`,async t=>{
  const {storeActionFixture}=await import('../test-support/backoffice-store.js');
  for(const edit of [m=>{delete m.backofficeActions[0].scopes;},m=>{m.backofficeActions[0].scopes={wydstore:[]};},m=>{m.backofficeActions[0].service.operation='unsupported';}]){
    await rejected(storeActionFixture(t,provider,{edit}));
  }
  for(const field of ['app','package'])await rejected(storeActionFixture(t,provider,{configure(f){f.config.libraries.find(l=>l.id==='wydstore').options.stores.find(s=>s.id==='records')[field]=field==='app'?'foreign':'foreign/package';}}));
  const f=await fixture(t,provider),payload=f.payload(),request=f.policyRequest(payload);
  request.policy.grants=copy(request.policy.grants);request.policy.grants.scopes.wydstore=['records'];
  await rejected(trusted.planPackagePolicy(request));
});
for(const provider of ['json','sqlite'])test(`BOB4A-14 ${provider}: exact tree, nested inheritance, handles and stale reviewed plans are validated`,async t=>{
  const f=await fixture(t,provider),p=boundPage(f),payload=f.payload(undefined,[p]);
  const plan=await f.plan(payload),file=path.join(f.root,STATE),original=await bytes(f),state=JSON.parse(original);
  state.packages[0].manifest.backofficeActions[0].permission='other.action.read';await fs.writeFile(file,JSON.stringify(state));await rejected(f.review(plan));await fs.writeFile(file,original);
  for(const mutate of [p=>{p.bindings[0].consumer='foreign-control';},p=>{p.bindings[0].constraints[0].type='foreign/control';},
    p=>{p.bindings[0].constraints.push({...copy(p.bindings[0].constraints[0]),type:f.pageFacts().nodes.find(n=>n.id===f.entry().instance).type,targets:['backoffice-members/get','backoffice-members/create']});},
    p=>{p.bindings[0].fixedInput={id:new Map()};},p=>{p.bindings[0].handle=f.operator;}]){
    const x=copy(payload);mutate(x.pages[0].proposal);await rejected(f.plan(x));
  }
  let read=false;const invalid=copy(payload);Object.defineProperty(invalid.pages[0].proposal,'permission',{enumerable:true,get(){read=true;return 'content.pages.view';}});
  await rejected(f.plan(invalid));assert.equal(read,false);
  // Source tree drift with an otherwise valid Page object invalidates the plan.
  const fresh=await f.plan(payload),changed=JSON.parse(original),tree=JSON.parse(changed.app);tree.properties.title='changed review source';changed.app=JSON.stringify(tree);
  await fs.writeFile(file,JSON.stringify(changed));await rejected(f.review(fresh));await fs.writeFile(file,original);
});
test('BOB4A-15: concurrent conflicting adoption/revocation has one catalog writer and no automatic replay',async t=>{
  const f=await fixture(t,'json');await f.adopt(f.payload());
  const adopting=await f.plan(f.payload()),revoking=await f.plan({actions:[],pages:[]});
  const results=await Promise.allSettled([f.review(adopting),f.review(revoking)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const approval=results.find(r=>r.status==='fulfilled').value;
  await f.apply(approval);assert.equal(f.state().policyHistory.length,2);await rejected(f.apply(approval));
  let entered,resume;const ready=new Promise(r=>entered=r),held=new Promise(r=>resume=r),plan=await f.plan(f.payload());
  const publishing=trusted.approvePackagePolicy(plan,{installationContext:f.operator,allowExpansion:true},{atStage:async stage=>{if(stage==='PLANNED'){entered();await held;}}});
  await ready;
  try{await rejected(Promise.resolve().then(()=>f.place('retire')));await rejected(trusted.packageOperation(f.operation('update',[f.candidate])));}
  finally{resume();}
  await f.apply(await publishing);
});
test('BOB4A-16: evidence expansion needs authenticated explicit expansion review; denial preserves source',async t=>{
  const f=await fixture(t,'json'),before=await bytes(f),plan=await f.plan(f.payload());assert.equal(plan.expanded,true);
  await assert.rejects(trusted.approvePackagePolicy(plan,{installationContext:f.operator}),{code:'PACKAGE.APPROVAL'});assert.equal(await bytes(f),before);
  await f.adopt(f.payload(['get']));const expanded=await f.plan(f.payload());assert.equal(expanded.backofficeChanges.expanded,true);
  await f.review(expanded);assert.equal(f.inspect().approval.plan.backofficeChanges.expanded,true);
});

for(const provider of ['json','sqlite'])test(`BOB4A-17 ${provider}: read-only inspection preserves files and metadata; restored-mtime evidence tamper fences cached authority`,async t=>{
  const f=await fixture(t,provider);await f.adopt(f.payload(undefined,[boundPage(f)]));
  const snapshot=async()=>{
    const out=[];const walk=async directory=>{for(const name of (await fs.readdir(directory)).sort()){
      const file=path.join(directory,name),s=await fs.lstat(file,{bigint:true});
      out.push([path.relative(f.root,file),String(s.mode),String(s.size),String(s.mtimeNs),s.isFile()?createHash('sha256').update(await fs.readFile(file)).digest('hex'):null]);
      if(s.isDirectory())await walk(file);
    }};await walk(f.root);return out;
  };
  const before=await snapshot();f.inspect();f.preflight();f.preflight();assert.deepEqual(await snapshot(),before);
  const e=f.entry(),context=trusted.acquirePackageExecution({root:f.root,app:e.executionPlacement.app,package:e.manifest.id,installation:e.receipt.id,generation:e.executionPlacement.generation,self:e.instance,installationContext:f.operator});
  const file=path.join(f.root,STATE),original=await bytes(f),s=await fs.stat(file),changed=JSON.parse(original);
  const self=changed.packages[0].backoffice.reviewer.self;changed.packages[0].backoffice.reviewer.self=(self[0]==='x'?'y':'x')+self.slice(1);
  const text=JSON.stringify(changed,null,2)+'\n';assert.equal(Buffer.byteLength(text),Buffer.byteLength(original));
  await fs.writeFile(file,text);await fs.utimes(file,s.atime,s.mtime);assert.equal(f.preflight().status,'blocked');assert.throws(()=>checkContext(context));
  await fs.writeFile(file,original);assert.equal(status(f).status,'adopted');assert.throws(()=>checkContext(context),'restoring bytes never revives a fenced handle');
});
for(const provider of ['json','sqlite'])test(`BOB4A-18 ${provider}: adopted Page evidence enables no HTTP Page, permission or administrative review endpoint`,async t=>{
  const f=await fixture(t,provider);await f.adopt(f.payload(undefined,[boundPage(f)]));
  const {createApp}=await import('../app.js');const app=createApp({root:f.root,libraries:f.libraries,localHostname:'127.0.0.1',logger:{error(){assert.fail('Unexpected HTTP exception');}}});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>app.shutdown(server));
  const base='http://127.0.0.1:'+server.address().port;
  for(const route of ['/administration/','/backoffice/administration','/backoffice/api/pages','/backoffice/api/approvals','/backoffice/api/host-policy']){
    const response=await fetch(base+route,{headers:{Cookie:'wydgit-auth='+f.login.token}});assert.notEqual(response.status,200,route);await response.text();
  }
  const shell=await fetch(base+'/backoffice',{headers:{Cookie:'wydgit-auth='+f.login.token}});assert.equal(shell.status,200);await shell.text();
});
