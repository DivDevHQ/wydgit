import path from 'node:path';
import {createHash} from 'node:crypto';
import {clean,freeze,record} from '../../../wydgine/object-model/validation.js';
import {validId} from '../../../wydgine/object-model/schema.js';
import {canonicalAuthority} from '../../../wydgine/http/routing.js';
import {executionLimits} from '../../../wydgine/inventory.js';
import {resourcePolicy} from '../../../wydgine/governance.js';

export function fail(code='HOSTING.INVALID'){return Object.assign(new Error('Provider operation refused'),{code});}
export function check(ok,code){if(!ok)throw fail(code);}
export function shape(v,keys){check(record(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));}
export const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
export const integer=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
export const digest=v=>createHash('sha256').update(JSON.stringify(clean(v))).digest('hex');
export const sealed=v=>freeze(clean(v));
export const overlap=(a,b)=>a===b||a.startsWith(b+path.sep)||b.startsWith(a+path.sep);
export const absolute=v=>typeof v==='string'&&path.isAbsolute(v)&&path.resolve(v)===v&&v!=='/'&&!/[\x00-\x1f\x7f\\]/.test(v)&&!v.split('/').includes('..');
export const relative=v=>typeof v==='string'&&v.length<=256&&!path.isAbsolute(v)&&v.split(/[\\/]/).every(p=>id(p));
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function json(input){try{check(typeof input!=='string'||Buffer.byteLength(input)<=4*1024*1024);const v=clean(typeof input==='string'?JSON.parse(input):input);check(Buffer.byteLength(JSON.stringify(v))<=4*1024*1024);return v;}catch{throw fail();}}
const list=v=>check(Array.isArray(v)&&v.length<=1024);
const unique=(rows,key)=>{const seen=new Set();for(const r of rows){const k=String(key(r)).toLowerCase();check(!seen.has(k),'HOSTING.CONFLICT');seen.add(k);}};
const lifecycle=v=>check(['active','suspended','retired'].includes(v));
const resources=v=>{shape(v,['maxPending','httpConcurrent','directConcurrent','payloadBytes']);resourcePolicy(v);};
const less=(v,max)=>Object.entries(v).every(([k,n])=>n<=max[k]);

