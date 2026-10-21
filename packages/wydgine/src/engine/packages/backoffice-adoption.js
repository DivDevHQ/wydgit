// Evidence inside reviewed package policy, never an execution/admission grant.
import {clean,freeze,requireThat as check} from '../object-model/validation.js';
import {fields} from '../libraries/contracts.js';
import {checkJsonBudget} from '../libraries/limits.js';
import {policyHash,approvedPolicyHash} from './policy-contract.js';
import {PREFLIGHT_LIMITS,actionReference,contractReceipt,validateBackOfficeActionScope,validateBackOfficePageEntry} from './backoffice-preflight-contract.js';
const same=(a,b)=>policyHash(a)===policyHash(b);
const code='PACKAGE.BACKOFFICE';
const subject=a=>`action:${a.owner}/${a.id}`;
export function backOfficePageFacts(model,entry){
  const pages=[...new Set([entry.placement.page,...(entry.additions??[]).map(a=>a.placement.page)])],nodes=[];
  for(const page of pages){
    const walk=id=>{const n=model.runtime.get(id),d=model.registry.get(n.prototype);nodes.push({id,page,type:n.prototype,
      ancestors:[n.prototype,...d.ancestors],isPage:model.registry.isA(n.prototype,'wydgit.core/page'),
      // Accepted configuration and containment, including inherited restrictions,
      // are evidence. Nothing here is a capability or a runtime object handle.
      configuration:clean(n.properties),execution:n.execution??null,slots:clean(n.slots)});
      Object.values(n.slots).flat().forEach(walk);};walk(page);
  }
  return {pages,nodes};
}
// Only called with accepted model/config and metadata imported by the existing
// trusted library resolver. Caller-supplied library/ownership facts never enter.
export function reviewBackOffice({input,entry,app,model,config,resolved}){
  // An already reviewed immutable artifact cannot be edited in place and then
  // blessed by a new review under the same receipt. Upgrade through lifecycle.
  const previous=entry.backoffice?.binding;
  if(previous?.installation===entry.receipt.id&&previous.packageRevision===entry.receipt.revision)
    check(previous.artifact===policyHash({manifest:entry.manifest,resources:entry.resources}),'PACKAGE.DRIFT','Reviewed package artifact changed without an installation revision');
  checkJsonBudget(input,PREFLIGHT_LIMITS,code);input=clean(input);fields(input,['actions','pages'],code);
  check(Array.isArray(input.actions)&&input.actions.length<=32&&Array.isArray(input.pages)&&input.pages.length<=32,code,'Bounded complete approval inventory required');
  const actions=[],pages=[],seen=new Set(),facts=backOfficePageFacts(model,entry);
  const stores=config.libraries.find(l=>l.id==='wydstore'&&l.enabled)?.options?.stores??[];
  for(const item of input.actions){
    fields(item,['reference','contractHash','scope'],code);
    const a=entry.manifest.backofficeActions?.find(a=>a.id===item.reference?.action&&a.owner===item.reference?.instance);
    check(a&&same(item.reference,actionReference(entry,a,app))&&!seen.has(subject(a)),code,'Exact unique accepted action reference required');seen.add(subject(a));
    const resolvedScopes={};
    for(const [id,names] of Object.entries(a.scopes))if(id!=='wydstore')resolvedScopes[id]=clean(resolved.scopeResolvers.get(id)?.({app,scopes:names})??[]);
    const result=validateBackOfficeActionScope({entry,app,action:a,operation:resolved.operations.get(`${a.service.library}/${a.service.operation}`)??null,stores,resolvedScopes});
    check(result.valid&&item.contractHash===result.contractHash,code,'Valid fresh installed action contract required');
    // All declarations are required preflight resources. A smaller resource set
    // would be unusable; narrowing from the receipt to this exact maximum is valid.
    check(same(item.scope,result.restrictiveScope),code,'Reviewed scope must include every required resource and no undeclared resource');
    actions.push({subject:subject(a),declaration:a,reference:item.reference,sourceContractHash:result.contractHash,scope:result.restrictiveScope,
      requiredResources:a.scopes,operation:{...a.service,capability:a.capability,effect:a.effect},policyRequirements:result.policyRequirements});
  }
  for(const item of input.pages){
    fields(item,['proposal','contractHash'],code);const p=item.proposal;
    check(!seen.has(`page:${p?.key}`),code,'Unique Page entry key required');seen.add(`page:${p?.key}`);
    const result=validateBackOfficePageEntry({proposal:p,entry,app,...facts});
    check(result.valid&&item.contractHash===result.contractHash,code,'Valid fresh installed Page contract required');
    for(const b of p.bindings)check(actions.some(a=>same(a.reference,b.reference)),code,'Every Page binding requires a reviewed action scope in this policy');
    pages.push({subject:`page:${p.key}`,proposal:p,sourceContractHash:result.contractHash});
  }
  return clean({actions:actions.sort((a,b)=>a.subject.localeCompare(b.subject)),pages:pages.sort((a,b)=>a.subject.localeCompare(b.subject))});
}
// Expanding dormant approval evidence also needs the existing explicit expansion
// review. Generation-only rebinding is not a semantic Page expansion.
export function backOfficeChanges(before,after){
  const semantic=p=>{p=clean(p);delete p.generation;delete p.policyRevision;
    for(const b of p.bindings)b.reference={app:b.reference.app,package:b.reference.package,installation:b.reference.installation,instance:b.reference.instance,action:b.reference.action};return p;};
  const expanded=after.actions.some(a=>{const old=before?.actions.find(v=>v.subject===a.subject);return !old||!same(a.declaration,old.declaration)||Object.entries(a.scope).some(([id,values])=>values.some(v=>!(old.scope[id]??[]).some(o=>same(v,o))));})||
    after.pages.some(p=>!before?.pages.some(old=>old.subject===p.subject&&same(semantic(old.proposal),semantic(p.proposal))));
  const reduced=(before?.actions??[]).some(a=>!after.actions.some(v=>v.subject===a.subject&&same(v.scope,a.scope)))||
    (before?.pages??[]).some(p=>!after.pages.some(v=>v.subject===p.subject&&same(semantic(v.proposal),semantic(p.proposal))));
  return {expanded,reduced};
}
const binding=(entry,app,state)=>({app,package:entry.manifest.id,publisher:entry.manifest.publisher,installation:entry.receipt.id,
  context:entry.executionPlacement?.context??null,generation:entry.executionPlacement?.generation??null,
  lifetimeGeneration:entry.lifetimeGeneration??null,policyRevision:entry.policyRevision??0,packageRevision:entry.receipt.revision,
  artifact:policyHash({manifest:entry.manifest,resources:entry.resources}),receipt:policyHash(contractReceipt(entry)),
  tree:policyHash(state.app),configuration:state.baseFingerprint});
