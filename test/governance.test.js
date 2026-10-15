import test from 'node:test';
import assert from 'node:assert/strict';
import {resourcePolicy,createGovernance,saturatingAdd,PAYLOAD_CEILING} from '../wydgine/governance.js';
import {meteredOutput} from '../wydgine/http/metered-output.js';
test('closed finite resource reductions preserve the combined admission ceiling',()=>{
 assert.deepEqual(resourcePolicy({},64),{maxPending:64,httpConcurrent:64,directConcurrent:64,payloadBytes:PAYLOAD_CEILING});
 for(const bad of [null,[],{unknown:1},{httpConcurrent:null},{directConcurrent:null},{payloadBytes:null},{maxPending:0},{maxPending:-1},{maxPending:65},{httpConcurrent:65},{payloadBytes:0},{payloadBytes:Infinity},{payloadBytes:PAYLOAD_CEILING+1},{maxPending:1,httpConcurrent:2}])assert.throws(()=>resourcePolicy(bad),e=>['HOST.POLICY','INPUT.JSON'].includes(e.code));
 assert.equal(resourcePolicy({maxPending:2},64).directConcurrent,2);
});
test('admission has no queue, double release, negative counter or nested class confusion',()=>{
 const m=createGovernance(resourcePolicy({maxPending:2,httpConcurrent:1,directConcurrent:1})),a=m.admit('http');assert.throws(()=>m.admit('http'),{code:'HOST.OVERLOAD'});const b=m.admit('direct');assert.throws(()=>m.admit('direct'),{code:'HOST.OVERLOAD'});a();a();b(true);b(true);
 const s=m.snapshot();assert.equal(s.work.current,0);assert.equal(s.work.peak,2);assert.equal(s.work.failed,1);assert.equal(s.classes.http.overloadRejected,1);assert.equal(s.classes.direct.completed,1);assert.equal(s.classes.direct.failed,1);assert.throws(()=>m.admit('publisher-label'),{code:'HOST.METER'});
});
test('synchronous quota reservations commit once, refund rejected native writes and never exceed the finite allowance',()=>{
 const m=createGovernance(resourcePolicy({payloadBytes:10}));assert.throws(()=>m.payload(4,()=>{throw Error('native write failed');}));assert.equal(m.snapshot().quota.consumed,0);assert.equal(m.payload(6,()=>false),false);assert.throws(()=>m.payload(5,()=>assert.fail()),{code:'HOST.QUOTA'});m.payload(4,()=>true);assert.throws(()=>m.admit('http'),{code:'HOST.QUOTA'});const s=m.snapshot();assert.equal(s.quota.remaining,0);assert.equal(s.traffic.acceptedBytes,10);assert.equal(s.traffic.attemptedBytes,19);assert.equal(s.traffic.reservedBytes,0);assert.equal(s.traffic.quotaRejectedWrites,1);assert.equal(s.classes.http.quotaRejected,1);
 const stopping=createGovernance(resourcePolicy({payloadBytes:10}));stopping.payload(5,()=>{assert.equal(stopping.snapshot().traffic.reservedBytes,5);stopping.transition('stopping');return true;});stopping.transition('stopped');assert.equal(stopping.snapshot().traffic.reservedBytes,0);assert.equal(stopping.snapshot().quota.consumed,5);
});
test('finite meter dimensions, overflow saturation and frozen snapshots cannot confer authority',()=>{
 assert.deepEqual(saturatingAdd(Number.MAX_SAFE_INTEGER-1,2),{value:Number.MAX_SAFE_INTEGER,overflowed:true});assert.throws(()=>saturatingAdd(0,-1));const m=createGovernance(resourcePolicy());m.page({steps:Number.MAX_SAFE_INTEGER,limited:false});m.page({steps:2,limited:true});const finish=m.service('wydstore');finish(true);finish(false);assert.throws(()=>m.service('private-user-value'),{code:'HOST.METER'});
 const s=m.snapshot();assert.equal(s.overflowed,true);assert.equal(s.execution.pageStepCharges,Number.MAX_SAFE_INTEGER);assert.equal(s.execution.pageLimitFailures,1);assert.equal(s.services.wydstore.failed,1);assert.equal(s.services.wydstore.succeeded,0);assert.throws(()=>s.policy.payloadBytes=999);assert.equal(m.snapshot().policy.payloadBytes,PAYLOAD_CEILING);
});
test('output accounting suppresses HEAD/304 bodies and distinguishes native acceptance from delivery',()=>{
 const m=createGovernance(resourcePolicy({payloadBytes:5}));let body='';const native={statusCode:200,destroyed:false,writableEnded:false,headersSent:false,write(b){body+=b;return false;},end(b){body+=b??'';this.writableEnded=true;},removeHeader(){},setHeader(){},destroy(){this.destroyed=true;}};
 const out=meteredOutput(native,false,m);assert.equal(out.write('é'),false);assert.equal(m.snapshot().traffic.acceptedBytes,2);native.statusCode=304;out.write('unaccounted suppressed');native.statusCode=200;out.end('abc');assert.equal(body,'éabc');assert.equal(m.snapshot().traffic.acceptedBytes,5);
 const head={...native,writableEnded:false,statusCode:200,end(b){assert.equal(b,undefined);}};meteredOutput(head,true,m).end('large head representation');assert.equal(m.snapshot().traffic.acceptedBytes,5);
});
