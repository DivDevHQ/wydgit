import test from 'node:test';
import assert from 'node:assert/strict';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {runPage,fixture} from '../test-support/events.js';
import {mountClient} from '../wydclient/index.js';
const l=value=>({op:'literal',value}),v=name=>({op:'variable',name}),c=name=>({op:'context',name}),r=(target,key)=>({op:'read',target,key}),b=(operator,left,right)=>({op:'binary',operator,left,right}),p=body=>({schema:'sewn/0.1',body});
const ret=value=>({op:'return',value});
const run=(body,limits={},scope={})=>execute(p(body),{context:new ExecutionContext({publisher:'acme',self:'home',limits}),scope});
const reject=(fn,code)=>assert.rejects(fn,e=>e.code===code);
test('JSON literals, local variables, expressions, branches, members, loops and termination are deterministic',async()=>{
 const body=[{op:'declare',name:'sum',value:l(0)},{op:'forEach',name:'item',items:l([1,2,3]),body:[{op:'set',name:'sum',value:b('+',v('sum'),v('item'))}]},{op:'if',condition:b('=',v('sum'),l(6)),then:[ret({op:'object',fields:{total:v('sum'),label:b('concat',l('o'),l('k')),member:r(l({a:[true]}),'a')}})],else:[{op:'stop'}]}];
 assert.deepEqual(await run(body),await run(body));assert.equal((await run(body)).value.total,6);
 assert.equal((await run([{op:'stop',value:l('done')},ret(l('unreachable'))])).status,'stopped');
 for(const [op,a,z,expected] of [['-',5,2,3],['*',5,2,10],['/',6,2,3],['!=',1,'1',true],['<',1,2,true],['<=',2,2,true],['>',3,2,true],['>=',2,2,true],['AND',true,false,false],['OR',false,true,true]])assert.equal((await run([ret(b(op,l(a),l(z)))])).value,expected);
 assert.equal((await run([ret({op:'not',value:l(false)})])).value,true);assert.equal((await run([ret(r(l([3]),0))])).value,3);
 await reject(()=>run([ret(b('+',l({}),l({})))]),'SEWN.TYPE');await reject(()=>run([ret(b('/',l(1),l(0)))]),'SEWN.TYPE');await reject(()=>run([ret(r(l([]),0))]),'SEWN.TYPE');
});
test('closed schema rejects executable values, unknown nodes/fields and prototype attacks',()=>{
 for(const bad of [p([{op:'eval',value:'process.exit()'}]),{...p([]),extra:true},p([{op:'stop',extra:true}]),p([ret(l(()=>{}))]),p([ret(l(new Date()))]),p([ret(l(Object.create({native:true})))])])assert.throws(()=>validate(bad),e=>e.code==='SEWN.INVALID');
 for(const key of ['__proto__','constructor','prototype']){assert.throws(()=>validate(p([ret(l(JSON.parse(`{"${key}":1}`)))])));assert.throws(()=>validate(p([ret(r(c('ME'),key))])));}
 let deep=l(1);for(let i=0;i<34;i++)deep={op:'not',value:deep};assert.throws(()=>validate(p([ret(deep)])),e=>e.code==='SEWN.LIMIT');assert.throws(()=>validate(p([ret(l('x'.repeat(70000)))])),e=>e.code==='SEWN.LIMIT');
});
test('resource maxima and context reductions fail closed',async()=>{
 await reject(()=>run([ret(l(1))],{sewnSteps:0}),'SEWN.LIMIT');await reject(()=>run([{op:'declare',name:'a',value:l(1)}],{sewnVariables:0}),'SEWN.LIMIT');await reject(()=>run([ret(l('xx'))],{sewnString:1}),'SEWN.LIMIT');await reject(()=>run([ret(l([1,2]))],{sewnValueNodes:2}),'SEWN.LIMIT');await reject(()=>run([ret({op:'not',value:l(true)})],{sewnExpressionDepth:0}),'SEWN.LIMIT');
 await reject(()=>run([{op:'if',condition:l(true),then:[]}],{sewnNesting:0}),'SEWN.LIMIT');await reject(()=>run([{op:'forEach',name:'i',items:l([1,2]),body:[]}],{sewnIterations:1}),'SEWN.LIMIT');
 const service={op:'service',library:'test',method:'wait',input:l({})};await reject(()=>run([service],{sewnServiceCalls:0}),'SEWN.LIMIT');await reject(()=>run([service],{sewnTimeMs:5},{SERVICES:{Call:()=>new Promise(resolve=>setTimeout(()=>resolve({ok:true}),30))}}),'SEWN.LIMIT');
});
test('Page contexts use existing scoped handles, facade allowlists and request isolation',async()=>{
 const workflow=p([{op:'call',target:c('ME'),method:'Set',args:[l('title'),{op:'invoke',target:r(c('REQUEST'),'Query'),method:'Get',args:[l('label')]}]}]);
 const handlers=[{type:'Page.Load',owner:'home',workflow}];const [a,z]=await Promise.all([runPage({handlers,input:{query:'label=One'}}),runPage({handlers,input:{query:'label=Two'}})]);assert.equal(a.error,null);assert.match(a.transport.text,/<title>One/);assert.match(z.transport.text,/<title>Two/);assert.equal(fixture().model.runtime.get('home').properties.title,'Test');
 for(const [value,code] of [[c('CLIENT'),'EVENT.CONTEXT'],[r(c('REQUEST'),'socket'),'SEWN.DENIED'],[r(c('ME'),'context'),'SEWN.DENIED'],[{op:'invoke',target:c('ME'),method:'requireCapability',args:[l('x')]},'SEWN.DENIED']])assert.equal((await runPage({handlers:[{type:'Page.Load',owner:'home',workflow:p([ret(value)])}]})).error.code,code);
 const leak=await runPage({handlers:[{type:'Page.Load',owner:'home',workflow:p([ret({op:'array',items:[c('ME')]})])}]});assert.equal(leak.error.code,'SEWN.TYPE');
 const denied=await runPage({context:fixture({capabilities:[]}).context,handlers});assert.equal(denied.error.code,'MUTATION.DENIED');
 const traversal=p([{op:'call',target:c('ME'),method:'related',args:[l('root')]}]);assert.equal((await runPage({handlers:[{type:'Page.Load',owner:'home',workflow:traversal}]})).error.code,'SEAM.TRAVERSAL');
 const stale=p([{op:'declare',name:'old',value:c('ME')},{op:'call',target:v('old'),method:'Remove',args:[]},ret(r(v('old'),'properties'))]);assert.equal((await runPage({handlers:[{type:'Page.Load',owner:'note',workflow:stale}]})).error.code,'EVENT.DENIED');
});
test('SEWN client handler executes through WydClient with no DOM access',async()=>{
 const element=new EventTarget();const client=mountClient({nodes:[{id:'home',element}],context:new ExecutionContext({publisher:'acme',self:'home'}),handlers:[{type:'Client.Ready',owner:'home',workflow:p([{op:'if',condition:b('=',r(c('ME'),'id'),l('home')),then:[ret(l('ready'))],else:[ret(c('REQUEST'))]}])}]});await client.ready;assert.equal(client.error(),null);await client.unmount();
});
test('portable subsystem contains no source evaluation or native imports',async()=>{
 const fs=await import('node:fs/promises');
 for(const file of ['schema','validate','bindings','execute']){const source=await fs.readFile(new URL(`../wydgine/sewn/${file}.js`,import.meta.url),'utf8');assert.doesNotMatch(source,/\beval\s*\(|\bFunction\s*\(|node:|\brequire\s*\(|\bimport\s*\(/);}
});

test('controlled Insert/Move/Remove reuse request-local mutation and scoped collections',async()=>{
 const workflow=p([
 {op:'call',target:c('ME'),method:'Insert',args:[l('blocks'),l(1),l({id:'thanks',type:'wydgit.core/block',properties:{content:{type:'markdown',value:'Transient'}}})]},
 {op:'declare',name:'children',value:{op:'invoke',target:c('ME'),method:'related',args:[l('children'),l('blocks')]}},
 {op:'call',target:r(v('children'),1),method:'Move',args:[c('ME'),l('blocks'),l(0)]},
 {op:'call',target:r(v('children'),1),method:'Remove',args:[]}
 ]);
 const result=await runPage({handlers:[{type:'Page.Load',owner:'section',workflow}]});assert.equal(result.error,null);assert.doesNotMatch(result.transport.text,/Transient/);assert.match(result.transport.text,/<form/);
 await reject(()=>run([ret(l('x'.repeat(16385)))],{sewnString:999999}),'SEWN.LIMIT');
});
