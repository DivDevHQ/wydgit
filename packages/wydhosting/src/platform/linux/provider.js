import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {createRegistry} from '../../registry.js';
import {createSupervisor} from '../../supervisor.js';
import {check,shape,integer} from '../../contracts.js';
import {createLinuxBackend} from './client.js';
import {createPrivateIngress} from './ingress.js';
import {inspectLinuxIntent} from './plan.js';
export function createLinuxRegistry(options){return createRegistry({...options,deploymentInspection:inspectLinuxIntent});}
export async function readProtectedJson(filename){
 check(typeof filename==='string'&&path.resolve(filename)===filename,'HOSTING.LINUX_CONFIG');
 let current='/';for(const part of filename.slice(1).split('/')){current=path.join(current,part);const info=await fs.lstat(current);check(!info.isSymbolicLink()&&info.uid===0&&(info.mode&0o022)===0,'HOSTING.LINUX_CONFIG');}
 const info=await fs.stat(filename);check(info.isFile()&&info.nlink===1&&info.size<=4*1024*1024,'HOSTING.LINUX_CONFIG');return JSON.parse(await fs.readFile(filename,'utf8'));
}
export async function startLinuxProvider(filename){
 check(process.platform==='linux'&&process.getuid()!==0,'HOSTING.LINUX_IDENTITY');
 const config=await readProtectedJson(filename);shape(config,['schema','registryDirectory','approval','edgeUid']);check(config.schema==='wydhosting.linux-provider/1'&&integer(config.edgeUid,1)&&config.registryDirectory==='/var/lib/wydhosting/provider'&&config.approval==='/etc/wydhosting/provider-approval.json','HOSTING.LINUX_CONFIG');
 const approval=await readProtectedJson(config.approval);check(approval.providerUid===process.getuid()&&approval.providerGid===process.getgid(),'HOSTING.LINUX_IDENTITY');
 const enforcing=(await fs.readFile('/sys/fs/selinux/enforce','utf8').catch(()=>'' )).trim()==='1';
 if(enforcing||approval.pools?.some(p=>Object.hasOwn(p,'selinuxCategory'))){
  check(enforcing&&approval.pools.length>0&&approval.pools.every(p=>integer(p.selinuxCategory,1,1023))&&(await fs.readFile('/proc/self/attr/current','utf8')).replace(/[\0\n]+$/,'')==='system_u:system_r:wydhosting_provider_t:s0','HOSTING.SELINUX_POLICY');
 }
 const credentialHelper='/opt/wydhosting/release/lib/peercred.node',backend=createLinuxBackend({approval,credentialHelper});
 const registry=createLinuxRegistry({directory:config.registryDirectory});
 const supervisor=await createSupervisor({registry,directory:registry.supervisorStateDirectory,linuxBackend:backend});
 const server=http.createServer({maxHeaderSize:8192},createPrivateIngress({registry,supervisor,backend,edgeUid:config.edgeUid,credentialHelper,onEvent:event=>process.stderr.write(JSON.stringify(event)+'\n')}));
 server.requestTimeout=120000;server.headersTimeout=15000;server.maxHeadersCount=64;
 try{
  for(const pool of approval.pools)await supervisor.startPool(pool.poolId,{execution:pool.execution,optional:pool.optional});
  // The runtime parent is provider-owned and protected; stale sockets refuse startup.
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen('/run/wydhosting/provider/edge.sock',resolve);});
  // Admin configures the edge's approved group on the provider RuntimeDirectory.
  await fs.chmod('/run/wydhosting/provider/edge.sock',0o660);
  let stopping;return {supervisor,server,shutdown:()=>stopping??=(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await supervisor.shutdown();})()};
 }catch(error){server.close();await supervisor.shutdown();throw error;}
}
