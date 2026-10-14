import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,compileModule} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {ExecutionContext} from '../wydgine/object-model/index.js';
const context=new ExecutionContext({publisher:'acme',self:'home'});
const run=async(source,scope={})=>(await execute(compile(source),{context,scope})).value;
test('concrete inspection and descriptor equality',async()=>{
 for(const [v,t] of [['"Hello"','String'],['42','Integer'],['42.0','Integer'],['42.5','Float'],['9007199254740992','Float'],['TRUE','Boolean'],['NULL','Null'],['[]','Array'],['{}','Object'],['Integer','DataType']])assert.equal((await run(`RETURN TypeOf(${v})`)).type,t);
 assert.deepEqual(await run('RETURN [Integer=Integer,Integer=Float,Integer="Integer",Integer<>Float]'),[true,false,false,true]);
 assert.equal(await run('DIM x AS Float=42\nRETURN TypeOf(x)=Integer'),true);
 assert.equal(await run('DIM x AS Number=42\nRETURN TypeOf(x)=Integer'),true);
 assert.equal(await run('RETURN TypeOf(SESSION.x)=Object',{SESSION:{x:{type:'DateTime',value:0}}}),true);
});
test('scalar contracts reject containers, null, descriptors and opaque handles',async()=>{
 for(const v of ['"text"','42','42.5','TRUE','DateTime("1970-01-01T00:00:00.000Z")'])assert.equal(await run(`DIM x AS Scalar=${v}\nRETURN TypeOf(x)=TypeOf(${v})`),true);
 for(const v of ['NULL','[]','{}','Integer','Me'])assert.throws(()=>compile(`DIM x AS Scalar=${v}`));
 await assert.rejects(run('DIM x AS Scalar=SESSION.x',{SESSION:{x:null}}),{code:'SEWN.TYPE'});
 assert.throws(()=>compile('DIM x AS Scalar=42\nDIM y AS Integer=x'));
 for(const t of ['Scalar','DataType','DateTime'])assert.throws(()=>compile(`DIM x AS ${t}`));
});
test('typed calls, returns, collections and JSON program reconstitution',async()=>{
 const source='FUNCTION Identity(v AS Scalar) AS Scalar\nRETURN v\nEND FUNCTION\nFUNCTION Kind(t AS DataType) AS DataType\nRETURN t\nEND FUNCTION\nEVENT Page.Load\nRETURN [TypeOf(Identity(42))=Kind(Integer),TypeOf(Identity(DateTime("1970-01-01T00:00:00.000Z")))=DateTime]\nEND EVENT';
 const p=compileModule(source).events[0].workflow;
 assert.deepEqual((await execute(JSON.parse(JSON.stringify(p)),{context,scope:{}})).value,[true,true]);
 assert.equal(await run('DIM a=[Integer,DateTime("1970-01-01T00:00:00.000Z")]\nFOR EACH x IN a\nIF TypeOf(x)=DataType THEN\nRETURN x=Integer\nEND IF\nNEXT'),true);
});
test('datetime strict construction, boundaries and comparisons',async()=>{
 for(const s of ['1970-01-01T00:00:00.000Z','1969-12-31T23:59:59.999Z','+275760-09-13T00:00:00.000Z','-271821-04-20T00:00:00.000Z'])assert.equal(await run(`DIM x AS DateTime=DateTime("${s}")\nRETURN x`),s);
 for(const s of ['2026-02-30T00:00:00.000Z','1970-01-01','1970-01-01T00:00:00Z','1970-01-01T00:00:00.000+00:00','+275760-09-13T00:00:00.001Z'])await assert.rejects(run(`RETURN DateTime("${s}")`),{code:'SEWN.TYPE'});
 assert.deepEqual(await run('DIM a=DateTime("1970-01-01T00:00:00.000Z")\nDIM b=DateTime("1970-01-01T00:00:00.001Z")\nRETURN [a=b,a<>b,a<b,a<=b,b>a,b>=a,a IS NULL,TypeOf(a)=DateTime]'),[false,true,true,true,true,true,false,true]);
 for(const op of ['<','=','+','IS'])for(const v of ['0','"1970-01-01T00:00:00.000Z"']){const src=`RETURN DateTime("1970-01-01T00:00:00.000Z") ${op} ${v}`;try{compile(src);}catch{continue;}await assert.rejects(run(src),{code:'SEWN.TYPE'});}
});
test('selection, closed schemas, forged values and budgets',async()=>{
 assert.equal(await run('SELECT CASE TypeOf(42)\nCASE Integer,Float\nRETURN "first"\nCASE Integer\nRETURN "second"\nCASE ELSE\nRETURN "other"\nEND SELECT'),'first');
 assert.equal(await run('SELECT CASE DateTime("1970-01-01T00:00:00.001Z")\nCASE IS > DateTime("1970-01-01T00:00:00.000Z")\nRETURN TRUE\nCASE ELSE\nRETURN FALSE\nEND SELECT'),true);
 const p=compile('RETURN TypeOf(42)');assert.equal(p.schema,'sewn/0.11');for(let i=1;i<=10;i++)assert.throws(()=>validate({...p,schema:`sewn/0.${i}`}));
 assert.throws(()=>validate({...p,body:[{op:'return',value:{op:'typeLiteral',type:'Host'}}]}));
 await assert.rejects(run('DIM x AS DataType=SESSION.x',{SESSION:{x:{type:'DataType',value:'Integer'}}}),{code:'SEWN.TYPE'});
 assert.throws(()=>compile('RETURN Integer IS Float'));
 await assert.rejects(execute(p,{scope:{},context:new ExecutionContext({publisher:'acme',self:'home',limits:{sewnSteps:1}})}),{code:'SEWN.LIMIT'});
});

