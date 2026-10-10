import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { packageFixture } from '../test-support/packages.js';
import { planPackageInstall, applyPackageInstall, validatePackageManifest, activatePackages } from '../wydgine/packages/index.js';
import { loadRepository } from '../wydgine/repository.js';
import { LIMITS } from '../wydgine/packages/manifest.js';
import { STATE, readInstalledState } from '../wydgine/packages/state.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { initializeHost } from '../wydgine/host.js';
const read=file=>fs.readFile(file,'utf8');
const write=(file,value)=>fs.writeFile(file,JSON.stringify(value));
const code=c=>e=>e.code===c;

test('closed versioned package manifest validates identities, compatibility, resources and bounds',async t=>{
 const {manifest}=await packageFixture(t);assert.equal(validatePackageManifest(manifest).id,'divdev/guestbook');
 for(const change of [m=>m.schema='unknown',m=>m.id='bad',m=>m.publisher='wydgit.core',m=>m.publisher='other',m=>m.version='wat',m=>m.version='1',m=>m.platform='>=9',m=>m.resources.template='../outside.json',m=>m.resources.template='/tmp/file',m=>m.resources.template='.hidden/file',m=>m.resources.template=m.resources.prototypes,m=>m.resources.sources.refresh='startup.js',m=>m.hooks={},m=>m.permissions.scopes=null,m=>m.permissions.scopes.prototypes=['divdev/*'],m=>m.storage[0].provider='sqlite',m=>m.resources.sources.refresh='a'.repeat(200),m=>m.permissions.capabilities=Array(129).fill('object.instances.edit')]){
  const m=structuredClone(manifest);change(m);assert.throws(()=>validatePackageManifest(m));
 }
 assert.throws(()=>validatePackageManifest(JSON.stringify(manifest).replace('"publisher":','"__proto__":{},"publisher":')));
 assert.throws(()=>validatePackageManifest(' '.repeat(32769)));
});

test('plan is read-only, canonical insertion, catalog/receipt, core files unchanged and source independence',async t=>{
 const {root,packagePath,options}=await packageFixture(t),core=await read(path.join(root,'prototypes/objects.json')),page=await read(path.join(root,'content/pages/home.json')),config=await read(path.join(root,'wydgit.config.json'));
 const plan=await planPackageInstall(options);assert.equal(plan.schema,'wydgit-install-plan/0.1');assert.deepEqual({...plan.placement},options.placement);assert.equal(plan.storageMappings.entries.store,'host-book');assert.equal(plan.prototypes.length,3);assert.ok(plan.resources['submit.bas'].sha256);assert.ok(Object.isFrozen(plan.approved));
 await assert.rejects(fs.stat(path.join(root,STATE)),{code:'ENOENT'});assert.deepEqual(await fs.readdir(path.join(root,'data')),[]);
 await assert.rejects(applyPackageInstall({...plan}),code('PACKAGE.PLAN'));
 const receipt=await applyPackageInstall(plan);assert.equal(receipt.schema,'wydgit-install-receipt/0.1');assert.deepEqual({...receipt.placement},options.placement);
 const model=loadRepository(root);assert.equal(model.runtime.get('home').slots.sections[1],'guestbook');assert.equal(model.registry.method('divdev/guestbook-form','saveentry').owner,'divdev/guestbook-form');assert.equal(model.installed.packages[0].state,'installed');
 assert.equal(await read(path.join(root,'prototypes/objects.json')),core);assert.equal(await read(path.join(root,'content/pages/home.json')),page);assert.equal(await read(path.join(root,'wydgit.config.json')),config);
 await fs.rm(packagePath,{recursive:true});assert.equal(loadRepository(root).runtime.get('guestbook').prototype,'divdev/guestbook');
 // Repeated install fails before touching the accepted catalog.
 await fs.cp('examples/guestbook',packagePath,{recursive:true});const accepted=await read(path.join(root,STATE));await assert.rejects(planPackageInstall(options),code('PACKAGE.ALREADY_INSTALLED'));assert.equal(await read(path.join(root,STATE)),accepted);
});

