import {reviewFixture,reviewedFramework} from '../test-support/backoffice-enforcement.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {actionFixture as unreviewedActionFixture,plain,catalog} from '../test-support/backoffice.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {validatePackageManifest,packageOperation,planPackageOperation,acquirePackageExecution,recoverPackageOperation,planPackagePolicy,approvePackagePolicy,applyPackagePolicy} from '../wydgine/packages/index.js';
import {createBackOfficeActions} from 'wydgine/trusted/packages';
import {initializeHost} from '../wydgine/host.js';
import {createGate} from '@wydgit/gate/client';

const actionFixture=async(...args)=>reviewFixture(await unreviewedActionFixture(...args));
const denied=result=>assert.equal(result.ok,false,JSON.stringify(result));
for(const provider of ['json','sqlite']) {
  test(`ACT-01 ADM-01 GAT-02 ${provider}: genuine installed roster, private discovery, input and output`,async t=>{
    const f=await actionFixture(t,provider),api=await reviewedFramework(f),actions=await f.discover(api);
    assert.equal(actions.length,1);const [action]=actions;
    assert.equal(action.id,'divdev/backoffice-members#backoffice-members/list-members');
    assert.equal(action.effect,'read');assert.equal(action.service,undefined);
    const result=await f.invoke(api,action.reference,{limit:5});assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(result.value.members[0].id,f.user.membership.id);assert.equal(result.value.total,1);
    assert.doesNotMatch(JSON.stringify(result),/password|hash|token|session|credential|provider|handle/i);
    for(const input of [{unexpected:true},{limit:0},{limit:'5'},[],null,{limit:51}])denied(await f.invoke(api,action.reference,input));
    const oversized=await f.invoke(api,action.reference,{padding:'x'.repeat(65537)});denied(oversized);
    let accessed=false;const input={get limit(){accessed=true;return 1;}};denied(await f.invoke(api,action.reference,input));assert.equal(accessed,false);
    denied(await api.invoke({...f.request,reference:{...action.reference,action:'unknown'},input:{}}));
    for(const patch of [{app:'foreign'},{installation:'forged'},{instance:'home'},{revision:'stale'},{generation:'stale'}])denied(await f.invoke(api,{...action.reference,...patch}));
    denied(await api.invoke({...f.request,reference:action.reference,input:{},identity:{authenticated:true}}));
    denied(await api.discover({...f.request,app:'foreign'}));
    denied(await api.discover({...f.request,session:'forged'}));
    denied(await api.discover({app:'boilerplate',identity:plain(f.user)}));
    assert.equal((await api.discover({...f.request,offset:1})).value.actions.length,0);
  });

  test(`ACT-02 GAT-02/03 ${provider}: live direct/group/role permissions, downgrade, revocation and expiry`,async t=>{
    const f=await actionFixture(t,provider),api=await reviewedFramework(f),[action]=await f.discover(api),userId=f.user.account.id;
    const assign=(roles=[],permissions=[])=>f.gate.assignUser({userId,roles,permissions});
    await assign();assert.deepEqual(await f.discover(api),[]);denied(await f.invoke(api,action.reference));
    const role=await f.gate.createRole({name:'Roster reader',permissions:['gate.members.manage']});await assign([role.id]);
    assert.equal((await f.invoke(api,action.reference)).ok,true);
    await f.gate.updateRole({id:role.id,permissions:[]});denied(await f.invoke(api,action.reference));
    const group=await f.gate.createGroup({name:'Readers',permissions:['gate.members.manage'],roles:[],members:[userId]});
    assert.equal((await f.discover(api)).length,1);await f.gate.updateGroup({id:group.id,permissions:[]});denied(await f.invoke(api,action.reference));
    await assign([],['gate.members.manage']);
    await f.gate.updateGroup({id:group.id,roles:[role.id]});await f.gate.updateRole({id:role.id,permissions:['gate.members.manage']});
    await assign();assert.equal((await f.invoke(api,action.reference)).ok,true);
    await f.gate.updateRole({id:role.id,permissions:[]});denied(await f.invoke(api,action.reference));
    await assign([],['gate.members.manage']);
    const now=t.mock.method(Date,'now',()=>f.login.session.expiresAt);denied(await f.invoke(api,action.reference));now.mock.restore();
    await f.gate.manageMember({id:f.user.membership.id,status:'suspended'});denied(await f.invoke(api,action.reference));
    await f.gate.manageMember({id:f.user.membership.id,status:'active'});
    // Suspension revoked the old session; restored membership cannot restore it.
    denied(await f.invoke(api,action.reference));f.login=await f.gate.login('alice',f.password);f.request.session=f.login.token;
    assert.equal((await f.invoke(api,action.reference)).ok,true);
    await f.gate.manageMember({id:f.user.membership.id,role:'member'});denied(await f.invoke(api,action.reference));
    f.login=await f.gate.login('alice',f.password);f.request.session=f.login.token;
    assert.deepEqual(await f.discover(api),[]);denied(await f.invoke(api,action.reference));
  });

  test(`ACT-03 CTX-05/06 LIF-01 ${provider}: replacement, relocation, retirement, retained reinstall and upgrade`,async t=>{
    const f=await actionFixture(t,provider),old=await reviewedFramework(f),[first]=await f.discover(old);
    await f.place('replace');assert.deepEqual(await f.discover(old),[]);denied(await f.invoke(old,first.reference));
    let fresh=await reviewedFramework(f),[next]=await f.discover(fresh);assert.notDeepEqual(next.reference,first.reference);denied(await f.invoke(fresh,first.reference));
    await f.place('relocate','FrontEnd');assert.deepEqual(await f.discover(await reviewedFramework(f)),[]);denied(await f.invoke(fresh,next.reference));
    await f.place('relocate');fresh=await reviewedFramework(f);[next]=await f.discover(fresh);
    await f.place('retire');assert.deepEqual(await f.discover(await reviewedFramework(f)),[]);denied(await f.invoke(fresh,next.reference));
    await f.place('replace');
    const file=path.join(f.candidate.packagePath,'manifest.json'),manifest=plain(f.manifest);manifest.version='0.1.1';manifest.backofficeActions[0].title='Current members';
    await fs.writeFile(file,JSON.stringify(manifest));await packageOperation(f.operation('update',[f.candidate]));
    fresh=await reviewedFramework(f);const [updated]=await f.discover(fresh);denied(await f.invoke(fresh,next.reference));assert.equal(updated.title,'Current members');
    await packageOperation(f.operation('uninstall'));assert.equal(catalog(f).retained.length,1);assert.deepEqual(await f.discover(await reviewedFramework(f)),[]);
    denied(await f.invoke(fresh,updated.reference));await packageOperation(f.operation('install',[f.candidate]));
    fresh=await reviewedFramework(f);const [reinstalled]=await f.discover(fresh);assert.notEqual(reinstalled.reference.installation,updated.reference.installation);
    denied(await f.invoke(fresh,updated.reference));assert.equal((await f.invoke(fresh,reinstalled.reference)).ok,true);
  });
}

