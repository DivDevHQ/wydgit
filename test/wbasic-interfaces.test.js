import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {compile,compileModule,compilePrototype,compileInterface} from '../wydgine/wydbasic/index.js';
import {PrototypeRegistry,ExecutionContext,hydrate} from '../wydgine/object-model/index.js';
import {bindMembers} from '../wydgine/object-model/members.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {compileDefinitions} from '../wydgine/repository.js';
const contract=compileInterface('INTERFACE ICountable\nFUNCTION Count() AS Integer\nSUB Observe(value AS String)\nEND INTERFACE',{id:'contracts/icountable',publisher:'contracts',version:'1.0.0'});
const type='interface:contracts/icountable@1.0.0';
const fixtureDefinitions=['contracts','collections','independent'].flatMap(p=>JSON.parse(readFileSync(new URL(`./fixtures/interfaces/${p}/prototypes.json`,import.meta.url))).prototypes);
const definitions=()=>compileDefinitions(fixtureDefinitions,{verifiedPrototypes:Object.fromEntries(fixtureDefinitions.map(d=>[d.id,d.publisher]))});
const trusted=ds=>Object.fromEntries(ds.map(d=>[d.id,d.publisher]));
const registryOf=(ds=definitions())=>new PrototypeRegistry(ds,{verifiedPrototypes:trusted(ds)});
const options=registry=>({prototypeRegistry:registry,dependencies:{'contracts/icountable':'1.0.0'}});
const l=value=>({op:'literal',value}),v=name=>({op:'variable',name}),me={op:'context',name:'ME'},cast=(value=me)=>({op:'cast',type,value}),impl=(value=me)=>({op:'implements',type,value});
const ret=value=>({op:'return',value}),doc=body=>({schema:'sewn/0.17',procedures:{},body});
function host(id='collections/counter',limits={},registry=registryOf()){
 const context=new ExecutionContext({publisher:'application',self:'counter',visible:['counter'],capabilities:['object.instances.construct'],scopes:{prototypes:['collections/counter']},limits});
 const node={id:'counter',prototype:id,properties:{secret:'hidden'}};
 const handle=bindMembers({id:node.id,prototype:id},{context,node:()=>node});return {prototypeRegistry:registry,context,scope:{ME:handle}};
}
const run=(p,h=host())=>execute(p,h);

