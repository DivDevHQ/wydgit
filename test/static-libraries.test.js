import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile,compileModule,compilePrototype} from '../wydgine/wydbasic/index.js';
import {compileDefinitions} from '../wydgine/repository.js';
import {StaticLibraryRegistry} from '../wydgine/static-libraries/index.js';
import {installStaticLibraryDirectory} from '../wydgine/static-libraries/package.js';
import {PrototypeRegistry,hydrate} from '../wydgine/object-model/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
const standard=JSON.parse(readFileSync(new URL('../libraries/wbasic/prototypes.json',import.meta.url))).prototypes[0];
const context=limits=>new ExecutionContext({publisher:'application',app:'application',self:'home',limits});
const definition=(id,alias,source,methodRules={},dependencies={},options={})=>({...compileDefinitions([{id,publisher:id.split('/')[0],static:true,alias,version:'1.0.0',dependencies,properties:{},slots:{},methodRules,behaviorSource:source}],options)[0]});
const setup=(definitions=[standard])=>({libraries:new StaticLibraryRegistry(definitions,{verifiedPrototypes:Object.fromEntries(definitions.map(d=>[d.id,d.publisher]))}),dependencies:Object.fromEntries(definitions.map(d=>[d.id,d.version]))});
const options=setup();
const run=async(source,opts=options,scope={},limits={})=>(await execute(compile(source,opts),{scope,context:context(limits)})).value;
const imported=expression=>'WITH LIBRARY divdev/wbasic\nRETURN '+expression;
const source='FUNCTION Echo(value AS String) AS String\nRETURN Helper(value)\nEND FUNCTION\nFUNCTION Helper(value AS String) AS String\nRETURN Trim(value)\nEND FUNCTION\nFUNCTION Unused() AS String\nRETURN "unused"\nEND FUNCTION\nSUB Observe(value AS String)\nCALL SERVICES.Invoke("diagnostic","1.0.0","observe",{"value":value})\nEND SUB';
const utility=()=>definition('acme/text-utilities','TextUtilities',source,{helper:{access:'private'}});

test('explicit ordinary library imports link only referenced methods deterministically',async()=>{
 for(const expression of ['Mid("Goober",2,3)','WBasic.Mid("Goober",2,3)','wbasic.mID("Goober",2,3)'])assert.equal(await run(imported(expression)),'oob');
 const a=compile(imported('Mid("Goober",2,3)'),options),b=compile(imported('Mid("Goober",2,3)'),options);
 assert.deepEqual(a,b);assert.equal(a.schema,'sewn/0.14');assert.equal(Object.keys(a.procedures).length,1);assert.equal(a.libraries[0].version,'1.0.0');assert.equal(a.libraries[0].id,'divdev/wbasic');assert.equal(a.libraries[0].methods.lib0.name,'mid');
 for(const expression of ['Mid("x",1,1)','WBasic.Mid("x",1,1)','Len("x")','InStr("x","x")','UCase("x")','LCase("X")'])assert.throws(()=>compile('RETURN '+expression,options));
 assert.equal(compile('RETURN Substring("Goober",1,3)',options).schema,'sewn/0.12');
 assert.throws(()=>compile('RETURN "x"\nWITH LIBRARY divdev/wbasic',options));
 assert.throws(()=>compileModule('FUNCTION Local() AS String\nWITH LIBRARY divdev/wbasic\nRETURN "x"\nEND FUNCTION',options));
 assert.throws(()=>compile('WITH LIBRARY divdev/WBasic\nRETURN "x"',options));
});

