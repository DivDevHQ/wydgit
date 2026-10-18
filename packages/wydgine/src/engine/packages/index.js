import {interfaceTypes} from '../object-model/interfaces.js';
import {validate as validateWorkflow} from '../sewn/validate.js';
import {StaticLibraryRegistry} from '../static-libraries/index.js';
import fs from 'node:fs/promises';
import { lstatSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadRepository, repositoryFromState, compileDefinitions } from '../repository.js';
import { hydrate, dehydrate, PrototypeRegistry } from '../object-model/index.js';
import { clean, freeze, jsonKeys, WydgitError, requireThat as check } from '../object-model/validation.js';
import { validateEnvelope } from '../object-model/schema.js';
import { ExecutionContext, checkContext, matchesObjectGrant } from '../seam/context.js';
import { EventRegistry, prepareHandlers, prepareAction } from '../events/index.js';
import { compileModule } from '../wydbasic/index.js';
import { validateConfig, validateManifest as libraryManifest, satisfies, fields } from '../libraries/contracts.js';
import { importNodePackage } from '../libraries/node-package.js';
import platform from '../../../package.json' with { type: 'json' };
import { validatePackageManifest,validateComponentPlatform, LIMITS, permissions, qualified } from './manifest.js';
import { STATE, readInstalledState, validateInstalledState, safeRead, baseFingerprint, stateFingerprint, digest } from './state.js';
import semver from 'semver';
import { packageGraph, removalOrder, protectedPackage } from './graph.js';
import { authorizeLifecycle, createPackageBudget, packageBudget } from './budget.js';
import { publishPackageState } from './transaction.js';
export { createPackageBudget } from './budget.js';
export { inspectPackageOperation, recoverPackageOperation } from './transaction.js';
export { validatePackageManifest } from './manifest.js';
const plans=new WeakMap();
const idsOf=node=>[node.id,...Object.values(node.slots).flat().flatMap(idsOf)];
const equal=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
function copyEnvelope(node,depth=0,budget={nodes:0}) {
 check(++budget.nodes<=LIMITS.templateNodes,'PACKAGE.LIMIT','Attachment node limit');
 check(depth<=LIMITS.templateDepth,'PACKAGE.LIMIT','Attachment depth limit');validateEnvelope(node);jsonKeys(node.slots);
 const slots=Object.create(null);for(const [slot,children] of Object.entries(node.slots)){check(/^[a-z][a-z0-9-]*$/.test(slot)&&!['constructor','prototype'].includes(slot)&&Array.isArray(children),'PACKAGE.TEMPLATE','Invalid attachment slot');jsonKeys(children);slots[slot]=children.map(child=>copyEnvelope(child,depth+1,budget));}
 return {schema:node.schema,id:node.id,prototype:node.prototype,properties:clean(node.properties),slots,provenance:clean(node.provenance)};
}
function packageDirectory(input) {
  const dir=path.resolve(input);let cursor=path.parse(dir).root;
  for(const part of dir.slice(cursor.length).split(path.sep)){cursor=path.join(cursor,part);check(!lstatSync(cursor).isSymbolicLink(),'PACKAGE.PATH','Symlink package root denied');}
  check(lstatSync(dir).isDirectory(),'PACKAGE.PATH','Expected package directory');return dir;
}
function loadPackage(packagePath) {
  try {
  const directory=packageDirectory(packagePath),manifest=validatePackageManifest(safeRead(directory,'manifest.json',LIMITS.manifest));
  const resources={};for(const file of [manifest.resources.prototypes,manifest.resources.template,...Object.values(manifest.resources.sources)])resources[file]=safeRead(directory,file);
  const definitions=JSON.parse(resources[manifest.resources.prototypes]);check(Array.isArray(definitions)&&definitions.length<=LIMITS.prototypes,'PACKAGE.LIMIT','Too many prototypes');
  check(definitions.every(d=>d.publisher===manifest.publisher&&d.id?.startsWith(manifest.publisher+'/')),'PACKAGE.NAMESPACE','Prototype namespace differs from package');
  validateComponentPlatform(manifest,definitions);
  const template=JSON.parse(resources[manifest.resources.template]);let count=0;const walk=(n,d=0)=>{check(d<=LIMITS.templateDepth&&++count<=LIMITS.templateNodes,'PACKAGE.LIMIT','Template too large');check(n&&n.slots&&typeof n.slots==='object','PACKAGE.TEMPLATE','Invalid template');for(const children of Object.values(n.slots)){check(Array.isArray(children),'PACKAGE.TEMPLATE','Invalid children');children.forEach(c=>walk(c,d+1));}};walk(template);
  return {manifest,resources,definitions,template};
  }catch(error){if(error instanceof WydgitError)throw error;throw new WydgitError('PACKAGE.SOURCE','Package resources are missing, unreadable or invalid');}
}
export function packageBindings(entry,registry,runtime) {
  const handlers=[],actions=[],events=new EventRegistry(),m=validatePackageManifest(entry.manifest);
  const moduleFor=(source,event)=>{const text=entry.resources[m.resources.sources[source]],module=entry.compiledSources?.[source]??compileModule(text,{registry:events,prototypeRegistry:registry,dependencies:m.interfaces??{}});check(module.events.length===1&&module.events[0].type===events.resolve(event),'PACKAGE.BINDING','Binding source must declare exactly its event');const workflow=validateWorkflow(module.events[0].workflow);for(const type of interfaceTypes(workflow)){const contract=registry.interface(type);check(m.interfaces?.[contract.id]===contract.version,'PACKAGE.INTERFACE','Compiled interface differs from manifest pin');}for(const lib of workflow.libraries??[])check(m.staticLibraries?.[lib.id]===lib.version,'PACKAGE.STATIC','Linked dependency differs from manifest');return workflow;};
  for(const b of m.bindings){
    const source=moduleFor(b.source,b.event);
    if(b.delegation){
      const d=b.delegation,declared=JSON.parse(entry.resources[m.resources.prototypes]).some(p=>p.id===d.type);
      check(declared&&entry.instanceIds.includes(d.root),'PACKAGE.BINDING','Delegation must belong to installed package');runtime.get(d.root);
      check(registry.isA(d.type,'wydgit.core/form')&&registry.get(d.type).actions?.[b.event]?.capability===b.capability,'PACKAGE.BINDING','Prototype does not delegate this action');
      const resolver=prepareHandlers([{owner:d.root,type:'Page.Resolve',workflow:moduleFor(d.resolver,'Page.Resolve')}],events)[0];
      actions.push(prepareAction({page:entry.placement.page,target:b.owner,type:b.event,method:b.method,capability:b.capability,workflow:source,delegation:{type:d.type,root:d.root,resolver:resolver.workflow,package:m.id,installation:entry.receipt?.id??null}},events));
      continue;
    }
    check(entry.instanceIds.includes(b.owner),'PACKAGE.BINDING','Owner outside installed template');runtime.get(b.owner);
    if(b.kind==='handler'){check(events.get(b.event).family==='Page'&&b.event!=='Page.Resolve','PACKAGE.BINDING','Only ordinary Page lifecycle handlers supported');handlers.push(...prepareHandlers([{owner:b.owner,type:b.event,workflow:source}],events));}
    else {check(events.get(b.event).family==='Semantic','PACKAGE.BINDING','Expected semantic action');check(b.event!=='Submit'||registry.isA(runtime.get(b.owner).prototype,'wydgit.core/form'),'PACKAGE.BINDING','Submit requires Form');actions.push(prepareAction({page:entry.placement.page,target:b.owner,type:b.event,method:b.method,capability:b.capability,workflow:source},events));}
  }
  for(const id of entry.instanceIds){const presentation=registry.get(runtime.get(id).prototype).presentation;for(const binding of [presentation?.request,presentation?.submission,presentation?.delivery].filter(Boolean))check(m.requires.libraries.some(r=>r.library===binding.library),'PACKAGE.LIBRARY','Component service provider must be declared');}
  return {handlers,actions};
}
async function resolveLibraries(root,manifest,hostConfig) {
  const config=validateConfig(hostConfig??safeRead(root,'wydgit.config.json')),resolved=[],scopeResolvers=new Map(),available=new Set(['object.instances.edit','object.instances.construct','app.forms.submit','event.custom.raise']);
  for(const required of manifest.requires.libraries){const entry=config.libraries.find(x=>x.id===required.library);check(entry?.enabled,'PACKAGE.LIBRARY','Required library must already be enabled');
    const {module,packageVersion}=await importNodePackage(entry,root);const m=libraryManifest(module.manifest);
    check(m.id===entry.id&&m.publisher===entry.publisher&&m.trust===entry.trust&&m.version===packageVersion&&satisfies(m.version,required.version)&&satisfies(platform.version,m.platform)&&m.targets.includes('server'),'PACKAGE.LIBRARY','Incompatible library');scopeResolvers.set(m.id,input=>module.resolvePackageScopes?.({...input,options:entry.options??{}}));resolved.push({id:m.id,version:m.version,package:entry.package});m.capabilities.forEach(cap=>available.add(cap));
  }
  return {config,resolved,available,scopeResolvers};
}
function approve(manifest,input,instanceIds,existingIds) {
  const grants=permissions(input);const requested=manifest.permissions;
  for(const key of ['capabilities','traversal','visible','editable'])check(equal(grants[key].slice().sort(),requested[key].slice().sort()),'PACKAGE.DENIED','Requested grants require explicit exact approval');
  check(equal(grants.scopes,requested.scopes),'PACKAGE.DENIED','Requested resource scopes require explicit approval');
  const patterns=[...grants.visible,...grants.editable];
  check(patterns.every(grant=>grant.endsWith('*')||instanceIds.includes(grant)), 'PACKAGE.DENIED','Exact object scopes must belong to the installable');
  check(existingIds.filter(id=>!instanceIds.includes(id)).every(id=>!matchesObjectGrant(patterns,id)), 'PACKAGE.DENIED','Object grants cover an existing object outside the installable');
  return grants;
}
function mapStorage(manifest,config,mappings,app) {
  check(equal(Object.keys(mappings).sort(),manifest.storage.map(x=>x.name).sort()),'PACKAGE.STORAGE','Supply exactly the declared logical mappings');const scopes=[];
  for(const requirement of manifest.storage){const mapping=mappings[requirement.name];fields(mapping,['store','collection'],'PACKAGE.STORAGE');check(manifest.requires.libraries.some(x=>x.library==='wydstore'),'PACKAGE.STORAGE','Storage requires WydStore');
    const store=config.libraries.find(x=>x.id==='wydstore'&&x.enabled)?.options?.stores?.find(x=>x.id===mapping.store),collection=store?.collections?.find(x=>x.id===mapping.collection);
    check(store?.app===app&&store?.publisher===manifest.publisher&&store?.package===manifest.id&&collection&&equal(collection.fields,requirement.fields),'PACKAGE.STORAGE','Incompatible host storage ownership/schema');
    if(manifest.permissions.scopes.wydstore.includes(requirement.name))scopes.push(mapping);
  }
  return {mappings:clean(mappings),scopes};
}
export async function planPackageInstall(options) {
  const plan=await planInstall(options);
  const data=plans.get(plan);packageGraph([...data.previous,data.entry]);return plan;
}
async function planInstall({root,packagePath,placement,approvals,storageMappings={},installationContext,hostConfig,verifiedPackages={},additions=[],page,properties={},navigation,staticLibraries},snapshot) {
  root=path.resolve(root);
  check(((snapshot===undefined?readInstalledState(root):snapshot)?.packages.length??0)<LIMITS.packages,'PACKAGE.LIMIT','Installed package safety ceiling reached');
  const base=baseFingerprint(root),head=stateFingerprint(root);const model=snapshot===undefined?loadRepository(root,{verifiedPackages}):repositoryFromState(root,snapshot,{verifiedPackages});const candidate=loadPackage(packagePath),{manifest,resources,definitions,template}=candidate;
  check(!(model.installed?.retained??[]).some(r=>r.entry.manifest.id===manifest.id),'PACKAGE.RETAINED','Use lifecycle reinstall for retained data');
  check(!(model.installed?.packages??[]).some(p=>p.manifest.id===manifest.id),'PACKAGE.ALREADY_INSTALLED','Package already installed');
  check(Array.isArray(additions)&&additions.length<=32,'PACKAGE.LIMIT','Too many initial attachments');
  jsonKeys(additions);const extra=additions.map(item=>{jsonKeys(item);fields(item,['placement','instance'],'PACKAGE.PLACEMENT');return {placement:clean(item.placement),instance:copyEnvelope(item.instance)};}),createdPage=page===undefined?undefined:copyEnvelope(page);
  const ownPrototype=node=>{check(definitions.some(d=>d.id===node.prototype),'PACKAGE.NAMESPACE','Attachment must instantiate a declared package prototype');Object.values(node.slots??{}).flat().forEach(ownPrototype);};
  for(const item of extra){fields(item,['placement','instance'],'PACKAGE.PLACEMENT');fields(item.placement,['page','parent','slot','index'],'PACKAGE.PLACEMENT');ownPrototype(item.instance);}
  if(createdPage){check(createdPage.prototype==='wydgit.core/page'&&Object.keys(createdPage.slots).length===0,'PACKAGE.PLACEMENT','New Page must be empty and native');}
  const prospective=dehydrate(model.runtime,{includeSensitive:true});
  if(createdPage)prospective.slots.pages.push(createdPage);
  const placementModel=hydrate(prospective,model.registry);
  fields(placement,['page','parent','slot','index'],'PACKAGE.PLACEMENT');check(typeof placement.slot==='string'&&Number.isSafeInteger(placement.index),'PACKAGE.PLACEMENT','Invalid placement');
  check(model.registry.isA(placementModel.get(placement.page).prototype,'wydgit.core/page'),'PACKAGE.PLACEMENT','Destination must be Page');
  const pageIds=[];const visit=id=>{pageIds.push(id);Object.values(placementModel.get(id).slots).flat().forEach(visit);};visit(placement.page);check(pageIds.includes(placement.parent),'PACKAGE.PLACEMENT','Parent outside Page');
  check(!(model.installed?.packages??[]).some(p=>[p.placement.page,...(p.additions??[]).map(x=>x.placement.page)].includes(placement.page)),'PACKAGE.PRINCIPALS','One authorized package principal per Page');
  const raw=JSON.parse(safeRead(root,'prototypes/objects.json'));for(const p of model.installed?.packages??[])raw.push(...JSON.parse(p.resources[p.manifest.resources.prototypes]));raw.push(...definitions);
  const trusted=Object.fromEntries(JSON.parse(safeRead(root,'prototypes/objects.json')).map(d=>[d.id,d.publisher]));for(const entry of model.installed?.packages??[])if(verifiedPackages[entry.manifest.id]===entry.manifest.publisher)for(const d of JSON.parse(entry.resources[entry.manifest.resources.prototypes]))trusted[d.id]=entry.manifest.publisher;if(verifiedPackages[manifest.id]===manifest.publisher)for(const d of definitions)trusted[d.id]=manifest.publisher;
  const interfaceDefinitions=compileDefinitions(raw.filter(d=>d.interface===true),{verifiedPrototypes:trusted});
  const interfaceRegistry=new PrototypeRegistry(interfaceDefinitions,{verifiedPrototypes:trusted});
  for(const [id,version] of Object.entries(manifest.interfaces??{}))interfaceRegistry.interface(`interface:${id}@${version}`);
  const staticOptions={libraries:staticLibraries,dependencies:{...manifest.staticLibraries,...manifest.interfaces},prototypeRegistry:interfaceRegistry,verifiedPrototypes:trusted};
  if(manifest.staticLibraries){check(staticLibraries instanceof StaticLibraryRegistry,'PACKAGE.STATIC','Host must supply an approved static-library build context');for(const [id,v] of Object.entries(manifest.staticLibraries))staticLibraries.resolve(id,v);}
  for(const d of definitions)for(const [id,v] of Object.entries(d.dependencies??{}))check(staticOptions.dependencies[id]===v,'PACKAGE.INTERFACE','Prototype dependency differs from approved build pins');
  const compiledDefinitions=compileDefinitions(definitions,staticOptions);
  for(const d of compiledDefinitions){for(const [id,v] of Object.entries(d.implements??{}))check(manifest.interfaces?.[id]===v,'PACKAGE.INTERFACE','Implementation must declare its exact manifest pin');if(d.behavior)for(const type of interfaceTypes(d.behavior)){const contract=interfaceRegistry.interface(type);check(manifest.interfaces?.[contract.id]===contract.version,'PACKAGE.INTERFACE','Prototype interface differs from manifest pin');}}
  if(manifest.staticLibraries||manifest.interfaces||definitions.some(d=>d.interface))resources[manifest.resources.prototypes]=JSON.stringify(compiledDefinitions);
  const registry=new PrototypeRegistry(compileDefinitions(raw.map(d=>compiledDefinitions.find(c=>c.id===d.id)??d),{verifiedPrototypes:trusted}),{verifiedPrototypes:trusted});check(registry.isA(template.prototype,'wydgit.core/section'),'PACKAGE.TEMPLATE','Expected Section template');
  properties=clean(properties);const configuredTemplate=copyEnvelope(template);check(properties&&typeof properties==='object'&&!Array.isArray(properties),'PACKAGE.TEMPLATE','Invalid template properties');
  const configure=node=>{if(Object.hasOwn(properties,node.id))Object.assign(node.properties,clean(properties[node.id]));Object.values(node.slots).flat().forEach(configure);};
  check(Object.keys(properties).every(id=>idsOf(template).includes(id)),'PACKAGE.TEMPLATE','Properties outside template');configure(configuredTemplate);
  const instanceIds=[...idsOf(configuredTemplate),...extra.flatMap(item=>idsOf(item.instance))];check(instanceIds.length<=LIMITS.templateNodes&&new Set(instanceIds).size===instanceIds.length,'PACKAGE.LIMIT','Invalid attachment IDs');
  check(!(model.installed?.retained??[]).some(r=>r.entry.instanceIds.some(id=>instanceIds.includes(id))),'PACKAGE.OWNERSHIP','Instance ID is reserved by retained package data');
  const approved=approve(manifest,approvals,instanceIds,idsOf(dehydrate(model.runtime))),{config,resolved,available,scopeResolvers}=await resolveLibraries(root,manifest,hostConfig),storage=mapStorage(manifest,config,storageMappings,model.runtime.rootId);
  const libraryScopes=Object.fromEntries(Object.entries(manifest.permissions.scopes).filter(([id])=>!['wydstore','prototypes','events'].includes(id)).map(([id,scopes])=>{check(scopeResolvers.has(id),'PACKAGE.STORAGE','Scope provider must be required');let grants;try{grants=clean(scopeResolvers.get(id)({app:model.runtime.rootId,scopes}));}catch{check(false,'PACKAGE.STORAGE','Library scope approval failed');}check(Array.isArray(grants)&&grants.length<=16,'PACKAGE.STORAGE','Invalid library grants');return [id,grants];}));
  check(approved.capabilities.every(cap=>available.has(cap)),'PACKAGE.DENIED','Requested capability has no required provider');
  checkContext(installationContext);check(installationContext.allows('object.instances.edit'),'MUTATION.DENIED','Mutation denied');check(installationContext.package===null,'PACKAGE.DENIED','Installation requires a host operator context');check(installationContext.app===model.runtime.rootId,'PACKAGE.DENIED','Wrong installation App');
  let runtime=hydrate(dehydrate(model.runtime,{includeSensitive:true}),registry,{revision:model.installed?.revision??0});
  if(createdPage){const edit=runtime.edit(installationContext);edit.insertChild(runtime.rootId,'pages',runtime.get(runtime.rootId).slots.pages.length,createdPage);runtime=edit.commit().runtime;}
  const edit=runtime.edit(installationContext);edit.insertChild(placement.parent,placement.slot,placement.index,configuredTemplate);runtime=edit.commit().runtime;
  for(const item of extra){const p=item.placement;check(registry.isA(runtime.get(p.page).prototype,'wydgit.core/page'),'PACKAGE.PLACEMENT','Attachment destination must be Page');const ids=[];const walk=id=>{ids.push(id);Object.values(runtime.get(id).slots).flat().forEach(walk);};walk(p.page);check(ids.includes(p.parent),'PACKAGE.PLACEMENT','Attachment parent outside Page');check(!(model.installed?.packages??[]).some(entry=>[entry.placement.page,...(entry.additions??[]).map(x=>x.placement.page)].includes(p.page)),'PACKAGE.PRINCIPALS','One package principal per Page');const edit=runtime.edit(installationContext);edit.insertChild(p.parent,p.slot,p.index,item.instance);runtime=edit.commit().runtime;}
  for(const item of [{placement,instance:configuredTemplate},...extra])check(runtime.get(item.placement.parent).slots[item.placement.slot]?.[item.placement.index]===item.instance.id,'PACKAGE.PLACEMENT','Attachments must preserve each approved position');
  if(navigation){fields(navigation,['id','label'],'PACKAGE.PLACEMENT');check(typeof navigation.label==='string'&&navigation.label.length<=128&&runtime.get(runtime.rootId).slots.navigation.includes(navigation.id),'PACKAGE.PLACEMENT','Choose existing App navigation');const node=runtime.get(navigation.id);check(registry.isA(node.prototype,'wydgit.core/navigation'),'PACKAGE.PLACEMENT','Expected navigation');const edit=runtime.edit(installationContext);edit.setProperty(navigation.id,'items',[...node.properties.items,{label:navigation.label,page:placement.page}]);runtime=edit.commit().runtime;}
  const result={runtime,revision:runtime.revision};
  const compiledSources=manifest.staticLibraries||manifest.interfaces?Object.fromEntries(Object.entries(manifest.resources.sources).map(([id,file])=>[id,compileModule(resources[file],staticOptions)])):null;
  const extensions={...(compiledSources?{compiledSources}:{}),...(extra.length?{additions:extra.map(item=>({placement:item.placement,instance:JSON.stringify(item.instance)}))}:{}),...(createdPage?{page:JSON.stringify(createdPage)}:{}),...(navigation?{navigation:clean(navigation)}:{}),...(Object.keys(properties).length?{properties:clean(properties)}:{}),...(Object.keys(libraryScopes).length?{libraryScopes}: {})};
  const entry={state:'installed',reason:'explicit',protected:false,manifest,resources,approved,storageMappings:storage.mappings,storageScopes:storage.scopes,libraries:resolved,instanceIds,instance:template.id,installable:manifest.installables[0].id,placement:clean(placement),...extensions};
  packageBindings(entry,registry,result.runtime);
  const plan=freeze({schema:'wydgit-install-plan/0.1',package:manifest.id,version:manifest.version,publisher:manifest.publisher,placement:clean(placement),instance:template.id,instanceIds,installable:entry.installable,prototypes:definitions.map(d=>d.id),resources:Object.fromEntries(Object.entries(resources).map(([file,text])=>[file,{bytes:Buffer.byteLength(text),sha256:digest(text)}])),libraries:resolved,requested:manifest.permissions,approved,storageMappings:storage.mappings,bindings:manifest.bindings,baseFingerprint:base,catalogFingerprint:head,...extensions});
  check(base===baseFingerprint(root)&&head===stateFingerprint(root),'PACKAGE.STALE','State changed during planning');
  if(hostConfig)check(Buffer.byteLength(JSON.stringify(validateConfig(hostConfig),null,2)+'\n')<=LIMITS.resource,'PACKAGE.LIMIT','Prospective host config too large');
  plans.set(plan,{root,installationContext,hostConfig:hostConfig?JSON.stringify(validateConfig(hostConfig),null,2)+'\n':null,entry,app:JSON.stringify(dehydrate(result.runtime,{includeSensitive:true})),revision:result.revision,retained:model.installed?.retained??[],previous:model.installed?.packages??[]});return plan;
}
async function syncPackageDirectory(root){const directory=await fs.open(path.join(root,'content'),'r');try{await directory.sync();}finally{await directory.close();}}
export async function applyPackageInstall(plan,{beforeReplace,prepareInfrastructure,beforeConfigReplace,beforeStateReplace}={}) {
  check(plans.has(plan),'PACKAGE.PLAN','Expected an original host plan');const data=plans.get(plan),{root}=data;const lock=path.join(root,'content/.package-install.lock');let handle,temp,configTemp,journal,rollbackInfrastructure,configChanged=false,committed=false;
  const legacyBudget=packageBudget(createPackageBudget(data.installationContext),data.installationContext);
  if(!data.hostConfig){
    const receipt=freeze(installationReceipt(plan,data,data.revision));
    const state={schema:'wydgit-installed/0.1',revision:data.revision,baseFingerprint:plan.baseFingerprint,app:data.app,packages:[...data.previous,{...data.entry,receipt}],...(data.retained.length?{retained:data.retained}:{})};
    let hookError;
    try{await publishPackageState({root,plan:{...plan,action:'install',changes:[{package:plan.package,action:'install'}]},state,budget:legacyBudget,atStage:async stage=>{
      try{if(stage==='APPLYING'){await beforeReplace?.();await beforeStateReplace?.();}}catch(error){hookError=error;throw error;}
    }});}catch(error){if(hookError&&error.code==='PACKAGE.STORAGE')throw hookError;throw error;}
    plans.delete(plan);return receipt;
  }
  const configPath=path.join(root,'wydgit.config.json'),journalPath=path.join(root,'content/.package-infrastructure.json');
  let configBefore;
  check(!data.hostConfig||typeof prepareInfrastructure==='function','PACKAGE.INFRASTRUCTURE','Host config apply requires trusted infrastructure preparation');
  try {legacyBudget.take();handle=await fs.open(lock,'wx',0o600);
    await handle.writeFile(JSON.stringify({schema:'wydgit.package-lock/1',id:randomUUID(),pid:process.pid,type:'infrastructure'}));await handle.sync();await syncPackageDirectory(root);
    const current=()=>check(baseFingerprint(root)===plan.baseFingerprint&&stateFingerprint(root)===plan.catalogFingerprint,'PACKAGE.STALE','App/catalog/config changed; plan again');current();
    const acceptedBase=data.hostConfig?baseFingerprint(root,data.hostConfig):plan.baseFingerprint;
    const receipt=freeze({schema:'wydgit-install-receipt/0.1',id:randomUUID(),package:plan.package,version:plan.version,publisher:plan.publisher,installedAt:new Date().toISOString(),revision:data.revision,instance:plan.instance,instanceIds:plan.instanceIds,installable:plan.installable,placement:plan.placement,resources:plan.resources,libraries:plan.libraries,approved:plan.approved,storageMappings:plan.storageMappings,bindings:plan.bindings,reason:data.entry.reason,protected:data.entry.protected,dependencies:data.entry.manifest.dependencies??{},previousCatalog:plan.catalogFingerprint,baseFingerprint:acceptedBase,...Object.fromEntries(['additions','page','navigation','properties','libraryScopes','compiledSources'].filter(key=>Object.hasOwn(plan,key)).map(key=>[key,plan[key]]))});
    const state={schema:'wydgit-installed/0.1',...(data.retained.length?{retained:data.retained}:{}),revision:data.revision,baseFingerprint:acceptedBase,app:data.app,packages:[...data.previous,{...data.entry,receipt}]};const text=JSON.stringify(state,null,2)+'\n';check(Buffer.byteLength(text)<=LIMITS.state,'PACKAGE.LIMIT','Installed state too large');
    temp=path.join(root,'content',`.package-${randomUUID()}.tmp`);const file=await fs.open(temp,'wx',0o600);try{await file.writeFile(text);await file.sync();}finally{await file.close();}
    if(beforeReplace)await beforeReplace();current();legacyBudget.take();
    if(data.hostConfig){
      configBefore=await fs.readFile(configPath,'utf8');
      configTemp=path.join(root,`.host-${randomUUID()}.tmp`);
      const file=await fs.open(configTemp,'wx',0o600);try{await file.writeFile(data.hostConfig);await file.sync();}finally{await file.close();}
      const backup={config:configBefore,state:plan.catalogFingerprint?await fs.readFile(path.join(root,STATE),'utf8'):null};
      journal=await fs.open(journalPath,'wx',0o600);try{await journal.writeFile(JSON.stringify(backup));await journal.sync();}finally{await journal.close();}await syncPackageDirectory(root);
      if(prepareInfrastructure)rollbackInfrastructure=await prepareInfrastructure();
      legacyBudget.take();current();if(beforeConfigReplace)await beforeConfigReplace();current();
      await fs.rename(configTemp,configPath);configTemp=null;configChanged=true;const directory=await fs.open(root,'r');try{await directory.sync();}finally{await directory.close();}
    }
    if(beforeStateReplace)await beforeStateReplace();legacyBudget.take();
    check(baseFingerprint(root)===acceptedBase&&stateFingerprint(root)===plan.catalogFingerprint,'PACKAGE.STALE','State changed before publication');
    await fs.rename(temp,path.join(root,STATE));temp=null;committed=true;await syncPackageDirectory(root);
    if(journal){await fs.unlink(journalPath);journal=null;}plans.delete(plan);return receipt;
  } catch(error){
    if(!committed){
      if(configChanged){const restore=path.join(root,`.restore-${randomUUID()}.tmp`);await fs.writeFile(restore,configBefore,{mode:0o600});await fs.rename(restore,configPath);}
      if(rollbackInfrastructure)await rollbackInfrastructure();
      if(journal){await fs.unlink(journalPath);journal=null;}
    }
    check(handle||error.code!=='EEXIST','PACKAGE.BUSY','Another installation holds the lock; inspect interrupted state before retrying');
    throw error;
  } finally {if(configTemp)await fs.unlink(configTemp).catch(()=>{});if(temp)await fs.unlink(temp).catch(()=>{});if(handle){await handle.close();await fs.unlink(lock);}}
}
export async function installPackage(options) {return applyPackageInstall(await planPackageInstall(options));}

