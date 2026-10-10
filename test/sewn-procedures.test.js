import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../wydgine/sewn/validate.js';
import {execute} from '../wydgine/sewn/execute.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {fixture,runPage} from '../test-support/events.js';
// These documents are hand-authored. This file deliberately never imports WydBASIC.
const l=value=>({op:'literal',value}),v=name=>({op:'variable',name}),c=name=>({op:'context',name});
const ret=value=>({op:'return',value}),param=(name,type)=>({name,type});
const fn=(params,returns,body)=>({kind:'function',params,returns,body}),sub=(params,body)=>({kind:'sub',params,body});
const call=(name,args=[])=>({op:'procedureCall',name,args}),invoke=(name,args=[])=>({op:'functionCall',name,args});
const doc=(procedures,body=[])=>({schema:'sewn/0.2',procedures,body});
const ctx=limits=>new ExecutionContext({publisher:'acme',self:'home',limits});
const run=(document,limits={},scope={})=>execute(document,{context:ctx(limits),scope});
const rejects=(document,code='SEWN.INVALID')=>assert.throws(()=>validate(document),e=>e.code===code);
const fails=(document,code='SEWN.TYPE',limits={},scope={})=>assert.rejects(()=>run(document,limits,scope),e=>e.code===code);

test('hand-authored SEWN functions and SUBs own parameters, results, early return and fresh frames',async()=>{
 const document=doc({
  full:fn([param('first','String'),param('last','String')],'String',[
   {op:'declare',name:'result',value:{op:'binary',operator:'concat',left:v('first'),right:v('last')}},ret(v('result'))]),
  early:sub([],[{op:'return'},{op:'set',name:'unreachable',value:l(1)}]),
  empty:sub([],[]),
  byval:fn([param('value','Number')],'Number',[{op:'set',name:'value',value:l(9)},ret(v('value'))])
 },[{op:'declare',name:'value',value:l(1)},call('early'),call('empty'),
  {op:'declare',name:'ignored',value:invoke('byval',[v('value')])},
  ret({op:'array',items:[invoke('full',[l('A'),l('B')]),invoke('full',[l('C'),l('D')]),v('value')]})]);
 assert.deepEqual((await run(document)).value,['AB','CD',1]);assert.deepEqual(await run(document),await run(document));
 assert.ok(Object.isFrozen(validate(document).procedures.full.body));
 await fails(doc({hidden:fn([],'String',[ret(v('caller'))])},[{op:'declare',name:'caller',value:l('secret')},ret(invoke('hidden'))]));
 await fails(doc({local:sub([],[{op:'declare',name:'private',value:l(1)}])},[call('local'),ret(v('private'))]));
});

test('closed SEWN 0.2 procedure declarations, calls and return grammar reject malformed programs',()=>{
 const good=sub([param('value','String')],[]);
 for(const procedures of [[],null,{bad:{...good,kind:'callback'}},{bad:{...good,host:()=>{}}},{bad:{...good,params:[param('x','Native')]}},{bad:{...good,params:[param('x','String'),param('x','Number')]}},{bad:{...good,params:[param('ME','String')]}},{me:good},{Bad:good},{bad:{...good,returns:'Null'}},{bad:fn([],'Native',[])}])rejects(doc(procedures));
 for(const body of [[call('missing')],[invoke('bad')].map(ret),[call('bad',[])],[call('bad',[l('a'),l('b')])],[{op:'procedureCall',name:l('bad'),args:[l('a')]}]])rejects(doc({bad:good},body));
 rejects(doc({bad:fn([],'String',[ret(l('a'))])},[call('bad')]));
 rejects(doc({bad:sub([],[ret(l(1))])}));rejects(doc({bad:fn([],'Number',[{op:'return'}])}));
 rejects(doc({bad:sub([],[{op:'stop'}])}));rejects(doc({},[{op:'return'}]));
 rejects({...doc({},[]),procedures:{bad:{...good,params:[{...param('x','String'),optional:true}]}}});
 rejects(doc({bad:sub(Array.from({length:17},(_,i)=>param('p'+i,'String')),[])}),'SEWN.LIMIT');
});

test('SEWN rejects direct and indirect cycles including unreachable calls',()=>{
 rejects(doc({a:sub([],[call('a')])}));
 rejects(doc({a:sub([],[call('b')]),b:sub([],[call('c')]),c:sub([],[call('a')])}));
 rejects(doc({a:fn([],'Number',[ret(invoke('a'))])}));
 rejects(doc({a:sub([],[{op:'if',condition:l(false),then:[call('a')]}])}));
});

