import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {PrototypeRegistry,hydrate,ExecutionContext} from '../../../wydgine/object-model/index.js';
import {coreDefinitions} from '../src/registry.js';
import {createInstanceController} from '../../../wydgine/execution/instances.js';
const current=JSON.parse(await readFile(new URL('../package.json',import.meta.url))).version;
const definitions=JSON.parse(await readFile(new URL('../../../test/fixtures/wydclient/conformance.json',import.meta.url)));
const expected=['typed',5,true,'Goo',[2,3],'2024-02-29',7,true,true];
const verifiedPrototypes=Object.fromEntries(definitions.map(d=>[d.id,d.publisher]));
test('independent canonical typed/numeric/Boolean/string/collection/DateTime/interface/static fixture conforms in Wydgine and both actual WydClient artifacts',async t=>{
 const registry=new PrototypeRegistry([...coreDefinitions,...definitions],{verifiedPrototypes});
 const envelope={schema:'wydgit/0.2',id:'page',prototype:'wydgit.core/page',properties:{title:'Conformance',slug:''},slots:{sections:[{schema:'wydgit/0.2',id:'probe',prototype:'conformance/probe',properties:{},slots:{},provenance:{}}]},provenance:{}};
 const runtime=hydrate(envelope,registry,{rootPrototype:'wydgit.core/page'}),context=new ExecutionContext({publisher:'operator',self:'page',app:'page',visible:['probe'],editable:['probe'],capabilities:['object.instances.edit','event.custom.raise'],scopes:{events:['ping','tick']}});
 const server=createInstanceController({runtime,registry,context,rootId:'page'});await server.activate();assert.deepEqual((await server.invoke('probe','probe')).value,expected);await server.invoke('probe','start');assert.equal(server.inspect('probe').properties.Log,'ABC');await server.unload();await assert.rejects(server.invoke('probe','start'));await server.activate();await server.invoke('probe','start');assert.equal(server.inspect('probe').properties.Log,'ABCABC');await server.dispose();
 for(const version of ['0.1.0-alpha.6','0.1.0-alpha.7',current])for(const suffix of ['', '.min']){
  const w=new Window({url:'https://example.test/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});
  w.eval('globalThis.WydClientConfig='+JSON.stringify({verifiedPrototypes,execution:{publisher:'conformance',installation:'reviewed-conformance',visible:['probe'],editable:['probe'],capabilities:['object.instances.edit','event.custom.raise'],scopes:{events:['ping','tick']},actions:['probe','start']}}));
  const script=w.document.createElement('script');script.id='wydgit-manifest';script.type='application/json';script.textContent=JSON.stringify({schema:'wydgit.registry/0.1',prototypes:definitions,entry:{id:'probe',type:'conformance/probe'}});w.document.head.append(script);
  w.eval(await readFile(new URL('../dist/wydgit-client-'+version+suffix+'.js',import.meta.url),'utf8'));
  const ready=await w.WydClient.ready();assert.equal(ready.ok,true,JSON.stringify(ready));const e=w.WydClient.execution();assert.deepEqual(JSON.parse(JSON.stringify((await e.invoke(e.entry(),'probe')).value)),expected);
  await e.invoke(e.entry(),'start');assert.equal(e.snapshot(e.entry()).properties.Log,'ABC');const held=e.entry();await e.unload();await assert.rejects(e.invoke(held,'start'));await e.activate();await e.invoke(e.entry(),'start');assert.equal(e.snapshot(e.entry()).properties.Log,'ABCABC');
 }
});
