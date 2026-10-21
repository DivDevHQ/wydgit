// Shared real installed fixtures; no runtime behavior is replaced.
import {storeActionFixture} from './backoffice-store.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from '../examples/wbasic-taskboard/build.mjs';
import {packageFixture} from './packages.js';
import {compileDefinitions,loadRepository} from '../wydgine/repository.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {packageOperation} from '../wydgine/packages/index.js';
import {initializeHost} from '../wydgine/host.js';
export async function twoResourceActionFixture(t,provider){
  return storeActionFixture(t,provider,{edit(m){
    m.storage.push({name:'archive',fields:{text:{type:'string'}}});
    m.permissions.scopes.wydstore.push('archive');
    const get=m.backofficeActions.find(a=>a.id==='get'),create=m.backofficeActions.find(a=>a.id==='create');
    m.backofficeActions.push({...structuredClone(create),id:'transaction',capability:'store.records.write',
      service:{library:'wydstore',apiVersion:'1.0.0',operation:'transaction'},
      input:{type:'object',fields:{store:create.input.fields.store,collection:create.input.fields.collection,
        operations:{type:'array',maxItems:2,items:{type:'object',fields:{operation:{type:'string',maxLength:16},
          input:{type:'object',fields:{id:create.input.fields.id,data:create.input.fields.data,collection:create.input.fields.collection},optional:['collection']}}}}}},
      output:{type:'array',maxItems:2,items:create.output}});
    m.backofficeActions.push({...structuredClone(get),id:'archive-get',permission:'archive.action.read',scopes:{wydstore:['archive']}});
  },configure(f){
    const store=f.config.libraries.find(l=>l.id==='wydstore').options.stores.find(s=>s.id==='records');
    store.authorization.collections.records.transaction={contexts:['BackOffice'],permission:'content.records.write'};
    store.collections.push({id:'archive',fields:{text:{type:'string'}}});
    store.authorization.collections.archive={get:{contexts:['BackOffice'],permission:'archive.records.read'},create:{contexts:['BackOffice'],permission:'archive.records.write'}};
    f.candidate.storageMappings.archive={store:'records',collection:'archive'};
  }});
}

export async function installedTaskboardFixture(t){
  const f=await packageFixture(t),core=compileDefinitions(JSON.parse(await fs.readFile('prototypes/objects.json','utf8')));
  const b=await build({definitions:core,verifiedPackages:{'divdev/wbasic-taskboard':'divdev'}}),manifest=structuredClone(b.manifest);
  manifest.resources.sources.select='select.bas';manifest.bindings.push({owner:'taskboard',event:'Page.PreRender',source:'select',kind:'handler'});
  await fs.writeFile(path.join(f.packagePath,'manifest.json'),JSON.stringify(manifest));
  for(const [file,text] of Object.entries(b.resources))await fs.writeFile(path.join(f.packagePath,file),text);
  await fs.writeFile(path.join(f.packagePath,'select.bas'),'EVENT Page.PreRender\nCALL Me.SelectPage(2)\nEND EVENT');
  const verifiedPackages={[manifest.id]:manifest.publisher},app=loadRepository(f.root).runtime.rootId;
  const operator=new ExecutionContext({...f.options.installationContext,visible:[...f.options.installationContext.visible,...manifest.permissions.visible],
    editable:[...f.options.installationContext.editable,...manifest.permissions.visible],capabilities:['object.instances.edit','packages.lifecycle.manage','packages.placement.manage','packages.placement.relocate']});
  const candidate={...f.options,installationContext:operator,approvals:manifest.permissions,storageMappings:{},verifiedPackages,serverPlacement:{app,context:'FrontEnd'}};
  const operation=action=>packageOperation({root:f.root,action,package:manifest.id,candidates:[candidate],installationContext:operator,verifiedPackages});
  await operation('install');
  const libraries=await initializeHost({root:f.root});t.after(()=>libraries.close());
  return {...f,manifest,verifiedPackages,app,operator,operation,libraries};
}