test('SEWN runtime checks dynamic parameter/result types and fail-closed FUNCTION completion',async()=>{
 await fails(doc({missing:fn([],'Number',[])},[ret(invoke('missing'))]));
 await fails(doc({wrong:fn([],'Boolean',[ret(l(1))])},[ret(invoke('wrong'))]));
 for(const [type,bad] of [['String',1],['Number','1'],['Boolean',null],['Null',false],['Array',{}],['Object',[]],['Wydgit',{}]])await fails(doc({typed:sub([param('input',type)],[])},[call('typed',[l(bad)])]));
 for(const [type,good] of [['String','a'],['Number',1],['Boolean',true],['Null',null],['Array',[1]],['Object',{a:1}]])assert.deepEqual(JSON.parse(JSON.stringify((await run(doc({typed:fn([param('input',type)],type,[ret(v('input'))])},[ret(invoke('typed',[l(good)]))]))).value)),good);
 await fails(doc({typed:sub([param('input','Object')],[])},[call('typed',[c('REQUEST')])]),'SEWN.TYPE',{}, {REQUEST:{}});
});

test('procedure count/depth/parameters/locals and all existing budgets are shared across frames',async()=>{
 const document=doc({outer:sub([],[call('inner')]),inner:sub([ ],[])},[call('outer')]);
 await fails(document,'SEWN.LIMIT',{sewnProcedureDepth:1});await fails(document,'SEWN.LIMIT',{sewnProcedureCalls:1});
 await fails(document,'SEWN.LIMIT',{sewnProcedureDepth:0});await fails(document,'SEWN.LIMIT',{sewnProcedureCalls:0});
 const identity=doc({id:fn([param('value','String')],'String',[ret(v('value'))])},[ret(invoke('id',[l('abc')]))]);
 await fails(identity,'SEWN.LIMIT',{sewnParameters:0});await fails(identity,'SEWN.LIMIT',{sewnVariables:0});await fails(identity,'SEWN.LIMIT',{sewnString:2});await fails(identity,'SEWN.LIMIT',{sewnSteps:3});
 const locals=doc({inner:sub([],[{op:'declare',name:'b',value:l(2)}])},[{op:'declare',name:'a',value:l(1)},call('inner')]);await fails(locals,'SEWN.LIMIT',{sewnVariables:1});
 const loop=doc({repeat:sub([],[{op:'forEach',name:'i',items:l([1,2]),body:[]}])},[call('repeat'),call('repeat')]);await fails(loop,'SEWN.LIMIT',{sewnIterations:3});
 const service={op:'serviceCall',library:'test',method:'save',input:l({})};
 const services=doc({save:fn([],'Object',[ret(service)])},[{op:'declare',name:'a',value:invoke('save')},ret(invoke('save'))]);
 await fails(services,'SEWN.LIMIT',{sewnServiceCalls:1},{SERVICES:{Call:async()=>({ok:true})}});
 await fails(services,'SEWN.LIMIT',{sewnTimeMs:5},{SERVICES:{Call:()=>new Promise(resolve=>setTimeout(()=>resolve({ok:true}),30))}});
});

test('hand-authored nested service functions retain the exact host-issued ExecutionContext',async()=>{
 const base=fixture(),context=base.context;let captured;
 const libraries={bind(actual){captured=actual;return {call:async()=>{actual.require('store.records.create');return {ok:true};}};}};
 const workflow=doc({save:fn([],'Object',[ret({op:'serviceCall',library:'wydstore',method:'create',input:l({})})]),outer:fn([],'Object',[ret(invoke('save'))])},[ret(invoke('outer'))]);
 const handlers=[{owner:'home',type:'Page.Load',workflow}];
 const result=await runPage({context,libraries,handlers});assert.equal(result.error.code,'SEAM.DENIED');assert.equal(captured,context);
 const allowed=new ExecutionContext({...context,capabilities:[...context.capabilities,'store.records.create']});assert.equal((await runPage({context:allowed,libraries,handlers})).error,null);assert.equal(captured,allowed);
});