test('interface declarations, approved identities, exact signatures, inheritance and override conformance',()=>{
 assert.equal(contract.signatures.count.returns,'Integer');assert.deepEqual(contract.signatures.observe.params,['String']);
 assert.deepEqual(compileDefinitions([{id:contract.id,publisher:contract.publisher,version:contract.version,interface:true,behaviorSource:'INTERFACE ICountable\nFUNCTION Count() AS Integer\nSUB Observe(value AS String)\nEND INTERFACE'}],{verifiedPrototypes:{[contract.id]:'contracts'}}),[contract]);
 for(const source of ['INTERFACE ICountable\nDIM x AS String\nEND INTERFACE','INTERFACE ICountable\nFUNCTION Count() AS Integer\nRETURN 1\nEND FUNCTION\nEND INTERFACE','INTERFACE ICountable\nPRIVATE SUB Secret()\nEND INTERFACE','INTERFACE ICountable\nSUB X()\nSUB x()\nEND INTERFACE','INTERFACE ICountable\nSUB X()\nEND INTERFACE\nRETURN 1'])assert.throws(()=>compileInterface(source,{id:contract.id,publisher:contract.publisher,version:contract.version}));
 const registry=registryOf();assert.ok(registry.implements('collections/derived',type));assert.ok(registry.implements('collections/override',type));assert.equal(registry.implements('independent/counter',type),false);
 for(const mutate of [ds=>delete ds[1].behavior.procedures.count,ds=>ds[1].behavior.procedures.count.returns='Float',ds=>ds[1].behavior.procedures.observe.params.reverse()&&ds[1].behavior.procedures.observe.params.push({name:'other',type:'String'}),ds=>ds[1].methodRules={count:{access:'private'}},ds=>ds[1].methodRules={count:{hidden:true}},ds=>ds[1].implements={'contracts/icountable':'2.0.0'},ds=>ds[1].implements=['contracts/icountable'],ds=>ds[3].behavior.procedures.count.returns='String',ds=>ds[3].methodRules={count:{access:'private'}}]){const ds=structuredClone(definitions());mutate(ds);assert.throws(()=>registryOf(ds));}
 for(const key of ['fields','extends','properties','behavior','requires','static'])assert.throws(()=>registryOf([{...contract,[key]:{}},...definitions().slice(1)]));
 const ds=definitions();assert.throws(()=>new PrototypeRegistry(ds),{code:'INTERFACE.PUBLISHER'});assert.throws(()=>new PrototypeRegistry(ds,{verifiedPrototypes:{[contract.id]:'contracts'}}),{code:'INTERFACE.PUBLISHER'});
 assert.throws(()=>registryOf([...definitions(),contract]),{code:'PROTOTYPE.DUPLICATE'});
 const competing={...contract,id:'unrelated/icountable',publisher:'unrelated'};const ambiguous=registryOf([...definitions(),competing]);assert.throws(()=>compile('DIM item AS ICountable',{prototypeRegistry:ambiguous,dependencies:{'contracts/icountable':'1.0.0','unrelated/icountable':'1.0.0'}}),{code:'INTERFACE.RESOLUTION'});
 assert.throws(()=>compile('DIM item AS ICountable',{prototypeRegistry:registry,dependencies:{'contracts/icountable':'1.0.1'}}),{code:'INTERFACE.RESOLUTION'});
 assert.throws(()=>hydrate({schema:'wydgit/0.2',id:'counter',prototype:contract.id,properties:{},slots:{},provenance:{}},registry));
});
async function conformance(executor){
 const registry=registryOf(),opts=options(registry);
 const source='DIM item AS ICountable\nSET item=Cast(Me,ICountable)\nCALL item.Observe("sample")\nRETURN [Implements(Me,ICountable),item IS Me,item.Count()]';
 for(const [id,count] of [['collections/counter',7],['collections/derived',7],['collections/override',9]])assert.deepEqual(JSON.parse(JSON.stringify((await executor(compile(source,opts),host(id))).value)),[true,true,count]);
 assert.equal((await executor(compile('RETURN Implements(Me,ICountable)',opts),host('independent/counter'))).value,false);
 await assert.rejects(executor(compile(source,opts),host('independent/counter')),{code:'SEWN.TYPE'});
 const p=compileModule('FUNCTION View(item AS Wydgit) AS ICountable\nRETURN item\nEND FUNCTION\nFUNCTION Use(item AS ICountable) AS Integer\nRETURN item.Count()\nEND FUNCTION\nEVENT Page.Load\nRETURN Use(View(Me))\nEND EVENT',opts).events[0].workflow;
 assert.equal((await executor(p,host())).value,7);await assert.rejects(executor(p,host('independent/counter')),{code:'SEWN.TYPE'});
 assert.equal((await executor(compile('DIM item AS ICountable\nRETURN item IS NULL',opts),host())).value,true);
 const denied=[{op:'read',target:cast(),key:'properties'},{op:'memberRead',target:cast(),name:'secret',exact:true},{op:'invoke',target:cast(),method:'related',args:[l('parent')]},{op:'methodValue',target:cast(),name:'detail',args:[]}];
 for(const value of denied)await assert.rejects(executor(doc([ret(value)]),host()),{code:'SEWN.DENIED'});
 for(const value of [l({implements:[contract.id]}),l(null),{op:'context',name:'SESSION'}])await assert.rejects(executor(doc([ret(impl(value))]),host()));
 for(const limits of [{sewnSteps:1},{sewnProcedureCalls:0},{sewnProcedureDepth:0},{sewnTimeMs:0}])await assert.rejects(executor(compile(source,opts),host('collections/counter',limits)),{code:'SEWN.LIMIT'});
}
test('server interface reference conformance, identity, dynamic dispatch, typed boundaries and isolation',async()=>conformance(run));
test('compiler rejects unrelated contracts, extra members, wrong argument types, property access and malformed operands',()=>{
 const registry=registryOf(),opts=options(registry);
 for(const tail of ['RETURN item.Detail()','RETURN item.secret','CALL item.Observe(1)','RETURN item.Count(1)','item = Me'])assert.throws(()=>compile(`DIM item AS ICountable\nSET item=Cast(Me,ICountable)\n${tail}`,opts));
 for(const source of ['RETURN Cast({},ICountable)','RETURN Implements(NULL,ICountable)','RETURN Cast(Me,"ICountable")','RETURN Cast(Me,Integer)','RETURN Cast(Me,Missing)','DIM Cast AS Integer'])assert.throws(()=>compile(source,opts));
 const other=compileInterface('INTERFACE IPaymentProcessor\nSUB Pay()\nEND INTERFACE',{id:'contracts/ipayment',publisher:'contracts',version:'1.0.0'});const r=registryOf([...definitions(),other]);assert.throws(()=>compile('DIM item AS ICountable\nDIM payment AS IPaymentProcessor\nSET payment=item',{prototypeRegistry:r,dependencies:{'contracts/icountable':'1.0.0','contracts/ipayment':'1.0.0'}}));
});
test('closed 0.17 wire and runtime binding reject forgery, widening and unchecked rebinding',async()=>{
 const p=doc([ret(impl())]);for(let i=1;i<=16;i++)assert.throws(()=>validate({...p,schema:`sewn/0.${i}`}),{code:'SEWN.INVALID'});
 for(const type of ['ICountable','interface:contracts/icountable@latest','interface:contracts/icountable@1.0.0 extra'])assert.throws(()=>validate(doc([ret({...impl(),type})])),{code:'SEWN.INVALID'});
 for(const extra of [{authority:true},{version:'1.0.0'},{handle:'counter'}])assert.throws(()=>validate(doc([ret({...cast(),...extra})])),{code:'SEWN.INVALID'});
 await assert.rejects(run(doc([ret({...impl(),type:'interface:contracts/icountable@2.0.0'})])),{code:'INTERFACE.UNKNOWN'});
 const h=host();h.scope.ME={id:'counter',prototype:'collections/counter',implements:[contract.id]};await assert.rejects(run(p,h),{code:'SEWN.DENIED'});
 const typed=doc([{op:'declare',name:'item',type,value:me},{op:'set',name:'item',value:l({})}]);await assert.rejects(run(typed),{code:'SEWN.TYPE'});
 const widened=doc([{op:'declare',name:'item',type,value:me}]);widened.procedures={widen:{kind:'function',params:[{name:'item',type:'Wydgit'}],returns:'String',body:[ret({op:'methodValue',target:v('item'),name:'detail',args:[]})]}};widened.body.push(ret({op:'functionCall',name:'widen',args:[v('item')]}));await assert.rejects(run(widened),{code:'SEWN.DENIED'});
});
test('interface inspection preserves reference context/lifetime and caller SEAM authority',async()=>{
 const h=host(),foreign=host();foreign.scope.ME=h.scope.ME;await assert.rejects(run(doc([ret(impl())]),foreign),{code:'OBJECT.ACCESS'});
 const hidden=host();hidden.scope.ME=bindMembers({id:'counter',prototype:'collections/counter'},{context:hidden.context,node(){hidden.context.require('store.records.read');}});await assert.rejects(run(doc([ret(impl())]),hidden),{code:'SEAM.DENIED'});
 const ds=definitions();ds[1].methodRules={count:{requires:['store.records.read']}};ds[3].methodRules={count:{requires:['store.records.read']}};await assert.rejects(run(compile('DIM item AS ICountable=Me\nRETURN item.Count()',options(registryOf(ds))),host('collections/counter',{},registryOf(ds))),{code:'SEAM.DENIED'});
 const draft={op:'construct',type:'collections/counter',id:l('draft')};assert.equal((await run(doc([{op:'declare',name:'item',value:draft},ret(impl(v('item')))]))).value,true);
 const stale=host();stale.scope.ME=bindMembers({id:'counter',prototype:'collections/counter'},{context:stale.context,node(){throw Object.assign(new Error('sensitive token'),{code:'EVENT.INVALID'});}});await assert.rejects(run(doc([ret(cast())]),stale),e=>!e.message.includes('sensitive token'));
});
test('browser executes validated contracts without compiler, registry installer, host services or budget resets',async()=>{
 const result=await build({stdin:{contents:"export {execute} from './wydgine/sewn/execute.js';export {PrototypeRegistry} from './wydgine/object-model/prototypes.js';export {ExecutionContext} from './wydgine/seam/context.js';export {bindMembers} from './wydgine/object-model/members.js';",resolveDir:process.cwd()},bundle:true,platform:'browser',target:'es2022',format:'iife',globalName:'PortableRuntime',minify:true,write:false,metafile:true});
 for(const input of Object.keys(result.metafile.inputs))assert.ok(!/wydbasic|static-libraries|node_modules|storage|packages\/index/.test(input),input);
 const sandbox={setTimeout,clearTimeout};runInNewContext(result.outputFiles[0].text,sandbox);
 await conformance((p,h)=>{const ds=definitions();sandbox.input=JSON.stringify({p,ds,verified:trusted(ds),id:h.scope.ME.prototype,limits:h.context.limits});return runInNewContext(`(()=>{const x=JSON.parse(input),context=new PortableRuntime.ExecutionContext({publisher:'application',self:'counter',limits:x.limits});const node={id:'counter',prototype:x.id};const handle=PortableRuntime.bindMembers({id:'counter',prototype:x.id},{context,node:()=>node});return PortableRuntime.execute(x.p,{context,scope:{ME:handle},prototypeRegistry:new PortableRuntime.PrototypeRegistry(x.ds,{verifiedPrototypes:x.verified})});})()`,sandbox);});
 const bytes=result.outputFiles[0].contents;console.log('Interface event executor with approved prototype metadata bytes',bytes.length,gzipSync(bytes).length,brotliCompressSync(bytes).length);
});

