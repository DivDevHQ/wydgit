import test from 'node:test';
import assert from 'node:assert/strict';
import * as trusted from 'wydgine/trusted/packages';

test('BOB3-00: trusted read-only preflight and pure contract validators are available',()=>{
  for(const name of ['inspectBackOfficeMigration','validateBackOfficePageEntry','validateBackOfficeActionScope'])
    assert.equal(typeof trusted[name],'function',name);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {twoResourceActionFixture,installedTaskboardFixture} from '../test-support/backoffice-preflight.js';
import {modulesFixture} from '../test-support/backoffice-modules.js';
import {catalog,plain} from '../test-support/backoffice.js';
import {loadRepository} from '../wydgine/repository.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {actionReference} from '../packages/wydgine/src/engine/packages/backoffice-preflight-contract.js';
const {inspectBackOfficeMigration:inspect,validateBackOfficePageEntry:page,validateBackOfficeActionScope:scope}=trusted;
const codes=r=>r.findings.map(f=>f.code);
const hasCode=(r,code)=>assert.ok(codes(r).includes(code),JSON.stringify(r));
const run=(f,extra={})=>inspect({root:f.root,libraries:f.libraries,installationContext:f.operator,verifiedPackages:f.verifiedPackages??{},...extra});
function facts(f,id='get'){
  const entry=plain(catalog(f).packages.find(e=>e.manifest.id===f.manifest.id)),action=entry.manifest.backofficeActions.find(a=>a.id===id);
  return {entry,app:f.request.app,action:structuredClone(action),operation:plain(f.libraries.administrativeOperation(action.service.library,action.service.operation)),
    stores:plain(f.config.libraries.find(l=>l.id==='wydstore').options.stores)};
}
function pageFacts(f){
  const entry=plain(catalog(f).packages.find(e=>e.manifest.id===f.manifest.id)),model=loadRepository(f.root,{verifiedPackages:f.verifiedPackages??{}}),nodes=[];
  const pages=[entry.placement.page];
  for(const page of pages){const walk=id=>{const n=model.runtime.get(id),d=model.registry.get(n.prototype);nodes.push({id,page,type:n.prototype,
    ancestors:[n.prototype,...d.ancestors],isPage:model.registry.isA(n.prototype,'wydgit.core/page')});Object.values(n.slots).flat().forEach(walk);};walk(page);}
  const proposal={schema:'wydgit.backoffice-page-entry-proposal/1',key:'administration',app:model.runtime.rootId,package:entry.manifest.id,
    installation:entry.receipt.id,owner:entry.instance,page:entry.placement.page,generation:entry.executionPlacement.generation,
    policyRevision:entry.policyRevision??0,permission:'content.pages.view',bindings:[]};
  return {proposal,entry,app:model.runtime.rootId,pages,nodes};
}
function reviewFor(facts,result,subject){return {schema:'wydgit.backoffice-review-candidate/1',app:facts.app,package:facts.entry.manifest.id,
  installation:facts.entry.receipt.id,generation:facts.entry.executionPlacement.generation,policyRevision:facts.entry.policyRevision??0,
  subject,contractHash:result.contractHash,status:'reviewed'};}
async function snapshot(root){
  const files=[];async function walk(dir){for(const name of (await fs.readdir(dir)).sort()){
    const file=path.join(dir,name),stat=await fs.lstat(file,{bigint:true});
    files.push([path.relative(root,file),String(stat.mode),String(stat.size),String(stat.mtimeNs),stat.isFile()?createHash('sha256').update(await fs.readFile(file)).digest('hex'):null]);
    if(stat.isDirectory())await walk(file);
  }}await walk(root);return files;
}
for(const provider of ['json','sqlite'])test(`BOB3-01 ${provider}: installed two-resource requirements, maxima, ownership and review candidates`,async t=>{
  const f=await twoResourceActionFixture(t,provider),base=facts(f);
  const valid=scope(base);assert.equal(valid.valid,true,JSON.stringify(valid));assert.equal(valid.enforcementReady,false);
  assert.equal(valid.reviewState,'missing');assert.equal(valid.legacyExposure.wydstore.length,2);assert.equal(valid.restrictiveScope.wydstore.length,1);
  assert.equal(Object.hasOwn(valid,'identityPermissions'),false);
  const scenarios=[
    ['missing scopes',x=>{delete x.action.scopes;},'BO.SCOPE_MISSING'],
    ['empty scopes',x=>{x.action.scopes={wydstore:[]};},'BO.SCOPE_INVALID'],
    ['duplicate scopes',x=>{x.action.scopes.wydstore=['records','records'];},'BO.SCOPE_INVALID'],
    ['unknown resource',x=>{x.action.scopes.wydstore=['unknown'];},'BO.RESOURCE_UNKNOWN'],
    ['wildcard',x=>{x.action.scopes.wydstore=['*'];},'BO.SCOPE_INVALID'],
    ['malformed identifier',x=>{x.action.scopes.wydstore=['records/../archive'];},'BO.RESOURCE_UNKNOWN'],
    ['missing mapping',x=>{delete x.entry.storageMappings.records;delete x.entry.receipt.storageMappings.records;},'BO.MAPPING_MISSING'],
    ['outside receipt',x=>{x.entry.approved.scopes.wydstore=['records'];x.entry.receipt.approved.scopes.wydstore=['records'];x.entry.storageScopes=[x.entry.storageMappings.records];x.action.scopes.wydstore=['records','archive'];},'BO.SCOPE_UNAPPROVED'],
    ['foreign site',x=>{x.stores.find(s=>s.id==='records').app='foreign-site';},'BO.RESOURCE_OWNER'],
    ['foreign package',x=>{x.stores.find(s=>s.id==='records').package='foreign/package';},'BO.RESOURCE_OWNER'],
    ['foreign principal',x=>{x.stores.find(s=>s.id==='records').principal='foreign/package';},'BO.RESOURCE_OWNER'],
    ['foreign receipt ownership',x=>{x.stores.find(s=>s.id==='records').installation='foreign';},'BO.RESOURCE_OWNER'],
    ['read attempting write',x=>{x.action.capability='store.records.write';},'BO.OPERATION'],
    ['unapproved capability',x=>{x.entry.approved.capabilities=[];x.entry.receipt.approved.capabilities=[];},'BO.CAPABILITY_APPROVAL'],
    ['unknown operation',x=>{x.action.service.operation='eval';x.operation=null;},'BO.OPERATION'],
    ['API mismatch',x=>{x.action.service.apiVersion='9.0.0';},'BO.OPERATION'],
    ['package schema mismatch',x=>{x.entry.manifest.schema='wydgit-package/9';},'BO.INVALID_CANDIDATE'],
    ['receipt schema mismatch',x=>{x.entry.receipt.schema='wydgit-install-receipt/9';},'BO.INSTALLATION_IDENTITY'],
    ['receipt drift',x=>{x.entry.receipt.approved.scopes.wydstore=[];},'BO.RECEIPT_DRIFT'],
    ['initiating scope absent',x=>{x.initiating={app:x.app,package:x.entry.manifest.id,installation:x.entry.receipt.id,capabilities:x.entry.approved.capabilities,scopes:{wydstore:[]}};},'BO.INITIATING_SCOPE']
  ];
  for(const [name,mutate,code] of scenarios)await t.test(name,()=>{const x=structuredClone(base);mutate(x);const r=scope(x);assert.equal(r.valid,false,JSON.stringify(r));hasCode(r,code);});
  await t.test('physical Store identifiers and grant ordering preserve canonical compatibility',()=>{
    const x=structuredClone(base);x.entry.approved.scopes.wydstore.reverse();x.entry.receipt.approved.scopes.wydstore.reverse();
    const store=x.stores.find(s=>s.id==='records');store.id='Records_DB';
    for(const mapping of Object.values(x.entry.storageMappings))mapping.store='Records_DB';
    for(const mapping of Object.values(x.entry.receipt.storageMappings))mapping.store='Records_DB';
    for(const mapping of x.entry.storageScopes)mapping.store='Records_DB';
    assert.equal(scope(x).valid,true,JSON.stringify(scope(x)));
  });
  await t.test('all required resources are maxima; no clipping counts as success',()=>{
    const x=structuredClone(base);x.action.scopes.wydstore.push('archive');
    const r=scope(x);assert.equal(r.valid,true,JSON.stringify(r));assert.equal(r.restrictiveScope.wydstore.length,2);hasCode(r,'BO.MULTI_RESOURCE_REVIEW');
    x.stores.find(s=>s.id==='records').authorization.collections.archive.get.contexts=['FrontEnd'];
    hasCode(scope(x),'BO.REQUIRED_POLICY');
  });
  await t.test('transaction requires policy on both declared collections; member checks stay live',()=>{
    const x=facts(f,'transaction');x.action.scopes.wydstore.push('archive');hasCode(scope(x),'BO.REQUIRED_POLICY');
    x.stores.find(s=>s.id==='records').authorization.collections.archive.transaction={contexts:['BackOffice'],permission:'archive.records.write'};
    const r=scope(x);assert.equal(r.valid,true,JSON.stringify(r));assert.equal(r.restrictiveScope.wydstore.length,2);
    assert.deepEqual(plain(r.transaction),{sameStoreOnly:true,allMembersRequireLiveAuthorization:true});assert.equal(r.enforcementReady,false);
  });
  await t.test('matching, stale and revoked candidate review never grants authority',()=>{
    const review=reviewFor(base,valid,`action:${base.action.owner}/${base.action.id}`),r=scope({...base,review});
    assert.equal(r.valid,true);assert.equal(r.reviewState,'matching-candidate');assert.equal(r.authority,false);assert.equal(r.enforcementReady,false);
    for(const [key,value] of [['generation','stale'],['policyRevision',99],['app','foreign'],['installation','foreign'],['contractHash','0'.repeat(64)]]){
      const bad={...review,[key]:value};hasCode(scope({...base,review:bad}),'BO.REVIEW_STALE');
    }
    hasCode(scope({...base,review:{...review,status:'revoked'}}),'BO.REVIEW_REVOKED');
  });
});

for(const provider of ['json','sqlite'])test(`BOB3-02 ${provider}: deterministic nonmutating installed inventory preserves legacy runtime`,async t=>{
  const f=await twoResourceActionFixture(t,provider),before=await snapshot(f.root),first=run(f),second=run(f);
  assert.equal(first.status,'requires-review',JSON.stringify(first));assert.deepEqual(first,second);assert.deepEqual(await snapshot(f.root),before);
  assert.equal(first.actions.length,6);assert.ok(first.actions.every(a=>a.status==='requires-review'&&!a.enforcementReady));
  const get=first.actions.find(a=>a.action==='get');assert.equal(get.legacyExposure.wydstore.length,2);assert.equal(get.restrictiveScope.wydstore.length,1);
  assert.ok(first.pages.every(p=>!p.pageEntryApproved&&p.status==='not-applicable'));
  const base=facts(f),review=reviewFor(base,scope(base),`action:${base.action.owner}/${base.action.id}`);
  const reviewed=run(f,{reviews:[review]});assert.equal(reviewed.actions.find(a=>a.action==='get').reviewState,'matching-candidate');
  assert.ok(reviewed.actions.every(a=>a.status==='requires-review'),'candidate review is never durable approval');
  const candidate=structuredClone(base.action);delete candidate.scopes;
  const missing=run(f,{actionCandidates:[{package:base.entry.manifest.id,installation:base.entry.receipt.id,action:candidate}]});
  assert.equal(missing.actions.find(a=>a.action==='get').status,'requires-declaration',JSON.stringify(missing));
  assert.deepEqual(await snapshot(f.root),before);
  for(const patch of [{installationContext:{...f.operator}},{installationContext:new ExecutionContext({...f.operator,capabilities:[]})},
    {actionCandidates:[{package:'foreign/package',installation:base.entry.receipt.id,action:base.action}]},{reviews:[review,review]}])assert.equal(run(f,patch).status,'blocked');
  const serialized=JSON.stringify(first);for(const secret of [f.login.token,f.password,f.root])assert.ok(!serialized.includes(secret));
  assert.ok(Object.isFrozen(first.actions));
  // B3 changes no action scope: the existing API still exposes full-receipt
  // behavior, independently qualified by BOB1-02 in the same focused selection.
  await f.place('retire');const retired=run(f);assert.ok(retired.actions.every(a=>a.status==='not-applicable'));assert.equal(retired.status,'not-applicable');
});

for(const provider of ['json','sqlite'])test(`BOB3-03 ${provider}: accepted integrity, symlink and recovery barriers cannot be bypassed`,async t=>{
  const f=await twoResourceActionFixture(t,provider),file=path.join(f.root,'content/installed-packages.json'),original=await fs.readFile(file,'utf8');
  const change=async mutate=>{const s=JSON.parse(original);mutate(s);await fs.writeFile(file,JSON.stringify(s));const r=run(f);assert.equal(r.status,'blocked',JSON.stringify(r));assert.equal(r.actions.length,0);await fs.writeFile(file,original);};
  await change(s=>{s.packages[0].receipt.approved.scopes.wydstore=[];});
  await change(s=>{const e=s.packages[0];e.resources[e.manifest.resources.template]+=' ';});
  await change(s=>{s.packages[0].executionPlacement.generation='0'.repeat(36);});
  const target=file+'.original';await fs.rename(file,target);await fs.symlink(target,file);
  assert.equal(run(f).status,'blocked');await fs.unlink(file);await fs.rename(target,file);
  const barrier=path.join(f.root,'content/.package-install.lock');await fs.writeFile(barrier,'{}');hasCode(run(f),'PACKAGE.RECOVERY');await fs.unlink(barrier);
  const config=path.join(f.root,'wydgit.config.json'),saved=await fs.readFile(config);await fs.appendFile(config,' ');hasCode(run(f),'PACKAGE.DRIFT');await fs.writeFile(config,saved);
  assert.equal(run(f).status,'requires-review');
});

test('BOB3-04: actual independent installed members/notices inventory remains separate and requires review',async t=>{
  const f=await modulesFixture(t,'json'),report=run(f);assert.equal(report.actions.length,2,JSON.stringify(report));
  assert.deepEqual(report.actions.map(a=>[a.package,a.action,a.status]),[
    ['divdev/backoffice-members','list-members','requires-review'],['divdev/backoffice-notices','list-notices','requires-review']]);
  assert.equal(report.actions[0].restrictiveScope.wydgate[0],'boilerplate');
});

for(const provider of ['json','sqlite'])test(`BOB3-05 ${provider}: exact Page proposals, typed nested/inherited references and review separation`,async t=>{
  const f=await twoResourceActionFixture(t,provider),base=pageFacts(f),a=base.entry.manifest.backofficeActions.find(a=>a.id==='get');
  // The installed section is a legitimate nested Page consumer and inherits from
  // core section. Constraints are review-candidate metadata, not prototype grants.
  const consumer=base.nodes.find(n=>n.id==='backoffice-members');
  const constraint={type:consumer.ancestors.at(-1),targets:[`${a.owner}/${a.id}`],effect:a.effect,input:a.input,output:a.output};
  base.proposal.bindings=[{name:'load',consumer:consumer.id,reference:actionReference(base.entry,a,base.app),usage:'prepare',fixedInput:{},constraints:[constraint]}];
  const valid=page(base);assert.equal(valid.valid,true,JSON.stringify(valid));assert.equal(valid.pageEntryApproved,false);hasCode(valid,'BO.REVIEW_REQUIRED');
  const review=reviewFor(base,valid,'page:administration'),approved=page({...base,review});assert.equal(approved.reviewState,'matching-candidate');assert.equal(approved.pageEntryApproved,false);
  const report=run(f,{pageProposals:[base.proposal],reviews:[review]});assert.equal(report.pages[0].valid,true,JSON.stringify(report));
  const scenarios=[
    ['permission absent',x=>{delete x.proposal.permission;},'BO.PAGE_DECLARATION'],
    ['oversized permission',x=>{x.proposal.permission='content.pages.'+'x'.repeat(129);},'BO.PAGE_DECLARATION'],
    ['invalid root',x=>{x.proposal.page=x.entry.instance;},'BO.PAGE_ROOT'],
    ['foreign installation',x=>{x.proposal.installation='foreign';},'BO.PAGE_IDENTITY'],
    ['foreign site',x=>{x.proposal.app='foreign';},'BO.PAGE_IDENTITY'],
    ['foreign package',x=>{x.proposal.package='foreign/package';},'BO.PAGE_IDENTITY'],
    ['stale generation',x=>{x.proposal.generation='stale';},'BO.PAGE_STALE'],
    ['retired',x=>{x.entry.executionPlacement.status='retired';x.entry.receipt.executionPlacement.status='retired';},'BO.PLACEMENT'],
    ['foreign action receipt',x=>{x.proposal.bindings[0].reference.installation='foreign';},'BO.BINDING_REFERENCE'],
    ['foreign action site',x=>{x.proposal.bindings[0].reference.app='foreign';},'BO.BINDING_REFERENCE'],
    ['foreign action package',x=>{x.proposal.bindings[0].reference.package='foreign/package';},'BO.BINDING_REFERENCE'],
    ['missing action',x=>{x.proposal.bindings[0].reference.action='missing';},'BO.BINDING_REFERENCE'],
    ['ambiguous action',x=>{x.entry.manifest.backofficeActions.push(x.entry.manifest.backofficeActions[0]);},'BO.INVALID_CANDIDATE'],
    ['nested privilege manufacture',x=>{x.proposal.bindings[0].capabilities=['store.records.write'];},'BO.BINDING_DECLARATION'],
    ['inherited target expansion',x=>{x.proposal.bindings[0].constraints.push({...structuredClone(constraint),type:consumer.type,targets:[...constraint.targets,'backoffice-members/create']});},'BO.BINDING_EXPANSION'],
    ['unknown allowed target',x=>{x.proposal.bindings[0].constraints[0].targets.push('foreign/missing');},'BO.BINDING_CONSTRAINT'],
    ['invalid fixed params',x=>{x.proposal.bindings[0].fixedInput={id:123};},'BO.BINDING_INPUT'],
    ['invented ancestry',x=>{x.proposal.bindings[0].constraints[0].type='foreign/control';},'BO.BINDING_CONSTRAINT']
  ];
  for(const [name,mutate,code] of scenarios)await t.test(name,()=>{const x=structuredClone(base);mutate(x);const r=page(x);assert.equal(r.valid,false,JSON.stringify(r));hasCode(r,code);});
  await t.test('inherited binding narrowing is valid data',()=>{
    const x=structuredClone(base);x.proposal.bindings[0].constraints.push({...structuredClone(constraint),type:consumer.type});
    assert.equal(page(x).valid,true,JSON.stringify(page(x)));
  });
  await t.test('Page preparation rejects write binding',()=>{
    const x=structuredClone(base),write=x.entry.manifest.backofficeActions.find(a=>a.id==='create'),b=x.proposal.bindings[0];
    b.reference=actionReference(x.entry,write,x.app);b.constraints=[{...constraint,targets:[`${write.owner}/${write.id}`],effect:write.effect,input:write.input,output:write.output}];
    hasCode(page(x),'BO.PREPARE_WRITE');b.usage='intent';assert.equal(page(x).valid,true);
  });
  assert.equal(page({...base,review:{...review,status:'revoked'}}).valid,false);
  assert.equal(page({...base,proposal:{...base.proposal,context:'HostAdmin'}}).valid,false);
  assert.equal(run(f,{pageProposals:[base.proposal,base.proposal]}).status,'blocked');
});

test('BOB3-06: B1 installed native Taskboard Page validates informational proposal after exact placement',async t=>{
  const f=await installedTaskboardFixture(t);await f.operation('update');
  const s=catalog(f),entry=s.packages[0];
  await trusted.executionPlacement({root:f.root,app:f.app,package:f.manifest.id,installation:entry.receipt.id,revision:s.revision,action:'relocate',context:'BackOffice',installationContext:f.operator,verifiedPackages:f.verifiedPackages});
  const base=pageFacts(f),r=page(base);assert.equal(r.valid,true,JSON.stringify(r));assert.equal(r.pageEntryApproved,false);
  const before=await snapshot(f.root),report=run(f,{pageProposals:[base.proposal]});assert.equal(report.pages[0].valid,true,JSON.stringify(report));assert.deepEqual(await snapshot(f.root),before);
  assert.equal(report.actions.length,0);assert.equal(report.pages[0].status,'requires-review');
});

test('BOB3-07: JSON/accessor/handle and limits reject without evaluating injected code',()=>{
  let read=false;const malformed={get entry(){read=true;return {};}};assert.equal(scope(malformed).valid,false);assert.equal(read,false);
  for(const value of [new Map(),()=>{},null,{entry:'x'.repeat(4*1024*1024+1)}])assert.equal(page(value).valid,false);
});
