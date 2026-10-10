import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { packageFixture } from '../test-support/packages.js';
import { buildOperatorPolicy, runInstaller } from '../scripts/install-package.js';
import { planOperatorInstall, applyOperatorInstall, storageLocation } from '../scripts/package-infrastructure.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { initializeHost } from '../wydgine/host.js';
import { activatePackages } from '../wydgine/packages/index.js';
import { loadRepository } from '../wydgine/repository.js';
const file=root=>path.join(root,'wydgit.config.json');
async function disabled(t){const fixture=await packageFixture(t);const library=fixture.config.libraries.find(l=>l.id==='wydstore');library.enabled=false;delete library.options;await fs.writeFile(file(fixture.root),JSON.stringify(fixture.config));return fixture;}
async function policyFor(f,provider='JSON',last='y'){
 const queue=['y','y','home','home','sections','1',provider,'',last],prompts=[];
 const policy=await buildOperatorPolicy({...f,ask:async prompt=>{prompts.push(prompt);assert.ok(queue.length,'Unexpected prompt '+prompt);return queue.shift();},write:text=>prompts.push(text)});
 return {policy,prompts};
}
const planFor=(f,policy)=>planOperatorInstall({...f,policy,installationContext:new ExecutionContext(policy.installationContext)});
async function untouched(f,before){assert.equal(await fs.readFile(file(f.root),'utf8'),before);assert.deepEqual(await fs.readdir(path.join(f.root,'data')),[]);await assert.rejects(fs.stat(path.join(f.root,'.wydgit-data')),{code:'ENOENT'});await assert.rejects(fs.stat(path.join(f.root,'content/installed-packages.json')),{code:'ENOENT'});assert.equal((await fs.readdir(path.join(f.root,'content'))).some(n=>n.startsWith('.package')),false);}
for(const provider of ['JSON','SQLite'])test(`${provider}: explicit interactive enablement/provisioning is prospective, applies and reopens through WydStore`,async t=>{
 const f=await disabled(t),before=await fs.readFile(file(f.root),'utf8'),{policy,prompts}=await policyFor(f,provider);
 assert.match(prompts.join('\n'),/object.instances.construct/);assert.match(prompts.join('\n'),/guestbook-entry-\*/);assert.equal(policy.infrastructure.enableWydstore,true);
 const resolved=await planFor(f,policy);assert.equal(resolved.hostConfig.libraries.find(l=>l.id==='wydstore').enabled,true);await untouched(f,before);
 await applyOperatorInstall(resolved);const model=loadRepository(f.root);let libraries=await initializeHost({root:f.root}),active=activatePackages(model,libraries,f.root),context=active.context({pageId:'home',session:{},ids:[]});
 const mapping=policy.storageMappings.entries;
 assert.equal((await libraries.bind(context).call('wydstore','create',{...mapping,id:'test-record',data:{name:'Ada',message:'Hi'}})).ok,true);
 libraries=await initializeHost({root:f.root});assert.equal((await libraries.bind(context).call('wydstore','query',mapping)).value.length,1);
 assert.equal(JSON.parse(await fs.readFile(file(f.root),'utf8')).libraries.find(l=>l.id==='wydstore').options.stores[0].provider,provider.toLowerCase());
 assert.ok((await fs.readdir(resolved.roots[0])).some(n=>n.endsWith(provider==='SQLite'?'.sqlite':'.json')));
});
test('declined enablement/provisioning and unused prospective plan do not change host state',async t=>{
 const f=await disabled(t),before=await fs.readFile(file(f.root),'utf8');
 let queue=['y','n'];assert.equal(await buildOperatorPolicy({...f,ask:async()=>queue.shift(),write:()=>{}}),null);await untouched(f,before);
 assert.equal((await policyFor(f,'JSON','n')).policy,null);await untouched(f,before);
 const {policy}=await policyFor(f);await planFor(f,policy);await untouched(f,before);
});
test('missing canonical library, unsafe paths, invalid schema and placement fail before writes',async t=>{
 const f=await disabled(t),{policy}=await policyFor(f),before=await fs.readFile(file(f.root),'utf8');
 for(const mutation of [p=>p.infrastructure.stores[0].location='../escape',p=>p.infrastructure.stores[0].location='content/storage',p=>p.infrastructure.stores[0].provider='remote',p=>p.infrastructure.stores[0].collections[0].fields.name.type='unknown',p=>p.placement.index=999,p=>p.infrastructure.enableWydstore=false]){const p=structuredClone(policy);mutation(p);await assert.rejects(planFor(f,p));await untouched(f,before);}
 await fs.symlink(path.join(f.root,'data'),path.join(f.root,'linked'));assert.throws(()=>storageLocation(f.root,'linked/new'),{code:'PACKAGE.PATH'});
 f.config.libraries=f.config.libraries.filter(l=>l.id!=='wydstore');await fs.writeFile(file(f.root),JSON.stringify(f.config));await assert.rejects(buildOperatorPolicy({...f,ask:async()=> 'y',write:()=>{}}),{code:'PACKAGE.LIBRARY'});
});
for(const hook of ['beforeConfigReplace','beforeStateReplace','beforeProviderSetup'])test(`${hook}: apply failure restores config, catalog, App and runtime directories`,async t=>{
 const f=await disabled(t),before=await fs.readFile(file(f.root),'utf8'),{policy}=await policyFor(f),resolved=await planFor(f,policy);
 const app=await fs.readFile(path.join(f.root,'content/app.json'),'utf8');
 await assert.rejects(applyOperatorInstall(resolved,{[hook]:()=>{throw Error('injected failure');}}),/injected failure/);
 await untouched(f,before);assert.equal(await fs.readFile(path.join(f.root,'content/app.json'),'utf8'),app);assert.throws(()=>loadRepository(f.root).runtime.get('guestbook'));
});
test('ambiguous mappings require selection and enabled existing storage is not reprovisioned',async t=>{
 const f=await packageFixture(t);const library=f.config.libraries.find(l=>l.id==='wydstore');library.options.stores.push({...library.options.stores[0],id:'second-book'});await fs.writeFile(file(f.root),JSON.stringify(f.config));
 let queue=['y','home','home','sections','1',''];await assert.rejects(buildOperatorPolicy({...f,ask:async()=>queue.shift(),write:()=>{}}),{code:'PACKAGE.PLACEMENT'});
 queue=['y','home','home','sections','1','2'];const policy=await buildOperatorPolicy({...f,ask:async()=>queue.shift(),write:()=>{}});assert.equal(policy.storageMappings.entries.store,'second-book');assert.equal(policy.infrastructure,undefined);await planFor(f,policy);
});