test('WBasic compatibility wrappers implement indexing, casing and strict conversion boundaries',async()=>{
 for(const [expression,expected] of [['Mid("",1,0)',''],['Mid("abc",4,0)',''],['Mid("abc",1,3)','abc'],['Mid("abc",2,1)','b'],['Mid("abc",5,0)',''],['Mid("abc",2,30)','bc'],['Len("")',0],['Len("abc")',3],['InStr("abc","b")',2],['InStr("abc","x")',0],['InStr("abc","")',1],['UCase("goober")','GOOBER'],['LCase("GOOBER")','goober'],['CStr(TRUE)','True'],['CStr(12.5)','12.5'],['CStr("x")','x'],['Val("12.5")',12.5],['Val(12)',12]])assert.equal(await run(imported(expression)),expected,expression);
 for(const expression of ['Mid("abc",0,1)','Mid("abc",1,-1)','Val(" 12 ")','Val("12x")','Val("0x10")','Val("1e400")','Val("1e-400")','Val(TRUE)'])await assert.rejects(run(imported(expression)),{code:'SEWN.TYPE'},expression);
 assert.equal(await run('RETURN Val(" 12 ")'),12);assert.equal(await run('RETURN CStr(FALSE)'),'False');
 assert.equal(compile('RETURN Val(" 12 ")').schema,'sewn/0.7');
 const dt='DateTime("2026-10-13T12:00:00.000Z")';assert.equal(await run(imported(`CStr(${dt})`)),'2026-10-13T12:00:00.000Z');assert.throws(()=>compile(`RETURN CStr(${dt})`));
});

test('third-party public functions, subroutines and private helpers use the same linker',async()=>{
 const opts=setup([standard,utility()]);
 assert.equal(await run('WITH LIBRARY acme/text-utilities\nRETURN TextUtilities.Echo(" title ")',opts),'title');
 const p=compile('WITH LIBRARY acme/text-utilities\nRETURN Echo(" title ")',opts);assert.equal(Object.keys(p.procedures).length,2);assert.deepEqual(Object.values(p.libraries[0].methods).map(m=>m.name).sort(),['echo','helper']);
 assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nRETURN TextUtilities.Helper("x")',opts),{code:'LIBRARY.PRIVATE'});
 assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nRETURN TextUtilities.Missing("x")',opts),{code:'LIBRARY.EXPORT'});
 let observations=0;await run('WITH LIBRARY acme/text-utilities\nCALL TextUtilities.Observe("x")',opts,{SERVICES:{Invoke(){observations++;return {};}}});assert.equal(observations,1);
 await run('WITH LIBRARY acme/text-utilities\nCALL Observe("x")',opts,{SERVICES:{Invoke(){observations++;return {};}}});assert.equal(observations,2);
 assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nRETURN Observe("x")',opts));assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nCALL Echo("x")',opts));
 assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nRETURN Echo(12)',opts));
 await assert.rejects(run('WITH LIBRARY acme/text-utilities\nRETURN Echo(SESSION.input)',opts,{SESSION:{input:12}}),{code:'SEWN.TYPE'});
});

test('resolution rejects ambiguity, alias collisions, missing dependencies and untrusted publishers',async()=>{
 const a=utility(),b=definition('other/text','OtherText','FUNCTION Echo(value AS String) AS String\nRETURN value\nEND FUNCTION');const opts=setup([a,b]);
 const imports='WITH LIBRARY acme/text-utilities\nWITH LIBRARY other/text\n';
 assert.throws(()=>compile(imports+'RETURN Echo("x")',opts),{code:'LIBRARY.AMBIGUOUS'});
 assert.equal(await run(imports+'RETURN OtherText.Echo("x")',opts),'x');
 const module=compileModule(imports+'FUNCTION Echo(value AS String) AS String\nRETURN "local"\nEND FUNCTION\nEVENT Page.Load\nRETURN [Echo("x"),OtherText.Echo("x")]\nEND EVENT',opts);assert.deepEqual((await execute(module.events[0].workflow,{scope:{},context:context()})).value,['local','x']);
 assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nRETURN "x"',{...opts,dependencies:{}}),{code:'LIBRARY.DEPENDENCY'});
 assert.throws(()=>compile('WITH LIBRARY missing/library\nRETURN "x"',{...opts,dependencies:{'missing/library':'1.0.0'}}),{code:'LIBRARY.MISSING'});
 assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nRETURN "x"',{...opts,dependencies:{'acme/text-utilities':'2.0.0'}}),{code:'LIBRARY.VERSION'});
 const untrusted=new StaticLibraryRegistry([a]);assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nRETURN "x"',{libraries:untrusted,dependencies:opts.dependencies}),{code:'LIBRARY.TRUST'});
 const forged={...b,alias:a.alias};assert.throws(()=>compile(imports+'RETURN "x"',setup([a,forged])),{code:'LIBRARY.ALIAS'});
 assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nWITH LIBRARY acme/text-utilities\nRETURN "x"',opts),{code:'LIBRARY.ALIAS'});
 assert.throws(()=>compile('WITH LIBRARY acme/text-utilities\nDIM TextUtilities="x"',opts));
});

