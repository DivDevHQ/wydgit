// Installed example application with genuine Store/Gate and reviewed bindings.
import fs from 'node:fs/promises';
import path from 'node:path';
import {actionFixture,installMembershipLogin} from './backoffice.js';
import {adoptionFixture} from './backoffice-adoption.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {initializeHost} from '../wydgine/host.js';
import {createGate} from '@wydgit/gate/client';
import {b5Binding} from './backoffice-b5.js';

export async function b6Fixture(t,provider='json'){
  const manifest=JSON.parse(await fs.readFile('examples/backoffice-editors/manifest.json'));
  const f=adoptionFixture(await actionFixture(t,provider,{
    edit:m=>Object.assign(m,structuredClone(manifest)),
    async configure(f){
      await f.libraries.close();
      f.candidate.packagePath=path.resolve('examples/backoffice-editors');
      const ids=[...f.operator.visible,...manifest.permissions.visible];
      f.operator=new ExecutionContext({...f.operator,visible:ids,editable:ids});
      const root=path.join(f.root,'workspace');await fs.mkdir(root);
      const rules=Object.fromEntries(['get','query','create','update'].map(op=>[op,{contexts:['BackOffice'],permission:['get','query'].includes(op)?'content.workspace.read':'content.workspace.write'}]));
      f.config.libraries.find(l=>l.id==='wydstore').options.stores.push({id:'workspace',app:'boilerplate',publisher:manifest.publisher,package:manifest.id,provider,root,collections:[{id:'workspace',fields:manifest.storage[0].fields}],authorization:{schema:'wydstore.authorization/1',collections:{workspace:rules}}});
      f.candidate.storageMappings={workspace:{store:'workspace',collection:'workspace'}};
      await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify(f.config));
      f.libraries=await initializeHost({root:f.root});f.gate=createGate(f.libraries.bind(f.gateContext));
    }
  }));
  await installMembershipLogin(f);
  f.permissions=['content.pages.view','content.workspace.read','content.workspace.write'];
  f.grant=permissions=>f.gate.assignUser({userId:f.user.account.id,roles:[],permissions});await f.grant(f.permissions);
  f.publish=async()=>{
    const bind=(id,name,consumer,fixedInput,usage='intent')=>({...b5Binding(f,id,name,usage,fixedInput),consumer});
    const target={store:'workspace',collection:'workspace',id:'home'};
    const p={...f.proposal(),key:'workspace',bindings:[
      bind('get','preview',f.entry().instance,target,'prepare'),
      bind('get','load','workspace-editor',target),bind('update','save','workspace-editor',target),
      bind('query','dashboard','workspace-dashboard',{store:'workspace',collection:'workspace',limit:10})
    ]};await f.adopt(f.payload(undefined,[p]));
  };
  const review=f.review;f.review=plan=>{f.reviewBytes=Buffer.byteLength(JSON.stringify(plan));return review(plan);};
  await f.publish();
  const api=f.framework(),create=(await f.discover(api)).find(a=>a.name==='create');
  const seed=await api.invoke({...f.request,reference:create.reference,input:{store:'workspace',collection:'workspace',id:'home',data:{title:'Workspace',columns:false,body:'Welcome to the workspace.'}},confirmed:true});
  if(!seed.ok)throw Error(JSON.stringify(seed));return f;
}

export async function b6ModulesFixture(t,provider='json'){
  const {modulesFixture,noticeManifest}=await import('./backoffice-modules.js');
  const f=adoptionFixture(await modulesFixture(t,provider));await installMembershipLogin(f);
  await f.adopt(f.payload(undefined,[{...f.proposal(),key:'members',bindings:[b5Binding(f,'list-members','members','intent',{limit:5})]}]));
  f.manifest=noticeManifest;f.operator=f.noticesOperator;adoptionFixture(f);
  await f.adopt(f.payload(undefined,[{...f.proposal(),key:'notices',bindings:[b5Binding(f,'list-notices','notices','intent',{store:'operations',collection:'notices',limit:5})]}]));
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.pages.view','gate.members.manage','operations.notices.read']});return f;
}