test('ACT-04: declarations reject collisions, unsupported fields/contracts and unauthorized registration',async t=>{
  const f=await actionFixture(t,'json',{install:false}),base=plain(f.manifest),a=base.backofficeActions[0];
  for(const mutate of [m=>m.backofficeActions.push(a),m=>m.backofficeActions[0].id='bad/id',m=>m.backofficeActions[0].context='FrontEnd',m=>m.backofficeActions[0].context='AccountAdmin',m=>m.backofficeActions[0].context='HostAdmin',m=>m.backofficeActions[0].execute='file.js',m=>m.backofficeActions[0].input={type:'any'},m=>m.backofficeActions[0].owner='home',m=>m.backofficeActions[0].scopes={},m=>m.platform='>=0.3.0-alpha.1']) {
    const m=plain(base);mutate(m);
    assert.throws(()=>validatePackageManifest(m));
  }
  for(const context of [{...f.operator},new ExecutionContext({...f.operator,capabilities:[]}),new ExecutionContext({...f.operator,package:'divdev/backoffice-members'})])
    assert.throws(()=>createBackOfficeActions({root:f.root,libraries:f.libraries,installationContext:context}));
  await packageOperation(f.operation('install',[f.candidate]));
  await reviewFixture(f);
  const original=f.libraries,forbidden={...original,administrativeOperation:()=>null};
  assert.throws(()=>createBackOfficeActions({root:f.root,libraries:forbidden,installationContext:f.operator}),{code:'BACKOFFICE.MIGRATION_REQUIRED'});
});

