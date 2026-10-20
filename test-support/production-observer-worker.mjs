import {performance} from 'node:perf_hooks';
const config=JSON.parse(process.argv[2]);
const initialization=performance.now();
if(config.deadlineLedger||config.spikeKBaseline){
  const {installDeadlineLedgerHooks}=await import('./deadline-ledger-hooks.mjs');
  installDeadlineLedgerHooks({costs:config.deadlineCosts===true,baseline:config.spikeKBaseline===true,observe:config.deadlineLedger===true});
}
if(config.synchronousAttribution){
  const {installAttributionHooks}=await import('./prerender-integrity-hooks.mjs');
  installAttributionHooks({category:config.attributionCategory??'all'});
}
const {runContactWindow}=await import('./http-concurrency.js');
const initializationMs=performance.now()-initialization,memoryBefore=process.memoryUsage(),cpu=process.cpuUsage();
const value=await runContactWindow(config);
value.worker={initializationMs,memoryBefore,memoryAfter:process.memoryUsage(),cpu:process.cpuUsage(cpu)};
process.stdout.write(JSON.stringify(value)+'\n');
