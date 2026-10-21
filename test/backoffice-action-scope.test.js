import {reviewFixture} from '../test-support/backoffice-enforcement.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {twoResourceActionFixture} from '../test-support/backoffice-preflight.js';
import {catalog,plain} from '../test-support/backoffice.js';
import {acquirePackageExecution} from '../wydgine/packages/index.js';

// B4b enforces DEC-02; B1 receipt-wide observations remain in archived evidence.
for(const provider of ['json','sqlite'])test(`BOB1-02 ${provider}: two required-resource scopes retain independent action and actual-target policies`,async t=>{
  const f=await twoResourceActionFixture(t,provider);await reviewFixture(f);
  const permissions=[...f.storePermissions,'archive.records.read','archive.records.write'];
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions});
  const entry=catalog(f).packages[0],identity=await f.gate.resolveSession(f.login.token);
  const context=acquirePackageExecution({root:f.root,package:f.manifest.id,installation:entry.receipt.id,
    generation:entry.executionPlacement.generation,app:f.request.app,self:'backoffice-members',installationContext:f.operator,identity});
  const archive={store:'records',collection:'archive',id:'record'};
  assert.equal((await f.libraries.bind(context).invoke('wydstore','1.0.0','create',{...archive,data:{text:'archive'}})).ok,true);
  const api=f.framework(),actions=await f.discover(api),get=actions.find(a=>a.name==='get');
  assert.ok(get);assert.equal(actions.some(a=>a.name==='archive-get'),false,'archive action permission is independent of Store policy');
  assert.deepEqual(plain(get.scopes),{wydstore:['records']});
  // The wider receipt cannot widen this action's reviewed records-only maximum.
  const observed=await f.invoke(api,get.reference,archive);
  assert.equal(observed.ok,false,JSON.stringify(observed));assert.equal(observed.code,'STORE.DENIED');
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:f.storePermissions});
  assert.equal((await f.invoke(api,get.reference,archive)).ok,false,'actual target policy must still reject');
  assert.ok((await f.discover(api)).some(a=>a.name==='get'),'records preflight remains authorized');
  for(const input of [{...archive,store:'gate'},{...archive,collection:'unapproved'}])
    assert.equal((await f.invoke(api,get.reference,input)).ok,false);
  for(const patch of [{package:'foreign/package'},{app:'foreign-site'},{instance:'page-admin'}])
    assert.equal((await f.invoke(api,{...get.reference,...patch},archive)).ok,false);
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[...permissions,'archive.action.read']});
  assert.ok((await f.discover(api)).some(a=>a.name==='archive-get'));
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:permissions.filter(p=>p!=='content.records.read')});
  assert.equal((await f.discover(api)).some(a=>a.name==='get'),false,'required resources also have a live preflight policy');
  assert.equal((await f.invoke(api,get.reference,archive)).ok,false);
  // A transaction must authorize each actual member before either provider writes.
  const transaction=actions.find(a=>a.name==='transaction'),input={store:'records',collection:'records',operations:[
    {operation:'create',input:{id:'batch',data:{text:'records'}}},
    {operation:'create',input:{id:'batch',collection:'archive',data:{text:'archive'}}}
  ]};
  const invokeBatch=()=>api.invoke({...f.request,reference:transaction.reference,input,confirmed:true});
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:f.storePermissions});
  assert.equal((await invokeBatch()).ok,false);
  const absent=await f.invoke(api,get.reference,{...f.recordInput,id:'batch'});
  assert.equal(absent.code,'STORE.NOT_FOUND','denied second member leaves first untouched');
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions});
  const batch=await invokeBatch();assert.equal(batch.ok,false,JSON.stringify(batch));
  assert.equal((await f.invoke(api,get.reference,{...f.recordInput,id:'batch'})).code,'STORE.NOT_FOUND');
});
