// Trusted runtime consumption of reviewed package policy. Inspection/planning
// deliberately remain usable before migration; only execution calls this gate.
import {clean,requireThat as check} from '../object-model/validation.js';
import {validateConfig} from '../libraries/contracts.js';
import {safeRead,readInstalledState,stateFingerprint} from './state.js';
import {policyHash} from './policy-contract.js';
import {inspectBackOfficeEvidence,backOfficePageFacts} from './backoffice-adoption.js';
import {actionReference,validateBackOfficeActionScope,validateBackOfficePageEntry} from './backoffice-preflight-contract.js';

export const sameBackOffice=(a,b)=>policyHash(a)===policyHash(b);
export function admitBackOffice({root,model,libraries}) {
  const head=stateFingerprint(root),state=readInstalledState(root),app=model.runtime.rootId;
  check(sameBackOffice(model.installed??null,state),'PACKAGE.STALE','Loaded installation changed before admission');
  check(!state?.manualReplacement&&!state?.policyReconciliation,'PACKAGE.PENDING','App maintenance must finish before admission');
  const stores=state?validateConfig(safeRead(root,'wydgit.config.json')).libraries.find(l=>l.id==='wydstore'&&l.enabled)?.options?.stores??[]:[];
  const actions=new Map(),pages=new Map();
  for(const entry of state?.packages??[]) {
    if(entry.executionPlacement?.context!=='BackOffice'||entry.executionPlacement.status!=='active')continue;
    const declared=entry.manifest.backofficeActions??[],evidence=inspectBackOfficeEvidence(entry,app,state);
    if(!declared.length&&!entry.backoffice?.pages.length)continue;
    check(evidence.eligibleForEnforcement,'BACKOFFICE.MIGRATION_REQUIRED',
      `Review current BackOffice migration for ${entry.manifest.id}; use inspectBackOfficeMigration while stopped (${evidence.diagnostic})`);
    const facts=backOfficePageFacts(model,entry);
    for(const a of declared){
      const approved=evidence.actions.find(v=>v.subject===`action:${a.owner}/${a.id}`),resolvedScopes={};
      for(const [id,names] of Object.entries(a.scopes))if(id!=='wydstore')resolvedScopes[id]=libraries.resolvePackageScopes(id,names,app);
      const result=validateBackOfficeActionScope({entry,app,action:a,stores,resolvedScopes,operation:libraries.administrativeOperation(a.service.library,a.service.operation)});
      check(approved&&result.valid&&sameBackOffice(approved.reference,actionReference(entry,a,app))&&sameBackOffice(approved.declaration,a)&&
        sameBackOffice(approved.scope,result.restrictiveScope)&&sameBackOffice(approved.requiredResources,a.scopes)&&
        sameBackOffice(approved.operation,{...a.service,capability:a.capability,effect:a.effect})&&sameBackOffice(approved.policyRequirements,result.policyRequirements),
      'BACKOFFICE.MIGRATION_REQUIRED',`Review exact BackOffice action ${entry.manifest.id}#${a.owner}/${a.id} while stopped`);
      actions.set(`${entry.manifest.id}#${a.owner}/${a.id}`,{entry,a,reference:approved.reference,scope:approved.scope});
    }
    for(const item of evidence.pages){
      const p=item.proposal,result=validateBackOfficePageEntry({proposal:p,entry,app,...facts});
      check(result.valid&&!pages.has(p.key)&&pages.size<256&&p.bindings.every(b=>{
        const a=actions.get(`${p.package}#${b.reference.instance}/${b.reference.action}`);return a&&sameBackOffice(a.reference,b.reference);
      }),'BACKOFFICE.MIGRATION_REQUIRED',`Review exact BackOffice Page entry for ${entry.manifest.id} while stopped`);
      pages.set(p.key,{entry,proposal:p,facts,reference:clean({schema:'wydgit.backoffice-page-reference/1',app,package:p.package,
        installation:p.installation,generation:p.generation,key:p.key,revision:policyHash({proposal:p,approval:evidence.approval,policy:entry.receipt.policyHash})})});
    }
  }
  check(head===stateFingerprint(root),'PACKAGE.STALE','Installation changed during admission');
  return {actions,pages,checkCurrent(){check(head===stateFingerprint(root),'ACTION.STALE','Installed BackOffice policy changed; restart after reviewed migration');}};
}
