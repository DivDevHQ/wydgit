import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {compileClass,compileFamily,parseDefinition} from '../wydgine/wydbasic/index.js';
import {lowerDefinition} from '../wydgine/definitions/index.js';
import {lowerFamily} from '../wydgine/definitions/family.js';
import {compileDefinitions,loadRepository} from '../wydgine/repository.js';
import {PrototypeRegistry,hydrate,ExecutionContext} from '../wydgine/object-model/index.js';
import {renderComponent} from '../wydgine/components.js';
import {bindMembers} from '../wydgine/object-model/members.js';
import {execute} from '../wydgine/sewn/execute.js';
import {compile} from '../wydgine/wydbasic/index.js';
import {packageFixture} from '../test-support/packages.js';
import {planPackageInstall,applyPackageInstall} from '../wydgine/packages/index.js';
const read=p=>readFileSync(p,'utf8');
const core=compileDefinitions(JSON.parse(read('prototypes/objects.json')));
const manifest=JSON.parse(read('examples/source-components/manifest.json'));
const sources=Object.fromEntries(['card.bas','panel.bas'].map(f=>[f,read(`examples/source-components/${f}`)]));
const options=()=>({manifest,verifiedPackages:{[manifest.id]:manifest.publisher},definitions:core,entry:{type:'divdev/source-panel',id:'source-panel'}});
const build=(s=sources,o=options())=>compileFamily(s,o);
const normalize=x=>JSON.parse(JSON.stringify(x));
const render=node=>renderComponent(node,null,{},'/',s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'));
const scaffold=template=>({schema:'wydgit/0.2',id:'app',prototype:'wydgit.core/app',properties:{title:'App',home:'page'},provenance:{},slots:{pages:[{schema:'wydgit/0.2',id:'page',prototype:'wydgit.core/page',properties:{title:'Page',slug:'page'},provenance:{},slots:{sections:[template]}}]}});

test('source family produces deterministic canonical package resources and complete ordered tree',()=>{
 const actual=build(),reverse=build(Object.fromEntries(Object.entries(sources).reverse()));assert.deepEqual(actual,reverse);
 assert.equal(actual.definitions[0].id,'divdev/source-card');assert.equal(actual.template.prototype,'divdev/source-panel');
 assert.deepEqual(actual.template.slots.blocks.map(c=>c.id),['source-panel-First','source-panel-Second']);
 const registry=new PrototypeRegistry([...core,...actual.definitions]);const runtime=hydrate(scaffold(actual.template),registry);
 assert.equal(runtime.get('source-panel-Second').properties.Status,'Ready');assert.ok(Object.isFrozen(actual.template.slots.blocks));
 assert.deepEqual(JSON.parse(actual.resources['prototypes.json']),normalize(actual.definitions));
 assert.deepEqual(JSON.parse(actual.resources['section.json']),normalize(actual.template));
 assert.equal(Object.hasOwn(actual.definitions[1],'composition'),false);assert.equal(Object.hasOwn(actual.definitions[1],'children'),false);
 const ir=parseDefinition(sources['panel.bas'],{...options(),definitions:[...core,actual.definitions[0]]});assert.equal(ir.schema,'wydgit.definition/0.20');
 assert.deepEqual(lowerFamily([ir,parseDefinition(sources['card.bas'],options())],options()),actual);
 const old=parseDefinition('PUBLIC CLASS Old\nMETA Id = "divdev/old"\nEND CLASS',options());assert.equal(old.schema,'wydgit.definition/0.19');assert.deepEqual(Object.keys(lowerDefinition(old,options())).sort(),['definition','manifest']);
});

test('server presentation bindings render updated state and escape markup; independently authored golden matches',async()=>{
 const actual=build(),card=actual.definitions[0];
 const golden=JSON.parse(read('test/fixtures/families/card.json'));assert.deepEqual(normalize(card),golden);
 for(const definition of [card,golden]){
  const context=new ExecutionContext({context:'FrontEnd',publisher:'caller',self:'card'}),properties={Title:'<script>alert(1)</script>',Status:'Pending'};
  const node={id:'card',prototype:definition.id,properties};const handle=bindMembers({id:node.id,prototype:node.prototype},{context,node:()=>node,set:(k,v)=>{properties[k]=v;}});
  const registry=new PrototypeRegistry([...core,definition]);
  const shown=()=>render({id:node.id,...properties,presentation:registry.get(definition.id).presentation});
  assert.match(shown(),/&lt;script&gt;/);assert.doesNotMatch(shown(),/<script>/);assert.match(shown(),/<p>Pending<\/p>/);
  await execute(compile('CALL Me.Complete()'),{scope:{ME:handle},context,prototypeRegistry:registry});assert.match(shown(),/<p>Complete<\/p>/);assert.match(shown(),/Source authored/);
 }
});

test('source-generated package installs through existing planner and survives source removal',async t=>{
 const fixture=await packageFixture(t),actual=build(),packagePath=fixture.packagePath;
 await fs.writeFile(path.join(packagePath,'manifest.json'),JSON.stringify(actual.manifest));
 for(const [file,text] of Object.entries(actual.resources))await fs.writeFile(path.join(packagePath,file),text);
 const before=loadRepository(fixture.root),ids=[];const walk=id=>{ids.push(id);Object.values(before.runtime.get(id).slots).flat().forEach(walk);};walk(before.runtime.rootId);
 const options={...fixture.options,approvals:actual.manifest.permissions,storageMappings:{},verifiedPackages:{[manifest.id]:manifest.publisher},installationContext:new ExecutionContext({context:'FrontEnd',publisher:'operator',self:'home',app:before.runtime.rootId,visible:[...ids,...manifest.permissions.visible],editable:[...ids,...manifest.permissions.visible],capabilities:['object.instances.edit']})};
 const plan=await planPackageInstall(options);const receipt=await applyPackageInstall(plan);assert.equal(receipt.package,manifest.id);
 const after=loadRepository(fixture.root,{verifiedPackages:options.verifiedPackages});assert.deepEqual(after.runtime.get('source-panel').slots.blocks,['source-panel-First','source-panel-Second']);
 assert.equal(after.registry.get('divdev/source-card').presentation.template.children[0].text.get,'properties.Title');
 await fs.rm(packagePath,{recursive:true});assert.equal(loadRepository(fixture.root).runtime.get('source-panel-First').properties.Title,'First task');
});

test('composition fails atomically for missing dependencies, bad slots, initializer contracts and forged trust',()=>{
 for(const change of [s=>s.replace('"divdev/source-card"','"evil/missing"'),s=>s.replace('SLOT blocks','SLOT missing'),s=>s.replace('PROPERTY Title = "First task"','PROPERTY Title = FALSE'),s=>s.replace('PROPERTY Title = "First task"','PROPERTY Unknown = "x"'),s=>s.replace('CHILD Second','CHILD first'),s=>s.replace('"divdev/source-card"','"divdev/source-panel"')])assert.throws(()=>build({...sources,'panel.bas':change(sources['panel.bas'])}));
 assert.throws(()=>build(sources,{...options(),verifiedPackages:{}}));
 assert.throws(()=>build({...sources,'extra.bas':sources['card.bas']}));
 assert.throws(()=>build(sources,{...options(),entry:{type:'divdev/source-card',id:'card'}}));
 assert.throws(()=>build(sources,{...options(),entry:{type:'divdev/source-panel',id:'invalid id'}}));
 let touched=false;const hostile={};Object.defineProperty(hostile,'card.bas',{enumerable:true,get(){touched=true;return sources['card.bas'];}});assert.throws(()=>build(hostile),{code:'INPUT.JSON'});assert.equal(touched,false);
 assert.throws(()=>build(JSON.parse('{"__proto__":"source"}')),{code:'INPUT.DANGEROUS_KEY'});
 assert.throws(()=>lowerFamily([null],options()),{code:'DEFINITION.FAMILY'});
 try{build({...sources,'card.bas':sources['card.bas'].replace('HEADING Me.Title','HEADING Me.Missing')});assert.fail('expected error');}catch(e){assert.equal(e.code,'WYDBASIC.NAME');assert.equal(e.details.file,'card.bas');assert.ok(e.details.line>0);assert.match(e.message,/card.bas/);}
});

test('presentation checks public exact member identity, target, injection and explicit bounds',()=>{
 for(const change of [s=>s.replace('PUBLIC PROPERTY Title','PRIVATE PROPERTY Title'),s=>s.replace('PUBLIC PROPERTY Title','PUBLIC HIDDEN PROPERTY Title'),s=>s.replace('= "Ready"','= "Ready" REQUIRES ["store.records.read"]'),s=>s.replace('HEADING Me.Title','HEADING Me.content'),s=>s.replace('HEADING Me.Title','HEADING NewId()'),s=>s.replace('LIMIT 256','LIMIT 100'),s=>s.replace(' IN ["Source authored", "Canonical JSON"]',' IN Me.content'),s=>s.replace('PRESENTATION SERVER','PRESENTATION CLIENT'),s=>s.replace('CONTENT Me.Status','SCRIPT "alert(1)"')])assert.throws(()=>build({...sources,'card.bas':change(sources['card.bas'])}));
 assert.throws(()=>build(sources,{...options(),manifest:{...manifest,runtime:['server','client']}}));
 const d=compileClass(sources['card.bas'].replace('Me.Title','Me.[Title]'),options()).definition;assert.equal(d.presentation.template.children[0].text.get,'properties.Title');
});

test('shared language-neutral lowerer rejects hostile IR independently of WBasic',()=>{
 const ir=parseDefinition(sources['card.bas'],options());
 for(const mutate of [x=>x.definition.presentation.template.children[0].text={get:'properties.content.value'},x=>x.definition.properties.Title.access='private',x=>x.definition.presentation.template.tag='script',x=>x.definition.presentation.template.attrs={onclick:'alert(1)'},x=>x.definition.presentation.template.attrs={style:'color:red'},x=>x.composition=[{name:'Bad',type:'evil/missing',slot:'children',properties:{}}]]){const x=structuredClone(ir);mutate(x);assert.throws(()=>lowerDefinition(x,options()));}
 const built=build(),panel=parseDefinition(sources['panel.bas'],{...options(),definitions:[...core,built.definitions[0]]});
 for(const mutate of [x=>x.composition[0].name='constructor',x=>x.composition[0].properties.Title=1,x=>x.composition[0].slot='unknown',x=>x.composition.push(x.composition[0]),x=>x.composition[0].authority=true]){const x=structuredClone(panel);mutate(x);assert.throws(()=>lowerDefinition(x,{...options(),definitions:[...core,built.definitions[0]]}));}
 for(const slot of ['constructor','__proto__',{}]){const x=structuredClone(panel);x.composition[0].slot=slot;assert.throws(()=>lowerDefinition(x,{...options(),definitions:[...core,built.definitions[0]]}),{code:'DEFINITION.SLOT'});}
});

test('family enforces inherited ordering, complete cardinality, composition cycles and global expansion bounds',()=>{
 const inherited={...sources,'derived.bas':'PUBLIC CLASS Derived EXTENDS divdev/source-panel\nMETA Id = "divdev/derived"\nCHILD Third AS "divdev/source-card" INTO blocks\nEND CHILD\nEND CLASS'};
 const o={...options(),entry:{type:'divdev/derived',id:'derived'}};assert.deepEqual(build(inherited,o).template.slots.blocks.map(c=>c.id),['derived-First','derived-Second','derived-Third']);
 assert.throws(()=>build({...inherited,'derived.bas':inherited['derived.bas'].replace('Third','First')},o));
 assert.throws(()=>build({...inherited,'derived.bas':inherited['derived.bas'].replace('CHILD Third','PUBLIC PROPERTY First AS Boolean = FALSE\nCHILD Third')},o));
 const leaf=build().definitions[0],bounded={id:'divdev/bounded',publisher:'divdev',extends:'wydgit.core/section',slots:{blocks:{accepts:['divdev/source-card'],ordered:true,min:3,max:3}}};
 assert.throws(()=>build({'panel.bas':sources['panel.bas'].replace('wydgit.core/section','divdev/bounded')},{...options(),definitions:[...core,leaf,bounded]}));
 const huge='PUBLIC CLASS Huge EXTENDS wydgit.core/section\nMETA Id = "divdev/huge"\n'+Array.from({length:256},(_,i)=>`CHILD Item${i} AS "divdev/source-card" INTO blocks\nEND CHILD`).join('\n')+'\nEND CLASS';
 assert.throws(()=>build({'card.bas':sources['card.bas'],'huge.bas':huge},{...options(),entry:{type:'divdev/huge',id:'huge'}}),{code:'DEFINITION.LIMIT'});
 const cycle={...sources,'panel.bas':sources['panel.bas'].replace('EXTENDS wydgit.core/section','EXTENDS divdev/derived'),'derived.bas':inherited['derived.bas']};assert.throws(()=>build(cycle),{code:'WYDBASIC.CYCLE'});
});
