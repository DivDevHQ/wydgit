import test from 'node:test';
import {once} from 'node:events';
import {createHostApp} from '../app.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from '../examples/wbasic-taskboard/build.mjs';
import {compileFamily,compile} from '../wydgine/wydbasic/index.js';
import {compileDefinitions,loadRepository} from '../wydgine/repository.js';
import {PrototypeRegistry,hydrate,ExecutionContext} from '../wydgine/object-model/index.js';
import {createInstanceController} from '../wydgine/execution/instances.js';
import {executePage} from '../wydgine/execution/page.js';
import {renderComponent} from '../wydgine/components.js';
import {planPackageInstall,applyPackageInstall} from '../wydgine/packages/index.js';
import {packageFixture} from '../test-support/packages.js';
const core=compileDefinitions(JSON.parse(readFileSync('prototypes/objects.json','utf8')));
const e=(id,prototype,properties={},slots={})=>({schema:'wydgit/0.2',id,prototype,properties,slots,provenance:{}});
const prepare=async()=>build({definitions:core,verifiedPackages:{'divdev/wbasic-taskboard':'divdev'}});
function host(b,overrides={}) {
 const definitions=[...core,...b.definitions],registry=new PrototypeRegistry(definitions,{verifiedPrototypes:Object.fromEntries(definitions.map(d=>[d.id,d.publisher]))});
 const runtime=hydrate(e('app','wydgit.core/app',{title:'App',home:'page'},{pages:[e('page','wydgit.core/page',{title:'Page',slug:''},{sections:[b.template]})]}),registry);
 const context=new ExecutionContext({publisher:'divdev',self:'page',app:'app',...b.manifest.permissions,...overrides});
 return {runtime,registry,context,controller:createInstanceController({runtime,registry,context,rootId:b.template.id})};
}
const list=c=>c.snapshot().slots.pages[0].slots.sections[0].slots.blocks.find(n=>n.prototype==='divdev/task-list');
const cardHTML=(b,c)=>{const registry=new PrototypeRegistry([...core,...b.definitions]);return list(c).slots.blocks.map(card=>renderComponent({id:card.id,...card.properties,presentation:registry.get(card.prototype).presentation},null,{},'/',s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'))).join('');};

test('Taskboard: full source family builds, validates, executes typed navigation, bindings and keyed child lifecycle',async()=>{
 const b=await prepare(),{controller:c}=host(b);await c.activate();
 assert.equal(b.definitions.length,6);assert.equal(list(c).slots.blocks.length,2);assert.deepEqual(list(c).slots.blocks.map(n=>n.properties.Key),['alpha','beta']);
 const original=list(c).slots.blocks.map(n=>n.id);assert.ok(original.every(id=>c.inspect(id).properties.InitCount===1));
 assert.match(cardHTML(b,c),/Write WBasic/);await c.render();assert.ok(original.every(id=>c.inspect(id).properties.Stage==='Rendered'));
 await c.invoke('taskboard','SelectPage',[2]);assert.equal(c.inspect('taskboard').properties.CurrentPage,2);assert.equal(list(c).slots.blocks.length,1);
 for(const id of original){assert.equal(c.status(id),'disposed');assert.equal(c.inspect(id).properties.Stage,'Disposed');await assert.rejects(c.invoke(id,'AnyMethod'));}
 await c.render();assert.match(cardHTML(b,c),/Verify lifecycle cleanup/);assert.doesNotMatch(cardHTML(b,c),/Write WBasic/);
 const current=list(c).slots.blocks[0].id;await c.page('Load');assert.equal(c.inspect('taskboard').properties.LoadCount,1);
 await c.unload();assert.equal(c.status('taskboard'),'initialized');assert.equal(c.inspect(current).properties.Stage,'Unloaded');await assert.rejects(c.invoke('taskboard','SelectPage',[1]));
 await c.activate();assert.equal(c.inspect(current).properties.InitCount,1);await c.invoke('taskboard','SelectPage',[3]);assert.equal(list(c).slots.blocks.length,0);
 await c.dispose();await c.dispose();assert.equal(c.status('taskboard'),'disposed');assert.deepEqual(c.errors(),[]);
});

test('Taskboard installs from generated canonical resources, executes through the real Page path and cleans up',async t=>{
 const b=await prepare(),fixture=await packageFixture(t);await fs.writeFile(path.join(fixture.packagePath,'manifest.json'),JSON.stringify(b.manifest));for(const [file,text] of Object.entries(b.resources))await fs.writeFile(path.join(fixture.packagePath,file),text);
 const model=loadRepository(fixture.root),ids=[];const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(model.runtime.rootId);
 const verifiedPackages={[b.manifest.id]:'divdev'},options={...fixture.options,verifiedPackages,approvals:b.manifest.permissions,storageMappings:{},installationContext:new ExecutionContext({publisher:'operator',self:'home',app:model.runtime.rootId,visible:[...ids,...b.manifest.permissions.visible],editable:[...ids,...b.manifest.permissions.visible],capabilities:['object.instances.edit']})};
 const plan=await planPackageInstall(options);await applyPackageInstall(plan);const installed=loadRepository(fixture.root,{verifiedPackages});
 const context=new ExecutionContext({publisher:'divdev',package:b.manifest.id,self:'home',app:installed.runtime.rootId,...b.manifest.permissions});
 const result=await executePage({model:installed,pageId:'home',context,session:{view:{id:'session',app:installed.runtime.rootId},active:()=>true,authorize:async()=>{}},input:{method:'GET',path:'/'},handlers:[{owner:'taskboard',type:'Page.PreRender',workflow:compile('CALL Me.SelectPage(2)')},{owner:'taskboard',type:'Page.PreRender',run:function(){assert.equal(this.ME.properties.CurrentPage,1,'typed raises wait for remaining Page handlers');}}],render:async projection=>{const taskboard=projection.pages.get('home').sections.find(n=>n.id==='taskboard'),cards=taskboard.blocks.find(n=>n.id==='taskboard-List').blocks;assert.equal(taskboard.CurrentPage,2);assert.equal(taskboard.LoadCount,1);assert.equal(cards.length,1);assert.equal(cards[0].Stage,'Rendered');return {html:renderComponent(cards[0],null,{},'/',s=>String(s)),status:200};}});
 assert.equal(result.error,null);assert.deepEqual(result.cleanupErrors,[]);
 const rendered=await executePage({model:installed,pageId:'home',context,session:{view:{id:'session',app:installed.runtime.rootId},active:()=>true,authorize:async()=>{}},input:{method:'GET',path:'/'},handlers:[{owner:'taskboard',type:'Page.PreRender',workflow:compile('CALL Me.SelectPage(2)')}]});
 assert.equal(rendered.error,null);const transport={headers:{},chunks:[],setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];},write(v){this.chunks.push(Buffer.from(v));return true;},end(v){if(v)this.chunks.push(Buffer.from(v));},on(){},once(){},removeListener(){}};await rendered.response.send(transport);const html=Buffer.concat(transport.chunks).toString();assert.match(html,/Verify lifecycle cleanup/);assert.doesNotMatch(html,/Write WBasic/);

 await fs.rm(fixture.packagePath,{recursive:true});assert.equal(loadRepository(fixture.root,{verifiedPackages}).runtime.get('taskboard').prototype,'divdev/taskboard');
});

test('Taskboard: typed payloads, missing event/construct/edit authority, private handlers and hostile data fail closed',async()=>{
 const b=await prepare();for(const permission of ['event.custom.raise','object.instances.construct','object.instances.edit']){
  const h=host(b,{capabilities:b.manifest.permissions.capabilities.filter(c=>c!==permission)});if(permission==='event.custom.raise'){await h.controller.activate();await assert.rejects(h.controller.invoke('taskboard','SelectPage',[2]));assert.equal(h.controller.inspect('taskboard').properties.CurrentPage,1);}else await assert.rejects(h.controller.activate());await h.controller.dispose();
 }
 const {controller:c}=host(b);await c.activate();await assert.rejects(c.invoke('taskboard','SelectPage',['2']));await assert.rejects(c.invoke('taskboard','OnPageChanged',[2]));await assert.rejects(c.invoke('taskboard','Dispose',[]));
 const old=list(c).slots.blocks.map(n=>n.id);
 await assert.rejects(c.workflow(compile('Me.Tasks = [{"Key":"same","Title":"One","Status":"Pending"},{"Key":"same","Title":"Two","Status":"Pending"}]'),{},'taskboard-List'));
 assert.deepEqual(list(c).slots.blocks.map(n=>n.id),old);
 await assert.rejects(c.workflow(compile('Me.Tasks = [{"Key":"bad","Title":"One","Status":"Invalid"}]'),{},'taskboard-List'));
 await assert.rejects(c.workflow(compile('Me.Tasks = [{"Key":"bad","Title":1,"Status":"Pending"}]'),{},'taskboard-List'));
 await c.dispose();
 const foreignContext=new ExecutionContext({publisher:'divdev',self:'page',app:'wrong',...b.manifest.permissions});const h=host(b);assert.throws(()=>createInstanceController({runtime:h.runtime,registry:h.registry,context:foreignContext,rootId:'taskboard'}));
});

test('closed component validator rejects forged relationships, inaccessible bindings and unsupported privileged host sources',async()=>{
 const b=await prepare();for(const mutate of [d=>d.component.subscriptions[0].source='Server',d=>d.component.subscriptions[0].source='Session',d=>d.component.subscriptions[0].source='App',d=>d.component.children[0].slot='constructor',d=>d.component.children[0].type='evil/missing',d=>d.component.subscriptions[0].handler='missing']){const ds=structuredClone(b.definitions);mutate(ds.find(d=>d.id==='divdev/taskboard'));assert.throws(()=>new PrototypeRegistry([...core,...ds]));}
 for(const mutate of [d=>d.component.repeaters[0].limit=0,d=>d.component.repeaters[0].limit=10000,d=>d.component.templates[0].bindings[0].input='Missing',d=>d.properties.Tasks.access='private']){const ds=structuredClone(b.definitions);mutate(ds.find(d=>d.id==='divdev/task-list'));assert.throws(()=>new PrototypeRegistry([...core,...ds]));}
});

function simple(body,limits={},services) {
 const manifest=JSON.parse(readFileSync('examples/source-components/manifest.json','utf8'));manifest.permissions={capabilities:['object.instances.edit','event.custom.raise','test.echo.read'],traversal:['children'],visible:['simple'],editable:['simple'],scopes:{wydstore:[],events:['tick']}};
 const b=compileFamily({'simple.bas':`PUBLIC CLASS Simple EXTENDS wydgit.core/section\nMETA Id = "divdev/simple"\nPUBLIC PROPERTY Value AS Number = 0\n${body}\nEND CLASS`},{manifest,definitions:core,verifiedPackages:{[manifest.id]:'divdev'},entry:{id:'simple',type:'divdev/simple'}});
 const h=host(b,{limits});if(services)h.controller=createInstanceController({runtime:h.runtime,registry:h.registry,context:h.context,rootId:'simple',services:services(h.context)});return h;
}
test('lifecycle Init-once, failure closure, throwing Dispose and event recursion share fatal budgets',async()=>{
 const init=simple('PROTECTED OVERRIDE SUB Init()\nDIM data AS Object = SERVICES.Call("wydtest","echo",{})\nMe.Value = data.value\nEND SUB',{},()=>({Call:async()=>({value:'bad'})}));await assert.rejects(init.controller.activate());assert.equal(init.controller.status('simple'),'disposed');await assert.rejects(init.controller.invoke('simple','Any'));await init.controller.dispose();
 const failed=simple('PROTECTED OVERRIDE SUB Preload()\nDIM n AS Object = SERVICES.Call("wydtest","echo",{})\nEND SUB',{},()=>({Call:async()=>{throw new Error('secret');}}));await assert.rejects(failed.controller.activate());assert.equal(failed.controller.status('simple'),'disposed');
 const throwing=simple('PROTECTED OVERRIDE SUB Dispose()\nDIM n AS Object = SERVICES.Call("wydtest","echo",{})\nEND SUB',{},()=>({Call:async()=>{throw new Error('secret');}}));await throwing.controller.activate();await throwing.controller.dispose();await throwing.controller.dispose();assert.equal(throwing.controller.status('simple'),'disposed');assert.doesNotMatch(JSON.stringify(throwing.controller.errors()),/secret/);
 const storm=simple('PUBLIC EVENT Tick()\nPUBLIC SUB StartStorm()\nRAISE EVENT Tick()\nEND SUB\nPRIVATE SUB OnTick()\nRAISE EVENT Tick()\nEND SUB\nBIND EVENT Me.Tick TO Me.OnTick',{sewnSteps:50});await storm.controller.activate();await assert.rejects(storm.controller.invoke('simple','StartStorm'),{code:'SEWN.LIMIT'});await storm.controller.dispose();
});

test('disposal cancels an awaited service and prevents later mutations or resurrection',async()=>{
 let release;const h=simple('PUBLIC SUB Pending()\nDIM n AS Object = SERVICES.Call("wydtest","echo",{})\nMe.Value = 99\nEND SUB',{},()=>({Call:()=>new Promise(resolve=>release=resolve)}));await h.controller.activate();const running=h.controller.invoke('simple','Pending');while(!release)await new Promise(r=>setImmediate(r));const disposing=h.controller.dispose();release({});await assert.rejects(running);await disposing;assert.equal(h.controller.status('simple'),'disposed');assert.equal(h.controller.inspect('simple').properties.Value,0);await assert.rejects(h.controller.invoke('simple','Pending'));await h.controller.dispose();
});

test('whole Taskboard family: independent canonical JSON/SEWN golden has identical structure and executable behavior',async()=>{
 const authored=await prepare(),definitions=JSON.parse(readFileSync('test/fixtures/taskboard/golden.json','utf8'));
 assert.deepEqual(JSON.parse(JSON.stringify(authored.definitions)),definitions);
 const golden={...authored,definitions};
 const observations=[];for(const artifact of [authored,golden]){const {controller:c}=host(artifact);await c.activate();const first=cardHTML(artifact,c);await c.invoke('taskboard','SelectPage',[2]);await c.render();const second=cardHTML(artifact,c);const current=c.inspect('taskboard');await c.dispose();observations.push({first,second,current,errors:c.errors()});}assert.deepEqual(observations[0],observations[1]);
});

test('verified App-root Server and Session wiring uses the existing host lifecycle and explicit SEAM subscription policy',async()=>{
 const {compileClass}=await import('../wydgine/wydbasic/index.js');const {createLifecycle}=await import('../wydgine/execution/lifecycle.js');
 const manifest=JSON.parse(readFileSync('examples/source-components/manifest.json','utf8')),source='PUBLIC CLASS HostApp EXTENDS wydgit.core/app\nMETA Id = "divdev/host-app"\nPUBLIC PROPERTY Started AS Boolean = FALSE\nPUBLIC PROPERTY Sessions AS Number = 0\nPRIVATE SUB OnStart()\nMe.Started = EVENT.Source IS Me\nEND SUB\nPRIVATE SUB OnSession()\nMe.Sessions = Me.Sessions + 1\nEND SUB\nBIND EVENT Server.Start TO Me.OnStart\nBIND EVENT Session.Start TO Me.OnSession\nEND CLASS';
 const options={manifest,definitions:core,verifiedPackages:{[manifest.id]:'divdev'}};assert.throws(()=>compileClass(source,options),{code:'WYDBASIC.TARGET'});
 const definition=compileClass(source,{...options,hostEvents:true}).definition,ds=[...core,definition],registry=new PrototypeRegistry(ds,{verifiedPrototypes:Object.fromEntries(ds.map(d=>[d.id,d.publisher]))}),runtime=hydrate(e('app',definition.id,{title:'App',home:'page'},{pages:[e('page','wydgit.core/page',{title:'Page',slug:''})]}),registry);
 const context=new ExecutionContext({publisher:'operator',self:'app',app:'app',capabilities:['object.instances.edit','event.lifecycle.subscribe'],editable:['app'],scopes:{events:['server.start','session.start']}}),instances=createInstanceController({runtime,registry,context,rootId:'app'});await instances.activate();
 const lifecycle=createLifecycle({app:'app',context,instances});await lifecycle.start();await lifecycle.start();await lifecycle.session({app:'app',type:'Start',session:{id:'session',app:'app',authenticated:false}});assert.equal(instances.inspect('app').properties.Started,true);assert.equal(instances.inspect('app').properties.Sessions,1);assert.deepEqual(lifecycle.errors(),[]);await lifecycle.stop();assert.equal(instances.status('app'),'disposed');await lifecycle.stop();
 const deniedContext=new ExecutionContext({publisher:'operator',self:'app',app:'app',editable:['app'],capabilities:['object.instances.edit'],scopes:{events:['server.start']}}),denied=createInstanceController({runtime,registry,context:deniedContext,rootId:'app'});await denied.activate();const noGrant=createLifecycle({app:'app',context:deniedContext,instances:denied});await noGrant.start();assert.equal(denied.inspect('app').properties.Started,false);assert.equal(noGrant.errors()[0].code,'SEAM.DENIED');await denied.dispose();
});

test('keyed reordering keeps identity and Init count; removed keys receive new live identities',async()=>{
 const b=await prepare(),{controller:c}=host(b);await c.activate();const original=list(c).slots.blocks.map(n=>n.id);
 await c.workflow(compile('Me.Tasks = [{"Key":"beta","Title":"Test canonical artifacts","Status":"Pending"},{"Key":"alpha","Title":"Write WBasic","Status":"Complete"}]'),{},'taskboard-List');assert.deepEqual(list(c).slots.blocks.map(n=>n.id),original.toReversed());assert.ok(original.every(id=>c.inspect(id).properties.InitCount===1));
 await c.invoke('taskboard','SelectPage',[2]);await c.invoke('taskboard','SelectPage',[1]);assert.ok(list(c).slots.blocks.every(n=>!original.includes(n.id)));assert.ok(original.every(id=>c.status(id)==='disposed'));await c.dispose();
});

test('canonical hostile metadata, forged entry tokens and inherited private event handlers cannot establish authority',async()=>{
 const {execute}=await import('../wydgine/sewn/execute.js');const b=await prepare(),h=host(b);
 await assert.rejects(execute(null,{scope:{},context:h.context,prototypeRegistry:h.registry,entry:{owner:'divdev/taskboard',name:'onpagechanged'}}),{code:'OBJECT.ACCESS'});
 for(const component of [{schema:'wydgit.component/0.20',children:[],subscriptions:[],templates:{}},{schema:'wydgit.component/0.20',children:[],subscriptions:[],repeaters:null},{schema:'wydgit.component/0.20',children:[],subscriptions:[{source:'Me',event:'Fake',handler:'selectpage',owner:'wydgit.core/app'}]}]){
  const ds=structuredClone(b.definitions);ds.find(d=>d.id==='divdev/taskboard').component=component;assert.throws(()=>new PrototypeRegistry([...core,...ds]),{code:'PROTOTYPE.COMPONENT'});
 }
 const noEvents=host(b,{scopes:{wydstore:[],prototypes:['divdev/task-card'],events:[]}});await noEvents.controller.activate();await assert.rejects(noEvents.controller.invoke('taskboard','SelectPage',[2]),{code:'EVENT.DENIED'});await noEvents.controller.dispose();
});

test('source slot acceptance/cardinality contracts validate and cannot weaken inherited class slots',async()=>{
 const b=await prepare(),manifest=b.manifest,definitions=[...core,...b.definitions],sources={'derived.bas':'PUBLIC CLASS Derived EXTENDS divdev/task-list\nMETA Id = "divdev/derived-list"\nSLOT blocks ACCEPTS ["wydgit.core/block"] MIN 0 MAX 100\nEND SLOT\nEND CLASS'};
 assert.throws(()=>compileFamily(sources,{manifest,definitions,verifiedPackages:{[manifest.id]:'divdev'},entry:{id:'derived',type:'divdev/derived-list'}}));
 assert.throws(()=>compileFamily({'derived.bas':'PUBLIC CLASS Derived EXTENDS divdev/taskboard\nMETA Id = "divdev/derived-board"\nEND CLASS'},{manifest,definitions,verifiedPackages:{[manifest.id]:'divdev'},entry:{id:'derived',type:'divdev/derived-board'}}),{code:'DEFINITION.DEPENDENCY'});
});

test('canonical default composition rejects cycles and overfull slots independently of the source compiler',async()=>{
 const b=await prepare();for(const change of [d=>d.component.children=[{name:'Self',type:d.id,slot:'blocks',properties:{}}],d=>{d.slots.blocks={accepts:['wydgit.core/block','wydgit.core/section'],ordered:true,min:0,max:1};}]){const ds=structuredClone(b.definitions);change(ds.find(d=>d.id==='divdev/taskboard'));assert.throws(()=>new PrototypeRegistry([...core,...ds]),{code:'PROTOTYPE.COMPONENT'});}
});

test('family diagnostics locate invalid typed template and bounded repetition declarations',async()=>{
 const b=await prepare(),source=readFileSync('examples/wbasic-taskboard/task-list.bas','utf8'),others=Object.fromEntries(await Promise.all(['task-record.bas','task-model.bas','task-card.bas','navigation.bas','taskboard.bas'].map(async file=>[file,await fs.readFile(new URL('../examples/wbasic-taskboard/'+file,import.meta.url),'utf8')])));
 for(const [text,line] of [[source.replace('INPUT "divdev/task-record" KEY Key','INPUT "divdev/task-record" KEY Missing'),6],[source.replace('LIMIT 8','LIMIT 0'),11]]){assert.throws(()=>compileFamily({...others,'task-list.bas':text},{manifest:b.manifest,definitions:core,verifiedPackages:{[b.manifest.id]:'divdev'},entry:{id:'taskboard',type:'divdev/taskboard'}}),error=>error.details.file==='task-list.bas'&&error.details.line===line&&typeof error.code==='string');}
});

test('new component artifacts require the executing runtime version and reject client execution claims',async()=>{
 const {validateComponentPlatform}=await import('../wydgine/packages/manifest.js');const b=await prepare();
 assert.throws(()=>validateComponentPlatform({...b.manifest,platform:'>=0.3.0-alpha.1 <0.4.0'},b.definitions),{code:'PACKAGE.VERSION'});
 assert.throws(()=>validateComponentPlatform({...b.manifest,runtime:['server','client']},b.definitions),{code:'PACKAGE.RUNTIME'});
 validateComponentPlatform(b.manifest,b.definitions);
 assert.throws(()=>compileFamily({'derived.bas':'PUBLIC CLASS Derived EXTENDS divdev/task-navigation\nMETA Id = "divdev/derived-navigation"\nEND CLASS'},{manifest:{...b.manifest,runtime:['server','client']},definitions:[...core,...b.definitions],verifiedPackages:{[b.manifest.id]:'divdev'},entry:{id:'derived',type:'divdev/derived-navigation'}}),{code:'PACKAGE.RUNTIME'});
});

test('child teardown precedes parent teardown and a failing child Dispose cannot skip host cleanup',async()=>{
 const b=await prepare(),definitions=structuredClone(b.definitions),log=[];
 const record={op:'service',library:'wydtest',method:'echo',input:{op:'object',fields:{id:{op:'read',target:{op:'context',name:'ME'},key:'id'}}},into:'receipt'};
 for(const d of definitions){d.lifecycle.Dispose??={schema:'sewn/0.3',body:[],procedures:{dispose:{kind:'sub',params:[],body:[]}}};d.lifecycle.Dispose.procedures.dispose.body.push(structuredClone(record));}
 const h=host({...b,definitions},{capabilities:[...b.manifest.permissions.capabilities,'test.echo.read']}),c=createInstanceController({runtime:h.runtime,registry:h.registry,context:h.context,rootId:'taskboard',services:{async Call(library,method,input){h.context.require('test.echo.read');log.push(input.id);if(input.id.includes('beta'))throw new Error('private cleanup exception');return {};}}});
 await c.activate();const children=list(c).slots.blocks.map(n=>n.id);await c.dispose();assert.ok(children.every(id=>log.indexOf(id)<log.indexOf('taskboard-List')));assert.ok(log.indexOf('taskboard-List')<log.indexOf('taskboard'));assert.ok(children.every(id=>c.status(id)==='disposed'));assert.equal(c.status('taskboard'),'disposed');assert.equal(c.errors().length,1);assert.doesNotMatch(JSON.stringify(c.errors()),/private cleanup exception/);
});

test('ordinary NEW constructs the installed public entry default composition without prototype JSON',async()=>{
 const b=await prepare(),h=host(b,{capabilities:['object.instances.edit','object.instances.construct'],editable:['page','created','created-*','taskboard','taskboard-*'],visible:['page','created','created-*','taskboard','taskboard-*'],scopes:{prototypes:b.definitions.map(d=>d.id),events:[],wydstore:[]}});
 const controller=createInstanceController({runtime:h.runtime,registry:h.registry,context:h.context,rootId:'page'});await controller.activate();
 await controller.workflow(compile('DIM draft AS Wydgit = NEW "divdev/taskboard"("created")\nMe.Insert("sections",1,draft)'),{},'page');
 const created=controller.snapshot().slots.pages[0].slots.sections.find(n=>n.id==='created');assert.ok(created);assert.deepEqual(created.slots.blocks.map(n=>n.id),['created-Model','created-List','created-Pager']);assert.equal(created.slots.blocks[1].slots.blocks.length,2);await controller.dispose();
});

test('installed Taskboard executes packaged WBasic navigation over the normal TCP host with independent publisher verification',async t=>{
 const b=await prepare(),f=await packageFixture(t),manifest=structuredClone(b.manifest);manifest.resources.sources.select='select.bas';manifest.bindings.push({owner:'taskboard',event:'Page.PreRender',source:'select',kind:'handler'});
 await fs.writeFile(path.join(f.packagePath,'manifest.json'),JSON.stringify(manifest));for(const [file,text] of Object.entries(b.resources))await fs.writeFile(path.join(f.packagePath,file),text);await fs.writeFile(path.join(f.packagePath,'select.bas'),'EVENT Page.PreRender\nCALL Me.SelectPage(2)\nEND EVENT');
 const verifiedPackages={[manifest.id]:manifest.publisher},base=loadRepository(f.root),ids=[];const walk=id=>{ids.push(id);Object.values(base.runtime.get(id).slots).flat().forEach(walk);};walk(base.runtime.rootId);
 await applyPackageInstall(await planPackageInstall({...f.options,approvals:manifest.permissions,storageMappings:{},verifiedPackages,installationContext:new ExecutionContext({publisher:'operator',self:'home',app:base.runtime.rootId,visible:[...ids,...manifest.permissions.visible],editable:[...ids,...manifest.permissions.visible],capabilities:['object.instances.edit']})}));
 const start=async(execution={})=>{const app=await createHostApp({root:f.root,execution}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.closeAllConnections();if(server.listening)await app.shutdown(server);});return 'http://127.0.0.1:'+server.address().port;};
 const url=await start({verifiedPackages});for(let i=0;i<2;i++){const response=await fetch(url+'/');assert.equal(response.status,200);const html=await response.text();assert.match(html,/Verify lifecycle cleanup/);assert.doesNotMatch(html,/Write WBasic/);}
 const denied=await fetch(await start()+'/');assert.equal(denied.status,403);assert.doesNotMatch(await denied.text(),/Verify lifecycle cleanup/);
});