test('ACT-05 CTX-05: FrontEnd is dormant, inherited context restrictions and unsupported service updates fail closed',async t=>{
  const f=await actionFixture(t,'json',{install:false});f.candidate.serverPlacement.context='FrontEnd';
  await packageOperation(f.operation('install',[f.candidate]));assert.deepEqual(await f.discover(await reviewedFramework(f)),[]);
  await f.place('relocate');const api=await reviewedFramework(f),[action]=await f.discover(api);
  const file=path.join(f.candidate.packagePath,'manifest.json'),manifest=plain(f.manifest);manifest.version='0.1.1';
  for(const operation of ['eval','apply-package-policy','login']) {
    manifest.backofficeActions[0].service.operation=operation;await fs.writeFile(file,JSON.stringify(manifest));
    await assert.rejects(planPackageOperation(f.operation('update',[f.candidate])),{code:'ACTION.SERVICE'});
    assert.equal((await f.invoke(api,action.reference)).ok,true);
  }
  manifest.backofficeActions[0].service.operation='list-members';await fs.writeFile(file,JSON.stringify(manifest));
  const proto=path.join(f.candidate.packagePath,'prototypes.json'),defs=JSON.parse(await fs.readFile(proto));
  defs[0].execution={schema:'wydgit.execution/1',runat:'Server',context:'FrontEnd'};await fs.writeFile(proto,JSON.stringify(defs));
  await assert.rejects(planPackageOperation(f.operation('update',[f.candidate])));
  assert.equal((await f.invoke(api,action.reference)).ok,true);
});

for(const missing of ['capability','scope'])test(`ACT-06 SEAM: live Gate permission cannot replace approved ${missing}`,async t=>{
  const f=await actionFixture(t),old=await reviewedFramework(f),[action]=await f.discover(old),s=catalog(f),e=s.packages[0];
  const grants=plain(e.approved);if(missing==='capability')grants.capabilities=[];else delete grants.scopes.wydgate;
  const host=new ExecutionContext({...f.operator,capabilities:[...f.operator.capabilities,'packages.policy.manage']});
  const plan=await planPackagePolicy({root:f.root,app:'boilerplate',package:e.manifest.id,installation:e.receipt.id,revision:s.revision,
    packageRevision:e.receipt.revision,policyRevision:e.policyRevision??0,policy:{grants,stores:[]},installationContext:host});
  const approval=await approvePackagePolicy(plan,{installationContext:host});
  await applyPackagePolicy({root:f.root,app:'boilerplate',package:e.manifest.id,installation:e.receipt.id,revision:approval.revision,
    packageRevision:e.receipt.revision,policyRevision:e.policyRevision??0,approval:approval.id,planHash:plan.sha256,installationContext:host});
  assert.throws(()=>f.framework(),{code:'BACKOFFICE.MIGRATION_REQUIRED'});denied(await f.invoke(old,action.reference));
});

