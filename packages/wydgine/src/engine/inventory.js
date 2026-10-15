// Trusted engine inventory validation; no controller or App startup imports.
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {resourcePolicy} from './governance.js';
import {presentationPolicy} from './presentation-policy.js';
import {validateRouting} from './http/routing.js';
import {loadRepository} from './repository.js';
import {validateConfig,validateRequirements} from './libraries/contracts.js';
import {stateFingerprint,checkInstallationRecovery} from './packages/state.js';
import {MAXIMA} from './sewn/schema.js';
import {validId} from './object-model/schema.js';
import {clean,freeze,record,requireThat as check,WydgitError} from './object-model/validation.js';
const fail=(code='HOST.INVALID')=>new WydgitError(code,'Multi-App host operation failed');
export const snapshotAppConfiguration=root=>{
 try{
  checkInstallationRecovery(root);
  const parts=[readFileSync(path.join(root,'wydgit.config.json'),'utf8'),readFileSync(path.join(root,'content/requirements.json'),'utf8'),JSON.parse(readFileSync(path.join(root,'content/app.json'))).id,stateFingerprint(root)];
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
 }catch{throw fail('HOST.STALE');}
};
const shape=(v,required,optional=[])=>check(record(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>[...required,...optional].includes(k)),'HOST.INVALID','Invalid host inventory');
const inside=(base,selected)=>{const rel=path.relative(base,selected);return !!rel&&!rel.startsWith('..')&&!path.isAbsolute(rel);};
// Inspect existing ancestors too, including missing future resource directories.
async function confined(base,selected){
 check(inside(base,selected),'HOST.ROOT','Resource outside application boundary');
 let at=base;
 for(const part of path.relative(base,selected).split(path.sep)){
  at=path.join(at,part);let stat;try{stat=await fs.lstat(at);}catch(e){if(e.code==='ENOENT')continue;throw fail('HOST.ROOT');}
  check(!stat.isSymbolicLink()&&(!stat.isFile()||stat.nlink===1),'HOST.ROOT','Linked application boundary');
 }
 return selected;
}
async function tree(root,at=root,depth=0,counter={n:0}){
 check(depth<=32,'HOST.ROOT','Application tree limit');
 for(const item of await fs.readdir(at,{withFileTypes:true})){
  check(++counter.n<=8192&&!item.isSymbolicLink()&&(item.isDirectory()||item.isFile()),'HOST.ROOT','Unsafe application tree');
  if(item.isFile())check((await fs.lstat(path.join(at,item.name))).nlink===1,'HOST.ROOT','Linked application file');
  if(item.isDirectory())await tree(root,path.join(at,item.name),depth+1,counter);
 }
}
const limitMaxima=Object.fromEntries([...Object.entries(MAXIMA).filter(([key])=>!['programNodes','programSize'].includes(key)).map(([key,v])=>['sewn'+key[0].toUpperCase()+key.slice(1),v]),...Object.entries({eventQueue:64,eventDispatches:256,eventHandlers:2048,eventDepth:16,eventRaises:256,eventTimeMs:5000})]);
export function executionLimits(input={}){
 const value=clean(input);check(record(value)&&Object.entries(value).every(([k,v])=>Object.hasOwn(limitMaxima,k)&&Number.isSafeInteger(v)&&v>0&&v<=limitMaxima[k]),'HOST.LIMIT','Invalid App execution limits');return value;
}
export async function validateAppInventory(input,{root,execution={}}={}){
 try{
  check(typeof input!=='string'||Buffer.byteLength(input)<=65536,'HOST.INVALID','Host inventory too large');
  const config=clean(typeof input==='string'?JSON.parse(input):input);shape(config,['schema','apps'],['shutdownMs','startupMs','maxPending','routing']);check(Buffer.byteLength(JSON.stringify(config))<=65536,'HOST.INVALID','Host inventory too large');
  check(config.schema==='wydgit.multi-host/0.1'&&Array.isArray(config.apps)&&config.apps.length>0&&config.apps.length<=16,'HOST.INVALID','Invalid App inventory');
  const shutdownMs=config.shutdownMs??5000,startupMs=config.startupMs??10000,maxPending=config.maxPending??64;
  check(Number.isSafeInteger(startupMs)&&startupMs>=10&&startupMs<=30000&&Number.isSafeInteger(shutdownMs)&&shutdownMs>=10&&shutdownMs<=30000&&Number.isSafeInteger(maxPending)&&maxPending>=1&&maxPending<=256,'HOST.LIMIT','Invalid host limits');
  const base=path.resolve(root);check(await fs.realpath(base)===base,'HOST.ROOT','Host base must be canonical');
  const ids=new Set(),roots=[],remote=[],httpPolicies=[];const apps=[];
  for(const entry of config.apps){
   shape(entry,['id','root'],['limits','resources']);
   check(!execution[entry.id]?.lifecycleInstances&&!execution[entry.id]?.files,'HOST.OWNER','I0 requires owned Page instances and canonical file services');
   check(validId(entry.id)&&entry.id.length<=128&&!ids.has(entry.id.toLowerCase()),'HOST.IDENTITY','Invalid or duplicate App identity');ids.add(entry.id.toLowerCase());
   check(typeof entry.root==='string'&&!path.isAbsolute(entry.root)&&entry.root.split(/[\\/]/).every(p=>p&&p!=='.'&&p!=='..'),'HOST.ROOT','Invalid App root');
   const selected=await confined(base,path.resolve(base,entry.root));check((await fs.stat(selected)).isDirectory(),'HOST.ROOT','Missing App directory');
   check(!roots.some(r=>r===selected||inside(r,selected)||inside(selected,r)),'HOST.ROOT','Overlapping App roots');roots.push(selected);
   for(const directory of ['content','prototypes','public']){await confined(selected,path.join(selected,directory));await tree(path.join(selected,directory));}
   await confined(selected,path.join(selected,'wydgit.config.json'));checkInstallationRecovery(selected);
   const appConfig=validateConfig(await fs.readFile(path.join(selected,'wydgit.config.json'),'utf8'));httpPolicies.push(presentationPolicy(appConfig.runtime).http);
   validateRequirements(await fs.readFile(path.join(selected,'content/requirements.json'),'utf8'));
   const model=loadRepository(selected,{verifiedPackages:execution[entry.id]?.verifiedPackages});
   check(model.runtime.rootId===entry.id,'HOST.IDENTITY','Canonical App identity mismatch');
   for(const library of appConfig.libraries.filter(l=>l.enabled)){
    check(['wydstore','wydgate','wydsearch','wydfiles','wydstream'].includes(library.id),'HOST.LIBRARY','Unsupported multi-App library');
    const o=library.options??{},owners=library.id==='wydstore'?o.stores:library.id==='wydsearch'?o.indexes:library.id==='wydgate'?[o]:o.apps;
    check(Array.isArray(owners)&&owners.length>0&&owners.every(v=>v.app===entry.id)&&(library.bindings??[]).every(b=>b.app===entry.id),'HOST.OWNER','Foreign service resource owner');
    const resources=library.id==='wydfiles'?owners.flatMap(v=>v.mounts):owners;
    for(const resource of resources){
     if(resource.root){const target=path.resolve(resource.root);check(!['content','prototypes','public','node_modules'].some(name=>target===path.join(selected,name)||inside(path.join(selected,name),target)),'HOST.ROOT','Unsafe service root');await confined(selected,target);}
     if(resource.provider==='s3'){
      const key=new URL(resource.endpoint).href+'|'+resource.bucket+'|',namespace=resource.namespace;
      check(typeof namespace==='string'&&namespace.length>0&&!remote.some(r=>r.id!==entry.id&&r.key===key&&(r.namespace===namespace||r.namespace.startsWith(namespace+'/')||namespace.startsWith(r.namespace+'/'))),'HOST.OWNER','Overlapping remote namespace');remote.push({id:entry.id,key,namespace});
     }
    }
   }
   apps.push({id:entry.id,root:selected,limits:executionLimits(entry.limits),resources:resourcePolicy(entry.resources,maxPending),snapshot:snapshotAppConfiguration(selected)});
  }
  const routing=Object.hasOwn(config,'routing')?validateRouting(config.routing,apps.map(a=>a.id)):null;
  if(routing)for(const id of routing.parking){const entry=apps.find(a=>a.id===id),settings=validateConfig(await fs.readFile(path.join(entry.root,'wydgit.config.json'),'utf8'));check(!settings.libraries.some(l=>l.enabled)&&!Object.keys(execution[id]??{}).length,'HOST.ROUTING','Parking App must be anonymous and service-free');}
  const http=Object.fromEntries(Object.keys(httpPolicies[0]).map(k=>[k,Math.min(...httpPolicies.map(p=>p[k]))]));
  return freeze({apps,shutdownMs,startupMs,maxPending,routing,http});
 }catch(e){throw e instanceof WydgitError&&e.code.startsWith('HOST.')?e:fail();}
}