const operationPlans=new WeakMap();
function installationReceipt(plan,data,revision) {
  return {schema:'wydgit-install-receipt/0.1',id:randomUUID(),package:plan.package,version:plan.version,publisher:plan.publisher,
    installedAt:new Date().toISOString(),revision,instance:plan.instance,instanceIds:plan.instanceIds,installable:plan.installable,
    placement:plan.placement,resources:plan.resources,libraries:plan.libraries,approved:plan.approved,storageMappings:plan.storageMappings,
    bindings:plan.bindings,previousCatalog:plan.catalogFingerprint,baseFingerprint:plan.baseFingerprint,
    dependencies:data.entry.manifest.dependencies??{},reason:data.entry.reason,protected:data.entry.protected,
    ...Object.fromEntries(['additions','page','navigation','properties','libraryScopes','compiledSources'].filter(key=>Object.hasOwn(plan,key)).map(key=>[key,plan[key]]))};
}
function detachPackage(root,state,entry,context,verifiedPackages) {
  let model=repositoryFromState(root,state,{verifiedPackages}),runtime=model.runtime;
  const attachments=[];
  for(const item of [{placement:entry.placement,id:entry.instance},...(entry.additions??[]).map(a=>({placement:a.placement,id:JSON.parse(a.instance).id}))]){
    const instance=dehydrate(runtime,{includeSensitive:true});let found;
    const visit=node=>{if(node.id===item.id)found=node;Object.values(node.slots).flat().forEach(visit);};visit(instance);
    check(found,'PACKAGE.OWNERSHIP','Installed attachment is missing');
    // The ordinary edit API requires grants for every descendant, parent and sibling.
    // A foreign installed attachment inside this subtree can never be removed.
    const ids=idsOf(found);
    check(!state.packages.some(p=>p!==entry&&p.instanceIds.some(id=>ids.includes(id))),'PACKAGE.OWNERSHIP','Subtree contains another package installation');
    attachments.push({placement:entry.placement===item.placement?clean(entry.placement):clean(item.placement),instance:JSON.stringify(found)});
    const edit=runtime.edit(context);edit.remove(item.id);runtime=edit.commit().runtime;
  }
  let navigationRemoved=false;
  if(entry.navigation){
    const node=runtime.get(entry.navigation.id),expected={label:entry.navigation.label,page:entry.placement.page};
    const matches=node.properties.items.map((item,i)=>equal(item,expected)?i:-1).filter(i=>i>=0);
    if(matches.length===1){const items=clean(node.properties.items);items.splice(matches[0],1);const edit=runtime.edit(context);edit.setProperty(node.id,'items',items);runtime=edit.commit().runtime;navigationRemoved=true;}
  }
  return {app:JSON.stringify(dehydrate(runtime,{includeSensitive:true})),retained:{entry,attachments,navigationRemoved}};
}
function validateCandidateState(root,state,verifiedPackages) {
  validateInstalledState(root,state);
  const model=repositoryFromState(root,state,{verifiedPackages});
  const config=validateConfig(safeRead(root,'wydgit.config.json')),pages=new Map(),allIds=idsOf(dehydrate(model.runtime));
  for(const entry of state.packages){
    check(equal([...idsOf(JSON.parse(entry.resources[entry.manifest.resources.template])),...(entry.additions??[]).flatMap(a=>idsOf(JSON.parse(a.instance)))],entry.instanceIds),'PACKAGE.CATALOG','Installed instance metadata drift');
    approve(entry.manifest,entry.approved,entry.instanceIds,allIds);
    const storage=mapStorage(entry.manifest,config,entry.storageMappings,model.runtime.rootId);
    check(equal(storage.scopes,entry.storageScopes),'PACKAGE.CATALOG','Catalog storage scope drift');
    for(const attachment of [{placement:entry.placement,id:entry.instance},...(entry.additions??[]).map(a=>({placement:a.placement,id:JSON.parse(a.instance).id}))]){
      const p=attachment.placement;
      check(model.registry.isA(model.runtime.get(p.page).prototype,'wydgit.core/page')&&model.runtime.get(p.parent).slots[p.slot]?.[p.index]===attachment.id,'PACKAGE.CATALOG','Installed placement drift');
      check(!pages.has(p.page)||pages.get(p.page)===entry,'PACKAGE.PRINCIPALS','Multiple package principals on Page');pages.set(p.page,entry);
    }
    packageBindings(entry,model.registry,model.runtime);
  }
  return model;
}

