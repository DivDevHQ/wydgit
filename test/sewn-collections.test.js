import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,compileModule} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
const context=limits=>new ExecutionContext({publisher:'acme',self:'home',limits});
const run=async(source,SESSION={},limits={})=>(await execute(compile(source),{scope:{SESSION},context:context(limits)})).value;
const literal=value=>({op:'literal',value});
const document=(body,procedures={})=>({schema:'sewn/0.13',procedures,body});
const wire=(body,scope={},limits={})=>execute(document(body),{scope,context:context(limits)});
const returned=value=>[{op:'return',value}];
const operation=(name,...args)=>({op:'operation',name,args});
const bad=source=>assert.rejects(run(source),{code:'SEWN.TYPE'});

test('indexed expressions support zero-based nested and dynamic portable arrays',async()=>{
 assert.equal(await run('DIM names AS Array=["Andy","Barney","Goober"]\nDIM second AS String=names[1]\nRETURN second'),'Barney');
 assert.deepEqual(await run('DIM a=[[1,2],[3,4]]\nRETURN [a[0][0],a[1][1],a[1][0]]'),[1,4,3]);
 assert.equal(await run('RETURN SESSION.a[SESSION.i+1]',{a:['first','second'],i:0}),'second');
 assert.equal(await run('RETURN Split("Andy,Barney,Goober",",")[1]'),'Barney');
 assert.deepEqual(await run('DIM a=[Integer,DateTime("1970-01-01T00:00:00.000Z")]\nRETURN [TypeOf(a[0])=DataType,a[0]=Integer,TypeOf(a[1])=DateTime]'),[true,true,true]);
 for(const source of ['RETURN [1][1]','RETURN [][0]','RETURN SESSION.a[SESSION.i]']){
  if(source.includes('SESSION'))for(const i of [-1,0.5,'0',null,9007199254740992])await assert.rejects(run(source,{a:[1],i}),{code:'SEWN.TYPE'});
  else await bad(source);
 }
 for(const source of ['RETURN [1][-1]','RETURN [1][0.5]','RETURN [1]["0"]','RETURN {}[0]','RETURN "x"[0]','DIM a=[1]\na[0]=2','DIM a=[{}]\na[0].x=2'])assert.throws(()=>compile(source),e=>e.code.startsWith('WYDBASIC.'));
 await assert.rejects(run('RETURN SESSION.a[0]',{a:{0:'host'}}),{code:'SEWN.TYPE'});
 for(const source of ['DIM x AS String=[1][0]\nRETURN x','DIM x AS Boolean=Split("a",",")[0]\nRETURN x','DIM x AS Array=SESSION.a[0]\nRETURN x'])await assert.rejects(run(source,{a:[1]}),{code:'SEWN.TYPE'});
});

test('collection dispatch preserves strings and existing scalar equality',async()=>{
 assert.deepEqual(await run('RETURN [Length("Goober"),Length(["Andy","Barney","Goober"]),Contains("Goober","ber"),Contains(["Andy","Barney"],"Barney"),IndexOf("Goober","ber"),IndexOf(["Andy","Barney"],"Barney")]'),[6,3,true,true,3,1]);
 for(const value of ['"x"','TRUE','FALSE','1','1.5','NULL','Integer','DateTime("1970-01-01T00:00:00.000Z")'])assert.deepEqual(await run(`RETURN [Contains([${value}],${value}),IndexOf([${value},${value}],${value})]`),[true,0]);
 assert.deepEqual(await run('RETURN [Contains([1],"1"),Contains([Integer],"Integer"),IndexOf([1],2),Length([]),Contains([],NULL),IndexOf([],NULL)]'),[false,false,-1,0,false,-1]);
 assert.deepEqual(await run('RETURN [Contains([Convert(1,Float)],1),Contains([DateTime("1970-01-01T00:00:00.000Z")],NULL)]'),[true,false]);
 for(const a of [[{}],[[1]],{length:1},null,1])await assert.rejects(run('RETURN Contains(SESSION.a,1)',{a}),{code:'SEWN.TYPE'});
 for(const x of [{},[1]])await assert.rejects(run('RETURN IndexOf([],SESSION.x)',{x}),{code:'SEWN.TYPE'});
 await bad('RETURN Contains([DateTime("1970-01-01T00:00:00.000Z")],"1970-01-01T00:00:00.000Z")');
 assert.throws(()=>compile('RETURN Contains([1],{})'));
 assert.equal(await run('RETURN Length(SESSION.a)',{a:[1,2]}),2);
 assert.equal(await run('RETURN Contains(SESSION.a,"b")',{a:'abc'}),true);
 for(const a of [null,{},1,true])await assert.rejects(run('RETURN Length(SESSION.a)',{a}),{code:'SEWN.TYPE'});
});

