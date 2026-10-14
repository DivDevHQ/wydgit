import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile,compileModule,compilePrototype} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {StaticLibraryRegistry} from '../wydgine/static-libraries/index.js';
import {MAXIMA} from '../wydgine/sewn/schema.js';
const staticWire=JSON.parse(readFileSync(new URL('./fixtures/sewn15-static-regex.json',import.meta.url)));
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/sewn15-regex.json',import.meta.url)));
const context=limits=>new ExecutionContext({publisher:'application',self:'home',limits});
const literal=value=>({op:'literal',value});
const operation=(name,args)=>({op:'operation',name,args:args.map(literal)});
const document=value=>({schema:'sewn/0.15',procedures:{},body:[{op:'return',value}]});
const run=(p,limits={},scope={})=>execute(p,{scope,context:context(limits)});
const plain=v=>JSON.parse(JSON.stringify(v));
const source=(name,args)=>`RETURN ${name}(${args.map(a=>typeof a==='string'?'"'+a.replaceAll('"','""')+'"':String(a)).join(',')})`;
async function conformance(executor){
 assert.equal((await executor(staticWire,{})).value,true);
 await assert.rejects(executor(staticWire,{sewnRegexWork:0}),e=>e.code==='SEWN.LIMIT');
 for(const f of fixtures){const p=document(operation(f.name,f.args));
  if(f.error)await assert.rejects(executor(p,f.limits??{}),e=>e.code===f.error,JSON.stringify(f));
  else assert.deepEqual(plain((await executor(p,f.limits??{})).value),f.value,JSON.stringify(f));
 }
}
test('shared portable regex fixture contract: all five operations, errors and reductions',async()=>{await conformance(run);});

test('compiler reserves intrinsics, enforces arities/types and preserves literal backslashes',async()=>{
 for(const f of fixtures.filter(f=>!f.error&&!f.args.some(a=>a.includes('\n')||a.includes('\r')))){
  const p=compile(source(f.name,f.args));assert.equal(p.schema,'sewn/0.15');assert.deepEqual(plain((await run(p)).value),f.value);
 }
 assert.equal((await run(compile('RETURN RegexTest(\n"ABC-1234",\n"^[A-Z]{3}-\\d{4}$",\n""\n)'))).value,true);
 const p=compile('RETURN RegexTest("123","\\d+","")');assert.equal(p.body[0].value.args[1].value,'\\d+');
 for(const s of ['RETURN RegexTest("x","x")','RETURN RegexTest("x","x","",0)','RETURN RegexReplace("x","x","")','RETURN RegexSplit("x",1,"")','RETURN RegexMatch(NULL,"x","")','DIM RegexTest=1','FUNCTION RegexTest() AS Boolean\nRETURN TRUE\nEND FUNCTION'])assert.throws(()=>compile(s));
 await assert.rejects(run(compile('RETURN RegexTest(SESSION.text,SESSION.pattern,SESSION.flags)'),{}, {SESSION:{text:1,pattern:'a',flags:''}}),{code:'SEWN.TYPE'});
 await assert.rejects(run(compile('DIM x AS String=RegexMatch("a","a","")\nRETURN x')),{code:'SEWN.TYPE'});
 const module=compileModule('FUNCTION Valid(t AS String) AS Boolean\nRETURN RegexTest(t,"^[A-Z]+$","")\nEND FUNCTION\nEVENT Page.Load\nRETURN Valid("ABC")\nEND EVENT');assert.equal((await run(module.events[0].workflow)).value,true);
});

test('closed wire grammar rejects forged fields, arities, nested expressions and historical operations',()=>{
 const p=document(operation('RegexTest',['a','a','']));validate(p);
 for(let i=1;i<=14;i++)assert.throws(()=>validate({...p,schema:`sewn/0.${i}`}),{code:'SEWN.INVALID'});
 for(const value of [{op:'operation',name:'RegexTest',args:[]},{op:'operation',name:'RegexTest'},{...p.body[0].value,flags:'g'},operation('RegexExec',['a','a','']),{op:'operation',name:'RegexTest',args:[literal('a'),literal('a'),{op:'eval',value:'g'}]}])assert.throws(()=>validate(document(value)),{code:'SEWN.INVALID'});
 assert.throws(()=>validate({...p,schema:'sewn/0.14',body:[]}),{code:'SEWN.INVALID'});
 assert.throws(()=>validate({...p,libraries:{}}),{code:'SEWN.INVALID'});
 assert.throws(()=>validate({...p,callbacks:[]}),{code:'SEWN.INVALID'});
 assert.throws(()=>validate(document({...p.body[0].value,args:[literal('a'),literal('a'),literal(()=>{})]})),{code:'SEWN.INVALID'});
});

