import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ExecutionContext, validObjectGrant, matchesObjectGrant, objectGrantCovers } from '../wydgine/seam/context.js';
import { hydrate, dehydrate } from '../wydgine/object-model/index.js';
import { loadRepository } from '../wydgine/repository.js';
import { descendantFields } from '../wydgine/object-model/forms.js';
import { webModel } from '../wydgine/web-model.js';
import { compile } from '../wydgine/wydbasic/index.js';
import { execute } from '../wydgine/sewn/execute.js';
import { planPackageInstall, applyPackageInstall, activatePackages, validatePackageManifest } from '../wydgine/packages/index.js';
import { permissions } from '../wydgine/packages/manifest.js';
import { initializeHost } from '../wydgine/host.js';
import { createLifecycle } from '../wydgine/execution/lifecycle.js';
import { mountClient } from '../wydclient/index.js';
import { packageFixture } from '../test-support/packages.js';
import { fixture, envelope, runPage } from '../test-support/events.js';
const dynamicIds=['guestbook-entry-20','guestbook-entry-200','guestbook-entry-abc123'];
const malformed=['*','foo*','-*','*-entry','guest*-entry','guestbook-*-item','guestbook-entry-**','guestbook-entry-?','entry-[abc]','entry-{a,b}','entry-(a|b)','entry-+*','entry-\\d*','entry-^*',''];
const grant='guestbook-entry-*';
const context=extra=>new ExecutionContext({publisher:'operator',app:'boilerplate',self:'home',visible:['home','section',grant],editable:['home','section',grant],capabilities:['object.instances.edit'],traversal:['children'],...extra});
function graph() {
  const base=fixture(),raw=dehydrate(base.model.runtime);
  raw.slots.pages[0].slots.sections[0].slots.blocks=dynamicIds.map(id=>envelope(id,'block',{content:{type:'markdown',value:'Original'}}));
  return {...base,runtime:hydrate(raw,base.model.registry)};
}

test('object grants preserve exact matches and accept only literal nonempty trailing prefixes',()=>{
  assert.equal(matchesObjectGrant(['foo'],'foo'),true);assert.equal(matchesObjectGrant(['foo'],'foo-bar'),false);
  for(const id of dynamicIds)assert.equal(matchesObjectGrant([grant],id),true);
  for(const id of ['guestbook-entry','guestbook-entr','guestbook-entryX-20','guestbook-entries-20','other-guestbook-entry-20','guestbook-entry-20/secret'])assert.equal(matchesObjectGrant([grant],id),false);
  assert.equal(matchesObjectGrant(['cart-line-*'],'cart-line-200'),true);
  assert.equal(matchesObjectGrant(['comment-*'],'comment-abc'),true);
  assert.equal(matchesObjectGrant(['a.b-*'],'a.b-c'),true);assert.equal(matchesObjectGrant(['a.b-*'],'axb-c'),false);
  assert.equal(validObjectGrant('foo*'),false);assert.equal(matchesObjectGrant(['foo*'],'foobar'),false);
  assert.equal(validObjectGrant('-*'),false);assert.equal(validObjectGrant('foo-*'),true);
  for(const value of malformed){assert.equal(validObjectGrant(value),false);assert.equal(matchesObjectGrant([value],'guestbook-entry-200'),false);for(const field of ['visible','editable'])assert.throws(()=>context({[field]:[value]}),{code:'SEAM.CONTEXT'});}
  assert.throws(()=>context({self:'*'}),{code:'SEAM.CONTEXT'});
  assert.throws(()=>context({visible:Array(10001).fill('foo')}),{code:'SEAM.CONTEXT'});
  assert.equal(objectGrantCovers(['guestbook-*'],grant),true);
  assert.equal(objectGrantCovers(['guestbook-entry-'],'guestbook-entry-*'),false);
  assert.equal(objectGrantCovers([grant],'guestbook-entry-20'),true);
  assert.equal(objectGrantCovers(['guestbook-entry-20'],grant),false);
});

