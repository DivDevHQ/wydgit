import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { lifecycleFixture, writeJson } from './package-lifecycle.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { initializeHost } from '../wydgine/host.js';
import { loadRepository } from '../wydgine/repository.js';
import { activatePackages, packageOperation } from '../wydgine/packages/index.js';
export async function interruptedEffects(t,root,request) {
  const requestFile=path.join(root,'effects-request-'+randomUUID()+'.json');await writeJson(requestFile,request);
  const child=spawn(process.execPath,['test-support/package-effects-child.js',requestFile],{stdio:['ignore','ignore','pipe','ipc']});
  let diagnostics='';child.stderr.on('data',chunk=>diagnostics=(diagnostics+chunk).slice(-4000));
  t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Did not reach '+request.pauseAt+': '+diagnostics));},15000);
    child.once('message',()=>{clearTimeout(timer);resolve();});
    child.once('exit',(code,signal)=>{clearTimeout(timer);reject(Error('Effects writer exited '+code+'/'+signal+': '+diagnostics));});
  });
  const ended=once(child,'close');child.kill('SIGKILL');await ended;
}
export async function provisionFixture(t,provider) {
  const f=await lifecycleFixture(t),context=new ExecutionContext({context:'FrontEnd',...f.context,visible:[...f.context.visible,...f.manifest.permissions.visible],editable:[...f.context.editable,...f.manifest.permissions.visible]});
  const library=f.config.libraries.find(l=>l.id==='wydstore');library.enabled=false;delete library.options;
  await writeJson(path.join(f.root,'wydgit.config.json'),f.config);
  const policy={installationContext:JSON.parse(JSON.stringify(context)),approvals:f.manifest.permissions,storageMappings:{entries:{store:'new-book',collection:'entries'}},
    placement:{page:'page-book',parent:'page-book',slot:'sections',index:0},
    page:{schema:'wydgit/0.2',id:'page-book',prototype:'wydgit.core/page',properties:{title:'Book',slug:'provisioned'},slots:{},provenance:{}},
    properties:{'guestbook-form':{label:'Configured form'}},navigation:{id:'main-navigation',label:'Provisioned'},
    infrastructure:{enableWydstore:true,stores:[{id:'new-book',provider,location:'.wydgit-data/book',collections:[{id:'entries',fields:f.manifest.storage[0].fields}]}]}};
  return {...f,context,policy,options:{root:f.root,packagePath:f.packagePath,manifest:f.manifest,policy,installationContext:context}};
}
export async function storedFixture(t,provider,{extraCollection=false,multiple=false}={}) {
  const f=await lifecycleFixture(t),candidate=await f.candidate('a');
  const fields={text:{type:'string',required:true}};
  const schema={name:'entries',schemaId:'entries',schemaVersion:1,fields};
  const permissions={capabilities:['store.records.read','store.records.create','store.records.write','store.records.delete'],traversal:[],visible:['pkg-a'],editable:[],scopes:{wydstore:['entries']}};
  async function version(version='1.0.0',storage=schema,{renamedInstance=false}={}) {
    const manifest=JSON.parse(await fs.readFile(path.join(candidate.packagePath,'manifest.json'),'utf8'));
    Object.assign(manifest,{version,storage:[storage],requires:{schema:'wydgit.requirements/0.1',libraries:[{library:'wydstore',version:'^0.1.0-alpha.3'}]},permissions});
    await writeJson(path.join(candidate.packagePath,'manifest.json'),manifest);
    if(renamedInstance)await writeJson(path.join(candidate.packagePath,'prototypes.json'),[{id:'acme/a',publisher:'acme',extends:'wydgit.core/section',properties:{setting2:{type:'string',default:'new default'}},slots:{}}]);
    return {...candidate,approvals:permissions,storageMappings:{entries:{store:'store-a',collection:'records'}}};
  }
  if(multiple){
    const definitions=JSON.parse(await fs.readFile(path.join(candidate.packagePath,'prototypes.json'),'utf8'));
    definitions.push({id:'acme/item',publisher:'acme',extends:'wydgit.core/block',properties:{note:{type:'string',default:'initial'}},slots:{}});
    await writeJson(path.join(candidate.packagePath,'prototypes.json'),definitions);
    const template=JSON.parse(await fs.readFile(path.join(candidate.packagePath,'section.json'),'utf8'));
    template.slots.blocks.push({schema:'wydgit/0.2',id:'pkg-item',prototype:'acme/item',properties:{note:'Owner item',content:{type:'markdown',value:'Item content'}},slots:{},provenance:{}});
    template.slots.blocks.push({...template.slots.blocks[0],id:'pkg-item2'});
    await writeJson(path.join(candidate.packagePath,'section.json'),template);
    permissions.visible.push('pkg-item','pkg-item2');
  }
  const initial=await version();
  const store={id:'store-a',app:'boilerplate',publisher:'acme',package:'acme/a',provider,root:path.join(f.root,'data'),collections:[{id:'records',schemaId:'entries',schemaVersion:1,fields},...(extraCollection?[{id:'foreign',fields:{text:{type:'string'}}}]:[])]};
  f.config.libraries.find(l=>l.id==='wydstore').options={stores:[store]};await writeJson(path.join(f.root,'wydgit.config.json'),f.config);
  await packageOperation(f.operation('install','acme/a',[initial]));
  const binding=async()=>{
    const model=loadRepository(f.root),libraries=await initializeHost({root:f.root}),active=activatePackages(model,libraries,f.root);
    return libraries.bind(active.context({pageId:'page-a',session:{},ids:[]}));
  };
  const service=await binding(),input={store:'store-a',collection:'records',id:'content'};
  const created=await service.call('wydstore','create',{...input,data:{text:'Original content'}});if(!created.ok)throw Error(created.code);
  const updated=await service.call('wydstore','update',{...input,version:1,data:{text:'Customer edit'}});if(!updated.ok)throw Error(updated.code);
  const migration=(toVersion='2.0.0')=>({schema:'wydgit.package-migration/1',package:'acme/a',from:'1.0.0',to:toVersion,
    storage:[{name:'entries',from:1,to:2,fields:{body:{type:'string',required:true}},operations:[{op:'rename',from:'text',to:'body'}]}],instances:[]});
  const target={name:'entries',schemaId:'entries',schemaVersion:2,fields:{body:{type:'string',required:true}}};
  return {...f,store,initial,version,binding,input,migration,target};
}
