import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../wydgine/sewn/validate.js';
import {execute} from '../wydgine/sewn/execute.js';
import {ExecutionContext,PrototypeRegistry} from '../wydgine/object-model/index.js';
import {bindMembers} from '../wydgine/object-model/members.js';
// Hand-authored wire documents; deliberately no source compiler import.
const l=value=>({op:'literal',value}),v=name=>({op:'variable',name}),ret=value=>({op:'return',value});
const nil=(value,negate=false)=>({op:'isNull',value,negate});
const loop=(name,items,body)=>({op:'forEach',name,items:l(items),body});
const doc=(body,procedures={})=>({schema:'sewn/0.6',procedures,body});
const ctx=extra=>new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'home',...extra});
const run=(p,extra={})=>execute(p,{context:ctx(),scope:{},...extra});
const exit={op:'exitFor'},add=name=>({op:'set',name,value:{op:'binary',operator:'+',left:v(name),right:l(1)}});

test('SEWN null tests distinguish null from every falsy value and data container',async()=>{
 const values=[null,false,0,'',[],{}];const result=await run(doc([ret({op:'array',items:values.flatMap(x=>[nil(l(x)),nil(l(x),true)])})]));assert.deepEqual(result.value,[true,false,false,true,false,true,false,true,false,true,false,true]);
});

test('SEWN null checks preserve handle opacity, context isolation, and live invocation guards',async()=>{
 const context=ctx(),handle={id:'h'};let live=true;bindMembers(handle,{context,node(){assert.ok(live,'stale');return {id:'h'};}});
 assert.equal((await run(doc([ret(nil({op:'context',name:'ME'},true))]),{context,scope:{ME:handle}})).value,true);
 await assert.rejects(run(doc([ret(nil({op:'context',name:'ME'}))]),{context:ctx(),scope:{ME:handle}}),{code:'OBJECT.ACCESS'});
 live=false;await assert.rejects(run(doc([ret(nil({op:'context',name:'ME'}))]),{context,scope:{ME:handle}}),{code:'SEWN.EXECUTION_FAILED'});
 await assert.rejects(run(doc([ret(nil({op:'context',name:'REQUEST'}))]),{scope:{REQUEST:{}}}),{code:'SEWN.TYPE'});
 await assert.rejects(run(doc([ret({op:'context',name:'ME'})]),{scope:{ME:{id:'h'}}}),{code:'SEWN.TYPE'});
});

test('EXIT FOR leaves only the nearest loop, continues subsequent code and cleans its variable',async()=>{
 const p=doc([{op:'declare',name:'count',value:l(0)},loop('outer',[1,2,3],[loop('inner',[4,5],[add('count'),exit,add('count')]),add('count')]),{op:'declare',name:'inner',value:l(7)},ret({op:'array',items:[v('count'),v('inner')]})]);assert.deepEqual((await run(p)).value,[6,7]);
 await assert.rejects(run(doc([loop('item',[1],[exit]),ret(v('item'))])),{code:'SEWN.TYPE'});
});

test('loop exits cannot escape procedure boundaries; RETURN remains distinct',async()=>{
 const procedures={work:{kind:'sub',params:[],body:[loop('local',[1,2],[exit])]},find:{kind:'function',params:[],returns:'Number',body:[loop('local',[1,2],[ret(v('local'))]),ret(l(0))]}};
 const p=doc([{op:'declare',name:'count',value:l(0)},loop('outer',[1,2],[{op:'procedureCall',name:'work',args:[]},add('count')]),ret({op:'array',items:[v('count'),{op:'functionCall',name:'find',args:[]}]})],procedures);assert.deepEqual((await run(p)).value,[2,1]);
 assert.throws(()=>validate(doc([loop('outer',[1],[{op:'procedureCall',name:'bad',args:[]}])],{bad:{kind:'sub',params:[],body:[exit]}})),{code:'SEWN.INVALID'});
});

test('closed wire versions reject new operations, malformed null tests and unbound exits',()=>{
 for(const schema of ['sewn/0.1','sewn/0.2','sewn/0.3','sewn/0.4','sewn/0.5']){
  for(const body of [[ret(nil(l(null)))],[loop('item',[1],[exit])]]){const p={schema,body,...(schema==='sewn/0.1'?{}:{procedures:{}})};assert.throws(()=>validate(p),{code:'SEWN.INVALID'});}
 }
 for(const p of [doc([exit]),doc([{op:'if',condition:l(true),then:[exit]}]),doc([ret({op:'isNull',value:l(null)})]),doc([ret({...nil(l(null)),negate:'yes'})]),doc([loop('item',[1],[{op:'exitFor',value:l(1)}])])])assert.throws(()=>validate(p),{code:'SEWN.INVALID'});
 // Keywords added in 0.6 do not retroactively invalidate old procedure identities.
 assert.equal(validate({schema:'sewn/0.2',procedures:{exit:{kind:'sub',params:[],body:[]}},body:[]}).schema,'sewn/0.2');
});

test('early exit consumes actual iterations without resetting shared resource ceilings',async()=>{
 const p=doc([loop('item',[1,2,3],[exit]),ret(l(true))]);assert.equal((await run(p,{context:ctx({limits:{sewnIterations:1}})})).value,true);
 await assert.rejects(run(p,{context:ctx({limits:{sewnIterations:0}})}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(doc([loop('first',[1],[exit]),loop('second',[1],[exit])]),{context:ctx({limits:{sewnIterations:1}})}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(doc([ret(nil(l(null)))]),{context:ctx({limits:{sewnSteps:1}})}),{code:'SEWN.LIMIT'});
});

test('null test cannot revive a consumed construction draft',async()=>{
 const registry=new PrototypeRegistry([{id:'acme/card',publisher:'acme',properties:{},slots:{}}]);const context=ctx({capabilities:['object.instances.construct'],scopes:{prototypes:['acme/card']}});
 const p=doc([{op:'declare',name:'card',value:{op:'construct',type:'acme/card',id:l('draft')}},{op:'call',target:{op:'context',name:'ME'},method:'Insert',args:[l('items'),l(0),v('card')]},ret(nil(v('card'),true))]);
 await assert.rejects(run(p,{context,prototypeRegistry:registry,scope:{ME:{id:'home',Insert(){}}}}),{code:'OBJECT.CONSTRUCTION'});
});
