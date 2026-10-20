// Spike G sidecar for the existing trusted Contact/FSREQPROMISE harness. This
// module is never imported by production code or browser builds. No authority.
import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
import {createHmac,randomBytes} from 'node:crypto';

const local=new AsyncLocalStorage();
const stages=new Set(['repositoryLoad','repositoryBuild','hydrate','dehydrate','editSetup','mutation','commit','changes',
  'draftCreate','draftSet','draftInsert','draftEnvelope','draftValidate','systemSet','installedBind','installedStamp',
  'installedValidate','installedRead','installedStateValidate','baseFingerprint','safeRead','contextCheck','metadata',
  'candidateConstruction','candidateValidation','commitValidation']);
const phases=new Set(['prepare','start','initialize','load','validate','action','prerender','render','cleanup','settle']);
const key=randomBytes(32);
const installationArtifacts=['content/installed-packages.json','wydgit.config.json','content/.package-install.lock','content/.package-recovery.lock',
  'content/.package-infrastructure.json','content/package-effects.json','content/package-operation.json'];
const sites=new Set(['packages/index.js','packages/state.js','repository.js']);
export function createSynchronousAttribution({generation=1,request=0,maxArtifacts=256,now=()=>performance.now()}={}) {
  if(!Number.isSafeInteger(generation)||generation<1||!Number.isInteger(request)||request<0||request>12||
    !Number.isInteger(maxArtifacts)||maxArtifacts<1||maxArtifacts>1024)throw new RangeError('Attribution bounds');
  const state={generation,request,now,phase:'prepare',deadline:null,stack:[],rows:new Map(),metadata:new Map(),artifacts:new Set(),
    knownFiles:new Map(),maxArtifacts,droppedArtifacts:0,overflow:0,counts:Object.create(null),boundaries:[],lifetimes:new WeakMap(),nextLifetime:0,closed:false};
  let result;
  return Object.freeze({
    run(operation){return local.run(state,operation);},
    finish(){
      if(result)return result;
      state.closed=true;
      result={schema:'wydgine.synchronous-attribution/1',generation,request,clock:'performance.now; synchronous brackets only',
        spans:[...state.rows.values()].map(row=>({...row})),metadata:[...state.metadata.values()].map(row=>({...row})),
        uniqueArtifacts:state.artifacts.size,droppedArtifacts:state.droppedArtifacts,stackOverflow:state.overflow,
        counts:{...state.counts},boundaries:state.boundaries.map(row=>({...row})),observedLifetimes:state.nextLifetime};
      state.rows.clear();state.metadata.clear();state.artifacts.clear();state.knownFiles.clear();
      return result;
    }
  });
}
export function syncSpan(stage,operation) {
  const s=local.getStore();if(!s||s.closed)return operation();
  if(!stages.has(stage))throw new RangeError('Unknown attribution stage');
  if(s.stack.length>=128){s.overflow++;return operation();}
    const insideBudget=s.deadline!==null,key=s.phase+'|'+insideBudget+'|'+stage,
      row=s.rows.get(key)??{phase:s.phase,insideBudget,stage,calls:0,inclusiveMs:0,exclusiveMs:0};
  s.rows.set(key,row);const frame={start:s.now(),children:0,stage};s.stack.push(frame);
  try{return operation();}finally{
    const duration=Math.max(0,s.now()-frame.start);s.stack.pop();row.calls++;row.inclusiveMs+=duration;
    row.exclusiveMs+=Math.max(0,duration-frame.children);
    if(s.stack.length)s.stack.at(-1).children+=duration;
  }
}
export function count(name,amount=1){
  const s=local.getStore();if(!s||s.closed)return;
  if(!['hydratedNodes','copiedNodes','draftValidationNodes','guardChecks','repeatedGenerationChecks'].includes(name))throw new RangeError('Unknown counter');
  s.counts[name]=(s.counts[name]??0)+amount;
}
export function lifetimeCheck(context){
  const s=local.getStore();if(!s||s.closed)return;
  // The instrumented guard supplies the original bound context. Derivations do
  // not manufacture new diagnostic generations. Only local ordinals are emitted.
  if(!s.lifetimes.has(context))s.lifetimes.set(context,++s.nextLifetime);
  else count('repeatedGenerationChecks');
  count('guardChecks');
}
export function phase(name){const s=local.getStore();if(s&&!s.closed&&phases.has(name))s.phase=name;}
export function budgetDeadline(deadline){const s=local.getStore();if(s&&!s.closed&&Number.isFinite(deadline))s.deadline=deadline;}
export function boundary(name){
  const s=local.getStore();if(!s||s.closed||s.boundaries.length>=32)return;
  if(!['budgetStarted','phase','serviceBefore','serviceAfter','finished'].includes(name))throw new RangeError('Unknown boundary');
  s.boundaries.push({name,phase:s.phase,atMs:s.now(),remainingMs:s.deadline===null?null:s.deadline-Date.now()});
}
export function observedFs(site,operation,fn,...args){
  const s=local.getStore();if(!s||s.closed)return fn(...args);
  if(!sites.has(site)||!['lstatSync','realpathSync','existsSync'].includes(operation))throw new RangeError('Unknown metadata site');
  const caller=s.stack.at(-1)?.stage??'unattributed',insideBudget=s.deadline!==null;
  const cause=s.stack.findLast(frame=>!['metadata','contextCheck','installedStamp'].includes(frame.stage))?.stage??'other';
  const mapKey=s.phase+'|'+insideBudget+'|'+site+'|'+operation+'|'+caller+'|'+cause;
  const row=s.metadata.get(mapKey)??{phase:s.phase,insideBudget,site,operation,caller,cause,calls:0,elapsedMs:0};s.metadata.set(mapKey,row);
  // Each capture covers one installation. Recognize its seven fixed logical
  // artifacts without hashing each repeated stamp; other paths become ephemeral
  // keyed digests. No private path or file bytes are emitted; the label cache
  // below privately retains at most seven path strings until capture finish.
  const file=String(args[0]);let digest=s.knownFiles.get(file);
  if(digest===undefined){
    const known=installationArtifacts.findIndex(name=>file.endsWith('/'+name));
    digest=known<0?createHmac('sha256',key).update(file).digest('hex'):'installation-artifact-'+known;
    // Diagnostic labels only. At most seven path strings per request, discarded
    // at finish. NEVER retain metadata, validation results or authority decisions.
    if(known>=0&&s.knownFiles.size<7)s.knownFiles.set(file,digest);
  }
  if(!s.artifacts.has(digest)){if(s.artifacts.size<s.maxArtifacts)s.artifacts.add(digest);else s.droppedArtifacts++;}
  const start=s.now();try{return syncSpan('metadata',()=>fn(...args));}finally{row.calls++;row.elapsedMs+=Math.max(0,s.now()-start);}
}
export function observeMethods(value,mapping){
  // These host-only test wrappers preserve the original receiver and accessors.
  // Public operation return values/exceptions pass through unchanged.
  const descriptors=Object.getOwnPropertyDescriptors(value);
  for(const [name,stage]of Object.entries(mapping))if(typeof descriptors[name]?.value==='function'){
    const fn=descriptors[name].value;descriptors[name]={...descriptors[name],value:function(...args){return syncSpan(stage,()=>fn.apply(value,args));}};
  }
  return Object.freeze(Object.defineProperties({},descriptors));
}