test('declining final infrastructure plan keeps disabled host and runtime data untouched, even with --apply',async t=>{
 const f=await disabled(t),before=await fs.readFile(file(f.root),'utf8'),queue=['y','y','home','home','sections','1','JSON','','y','n'];let text='';
 const result=await runInstaller({args:[f.packagePath,'--root',f.root,'--apply'],ask:async()=>queue.shift(),output:{write:value=>{text+=value;}}});
 assert.equal(result.receipt,null);assert.match(text,/enableWydstore/);assert.match(text,/requested/);await untouched(f,before);
});
test('stale host choices are rejected and interrupted infrastructure state blocks startup',async t=>{
 const f=await disabled(t),{policy}=await policyFor(f),resolved=await planFor(f,policy);
 await fs.appendFile(file(f.root),'\n');await assert.rejects(applyOperatorInstall(resolved),{code:'PACKAGE.STALE'});await assert.rejects(fs.stat(path.join(f.root,'.wydgit-data')),{code:'ENOENT'});
 await fs.writeFile(path.join(f.root,'content/.package-infrastructure.json'),'{}');assert.throws(()=>loadRepository(f.root),{code:'PACKAGE.RECOVERY'});await assert.rejects(initializeHost({root:f.root}),{code:'PACKAGE.RECOVERY'});
});

