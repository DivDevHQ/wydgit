import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadRepository } from '../wydgine/repository.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
export async function packageFixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'wydpackage-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for(const name of ['content','prototypes','public'])await fs.cp(name,path.join(root,name),{recursive:true});
  const packagePath=path.join(root,'guestbook');await fs.cp('examples/guestbook',packagePath,{recursive:true});
  const manifest=JSON.parse(await fs.readFile(path.join(packagePath,'manifest.json'),'utf8'));
  const config=JSON.parse(await fs.readFile('wydgit.config.json','utf8'));const library=config.libraries.find(l=>l.id==='wydstore');
  await fs.mkdir(path.join(root,'data'));library.enabled=true;library.options={stores:[{id:'host-book',app:'boilerplate',publisher:'divdev',package:'divdev/guestbook',provider:'json',root:path.join(root,'data'),collections:[{id:'host-entries',fields:manifest.storage[0].fields}]}]};
  await fs.writeFile(path.join(root,'wydgit.config.json'),JSON.stringify(config));await fs.symlink(path.resolve('node_modules'),path.join(root,'node_modules'),'dir');
  const model=loadRepository(root),ids=[];const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(model.runtime.rootId);
  const options={root,packagePath,placement:{page:'home',parent:'home',slot:'sections',index:1},approvals:structuredClone(manifest.permissions),storageMappings:{entries:{store:'host-book',collection:'host-entries'}},installationContext:new ExecutionContext({publisher:'operator',self:'home',app:model.runtime.rootId,visible:[...ids,...manifest.permissions.visible],editable:[...ids,...manifest.permissions.visible],capabilities:['object.instances.edit']})};
  return {root,packagePath,manifest,config,options};
}
