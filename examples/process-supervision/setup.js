// Disposable canonical Apps and actual I5.3 approvals, never production staging.
import fs from 'node:fs/promises';
import path from 'node:path';
import {provisionHostnameExample} from '../hostname-host/setup.js';
import {installTaskboards} from '../hostname-host/taskboards.js';
import {createRegistry,fingerprintApprovedApp,emptyRegistry} from 'wydhosting';
export async function provisionPools(root,{dedicatedApp=false}={}){
 const shared=path.join(root,'shared'),dedicated=path.join(root,'dedicated');await fs.mkdir(shared);await fs.mkdir(dedicated);
 await provisionHostnameExample(shared);const execution=await installTaskboards(shared);
 await fs.rename(path.join(shared,'platform-parking'),path.join(dedicated,'app-gamma'));
 const appFile=path.join(dedicated,'app-gamma/content/app.json'),app=JSON.parse(await fs.readFile(appFile));app.id='app-gamma';await fs.writeFile(appFile,JSON.stringify(app));
 const resources={maxPending:4,httpConcurrent:2,directConcurrent:2,payloadBytes:16777216},limits={sewnSteps:1000};
 const r=structuredClone(emptyRegistry('disposable-provider'));
 r.plans=['free',dedicatedApp?'dedicated':'paid'].map(tier=>({planId:tier,revision:1,tier,maxApps:tier==='free'?1:4,maxPools:tier==='dedicated'?4:1,allowPerApp:tier==='dedicated',resources,limits}));
 r.customers=['alpha','beta','gamma'].map(customerId=>({customerId,state:'active',planId:customerId==='gamma'?(dedicatedApp?'dedicated':'paid'):'free',planRevision:1,accountId:customerId==='gamma'?'gamma-account':null}));
 r.accounts=[{accountId:'shared-account',customerId:null,uid:4000,gid:4000,home:root+'/homes/shared',state:'intended'},{accountId:'gamma-account',customerId:'gamma',uid:4001,gid:4001,home:root+'/homes/gamma',state:'intended'}];
 r.pools=[{poolId:'shared',mode:'shared',customerId:null,accountId:'shared-account',base:shared,isolation:'shared-process'},{poolId:'dedicated',mode:dedicatedApp?'dedicated-app':'dedicated-customer',customerId:'gamma',accountId:'gamma-account',base:dedicated,isolation:'separate-process-uid-required'}].map(p=>({...p,hostId:'local',capacity:16,generation:1,state:'active',resources,limits,transport:{mode:'local-http'}}));
 r.apps=await Promise.all(['alpha','beta','gamma'].map(async customerId=>{const poolId=customerId==='gamma'?'dedicated':'shared',appId='app-'+customerId;return {appId,customerId,source:root+'/sources/'+customerId,snapshot:await fingerprintApprovedApp(path.join(root,poolId,appId)),approval:'fixture-operator',placement:{poolId,directory:appId,deploymentId:customerId+'-deployment',epoch:1,state:'active'},state:'active',role:'tenant',resources,limits,namespaces:[]};}));
 r.domains=r.apps.map(a=>({hostname:a.customerId+'.localhost',appId:a.appId,customerId:a.customerId,approval:'local-development',evidence:'fixture-operator',state:'active',epoch:1,revision:1}));
 const directory=path.join(root,'registry');await fs.mkdir(directory,{mode:0o700});const supervisorDirectory=path.join(directory,'supervisor');await fs.mkdir(supervisorDirectory,{mode:0o700});
 const registry=createRegistry({directory,fixtureRoot:root,authorize:()=> 'fixture-operator'});await registry.initialize(r.providerId);
 const actions=['plans','customers','accounts','pools','apps','domains'].flatMap((key,i)=>r[key].map(record=>({kind:['registerPlan','registerCustomer','assignAccount','registerPool','registerApp','registerDomain'][i],record})));
 await registry.apply(await registry.plan({schema:'wydhosting.request/1',operationId:'fixture-approval',expectedRevision:0,expiresAt:Date.now()+60000,actions}));
 return {registry,fixtureRoot:root,directory:supervisorDirectory,execution};
}
