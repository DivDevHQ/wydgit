import {interfaceTypes} from '../object-model/interfaces.js';
import {validate as validateWorkflow} from '../sewn/validate.js';
import {StaticLibraryRegistry} from '../static-libraries/index.js';
import fs from 'node:fs/promises';
import { lstatSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadRepository, compileDefinitions } from '../repository.js';
import { hydrate, dehydrate, PrototypeRegistry } from '../object-model/index.js';
import { clean, freeze, jsonKeys, requireThat as check } from '../object-model/validation.js';
import { validateEnvelope } from '../object-model/schema.js';
import { ExecutionContext, checkContext, matchesObjectGrant } from '../seam/context.js';
import { EventRegistry, prepareHandlers, prepareAction } from '../events/index.js';
import { compileModule } from '../wydbasic/index.js';
import { validateConfig, validateManifest as libraryManifest, satisfies, fields } from '../libraries/contracts.js';
import { importNodePackage } from '../libraries/node-package.js';
import platform from '../../package.json' with { type: 'json' };
import { validatePackageManifest, LIMITS, permissions } from './manifest.js';
import { STATE, readInstalledState, safeRead, baseFingerprint, stateFingerprint, digest } from './state.js';
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
  const directory=packageDirectory(packagePath),manifest=validatePackageManifest(safeRead(directory,'manifest.json',LIMITS.manifest));
  const resources={};for(const file of [manifest.resources.prototypes,manifest.resources.template,...Object.values(manifest.resources.sources)])resources[file]=safeRead(directory,file);
  const definitions=JSON.parse(resources[manifest.resources.prototypes]);check(Array.isArray(definitions)&&definitions.length<=LIMITS.prototypes,'PACKAGE.LIMIT','Too many prototypes');
  check(definitions.every(d=>d.publisher===manifest.publisher&&d.id?.startsWith(manifest.publisher+'/')),'PACKAGE.NAMESPACE','Prototype namespace differs from package');
  const template=JSON.parse(resources[manifest.resources.template]);let count=0;const walk=(n,d=0)=>{check(d<=LIMITS.templateDepth&&++count<=LIMITS.templateNodes,'PACKAGE.LIMIT','Template too large');check(n&&n.slots&&typeof n.slots==='object','PACKAGE.TEMPLATE','Invalid template');for(const children of Object.values(n.slots)){check(Array.isArray(children),'PACKAGE.TEMPLATE','Invalid children');children.forEach(c=>walk(c,d+1));}};walk(template);
  return {manifest,resources,definitions,template};
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
  const config=validateConfig(hostConfig??safeRead(root,'wydgit.config.json')),resolved=[],scopeResolvers=new Map(),available=new Set(['object.instances.edit','object.instances.construct','app.forms.submit']);
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
export async function planPackageInstall({root,packagePath,placement,approvals,storageMappings={},installationContext,hostConfig,verifiedPackages={},additions=[],page,properties={},navigation,staticLibraries}) {
  root=path.resolve(root);
  check((readInstalledState(root)?.packages.length??0)<LIMITS.packages,'PACKAGE.LIMIT','Installed package safety ceiling reached');
  const base=baseFingerprint(root),head=stateFingerprint(root);const model=loadRepository(root,{verifiedPackages}),candidate=loadPackage(packagePath),{manifest,resources,definitions,template}=candidate;
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
  const approved=approve(manifest,approvals,instanceIds,idsOf(dehydrate(model.runtime))),{config,resolved,available,scopeResolvers}=await resolveLibraries(root,manifest,hostConfig),storage=mapStorage(manifest,config,storageMappings,model.runtime.rootId);
  const libraryScopes=Object.fromEntries(Object.entries(manifest.permissions.scopes).filter(([id])=>!['wydstore','prototypes'].includes(id)).map(([id,scopes])=>{check(scopeResolvers.has(id),'PACKAGE.STORAGE','Scope provider must be required');let grants;try{grants=clean(scopeResolvers.get(id)({app:model.runtime.rootId,scopes}));}catch{check(false,'PACKAGE.STORAGE','Library scope approval failed');}check(Array.isArray(grants)&&grants.length<=16,'PACKAGE.STORAGE','Invalid library grants');return [id,grants];}));
  check(approved.capabilities.every(cap=>available.has(cap)),'PACKAGE.DENIED','Requested capability has no required provider');
  checkContext(installationContext);check(installationContext.app===model.runtime.rootId,'PACKAGE.DENIED','Wrong installation App');
  let runtime=hydrate(dehydrate(model.runtime,{includeSensitive:true}),registry,{revision:model.installed?.revision??0});
  if(createdPage){const edit=runtime.edit(installationContext);edit.insertChild(runtime.rootId,'pages',runtime.get(runtime.rootId).slots.pages.length,createdPage);runtime=edit.commit().runtime;}
  const edit=runtime.edit(installationContext);edit.insertChild(placement.parent,placement.slot,placement.index,configuredTemplate);runtime=edit.commit().runtime;
  for(const item of extra){const p=item.placement;check(registry.isA(runtime.get(p.page).prototype,'wydgit.core/page'),'PACKAGE.PLACEMENT','Attachment destination must be Page');const ids=[];const walk=id=>{ids.push(id);Object.values(runtime.get(id).slots).flat().forEach(walk);};walk(p.page);check(ids.includes(p.parent),'PACKAGE.PLACEMENT','Attachment parent outside Page');check(!(model.installed?.packages??[]).some(entry=>[entry.placement.page,...(entry.additions??[]).map(x=>x.placement.page)].includes(p.page)),'PACKAGE.PRINCIPALS','One package principal per Page');const edit=runtime.edit(installationContext);edit.insertChild(p.parent,p.slot,p.index,item.instance);runtime=edit.commit().runtime;}
  for(const item of [{placement,instance:configuredTemplate},...extra])check(runtime.get(item.placement.parent).slots[item.placement.slot]?.[item.placement.index]===item.instance.id,'PACKAGE.PLACEMENT','Attachments must preserve each approved position');
  if(navigation){fields(navigation,['id','label'],'PACKAGE.PLACEMENT');check(typeof navigation.label==='string'&&navigation.label.length<=128&&runtime.get(runtime.rootId).slots.navigation.includes(navigation.id),'PACKAGE.PLACEMENT','Choose existing App navigation');const node=runtime.get(navigation.id);check(registry.isA(node.prototype,'wydgit.core/navigation'),'PACKAGE.PLACEMENT','Expected navigation');const edit=runtime.edit(installationContext);edit.setProperty(navigation.id,'items',[...node.properties.items,{label:navigation.label,page:placement.page}]);runtime=edit.commit().runtime;}
  const result={runtime,revision:runtime.revision};
  const compiledSources=manifest.staticLibraries||manifest.interfaces?Object.fromEntries(Object.entries(manifest.resources.sources).map(([id,file])=>[id,compileModule(resources[file],staticOptions)])):null;
  const extensions={...(compiledSources?{compiledSources}:{}),...(extra.length?{additions:extra.map(item=>({placement:item.placement,instance:JSON.stringify(item.instance)}))}:{}),...(createdPage?{page:JSON.stringify(createdPage)}:{}),...(navigation?{navigation:clean(navigation)}:{}),...(Object.keys(properties).length?{properties:clean(properties)}:{}),...(Object.keys(libraryScopes).length?{libraryScopes}: {})};
  const entry={state:'installed',manifest,resources,approved,storageMappings:storage.mappings,storageScopes:storage.scopes,libraries:resolved,instanceIds,instance:template.id,installable:manifest.installables[0].id,placement:clean(placement),...extensions};
  packageBindings(entry,registry,result.runtime);
  const plan=freeze({schema:'wydgit-install-plan/0.1',package:manifest.id,version:manifest.version,publisher:manifest.publisher,placement:clean(placement),instance:template.id,instanceIds,installable:entry.installable,prototypes:definitions.map(d=>d.id),resources:Object.fromEntries(Object.entries(resources).map(([file,text])=>[file,{bytes:Buffer.byteLength(text),sha256:digest(text)}])),libraries:resolved,requested:manifest.permissions,approved,storageMappings:storage.mappings,bindings:manifest.bindings,baseFingerprint:base,catalogFingerprint:head,...extensions});
  check(base===baseFingerprint(root)&&head===stateFingerprint(root),'PACKAGE.STALE','State changed during planning');
  if(hostConfig)check(Buffer.byteLength(JSON.stringify(validateConfig(hostConfig),null,2)+'\n')<=LIMITS.resource,'PACKAGE.LIMIT','Prospective host config too large');
  plans.set(plan,{root,hostConfig:hostConfig?JSON.stringify(validateConfig(hostConfig),null,2)+'\n':null,entry,app:JSON.stringify(dehydrate(result.runtime,{includeSensitive:true})),revision:result.revision,previous:model.installed?.packages??[]});return plan;
}
export async function applyPackageInstall(plan,{beforeReplace,prepareInfrastructure,beforeConfigReplace,beforeStateReplace}={}) {
  check(plans.has(plan),'PACKAGE.PLAN','Expected an original host plan');const data=plans.get(plan),{root}=data;const lock=path.join(root,'content/.package-install.lock');let handle,temp,configTemp,journal,rollbackInfrastructure,configChanged=false,committed=false;
  const configPath=path.join(root,'wydgit.config.json'),journalPath=path.join(root,'content/.package-infrastructure.json');
  let configBefore;
  check(!data.hostConfig||typeof prepareInfrastructure==='function','PACKAGE.INFRASTRUCTURE','Host config apply requires trusted infrastructure preparation');
  try {handle=await fs.open(lock,'wx',0o600);
    const current=()=>check(baseFingerprint(root)===plan.baseFingerprint&&stateFingerprint(root)===plan.catalogFingerprint,'PACKAGE.STALE','App/catalog/config changed; plan again');current();
    const acceptedBase=data.hostConfig?baseFingerprint(root,data.hostConfig):plan.baseFingerprint;
    const receipt=freeze({schema:'wydgit-install-receipt/0.1',id:randomUUID(),package:plan.package,version:plan.version,publisher:plan.publisher,installedAt:new Date().toISOString(),revision:data.revision,instance:plan.instance,instanceIds:plan.instanceIds,installable:plan.installable,placement:plan.placement,resources:plan.resources,libraries:plan.libraries,approved:plan.approved,storageMappings:plan.storageMappings,bindings:plan.bindings,previousCatalog:plan.catalogFingerprint,baseFingerprint:acceptedBase,...Object.fromEntries(['additions','page','navigation','properties','libraryScopes','compiledSources'].filter(key=>Object.hasOwn(plan,key)).map(key=>[key,plan[key]]))});
    const state={schema:'wydgit-installed/0.1',revision:data.revision,baseFingerprint:acceptedBase,app:data.app,packages:[...data.previous,{...data.entry,receipt}]};const text=JSON.stringify(state,null,2)+'\n';check(Buffer.byteLength(text)<=LIMITS.state,'PACKAGE.LIMIT','Installed state too large');
    temp=path.join(root,'content',`.package-${randomUUID()}.tmp`);const file=await fs.open(temp,'wx',0o600);try{await file.writeFile(text);await file.sync();}finally{await file.close();}
    if(beforeReplace)await beforeReplace();current();
    if(data.hostConfig){
      configBefore=await fs.readFile(configPath,'utf8');
      configTemp=path.join(root,`.host-${randomUUID()}.tmp`);
      const file=await fs.open(configTemp,'wx',0o600);try{await file.writeFile(data.hostConfig);await file.sync();}finally{await file.close();}
      const backup={config:configBefore,state:plan.catalogFingerprint?await fs.readFile(path.join(root,STATE),'utf8'):null};
      journal=await fs.open(journalPath,'wx',0o600);try{await journal.writeFile(JSON.stringify(backup));await journal.sync();}finally{await journal.close();}
      if(prepareInfrastructure)rollbackInfrastructure=await prepareInfrastructure();
      current();if(beforeConfigReplace)await beforeConfigReplace();current();
      await fs.rename(configTemp,configPath);configTemp=null;configChanged=true;
    }
    if(beforeStateReplace)await beforeStateReplace();
    check(baseFingerprint(root)===acceptedBase&&stateFingerprint(root)===plan.catalogFingerprint,'PACKAGE.STALE','State changed before publication');
    await fs.rename(temp,path.join(root,STATE));temp=null;committed=true;
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
    const libraryScopes=Object.fromEntries(Object.entries(entry.manifest.permissions.scopes).filter(([id])=>!['wydstore','prototypes'].includes(id)).map(([id,scopes])=>[id,libraries.resolvePackageScopes(id,scopes,model.runtime.rootId)]));check(equal(libraryScopes,entry.libraryScopes??{}),'PACKAGE.CATALOG','Library scope drift');
    const storage=mapStorage(entry.manifest,config,entry.storageMappings,model.runtime.rootId);check(equal(storage.scopes,entry.storageScopes),'PACKAGE.CATALOG','Catalog storage scope drift');
    libraries.resolve(entry.manifest.requires);
    check(entry.libraries.every(mapping=>libraries.get(mapping.id).version===mapping.version&&config.libraries.find(item=>item.id===mapping.id)?.package===mapping.package),'PACKAGE.LIBRARY','Approved library mapping changed');
    const bound=packageBindings(entry,model.registry,model.runtime);handlers.push(...bound.handlers);actions.push(...bound.actions);pages.set(entry.placement.page,entry);
  }
  return {handlers,actions,pages,context({pageId,session,ids}){const entry=pages.get(pageId);if(!entry)return new ExecutionContext({publisher:'wydgit.core',app:model.runtime.rootId,self:pageId,visible:ids,identity:session.identity??null});
    const grant=entry.approved;return new ExecutionContext({publisher:entry.manifest.publisher,package:entry.manifest.id,installation:entry.receipt.id??null,template:entry.installable,principal:entry.manifest.id,app:model.runtime.rootId,self:pageId,identity:session.identity??null,capabilities:grant.capabilities,traversal:grant.traversal,visible:grant.visible,editable:grant.editable,scopes:{...grant.scopes,wydstore:entry.storageScopes,...(entry.libraryScopes??{})}});
  }};
}
