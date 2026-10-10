import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../wydgine/wydbasic/index.js';
import { execute } from '../wydgine/sewn/execute.js';
import { validate } from '../wydgine/sewn/validate.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { packageFixture } from '../test-support/packages.js';
import { initializeHost } from '../wydgine/host.js';
import { loadRepository } from '../wydgine/repository.js';
const context=new ExecutionContext({publisher:'untrusted',self:'x'});
const run=source=>execute(compile(source),{context,scope:{}});

test('NewId is a bounded portable String intrinsic, distinct IDs and no host/entropy/authority surface',async()=>{
 const ids=[];for(let i=0;i<100;i++)ids.push((await run('DIM id AS String = nEwId()\nRETURN id')).value);
 assert.equal(new Set(ids).size,100);assert.ok(ids.every(id=>/^w[0-9a-f]{32}$/.test(id)));assert.equal(context.capabilities.length,0);
 assert.throws(()=>compile('RETURN NewId("entropy")'));assert.throws(()=>compile('RETURN NewId().randomUUID()'));
 assert.throws(()=>validate({schema:'sewn/0.3',procedures:{},body:[{op:'return',value:{op:'newId',entropy:'mine'}}]}));
 assert.throws(()=>validate({schema:'sewn/0.1',body:[{op:'return',value:{op:'newId'}}]}));
 const crypto=globalThis.crypto;try{Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true});await assert.rejects(run('RETURN NewId()'),e=>e.code==='SEWN.DENIED');}finally{Object.defineProperty(globalThis,'crypto',{value:crypto,configurable:true});}
});

test('NewId works in WydStore and NEW but confers no create/construct/edit authority',async t=>{
 const {root}=await packageFixture(t),libraries=await initializeHost({root});const id=(await run('RETURN NewId()')).value;
 const ctx=new ExecutionContext({publisher:'divdev',package:'divdev/guestbook',app:'boilerplate',self:'x',capabilities:['store.records.create'],scopes:{wydstore:[{store:'host-book',collection:'host-entries'}]}});
 const input={store:'host-book',collection:'host-entries',id,data:{name:'Ada',message:'Portable'}};assert.equal((await libraries.bind(ctx).call('wydstore','create',input)).ok,true);
 assert.equal((await libraries.bind(context).call('wydstore','create',{...input,id:(await run('RETURN NewId()')).value})).code,'SEAM.DENIED');
 const source='DIM panel AS Wydgit\nSET panel = NEW "acme/message-panel"(NewId())\nRETURN panel.id';
 const prototypeRegistry=loadRepository(root).registry,construct=new ExecutionContext({publisher:'untrusted',self:'x',capabilities:['object.instances.construct'],scopes:{prototypes:['acme/message-panel']}});
 const created=await execute(compile(source),{context:construct,prototypeRegistry,scope:{}});assert.match(created.value,/^w[0-9a-f]{32}$/);assert.equal(construct.allows('object.instances.edit'),false);
 await assert.rejects(execute(compile(source),{context,prototypeRegistry,scope:{}}),e=>e.code==='SEAM.DENIED');
});
