// Test-only: importing this module installs no hook. Never imported by runtime code.
import {createHook, executionAsyncId} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';

export function createFsreqpromiseProbe({enabled=false,maxCalls=64,maxResources=128}={}) {
  if(!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>1024||!Number.isInteger(maxResources)||maxResources<1||maxResources>2048)
    throw new RangeError('Invalid probe bounds');
  const calls=[],resources=new Map();
  let active=null,stopped=false,seen=0,droppedCalls=0,droppedResources=0,hookErrors=0;
  const now=()=>performance.now();
  // Hook callbacks never escape exceptions, log, schedule work, or retain resource objects.
  const safe=work=>(...args)=>{try{work(...args);}catch{hookErrors++;stop();}};
  const hook=enabled?createHook({
    init:safe((id,type,trigger)=>{
      if(type!=='FSREQPROMISE'||!active)return;
      active.candidates++;
      if(seen>=maxResources){droppedResources++;active.overflow=true;return;}
      seen++;
      const row={id,type,trigger,initMs:now(),beforeCount:0,afterCount:0,firstBeforeMs:null,lastAfterMs:null,destroyMs:null};
      active.resources.push(row);resources.set(id,row);
    }),
    before:safe(id=>{const row=resources.get(id);if(row){row.beforeCount++;row.firstBeforeMs??=now();}}),
    after:safe(id=>{const row=resources.get(id);if(row){row.afterCount++;row.lastAfterMs=now();}}),
    destroy:safe(id=>{const row=resources.get(id);if(row){row.destroyMs=now();resources.delete(id);}})
  }):null;
  const allocate=(mode,request=null,operation=null)=>{
    if(!enabled||stopped)return undefined;
    if(calls.length>=maxCalls){droppedCalls++;return undefined;}
    const row={call:calls.length+1,mode,request,operation,executionId:null,invocationMs:null,invokedMs:null,recoveryMs:null,producerMs:null,resumeMs:null,validatedMs:null,candidates:0,overflow:false,resources:[]};
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
    observe({request,operation}){
      if(!Number.isInteger(request)||request<0||request>12||!Number.isInteger(operation)||operation<1||operation>64)
        throw new RangeError('Invalid fixture identity');
      const row=allocate('lifecycle',request,operation);
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
    stop,
    snapshot(){return {enabled,stopped,seen,droppedCalls,droppedResources,hookErrors,tracked:resources.size,calls:calls.map(row=>{
      const resource=row.resources[0];
      const unique=!row.overflow&&row.candidates===1&&row.invocationMs!==null&&resource.trigger===row.executionId&&resource.initMs>=row.invocationMs;
      const correlation=row.mode==='isolated'?(unique?'isolated-single-resource':'ambiguous'):
        hookErrors||row.overflow||row.candidates>1?'ambiguous':
        !unique||row.invokedMs===null||resource.initMs>row.invokedMs||resource.beforeCount!==1||resource.afterCount!==1||row.recoveryMs===null||row.recoveryMs<resource.lastAfterMs?'missing':'lifecycle-single-resource';
      return {...row,resources:row.resources.map(resource=>({...resource})),correlation};
    })};}
  });
}
