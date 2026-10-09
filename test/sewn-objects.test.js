import test from 'node:test';
import assert from 'node:assert/strict';
import {PrototypeRegistry,ExecutionContext,hydrate,dehydrate} from '../wydgine/object-model/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
// Independent canonical SEWN proof: deliberately no compiler import.
const l=value=>({op:'literal',value}),v=name=>({op:'variable',name}),me={op:'context',name:'ME'};
const read=(target,key)=>({op:'read',target,key});
const call=(target,method,args=[])=>({op:'call',target,method,args});
const method=(target,name,args=[])=>({op:'methodCall',target,name,args});
const result=(target,name,args=[])=>({op:'methodValue',target,name,args});
const ret=value=>({op:'return',value});
const sub=(body,params=[])=>({kind:'sub',params,body});
const fn=(returns,body,params=[])=>({kind:'function',params,returns,body});
const doc=(body=[],procedures={})=>({schema:'sewn/0.3',procedures,body});
const param={name:'value',type:'String'};
const behavior=doc([],{
 settitle:sub([call(me,'Set',[l('title'),v('value')])],[param]),
 hastitle:fn('Boolean',[ret({op:'binary',operator:'!=',left:read(read(me,'properties'),'title'),right:l('')})]),
 echo:fn('String',[ret(v('value'))],[param]),
 storage:sub([{op:'service',library:'wydstore',method:'create',input:l({})}])
});
const definitions=()=>[
 {id:'wydgit.core/app',publisher:'wydgit.core',slots:{items:{accepts:['acme/card'],ordered:true,max:2}},properties:{}},
 {id:'wydgit.core/base',publisher:'wydgit.core',public:true,abstract:true,properties:{title:{type:'string',default:''}},slots:{},behavior:structuredClone(behavior)},
 {id:'acme/card',publisher:'acme',extends:'wydgit.core/base',slots:{items:{accepts:['acme/card'],ordered:true,max:1}}},
 {id:'acme/fancy',publisher:'acme',extends:'acme/card',overrides:['settitle'],behavior:doc([],{settitle:sub([call(me,'Set',[l('title'),{op:'binary',operator:'concat',left:l('Fancy: '),right:v('value')}])],[{...param}])})}
];
const context=(extra={})=>new ExecutionContext({publisher:'caller',self:'app',visible:['app','card','child'],editable:['app','card','child'],capabilities:['object.instances.edit','object.instances.construct'],scopes:{prototypes:['acme/card','acme/fancy','wydgit.core/base']},...extra});
const envelope=(id,type,properties={},slots={})=>({schema:'wydgit/0.2',id,prototype:type,properties,slots,provenance:{}});
const draft=(name='card',type='acme/card')=>({op:'declare',name,value:{op:'construct',type,id:l(name)}});
async function run(body,{ctx=context(),registry=new PrototypeRegistry(definitions()),scope={}}={}){return execute(doc(body),{context:ctx,prototypeRegistry:registry,scope});}
const error=code=>e=>e.code===code;
function runtimeHost(ctx=context()){
 const registry=new PrototypeRegistry(definitions());let runtime=hydrate(envelope('app','wydgit.core/app'),registry);
 const handle=()=>({get prototype(){return runtime.get('app').prototype;},Insert(slot,index,value){const edit=runtime.edit(ctx);edit.insertChild('app',slot,index,value);runtime=edit.commit().runtime;}});
 return {registry,scope:{ME:handle()},ctx,get runtime(){return runtime;}};
}

