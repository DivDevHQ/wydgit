// Explicit isolated qualification only; never loaded by the Contact/runtime path.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setImmediate} from 'node:timers/promises';
import {createFsreqpromiseProbe} from './fsreqpromise-correlation.js';
import {checkLifecycleLock} from '../packages/wydstore/src/lifecycle-lock.js';

if(process.argv.length!==3||process.argv[2]!=='--observe')throw new Error('Usage: node test-support/fsreqpromise-correlation-probe.mjs --observe');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-fsreq-evidence-'));
const probe=createFsreqpromiseProbe({enabled:true,maxCalls:14,maxResources:14});
const outcomes=[];
let observation;
try {
  await fs.writeFile(path.join(root,'present.lifecycle'),'');
  for(const name of ['present','missing']){
    try{await probe.capture(c=>checkLifecycleLock(root,name,false,c));outcomes.push('allowed');}
    catch(error){if(error.code!=='STORE.BUSY')throw error;outcomes.push('STORE.BUSY');}
  }
  await Promise.all(Array.from({length:12},()=>probe.capture(c=>checkLifecycleLock(root,'missing',false,c))));
  await setImmediate();
  observation=probe.snapshot();
}finally{probe.stop();await fs.rm(root,{recursive:true,force:true});}
const calls=observation.calls;
const intervals=calls.filter(row=>row.correlation==='isolated-single-resource').map(row=>{
  const r=row.resources[0];return {call:row.call,
    invocationToBeforeMs:r.firstBeforeMs===null?null:r.firstBeforeMs-row.invocationMs,
    afterToRecoveryMs:r.lastAfterMs===null||row.recoveryMs===null?null:row.recoveryMs-r.lastAfterMs};
});
process.stdout.write(JSON.stringify({schema:'wydgine.fsreqpromise-correlation-evidence/1',date:'2026-10-19',
  startingHead:'b24d11e34382c95d74c4ced59773c3315ad7e8dd',branch:'develop/0.3',node:process.version,release:'0.3.0-alpha.28',
  issue:{id:'WYDGINE-0.3-HTTP-LIMIT',status:'OPEN'},
  command:'node test-support/fsreqpromise-correlation-probe.mjs --observe',
  scope:'Real lifecycle helper, isolated synchronous capture; not an HTTP reproduction or production timing baseline',
  contract:'Only the known helper is invoked inside each capture window; source inspection identifies exactly one fs/promises.lstat before its first await. Unique FSREQPROMISE init must follow start and have trigger equal to captured executionAsyncId. Multiple candidates or overflow are ambiguous.',
  clock:'performance.now monotonic milliseconds in this process',outcomes,concurrentMissingCalls:12,
  observation,intervals,cleanup:{hookStopped:probe.snapshot().stopped,trackedAfterStop:probe.snapshot().tracked,fixtureRemoved:true},
  limitations:['No OS completion, Promise settlement, or exclusive filesystem/thread-pool attribution.',
    'before/after are resource callback boundaries; counts are retained without assuming one-to-one operation mapping.',
    'destroy is optional lifetime evidence, never a completion timestamp.',
    'Capture contract is established only for this helper fixture; Contact integration is not established.',
    'Global hook dispatch and synchronous marker overhead are uncalibrated; this run is not comparable to alpha.28 load timings.'],
  http:{performed:false,reason:'No existing synchronous per-lifecycle capture seam in Contact harness; omitted to keep this diagnostic spike bounded.'}
},null,2)+'\n');
