import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,compileModule,compilePrototype} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {StaticLibraryRegistry} from '../wydgine/static-libraries/index.js';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {gzipSync,brotliCompressSync} from 'node:zlib';
const context=limits=>new ExecutionContext({publisher:'application',self:'home',limits});
const run=(p,limits={},scope={})=>execute(p,{context:context(limits),scope});
const l=value=>({op:'literal',value});
const loop=(mode='while',condition=l(true),body=[])=>({op:'do',mode,condition,body});
const doc=body=>({schema:'sewn/0.16',procedures:{},body});
const fixtures=[];
for(const mode of ['WHILE','UNTIL']){
 fixtures.push([`DIM n AS Integer=0\nDO ${mode} n ${mode==='WHILE'?'<':'>='} 5\nn=n+1\nLOOP\nRETURN n`,5]);
 fixtures.push([`DO ${mode} ${mode==='WHILE'?'FALSE':'TRUE'}\nRETURN 99\nLOOP\nRETURN 0`,0]);
 for(const inner of ['WHILE','UNTIL'])fixtures.push([`DIM n AS Integer=0\nDO ${mode} ${mode==='WHILE'?'TRUE':'FALSE'}\nDO ${inner} ${inner==='WHILE'?'TRUE':'FALSE'}\nn=n+1\nEXIT DO\nLOOP\nEXIT DO\nLOOP\nRETURN n`,1]);
}
for(const forLoop of ['FOR i=1 TO 3','FOR EACH i IN [1,2,3]']){
 fixtures.push([`DIM n AS Integer=0\n${forLoop}\nDO WHILE TRUE\nn=n+1\nEXIT DO\nLOOP\nNEXT\nRETURN n`,3]);
 fixtures.push([`DIM n AS Integer=0\nDO WHILE TRUE\n${forLoop}\nn=n+1\nEXIT DO\nNEXT\nRETURN 99\nLOOP\nRETURN n`,1]);
 fixtures.push([`DIM n AS Integer=0\nDO WHILE TRUE\n${forLoop}\nEXIT FOR\nNEXT\nn=n+1\nEXIT DO\nLOOP\nRETURN n`,1]);
}
fixtures.push(['DO WHILE TRUE\nIF TRUE THEN\nEXIT DO\nEND IF\nLOOP\nRETURN 1',1]);
fixtures.push(['DO WHILE TRUE\nSELECT CASE 1\nCASE 1\nEXIT DO\nEND SELECT\nLOOP\nRETURN 2',2]);
fixtures.push(['DIM n=0\nDO WHILE TRUE\nTRY\nEXIT DO\nFINALLY\nn=n+1\nEND TRY\nLOOP\nRETURN n',1]);
fixtures.push(['DO WHILE TRUE\nTRY\nIF SESSION.bad THEN\nEND IF\nCATCH err\nEXIT DO\nEND TRY\nLOOP\nRETURN 3',3]);
fixtures.push(['DO UNTIL FALSE\nRETURN 4\nLOOP',4]);
fixtures.push(['DO WHILE TRUE\nSTOP 5\nLOOP',5]);
async function conformance(executor){
 for(const [source,value] of fixtures)assert.equal((await executor(compile(source),{}, {SESSION:{bad:123}})).value,value,source);
 for(const source of ['DO WHILE TRUE\nLOOP','DO UNTIL FALSE\nLOOP','DO WHILE TRUE\nDO UNTIL FALSE\nLOOP\nLOOP','DO WHILE TRUE\nTRY\nIF SESSION.bad THEN\nEND IF\nCATCH err\nEND TRY\nLOOP'])await assert.rejects(executor(compile(source),{sewnIterations:8},{SESSION:{bad:123}}),{code:'SEWN.LIMIT'});
 for(const limits of [{sewnSteps:4},{sewnIterations:0},{sewnTimeMs:0}])await assert.rejects(executor(compile('DO WHILE TRUE\nLOOP'),limits),{code:'SEWN.LIMIT'});
 for(const mode of ['while','until'])await assert.rejects(executor(doc([loop(mode,l(123))])),{code:'SEWN.TYPE'});
 const p=compileModule('FUNCTION Count() AS Integer\nDIM n AS Integer=0\nDO UNTIL n>=3\nn=n+1\nLOOP\nRETURN n\nEND FUNCTION\nEVENT Page.Load\nRETURN [Count(),Count()]\nEND EVENT').events[0].workflow;
 assert.deepEqual(JSON.parse(JSON.stringify((await executor(p)).value)),[3,3]);await assert.rejects(executor(p,{sewnIterations:5}),{code:'SEWN.LIMIT'});
 const infinite=compileModule('FUNCTION Spin() AS Boolean\nDO WHILE TRUE\nLOOP\nRETURN TRUE\nEND FUNCTION\nEVENT Page.Load\nTRY\nRETURN Spin()\nCATCH err\nRETURN FALSE\nFINALLY\nRETURN FALSE\nEND TRY\nEND EVENT').events[0].workflow;
 await assert.rejects(executor(infinite,{sewnIterations:4}),{code:'SEWN.LIMIT'});
}
test('DO source and server conformance: modes, scopes, nested exits, flow and fatal shared budgets',async()=>conformance(run));
test('DO parser and lexical validation fail closed with source locations',()=>{
 for(const source of ['EXIT DO','IF FALSE THEN\nEXIT DO\nEND IF','DO WHILE TRUE\nEXIT FOR\nLOOP','DO\nLOOP','DO WHILE TRUE','LOOP','DO WHILE TRUE\nNEXT','DO WHILE TRUE\nLOOP UNTIL TRUE','DO UNTIL "done"\nLOOP','DO WHILE 123\nLOOP','DO WHILE TRUE\nDIM x=1\nLOOP','DO WHILE TRUE\nCONST x=1\nLOOP'])assert.throws(()=>compile(source),e=>/Line [0-9]+, column [0-9]+/.test(e.message));
 assert.throws(()=>compileModule('SUB Bad()\nEXIT DO\nEND SUB\nEVENT Page.Load\nDO WHILE TRUE\nCALL Bad()\nLOOP\nEND EVENT'));
 assert.equal(compile("do while RegexTest(\n\"a\",\"a\",\"\"\n)\n' comment\nexit do\nloop").schema,'sewn/0.16');
});
test('DO closed schema rejects malformed bodies, conditions, modes, fields and historical forms',()=>{
 const valid=loop();validate(doc([valid]));
 for(const n of [{...valid,mode:'forever'},{...valid,condition:undefined},{op:'do',mode:'while',body:[]},{...valid,body:null},{...valid,body:[{op:'eval'}]},{...valid,extra:true},{...valid,condition:{op:'eval'}},{op:'exitDo'},{op:'if',condition:l(false),then:[{op:'exitDo'}]},loop('while',l(true),[{op:'exitDo',extra:1}])])assert.throws(()=>validate(doc([n])),{code:'SEWN.INVALID'});
 for(let i=1;i<=15;i++)assert.throws(()=>validate({...doc([valid]),schema:`sewn/0.${i}`}),{code:'SEWN.INVALID'});
 assert.throws(()=>validate({...doc([loop('while',l(true),[{op:'procedureCall',name:'bad',args:[]}])]),procedures:{bad:{kind:'sub',params:[],body:[{op:'exitDo'}]}}}),{code:'SEWN.INVALID'});
});
test('DO static linking promotes schema and retains caller iteration budgets and regex behavior',async()=>{
 const d={id:'acme/loops',publisher:'acme',static:true,alias:'Loops',version:'1.0.0',dependencies:{},properties:{},slots:{},behavior:compilePrototype('FUNCTION Count() AS Integer\nDIM n AS Integer=0\nDO UNTIL n=3\nn=n+1\nLOOP\nRETURN n\nEND FUNCTION\nFUNCTION Spin() AS Boolean\nDO WHILE TRUE\nLOOP\nRETURN TRUE\nEND FUNCTION',{static:true})};
 const options={libraries:new StaticLibraryRegistry([d],{verifiedPrototypes:{'acme/loops':'acme'}}),dependencies:{'acme/loops':'1.0.0'}};
 const p=compile('WITH LIBRARY acme/loops\nRETURN [Count(),Count()]',options);assert.equal(p.schema,'sewn/0.16');await assert.rejects(run(p,{sewnIterations:5}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(compile('WITH LIBRARY acme/loops\nRETURN Spin()',options),{sewnIterations:5}),{code:'SEWN.LIMIT'});
 assert.equal((await run(compile('DO WHILE TRUE\nTRY\nRETURN RegexTest("a","(","")\nCATCH err\nEXIT DO\nEND TRY\nLOOP\nRETURN TRUE'))).value,true);
});
test('browser bundle executes identical DO fixtures without compiler or host modules',async()=>{
 const result=await build({stdin:{contents:"import {execute} from './wydgine/sewn/execute.js';import {ExecutionContext} from './wydgine/seam/context.js';export const run=(p,limits={},scope={})=>execute(p,{scope,context:new ExecutionContext({publisher:'application',self:'home',limits})});",resolveDir:process.cwd()},bundle:true,platform:'browser',target:'es2022',format:'iife',globalName:'PortableRuntime',minify:true,write:false,metafile:true});
 for(const input of Object.keys(result.metafile.inputs))assert.ok(!/wydbasic|static-libraries|node_modules|storage/.test(input),input);
 const sandbox={setTimeout,clearTimeout};runInNewContext(result.outputFiles[0].text,sandbox);
 await conformance((p,limits={},scope={})=>runInNewContext(`PortableRuntime.run(JSON.parse(${JSON.stringify(JSON.stringify(p))}),${JSON.stringify(limits)},${JSON.stringify(scope)})`,sandbox));
 const bytes=result.outputFiles[0].contents;console.log('DO event executor bytes',bytes.length,gzipSync(bytes).length,brotliCompressSync(bytes).length);
});
test('WydClient DO event cancellation and controlled limit failures',async()=>{
 const {mountClient}=await import('../wydclient/index.js');class Element extends EventTarget{}
 for(const infinite of [false,true]){
 const element=new Element(),workflow=compileModule(`EVENT Change\nDO WHILE TRUE\n${infinite?'':'EVENT.Cancel()\nEXIT DO'}\nLOOP\nEND EVENT`).events[0].workflow;
 const client=mountClient({nodes:[{id:'home',kind:'field',element,value:'old'}],context:context({sewnIterations:4}),handlers:[{owner:'home',type:'Change',workflow}]});await client.ready;element.value='new';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),infinite?'SEWN.LIMIT':null);await client.unmount();
 }
});
test('condition calls reevaluate with shared costs; DO propagates EXIT FOR to enclosing FOR',async()=>{
 const p=compileModule('FUNCTION Ready() AS Boolean\nRETURN EVENT.Cancelled\nEND FUNCTION\nEVENT Page.Load\nDO UNTIL Ready()\nEVENT.Cancel()\nLOOP\nRETURN TRUE\nEND EVENT');
 // Conditions use ordinary function-call lowering, with no special evaluator.
 assert.equal(p.events[0].workflow.body[0].condition.op,'functionCall');
 let cancelled=false,calls=0;const event={get Cancelled(){calls++;return cancelled;},Cancel(){cancelled=true;}};assert.equal((await run(p.events[0].workflow,{}, {EVENT:event})).value,true);assert.equal(calls,2);
 const source='DIM n=0\nFOR i=1 TO 3\nDO WHILE TRUE\nn=n+1\nEXIT FOR\nLOOP\nNEXT\nRETURN n';assert.equal((await run(compile(source))).value,1);
 for(const mode of ['WHILE','UNTIL'])await assert.rejects(run(compile(`DO ${mode} SESSION.value\nLOOP`),{}, {SESSION:{value:'done'}}),{code:'SEWN.TYPE'});
 const fatal=compile('DO WHILE TRUE\nTRY\nEXIT DO\nFINALLY\nDO UNTIL FALSE\nLOOP\nEND TRY\nLOOP');await assert.rejects(run(fatal,{sewnIterations:4}),{code:'SEWN.LIMIT'});
});