test('adversarial patterns fail closed or run under pre-reserved NFA work',async()=>{
 for(const pattern of ['(a+)+$','(a|aa)+$','(a*)*$','(a+)+b'])await assert.rejects(run(document(operation('RegexTest',['a'.repeat(4095)+'!',pattern,'']))),{code:'SEWN.REGEX'});
 for(const pattern of ['(?:a+)+$','(?:a|aa)+$','(?:a*)*$','(?:a+)+b']){
  assert.equal((await run(document(operation('RegexTest',['a'.repeat(512)+'!',pattern,''])))).value,pattern==='(?:a*)*$');
  await assert.rejects(run(document(operation('RegexTest',['a'.repeat(512)+'!',pattern,''])),{sewnRegexWork:100}),{code:'SEWN.LIMIT'});
 }
 for(const [text,pattern] of [['a','a'.repeat(257)],['a'.repeat(4097),'a'],['a','a{999999999}'],['a','()'.repeat(9)],['a','(?:'.repeat(17)+'a'+')'.repeat(17)],['a','(?:a{32}){32}'],['a','(?:a{32,}){32,}'],['a','(?:'.repeat(6)+'a'+'){32,}'.repeat(6)],['a','a'.repeat(129)]])await assert.rejects(run(document(operation('RegexTest',[text,pattern,'']))),{code:'SEWN.LIMIT'});
 await assert.rejects(run(document(operation('RegexMatches',['a'.repeat(129),'a',''])),{sewnRegexWork:MAXIMA.regexWork}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(document(operation('RegexReplace',['a'.repeat(64),'a','x'.repeat(512),'g']))),{code:'SEWN.LIMIT'});
 await assert.rejects(run(document(operation('RegexTest',['a','a',''])),{sewnTimeMs:0}),{code:'SEWN.LIMIT'});
});

test('NFA admission reserves work before engine entry and unsupported grammar never compiles',async()=>{
 const {RE2JS}=await import('../wydgine/sewn/vendor/re2js.js');const original=RE2JS.compile;let compilations=0,searches=0;
 RE2JS.compile=(...args)=>{compilations++;const compiled=original.call(RE2JS,...args),engine=compiled.re2(),nfa=engine.doExecuteNFA;
  engine.executeEngine=()=>{throw Error('Unexpected engine path');};
  engine.doExecuteNFA=function(...args){searches++;return nfa.apply(this,args);};return compiled;
 };
 try{
  assert.equal((await run(document(operation('RegexTest',['abc','b',''])))).value,true);assert.equal(searches,1);
  searches=0;compilations=0;await assert.rejects(run(document(operation('RegexTest',['a'.repeat(512)+'!','(?:a+)+$',''])),{sewnRegexWork:2000}),{code:'SEWN.LIMIT'});assert.equal(searches,0);assert.equal(compilations,1);
  compilations=0;for(const pattern of ['(a+)+$','(?=a)','(?:a{32}){32}','(?:a{32,}){32,}'])await assert.rejects(run(document(operation('RegexTest',['a',pattern,'']))),e=>['SEWN.REGEX','SEWN.LIMIT'].includes(e.code));assert.equal(compilations,0);
 }finally{RE2JS.compile=original;}
});

test('malformed pattern errors recover; shared budgets remain fatal through catch/finally/retry',async()=>{
 const recover=compile('TRY\nRETURN RegexTest("a","(","")\nCATCH err\nRETURN err.code\nEND TRY');assert.equal((await run(recover)).value,'SEWN.REGEX');
 for(const s of ['TRY\nRETURN RegexTest("a","a{33}","")\nCATCH err\nRETURN TRUE\nEND TRY','TRY\nRETURN RegexTest("a","a","")\nCATCH err\nRETURN TRUE\nFINALLY\nRETURN TRUE\nEND TRY'])await assert.rejects(run(compile(s),{sewnRegexWork:0}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(compile('TRY\nRETURN RegexTest(SESSION.text,".","i")\nCATCH err\nRETURN TRUE\nEND TRY'),{sewnRegexWork:100},{SESSION:{text:'a'.repeat(1023)+'é'}}),{code:'SEWN.LIMIT'});
 const retry=compile('FOR i=1 TO 20\nTRY\nIF RegexTest("a","(","") THEN\nEND IF\nCATCH err\nEND TRY\nNEXT\nRETURN TRUE');
 await assert.rejects(run(retry,{sewnRegexWork:20}),{code:'SEWN.LIMIT'});
});

test('regex work remains cumulative across frames and output values remain portable',async()=>{
 const call=operation('RegexTest',['a','a','']);
 const single=await run(document(call),{sewnRegexWork:300});assert.equal(single.value,true);
 await assert.rejects(run(document({op:'array',items:[call,call]}),{sewnRegexWork:300}),{code:'SEWN.LIMIT'});
 const p=compileModule('FUNCTION Valid() AS Boolean\nRETURN RegexTest("a","a","")\nEND FUNCTION\nEVENT Page.Load\nRETURN [Valid(),Valid()]\nEND EVENT').events[0].workflow;
 await assert.rejects(run(p,{sewnRegexWork:300}),{code:'SEWN.LIMIT'});
 const outputs=await run(document(operation('RegexMatches',['aa','(a)',''])));assert.ok(Object.isFrozen(outputs.value));assert.ok(Object.isFrozen(outputs.value[0].groups));assert.equal(Object.getPrototypeOf(outputs.value[0]),null);
});

test('third-party static regex library retains original caller limits and closed portable linking',async()=>{
 const d={id:'acme/patterns',publisher:'acme',static:true,alias:'Patterns',version:'1.0.0',dependencies:{},properties:{},slots:{},methodRules:{helper:{access:'private'}},behavior:compilePrototype('FUNCTION Valid(t AS String) AS Boolean\nRETURN Helper(t)\nEND FUNCTION\nFUNCTION Helper(t AS String) AS Boolean\nRETURN RegexTest(t,"a","")\nEND FUNCTION',{static:true})};
 const options={libraries:new StaticLibraryRegistry([d],{verifiedPrototypes:{'acme/patterns':'acme'}}),dependencies:{'acme/patterns':'1.0.0'}};
 const p=compile('WITH LIBRARY acme/patterns\nRETURN Patterns.Valid("a")',options);assert.equal(p.schema,'sewn/0.15');assert.equal(p.libraries[0].id,'acme/patterns');assert.equal((await run(p)).value,true);
 const {libraries:omitted,...portable}=d.behavior;
 const portableOptions={...options,libraries:new StaticLibraryRegistry([{...d,behavior:portable}],{verifiedPrototypes:{'acme/patterns':'acme'}})};
 assert.equal((await run(compile('WITH LIBRARY acme/patterns\nRETURN Valid("a")',portableOptions))).value,true);
 await assert.rejects(run(p,{sewnRegexWork:0}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(p,{sewnProcedureCalls:0}),{code:'SEWN.LIMIT'});
 const twice=compile('WITH LIBRARY acme/patterns\nRETURN [Valid("a"),Valid("a")]',options);await assert.rejects(run(twice,{sewnRegexWork:300}),{code:'SEWN.LIMIT'});
 const guarded={...d,methodRules:{...d.methodRules,valid:{requires:['store.records.read']}}};const guardedOptions={...options,libraries:new StaticLibraryRegistry([guarded],{verifiedPrototypes:{'acme/patterns':'acme'}})};
 await assert.rejects(run(compile('WITH LIBRARY acme/patterns\nRETURN Valid("a")',guardedOptions)),{code:'SEAM.DENIED'});
});

test('repeated and concurrent regex calls have no retained mutable match state',async()=>{
 const p=document(operation('RegexMatch',['aa','a','g']));
 const results=await Promise.all(Array.from({length:32},()=>run(p)));for(const r of results)assert.equal(r.value.index,0);
 for(let i=0;i<20;i++)assert.equal((await run(p)).value.index,0);
});

test('WydClient regex Change handlers preserve cancellation and fatal limits',async()=>{
 const {mountClient}=await import('../wydclient/index.js');class Element extends EventTarget{}
 for(const limits of [{},{sewnRegexWork:0}]){
  const element=new Element();const p=compileModule('EVENT Change\nIF RegexTest("ABC-1234","^[A-Z]{3}-\\d{4}$","") THEN\nEVENT.Cancel()\nEND IF\nEND EVENT').events[0].workflow;
  const client=mountClient({nodes:[{id:'home',kind:'field',element,value:'old'}],context:context(limits),handlers:[{owner:'home',type:'Change',workflow:p}]});await client.ready;element.value='new';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),limits.sewnRegexWork===0?'SEWN.LIMIT':null);await client.unmount();
 }
});

test('browser-only wire executor satisfies the same full regex conformance without host tooling',async()=>{
 const {build}=await import('esbuild');const {runInNewContext}=await import('node:vm');
 const result=await build({stdin:{contents:"import {execute} from './wydgine/sewn/execute.js';import {ExecutionContext} from './wydgine/seam/context.js';export const run=(p,limits={})=>execute(p,{scope:{},context:new ExecutionContext({publisher:'application',self:'home',limits})});",resolveDir:process.cwd()},bundle:true,platform:'browser',target:'es2022',format:'iife',globalName:'PortableRuntime',write:false,metafile:true});
 for(const input of Object.keys(result.metafile.inputs))assert.ok(!/wydbasic|static-libraries|package\.js|node_modules|wydstore|storage/.test(input),input);
 // Native dynamic RegExp construction is unavailable, including in the engine.
 const sandbox={setTimeout,clearTimeout,RegExp:class {constructor(){throw Error('Native regex forbidden');}}};runInNewContext(result.outputFiles[0].text,sandbox);
 await conformance((p,limits)=>runInNewContext(`PortableRuntime.run(JSON.parse(${JSON.stringify(JSON.stringify(p))}),${JSON.stringify(limits)})`,sandbox));
});