test('runtime scoped handles, filtering and mutations match future IDs but retain capability/traversal/edit separation',()=>{
  const {runtime}=graph();const ctx=context();
  const children=runtime.scope(ctx,'section').related('children','blocks');assert.deepEqual(children.map(n=>n.id),dynamicIds);
  const edit=runtime.edit(ctx);for(const id of dynamicIds)edit.setProperty(id,'content',{type:'markdown',value:'Changed'});const changed=edit.commit().runtime;
  for(const id of dynamicIds)assert.equal(changed.get(id).properties.content.value,'Changed');
  const add=changed.edit(ctx);add.insertChild('section','blocks',3,envelope('guestbook-entry-new','block',{content:{type:'markdown',value:'Future'}}));assert.equal(add.commit().runtime.get('guestbook-entry-new').properties.content.value,'Future');
  assert.throws(()=>runtime.scope(context({traversal:[]}),'section').related('children'),{code:'SEAM.TRAVERSAL'});
  assert.throws(()=>runtime.scope(context({visible:['home','section','guestbook-entry-20']}),'guestbook-entry-200'),{code:'SEAM.VISIBILITY'});
  const filtered=runtime.scope(context({visible:['section','guestbook-entry-20']}),'section').related('children','blocks');assert.deepEqual(filtered.map(n=>n.id),[dynamicIds[0]]);
  assert.throws(()=>runtime.edit(context({capabilities:[]})),{code:'MUTATION.DENIED'});
  assert.throws(()=>runtime.edit(context({editable:[]})).setProperty(dynamicIds[0],'content',{type:'markdown',value:'Denied'}),{code:'MUTATION.DENIED'});
  assert.throws(()=>runtime.edit(context({visible:['home','section']})).setProperty(dynamicIds[0],'content',{type:'markdown',value:'Denied'}),{code:'MUTATION.DENIED'});
  assert.throws(()=>children[0].requireCapability('store.records.create'),{code:'SEAM.DENIED'});
  assert.equal(ctx.capabilities.includes('object.instances.construct'),false);
  assert.equal(runtime.get(dynamicIds[0]).properties.content.value,'Original');
});

function formGraph() {
  const base=fixture(),raw=dehydrate(base.model.runtime);
  raw.slots.pages[0].slots.sections[0].slots.blocks=[envelope('guestbook-form','form',{}, {blocks:[envelope(dynamicIds[1],'text-input',{name:'name',label:'Name'})]})];
  const runtime=hydrate(raw,base.model.registry),ctx=context({visible:['home','section','guestbook-form',grant],editable:['guestbook-form',grant]});
  return {...base,runtime,model:webModel(runtime,base.model),context:ctx};
}

test('Page handles, Submit action visibility and server Form traversal/edit checks accept wildcard fields',async()=>{
  const base=formGraph(),handlers=[{owner:'guestbook-form',type:'Page.Load',wydBasic:'CALL Me.Bind({"name":"Ada"})'}];
  assert.deepEqual(descendantFields(base.runtime,base.model.registry,'guestbook-form',base.context).map(n=>n.id),[dynamicIds[1]]);
  const good=await runPage({...base,handlers});assert.equal(good.error,null);assert.match(good.transport.text,/value="Ada"/);
  const traverse=await runPage({...base,handlers,context:new ExecutionContext({...base.context,traversal:[]})});assert.equal(traverse.error.code,'SEAM.TRAVERSAL');
  const edit=await runPage({...base,handlers,context:new ExecutionContext({...base.context,editable:['guestbook-form']})});assert.equal(edit.error.code,'MUTATION.DENIED');
  // Route a wildcard-visible Form owner as well as fields through the existing POST action.
  const raw=dehydrate(base.runtime);raw.slots.pages[0].slots.sections[0].slots.blocks[0].id='guestbook-entry-form';const runtime=hydrate(raw,base.model.registry);
  const result=await runPage({...base,model:webModel(runtime,base.model),context:context({capabilities:['object.instances.edit','app.forms.submit'],editable:[grant]}),input:{method:'POST',form:new URLSearchParams({_target:'guestbook-entry-form',_action:'Submit',_csrf:'c'.repeat(64),name:'Posted'}).toString(),action:{target:'guestbook-entry-form',type:'Submit',csrf:'c'.repeat(64),payload:{}}},actions:[{page:'home',target:'guestbook-entry-form',type:'Submit',method:'POST',capability:'app.forms.submit',wydBasic:'CALL Me.Clear()'}]});
  assert.equal(result.error,null);assert.doesNotMatch(result.transport.text,/value="Posted"/);
});