test('WydClient executes the same datetime and inspection operations',async()=>{
 const {mountClient}=await import('../wydclient/index.js');
 class Element extends EventTarget {}
 const element=new Element();
 const client=mountClient({nodes:[{id:'home',kind:'field',element,value:'old'}],context,handlers:[{owner:'home',type:'Change',wydBasic:'DIM d AS DateTime=DateTime("1970-01-01T00:00:00.000Z")\nIF TypeOf(d)=DateTime THEN\nEVENT.Cancel()\nEND IF'}]});
 await client.ready;element.value='new';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),null);await client.unmount();
});

test('dynamic procedure contracts enforce arguments and returns without laundering types',async()=>{
 const module=body=>compileModule(`FUNCTION Echo(x AS Scalar) AS Scalar\nRETURN x\nEND FUNCTION\nFUNCTION Stamp(x AS DateTime) AS DateTime\nRETURN x\nEND FUNCTION\nFUNCTION Dynamic() AS DataType\nRETURN SESSION.x\nEND FUNCTION\nSUB Accept(x AS DataType)\nRETURN\nEND SUB\nEVENT Page.Load\n${body}\nEND EVENT`).events[0].workflow;
 const invoke=(body,scope={})=>execute(module(body),{context,scope});
 assert.equal((await invoke('RETURN Stamp(DateTime("1969-12-31T23:59:59.999Z"))')).value,'1969-12-31T23:59:59.999Z');
 assert.equal((await invoke('CALL Accept(Integer)\nRETURN TRUE')).value,true);
 for(const x of [null,[],{}, {type:'DataType',value:'Integer'}])await assert.rejects(invoke('RETURN Echo(SESSION.x)',{SESSION:{x}}),{code:'SEWN.TYPE'});
 await assert.rejects(invoke('RETURN Dynamic()',{SESSION:{x:'Integer'}}),{code:'SEWN.TYPE'});
 await assert.rejects(invoke('RETURN Stamp(SESSION.x)',{SESSION:{x:'1970-01-01T00:00:00.000Z'}}),{code:'SEWN.TYPE'});
 assert.equal(await run('RETURN TypeOf(Me)=Wydgit',{ME:{id:'home'}}),true);
 assert.throws(()=>compile('RETURN TypeOf(REQUEST)'));
 assert.deepEqual(await run('DIM data={"kind":Integer,"instant":DateTime("1970-01-01T00:00:00.000Z")}\nRETURN [TypeOf(data.kind)=DataType,data.kind=Integer,TypeOf(data.instant)=DateTime]'),[true,true,true]);
});

test('collection procedure contracts preserve nested typed values and reject nested handles',async()=>{
 const p=compileModule('FUNCTION Copy(x AS Object) AS Object\nRETURN x\nEND FUNCTION\nEVENT Page.Load\nDIM x=Copy({"kind":Integer,"date":DateTime("1970-01-01T00:00:00.000Z")})\nRETURN [TypeOf(x.kind)=DataType,TypeOf(x.date)=DateTime]\nEND EVENT').events[0].workflow;
 assert.deepEqual((await execute(p,{context,scope:{}})).value,[true,true]);
 await assert.rejects(run('DIM children=Me.related("children","blocks")\nRETURN [children]',{ME:{id:'home',related:()=>[{id:'child'}]}}),{code:'SEWN.TYPE'});
});
