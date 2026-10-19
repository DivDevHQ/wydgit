import fs from 'node:fs/promises';
import path from 'node:path';
import {membershipFixture} from './membership.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {packageOperation,executionPlacement} from '../wydgine/packages/index.js';
import {readInstalledState} from '../wydgine/packages/state.js';
import {createBackOfficeActions} from 'wydgine/trusted/packages';
export const plain=x=>JSON.parse(JSON.stringify(x));
export const catalog=f=>readInstalledState(f.root);
export async function actionFixture(t,provider='json',{install=true,edit=()=>{},configure=async()=>{},app='boilerplate'}={}) {
  const f=await membershipFixture(t,provider,'open',false,{app});
  t.after(()=>f.libraries.close());
  const packagePath=path.join(f.root,'admin-package');await fs.cp('examples/backoffice-members',packagePath,{recursive:true});
  const manifest=JSON.parse(await fs.readFile(path.join(packagePath,'manifest.json')));edit(manifest);
  await fs.writeFile(path.join(packagePath,'manifest.json'),JSON.stringify(manifest));
  const ids=[...f.options.installationContext.visible,'page-admin','backoffice-members'];
  f.operator=new ExecutionContext({...f.options.installationContext,capabilities:['object.instances.edit','packages.lifecycle.manage','packages.placement.manage','packages.placement.relocate'],visible:ids,editable:ids});
  f.candidate={packagePath,approvals:manifest.permissions,storageMappings:{},placement:{page:'page-admin',parent:'page-admin',slot:'sections',index:0},
    page:{schema:'wydgit/0.2',id:'page-admin',prototype:'wydgit.core/page',properties:{title:'Administration',slug:'administration'},slots:{},provenance:{}},serverPlacement:{app,context:'BackOffice'}};
  await configure(f);
  f.operation=(action,candidates=[])=>({root:f.root,package:manifest.id,action,candidates,installationContext:f.operator});
  f.place=(action,context='BackOffice')=>{const state=catalog(f),entry=state.packages.find(p=>p.manifest.id===manifest.id);return executionPlacement({root:f.root,package:manifest.id,installation:entry.receipt.id,revision:state.revision,app,action,context,installationContext:f.operator});};
  f.framework=()=>createBackOfficeActions({root:f.root,libraries:f.libraries,installationContext:f.operator});
  if(install)await packageOperation(f.operation('install',[f.candidate]));
  const registered=await f.gate.register({username:'alice',password:f.password});
  await f.gate.manageMember({id:registered.membership.id,role:'administrator'});
  await f.gate.assignUser({userId:registered.account.id,roles:[],permissions:['gate.members.manage']});
  f.login=await f.gate.login('alice',f.password);f.user=registered;
  f.request={app,session:f.login.token};f.manifest=manifest;
  f.discover=async framework=>{const result=await framework.discover(f.request);if(!result.ok)throw Error(JSON.stringify(result));return result.value.actions;};
  f.invoke=(framework,reference,input={})=>framework.invoke({...f.request,reference,input});
  return f;
}

// Explicit disposable test installation. Provisioning remains a trusted fixture
// step; the membership package itself neither creates admins nor approves grants.
export async function installMembershipLogin(f){
  const directory=path.resolve('examples/membership'),manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json')));
  const ids=[...f.operator.visible,...manifest.permissions.visible,'page-login'];
  const operator=new ExecutionContext({...f.operator,visible:ids,editable:ids});
  await packageOperation({root:f.root,package:manifest.id,action:'install',installationContext:operator,candidates:[{
    packagePath:directory,approvals:manifest.permissions,storageMappings:{},placement:{page:'page-login',parent:'page-login',slot:'sections',index:0},
    page:{schema:'wydgit/0.2',id:'page-login',prototype:'wydgit.core/page',properties:{title:'Sign in',slug:'sign-in'},slots:{},provenance:{}}
  }]});
}
