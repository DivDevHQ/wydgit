import fs from 'node:fs/promises';
import path from 'node:path';
import {validateAppInventory} from 'wydgine/trusted/provider';
import {validateConfig} from 'wydgine/trusted/provider';
import {validateRouting} from 'wydgine/trusted/provider';
import {check,overlap,absolute,validateRegistry,sealed} from './contracts.js';

export {safePath,fingerprintApprovedApp} from 'wydgine/trusted/provider';
import {safePath,fingerprintApprovedApp} from 'wydgine/trusted/provider';
function inventory(r,p,{all=false}={}){
 const apps=r.apps.filter(a=>a.placement.poolId===p.poolId&&(all||a.state==='active'));
 check(apps.length>0,'HOSTING.EMPTY_POOL');
 const input={schema:'wydgit.multi-host/0.1',apps:apps.map(a=>({id:a.appId,root:a.placement.directory,limits:a.limits,resources:a.resources}))};
 const routes=r.domains.filter(d=>d.state==='active'&&apps.some(a=>a.appId===d.appId)).map(d=>{const a=apps.find(a=>a.appId===d.appId);return {hostname:d.hostname,app:d.appId,state:a.role==='parking'?'parked':'active',approval:d.approval};});
 if(routes.length)input.routing={schema:'wydgit.routing/0.1',transport:p.transport,routes};
 return input;
}
export async function compilePool(input,poolId,options={}){
 const r=validateRegistry(input);await inspectRegistry(r,options);const p=r.pools.find(p=>p.poolId===poolId);check(p&&p.state==='active','HOSTING.PLACEMENT');
 check(r.apps.filter(a=>a.placement.poolId===poolId&&a.state==='active').every(a=>r.customers.find(c=>c.customerId===a.customerId)?.state==='active'),'HOSTING.PLACEMENT');
 const result=inventory(r,p);await validateAppInventory(result,{root:p.base});return sealed(result);
}
export async function inspectRegistry(input,{stateDirectory,fixtureRoot}={}){
 const r=validateRegistry(input),pending=[],remote=[];
 const roots=[...r.pools.map(p=>p.base),...r.apps.map(a=>a.source),...r.accounts.map(a=>a.home)];
 if(roots.length){check(absolute(fixtureRoot)&&fixtureRoot.split('/').filter(Boolean).length>=2,'HOSTING.FIXTURE_ROOT');await safePath(fixtureRoot,{missing:true});for(const root of roots)check(root.startsWith(fixtureRoot+path.sep),'HOSTING.ROOT');}

 if(stateDirectory){for(const root of [...r.pools.map(p=>p.base),...r.apps.map(a=>a.source),...r.accounts.map(a=>a.home)])check(!overlap(root,stateDirectory),'HOSTING.ROOT');}
 for(const a of r.accounts)await safePath(a.home,{missing:true});
 for(const a of r.apps)await safePath(a.source,{missing:true});
 for(const p of r.pools){
  const apps=r.apps.filter(a=>a.placement.poolId===p.poolId);if(!apps.length){await safePath(p.base,{missing:true});continue;}
  const proposal=inventory(r,p,{all:true});if(proposal.routing)validateRouting(proposal.routing,apps.map(a=>a.appId));
  if(!await safePath(p.base,{missing:true})){pending.push(p.poolId);continue;}
  let incomplete=false;
  for(const a of apps)if(!await safePath(path.join(p.base,a.placement.directory),{missing:true}))incomplete=true;
  if(incomplete){pending.push(p.poolId);continue;}
  await validateAppInventory(proposal,{root:p.base});
  for(const a of apps){const root=path.join(p.base,a.placement.directory);check(await fingerprintApprovedApp(root)===a.snapshot,'HOSTING.SNAPSHOT');
   const config=validateConfig(await fs.readFile(path.join(root,'wydgit.config.json'),'utf8'));
   for(const l of config.libraries.filter(l=>l.enabled)){
    const o=l.options??{},owners=l.id==='wydstore'?o.stores:l.id==='wydsearch'?o.indexes:l.id==='wydgate'?[o]:o.apps;
    for(const resource of l.id==='wydfiles'?owners.flatMap(v=>v.mounts):owners)if(resource.provider==='s3'){
     const endpoint=new URL(resource.endpoint).href,key=endpoint+'|'+resource.bucket,namespace=resource.namespace;
     check(a.namespaces.some(n=>n.endpoint===endpoint&&n.bucket===resource.bucket&&n.namespace===namespace),'HOSTING.NAMESPACE');
     check(!remote.some(v=>v.key===key&&(v.namespace===namespace||v.namespace.startsWith(namespace+'/')||namespace.startsWith(v.namespace+'/'))),'HOSTING.NAMESPACE');remote.push({key,namespace});
    }
   }
  }
 }
 return sealed({adapter:'local-fixture/1',productionReady:false,pendingPools:pending,code:pending.length?'HOSTING.STAGING_REQUIRED':'HOSTING.REGISTRY_VALID',osStatus:'unsupported'});
}
