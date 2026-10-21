import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from '../examples/wbasic-taskboard/build.mjs';
import {packageFixture} from '../test-support/packages.js';
import {compileDefinitions,loadRepository} from '../wydgine/repository.js';
import {ExecutionContext,checkContext} from '../wydgine/seam/context.js';
import {packageOperation,executionPlacement,acquirePackageExecution,activatePackages} from '../wydgine/packages/index.js';
import {readInstalledState} from '../wydgine/packages/state.js';
import {initializeHost} from '../wydgine/host.js';
import {executePage} from '../wydgine/execution/page.js';

// Independent native Page qualification only. There is no BackOffice HTTP route,
// Page permission, component action bridge or synthetic administrative caller here.
test('BOB1-03: installed neutral composed Page uses receipt authority in both contexts and fences old generations',async t=>{
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
  const current=()=>readInstalledState(f.root).packages[0];
  const acquire=(entry=current())=>acquirePackageExecution({root:f.root,app,package:manifest.id,installation:entry.receipt.id,generation:entry.executionPlacement.generation,self:'taskboard',installationContext:operator,verifiedPackages});
  const place=action=>{const state=readInstalledState(f.root),entry=state.packages[0];return executionPlacement({root:f.root,app,package:manifest.id,installation:entry.receipt.id,revision:state.revision,action,context:'BackOffice',installationContext:operator,verifiedPackages});};
  const render=async context=>{
    const model=loadRepository(f.root,{verifiedPackages}),bindings=activatePackages(model,libraries,f.root);
    // Native host-only root binding mirrors the public adapter's Page self. It
    // preserves the acquired receipt/lifetime; it defines no HTTP admission rule.
    context=new ExecutionContext({...context,self:bindings.pages.get('home').placement.page,placement:context});
    const result=await executePage({model,pageId:'home',context,session:{view:{id:'native-session',app},active:()=>true,authorize:async()=>{}},input:{method:'GET',path:'/'},handlers:bindings.handlers,libraries});
    assert.equal(result.error,null,JSON.stringify(result.error));assert.deepEqual(result.cleanupErrors,[]);
    const output={chunks:[],setHeader(){},getHeader(){},write(v){this.chunks.push(Buffer.from(v));return true;},end(v){if(v)this.chunks.push(Buffer.from(v));},on(){},once(){},removeListener(){}};
    try{await result.response.send(output);const html=Buffer.concat(output.chunks).toString();assert.match(html,/Verify lifecycle cleanup/);assert.doesNotMatch(html,/Write WBasic/);return html;}
    finally{await result.response.close();}
  };
  const front=acquire(),source=current();assert.equal(front.context,'FrontEnd');await render(front);
  await place('relocate');assert.throws(()=>checkContext(front),{code:'SEAM.CONTEXT'});assert.throws(()=>acquire(source),{code:'PACKAGE.STALE'});
  const administrative=acquire();assert.equal(administrative.context,'BackOffice');await render(administrative);
  const bindings=activatePackages(loadRepository(f.root,{verifiedPackages}),libraries,f.root);
  assert.throws(()=>bindings.context({pageId:'home',session:{},ids:['home','taskboard']}),{code:'EXECUTION.PLACEMENT'});
  assert.throws(()=>checkContext({...administrative}),{code:'SEAM.CONTEXT'});
  manifest.version='0.1.1';await fs.writeFile(path.join(f.packagePath,'manifest.json'),JSON.stringify(manifest));await operation('update');
  assert.throws(()=>checkContext(administrative),{code:'SEAM.CONTEXT'});const upgraded=acquire();await render(upgraded);
  await place('retire');assert.throws(()=>checkContext(upgraded),{code:'SEAM.CONTEXT'});assert.throws(()=>acquire(),{code:'PACKAGE.STALE'});
});
