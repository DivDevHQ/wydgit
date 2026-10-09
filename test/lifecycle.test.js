import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLibraries } from '../wydgine/libraries/index.js';
import { createLifecycle } from '../wydgine/execution/lifecycle.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createGate } from '@wydgit/gate/client';
import { configuration,temp,gateContext,secret,project } from '../test-support/wydgate.js';
import platform from '../package.json' with {type:'json'};
for(const provider of ['json','sqlite'])test(`${provider}: real Gate transitions deliver Start/Authenticated and idempotent terminal cleanup`,async t=>{
 const trace=[],root=await temp(t),context=new ExecutionContext({publisher:'wydgit.core',app:'appA',self:'appA'});
 const handlers=['Start','Authenticated','Logout','Timeout','End'].map(type=>({type:`Session.${type}`,owner:'appA',run:function(){trace.push([type,this.SESSION.id,this.SESSION.authenticated]);assert.throws(()=>this.PAGE,e=>e.code==='EVENT.CONTEXT');assert.throws(()=>this.REQUEST,e=>e.code==='EVENT.CONTEXT');assert.deepEqual(context.capabilities,[]);if(type==='Logout')throw new Error('cleanup still required');}}));
 const lifecycle=createLifecycle({app:'appA',context,handlers}),config=configuration(root,provider);config.libraries[0].options.sessionTtlMs=1000;
 const options={config,root:project,platformVersion:platform.version,lifecycle:async(id,event)=>{assert.equal(id,'wydgate');assert.doesNotMatch(JSON.stringify(event),/digest|token|password/);await lifecycle.session(event);}};
 const first=await loadLibraries(options),second=await loadLibraries(options),gate=createGate(first.bind(gateContext())),other=createGate(second.bind(gateContext()));
 await gate.createUser({username:'alice',password:secret});const login=await gate.login('alice',secret);assert.deepEqual(trace.map(x=>x[0]),['Start','Authenticated']);assert.equal(trace[1][2],true);
 await Promise.allSettled([gate.logout(login.token),other.logout(login.token)]);assert.deepEqual(trace.map(x=>x[0]),['Start','Authenticated','Logout','End']);assert.equal(trace.at(-1)[2],false);assert.equal(lifecycle.errors().length,1);
 const expired=await gate.login('alice',secret);const clock=t.mock.method(Date,'now',()=>expired.session.expiresAt);
 await Promise.allSettled([gate.resolveSession(expired.token),other.resolveSession(expired.token)]);await assert.rejects(()=>gate.resolveSession(expired.token));clock.mock.restore();
 assert.deepEqual(trace.slice(-4).map(x=>x[0]),['Start','Authenticated','Timeout','End']);assert.equal(trace.filter(x=>x[0]==='End'&&x[1]===expired.session.id).length,1);
});
test('Server lifecycle activates/stops once with no fabricated request or Session contexts',async()=>{
 const trace=[],context=new ExecutionContext({publisher:'wydgit.core',app:'app',self:'app'});
 const lifecycle=createLifecycle({app:'app',context,handlers:['Start','Stop'].map(type=>({type:`Server.${type}`,owner:'app',run:function(){trace.push(type);assert.equal(this.SERVER.App,'app');for(const name of ['SESSION','REQUEST','RESPONSE','PAGE'])assert.throws(()=>this[name],e=>e.code==='EVENT.CONTEXT');}}))});
 await Promise.all([lifecycle.start(),lifecycle.start()]);await Promise.all([lifecycle.stop(),lifecycle.stop()]);assert.deepEqual(trace,['Start','Stop']);
});