test('ACT-07: mutation confirmation, explicit service failure and forbidden native authority',async t=>{
  const f=await actionFixture(t,'json',{edit:m=>{
    const a=m.backofficeActions[0];a.id='manage-member';a.service.operation='manage-member';a.effect='write';a.confirmation='Confirm the membership change';
    a.input={type:'object',fields:{id:{type:'string',maxLength:64},status:{type:'string',maxLength:16}}};a.output=m.backofficeActions[0].output.fields.members.items;
  }}),api=await reviewedFramework(f),[action]=await f.discover(api);
  const target=await f.gate.register({username:'bob',password:f.password});
  const request={...f.request,reference:action.reference,input:{id:target.membership.id,status:'suspended'}};
  assert.equal((await api.invoke(request)).code,'ACTION.CONFIRMATION');
  const changed=await api.invoke({...request,confirmed:true});assert.equal(changed.ok,true,JSON.stringify(changed));assert.equal(changed.value.status,'suspended');
  const bad=await api.invoke({...request,confirmed:true,input:{...request.input,status:'invented'}});denied(bad);assert.equal(bad.value,undefined);
  const state=catalog(f),e=state.packages[0],identity=await f.gate.resolveSession(f.login.token);
  const caller=acquirePackageExecution({root:f.root,app:'boilerplate',package:e.manifest.id,installation:e.receipt.id,generation:e.executionPlacement.generation,
    self:'backoffice-members',installationContext:f.operator,identity});
  await assert.rejects(planPackagePolicy({root:f.root,app:'boilerplate',package:e.manifest.id,installation:e.receipt.id,installationContext:caller}));
  denied(await api.invoke({...request,confirmed:true,service:'applyPackagePolicy'}));
});

test('ACT-08: closed result contract rejects unexpected secrets, accessors and host handles',async t=>{
  const f=await actionFixture(t),real=f.libraries;
  for(const output of [{token:'secret'},new Map(),()=>{}, {get token(){assert.fail('getter ran');}}]) {
    const libraries={...real,bind(context){const bound=real.bind(context);return {...bound,invoke:async()=>({ok:true,value:output})};}};
    const api=createBackOfficeActions({root:f.root,libraries,installationContext:f.operator}),[action]=await f.discover(api);
    const result=await f.invoke(api,action.reference);assert.equal(result.code,'ACTION.INVALID_RESULT');assert.doesNotMatch(JSON.stringify(result),/secret/);
  }
});

for(const provider of ['json','sqlite'])for(const stage of ['APPLYING','PUBLISHED'])test(`ACT-09 LIF-01 ${provider}: interrupted replacement ${stage} recovery has one registration`,async t=>{
  const f=await actionFixture(t,provider),old=await reviewedFramework(f),[action]=await f.discover(old),s=catalog(f),e=s.packages[0];
  const request={root:f.root,app:'boilerplate',package:e.manifest.id,installation:e.receipt.id,revision:s.revision,action:'replace',context:'BackOffice',installationContext:f.operator};
  const file=path.join(f.root,'replace.json');await fs.writeFile(file,JSON.stringify(request));
  const child=spawn(process.execPath,['test-support/placement-child.js',file,stage],{stdio:['ignore','pipe','pipe','ipc']});
  let errors='';child.stderr.on('data',x=>errors+=x);t.after(()=>child.kill('SIGKILL'));
  await Promise.race([once(child,'message',{signal:AbortSignal.timeout(15000)}),once(child,'exit').then(()=>{throw Error(errors||'child exited');})]);
  child.kill('SIGKILL');await once(child,'exit');await recoverPackageOperation({root:f.root,installationContext:f.operator});
  const api=await reviewedFramework(f),actions=await f.discover(api);assert.equal(actions.length,1);assert.equal(catalog(f).packages.length,1);
  if(stage==='PUBLISHED'){denied(await f.invoke(old,action.reference));denied(await f.invoke(api,action.reference));}
  assert.equal((await f.invoke(api,actions[0].reference)).ok,true);
});

