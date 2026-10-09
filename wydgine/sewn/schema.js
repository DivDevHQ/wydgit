// Runtime-neutral closed grammar. Every operand is a structured expression.
export const SCHEMA='sewn/0.1';
export const MAXIMA=Object.freeze({steps:10000,expressionDepth:32,nesting:16,iterations:1000,variables:64,valueNodes:4096,string:16384,serviceCalls:32,timeMs:1000,programNodes:8192,programSize:65536});
export const statements=Object.freeze({declare:['name','value'],set:['name','value'],if:['condition','then','else?'],forEach:['name','items','body'],call:['target','method','args','into?'],service:['library','method','input','into?'],return:['value'],stop:['value?']});
export const expressions=Object.freeze({array:['items'],object:['fields'],literal:['value'],variable:['name'],context:['name'],read:['target','key'],invoke:['target','method','args'],binary:['operator','left','right'],not:['value']});
export const operators=['=','!=','<','<=','>','>=','AND','OR','+','-','*','/','concat'];
export const contextNames=['ME','EVENT','REQUEST','RESPONSE','SESSION','PAGE','SERVER','CLIENT'];
export const safeKey=k=>typeof k==='string'&&!['__proto__','constructor','prototype'].includes(k);
