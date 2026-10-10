import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,compileModule,parseModule} from '../wydgine/wydbasic/index.js';
import {validate} from '../wydgine/sewn/validate.js';
import {execute} from '../wydgine/sewn/execute.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {EventRegistry,prepareHandlers,prepareAction,createDispatcher} from '../wydgine/events/index.js';
import {runPage,fixture} from '../test-support/events.js';
import {mountClient} from '../wydclient/index.js';
const context=new ExecutionContext({publisher:'acme',self:'home'});
const run=async source=>execute(compileModule(source).events[0].workflow,{context,scope:{}});
const moduleWith=(declarations,body='RETURN NULL')=>`${declarations}\nEVENT Page.Load\n${body}\nEND EVENT`;
const error=(source,code)=>assert.throws(()=>compileModule(source),e=>e.code===`WYDBASIC.${code}`&&e.details.line>0&&e.details.column>0,source);

test('SUB/FUNCTION module parsing and deterministic canonical compilation expose no second execution format',async()=>{
 const source=moduleWith(`FUNCTION FullName(first AS String,last AS String) AS String
 DIM result=first & " " & last
 RETURN result
END FUNCTION
SUB Early()
 RETURN
 Me.Set("title","unreachable")
END SUB`, 'CALL EARLY()\nDIM name=fullname("A","B")\nRETURN FullName(name,"C")');
 const ast=parseModule(source);assert.equal(ast.procedures[0].params.length,2);assert.equal(ast.procedures[1].procedureKind,'sub');assert.equal(ast.events[0].type,'Page.Load');
 const compiled=compileModule(source);assert.deepEqual(compiled,compileModule(source));assert.deepEqual(validate(compiled.events[0].workflow),compiled.events[0].workflow);assert.ok(Object.isFrozen(compiled.events[0].workflow.procedures.fullname));assert.equal(compiled.events[0].workflow.schema,'sewn/0.2');assert.equal(compiled.events[0].workflow.body[0].op,'procedureCall');assert.equal((await run(source)).value,'A B C');
 const mixed=moduleWith('FUNCTION Value() AS Number\nRETURN 7\nEND FUNCTION','RETURN vAlUe()');assert.equal((await run(mixed)).value,7);
 assert.equal(compile('RETURN 1').schema,'sewn/0.1');
});