for(const provider of ['json','sqlite'])test(`ACT-10 STO-02 ${provider}: actions preserve independent protected Store and ownership checks`,async t=>{
  const f=await actionFixture(t,provider,{edit:m=>{
    m.permissions.capabilities=['store.records.read','store.records.create','store.records.write'];m.permissions.scopes.wydstore=['records'];
    m.requires.libraries.push({library:'wydstore',version:'^0.1.0-alpha.5'});m.storage=[{name:'records',fields:{text:{type:'string'}}}];
    const a=m.backofficeActions[0];a.permission='content.action.read';a.capability='store.records.read';a.scopes={wydstore:['records']};
    a.service={library:'wydstore',apiVersion:'1.0.0',operation:'count'};
    a.input={type:'object',fields:{store:{type:'string',maxLength:64},collection:{type:'string',maxLength:64}}};
    a.output={type:'integer',min:0,max:256};
    for(const operation of ['create','update']){
      const write=plain(a);write.id=operation;write.service.operation=operation;write.capability=operation==='create'?'store.records.create':'store.records.write';
      write.permission='content.action.write';write.effect='write';write.confirmation='Confirm record change';
      const data={type:'object',fields:{text:{type:'string',maxLength:128}}};
      Object.assign(write.input.fields,{id:{type:'string',maxLength:64},data});
      if(operation==='update')write.input.fields.version={type:'integer',min:1,max:100};
      write.output={type:'object',fields:{id:{type:'string',maxLength:64},version:{type:'integer',min:1,max:100},data}};
      m.backofficeActions.push(write);
    }
  },configure:async f=>{
    await f.libraries.close();const root=path.join(f.root,'records');await fs.mkdir(root);
    f.config.libraries.find(l=>l.id==='wydstore').options.stores.push({id:'records',app:'boilerplate',publisher:'divdev',package:'divdev/backoffice-members',provider,root,
      collections:[{id:'records',fields:{text:{type:'string'}}}],authorization:{schema:'wydstore.authorization/1',collections:{records:{count:{contexts:['BackOffice'],permission:'content.records.read'},
        create:{contexts:['BackOffice'],permission:'content.records.write'},update:{contexts:['BackOffice'],permission:'content.records.write'}}}}});
    await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify(f.config));f.candidate.storageMappings={records:{store:'records',collection:'records'}};
    f.libraries=await initializeHost({root:f.root});f.gate=createGate(f.libraries.bind(f.gateContext));
  }});
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.action.read']});
  const api=await reviewedFramework(f),input={store:'records',collection:'records'};
  assert.deepEqual(await f.discover(api),[]);
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.action.read','content.records.read']});
  const [action]=await f.discover(api);
  const result=await f.invoke(api,action.reference,input);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value,0);
  denied(await f.invoke(api,action.reference,{store:'identity',collection:'directory'}));
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.action.read','content.records.read','content.action.write','content.records.write']});
  const actions=await f.discover(api),create=actions.find(a=>a.name==='create'),update=actions.find(a=>a.name==='update');
  const write=(a,data)=>api.invoke({...f.request,reference:a.reference,input:{...input,id:'record',...data},confirmed:true});
  assert.equal((await write(create,{data:{text:'first'}})).value.version,1);
  assert.equal((await write(update,{version:1,data:{text:'second'}})).value.version,2);
  const conflict=await write(update,{version:1,data:{text:'stale'}});assert.equal(conflict.ok,false);assert.equal(conflict.code,'STORE.CONFLICT');
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.action.read']});denied(await f.invoke(api,action.reference,input));assert.deepEqual(await f.discover(api),[]);
});

