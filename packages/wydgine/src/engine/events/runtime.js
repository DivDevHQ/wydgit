import { sensitive } from '../object-model/forms.js';
import { validate as validateWorkflow } from '../sewn/validate.js';
import { execute as executeWorkflow } from '../sewn/execute.js';
import { freeze, requireThat as check, WydgitError } from '../object-model/validation.js';
import { checkContext } from '../seam/context.js';
import {createExecutionBudget,executionBudget} from '../sewn/budget.js';
export const fail = (code='EVENT.INVALID') => { throw new WydgitError(code,'Event operation failed'); };
export const safeError = error => new WydgitError(error instanceof WydgitError ? error.code : 'EVENT.HANDLER_FAILED','Execution failed');
export { EventRegistry } from './registry.js';
import { EventRegistry } from './registry.js';
export function handler(fn) {
  // Trusted JS bridge only; portable source uses the separate SEWN compiler.
  const source=typeof fn==='function'?Function.prototype.toString.call(fn):'';
  check(/^(?:async\s+)?(?:function(?:\s+[\w$]+)?\s*)?\(\s*\)/.test(source)&&fn.length===0,'EVENT.INVALID','Handlers must declare no parameters');return fn;
}
export function createDispatcher({registry=new EventRegistry(),handlers=[],context,handle,contexts=()=>({}),exists=()=>true,defaults={},limit={},completed=()=>false,runtimeTarget='server',identifiers={},reusable=false,canRaise=exists,prototypeRegistry,budget,executor=executeWorkflow,dynamicHandlers=()=>[]}) {
  checkContext(context);
  const records=handlers.map(prepareRuntimeHandler).map((r)=>{const d=registry.get(r.type);check(['Semantic','Custom'].includes(d.family)||r.source===undefined||r.source===r.owner,'EVENT.INVALID','Lifecycle handler owner must be recipient');check(typeof r.owner==='string','EVENT.INVALID','Missing owner');return r;});
  const bounds={queue:64,dispatches:256,handlers:2048,depth:16,timeMs:5000,...limit};
  for(const key of Object.keys(bounds)){const grant=context.limits[`event${key[0].toUpperCase()+key.slice(1)}`];if(grant!==undefined)bounds[key]=Math.min(bounds[key],grant);check(Number.isSafeInteger(bounds[key])&&bounds[key]>0,'EVENT.LIMIT','Invalid limit');}
  let deadline=Date.now()+bounds.timeMs;const sharedBudget=budget;budget??=createExecutionBudget(context,{deadline,guard:()=>check(!closed,'EVENT.INVALID','Closed dispatch')});
  let calls=0,count=0,closed=false,processing=false,currentDepth=0,chainBase=-1;const queue=[];
  const enqueue=task=>{check(processing&&!closed&&queue.length<bounds.queue,'EVENT.LIMIT','No active bounded event chain');executionBudget(budget,context).take('eventRaises');queue.push({...task,payload:registry.payload(task.type,task.payload??{}),depth:currentDepth+1});};
  const deliver=async task=>{
    executionBudget(budget,context).take('eventDispatches');check(Date.now()<deadline&&!closed&&++count<=bounds.dispatches&&task.depth<=Math.min(bounds.depth,executionBudget(budget,context).bounds.eventDepth),'EVENT.LIMIT','Dispatch limit');
    currentDepth=task.depth;const definition=registry.get(task.type);let payload=registry.payload(task.type,task.payload??{});
    // Change is a generic observation contract, not an exact member access.
    // Its returned envelope must be as safe as its handler-facing payload.
    if(task.type==='Change'&&prototypeRegistry){
      const target=handle(task.target,()=>{}),rule=prototypeRegistry.get(target.prototype).properties.value;
      if(!rule||(rule.access??'public')!=='public'||rule.hidden===true||rule.requires?.length||sensitive(target.prototype,prototypeRegistry))payload=freeze({OldValue:'',NewValue:''});
    }
    const envelope=freeze({schema:'wydgit.event/0.1',type:task.type,runtime:runtimeTarget,app:context.app,session:identifiers.session??null,page:identifiers.page??null,source:task.source,target:task.target,payload,cancelable:definition.cancelable});
    const structural=!['Semantic','Custom'].includes(definition.family);
    check(exists(task.target)&&exists(task.source),'EVENT.INVALID','Stale event target');
    let cancelled=false,handled=false;
    for(const record of [...records,...dynamicHandlers({budget,enqueue}).map(prepareRuntimeHandler)].filter(r=>r.type===task.type&&(r.source??r.owner)===task.target)) {
      if(!exists(task.source))break;if(!exists(record.owner))continue;
      executionBudget(budget,context).take('eventHandlers');check(++calls<=bounds.handlers,'EVENT.LIMIT','Handler limit');
      if(record.capability)context.require(record.capability);
      let active=true;const guard=()=>check(active&&!closed,'EVENT.INVALID','Stale invocation');
      const event={Type:task.type,Source:handle(task.source,guard),Target:handle(task.target,guard),Payload:payload,Cancelable:definition.cancelable,
        get Cancelled(){guard();return cancelled;},get Handled(){guard();return handled;},set Handled(value){guard();check(typeof value==='boolean','EVENT.INVALID','Handled must be boolean');handled=value;},
        Cancel(){guard();check(definition.cancelable,'EVENT.INVALID','Event cannot cancel');cancelled=true;},
        Raise(type,source,payload={}) {
          guard();check(typeof type==='string'&&!type.includes('#'),'EVENT.DENIED','Class events require authenticated declaration dispatch');context.require('event.custom.raise');check(context.scopes.events?.includes(type),'EVENT.DENIED','Event scope denied');
          check(registry.get(type).family==='Custom','EVENT.DENIED','Only custom events may be raised');
          // Handles belong to this execution and must remain visible.
          const id=source.id;check(canRaise(id),'EVENT.INVALID','Target is not initialized');check(handle(id,guard).id===id&&source===handle(id,guard),'EVENT.DENIED','Expected scoped handle');
          executionBudget(budget,context).take('eventRaises');check(queue.length<bounds.queue,'EVENT.LIMIT','Event queue limit');queue.push({type,source:id,target:id,payload:registry.payload(type,payload),depth:task.depth+1});
        }};
      if(task.type==='Change')Object.defineProperties(event,{OldValue:{get(){guard();return payload.OldValue;}},NewValue:{get(){guard();return payload.NewValue;}}});
      const provided={ME:handle(record.owner,guard),EVENT:Object.freeze(event),...contexts(guard,task)};
      const scope=new Proxy(Object.freeze(provided),{get(target,key){guard();check(Object.hasOwn(target,key),'EVENT.CONTEXT','Context unavailable');return target[key];}});
      let timer;
      try {await Promise.race([Promise.resolve().then(()=>record.workflow?executor(record.workflow,{scope,context,prototypeRegistry,budget,enqueue}):record.run.call(scope)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new WydgitError('EVENT.LIMIT','Handler time limit')),Math.max(1,deadline-Date.now()));})]);}
      catch(error){throw safeError(error);}finally{active=false;clearTimeout(timer);}
      if(completed()||!structural&&(cancelled||handled))break;
    }
    if(!completed()&&!cancelled&&task.valid!==false&&Object.hasOwn(defaults,task.type)&&defaults[task.type])await defaults[task.type](task,payload,context);
    return freeze({cancelled,handled,envelope:{...envelope,cancelled,handled}});
  };
  const invoke=async task=>{const restore=executionBudget(budget,context).enterEvent(chainBase+task.depth+1);try{return await deliver(task);}finally{restore();}};
  return Object.freeze({
    enqueue,
    async dispatch(task) {
      check(!processing&&!closed,'EVENT.INVALID','Recursive dispatch denied');if(reusable){deadline=Date.now()+bounds.timeMs;calls=0;count=0;if(!sharedBudget){executionBudget(budget,context).close();budget=createExecutionBudget(context,{deadline,guard:()=>check(!closed,'EVENT.INVALID','Closed dispatch')});}}chainBase=executionBudget(budget,context).eventDepth();processing=true;
      try {const result=await invoke({...task,depth:0});while(queue.length)await invoke(queue.shift());return result;}
      catch(error){queue.length=0;throw safeError(error);}finally{processing=false;}
    },close(){closed=true;queue.length=0;if(!sharedBudget)executionBudget(budget,context).close();}
  });
}

function prepareRuntimeHandler(record) {
  check(record.wydBasic===undefined&&record.wydBasicModule===undefined,'EVENT.INVALID','Client/runtime handlers require compiled SEWN');
  check(['run','workflow'].filter(key=>record[key]!==undefined).length===1,'EVENT.INVALID','Choose one handler implementation');
  return record.workflow!==undefined?{...record,workflow:validateWorkflow(record.workflow)}:{...record,run:handler(record.run)};
}
