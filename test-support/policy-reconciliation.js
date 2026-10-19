import {lifecycleFixture} from './package-lifecycle.js';
import {storedFixture} from './package-effects.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {readInstalledState} from '../wydgine/packages/state.js';
import {packageOperation,planPackagePolicy,approvePackagePolicy,applyPackagePolicy} from '../wydgine/packages/index.js';
export async function policyFixture(t,provider) {
  const f=provider?await storedFixture(t,provider):await lifecycleFixture(t);
  if(!provider)await packageOperation(f.operation('install','acme/a',[await f.candidate('a')]));
  f.operator=new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'packages.policy.manage','packages.placement.manage']});
  f.state=()=>readInstalledState(f.root);
  f.entry=()=>f.state().packages.find(e=>e.manifest.id==='acme/a');
  f.request=(grants=f.entry().approved,stores=[])=>({root:f.root,app:'boilerplate',package:'acme/a',installation:f.entry().receipt.id,revision:f.state().revision,packageRevision:f.entry().receipt.revision,policyRevision:f.entry().policyRevision??0,policy:{grants,stores},installationContext:f.operator});
  f.finish=approval=>({root:f.root,app:approval.plan.app,package:approval.plan.package,installation:approval.plan.installation,revision:approval.revision,packageRevision:approval.plan.packageRevision,policyRevision:approval.plan.policyRevision,approval:approval.id,planHash:approval.plan.sha256,installationContext:f.operator});
  f.plan=(grants,stores)=>planPackagePolicy(f.request(grants,stores));
  f.review=(plan,allowExpansion=false)=>approvePackagePolicy(plan,{installationContext:f.operator,allowExpansion});
  f.apply=approval=>applyPackagePolicy(f.finish(approval));
  f.reconcile=async(grants,stores,expanded=false)=>f.apply(await f.review(await f.plan(grants,stores),expanded));
  return f;
}