test('ACT-11 GAT-03: equal package/action/instance names across canonical sites do not merge sessions or references',async t=>{
  const a=await actionFixture(t,'json'),b=await actionFixture(t,'sqlite',{app:'second-site'}),apiA=await reviewedFramework(a),apiB=await reviewedFramework(b);
  const [actionA]=await a.discover(apiA),[actionB]=await b.discover(apiB);assert.equal(actionA.id,actionB.id);
  assert.notEqual(actionA.reference.app,actionB.reference.app);assert.notEqual(actionA.reference.installation,actionB.reference.installation);
  denied(await apiB.invoke({...b.request,reference:actionA.reference,input:{}}));
  denied(await apiB.invoke({...a.request,reference:actionB.reference,input:{}}));
  denied(await apiB.invoke({...b.request,session:a.request.session,reference:actionB.reference,input:{}}));
  await b.gate.assignUser({userId:b.user.account.id,roles:[],permissions:[]});assert.deepEqual(await b.discover(apiB),[]);
  assert.equal((await a.invoke(apiA,actionA.reference)).ok,true);denied(await b.invoke(apiB,actionB.reference));
});

test('ACT-12 GAT-03 LIF-01: admitted actions block replacement, and permission revocation before service entry denies',async t=>{
  const f=await actionFixture(t),real=f.libraries;
  let enter,release;const started=new Promise(r=>enter=r),paused=new Promise(r=>release=r);
  const libraries={...real,bind(context){const bound=real.bind(context);return {...bound,async invoke(...args){enter();await paused;return bound.invoke(...args);}};}};
  const api=createBackOfficeActions({root:f.root,libraries,installationContext:f.operator}),[action]=await f.discover(api);
  const pending=f.invoke(api,action.reference);await started;
  try {
    await assert.rejects(f.place('replace'),{code:'PACKAGE.RUNNING'});
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[]});
  }finally{release();}
  denied(await pending);await f.place('replace');
});

test('ACT-13: host service budget reductions remain effective at the action boundary',async t=>{
  const f=await actionFixture(t),operator=new ExecutionContext({...f.operator,limits:{serviceResponseBytes:1}});
  const api=createBackOfficeActions({root:f.root,libraries:f.libraries,installationContext:operator}),[action]=await f.discover(api);
  denied(await f.invoke(api,action.reference));
  const noCalls=new ExecutionContext({...f.operator,limits:{sewnServiceCalls:0}});
  const limited=createBackOfficeActions({root:f.root,libraries:f.libraries,installationContext:noCalls});
  assert.equal((await f.invoke(limited,action.reference)).code,'SEWN.LIMIT');
});

test('ACT-14: separately installed modules contribute without a central list, and retire independently',async t=>{
  const f=await actionFixture(t),before=await reviewedFramework(f),[first]=await f.discover(before),directory=path.join(f.root,'other-admin');
  await fs.cp(f.candidate.packagePath,directory,{recursive:true});const manifest=plain(f.manifest);
  manifest.id='divdev/other-admin';manifest.permissions.visible=['other-admin'];manifest.backofficeActions[0].owner='other-admin';
  const proto=JSON.parse(await fs.readFile(path.join(directory,'prototypes.json')));proto[0].id='divdev/other-admin';
  const node=JSON.parse(await fs.readFile(path.join(directory,'section.json')));node.id='other-admin';node.prototype='divdev/other-admin';
  for(const [file,value] of [['manifest.json',manifest],['prototypes.json',proto],['section.json',node]])await fs.writeFile(path.join(directory,file),JSON.stringify(value));
  f.operator=new ExecutionContext({...f.operator,visible:[...f.operator.visible,'page-other','other-admin'],editable:[...f.operator.editable,'page-other','other-admin']});
  const candidate={...f.candidate,packagePath:directory,approvals:manifest.permissions,
    placement:{page:'page-other',parent:'page-other',slot:'sections',index:0},page:{...f.candidate.page,id:'page-other',properties:{title:'Other admin',slug:'other-admin'}}};
  await packageOperation({root:f.root,package:manifest.id,action:'install',candidates:[candidate],installationContext:f.operator});
  const api=await reviewedFramework(f),actions=await f.discover(api);assert.equal(actions.length,2);assert.equal(actions[0].name,actions[1].name);
  for(const a of actions)assert.equal((await f.invoke(api,a.reference)).ok,true);
  // The reviewed accepted Page tree changed; explicit re-review fences its old reference.
  denied(await f.invoke(before,first.reference));
  const s=catalog(f),e=s.packages.find(p=>p.manifest.id===manifest.id);
  const {executionPlacement}=await import('../wydgine/packages/index.js');
  await executionPlacement({root:f.root,app:'boilerplate',package:manifest.id,installation:e.receipt.id,revision:s.revision,action:'retire',context:'BackOffice',installationContext:f.operator});
  assert.equal((await f.discover(await reviewedFramework(f))).length,1);denied(await f.invoke(api,actions.find(a=>a.package===manifest.id).reference));
});

