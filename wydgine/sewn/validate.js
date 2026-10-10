import { clean,freeze,jsonKeys,WydgitError } from '../object-model/validation.js';
import {SCHEMA,MAXIMA,statements,expressions,operators,contextNames,safeKey,PROCEDURE_SCHEMA,procedureStatements,procedureExpressions,sourceTypes,reservedNames,OBJECT_SCHEMA,objectStatements,objectExpressions} from './schema.js';
export const fail=code=>{throw new WydgitError(`SEWN.${code}`,'SEWN execution failed');};
export const ensure=(v,code='INVALID')=>{if(!v)fail(code);};
export const name=n=>ensure(safeKey(n)&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n));
export function validate(document) {
 let count=0,characters=0;const seen=new Set();
 const preflight=(v,d=0)=>{ensure(d<=64&&++count<=MAXIMA.programNodes,'LIMIT');if(typeof v==='string'){characters+=v.length;ensure(characters<=MAXIMA.programSize,'LIMIT');}if(v&&typeof v==='object'){ensure(!seen.has(v));seen.add(v);let keys;try{keys=jsonKeys(v);}catch{fail('INVALID');}for(const key of keys){ensure(safeKey(key));characters+=key.length;ensure(characters<=MAXIMA.programSize,'LIMIT');preflight(Object.getOwnPropertyDescriptor(v,key).value,d+1);}seen.delete(v);}};preflight(document);
 let p;try{p=clean(document);}catch{fail('INVALID');}
 let nodes=0;const size=(v,d=0)=>{ensure(d<=64,'LIMIT');ensure(++nodes<=MAXIMA.programNodes,'LIMIT');if(v&&typeof v==='object')Object.values(v).forEach(x=>size(x,d+1));};size(p);ensure(JSON.stringify(p).length<=MAXIMA.programSize,'LIMIT');
 const shape=(n,fields)=>{ensure(n&&typeof n==='object'&&!Array.isArray(n));ensure(Object.keys(n).every(k=>k==='op'||fields.some(f=>f.replace('?','')===k)));for(const f of fields)if(!f.endsWith('?'))ensure(Object.hasOwn(n,f));};
 const objects=p?.schema===OBJECT_SCHEMA,modern=objects||p?.schema===PROCEDURE_SCHEMA;
 const statementGrammar=objects?objectStatements:modern?procedureStatements:statements,expressionGrammar=objects?objectExpressions:modern?procedureExpressions:expressions;
 ensure(p&&[SCHEMA,PROCEDURE_SCHEMA,OBJECT_SCHEMA].includes(p.schema)&&Object.keys(p).every(k=>(modern?['schema','body','procedures']:['schema','body']).includes(k)));
 const procedures=modern?p.procedures:{};
 ensure(procedures&&typeof procedures==='object'&&!Array.isArray(procedures));
 const graph=new Map();let current=null;
 const procedureName=n=>{name(n);ensure(n===n.toLowerCase()&&!reservedNames.includes(n.toUpperCase()));};
 const procedureCall=(n,kind,d)=>{procedureName(n.name);ensure(Object.hasOwn(procedures,n.name));const proc=procedures[n.name];ensure(proc.kind===kind&&Array.isArray(n.args)&&n.args.length===proc.params.length);if(current)graph.get(current).add(n.name);n.args.forEach(x=>expr(x,d+1));};
 const service=n=>ensure(safeKey(n.library)&&safeKey(n.method));
 const expr=(n,d=0)=>{ensure(d<=MAXIMA.expressionDepth,'LIMIT');ensure(n&&Object.hasOwn(expressionGrammar,n.op));shape(n,expressionGrammar[n.op]);
  if(n.op==='array'){ensure(Array.isArray(n.items));n.items.forEach(x=>expr(x,d+1));}if(n.op==='object'){ensure(n.fields&&typeof n.fields==='object'&&!Array.isArray(n.fields));Object.values(n.fields).forEach(x=>expr(x,d+1));}
  if(n.op==='construct'){ensure(typeof n.type==='string'&&/^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(n.type));expr(n.id,d+1);}
  if(n.op==='methodValue'){procedureName(n.name);expr(n.target,d+1);ensure(Array.isArray(n.args)&&n.args.length<=MAXIMA.parameters);n.args.forEach(x=>expr(x,d+1));}
  if(n.op==='functionCall')procedureCall(n,'function',d);if(n.op==='serviceCall'){service(n);expr(n.input,d+1);}
  if(n.op==='variable')name(n.name);if(n.op==='context')ensure(contextNames.includes(n.name));
  if(n.op==='read'){ensure(safeKey(n.key)||Number.isSafeInteger(n.key)&&n.key>=0);expr(n.target,d+1);}
  if(n.op==='invoke'){ensure(safeKey(n.method));expr(n.target,d+1);ensure(Array.isArray(n.args));n.args.forEach(x=>expr(x,d+1));}
  if(n.op==='binary'){ensure(operators.includes(n.operator));expr(n.left,d+1);expr(n.right,d+1);}if(n.op==='not')expr(n.value,d+1);
 };
 const body=(b,d=0)=>{ensure(d<=MAXIMA.nesting,'LIMIT');ensure(Array.isArray(b));for(const n of b){ensure(n&&Object.hasOwn(statementGrammar,n.op));shape(n,statementGrammar[n.op]);
  if(['declare','set','forEach'].includes(n.op))name(n.name);if(Object.hasOwn(n,'into'))name(n.into);
  if(n.op==='methodCall'){procedureName(n.name);expr(n.target);ensure(Array.isArray(n.args)&&n.args.length<=MAXIMA.parameters);n.args.forEach(x=>expr(x));}
  if(n.op==='procedureCall')procedureCall(n,'sub',0);
  if(n.op==='return'){ensure(current?procedures[current].kind==='sub'?!Object.hasOwn(n,'value'):Object.hasOwn(n,'value'):Object.hasOwn(n,'value'));}
  if(n.op==='stop')ensure(!current);
  if(['declare','set'].includes(n.op)||n.op==='return'&&Object.hasOwn(n,'value')||n.op==='stop'&&Object.hasOwn(n,'value'))expr(n.value);
  if(n.op==='if'){expr(n.condition);body(n.then,d+1);if(n.else!==undefined)body(n.else,d+1);}
  if(n.op==='forEach'){expr(n.items);body(n.body,d+1);}
  if(n.op==='call'){expr(n.target);ensure(safeKey(n.method)&&Array.isArray(n.args));n.args.forEach(x=>expr(x));}
  if(n.op==='service'){service(n);expr(n.input);}
 }};
 for(const [id,proc] of Object.entries(procedures)){
  procedureName(id);shape(proc,proc?.kind==='function'?['kind','params','returns','body']:['kind','params','body']);ensure(!Object.hasOwn(proc,'op'));
  ensure(['function','sub'].includes(proc.kind)&&Array.isArray(proc.params));ensure(proc.params.length<=MAXIMA.parameters,'LIMIT');
  if(proc.kind==='function')ensure(sourceTypes.includes(proc.returns));
  const names=new Set();for(const param of proc.params){shape(param,['name','type']);ensure(!Object.hasOwn(param,'op'));name(param.name);ensure(!reservedNames.includes(param.name.toUpperCase())&&!names.has(param.name)&&sourceTypes.includes(param.type));names.add(param.name);}
  graph.set(id,new Set());
 }
 for(const [id,proc] of Object.entries(procedures)){current=id;body(proc.body);}current=null;body(p.body);
 const visited=new Set(),active=new Set();
 const visit=id=>{ensure(!active.has(id));if(visited.has(id))return;active.add(id);for(const next of graph.get(id))visit(next);active.delete(id);visited.add(id);};
 for(const id of graph.keys())visit(id);
 return freeze(p);
}
