// Spike L qualification sidecar. Never imported by shipped runtime. No authority.
import {AsyncLocalStorage,createHook} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
const local=new AsyncLocalStorage();
const names=new Set(['dispatch','workEntry','storeEntry','providerEntry','providerComplete','providerSettlement','taskSettlement','nativeContinuation','pageContinuation',...['sqlitePreflight','sqliteLifecycle','sqliteTransaction','jsonQueue','jsonWork'].flatMap(n=>[n+'Start',n+'End'])]);
let promises,tracked,hook;
export function startPromiseObservation(){
  if(hook)throw Error('Promise observer already active');
  promises=new WeakMap();tracked=new Map();
  hook=createHook({init(id,type,trigger,resource){if(type==='PROMISE')promises.set(resource,id);},promiseResolve(id){
    const row=tracked.get(id);if(!row)return;tracked.delete(id);
    row.capture.run(()=>schedulingMark(row.name,row.operation));
  }});hook.enable();
  return ()=>{hook.disable();hook=null;promises=null;tracked=null;};
}
export function schedulingPromise(promise,name){
  const s=local.getStore(),id=promises?.get(promise);
  if(s&&!s.closed&&s.operation&&id!==undefined&&['providerSettlement','taskSettlement'].includes(name)&&tracked.size<1664)
    tracked.set(id,{capture:s.capture,name,operation:s.operation});
  return promise;
}
export function createNativeScheduling({request=0,costs=false,now=()=>performance.now(),maxRows=128,maxSpans=4096}={}){
  if(!Number.isInteger(request)||request<0||request>12||!Number.isInteger(maxRows)||maxRows<1||maxRows>512||!Number.isInteger(maxSpans)||maxSpans<1||maxSpans>4096)throw RangeError('Scheduling bounds');
  const s={request,costs,now,maxRows,maxSpans,operation:0,rows:[],spans:[],dropped:0,droppedSpans:0,closed:false};let result;
  const capture=Object.freeze({run:fn=>local.run(s,fn),finish(){if(result)return result;s.closed=true;
    return result=Object.freeze({schema:'wydgine.native-scheduling/1',request,rows:Object.freeze(s.rows),spans:Object.freeze(s.spans),dropped:s.dropped,droppedSpans:s.droppedSpans});}});
  s.capture=capture;return capture;
}
export function schedulingMark(name,operation){
  const s=local.getStore();if(!s||s.closed||!names.has(name))return;
  if(name==='dispatch'){if(s.operation>=64){s.dropped++;return;}s.operation++;}
  if(!s.operation)return;
  if(s.rows.length>=s.maxRows){s.dropped++;return;}
  s.rows.push(Object.freeze({name,operation:operation??s.operation,atMs:s.now()}));
}
export function schedulingSync(name,fn){
  const s=local.getStore();if(!s||s.closed||!s.costs||name!=='installedStamp')return fn();
  const startMs=s.now();try{return fn();}finally{
    if(s.spans.length<s.maxSpans)s.spans.push(Object.freeze({name,startMs,endMs:s.now()}));else s.droppedSpans++;
  }
}
