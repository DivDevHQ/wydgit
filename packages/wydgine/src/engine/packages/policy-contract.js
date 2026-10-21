// Durable catalog evidence shared by policy planning, startup and recovery.
import { createHash } from 'node:crypto';
import { clean, record, requireThat as check } from '../object-model/validation.js';
import { fields } from '../libraries/contracts.js';
export const policyHash=value=>createHash('sha256').update(JSON.stringify(clean(value))).digest('hex');
export const approvedPolicyHash=(entry,app)=>policyHash({app,installation:entry.receipt.id,package:entry.manifest.id,publisher:entry.manifest.publisher,revision:entry.policyRevision,approved:entry.approved,storageMappings:entry.storageMappings,storageScopes:entry.storageScopes,libraryScopes:entry.libraryScopes??{},...(entry.receipt.backofficeHash===undefined?{}:{backofficeHash:entry.receipt.backofficeHash})});
export const policyPlanHash=plan=>{const value=clean(plan);delete value.sha256;return policyHash(value);};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function authorizePolicy(context,app,authorizeLifecycle) {
  authorizeLifecycle(context,app);
  check(context.runat==='Server'&&context.installation===null,'PACKAGE.DENIED','Native host policy authority required');
  context.require('packages.policy.manage');
}
export function validatePolicyMetadata(state) {
  const entries=[...state.packages,...(state.retained??[]).map(r=>r.entry)];
  for(const entry of entries) {
    validateBackOfficeMetadata(entry);
    check(entry.policyRevision===undefined?entry.receipt.policyRevision===undefined&&entry.receipt.policyHash===undefined:
      state.schema==='wydgit-installed/0.4'&&Number.isSafeInteger(entry.policyRevision)&&entry.policyRevision>0&&entry.policyRevision===entry.receipt.policyRevision,
      'PACKAGE.CATALOG','Invalid approved policy revision');
    if(entry.policyRevision!==undefined)check(entry.receipt.policyHash===approvedPolicyHash(entry,JSON.parse(state.app).id),'PACKAGE.DRIFT','Approved policy differs from its receipt integrity evidence');
  }
  const pending=state.policyReconciliation;
  check(state.schema==='wydgit-installed/0.4'||pending===undefined&&state.policyHistory===undefined,'PACKAGE.CATALOG','Reviewed policy requires catalog 0.4');
  if(pending!==undefined) {
    fields(pending,['schema','id','plan','reviewer','approvedAt'],'PACKAGE.CATALOG');
    const p=pending.plan,entry=state.packages.find(e=>e.manifest.id===p?.package);
    check(pending.schema==='wydgit.policy-approval/1'&&typeof pending.id==='string'&&/^[a-f0-9-]{36}$/.test(pending.id)&&record(p)&&p.schema==='wydgit.package-policy-plan/1'&&sha(p.sha256)&&p.sha256===policyPlanHash(p)&&p.app===JSON.parse(state.app).id&&entry?.receipt.id===p.installation&&entry.receipt.revision===p.packageRevision&&(entry.policyRevision??0)===p.policyRevision&&p.proposedPolicyRevision===p.policyRevision+1&&state.revision===p.revision+1&&record(pending.reviewer)&&typeof pending.reviewer.publisher==='string'&&typeof pending.reviewer.self==='string'&&typeof pending.approvedAt==='string',
      'PACKAGE.CATALOG','Invalid reviewed policy binding');
    const source=clean(state);delete source.policyReconciliation;source.schema=p.sourceSchema;source.revision=p.revision;
    check(policyHash(source)===p.sourceStateHash,'PACKAGE.DRIFT','Approved source state changed');
  }
  if(state.policyHistory!==undefined)check(Array.isArray(state.policyHistory)&&state.policyHistory.length<=32&&state.policyHistory.every(h=>record(h)&&h.schema==='wydgit.policy-outcome/1'&&['APPLIED','CANCELLED'].includes(h.status)&&sha(h.plan?.sha256)&&h.plan.sha256===policyPlanHash(h.plan)&&typeof h.approval==='string'&&record(h.reviewer)&&record(h.caller)),'PACKAGE.CATALOG','Invalid policy audit history');
}

export function validateBackOfficeMetadata(entry){
  if(entry.backoffice===undefined){check(entry.receipt.backofficeHash===undefined,'PACKAGE.DRIFT','Missing BackOffice evidence');return;}
  const e=entry.backoffice;
  check(entry.policyRevision!==undefined&&record(e)&&e.schema==='wydgit.backoffice-adoption/1'&&['adopted','revoked'].includes(e.status)&&
    record(e.binding)&&Array.isArray(e.actions)&&e.actions.length<=32&&Array.isArray(e.pages)&&e.pages.length<=32&&
    Array.isArray(e.revokedSubjects)&&e.revokedSubjects.length<=256&&record(e.reviewer)&&typeof e.approval==='string'&&
    typeof e.approvedAt==='string'&&typeof e.planHash==='string'&&entry.receipt.backofficeHash===policyHash(e),'PACKAGE.DRIFT','Invalid BackOffice adoption integrity evidence');
}