test('SEWN dynamic dispatch, inherited method, kind/results/parameters and draft defaults',async()=>{
 const value=await run([draft('card','acme/fancy'),method(v('card'),'settitle',[l('Hello')]),ret({op:'array',items:[read(read(v('card'),'properties'),'title'),result(v('card'),'hastitle'),result(v('card'),'echo',[l('typed')])]})]);
 assert.deepEqual(value.value,['Fancy: Hello',true,'typed']);
 await assert.rejects(run([draft(),method(v('card'),'missing')]),error('PROTOTYPE.METHOD'));
 await assert.rejects(run([draft(),ret(result(v('card'),'settitle',[l('x')]))]),error('SEWN.TYPE'));
 await assert.rejects(run([draft(),method(v('card'),'echo',[l('x')])]),error('SEWN.TYPE'));
 await assert.rejects(run([draft(),method(v('card'),'settitle',[l(1)])]),error('SEWN.TYPE'));
 const defs=definitions();defs[2].behavior=doc([],{bad:fn('String',[ret(l(1))])});
 await assert.rejects(run([draft(),ret(result(v('card'),'bad'))],{registry:new PrototypeRegistry(defs)}),error('SEWN.TYPE'));
});

test('portable receiver keeps exact caller authority despite public/core/inherited ownership',async()=>{
 const ctx=context({capabilities:[]});let actual;
 const scope={ME:{prototype:'acme/fancy',Set(){actual=ctx;ctx.require('object.instances.edit');}},SERVICES:{Call(){actual=ctx;ctx.require('store.records.create');}}};
 await assert.rejects(run([method(me,'settitle',[l('denied')])],{ctx,scope}),error('SEAM.DENIED'));assert.equal(actual,ctx);
 await assert.rejects(run([method(me,'storage')],{ctx,scope}),error('SEAM.DENIED'));assert.equal(actual,ctx);
 await assert.rejects(run([method(l({}),'hastitle')],{ctx,scope}),error('SEWN.DENIED'));
});

test('draft construction rejects missing authority, prototype, abstractness, identity and invalid properties early',async()=>{
 await assert.rejects(run([draft()],{ctx:context({capabilities:[]})}),error('SEAM.DENIED'));
 await assert.rejects(run([draft()],{ctx:context({scopes:{prototypes:[]}})}),error('SEAM.DENIED'));
 await assert.rejects(run([draft('card','wydgit.core/base')]),error('OBJECT.CONSTRUCTION'));
 await assert.rejects(run([draft('card','acme/unknown')],{ctx:context({scopes:{prototypes:['acme/unknown']}})}),error('PROTOTYPE.UNKNOWN'));
 await assert.rejects(run([{...draft(),value:{op:'construct',type:'acme/card',id:l('1invalid')}}]),error('OBJECT.CONSTRUCTION'));
 for(const [key,value] of [['missing','x'],['title',1],['constructor','x']])await assert.rejects(run([draft(),call(v('card'),'Set',[l(key),l(value)])]),error('OBJECT.PROPERTY'));
 await assert.rejects(run([draft(),call(v('card'),'related',[l('root')])]),error('SEWN.DENIED'));
});

test('draft consumption is atomic, nested subtrees attach through existing mutation and stale tokens cannot be reused',async()=>{
 const host=runtimeHost();await run([draft(),draft('child'),method(v('child'),'settitle',[l('nested')]),call(v('card'),'Insert',[l('items'),l(0),v('child')]),call(me,'Insert',[l('items'),l(0),v('card')])],host);
 assert.equal(host.runtime.get('child').properties.title,'nested');assert.equal(host.runtime.scope(host.ctx,'child').id,'child');
 for(const reuse of [call(me,'Insert',[l('items'),l(0),v('card')]),method(v('card'),'hastitle'),call(v('card'),'Set',[l('title'),l('x')]),ret(read(v('card'),'id'))]){
  await assert.rejects(run([draft(),draft('child'),call(v('card'),'Insert',[l('items'),l(0),v('child')]),ret(read(v('child'),'id'))]),error('OBJECT.CONSTRUCTION'));
 const h=runtimeHost();await assert.rejects(run([draft(),call(me,'Insert',[l('items'),l(0),v('card')]),reuse],h),e=>['OBJECT.CONSTRUCTION','SEWN.TYPE'].includes(e.code));assert.equal(h.runtime.get('app').slots.items.length,1);
 }
 const h=runtimeHost();await assert.rejects(run([draft(),call(me,'Insert',[l('no'),l(0),v('card')])],h));assert.equal(h.runtime.get('app').slots.items.length,0);
});

