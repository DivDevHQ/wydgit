import test from 'node:test';import assert from 'node:assert/strict';
import {compile,compileModule,compilePrototype} from '../wydgine/wydbasic/index.js';import {execute} from '../wydgine/sewn/execute.js';import {validate} from '../wydgine/sewn/validate.js';import {ExecutionContext} from '../wydgine/seam/context.js';import {WydgitError} from '../wydgine/object-model/validation.js';
const run=(source,options={})=>execute(compile(source),{scope:{},context:new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'home'}),...options});
test('catch exposes only safe structured error and finally executes',async()=>{
 const source='DIM n AS Number = 0\nTRY\nn = Val("junk")\nCATCH err\nIF err.code = "SEWN.TYPE" THEN\nn = 2\nEND IF\nFINALLY\nn = n+1\nEND TRY\nRETURN n';assert.equal(compile(source).schema,'sewn/0.8');assert.equal((await run(source)).value,3);
 assert.deepEqual({...((await run('TRY\nRETURN Val("junk")\nCATCH err\nRETURN err\nEND TRY')).value)},{code:'SEWN.TYPE',message:'Invalid value or operation.'});
 assert.equal((await run('DIM n AS Number = 0\nTRY\nn = 2\nFINALLY\nn = n+1\nEND TRY\nRETURN n')).value,3);
});
test('finally runs on return, stop, exit for and nested recovery',async()=>{
 assert.equal((await run('TRY\nRETURN 1\nFINALLY\nRETURN 2\nEND TRY')).value,2);
 assert.equal((await run('TRY\nSTOP 1\nFINALLY\nRETURN 2\nEND TRY')).value,2);
 assert.equal((await run('DIM n AS Number = 0\nFOR EACH item IN [1,2]\nTRY\nEXIT FOR\nFINALLY\nn = n+1\nEND TRY\nNEXT item\nRETURN n')).value,1);
 assert.equal((await run('TRY\nTRY\nRETURN Val("x")\nFINALLY\nDIM done AS Boolean = TRUE\nEND TRY\nCATCH outer\nRETURN 7\nEND TRY')).value,7);
 const mod=compileModule('FUNCTION Read() AS Number\nTRY\nRETURN Val("x")\nCATCH err\nRETURN 3\nFINALLY\nDIM done AS Boolean = TRUE\nEND TRY\nEND FUNCTION\nEVENT Submit\nRETURN Read()\nEND EVENT');assert.equal((await execute(mod.events[0].workflow,{scope:{},context:new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'home'})})).value,3);
 assert.equal(compilePrototype('FUNCTION Read() AS Number\nTRY\nRETURN 1\nFINALLY\nRETURN 2\nEND TRY\nEND FUNCTION').schema,'sewn/0.8');
});
test('handler errors propagate with cleanup; catch variable is lexical',async()=>{
 assert.equal((await run('DIM n AS Number = 0\nTRY\nTRY\nn = Val("x")\nCATCH inner\nn = Val("y")\nFINALLY\nn = 4\nEND TRY\nCATCH outer\nRETURN n\nEND TRY\nRETURN 0')).value,4);
 assert.throws(()=>compile('TRY\nRETURN 1\nCATCH err\nRETURN 2\nEND TRY\nRETURN err'),{code:'WYDBASIC.NAME'});
 for(const s of ['TRY\nRETURN 1\nEND TRY','TRY\nRETURN 1\nCATCH\nEND TRY','TRY\nRETURN 1\nFINALLY\nEXIT FOR\nEND TRY'])assert.throws(()=>compile(s));
});
test('fatal denial, limits and unknown native errors bypass catch and finally',async()=>{
 for(const error of [new WydgitError('SEAM.DENIED','secret'),new WydgitError('SEWN.LIMIT','secret'),new Error('secret')]){
  let cleanup=0;const scope={RESPONSE:{WriteMarkdown(){cleanup++;}},REQUEST:{Form:{Get(){throw error;}}}};
  await assert.rejects(run('TRY\nDIM text AS String = REQUEST.Form.Get("x")\nCATCH err\nRESPONSE.WriteMarkdown("caught")\nFINALLY\nRESPONSE.WriteMarkdown("finally")\nEND TRY',{scope}),e=>e.message==='SEWN execution failed');assert.equal(cleanup,0);
 }
 await assert.rejects(run('TRY\nRETURN Val("x")\nCATCH err\nRETURN 2\nEND TRY',{context:new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'home',limits:{sewnSteps:1}})}),{code:'SEWN.LIMIT'});
});
test('older schemas stay closed and malformed try nodes are rejected',()=>{
 const node={op:'try',body:[],finally:[]};for(let i=1;i<=7;i++)assert.throws(()=>validate({schema:'sewn/0.'+i,...(i>1?{procedures:{}}:{}),body:[node]}));
 for(const node of [{op:'try',body:[]},{op:'try',body:[],catch:{name:'constructor',body:[]}},{op:'try',body:[],finally:[],extra:true},{op:'try',body:[],catch:{name:'err',body:[],extra:true}}])assert.throws(()=>validate({schema:'sewn/0.8',procedures:{},body:[node]}));
 assert.equal(compile('RETURN 1').schema,'sewn/0.1');
});

test('independent SEWN recovery and sequential catch scopes',async()=>{
 const literal=value=>({op:'literal',value});
 const doc={schema:'sewn/0.8',procedures:{},body:[{op:'try',body:[{op:'return',value:{op:'convert',type:'Number',value:literal('bad')}}],catch:{name:'err',body:[{op:'return',value:{op:'read',target:{op:'variable',name:'err'},key:'code'}}]},finally:[]}]};
 assert.equal((await execute(doc,{scope:{},context:new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'home'})})).value,'SEWN.TYPE');
 assert.equal((await run('DIM n AS Number = 0\nTRY\nn = Val("x")\nCATCH err\nn = 1\nEND TRY\nTRY\nn = Val("y")\nCATCH err\nn = n+1\nEND TRY\nRETURN n')).value,2);
});
