import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,parse,tokenize} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {runPage,fixture} from '../test-support/events.js';
import {prepareHandler} from '../wydgine/events/index.js';
import {mountClient} from '../wydclient/index.js';
const context=new ExecutionContext({publisher:'acme',self:'home'});
const run=source=>execute(compile(source),{context,scope:{}});
const l=value=>({op:'literal',value}),v=name=>({op:'variable',name}),b=(operator,left,right)=>({op:'binary',operator,left,right});
test('case-insensitive front end emits deterministic validated SEWN and equivalent execution',async()=>{
 const source=`' sum
DiM Total AS Number=0
FOR EACH Item IN [1,2,3]
 total = TOTAL + item
NEXT ITEM
IF (total + 1) > 6 THEN
 RETURN {"total":total,"label":"o" & "k"}
ELSEIF total = 0 THEN
 STOP "empty"
ELSE
 RETURN NULL
END IF`;
 const workflow=compile(source);assert.deepEqual(validate(workflow),workflow);assert.deepEqual(compile(source),workflow);
 const manual={schema:'sewn/0.1',body:[{op:'declare',name:'total',value:l(0)},{op:'forEach',name:'item',items:{op:'array',items:[l(1),l(2),l(3)]},body:[{op:'set',name:'total',value:b('+',v('total'),v('item'))}]},{op:'if',condition:b('>',b('+',v('total'),l(1)),l(6)),then:[{op:'return',value:{op:'object',fields:{total:v('total'),label:b('concat',l('o'),l('k'))}}}],else:[{op:'if',condition:b('=',v('total'),l(0)),then:[{op:'stop',value:l('empty')}],else:[{op:'return',value:l(null)}]}]}]};
 assert.deepEqual(workflow,validate(manual));assert.deepEqual(await run(source),await execute(manual,{context,scope:{}}));
 assert.deepEqual(compile('dim Name="Alice"\nreturn NAME'),compile('DIM name="Alice"\nRETURN name'));
 assert.equal(parse('DIM Count=1').body[0].name,'Count');assert.deepEqual(tokenize('\nRETURN 1')[1].location,{offset:1,line:2,column:1});
});
test('types, defaults, scalar operators, quoted strings and stop follow SEWN semantics',async()=>{
 for(const [expr,result] of [['5-2',3],['3*2',6],['6/2',3],['-2+3',1],['3.14',3.14],['1<>"1"',true],['1<2',true],['2<=2',true],['3>=2',true],['NOT FALSE AND TRUE OR FALSE',true],['"a" & "b"','ab'],['"say ""hi"""','say "hi"']])assert.equal((await run('RETURN '+expr)).value,result);
 assert.equal((await run('DIM s AS String\nDIM a AS Array\nDIM o AS Object\nDIM n AS Null\nDIM b AS Boolean\nRETURN s')).value,'');
 assert.equal((await run('DIM x=1\nx=2\nRETURN x')).value,2);
 assert.equal((await run('STOP "reason"\nRETURN 1')).status,'stopped');assert.equal((await run('STOP')).value,null);
 await assert.rejects(()=>run('RETURN 1/0'),e=>e.code==='SEWN.TYPE');
});
test('compile errors are structured and located, including unsupported and hostile syntax',()=>{
 for(const [source,code] of [['\nRETURN usrname','NAME'],['DIM a=1\nDIM A=2','NAME'],['DIM x AS Native','TYPE'],['DIM x AS String=1','TYPE'],['DIM x=1\nSET x=2','TYPE'],['DIM x AS Wydgit\nx=Me','TYPE'],['RETURN process','NAME'],['RETURN eval("x")','UNSUPPORTED'],['RETURN REQUEST.socket','UNSUPPORTED'],['RETURN ME.constructor','UNSUPPORTED'],['RETURN {"__proto__":1}','UNSUPPORTED'],['RETURN {"x":1,"x":2}','NAME'],['RETURN "bad','SYNTAX'],['IF TRUE THEN\nRETURN 1','SYNTAX'],['RETURN (1+2','SYNTAX'],['GOTO 10','UNSUPPORTED'],['FUNCTION x','UNSUPPORTED'],['DIM x=TRUE+1','TYPE'],['RETURN []=[]','TYPE'],['RETURN REQUEST.Form.Get()','TYPE'],['DIM me=1','NAME'],['DIM x=SERVICES.Call("fs","read",Me)','TYPE'],['FOR EACH i IN [1]\nDIM x=1\nNEXT','UNSUPPORTED'],['IF TRUE THEN\nDIM x=1\nEND IF\nRETURN x','NAME']])assert.throws(()=>compile(source),e=>e.code==='WYDBASIC.'+code&&e.details.line>=1&&e.details.column>=1,source);
 const error=(()=>{try{compile('\nRETURN unknown');}catch(e){return e.toJSON();}})();assert.equal(error.details.line,2);assert.equal(error.details.column,8);assert.match(error.message,/Unknown variable 'unknown'/);
 for(const name of ['Function','globalThis','window','document','require','import','fs','child_process','Hono'])assert.throws(()=>compile('RETURN '+name));
});
test('SET, contextual reads and facade calls use existing request-local authority with concurrent isolation',async()=>{
 const handlers=[{type:'Page.Load',owner:'home',wydBasic:'DIM item AS Wydgit\nSET ITEM=Me\nitem.Set("title",REQUEST.Query.Get("label"))\nIF NOT SESSION.authenticated THEN\nRETURN EVENT.Payload\nEND IF'}];
 const [one,two]=await Promise.all([runPage({handlers,input:{query:'label=One'}}),runPage({handlers,input:{query:'label=Two'}})]);assert.equal(one.error,null);assert.equal(two.error,null);assert.match(one.transport.text,/<title>One/);assert.match(two.transport.text,/<title>Two/);assert.equal(fixture().model.runtime.get('home').properties.title,'Test');
 assert.equal((await runPage({handlers,context:fixture({capabilities:[]}).context,input:{query:'label=Denied'}})).error.code,'MUTATION.DENIED');
 assert.equal((await runPage({handlers:[{type:'Page.Load',owner:'home',wydBasic:'RETURN CLIENT.Cookies.Get("theme")'}]})).error.code,'EVENT.CONTEXT');
 assert.deepEqual(compile('DIM x AS Wydgit=ME\nSET x=PAGE\nRETURN SERVER.App').body[1],validate({schema:'sewn/0.1',body:[{op:'set',name:'x',value:{op:'context',name:'PAGE'}}]}).body[0]);
 const nav=await runPage({handlers:[{type:'Page.Load',owner:'section',wydBasic:'DIM children=Me.related("children","blocks")\nFOR EACH child IN children\nRETURN child.id\nNEXT'}]});assert.equal(nav.error,null);
});
test('registration rejects invalid source and mixed implementation forms before any dispatch',async()=>{
 for(const record of [{wydBasic:'RETURN unknown'},{wydBasic:'STOP',run:function(){}},{wydBasic:'STOP',workflow:{schema:'sewn/0.1',body:[]}},{run:function(){},workflow:{schema:'sewn/0.1',body:[]}},{ }])assert.throws(()=>prepareHandler(record));
 await assert.rejects(()=>runPage({actions:[{wydBasic:'RETURN unknown'}]}),e=>e.code==='WYDBASIC.NAME');
});
test('WydClient Ready and semantic Change execute compiled source without native contexts',async()=>{
 const element=new EventTarget();const client=mountClient({nodes:[{id:'home',element,kind:'field',value:'old'}],context,handlers:[{type:'Client.Ready',owner:'home',wydBasic:'IF Me.id="home" THEN\nRETURN "ready"\nELSE\nRETURN REQUEST.IsPost\nEND IF'},{type:'Change',owner:'home',wydBasic:'EVENT.Cancel()'}]});await client.ready;assert.equal(client.error(),null);element.value='bad';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),null);await client.unmount();
});
test('compiler and generated workflows contain no JavaScript/native execution mechanism',async()=>{
 const fs=await import('node:fs/promises');for(const file of ['tokenize','parse','compile','errors','index'])assert.doesNotMatch(await fs.readFile(new URL(`../wydgine/wydbasic/${file}.js`,import.meta.url),'utf8'),/\beval\s*\(|\bFunction\s*\(|node:|\brequire\s*\(|\bimport\s*\(/);
});
test('compiled member/method workflow has the same structure and rendered result as handwritten SEWN',async()=>{
 const source='Me.Set("title", REQUEST.Query.Get("label"))';
 const manual={schema:'sewn/0.1',body:[{op:'call',target:{op:'context',name:'ME'},method:'Set',args:[l('title'),{op:'invoke',target:{op:'read',target:{op:'context',name:'REQUEST'},key:'Query'},method:'Get',args:[l('label')]}]}]};
 assert.deepEqual(compile(source),validate(manual));
 const record={type:'Page.Load',owner:'home'},input={query:'label=Equivalent'};
 const basic=await runPage({handlers:[{...record,wydBasic:source}],input}),sewn=await runPage({handlers:[{...record,workflow:manual}],input});
 assert.equal(basic.error,null);assert.equal(basic.transport.text,sewn.transport.text);
 const service={schema:'sewn/0.1',body:[{op:'service',library:'wydstore',method:'create',input:{op:'object',fields:{store:l('main')}},into:'result'},{op:'return',value:{op:'read',target:v('result'),key:'ok'}}]};
 const compiled=compile('DIM result=SERVICES.Call("wydstore","create",{"store":"main"})\nRETURN result.ok');assert.deepEqual(compiled,validate(service));
 const scope={SERVICES:{Call:async()=>({ok:true,value:null})}};assert.deepEqual(await execute(compiled,{context,scope}),await execute(service,{context,scope}));
});
test('Insert, Move and Remove compile to existing validated request-local mutations',async()=>{
 const handlers=[{type:'Page.Load',owner:'section',wydBasic:`
Me.Insert("blocks", 1, {"id":"thanks","type":"wydgit.core/block","properties":{
    "content":{"type":"markdown","value":"Transient"}
}})
DIM children=Me.related("children","blocks")
FOR EACH child IN children
    IF child.id="thanks" THEN
        child.Move(Me,"blocks",0)
        child.Remove()
    END IF
NEXT
`}];
 const result=await runPage({handlers});assert.equal(result.error,null);assert.doesNotMatch(result.transport.text,/Transient/);assert.match(result.transport.text,/<form/);
 for(const source of ['DIM IF=1','DIM item AS Wydgit\nSET item=REQUEST.Form.Get("name")'])assert.throws(()=>compile(source));
});

test('source and compiler bounds fail with located WydBASIC errors rather than native recursion failures',()=>{
 for(const source of ['RETURN '+Array(10000).fill('1').join('+'),'RETURN '+ '('.repeat(40)+'1'+')'.repeat(40),'x'.repeat(65537),null])assert.throws(()=>compile(source),e=>e.code.startsWith('WYDBASIC.')&&Number.isInteger(e.details.line));
});

test('string contents cannot be mistaken for keywords, operators or structural delimiters',async()=>{
 const result=await run('RETURN {"}":["]", "AND", "=", "THEN", "DIM"]}');
 assert.deepEqual([...result.value['}']],[']','AND','=','THEN','DIM']);
 assert.throws(()=>compile('RETURN 1 "AND" TRUE'),e=>e.code==='WYDBASIC.SYNTAX');
});