test('client visibility and Form edits share object matching; client action resource scope stays exact',async()=>{
  class Control extends EventTarget {value='';}
  const prototypeRegistry=loadRepository(process.cwd()).registry;
  const nodes=()=>[{id:'guestbook-form',kind:'form',prototype:'wydgit.core/form',element:new Control(),properties:{}},{id:dynamicIds[1],parent:'guestbook-form',kind:'field',prototype:'wydgit.core/text-input',element:new Control(),properties:{name:'name',label:'Name'}}];
  const ctx=context({self:'guestbook-form',visible:['guestbook-form',grant],editable:['guestbook-form',grant],capabilities:['object.instances.edit','client.actions.submit'],scopes:{actions:['guestbook-*']}});
  const controls=nodes(),client=mountClient({nodes:controls,prototypeRegistry,context:ctx,handlers:[{owner:'guestbook-form',type:'Client.Ready',wydBasic:'CALL Me.Bind({"name":"Client Ada"})'}]});
  await client.ready;assert.equal(controls[1].element.value,'Client Ada');
  controls[0].element.dispatchEvent(new Event('submit',{cancelable:true}));await client.idle();assert.equal(client.error(),'EVENT.DENIED');await client.unmount();
  for(const [extra,code] of [[{editable:['guestbook-form']},'SEAM.DENIED'],[{traversal:[]},'SEAM.TRAVERSAL']]){const denied=mountClient({nodes:nodes(),prototypeRegistry,context:new ExecutionContext({...ctx,...extra}),handlers:[{owner:'guestbook-form',type:'Client.Ready',wydBasic:'CALL Me.Bind({"name":"Denied"})'}]});await assert.rejects(denied.ready,{code});}
});

test('wildcard visibility/editability cannot authorize prototype construction or library resource scopes',async t=>{
  const {root}=await packageFixture(t),prototypeRegistry=loadRepository(root).registry;
  const source='DIM entry AS Wydgit\nSET entry = NEW "acme/message-panel"("guestbook-entry-200")\nRETURN entry.id';
  await assert.rejects(execute(compile(source),{prototypeRegistry,context:context(),scope:{}}),{code:'SEAM.DENIED'});
  await assert.rejects(execute(compile(source),{prototypeRegistry,context:context({capabilities:['object.instances.construct'],scopes:{prototypes:['acme/*']}}),scope:{}}),{code:'SEAM.DENIED'});
  const allowed=context({capabilities:['object.instances.construct'],scopes:{prototypes:['acme/message-panel']}});assert.equal((await execute(compile(source),{prototypeRegistry,context:allowed,scope:{}})).value,dynamicIds[1]);assert.equal(allowed.allows('object.instances.edit'),false);
  const libraries=await initializeHost({root}),input={store:'host-book',collection:'host-entries'};
  const noCapability=new ExecutionContext({publisher:'divdev',package:'divdev/guestbook',app:'boilerplate',self:'home',visible:[grant],editable:[grant],scopes:{wydstore:[input]}});assert.equal((await libraries.bind(noCapability).call('wydstore','query',input)).code,'SEAM.DENIED');
  const noResource=new ExecutionContext({...noCapability,capabilities:['store.records.read'],scopes:{wydstore:[{store:'host-*',collection:'host-*'}]}});assert.equal((await libraries.bind(noResource).call('wydstore','query',input)).ok,false);
});

