// Explicit disposable-fixture migration. Never called by production startup.
import {adoptionFixture} from './backoffice-adoption.js';
import {readInstalledState} from '../wydgine/packages/state.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
export async function reviewFixture(f){
  for(const entry of readInstalledState(f.root)?.packages??[]){
    if(entry.executionPlacement?.context!=='BackOffice'||entry.executionPlacement.status!=='active'||!entry.manifest.backofficeActions?.length)continue;
    const ids=[...new Set([...f.operator.visible,...entry.approved.visible,entry.placement.page])];
    const target=adoptionFixture({...f,manifest:entry.manifest,operator:new ExecutionContext({...f.operator,visible:ids,editable:ids})});
    if(!target.inspect().backoffice.eligibleForEnforcement)await target.adopt(target.payload());
  }return f;
}
export async function reviewedFramework(f){await reviewFixture(f);return f.framework();}
