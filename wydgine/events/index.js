import { clean, freeze, record, requireThat as check, WydgitError } from '../object-model/validation.js';
import { checkContext } from '../seam/context.js';
export const fail = (code='EVENT.INVALID') => { throw new WydgitError(code,'Event operation failed'); };
export const safeError = error => new WydgitError(error instanceof WydgitError ? error.code : 'EVENT.HANDLER_FAILED','Execution failed');
const types=['string','number','boolean','object','array','null','json'];
export class EventRegistry {
  #events=new Map();
  constructor() {
    for(const [family,names] of Object.entries({Server:['Start','Stop'],Session:['Start','Authenticated','Logout','Timeout','End'],Page:['Start','Initialize','Load','Validate','PreRender','Unload'],Client:['Mount','Ready','Unmount']}))
      for(const name of names)this.define(`${family}.${name}`,{family,fields:{},cancelable:false});
    this.define('Activate',{family:'Semantic',cancelable:true,fields:{Command:{type:'string',optional:true}}});
    this.define('Change',{family:'Semantic',cancelable:true,fields:{OldValue:{type:'json'},NewValue:{type:'json'}}});
    this.define('Submit',{family:'Semantic',cancelable:true,fields:{}});
  }
  define(name,input) {
    check(typeof name==='string'&&/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?$/.test(name)&&!this.#events.has(name),'EVENT.INVALID','Invalid event definition');
    const d=clean(input);check(record(d)&&Object.keys(d).every(k=>['family','cancelable','fields'].includes(k))&&['Server','Session','Page','Client','Semantic','Custom'].includes(d.family)&&typeof d.cancelable==='boolean'&&record(d.fields),'EVENT.INVALID','Invalid event schema');
    for(const rule of Object.values(d.fields))check(record(rule)&&Object.keys(rule).every(k=>['type','optional'].includes(k))&&types.includes(rule.type)&&(rule.optional===undefined||typeof rule.optional==='boolean'),'EVENT.INVALID','Invalid payload rule');
    check(['Semantic','Custom'].includes(d.family)||!d.cancelable,'EVENT.INVALID','Lifecycle cannot cancel');
    this.#events.set(name,freeze(d));return this;
  }
  get(name){check(this.#events.has(name),'EVENT.INVALID','Unknown event');return this.#events.get(name);}
  payload(name,input) {
    const value=clean(input),d=this.get(name);check(record(value)&&JSON.stringify(value).length<=16384,'EVENT.LIMIT','Payload limit');
    function depth(v,n=0){check(n<=16,'EVENT.LIMIT','Payload depth');if(v&&typeof v==='object')Object.values(v).forEach(x=>depth(x,n+1));}depth(value);
    check(Object.keys(value).every(k=>Object.hasOwn(d.fields,k)),'EVENT.INVALID','Unknown payload field');
    for(const [key,rule] of Object.entries(d.fields)) {
      if(!Object.hasOwn(value,key)){check(rule.optional===true,'EVENT.INVALID','Missing payload field');continue;}
      const v=value[key],type=v===null?'null':Array.isArray(v)?'array':typeof v;
      check(rule.type==='json'||rule.type===type,'EVENT.INVALID','Invalid payload type');
    }
    return freeze(value);
  }
}
export function handler(fn) {
  // Trusted JS bridge only; no source evaluation or WydBASIC/SEWN compiler.
  const source=typeof fn==='function'?Function.prototype.toString.call(fn):'';
  check(/^(?:async\s+)?(?:function(?:\s+[\w$]+)?\s*)?\(\s*\)/.test(source)&&fn.length===0,'EVENT.INVALID','Handlers must declare no parameters');return fn;
}
export function createDispatcher({registry=new EventRegistry(),handlers=[],context,handle,contexts=()=>({}),exists=()=>true,defaults={},limit={},completed=()=>false,runtimeTarget='server',identifiers={},reusable=false,canRaise=exists}) {
  checkContext(context);
  const records=handlers.map((r)=>{const d=registry.get(r.type);check(['Semantic','Custom'].includes(d.family)||r.source===undefined||r.source===r.owner,'EVENT.INVALID','Lifecycle handler owner must be recipient');check(typeof r.owner==='string','EVENT.INVALID','Missing owner');return {...r,run:handler(r.run)};});
  const bounds={queue:64,dispatches:256,handlers:2048,depth:16,timeMs:5000,...limit};
  for(const key of Object.keys(bounds)){const grant=context.limits[`event${key[0].toUpperCase()+key.slice(1)}`];if(grant!==undefined)bounds[key]=Math.min(bounds[key],grant);check(Number.isSafeInteger(bounds[key])&&bounds[key]>0,'EVENT.LIMIT','Invalid limit');}
  let deadline=Date.now()+bounds.timeMs;
  let calls=0,count=0,closed=false,processing=false;const queue=[];
  const invoke=async task=>{
    check(Date.now()<deadline&&!closed&&++count<=bounds.dispatches&&task.depth<=bounds.depth,'EVENT.LIMIT','Dispatch limit');
    const definition=registry.get(task.type),payload=registry.payload(task.type,task.payload??{});
    const envelope=freeze({schema:'wydgit.event/0.1',type:task.type,runtime:runtimeTarget,app:context.app,session:identifiers.session??null,page:identifiers.page??null,source:task.source,target:task.target,payload,cancelable:definition.cancelable});
    const structural=!['Semantic','Custom'].includes(definition.family);
    check(exists(task.target)&&exists(task.source),'EVENT.INVALID','Stale event target');
    let cancelled=false,handled=false;
    for(const record of records.filter(r=>r.type===task.type&&(r.source??r.owner)===task.target)) {
      check(++calls<=bounds.handlers,'EVENT.LIMIT','Handler limit');
      if(record.capability)context.require(record.capability);
      let active=true;const guard=()=>check(active&&!closed,'EVENT.INVALID','Stale invocation');
      const event={Type:task.type,Source:handle(task.source,guard),Target:handle(task.target,guard),Payload:payload,Cancelable:definition.cancelable,
        get Cancelled(){guard();return cancelled;},get Handled(){guard();return handled;},set Handled(value){guard();check(typeof value==='boolean','EVENT.INVALID','Handled must be boolean');handled=value;},
        Cancel(){guard();check(definition.cancelable,'EVENT.INVALID','Event cannot cancel');cancelled=true;},
        Raise(type,source,payload={}) {
          guard();context.require('event.custom.raise');check(context.scopes.events?.includes(type),'EVENT.DENIED','Event scope denied');
          check(registry.get(type).family==='Custom','EVENT.DENIED','Only custom events may be raised');
          // Handles belong to this execution and must remain visible.
          const id=source.id;check(canRaise(id),'EVENT.INVALID','Target is not initialized');check(handle(id,guard).id===id&&source===handle(id,guard),'EVENT.DENIED','Expected scoped handle');
          check(queue.length<bounds.queue,'EVENT.LIMIT','Event queue limit');queue.push({type,source:id,target:id,payload:registry.payload(type,payload),depth:task.depth+1});
        }};
      if(task.type==='Change')Object.defineProperties(event,{OldValue:{get(){guard();return payload.OldValue;}},NewValue:{get(){guard();return payload.NewValue;}}});
      const provided={ME:handle(record.owner,guard),EVENT:Object.freeze(event),...contexts(guard,task)};
      const scope=new Proxy(Object.freeze(provided),{get(target,key){guard();check(Object.hasOwn(target,key),'EVENT.CONTEXT','Context unavailable');return target[key];}});
      let timer;
      try {await Promise.race([Promise.resolve().then(()=>record.run.call(scope)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new WydgitError('EVENT.LIMIT','Handler time limit')),Math.max(1,deadline-Date.now()));})]);}
      catch(error){throw safeError(error);}finally{active=false;clearTimeout(timer);}
      if(completed()||!structural&&(cancelled||handled))break;
    }
    if(!completed()&&!cancelled&&task.valid!==false&&Object.hasOwn(defaults,task.type)&&defaults[task.type])await defaults[task.type](task,payload,context);
    return freeze({cancelled,handled,envelope:{...envelope,cancelled,handled}});
  };
  return Object.freeze({
    async dispatch(task) {
      check(!processing&&!closed,'EVENT.INVALID','Recursive dispatch denied');if(reusable){deadline=Date.now()+bounds.timeMs;calls=0;count=0;}processing=true;
      try {const result=await invoke({...task,depth:0});while(queue.length)await invoke(queue.shift());return result;}
      catch(error){queue.length=0;throw safeError(error);}finally{processing=false;}
    },close(){closed=true;queue.length=0;}
  });
}