// The policy outcome chooses a fresh generation. References are explicitly
// rebound only in this reviewed transition, never by read-only reconciliation.
export function adoptBackOffice(state,entry,approval){
  const reviewed=approval.plan.backoffice;if(reviewed===undefined)return;
  const app=approval.plan.app,old=entry.backoffice;
  const actions=clean(reviewed.actions),pages=clean(reviewed.pages);
  for(const item of actions){
    const a=entry.manifest.backofficeActions.find(a=>subject(a)===item.subject);
    item.reference=actionReference(entry,a,app);
  }
  for(const item of pages){
    item.proposal.generation=entry.executionPlacement.generation;item.proposal.policyRevision=entry.policyRevision;
    for(const b of item.proposal.bindings)b.reference=clean(actions.find(a=>a.subject===`action:${b.reference.instance}/${b.reference.action}`).reference);
  }
  const active=new Set([...actions,...pages].map(a=>a.subject));
  const revokedSubjects=[...new Set([...(old?.revokedSubjects??[]),...(old?[...old.actions,...old.pages].map(a=>a.subject):[])])].filter(s=>!active.has(s)).sort();
  check(revokedSubjects.length<=256,code,'Revocation inventory limit requires reviewed package replacement');
  entry.backoffice=clean({schema:'wydgit.backoffice-adoption/1',status:active.size?'adopted':'revoked',binding:binding(entry,app,state),
    approval:approval.id,planHash:approval.plan.sha256,reviewer:approval.reviewer,approvedAt:approval.approvedAt,
    actions,pages,revokedSubjects});
  entry.receipt.backofficeHash=policyHash(entry.backoffice);
  entry.receipt.policyHash=approvedPolicyHash(entry,app);
}
export function inspectBackOfficeEvidence(entry,app,state){
  const e=entry.backoffice;
  if(!e)return freeze({status:'proposed',reviewed:false,durablyAdopted:false,eligibleForEnforcement:false,enforcementReady:false,authority:false,
    diagnostic:'BO.ADOPTION_REQUIRED',remediation:'Review exact declarations through stopped-App package policy.'});
  const current=same(e.binding,binding(entry,app,state))&&entry.executionPlacement?.context==='BackOffice'&&entry.executionPlacement.status==='active'&&state.packages.includes(entry);
  const maintenanceClear=!state.policyReconciliation&&!state.manualReplacement;
  const stale=!current,missing=(entry.manifest.backofficeActions??[]).filter(a=>!e.actions.some(v=>v.subject===subject(a))).map(subject);
  return freeze(clean({status:stale?'stale':e.status,reviewed:true,durablyAdopted:!stale&&e.status==='adopted',eligibleForEnforcement:!stale&&e.status==='adopted'&&!missing.length&&maintenanceClear,
    enforcementReady:false,authority:false,maintenanceClear,approval:e.approval,planHash:e.planHash,reviewer:e.reviewer,approvedAt:e.approvedAt,binding:e.binding,
    actions:e.actions,pages:e.pages,revokedSubjects:e.revokedSubjects,missingActions:missing,
    diagnostic:!maintenanceClear?'BO.ADOPTION_PENDING':stale?'BO.ADOPTION_STALE':e.status==='revoked'?'BO.ADOPTION_REVOKED':missing.length?'BO.MIGRATION_INCOMPLETE':'BO.ADOPTION_CURRENT',
    remediation:!maintenanceClear?'Resolve the pending reviewed lifecycle before enforcement integration.':stale?'Review current generation and policy; never transfer old evidence.':missing.length?'Explicitly review remaining actions before an enforcing runtime starts the App.':'B4b must independently validate evidence and live caller, resource, policy and lifetime checks.'}));
}