test('WydClient interface events retain cancellation, caller budgets and guarded handles',async()=>{
 const {mountClient}=await import('../wydclient/index.js');class Element extends EventTarget{}
 for(const infinite of [false,true]){
  const registry=registryOf(),element=new Element(),context=new ExecutionContext({publisher:'application',self:'counter',visible:['counter'],limits:{sewnIterations:4}});
  const workflow=compileModule(`EVENT Change\nDIM item AS ICountable=Me\nIF Implements(item,ICountable) THEN\n${infinite?'DO WHILE TRUE\nLOOP':'IF item.Count()=7 THEN\nEVENT.Cancel()\nEND IF'}\nEND IF\nEND EVENT`,options(registry)).events[0].workflow;
  const client=mountClient({prototypeRegistry:registry,nodes:[{id:'counter',prototype:'collections/counter',kind:'field',element,value:'old'}],context,handlers:[{owner:'counter',type:'Change',workflow}]});await client.ready;element.value='new';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),infinite?'SEWN.LIMIT':null);await client.unmount();
 }
});

test('consumed draft and stale transaction references cannot be revived or inspected through a view',async()=>{
 const h=host();h.scope.PAGE={id:'page',prototype:'collections/counter',Insert(){}};
 const draft={op:'construct',type:'collections/counter',id:l('draft')};
 for(const operation of [cast,impl]){
  const body=[{op:'declare',name:'original',value:draft},{op:'declare',name:'view',value:cast(v('original'))},{op:'call',target:{op:'context',name:'PAGE'},method:'Insert',args:[l('items'),l(0),v('original')]},ret(operation(v('view')))];
  await assert.rejects(run(doc(body),h),{code:'OBJECT.CONSTRUCTION'});
 }
 const registry=registryOf(),context=new ExecutionContext({publisher:'application',self:'home',visible:['counter'],capabilities:['object.instances.edit']});
 const {loadRepository}=await import('../wydgine/repository.js');const runtime=loadRepository(process.cwd()).runtime;const edit=runtime.edit(context),node={id:'counter',prototype:'collections/counter'},handle=bindMembers({id:'counter',prototype:node.prototype},{context,node(){edit.changes();return node;}});edit.abort();
 for(const operation of [cast,impl])await assert.rejects(run(doc([ret(operation())]),{context,prototypeRegistry:registry,scope:{ME:handle}}));
});

