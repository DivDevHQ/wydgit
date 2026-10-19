import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStores } from '@wydgit/store/client';
import { scopedFixture, permissions, readPermission, writePermission } from '../test-support/scoped-policy.js';
import { load } from '../test-support/wydgate.js';
import { endExecutionContext } from '../wydgine/seam/context.js';
import { effectiveLimits, STORE_SERVICE_DEFAULTS } from '../wydgine/libraries/limits.js';
import { PrototypeRegistry, hydrate } from '../wydgine/object-model/index.js';
import { compile, compilePrototype } from '../wydgine/wydbasic/index.js';
import { execute } from '../wydgine/sewn/execute.js';

const denied=(result,code='STORE.DENIED')=>{assert.equal(result.ok,false,JSON.stringify(result));assert.equal(result.code,code);assert.doesNotMatch(JSON.stringify(result),/passwordHash|digest|argon2|\/tmp\/|connection|SELECT/);};
const plain=value=>JSON.parse(JSON.stringify(value));
for(const provider of ['json','sqlite']) {
  test(`STO-01 GAT-02 ${provider}: approved site read/write requires policy, SEAM and exact context`,async t=>{
    const f=await scopedFixture(t,provider),call=(extra,op,input)=>f.services(extra).invoke('wydstore','1.0.0',op,{...f.input,...input});
    assert.equal((await call({},'get')).value.data.name,f.app);
    assert.equal((await call({},'update',{version:1,data:{name:'site edit'}})).value.version,2);
    assert.equal((await call({context:'FrontEnd'},'get')).value.data.name,'site edit');
    denied(await call({context:'FrontEnd'},'update',{version:2,data:{name:'forged BackOffice'}}));
    denied(await call({capabilities:[]},'get'),'SEAM.DENIED');
    denied(await call({identity:null},'get'));
    const account=await f.gate.createUser({username:'nomembership',password:'scoped policy test passphrase'});
    await f.gate.assignUser({userId:account.id,roles:[],permissions});
    const accountLogin=await f.gate.login('nomembership','scoped policy test passphrase');
    denied(await call({identity:await f.gate.resolveSession(accountLogin.token)},'get'));
    denied(await call({scopes:{}},'get'));
    for(const extra of [{publisher:'other'},{package:'acme/other'},{principal:'other'},{app:'foreign',identity:null}])denied(await call(extra,'get'));
    await f.gate.updateRole({id:f.role.id,permissions:[]});
    denied(await call({},'get'));denied(await call({},'get',{id:'missing'}));
    // Claimed role/permission facts cannot repair live policy.
    denied(await call({identity:{...f.identity,membershipRole:'owner',permissions}},'get'));
    await f.gate.assignUser({userId:f.registered.account.id,roles:[],permissions:[readPermission]});
    assert.equal((await call({},'get')).ok,true);
    denied(await call({},'update',{version:2,data:{name:'no write permission'}}));
  });

  test(`STO-01/05 ${provider}: public content, drafts, forbidden identity fields and direct resource entry`,async t=>{
    const f=await scopedFixture(t,provider),anonymous=f.services({identity:null,context:'FrontEnd'});
    const publicInput={store:'main',collection:'published',id:'record'};
    assert.equal((await anonymous.call('wydstore','get',publicInput)).value.data.name,f.app);
    denied(await anonymous.call('wydstore','history',publicInput));
    for(const patch of [{app:'foreign'},{context:'BackOffice'},{principal:'owner'},
      {membershipId:f.registered.membership.id},{identity:f.identity},{authorization:{permit:true}},{decision:{permit:true}}]) {
      const result=await anonymous.call('wydstore','get',{...f.input,...patch});
      assert.equal(result.ok,false);
    }
    assert.throws(()=>f.registry.bind({...f.caller()}),{code:'SEAM.CONTEXT'});
    const draft=f.collection({identity:null}).create('draft',{name:'local'});draft.set('name','still local');
    await assert.rejects(()=>draft.save(),{code:'STORE.DENIED'});
    // Raw handlers are native host-only, but still enforce resource policy.
    const caller=f.caller({identity:null}),handler=f.registry.service('wydstore','get');
    await assert.rejects(()=>handler(f.input,caller,effectiveLimits(STORE_SERVICE_DEFAULTS,caller)),{code:'STORE.DENIED'});
    const copied=f.collection();const record=await copied.get('record');
    await f.gate.updateRole({id:f.role.id,permissions:[]});
    assert.equal(await record.save(),record); // Unchanged local snapshot; no I/O.
    record.set('name','unauthorized mutation');await assert.rejects(()=>record.save(),{code:'STORE.DENIED'});
    await assert.rejects(()=>copied.get('record'),{code:'STORE.DENIED'});
    await assert.rejects(()=>copied.history('record'),{code:'STORE.DENIED'});
  });

  test(`ADM-01 ${provider}: history, metadata, queries and every transaction member authorize before mutation`,async t=>{
    const f=await scopedFixture(t,provider),service=f.services();
    assert.equal((await service.invoke('wydstore','1.0.0','metadata',{store:'main',collection:'users'})).ok,true);
    assert.equal((await service.invoke('wydstore','1.0.0','count',{store:'main',collection:'users'})).value,1);
    assert.equal((await service.call('wydstore','query',{store:'main',collection:'users'})).value.length,1);
    const batch={store:'main',collection:'users',operations:[
      {operation:'update',input:{id:'record',version:1,data:{name:'batch'}}},
      {operation:'history',input:{id:'record'}}]};
    await f.gate.updateRole({id:f.role.id,permissions:[readPermission,writePermission]});
    denied(await service.invoke('wydstore','1.0.0','transaction',batch));
    denied(await service.invoke('wydstore','1.0.0','metadata',{store:'main',collection:'users'}));
    assert.equal((await service.call('wydstore','get',f.input)).value.version,1);
    await f.gate.updateRole({id:f.role.id,permissions});
    const result=await service.invoke('wydstore','1.0.0','transaction',batch);assert.equal(result.ok,true);assert.equal(result.value[1].length,2);
    const nested={...batch,operations:[{operation:'create',input:{collection:'published',id:'denied',data:{name:'must not exist'}}}]};
    denied(await service.invoke('wydstore','1.0.0','transaction',nested));
    const noCreate=f.services({capabilities:['store.records.read','store.records.write']});
    denied(await noCreate.invoke('wydstore','1.0.0','transaction',{...batch,operations:[{operation:'create',input:{id:'new',data:{name:'no cap'}}}]}),'SEAM.DENIED');
    assert.equal((await service.call('wydstore','delete',{...f.input,version:2})).ok,true);
    assert.equal((await service.call('wydstore','history',f.input)).value.length,3);
    await f.gate.updateRole({id:f.role.id,permissions:[]});
    denied(await service.call('wydstore','history',f.input));
    denied(await service.call('wydstore','query',{store:'main',collection:'users'}));
    denied(await service.invoke('wydstore','1.0.0','count',{store:'main',collection:'users'}));
  });

  test(`GAT-03 STO-05 ${provider}: cached handles revalidate logout, expiry, idle timeout and membership revocation`,async t=>{
    const f=await scopedFixture(t,provider),cached=f.services();
    assert.equal((await cached.call('wydstore','get',f.input)).ok,true);
    const now=t.mock.method(Date,'now',()=>f.login.session.expiresAt);
    denied(await cached.call('wydstore','get',f.input));now.mock.restore();
    const idleConfig=plain(f.config);idleConfig.libraries[0].options.sessionIdleMs=1000;
    const idleRegistry=await load(idleConfig);t.after(()=>idleRegistry.close());
    const idleNow=t.mock.method(Date,'now',()=>f.identity.createdAt+5000);
    denied(await idleRegistry.bind(f.caller()).call('wydstore','get',f.input));idleNow.mock.restore();
    await f.gate.logout(f.login.token);denied(await cached.call('wydstore','get',f.input));
    for(const status of ['suspended','left']) {
      await f.gate.manageMember({id:f.registered.membership.id,status:'active'});
      const login=await f.gate.login('alice','scoped policy test passphrase');
      const service=f.services({identity:await f.gate.resolveSession(login.token)});
      assert.equal((await service.call('wydstore','get',f.input)).ok,true);
      await f.gate.manageMember({id:f.registered.membership.id,status});
      denied(await service.call('wydstore','get',f.input));
    }
    await f.gate.manageMember({id:f.registered.membership.id,status:'active'});
    const login=await f.gate.login('alice','scoped policy test passphrase'),identity=await f.gate.resolveSession(login.token);
    await f.gate.updateUser({id:f.registered.account.id,active:false});
    denied(await f.services({identity}).call('wydstore','get',f.input));
    for(const patch of [{sessionId:`s_${randomUUID()}`},{userId:`u_${randomUUID()}`},{membershipId:`m_${randomUUID()}`}])
      denied(await f.services({identity:{...f.identity,...patch}}).call('wydstore','get',f.input));
  });

  test(`STO-02 GAT-01 ${provider}: equal store/role names and colliding principal IDs never merge sites`,async t=>{
    const a=await scopedFixture(t,provider,'appA'),b=await scopedFixture(t,provider,'appB');
    assert.notEqual(a.registered.account.id,b.registered.account.id);assert.notEqual(a.role.id,b.role.id);
    const snapshot=(await a.storage.call('wydstore','get',a.directoryRequest)).value;
    const before=(await b.storage.call('wydstore','get',b.directoryRequest)).value;
    // Adversarial native fixture: identical account/session/role IDs in independent
    // directories, with different membership and permissions. This is not federation.
    const data=plain(snapshot.data);data.membership.app='appB';
    const member=data.membership.members[0];member.app='appB';member.id=`m_${randomUUID()}`;
    data.roles[0].permissions=[];
    assert.equal((await b.storage.call('wydstore','update',{...b.directoryRequest,version:before.version,data})).ok,true);
    const bIdentity={...a.identity,app:'appB',membershipId:member.id};
    assert.equal((await a.services().call('wydstore','get',a.input)).value.data.name,'appA');
    denied(await b.services({identity:bIdentity}).call('wydstore','get',b.input));
    denied(await b.services({identity:{...a.identity,app:'appB'}}).call('wydstore','get',b.input));
    denied(await a.services({app:'appB',identity:null}).call('wydstore','get',a.input));
    const copied=await a.collection().get('record');
    denied(await b.services({identity:bIdentity}).call('wydstore','get',{...b.input,handle:copied}),'SERVICE.INVALID_REQUEST');
    const foreign=createStores(b.services({identity:bIdentity})).get('main').collection('users');
    await assert.rejects(()=>foreign.get(copied.id),{code:'STORE.DENIED'});
    await b.gate.assignUser({userId:a.identity.userId,roles:[],permissions:[readPermission]});
    assert.equal((await b.services({identity:bIdentity}).call('wydstore','get',b.input)).value.data.name,'appB');
    assert.equal((await a.services().call('wydstore','get',a.input)).value.data.name,'appA');
    // A foreign owner cannot reopen A's physical data by changing config strings.
    const forged=plain(b.config),definition=forged.libraries[1].options.stores[1];
    definition.root=a.config.libraries[1].options.stores[1].root;
    const reopened=await load(forged);t.after(()=>reopened.close());
    const result=await reopened.bind(b.caller({identity:bIdentity})).call('wydstore','get',b.input);
    assert.equal(result.code,'STORE.NOT_FOUND'); // Separate owner-derived file, never A's record.
    await b.gate.assignUser({userId:a.identity.userId,roles:[],permissions:[readPermission,writePermission]});
    assert.equal((await reopened.bind(b.caller({identity:bIdentity})).call('wydstore','create',{...b.input,data:{name:'B in a shared root'}})).ok,true);
    assert.equal((await a.services().call('wydstore','get',a.input)).value.data.name,'appA');
  });

  test(`GAT-03 ${provider}: restart, unavailable Gate and corrupt policy state fail closed`,async t=>{
    const f=await scopedFixture(t,provider),reopened=await load(f.config);t.after(()=>reopened.close());
    const cached=reopened.bind(f.caller());
    assert.equal((await cached.call('wydstore','get',f.input)).ok,true);
    await f.gate.updateRole({id:f.role.id,permissions:[]});denied(await cached.call('wydstore','get',f.input));
    const unavailable=plain(f.config);unavailable.libraries=unavailable.libraries.filter(l=>l.id!=='wydgate');
    const isolated=await load(unavailable);t.after(()=>isolated.close());
    denied(await isolated.bind(f.caller()).call('wydstore','get',f.input));
    assert.equal((await isolated.bind(f.caller({identity:null,context:'FrontEnd'})).call('wydstore','get',{...f.input,collection:'published'})).ok,true);
    const state=(await f.storage.call('wydstore','get',f.directoryRequest)).value,data=plain(state.data);data.assignments[0].roles=['missing'];
    assert.equal((await f.storage.call('wydstore','update',{...f.directoryRequest,version:state.version,data})).ok,true);
    denied(await cached.call('wydstore','get',f.input));
    const context=f.caller(),service=reopened.bind(context);endExecutionContext(context);
    await assert.rejects(()=>service.call('wydstore','get',f.input),{code:'SEAM.CONTEXT'});
  });

  test(`GAT-02 CTX-05 ${provider}: inherited service implementation cannot lend BackOffice authority`,async t=>{
    const f=await scopedFixture(t,provider);
    const definitions=[
      {id:'wydgit.core/app',publisher:'wydgit.core',slots:{items:{accepts:['acme/base'],ordered:true}}},
      {id:'acme/base',publisher:'acme',behavior:compilePrototype(`FUNCTION Change() AS Object
RETURN SERVICES.Invoke("wydstore", "1.0.0", "update", {"store":"main","collection":"users","id":"record","version":1,"data":{"name":"inherited"}})
END FUNCTION`)},
      {id:'acme/derived',publisher:'acme',extends:'acme/base'}
    ];
    const registry=new PrototypeRegistry(definitions),env=(id,prototype,slots={})=>({schema:'wydgit/0.2',id,prototype,properties:{},slots,provenance:{}});
    const runtime=hydrate(env(f.app,'wydgit.core/app',{items:[env('target','acme/derived')]}),registry);
    const run=async caller=>execute(compile('RETURN Me.Change()'),{context:caller,prototypeRegistry:registry,
      scope:{ME:runtime.scope(caller,'target'),SERVICES:{Invoke:(...args)=>f.registry.bind(caller).invoke(...args)}}});
    const frontend=f.caller({context:'FrontEnd',self:f.app,visible:['target']});
    denied((await run(frontend)).value);
    const noCapability=f.caller({self:f.app,visible:['target'],capabilities:[]});denied((await run(noCapability)).value,'SEAM.DENIED');
    const backoffice=f.caller({self:f.app,visible:['target']});assert.equal((await run(backoffice)).value.ok,true);
    // A live privileged receiver handle also cannot be imported into FrontEnd.
    const {memberAdapter}=await import('../wydgine/object-model/members.js');
    assert.throws(()=>memberAdapter(runtime.scope(backoffice,'target'),frontend),{code:'OBJECT.ACCESS'});
    const restricted=new PrototypeRegistry([...definitions,{id:'acme/admin',publisher:'acme',extends:'acme/base',
      execution:{schema:'wydgit.execution/1',runat:'Server',context:'BackOffice'}}]);
    const placed=hydrate(env(f.app,'wydgit.core/app',{items:[env('target','acme/admin')]}),restricted);
    assert.throws(()=>placed.scope(frontend,'target'),{code:'EXECUTION.PLACEMENT'});
  });

  test(`GAT-02/03 ${provider}: current group permissions and exact installation restrictions apply`,async t=>{
    const f=await scopedFixture(t,provider);await f.gate.assignUser({userId:f.identity.userId,roles:[],permissions:[]});
    const group=await f.gate.createGroup({name:'Editors',members:[f.identity.userId],roles:[],permissions:[readPermission]});
    const service=f.services();assert.equal((await service.call('wydstore','get',f.input)).ok,true);
    await f.gate.updateGroup({id:group.id,members:[]});denied(await service.call('wydstore','get',f.input));
    await f.gate.updateGroup({id:group.id,members:[f.identity.userId]});
    const config=plain(f.config);config.libraries[1].options.stores[1].installation='different-installation';
    const registry=await load(config);t.after(()=>registry.close());
    denied(await registry.bind(f.caller()).call('wydstore','get',f.input));
    denied(await registry.bind(f.caller({installation:null})).call('wydstore','get',f.input));
  });

  test(`GAT-03 ${provider}: unavailable backing directory denies protected operations while public reads continue`,async t=>{
    const f=await scopedFixture(t,provider),service=f.services();
    assert.equal((await service.call('wydstore','get',f.input)).ok,true);
    const root=f.config.libraries[1].options.stores[0].root;
    const filename=(await fs.readdir(root)).find(name=>name.endsWith(provider==='json'?'.json':'.sqlite'));
    const file=path.join(root,filename);await fs.rename(file,file+'.offline');
    try {
      denied(await service.call('wydstore','get',f.input));
      denied(await service.call('wydstore','history',f.input));
      assert.equal((await service.call('wydstore','get',{...f.input,collection:'published'})).ok,true);
    } finally {await fs.rename(file+'.offline',file);}
    assert.equal((await service.call('wydstore','get',f.input)).ok,true);
  });
}

