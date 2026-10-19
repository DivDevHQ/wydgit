// Trusted, process-local observation. One unreferenced timer for all active windows.
import {performance} from 'node:perf_hooks';
export function createSchedulingSampler({now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout,intervalMs=50}={}) {
  const windows=new Set();let timer=null,expected=0,generation=0;
  const record=(window,actual,late)=>{
    if(window.maxLatenessOffsetMs===null||late>window.maxLatenessMs){window.maxLatenessMs=late;window.maxLatenessOffsetMs=Math.max(0,actual-window.started);}
  };
  const arm=()=>{
    expected=now()+intervalMs;const current=++generation;
    timer=schedule(()=>{
      if(current!==generation)return;
      const actual=now(),late=Math.max(0,actual-expected);timer=null;
      for(const window of windows){window.callbacks++;window.lastCallback=actual;record(window,actual,Math.min(late,Math.max(0,actual-window.started)));}
      // No catch-up burst after a late callback.
      if(windows.size)arm();
    },intervalMs);timer.unref?.();
  };
  return Object.freeze({
    start(){
      const window={started:now(),lastCallback:null,callbacks:0,maxLatenessMs:0,maxLatenessOffsetMs:null};let result;
      windows.add(window);if(timer===null)arm();
      return Object.freeze({finish(){
        if(result)return result;
        const ended=now(),pendingLatenessMs=Math.max(0,ended-Math.max(expected,window.started));
        // A final callback may not have had an opportunity to run. Its overdue
        // amount is a lower bound, not a measured callback execution delay.
        windows.delete(window);
        if(!windows.size){cancel(timer);timer=null;generation++;}
        result=Object.freeze({schema:'wydgine.scheduling/1',intervalMs,callbacks:window.callbacks,
          maxLatenessMs:window.maxLatenessMs,maxLatenessOffsetMs:window.maxLatenessOffsetMs,
          durationMs:Math.max(0,ended-window.started),pendingLatenessMs,pendingLatenessOffsetMs:pendingLatenessMs>0?Math.max(0,ended-window.started):null,
          unsampledTailMs:Math.max(0,ended-(window.lastCallback??window.started)),incomplete:true});
        return result;
      }});
    }
  });
}
export const httpSchedulingSampler=createSchedulingSampler();
