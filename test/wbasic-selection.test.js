import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,compileModule,compilePrototype,parse} from '../wydgine/wydbasic/index.js';
import {validate} from '../wydgine/sewn/validate.js';
import {execute} from '../wydgine/sewn/execute.js';
import {ExecutionContext,PrototypeRegistry} from '../wydgine/object-model/index.js';
import {bindMembers} from '../wydgine/object-model/members.js';
import {fixture,runPage} from '../test-support/events.js';
const context=new ExecutionContext({publisher:'acme',self:'home'});
const run=(source,scope={},ctx=context)=>execute(compile(source),{context:ctx,scope});
const literal=value=>({op:'literal',value});
const document=body=>({schema:'sewn/0.9',procedures:{},body});

test('selection values, ordering, first match, no fallthrough, strict equality and nesting',async()=>{
 for(const [selector,expected] of [['2','values'],['4','ordered']])assert.equal((await run(`SELECT CASE ${selector}\nCASE 1, 2, 3\nRETURN "values"\nCASE IS >= 4, IS < 0\nRETURN "ordered"\nCASE NULL\nRETURN "null"\nCASE ELSE\nRETURN "else"\nEND SELECT`)).value,expected);
 assert.equal((await run('DIM n=0\nSELECT CASE 1\nCASE 1\nn=2\nCASE 1\nn=3\nEND SELECT\nRETURN n')).value,2);
 assert.equal((await run('SELECT CASE 9\nCASE 1\nRETURN 0\nEND SELECT\nRETURN 7')).value,7);
 assert.equal((await run('FOR EACH x IN [1,2]\nSELECT CASE x\nCASE 1\nSELECT CASE TRUE\nCASE TRUE\nEXIT FOR\nEND SELECT\nEND SELECT\nNEXT x\nRETURN 8')).value,8);
 assert.equal((await run('SELECT CASE "2"\nCASE 2\nRETURN FALSE\nCASE ELSE\nRETURN TRUE\nEND SELECT')).value,true);
 assert.equal((await run('SELECT CASE NULL\nCASE NULL\nRETURN TRUE\nEND SELECT')).value,true);
 assert.equal(parse('select case 1\ncase else\nend select').body[0].kind,'select');
});

test('selector and lazy case operands execute once in source order',async()=>{
 let calls=0;const scope={REQUEST:{IsPost:false},ME:{id:'home',Set(){calls++;}}};
 const workflow=compileModule(`FUNCTION Pick() AS Number\nMe.Set("title", "pick")\nRETURN 2\nEND FUNCTION\nFUNCTION Bad() AS Number\nRETURN Val("invalid")\nEND FUNCTION\nEVENT Page.Load\nSELECT CASE Pick()\nCASE 1, 2, Bad()\nRETURN 4\nCASE Bad()\nRETURN 0\nEND SELECT\nRETURN 0\nEND EVENT`).events[0].workflow;
 assert.equal(workflow.schema,'sewn/0.9');assert.equal((await execute(workflow,{context,scope})).value,4);assert.equal(calls,1);
});

test('identity compares underlying objects across fresh tokens and procedure frames, not IDs',async()=>{
 const me={id:'same'},other={id:'same'};
 assert.deepEqual((await run('RETURN [Me IS Me, Me IS NOT Page, NOT Me IS Page, NULL IS Me, Me IS NOT NULL]',{ME:me,PAGE:other})).value,[true,true,true,false,true]);
 const node={id:'same',prototype:'acme/card'},a={id:'same'},b={id:'same'};bindMembers(a,{context,node:()=>node});bindMembers(b,{context,node:()=>node});
 assert.equal((await run('RETURN Me IS Page',{ME:a,PAGE:b})).value,true);
 const mod=compileModule('FUNCTION Same(a AS Wydgit, b AS Wydgit) AS Boolean\nRETURN a IS b\nEND FUNCTION\nEVENT Page.Load\nSELECT CASE Me\nCASE IS Page\nRETURN Same(Me, Page)\nCASE IS NULL\nRETURN FALSE\nCASE ELSE\nRETURN FALSE\nEND SELECT\nEND EVENT').events[0].workflow;
 assert.equal((await execute(mod,{context,scope:{ME:me,PAGE:me}})).value,true);
 const foreign=new ExecutionContext({publisher:'acme',self:'home'});bindMembers(b,{context:foreign,node:()=>node});await assert.rejects(run('RETURN Me IS Page',{ME:a,PAGE:b}),{code:'OBJECT.ACCESS'});
});

test('grammar and compiler reject malformed, unsupported and incompatible selection',()=>{
 for(const bad of ['SELECT CASE 1\nEND SELECT','SELECT CASE 1\nCASE ELSE\nCASE 1\nEND SELECT','SELECT CASE 1\nCASE\nEND SELECT','SELECT CASE 1\nCASE 1,\nEND SELECT','SELECT CASE 1\nCASE 1 TO 2\nEND SELECT','SELECT CASE []\nCASE ELSE\nEND SELECT','SELECT CASE Me\nCASE Me\nEND SELECT','SELECT CASE 1\nCASE IS Me\nEND SELECT','SELECT CASE 1\nCASE IS < "x"\nEND SELECT','RETURN REQUEST IS Me','RETURN {} IS Me','RETURN 1 IS 1','SELECT CASE 1\nCASE 1\nDIM x=1\nEND SELECT\nRETURN x'])assert.throws(()=>compile(bad),e=>e.code.startsWith('WYDBASIC.'));
 for(const bad of ['FOR i=1 TO 2\nNEXT i'])assert.throws(()=>compile(bad));
 assert.equal(compile('DIM case=1\nRETURN case').schema,'sewn/0.1');
 assert.equal(compile('RETURN NULL IS NULL').schema,'sewn/0.6');assert.equal(compile('RETURN Val("1")').schema,'sewn/0.7');assert.equal(compile('TRY\nRETURN 1\nFINALLY\nEND TRY').schema,'sewn/0.8');
});

