import test from 'node:test';import assert from 'node:assert/strict';
import {execute} from '../wydgine/sewn/execute.js';import {validate} from '../wydgine/sewn/validate.js';import {ExecutionContext} from '../wydgine/seam/context.js';
// Independent hand-authored wire tests; no compiler imports.
const l=value=>({op:'literal',value}),convert=(type,value)=>({op:'convert',type,value}),doc=value=>({schema:'sewn/0.7',procedures:{},body:[{op:'return',value}]}),ctx=limits=>new ExecutionContext({context:'FrontEnd',publisher:'acme',self:'home',limits});
const run=(value,extra={})=>execute(doc(value),{context:ctx(),scope:{},...extra});

test('CStr formats primitives deterministically without locale or object coercion',async()=>{
 for(const [value,expected] of [['hello','hello'],['',''],[0,'0'],[-0,'0'],[12.5,'12.5'],[1e21,'1e+21'],[true,'True'],[false,'False']])assert.equal((await run(convert('String',l(value)))).value,expected);
 for(const value of [null,[],{}, {toString:'unsafe'}])await assert.rejects(run(convert('String',l(value))),{code:'SEWN.TYPE'});
});

test('Val accepts complete finite decimal values, rejects partial/malformed/nondecimal input',async()=>{
 for(const [value,expected] of [['10',10],[' +10\t',10],['\r\n-2.5e1 ', -25],['.5',.5],['5.',5],['001',1],['1e-3',.001],[42,42]])assert.equal((await run(convert('Number',l(value)))).value,expected);
 for(const value of ['', ' ', '10junk','0x10','&H10','1,000','1_000','NaN','Infinity','1e999','--1','1 2','1e','1.2.3','\u00a010',true,false,null,[],{}])await assert.rejects(run(convert('Number',l(value))),{code:'SEWN.TYPE'});
});

test('conversion cannot leak handles/facades and retains string/step/depth budgets',async()=>{
 for(const type of ['String','Number'])for(const name of ['ME','REQUEST'])await assert.rejects(run(convert(type,{op:'context',name}),{scope:{ME:{id:'home'},REQUEST:{}}}),{code:'SEWN.TYPE'});
 await assert.rejects(run(convert('String',l(1234)),{context:ctx({sewnString:3})}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(convert('String',l(true)),{context:ctx({sewnString:3})}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(convert('Number',l('1234')),{context:ctx({sewnString:3})}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(convert('Number',l('1')),{context:ctx({sewnSteps:2})}),{code:'SEWN.LIMIT'});
});

test('SEWN 0.1–0.6 remain closed; conversion operation has a bounded typed shape',()=>{
 for(let i=1;i<=6;i++){const p=doc(convert('String',l(1)));p.schema='sewn/0.'+i;if(i===1)delete p.procedures;assert.throws(()=>validate(p),{code:'SEWN.INVALID'});}
 for(const expr of [{op:'convert',type:'Object',value:l(1)},{op:'convert',value:l(1)},{op:'convert',type:'String'},{...convert('String',l(1)),method:'toString'}])assert.throws(()=>validate(doc(expr)),{code:'SEWN.INVALID'});
 assert.equal(validate({schema:'sewn/0.6',procedures:{val:{kind:'sub',params:[],body:[]}},body:[]}).schema,'sewn/0.6');
});

test('operand evaluated once; conversion does not imply service authority',async()=>{
 let calls=0;const value=convert('Number',{op:'read',target:{op:'serviceCall',library:'test',method:'read',input:l({})},key:'value'});const result=await run(value,{scope:{SERVICES:{Call(){calls++;return {value:'12'};}}}});assert.equal(result.value,12);assert.equal(calls,1);
 await assert.rejects(run(value,{context:ctx({sewnServiceCalls:0}),scope:{SERVICES:{Call(){throw Error('must not run');}}}}),{code:'SEWN.LIMIT'});
});
