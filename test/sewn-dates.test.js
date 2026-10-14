import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,compileModule} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {validate} from '../wydgine/sewn/validate.js';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {gzipSync,brotliCompressSync} from 'node:zlib';
const run=(p,limits={})=>execute(p,{scope:{},context:new ExecutionContext({publisher:'application',self:'home',limits})});
const dt=s=>`DateTime("${s}")`;
const a=dt('2024-01-31T23:15:16.123Z');
const cases=[
 [`DateAdd(${a},"month",1,"UTC")`,'2024-02-29T23:15:16.123Z'],
 [`DateAdd(${dt('2024-02-29T00:00:00.000Z')},"year",1,"UTC")`,'2025-02-28T00:00:00.000Z'],
 [`DateAdd(${a},"month",-13,"UTC")`,'2022-12-31T23:15:16.123Z'],
 [`DateAdd(${a},"week",1,"UTC")`,'2024-02-07T23:15:16.123Z'],
 [`DatePart(${a},"day","+02:00")`,1],
 [`DatePart(${a},"dayOfWeek","UTC")`,3],
 [`FormatDate(${a},"yyyy-MM-dd HH:mm:ss.SSS XXX","-05:00")`,'2024-01-31 18:15:16.123 -05:00'],
 [`FormatDate(${a},"iso","+23:59")`,'2024-02-01T23:14:16.123+23:59'],
 ['ParseDate("1969-12-31T19:00:00.000-05:00","iso","-05:00")','1970-01-01T00:00:00.000Z'],
 ['ParseDate("0000-02-29T00:00:00.000Z","iso","UTC")','0000-02-29T00:00:00.000Z'],
 [`DateDiff(${dt('2024-01-31T23:59:59.999Z')},${dt('2024-02-01T00:00:00.000Z')},"day","UTC")`,1],
 [`DateDiff(${dt('2024-02-01T00:00:00.000Z')},${dt('2024-01-31T23:59:58.501Z')},"second","UTC")`,-1],
];
for(const part of ['year','month','day','hour','minute','second','millisecond'])cases.push([`DatePart(${a},"${part}","UTC")`,{year:2024,month:1,day:31,hour:23,minute:15,second:16,millisecond:123}[part]]);
for(const year of [1900,2000,2100,2400])cases.push([`DateAdd(${dt(`${year}-01-31T00:00:00.000Z`)},"month",1,"UTC")`,`${year}-02-${year%400===0?29:28}T00:00:00.000Z`]);
for(const unit of ['millisecond','second','minute','hour','day','week'])cases.push([`DateAdd(${dt('1970-01-01T00:00:00.000Z')},"${unit}",-1,"UTC")`,new Date(-({millisecond:1,second:1000,minute:60000,hour:3600000,day:86400000,week:604800000}[unit])).toISOString()]);
for(const bound of ['-271821-04-20T00:00:00.000Z','+275760-09-13T00:00:00.000Z']){
 cases.push([`ParseDate("${bound}","iso","UTC")`,bound]);
 cases.push([`FormatDate(${dt(bound)},"iso","UTC")`,bound]);
 cases.push([`DateAdd(${dt(bound)},"year",0,"UTC")`,bound]);
}
for(const [part,result] of [['month',1],['year',1],['week',0],['hour',0]])cases.push([`DateDiff(${dt('2023-12-31T23:59:59.999Z')},${dt('2024-01-01T00:00:00.000Z')},"${part}","UTC")`,result]);
const bad=[...['2023-02-29','1900-02-29','2024-02-30','2024-00-01','2024-13-01'].map(d=>`ParseDate("${d}T00:00:00.000Z","iso","UTC")`),...['2024-01-01T24:00:00.000Z','2024-01-01T00:00:60.000Z','2024-01-01T00:00:00.00Z','2024-01-01T00:00:00.000','2024-01-01T00:00:00.000Zx'].map(s=>`ParseDate("${s}","iso","UTC")`),...['America/Chicago','Europe/London','Australia/Sydney','+24:00','+01:60','-00:00','bogus'].map(z=>`DatePart(${a},"year","${z}")`),`FormatDate(${a},"MMM","UTC")`,`DatePart(${a},"week","UTC")`,`DateAdd(${a},"hour",9007199254740991,"UTC")`,`DateAdd(${dt('+275760-09-13T00:00:00.000Z')},"millisecond",1,"UTC")`,`DateAdd(${dt('-271821-04-20T00:00:00.000Z')},"day",-1,"UTC")`];
async function conformance(executor){
 for(const [expr,value] of cases)assert.equal((await executor(compile(`RETURN ${expr}`))).value,value,expr);
 for(const expr of bad)await assert.rejects(executor(compile(`RETURN ${expr}`)),{code:'SEWN.TYPE'});
 for(const [expr,limits] of [[`FormatDate(${a},"${'MM'.repeat(65)}","UTC")`,{}],[`ParseDate("${'x'.repeat(41)}","iso","UTC")`,{}],[`FormatDate(${a},"yyyy","UTC")`,{sewnDateTokens:0}],[`FormatDate(${a},"yyyy","UTC")`,{sewnDateOutput:3}],[`DatePart(${a},"year","UTC")`,{sewnSteps:3}]])await assert.rejects(executor(compile(`TRY\nRETURN ${expr}\nCATCH err\nRETURN 99\nEND TRY`),limits),{code:'SEWN.LIMIT'});
 assert.equal((await executor(compile(`TRY\nRETURN FormatDate(${a},"bad","UTC")\nCATCH err\nRETURN err.code\nEND TRY`))).value,'SEWN.TYPE');
 const nested=compileModule(`FUNCTION F() AS String\nRETURN FormatDate(${a},"yyyy-MM-dd","UTC")\nEND FUNCTION\nEVENT Page.Load\nRETURN [F(),F()]\nEND EVENT`).events[0].workflow;
 await assert.rejects(executor(nested,{sewnSteps:20}),{code:'SEWN.LIMIT'});
}
test('portable date calendar, parsing, formatting, errors and cumulative budgets',()=>conformance(run));
test('date wire closure, historical isolation, types and compiler diagnostics',async()=>{
 for(const [expr,limits] of [[`DatePart(${a},"year","${'x'.repeat(65)}")`,{}],[`ParseDate("2000-01-01T00:00:00.000Z","iso","UTC")`,{sewnDateInput:0}],[`FormatDate(${a},"iso","UTC")`,{sewnDateFormat:0}],[`DatePart(${a},"year","UTC")`,{sewnDateZone:0}],[`DatePart(${a},"year","UTC")`,{sewnTimeMs:0}]])await assert.rejects(run(compile(`RETURN ${expr}`),limits),{code:'SEWN.LIMIT'});
 const p=compile(`RETURN DatePart(${a},"year","UTC")`);assert.equal(p.schema,'sewn/0.18');
 for(let i=1;i<=17;i++)assert.throws(()=>validate({...p,schema:`sewn/0.${i}`}),{code:'SEWN.INVALID'});
 for(const change of [{name:'DateUnknown'},{args:[]},{args:[{op:'eval'}]}])assert.throws(()=>validate({...p,body:[{op:'return',value:{...p.body[0].value,...change}}]}),{code:'SEWN.INVALID'});
 for(const s of ['RETURN DatePart(1,"year","UTC")','RETURN ParseDate("x","iso")','DIM DateAdd=1','RETURN Now()'])assert.throws(()=>compile(s));
 const forged={...p,body:[{op:'return',value:{op:'operation',name:'DatePart',args:[{op:'literal',value:{type:'DateTime',value:0}},{op:'literal',value:'year'},{op:'literal',value:'UTC'}]}}]};await assert.rejects(run(forged),{code:'SEWN.TYPE'});
});
test('independent browser bundle runs shared date fixtures without compiler or host timezone data',async()=>{
 const result=await build({stdin:{contents:"export {execute} from './wydgine/sewn/execute.js';export {ExecutionContext} from './wydgine/seam/context.js';export {PrototypeRegistry} from './wydgine/object-model/prototypes.js';export {bindMembers} from './wydgine/object-model/members.js';",resolveDir:process.cwd()},bundle:true,platform:'browser',target:'es2022',format:'iife',globalName:'Portable',minify:true,write:false,metafile:true});
 for(const input of Object.keys(result.metafile.inputs))assert.ok(!/wydbasic|static-libraries|storage|node_modules/.test(input),input);
 const sandbox={setTimeout,clearTimeout};runInNewContext(result.outputFiles[0].text,sandbox);const api=sandbox.Portable;
 await conformance((p,limits={})=>runInNewContext(`Portable.execute(JSON.parse(${JSON.stringify(JSON.stringify(p))}),{scope:{},context:new Portable.ExecutionContext({publisher:'application',self:'home',limits:${JSON.stringify(limits)}})})`,sandbox));
 const bytes=result.outputFiles[0].contents;console.log('date event harness min/gzip/br',bytes.length,gzipSync(bytes).length,brotliCompressSync(bytes).length);
});
test('date static linking preserves 0.18 and caller budgets; WydClient cancellation remains live',async()=>{
 const {compilePrototype}=await import('../wydgine/wydbasic/index.js');const {StaticLibraryRegistry}=await import('../wydgine/static-libraries/index.js');
 const d={id:'acme/dates',publisher:'acme',static:true,alias:'Dates',version:'1.0.0',dependencies:{},properties:{},slots:{},behavior:compilePrototype(`FUNCTION Year() AS Integer\nRETURN DatePart(${a},"year","UTC")\nEND FUNCTION`,{static:true})};
 const p=compile('WITH LIBRARY acme/dates\nRETURN [Year(),Year()]',{libraries:new StaticLibraryRegistry([d],{verifiedPrototypes:{'acme/dates':'acme'}}),dependencies:{'acme/dates':'1.0.0'}});
 assert.equal(p.schema,'sewn/0.18');assert.deepEqual((await run(p)).value,[2024,2024]);await assert.rejects(run(p,{sewnSteps:15}),{code:'SEWN.LIMIT'});
 const {mountClient}=await import('../wydclient/index.js');class Element extends EventTarget{}const element=new Element();
 const workflow=compileModule(`EVENT Change\nDIM y=DatePart(${a},"year","UTC")\nEVENT.Cancel()\nEND EVENT`).events[0].workflow;
 const client=mountClient({nodes:[{id:'home',kind:'field',element,value:'old'}],context:new ExecutionContext({publisher:'application',self:'home'}),handlers:[{owner:'home',type:'Change',workflow}]});await client.ready;element.value='new';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),null);await client.unmount();
});
