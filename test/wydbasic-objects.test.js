import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,compileModule,compilePrototype} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {loadRepository} from '../wydgine/repository.js';
import {ExecutionContext,PrototypeRegistry} from '../wydgine/object-model/index.js';
import {fixture,runPage} from '../test-support/events.js';
import {mountClient} from '../wydclient/index.js';
const registry=()=>loadRepository(process.cwd()).registry;
const context=(extra={})=>new ExecutionContext({publisher:'caller',self:'home',capabilities:['object.instances.construct'],scopes:{prototypes:['acme/message-panel','acme/important-message-panel','wydgit.core/object','acme/unknown']},...extra});
const run=(source,extra={})=>execute(compile(source),{context:context(),prototypeRegistry:registry(),scope:{},...extra});
const error=code=>e=>e.code===code;

test('NEW explicit ID, case insensitive SUB/FUNCTION dynamic dispatch and deterministic source lowering',async()=>{
 const source=`DIM panel AS Wydgit
SET panel = NEW "acme/important-message-panel"("result-panel")
CALL panel.sEtMeSsAgE("Hello")
RETURN {"has":panel.hAsMeSsAgE(), "text":panel.properties.content.value}`;
 assert.equal((await run('RETURN "NEW"')).value,'NEW');assert.equal(compile(source).schema,'sewn/0.3');assert.deepEqual(compile(source),compile(source));
 assert.deepEqual({... (await run(source)).value},{has:true,text:'Important: Hello'});
 for(const [type,code] of [['acme/unknown','PROTOTYPE.UNKNOWN'],['wydgit.core/object','OBJECT.CONSTRUCTION']])await assert.rejects(run(`DIM panel AS Wydgit\nSET panel = NEW "${type}"("panel")`),error(code));
 for(const source of ['DIM panel AS Wydgit\nSET panel = NEW "acme/message-panel"()', 'DIM panel AS Wydgit\nSET panel = NEW Navigation("panel")'])assert.throws(()=>compile(source),e=>e.code.startsWith('WYDBASIC.')&&Number.isInteger(e.details.line));
 await assert.rejects(run('DIM panel AS Wydgit\nSET panel = NEW "acme/message-panel"("1")'),error('OBJECT.CONSTRUCTION'));
 await assert.rejects(run('DIM panel AS Wydgit\nSET panel = NEW "acme/message-panel"("panel")\npanel.SetMessage(1)'),error('SEWN.TYPE'));
 await assert.rejects(run('DIM panel AS Wydgit\nSET panel = NEW "acme/message-panel"("panel")\nRETURN panel.SetMessage("x")'),error('SEWN.TYPE'));
 assert.throws(()=>compilePrototype('SUB Thing()\nEND SUB\nSUB thing()\nEND SUB'),error('WYDBASIC.NAME'));
});

test('methods call module procedures, procedures call methods and methods dispatch another method with isolated frames',async()=>{
 const behavior=compilePrototype(`FUNCTION Prefix(value AS String) AS String
 RETURN "Prefix: " & value
END FUNCTION
SUB SetMessage(value AS String)
 Me.Set("content", {"type":"markdown", "value":Prefix(value)})
END SUB
FUNCTION HasMessage() AS Boolean
 RETURN Me.properties.content.value <> ""
END FUNCTION
FUNCTION ViaMethod() AS Boolean
 RETURN Me.HasMessage()
END FUNCTION`);
 const prototypeRegistry=new PrototypeRegistry([
 {id:'wydgit.core/app',publisher:'wydgit.core',properties:{},slots:{}},
 {id:'acme/panel',publisher:'acme',properties:{content:{type:'object',default:{type:'markdown',value:''}}},slots:{},behavior}
 ]);
 const source=`SUB Update(target AS Wydgit, value AS String)
 CALL target.SetMessage(value)
END SUB
EVENT Activate
 DIM panel AS Wydgit
 SET panel = NEW "acme/panel"("panel")
 CALL Update(panel, "Hello")
 RETURN {"text":panel.properties.content.value,"has":panel.ViaMethod()}
END EVENT`;
 const workflow=compileModule(source).events[0].workflow;
 const result=await execute(workflow,{scope:{},prototypeRegistry,context:context({scopes:{prototypes:['acme/panel']}})});
 assert.deepEqual({...result.value},{text:'Prefix: Hello',has:true});
 assert.throws(()=>compilePrototype(`SUB Recursive()\nCALL Me.Recursive()\nEND SUB`)&&new PrototypeRegistry([{id:'acme/a',publisher:'acme',behavior:compilePrototype(`SUB Recursive()\nCALL Me.Recursive()\nEND SUB`)}]),error('PROTOTYPE.METHOD'));
});

