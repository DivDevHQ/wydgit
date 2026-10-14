import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,compileModule,compilePrototype} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
const context=limits=>new ExecutionContext({publisher:'acme',self:'home',limits});
const run=async(source,SESSION={},limits={})=>(await execute(compile(source),{scope:{SESSION},context:context(limits)})).value;
const bad=source=>assert.rejects(run(source),{code:'SEWN.TYPE'});
test('canonical conversion matrix, safe boundaries and legacy compatibility',async()=>{
 for(const [source,result] of [['Convert(TRUE,String)','True'],['Convert("False",Boolean)',false],['Convert("42",Integer)',42],['Convert(".5",Float)',.5],['Convert(42,Number)',42],['Convert("9007199254740991",Integer)',9007199254740991],['Convert(DateTime("1970-01-01T00:00:00.000Z"),String)','1970-01-01T00:00:00.000Z'],['Convert(Convert("1970-01-01T00:00:00.000Z",DateTime),String)','1970-01-01T00:00:00.000Z']])assert.equal(await run(`RETURN ${source}`),result);
 for(const expr of ['Convert("true",Boolean)','Convert("1",Boolean)','Convert(" 1",Number)','Convert("1e999",Float)','Convert("1e-999",Float)','Convert("9007199254740992",Float)','Convert("1.00000000000000001",Integer)','Convert("1.5",Integer)','Convert("2026-02-30T00:00:00.000Z",DateTime)'])await bad(`RETURN ${expr}`);
 for(const target of ['Object','Array','Wydgit','Scalar','DataType','NULL','"Integer"','TypeOf(1)'])assert.throws(()=>compile(`RETURN Convert(1,${target})`));
 for(const expr of ['Convert(NULL,String)','Convert(TRUE,Number)','Convert(1,DateTime)','Convert(1,Boolean)'])assert.throws(()=>compile(`RETURN ${expr}`));
 assert.equal(await run('RETURN Val(" +001.5 ")'),1.5);assert.equal(await run('RETURN CStr(FALSE)'), 'False');
 for(const x of [null,{},[],true])await assert.rejects(run('RETURN Convert(SESSION.x,Integer)',{x}),{code:'SEWN.TYPE'});
});
test('string primitives use checked UTF-16 positions and literal replacement',async()=>{
 for(const [expr,result] of [['Length("😀")',2],['Substring("Goober",0,3)','Goo'],['Substring("abc",3,0)',''],['IndexOf("abc","")',0],['LastIndexOf("abc","")',3],['IndexOf("abc","x")',-1],['LastIndexOf("abc","x")',-1],['StartsWith("","")',true],['EndsWith("","")',true],['Contains("","")',true],['ToUpper("abc")','ABC'],['ToLower("ABC")','abc'],['Trim(" x ")','x'],['TrimStart(" x ")','x '],['TrimEnd(" x ")',' x'],['Replace("aaaa","aa","$")','$$'],['Replace("a.a",".","x")','axa'],['Repeat("ab",3)','ababab'],['Repeat("",9007199254740991)','']])assert.equal(await run(`RETURN ${expr}`),result);
 for(const expr of ['Substring("abc",-1,1)','Substring("abc",4,0)','Substring("abc",2,2)','Repeat("x",-1)','Replace("x","","y")'])await bad(`RETURN ${expr}`);
 for(const expr of ['Length(1)','Repeat("x",.5)','Substring("abc",0,1.5)'])assert.throws(()=>compile(`RETURN ${expr}`));
 await assert.rejects(run('RETURN ToUpper(SESSION.x)',{x:2}),{code:'SEWN.TYPE'});
 for(const expr of ['Repeat("ab",3)','Replace("aa","a","xxxx")','ToUpper("ßßß")'])await assert.rejects(run(`RETURN ${expr}`,{}, {sewnString:4}),{code:'SEWN.LIMIT'});
});
test('math domains, exact Power and decimal half-away rounding',async()=>{
 for(const [expr,result] of [['Abs(-3)',3],['Floor(-1.2)',-2],['Ceiling(-1.2)',-1],['Truncate(-1.9)',-1],['Min(2,-3)',-3],['Max(2,-3)',2],['Power(2,3)',8],['Sqrt(9)',3],['Sign(-3)',-1],['Sign(-0)',0],['Round(1.005,2)',1.01],['Round(-1.005,2)',-1.01],['Round(2.5,0)',3],['Round(-2.5,0)',-3],['Round(Convert("1e-300",Float),15)',0],['Round(SESSION.large,15)',1e300],['Round(9007199254740991,15)',9007199254740991]])assert.equal(await run(`RETURN ${expr}`,{large:1e300}),result);
 for(const expr of ['Sqrt(-1)','Power(2,53)','Power(-2,0.5)','Round(1,-1)','Round(1,16)'])await bad(`RETURN ${expr}`);
 await assert.rejects(run('RETURN Power(SESSION.large,2)',{large:1e300}),{code:'SEWN.TYPE'});
 assert.equal(await run('RETURN Power(2,-2)=2^-2'),true);
 await assert.rejects(run('RETURN Abs(SESSION.x)',{x:'1'}),{code:'SEWN.TYPE'});
 assert.throws(()=>compile('RETURN Round(1,.5)'));
});
test('closed wire grammar, resource budgets and opaque data rejection',async()=>{
 const p=compile('RETURN Length("abc")');assert.equal(p.schema,'sewn/0.12');
 for(let i=1;i<=11;i++)assert.throws(()=>validate({...p,schema:`sewn/0.${i}`}),{code:'SEWN.INVALID'});
 for(const value of [{op:'operation',name:'constructor',args:[]},{op:'operation',name:'Length',args:[]},{op:'operation',name:'Length',args:[{op:'literal',value:'x'}],host:true},{op:'convert',mode:'host',type:'String',value:{op:'literal',value:1}}])assert.throws(()=>validate({...p,body:[{op:'return',value}]}),{code:'SEWN.INVALID'});
 await assert.rejects(run('RETURN Length("abc")',{}, {sewnSteps:1}),{code:'SEWN.LIMIT'});
 await assert.rejects(run('RETURN Repeat("a",16385)'),{code:'SEWN.LIMIT'});
 assert.throws(()=>compile('RETURN Convert(Me,String)'));
 await assert.rejects(run('RETURN Convert(SESSION.x,DateTime)',{x:{type:'DateTime',value:0}}),{code:'SEWN.TYPE'});
});
test('procedure and collection contracts and selection retain typed identity',async()=>{
 const p=compileModule('FUNCTION Echo(x AS Integer) AS Integer\nRETURN Abs(x)\nEND FUNCTION\nEVENT Page.Load\nDIM x AS Integer=Echo(Convert("-2",Integer))\nSELECT CASE x\nCASE 2\nRETURN [x,TypeOf(Convert("1",Float))=Integer,Convert("1970-01-01T00:00:00.000Z",DateTime)=DateTime("1970-01-01T00:00:00.000Z")]\nEND SELECT\nEND EVENT').events[0].workflow;
 assert.deepEqual((await execute(JSON.parse(JSON.stringify(p)),{context:context(),scope:{}})).value,[2,true,true]);
});
test('WydClient executes canonical wire operations and Change cancellation',async()=>{
 const {mountClient}=await import('../wydclient/index.js');class Element extends EventTarget{}const element=new Element();
 const client=mountClient({nodes:[{id:'home',kind:'field',element,value:'old'}],context:context(),handlers:[{owner:'home',type:'Change',workflow:compile('IF Contains(ToUpper("abc"),"B") AND Convert("True",Boolean) AND Round(-2.5,0)=-3 THEN\nEVENT.Cancel()\nEND IF')}]});
 await client.ready;element.value='new';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),null);await client.unmount();
});

