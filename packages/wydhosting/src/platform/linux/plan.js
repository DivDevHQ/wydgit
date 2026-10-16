// A read-only candidate approval. Only an administrator can install it as root policy.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {poolInventory,safePath} from '../../adapter.js';
import {validateRouting,validateApprovedSource} from 'wydgine/trusted/provider';
import {validateRegistry,check,integer,shape,sealed,digest} from '../../contracts.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const linuxPaths=Object.freeze({approval:'/etc/wydhosting/approval.json',state:'/var/lib/wydhosting',release:'/opt/wydhosting/release',socket:'/run/wydhosting/broker.sock'});
export async function describeDeployment(root) {
 await safePath(root);const files=[],directories=[];let bytes=0,count=0;
 async function walk(relative,depth=0) {
  check(depth<=32&&++count<=8192,'HOSTING.STAGING_LIMIT');
  const filename=path.join(root,relative);await safePath(filename);const s=await fs.lstat(filename);
  if(s.isDirectory()){directories.push(relative);for(const name of (await fs.readdir(filename)).sort())await walk(relative+'/'+name,depth+1);}
  else {check(s.isFile()&&s.nlink===1&&s.size<=16*1024*1024,'HOSTING.STAGING');bytes+=s.size;check(bytes<=128*1024*1024,'HOSTING.STAGING_LIMIT');const content=await fs.readFile(filename);check(content.length===s.size,'HOSTING.STAGING');files.push({path:relative,size:content.length,sha256:sha(content)});}
 }
 for(const relative of ['content','prototypes','public','wydgit.config.json'])await walk(relative);
 return sealed({directories,files});
}
export async function createLinuxPlan(input,{providerUid,providerGid,limits,execution={},optional={}}={}) {
 const registry=validateRegistry(input);check(integer(providerUid,1000,2147483647)&&integer(providerGid,1000,2147483647),'HOSTING.LINUX_IDENTITY');
 shape(limits,['memoryBytes','cpuPercent','tasks','fileDescriptors','temporaryBytes']);
 for(const [key,min,max]of [['memoryBytes',64*1024*1024,64*1024**3],['cpuPercent',1,6400],['tasks',16,4096],['fileDescriptors',64,65536],['temporaryBytes',1024*1024,1024**3]])check(integer(limits[key],min,max),'HOSTING.LINUX_LIMIT');
 const pools=[];
 for(const pool of registry.pools.filter(p=>p.state==='active')) {
  const account=registry.accounts.find(a=>a.accountId===pool.accountId);
  check(account&&account.uid>=60000&&account.gid===account.uid&&![providerUid,providerGid].includes(account.uid),'HOSTING.LINUX_IDENTITY');
  check(account.home===linuxPaths.state+'/accounts/'+account.accountId,'HOSTING.LINUX_LAYOUT');
  check(pool.base===linuxPaths.state+'/pools/'+pool.poolId+'/generations/'+pool.generation,'HOSTING.LINUX_LAYOUT');
  const inventory=poolInventory(registry,pool);check(inventory.apps.length>0&&inventory.routing,'HOSTING.ROUTING_REQUIRED');
  validateRouting(inventory.routing,inventory.apps.map(a=>a.id));
  const deployments=[];
  for(const app of registry.apps.filter(a=>a.placement.poolId===pool.poolId&&a.state==='active')) {
   check(app.source===linuxPaths.state+'/uploads/'+account.accountId+'/'+app.placement.deploymentId,'HOSTING.LINUX_LAYOUT');
   check(await validateApprovedSource(app.source,app.appId,execution[pool.poolId]?.[app.appId])===app.snapshot,'HOSTING.SNAPSHOT');
   // The exact execution bytes add integrity coverage; package approval stays canonical.
   const descriptor=await describeDeployment(app.source);
   check(Buffer.byteLength(JSON.stringify(deployments))+Buffer.byteLength(JSON.stringify(descriptor))<=4*1024*1024,'HOSTING.LINUX_APPROVAL_LIMIT');
   deployments.push({appId:app.appId,source:app.source,directory:app.placement.directory,snapshot:app.snapshot,descriptor});
  }
  const privateInventory=structuredClone(inventory);privateInventory.routing.transport={mode:'private-unix',uid:providerUid};
  pools.push({poolId:pool.poolId,account,base:pool.base,generation:pool.generation,inventory:privateInventory,deployments,limits,execution:execution[pool.poolId]??{},optional:optional[pool.poolId]??[]});
 }
 check(pools.length>0,'HOSTING.EMPTY_POOL');
 const body={schema:'wydhosting.linux-approval/1',providerId:registry.providerId,registryRevision:registry.revision,registryDigest:digest(registry),providerUid,providerGid,pools};
 check(Buffer.byteLength(JSON.stringify(body))<=4*1024*1024-512,'HOSTING.LINUX_APPROVAL_LIMIT');
 return sealed({...body,policyRevision:digest(body),qualification:'unqualified',activation:'manual-review-required'});
}
export async function linuxPreflight() {
 const read=async file=>(await fs.readFile(file,'utf8').catch(()=>''));
 const os=await read('/etc/os-release'),cgroups=await read('/sys/fs/cgroup/cgroup.controllers'),pid1=(await read('/proc/1/comm')).trim();
 const distro=Object.fromEntries(os.split('\n').filter(x=>/^(ID|VERSION_ID)=/.test(x)).map(x=>{const [k,v]=x.split('=');return [k,v.replaceAll('"','')];}));
 return sealed({schema:'wydhosting.linux-preflight/1',platform:process.platform,node:process.version,distro,pid1,cgroupV2:cgroups.split(/\s+/).filter(Boolean),candidate:process.platform==='linux'&&((distro.ID==='ubuntu'&&distro.VERSION_ID==='24.04')||(distro.ID==='debian'&&distro.VERSION_ID==='13'))&&pid1==='systemd',privilegedQualification:'not-executed',productionReady:false});
}

// Registry intent remains the sole journal. In this lane privileged descriptors
// and the worker validate deployment bytes; the nonroot registry cannot read them.
export async function inspectLinuxIntent(input){
 const r=validateRegistry(input);
 return sealed({adapter:'linux-intent/1',pendingPools:r.pools.filter(p=>p.state==='active').map(p=>p.poolId),productionReady:false,osStatus:'verification-required',code:'HOSTING.LINUX_QUALIFICATION_REQUIRED'});
}
