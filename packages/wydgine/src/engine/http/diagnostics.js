// Trusted local observation only. One fixed-size record, no request data or queue.
import {performance} from 'node:perf_hooks';
import {httpSchedulingSampler} from './scheduling.js';
const safeCode=code=>typeof code==='string'&&/^[A-Z][A-Z0-9_]{0,31}(?:\.[A-Z][A-Z0-9_]{0,31}){1,3}$/.test(code)&&code.length<=64?code:'HTTP.INTERNAL';
export function createHttpDiagnostics(observe,{sampler=httpSchedulingSampler}={}) {
  if(typeof observe!=='function')return null;
  const sampling=sampler.start(),started=performance.now(),loop=performance.eventLoopUtilization();
  let phase='prepare',failure=null,meter=null,admitted=false;
  return Object.freeze({
    phase(value){phase=value;},
    admit(){admitted=true;},
    meter(value){meter=value;},
    failure(error){failure??={phase,code:safeCode(error?.code)};},
    finish(res,result){
      const scheduling=sampling.finish(),utilization=performance.eventLoopUtilization(loop);
      // Process-wide overlapping activity, not per-request CPU or delay attribution.
      const record=Object.freeze({schema:'wydgine.http-diagnostics/1',execution:'page',
        elapsedMs:Math.max(0,performance.now()-started),failure:failure?Object.freeze(failure):null,
        pageAdmitted:admitted,meter,cleanupCode:result?.cleanupErrors[0]?safeCode(result.cleanupErrors[0].code):null,services:result?.services??null,
        operationOutcome:result?.outcome??'unknown',status:res.statusCode,
        headersPublished:Boolean(res.headersSent),responseEnded:Boolean(res.writableEnded),disconnected:Boolean(res.destroyed),
        scheduling,eventLoop:Object.freeze({activeMs:utilization.active,idleMs:utilization.idle})});
      try{observe(record);}catch{/* Observers cannot alter transport results. */}
    }
  });
}