const pageContext=()=>{const base=fixture().context;return new ExecutionContext({...base,visible:[...base.visible,'result-panel'],editable:[...base.editable,'result-panel'],capabilities:[...base.capabilities,'object.instances.construct'],scopes:{...base.scopes,prototypes:['acme/message-panel','acme/important-message-panel']}});};
const applicationSource=`EVENT Submit
 DIM panel AS Wydgit
 SET panel = NEW "acme/important-message-panel"("result-panel")
 CALL panel.SetMessage(REQUEST.Form.Get("name"))
 IF panel.HasMessage() THEN
   Me.Insert("blocks", 0, panel)
 END IF
END EVENT`;

test('vertical Page Submit → NEW draft → override/inherited methods → validated containment → rendered request-local result',async()=>{
 const input={method:'POST',form:'name=Resources',action:{target:'form',type:'Submit',csrf:'c'.repeat(64)}};
 const actions=[{page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',wydBasicModule:'EVENT Submit\nEND EVENT'}];
 const routed=[{owner:'section',source:'form',wydBasicModule:applicationSource}];
 const result=await runPage({context:pageContext(),handlers:routed,actions,input});assert.equal(result.error,null);assert.match(result.transport.text,/Important: Resources/);
 const later=await runPage({context:pageContext()});assert.doesNotMatch(later.transport.text,/Important: Resources/);
 for(const capability of ['object.instances.construct','object.instances.edit']){
  const ctx=pageContext();const denied=await runPage({context:new ExecutionContext({...ctx,capabilities:ctx.capabilities.filter(x=>x!==capability)}),handlers:routed,actions,input});assert.ok(denied.error);assert.doesNotMatch(denied.transport.text,/Important: Resources/);
 }
 const reuse=await runPage({context:pageContext(),handlers:[{...routed[0],wydBasicModule:applicationSource.replace('END EVENT','panel.SetMessage("again")\nEND EVENT')}],actions,input});assert.equal(reuse.error.code,'OBJECT.CONSTRUCTION');
 const old=await runPage({handlers:[{owner:'section',type:'Page.Load',wydBasic:'Me.Insert("blocks", 0, {"id":"thanks","type":"wydgit.core/block","properties":{"content":{"type":"markdown","value":"Descriptor"}}})'}]});assert.equal(old.error,null);assert.match(old.transport.text,/Descriptor/);
});

test('WydClient executes inherited read-only methods through the same portable dispatch, with no tree mutation facade',async()=>{
 const element={addEventListener(){},removeEventListener(){}};
 const mounted=mountClient({prototypeRegistry:registry(),context:context(),nodes:[{id:'home',prototype:'acme/important-message-panel',properties:{content:{type:'markdown',value:'Client'}},element}],handlers:[{owner:'home',wydBasicModule:'EVENT Client.Ready\nIF NOT Me.HasMessage() THEN\n Me.Missing()\nEND IF\nEND EVENT'}]});await mounted.ready;await mounted.unmount();assert.equal(mounted.error(),null);
 const denied=mountClient({prototypeRegistry:registry(),context:context(),nodes:[{id:'home',prototype:'acme/message-panel',properties:{content:{type:'markdown',value:''}},element}],handlers:[{owner:'home',wydBasic:'Me.SetMessage("Denied")',type:'Client.Ready'}]});await assert.rejects(denied.ready,error('SEWN.DENIED'));
});

test('prototype methods retain caller context through real WydStore dispatch and cannot use core publisher authority',async t=>{
 const {fixture:storeFixture}=await import('../test-support/wydstore.js');const store=await storeFixture(t);
 const behavior=compilePrototype(`FUNCTION Save() AS Object
 RETURN SERVICES.Call("wydstore", "create", {"store":"main", "collection":"users", "id":"saved", "data":{"name":"Denied"}})
END FUNCTION`);
 const prototypeRegistry=new PrototypeRegistry([{id:'wydgit.core/trusted',publisher:'wydgit.core',public:true,behavior},{id:'acme/derived',publisher:'acme',extends:'wydgit.core/trusted'}]);
 const deniedContext=new ExecutionContext({...store.ctx,capabilities:store.ctx.capabilities.filter(x=>x!=='store.records.create')});let captured;
 const scope={ME:{prototype:'acme/derived'},SERVICES:{async Call(library,method,input){captured=deniedContext;return store.registry.bind(deniedContext).call(library,method,input);}}};
 const denied=await execute(compile('RETURN Me.Save()'),{prototypeRegistry,context:deniedContext,scope});assert.equal(denied.value.ok,false);assert.equal(denied.value.code,'SEAM.DENIED');assert.equal(captured,deniedContext);assert.equal((await store.collection.query()).length,0);
});
