import {check,shape,id,integer,json,digest,sealed,validateRegistry} from './contracts.js';
import {inspectRegistry} from './adapter.js';

const collections={registerPlan:['plans','planId'],registerCustomer:['customers','customerId'],assignAccount:['accounts','accountId'],registerPool:['pools','poolId'],registerApp:['apps','appId'],registerDomain:['domains','hostname']};
export function validateRequest(input){
 const r=json(input);shape(r,['schema','operationId','expectedRevision','expiresAt','actions']);check(r.schema==='wydhosting.request/1'&&id(r.operationId)&&integer(r.expectedRevision)&&integer(r.expiresAt,1)&&Array.isArray(r.actions)&&r.actions.length>0&&r.actions.length<=64);
 for(const a of r.actions){check(a&&typeof a.kind==='string');if(collections[a.kind]){shape(a,['kind','record']);check(a.record&&typeof a.record==='object'&&!Array.isArray(a.record));}
 else if(a.kind==='changePlan'){shape(a,['kind','customerId','planId','planRevision']);check(id(a.customerId)&&id(a.planId)&&integer(a.planRevision,1));}
 else if(a.kind==='changeDomain'){shape(a,['kind','customerId','hostname','appId','expectedRevision','evidence']);check(id(a.customerId)&&typeof a.hostname==='string'&&typeof a.appId==='string'&&integer(a.expectedRevision,1)&&id(a.evidence));}
 else if(a.kind==='assignPlacement'){shape(a,['kind','customerId','appId','placement']);check(id(a.customerId)&&typeof a.appId==='string');shape(a.placement,['poolId','directory','deploymentId','epoch','state']);check(integer(a.placement.epoch,1));}
 else if(a.kind==='setAssignmentState'){shape(a,['kind','customerId','appId','state']);check(id(a.customerId)&&typeof a.appId==='string'&&['suspended','retired'].includes(a.state));}
 else check(false,'HOSTING.UNSUPPORTED');}
 return sealed(r);
}
function propose(registry,request){
 const r=structuredClone(registry),required=[];let blocked=false;
 for(const a of request.actions){
  if(collections[a.kind]){const [collection,key]=collections[a.kind];check(!r[collection].some(v=>collection==='plans'?v.planId===a.record.planId&&v.revision===a.record.revision:String(v[key]).toLowerCase()===String(a.record[key]).toLowerCase()),'HOSTING.CONFLICT');r[collection].push(structuredClone(a.record));if(a.kind==='assignAccount'&&a.record.customerId!==null){const c=r.customers.find(c=>c.customerId===a.record.customerId);check(c&&c.state==='active'&&(c.accountId===null||c.accountId===a.record.accountId),'HOSTING.ACCOUNT');c.accountId=a.record.accountId;}if(a.kind==='assignAccount')required.push('LINUX_ACCOUNT_REQUIRED');if(a.kind==='registerPool')required.push('POOL_PROCESS_REQUIRED');if(a.kind==='registerApp')required.push('STAGING_QUALIFICATION_REQUIRED');if(a.kind==='registerDomain')required.push('DOMAIN_ROUTE_REQUIRED');}
  else if(a.kind==='changePlan'){const c=r.customers.find(c=>c.customerId===a.customerId);check(c&&c.state==='active','HOSTING.OWNER');c.planId=a.planId;c.planRevision=a.planRevision;}
  else if(a.kind==='changeDomain'){const d=r.domains.find(d=>d.hostname===a.hostname),app=r.apps.find(v=>v.appId===a.appId);check(d&&d.state!=='retired'&&d.customerId===a.customerId&&app?.customerId===a.customerId&&d.revision===a.expectedRevision,'HOSTING.OWNER');d.appId=a.appId;d.epoch=app.placement.epoch;d.revision++;d.evidence=a.evidence;required.push('DOMAIN_ROUTE_REQUIRED');}
  else {const app=r.apps.find(v=>v.appId===a.appId);check(app&&app.customerId===a.customerId&&app.state!=='retired','HOSTING.OWNER');
   if(a.kind==='assignPlacement'){check(a.placement.epoch===app.placement.epoch+1,'HOSTING.CONFLICT');app.placement=structuredClone(a.placement);for(const d of r.domains.filter(d=>d.appId===app.appId)){d.epoch=app.placement.epoch;d.revision++;}blocked=true;required.push('STOPPED_MIGRATION_REQUIRED');}
   else {app.state=a.state;app.placement.state=a.state;for(const d of r.domains.filter(d=>d.appId===app.appId)){d.state=a.state;d.revision++;}required.push('RUNTIME_FENCING_REQUIRED');}
  }
 }
 r.revision++;check(integer(r.revision),'HOSTING.CONFLICT');return {registry:validateRegistry(r),required:[...new Set(required)].sort(),blocked};
}
export async function plan(input,request,{now=Date.now(),stateDirectory,fixtureRoot}={}){
 const r=validateRegistry(input),q=validateRequest(request);check(q.expectedRevision===r.revision,'HOSTING.STALE');check(q.expiresAt>now&&q.expiresAt<=now+60*60*1000,'HOSTING.EXPIRED');
 const next=propose(r,q),inspection=await inspectRegistry(next.registry,{stateDirectory,fixtureRoot});
 const body={schema:'wydhosting.plan/1',operationId:q.operationId,expectedRevision:r.revision,baseDigest:digest(r),request:q,proposed:next.registry,requiredOperations:next.required,approvals:['EXACT_PLAN_OPERATOR_APPROVAL'],warnings:['FIXTURE_ONLY','OS_PROVISIONING_UNSUPPORTED',...(inspection.pendingPools.length?['STAGING_REQUIRED']:[])],applicable:!next.blocked,expiresAt:q.expiresAt};
 return sealed({...body,digest:digest(body)});
}
export function validatePlan(input){
 const p=json(input);shape(p,['schema','operationId','expectedRevision','baseDigest','request','proposed','requiredOperations','approvals','warnings','applicable','expiresAt','digest']);check(p.schema==='wydhosting.plan/1'&&id(p.operationId)&&integer(p.expectedRevision)&&integer(p.expiresAt,1)&&typeof p.baseDigest==='string'&&/^[a-f0-9]{64}$/.test(p.baseDigest)&&typeof p.applicable==='boolean'&&[p.requiredOperations,p.approvals,p.warnings].every(a=>Array.isArray(a)&&a.every(v=>typeof v==='string'&&/^[A-Z_]{1,64}$/.test(v))));const {digest:hash,...body}=p;check(digest(body)===hash,'HOSTING.DIGEST');validateRequest(p.request);validateRegistry(p.proposed);check(p.operationId===p.request.operationId&&p.expectedRevision===p.request.expectedRevision&&p.expiresAt===p.request.expiresAt,'HOSTING.DIGEST');return sealed(p);
}
export async function verifyPlan(registry,input,options){const p=validatePlan(input),expected=await plan(registry,p.request,options);check(digest(expected)===digest(p),'HOSTING.DIGEST');return p;}
