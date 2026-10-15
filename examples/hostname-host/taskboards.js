// Install the existing server-target WBasic Taskboard through the public installer.
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from '../wbasic-taskboard/build.mjs';
import {compileDefinitions,loadRepository} from '../../wydgine/repository.js';
import {planPackageInstall,applyPackageInstall} from '../../wydgine/packages/index.js';
import {ExecutionContext} from '../../wydgine/seam/context.js';
export async function installTaskboards(base){
 const core=compileDefinitions(JSON.parse(await fs.readFile(new URL('../../prototypes/objects.json',import.meta.url))));
 const verifiedPackages={'divdev/wbasic-taskboard':'divdev'},built=await build({definitions:core,verifiedPackages});
 for(const [index,id] of ['app-alpha','app-beta'].entries()){
  const root=path.join(base,id),packagePath=path.join(root,'source-package');await fs.mkdir(packagePath);const manifest=structuredClone(built.manifest);manifest.resources.sources.select='select.bas';manifest.resources.sources.submit='submit.bas';manifest.permissions.capabilities.push('app.forms.submit');manifest.bindings.push({owner:'taskboard-routing-form',event:'Submit',source:'submit',kind:'action',method:'POST',capability:'app.forms.submit'});manifest.bindings.push({owner:'taskboard',event:'Page.PreRender',source:'select',kind:'handler'});
  await fs.writeFile(path.join(packagePath,'manifest.json'),JSON.stringify(manifest));for(const [file,text] of Object.entries(built.resources)){if(file===manifest.resources.template){const template=JSON.parse(text);template.slots.blocks.push({schema:'wydgit/0.2',id:'taskboard-routing-form',prototype:'wydgit.core/form',properties:{label:'Submit'},slots:{blocks:[{schema:'wydgit/0.2',id:'taskboard-routing-name',prototype:'wydgit.core/field',properties:{name:'Name',label:'Routing test name',required:true},slots:{},provenance:{}}]},provenance:{}});await fs.writeFile(path.join(packagePath,file),JSON.stringify(template));}else await fs.writeFile(path.join(packagePath,file),text);}await fs.writeFile(path.join(packagePath,'submit.bas'),'EVENT Submit\nCALL Me.Set("label", "Submitted through SEWN")\nEND EVENT');await fs.writeFile(path.join(packagePath,'select.bas'),`EVENT Page.PreRender\nCALL Me.SelectPage(${index===0?2:1})\nEND EVENT`);
  const model=loadRepository(root),ids=[];const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(model.runtime.rootId);
  await applyPackageInstall(await planPackageInstall({root,packagePath,placement:{page:'home',parent:'home',slot:'sections',index:1},approvals:manifest.permissions,storageMappings:{},verifiedPackages,installationContext:new ExecutionContext({publisher:'operator',self:'home',app:id,visible:[...ids,...manifest.permissions.visible],editable:[...ids,...manifest.permissions.visible],capabilities:['object.instances.edit']})}));
 }
 return Object.fromEntries(['app-alpha','app-beta'].map(id=>[id,{verifiedPackages}]));
}
