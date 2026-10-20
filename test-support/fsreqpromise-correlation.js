// Test-only: importing this module installs no hook. Never imported by runtime code.
import {createHook, executionAsyncId} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';

export function createFsreqpromiseProbe({enabled=false,maxCalls=64,maxResources=128,now=()=>performance.now()}={}) {
  if(!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>1024||!Number.isInteger(maxResources)||maxResources<1||maxResources>2048)
    throw new RangeError('Invalid probe bounds');
  const calls=[],inspections=[],nativeCalls=[],resources=new Map();
  let active=null,stopped=false,seen=0,droppedCalls=0,droppedResources=0,hookErrors=0;
  const increment=value=>Math.min(1000000,value+1);
  // Hook callbacks never escape exceptions, log, schedule work, or retain resource objects.
  const safe=work=>(...args)=>{try{work(...args);}catch{hookErrors=increment(hookErrors);stop();}};
  const hook=enabled?createHook({
    init:safe((id,type,trigger)=>{
      if(type!=='FSREQPROMISE'||!active)return;
      active.candidates=increment(active.candidates);
      if(seen>=maxResources){droppedResources=increment(droppedResources);active.overflow=true;if(active.mode==='inspection')stop();return;}
      seen++;
      const row={id,type,trigger,initMs:now(),beforeCount:0,afterCount:0,firstBeforeMs:null,lastAfterMs:null,destroyMs:null};
      active.resources.push(row);resources.set(id,row);
    }),
    before:safe(id=>{const row=resources.get(id);if(row){row.beforeCount=increment(row.beforeCount);row.firstBeforeMs??=now();}}),
    after:safe(id=>{const row=resources.get(id);if(row){row.afterCount=increment(row.afterCount);row.lastAfterMs=now();}}),
    destroy:safe(id=>{const row=resources.get(id);if(row){row.destroyMs=now();resources.delete(id);}})
  }):null;
  const allocate=(mode,request=null,operation=null)=>{
    if(!enabled||stopped)return undefined;
    if(calls.length>=maxCalls){droppedCalls=increment(droppedCalls);return undefined;}
    const row={call:calls.length+1,mode,request,operation,entryMs:now(),executionId:null,invocationMs:null,invokedMs:null,recoveryMs:null,producerMs:null,resumeMs:null,validatedMs:null,candidates:0,overflow:false,resources:[]};
    calls.push(row);return row;
  };
  const mark=(row,key)=>()=>{if(!stopped)row[key]??=now();};
  const stop=()=>{hook?.disable();resources.clear();active=null;stopped=true;};
  hook?.enable();
  return Object.freeze({
    // The callback must synchronously invoke ONLY the known helper up to its first
    // await. No async wrapper/reaction is inserted. Concurrent pending calls may
    // coexist, but synchronous capture windows must not overlap.
    capture(invoke){
      if(active)throw new Error('Nested capture is not supported');
      const row=allocate('isolated');
      if(!row)return invoke(undefined);
      row.executionId=executionAsyncId();active=row;
      const completion={continuation(name){if(name!=='sqliteLifecycleLstat')return undefined;return {
        start:mark(row,'invocationMs'),recoveryEntry:mark(row,'recoveryMs'),enoent(){},complete:mark(row,'producerMs'),resume:mark(row,'resumeMs'),validated:mark(row,'validatedMs')
      };}};
      try{return invoke(completion);}finally{active=null;}
    },
    // Called once by the trusted native-operation continuation factory. Request
    // and operation are bounded numeric fixture identities, never payload data.
    observe({request,operation,inspection=null,stage=null,ordinal=null}){
      if(!Number.isInteger(request)||request<0||request>12||!Number.isInteger(operation)||operation<1||operation>64)
        throw new RangeError('Invalid fixture identity');
      if(inspection!==null&&(!Number.isInteger(inspection)||inspection<1||inspection>maxCalls||
        !['rootLstat','sqliteFileLstat'].includes(stage)||!Number.isInteger(ordinal)||ordinal<1||ordinal>128))
        throw new RangeError('Invalid filesystem identity');
      const row=allocate(inspection===null?'lifecycle':'inspection',request,operation);
      if(row)Object.assign(row,{inspection,stage,ordinal});
      if(!row)return undefined;
      return Object.freeze({
        start(){
          if(stopped)return;
          if(active){active.overflow=true;row.overflow=true;stop();return;}
          row.executionId=executionAsyncId();row.invocationMs=now();active=row;
        },
        invoked(){if(stopped)return;row.invokedMs??=now();if(active===row)active=null;},
        recoveryEntry:mark(row,'recoveryMs'),enoent(){},complete:mark(row,'producerMs'),
        resume:mark(row,'resumeMs'),validated:mark(row,'validatedMs'),cancel:stop
      });
    },
    native({request,operation}){
      if(!enabled||stopped)return undefined;
      if(!Number.isInteger(request)||request<0||request>12||!Number.isInteger(operation)||operation<1||operation>64)
        throw new RangeError('Invalid fixture identity');
      if(nativeCalls.length>=64){droppedCalls=increment(droppedCalls);stop();return undefined;}
      const row={request,operation,dispatchMs:null,completeMs:null,pageContinuationMs:null,storeEntryMs:null,clearStartMs:null,clearEndMs:null};
      nativeCalls.push(row);
      return Object.freeze(Object.fromEntries(['dispatch','complete','pageContinuation','storeEntry','clearStart','clearEnd'].map(stage=>[stage,mark(row,stage+'Ms')]).concat([['cancel',stop]])));
    },
    inspect({request,operation}){
      if(!enabled||stopped)return undefined;
      if(!Number.isInteger(request)||request<0||request>12||!Number.isInteger(operation)||operation<1||operation>64)
        throw new RangeError('Invalid fixture identity');
      if(inspections.length>=maxCalls){droppedCalls=increment(droppedCalls);stop();return undefined;}
      const row={inspection:inspections.length+1,request,operation,entryMs:now(),startMs:null,awaitingMs:null,
        completeMs:null,resumeMs:null,transactionStartMs:null,transactionEndMs:null,settledMs:null,
        checkpointFirstMs:null,checkpointLastMs:null,checkpointCount:0};
      inspections.push(row);
      return Object.freeze({
        start:mark(row,'startMs'),awaiting:mark(row,'awaitingMs'),complete:mark(row,'completeMs'),resume:mark(row,'resumeMs'),
        transactionStart:mark(row,'transactionStartMs'),transactionEnd:mark(row,'transactionEndMs'),settled:mark(row,'settledMs'),
        checkpoint(){if(stopped)return;const at=now();row.checkpointFirstMs??=at;row.checkpointLastMs=at;row.checkpointCount=Math.min(1000000,row.checkpointCount+1);},
        filesystem:(stage,ordinal)=>{
          if(!['rootLstat','sqliteFileLstat'].includes(stage)||!Number.isInteger(ordinal)||ordinal<1||ordinal>128){stop();return undefined;}
          const observer=this.observe({request,operation,inspection:row.inspection,stage,ordinal});
          if(!observer)stop();
          return observer;
        },cancel:stop
      });
    },
    stop,
    snapshot(){return {enabled,stopped,seen,droppedCalls,droppedResources,hookErrors,tracked:resources.size,nativeCalls:nativeCalls.map(row=>({...row})),inspections:inspections.map(row=>({...row})),calls:calls.map(row=>{
      const resource=row.resources[0];
      const unique=!row.overflow&&row.candidates===1&&row.invocationMs!==null&&resource.trigger===row.executionId&&resource.initMs>=row.invocationMs;
      const continuation=row.mode==='inspection'?row.resumeMs:row.recoveryMs;
      const correlation=row.mode==='isolated'?(unique?'isolated-single-resource':'ambiguous'):
        hookErrors||row.overflow||row.candidates>1?'ambiguous':
        !unique||row.invokedMs===null||resource.initMs>row.invokedMs||resource.beforeCount!==1||resource.afterCount!==1||continuation===null||continuation<resource.lastAfterMs?'missing':row.mode==='inspection'?'inspection-single-resource':'lifecycle-single-resource';
      return {...row,resources:row.resources.map(resource=>({...resource})),correlation};
    })};}
  });
}