test('missing/escaping/oversized resources and symlink roots fail without installation',async t=>{
 const {root,packagePath,options}=await packageFixture(t),file=path.join(packagePath,'submit.bas'),source=await read(file);
 await fs.unlink(file);await assert.rejects(planPackageInstall(options));await fs.writeFile(file,'x'.repeat(65537));await assert.rejects(planPackageInstall(options),code('PACKAGE.LIMIT'));
 await fs.unlink(file);await fs.symlink(path.join(root,'content/app.json'),file);await assert.rejects(planPackageInstall(options),code('PACKAGE.PATH'));await fs.unlink(file);await fs.writeFile(file,source);
 const link=path.join(root,'linked');await fs.symlink(packagePath,link);await assert.rejects(planPackageInstall({...options,packagePath:link}),code('PACKAGE.PATH'));await assert.rejects(fs.stat(path.join(root,STATE)),{code:'ENOENT'});
});

test('candidate registry retains duplicate, publisher, inheritance, override, cycle and abstract rules',async t=>{
 const {root,packagePath,options}=await packageFixture(t),file=path.join(packagePath,'prototypes.json'),original=JSON.parse(await read(file));
 const cases=[
 [d=>d.push(d[0]),'PROTOTYPE.DUPLICATE'],
 [d=>d[0].extends='divdev/missing','PROTOTYPE.UNKNOWN'],
 [d=>d[0].extends=d[0].id,'PROTOTYPE.CYCLE'],
 [d=>d[0].extends='acme/message-panel','PROTOTYPE.PUBLISHER'],
 [d=>d[0].abstract=true,'OBJECT.ABSTRACT'],
 [d=>d[1].behaviorSource='SUB Clear()\nEND SUB','PROTOTYPE.METHOD'],
 [d=>{d[1].behaviorSource='SUB Clear(value AS String)\nEND SUB';d[1].overrides=['clear'];},'PROTOTYPE.METHOD'],
 [d=>d[0].behaviorSource='SUB Cycle()\nCALL Me.Cycle()\nEND SUB','PROTOTYPE.METHOD'],
 [d=>d[0].behaviorSource='PROCESS.exit()','WYDBASIC.SYNTAX'],
 ];
 for(const [change,expected] of cases){const d=structuredClone(original);change(d);await write(file,d);await assert.rejects(planPackageInstall(options),code(expected));}
 await write(file,original);
 // Collision with an existing core definition within the same publisher namespace.
 const core=path.join(root,'prototypes/objects.json'),defs=JSON.parse(await read(core));
 const privateCore=structuredClone(defs);privateCore.find(d=>d.id==='wydgit.core/section').public=false;await write(core,privateCore);await assert.rejects(planPackageInstall(options),code('PROTOTYPE.PUBLISHER'));await write(core,defs);
 defs.push({...original[0],behaviorSource:undefined});await write(core,defs);await assert.rejects(planPackageInstall(options),code('PROTOTYPE.DUPLICATE'));
 await assert.rejects(fs.stat(path.join(root,STATE)),{code:'ENOENT'});
});

test('invalid placement/content, duplicate objects, nested Form and unknown bindings fail atomically',async t=>{
 const {root,packagePath,manifest,options}=await packageFixture(t),file=path.join(packagePath,'section.json'),original=JSON.parse(await read(file));
 await assert.rejects(planPackageInstall({...options,placement:{...options.placement,slot:'unknown'}}),code('MUTATION.INVALID_SLOT'));
 await assert.rejects(planPackageInstall({...options,placement:{...options.placement,index:99}}),code('MUTATION.INDEX'));
 await assert.rejects(planPackageInstall({...options,placement:{...options.placement,parent:'about'}}),code('PACKAGE.PLACEMENT'));
 for(const change of [n=>n.slots.blocks[0].id='guestbook',n=>n.slots.blocks[0].properties.content=3,n=>n.slots.blocks[1].slots.blocks.push({...structuredClone(n.slots.blocks[1]),id:'nested'})]){const n=structuredClone(original);change(n);await write(file,n);await assert.rejects(planPackageInstall(options));}
 await write(file,original);const m=structuredClone(manifest);m.bindings[0].event='Page.Wat';await write(path.join(packagePath,'manifest.json'),m);await assert.rejects(planPackageInstall(options));await assert.rejects(fs.stat(path.join(root,STATE)),{code:'ENOENT'});
});

