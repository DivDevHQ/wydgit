import { construction } from '../object-model/construction.js';
import {clean,freeze,WydgitError} from '../object-model/validation.js';
import {checkContext} from '../seam/context.js';
import {MAXIMA,safeKey} from './schema.js';
import {validate,ensure,fail} from './validate.js';
import {reads,methods} from './bindings.js';
export async function execute(document,{scope,context,prototypeRegistry}) {
 checkContext(context);const program=validate(document),bounds={...MAXIMA};
 for(const key of Object.keys(bounds))bounds[key]=Math.min(bounds[key],context.limits[`sewn${key[0].toUpperCase()+key.slice(1)}`]??bounds[key]);
 let active=true,steps=0,iterations=0,services=0,procedureCalls=0,procedureDepth=0,liveVariables=0;const deadline=Date.now()+bounds.timeMs,refs=new WeakMap();let vars=new Map(),bodyDepth=0,receiver=null,frameProgram=program;const activeCalls=new Set();
 const tick=()=>ensure(active&&Date.now()<deadline&&++steps<=bounds.steps,'LIMIT');
 const builders=construction(prototypeRegistry,context,bounds,tick);
 const ref=(value,kind)=>{const token=Object.freeze(Object.create(null));refs.set(token,{value,kind});return token;};
 const data=value=>{let result;try{result=clean(value);}catch{fail('TYPE');}let count=0;const walk=(v,d=0)=>{ensure(d<=bounds.expressionDepth&&++count<=bounds.valueNodes,'LIMIT');if(typeof v==='string')ensure(v.length<=bounds.string,'LIMIT');if(v&&typeof v==='object')Object.values(v).forEach(x=>walk(x,d+1));};walk(result);return freeze(result);};
 const safe=value=>refs.has(value)?value:Array.isArray(value)?(ensure(value.length<=bounds.valueNodes,'LIMIT'),Object.freeze(value.map(safe))):data(value);
 const store=(n,v,declare=false)=>{ensure(declare?!vars.has(n):vars.has(n),'TYPE');if(declare){ensure(liveVariables<bounds.variables,'LIMIT');liveVariables++;}vars.set(n,safe(v));};
 const json=v=>{const visit=x=>{ensure(!refs.has(x),'TYPE');if(x&&typeof x==='object')Object.values(x).forEach(visit);};visit(v);return data(v);};
 const member=(target,key)=>{ensure(safeKey(key)||Number.isSafeInteger(key)&&key>=0,'DENIED');const r=refs.get(target);if(r){if(r.kind==='handle'&&builders.has(r.value))builders.check(r.value);ensure(reads[r.kind]?.includes(key),'DENIED');const v=r.value[key];if(key==='Source'||key==='Target')return ref(v,'handle');if(['Query','Form'].includes(key))return ref(v,'map');if(key==='Cookies')return ref(v,r.kind==='RESPONSE'?'cookieWrite':'cookieRead');if(key==='Headers')return ref(v,'headers');return data(v);}
  ensure(target!==null&&typeof target==='object','TYPE');if(Array.isArray(target))ensure(Number.isSafeInteger(key)&&key>=0&&key<target.length,'TYPE');else ensure(Object.hasOwn(target,key),'TYPE');return safe(target[key]);};
 const call=async(target,method,args)=>{tick();const r=refs.get(target),rule=r&&methods[r.kind]?.[method];ensure(rule&&args.length>=rule[0]&&args.length<=rule[1],'DENIED');
  const draftIndex=r.kind==='handle'?(method==='Insert'?2:method==='Replace'?0:-1):-1;const draft=draftIndex>=0&&refs.get(args[draftIndex]);
  const actual=args.map((v,i)=>{if(r.kind==='handle'&&method==='Move'&&i===0||r.kind==='EVENT'&&method==='Raise'&&i===1){const h=refs.get(v);ensure(h?.kind==='handle','TYPE');return h.value;}if(i===draftIndex&&draft?.kind==='handle'&&builders.has(draft.value))return builders.has(r.value)?draft.value:builders.envelope(draft.value);return json(v);});
  if(r.kind==='handle'&&['Insert','Replace'].includes(method)&&!builders.has(r.value)&&!(draft?.kind==='handle'&&builders.has(draft.value))){
   const envelope=x=>{ensure(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>['id','type','properties','slots'].includes(k))&&typeof x.id==='string'&&typeof x.type==='string','TYPE');const slots=Object.create(null);for(const [k,children] of Object.entries(x.slots??{})){ensure(Array.isArray(children),'TYPE');slots[k]=children.map(envelope);}return {schema:'wydgit/0.2',id:x.id,prototype:x.type,properties:x.properties??{},slots,provenance:{}};};
   const i=method==='Insert'?2:0;actual[i]=envelope(actual[i]);
  }
  ensure(typeof r.value[method]==='function','DENIED');const value=await r.value[method](...actual);if(draft?.kind==='handle'&&builders.has(draft.value)&&!builders.has(r.value))builders.consume(draft.value);tick();if(method==='related'){if(Array.isArray(value))ensure(value.length<=bounds.valueNodes,'LIMIT');return Array.isArray(value)?Object.freeze(value.map(v=>ref(v,'handle'))):value===null?null:ref(value,'handle');}return value===undefined?null:data(value);
 };
 // All frames share this execution's tokens, authority, deadline and counters.
 const typed=(v,type)=>{const r=refs.get(v);if(type==='Wydgit'){ensure(v===null||r?.kind==='handle','TYPE');return safe(v);}ensure(!r,'TYPE');const result=json(v),actual=result===null?'Null':Array.isArray(result)?'Array':({string:'String',number:'Number',boolean:'Boolean',object:'Object'})[typeof result];ensure(actual===type,'TYPE');return result;};
 const service=async(n,evaluate=expr)=>{ensure(++services<=bounds.serviceCalls,'LIMIT');const input=json(await evaluate(n.input));tick();const v=await scope.SERVICES.Call(n.library,n.method,input);tick();return v;};
 const procedure=async(n,kind,evaluate=expr,calleeProgram=frameProgram,calleeReceiver=receiver)=>{
  tick();ensure(++procedureCalls<=bounds.procedureCalls&&procedureDepth<bounds.procedureDepth,'LIMIT');
  const proc=calleeProgram.procedures?.[n.name];ensure(proc?.kind===kind&&n.args.length===proc.params.length,'TYPE');ensure(proc.params.length<=bounds.parameters,'LIMIT');
  ensure(!activeCalls.has(proc),'LIMIT');
  const args=await argumentsIn(n.args,evaluate);const values=args.map((v,i)=>typed(v,proc.params[i].type));
  activeCalls.add(proc);
  const caller=vars,previousProgram=frameProgram,previousReceiver=receiver;vars=new Map();frameProgram=calleeProgram;receiver=calleeReceiver;procedureDepth++;
  try{for(let i=0;i<values.length;i++)store(proc.params[i].name,values[i],true);
   const result=await body(proc.body,bodyDepth);
   if(kind==='sub'){ensure(!result||result.status==='returned'&&!result.hasValue,'TYPE');return null;}
   ensure(result?.status==='returned'&&result.hasValue,'TYPE');return typed(result.value,proc.returns);
  }finally{liveVariables-=vars.size;vars=caller;procedureDepth--;frameProgram=previousProgram;receiver=previousReceiver;activeCalls.delete(proc);}
 };
 const method=async(n,kind,evaluate=expr)=>{
  const target=await evaluate(n.target),r=refs.get(target);ensure(r?.kind==='handle'&&prototypeRegistry,'DENIED');if(builders.has(r.value))builders.check(r.value);
  const resolved=prototypeRegistry.method(r.value.prototype,n.name);
  // The shared frame routine evaluates arguments under the caller's Me/table.
  return procedure(n,kind,evaluate,resolved.behavior,target);
 };
 const boolean=v=>{ensure(typeof v==='boolean','TYPE');return v;};
 const expr=async(n,d=0)=>{tick();ensure(d<=bounds.expressionDepth,'LIMIT');const e=x=>expr(x,d+1);
  switch(n.op){case 'construct':return ref(builders.create(n.type,json(await e(n.id))),'handle');case 'methodValue':return method(n,'function',e);case 'functionCall':return procedure(n,'function',e);case 'serviceCall':return data(await service(n,e));case 'array':return data((await argumentsIn(n.items,e)).map(json));case 'object':{const out=Object.create(null);for(const [k,v] of Object.entries(n.fields))out[k]=json(await e(v));return data(out);}case 'literal':return data(n.value);case 'variable':ensure(vars.has(n.name),'TYPE');return vars.get(n.name);case 'context':{if(n.name==='ME'&&receiver)return receiver;const v=scope[n.name];return n.name==='SESSION'?data(v):ref(v,['ME','PAGE'].includes(n.name)?'handle':n.name);}case 'read':return member(await e(n.target),n.key);case 'invoke':return call(await e(n.target),n.method,await argumentsIn(n.args,e));case 'not':return !boolean(await e(n.value));case 'binary':{const a=await e(n.left),op=n.operator;if(op==='AND')return boolean(a)&&boolean(await e(n.right));if(op==='OR')return boolean(a)||boolean(await e(n.right));const b=await e(n.right);ensure(!refs.has(a)&&!refs.has(b),'TYPE');if(op==='='||op==='!='){ensure(a===null||['string','number','boolean'].includes(typeof a),'TYPE');ensure(b===null||['string','number','boolean'].includes(typeof b),'TYPE');return op==='='?a===b:a!==b;}if(['<','<=','>','>='].includes(op)){ensure(typeof a===typeof b&&['string','number'].includes(typeof a),'TYPE');return op==='<'?a<b:op==='<='?a<=b:op==='>'?a>b:a>=b;}if(op==='concat'){ensure(typeof a==='string'&&typeof b==='string','TYPE');return data(a+b);}ensure(typeof a==='number'&&typeof b==='number','TYPE');const v=op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:a/b;ensure(Number.isFinite(v),'TYPE');return v;}}
 };
 const argumentsIn=async(args,e)=>{const values=[];for(const x of args)values.push(await e(x));return values;};
 const body=async(nodes,depth=0)=>{ensure(depth<=bounds.nesting,'LIMIT');const previousDepth=bodyDepth;bodyDepth=depth;try{for(const n of nodes){tick();switch(n.op){case 'declare':case 'set':store(n.name,await expr(n.value),n.op==='declare');break;case 'if':{const s=await body(boolean(await expr(n.condition))?n.then:n.else??[],depth+1);if(s)return s;break;}case 'forEach':{const items=await expr(n.items);ensure(Array.isArray(items)&&!vars.has(n.name),'TYPE');ensure(liveVariables<bounds.variables,'LIMIT');liveVariables++;try{for(const item of items){tick();ensure(++iterations<=bounds.iterations,'LIMIT');vars.set(n.name,safe(item));const s=await body(n.body,depth+1);if(s)return s;}}finally{vars.delete(n.name);liveVariables--;}break;}case 'call':{const v=await call(await expr(n.target),n.method,await argumentsIn(n.args,expr));if(n.into)store(n.into,v,true);break;}case 'service':{const v=await service(n);if(n.into)store(n.into,data(v),true);break;}case 'methodCall':await method(n,'sub');break;case 'procedureCall':await procedure(n,'sub');break;case 'return':{const hasValue=Object.hasOwn(n,'value'),value=hasValue?await expr(n.value):null;return procedureDepth?{status:'returned',value,hasValue}:{status:'returned',value:json(value)};}case 'stop':return {status:'stopped',value:n.value===undefined?null:json(await expr(n.value))};}}return null;}finally{bodyDepth=previousDepth;}};
 let timer;try{return freeze(await Promise.race([body(program.body).then(v=>v??{status:'completed',value:null}),new Promise((_,reject)=>{timer=setTimeout(()=>{active=false;reject(new WydgitError('SEWN.LIMIT','SEWN execution failed'));},bounds.timeMs);})]));}catch(error){throw new WydgitError(error instanceof WydgitError?error.code:'SEWN.EXECUTION_FAILED','SEWN execution failed');}finally{active=false;builders.close();clearTimeout(timer);}
}
