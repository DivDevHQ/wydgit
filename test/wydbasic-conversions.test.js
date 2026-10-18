import test from 'node:test';import assert from 'node:assert/strict';
import {compile,compileModule,compilePrototype} from '../wydgine/wydbasic/index.js';import {execute} from '../wydgine/sewn/execute.js';import {ExecutionContext,PrototypeRegistry} from '../wydgine/object-model/index.js';import {fixture,runPage} from '../test-support/events.js';
const context=new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'home'}),run=source=>execute(compile(source),{context,scope:{}});

test('conversion intrinsics work in bodies/modules with static types and one argument',async()=>{
 const source='DIM label AS String = cStR(42)\nDIM offset AS Number = vAl(" 10 ")\nRETURN [label, offset+1, CStr(FALSE)]';assert.equal(compile(source).schema,'sewn/0.7');assert.deepEqual((await run(source)).value,['42',11,'False']);
 for(const source of ['RETURN CStr()','RETURN Val("1","2")','RETURN CStr(NULL)','RETURN Val(TRUE)','RETURN CStr({})','RETURN Val([])','RETURN CStr(Me)','RETURN Val(REQUEST)','DIM n AS Number = CStr(1)','DIM s AS String = Val("1")'])assert.throws(()=>compile(source),{code:'WYDBASIC.TYPE'});
 for(const name of ['CStr','Val'])assert.throws(()=>compileModule(`FUNCTION ${name}() AS Number\nRETURN 1\nEND FUNCTION`),{code:'WYDBASIC.NAME'});
 assert.equal(compile('RETURN 1').schema,'sewn/0.1');assert.equal(compile('RETURN NULL IS NULL').schema,'sewn/0.6');
});

test('nested conversion composes with control, procedures and prototype methods',async()=>{
 const source=`FUNCTION Twice(text AS String) AS Number
 RETURN Val(text)*2
END FUNCTION
EVENT Page.Load
 DIM answer = 0
 FOR EACH item IN ["2","3"]
  answer=Twice(item)
  EXIT FOR
 NEXT item
 RETURN CStr(answer)
END EVENT`;
 assert.equal((await execute(compileModule(source).events[0].workflow,{context,scope:{}})).value,'4');
 const behavior=compilePrototype('FUNCTION Format(value AS Number) AS String\nRETURN CStr(value)\nEND FUNCTION');assert.equal(behavior.schema,'sewn/0.7');const registry=new PrototypeRegistry([{id:'acme/card',publisher:'acme',properties:{},slots:{},behavior}]);const workflow=compileModule('EVENT Page.Load\nRETURN Me.Format(7)\nEND EVENT').events[0].workflow;assert.equal((await execute(workflow,{context,scope:{ME:{id:'home',prototype:'acme/card'}},prototypeRegistry:registry})).value,'7');
});

test('request conversion is explicit; bad numeric input fails instead of defaulting to zero',async()=>{
 const base=fixture(),source=`EVENT Page.Load
 DIM offset AS Number = Val(REQUEST.Query.Get("offset"))
 IF offset >= 0 THEN
  Me.Set("label", "Offset " & CStr(offset))
 END IF
END EVENT`;
 const good=await runPage({...base,input:{method:'GET',path:'/',query:'offset=10'},handlers:[{owner:'form',wydBasicModule:source}]});assert.equal(good.error,null);assert.match(good.transport.text,/Offset 10/);
 const bad=await runPage({...base,input:{method:'GET',path:'/',query:'offset=10junk'},handlers:[{owner:'form',wydBasicModule:source}]});assert.equal(bad.error.code,'SEWN.TYPE');
});
