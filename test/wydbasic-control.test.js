import test from 'node:test';import assert from 'node:assert/strict';
import {compile,compileModule,compilePrototype} from '../wydgine/wydbasic/index.js';import {execute} from '../wydgine/sewn/execute.js';import {ExecutionContext,PrototypeRegistry} from '../wydgine/object-model/index.js';import {fixture,runPage} from '../test-support/events.js';
const context=new ExecutionContext({publisher:'acme',self:'home'}),run=source=>execute(compile(source),{context,scope:{}});

test('IS NULL and IS NOT NULL compose with NOT/AND/OR and retain explicit boolean semantics',async()=>{
 const source='RETURN [NULL IS NULL, FALSE IS NOT NULL, NOT NULL IS NULL, NULL IS NULL AND FALSE IS NOT NULL, 0 IS NULL OR "" IS NOT NULL]';assert.deepEqual((await run(source)).value,[true,true,false,true,true]);assert.equal(compile(source).schema,'sewn/0.6');
 for(const bad of ['RETURN 1 IS 2','RETURN NULL IS NOT','RETURN NULL IS NOT TRUE','RETURN NULL IsNot NULL','IF REQUEST IS NULL THEN\nRETURN TRUE\nEND IF'])assert.throws(()=>compile(bad),e=>e.code.startsWith('WYDBASIC.'));
 assert.throws(()=>compile('DIM item AS Wydgit\nIF item THEN\nRETURN TRUE\nEND IF'),{code:'WYDBASIC.TYPE'});
 assert.throws(()=>compile('DIM item AS Wydgit\nRETURN item = NULL'),{code:'WYDBASIC.TYPE'});
 assert.equal(compile('RETURN 1').schema,'sewn/0.1');
});

test('EXIT FOR is case-insensitive, nearest-loop scoped, and invalid outside lexical loops',async()=>{
 const p='DIM count = 0\nFOR EACH a IN [1,2]\nFOR EACH b IN [3,4]\ncount=count+1\nExIt FoR\nNEXT b\ncount=count+1\nNEXT a\nRETURN count';assert.equal((await run(p)).value,4);
 for(const bad of ['EXIT FOR','IF TRUE THEN\nEXIT FOR\nEND IF','FOR EACH x IN [1]\nEXIT WHILE\nNEXT x','FOR EACH x IN [1]\nEXIT FOR 1\nNEXT x'])assert.throws(()=>compile(bad),e=>e.code.startsWith('WYDBASIC.'));
 assert.throws(()=>compileModule('SUB Bad()\nEXIT FOR\nEND SUB\nEVENT Page.Load\nFOR EACH x IN [1]\nCALL Bad()\nNEXT x\nEND EVENT'),{code:'WYDBASIC.TYPE'});
});

test('FindNode returns nullable Wydgit once; Page workflow uses IS NOT NULL and EXIT FOR',async()=>{
 const base=fixture();const source=`FUNCTION FindNode(parent AS Wydgit, slotName AS String, sId AS String) AS Wydgit
 FOR EACH node IN parent.related("children", slotName)
  IF node.id = sId THEN
   RETURN node
  END IF
 NEXT node
 RETURN NULL
END FUNCTION
EVENT Page.Load
 DIM item AS Wydgit
 SET item = FindNode(Me, "blocks", "form")
 IF item IS NOT NULL THEN
  item.Set("label", "Found once")
 END IF
 SET item = FindNode(Me, "blocks", "missing")
 IF item IS NULL THEN
  FOR EACH child IN Me.related("children", "blocks")
   child.Set("label", "Exited early")
   EXIT FOR
  NEXT child
 END IF
END EVENT`;
 const result=await runPage({...base,handlers:[{owner:'section',wydBasicModule:source}]});assert.equal(result.error,null);assert.match(result.transport.text,/Exited early/);
});

test('prototype methods can use null checks and exits through the same SEWN runtime',async()=>{
 const behavior=compilePrototype('FUNCTION First() AS Number\nDIM answer = 0\nFOR EACH item IN [7,8]\nanswer=item\nEXIT FOR\nNEXT item\nRETURN answer\nEND FUNCTION\nFUNCTION Present(value AS Wydgit) AS Boolean\nRETURN value IS NOT NULL\nEND FUNCTION');assert.equal(behavior.schema,'sewn/0.6');const registry=new PrototypeRegistry([{id:'acme/card',publisher:'acme',properties:{},slots:{},behavior}]);
 const mod=compileModule('EVENT Page.Load\nRETURN [Me.First(), Me.Present(NULL)]\nEND EVENT').events[0].workflow;
 const result=await execute(mod,{context,prototypeRegistry:registry,scope:{ME:{id:'home',prototype:'acme/card'}}});assert.deepEqual(result.value,[7,false]);
});
