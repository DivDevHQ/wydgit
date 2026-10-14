import {STATIC_SCHEMA} from './schema.js';
import {COLLECTION_SCHEMA,collectionExpressions,collectionStatements,collectionReservedNames,collectionSignatures,constantTypes} from './schema.js';
import {OPERATION_SCHEMA,operationExpressions,operationReservedNames,operationSignatures,conversionTargets} from './schema.js';
import {CONTRACT_SCHEMA,contractTypes,contractExpressions,contractReservedNames} from './schema.js';
import {NUMERIC_SCHEMA,numericTypes,numericExpressions,numericReservedNames} from './schema.js';
import { clean,freeze,jsonKeys,WydgitError } from '../object-model/validation.js';
import {SCHEMA,MAXIMA,statements,expressions,operators,contextNames,safeKey,PROCEDURE_SCHEMA,procedureStatements,procedureExpressions,sourceTypes,reservedNames,OBJECT_SCHEMA,objectStatements,objectExpressions,SERVICE_SCHEMA,serviceStatements,serviceExpressions,MEMBER_SCHEMA,memberStatements,memberExpressions,CONTROL_SCHEMA,controlStatements,controlExpressions,controlReservedNames,CONVERSION_SCHEMA,conversionExpressions,conversionReservedNames,EXCEPTION_SCHEMA,exceptionStatements,exceptionReservedNames,SELECTION_SCHEMA,selectionStatements,selectionExpressions,selectionReservedNames} from './schema.js';
export const fail=code=>{throw new WydgitError(`SEWN.${code}`,'SEWN execution failed');};
export const ensure=(v,code='INVALID')=>{if(!v)fail(code);};
export const name=n=>ensure(safeKey(n)&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n));
export function validate(document) {
 let count=0,characters=0;const seen=new Set();
 const preflight=(v,d=0)=>{ensure(d<=64&&++count<=MAXIMA.programNodes,'LIMIT');if(typeof v==='string'){characters+=v.length;ensure(characters<=MAXIMA.programSize,'LIMIT');}if(v&&typeof v==='object'){ensure(!seen.has(v));seen.add(v);let keys;try{keys=jsonKeys(v);}catch{fail('INVALID');}for(const key of keys){ensure(safeKey(key));characters+=key.length;ensure(characters<=MAXIMA.programSize,'LIMIT');preflight(Object.getOwnPropertyDescriptor(v,key).value,d+1);}seen.delete(v);}};preflight(document);
 let p;try{p=clean(document);}catch{fail('INVALID');}
 let nodes=0;const size=(v,d=0)=>{ensure(d<=64,'LIMIT');ensure(++nodes<=MAXIMA.programNodes,'LIMIT');if(v&&typeof v==='object')Object.values(v).forEach(x=>size(x,d+1));};size(p);ensure(JSON.stringify(p).length<=MAXIMA.programSize,'LIMIT');
 const shape=(n,fields)=>{ensure(n&&typeof n==='object'&&!Array.isArray(n));ensure(Object.keys(n).every(k=>k==='op'||fields.some(f=>f.replace('?','')===k)));for(const f of fields)if(!f.endsWith('?'))ensure(Object.hasOwn(n,f));};
 const staticLinked=p?.schema===STATIC_SCHEMA,collections=staticLinked||p?.schema===COLLECTION_SCHEMA,operations=collections||p?.schema===OPERATION_SCHEMA,contracts=operations||p?.schema===CONTRACT_SCHEMA,numeric=contracts||p?.schema===NUMERIC_SCHEMA,types=contracts?contractTypes:numeric?numericTypes:sourceTypes;
 const selection=numeric||p?.schema===SELECTION_SCHEMA,exceptions=selection||p?.schema===EXCEPTION_SCHEMA,conversion=exceptions||p?.schema===CONVERSION_SCHEMA,control=conversion||p?.schema===CONTROL_SCHEMA,reserved=collections?collectionReservedNames:operations?operationReservedNames:contracts?contractReservedNames:numeric?numericReservedNames:selection?selectionReservedNames:exceptions?exceptionReservedNames:conversion?conversionReservedNames:control?controlReservedNames:reservedNames;
 const members=control||p?.schema===MEMBER_SCHEMA;
 const versioned=members||p?.schema===SERVICE_SCHEMA,objects=versioned||p?.schema===OBJECT_SCHEMA,modern=objects||p?.schema===PROCEDURE_SCHEMA;
 const statementGrammar=collections?collectionStatements:selection?selectionStatements:exceptions?exceptionStatements:control?controlStatements:members?memberStatements:versioned?serviceStatements:objects?objectStatements:modern?procedureStatements:statements,expressionGrammar=collections?collectionExpressions:operations?operationExpressions:contracts?contractExpressions:numeric?numericExpressions:selection?selectionExpressions:conversion?conversionExpressions:control?controlExpressions:members?memberExpressions:versioned?serviceExpressions:objects?objectExpressions:modern?procedureExpressions:expressions;
 ensure(p&&[SCHEMA,PROCEDURE_SCHEMA,OBJECT_SCHEMA,SERVICE_SCHEMA,MEMBER_SCHEMA,CONTROL_SCHEMA,CONVERSION_SCHEMA,EXCEPTION_SCHEMA,SELECTION_SCHEMA,NUMERIC_SCHEMA,CONTRACT_SCHEMA,OPERATION_SCHEMA,COLLECTION_SCHEMA,STATIC_SCHEMA].includes(p.schema)&&Object.keys(p).every(k=>(modern?['schema','body','procedures',...(staticLinked?['libraries']:[])]:['schema','body']).includes(k)));
 const procedures=modern?p.procedures:{};
 ensure(procedures&&typeof procedures==='object'&&!Array.isArray(procedures));
 const owners=new Map();
 if(staticLinked){
  ensure(Array.isArray(p.libraries)&&p.libraries.length<=64);const ids=new Set();
  for(const lib of p.libraries){shape(lib,['id','version','alias','methods']);ensure(!Object.hasOwn(lib,'op')&&typeof lib.id==='string'&&/^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(lib.id)&&!ids.has(lib.id));ids.add(lib.id);
   ensure(typeof lib.version==='string'&&/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(lib.version));name(lib.alias);
   ensure(lib.methods&&typeof lib.methods==='object'&&!Array.isArray(lib.methods));
   for(const [id,m] of Object.entries(lib.methods)){name(id);shape(m,['name','access','requires']);ensure(!Object.hasOwn(m,'op'));name(m.name);ensure(['public','private'].includes(m.access)&&Array.isArray(m.requires)&&new Set(m.requires).size===m.requires.length&&m.requires.every(x=>typeof x==='string'&&/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(x)));ensure(Object.hasOwn(procedures,id)&&!owners.has(id));owners.set(id,{library:lib.id,...m});}
  }
 }
 const graph=new Map();let current=null;
 const procedureName=n=>{name(n);ensure((members||n===n.toLowerCase())&&(!reserved.includes(n.toUpperCase())||staticLinked&&['CSTR','VAL'].includes(n.toUpperCase())));};
 const procedureCall=(n,kind,d)=>{procedureName(n.name);ensure(Object.hasOwn(procedures,n.name));const owner=owners.get(n.name);ensure(!owner||owner.access==='public'||owners.get(current)?.library===owner.library);const proc=procedures[n.name];ensure(proc.kind===kind&&Array.isArray(n.args)&&n.args.length===proc.params.length);if(current)graph.get(current).add(n.name);n.args.forEach(x=>expr(x,d+1));};
 const service=n=>{ensure(safeKey(n.library)&&safeKey(n.method));if(n.op.startsWith('canonical'))ensure(typeof n.apiVersion==='string'&&/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(n.apiVersion));};
 const expr=(n,d=0)=>{ensure(d<=MAXIMA.expressionDepth,'LIMIT');ensure(n&&Object.hasOwn(expressionGrammar,n.op));shape(n,expressionGrammar[n.op]);
  if(n.op==='typeLiteral')ensure(contractTypes.includes(n.type));
  if(['typeOf','dateTime','typeCheck'].includes(n.op)){if(n.op==='typeCheck')ensure((collections?contractTypes.filter(t=>t!=='Wydgit'):['Scalar','DataType','DateTime']).includes(n.type));expr(n.value,d+1);}
  if(n.op==='numericCheck'){ensure(['Integer','Float'].includes(n.type));expr(n.value,d+1);}
  if(n.op==='numericPredicate'){ensure(['IsInteger','IsSafeInteger'].includes(n.predicate));expr(n.value,d+1);}
  if(n.op==='numeric'||n.op==='xor'){if(n.op==='numeric')ensure(['+','-','*','/','MOD','\\','^'].includes(n.operator)&&['Integer','Float','Auto'].includes(n.type));expr(n.left,d+1);expr(n.right,d+1);}
  if(n.op==='identity'){ensure(typeof n.negate==='boolean');expr(n.left,d+1);expr(n.right,d+1);}
  if(n.op==='convert'){ensure(n.mode===undefined?['String','Number'].includes(n.type):operations&&n.mode==='canonical'&&conversionTargets.includes(n.type));expr(n.value,d+1);}
  if(n.op==='operation'){const signatures=collections?collectionSignatures:operationSignatures;ensure(Object.hasOwn(signatures,n.name)&&Array.isArray(n.args)&&n.args.length===signatures[n.name].length);n.args.forEach(x=>expr(x,d+1));}
  if(n.op==='index'){expr(n.target,d+1);expr(n.index,d+1);}
  if(n.op==='isNull'){ensure(typeof n.negate==='boolean');expr(n.value,d+1);}
  if(n.op==='array'){ensure(Array.isArray(n.items));n.items.forEach(x=>expr(x,d+1));}if(n.op==='object'){ensure(n.fields&&typeof n.fields==='object'&&!Array.isArray(n.fields));Object.values(n.fields).forEach(x=>expr(x,d+1));}
  if(n.op==='construct'){ensure(typeof n.type==='string'&&/^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(n.type));expr(n.id,d+1);}
  if(n.op==='memberRead'){ensure(safeKey(n.name)&&typeof n.exact==='boolean');expr(n.target,d+1);}
  if(n.op==='methodValue'){if(n.exact!==undefined)ensure(typeof n.exact==='boolean');procedureName(n.name);expr(n.target,d+1);ensure(Array.isArray(n.args)&&n.args.length<=MAXIMA.parameters);n.args.forEach(x=>expr(x,d+1));}
  if(n.op==='functionCall')procedureCall(n,'function',d);if(n.op==='serviceCall'||n.op==='canonicalServiceCall'){service(n);expr(n.input,d+1);}
  if(n.op==='variable')name(n.name);if(n.op==='context')ensure(contextNames.includes(n.name)&&!(owners.has(current)&&n.name==='ME'));
  if(n.op==='read'){ensure(safeKey(n.key)||Number.isSafeInteger(n.key)&&n.key>=0);expr(n.target,d+1);}
  if(n.op==='invoke'){ensure(safeKey(n.method));expr(n.target,d+1);ensure(Array.isArray(n.args));n.args.forEach(x=>expr(x,d+1));}
  if(n.op==='binary'){ensure(operators.includes(n.operator));expr(n.left,d+1);expr(n.right,d+1);}if(n.op==='not')expr(n.value,d+1);
 };
 const body=(b,d=0,loops=0)=>{ensure(d<=MAXIMA.nesting,'LIMIT');ensure(Array.isArray(b));for(const n of b){ensure(n&&Object.hasOwn(statementGrammar,n.op));shape(n,statementGrammar[n.op]);
  if(['declare','constant','set','forEach','forNumeric'].includes(n.op))name(n.name);if(Object.hasOwn(n,'into'))name(n.into);
  if(n.op==='constant'){ensure(constantTypes.includes(n.type));expr(n.value);}
  if(n.op==='forNumeric'){expr(n.start);expr(n.end);expr(n.step);body(n.body,d+1,loops+1);}
  if(n.op==='memberSet'){ensure(safeKey(n.name)&&typeof n.exact==='boolean');expr(n.target);expr(n.value);}
  if(n.op==='methodCall'){if(n.exact!==undefined)ensure(typeof n.exact==='boolean');procedureName(n.name);expr(n.target);ensure(Array.isArray(n.args)&&n.args.length<=MAXIMA.parameters);n.args.forEach(x=>expr(x));}
  if(n.op==='procedureCall')procedureCall(n,'sub',0);
  if(n.op==='return'){ensure(current?procedures[current].kind==='sub'?!Object.hasOwn(n,'value'):Object.hasOwn(n,'value'):Object.hasOwn(n,'value'));}
  if(n.op==='select'){expr(n.value);ensure(Array.isArray(n.cases)&&(n.cases.length>0||Object.hasOwn(n,'else')));for(const branch of n.cases){shape(branch,['tests','body']);ensure(!Object.hasOwn(branch,'op')&&Array.isArray(branch.tests)&&branch.tests.length>0);for(const test of branch.tests){shape(test,['operator','value']);ensure(!Object.hasOwn(test,'op')&&['=','!=','<','<=','>','>=','IS','IS NOT'].includes(test.operator));expr(test.value);}body(branch.body,d+1,loops);}if(Object.hasOwn(n,'else'))body(n.else,d+1,loops);}
  if(n.op==='try'){ensure(Object.hasOwn(n,'catch')||Object.hasOwn(n,'finally'));body(n.body,d+1,loops);if(Object.hasOwn(n,'catch')){shape(n.catch,['name','body']);ensure(!Object.hasOwn(n.catch,'op'));name(n.catch.name);ensure(!reserved.includes(n.catch.name.toUpperCase()));body(n.catch.body,d+1,loops);}if(Object.hasOwn(n,'finally'))body(n.finally,d+1,loops);}
  if(n.op==='exitFor')ensure(loops>0);
  if(n.op==='stop')ensure(!current);
  if(['declare','set'].includes(n.op)||n.op==='return'&&Object.hasOwn(n,'value')||n.op==='stop'&&Object.hasOwn(n,'value'))expr(n.value);
  if(n.op==='if'){expr(n.condition);body(n.then,d+1,loops);if(n.else!==undefined)body(n.else,d+1,loops);}
  if(n.op==='forEach'){expr(n.items);body(n.body,d+1,loops+1);}
  if(n.op==='call'){expr(n.target);ensure(safeKey(n.method)&&Array.isArray(n.args));n.args.forEach(x=>expr(x));}
  if(n.op==='service'||n.op==='canonicalService'){service(n);expr(n.input);}
 }};
 for(const [id,proc] of Object.entries(procedures)){
  procedureName(id);shape(proc,proc?.kind==='function'?['kind','params','returns','body']:['kind','params','body']);ensure(!Object.hasOwn(proc,'op'));
  ensure(['function','sub'].includes(proc.kind)&&Array.isArray(proc.params));ensure(proc.params.length<=MAXIMA.parameters,'LIMIT');
  if(proc.kind==='function')ensure(types.includes(proc.returns));
  const names=new Set();for(const param of proc.params){shape(param,['name','type']);ensure(!Object.hasOwn(param,'op'));name(param.name);ensure(!reserved.includes(param.name.toUpperCase())&&!names.has(param.name)&&types.includes(param.type));names.add(param.name);}
  graph.set(id,new Set());
 }
 for(const [id,proc] of Object.entries(procedures)){current=id;body(proc.body);}current=null;body(p.body);
 const visited=new Set(),active=new Set();
 const visit=id=>{ensure(!active.has(id));if(visited.has(id))return;active.add(id);for(const next of graph.get(id))visit(next);active.delete(id);visited.add(id);};
 if(!staticLinked)for(const id of graph.keys())visit(id);
 return freeze(p);
}