test('ACT-15: contributor metadata cannot weaken trusted service discovery permission',async t=>{
  const f=await actionFixture(t,'json',{edit:m=>m.backofficeActions[0].permission='content.action.read'});
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.action.read']});
  const api=await reviewedFramework(f);assert.deepEqual(await f.discover(api),[]);
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.action.read','gate.members.manage']});
  const [action]=await f.discover(api);assert.equal((await f.invoke(api,action.reference)).ok,true);
});

for(const provider of ['json','sqlite'])test(`BOFOUND-03 ${provider}: installed actions reject recovery barriers, receipt drift, restored-mtime tampering and catalog symlinks before dispatch`,async t=>{
  const f=await actionFixture(t,provider),api=await reviewedFramework(f),[action]=await f.discover(api);
  const file=path.join(f.root,'content/installed-packages.json'),lock=path.join(f.root,'content/.package-install.lock');
  const seconds=1700000000;await fs.utimes(file,seconds,seconds);
  const bytes=await fs.readFile(file);let calls=0;
  const invoke=()=>api.invoke({...f.request,reference:action.reference,input:{}},{onStart:()=>calls++});
  assert.equal((await invoke()).ok,true);assert.equal(calls,1);
  await fs.writeFile(lock,'{}');
  try{denied(await invoke());assert.equal(calls,1);}finally{await fs.unlink(lock);}
  // A corrupt mirrored receipt cannot supply approval or a runnable contribution.
  const state=JSON.parse(bytes);state.packages[0].receipt.approved.capabilities=[];
  await fs.writeFile(file,JSON.stringify(state));
  try{denied(await invoke());assert.equal(calls,1);}finally{await fs.writeFile(file,bytes);}
  await fs.utimes(file,seconds,seconds);
  const before=await fs.stat(file,{bigint:true}),entry=JSON.parse(bytes).packages[0];
  const source=entry.manifest.resources.prototypes,original=JSON.stringify(entry.resources[source]);
  const tampered=JSON.stringify(entry.resources[source].replace('wydgit.core/section','wydgit.core/Section'));
  assert.notEqual(tampered,original);assert.equal(tampered.length,original.length);
  await fs.writeFile(file,bytes.toString().replace(original,tampered));await fs.utimes(file,seconds,seconds);
  try{
    const after=await fs.stat(file,{bigint:true});assert.equal(after.mtimeNs,before.mtimeNs);assert.equal(after.size,before.size);
    assert.notEqual(after.ctimeNs,before.ctimeNs);denied(await invoke());assert.equal(calls,1);
  }finally{await fs.writeFile(file,bytes);}
  await fs.rename(file,file+'.held');await fs.symlink(file+'.held',file);
  try{denied(await invoke());assert.equal(calls,1);}finally{await fs.unlink(file);await fs.rename(file+'.held',file);}
  // Fresh acquisition from restored accepted state is allowed; an old reference
  // never selects a different generation or bypasses the admission checks.
  assert.equal((await invoke()).ok,true);assert.equal(calls,2);
});
