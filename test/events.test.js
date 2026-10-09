import test from 'node:test';
import assert from 'node:assert/strict';
import { EventRegistry,createDispatcher,handler } from '../wydgine/events/index.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { fixture,runPage,envelope,Transport } from '../test-support/events.js';
const rejects=(fn,code)=>assert.rejects(fn,error=>error.code===code);

test('parameterless context bridge rejects conventional arguments and registry rejects hostile payloads',()=>{
 for(const fn of [function(x){},(x={})=>{},(...args)=>{}])assert.throws(()=>handler(fn),e=>e.code==='EVENT.INVALID');
 const registry=new EventRegistry().define('Cart.Added',{family:'Custom',cancelable:false,fields:{count:{type:'number'}}});
 assert.throws(()=>registry.payload('Cart.Added',{count:()=>{}}));assert.throws(()=>registry.payload('Cart.Added',{count:1,authority:true}));
 for(const key of ['__proto__','constructor','prototype'])assert.throws(()=>registry.payload('Submit',JSON.parse(`{"${key}":true}`)));
 assert.throws(()=>registry.payload('Change',{OldValue:null,NewValue:'x'.repeat(17000)}),e=>e.code==='EVENT.LIMIT');
});

test('Page GET lifecycle is deterministic, root-only Start, reverse cleanup, and safe contextual handles',async()=>{
 const trace=[],ids=['home','section','form','name','note'];let saved;
 const handlers=['Start','Initialize','Load','Validate','PreRender','Unload'].flatMap(phase=>ids.map(owner=>({type:`Page.${phase}`,owner,run:function(){trace.push(`${this.EVENT.Type}:${this.ME.id}`);assert.equal(this.EVENT.Source.id,'home');assert.equal(this.EVENT.Target.id,this.ME.id);assert.equal(this.SESSION.id,'sessionA');assert.throws(()=>this.CLIENT,e=>e.code==='EVENT.CONTEXT');saved=this.ME;}})));
 const first=await runPage({handlers}),secondTrace=trace.splice(0);assert.equal(first.error,null);assert.match(first.transport.text,/<form/);
 const expected=['Page.Start:home',...['Initialize','Load','Validate','PreRender'].flatMap(p=>ids.map(id=>`Page.${p}:${id}`)),...ids.toReversed().map(id=>`Page.Unload:${id}`)];assert.deepEqual(secondTrace,expected);
 assert.throws(()=>saved.id,e=>e.code==='EVENT.INVALID');await runPage({handlers});assert.deepEqual(trace,expected);
});

test('phase snapshots initialize additions once, skip removed recipients, and unload removed nodes',async()=>{
 const trace=[];const handlers=[
  {type:'Page.Load',owner:'form',run:function(){this.ME.related('children','blocks')[1].Remove();this.ME.Insert('blocks',1,envelope('extra','field',{name:'extra'}));}},
  {type:'Page.PreRender',owner:'section',run:function(){this.ME.Insert('blocks',1,envelope('thanks','block',{content:{type:'markdown',value:'Late'}}));}},
  ...['home','section','form','name','note','extra','thanks'].flatMap(owner=>['Initialize','Load','Validate','PreRender','Unload'].map(p=>({type:`Page.${p}`,owner,run:function(){trace.push(`${p}:${this.ME.id}`);}})))
 ];const result=await runPage({handlers});assert.equal(result.error,null);assert.match(result.transport.text,/Late/);
 assert.equal(trace.filter(x=>x==='Initialize:extra').length,1);assert.ok(!trace.includes('Load:extra'));assert.ok(trace.includes('Validate:extra'));assert.ok(!trace.includes('Load:note'));assert.ok(trace.includes('Unload:note'));assert.ok(trace.includes('Initialize:thanks'));assert.ok(!trace.includes('Load:thanks'));assert.ok(!trace.includes('Validate:thanks'));
 assert.equal(trace.filter(x=>x==='Unload:extra').length,1);
});

