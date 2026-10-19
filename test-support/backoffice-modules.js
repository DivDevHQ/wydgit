// Disposable, explicitly trusted test provisioning; no live credentials or data.
import fs from 'node:fs/promises';
import path from 'node:path';
import {actionFixture} from './backoffice.js';
import {noticeStore} from '../examples/backoffice-notices/configuration.js';
import {installNotices} from '../examples/backoffice-notices/install.js';
import noticeManifest from '../examples/backoffice-notices/manifest.json' with {type:'json'};
import {initializeHost} from '../wydgine/host.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {createGate} from '@wydgit/gate/client';
export {noticeManifest};
export async function modulesFixture(t,provider='json',app='boilerplate'){
  const f=await actionFixture(t,provider,{app,configure:async f=>{
    await f.libraries.close();const root=path.join(f.root,'operations');await fs.mkdir(root);
    f.config.libraries.find(l=>l.id==='wydstore').options.stores.push(noticeStore({app,root,provider}));
    await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify(f.config));
    f.libraries=await initializeHost({root:f.root});f.gate=createGate(f.libraries.bind(f.gateContext));
  }});
  f.noticesReceipt=await installNotices({root:f.root,approvals:noticeManifest.permissions,storageMappings:{notices:{store:'operations',collection:'notices'}}});
  f.noticesInput={store:'operations',collection:'notices',limit:5};
  f.noticesOperator=new ExecutionContext({...f.operator,visible:[...f.operator.visible,'backoffice-notices','page-backoffice-notices'],editable:[...f.operator.editable,'backoffice-notices','page-backoffice-notices']});
  // Native fixture seeding is independent of the package's read-only receipt.
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['gate.members.manage','operations.notices.read','operations.notices.write']});
  const resolved=await f.gate.resolveSession(f.login.token);
  const seed=new ExecutionContext({context:'BackOffice',publisher:'divdev',package:noticeManifest.id,installation:f.noticesReceipt.id,self:'backoffice-notices',app,identity:resolved,
    capabilities:['store.records.create'],scopes:{wydstore:[{store:'operations',collection:'notices'}]}});
  const inserted=await f.libraries.bind(seed).invoke('wydstore','1.0.0','create',{store:'operations',collection:'notices',id:'local-check',data:{title:'Local qualification',level:'info',active:true,message:'Disposable operational notice; no live system state.'}});
  if(!inserted.ok)throw Error('Fixture notice seeding failed: '+inserted.code);
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['gate.members.manage','operations.notices.read']});
  return f;
}