test('host-enabled compatible storage and explicit exact grants required; package cannot change host config',async t=>{
 const {root,options,config}=await packageFixture(t),file=path.join(root,'wydgit.config.json'),original=JSON.stringify(config);
 for(const change of [c=>c.libraries=c.libraries.filter(x=>x.id!=='wydstore'),c=>c.libraries.find(x=>x.id==='wydstore').enabled=false,c=>c.libraries.find(x=>x.id==='wydstore').version='>=9',c=>c.libraries.find(x=>x.id==='wydstore').options.stores[0].publisher='other',c=>c.libraries.find(x=>x.id==='wydstore').options.stores[0].collections[0].fields.message.type='boolean']){const c=structuredClone(config);change(c);await write(file,c);const before=await read(file);await assert.rejects(planPackageInstall(options));assert.equal(await read(file),before);}
 await fs.writeFile(file,original);
 await assert.rejects(planPackageInstall({...options,storageMappings:{entries:{store:'host-book',collection:'host-entries',provider:'sqlite'}}}));
 await assert.rejects(planPackageInstall({...options,approvals:{...options.approvals,capabilities:[]}}),code('PACKAGE.DENIED'));
 await assert.rejects(planPackageInstall({...options,approvals:{...options.approvals,capabilities:[...options.approvals.capabilities,'store.records.delete']}}),code('PACKAGE.DENIED'));
 await assert.rejects(planPackageInstall({...options,installationContext:new ExecutionContext({publisher:'divdev',package:'divdev/guestbook',self:'home',app:'boilerplate',visible:options.installationContext.visible,editable:options.installationContext.editable})}),code('MUTATION.DENIED'));
 assert.deepEqual(await fs.readdir(path.join(root,'data')),[]);
});

test('stale App/config/catalog plans rejected, persistence failure preserves accepted state, competing plans serialized',async t=>{
 const {root,options}=await packageFixture(t),file=path.join(root,'content/pages/home.json'),original=await read(file);
 const stale=await planPackageInstall(options);await fs.writeFile(file,original+'\n');await assert.rejects(applyPackageInstall(stale),code('PACKAGE.STALE'));await fs.writeFile(file,original);
 const plan=await planPackageInstall(options),competing=await planPackageInstall(options);
 await assert.rejects(applyPackageInstall(plan,{beforeReplace(){throw new Error('simulated interruption');}}),/simulated interruption/);assert.equal(await read(file),original);await assert.rejects(fs.stat(path.join(root,STATE)),{code:'ENOENT'});
 assert.equal((await fs.readdir(path.join(root,'content'))).some(n=>n.startsWith('.package')),false);
 await applyPackageInstall(plan);const accepted=await read(path.join(root,STATE));await assert.rejects(applyPackageInstall(competing),code('PACKAGE.STALE'));assert.equal(await read(path.join(root,STATE)),accepted);
 await fs.writeFile(file,original+'\n');assert.throws(()=>loadRepository(root),code('PACKAGE.DRIFT'));
});

