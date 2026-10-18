// Bounded trusted timing only. No identity, input, handle or context is retained.
import { performance } from 'node:perf_hooks';
export function createPageDiagnostics() {
  const started=performance.now(),phases=Object.create(null),spans=Object.create(null);
  let phase='prepare',phaseStarted=started,budgetStarted=started,failed=null;
  const elapsed=value=>Math.max(0,performance.now()-value);
  const add=(map,key,ms)=>{const entry=map[key]??={calls:0,elapsedMs:0};entry.calls++;entry.elapsedMs+=ms;map[key]=entry;};
  return Object.freeze({
    budgetStarted(){budgetStarted=performance.now();},
    phase(name){add(phases,phase,elapsed(phaseStarted));phase=name;phaseStarted=performance.now();},
    failure(){failed??=phase;},
    async measure(name,operation){const since=performance.now();try{return await operation();}finally{add(spans,name,elapsed(since));}},
    finish(meter){
      add(phases,phase,elapsed(phaseStarted));phaseStarted=performance.now();
      const snapshot=map=>Object.freeze(Object.fromEntries(Object.entries(map).map(([k,v])=>[k,Object.freeze({calls:v.calls,elapsedMs:Math.round(v.elapsedMs*1000)/1000})])));
      return Object.freeze({...meter,diagnostics:Object.freeze({schema:'wydgit.page-diagnostics/1',execution:'page',accountingPath:Object.freeze(['page','events','components','workflow','services']),phaseAtFailure:failed,preparationMs:Math.max(0,budgetStarted-started),phases:snapshot(phases),spans:snapshot(spans)})});
    }
  });
}
