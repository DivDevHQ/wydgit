import { clean,freeze,jsonKeys,WydgitError } from '../object-model/validation.js';
import {SCHEMA,MAXIMA,statements,expressions,operators,contextNames,safeKey} from './schema.js';
export const fail=code=>{throw new WydgitError(`SEWN.${code}`,'SEWN execution failed');};
export const ensure=(v,code='INVALID')=>{if(!v)fail(code);};
export const name=n=>ensure(safeKey(n)&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n));
export function validate(document) {
 let count=0,characters=0;const seen=new Set();
 const preflight=(v,d=0)=>{ensure(d<=64&&++count<=MAXIMA.programNodes,'LIMIT');if(typeof v==='string'){characters+=v.length;ensure(characters<=MAXIMA.programSize,'LIMIT');}if(v&&typeof v==='object'){ensure(!seen.has(v));seen.add(v);let keys;try{keys=jsonKeys(v);}catch{fail('INVALID');}for(const key of keys){ensure(safeKey(key));characters+=key.length;ensure(characters<=MAXIMA.programSize,'LIMIT');preflight(Object.getOwnPropertyDescriptor(v,key).value,d+1);}seen.delete(v);}};preflight(document);
 let p;try{p=clean(document);}catch{fail('INVALID');}
 let nodes=0;const size=(v,d=0)=>{ensure(d<=64,'LIMIT');ensure(++nodes<=MAXIMA.programNodes,'LIMIT');if(v&&typeof v==='object')Object.values(v).forEach(x=>size(x,d+1));};size(p);ensure(JSON.stringify(p).length<=MAXIMA.programSize,'LIMIT');
 const shape=(n,fields)=>{ensure(n&&typeof n==='object'&&!Array.isArray(n));ensure(Object.keys(n).every(k=>k==='op'||fields.some(f=>f.replace('?','')===k)));for(const f of fields)if(!f.endsWith('?'))ensure(Object.hasOwn(n,f));};
 const expr=(n,d=0)=>{ensure(d<=MAXIMA.expressionDepth,'LIMIT');ensure(n&&Object.hasOwn(expressions,n.op));shape(n,expressions[n.op]);
  if(n.op==='array'){ensure(Array.isArray(n.items));n.items.forEach(x=>expr(x,d+1));}if(n.op==='object'){ensure(n.fields&&typeof n.fields==='object'&&!Array.isArray(n.fields));Object.values(n.fields).forEach(x=>expr(x,d+1));}
  if(n.op==='variable')name(n.name);if(n.op==='context')ensure(contextNames.includes(n.name));
  if(n.op==='read'){ensure(safeKey(n.key)||Number.isSafeInteger(n.key)&&n.key>=0);expr(n.target,d+1);}
  if(n.op==='invoke'){ensure(safeKey(n.method));expr(n.target,d+1);ensure(Array.isArray(n.args));n.args.forEach(x=>expr(x,d+1));}
  if(n.op==='binary'){ensure(operators.includes(n.operator));expr(n.left,d+1);expr(n.right,d+1);}if(n.op==='not')expr(n.value,d+1);
 };
 const body=(b,d=0)=>{ensure(d<=MAXIMA.nesting,'LIMIT');ensure(Array.isArray(b));for(const n of b){ensure(n&&Object.hasOwn(statements,n.op));shape(n,statements[n.op]);
  if(['declare','set','forEach'].includes(n.op))name(n.name);if(Object.hasOwn(n,'into'))name(n.into);
  if(['declare','set','return'].includes(n.op)||n.op==='stop'&&Object.hasOwn(n,'value'))expr(n.value);
  if(n.op==='if'){expr(n.condition);body(n.then,d+1);if(n.else!==undefined)body(n.else,d+1);}
  if(n.op==='forEach'){expr(n.items);body(n.body,d+1);}
  if(n.op==='call'){expr(n.target);ensure(safeKey(n.method)&&Array.isArray(n.args));n.args.forEach(x=>expr(x));}
  if(n.op==='service'){ensure(safeKey(n.library)&&safeKey(n.method));expr(n.input);}
 }};
 ensure(p&&p.schema===SCHEMA&&Object.keys(p).every(k=>['schema','body'].includes(k)));body(p.body);return freeze(p);
}