// Trusted, stopped-App API. Candidate paths, grants, contexts and protection are
// operator policy, never package input. There are no executable lifecycle hooks.
export async function planPackageOperation({root,action,package:id,candidates=[],installationContext,budget:token,signal,parentBudget,prune=true,protectedPackages=[],verifiedPackages={}}) {
  root=path.resolve(root);
  check(['install','update','upgrade','uninstall','promote','purge'].includes(action),'PACKAGE.ACTION','Unsupported lifecycle action');
  check(qualified(id),'PACKAGE.IDENTITY','Invalid package identity');
  check(token===undefined||signal===undefined&&parentBudget===undefined,'PACKAGE.BUDGET','Attach cancellation and parent accounting when creating the shared budget');
  const accepted=readInstalledState(root),initial=loadRepository(root,{verifiedPackages});
  authorizeLifecycle(installationContext,initial.runtime.rootId);
  check(Array.isArray(candidates)&&candidates.length<=LIMITS.packages&&Array.isArray(protectedPackages)&&protectedPackages.length<=LIMITS.packages&&protectedPackages.every(id=>typeof id==='string'&&/^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(id)),'PACKAGE.LIMIT','Lifecycle inventory ceiling');
  token??=createPackageBudget(installationContext,{signal,parentBudget});const meter=packageBudget(token,installationContext);meter.take();
  const base=baseFingerprint(root),head=stateFingerprint(root),state=clean(accepted??{schema:'wydgit-installed/0.1',revision:0,baseFingerprint:base,app:JSON.stringify(dehydrate(initial.runtime,{includeSensitive:true})),packages:[]});
  state.retained??=[];const changes=[],warnings=[],installations=[],retention=[],inventory=new Map();
  for(const options of candidates){meter.take();check(!options.hostConfig,'PACKAGE.INFRASTRUCTURE','Provision libraries separately before lifecycle operations');const candidate=loadPackage(options.packagePath);check(!inventory.has(candidate.manifest.id),'PACKAGE.CONFLICT','Duplicate candidate identity');inventory.set(candidate.manifest.id,{options,candidate});}
  const original=state.packages.find(p=>p.manifest.id===id);
  const remove=packageId=>{
    meter.take();const entry=state.packages.find(p=>p.manifest.id===packageId);
    check(!protectedPackage(entry),'PACKAGE.PROTECTED','Protected package cannot be removed');
    const detached=detachPackage(root,state,entry,installationContext,verifiedPackages);state.app=detached.app;
    if(entry.navigation&&!detached.retained.navigationRemoved)warnings.push({package:packageId,code:'PACKAGE.CUSTOMIZED_NAVIGATION',retained:true});
    retention.push({package:packageId,instanceIds:entry.instanceIds,storageMappings:entry.storageMappings,data:'retained'});
    state.packages=state.packages.filter(p=>p!==entry);state.retained.push(detached.retained);changes.push({package:packageId,action:'uninstall',data:'retained'});
  };
  if(action==='uninstall'){
    for(const packageId of removalOrder(state.packages,id,{prune}))remove(packageId);
  }else if(action==='purge'){
    check(!original,'PACKAGE.INSTALLED','Uninstall retaining data before authorizing purge');
    const retained=state.retained.find(r=>r.entry.manifest.id===id);check(retained,'PACKAGE.NOT_RETAINED','No retained package');
    check(!protectedPackage(retained.entry),'PACKAGE.PROTECTED','Protected package cannot be purged');
    // No raw filesystem/SQL deletion: adapters currently lack a safe package-purge
    // contract. Do not report success while leaving authoritative data behind.
    check(retained.entry.manifest.storage.length===0&&Object.keys(retained.entry.libraryScopes??{}).length===0,'PACKAGE.PURGE_UNSUPPORTED','Physical data purge requires a trusted adapter ownership/backup contract');
    const owned=new Set(retained.entry.instanceIds);
    check(retained.attachments.every(a=>idsOf(JSON.parse(a.instance)).every(node=>owned.has(node))),'PACKAGE.OWNERSHIP','Retained subtree contains site-owned additions; preserve and reconcile explicitly');
    state.retained=state.retained.filter(r=>r!==retained);changes.push({package:id,action:'purge',data:'authorized-retained-instances'});
  }else if(action==='promote'){
    check(original,'PACKAGE.NOT_INSTALLED','Package is not installed');
    if(original.reason==='automatic'){original.reason='explicit';original.receipt.reason='explicit';changes.push({package:id,action:'promote'});}
  }else{
    check(inventory.has(id),'PACKAGE.DEPENDENCY','Supply the requested package candidate');
    if(action!=='install')check(original,'PACKAGE.NOT_INSTALLED','Update requires an installed package');
    const visiting=new Set(),selected=new Map(),ordered=[];
    const resolve=packageId=>{
      meter.take();check(!visiting.has(packageId),'PACKAGE.CYCLE','Circular package dependencies');if(selected.has(packageId))return;
      const item=inventory.get(packageId);check(item,'PACKAGE.DEPENDENCY','Supply an explicitly approved dependency candidate');
      visiting.add(packageId);selected.set(packageId,item);
      for(const [dependency,range] of Object.entries(item.candidate.manifest.dependencies??{})){
        const existing=state.packages.find(p=>p.manifest.id===dependency);
        if(existing&&semver.satisfies(existing.manifest.version,range,{includePrerelease:true}))continue;
        const candidate=inventory.get(dependency);check(candidate&&semver.satisfies(candidate.candidate.manifest.version,range,{includePrerelease:true}),'PACKAGE.CONFLICT','Missing or incompatible approved dependency');resolve(dependency);
      }
      visiting.delete(packageId);ordered.push(packageId);
    };
    resolve(id);
    const proposed=state.packages.filter(p=>!selected.has(p.manifest.id)).concat([...selected].map(([,item])=>({manifest:item.candidate.manifest})));
    packageGraph(proposed); // Reverse dependents veto incompatible shared upgrades.
    for(const packageId of ordered){
      meter.take();const {options,candidate}=selected.get(packageId),old=state.packages.find(p=>p.manifest.id===packageId),retained=state.retained.find(r=>r.entry.manifest.id===packageId),prior=old??retained?.entry;
      const sameVersion=old&&old.manifest.version===candidate.manifest.version;
      const compiled=old&&(old.compiledSources||JSON.parse(old.resources[old.manifest.resources.prototypes]).some(d=>d.interface));
      if(sameVersion&&!compiled){
        check(equal(old.manifest,candidate.manifest)&&equal(old.resources,candidate.resources),'PACKAGE.VERSION','Same-version package resources changed');
        if(action==='install'&&packageId===id&&old.reason==='automatic'){old.reason='explicit';old.receipt.reason='explicit';changes.push({package:packageId,action:'promote'});}continue;
      }
      if(old&&packageId===id&&!sameVersion)check(action!=='install','PACKAGE.ALREADY_INSTALLED','Use update or upgrade for an installed package');
      if(prior){
        const major=!semver.satisfies(candidate.manifest.version,'^'+prior.manifest.version,{includePrerelease:true});
        check(sameVersion||semver.gt(candidate.manifest.version,prior.manifest.version)||retained&&candidate.manifest.version===prior.manifest.version,'PACKAGE.VERSION','Downgrades are unsupported');
        check(!major||action==='upgrade','PACKAGE.UPGRADE_REQUIRED','Major version change requires an explicit upgrade');
        check(equal(prior.manifest.storage,candidate.manifest.storage),'PACKAGE.MIGRATION_REQUIRED','Storage schema changes require a qualified migration contract');
      }
      const preserved=state.app;
      let saved=retained;
      if(old){const detached=detachPackage(root,state,old,installationContext,verifiedPackages);saved=detached.retained;state.app=detached.app;state.packages=state.packages.filter(p=>p!==old);}
      state.retained=state.retained.filter(r=>r!==retained);
      const previousOptions=prior?{placement:prior.placement,storageMappings:prior.storageMappings,
        ...(prior.additions?{additions:prior.additions.map(a=>({placement:a.placement,instance:JSON.parse(a.instance)}))}:{}),
        ...(prior.navigation&&saved.navigationRemoved?{navigation:prior.navigation}:{}),properties:prior.properties??{}}:{};
      // Created Pages remain App-owned across uninstall and are reused on reinstall.
      const subplan=await planInstall({...options,...previousOptions,page:prior?undefined:options.page,root,installationContext,verifiedPackages},state),data=plans.get(subplan);plans.delete(subplan);
      check(equal(candidate.manifest,data.entry.manifest),'PACKAGE.STALE','Candidate manifest changed during dependency planning');
      installations.push(subplan);
      if(prior){
        check(equal(prior.instanceIds,data.entry.instanceIds)&&prior.instance===data.entry.instance&&equal(prior.placement,data.entry.placement),'PACKAGE.MIGRATION_REQUIRED','Changed instance footprint requires explicit migration');
        if(prior.page){data.entry.page=prior.page;}
        if(prior.navigation){data.entry.navigation=prior.navigation;}
      }
      if(prior&&prior.manifest.version===data.entry.manifest.version)check(equal(prior.manifest,data.entry.manifest)&&equal(prior.resources,data.entry.resources)&&equal(prior.compiledSources??null,data.entry.compiledSources??null),'PACKAGE.VERSION','Same-version package resources changed');
      data.entry.reason=prior?(action==='install'&&packageId===id?'explicit':prior.reason??'explicit'):(packageId===id?'explicit':'automatic');
      data.entry.protected=prior?.protected??protectedPackages.includes(packageId);
      const receiptPlan={...subplan,...Object.fromEntries(['page','navigation'].filter(key=>Object.hasOwn(data.entry,key)).map(key=>[key,data.entry[key]]))};
      data.entry.receipt=sameVersion?{...old.receipt,reason:data.entry.reason,protected:data.entry.protected,dependencies:data.entry.manifest.dependencies??{}}:installationReceipt(receiptPlan,data,state.revision+1);
      state.packages.push(data.entry);state.app=data.app;
      if(old)state.app=preserved;
      else if(retained){
        // Replace newly provisioned defaults with the preserved App-owned trees.
        const app=JSON.parse(state.app),snapshots=new Map(retained.attachments.map(a=>[JSON.parse(a.instance).id,JSON.parse(a.instance)]));
        const restore=node=>{for(const children of Object.values(node.slots))for(let i=0;i<children.length;i++){if(snapshots.has(children[i].id))children[i]=snapshots.get(children[i].id);else restore(children[i]);}};restore(app);state.app=JSON.stringify(app);
      }
      const model=repositoryFromState(root,state,{verifiedPackages});state.app=JSON.stringify(dehydrate(model.runtime,{includeSensitive:true}));
      packageBindings(data.entry,model.registry,model.runtime);
      if(!sameVersion)changes.push({package:packageId,action:old?'update':retained?'reinstall':'install',version:candidate.manifest.version,reason:data.entry.reason});
    }
    // A removed dependency can recursively orphan its automatic dependency chain.
    if(original&&prune){
      for(const dependency of Object.keys(original.manifest.dependencies??{})){
        const graph=packageGraph(state.packages),entry=graph.nodes.get(dependency);
        if(entry?.reason==='automatic'&&!protectedPackage(entry)&&graph.reverse.get(dependency).length===0)for(const orphan of removalOrder(state.packages,dependency))remove(orphan);
      }
    }
  }
  state.revision=(accepted?.revision??0)+1;check(Number.isSafeInteger(state.revision),'PACKAGE.LIMIT','Catalog revision exhausted');
  validateCandidateState(root,state,verifiedPackages);check(Buffer.byteLength(JSON.stringify(state,null,2)+'\n')<=LIMITS.state,'PACKAGE.LIMIT','Installed state too large');meter.take();
  check(base===baseFingerprint(root)&&head===stateFingerprint(root),'PACKAGE.STALE','State changed during lifecycle planning');
  const graphSummary=packages=>packages.map(p=>({package:p.manifest.id,version:p.manifest.version,dependencies:p.manifest.dependencies??{},reason:p.reason??'explicit',protected:protectedPackage(p)}));
  const plan=freeze({schema:'wydgit.package-operation-plan/1',action,package:id,changes,warnings,installations,retention,beforeGraph:graphSummary(accepted?.packages??[]),afterGraph:graphSummary(state.packages),baseFingerprint:base,catalogFingerprint:head,revision:state.revision,dataRetention:'preserve-unless-explicit-purge',meter:meter.snapshot()});
  operationPlans.set(plan,{root,state,meter});return plan;
}
export async function applyPackageOperation(plan,options={}){
  check(operationPlans.has(plan),'PACKAGE.PLAN','Expected an original host lifecycle plan');const data=operationPlans.get(plan);
  // Consume before apply: even an ambiguous storage error cannot replay this plan.
  operationPlans.delete(plan);return publishPackageState({...data,plan,budget:data.meter,atStage:options.atStage});
}
export async function packageOperation(options){return applyPackageOperation(await planPackageOperation(options));}

