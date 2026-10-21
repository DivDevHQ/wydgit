// Trusted disposable installation helpers. No production approval is performed.
import * as trusted from 'wydgine/trusted/packages';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {readInstalledState} from '../wydgine/packages/state.js';
import {loadRepository} from '../wydgine/repository.js';
import {backOfficePageFacts} from '../packages/wydgine/src/engine/packages/backoffice-adoption.js';
export function adoptionFixture(f){
  f.operator=new ExecutionContext({...f.operator,capabilities:[...f.operator.capabilities,'packages.policy.manage']});
  f.state=()=>readInstalledState(f.root);
  f.entry=()=>f.state().packages.find(e=>e.manifest.id===f.manifest.id);
  f.preflight=(extra={})=>trusted.inspectBackOfficeMigration({root:f.root,libraries:f.libraries,installationContext:f.operator,verifiedPackages:f.verifiedPackages??{},...extra});
  f.proposal=()=>{const e=f.entry();return {schema:'wydgit.backoffice-page-entry-proposal/1',key:'administration',app:e.executionPlacement.app,
    package:e.manifest.id,installation:e.receipt.id,owner:e.instance,page:e.placement.page,generation:e.executionPlacement.generation,
    policyRevision:e.policyRevision??0,permission:'content.pages.view',bindings:[]};};
  f.pageFacts=()=>backOfficePageFacts(loadRepository(f.root,{verifiedPackages:f.verifiedPackages??{}}),f.entry());
  f.payload=(ids=f.entry().manifest.backofficeActions?.map(a=>a.id)??[],proposals=[])=>{
    const report=f.preflight({pageProposals:proposals});
    if(report.status==='blocked')throw Error(JSON.stringify(report));
    return {actions:ids.map(id=>{const a=report.actions.find(a=>a.package===f.manifest.id&&a.action===id);return {reference:a.reference,contractHash:a.contractHash,scope:a.restrictiveScope};}),
      // Multiple entry keys can publish the same Page. Obtain each candidate's
      // own digest rather than accidentally reusing the first Page's digest.
      pages:proposals.map(proposal=>({proposal,contractHash:trusted.validateBackOfficePageEntry({proposal,entry:f.entry(),app:f.entry().executionPlacement.app,...f.pageFacts()}).contractHash}))};
  };
  f.policyRequest=backoffice=>{const s=f.state(),e=f.entry();return {root:f.root,app:e.executionPlacement.app,package:e.manifest.id,installation:e.receipt.id,
    revision:s.revision,packageRevision:e.receipt.revision,policyRevision:e.policyRevision??0,policy:{grants:e.approved,stores:[],...(backoffice===undefined?{}:{backoffice})},installationContext:f.operator};};
  f.plan=payload=>trusted.planPackagePolicy(f.policyRequest(payload));
  f.review=plan=>trusted.approvePackagePolicy(plan,{installationContext:f.operator,allowExpansion:true});
  f.finish=approval=>({root:f.root,app:approval.plan.app,package:approval.plan.package,installation:approval.plan.installation,
    revision:approval.revision,packageRevision:approval.plan.packageRevision,policyRevision:approval.plan.policyRevision,approval:approval.id,planHash:approval.plan.sha256,installationContext:f.operator});
  f.apply=(approval,options)=>trusted.applyPackagePolicy(f.finish(approval),options);
  f.adopt=async payload=>{const approval=await f.review(await f.plan(payload));await f.apply(approval);return approval;};
  f.inspect=()=>trusted.inspectPackagePolicy({root:f.root,app:f.entry().executionPlacement.app,package:f.manifest.id,installation:f.entry().receipt.id,installationContext:f.operator});
  return f;
}