// Record revisions are closed by the containing registry/1 schema. Plan revisions
// are immutable records, referenced by the exact pair (planId, revision).
export function validateRegistry(input){
 try{
 const r=json(input);shape(r,['schema','providerId','revision','plans','customers','accounts','pools','apps','domains']);
 check(r.schema==='wydhosting.registry/1'&&id(r.providerId)&&integer(r.revision));
 for(const k of ['plans','customers','accounts','pools','apps','domains'])list(r[k]);
 for(const p of r.plans){shape(p,['planId','revision','tier','maxApps','maxPools','allowPerApp','resources','limits']);check(id(p.planId)&&integer(p.revision,1)&&['free','paid','dedicated'].includes(p.tier)&&integer(p.maxApps,1,1024)&&integer(p.maxPools,1,1024)&&typeof p.allowPerApp==='boolean');resources(p.resources);executionLimits(p.limits);if(p.tier==='free')check(p.maxApps===1&&p.maxPools===1&&!p.allowPerApp&&p.resources.maxPending<=4&&p.resources.payloadBytes<=16*1024*1024&&Object.hasOwn(p.limits,'sewnSteps')&&p.limits.sewnSteps<=1000);if(p.tier==='paid')check(p.maxPools===1&&!p.allowPerApp);}
 unique(r.plans,p=>p.planId+':'+p.revision);
 for(const c of r.customers){shape(c,['customerId','state','planId','planRevision','accountId']);check(id(c.customerId)&&id(c.planId)&&integer(c.planRevision,1)&&(c.accountId===null||id(c.accountId)));lifecycle(c.state);}
 unique(r.customers,c=>c.customerId);
 const customer=key=>{const c=r.customers.find(c=>c.customerId===key);check(c,'HOSTING.REFERENCE');return c;};
 const plan=c=>{const p=r.plans.find(p=>p.planId===c.planId&&p.revision===c.planRevision);check(p,'HOSTING.REFERENCE');return p;};
 for(const a of r.accounts){shape(a,['accountId','customerId','uid','gid','home','state']);check(id(a.accountId)&&integer(a.uid,1,2147483647)&&integer(a.gid,1,2147483647)&&absolute(a.home)&&a.state==='intended');if(a.customerId!==null)customer(a.customerId);}
 for(const key of ['accountId','uid','gid','home'])unique(r.accounts,a=>a[key]);unique(r.accounts.filter(a=>a.customerId!==null),a=>a.customerId);
 for(const c of r.customers){const p=plan(c),account=r.accounts.find(a=>a.accountId===c.accountId);check(p.tier==='free'?c.accountId===null&&!r.accounts.some(a=>a.customerId===c.customerId):account?.customerId===c.customerId,'HOSTING.ACCOUNT');}
 for(const a of r.accounts.filter(a=>a.customerId!==null))check(customer(a.customerId).accountId===a.accountId,'HOSTING.ACCOUNT');
 for(const p of r.pools){shape(p,['poolId','hostId','mode','customerId','accountId','base','capacity','generation','state','isolation','resources','limits','transport']);check(id(p.poolId)&&p.hostId==='local'&&['shared','dedicated-customer','dedicated-app'].includes(p.mode)&&absolute(p.base)&&integer(p.capacity,1,16)&&integer(p.generation,1));lifecycle(p.state);check(p.isolation===(p.mode==='shared'?'shared-process':'separate-process-uid-required'));resources(p.resources);executionLimits(p.limits);
 if(p.mode==='shared')check(p.customerId===null&&id(p.accountId)&&r.accounts.some(a=>a.accountId===p.accountId&&a.customerId===null),'HOSTING.ACCOUNT');
 else {const c=customer(p.customerId),ent=plan(c);check(ent.tier!=='free'&&p.accountId===c.accountId&&(p.mode!=='dedicated-app'||ent.allowPerApp),'HOSTING.PLACEMENT');}
 shape(p.transport,p.transport?.mode==='local-http'?['mode']:['mode','peers']);check(['local-http','trusted-proxy'].includes(p.transport.mode));if(p.transport.mode==='trusted-proxy')check(Array.isArray(p.transport.peers)&&p.transport.peers.length>0&&p.transport.peers.length<=16&&p.transport.peers.every(x=>typeof x==='string'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(x))&&new Set(p.transport.peers).size===p.transport.peers.length);
 }
 unique(r.pools,p=>p.poolId);unique(r.pools,p=>p.base);
 for(const p of r.pools)check(!r.pools.some(q=>q!==p&&overlap(p.base,q.base)),'HOSTING.ROOT');
 const roots=r.accounts.map(a=>a.home);for(const p of r.pools)check(!roots.some(home=>overlap(home,p.base)),'HOSTING.ROOT');
 for(let i=0;i<roots.length;i++)check(!roots.slice(i+1).some(q=>overlap(roots[i],q)),'HOSTING.ROOT');
 for(const a of r.apps){shape(a,['appId','customerId','source','snapshot','approval','placement','state','role','resources','limits','namespaces']);check(validId(a.appId)&&a.appId.length<=128&&absolute(a.source)&&sha(a.snapshot)&&id(a.approval)&&['tenant','parking'].includes(a.role));lifecycle(a.state);const c=customer(a.customerId),ent=plan(c);resources(a.resources);executionLimits(a.limits);check(less(a.resources,ent.resources)&&Object.entries(ent.limits).every(([k,v])=>a.limits[k]!==undefined&&a.limits[k]<=v),'HOSTING.ENTITLEMENT');
 shape(a.placement,['poolId','directory','deploymentId','epoch','state']);check(id(a.placement.poolId)&&relative(a.placement.directory)&&id(a.placement.deploymentId)&&integer(a.placement.epoch,1));lifecycle(a.placement.state);check(a.placement.state===a.state,'HOSTING.PLACEMENT');
 const p=r.pools.find(p=>p.poolId===a.placement.poolId);check(p,'HOSTING.REFERENCE');if(a.state==='active')check(c.state==='active'&&p.state==='active','HOSTING.PLACEMENT');check(p.mode==='shared'?ent.tier==='free':p.customerId===c.customerId,'HOSTING.PLACEMENT');check(less(a.resources,p.resources)&&Object.entries(p.limits).every(([k,v])=>a.limits[k]!==undefined&&a.limits[k]<=v),'HOSTING.ENTITLEMENT');check(!r.pools.some(q=>overlap(a.source,q.base))&&!r.accounts.some(q=>q.customerId!==c.customerId&&overlap(a.source,q.home)),'HOSTING.ROOT');
 }
 const remote=[];
 for(const a of r.apps){list(a.namespaces);for(const n of a.namespaces){shape(n,['endpoint','bucket','namespace']);check(typeof n.endpoint==='string'&&n.endpoint.length<=512&&typeof n.bucket==='string'&&/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(n.bucket)&&typeof n.namespace==='string'&&n.namespace.length<=256&&n.namespace.split('/').every(id),'HOSTING.NAMESPACE');const u=new URL(n.endpoint);check(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash&&u.href===n.endpoint,'HOSTING.NAMESPACE');check(!remote.some(q=>q.endpoint===n.endpoint&&q.bucket===n.bucket&&(q.namespace===n.namespace||q.namespace.startsWith(n.namespace+'/')||n.namespace.startsWith(q.namespace+'/'))),'HOSTING.NAMESPACE');remote.push(n);}}
 unique(r.apps,a=>a.appId);unique(r.apps,a=>a.placement.deploymentId);unique(r.apps,a=>a.source);
 for(const a of r.apps)check(!r.apps.some(b=>a!==b&&overlap(a.source,b.source)),'HOSTING.ROOT');
 for(const p of r.pools){const apps=r.apps.filter(a=>a.placement.poolId===p.poolId);check(apps.length<=p.capacity&&(p.mode!=='dedicated-app'||apps.length<=1),'HOSTING.CAPACITY');for(const a of apps)check(!apps.some(b=>a!==b&&overlap(path.join(p.base,a.placement.directory),path.join(p.base,b.placement.directory))),'HOSTING.ROOT');}
 for(const c of r.customers){const ent=plan(c);check(r.apps.filter(a=>a.customerId===c.customerId).length<=ent.maxApps&&r.pools.filter(p=>p.customerId===c.customerId).length<=ent.maxPools,'HOSTING.ENTITLEMENT');}
 for(const d of r.domains){shape(d,['hostname','appId','customerId','approval','evidence','state','epoch','revision']);const host=canonicalAuthority(d.hostname);check(host.port===null&&host.hostname===d.hostname&&id(d.evidence)&&integer(d.epoch,1)&&integer(d.revision,1)&&['operator-domain','platform-domain','local-development'].includes(d.approval));lifecycle(d.state);const a=r.apps.find(a=>a.appId===d.appId);check(a&&a.customerId===d.customerId&&d.epoch===a.placement.epoch&&(d.state!=='active'||a.state==='active'),'HOSTING.OWNER');}
 unique(r.domains,d=>d.hostname);
 return sealed(r);
 }catch(e){throw e.code?.startsWith('HOSTING.')?e:fail();}
}
export function emptyRegistry(providerId){return validateRegistry({schema:'wydhosting.registry/1',providerId,revision:0,plans:[],customers:[],accounts:[],pools:[],apps:[],domains:[]});}
