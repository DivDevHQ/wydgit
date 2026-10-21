import test from 'node:test';
import assert from 'node:assert/strict';
import {storeActionFixture} from '../test-support/backoffice-store.js';
import {catalog,plain} from '../test-support/backoffice.js';
import {acquirePackageExecution} from '../wydgine/packages/index.js';

// DEC-02 characterization, not approval of action scope as a maximum or minimum.
// Keep the observed distinction visible until the authority contract is reviewed.
for(const provider of ['json','sqlite'])test(`BOB1-02 ${provider}: two required-resource scopes retain independent action and actual-target policies`,async t=>{
  const f=await storeActionFixture(t,provider,{edit(m){
    m.storage.push({name:'archive',fields:{text:{type:'string'}}});
    m.permissions.scopes.wydstore.push('archive');
    const get=m.backofficeActions.find(a=>a.id==='get'),create=m.backofficeActions.find(a=>a.id==='create');
    m.backofficeActions.push({...structuredClone(create),id:'transaction',capability:'store.records.write',
      service:{library:'wydstore',apiVersion:'1.0.0',operation:'transaction'},
      input:{type:'object',fields:{store:create.input.fields.store,collection:create.input.fields.collection,
        operations:{type:'array',maxItems:2,items:{type:'object',fields:{operation:{type:'string',maxLength:16},
          input:{type:'object',fields:{id:create.input.fields.id,data:create.input.fields.data,collection:create.input.fields.collection},optional:['collection']}}}}}},
      output:{type:'array',maxItems:2,items:create.output}});
    m.backofficeActions.push({...structuredClone(get),id:'archive-get',permission:'archive.action.read',scopes:{wydstore:['archive']}});
  },configure(f){
    const store=f.config.libraries.find(l=>l.id==='wydstore').options.stores.find(s=>s.id==='records');
    store.authorization.collections.records.transaction={contexts:['BackOffice'],permission:'content.records.write'};
    store.collections.push({id:'archive',fields:{text:{type:'string'}}});
    store.authorization.collections.archive={get:{contexts:['BackOffice'],permission:'archive.records.read'},create:{contexts:['BackOffice'],permission:'archive.records.write'}};
    f.candidate.storageMappings.archive={store:'records',collection:'archive'};
  }});
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
  // Current dispatch retains the receipt's two approved resources. Required scope
  // is preflighted, but is not currently a dispatch ceiling. This is DEC-02 evidence.
  const observed=await f.invoke(api,get.reference,archive);
  assert.equal(observed.ok,true,JSON.stringify(observed));assert.equal(observed.value.data.text,'archive');
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
  const batch=await invokeBatch();assert.equal(batch.ok,true,JSON.stringify(batch));
  assert.deepEqual(batch.value.map(r=>r.version),[1,1]);
  assert.equal((await f.invoke(api,get.reference,{...archive,id:'batch'})).value.data.text,'archive');
});