test('Guestbook installation/activation use approved wildcard scopes for IDs beyond old range',async t=>{
  const {root,packagePath,options,manifest}=await packageFixture(t);
  assert.equal(manifest.permissions.visible.filter(id=>id.startsWith('guestbook-entry-')).join(),grant);
  assert.ok(options.installationContext.visible.includes(grant));assert.ok(options.installationContext.editable.includes(grant));
  const file=path.join(packagePath,'section.json'),template=JSON.parse(await fs.readFile(file,'utf8')),entries=template.slots.blocks.find(n=>n.id==='guestbook-entries');
  for(const id of dynamicIds)entries.slots.blocks.push({schema:'wydgit/0.2',id,prototype:'divdev/guestbook-entry',properties:{},slots:{},provenance:{}});
  await fs.writeFile(file,JSON.stringify(template));const plan=await planPackageInstall(options);assert.ok(plan.approved.visible.includes(grant));assert.ok(plan.approved.editable.includes(grant));
  await applyPackageInstall(plan);const model=loadRepository(root),active=activatePackages(model,await initializeHost({root}),root),ctx=active.context({pageId:'home',session:{},ids:[]});
  const edit=model.runtime.edit(ctx);for(const id of dynamicIds){assert.equal(model.runtime.scope(ctx,id).id,id);edit.setProperty(id,'content',{type:'markdown',value:'Dynamic entry'});}edit.commit();
  assert.equal(ctx.package,'divdev/guestbook');assert.equal(ctx.allows('store.records.delete'),false);
  const policy=JSON.parse(await fs.readFile('examples/guestbook-policy.example.json','utf8'));for(const grants of [policy.approvals,policy.installationContext])for(const key of ['visible','editable'])assert.deepEqual(grants[key].filter(id=>id.startsWith('guestbook-entry-')),[grant]);
});

test('package policies reject malformed/overbroad object patterns and require separately approved patterns',async t=>{
  const {root,packagePath,manifest,options}=await packageFixture(t);
  for(const value of malformed)for(const key of ['visible','editable']){const m=structuredClone(manifest);m.permissions[key].push(value);assert.throws(()=>validatePackageManifest(m),{code:'PACKAGE.MANIFEST'});}
  const p={capabilities:[],traversal:[],visible:['guestbook-*'],editable:[grant],scopes:{wydstore:[]}};assert.doesNotThrow(()=>permissions(p));assert.throws(()=>permissions({...p,visible:['guestbook-entry-']}),{code:'PACKAGE.MANIFEST'});
  await assert.rejects(planPackageInstall({...options,approvals:{...options.approvals,visible:[...options.approvals.visible,'other-*']}}),{code:'PACKAGE.DENIED'});
  // An approved prefix must not reach an existing object owned outside the template.
  const pageFile=path.join(root,'content/pages/home.json'),page=JSON.parse(await fs.readFile(pageFile,'utf8'));page.slots.sections[0].slots.blocks.push(envelope('guestbook-entry-outsider','block',{content:{type:'markdown',value:'Outside'}}));await fs.writeFile(pageFile,JSON.stringify(page));
  await assert.rejects(planPackageInstall(options),{code:'PACKAGE.DENIED'});
  // Pattern owners still name concrete objects, never wildcard event recipients.
  const invalidOwner=structuredClone(manifest);invalidOwner.bindings[0].owner=grant;assert.throws(()=>validatePackageManifest(invalidOwner),{code:'PACKAGE.MANIFEST'});
});

test('lifecycle object visibility uses wildcard grants without broadening lifecycle capability policy',async()=>{
  let called=0;const app=dynamicIds[1],ctx=new ExecutionContext({publisher:'operator',self:'operator',app,visible:[grant]});
  const lifecycle=createLifecycle({app,context:ctx,handlers:[{owner:dynamicIds[1],type:'Server.Start',run:function(){assert.equal(this.ME.id,dynamicIds[1]);called++;}}]});await lifecycle.start();assert.equal(called,1);await lifecycle.stop();
  const denied=createLifecycle({app,context:ctx,handlers:[{owner:dynamicIds[1],type:'Server.Start',capability:'store.records.create',run:function(){}}]});await denied.start();assert.equal(denied.errors()[0].code,'SEAM.DENIED');
});