test('transitive linking pins implementations and rejects unsupported package cycles',async()=>{
 const base=utility(),baseOptions=setup([base]);
 const composed=definition('other/titles','Titles','WITH LIBRARY acme/text-utilities\nFUNCTION Title(value AS String) AS String\nRETURN TextUtilities.Echo(value)\nEND FUNCTION',{}, {'acme/text-utilities':'1.0.0'},baseOptions);
 const opts=setup([base,composed]);const p=compile('WITH LIBRARY other/titles\nRETURN Title(" x ")',opts);
 assert.equal(Object.keys(p.procedures).length,3);assert.deepEqual(p.libraries.map(lib=>lib.id),['acme/text-utilities','other/titles']);assert.equal((await execute(p,{scope:{},context:context()})).value,'x');
 assert.throws(()=>compile('WITH LIBRARY other/titles\nRETURN Title("x")',{...opts,dependencies:{'other/titles':'1.0.0'}}),{code:'LIBRARY.DEPENDENCY'});
 const upgraded={...base,version:'2.0.0',methodRules:{},behavior:compilePrototype('FUNCTION Echo(value AS String) AS String\nRETURN "new"\nEND FUNCTION',{static:true})};setup([upgraded]);assert.equal((await execute(p,{scope:{},context:context()})).value,'x');
 const cycleA={...base,dependencies:{'other/text':'1.0.0'}},cycleB=definition('other/text','OtherText','FUNCTION Echo(value AS String) AS String\nRETURN value\nEND FUNCTION',{}, {'acme/text-utilities':'1.0.0'});
 assert.throws(()=>setup([cycleA,cycleB]),{code:'LIBRARY.CYCLE'});
});

test('static prototype contracts reject instance state, construction and implicit Me',()=>{
 for(const change of [{static:'yes'},{alias:'bad.alias'},{version:'latest'},{extends:'divdev/wbasic'},{properties:{secret:{type:'string'}}},{slots:{children:{accepts:['divdev/wbasic'],ordered:true}}},{methodRules:{mid:{access:'protected'}}}])assert.throws(()=>new PrototypeRegistry([{...standard,...change}]));
 assert.throws(()=>compilePrototype('FUNCTION Hidden() AS String\nRETURN Me.[secret]\nEND FUNCTION',{static:true}));
 assert.throws(()=>definition('acme/unsafe','Unsafe','FUNCTION Host() AS String\nRETURN process.env\nEND FUNCTION'));
 assert.throws(()=>hydrate({schema:'wydgit/0.2',id:'library',prototype:'divdev/wbasic',properties:{},slots:{},provenance:{}},new PrototypeRegistry([standard])));
 assert.throws(()=>new PrototypeRegistry([standard]).method('divdev/wbasic','mid'));
 assert.throws(()=>definition('acme/intrinsic','Intrinsic','FUNCTION Substring(value AS String) AS String\nRETURN value\nEND FUNCTION'));
});