test('draft failed insertion remains usable for correction/retry; duplicate IDs, child type and cardinality stay atomic',async()=>{
 // Host adapter deliberately tries a failing mutation first, then retries the same envelope.
 const h=runtimeHost();let attempts=0;const insert=h.scope.ME.Insert;
 h.scope.ME.Insert=(slot,index,raw)=>{assert.throws(()=>insert('no',index,raw));attempts++;insert(slot,index,raw);};
 await run([draft(),call(me,'Insert',[l('items'),l(0),v('card')])],h);assert.equal(attempts,1);
 const defs=definitions();defs[2].slots.items.max=0;
 await assert.rejects(run([draft(),draft('child'),call(v('card'),'Insert',[l('items'),l(0),v('child')])],{registry:new PrototypeRegistry(defs)}),error('OBJECT.CARDINALITY'));
 const typeDefs=definitions();typeDefs[2].slots.items.accepts=['acme/fancy'];
 await assert.rejects(run([draft(),draft('child'),call(v('card'),'Insert',[l('items'),l(0),v('child')])],{registry:new PrototypeRegistry(typeDefs)}),error('OBJECT.CHILD_TYPE'));
 const duplicate=runtimeHost();await assert.rejects(run([draft(),call(me,'Insert',[l('items'),l(0),v('card')]),{...draft('other'),value:{op:'construct',type:'acme/card',id:l('card')}},call(me,'Insert',[l('items'),l(0),v('other')])],duplicate),error('MUTATION.DUPLICATE_ID'));
 assert.equal(dehydrate(h.runtime).slots.items.length,1);
});

test('opaque drafts cannot escape results, arrays/objects or service payloads; construction and combined call limits reduce only',async()=>{
 for(const value of [v('card'),{op:'array',items:[v('card')]},{op:'object',fields:{x:v('card')}}])await assert.rejects(run([draft(),ret(value)]),error('SEWN.TYPE'));
 await assert.rejects(run([draft(),{op:'service',library:'test',method:'save',input:v('card')}],{scope:{SERVICES:{Call(){throw Error('must not run');}}}}),error('SEWN.TYPE'));
 for(const limits of [{sewnDrafts:0},{sewnDraftNodes:0},{sewnConstructionOperations:0},{sewnConstructionSize:0}])await assert.rejects(run([draft()],{ctx:context({limits})}),error('SEWN.LIMIT'));
 for(const limits of [{sewnProcedureCalls:0},{sewnProcedureDepth:0},{sewnParameters:0}])await assert.rejects(run([draft(),method(v('card'),'settitle',[l('x')])],{ctx:context({limits})}),error('SEWN.LIMIT'));
 await assert.rejects(run([draft(),draft('child'),call(v('card'),'Insert',[l('items'),l(0),v('child')])],{ctx:context({limits:{sewnDraftDepth:0}})}),error('SEWN.LIMIT'));
});

test('overrides enforce explicit compatible signatures; static and dynamic method cycles fail closed',async()=>{
 for(const change of [d=>delete d.overrides,d=>d.behavior.procedures.settitle.params.push(param),d=>d.behavior.procedures.settitle.params[0].type='Number',d=>d.behavior.procedures.settitle={kind:'function',params:[param],returns:'String',body:[ret(l(''))]}]){const defs=definitions();change(defs[3]);assert.throws(()=>new PrototypeRegistry(defs),error('PROTOTYPE.METHOD'));}
 const defs=definitions();defs[2].behavior=doc([],{bounce:sub([method(me,'bounce')])});assert.throws(()=>new PrototypeRegistry(defs),error('PROTOTYPE.METHOD'));
 const dynamic=definitions();dynamic[2].behavior=doc([],{bounce:sub([{op:'declare',name:'other',value:me},method(v('other'),'bounce')])});
 await assert.rejects(run([draft(),method(v('card'),'bounce')],{registry:new PrototypeRegistry(dynamic)}),error('SEWN.LIMIT'));
 for(const schema of ['sewn/0.1','sewn/0.2'])assert.throws(()=>validate({...doc([draft()]),schema}),error('SEWN.INVALID'));
});

