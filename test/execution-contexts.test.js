import test from 'node:test';
import assert from 'node:assert/strict';
import {PrototypeRegistry,hydrate,dehydrate} from '../wydgine/object-model/index.js';
import {ExecutionContext,checkContext,endExecutionContext} from '../wydgine/seam/context.js';
import {createInstanceController} from '../wydgine/execution/instances.js';
import {createExecutionBudget,executionBudget} from '../wydgine/sewn/budget.js';
import {bindServices} from '../wydgine/libraries/dispatch.js';
import {createStores} from '@wydgit/store/client';
import {fixture,load,context as storageContext} from '../test-support/wydstore.js';
const contract=(runat,context)=>({schema:'wydgit.execution/1',runat,...(context===undefined?{}:{context})});
const host=(options={})=>new ExecutionContext({publisher:'operator',self:'app',app:'app',...options});
const definitions=[{id:'wydgit.core/app',publisher:'wydgit.core',public:true,properties:{},slots:{}},
 {id:'acme/neutral',publisher:'acme',extends:'wydgit.core/app'}];
const envelope=(execution)=>({schema:'wydgit/0.3',id:'app',prototype:'acme/neutral',properties:{},slots:{},provenance:{},...(execution?{execution}:{})});
const rejected=(fn,code)=>assert.throws(fn,{code});

test('CTX-01/04 CLI-01: canonical identifiers, implicit/explicit SUB and no server default',()=>{
 for(const options of [{runat:'Client'},{runat:'Client',context:'SUB'}]){
  const ctx=host(options);assert.equal(ctx.context,'SUB');assert.equal(ctx.runat,'Client');
 }
 for(const context of ['FrontEnd','BackOffice'])assert.equal(host({runat:'Server',context}).context,context);
 rejected(()=>host({runat:'Server'}),'EXECUTION.CONTEXT');
 for(const runat of ['client','server','CLIENT','Unknown',null])rejected(()=>host({runat,context:'SUB'}),'EXECUTION.RUNTIME');
 for(const [runat,context] of [['Client','FrontEnd'],['Server','SUB'],['Server','frontend'],['Server','backoffice'],['Client','sub'],['Server','Unknown'],['Server','HostAdmin'],['Server','AccountAdmin'],['Client',null]])rejected(()=>host({runat,context}),'EXECUTION.CONTEXT');
});

test('CTX-02/03: neutral reuse, exact restrictions and multilevel inheritance',async()=>{
 const registry=new PrototypeRegistry(definitions),runtime=hydrate(envelope(),registry);
 for(const context of ['FrontEnd','BackOffice']){
  const controller=createInstanceController({runtime,registry,context:host({context}),rootId:'app'});
  await controller.activate();await controller.dispose();
 }
 const restricted=[...definitions,{id:'acme/restricted',publisher:'acme',extends:'acme/neutral',execution:contract('Server','BackOffice')},
  {id:'acme/middle',publisher:'acme',extends:'acme/restricted'},
  {id:'acme/leaf',publisher:'acme',extends:'acme/middle',execution:contract('Server')}];
 const r=new PrototypeRegistry(restricted);assert.equal(r.get('acme/leaf').execution.context,'BackOffice');
 const data={...envelope(),prototype:'acme/leaf'};
 const rt=hydrate(data,r);rejected(()=>rt.scope(host({context:'FrontEnd'})),'EXECUTION.PLACEMENT');
 rt.scope(host({context:'BackOffice'}));
 for(const execution of [contract('Server','FrontEnd'),contract('Client')]){
  rejected(()=>new PrototypeRegistry([...restricted,{id:'acme/escape',publisher:'acme',extends:'acme/leaf',execution}]),'EXECUTION.RESTRICTION');
  rejected(()=>hydrate({...data,execution},r),'EXECUTION.RESTRICTION');
 }
});

