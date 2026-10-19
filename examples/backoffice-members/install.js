// Explicit native operator tool. The separately reviewed file approves package
// requirements; this tool never provisions accounts or changes Gate permissions.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRepository} from '../../wydgine/repository.js';
import {ExecutionContext} from '../../wydgine/seam/context.js';
import {packageOperation} from 'wydgine/trusted/packages';

export async function installMembers({root,approvals}){
  root=path.resolve(root);
  const packagePath=fileURLToPath(new URL('./',import.meta.url)),model=loadRepository(root),ids=[];
  const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(model.runtime.rootId);
  const page='page-backoffice-members',visible=[...new Set([...ids,page,'backoffice-members'])];
  const installationContext=new ExecutionContext({context:'BackOffice',publisher:'operator',self:model.runtime.rootId,app:model.runtime.rootId,
    capabilities:['packages.lifecycle.manage','packages.placement.manage','object.instances.edit'],visible,editable:visible});
  return packageOperation({root,action:'install',package:'divdev/backoffice-members',installationContext,candidates:[{
    packagePath,approvals,storageMappings:{},serverPlacement:{app:model.runtime.rootId,context:'BackOffice'},
    placement:{page,parent:page,slot:'sections',index:0},
    ...(model.pages.has(page)?{}:{page:{schema:'wydgit/0.2',id:page,prototype:'wydgit.core/page',properties:{title:'BackOffice action placement',slug:'backoffice-members-source'},slots:{},provenance:{}}})
  }]});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [root,approvalFile,...extra]=process.argv.slice(2);
  if(!root||!approvalFile||extra.length)throw Error('Usage: node examples/backoffice-members/install.js APP_ROOT REVIEWED_PERMISSIONS_JSON');
  await installMembers({root,approvals:JSON.parse(await fs.readFile(approvalFile,'utf8'))});
  console.log('Installed divdev/backoffice-members in BackOffice. No accounts or permissions were changed.');
}
