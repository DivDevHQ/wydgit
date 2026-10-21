// Native, observational inspection only. Does not call services, resolve sessions,
// publish policy, edit receipts, take an execution lease or enable admission.
import path from 'node:path';
import {clean,freeze,record} from '../object-model/validation.js';
import {loadRepository} from '../repository.js';
import {activatePackages,acquirePackageExecution} from './index.js';
import {authorizeLifecycle} from './budget.js';
import {readInstalledState,safeRead,stateFingerprint,baseFingerprint} from './state.js';
import {validateConfig} from '../libraries/contracts.js';
import {checkContext} from '../seam/context.js';
import {checkJsonBudget} from '../libraries/limits.js';
import {PREFLIGHT_LIMITS,actionReference,validateBackOfficeActionScope,validateBackOfficePageEntry} from './backoffice-preflight-contract.js';

import {backOfficePageFacts,inspectBackOfficeEvidence} from './backoffice-adoption.js';
const statusFor=result=>{
  const codes=result.findings.filter(f=>f.severity==='error').map(f=>f.code);
  const declaration=['BO.SCOPE_MISSING','BO.SCOPE_INVALID','BO.RESOURCE_UNKNOWN','BO.ACTION_DECLARATION'];
  const reconciliation=['BO.SCOPE_UNAPPROVED','BO.CAPABILITY_APPROVAL'];
  if(codes.some(c=>![...declaration,...reconciliation].includes(c)))return 'blocked';
  if(codes.some(c=>declaration.includes(c)))return 'requires-declaration';
  return codes.length?'requires-receipt-reconciliation':'requires-review';
};
const inventoryStatus=items=>{
  if(items.some(v=>v.status==='blocked'))return 'blocked';
  const relevant=items.filter(v=>v.status!=='not-applicable');
  if(!relevant.length)return 'not-applicable';
  return relevant.every(v=>v.status==='durably-adopted'&&v.eligibleForEnforcement)?'eligible-for-enforcement':'requires-review';
};
// Plain facts intentionally contain no credentials, provider roots, record data,
// native contexts or executable references. They can be passed to pure validators.
export function inspectBackOfficeMigration({root,libraries,installationContext,verifiedPackages={},pageProposals=[],actionCandidates=[],reviews=[]}){
  let app=null;
  try{
    root=path.resolve(root);
    // Authorize before disclosing any installed facts. This is native inspection
    // authority, not a package/action caller and never an output grant.
    authorizeLifecycle(installationContext,installationContext.app);installationContext.require('packages.placement.manage');
    checkJsonBudget({pageProposals,actionCandidates,reviews},PREFLIGHT_LIMITS,'BACKOFFICE.INVALID_CANDIDATE');
    const proposals=clean(pageProposals),candidates=clean(actionCandidates),reviewCandidates=clean(reviews);
    if(!Array.isArray(proposals)||proposals.length>256||!Array.isArray(candidates)||candidates.length>256||!Array.isArray(reviewCandidates)||reviewCandidates.length>512)throw Error();
    const selector=x=>`${x.package}\0${x.installation}\0${x.subject}`;
    const reviewMap=new Map(),candidateMap=new Map(),proposalKeys=new Set(),usedReviews=new Set(),usedCandidates=new Set(),usedProposals=new Set();
    for(const review of reviewCandidates){
      if(!record(review)||reviewMap.has(selector(review)))throw Error();reviewMap.set(selector(review),review);
    }
    for(const candidate of candidates){
      if(!record(candidate)||Object.keys(candidate).sort().join(',')!=='action,installation,package'||!record(candidate.action))throw Error();
      const key=selector({...candidate,subject:candidate.action.id});if(candidateMap.has(key))throw Error();candidateMap.set(key,candidate);
    }
    for(const proposal of proposals){
      if(!record(proposal)||proposalKeys.has(proposal.key))throw Error();proposalKeys.add(proposal.key);
    }
    const reviewFor=(entry,subject)=>{
      const key=selector({package:entry.manifest.id,installation:entry.receipt.id,subject});
      if(!reviewMap.has(key))return {};usedReviews.add(key);return {review:reviewMap.get(key)};
    };
    const state=readInstalledState(root),head=stateFingerprint(root),base=baseFingerprint(root);
    const model=loadRepository(root,{verifiedPackages});app=model.runtime.rootId;
    authorizeLifecycle(installationContext,app);
    activatePackages(model,libraries,root);
    const config=validateConfig(safeRead(root,'wydgit.config.json'));
    const stores=config.libraries.find(l=>l.id==='wydstore'&&l.enabled)?.options?.stores??[];
    const actions=[],pages=[],installations=[];
    const entries=state?.packages??[];
    for(const entry of [...entries,...(state?.retained??[]).map(r=>r.entry)].slice().sort((a,b)=>a.manifest.id<b.manifest.id?-1:a.manifest.id>b.manifest.id?1:0)){
      if(proposals.filter(p=>p.package===entry.manifest.id&&p.installation===entry.receipt.id).length>32)throw Error();
      const adoption=inspectBackOfficeEvidence(entry,app,state);
      const active=entries.includes(entry)&&entry.executionPlacement?.context==='BackOffice'&&entry.executionPlacement.status==='active';
      installations.push({app,package:entry.manifest.id,installation:entry.receipt.id,
        adoption,placement:entry.executionPlacement??null,status:active&&adoption.eligibleForEnforcement?'eligible-for-enforcement':active&&(entry.manifest.backofficeActions?.length??0)>0?'requires-review':'not-applicable',
        reason:active?adoption.remediation:'Dormant, retired, retained or non-BackOffice; review required before activation.',
        actionCount:entry.manifest.backofficeActions?.length??0});
      if(!active){
        for(const action of entry.manifest.backofficeActions??[])actions.push({app,package:entry.manifest.id,installation:entry.receipt.id,
          action:action.id,status:'not-applicable',authority:false,enforcementReady:false,source:'installed',
          existingDeclaredResources:action.scopes,existingApprovedResources:{wydstore:entry.storageScopes??[],...entry.libraryScopes},
          legacyExposure:{wydstore:entry.storageScopes??[],...entry.libraryScopes},
          requiredReviewerAction:'Review strict adoption before BackOffice activation/reactivation.',findings:[]});
        continue;
      }
      // Reuse full canonical accepted-tree/placement/generation validation. The
      // acquired binding stays local, executes nothing and is never returned.
      const guard=acquirePackageExecution({root,app,package:entry.manifest.id,installation:entry.receipt.id,
        generation:entry.executionPlacement.generation,self:entry.instance,installationContext,verifiedPackages});
      for(const action of (entry.manifest.backofficeActions??[]).slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
        const key=selector({package:entry.manifest.id,installation:entry.receipt.id,subject:action.id});
        const candidate=candidateMap.get(key)?.action??action;if(candidateMap.has(key))usedCandidates.add(key);
        const operation=libraries.administrativeOperation(candidate.service?.library,candidate.service?.operation);
        const resolvedScopes={};
        for(const [id,names] of Object.entries(candidate.scopes??{}))if(id!=='wydstore'&&id===candidate.service?.library){
          try{resolvedScopes[id]=libraries.resolvePackageScopes(id,names,app);}catch{/* Validator reports unavailable resolution; no fallback. */}
        }
        const result=validateBackOfficeActionScope({entry,app,action:candidate,operation,stores,resolvedScopes,
          ...reviewFor(entry,`action:${candidate.owner}/${candidate.id}`)});
        const adopted=!candidateMap.has(key)&&adoption.status==='adopted'&&adoption.actions.some(a=>a.subject===`action:${action.owner}/${action.id}`&&JSON.stringify(clean(a.scope))===JSON.stringify(clean(result.restrictiveScope)));
        const approvalStatus=adopted?'durably-adopted':adoption.status==='stale'?'stale':adoption.revokedSubjects?.includes(`action:${action.owner}/${action.id}`)?'revoked':null;
        actions.push({app,package:entry.manifest.id,installation:entry.receipt.id,action:action.id,
          adoptionStatus:approvalStatus??'proposed',reviewed:adopted,durablyAdopted:adopted,eligibleForEnforcement:adopted&&result.valid&&adoption.eligibleForEnforcement,
          reference:actionReference(entry,action,app),source:candidateMap.has(key)?'candidate-over-installed':'installed',status:result.valid&&approvalStatus?approvalStatus:statusFor(result),
          existingDeclaredResources:action.scopes,existingApprovedResources:{wydstore:entry.storageScopes??[],...entry.libraryScopes},
          legacyExposure:{wydstore:entry.storageScopes??[],...entry.libraryScopes},
          compatibilityRisk:'Legacy dispatch is receipt-wide; dynamic extra-resource dependency cannot be disproved statically.',
          requiredReviewerAction:'Review the exact maximum through package policy; B4b must independently enforce live authorization.',...result,
          ...(adopted?{reviewState:'durably-adopted',findings:result.findings.filter(f=>f.code!=='BO.REVIEW_REQUIRED')}:{})});
      }
      const {pages:acceptedPages,nodes}=backOfficePageFacts(model,entry);
      const adoptedProposals=adoption.status==='adopted'?adoption.pages.map(p=>p.proposal):[];
      for(const page of acceptedPages){
        const matches=[...proposals,...adoptedProposals.filter(a=>!proposals.some(p=>p.key===a.key))].filter(p=>p?.package===entry.manifest.id&&p?.installation===entry.receipt.id&&p?.page===page);
        if(!matches.length){pages.push({app,package:entry.manifest.id,installation:entry.receipt.id,page,status:'not-applicable',
          pageEntryApproved:false,authority:false,reason:'Placement alone creates no HTTP Page entry.'});continue;}
        for(const proposal of matches){
          if(proposals.includes(proposal))usedProposals.add(proposal.key);
          const result=validateBackOfficePageEntry({proposal,entry,app,pages:acceptedPages,nodes,...reviewFor(entry,`page:${proposal.key}`)});
          const adopted=adoptedProposals.some(p=>JSON.stringify(clean(p))===JSON.stringify(clean(proposal)));
          const chain=proposal.bindings.every(b=>actions.some(a=>a.package===entry.manifest.id&&a.installation===entry.receipt.id&&a.action===b.reference.action&&a.durablyAdopted&&a.valid));
          pages.push({app,package:entry.manifest.id,installation:entry.receipt.id,page,status:adopted&&result.valid&&chain?'durably-adopted':statusFor(result),...result,
            ...(adopted&&chain?{reviewState:'durably-adopted',findings:result.findings.filter(f=>f.code!=='BO.REVIEW_REQUIRED')}:{}),
            pageEntryApproved:adopted&&result.valid&&chain,reviewed:adopted,durablyAdopted:adopted&&result.valid&&chain,
            eligibleForEnforcement:adopted&&result.valid&&chain&&adoption.eligibleForEnforcement});
        }
      }
      checkContext(guard);
    }
    // Unknown or duplicated selectors are errors, never silently omitted.
    if(usedProposals.size!==proposals.length||usedCandidates.size!==candidates.length||usedReviews.size!==reviewCandidates.length)throw Error();
    checkContext(installationContext);
    if(head!==stateFingerprint(root)||base!==baseFingerprint(root))throw Error();
    const report={schema:'wydgit.backoffice-migration-preflight/1',authority:false,liveAuthorization:'not-checked',
      source:'local-installed-catalog',app,catalogRevision:state?.revision??null,sourceFingerprint:head,
      status:inventoryStatus([...actions,...pages]),enforcementActive:false,
      installations,actions,pages,findings:[]};
    checkJsonBudget(report,PREFLIGHT_LIMITS,'BACKOFFICE.PREFLIGHT_LIMIT');return freeze(report);
  }catch(error){
    // Paths, provider exceptions, configuration and submitted payloads never leak.
    const code=['PACKAGE.DRIFT','PACKAGE.CATALOG','PACKAGE.PATH','PACKAGE.RECOVERY','PACKAGE.PENDING','SEAM.CONTEXT','SEAM.DENIED','PACKAGE.DENIED'].includes(error?.code)?error.code:'BACKOFFICE.PREFLIGHT_BLOCKED';
    return freeze({schema:'wydgit.backoffice-migration-preflight/1',authority:false,liveAuthorization:'not-checked',
      source:'local-installed-catalog',status:'blocked',enforcementActive:false,installations:[],actions:[],pages:[],findings:[{
        code,severity:'error',requirement:'BO-ACT-10',contract:'Inspection requires exact valid accepted state and unambiguous bounded candidates.',
        evidenceSource:'local-installed-catalog',remediation:'Restore accepted state or correct candidates, then rerun read-only inspection.',
        reviewRequired:true,enforcementWouldReject:true}]});
  }
}
