import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createPageEdit} from '../packages/wydgine/src/engine/execution/canonical-edit.js';
import {PrototypeRegistry,hydrate,dehydrate,serialize,ExecutionContext,resultOf,WydgitError} from '../wydgine/object-model/index.js';
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

// Spike I: compare every meaningful observable, without flattening canonical data.
function sameSnapshot(left,right,context){
 assert.equal(right.revision,left.revision);assert.equal(right.rootId,left.rootId);
 assert.deepEqual(dehydrate(right,{includeSensitive:true}),dehydrate(left,{includeSensitive:true}));
 assert.equal(serialize(right),serialize(left));
 const visit=id=>{
  const a=left.get(id),b=right.get(id);assert.deepEqual(b.properties,a.properties);assert.deepEqual(b.slots,a.slots);assert.equal(b.prototype,a.prototype);
  for(const key of ['id','prototype','properties','slots','provenance']){
   const {value:av,...ad}=Object.getOwnPropertyDescriptor(a,key),{value:bv,...bd}=Object.getOwnPropertyDescriptor(b,key);assert.deepEqual(bd,ad);assert.deepEqual(bv,av);
  }
  assert.ok(Object.isFrozen(b)&&Object.isFrozen(b.properties)&&Object.isFrozen(b.slots));
  for(const relation of ['parent','root','previousSibling','nextSibling'])assert.equal(right.scope(context,id).related(relation)?.id,left.scope(context,id).related(relation)?.id);
  for(const ids of Object.values(a.slots))ids.forEach(visit);
 };visit(left.rootId);
}
for(let seed=1;seed<=6;seed++)test(`Spike I bounded generated differential sequence ${seed}`,()=>{
 const f=fixture();let left=f.runtime,right=f.runtime,state=seed;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
 for(let batch=0;batch<6;batch++){
  const a=left.edit(f.context),b=createPageEdit(right,f.context,f.registry);
  for(let i=0;i<10;i++){
   const id=['a','aa','b'][random()%3],kind=random()%9;
   const args=kind===0?['label','label '+random()]:kind===1?['count',random()%100]:kind===2?['data',{nested:[random(),{ok:true}]}]:kind===3?['list',[random(),{items:[false,null]}]]:kind===4?['label',false]:kind===5?['missing',null]:kind===6?['id','forged']:kind===7?['label',left.get(id).properties.label]:['count',0];
   assert.deepEqual(resultOf(()=>a.setProperty(id,...args)),resultOf(()=>b.setProperty(id,...args)));
   assert.deepEqual(b.changes(),a.changes());sameSnapshot(left,right,f.context);
  }
  assert.deepEqual(resultOf(()=>a.commit({currentRevision:left.revision+1})),resultOf(()=>b.commit({currentRevision:right.revision+1})));
  const ca=a.commit(),cb=b.commit();assert.deepEqual(cb.changes,ca.changes);assert.equal(cb.baseRevision,ca.baseRevision);left=ca.runtime;right=cb.runtime;sameSnapshot(left,right,f.context);
 }
});
for(const invalid of ['getter','setter','hidden','symbol','prototype','cycle','bigint','undefined','nan','sparse'])test(`Spike I rejected ${invalid} after a successful candidate cannot damage the accepted snapshot`,()=>{
 const f=fixture(),a=f.runtime.edit(f.context),b=createPageEdit(f.runtime,f.context,f.registry);
 const make=()=>{
  const v={};
  if(invalid==='getter')Object.defineProperty(v,'x',{enumerable:true,get(){assert.fail('getter executed');}});
  if(invalid==='setter')Object.defineProperty(v,'x',{enumerable:true,set(){assert.fail('setter executed');}});
  if(invalid==='hidden')Object.defineProperty(v,'x',{value:1});
  if(invalid==='symbol')v[Symbol('x')]=1;
  if(invalid==='prototype')Object.setPrototypeOf(v,{foreign:true});
  if(invalid==='cycle')v.x=v;
  if(invalid==='bigint')v.x=1n;
  if(invalid==='undefined')v.x=undefined;
  if(invalid==='nan')v.x=NaN;
  if(invalid==='sparse')v.x=new Array(2);
  return v;
 };
 for(const edit of [a,b])edit.setProperty('a','label','accepted');
 const x=resultOf(()=>a.setProperty('a','data',make())),y=resultOf(()=>b.setProperty('a','data',make()));assert.equal(x.ok,false);assert.deepEqual(y,x);
 sameSnapshot(a.commit().runtime,b.commit().runtime,f.context);
});
for(const malformed of ['duplicate','cycle','descriptor','unknown-prototype','root','multiple-parents'])test(`Spike I malformed incoming ${malformed} retains portable error precedence and commit rollback`,()=>{
 const f=fixture(),a=f.runtime.edit(f.context),b=createPageEdit(f.runtime,f.context,f.registry);
 const make=()=>{
  const n=f.node('new');
  if(malformed==='duplicate')n.id='aa';
  if(malformed==='cycle')n.slots.items.push(n);
  if(malformed==='descriptor')Object.defineProperty(n,'id',{enumerable:true,get(){assert.fail('identity accessor executed');}});
  if(malformed==='unknown-prototype')n.prototype='acme/missing';
  if(malformed==='root')n.prototype='wydgit.core/app';
  if(malformed==='multiple-parents'){const child=f.node('copy');n.slots.items=[child,child];}
  return n;
 };
 const x=resultOf(()=>a.insertChild('a','items',0,make())),y=resultOf(()=>b.insertChild('a','items',0,make()));assert.equal(x.ok,false);assert.deepEqual(y,x);
 sameSnapshot(a.commit().runtime,b.commit().runtime,f.context);
});
test('Spike I maximum revision validates candidates and reports conflict only at commit',()=>{
 const f=fixture(),runtime=hydrate(dehydrate(f.runtime),f.registry,{revision:Number.MAX_SAFE_INTEGER}),a=runtime.edit(f.context),b=createPageEdit(runtime,f.context,f.registry);
 for(const [name,value] of [['label','accepted'],['label',false],['count',2]])assert.deepEqual(resultOf(()=>b.setProperty('a',name,value)),resultOf(()=>a.setProperty('a',name,value)));
 assert.deepEqual(b.changes(),a.changes());assert.deepEqual(resultOf(()=>b.commit()),resultOf(()=>a.commit()));
 assert.equal(resultOf(()=>b.commit()).code,'MUTATION.CONFLICT');
});
test('Spike I empty sessions and failed first candidates still commit a fresh runtime',()=>{
 const f=fixture();
 for(const failed of [false,true]){
  const a=f.runtime.edit(f.context),b=createPageEdit(f.runtime,f.context,f.registry);
  if(failed)for(const edit of [a,b])assert.throws(()=>edit.setProperty('a','label',false),{code:'MUTATION.INVALID_PROPERTY'});
  const left=a.commit(),right=b.commit();assert.notEqual(right.runtime,f.runtime);sameSnapshot(left.runtime,right.runtime,f.context);assert.deepEqual(right.changes,left.changes);
 }
});
for(const change of ['symlink','restored-mtime','revoke','retirement','tamper','replacement'])test(`Spike I installed commit checks ${change} after the last successful candidate`,async t=>{
 const f=await lifecycleFixture(t),a=await f.candidate('a');a.approvals.capabilities=['object.instances.edit'];a.approvals.editable=['pkg-a'];
 const manifest=JSON.parse(await fs.readFile(path.join(a.packagePath,'manifest.json')));manifest.permissions=a.approvals;await writeJson(path.join(a.packagePath,'manifest.json'),manifest);
 await packageOperation(f.operation('install','acme/a',[a]));
 const catalog=path.join(f.root,'content/installed-packages.json'),bytes=await fs.readFile(catalog),seconds=1700000000;
 if(change==='restored-mtime')await fs.utimes(catalog,seconds,seconds);
 const model=loadRepository(f.root),context=activatePackages(model,{resolve(){},resolvePackageScopes(){}},f.root).context({pageId:'page-a',session:{},ids:[]}),edit=createPageEdit(model.runtime,context,model.registry);
 edit.setProperty('pkg-a','setting','accepted');
 if(change==='symlink'){await fs.rename(catalog,catalog+'.held');await fs.symlink(catalog+'.held',catalog);}
 if(change==='restored-mtime'){
  const before=await fs.stat(catalog,{bigint:true}),state=JSON.parse(bytes),entry=state.packages[0],source=entry.manifest.resources.prototypes;
  const old=JSON.stringify(entry.resources[source]),next=JSON.stringify(entry.resources[source].replace('package default','Package default'));
  assert.notEqual(old,next);await fs.writeFile(catalog,bytes.toString().replace(old,next));await fs.utimes(catalog,seconds,seconds);
  const after=await fs.stat(catalog,{bigint:true});assert.equal(after.size,before.size);assert.equal(after.mtimeNs,before.mtimeNs);assert.notEqual(after.ctimeNs,before.ctimeNs);
 }
 if(change==='revoke')endExecutionContext(context);
 if(change==='retirement')await manualReplacement({schema:'wydgit.manual-replacement-request/1',root:f.root,package:'acme/a',action:'retire',installationContext:f.context});
 if(change==='tamper'){const state=JSON.parse(bytes),entry=state.packages[0];entry.resources[entry.manifest.resources.prototypes]+=' ';await writeJson(catalog,state);}
 if(change==='replacement'){await fs.writeFile(catalog+'.new',bytes);await fs.rename(catalog+'.new',catalog);assert.equal(edit.commit().runtime.get('pkg-a').properties.setting,'accepted');return;}

 assert.throws(()=>edit.commit(),{code:'SEAM.CONTEXT'});assert.equal(model.runtime.get('pkg-a').properties.setting,'package default');
});

