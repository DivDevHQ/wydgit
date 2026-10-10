import test from 'node:test';
import assert from 'node:assert/strict';
import { mountClient } from '../wydclient/index.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
class Element extends EventTarget {value='';}
const context=()=>new ExecutionContext({publisher:'acme',self:'form',visible:['form','field'],capabilities:['client.actions.submit','client.cookies.read'],scopes:{actions:['form'],cookies:[{name:'theme',path:'/'},{name:'__Host-wydgit-auth',path:'/'}]}});
test('client Mount/Ready/Unmount, semantic adaptation, Change reconciliation and submit ownership',async()=>{
 const form=new Element(),field=new Element(),trace=[];let submits=0,stale;
 const handlers=['Mount','Ready','Unmount'].flatMap(p=>['form','field'].map(owner=>({type:`Client.${p}`,owner,run:function(){trace.push(`${p}:${this.ME.id}`);assert.throws(()=>this.REQUEST,e=>e.code==='EVENT.CONTEXT');}})));
 handlers.push({type:'Change',owner:'field',run:function(){assert.equal(this.EVENT.OldValue,'old');assert.equal(this.EVENT.NewValue,'bad');assert.equal(this.EVENT.Payload.target,undefined);assert.equal(this.ME.document,undefined);this.EVENT.Cancel();stale=this.ME;assert.equal(this.CLIENT.Cookies.Get('theme'),'dark');assert.throws(()=>this.CLIENT.Cookies.Get('__Host-wydgit-auth'),e=>e.code==='SEAM.DENIED');}});
 const options={nodes:[{id:'form',kind:'form',element:form},{id:'field',parent:'form',kind:'field',element:field,value:'old'}],context:context(),handlers,readCookies:()=> 'theme=dark; __Host-wydgit-auth=should-not-leak',submit:async request=>{assert.deepEqual(Object.keys(request).sort(),['payload','target','type']);submits++;}};
 const client=mountClient(options);await client.ready;assert.deepEqual(trace,['Mount:form','Mount:field','Ready:form','Ready:field']);field.value='bad';field.dispatchEvent(new Event('change'));await client.idle();assert.equal(field.value,'old');assert.throws(()=>stale.id,e=>e.code==='EVENT.INVALID');
 const native=new Event('submit',{cancelable:true});form.dispatchEvent(native);await client.idle();assert.equal(native.defaultPrevented,true);assert.equal(submits,1);
 await client.unmount();await client.unmount();assert.deepEqual(trace.slice(-2),['Unmount:field','Unmount:form']);form.dispatchEvent(new Event('submit'));await client.idle();assert.equal(submits,1);
 const remount=mountClient(options);await remount.ready;await remount.unmount();assert.equal(trace.filter(x=>x==='Mount:form').length,2);
});
test('client cancellation suppresses default and handler failure releases native listeners',async()=>{
 const form=new Element();let count=0;const client=mountClient({nodes:[{id:'form',element:form,kind:'form'}],context:context(),handlers:[{type:'Submit',owner:'form',run:function(){this.EVENT.Cancel();}}],submit:async()=>count++});await client.ready;form.dispatchEvent(new Event('submit',{cancelable:true}));await client.idle();assert.equal(count,0);await client.unmount();
 const failed=mountClient({nodes:[{id:'form',element:form,kind:'form'}],context:context(),handlers:[{type:'Submit',owner:'form',run:function(){throw new Error('native private');}}],submit:async()=>count++});await failed.ready;form.dispatchEvent(new Event('submit',{cancelable:true}));await failed.idle();assert.equal(failed.error(),'EVENT.HANDLER_FAILED');form.dispatchEvent(new Event('submit'));await failed.idle();assert.equal(count,0);
});
