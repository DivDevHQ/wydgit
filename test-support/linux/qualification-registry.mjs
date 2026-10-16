// Installed, disposable VM fixture. Uses the real registry journal and planner.
import fs from 'node:fs/promises';
import {createLinuxRegistry} from './node_modules/wydhosting/src/platform/linux/provider.js';
import {createLinuxPlan} from './node_modules/wydhosting/src/platform/linux/plan.js';
import {fingerprintApprovedApp} from 'wydgine/trusted/provider';
const pools=JSON.parse(process.argv[2]);
const resources={maxPending:4,httpConcurrent:4,directConcurrent:1,payloadBytes:1048576};
const actions=[{kind:'registerPlan',record:{planId:'paid',revision:1,tier:'paid',maxApps:1,maxPools:1,allowPerApp:false,resources,limits:{}}}];
for(const p of pools){
 const appId=p.poolId,customerId=p.account.customerId;
 actions.push(
  {kind:'registerCustomer',record:{customerId,state:'active',planId:'paid',planRevision:1,accountId:null}},
  {kind:'assignAccount',record:p.account},
  {kind:'registerPool',record:{poolId:p.poolId,hostId:'local',mode:'dedicated-customer',customerId,accountId:p.account.accountId,base:p.base,capacity:1,generation:1,state:'active',isolation:'separate-process-uid-required',resources,limits:{},transport:{mode:'trusted-proxy',peers:['127.0.0.1']}}},
  {kind:'registerApp',record:{appId,customerId,source:p.deployments[0].source,snapshot:await fingerprintApprovedApp(p.deployments[0].source),approval:'vm-operator',placement:{poolId:p.poolId,directory:'app',deploymentId:'deployment-'+p.poolId,epoch:1,state:'active'},state:'active',role:'tenant',resources,limits:{},namespaces:[]}},
  {kind:'registerDomain',record:{hostname:p.poolId.slice(-1)+'.localhost',appId,customerId,approval:'local-development',evidence:'vm-operator',state:'active',epoch:1,revision:1}}
 );
}
const registry=createLinuxRegistry({directory:'/var/lib/wydhosting/provider',authorize:()=> 'vm-operator'});
await registry.initialize('i56');
await registry.apply(await registry.plan({schema:'wydhosting.request/1',operationId:'integrated',expectedRevision:0,expiresAt:Date.now()+60000,actions}));
const current=(await registry.inspect()).registry;
const approval=await createLinuxPlan(current,{providerUid:61050,providerGid:61050,limits:pools[0].limits,selinuxCategories:{'i56-a':51,'i56-b':52}});
await fs.mkdir(registry.supervisorStateDirectory,{mode:0o700});
console.log(JSON.stringify(approval));
