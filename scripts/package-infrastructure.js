// Host/operator policy only. Never supplied by a package manifest.
import fs from 'node:fs/promises';
import { existsSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { safeRoot } from '../packages/wydstore/src/local-root.js';
import { validateConfig, fields } from '../wydgine/libraries/contracts.js';
import { importNodePackage } from '../wydgine/libraries/node-package.js';
import { requireThat as check, clean } from '../wydgine/object-model/validation.js';
import { validateStoreConfig, openStores } from '../packages/wydstore/src/core.js';
import { checkJsonBudget } from '../wydgine/libraries/limits.js';
import { planPackageInstall, applyPackageInstall } from '../wydgine/packages/index.js';
export const physicalStoreId=id=>id.replace(/[^a-z0-9-]/g,'-');
export function storageLocation(root,relative) {
 check(typeof relative==='string'&&relative.length<=256&&!path.isAbsolute(relative)&&relative.split('/').every(p=>p==='.wydgit-data'||/^[a-z][a-z0-9-]*$/.test(p)),'PACKAGE.PATH','Use a safe site-relative runtime directory');
 check(!['content','prototypes','examples','public','node_modules','wydgine','wydclient','packages','scripts','test','test-support','docs'].includes(relative.split('/')[0]),'PACKAGE.PATH','Runtime data cannot use application/resource directories');
 const base=path.resolve(root);let cursor=path.parse(base).root;
 for(const part of base.slice(cursor.length).split(path.sep)){cursor=path.join(cursor,part);const info=lstatSync(cursor);check(info.isDirectory()&&!info.isSymbolicLink(),'PACKAGE.PATH','Unsafe site directory');}
 for(const part of relative.split('/')){cursor=path.join(cursor,part);const info=lstatSync(cursor,{throwIfNoEntry:false});if(info)check(info.isDirectory()&&!info.isSymbolicLink(),'PACKAGE.PATH','Unsafe runtime directory');}
 return cursor;
}
export async function planOperatorInstall({policy,...options}) {
 let hostConfig;const roots=[];
 if(policy.infrastructure){
  fields(policy.infrastructure,['enableWydstore','stores',...(policy.infrastructure.search!==undefined?['search']:[]),...(policy.infrastructure.media!==undefined?['media']:[])],'PACKAGE.INFRASTRUCTURE');
  check(typeof policy.infrastructure.enableWydstore==='boolean'&&Array.isArray(policy.infrastructure.stores)&&policy.infrastructure.stores.length<=16,'PACKAGE.INFRASTRUCTURE','Invalid infrastructure approval');
  hostConfig=JSON.parse(JSON.stringify(validateConfig(await fs.readFile(path.join(options.root,'wydgit.config.json'),'utf8'))));
  const library=hostConfig.libraries.find(l=>l.id==='wydstore');
  check(library?.package==='@wydgit/store'&&library.trust==='canonical'&&library.publisher==='wydgit.core','PACKAGE.LIBRARY','Canonical WydStore must already be installed');
  await importNodePackage(library,options.root);
  if(policy.infrastructure.enableWydstore)library.enabled=true;
  check(library.enabled,'PACKAGE.LIBRARY','Enabling WydStore requires explicit approval');
  library.options??={stores:[]};
  for(const request of policy.infrastructure.stores){
   fields(request,['id','provider','location','collections'],'PACKAGE.INFRASTRUCTURE');
   check(['json','sqlite'].includes(request.provider),'PACKAGE.INFRASTRUCTURE','Unsupported provider');
   const root=storageLocation(options.root,request.location);
   check(!existsSync(root)&&!roots.includes(root),'PACKAGE.STORAGE','New storage needs an unused directory');roots.push(root);
   library.options.stores.push({id:request.id,app:policy.installationContext.app,publisher:options.manifest.publisher,package:options.manifest.id,provider:request.provider,root,collections:clean(request.collections)});
  }
  if(policy.infrastructure.search){
   const request=policy.infrastructure.search;fields(request,['index','pages',...['provider','location'].filter(key=>Object.hasOwn(request,key))],'PACKAGE.INFRASTRUCTURE');
   check(options.manifest.requires.libraries.some(r=>r.library==='wydsearch')&&options.manifest.permissions.scopes.wydsearch?.includes(request.index),'PACKAGE.INFRASTRUCTURE','Undeclared search index');
   const {loadRepository}=await import('../wydgine/repository.js'),model=loadRepository(options.root),app=model.runtime.rootId;
   check(Array.isArray(request.pages)&&request.pages.length>0&&request.pages.length<=256&&new Set(request.pages).size===request.pages.length&&request.pages.every(id=>model.pages.has(id)),'PACKAGE.INFRASTRUCTURE','Select existing public source Pages explicitly');
   let search=hostConfig.libraries.find(l=>l.id==='wydsearch');
   if(!search){search={id:'wydsearch',package:'@wydgit/search',enabled:false,version:'^0.1.0-alpha.1',publisher:'wydgit.core',trust:'canonical'};hostConfig.libraries.push(search);}
   check(search.package==='@wydgit/search'&&search.publisher==='wydgit.core'&&search.trust==='canonical','PACKAGE.LIBRARY','Approved canonical WydSearch required');await importNodePackage(search,options.root);
   const existing=search.options?.indexes?.find(i=>i.id===request.index);
   if(existing){
    const source=search.options.pageSource?.indexes?.find(i=>i.id===request.index);
    check(existing.app===app&&source&&JSON.stringify([...source.pages].sort())===JSON.stringify([...request.pages].sort())&&request.provider===undefined&&request.location===undefined,'PACKAGE.INFRASTRUCTURE','Reuse cannot change existing source policy or storage');
   }else{
    check(['json','sqlite'].includes(request.provider)&&typeof request.location==='string','PACKAGE.INFRASTRUCTURE','Approve a provider and new location');
    const root=storageLocation(options.root,request.location);check(!existsSync(root)&&!roots.includes(root),'PACKAGE.STORAGE','Search storage needs an unused directory');roots.push(root);
    const id='search-'+request.index;check(!library.options.stores.some(s=>s.id===id),'PACKAGE.STORAGE','Search store ID collision');
    library.options.stores.push({id,app,publisher:'wydgit.core',package:'library:wydsearch',provider:request.provider,root,collections:[{id:'indexes',schemaId:'search-index',schemaVersion:1,fields:{schemaVersion:{type:'number',required:true},documents:{type:'array',required:true}}}]});
    search.options??={indexes:[]};search.options.indexes.push({id:request.index,app,store:id,collection:'indexes'});
    search.options.pageSource??={schema:'wydgit.search-source/0.1',indexes:[]};search.options.pageSource.indexes.push({id:request.index,publisher:'wydgit.core',package:'host:site-search',principal:'host:site-search',pages:[...request.pages]});
    search.bindings??=[{library:'wydstore',app,capabilities:['store.records.read','store.records.create','store.records.write'],scopes:{wydstore:[]}}];
    const binding=search.bindings.find(b=>b.library==='wydstore');check(binding&&binding.app===app&&Array.isArray(binding.scopes.wydstore),'PACKAGE.INFRASTRUCTURE','Incompatible existing search dependency binding');binding.scopes.wydstore.push({store:id,collection:'indexes'});
   }
   search.enabled=true;
  }
  if(policy.infrastructure.media){
   const request=policy.infrastructure.media;
   fields(request,['resource','provider','metadataLocation','binaryLocation','categories',...['limits','uploadPermission'].filter(k=>Object.hasOwn(request,k))],'PACKAGE.INFRASTRUCTURE');
   check(options.manifest.requires.libraries.some(r=>r.library==='wydstream')&&options.manifest.permissions.scopes.wydstream?.includes(request.resource)&&['json','sqlite'].includes(request.provider),'PACKAGE.INFRASTRUCTURE','Undeclared media resource');
   const app=policy.installationContext.app,root=storageLocation(options.root,request.metadataLocation),binary=storageLocation(options.root,request.binaryLocation);
   check(root!==binary&&!existsSync(root)&&!existsSync(binary)&&!roots.includes(root)&&!roots.includes(binary),'PACKAGE.STORAGE','Media requires unused separate roots');roots.push(root,binary);
   let stream=hostConfig.libraries.find(l=>l.id==='wydstream');
   if(!stream){stream={id:'wydstream',package:'@wydgit/stream',enabled:false,version:'^0.1.0-alpha.1',publisher:'wydgit.core',trust:'canonical'};hostConfig.libraries.push(stream);}
   check(stream.package==='@wydgit/stream'&&stream.publisher==='wydgit.core'&&stream.trust==='canonical'&&!stream.enabled&&!stream.options,'PACKAGE.INFRASTRUCTURE','Media resource already configured; use existing resource without provisioning');const {module:implementation}=await importNodePackage(stream,options.root);
   const id='media-'+request.resource;
   check(!library.options.stores.some(s=>s.id===id),'PACKAGE.STORAGE','Media store ID collision');
   library.options.stores.push({id,app,publisher:'wydgit.core',package:'library:wydstream',provider:request.provider,root,collections:[{id:'media',schemaId:'media-ledger',schemaVersion:1,fields:implementation.metadataFields}]});
   stream.options={apps:[{app,resource:request.resource,store:id,collection:'media',root:binary,categories:clean(request.categories),...(request.uploadPermission?{uploadPermission:request.uploadPermission}:{})}],...(request.limits?{limits:clean(request.limits)}:{})};
   try{check(typeof implementation.validateOptions==='function','PACKAGE.INFRASTRUCTURE','Media provider cannot validate provisioning');implementation.validateOptions(stream.options);}catch{check(false,'PACKAGE.INFRASTRUCTURE','Invalid media resource policy');}
   stream.bindings=[{library:'wydstore',app,capabilities:['store.records.read','store.records.create','store.records.write'],scopes:{wydstore:[{store:id,collection:'media'}]}}];stream.enabled=true;
  }
  validateStoreConfig(library.options);validateConfig(hostConfig);
  for(const store of library.options.stores)if(!roots.includes(store.root))await safeRoot(store.root);
  if(policy.infrastructure.stores.some(s=>s.provider==='sqlite')||policy.infrastructure.search?.provider==='sqlite'||policy.infrastructure.media?.provider==='sqlite'){const require=createRequire(path.join(options.root,'package.json')),Database=require('better-sqlite3');const probe=new Database(':memory:');probe.close();}
 }
 const plan=await planPackageInstall({...options,placement:policy.placement,approvals:policy.approvals,storageMappings:policy.storageMappings,installationContext:options.installationContext,hostConfig,...Object.fromEntries(['additions','page','navigation','properties'].filter(key=>Object.hasOwn(policy,key)).map(key=>[key,policy[key]]))});
 return {plan,infrastructure:policy.infrastructure??null,hostConfig,roots,root:options.root};
}
export async function applyOperatorInstall(resolved,hooks={}) {
 const created=[];
 const rollback=async()=>{for(const directory of [...created].reverse()){if(resolved.roots.includes(directory))await fs.rm(directory,{recursive:true,force:true});else await fs.rmdir(directory).catch(error=>{if(!['ENOENT','ENOTEMPTY'].includes(error.code))throw error;});}};
 return applyPackageInstall(resolved.plan,{...hooks,prepareInfrastructure:async()=>{
  try{
   for(const root of resolved.roots){
    // Track only directories created by this operation; never remove reused data.
    const missing=[];let cursor=root;while(!existsSync(cursor)){missing.unshift(cursor);cursor=path.dirname(cursor);}
    storageLocation(resolved.root,path.relative(resolved.root,root));
    for(const directory of missing){await fs.mkdir(directory,{mode:0o700});created.push(directory);}
   }
   if(hooks.beforeProviderSetup)await hooks.beforeProviderSetup();
   const stores=resolved.hostConfig.libraries.find(l=>l.id==='wydstore').options.stores.filter(s=>resolved.roots.includes(s.root));
   if(stores.length)await openStores({stores},checkJsonBudget);
   return rollback;
  }catch(error){await rollback();throw error;}
 }});
}