test('Slice copies clamped ranges and preserves nested typed values',async()=>{
 for(const [start,length,expected] of [[1,2,['Barney','Goober']],[0,0,[]],[4,2,[]],[9007199254740991,1,[]],[2,9007199254740991,['Goober','Floyd']]])assert.deepEqual(await run(`RETURN Slice(["Andy","Barney","Goober","Floyd"],${start},${length})`),expected);
 assert.deepEqual(await run('RETURN Slice([[1],{"x":2}],0,2)'),[[1],Object.assign(Object.create(null),{x:2})]);
 assert.deepEqual(await run('DIM a=Slice([[Integer,DateTime("1970-01-01T00:00:00.000Z")]],0,1)\nRETURN [a[0][0]=Integer,TypeOf(a[0][1])=DateTime]'),[true,true]);
 await bad('RETURN Slice([1],-1,1)');await bad('RETURN Slice([1],0,-1)');
 assert.throws(()=>compile('RETURN Slice([1],0.5,1)'));
 const result=await wire(returned(operation('Slice',literal([1]),literal(0),literal(1))));assert.ok(Object.isFrozen(result.value));
});

test('Join and literal Split define empty fields and UTF-16 semantics',async()=>{
 assert.equal(await run('RETURN Join(["Andy","Barney","Goober"],", ")'),'Andy, Barney, Goober');
 assert.equal(await run('RETURN Join([],"-")'),'');assert.equal(await run('RETURN Join(["a","b"],"")'),'ab');
 for(const [text,separator,expected] of [['','',[]],['',',',['']],['abc',',',['abc']],[',a,,b,',',',['','a','','b','']],['😀','',['\ud83d','\ude00']],['a.$b.$','.$',['a','b','']]])assert.deepEqual(await run(`RETURN Split(SESSION.text,SESSION.separator)`,{text,separator}),expected);
 for(const x of [[1],[null],[{}],[[1]]])await assert.rejects(run('RETURN Join(SESSION.x,",")',{x}),{code:'SEWN.TYPE'});
 for(const source of ['RETURN Join(["x"],1)','RETURN Split(1,",")','RETURN Split("x",1)','RETURN Slice("x",0,1)'])assert.throws(()=>compile(source));
 await assert.rejects(run('RETURN Split(SESSION.x,",")',{x:[]}),{code:'SEWN.TYPE'});
});