test('CTX-02/05: declarations restrict but cannot establish trusted placement or grants',()=>{
 const registry=new PrototypeRegistry(definitions),runtime=hydrate(envelope(contract('Server','BackOffice')),registry);
 rejected(()=>host({}),'EXECUTION.CONTEXT');
 rejected(()=>runtime.scope(host({context:'FrontEnd'})),'EXECUTION.PLACEMENT');
 const admin=host({context:'BackOffice'});runtime.scope(admin);
 rejected(()=>admin.require('store.records.write'),'SEAM.DENIED');
 for(const context of ['HostAdmin','AccountAdmin','BACKOFFICE'])rejected(()=>hydrate(envelope(contract('Server',context)),registry),'EXECUTION.CONTEXT');
 const parent=host({context:'BackOffice'}),child=host({placement:parent});assert.equal(child.context,'BackOffice');
 rejected(()=>host({placement:parent,context:'FrontEnd'}),'EXECUTION.PLACEMENT');
 rejected(()=>host({placement:{...parent}}),'SEAM.CONTEXT');
 rejected(()=>host({placement:parent,app:'foreign'}),'EXECUTION.PLACEMENT');
 assert.throws(()=>{child.context='FrontEnd';},TypeError);
});

test('CLI-01: real client execution obeys implicit SUB and prototype restrictions',async()=>{
 const registry=new PrototypeRegistry(definitions),runtime=hydrate(envelope(contract('Client')),registry);
 for(const options of [{runat:'Client'},{runat:'Client',context:'SUB'}]){
  const controller=createInstanceController({runtime,registry,context:host(options),rootId:'app',runtimeTarget:'client'});
  await controller.activate();await controller.dispose();
 }
 rejected(()=>createInstanceController({runtime,registry,context:host({runat:'Client'}),rootId:'app'}),'EXECUTION.RUNTIME');
 rejected(()=>runtime.scope(host({context:'BackOffice'})),'EXECUTION.PLACEMENT');
});

test('CTX-05/06: ended placement fences inherited contexts, budgets, handles and cached services',async()=>{
 const registry=new PrototypeRegistry(definitions),runtime=hydrate(envelope(),registry);
 const parent=host({context:'FrontEnd'}),child=host({placement:parent}),clone=new ExecutionContext({...child,limits:{steps:1}});
 const handle=runtime.scope(child),budget=createExecutionBudget(child);let calls=0;
 const service={capability:'store.records.read',authorize:()=>true,handler:()=>{calls++;return {};}};
 const caller=host({placement:parent,capabilities:['store.records.read']});
 const dispatch=bindServices(caller,()=>service);
 assert.equal((await dispatch.call('test','get',{})).ok,true);
 endExecutionContext(parent);
 for(const ctx of [parent,child,clone,caller])rejected(()=>checkContext(ctx),'SEAM.CONTEXT');
 rejected(()=>handle.requireCapability('store.records.read'),'SEAM.CONTEXT');
 rejected(()=>executionBudget(budget,child),'SEAM.CONTEXT');
 assert.equal((await dispatch.call('test','get',{})).code,'SEAM.DENIED');assert.equal(calls,1);
 const fresh=host({context:'BackOffice'});checkContext(fresh);
 rejected(()=>new ExecutionContext({...parent}),'SEAM.CONTEXT');
});