test('procedure diagnostics cover names, arity/types, kind, returns, cycles, parameters and invalid control flow',()=>{
 const f='FUNCTION Valid(value AS String) AS Boolean\nRETURN value<>""\nEND FUNCTION';
 for(const [source,code] of [
  [moduleWith(f,'RETURN missing()'),'NAME'],[moduleWith(f,'RETURN Valid()'),'TYPE'],[moduleWith(f,'RETURN Valid(1)'),'TYPE'],[moduleWith(f,'CALL Valid("x")'),'TYPE'],
  [moduleWith('SUB Task()\nEND SUB','RETURN Task()'),'TYPE'],[moduleWith('SUB Task()\nRETURN 1\nEND SUB'),'TYPE'],
  [moduleWith('FUNCTION Value() AS String\nRETURN\nEND FUNCTION'),'TYPE'],[moduleWith('FUNCTION Value() AS String\nEND FUNCTION'),'TYPE'],
  [moduleWith('FUNCTION Value() AS Boolean\nRETURN 1\nEND FUNCTION'),'TYPE'],
  [moduleWith('FUNCTION Value() AS String\nIF TRUE THEN\nRETURN "x"\nEND IF\nEND FUNCTION'),'TYPE'],
  [moduleWith('SUB Save()\nEND SUB\nFUNCTION SAVE() AS Boolean\nRETURN TRUE\nEND FUNCTION'),'NAME'],
  [moduleWith('SUB Save(x AS String,X AS Number)\nEND SUB'),'NAME'],[moduleWith('SUB REQUEST()\nEND SUB'),'NAME'],
  [moduleWith('SUB Save()\nCALL save()\nEND SUB'),'NAME'],[moduleWith('SUB First()\nCALL Second()\nEND SUB\nSUB Second()\nCALL First()\nEND SUB'),'NAME'],
  [moduleWith('SUB Save()\nDIM x=1\nDIM X=2\nEND SUB'),'NAME'],[moduleWith('SUB Save()\nRETURN caller\nEND SUB'),'TYPE'],
  [moduleWith('SUB Save()\nDIM x AS Native\nEND SUB'),'TYPE'],[moduleWith('SUB Save(ByRef x AS String)\nEND SUB'),'SYNTAX'],
  [moduleWith('SUB Save(x AS String="x")\nEND SUB'),'SYNTAX'],[moduleWith('SUB Save()\nSUB Nested()\nEND SUB\nEND SUB'),'UNSUPPORTED'],
  [moduleWith('SUB Save()\nFOR EACH x IN [1]\nDIM y=1\nNEXT\nEND SUB'),'UNSUPPORTED'],
  [moduleWith('SUB Save()\nSTOP\nEND SUB'),'UNSUPPORTED'],[moduleWith(f,'RETURN Valid'),'NAME'],
  ['EVENT Submit(e)\nEND EVENT','SYNTAX'],['EVENT Missing\nEND EVENT','NAME'],['EVENT Page.Load\nEND EVENT\nEVENT PAGE.LOAD\nEND EVENT','NAME'],
  ['SUB Save()\nRETURN','SYNTAX'],['FUNCTION Value() AS String\nRETURN "x"','SYNTAX'],['EVENT Submit\nRETURN NULL','SYNTAX'],
  ['DIM x=1','SYNTAX'],[moduleWith('FUNCTION Read() AS String\nRETURN caller\nEND FUNCTION','DIM caller="x"\nRETURN Read()'),'NAME'],
  [moduleWith('SUB Write()\nDIM private=1\nEND SUB','CALL Write()\nRETURN private'),'NAME'],
 ])error(source,code);
 const failed=(()=>{try{compileModule('SUB Good(value AS String, VALUE AS String)\nEND SUB');}catch(e){return e.toJSON();}})();assert.equal(failed.details.line,1);assert.equal(failed.details.column,27);assert.ok(!('stack' in failed));
});

test('typed parameters are ByVal, local frames repeat safely, complete IF returns are accepted',async()=>{
 const source=moduleWith(`FUNCTION Choose(value AS Boolean) AS String
 IF value THEN
  RETURN "yes"
 ELSE
  RETURN "no"
 END IF
END FUNCTION
FUNCTION Add(value AS Number) AS Number
 value=value+1
 DIM local=value
 RETURN local
END FUNCTION`, 'DIM value=1\nDIM a=Add(value)\nDIM b=Add(value)\nRETURN {"value":value,"sum":a+b,"yes":Choose(TRUE),"no":Choose(FALSE)}');
 const result=(await run(source)).value;assert.equal(result.value,1);assert.equal(result.sum,4);assert.equal(result.yes,'yes');assert.equal(result.no,'no');
});

test('event registry resolves built-in/custom names case-insensitively and rejects ambiguity',()=>{
 for(const name of ['page.load','PAGE.LOAD','Page.Load'])assert.equal(compileModule(`EVENT ${name}\nEND EVENT`).events[0].type,'Page.Load');
 const registry=new EventRegistry().define('Cart.Saved',{family:'Custom',cancelable:true,fields:{}});
 assert.equal(compileModule('EVENT cart.saved\nEND EVENT',{registry}).events[0].type,'Cart.Saved');
 registry.define('CART.SAVED',{family:'Custom',cancelable:true,fields:{}});assert.throws(()=>compileModule('EVENT Cart.Saved\nEND EVENT',{registry}),e=>e.code==='WYDBASIC.NAME');
});

