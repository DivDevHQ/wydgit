import fs from 'node:fs/promises';
import path from 'node:path';
import { packageFixture } from './packages.js';
import { loadRepository } from '../wydgine/repository.js';
import { dehydrate } from '../wydgine/object-model/index.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
export const writeJson=(file,value)=>fs.writeFile(file,JSON.stringify(value));
export async function lifecycleFixture(t){
  const fixture=await packageFixture(t),model=loadRepository(fixture.root),ids=[];
  const walk=node=>{ids.push(node.id);Object.values(node.slots).flat().forEach(walk);};walk(dehydrate(model.runtime));
  const context=new ExecutionContext({publisher:'operator',self:'home',app:'boilerplate',capabilities:['object.instances.edit','packages.lifecycle.manage'],visible:[...ids,'pkg-*','page-*'],editable:[...ids,'pkg-*','page-*']});
  const candidate=async(name,{version='1.0.0',dependencies={},publisher='acme'}={})=>{
    const packagePath=path.join(fixture.root,'candidate-'+name);await fs.mkdir(packagePath,{recursive:true});
    const permissions={capabilities:[],traversal:[],visible:['pkg-'+name],editable:[],scopes:{wydstore:[]}};
    const manifest={schema:'wydgit-package/0.1',id:publisher+'/'+name,publisher,version,platform:'>=0.3.0-alpha.1',runtime:['server'],
      dependencies,resources:{prototypes:'prototypes.json',template:'section.json',sources:{}},requires:{schema:'wydgit.requirements/0.1',libraries:[]},storage:[],permissions,bindings:[],installables:[{id:'main',kind:'section-template'}]};
    const template={schema:'wydgit/0.2',id:'pkg-'+name,prototype:publisher+'/'+name,properties:{},slots:{blocks:[]},provenance:{}};
    await writeJson(path.join(packagePath,'manifest.json'),manifest);
    await writeJson(path.join(packagePath,'prototypes.json'),[{id:publisher+'/'+name,publisher,extends:'wydgit.core/section',properties:{setting:{type:'string',default:'package default'}},slots:{}}]);
    await writeJson(path.join(packagePath,'section.json'),template);
    return {packagePath,approvals:permissions,placement:{page:'page-'+name,parent:'page-'+name,slot:'sections',index:0},page:{schema:'wydgit/0.2',id:'page-'+name,prototype:'wydgit.core/page',properties:{title:name,slug:name},slots:{},provenance:{}}};
  };
  return {...fixture,context,candidate,operation:(action,id,candidates=[],extra={})=>({root:fixture.root,action,package:id,candidates,installationContext:context,...extra})};
}