test('independent closed wire grammar and runtime type guards',async()=>{
 const selection={op:'select',value:literal(2),cases:[{tests:[{operator:'=',value:literal(2)}],body:[{op:'return',value:literal(3)}]}]};
 assert.equal((await execute(document([selection]),{context,scope:{}})).value,3);
 const identity={op:'identity',left:literal(null),right:literal(null),negate:false};assert.equal((await execute(document([{op:'return',value:identity}]),{context,scope:{}})).value,true);
 for(let i=1;i<=8;i++)for(const body of [[selection],[{op:'return',value:identity}]])assert.throws(()=>validate({schema:`sewn/0.${i}`,...(i>1?{procedures:{}}:{}),body}));
 for(const node of [{...selection,extra:1},{...selection,cases:[]},{...selection,cases:[{tests:[],body:[]}]},{...selection,cases:[{tests:[{operator:'AND',value:literal(1)}],body:[]}]},{...selection,cases:[{tests:[{operator:'=',value:literal(1),extra:1}],body:[]}]},{...selection,cases:[{tests:[{operator:'=',value:literal(1)}],body:[],op:'if'}]}])assert.throws(()=>validate(document([node])));
 for(const operand of [[],{},1,true,'x'])await assert.rejects(execute(document([{op:'return',value:{...identity,left:literal(operand)}}]),{context,scope:{}}),{code:'SEWN.TYPE'});
 await assert.rejects(execute(document([{...selection,value:literal([])}]),{context,scope:{}}),{code:'SEWN.TYPE'});
});

test('selection and identity spend shared steps and preserve fatal limits',async()=>{
 const limited=new ExecutionContext({publisher:'acme',self:'home',limits:{sewnSteps:4}});
 await assert.rejects(run('SELECT CASE 2\nCASE 1, 2\nRETURN 3\nEND SELECT',{},limited),{code:'SEWN.LIMIT'});
 await assert.rejects(run('TRY\nRETURN Me IS Me\nCATCH err\nRETURN FALSE\nEND TRY',{ME:{id:'home'}},new ExecutionContext({publisher:'acme',self:'home',limits:{sewnSteps:3}})),{code:'SEWN.LIMIT'});
});

test('prototype methods and authorized Page integration use selection',async()=>{
 const behavior=compilePrototype('FUNCTION Same(other AS Wydgit) AS Boolean\nSELECT CASE Me\nCASE IS other\nRETURN TRUE\nCASE ELSE\nRETURN FALSE\nEND SELECT\nEND FUNCTION');
 const registry=new PrototypeRegistry([{id:'acme/card',publisher:'acme',properties:{},slots:{},behavior}]);
 assert.equal((await execute(compile('RETURN Me.Same(Me)'),{context,scope:{ME:{id:'home',prototype:'acme/card'}},prototypeRegistry:registry})).value,true);
 const result=await runPage({...fixture(),handlers:[{type:'Page.Load',owner:'name',wydBasic:'SELECT CASE Me\nCASE IS Me\nMe.Set("label", "Selected")\nEND SELECT'}]});assert.equal(result.error,null);assert.match(result.transport.text,/Selected/);
});


test('identity and selection retain consumed-draft and stale-handle guards',async()=>{
 const registry=new PrototypeRegistry([{id:'acme/card',publisher:'acme',properties:{},slots:{}}]);
 const ctx=new ExecutionContext({publisher:'acme',self:'home',capabilities:['object.instances.construct'],scopes:{prototypes:['acme/card']}});
 for(const suffix of ['RETURN card IS card','SELECT CASE card\nCASE ELSE\nRETURN TRUE\nEND SELECT'])await assert.rejects(execute(compile('DIM card AS Wydgit\nSET card=NEW "acme/card"("draft")\nMe.Insert("items", 0, card)\n'+suffix),{context:ctx,prototypeRegistry:registry,scope:{ME:{id:'home',Insert(){}}}}),{code:'OBJECT.CONSTRUCTION'});
 const handle={id:'home'};bindMembers(handle,{context,node(){throw new Error('stale private details');}});
 await assert.rejects(run('RETURN Me IS NULL OR Me IS Me',{ME:handle}),e=>e.code==='SEWN.EXECUTION_FAILED'&&!e.message.includes('private'));
 const denied=await runPage({...fixture({editable:[],capabilities:[]}),handlers:[{type:'Page.Load',owner:'name',wydBasic:'SELECT CASE Me\nCASE IS Me\nMe.Set("label", "Denied")\nEND SELECT'}]});assert.ok(denied.error);assert.doesNotMatch(denied.transport.text,/Denied/);
});