test('collection allocations and scans consume caller reductions',async()=>{
 await assert.rejects(run('RETURN Join(["abc","def"],"-")',{}, {sewnString:6}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('RETURN Split("abcd","")',{}, {sewnValueNodes:4}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('RETURN Split(",,,,",",")',{}, {sewnValueNodes:5}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('RETURN Split("x",",")',{}, {sewnValueNodes:1}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('RETURN Contains(SESSION.a,0)',{a:Array(64).fill(1)}, {sewnSteps:10}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('RETURN SESSION.a[0]',{a:Array(64).fill(1)}, {sewnSteps:3}),{code:'SEWN.LIMIT'});
 assert.deepEqual(await run('RETURN Split("","")',{}, {sewnValueNodes:1}),[]);
});

test('numeric loops implement inclusive positive, negative and fractional steps',async()=>{
 for(const loop of ['FOR i=1 TO 10','FOR i=10 TO 1 STEP -1'])assert.equal(await run(`DIM total AS Integer=0\n${loop}\ntotal=total+i\nNEXT i\nRETURN total`),55);
 for(const [start,end,step,count] of [[0,1,0.25,5],[1,0,-0.25,5],[1,0,1,0],[0,1,-1,0],[1,1,1,1],[1,1,-1,1],[0,1,2,1],[0,1,0.1,11]])assert.equal(await run(`DIM n AS Integer=0\nFOR x=${start} TO ${end} STEP ${step}\nn=n+1\nNEXT\nRETURN n`),count);
 assert.equal(await run('FOR i=9007199254740991 TO 9007199254740991\nRETURN i\nNEXT'),9007199254740991);
 for(const source of ['FOR i=1 TO 2 STEP 0\nNEXT','FOR i="1" TO 2\nNEXT','FOR i=1 TO 2\nNEXT j','FOR i=1 TO 2\ni=3\nNEXT','FOR i=1 TO 2\nNEXT\nRETURN i','DIM i=1\nFOR i=1 TO 2\nNEXT'])assert.throws(()=>compile(source));
 assert.equal(await run('FOR i=1 TO 1\nNEXT\nFOR i=1 TO 1\nNEXT\nCONST i=4\nRETURN i'),4);
});

test('numeric bounds evaluate once and body changes do not change captured bounds',async()=>{
 const source='DIM total=0\nDIM a=SESSION.a\nDIM b=SESSION.b\nDIM c=SESSION.c\nFOR i=a TO b STEP c\na=100\nb=100\nc=10\ntotal=total+i\nNEXT\nRETURN total';
 assert.equal(await run(source,{a:1,b:3,c:1}),6);
 for(const field of ['a','b','c'])for(const value of [null,'1',true,[],{}])await assert.rejects(run(source,{a:1,b:3,c:1,[field]:value}),{code:'SEWN.TYPE'});
 await assert.rejects(run(source,{a:1,b:3,c:0}),{code:'SEWN.TYPE'});
 let calls=[];const bound=method=>({op:'read',target:{op:'serviceCall',library:'test',method,input:literal({})},key:'value'});
 const result=await wire([{op:'forNumeric',name:'i',start:bound('start'),end:bound('end'),step:bound('step'),body:[{op:'exitFor'}]},{op:'return',value:literal(true)}],{SERVICES:{Call(library,method){calls.push(method);return {value:method==='end'?10:1};}}});
 assert.equal(result.value,true);assert.deepEqual(calls,['start','end','step']);
});

test('nested and mixed loops honor innermost EXIT FOR, returns and cleanup',async()=>{
 assert.equal(await run('DIM n AS Integer=0\nFOR i=1 TO 3\nFOR j=1 TO 4\nn=n+1\nEXIT FOR\nNEXT j\nNEXT i\nRETURN n'),3);
 assert.equal(await run('DIM n AS Integer=0\nFOR i=1 TO 3\nFOR EACH item IN [1,2]\nn=n+item\nEXIT FOR\nNEXT item\nNEXT i\nRETURN n'),3);
 assert.equal(await run('DIM n AS Integer=0\nFOR EACH item IN [1,2]\nFOR i=1 TO 3\nn=n+item\nEXIT FOR\nNEXT i\nNEXT item\nRETURN n'),3);
 assert.equal(await run('TRY\nFOR i=1 TO 2 STEP SESSION.step\nNEXT\nCATCH err\nEND TRY\nFOR i=1 TO 1\nNEXT\nRETURN TRUE',{step:0}),true);
 const module=compileModule('FUNCTION First() AS Integer\nFOR i=1 TO 3\nRETURN i\nNEXT\nRETURN 0\nEND FUNCTION\nEVENT Page.Load\nRETURN First()\nEND EVENT');
 assert.equal((await execute(module.events[0].workflow,{scope:{},context:context()})).value,1);
});

test('numeric increments reject overflow and nonprogress without resetting budgets',async()=>{
 await assert.rejects(run('FOR i=9007199254740990 TO 9007199254740991 STEP 2\nNEXT'),{code:'SEWN.TYPE'});
 await assert.rejects(run('FOR i=SESSION.start TO SESSION.end STEP SESSION.step\nNEXT',{start:1e300,end:1.1e300,step:1}),{code:'SEWN.TYPE'});
 await assert.rejects(run('FOR i=SESSION.start TO SESSION.end STEP SESSION.step\nNEXT',{start:1e308,end:Number.MAX_VALUE,step:1e308}),{code:'SEWN.TYPE'});
 await assert.rejects(run('FOR i=1 TO 3\nNEXT',{}, {sewnIterations:2}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('FOR i=1 TO 2\nFOR EACH x IN [1,2]\nNEXT\nNEXT',{}, {sewnIterations:5}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('FOR i=1 TO 3\nNEXT',{}, {sewnSteps:5}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('FOR i=1 TO 1\nNEXT',{}, {sewnVariables:0}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('FOR i=1 TO 1\nNEXT',{}, {sewnNesting:0}),{code:'SEWN.LIMIT'});
});

test('constants require initialized scalars and reject rebinding and scope collisions',async()=>{
 assert.deepEqual(await run('CONST MaxPageSize AS Integer=8\nCONST AppName AS String="Taskboard"\nCONST enabled=TRUE\nCONST empty=NULL\nCONST t=String\nCONST d=DateTime("1970-01-01T00:00:00.000Z")\nRETURN [MaxPageSize,AppName,enabled,empty,t=String,TypeOf(d)=DateTime]'),[8,'Taskboard',true,null,true,true]);
 assert.equal(await run('CONST n AS Integer=Abs(SESSION.x)\nRETURN n',{x:-8}),8);
 assert.equal(await run('CONST x AS Scalar=SESSION.x\nRETURN TypeOf(x)=Boolean',{x:true}),true);
 for(const source of ['CONST x','CONST x AS String','CONST x=1\nx=2','CONST x=1\nDIM x=2','DIM x=1\nCONST x=2','CONST x AS Integer="1"','CONST x=[]','CONST x={}','CONST x=Me','CONST x AS Wydgit=NULL','CONST x=SESSION.x','FOR i=1 TO 1\nCONST x=1\nNEXT'])assert.throws(()=>compile(source),e=>e.code.startsWith('WYDBASIC.'));
 for(const x of [null,1,[],{}])await assert.rejects(run('CONST x AS String=SESSION.x\nRETURN x',{x}),{code:'SEWN.TYPE'});
 await assert.rejects(run('CONST x AS DataType=SESSION.x\nRETURN x',{x:{type:'DataType',value:'String'}}),{code:'SEWN.TYPE'});
 const module=compileModule('FUNCTION Echo(x AS Integer) AS Integer\nCONST n AS Integer=x\nRETURN n\nEND FUNCTION\nEVENT Page.Load\nCONST n AS Integer=3\nRETURN [Echo(1),Echo(2),n]\nEND EVENT');
 assert.deepEqual((await execute(module.events[0].workflow,{scope:{},context:context()})).value,[1,2,3]);
});

test('closed 0.13 wire grammar and runtime immutable bindings cannot be bypassed',async()=>{
 const p=compile('CONST n=2\nFOR i=1 TO n\nNEXT\nRETURN Split("a,b",",")[1]');assert.equal(p.schema,'sewn/0.13');
 for(let i=1;i<=12;i++)assert.throws(()=>validate({...p,schema:`sewn/0.${i}`}),{code:'SEWN.INVALID'});
 for(const expression of [{op:'index',target:literal([1])},{op:'index',target:literal([1]),index:literal(0),write:true},operation('Slice',literal([])),operation('constructor',literal([]))])assert.throws(()=>validate(document(returned(expression))),{code:'SEWN.INVALID'});
 for(const statement of [{op:'constant',name:'n',type:'Object',value:literal({})},{op:'constant',name:'n',type:'Integer'},{op:'forNumeric',name:'i',start:literal(0),end:literal(1),body:[]},{op:'exitFor'}])assert.throws(()=>validate(document([statement])),{code:'SEWN.INVALID'});
 await assert.rejects(wire([{op:'constant',name:'n',type:'Integer',value:literal(1)},{op:'set',name:'n',value:literal(2)}]),{code:'SEWN.TYPE'});
 await assert.rejects(wire([{op:'forNumeric',name:'i',start:literal(1),end:literal(2),step:literal(1),body:[{op:'set',name:'i',value:literal(2)}]}]),{code:'SEWN.TYPE'});
 for(const name of ['Length','Contains','IndexOf'])await assert.rejects(execute({...document(returned(operation(name,literal([1]),...(name==='Length'?[]:[literal(1)])))),schema:'sewn/0.12'},{scope:{},context:context()}),{code:'SEWN.TYPE'});
 assert.throws(()=>validate({...document(returned({op:'typeCheck',type:'String',value:literal('x')})),schema:'sewn/0.12'}),{code:'SEWN.INVALID'});
 await assert.rejects(wire([{op:'constant',name:'n',type:'Integer',value:literal(1)},{op:'declare',name:'n',value:literal(2)}]),{code:'SEWN.TYPE'});
});

test('portable operations reject opaque arrays and arbitrary host member access',async()=>{
 const children={op:'invoke',target:{op:'context',name:'ME'},method:'related',args:[literal('children'),literal('blocks')]};
 for(const value of [{op:'index',target:children,index:literal(0)},operation('Length',children),operation('Slice',children,literal(0),literal(1)),operation('Contains',children,literal(null))])await assert.rejects(wire(returned(value),{ME:{id:'home',related:()=>[{id:'child'}]}}),{code:'SEWN.TYPE'});
 for(const name of ['ME','REQUEST'])await assert.rejects(wire(returned({op:'index',target:{op:'context',name},index:literal(0)}),{ME:{id:'home'},REQUEST:{}}),{code:'SEWN.TYPE'});
 assert.throws(()=>compile('RETURN Me.related("children","blocks")[0]'));
 const legacyReferences='CONST n=1\nDIM nodes AS Array=Me.related("children","blocks")\nDIM result AS String=""\nFOR EACH item IN nodes\nresult=item.id\nNEXT\nRETURN result';
 assert.equal((await execute(compile(legacyReferences),{scope:{ME:{id:'home',related:()=>[{id:'child'}]}},context:context()})).value,'child');
 await assert.rejects(wire(returned({op:'index',target:literal({0:'value'}),index:literal(0)})),{code:'SEWN.TYPE'});
 assert.throws(()=>compile('RETURN [1].constructor()'));
 await assert.rejects(wire([{op:'constant',name:'saved',type:'Scalar',value:{op:'context',name:'ME'}}],{ME:{id:'home'}}),{code:'SEWN.TYPE'});
});

test('procedure arrays, typed indexed returns and authorized service arrays interoperate',async()=>{
 const module=compileModule('FUNCTION Copy(a AS Array) AS Array\nRETURN Slice(a,0,2)\nEND FUNCTION\nFUNCTION Name(a AS Array) AS String\nRETURN a[1]\nEND FUNCTION\nEVENT Page.Load\nDIM a=Copy([String,DateTime("1970-01-01T00:00:00.000Z")])\nRETURN [a[0]=String,TypeOf(a[1])=DateTime,Name(["Andy","Barney"])]\nEND EVENT');
 assert.deepEqual((await execute(module.events[0].workflow,{context:context(),scope:{}})).value,[true,true,'Barney']);
 const response={op:'read',target:{op:'serviceCall',library:'test',method:'query',input:literal({})},key:'items'};
 const result=await wire(returned(operation('Join',response,literal('-'))),{SERVICES:{Call(){return {items:['a','b']};}}});assert.equal(result.value,'a-b');
 await assert.rejects(wire(returned(operation('Length',response)),{SERVICES:{Call(){throw Error('must not execute');}}},{sewnServiceCalls:0}),{code:'SEWN.LIMIT'});
});

test('WydClient executes indexed reads, collections, procedure loops and constants with cancellation',async()=>{
 const {mountClient}=await import('../wydclient/index.js');class Element extends EventTarget{}const element=new Element();
 const module=compileModule('FUNCTION Total() AS Integer\nCONST endValue AS Integer=3\nDIM n AS Integer=0\nFOR i=1 TO endValue\nn=n+i\nNEXT\nRETURN n\nEND FUNCTION\nEVENT Change\nCONST names AS String=Join(Split("a,b",","),"-")\nIF names="a-b" AND Total()=6 AND Split(names,"-")[1]="b" THEN\nEVENT.Cancel()\nEND IF\nEND EVENT');
 const client=mountClient({nodes:[{id:'home',kind:'field',element,value:'old'}],context:context(),handlers:[{owner:'home',type:'Change',workflow:module.events[0].workflow}]});
 await client.ready;element.value='new';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),null);await client.unmount();
 const limitedElement=new Element();const limited=mountClient({nodes:[{id:'home',kind:'field',element:limitedElement,value:'old'}],context:context({sewnIterations:1}),handlers:[{owner:'home',type:'Change',workflow:compile('FOR i=1 TO 2\nNEXT')}]});
 await limited.ready;limitedElement.value='new';limitedElement.dispatchEvent(new Event('change'));await limited.idle();assert.equal(limitedElement.value,'old');assert.equal(limited.error(),'SEWN.LIMIT');await limited.unmount();
});

test('browser-targeted executor runs 0.13 wire workflows without source compilers or Node services',async()=>{
 const {build}=await import('esbuild');const {runInNewContext}=await import('node:vm');
 const result=await build({stdin:{contents:"import {execute} from './wydgine/sewn/execute.js';import {ExecutionContext} from './wydgine/seam/context.js';export const run=(document,limits={})=>execute(document,{scope:{},context:new ExecutionContext({publisher:'acme',self:'home',limits})});",resolveDir:process.cwd()},bundle:true,platform:'browser',target:'es2022',format:'iife',globalName:'PortableRuntime',write:false,metafile:true});
 for(const input of Object.keys(result.metafile.inputs))assert.ok(!/wydbasic|node_modules|wydstore|storage/.test(input),input);
 const sandbox={setTimeout,clearTimeout};runInNewContext(result.outputFiles[0].text,sandbox);
 const source='CONST names AS String=Join(Split("Andy,Barney,Goober",","),"-")\nDIM total AS Integer=0\nFOR i=1 TO 3\ntotal=total+i\nNEXT\nRETURN names & Convert(total,String)';
 const serialized=JSON.stringify(compile(source));
 const run=limits=>runInNewContext(`PortableRuntime.run(JSON.parse(${JSON.stringify(serialized)}),${JSON.stringify(limits)})`,sandbox);
 assert.equal((await run({})).value,'Andy-Barney-Goober6');
 await assert.rejects(run({sewnIterations:2}),error=>error.code==='SEWN.LIMIT');
});