test('activation uses exact approved principal and actual Session identity, rejects principal union',async t=>{
 const {root,options}=await packageFixture(t);await applyPackageInstall(await planPackageInstall(options));const libraries=await initializeHost({root}),model=loadRepository(root),active=activatePackages(model,libraries,root);
 const identity={authenticated:true,app:'boilerplate',userId:'user',sessionId:'session',createdAt:1,expiresAt:9,roles:[],groups:[],permissions:['store.records.delete']};const context=active.context({pageId:'home',session:{identity},ids:['home']});assert.equal(context.identity.sessionId,'session');assert.equal(context.package,'divdev/guestbook');assert.equal(context.allows('store.records.delete'),false);assert.equal(context.editable.includes('home'),false);
 assert.equal((await libraries.bind(context).call('wydstore','create',{store:'host-book',collection:'host-entries',id:'entry',data:{name:'Ada',message:'Hello'}})).ok,true);
 const denied=new ExecutionContext({publisher:'divdev',package:'divdev/guestbook',app:'boilerplate',self:'guestbook',scopes:context.scopes});assert.equal((await libraries.bind(denied).call('wydstore','query',{store:'host-book',collection:'host-entries'})).code,'SEAM.DENIED');
 const altered={...model,installed:{...model.installed,packages:[...model.installed.packages,...model.installed.packages]}};assert.throws(()=>activatePackages(altered,libraries,root),code('PACKAGE.PRINCIPALS'));
 const {createHostApp}=await import('../app.js');await assert.rejects(createHostApp({root,execution:{context:()=>context}}),code('PACKAGE.PRINCIPALS'));
});

test('second package: duplicate prototypes and same Page denied; different Page isolated; failed persistence preserves installed catalog',async t=>{
 const {root,packagePath,manifest,options}=await packageFixture(t);await applyPackageInstall(await planPackageInstall(options));const accepted=await read(path.join(root,STATE));
 const next=structuredClone(manifest);next.id='divdev/other';await write(path.join(packagePath,'manifest.json'),next);
 await assert.rejects(planPackageInstall(options),code('PACKAGE.PRINCIPALS'));
 await assert.rejects(planPackageInstall({...options,placement:{page:'about',parent:'about',slot:'sections',index:0}}),code('PROTOTYPE.DUPLICATE'));
 next.resources.sources={};next.bindings=[];next.storage=[];next.requires.libraries=[];next.permissions={capabilities:[],traversal:[],visible:['other-section'],editable:[],scopes:{wydstore:[]}};
 await write(path.join(packagePath,'manifest.json'),next);await write(path.join(packagePath,'prototypes.json'),[{id:'divdev/other',publisher:'divdev',extends:'wydgit.core/section',properties:{},slots:{}}]);
 await write(path.join(packagePath,'section.json'),{schema:'wydgit/0.2',id:'other-section',prototype:'divdev/other',properties:{},slots:{},provenance:{}});
 const ctx=options.installationContext;const installContext=new ExecutionContext({...ctx,visible:[...ctx.visible,'other-section'],editable:[...ctx.editable,'other-section']});
 const otherOptions={...options,placement:{page:'about',parent:'about',slot:'sections',index:0},approvals:next.permissions,storageMappings:{},installationContext:installContext};
 const plan=await planPackageInstall(otherOptions);await assert.rejects(applyPackageInstall(plan,{beforeReplace(){throw new Error('persistence failed');}}),/persistence failed/);assert.equal(await read(path.join(root,STATE)),accepted);assert.equal(loadRepository(root).runtime.get('home').slots.sections[1],'guestbook');
 await applyPackageInstall(plan);const model=loadRepository(root),libraries=await initializeHost({root}),active=activatePackages(model,libraries,root);
 const other=active.context({pageId:'about',session:{},ids:['about','other-section']});assert.equal(other.package,'divdev/other');assert.deepEqual(other.capabilities,[]);assert.equal(other.visible.includes('guestbook'),false);
 const guest=active.context({pageId:'home',session:{},ids:['home']});assert.equal(guest.visible.includes('other-section'),false);
 const state=await read(path.join(root,STATE));const stale=JSON.parse(state);stale.packages[0].resources['submit.bas']+='\n';await write(path.join(root,STATE),stale);assert.throws(()=>loadRepository(root),code('PACKAGE.DRIFT'));
});

