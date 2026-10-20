import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createPageEdit} from '../packages/wydgine/src/engine/execution/canonical-edit.js';
import {PrototypeRegistry,hydrate,dehydrate,serialize,ExecutionContext,resultOf} from '../wydgine/object-model/index.js';
import {compile,compilePrototype} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {endExecutionContext} from '../wydgine/seam/context.js';
import {clearFixture,measureClear} from '../test-support/form-clear.js';
import {lifecycleFixture,writeJson} from '../test-support/package-lifecycle.js';
import {packageOperation,activatePackages,manualReplacement} from '../wydgine/packages/index.js';
import {loadRepository} from '../wydgine/repository.js';

const slot={accepts:['acme/base'],ordered:true};
function fixture(){
 const registry=new PrototypeRegistry([
  {id:'wydgit.core/app',publisher:'wydgit.core',slots:{items:slot}},
  {id:'acme/base',publisher:'acme',public:true,behavior:compilePrototype('FUNCTION ReadLabel() AS String\nRETURN Me.label\nEND FUNCTION'),properties:{label:{type:'string',required:true},data:{type:'object',default:{}},list:{type:'array',default:[]},count:{type:'number',default:0}},slots:{items:slot}},
  {id:'acme/derived',publisher:'acme',extends:'acme/base'}
 ]);
 const node=(id,items=[])=>({schema:'wydgit/0.3',id,prototype:'acme/derived',execution:{schema:'wydgit.execution/1',runat:'Server',context:'FrontEnd'},properties:{label:id},slots:{items},provenance:{publisher:'acme'}});
 const runtime=hydrate({schema:'wydgit/0.2',id:'app',prototype:'wydgit.core/app',properties:{},slots:{items:[node('a',[node('aa')]),node('b')]},provenance:{}},registry,{revision:7});
 const context=new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'app',app:'app',visible:['app','a','aa','b','new','copy','copy-aa'],editable:['app','a','aa','b','new','copy','copy-aa'],traversal:['children','root','parent','previousSibling','nextSibling'],capabilities:['object.instances.edit']});
 return {runtime,registry,context,node};
}
const normalized=v=>JSON.parse(JSON.stringify(v));
for(const operation of ['changed','unchanged','nested','arrays','reset','invalid','structure'])test(`Page edit agrees with portable edit after each ${operation} operation and failure`,()=>{
 const f=fixture(),a=f.runtime.edit(f.context),b=createPageEdit(f.runtime,f.context,f.registry),original=serialize(f.runtime);
 const steps={
  changed:[['setProperty','a','label','first'],['setProperty','a','label','second']],
  unchanged:[['setProperty','a','label','a'],['setProperty','a','count',0]],
  nested:[['setProperty','a','data',{nested:{array:[0,{ok:true}]}}],['setProperty','b','data',{other:[] }]],
  arrays:[['setProperty','a','list',[{nested:[1,2]},false]],['setProperty','a','list',[]]],
  reset:[['setProperty','a','count',8],['resetProperty','a','count'],['resetProperty','a','label']],
  invalid:[['setProperty','a','label',false],['setProperty','a','missing',true],['setProperty','a','data',JSON.parse('{"__proto__":1}')],['setProperty','a','list',new Array(1)],['setProperty','a','label','repaired']],
  structure:[['moveChild','aa','b','items',0],['insertChild','a','items',0,f.node('new')],['cloneChild','b','a','items',1,[['b','copy'],['aa','copy-aa']]],['moveChild','a','new','items',0],['remove','b']]
 }[operation];
 for(const [name,...args] of steps){
  assert.deepEqual(resultOf(()=>a[name](...args)),resultOf(()=>b[name](...args)));
  assert.deepEqual(a.changes(),b.changes());assert.equal(serialize(f.runtime),original);
 }
 assert.deepEqual(resultOf(()=>a.commit({currentRevision:99})),resultOf(()=>b.commit({currentRevision:99})));
 const left=a.commit(),right=b.commit();assert.deepEqual(left.changes,right.changes);assert.equal(serialize(left.runtime),serialize(right.runtime));assert.equal(right.revision,8);
 assert.equal(right.runtime.get('a').prototype,'acme/derived');assert.ok(f.registry.isA(right.runtime.get('a').prototype,'acme/base'));
 const scope=right.runtime.scope(f.context,'a');assert.equal(scope.related('parent').id,'app');assert.equal(scope.related('root').id,'app');
 assert.equal(scope.related('nextSibling')?.id,left.runtime.scope(f.context,'a').related('nextSibling')?.id);
 assert.throws(()=>b.setProperty('a','label','closed'),{code:'MUTATION.CLOSED'});
});
test('Page edit retains nested input isolation, descriptors and failed-candidate rollback',()=>{
 const f=fixture(),edit=createPageEdit(f.runtime,f.context,f.registry),value={nested:[{ok:true}]};
 edit.setProperty('a','data',value);value.nested[0].ok=false;
 for(const variant of ['getter','hidden','symbol']){
  const invalid={};if(variant==='getter')Object.defineProperty(invalid,'x',{enumerable:true,get(){assert.fail('accessor invoked');}});
  if(variant==='hidden')Object.defineProperty(invalid,'x',{value:true});if(variant==='symbol')invalid[Symbol('x')]=true;
  assert.throws(()=>edit.setProperty('a','data',invalid),{code:'INPUT.JSON'});
 }
 const child=f.node('new');child.properties.label=false;assert.throws(()=>edit.insertChild('a','items',0,child),{code:'MUTATION.INVALID_PROPERTY'});
 child.properties.label='new';edit.insertChild('a','items',0,child);child.properties.label='caller mutation';
 const next=edit.commit().runtime;assert.deepEqual(normalized(next.get('a').properties.data),{nested:[{ok:true}]});assert.equal(next.get('new').properties.label,'new');
 assert.equal(next.get('aa').id,'aa');assert.equal(next.scope(f.context,'aa').related('previousSibling').id,'new');
 assert.throws(()=>{next.get('a').properties.data.nested[0].ok=false;},TypeError);
});
test('Page edit checks unchanged authority and expired contexts before every operation/commit',()=>{
 const f=fixture(),limited=new ExecutionContext({...f.context,editable:['a']}),edit=createPageEdit(f.runtime,limited,f.registry);
 assert.throws(()=>edit.setProperty('b','label','b'),{code:'MUTATION.DENIED'});edit.setProperty('a','label','a');
 assert.throws(()=>createPageEdit(f.runtime,new ExecutionContext({...f.context,capabilities:[]}),f.registry),{code:'MUTATION.DENIED'});
 endExecutionContext(limited);assert.throws(()=>edit.setProperty('a','label','a'),{code:'SEAM.CONTEXT'});assert.throws(()=>edit.commit(),{code:'SEAM.CONTEXT'});
});
test('independent Page edit sessions never share working state; abort and revision exhaustion retain their errors',()=>{
 const f=fixture(),one=createPageEdit(f.runtime,f.context,f.registry),two=createPageEdit(f.runtime,f.context,f.registry);
 one.setProperty('a','label','one');two.setProperty('a','label','two');assert.equal(one.commit().runtime.get('a').properties.label,'one');assert.equal(two.commit().runtime.get('a').properties.label,'two');
 const aborted=createPageEdit(f.runtime,f.context,f.registry);aborted.abort();assert.throws(()=>aborted.commit(),{code:'MUTATION.CLOSED'});
 const max=hydrate(dehydrate(f.runtime),f.registry,{revision:Number.MAX_SAFE_INTEGER});assert.throws(()=>createPageEdit(max,f.context,f.registry).commit(),{code:'MUTATION.CONFLICT'});
});
test('real Page setters publish each intermediate state to retained handles and later callbacks',async()=>{
 const f=clearFixture(),order=[];let expired;
 const {result}=await measureClear(f,{handlers:[
  {owner:'field0',type:'Page.Load',run:function(){expired=this.ME;const before=this.ME.properties;this.ME.Set('label','first');order.push(this.ME.properties.label);assert.equal(before.label,'Field 0');this.ME.Set('label','second');order.push(this.ME.properties.label);assert.throws(()=>this.ME.Set('label',false),{code:'MUTATION.INVALID_PROPERTY'});assert.equal(this.ME.properties.label,'second');}},
  {owner:'field0',type:'Page.PreRender',run:function(){order.push(this.ME.properties.label);}}
 ]});
 assert.equal(result.error,null);assert.deepEqual(order,['first','second','second']);assert.equal(f.model.runtime.get('field0').properties.label,'Field 0');assert.throws(()=>expired.Set('label','late'));
});
for(const reason of ['cancelled','expired'])test(`real Page rejects later mutation after ${reason} without altering earlier observed state`,async()=>{
 const f=clearFixture();let stop=false,seen;
 const pending=measureClear(f,{cancelled:()=>stop,handlers:[{owner:'field0',type:'Page.Load',run:function(){this.ME.Set('label','accepted');seen=this.ME.properties.label;if(reason==='cancelled')stop=true;else endExecutionContext(f.context);assert.throws(()=>this.ME.Set('label','denied'));}}]});
 if(reason==='expired')await assert.rejects(pending,{code:'SEAM.CONTEXT'});else assert.ok((await pending).result.error);
 assert.equal(seen,'accepted');assert.equal(f.model.runtime.get('field0').properties.label,'Field 0');
});
for(const change of ['replacement','tamper','retirement'])test(`installed pending Page edit retains ${change} lifetime boundary`,async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a');a.approvals.capabilities=['object.instances.edit'];a.approvals.editable=['pkg-a'];
 const manifest=JSON.parse(await fs.readFile(path.join(a.packagePath,'manifest.json')));manifest.permissions=a.approvals;await writeJson(path.join(a.packagePath,'manifest.json'),manifest);
 await packageOperation(f.operation('install','acme/a',[a]));const model=loadRepository(f.root),context=activatePackages(model,{resolve(){},resolvePackageScopes(){}},f.root).context({pageId:'page-a',session:{},ids:[]});
 const edit=createPageEdit(model.runtime,context,model.registry);edit.setProperty('pkg-a','setting','accepted');
 const catalog=path.join(f.root,'content/installed-packages.json'),bytes=await fs.readFile(catalog);
 if(change==='replacement'){await fs.writeFile(catalog+'.new',bytes);await fs.rename(catalog+'.new',catalog);edit.setProperty('pkg-a','setting','accepted');assert.equal(edit.commit().runtime.get('pkg-a').properties.setting,'accepted');return;}
 if(change==='tamper'){const state=JSON.parse(bytes),entry=state.packages[0];entry.resources[entry.manifest.resources.prototypes]+=' ';await writeJson(catalog,state);}
 else await manualReplacement({schema:'wydgit.manual-replacement-request/1',root:f.root,package:'acme/a',action:'retire',installationContext:f.context});
 assert.throws(()=>edit.setProperty('pkg-a','setting','accepted'),{code:'SEAM.CONTEXT'});assert.throws(()=>edit.commit(),{code:'SEAM.CONTEXT'});
 if(change==='tamper'){await fs.writeFile(catalog,bytes);assert.throws(()=>edit.commit(),{code:'SEAM.CONTEXT'});}
});