export function activatePackages(model,libraries,root) {
  const config=validateConfig(safeRead(root,'wydgit.config.json'));
  const entries=model.installed?.packages??[],pages=new Map(),handlers=[],actions=[];
  for(const entry of entries){check(!pages.has(entry.placement.page),'PACKAGE.PRINCIPALS','Multiple package principals on Page');
    const template=JSON.parse(entry.resources[entry.manifest.resources.template]);
    check(equal([...idsOf(template),...(entry.additions??[]).flatMap(item=>idsOf(JSON.parse(item.instance)))],entry.instanceIds)&&entry.instance===template.id,'PACKAGE.CATALOG','Installed instance metadata drift');
    const page=model.runtime.get(entry.placement.page),parent=model.runtime.get(entry.placement.parent);
    check(model.registry.isA(page.prototype,'wydgit.core/page')&&parent.slots[entry.placement.slot]?.[entry.placement.index]===entry.instance,'PACKAGE.CATALOG','Installed placement drift');
    approve(entry.manifest,entry.approved,entry.instanceIds,idsOf(dehydrate(model.runtime)));
    const declared=JSON.parse(entry.resources[entry.manifest.resources.prototypes]).map(d=>d.id);
    for(const item of entry.additions??[]){const p=item.placement,instance=copyEnvelope(JSON.parse(item.instance));check(model.registry.isA(model.runtime.get(p.page).prototype,'wydgit.core/page'),'PACKAGE.CATALOG','Invalid attachment Page');const descendants=[];const walk=id=>{descendants.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(p.page);check(descendants.includes(p.parent)&&model.runtime.get(p.parent).slots[p.slot]?.[p.index]===instance.id,'PACKAGE.CATALOG','Attachment placement drift');for(const id of idsOf(instance))check(declared.includes(model.runtime.get(id).prototype),'PACKAGE.CATALOG','Attachment prototype drift');check(!pages.has(p.page)||pages.get(p.page)===entry,'PACKAGE.PRINCIPALS','Multiple package principals on Page');pages.set(p.page,entry);}
    const libraryScopes=Object.fromEntries(Object.entries(entry.manifest.permissions.scopes).filter(([id])=>!['wydstore','prototypes','events'].includes(id)).map(([id,scopes])=>[id,libraries.resolvePackageScopes(id,scopes,model.runtime.rootId)]));check(equal(libraryScopes,entry.libraryScopes??{}),'PACKAGE.CATALOG','Library scope drift');
    const storage=mapStorage(entry.manifest,config,entry.storageMappings,model.runtime.rootId);check(equal(storage.scopes,entry.storageScopes),'PACKAGE.CATALOG','Catalog storage scope drift');
    libraries.resolve(entry.manifest.requires);
    check(entry.libraries.every(mapping=>libraries.get(mapping.id).version===mapping.version&&config.libraries.find(item=>item.id===mapping.id)?.package===mapping.package),'PACKAGE.LIBRARY','Approved library mapping changed');
    const bound=packageBindings(entry,model.registry,model.runtime);handlers.push(...bound.handlers);actions.push(...bound.actions);pages.set(entry.placement.page,entry);
  }
  return {handlers,actions,pages,context({pageId,session,ids}){const entry=pages.get(pageId);if(!entry)return new ExecutionContext({publisher:'wydgit.core',app:model.runtime.rootId,self:pageId,visible:ids,identity:session.identity??null});
    const grant=entry.approved;return new ExecutionContext({publisher:entry.manifest.publisher,package:entry.manifest.id,installation:entry.receipt.id??null,template:entry.installable,principal:entry.manifest.id,app:model.runtime.rootId,self:pageId,identity:session.identity??null,capabilities:grant.capabilities,traversal:grant.traversal,visible:grant.visible,editable:grant.editable,scopes:{...grant.scopes,wydstore:entry.storageScopes,...(entry.libraryScopes??{})}});
  }};
}