test('invalid POST preserves values/errors and runs Submit but not default; valid POST replaces only local form',async()=>{
 let actions=0,seen=[];
 const input={method:'POST',path:'/',form:'name=&note=preserved',action:{target:'form',type:'Submit',csrf:'c'.repeat(64),payload:{}}};
 const handlers=[{type:'Page.Load',owner:'note',run:function(){seen.push(this.ME.properties.value);}},{type:'Submit',owner:'form',run:function(){seen.push(this.ME.properties.valid);}}];
 const defaults=[{page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',run:function(){actions++;this.ME.Replace(envelope('thanks','block',{content:{type:'markdown',value:'Thank you'}}));}}];
 const invalid=await runPage({input,handlers,actions:defaults});assert.equal(invalid.error,null);assert.equal(actions,0);assert.deepEqual(seen,['preserved',false]);assert.match(invalid.transport.text,/aria-invalid="true"/);assert.match(invalid.transport.text,/value="preserved"/);
 const valid=await runPage({input:{...input,form:'name=Alice&note=preserved'},handlers,actions:defaults});assert.equal(valid.error,null);assert.equal(actions,1);assert.match(valid.transport.text,/Thank you/);assert.doesNotMatch(valid.transport.text,/<form/);
 const next=await runPage();assert.match(next.transport.text,/<form/);assert.doesNotMatch(next.transport.text,/Thank you|value="Alice"/);
});

test('cancel, handled, denied actions, forged input and explicit Markdown preserve cleanup/default rules',async()=>{
 let count=0,cleanup=0;
 const input={method:'POST',form:'name=Alice',action:{target:'form',type:'Submit',csrf:'c'.repeat(64),payload:{}}},actions=[{page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',run:function(){count++;}}];
 const unload={type:'Page.Unload',owner:'home',run:function(){cleanup++;assert.throws(()=>this.RESPONSE.Status=200,e=>e.code==='RESPONSE.STATE');assert.throws(()=>this.ME.Set('title','late'),e=>e.code==='EVENT.DENIED');}};
 const cancelled=await runPage({input,actions,handlers:[{type:'Submit',owner:'form',run:function(){this.EVENT.Cancel();}}, {type:'Submit',owner:'form',run:function(){assert.fail('cancel stops later handlers');}},unload]});assert.equal(cancelled.error,null);assert.equal(count,0);assert.equal(cleanup,1);
 await runPage({input,actions,handlers:[{type:'Submit',owner:'form',run:function(){this.EVENT.Handled=true;}},unload]});assert.equal(count,1);
 const denied=await runPage({input,actions,context:fixture({capabilities:[]}).context,handlers:[unload]});assert.equal(denied.error.code,'SEAM.DENIED');assert.equal(cleanup,3);assert.equal(count,1);
 const forged=await runPage({input:{...input,action:{...input.action,csrf:'forged'}},actions});assert.equal(forged.error.code,'REQUEST.FORGERY');assert.equal(count,1);
 const bad=await runPage({input:{...input,form:'name=Alice&capabilities=admin'},actions});assert.equal(bad.error.code,'REQUEST.INVALID');
 const markdown=await runPage({handlers:[{type:'Page.Load',owner:'home',run:async function(){await this.RESPONSE.WriteMarkdown('# Safe\n<script>alert(1)</script>\n[x](javascript:alert(1))');assert.throws(()=>this.RESPONSE.Status=201,e=>e.code==='RESPONSE.STATE');}},unload]});assert.equal(markdown.error,null);assert.match(markdown.transport.text,/<h1>Safe/);assert.doesNotMatch(markdown.transport.text,/<form|<script|javascript:/);assert.equal(cleanup,4);
});

test('handler, renderer and cleanup failures are sanitized and cannot skip initialized cleanup',async()=>{
 const trace=[];const handlers=['home','section','form','name','note'].map(owner=>({type:'Page.Unload',owner,run:function(){trace.push(this.ME.id);if(owner==='name')throw new Error('/secret/path');}}));
 const failed=await runPage({handlers:[...handlers,{type:'Page.Load',owner:'form',run:function(){throw new Error('private');}}]});assert.equal(failed.error.code,'EVENT.HANDLER_FAILED');assert.equal(failed.cleanupErrors.length,1);assert.deepEqual(trace,['note','name','form','section','home']);assert.doesNotMatch(JSON.stringify(failed.error),/private|secret/);
 trace.length=0;const rendered=await runPage({handlers,render(){throw new Error('renderer private');}});assert.equal(rendered.error.code,'EVENT.HANDLER_FAILED');assert.equal(trace.length,5);
});

test('queued custom events are FIFO after defaults, handles are scoped and bounded self-raising fails',async()=>{
 const events=new EventRegistry().define('Cart.Added',{family:'Custom',cancelable:true,fields:{count:{type:'number'}}}),trace=[];
 const handlers=[{type:'Page.Load',owner:'home',run:function(){this.EVENT.Raise('Cart.Added',this.ME,{count:1});this.EVENT.Raise('Cart.Added',this.ME,{count:2});trace.push('load');}}, {type:'Cart.Added',owner:'home',run:async function(){await Promise.resolve();trace.push(this.EVENT.Payload.count);}}];
 assert.equal((await runPage({events,handlers})).error,null);assert.deepEqual(trace,['load',1,2]);
 const loop=await runPage({events,handlers:[handlers[0],{type:'Cart.Added',owner:'home',run:function(){this.EVENT.Raise('Cart.Added',this.ME,{count:1});}}]});assert.equal(loop.error.code,'EVENT.LIMIT');
 const timeout=await runPage({context:fixture({limits:{eventTimeMs:10}}).context,handlers:[{type:'Page.Load',owner:'home',run:async function(){await new Promise(resolve=>setTimeout(resolve,30));assert.throws(()=>this.ME.id);}}]});assert.equal(timeout.error.code,'EVENT.LIMIT');
});

test('concurrent requests never share mutable trees, contexts or identity authority',async()=>{
 const a=fixture(),b=fixture();let ready=0,release;const barrier=new Promise(resolve=>release=resolve);
 const handlers=[{type:'Page.Load',owner:'home',run:async function(){const label=this.REQUEST.Query.Get('label');this.ME.Set('title',label);if(++ready===2)release();await barrier;assert.equal(this.ME.properties.title,label);assert.deepEqual(this.SESSION.authenticated,false);}}];
 const [one,two]=await Promise.all([runPage({...a,handlers,input:{query:'label=One'}}),runPage({...b,handlers,input:{query:'label=Two'}})]);assert.equal(one.error,null);assert.equal(two.error,null);assert.match(one.transport.text,/<title>One/);assert.match(two.transport.text,/<title>Two/);assert.equal(a.model.runtime.get('home').properties.title,'Test');
});

test('semantic Source/Target differ from named owner; raised work follows default and stale queued objects fail',async()=>{
 const events=new EventRegistry().define('Cart.Added',{family:'Custom',cancelable:false,fields:{}}),trace=[];
 const input={method:'POST',form:'name=Alice',action:{target:'form',type:'Submit',csrf:'c'.repeat(64),payload:{}}};
 const actions=[{page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',run:function(){trace.push('default');}}];
 const handlers=[{type:'Submit',owner:'home',source:'form',run:function(){assert.equal(this.EVENT.Source.id,'form');assert.equal(this.EVENT.Target.id,'form');assert.equal(this.ME.id,'home');trace.push('handler');this.EVENT.Raise('Cart.Added',this.ME,{});}},{type:'Cart.Added',owner:'home',run:function(){trace.push('queued');}}];
 assert.equal((await runPage({input,actions,handlers,events})).error,null);assert.deepEqual(trace,['handler','default','queued']);
 const stale=await runPage({events,handlers:[{type:'Page.Load',owner:'form',run:function(){this.EVENT.Raise('Cart.Added',this.ME,{});this.ME.Remove();}}]});assert.equal(stale.error.code,'EVENT.INVALID');
});

test('lifecycle Handled cannot suppress structural traversal and Cancel is invalid',async()=>{
 const trace=[];const normal=await runPage({handlers:[{type:'Page.Load',owner:'home',run:function(){this.EVENT.Handled=true;assert.throws(()=>this.EVENT.Cancel(),e=>e.code==='EVENT.INVALID');}},{type:'Page.Load',owner:'form',run:function(){trace.push('form');}}]});assert.equal(normal.error,null);assert.deepEqual(trace,['form']);
});

test('request-local deleted IDs stay reserved and custom field validation suppresses submission defaults',async()=>{
 const identity=await runPage({handlers:[{type:'Page.Load',owner:'form',run:function(){this.ME.related('children','blocks')[1].Remove();assert.throws(()=>this.ME.Insert('blocks',1,envelope('note','field',{name:'note'})),e=>e.code==='MUTATION.IDENTITY');}}]});assert.equal(identity.error,null);
 let defaults=0;
 const invalid=await runPage({input:{method:'POST',form:'name=Alice',action:{target:'form',type:'Submit',csrf:'c'.repeat(64),payload:{}}},handlers:[{type:'Page.Validate',owner:'name',run:function(){this.ME.Set('valid',false);this.ME.Set('errors',['Not accepted']);}}],actions:[{page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',run:function(){defaults++;}}]});assert.equal(invalid.error,null);assert.equal(defaults,0);assert.match(invalid.transport.text,/Not accepted/);
});