test('Spike I global Form invariants and select normalization remain full candidate checks',()=>{
 const f=clearFixture({count:8}),registry=f.model.registry;let left=f.model.runtime,right=left;
 const steps=[['setProperty','field0','label','accepted'],['setProperty','field0','name','field1'],['setProperty','field0','maxLength',-1],['setProperty','field3','options',[{value:'x',label:'X',enabled:true,extra:1}]],['resetProperty','field6','value'],['setProperty','field6','multiple',false],['resetProperty','field6','value'],['setProperty','field7','value','secret'],['setProperty','field1','format',{nested:[{flag:true}]}]];
 for(const [method,...args] of steps){
  const a=left.edit(f.context),b=createPageEdit(right,f.context,registry);
  assert.deepEqual(resultOf(()=>b[method](...args)),resultOf(()=>a[method](...args)));
  const ca=a.commit(),cb=b.commit();assert.deepEqual(cb.changes,ca.changes);left=ca.runtime;right=cb.runtime;
  assert.deepEqual(dehydrate(right,{includeSensitive:true}),dehydrate(left,{includeSensitive:true}));assert.equal(serialize(right),serialize(left));assert.equal(right.revision,left.revision);
 }
 assert.equal(right.get('field7').properties.value,'secret');assert.equal(right.scope(f.context,'field7').properties.value,'');
});

// Trusted fault injection exercises the full-validation fallback, not a mutable
// registry supported for production reuse. Page registries have frozen definitions.
test('Spike I failed commit validation without an accepted candidate leaves the session repairable',()=>{
 const f=fixture();let fail=false;
 const registry={get(id){if(fail)throw new WydgitError('PROTOTYPE.UNKNOWN','Injected lookup failure');return f.registry.get(id);},isA:(...args)=>f.registry.isA(...args)};
 const original=hydrate(dehydrate(f.runtime),registry,{revision:7}),a=original.edit(f.context),b=createPageEdit(original,f.context,registry);
 fail=true;const left=resultOf(()=>a.commit()),right=resultOf(()=>b.commit());assert.equal(left.code,'PROTOTYPE.UNKNOWN');assert.deepEqual(right,left);assert.equal(original.revision,7);
 fail=false;sameSnapshot(a.commit().runtime,b.commit().runtime,f.context);
});