test('interface implementation arguments, returns, services and cumulative budgets remain checked',async()=>{
 const ds=structuredClone(definitions());ds[1].behavior.procedures.count.body=[ret({op:'read',target:{op:'context',name:'SESSION'},key:'result'})];const registry=registryOf(ds),h=host('collections/counter',{},registry);h.scope.SESSION={result:'wrong'};
 await assert.rejects(run(compile('DIM item AS ICountable=Me\nRETURN item.Count()',options(registry)),h),{code:'SEWN.TYPE'});
 const serviceDefs=structuredClone(definitions());serviceDefs[1].behavior.procedures.count.body=[ret({op:'serviceCall',library:'test',method:'inspect',input:l({})})];const serviceRegistry=registryOf(serviceDefs),serviceHost=host('collections/counter',{},serviceRegistry);serviceHost.scope.SERVICES={Call(){serviceHost.context.require('store.records.read');}};
 await assert.rejects(run(compile('DIM item AS ICountable=Me\nRETURN item.Count()',options(serviceRegistry)),serviceHost),{code:'SEAM.DENIED'});
 const p=compile('DIM item AS ICountable=Me\nRETURN [item.Count(),item.Count()]',options(registryOf()));await assert.rejects(run(p,host('collections/counter',{sewnProcedureCalls:1})),{code:'SEWN.LIMIT'});
 await assert.rejects(run(doc([{op:'declare',name:'item',value:cast()},{op:'methodCall',target:v('item'),name:'observe',args:[l(1)]}])),{code:'SEWN.TYPE'});
 const typedParameter=doc([ret({op:'functionCall',name:'use',args:[me]})]);typedParameter.procedures={use:{kind:'function',params:[{name:'item',type}],returns:'Integer',body:[{op:'set',name:'item',value:l({})},ret(l(0))]}};await assert.rejects(run(typedParameter),{code:'SEWN.TYPE'});
});

