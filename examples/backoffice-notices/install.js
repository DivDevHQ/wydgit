// Explicit native operator tool. Approvals and storage mappings are independently
// reviewed files. No Gate provisioning, host policy editing or service export.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRepository} from '../../wydgine/repository.js';
import {ExecutionContext} from '../../wydgine/seam/context.js';
import {packageOperation} from 'wydgine/trusted/packages';
export async function installNotices({root,approvals,storageMappings}){
  root=path.resolve(root);const packagePath=fileURLToPath(new URL('./',import.meta.url)),model=loadRepository(root),ids=[];
  const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(model.runtime.rootId);
  const page='page-backoffice-notices',visible=[...new Set([...ids,page,'backoffice-notices'])];
  const installationContext=new ExecutionContext({context:'BackOffice',publisher:'operator',self:model.runtime.rootId,app:model.runtime.rootId,
    capabilities:['packages.lifecycle.manage','packages.placement.manage','object.instances.edit'],visible,editable:visible});
  return packageOperation({root,action:'install',package:'divdev/backoffice-notices',installationContext,candidates:[{
    packagePath,approvals,storageMappings,serverPlacement:{app:model.runtime.rootId,context:'BackOffice'},placement:{page,parent:page,slot:'sections',index:0},
    ...(model.pages.has(page)?{}:{page:{schema:'wydgit/0.2',id:page,prototype:'wydgit.core/page',properties:{title:'BackOffice notices placement',slug:'backoffice-notices-source'},slots:{},provenance:{}}})
  }]});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [root,approvalFile,mappingFile,...extra]=process.argv.slice(2);
  if(!root||!approvalFile||!mappingFile||extra.length)throw Error('Usage: node examples/backoffice-notices/install.js APP_ROOT REVIEWED_PERMISSIONS_JSON REVIEWED_MAPPINGS_JSON');
  await installNotices({root,approvals:JSON.parse(await fs.readFile(approvalFile,'utf8')),storageMappings:JSON.parse(await fs.readFile(mappingFile,'utf8'))});
  console.log('Installed read-only operational notices. No accounts or Gate permissions were changed.');
}
