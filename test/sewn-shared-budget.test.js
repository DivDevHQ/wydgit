import test from 'node:test';
import {readFileSync} from 'node:fs';
import {PrototypeRegistry} from '../wydgine/object-model/prototypes.js';
import {compileDefinitions} from '../wydgine/repository.js';
import assert from 'node:assert/strict';
import {createExecutionBudget,executionBudget} from '../wydgine/sewn/budget.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {execute} from '../wydgine/sewn/execute.js';
import {compile} from '../wydgine/wydbasic/index.js';
import {createDispatcher,EventRegistry} from '../wydgine/events/index.js';
const context=limits=>new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'owner',visible:['owner'],capabilities:['event.custom.raise'],scopes:{events:['Again']},limits});
test('opaque budgets authenticate contexts, share counters and fail terminally across executions',async()=>{
 const ctx=context({sewnSteps:8}),budget=createExecutionBudget(ctx),program=compile('DIM x = 1\nRETURN x');
 await execute(program,{context:ctx,scope:{},budget});await execute(program,{context:ctx,scope:{},budget});
 await assert.rejects(execute(program,{context:ctx,scope:{},budget}),{code:'SEWN.LIMIT'});
 await assert.rejects(execute(compile('RETURN 0'),{context:ctx,scope:{},budget}),{code:'SEWN.LIMIT'});
 assert.throws(()=>executionBudget(budget,context({})),{code:'SEAM.CONTEXT'});assert.throws(()=>executionBudget({},ctx),{code:'SEAM.CONTEXT'});
 assert.ok(executionBudget(budget,ctx).snapshot().steps>8);
});
test('separate event handlers and queued nested events cannot reset SEWN step budget',async()=>{
 const ctx=context({sewnSteps:12}),registry=new EventRegistry().define('Again',{family:'Custom',cancelable:true,fields:{}});
 const handles=new WeakMap();const handle=(id,guard)=>{if(!handles.has(guard))handles.set(guard,Object.freeze({get id(){guard();return id;}}));return handles.get(guard);};
 const workflow=compile('CALL EVENT.Raise("Again",ME,{})');
 const dispatcher=createDispatcher({context:ctx,registry,handle,handlers:[{type:'Again',owner:'owner',workflow}]});
 await assert.rejects(dispatcher.dispatch({type:'Again',source:'owner',target:'owner',payload:{}}),{code:'SEWN.LIMIT'});dispatcher.close();
});
test('service calls and construction counts remain shared; cancellation rejects late work',async()=>{
 const ctx=context({sewnServiceCalls:1}),budget=createExecutionBudget(ctx);let calls=0;
 const scope={SERVICES:{Call:async()=>{calls++;return {};}}};const program=compile('DIM value AS Object = SERVICES.Call("wydstore","get",{})');
 await execute(program,{context:ctx,scope,budget});await assert.rejects(execute(program,{context:ctx,scope,budget}),{code:'SEWN.LIMIT'});assert.equal(calls,1);
 const constructionContext=new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'owner',capabilities:['object.instances.construct'],scopes:{prototypes:['wydgit.core/block']},limits:{sewnDrafts:1}}),constructionBudget=createExecutionBudget(constructionContext),prototypeRegistry=new PrototypeRegistry(compileDefinitions(JSON.parse(readFileSync('prototypes/objects.json','utf8'))));
 const construct=compile('DIM draft AS Wydgit = NEW "wydgit.core/block"("draft")');await execute(construct,{context:constructionContext,scope:{},budget:constructionBudget,prototypeRegistry});await assert.rejects(execute(construct,{context:constructionContext,scope:{},budget:constructionBudget,prototypeRegistry}),{code:'SEWN.LIMIT'});
 let cancel=false,release;const delayed=createExecutionBudget(ctx,{guard:()=>assert.equal(cancel,false)});
 const promise=execute(program,{context:ctx,budget:delayed,scope:{SERVICES:{Call:()=>new Promise(r=>release=r)}}});
 while(!release)await new Promise(r=>setImmediate(r));cancel=true;release({});await assert.rejects(promise);assert.throws(()=>executionBudget(delayed,ctx).check());
});

test('nested native dispatchers and defaults share effective event depth',async()=>{const ctx=context({eventDepth:1}),budget=createExecutionBudget(ctx),registry=new EventRegistry().define('Again',{family:'Custom',cancelable:true,fields:{}});let entered=0;const nested=()=>createDispatcher({context:ctx,budget,registry,handle:(id,guard)=>Object.freeze({get id(){guard();return id;}}),handlers:[{owner:'owner',type:'Again',run:async function(){entered++;const next=nested();try{await next.dispatch({type:'Again',source:'owner',target:'owner',payload:{}});}finally{next.close();}}}]});const dispatcher=nested();await assert.rejects(dispatcher.dispatch({type:'Again',source:'owner',target:'owner',payload:{}}),{code:'EVENT.LIMIT'});assert.equal(entered,2);assert.throws(()=>executionBudget(budget,ctx).check(),{code:'SEWN.LIMIT'});dispatcher.close();});

test('versioned trusted meters identify the exhausted resource and preserve the first terminal cause',()=>{
 const ctx=context({sewnSteps:1}),token=createExecutionBudget(ctx),ledger=executionBudget(token,ctx);
 ledger.take('steps');assert.throws(()=>ledger.take('steps'),e=>e.code==='SEWN.LIMIT'&&e.details.resource==='steps'&&e.details.limit===1&&e.details.used===2);
 const meter=ledger.meter();assert.equal(meter.schema,'wydgit.execution-meter/1');assert.equal(meter.exhaustion.resource,'steps');assert.equal(Object.isFrozen(meter),true);assert.equal(Object.isFrozen(meter.charges),true);
 assert.throws(()=>ledger.check(),e=>e.details.resource==='steps');ledger.close();assert.equal(ledger.meter().exhaustion.resource,'steps');
 const expired=createExecutionBudget(ctx,{deadline:0});assert.throws(()=>executionBudget(expired,ctx).check(),e=>e.details.resource==='timeMs');
 const cancelled=createExecutionBudget(ctx,{guard:()=>{throw Error('cancelled');}});assert.throws(()=>executionBudget(cancelled,ctx).check(),/cancelled/);assert.equal(executionBudget(cancelled,ctx).meter().exhaustion.resource,'guard');
});