test('stale host config/catalog, bounded template/prototype counts and unapproved scopes fail closed',async t=>{
 const {root,packagePath,options,manifest}=await packageFixture(t),configFile=path.join(root,'wydgit.config.json'),config=await read(configFile);
 const plan=await planPackageInstall(options);await fs.writeFile(configFile,config+'\n');await assert.rejects(applyPackageInstall(plan),code('PACKAGE.STALE'));await fs.writeFile(configFile,config);
 const stale=await planPackageInstall(options);await fs.writeFile(path.join(root,STATE),'{}');await assert.rejects(applyPackageInstall(stale),code('PACKAGE.STALE'));await fs.unlink(path.join(root,STATE));
 await assert.rejects(planPackageInstall({...options,approvals:{...options.approvals,scopes:{wydstore:[]}}}),code('PACKAGE.DENIED'));
 const definitions=JSON.parse(await read(path.join(packagePath,'prototypes.json')));await write(path.join(packagePath,'prototypes.json'),Array.from({length:65},()=>definitions[0]));await assert.rejects(planPackageInstall(options),code('PACKAGE.LIMIT'));await write(path.join(packagePath,'prototypes.json'),definitions);
 const template=JSON.parse(await read(path.join(packagePath,'section.json')));let current=template;for(let i=0;i<34;i++){const child={...structuredClone(template),id:'depth-'+i,slots:{blocks:[]}};current.slots={blocks:[child]};current=child;}await write(path.join(packagePath,'section.json'),template);await assert.rejects(planPackageInstall(options),code('PACKAGE.LIMIT'));
 const m=structuredClone(manifest);for(let i=0;i<16;i++)m.resources.sources['source-'+i]='source-'+i+'.bas';assert.throws(()=>validatePackageManifest(m));
});

test('simultaneous install attempts fail with structured busy and publish exactly one accepted state',async t=>{
 const {root,options}=await packageFixture(t),a=await planPackageInstall(options),b=await planPackageInstall(options);
 let release,entered;const held=new Promise(r=>release=r),ready=new Promise(r=>entered=r);
 const first=applyPackageInstall(a,{beforeReplace:async()=>{entered();await held;}});
 await ready;
 try{assert.throws(()=>loadRepository(root),{code:'PACKAGE.RECOVERY'});await assert.rejects(applyPackageInstall(b),{code:'PACKAGE.BUSY'});}
 finally{release();}
 await first;assert.equal(loadRepository(root).installed.packages.length,1);
 await assert.rejects(applyPackageInstall(b),{code:'PACKAGE.STALE'});
});

test('malformed catalogs and receipt metadata drift fail closed',async t=>{
 const {root,options}=await packageFixture(t);await applyPackageInstall(await planPackageInstall(options));
 const location=path.join(root,STATE),accepted=await read(location);
 for(const change of [s=>s.packages=[null],s=>s.packages[0].state='active',s=>s.packages[0].receipt.approved.capabilities=[],s=>s.packages[0].receipt.placement.page='contact',s=>s.packages[0].receipt.instanceIds=[],s=>s.packages[0].receipt.storageMappings={},s=>s.packages[0].receipt.publisher='other',s=>s.packages[0].receipt.instance='other',s=>s.packages[0].receipt.installable='other',s=>s.packages[0].receipt.libraries=[],s=>s.packages[0].receipt.bindings=[]]){
  const state=JSON.parse(accepted);change(state);await write(location,state);assert.throws(()=>loadRepository(root),{code:'PACKAGE.CATALOG'});
 }
 await fs.writeFile(location,'{');assert.throws(()=>loadRepository(root),{code:'INPUT.JSON'});
 await fs.writeFile(location,accepted);await fs.writeFile(path.join(root,'content/.package-install.lock'),'interrupted');
 assert.throws(()=>loadRepository(root),{code:'PACKAGE.RECOVERY'});await assert.rejects(initializeHost({root}),{code:'PACKAGE.RECOVERY'});
});

test('dangling recovery and catalog symlinks cannot be mistaken for absent state',async t=>{
 const {root}=await packageFixture(t);
 for(const relative of ['content/.package-install.lock','content/.package-infrastructure.json',STATE]){
  const location=path.join(root,relative);await fs.symlink(path.join(root,'missing-target'),location);
  assert.throws(()=>loadRepository(root),{code:relative===STATE?'PACKAGE.PATH':'PACKAGE.RECOVERY'});
  if(relative!==STATE)await assert.rejects(initializeHost({root}),{code:'PACKAGE.RECOVERY'});
  await fs.unlink(location);
 }
});

