import test from 'node:test';
import assert from 'node:assert/strict';
import {openGate} from '../packages/wydgate/src/core.js';
import {fixture,gateContext,secret,directoryRequest} from '../test-support/wydgate.js';

const barrier=()=>{let enter,release;return {entered:new Promise(r=>enter=r),held:new Promise(r=>release=r),enter:()=>enter(),release:()=>release()};};
// Delay only the test caller's CAS submission. The independent runtime commits to
// the real provider while the touch holds an obsolete validated revision.
async function controlled(t,provider,options={}){
 const f=await fixture(t,provider);t.after(()=>f.registry.close());
 const user=await f.gate.createUser({username:'alice',password:secret}),login=await f.gate.login('alice',secret);
 let before=async()=>{},after=async()=>{},updates=0;
 const core=await openGate({...f.config.libraries[0].options,...options},{identity:{app:'appA',publisher:'wydgit.core',library:'wydgate'},async call(operation,input){if(operation==='update'){updates++;const override=await before(input);if(override)return override;}const result=await f.storage.call('wydstore',operation,input);if(operation==='update')await after(input,result);return result;}});
 return {...f,user,login,resolve:()=>core.execute('resolve-session',{token:login.token},gateContext()),setBefore:value=>before=value,setAfter:value=>after=value,updates:()=>updates};
}

for(const provider of ['json','sqlite']){
 for(const transition of ['logout','revocation','credential rotation','absolute expiration','idle expiration','permission change'])test(`GATECONT ${provider}: stale touch revalidates after ${transition}`,async t=>{
  const f=await controlled(t,provider,{sessionIdleMs:transition==='idle expiration'?1000:3600000}),b=barrier();t.after(b.release);
  let armed=true,touchedAt;f.setBefore(async input=>{if(armed){armed=false;touchedAt=input.data.sessions.find(s=>s.id===f.login.session.id).lastSeenAt;b.enter();await b.held;}});
  const pending=f.resolve();const settled=Promise.allSettled([pending]);await b.entered;
  if(transition==='logout')await f.gate.logout(f.login.token);
  if(transition==='revocation')await f.gate.revokeSession(f.login.session.id);
  if(transition==='credential rotation')await f.gate.changePassword(f.user.id,secret+' rotated');
  if(transition==='permission change')await f.gate.assignUser({userId:f.user.id,roles:[],permissions:['operations.changed.read']});
  if(transition.includes('expiration'))t.mock.method(Date,'now',()=>transition==='idle expiration'?touchedAt+1000:f.login.session.expiresAt);
  b.release();const [result]=await settled;
  if(transition==='permission change'){
   assert.equal(result.status,'fulfilled');assert.ok(result.value.permissions.includes('operations.changed.read'));assert.equal(f.updates(),2,'A stale revision is reread before authentication succeeds');
  }else{
   assert.equal(result.status,'rejected');assert.equal(result.reason.code,'GATE.SESSION_INVALID');
   await assert.rejects(f.resolve(),{code:'GATE.SESSION_INVALID'});
  }
  const current=(await f.storage.call('wydstore','get',directoryRequest)).value;
  const session=current.data.sessions.find(s=>s.id===f.login.session.id);
  if(!transition.includes('expiration')&&transition!=='permission change')assert.equal(session.revoked,true);
 });

 test(`GATECONT ${provider}: conflict/busy/I/O fail closed with bounded attempts and same-session recovery`,async t=>{
  const f=await controlled(t,provider);
  for(const [code,expected,attempts] of [['STORE.CONFLICT','GATE.CONFLICT',3],['STORE.BUSY','GATE.BUSY',1],['STORE.IO','GATE.IO',1]]){
   const before=f.updates();f.setBefore(async()=>({ok:false,code}));
   await assert.rejects(f.resolve(),{code:expected});assert.equal(f.updates()-before,attempts);
   f.setBefore(async()=>{});assert.equal((await f.resolve()).sessionId,f.login.session.id);
  }
 });

 test(`GATECONT ${provider}: newer durable activity survives an older delayed touch completion`,async t=>{
  const f=await controlled(t,provider,{sessionIdleMs:1000}),b=barrier();t.after(b.release);let armed=true,touchedAt,clock=Date.now();t.mock.method(Date,'now',()=>clock);
  f.setAfter(async input=>{if(armed){armed=false;touchedAt=input.data.sessions.find(s=>s.id===f.login.session.id).lastSeenAt;b.enter();await b.held;}});
  const pending=f.resolve(),settled=Promise.allSettled([pending]);await b.entered;
  clock=touchedAt+999;assert.equal((await f.resolve()).sessionId,f.login.session.id);
  clock=touchedAt+1000;b.release();const [result]=await settled;
  assert.equal(result.status,'fulfilled','A completed newer touch must prevent false invalid-session/cookie deletion');assert.equal(result.value.sessionId,f.login.session.id);
  assert.equal(f.updates(),2,'No retry or extra touch is introduced');
 });

 test(`GATECONT ${provider}: simultaneous sessions contend without invalidation or cached identity`,async t=>{
  const f=await controlled(t,provider),otherUser=await f.gate.createUser({username:'bobby',password:secret}),other=await f.gate.login('bobby',secret);
  const before=(await f.storage.call('wydstore','get',directoryRequest)).value.version;
  const results=await Promise.allSettled(Array.from({length:12},(_,i)=>f.gate.resolveSession(i%2?other.token:f.login.token)));
  assert.ok(results.some(r=>r.status==='fulfilled'));
  for(const [i,result] of results.entries())if(result.status==='fulfilled')assert.equal(result.value.sessionId,i%2?other.session.id:f.login.session.id);else assert.ok(['GATE.CONFLICT','GATE.BUSY'].includes(result.reason.code));
  assert.equal((await f.gate.resolveSession(other.token)).userId,otherUser.id);assert.equal((await f.resolve()).sessionId,f.login.session.id);
  const current=(await f.storage.call('wydstore','get',directoryRequest)).value;
  assert.ok(current.version>before);assert.equal(current.data.sessions.length,2);assert.ok(current.data.sessions.every(s=>!s.revoked));
 });
}