test('unattended infrastructure is applied only from explicit operator policy',async t=>{
 const f=await disabled(t),{policy}=await policyFor(f,'SQLite'),policyPath=path.join(f.root,'operator.json');
 await fs.writeFile(policyPath,JSON.stringify(policy));
 const result=await runInstaller({args:[f.packagePath,'--root',f.root,'--approval',policyPath,'--apply'],ask:()=>{throw Error('Unexpected prompt');},output:{write:()=>{}}});
 assert.equal(result.receipt.package,'divdev/guestbook');assert.equal(loadRepository(f.root).runtime.get('guestbook').prototype,'divdev/guestbook');
});
test('infrastructure failure preserves an already accepted package catalog and config',async t=>{
 const f=await packageFixture(t),initialPolicy=JSON.parse(await fs.readFile('examples/guestbook-policy.example.json','utf8'));
 await applyOperatorInstall(await planFor(f,initialPolicy));
 const catalogFile=path.join(f.root,'content/installed-packages.json'),catalog=await fs.readFile(catalogFile,'utf8'),config=await fs.readFile(file(f.root),'utf8');
 const m=structuredClone(f.manifest);m.id='divdev/other';m.resources.sources={};m.bindings=[];m.permissions={capabilities:[],traversal:[],visible:['other'],editable:[],scopes:{wydstore:[]}};
 const template={schema:'wydgit/0.2',id:'other',prototype:'wydgit.core/section',properties:{},slots:{blocks:[]},provenance:{}};
 await fs.writeFile(path.join(f.packagePath,'manifest.json'),JSON.stringify(m));await fs.writeFile(path.join(f.packagePath,'prototypes.json'),'[]');await fs.writeFile(path.join(f.packagePath,'section.json'),JSON.stringify(template));f.manifest=m;
 const policy={infrastructure:{enableWydstore:false,stores:[{id:'other-store',provider:'json',location:'.wydgit-data/other',collections:[{id:'entries',fields:m.storage[0].fields}]}]},placement:{page:'about',parent:'about',slot:'sections',index:0},approvals:m.permissions,storageMappings:{entries:{store:'other-store',collection:'entries'}},installationContext:{publisher:'operator',app:'boilerplate',self:'about',capabilities:['object.instances.edit'],visible:['about','other','about-intro','about-principles'],editable:['about','other','about-intro','about-principles']}};
 // Derive the slot's real occupants rather than relying on sample content names.
 const occupants=loadRepository(f.root).runtime.get('about').slots.sections;policy.installationContext.visible=['about','other',...occupants];policy.installationContext.editable=policy.installationContext.visible;
 const resolved=await planFor(f,policy);
 await assert.rejects(applyOperatorInstall(resolved,{beforeStateReplace:()=>{throw Error('catalog write failure');}}),/catalog write failure/);
 assert.equal(await fs.readFile(catalogFile,'utf8'),catalog);assert.equal(await fs.readFile(file(f.root),'utf8'),config);assert.equal(loadRepository(f.root).runtime.get('guestbook').prototype,'divdev/guestbook');await assert.rejects(fs.stat(path.join(f.root,'.wydgit-data')),{code:'ENOENT'});
});

test('source directories and symlink site roots cannot become runtime storage locations',async t=>{
 const f=await disabled(t);
 for(const directory of ['docs','scripts','wydgine','wydclient','packages','test','test-support'])assert.throws(()=>storageLocation(f.root,directory+'/runtime'),{code:'PACKAGE.PATH'});
 const link=path.join(f.root,'site-link');await fs.symlink(f.root,link);
 assert.throws(()=>storageLocation(link,'.wydgit-data/new-store'),{code:'PACKAGE.PATH'});
});

test('config change immediately before replacement fails stale without overwriting the operator change',async t=>{
 const f=await disabled(t),before=await fs.readFile(file(f.root),'utf8'),{policy}=await policyFor(f),resolved=await planFor(f,policy);
 await assert.rejects(applyOperatorInstall(resolved,{beforeConfigReplace:()=>fs.appendFile(file(f.root),'\n')}),{code:'PACKAGE.STALE'});
 await untouched(f,before+'\n');
});