test('package safety ceiling permits more than 32 and rejects planning at 1024 before candidate work or writes',async t=>{
 const {root,packagePath}=await packageFixture(t);
 const pageId=i=>'capacity-page-'+i,instanceId=i=>'capacity-section-'+i;
 // Provision all destinations in base content before accepting a catalog so this
 // tests the package ceiling, not base drift or the one-principal-per-Page rule.
 for(let i=0;i<34;i++)await write(path.join(root,'content/pages',pageId(i)+'.json'),{
  schema:'wydgit/0.2',id:pageId(i),prototype:'wydgit.core/page',properties:{title:'Capacity '+i,slug:pageId(i)},slots:{sections:[],navigation:[]},provenance:{}
 });
 await write(path.join(packagePath,'prototypes.json'),[]);
 const optionsFor=async i=>{
  const approvals={capabilities:[],traversal:[],visible:[instanceId(i)],editable:[],scopes:{wydstore:[]}};
  await write(path.join(packagePath,'manifest.json'),{
   schema:'wydgit-package/0.1',id:'acme/capacity-'+i,publisher:'acme',version:'1.0.0',platform:'>=0.2.0-alpha.1',runtime:['server'],
   resources:{prototypes:'prototypes.json',template:'section.json',sources:{}},requires:{schema:'wydgit.requirements/0.1',libraries:[]},
   storage:[],permissions:approvals,bindings:[],installables:[{id:'capacity',kind:'section-template'}]
  });
  await write(path.join(packagePath,'section.json'),{schema:'wydgit/0.2',id:instanceId(i),prototype:'wydgit.core/section',properties:{},slots:{blocks:[]},provenance:{}});
  return {root,packagePath,placement:{page:pageId(i),parent:pageId(i),slot:'sections',index:0},approvals,
   installationContext:new ExecutionContext({publisher:'operator',self:pageId(i),app:'boilerplate',capabilities:['object.instances.edit'],visible:[pageId(i),instanceId(i)],editable:[pageId(i),instanceId(i)]})};
 };
 for(let i=0;i<33;i++)await applyPackageInstall(await planPackageInstall(await optionsFor(i)));
 const model=loadRepository(root);assert.equal(model.installed.packages.length,33);
 assert.equal(model.runtime.get(instanceId(32)).prototype,'wydgit.core/section');
 const catalog=await read(path.join(root,STATE)),config=await read(path.join(root,'wydgit.config.json'));
 // Expand validated receipt metadata to exercise the defensive ceiling without
 // treating 1024 sequential installs as a supported-capacity benchmark.
 const state=JSON.parse(catalog);
 while(state.packages.length<LIMITS.packages){const entry=structuredClone(state.packages[0]);entry.manifest.id='acme/bound-'+state.packages.length;entry.receipt.package=entry.manifest.id;state.packages.push(entry);}
 await write(path.join(root,STATE),state);
 assert.equal(readInstalledState(root).packages.length,LIMITS.packages);
 const boundedCatalog=await read(path.join(root,STATE));
 const options=await optionsFor(33);options.packagePath=path.join(root,'nonexistent-candidate');
 const contents=await fs.readdir(path.join(root,'content')),data=await fs.readdir(path.join(root,'data'));
 await assert.rejects(planPackageInstall(options),{code:'PACKAGE.LIMIT'});
 assert.equal(await read(path.join(root,STATE)),boundedCatalog);assert.equal(await read(path.join(root,'wydgit.config.json')),config);
 assert.deepEqual(await fs.readdir(path.join(root,'content')),contents);assert.deepEqual(await fs.readdir(path.join(root,'data')),data);
 state.packages.push(structuredClone(state.packages[0]));await write(path.join(root,STATE),state);
 assert.throws(()=>readInstalledState(root),code('PACKAGE.CATALOG'));
 await fs.writeFile(path.join(root,STATE),boundedCatalog);
 await assert.rejects(fs.stat(path.join(root,'.wydgit-data')),{code:'ENOENT'});
});
