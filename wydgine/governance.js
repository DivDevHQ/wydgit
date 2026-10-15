// Trusted host-only accounting. No package, context, token or arbitrary labels enter snapshots.
import {clean,freeze,record,requireThat as check,WydgitError} from './object-model/validation.js';
export const PAYLOAD_CEILING=2**40;
export function resourcePolicy(input={},maxPending=64){
 check(Number.isSafeInteger(maxPending)&&maxPending>=1&&maxPending<=256,'HOST.POLICY','Invalid host admission ceiling');
 const value=clean(input);check(record(value)&&Object.keys(value).every(k=>['maxPending','httpConcurrent','directConcurrent','payloadBytes'].includes(k)),'HOST.POLICY','Invalid App resource policy');
 const policy={maxPending,...value};if(!Object.hasOwn(value,'httpConcurrent'))policy.httpConcurrent=policy.maxPending;if(!Object.hasOwn(value,'directConcurrent'))policy.directConcurrent=policy.maxPending;if(!Object.hasOwn(value,'payloadBytes'))policy.payloadBytes=PAYLOAD_CEILING;
 check(['maxPending','httpConcurrent','directConcurrent'].every(k=>Number.isSafeInteger(policy[k])&&policy[k]>=1&&policy[k]<=maxPending)&&policy.httpConcurrent<=policy.maxPending&&policy.directConcurrent<=policy.maxPending&&Number.isSafeInteger(policy.payloadBytes)&&policy.payloadBytes>=1&&policy.payloadBytes<=PAYLOAD_CEILING,'HOST.POLICY','Invalid App resource policy');return freeze(policy);
}
export function saturatingAdd(value,amount){check(Number.isSafeInteger(value)&&value>=0&&Number.isSafeInteger(amount)&&amount>=0,'HOST.METER','Invalid counter');return {value:Math.min(Number.MAX_SAFE_INTEGER,value+amount),overflowed:amount>Number.MAX_SAFE_INTEGER-value};}
const libraries=['wydstore','wydgate','wydfiles','wydstream','wydsearch'];
export function createGovernance(policy){
 const created=performance.now();let started=null,ended=null,overflowed=false,used=0,transitions=1,lastState='configured';
 const work={current:0,peak:0,failed:0},classes=Object.fromEntries(['http','direct'].map(k=>[k,{admitted:0,completed:0,failed:0,overloadRejected:0,quotaRejected:0,current:0,peak:0}]));
 const traffic={attemptedBytes:0,acceptedBytes:0,quotaRejectedWrites:0,quotaRejectedBytes:0,reservedBytes:0,completed:0,failed:0,aborted:0};
 const services=Object.fromEntries(libraries.map(k=>[k,{attempted:0,succeeded:0,failed:0,current:0,peak:0}]));
 const execution={pages:0,pageStepCharges:0,pageLimitFailures:0};
 const add=(object,key,n=1)=>{const result=saturatingAdd(object[key],n);object[key]=result.value;overflowed ||=result.overflowed;};
 return Object.freeze({
  transition(state){if(state===lastState)return;lastState=state;const next=saturatingAdd(transitions,1);transitions=next.value;overflowed ||=next.overflowed;if(state==='active'&&started===null)started=performance.now();if(['stopped','failed'].includes(state)&&ended===null)ended=performance.now();},
  admit(kind){
   check(Object.hasOwn(classes,kind),'HOST.METER','Unknown work class');const c=classes[kind];
   if(kind==='http'&&used>=policy.payloadBytes){add(c,'quotaRejected');throw new WydgitError('HOST.QUOTA','App resource allowance exhausted');}
   if(work.current>=policy.maxPending||c.current>=policy[kind==='http'?'httpConcurrent':'directConcurrent']){add(c,'overloadRejected');throw new WydgitError('HOST.OVERLOAD','App admission saturated');}
   add(c,'admitted');work.current++;c.current++;work.peak=Math.max(work.peak,work.current);c.peak=Math.max(c.peak,c.current);let live=true;
   return (failed=false)=>{if(!live)return;live=false;work.current--;c.current--;add(c,'completed');if(failed){add(c,'failed');add(work,'failed');}};
  },
  payload(bytes,write){
   check(Number.isSafeInteger(bytes)&&bytes>=0,'HOST.METER','Invalid payload charge');add(traffic,'attemptedBytes',bytes);
   if(bytes>policy.payloadBytes-used){add(traffic,'quotaRejectedWrites');add(traffic,'quotaRejectedBytes',bytes);throw new WydgitError('HOST.QUOTA','App resource allowance exhausted');}
   // Synchronous reservation: no await between check, reservation and native acceptance.
   used+=bytes;traffic.reservedBytes+=bytes;
   try{const result=write();traffic.reservedBytes-=bytes;add(traffic,'acceptedBytes',bytes);return result;}
   catch(error){traffic.reservedBytes-=bytes;used-=bytes;throw error;}
  },
  httpOutcome(failed,aborted){if(aborted)add(traffic,'aborted');else add(traffic,'completed');if(failed)add(traffic,'failed');},
  service(id){check(libraries.includes(id),'HOST.METER','Unknown metered library');const c=services[id];add(c,'attempted');c.current++;c.peak=Math.max(c.peak,c.current);let live=true;return failed=>{if(!live)return;live=false;c.current--;add(c,failed?'failed':'succeeded');};},
  page({steps,limited}){check(Number.isSafeInteger(steps)&&steps>=0&&typeof limited==='boolean','HOST.METER','Invalid Page accounting');add(execution,'pages');add(execution,'pageStepCharges',steps);if(limited)add(execution,'pageLimitFailures');},
  snapshot(){return freeze(clean({scope:'controller-app-lifetime',ageMs:Math.floor(performance.now()-created),activeMs:started===null?0:Math.floor((ended??performance.now())-started),transitions,overflowed,policy,work,classes,traffic,services,execution,quota:{allowance:policy.payloadBytes,consumed:used,remaining:policy.payloadBytes-used}}));}
 });
}