test('archived Guestbook and pre-Codex Taskboard source baselines still compile unchanged',async()=>{
 const {readFile}=await import('node:fs/promises');
 const fixtures=JSON.parse(await readFile(new URL('./fixtures/sewn12-baselines.json',import.meta.url),'utf8'));
 assert.equal(fixtures.length,9);
 for(const {source} of fixtures){const programs=/^\s*(EVENT|FUNCTION|SUB)\b/im.test(source)?(()=>{const m=compileModule(source);return m.events.length?m.events.map(e=>e.workflow):[compilePrototype(source)];})():[compile(source)];for(const p of programs){assert.notEqual(p.schema,'sewn/0.12');validate(p);}}
});

test('independent wire operations enforce dynamic types, arity and caller authority',async()=>{
 const literal=value=>({op:'literal',value});
 const document=value=>({schema:'sewn/0.12',procedures:{},body:[{op:'return',value}]});
 for(const [name,args] of [['Length',[1]],['Substring',['abc',0.5,1]],['Round',[1,'2']],['Abs',[{}]],['Sqrt',[-1]],['Repeat',['x',-1]]])await assert.rejects(execute(document({op:'operation',name,args:args.map(literal)}),{context:context(),scope:{}}),{code:'SEWN.TYPE'});
 for(const name of ['ME','REQUEST'])await assert.rejects(execute(document({op:'operation',name:'Length',args:[{op:'context',name}]}),{context:context(),scope:{ME:{id:'home'},REQUEST:{private:'secret'}}}),{code:'SEWN.TYPE'});
 assert.equal((await execute(document({op:'operation',name:'Power',args:[literal(2),literal(3)]}),{context:context(),scope:{}})).value,8);
 for(const type of ['String','Number'])assert.throws(()=>validate({...document({op:'convert',mode:'canonical',type,value:literal(1)}),schema:'sewn/0.11'}),{code:'SEWN.INVALID'});
 await assert.rejects(run('RETURN Replace("aaaa","a","b")',{}, {sewnSteps:4}),{code:'SEWN.LIMIT'});
 assert.equal(await run('RETURN Substring("😀",0,1)'), '\ud83d');
 assert.equal(await run('RETURN Convert(SESSION.x,Float)',{x:9007199254740992}),9007199254740992);
 await assert.rejects(run('RETURN Convert(SESSION.x,Integer)',{x:9007199254740992}),{code:'SEWN.TYPE'});
});