test('expired real Page deadline prevents mutation entry',async()=>{
 const f=clearFixture(),context=new ExecutionContext({...f.context,limits:{sewnTimeMs:0}});let entered=false;
 const {result}=await measureClear({...f,context},{handlers:[{owner:'field0',type:'Page.Load',run:function(){entered=true;this.ME.Set('label','denied');}}]});
 assert.equal(entered,false);assert.equal(result.error.code,'SEWN.LIMIT');assert.equal(f.model.runtime.get('field0').properties.label,'Field 0');
});

test('inherited method dispatch reads the new canonical snapshot with the same caller',async()=>{
 const f=fixture(),edit=createPageEdit(f.runtime,f.context,f.registry);edit.setProperty('a','label','inherited read');
 const runtime=edit.commit().runtime,result=await execute(compile('RETURN Me.ReadLabel()'),{scope:{ME:runtime.scope(f.context,'a')},context:f.context,prototypeRegistry:f.registry});
 assert.equal(result.value,'inherited read');assert.equal(f.registry.get('acme/derived').methods.readlabel.owner,'acme/base');
});
test('concurrent real Pages retain independent intermediate property states',async()=>{
 const f=clearFixture();
 const run=label=>measureClear(f,{handlers:[{owner:'field0',type:'Page.Load',run:async function(){this.ME.Set('label',label);await Promise.resolve();assert.equal(this.ME.properties.label,label);this.ME.Set('label',label+' again');assert.equal(this.ME.properties.label,label+' again');}}]});
 const results=await Promise.all([run('first'),run('second')]);for(const r of results)assert.equal(r.result.error,null);
 assert.equal(f.model.runtime.get('field0').properties.label,'Field 0');
});
