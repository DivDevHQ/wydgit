import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileClass,parseDefinition,compile,compileInterface } from '../wydgine/wydbasic/index.js';
import { lowerDefinition } from '../wydgine/definitions/index.js';
import { PrototypeRegistry,ExecutionContext,hydrate,dehydrate } from '../wydgine/object-model/index.js';
import { bindMembers } from '../wydgine/object-model/members.js';
import { execute } from '../wydgine/sewn/execute.js';
import { compileDefinitions } from '../wydgine/repository.js';
import { validate } from '../wydgine/sewn/validate.js';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const manifest=read('../examples/guestbook/manifest.json');
const core=compileDefinitions(read('../prototypes/objects.json'));
const source=readFileSync(new URL('./fixtures/classes/task-card.bas',import.meta.url),'utf8');
const verified=ds=>Object.fromEntries(ds.map(d=>[d.id,d.publisher]));
const options=(definitions=core)=>({manifest,verifiedPackages:{[manifest.id]:manifest.publisher},definitions,registryOptions:{verifiedPrototypes:verified(definitions)}});
const build=(s=source,o=options())=>compileClass(s,o).definition;
const wrap=body=>`PUBLIC CLASS Card\nMETA Id = "divdev/card"\n${body}\nEND CLASS`;
function host(ds,id,properties={},limits={}) {
 const registry=new PrototypeRegistry(ds,{verifiedPrototypes:verified(ds)}),context=new ExecutionContext({publisher:'caller',self:'card',visible:['card'],limits});
 const node={id:'card',prototype:id,properties};let live=true;
 const handle=bindMembers({id:'card',prototype:id},{context,node(){assert.ok(live);return node;},set(name,value){node.properties[name]=value;}});
 return {context,prototypeRegistry:registry,scope:{ME:handle},node,dispose(){live=false;}};
}
const run=(s,h)=>execute(compile(s),h);
test('class fixture: deterministic canonical output, inherited base, properties, typed methods and package manifest',async()=>{
 const d=build();assert.deepEqual(d,build());assert.equal(d.extends,'wydgit.core/block');assert.equal(d.properties.Cache.access,'private');assert.equal(d.properties.Key.required,true);assert.equal(d.behavior.schema,'sewn/0.5');validate(d.behavior);
 const h=host([...core,d],d.id,{Complete:false});await run('CALL Me.SetComplete(TRUE)',h);assert.equal((await run('RETURN Me.IsComplete()',h)).value,true);
 const envelope=(id,prototype,properties,slots={})=>({schema:'wydgit/0.2',id,prototype,properties,slots,provenance:{}});
 const runtime=hydrate(envelope('app','wydgit.core/app',{title:'App',home:'page'},{pages:[envelope('page','wydgit.core/page',{title:'Page',slug:'page'},{sections:[envelope('section','wydgit.core/section',{}, {blocks:[envelope('card',d.id,{Key:'one'})]})]})]}),h.prototypeRegistry);
 const json=dehydrate(runtime).slots.pages[0].slots.sections[0].slots.blocks[0];assert.equal(json.properties.Title,'Untitled');assert.equal(Object.hasOwn(json.properties,'Cache'),false);
 assert.equal(compileClass(source,options()).manifest.version,manifest.version);assert.equal(d.version,undefined);
});
test('shared IR golden fixture: independent JSON and WBasic definitions have identical semantics and behavior',async()=>{
 const actual=build(wrap('PUBLIC PROPERTY Ready AS Boolean = FALSE\nPUBLIC FUNCTION IsReady() AS Boolean\nRETURN Me.Ready\nEND FUNCTION'));
 const expected=read('./fixtures/classes/golden.json');assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
 for(const d of [actual,expected]){const h=host([d],d.id,{Ready:true});assert.equal((await run('RETURN Me.IsReady()',h)).value,true);}
 const ir=parseDefinition(wrap(''),options());assert.deepEqual(lowerDefinition(ir,options()).definition,build(wrap('')));
});
test('trusted metadata rejects forged publisher, conflicting identities, versions, unsupported source fields and incomplete manifests',()=>{
 for(const [s,o] of [[source, {...options(),verifiedPackages:{}}],[source.replace('META Id', 'META Publisher = "evil"\nMETA Id'),options()],[source,{...options(),id:'divdev/other'}],[source.replace('META Id','META Version = "99.0.0"\nMETA Id'),options()],[source.replace('META Id','META Description = "text"\nMETA Id'),options()],[source,{...options(),manifest:{publisher:'divdev'}}],[source.replace('divdev/task-card','evil/task-card'),options()]])assert.throws(()=>build(s,o));
 assert.throws(()=>build('PUBLIC CLASS Wydgit\nMETA Id = "divdev/root"\nEND CLASS'));
 assert.throws(()=>build(wrap('META Id = "divdev/card"')));
 assert.throws(()=>build(wrap('PUBLIC PROPERTY Publisher AS String')));
});
test('properties enforce portable types, deterministic defaults, required rules and closed class syntax',()=>{
 for(const body of ['PUBLIC PROPERTY Value AS Integer = 1','PUBLIC PROPERTY Value AS DateTime','PUBLIC PROPERTY Value AS Wydgit','PUBLIC PROPERTY Value AS Boolean = 1','PUBLIC PROPERTY Value AS String = NewId()','PUBLIC PROPERTY Value AS Object = {"__proto__":{}}','PUBLIC PROPERTY Value AS String\nPUBLIC PROPERTY value AS String','PUBLIC PROPERTY Ready AS Boolean\nPUBLIC SUB Ready()\nEND SUB','PUBLIC PRIVATE PROPERTY Value AS String','PUBLIC PROPERTY Value AS Number = 1 / 0','PUBLIC SUB Test()\nMe.Missing = TRUE\nEND SUB','PUBLIC PROPERTY Ready AS Boolean\nPUBLIC SUB Test()\nMe.Ready = "yes"\nEND SUB'])assert.throws(()=>build(wrap(body)),body);
 assert.throws(()=>build(wrap('')+'\n'+wrap('')));assert.throws(()=>build(wrap('RETURN 1')));
});
test('abstract methods, explicit override contracts, virtual dispatch and inherited declaring context',async()=>{
 const base=build(wrap('PUBLIC MUSTOVERRIDE FUNCTION Value() AS String\nPUBLIC FUNCTION Routed() AS String\nRETURN Me.Value()\nEND FUNCTION').replace('PUBLIC CLASS','PUBLIC MUSTINHERIT CLASS'));
 const derivedSource='PUBLIC CLASS Derived EXTENDS divdev/card\nMETA Id = "divdev/derived"\nPUBLIC OVERRIDE FUNCTION Value() AS String\nRETURN "derived"\nEND FUNCTION\nEND CLASS';
 const derived=build(derivedSource,options([...core,base]));assert.equal((await run('RETURN Me.Routed()',host([base,derived],derived.id))).value,'derived');
 assert.throws(()=>build(derivedSource.replace('PUBLIC OVERRIDE FUNCTION Value() AS String\nRETURN "derived"\nEND FUNCTION',''),options([...core,base])));
 assert.throws(()=>hydrate({schema:'wydgit/0.2',id:'base',prototype:base.id,properties:{},slots:{},provenance:{}},new PrototypeRegistry([base])));
 for(const change of [s=>s.replace('OVERRIDE ',''),s=>s.replace('AS String','AS Boolean'),s=>s.replace('PUBLIC OVERRIDE','PRIVATE OVERRIDE')])assert.throws(()=>build(change(derivedSource),options([...core,base])));
 const concrete=build(wrap('PRIVATE PROPERTY Secret AS String = "base"\nPUBLIC VIRTUAL FUNCTION Value() AS String\nRETURN Me.Secret\nEND FUNCTION'));
 const inherited=build('PUBLIC CLASS Derived EXTENDS divdev/card\nMETA Id = "divdev/derived"\nEND CLASS',options([concrete]));assert.equal((await run('RETURN Me.Value()',host([concrete,inherited],inherited.id,{Secret:'base'}))).value,'base');
 assert.throws(()=>build(derivedSource,options([{...concrete,methodContracts:{value:{...concrete.methodContracts.value,virtual:false}}}])));
 assert.throws(()=>build(derivedSource.replace('RETURN "derived"','RETURN Me.Secret'),options([concrete])));
 const friend={...build(wrap('FRIEND PROPERTY Shared AS String = "shared"')),friends:['divdev/derived']};
 const allowed=build(derivedSource.replace('PUBLIC OVERRIDE FUNCTION Value','PUBLIC FUNCTION Value').replace('RETURN "derived"','RETURN Me.Shared'),options([friend]));assert.equal((await run('RETURN Me.Value()',host([friend,allowed],allowed.id,{Shared:'shared'}))).value,'shared');
});
test('interfaces use exact manifest pins, canonical conformance, Cast and stable identity',async()=>{
 const contract=compileInterface('INTERFACE IReady\nFUNCTION IsReady() AS Boolean\nEND INTERFACE',{id:'divdev/iready',publisher:'divdev',version:'1.0.0'});
 const o=options([...core,contract]);o.manifest={...manifest,interfaces:{'divdev/iready':'1.0.0'}};
 const d=build(wrap('IMPLEMENTS "divdev/iready"\nPUBLIC FUNCTION IsReady() AS Boolean\nRETURN TRUE\nEND FUNCTION'),o),h=host([...core,contract,d],d.id);
 const program=compile('DIM view AS IReady = Cast(Me,IReady)\nRETURN [view IS Me,view.IsReady(),Implements(Me,IReady)]',{prototypeRegistry:h.prototypeRegistry,dependencies:o.manifest.interfaces});
 assert.deepEqual(JSON.parse(JSON.stringify((await execute(program,h)).value)),[true,true,true]);
 assert.throws(()=>build(wrap('IMPLEMENTS "divdev/iready"'),o));assert.throws(()=>build(wrap('IMPLEMENTS "divdev/iready"'),options([contract])));
});
test('lifecycle is validated isolated hook metadata with no public, protected or lexical invocation path',async()=>{
 const d=build();assert.ok(d.lifecycle.Init);assert.equal(d.behavior.procedures.init,undefined);
 const h=host([...core,d],d.id,{Complete:false});await assert.rejects(run('CALL Me.Init()',h));
 for(const body of ['PUBLIC SUB Init()\nEND SUB','PROTECTED OVERRIDE FUNCTION Init() AS Boolean\nRETURN TRUE\nEND FUNCTION','PROTECTED OVERRIDE SUB Dispose(value AS String)\nEND SUB','PUBLIC SUB Go()\nCALL Me.Dispose()\nEND SUB'])assert.throws(()=>build(wrap(body)));
 for(const lifecycle of [{Start:d.lifecycle.Init},{Init:{...d.lifecycle.Init,extra:true}},{Init:{schema:'sewn/0.3',procedures:{init:{kind:'sub',params:[{name:'x',type:'String'}],body:[]}},body:[]}}])assert.throws(()=>new PrototypeRegistry([{...d,lifecycle},...core]));
});
test('event contracts are typed, inherited and unambiguously owned; unsupported delivery is rejected',()=>{
 const d=build();assert.equal(d.events.Changed.params[0].type,'Boolean');assert.equal(new PrototypeRegistry([...core,d]).get(d.id).eventOwners.Changed,d.id);
 for(const body of ['PUBLIC EVENT Changed(x AS Wydgit)','PUBLIC EVENT Changed(x AS String,x AS Number)','PUBLIC EVENT Init()','PUBLIC EVENT Foo()\nPUBLIC PROPERTY foo AS String','PUBLIC SUB Go()\nRAISE EVENT Changed(TRUE)\nEND SUB','PUBLIC SUB Go()\nEVENT.Raise("Page.Load",Me,{})\nEND SUB'])assert.throws(()=>build(wrap(body)));
 assert.throws(()=>new PrototypeRegistry([...core,{...d,events:{Changed:{access:'public',params:[],authority:true}}}]));
 assert.throws(()=>build('PUBLIC CLASS Derived EXTENDS divdev/task-card\nMETA Id = "divdev/derived"\nPUBLIC EVENT Changed()\nEND CLASS',options([...core,d])));
});
test('shared validation denies hostile inheritance, schema mutation, capability removal and injected host code',()=>{
 assert.throws(()=>build(wrap('').replace('CLASS Card','CLASS Card EXTENDS missing/parent')));
 assert.throws(()=>build(wrap('').replace('CLASS Card','CLASS Card EXTENDS other/base'),options([{id:'other/base',publisher:'other'}])));
 const ir=parseDefinition(wrap(''),options());for(const mutate of [x=>x.extra=true,x=>x.definition.methods={},x=>x.metadata.capabilities=['*'],x=>x.definition.properties.__proto__={},x=>x.definition.behavior.body.push({op:'eval',code:'process.exit()'}),x=>x.definition.extends=x.definition.id]){const value=structuredClone(ir);mutate(value);assert.throws(()=>lowerDefinition(value,options()));}
 for(const body of ['PUBLIC FUNCTION Hack() AS Object\nRETURN process.env\nEND FUNCTION','PUBLIC SUB Hack()\nCALL require("fs")\nEND SUB','PUBLIC PROPERTY constructor AS String'])assert.throws(()=>build(wrap(body)));
});
test('class method execution preserves caller capabilities, shared budgets and stale reference failures',async()=>{
 const d=build(wrap('PUBLIC FUNCTION Value() AS Boolean\nRETURN TRUE\nEND FUNCTION'));d;const h=host([d],d.id,{}, {sewnProcedureCalls:0});await assert.rejects(run('RETURN Me.Value()',h),{code:'SEWN.LIMIT'});
 const guarded=structuredClone(d);guarded.methodRules.value.requires=['store.records.read'];await assert.rejects(run('RETURN Me.Value()',host([guarded],d.id)),{code:'SEAM.DENIED'});
 const stale=host([d],d.id);stale.dispose();await assert.rejects(run('RETURN Me.Value()',stale));
});
test('explicit static imports retain exact dependency pins and linked helpers cannot become instance methods',async()=>{
 const {StaticLibraryRegistry}=await import('../wydgine/static-libraries/index.js');
 const library=read('../libraries/wbasic/prototypes.json').prototypes[0];
 const libraries=new StaticLibraryRegistry([library],{verifiedPrototypes:{[library.id]:library.publisher}});
 const o={...options(),manifest:{...manifest,staticLibraries:{'divdev/wbasic':'1.0.0'}},libraries};
 const text='WITH LIBRARY divdev/wbasic\n'+wrap('PUBLIC FUNCTION Label(value AS String) AS String\nRETURN Mid(value,2,3)\nEND FUNCTION');
 const d=build(text,o),h=host([...core,d],d.id);assert.equal((await run('RETURN Me.Label("Goober")',h)).value,'oob');
 assert.equal(d.behavior.libraries[0].version,'1.0.0');
 for(const lib of d.behavior.libraries)for(const name of Object.keys(lib.methods))assert.throws(()=>h.prototypeRegistry.method(d.id,name));
 assert.throws(()=>build(text,{...o,manifest:{...manifest,staticLibraries:{'divdev/wbasic':'9.0.0'}}}));
 assert.throws(()=>build(wrap('PUBLIC FUNCTION Label(value AS String) AS String\nRETURN Mid(value,2,3)\nEND FUNCTION'),o));
});
test('event emission diagnoses declaration and typed arguments before rejecting unsupported runtime delivery',()=>{
 const s=arg=>wrap(`PUBLIC EVENT Changed(value AS Boolean)\nPUBLIC SUB Go()\nRAISE EVENT Changed(${arg})\nEND SUB`);
 assert.throws(()=>build(s('1')),{code:'WYDBASIC.TYPE'});
 assert.throws(()=>build(s('TRUE')),{code:'WYDBASIC.UNSUPPORTED'});
 assert.throws(()=>build(s('TRUE').replace('RAISE EVENT Changed','RAISE EVENT Missing')),{code:'WYDBASIC.NAME'});
 const ir=parseDefinition(wrap('PUBLIC PROPERTY Ready AS Boolean = TRUE'),options());
 for(const mutate of [d=>d.properties.Ready.default='true',d=>d.properties.Ready.required='yes',d=>d.events={ServerStart:{access:'public',params:[],family:'Server'}},d=>d.methodContracts={evil:{kind:'sub',params:[],access:'public',virtual:true,abstract:true}}]){const x=structuredClone(ir);mutate(x.definition);assert.throws(()=>lowerDefinition(x,options()));}
});
test('source enums and capability requirements preserve canonical property and abstract override restrictions',async()=>{
 const s=wrap('PUBLIC PROPERTY Mode AS String = "a" ENUM ["a","b"] REQUIRES ["store.records.read"]\nPUBLIC FUNCTION ReadMode() AS String REQUIRES ["store.records.read"]\nRETURN Me.Mode\nEND FUNCTION');
 const d=build(s);assert.deepEqual([...d.properties.Mode.enum],['a','b']);assert.deepEqual([...d.methodRules.readmode.requires],['store.records.read']);
 await assert.rejects(run('RETURN Me.ReadMode()',host([d],d.id,{Mode:'a'})),{code:'SEAM.DENIED'});
 assert.throws(()=>build(s.replace('= "a"','= "c"')));assert.throws(()=>build(s.replace('"store.records.read"','"*"')));
 const base=build(wrap('PUBLIC MUSTOVERRIDE FUNCTION Value() AS Boolean REQUIRES ["store.records.read"]').replace('PUBLIC CLASS','PUBLIC MUSTINHERIT CLASS'));
 const child='PUBLIC CLASS Child EXTENDS divdev/card\nMETA Id = "divdev/child"\nPUBLIC OVERRIDE FUNCTION Value() AS Boolean\nRETURN TRUE\nEND FUNCTION\nEND CLASS';
 assert.throws(()=>build(child,options([base])));
 const accepted=build(child.replace('AS Boolean\nRETURN','AS Boolean REQUIRES ["store.records.read"]\nRETURN'),options([base]));assert.equal(accepted.overrides[0],'value');
});