test('one module shares procedures across Page lifecycle events and concurrent request-local trees',async()=>{
 const source=`SUB SetHeading(value AS String)
 Me.Set("title", value)
END SUB
FUNCTION QueryValue(name AS String) AS String
 RETURN REQUEST.Query.Get(name)
END FUNCTION
EVENT page.load
 CALL SetHeading(QueryValue("title"))
END EVENT
EVENT Page.Validate
 CALL SetHeading(Me.properties.title & " validated")
END EVENT
EVENT Page.PreRender
 CALL SetHeading(Me.properties.title & " ready")
END EVENT`;
 const handlers=[{owner:'home',wydBasicModule:source}],prepared=prepareHandlers(handlers);assert.equal(prepared.length,3);for(const r of prepared)assert.equal(r.workflow.schema,'sewn/0.2');
 const results=await Promise.all(['One','Two'].map(title=>runPage({handlers,input:{query:'title='+title}})));for(const [i,result] of results.entries()){assert.equal(result.error,null);assert.match(result.transport.text,new RegExp(`<title>${['One','Two'][i]} validated ready`));}assert.equal(fixture().model.runtime.get('home').properties.title,'Test');
 assert.equal((await runPage({handlers,context:fixture({capabilities:[]}).context,input:{query:'title=Denied'}})).error.code,'MUTATION.DENIED');
 assert.equal((await runPage({handlers:[{owner:'home',wydBasicModule:moduleWith('FUNCTION Browser() AS String\nRETURN CLIENT.Cookies.Get("theme")\nEND FUNCTION','RETURN Browser()')}]})).error?.code,'EVENT.CONTEXT');
});

test('opaque Wydgit procedure parameters use existing SET and stale checks',async()=>{
 const source=moduleWith('SUB RemoveItem(item AS Wydgit)\nitem.Remove()\nEND SUB','DIM item AS Wydgit=Me\nCALL RemoveItem(item)');
 assert.equal((await runPage({handlers:[{owner:'note',wydBasicModule:source}]})).error,null);
 const stale=source.replace('CALL RemoveItem(item)','CALL RemoveItem(item)\nCALL RemoveItem(item)');assert.equal((await runPage({handlers:[{owner:'note',wydBasicModule:stale}]})).error.code,'EVENT.DENIED');
 const denied=await runPage({handlers:[{owner:'note',wydBasicModule:source}],context:fixture({capabilities:[]}).context});assert.equal(denied.error.code,'MUTATION.DENIED');
 error(moduleWith('SUB RemoveItem(item AS Wydgit)\nEND SUB','CALL RemoveItem({})'),'TYPE');
 error(moduleWith('SUB Assign(item AS Wydgit)\nitem=Me\nEND SUB'),'TYPE');
});

test('module registration is exclusive, setup-only and preserves explicit action routing metadata',async()=>{
 const source='EVENT Submit\nRETURN NULL\nEND EVENT';
 for(const record of [{owner:'home',wydBasicModule:source,run:function(){}},{owner:'home',wydBasicModule:source,workflow:{schema:'sewn/0.1',body:[]}},{owner:'home',wydBasicModule:source,wydBasic:'STOP'},{type:'Submit',owner:'home',wydBasicModule:source},{wydBasicModule:source}])assert.throws(()=>prepareHandlers([record]),e=>e.code==='EVENT.INVALID');
 const action=prepareAction({page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',wydBasicModule:source});assert.equal(action.method,'POST');assert.equal(action.capability,'app.forms.submit');assert.equal(action.workflow.schema,'sewn/0.2');assert.equal(action.wydBasicModule,undefined);
 for(const source of ['EVENT Change\nEND EVENT','EVENT Submit\nEND EVENT\nEVENT Page.Load\nEND EVENT'])assert.throws(()=>prepareAction({type:'Submit',wydBasicModule:source}),e=>e.code==='EVENT.INVALID');
 let reads=0;const record={owner:'home',get wydBasicModule(){reads++;return 'EVENT Page.Load\nRETURN NULL\nEND EVENT';}};
 const dispatcher=createDispatcher({handlers:[record],context,handle:()=>({}),exists:()=>true});const preparedReads=reads;await dispatcher.dispatch({type:'Page.Load',source:'home',target:'home'});await dispatcher.dispatch({type:'Page.Load',source:'home',target:'home'});assert.equal(reads,preparedReads);dispatcher.close();
 await assert.rejects(()=>runPage({actions:[{type:'Submit',wydBasicModule:'EVENT Missing\nEND EVENT'}]}),e=>e.code==='WYDBASIC.NAME');
});

test('WydClient event modules share procedures and preserve semantic cancellation/default behavior',async()=>{
 const element=new EventTarget(),client=mountClient({nodes:[{id:'home',element,kind:'field',value:'old'}],context,handlers:[{owner:'home',wydBasicModule:`
FUNCTION IsOwner(value AS String) AS Boolean
 RETURN value="home"
END FUNCTION
SUB CancelChange()
 EVENT.Cancel()
END SUB
EVENT CLIENT.READY
 IF NOT IsOwner(Me.id) THEN
  RETURN REQUEST.IsPost
 END IF
END EVENT
EVENT change
 IF IsOwner(Me.id) THEN
  CALL CancelChange()
 END IF
END EVENT`} ]});
 await client.ready;assert.equal(client.error(),null);element.value='bad';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),null);await client.unmount();
});