test('STO-05: invalid, ambiguous and future store policies reject configuration',async t=>{
  const f=await scopedFixture(t);
  const policies=[null,{}, {schema:'wydstore.authorization/2',collections:{}},
    {schema:'wydstore.authorization/1',collections:{foreign:{get:{public:true,contexts:['FrontEnd']}}}},
    ...[{contexts:['HostAdmin'],public:true},{contexts:['BackOffice'],permission:'*'},
      {contexts:['FrontEnd'],permission:readPermission,public:true},{contexts:[],public:true},
      {contexts:['FrontEnd'],public:false},{contexts:['FrontEnd']},{contexts:['FrontEnd','FrontEnd'],public:true}]
      .map(rule=>({schema:'wydstore.authorization/1',collections:{users:{get:rule}}}))];
  for(const authorization of policies) {
    const config=plain(f.config);config.libraries[1].options.stores[1].authorization=authorization;
    await assert.rejects(()=>load(config),{code:'STORE.INVALID_CONFIG'});
  }
  const closed=plain(f.config);closed.libraries[1].options.stores[1].authorization={schema:'wydstore.authorization/1',collections:{}};
  const registry=await load(closed);t.after(()=>registry.close());denied(await registry.bind(f.caller()).call('wydstore','get',f.input));
});