test('linked wire rejects private cross-library access, implicit Me and malformed provenance',()=>{
 const opts=setup([utility()]),p=compile('WITH LIBRARY acme/text-utilities\nRETURN Echo("x")',opts);
 const corrupt=fn=>{const wire=structuredClone(p);fn(wire);assert.throws(()=>validate(wire),{code:'SEWN.INVALID'});};
 const helper=Object.keys(p.libraries[0].methods).find(n=>p.libraries[0].methods[n].access==='private');
 corrupt(w=>{w.body[0].value.name=helper;});
 corrupt(w=>{w.procedures.lib0.body[0].value={op:'context',name:'ME'};});
 corrupt(w=>{w.procedures.lib0.body[0].value={op:'hostFunction',name:'eval'};});
 corrupt(w=>{w.libraries[0].version='latest';});corrupt(w=>{w.libraries[0].methods.lib0.requires=['*'];});corrupt(w=>{w.libraries.push(w.libraries[0]);});corrupt(w=>{w.schema='sewn/0.13';});
 const foreign=structuredClone(p);foreign.libraries[0].methods.lib0.access='private';foreign.libraries.push({id:'other/foreign',version:'1.0.0',alias:'Foreign',methods:{foreign:{name:'foreign',access:'public',requires:[]}}});foreign.procedures.foreign={kind:'function',params:[],returns:'String',body:[{op:'return',value:{op:'functionCall',name:helper,args:[{op:'literal',value:'x'}]}}]};assert.throws(()=>validate(foreign),{code:'SEWN.INVALID'});
});

