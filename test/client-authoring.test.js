import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {buildClientFromConfig} from '../scripts/build-client-package.js';
import {buildClientPackage,signClientPackage} from '../wydgine/wydbasic/client-package.js';
import {compileDefinitions} from '../wydgine/repository.js';
import {compileFamily} from '../wydgine/wydbasic/index.js';
import {createRuntime} from '../packages/wydclient/src/runtime.js';
import {webcrypto} from 'node:crypto';
import {Window} from 'happy-dom';
const directory=new URL('../examples/wbasic-taskboard/client/',import.meta.url),config=JSON.parse(await readFile(new URL('build.json',directory))),sources=Object.fromEntries(await Promise.all(config.sources.map(async file=>[file,await readFile(new URL(file,directory),'utf8')]))),definitions=compileDefinitions(JSON.parse(await readFile(new URL('../prototypes/objects.json',import.meta.url))));
const options={target:'client',manifest:config.manifest,entry:config.entry,definitions,verifiedPackages:{[config.manifest.id]:'divdev'}};
test('explicit CLIENT uses normal family IR/lowering and emits deterministic existing browser envelopes',async t=>{
 const a=buildClientPackage(sources,options),b=buildClientPackage(Object.fromEntries(Object.entries(sources).reverse()),options);assert.equal(a.packageText,b.packageText);assert.equal(a.registryText,b.registryText);assert.equal(a.integrity,b.integrity);assert.equal(a.payload.schema,'wydgit.prototype-package/0.1');assert.equal(a.clientVersion,'0.1.0-alpha.10');assert.ok(a.definitions.some(d=>d.presentation?.schema==='wydgit.presentation/0.2'));
 const out=await mkdtemp(join(tmpdir(),'h4-client-'));t.after(()=>rm(out,{recursive:true,force:true}));await buildClientFromConfig(new URL('build.json',directory).pathname,out,{verifiedPackages:options.verifiedPackages});assert.equal(await readFile(join(out,'package.json'),'utf8'),a.packageText);assert.equal(await readFile(join(out,'registry.json'),'utf8'),a.registryText);assert.equal(await readFile(new URL('../packages/wydclient/examples/interactive/package.json',import.meta.url),'utf8'),a.packageText);
});
test('CLIENT rejects unavailable contexts/renderer structures and malformed action signatures with source diagnostics',()=>{
 for(const replace of [s=>s.replace('PRESENTATION CLIENT','PRESENTATION SERVER'),s=>s.replace('CALL NextPage','CALL ApplyPage'),s=>s.replace('SUB SubmitTask(data AS Object)','SUB SubmitTask(data AS String)'),s=>s.replace('Me.Message = "Local tasks cleared."','Me.Message = SESSION.id')]){
  assert.throws(()=>buildClientPackage({...sources,'taskboard.bas':replace(sources['taskboard.bas'])},options),e=>typeof e.code==='string'&&e.details.file==='taskboard.bas'&&Number.isInteger(e.details.line)&&Number.isInteger(e.details.column));
 }
 assert.throws(()=>buildClientPackage(sources,{...options,target:'server'}));assert.throws(()=>compileFamily(sources,{...options,target:'future'}));assert.throws(()=>buildClientPackage(sources,{...options,verifiedPackages:{}}));
 for(const permission of ['store.records.write','client.dom.read'])assert.throws(()=>buildClientPackage(sources,{...options,manifest:{...options.manifest,permissions:{...options.manifest.permissions,capabilities:[permission]}}}));
});
test('generated signed CLIENT package executes only after independent key and exact package-version approval',async t=>{
 const a=buildClientPackage(sources,options),{privateKey}=generateKeyPairSync('ed25519'),signed=signClientPackage(a,{privateKey,keyId:'test-key',url:'/package.json'});
 assert.deepEqual(signClientPackage(a,{privateKey,keyId:'test-key',url:'/package.json'}),signed);
 for(const mode of ['approved','wrong-version','bad-signature','self-approval']){
  const w=new Window({url:'https://example.test/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});
  const m=structuredClone(signed.registry);if(mode==='bad-signature')m.packages[0].signature='A'.repeat(86)+'==';if(mode==='self-approval')m.execution={capabilities:['object.instances.edit']};
  const s=w.document.createElement('script');s.type='application/json';s.id='wydgit-manifest';s.textContent=JSON.stringify(m);w.document.head.append(s);
  const execution={publisher:'divdev',package:a.payload.id,packageVersion:mode==='wrong-version'?'0.0.0':a.payload.version,installation:'reviewed-test',actions:['nextpage','submittask','cleartasks'],...config.manifest.permissions};
  const r=createRuntime({document:w.document,location:w.location,crypto:webcrypto,fetch:async()=>{const response=new Response(a.packageText,{headers:{'Content-Type':'application/json'}});Object.defineProperty(response,'url',{value:'https://example.test/package.json'});return response;}},{trustedKeys:[signed.key],execution});
  const ready=await r.ready();assert.equal(ready.ok,mode==='approved',JSON.stringify(ready));if(ready.ok){w.document.querySelector('[data-wydclient-control="Next"]').click();await new Promise(r=>setTimeout(r,20));assert.equal(r.execution().snapshot(r.execution().entry()).properties.CurrentPage,2);}
 }
});
test('CLIENT static helpers retain exact pins, trusted availability and portable operation enforcement',async()=>{
 const {StaticLibraryRegistry}=await import('../wydgine/static-libraries/index.js');
 const library=compileDefinitions([{id:'approved/text',publisher:'approved',static:true,alias:'TextHelpers',version:'1.0.0',properties:{},slots:{},methodRules:{},behaviorSource:'FUNCTION Echo(value AS String) AS String\nRETURN Trim(value)\nEND FUNCTION'}])[0];
 const manifest={...options.manifest,staticLibraries:{'approved/text':'1.0.0'}},modified={...sources,'taskboard.bas':'WITH LIBRARY approved/text\n'+sources['taskboard.bas'].replace('Me.Message = "Local tasks cleared."','Me.Message = TextHelpers.Echo("Local tasks cleared.")')};
 const libraries=new StaticLibraryRegistry([library],{verifiedPrototypes:{'approved/text':'approved'}});
 const result=buildClientPackage(modified,{...options,manifest,libraries});assert.equal(result.definitions.find(d=>d.id==='divdev/taskboard').behavior.libraries[0].id,'approved/text');
 assert.throws(()=>buildClientPackage(modified,{...options,manifest}));assert.throws(()=>buildClientPackage(modified,{...options,manifest:{...manifest,staticLibraries:{'approved/text':'2.0.0'}},libraries}));
 assert.throws(()=>buildClientPackage(modified,{...options,manifest,libraries:new StaticLibraryRegistry([library])}));
});
test('server renderer explicitly rejects semantic CLIENT presentation rather than treating it as HTTP HTML',async()=>{
 const {renderComponent}=await import('../wydgine/components.js'),result=buildClientPackage(sources,options),presentation=result.definitions.find(d=>d.id==='divdev/taskboard').presentation;
 assert.throws(()=>renderComponent({id:'taskboard',presentation},null,{},'/',String),{code:'COMPONENT.TARGET'});
});