test('incomplete drafts share hydration defaults and remain retryable after property, permission and containment denial',async()=>{
 const {construction}=await import('../wydgine/object-model/construction.js');const {MAXIMA}=await import('../wydgine/sewn/schema.js');
 const defs=definitions();defs[2].properties={required:{type:'number',required:true},choice:{type:'string',enum:['yes'],default:'yes'}};
 const registry=new PrototypeRegistry(defs),ctx=context();let alive=true;const builders=construction(registry,ctx,MAXIMA,()=>assert.ok(alive));const draft=builders.create('acme/card','card');
 assert.equal(draft.properties.title,'');assert.equal(draft.properties.choice,'yes');assert.throws(()=>builders.envelope(draft),error('OBJECT.PROPERTY'));
 assert.throws(()=>draft.Set('choice','no'),error('OBJECT.PROPERTY'));assert.equal(draft.properties.choice,'yes');draft.Set('required',2);
 let runtime=hydrate(envelope('app','wydgit.core/app'),registry);assert.throws(()=>runtime.edit(context({capabilities:[]})).insertChild('app','items',0,builders.envelope(draft)),error('MUTATION.DENIED'));builders.check(draft);
 const edit=runtime.edit(ctx);assert.throws(()=>edit.insertChild('app','no',0,builders.envelope(draft)));builders.check(draft);edit.insertChild('app','items',0,builders.envelope(draft));runtime=edit.commit().runtime;builders.consume(draft);
 assert.equal(runtime.get('card').properties.required,2);assert.throws(()=>builders.consume(draft),error('OBJECT.CONSTRUCTION'));
 const another=builders.create('acme/card','child');alive=false;assert.throws(()=>another.properties);
 await assert.rejects(run([draftNode()],{ctx:context({scopes:{prototypes:'acme/card'}})}),error('SEAM.DENIED'));
 function draftNode(){return {op:'declare',name:'card',value:{op:'construct',type:'acme/card',id:l('card')}};}
});

test('method/procedure frames share call depth/count and receiver restoration; stale runtime receivers fail safely',async()=>{
 const defs=definitions();defs[2].behavior=doc([],{outer:fn('String',[{op:'return',value:{op:'functionCall',name:'inner',args:[]}}]),inner:fn('String',[ret(read(read(me,'properties'),'title'))])});
 const registry=new PrototypeRegistry(defs);
 await assert.rejects(run([draft(),ret(result(v('card'),'outer'))],{registry,ctx:context({limits:{sewnProcedureDepth:1}})}),error('SEWN.LIMIT'));
 await assert.rejects(run([draft(),ret(result(v('card'),'outer'))],{registry,ctx:context({limits:{sewnProcedureCalls:1}})}),error('SEWN.LIMIT'));
 const {WydgitError}=await import('../wydgine/object-model/index.js');const scope={ME:{get prototype(){throw new WydgitError('EVENT.INVALID','host detail must be hidden');}}};
 await assert.rejects(run([ret(result(me,'hastitle'))],{scope}),e=>e.code==='EVENT.INVALID'&&!e.message.includes('host detail'));
});


test('construction platform maxima cannot be widened by context limits',async()=>{
 const body=[{op:'declare',name:'card',value:l(null)},{op:'forEach',name:'iteration',items:l(Array.from({length:65},(_,i)=>i)),body:[{op:'set',name:'card',value:{op:'construct',type:'acme/card',id:l('card')}}]}];
 await assert.rejects(run(body,{ctx:context({limits:{sewnDrafts:10000,sewnDraftNodes:10000,sewnConstructionSize:1000000}})}),error('SEWN.LIMIT'));
});
