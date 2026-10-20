// Bounded trusted timing only. No identity, input, handle or context is retained.
import { performance } from 'node:perf_hooks';
export function createPageDiagnostics() {
  const started=performance.now(),phases=Object.create(null),spans=Object.create(null);
  let progress=null,services=null;
  let phase='prepare',phaseStarted=started,budgetStarted=started,failed=null;
  const elapsed=value=>Math.max(0,performance.now()-value);
  const add=(map,key,ms)=>{const entry=map[key]??={calls:0,elapsedMs:0};entry.calls++;entry.elapsedMs+=ms;map[key]=entry;};
  const measure=async(name,operation,resume)=>{progress?.checkpoint(services?.snapshot(),name);const since=performance.now();try{return await operation();}finally{resume?.();add(spans,name,elapsed(since));progress?.checkpoint(services?.snapshot(),name);}};
  return Object.freeze({
    budgetStarted(observation,completion){budgetStarted=performance.now();progress=observation;services=completion;},
    phase(name){progress?.phase(name,services?.snapshot());add(phases,phase,elapsed(phaseStarted));phase=name;phaseStarted=performance.now();},
    failure(){failed??=phase;},
    settled(){progress?.checkpoint(services?.snapshot());},
    // Wrap only already trusted native handlers; the dispatcher's own timer race,
    // scope proxy and revocation still own their execution lifetime.
    handlers(records){return progress?records.map(record=>record.run?{...record,run:async function(){return measure('handler',()=>record.run.call(this));}}:record):records;},
    measure,
    finish(meter){
      add(phases,phase,elapsed(phaseStarted));phaseStarted=performance.now();
      const snapshot=map=>Object.freeze(Object.fromEntries(Object.entries(map).map(([k,v])=>[k,Object.freeze({calls:v.calls,elapsedMs:Math.round(v.elapsedMs*1000)/1000})])));
      const nativeStages=services?.timing();
      const continuations=services?.continuations();
      return Object.freeze({...meter,diagnostics:Object.freeze({schema:'wydgit.page-diagnostics/1',execution:'page',accountingPath:Object.freeze(['page','events','components','workflow','services']),phaseAtFailure:failed,preparationMs:Math.max(0,budgetStarted-started),phases:snapshot(phases),spans:snapshot(spans),...(nativeStages?{nativeStages}:{}),...(continuations?{continuations}:{})})});
    }
  });
}