test('opaque handle parameters retain mutation authority and stale handle checks through nested frames',async()=>{
 const remove={op:'call',target:v('item'),method:'Remove',args:[]};
 const workflow=doc({remove:sub([param('item','Wydgit')],[remove]),outer:sub([param('item','Wydgit')],[call('remove',[v('item')])])},[call('outer',[c('ME')])]);
 const handlers=[{owner:'note',type:'Page.Load',workflow}];
 assert.equal((await runPage({handlers})).error,null);
 assert.equal((await runPage({handlers,context:fixture({capabilities:[]}).context})).error.code,'MUTATION.DENIED');
 const stale=doc(workflow.procedures,[{op:'declare',name:'old',value:c('ME')},call('outer',[v('old')]),call('outer',[v('old')])]);assert.equal((await runPage({handlers:[{owner:'note',type:'Page.Load',workflow:stale}]})).error.code,'EVENT.DENIED');
 const leak=doc({id:fn([param('item','Wydgit')],'Wydgit',[ret(v('item'))])},[ret(invoke('id',[c('ME')]))]);assert.equal((await runPage({handlers:[{owner:'home',type:'Page.Load',workflow:leak}]})).error.code,'SEWN.TYPE');
});

test('historical SEWN 0.1 remains executable and rejects 0.2 syntax',async()=>{
 assert.equal((await run({schema:'sewn/0.1',body:[ret(l('legacy'))]})).value,'legacy');
 for(const body of [[call('x')],[ret(invoke('x'))],[ret({op:'serviceCall',library:'test',method:'save',input:l({})})],[{op:'return'}]])rejects({schema:'sewn/0.1',body});
 rejects({schema:'sewn/0.1',procedures:{},body:[]});
});

test('reduced expression/nesting/value limits apply to procedure arguments and callee operations',async()=>{
 const identity=doc({id:fn([param('value','Number')],'Number',[ret(v('value'))])},[ret(invoke('id',[l(1)]))]);await fails(identity,'SEWN.LIMIT',{sewnExpressionDepth:0});
 const branch=doc({inner:sub([],[{op:'if',condition:l(true),then:[]}]),outer:sub([],[{op:'if',condition:l(true),then:[call('inner')]}])},[call('outer')]);await fails(branch,'SEWN.LIMIT',{sewnNesting:1});
 const service=doc({load:fn([],'Object',[ret({op:'serviceCall',library:'test',method:'load',input:l({})})])},[ret(invoke('load'))]);await fails(service,'SEWN.LIMIT',{sewnExpressionDepth:0},{SERVICES:{Call:async()=>({ok:true})}});
 await fails(doc({branch:sub([],[{op:'if',condition:l(true),then:[]}])},[call('branch')]),'SEWN.LIMIT',{sewnNesting:0});
 await fails(doc({array:fn([],'Array',[ret(l([1,2]))])},[ret(invoke('array'))]),'SEWN.LIMIT',{sewnValueNodes:2});
});

test('SEWN service expressions cannot serialize opaque references or invoke reflective procedures',async()=>{
 const service=doc({leak:fn([param('item','Wydgit')],'Object',[ret({op:'serviceCall',library:'test',method:'save',input:v('item')})])},[ret(invoke('leak',[c('ME')]))]);let calls=0;
 await fails(service,'SEWN.TYPE',{}, {ME:{},SERVICES:{Call:async()=>{calls++;return {ok:true};}}});assert.equal(calls,0);
 for(const name of ['constructor','__proto__','prototype','eval','function','process','globalthis','window','document','require','import','fs','child_process'])rejects(doc({[name]:sub([],[])},[]));
 const native=doc({escape:sub([],[{op:'call',target:c('ME'),method:'native',args:[]}])},[call('escape')]);await fails(native,'SEWN.DENIED',{}, {ME:{}});
});

test('hard procedure call/depth maxima cannot be widened by ExecutionContext grants',async()=>{
 const calls=doc({noop:sub([],[])},Array.from({length:257},()=>call('noop')));await fails(calls,'SEWN.LIMIT',{sewnProcedureCalls:10000});
 const procedures={};for(let i=0;i<17;i++)procedures['p'+i]=sub([],i<16?[call('p'+(i+1))]:[]);
 await fails(doc(procedures,[call('p0')]),'SEWN.LIMIT',{sewnProcedureDepth:10000});
 const params=Array.from({length:16},(_,i)=>param('p'+i,'Number'));
 assert.equal((await run(doc({last:fn(params,'Number',[ret(v('p15'))])},[ret(invoke('last',Array.from({length:16},(_,i)=>l(i))))]))).value,15);
});