test('package installation pins interface artifacts, validates ownership and reloads without source resolution',async t=>{
 const fs=await import('node:fs/promises'),path=await import('node:path');const {packageFixture}=await import('../test-support/packages.js');const {planPackageInstall,applyPackageInstall,packageBindings}=await import('../wydgine/packages/index.js');const {loadRepository}=await import('../wydgine/repository.js');
 const fixture=await packageFixture(t),contractId='divdev/icountable';fixture.manifest.interfaces={[contractId]:'1.0.0'};
 const file=path.join(fixture.packagePath,fixture.manifest.resources.prototypes),ds=JSON.parse(await fs.readFile(file,'utf8'));
 ds.push({id:contractId,publisher:'divdev',version:'1.0.0',interface:true,behaviorSource:'INTERFACE ICountable\nFUNCTION Count() AS Integer\nEND INTERFACE'});ds[0].implements={[contractId]:'1.0.0'};ds[0].behaviorSource='FUNCTION Count() AS Integer\nRETURN 3\nEND FUNCTION';
 await fs.writeFile(file,JSON.stringify(ds));await fs.writeFile(path.join(fixture.packagePath,'manifest.json'),JSON.stringify(fixture.manifest));await fs.writeFile(path.join(fixture.packagePath,'refresh.bas'),'EVENT Page.PreRender\nDIM item AS ICountable=Me\nRETURN item.Count()\nEND EVENT');
 await assert.rejects(planPackageInstall(fixture.options),{code:'INTERFACE.PUBLISHER'});
 const verifiedPackages={[fixture.manifest.id]:'divdev'},plan=await planPackageInstall({...fixture.options,verifiedPackages});assert.equal(plan.compiledSources.refresh.events[0].workflow.schema,'sewn/0.17');await applyPackageInstall(plan);
 const model=loadRepository(fixture.root,{verifiedPackages}),entry=model.installed.packages[0],workflow=packageBindings(entry,model.registry,model.runtime).handlers[0].workflow;
 const id=entry.manifest.bindings[0].owner,context=new ExecutionContext({publisher:'application',self:id,visible:[id]});assert.equal((await execute(workflow,{prototypeRegistry:model.registry,context,scope:{ME:model.runtime.scope(context,id)}})).value,3);
 await fs.writeFile(path.join(fixture.packagePath,'refresh.bas'),'invalid source');assert.deepEqual(packageBindings(entry,model.registry,model.runtime).handlers[0].workflow,workflow);
});