test('bounded recursion and nested libraries consume shared caller budgets',async()=>{
 const recursive=definition('acme/recursion','Recursion','FUNCTION Count(value AS Integer) AS Integer\nIF value=0 THEN\nRETURN 0\nEND IF\nRETURN Count(value-1)+1\nEND FUNCTION');const opts=setup([recursive]);
 assert.equal(await run('WITH LIBRARY acme/recursion\nRETURN Count(4)',opts),4);
 for(const limits of [{sewnProcedureDepth:2},{sewnProcedureCalls:2},{sewnSteps:5}])await assert.rejects(run('WITH LIBRARY acme/recursion\nRETURN Count(4)',opts,{},limits),{code:'SEWN.LIMIT'});
 const utilityOptions=setup([utility()]);await assert.rejects(run('WITH LIBRARY acme/text-utilities\nRETURN Echo("x")',utilityOptions,{}, {sewnProcedureCalls:1}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(imported('Mid("Goober",2,3)'),options,{}, {sewnString:3}),{code:'SEWN.LIMIT'});
 assert.throws(()=>compilePrototype('FUNCTION Count(value AS Integer) AS Integer\nRETURN Count(value)\nEND FUNCTION'));
});

test('public visibility cannot launder capability or storage authority',async()=>{
 const scoped=definition('trusted/diagnostic','Diagnostic','FUNCTION ReadSecret() AS Object\nRETURN SERVICES.Invoke("wydstore","1.0.0","query",{"store":"foreign","collection":"secrets"})\nEND FUNCTION',{readsecret:{requires:['store.records.read']}});const opts=setup([scoped]);let called=0;
 await assert.rejects(run('WITH LIBRARY trusted/diagnostic\nRETURN ReadSecret()',opts,{SERVICES:{Invoke(){called++;throw Error('must not execute');}}}),{code:'SEAM.DENIED'});assert.equal(called,0);
 const unguarded={...scoped,methodRules:{}};const deniedContext=context();await assert.rejects(run('WITH LIBRARY trusted/diagnostic\nRETURN ReadSecret()',setup([unguarded]),{SERVICES:{Invoke(){deniedContext.require('store.records.read');}}}),{code:'SEAM.DENIED'});
 const state=definition('acme/isolated','Isolated','FUNCTION Fresh() AS Integer\nDIM counter AS Integer=0\ncounter=counter+1\nRETURN counter\nEND FUNCTION');const stateOptions=setup([state]);assert.deepEqual(await run('WITH LIBRARY acme/isolated\nRETURN [Fresh(),Fresh()]',stateOptions),[1,1]);assert.equal(await run('WITH LIBRARY acme/isolated\nRETURN Fresh()',stateOptions),1);
});

test('development-directory installation preserves explicit host trust and compiled artifact integrity',()=>{
 assert.throws(()=>installStaticLibraryDirectory('libraries/wbasic'),{code:'PACKAGE.UNTRUSTED'});
 const installed=installStaticLibraryDirectory('libraries/wbasic',{verifiedPackages:{'divdev/wbasic':'divdev'}});assert.deepEqual(JSON.parse(JSON.stringify(installed.definitions)),[standard]);assert.equal(installed.version,'1.0.0');
 assert.deepEqual(JSON.parse(JSON.stringify(compilePrototype(readFileSync('libraries/wbasic/library.bas','utf8'),{static:true}))),standard.behavior);
 assert.throws(()=>installStaticLibraryDirectory('libraries/wbasic',{verifiedPackages:{'divdev/wbasic':'other'}}),{code:'PACKAGE.UNTRUSTED'});
});

test('WydClient linked static procedures preserve cancellation and budget enforcement',async()=>{
 const {mountClient}=await import('../wydclient/index.js');class Element extends EventTarget{}
 const workflow=compileModule('WITH LIBRARY divdev/wbasic\nEVENT Change\nIF WBasic.Mid("Goober",2,3)="oob" THEN\nEVENT.Cancel()\nEND IF\nEND EVENT',options).events[0].workflow;
 assert.equal(Object.keys(workflow.procedures).length,1);
 for(const [limits,expected] of [[{},null],[{sewnProcedureCalls:0},'SEWN.LIMIT']]){const element=new Element(),client=mountClient({nodes:[{id:'home',kind:'field',element,value:'old'}],context:context(limits),handlers:[{owner:'home',type:'Change',workflow}]});await client.ready;element.value='new';element.dispatchEvent(new Event('change'));await client.idle();assert.equal(element.value,'old');assert.equal(client.error(),expected);await client.unmount();}
});

test('browser executor consumes portable static wire without compiler or resolver code',async()=>{
 const {build}=await import('esbuild'),{runInNewContext}=await import('node:vm');
 const result=await build({stdin:{contents:"import {execute} from './wydgine/sewn/execute.js';import {ExecutionContext} from './wydgine/seam/context.js';export const run=(p,limits={})=>execute(p,{scope:{},context:new ExecutionContext({publisher:'application',self:'home',limits})});",resolveDir:process.cwd()},bundle:true,platform:'browser',target:'es2022',format:'iife',globalName:'PortableRuntime',write:false,metafile:true});
 for(const input of Object.keys(result.metafile.inputs))assert.ok(!/wydbasic|static-libraries|node_modules|wydstore|storage/.test(input),input);
 const sandbox={setTimeout,clearTimeout};runInNewContext(result.outputFiles[0].text,sandbox);
 const p=JSON.stringify(compile(imported('Mid("Goober",2,3)'),options));
 const browserRun=limits=>runInNewContext(`PortableRuntime.run(JSON.parse(${JSON.stringify(p)}),${JSON.stringify(limits)})`,sandbox);
 assert.equal((await browserRun({})).value,'oob');await assert.rejects(browserRun({sewnProcedureCalls:0}),e=>e.code==='SEWN.LIMIT');
});

test('static calls from instance methods cannot inherit private declaring-class access',async()=>{
 const reader=definition('acme/reader','Reader','FUNCTION ReadHidden(value AS Wydgit) AS String\nRETURN value.[secret]\nEND FUNCTION');const opts=setup([reader]);
 const root={id:'wydgit.core/app',publisher:'wydgit.core',properties:{secret:{type:'string',default:'hidden',access:'private'}},slots:{},behavior:compilePrototype('WITH LIBRARY acme/reader\nFUNCTION Leak() AS String\nRETURN ReadHidden(Me)\nEND FUNCTION',opts)};
 const registry=new PrototypeRegistry([root]),runtime=hydrate({schema:'wydgit/0.2',id:'home',prototype:root.id,properties:{},slots:{},provenance:{}},registry),ctx=new ExecutionContext({publisher:"application",app:"home",self:"home"});
 await assert.rejects(execute(compile('RETURN Me.Leak()'),{scope:{ME:runtime.scope(ctx)},context:ctx,prototypeRegistry:registry}),{code:'OBJECT.ACCESS'});
});

test('application directory installation saves pinned linked handlers and reloads without a resolver',async t=>{
 const fs=await import('node:fs/promises'),path=await import('node:path');const {packageFixture}=await import('../test-support/packages.js');
 const {planPackageInstall,applyPackageInstall,packageBindings}=await import('../wydgine/packages/index.js');const {loadRepository}=await import('../wydgine/repository.js');
 const fixture=await packageFixture(t);fixture.manifest.staticLibraries={'divdev/wbasic':'1.0.0'};
 await fs.writeFile(path.join(fixture.packagePath,'manifest.json'),JSON.stringify(fixture.manifest));
 await fs.writeFile(path.join(fixture.packagePath,'refresh.bas'),'WITH LIBRARY divdev/wbasic\nEVENT Page.PreRender\nRETURN Mid("Goober",2,3)\nEND EVENT');
 await assert.rejects(planPackageInstall(fixture.options),{code:'PACKAGE.STATIC'});
 const plan=await planPackageInstall({...fixture.options,staticLibraries:options.libraries});assert.equal(plan.compiledSources.refresh.events[0].workflow.libraries[0].version,'1.0.0');
 await applyPackageInstall(plan);const model=loadRepository(fixture.root),entry=model.installed.packages[0],bound=packageBindings(entry,model.registry,model.runtime);const workflow=bound.handlers[0].workflow;
 assert.equal((await execute(workflow,{scope:{},context:context()})).value,'oob');assert.equal(Object.keys(workflow.procedures).length,1);
 await fs.writeFile(path.join(fixture.packagePath,'refresh.bas'),'invalid source');assert.deepEqual(packageBindings(loadRepository(fixture.root).installed.packages[0],model.registry,model.runtime).handlers[0].workflow,workflow);
});

test('private subroutines, dynamic result checks and operation budgets retain the shared execution contract',async()=>{
 const observer=definition('acme/observer','Observer','SUB Observe(value AS String)\nCALL Internal(value)\nEND SUB\nSUB Internal(value AS String)\nCALL SERVICES.Invoke("diagnostic","1.0.0","observe",{"value":value})\nEND SUB',{internal:{access:'private'}}),opts=setup([observer]);let called=0;
 await run('WITH LIBRARY acme/observer\nCALL Observe("x")',opts,{SERVICES:{Invoke(){called++;return {};}}});assert.equal(called,1);
 assert.throws(()=>compile('WITH LIBRARY acme/observer\nCALL Observer.Internal("x")',opts),{code:'LIBRARY.PRIVATE'});
 await assert.rejects(run('WITH LIBRARY acme/observer\nCALL Observe("x")',opts,{SERVICES:{Invoke(){called++;return {};}}},{sewnServiceCalls:0}),{code:'SEWN.LIMIT'});assert.equal(called,1);
 const dynamic=definition('acme/dynamic','Dynamic','FUNCTION Text() AS String\nRETURN SESSION.input\nEND FUNCTION');await assert.rejects(run('WITH LIBRARY acme/dynamic\nRETURN Text()',setup([dynamic]),{SESSION:{input:42}}),{code:'SEWN.TYPE'});
 const iteration=definition('acme/iteration','Iteration','FUNCTION Total() AS Integer\nDIM n AS Integer=0\nFOR i=1 TO 3\nn=n+i\nNEXT\nRETURN n\nEND FUNCTION');await assert.rejects(run('WITH LIBRARY acme/iteration\nRETURN Total()',setup([iteration]),{},{sewnIterations:2}),{code:'SEWN.LIMIT'});
 await assert.rejects(run(imported('Mid("x",1,1)'),options,{},{sewnTimeMs:0}),{code:'SEWN.LIMIT'});
 const {mountClient}=await import('../wydclient/index.js');assert.throws(()=>mountClient({nodes:[{id:'home',element:new EventTarget()}],context:context(),handlers:[{owner:'home',type:'Client.Ready',wydBasic:'RETURN "source"'}]}),{code:'EVENT.INVALID'});
 const {build}=await import('esbuild');const browser=await build({entryPoints:['wydclient/index.js'],bundle:true,platform:'browser',target:'es2022',format:'esm',write:false,metafile:true});for(const input of Object.keys(browser.metafile.inputs))assert.ok(!/wydbasic|static-libraries/.test(input),input);
});