for(const provider of ['json','sqlite'])test(`MIG-01/02 ${provider}: declarations round-trip with history and cannot activate reserved placement`,async t=>{
 const f=await fixture(t,provider),registry=new PrototypeRegistry(definitions);
 const record=f.collection.create('context-bearing',{name:'stable',info:{app:JSON.stringify(envelope(contract('Server','BackOffice')))}});await record.save();
 record.set('info',{app:JSON.stringify(envelope(contract('Server','FrontEnd')))});await record.save();
 const reopened=await load(f.store),collection=createStores(reopened.bind(storageContext())).get('main').collection('users');
 const saved=await collection.get('context-bearing');assert.equal(saved.version,2);assert.equal(saved.current.name,'stable');
 const runtime=hydrate(saved.current.info.app,registry);assert.deepEqual(JSON.parse(JSON.stringify(dehydrate(runtime))),JSON.parse(saved.current.info.app));
 runtime.scope(host({context:'FrontEnd'}));rejected(()=>runtime.scope(host({context:'BackOffice'})),'EXECUTION.PLACEMENT');
 const before=JSON.stringify(saved.current);const invalid=envelope(contract('Server','HostAdmin'));
 rejected(()=>hydrate(invalid,registry),'EXECUTION.CONTEXT');assert.equal(JSON.stringify((await collection.get('context-bearing')).current),before);
 const history=await collection.history('context-bearing');assert.equal(history.length,2);
 const old=history.find(h=>h.version===1);assert.ok(old);assert.equal(JSON.parse(old.data.info.app).execution.context,'BackOffice');
});

test('CTX-05 MIG-02: portable package declarations cannot promote public installation placement',async t=>{
 const {packageFixture}=await import('../test-support/packages.js');
 const {planPackageInstall}=await import('../wydgine/packages/index.js');
 const fs=await import('node:fs/promises'),path=await import('node:path');
 const f=await packageFixture(t),file=path.join(f.packagePath,f.manifest.resources.prototypes);
 const original=await fs.readFile(file,'utf8'),defs=JSON.parse(original);
 defs[0].execution=contract('Server','BackOffice');await fs.writeFile(file,JSON.stringify(defs));
 await assert.rejects(planPackageInstall(f.options),{code:'EXECUTION.PLACEMENT'});
 await assert.rejects(fs.stat(path.join(f.root,'content/installed-packages.json')),{code:'ENOENT'});
 for(const context of ['HostAdmin','AccountAdmin']){
  defs[0].execution=contract('Server',context);await fs.writeFile(file,JSON.stringify(defs));
  await assert.rejects(planPackageInstall(f.options),{code:'EXECUTION.CONTEXT'});
 }
 await fs.writeFile(file,original);
 const plan=await planPackageInstall(f.options);assert.ok(plan);
 endExecutionContext(f.options.installationContext);
 const {applyPackageInstall}=await import('../wydgine/packages/index.js');
 await assert.rejects(applyPackageInstall(plan),{code:'SEAM.CONTEXT'});
 await assert.rejects(fs.stat(path.join(f.root,'content/installed-packages.json')),{code:'ENOENT'});
});

test('CTX-06: a retained edit session and execution ledger expire with placement',()=>{
 const registry=new PrototypeRegistry(definitions),runtime=hydrate(envelope(),registry);
 const context=host({context:'FrontEnd',capabilities:['object.instances.edit'],editable:['app']});
 const edit=runtime.edit(context),token=createExecutionBudget(context),ledger=executionBudget(token,context);
 endExecutionContext(context);
 rejected(()=>edit.commit(),'SEAM.CONTEXT');rejected(()=>ledger.take('steps'),'SEAM.CONTEXT');
});

test('CTX-05: a BackOffice callee cannot lend capabilities or its handle to FrontEnd',()=>{
 const registry=new PrototypeRegistry(definitions),runtime=hydrate(envelope(),registry);
 const low=host({context:'FrontEnd'}),high=host({context:'BackOffice',capabilities:['store.records.write']});
 const ordinary=runtime.scope(low),privileged=runtime.scope(high);
 assert.equal(privileged.requireCapability('store.records.write'),true);
 rejected(()=>ordinary.requireCapability('store.records.write'),'SEAM.DENIED');
 // The existing adapter boundary still requires the original exact caller object.
 return import('../wydgine/object-model/members.js').then(({memberAdapter})=>{
  rejected(()=>memberAdapter(privileged,low),'OBJECT.ACCESS');
 });
});
