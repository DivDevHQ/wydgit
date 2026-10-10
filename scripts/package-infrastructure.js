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
  fields(policy.infrastructure,['enableWydstore','stores'],'PACKAGE.INFRASTRUCTURE');
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
  validateStoreConfig(library.options);validateConfig(hostConfig);
  for(const store of library.options.stores)if(!roots.includes(store.root))await safeRoot(store.root);
  if(policy.infrastructure.stores.some(s=>s.provider==='sqlite')){const require=createRequire(path.join(options.root,'package.json')),Database=require('better-sqlite3');const probe=new Database(':memory:');probe.close();}
 }
 const plan=await planPackageInstall({...options,placement:policy.placement,approvals:policy.approvals,storageMappings:policy.storageMappings,installationContext:options.installationContext,hostConfig});
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
   if(stores.length)await openStores({stores});
   return rollback;
  }catch(error){await rollback();throw error;}
 }});
}