test('service expressions inside FUNCTIONs and assignments remain sequential canonical SEWN operations',async()=>{
 const source=moduleWith(`FUNCTION Save(value AS String) AS Object
 RETURN SERVICES.Call("test","save",{"value":value})
END FUNCTION`, 'DIM result AS Object={}\nresult=Save("first")\nRETURN {"a":result.ok,"b":Save("second").ok}');
 const calls=[],scope={SERVICES:{async Call(library,method,input){calls.push([library,method,input.value]);return {ok:true,value:null};}}};
 const workflow=compileModule(source).events[0].workflow;assert.equal(workflow.procedures.save.body[0].value.op,'serviceCall');
 const result=await execute(workflow,{context,scope});assert.equal(result.value.a,true);assert.equal(result.value.b,true);assert.deepEqual(calls,[['test','save','first'],['test','save','second']]);
 await assert.rejects(()=>execute(workflow,{context:new ExecutionContext({...context,limits:{sewnServiceCalls:1}}),scope}),e=>e.code==='SEWN.LIMIT');
 const dynamic=compileModule(moduleWith('FUNCTION Read() AS String\nRETURN REQUEST.Form.Get("value")\nEND FUNCTION','RETURN Read()')).events[0].workflow;
 await assert.rejects(()=>execute(dynamic,{context,scope:{REQUEST:{Form:{Get:()=>1}}}}),e=>e.code==='SEWN.TYPE');
 for(const body of ['CALL eval("x")','RETURN process.exit()','RETURN globalThis','RETURN CallByName("Save")','RETURN SERVICES.Call("fs", "read", ME)'])assert.throws(()=>compileModule(moduleWith('',body)),e=>e.code.startsWith('WYDBASIC.'));
});

test('server lifecycle modules compile once during construction before Start and Stop dispatch',async()=>{
 const {createLifecycle}=await import('../wydgine/execution/lifecycle.js');let reads=0;
 const context=new ExecutionContext({publisher:'acme',self:'app',app:'app'});
 const lifecycle=createLifecycle({app:'app',context,handlers:[{owner:'app',get wydBasicModule(){reads++;return `
FUNCTION IsApp() AS Boolean
 RETURN SERVER.App="app"
END FUNCTION
EVENT Server.Start
 IF NOT IsApp() THEN
  RETURN REQUEST.IsPost
 END IF
END EVENT
EVENT Server.Stop
 IF NOT IsApp() THEN
  RETURN REQUEST.IsPost
 END IF
END EVENT`;}}]});
 const preparedReads=reads;await lifecycle.start();await lifecycle.stop();assert.deepEqual(lifecycle.errors(),[]);assert.equal(reads,preparedReads);
});

test('nullable Wydgit results stay opaque, and excess parameters have located diagnostics',async()=>{
 const source=moduleWith('FUNCTION NoItem() AS Wydgit\nRETURN NULL\nEND FUNCTION\nSUB Accept(item AS Wydgit)\nRETURN\nEND SUB','DIM item AS Wydgit=NoItem()\nSET item=NULL\nCALL Accept(item)\nRETURN TRUE');assert.equal((await run(source)).value,true);
 const parameters=Array.from({length:17},(_,i)=>'p'+i+' AS Number').join(',');error(moduleWith(`SUB Excess(${parameters})\nEND SUB`),'COMPILE');
 assert.throws(()=>prepareAction({type:'Submit',target:'form',owner:'home',wydBasicModule:'EVENT Submit\nEND EVENT'}),e=>e.code==='EVENT.INVALID');
});
