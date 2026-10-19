import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { packageFixture } from './packages.js';
import { configuration } from './wydgate.js';
import { installPackage } from '../wydgine/packages/index.js';
import { initializeHost } from '../wydgine/host.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createGate } from '@wydgit/gate/client';
import { manifest } from '@wydgit/gate';
export async function membershipFixture(t,provider='json',registration='open',install=true,hostOptions={}) {
  const f=await packageFixture(t);f.packagePath=path.resolve('examples/membership');f.manifest=JSON.parse(await fs.readFile(path.join(f.packagePath,'manifest.json')));
  const app=hostOptions.app??'boilerplate';
  if(app!=='boilerplate'){
    const file=path.join(f.root,'content/app.json'),data=JSON.parse(await fs.readFile(file));data.id=app;await fs.writeFile(file,JSON.stringify(data));
  }
  if(hostOptions.administration){
    const copy=path.join(f.root,'membership-package');await fs.cp(f.packagePath,copy,{recursive:true});f.packagePath=copy;
    f.manifest.permissions.capabilities.push('gate.members.manage');f.manifest.permissions.visible.push('membership-member-list');
    const section=JSON.parse(await fs.readFile(path.join(copy,'section.json')));section.slots.blocks.push({schema:'wydgit/0.2',id:'membership-member-list',prototype:'divdev/member-list',properties:{},slots:{},provenance:{}});
    await fs.writeFile(path.join(copy,'manifest.json'),JSON.stringify(f.manifest));await fs.writeFile(path.join(copy,'section.json'),JSON.stringify(section));
  }
  const gateRoot=path.join(f.root,'gate');await fs.mkdir(gateRoot);
  const config=configuration(gateRoot,provider,{registration});const gateConfig=config.libraries[0],store=config.libraries[1].options.stores[0];
  Object.assign(gateConfig.options,hostOptions.options??{});gateConfig.options.app=app;gateConfig.bindings[0].app=app;store.app=app;
  f.config={schema:'wydgit.host/0.1',libraries:config.libraries};await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify(f.config));
  f.options={...f.options,packagePath:f.packagePath,approvals:f.manifest.permissions,storageMappings:{},installationContext:new ExecutionContext({context:'FrontEnd',publisher:'operator',self:'home',app,visible:[...f.options.installationContext.visible,...f.manifest.permissions.visible,app],editable:[...f.options.installationContext.visible,...f.manifest.permissions.visible,app],capabilities:['object.instances.edit']})};
  if(install)f.receipt=await installPackage(f.options);
  f.libraries=await initializeHost({root:f.root,adapters:hostOptions.adapter?{wydgate:hostOptions.adapter}: {}});
  f.gateContext=new ExecutionContext({context:'FrontEnd',publisher:'host',package:'host:gate',self:'home',app,capabilities:manifest.capabilities,scopes:{wydgate:[app],wydgateBootstrap:[app]}});
  f.gate=createGate(f.libraries.bind(f.gateContext));
  f.password=randomBytes(24).toString('base64url');
  f.memberGate=identity=>createGate(f.libraries.bind(new ExecutionContext({context:'FrontEnd',publisher:'divdev',package:'divdev/membership',installation:f.receipt?.id??'test-install',self:'membership',app,identity,capabilities:['gate.accounts.use','gate.members.use'],scopes:{wydgate:[app]}})));
  return f;
}
