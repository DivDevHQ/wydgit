// Native host Plan -> durable Review -> stopped-App Apply. No package service.
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { clean, freeze, requireThat as check } from '../object-model/validation.js';
import { fields, validateConfig } from '../libraries/contracts.js';
import { readInstalledState, baseFingerprint, stateFingerprint, safeRead } from './state.js';
import { LIMITS } from './manifest.js';
import { createPackageBudget, packageBudget, authorizeLifecycle } from './budget.js';
import { publishPackageState } from './transaction.js';
import { publishPackageEffects, boundedPackageCheckpoint } from './effects.js';
import { storeLifecycle } from './store-lifecycle.js';
import { reserveStoppedApp } from '../execution/maintenance.js';
import { objectGrantCovers } from '../seam/context.js';
import { policyHash, policyPlanHash, approvedPolicyHash, authorizePolicy } from './policy-contract.js';
const same=(a,b)=>policyHash(a)===policyHash(b);
const serialized=value=>JSON.stringify(clean(value),null,2)+'\n';
const snapshot=root=>({baseFingerprint:baseFingerprint(root),catalogFingerprint:stateFingerprint(root)});
const authority=(context,state)=>authorizePolicy(context,JSON.parse(state.app).id,authorizeLifecycle);
const actor=context=>{const value={publisher:context.publisher,self:context.self,principal:context.principal};check(Buffer.byteLength(serialized(value))<=1024,'PACKAGE.LIMIT','Policy audit principal exceeds 1 KiB');return value;};
const meter=context=>packageBudget(createPackageBudget(context),context);
const difference=(before,after,covers=(values,value)=>values.includes(value))=>({added:after.filter(v=>!covers(before,v)),removed:before.filter(v=>!covers(after,v))});
function grantChanges(before,after) {
  const result={};
  for(const key of ['capabilities','traversal','visible','editable'])result[key]=difference(before[key],after[key],['visible','editable'].includes(key)?objectGrantCovers:undefined);
  result.scopes=Object.fromEntries([...new Set([...Object.keys(before.scopes),...Object.keys(after.scopes)])].sort().map(key=>[key,difference(before.scopes[key]??[],after.scopes[key]??[])]));
  return result;
}
// A different permission cannot be proven narrower without changing live Gate
// assignments. Classify it conservatively as expanded, never infer role hierarchy.
function storeExpansion(before,after) {
  if(before===null)return false; // No operation policy: SEAM/owner checks only.
  if(after===null)return true;
  for(const [collection,rules] of Object.entries(after.collections))for(const [operation,rule] of Object.entries(rules)) {
    const old=before.collections[collection]?.[operation];
    if(!old||rule.contexts.some(c=>!old.contexts.includes(c))||old.public!==true&&(rule.public===true||rule.permission!==old.permission))return true;
  }
  return false;
}
function outcome(state,accepted,approval,context,cancel) {
  delete state.policyReconciliation;
  const p=approval.plan,entry=state.packages.find(e=>e.manifest.id===p.package);
  entry.lifetimeGeneration=randomUUID();entry.receipt.lifetimeGeneration=entry.lifetimeGeneration;
  if(!cancel&&entry.executionPlacement){entry.executionPlacement.generation=randomUUID();entry.receipt.executionPlacement=clean(entry.executionPlacement);}
  state.schema='wydgit-installed/0.4';state.revision=accepted.revision+1;
  check(Number.isSafeInteger(state.revision),'PACKAGE.LIMIT','Catalog revision exhausted');
  state.policyHistory=[...(accepted.policyHistory??[]),{schema:'wydgit.policy-outcome/1',approval:approval.id,status:cancel?'CANCELLED':'APPLIED',plan:p,reviewer:approval.reviewer,approvedAt:approval.approvedAt,caller:actor(context)}].slice(-32);
  return state;
}
export function createPolicyLifecycle({validateCandidateState,resolveLibraries,approve,mapStorage}) {
  const plans=new WeakMap();
  async function prepare(root,accepted,request,installationContext) {
    const {app,package:id,installation,revision,packageRevision,policyRevision,policy:inputPolicy}=request;
    const policy=clean(inputPolicy);
    authority(installationContext,accepted);
    check(!accepted.manualReplacement&&!accepted.policyReconciliation,'PACKAGE.PENDING','Another reviewed lifecycle reserves this App');
    const work=meter(installationContext);work.take();
    const state=clean(accepted),entry=state.packages.find(e=>e.manifest.id===id);
    check(app===installationContext.app,'PACKAGE.DENIED','Exact canonical App required');
    check(entry&&entry.receipt.id===installation,'PACKAGE.OWNERSHIP','Exact package installation required');
    check(revision===accepted.revision&&packageRevision===entry.receipt.revision&&policyRevision===(entry.policyRevision??0),'PACKAGE.STALE','Exact catalog, package and policy revisions required');
    fields(policy,['grants','stores'],'PACKAGE.POLICY');
    check(Array.isArray(policy.stores)&&policy.stores.length<=LIMITS.storage,'PACKAGE.LIMIT','Bounded store policy inventory required');
    const config=clean(validateConfig(safeRead(root,'wydgit.config.json')));
    const model=validateCandidateState(root,state,{});
    const ids=[];const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(model.runtime.rootId);
    const grants=approve(entry.manifest,policy.grants,entry.instanceIds,ids,true);
    const resolved=await resolveLibraries(root,entry.manifest,config);
    check(grants.capabilities.every(c=>resolved.available.has(c)),'PACKAGE.DENIED','No declared capability provider');
    check(same(resolved.resolved,entry.libraries),'PACKAGE.LIBRARY','Accepted dependency versions changed');
    const libraries=Object.fromEntries(Object.entries(grants.scopes).filter(([id])=>!['wydstore','prototypes','events'].includes(id)).map(([id,scopes])=>{
      check(resolved.scopeResolvers.has(id),'PACKAGE.STORAGE','Undeclared scope provider');
      const value=clean(resolved.scopeResolvers.get(id)({app,scopes}));
      check(Array.isArray(value)&&value.length<=16,'PACKAGE.STORAGE','Invalid library scope approval');return [id,value];
    }));
    const changes=grantChanges(entry.approved,grants),stores=[],seen=new Set();
    for(const proposed of policy.stores)fields(proposed,['store','authorization'],'PACKAGE.POLICY');
    for(const proposed of [...policy.stores].sort((a,b)=>String(a.store).localeCompare(String(b.store)))) {
      work.take();fields(proposed,['store','authorization'],'PACKAGE.POLICY');
      check(!seen.has(proposed.store),'PACKAGE.CONFLICT','Duplicate store policy');seen.add(proposed.store);
      const store=config.libraries.find(l=>l.id==='wydstore'&&l.enabled)?.options?.stores?.find(s=>s.id===proposed.store);
      const mapped=Object.values(entry.storageMappings).filter(m=>m.store===proposed.store).map(m=>m.collection);
      check(store&&mapped.length&&store.app===app&&store.publisher===entry.manifest.publisher&&store.package===id&&(!store.principal||store.principal===id)&&(!store.installation||store.installation===installation)&&store.collections.every(c=>mapped.includes(c.id)),
        'PACKAGE.OWNERSHIP','Only exclusively mapped package-owned stores can change operational policy');
      check(![...state.packages.filter(e=>e!==entry),...(state.retained??[]).map(r=>r.entry)].some(e=>Object.values(e.storageMappings).some(m=>m.store===store.id))&&!config.libraries.some(l=>(l.bindings??[]).some(b=>(b.scopes.wydstore??[]).some(s=>s.store===store.id))),
        'PACKAGE.OWNERSHIP','Shared stores require a separate reviewed workflow');
      const before=store.authorization??null,after=clean(proposed.authorization);
      if(after===null)delete store.authorization;else store.authorization=after;
      const provider=await storeLifecycle(root);provider.validateStoreConfig({stores:[store]});
      stores.push({store:store.id,before:clean(before),after,expanded:storeExpansion(before,after),owner:{app,publisher:store.publisher,package:id,principal:store.principal??id,installation:store.installation??null},collections:mapped.sort()});
    }
    const libraryExpanded=Object.entries(libraries).some(([id,scopes])=>scopes.some(scope=>!(entry.libraryScopes?.[id]??[]).some(old=>same(old,scope))));
    const libraryReduced=Object.entries(entry.libraryScopes??{}).some(([id,scopes])=>scopes.some(scope=>!(libraries[id]??[]).some(next=>same(next,scope))));
    entry.approved=grants;entry.receipt.approved=clean(grants);
    entry.libraryScopes=libraries;entry.receipt.libraryScopes=clean(libraries);
    entry.storageScopes=mapStorage(entry.manifest,config,entry.storageMappings,app,grants).scopes;
    entry.policyRevision=policyRevision+1;entry.receipt.policyRevision=entry.policyRevision;entry.receipt.policyHash=approvedPolicyHash(entry,app);
    state.schema='wydgit-installed/0.4';
    validateCandidateState(root,state,{},config);
    const configChanged=!same(config,validateConfig(safeRead(root,'wydgit.config.json')));
    const configAfter=configChanged?serialized(config):undefined;
    if(configChanged)state.baseFingerprint=baseFingerprint(root,configAfter);
    const expanded=libraryExpanded||[...Object.values(changes).filter(x=>x.added),...Object.values(changes.scopes)].some(c=>c.added.length)||stores.some(s=>s.expanded);
    const reduced=libraryReduced||[...Object.values(changes).filter(x=>x.removed),...Object.values(changes.scopes)].some(c=>c.removed.length)||stores.some(s=>!same(s.before,s.after));
    const plan={schema:'wydgit.package-policy-plan/1',action:'policy-apply',app,package:id,installation,revision,packageRevision,policyRevision,proposedPolicyRevision:policyRevision+1,
      packageVersion:entry.manifest.version,packageFingerprint:policyHash({manifest:entry.manifest,resources:entry.resources}),sourceSchema:accepted.schema,sourceStateHash:policyHash(accepted),
      ...snapshot(root),requested:entry.manifest.permissions,before:accepted.packages.find(e=>e.manifest.id===id).approved,policy:{grants,stores:stores.map(s=>({store:s.store,authorization:s.after}))},changes,stores,
      authority:expanded?'expanded':reduced?'reduced':'equivalent',expanded,context:{before:entry.executionPlacement?.context??'FrontEnd',after:entry.executionPlacement?.context??'FrontEnd',relocation:false},
      effectiveScopes:{before:{storage:accepted.packages.find(e=>e.manifest.id===id).storageScopes,libraries:accepted.packages.find(e=>e.manifest.id===id).libraryScopes??{}},after:{storage:entry.storageScopes,libraries}},
      dependencies:{before:entry.manifest.dependencies??{},after:entry.manifest.dependencies??{},changed:false},migrationRequired:false,dataRetention:'preserve-records-history-ownership-bindings',changesSummary:[{package:id,action:'policy-apply'}]};
    plan.sha256=policyPlanHash(plan);
    check(Buffer.byteLength(serialized(plan))<=LIMITS.resource,'PACKAGE.LIMIT','Policy review exceeds 64 KiB');
    work.take();return {plan:freeze(clean(plan)),state,configAfter};
  }
  function inspectPackagePolicy(input) {
    const {root,installationContext,...request}=input;
    fields(request,['app','package','installation'],'PACKAGE.POLICY');
    const state=readInstalledState(path.resolve(root));check(state,'PACKAGE.NOT_INSTALLED','Installed package required');authority(installationContext,state);
    const entry=state.packages.find(e=>e.manifest.id===request.package);
    check(request.app===installationContext.app&&entry?.receipt.id===request.installation,'PACKAGE.OWNERSHIP','Exact canonical App and installation required');
    return freeze(clean({schema:'wydgit.package-policy-inspection/1',app:request.app,package:request.package,installation:request.installation,
      revision:state.revision,packageRevision:entry.receipt.revision,policyRevision:entry.policyRevision??0,requested:entry.manifest.permissions,approved:entry.approved,
      approval:state.policyReconciliation?.plan.package===request.package?{...state.policyReconciliation,revision:state.revision}:null}));
  }
  async function planPackagePolicy(input) {
    const {root:inputRoot,installationContext,...request}=input;
    fields(request,['app','package','installation','revision','packageRevision','policyRevision','policy'],'PACKAGE.POLICY');
    const root=path.resolve(inputRoot),accepted=readInstalledState(root);
    check(accepted,'PACKAGE.NOT_INSTALLED','Installed package required');
    const base=snapshot(root),data=await prepare(root,accepted,request,installationContext);
    check(same(base,snapshot(root)),'PACKAGE.STALE','State changed during policy planning');
    plans.set(data.plan,{root,state:data.state,configAfter:data.configAfter});return data.plan;
  }
  async function approvePackagePolicy(plan,{installationContext,allowExpansion=false,...unknown}={},options={}) {
    fields(unknown,[],'PACKAGE.POLICY');
    check(plans.has(plan),'PACKAGE.PLAN','Original reviewed host plan required');
    const {root,state:target,configAfter}=plans.get(plan);plans.delete(plan);
    const release=reserveStoppedApp(root);
    try {
      const state=readInstalledState(root);check(state,'PACKAGE.NOT_INSTALLED','Installed package required');authority(installationContext,state);
      check(same(snapshot(root),{baseFingerprint:plan.baseFingerprint,catalogFingerprint:plan.catalogFingerprint}),'PACKAGE.STALE','Reviewed revisions changed');
      check(typeof allowExpansion==='boolean'&&(!plan.expanded||allowExpansion===true),'PACKAGE.APPROVAL','Explicit native host approval of expansion required');
      check(!state.policyReconciliation&&!state.manualReplacement,'PACKAGE.PENDING','Another lifecycle reserves this App');
      const approval={schema:'wydgit.policy-approval/1',id:randomUUID(),plan,reviewer:actor(installationContext),approvedAt:new Date().toISOString()};
      state.policyReconciliation=clean(approval);state.schema='wydgit-installed/0.4';state.revision++;
      validateCandidateState(root,state,{});
      // Approval must never strand an App whose apply/cancel cannot checkpoint.
      // Reserve an additional bounded caller identity for a different applying host.
      const configBefore=safeRead(root,'wydgit.config.json');
      for(const cancel of [false,true]){
        const after=outcome(cancel?clean(state):clean(target),state,approval,installationContext,cancel);
        boundedPackageCheckpoint({schema:'wydgit.package-checkpoint/1',id:randomUUID(),app:plan.app,package:plan.package,action:cancel?'policy-cancel':'policy-apply',baseBefore:plan.baseFingerprint,configBefore,configAfter:cancel?configBefore:configAfter??configBefore,stateBefore:serialized(state),stateAfter:serialized(after),resources:[],directories:[]},2048);
      }
      await publishPackageState({root,plan:{...plan,action:'policy-approve',changes:[{package:plan.package,action:'policy-approve',plan:plan.sha256,approval:approval.id}]},state,budget:meter(installationContext),atStage:options.atStage});
      return freeze({...approval,revision:state.revision});
    } finally {release();}
  }
  async function finish(input,options,cancel) {
    const {root:inputRoot,installationContext,...request}=input;
    fields(request,['app','package','installation','revision','packageRevision','policyRevision','approval','planHash'],'PACKAGE.POLICY');
    const root=path.resolve(inputRoot),release=reserveStoppedApp(root);
    try {
      const expected=snapshot(root),accepted=readInstalledState(root);check(accepted,'PACKAGE.NOT_INSTALLED','Installed package required');authority(installationContext,accepted);
      const approval=accepted.policyReconciliation,p=approval?.plan;
      check(p&&approval.id===request.approval&&p.sha256===request.planHash,'PACKAGE.APPROVAL','Exact pending approval required');
      check(request.app===p.app&&request.package===p.package&&request.installation===p.installation,'PACKAGE.OWNERSHIP','Approval identity differs');
      check(request.revision===accepted.revision&&request.packageRevision===p.packageRevision&&request.policyRevision===p.policyRevision,'PACKAGE.STALE','Approval revisions differ');
      const source=clean(accepted);delete source.policyReconciliation;source.schema=p.sourceSchema;source.revision=p.revision;
      check(policyHash(source)===p.sourceStateHash,'PACKAGE.STALE','Reviewed source changed');
      let state,configAfter;
      if(cancel) {state=clean(accepted);delete state.policyReconciliation;}
      else {
        const data=await prepare(root,source,{app:p.app,package:p.package,installation:p.installation,revision:p.revision,packageRevision:p.packageRevision,policyRevision:p.policyRevision,policy:p.policy},installationContext);
        // The approval itself changes only the catalog hash; all reviewed effects
        // and source revisions must recompute exactly before staging.
        const rebuilt=clean(data.plan);rebuilt.catalogFingerprint=p.catalogFingerprint;rebuilt.sha256=policyPlanHash(rebuilt);
        check(rebuilt.sha256===p.sha256,'PACKAGE.STALE','Reviewed policy effects changed');
        state=data.state;configAfter=data.configAfter;
      }
      state=outcome(state,accepted,approval,installationContext,cancel);
      await options.atStage?.('POLICY_VALIDATED');
      check(same(expected,snapshot(root)),'PACKAGE.STALE','Approved source changed during policy validation');
      const plan={...expected,action:cancel?'policy-cancel':'policy-apply',package:p.package,changes:[{package:p.package,action:cancel?'policy-cancel':'policy-apply',plan:p.sha256,approval:approval.id}]};
      return await publishPackageEffects({root,plan,state,configAfter,budget:meter(installationContext),atStage:options.atStage});
    } finally {release();}
  }
  return {inspectPackagePolicy,planPackagePolicy,approvePackagePolicy,applyPackagePolicy:(input,options={})=>finish(input,options,false),cancelPackagePolicy:(input,options={})=>finish(input,options,true)};
}
