import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {provisionExample} from '../examples/multi-app/setup.js';
import {createMultiAppHost,validateAppInventory} from '../wydgine/trusted/worker.js';
import {createGate} from '@wydgit/gate/client';
import {manifest as gateManifest} from '@wydgit/gate';
import {ExecutionContext} from '../wydgine/seam/context.js';
const password='long isolated test passphrase';
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-multi-'));let host;t.after(async()=>{try{await host?.dispose();}catch{}await fs.rm(root,{recursive:true,force:true});});const config=await provisionExample(root);return {root,config,async start(options={}){host=await createMultiAppHost(config,{root,...options});return host;}};}
const context=(h,token,extra={})=>h.context(token,{context:'FrontEnd',publisher:'acme',package:'acme/demo',installation:'same-installation',self:'home',capabilities:['store.records.read','store.records.create','store.records.write','search.documents.read','stream.media.read','files.storage.read','files.storage.list'],scopes:{wydstore:[{store:'main',collection:'records'}],wydsearch:[{index:'main'}],wydstream:[{resource:'media'}],wydfiles:[{path:'/'}]},...extra});
const invoke=(h,t,c,lib,op,input)=>h.bind(t,c).invoke(lib,'1.0.0',op,input);
test('two real Apps isolate identical logical storage, Gate identity, HTTP sessions and service scopes',async t=>{
 const f=await fixture(t),h=await f.start({execution:Object.fromEntries(['app-alpha','app-beta'].map(id=>[id,{gateContext:new ExecutionContext({context:'FrontEnd',publisher:'host',package:'host:gate',app:id,self:'home',capabilities:gateManifest.capabilities,scopes:{wydgate:[id]}})}]))}),[a,b]=await Promise.all(['app-alpha','app-beta'].map(id=>h.activate(id)));
 const ca=context(h,a),cb=context(h,b),da=h.bind(a,ca),db=h.bind(b,cb);
 assert.notEqual(a,b);assert.equal(h.select('app-alpha'),a);
 const resource={store:'main',collection:'records'};
 const results=await Promise.all([da.invoke('wydstore','1.0.0','create',{...resource,id:'same',data:{name:'Alpha private'}}),db.invoke('wydstore','1.0.0','create',{...resource,id:'same',data:{name:'Beta private'}})]);assert.ok(results.every(r=>r.ok),JSON.stringify(results));
 assert.equal((await da.invoke('wydstore','1.0.0','get',{...resource,id:'same'})).value.data.name,'Alpha private');assert.equal((await db.invoke('wydstore','1.0.0','get',{...resource,id:'same'})).value.data.name,'Beta private');
 assert.throws(()=>h.bind(b,ca));assert.throws(()=>h.bind(a,{...ca}));assert.throws(()=>h.context(a,{...ca,app:'app-beta'}));assert.throws(()=>h.select('unknown'));assert.throws(()=>h.bind(JSON.parse('{}'),ca));
 const {keyFor}=await import('../packages/wydfiles/src/contract.js');await fs.writeFile(path.join(f.root,'app-alpha/files',keyFor('/same')),'Alpha private bytes');
 assert.equal((await da.invoke('wydfiles','1.0.0','exists',{path:'/same'})).value.exists,true);assert.equal((await db.invoke('wydfiles','1.0.0','exists',{path:'/same'})).value.exists,false);
 assert.equal((await da.invoke('wydsearch','1.0.0','search',{index:'main',query:'alpha'})).value.total,1);assert.equal((await db.invoke('wydsearch','1.0.0','search',{index:'main',query:'alpha'})).value.total,0);
 for(const lib of ['wydsearch','wydstream','wydfiles']){const [op,input]=lib==='wydsearch'?['search',{index:'main',query:'private'}]:lib==='wydstream'?['list',{resource:'media'}]:['exists',{path:'/same'}];assert.equal((await da.invoke(lib,'1.0.0',op,input)).ok,true,lib);assert.equal((await db.invoke(lib,'1.0.0',op,input)).ok,true,lib);assert.throws(()=>h.bind(b,ca));}
 const gate=(token,id)=>createGate(h.bind(token,context(h,token,{publisher:'host',package:'host:gate',capabilities:gateManifest.capabilities,scopes:{wydgate:[id]}})));
 const ga=gate(a,'app-alpha'),gb=gate(b,'app-beta');const users=await Promise.all([ga.register({username:'alice',password}),gb.register({username:'alice',password})]);assert.equal(users[0].membership.app,'app-alpha');assert.equal(users[1].membership.app,'app-beta');
 const [la,lb]=await Promise.all([ga.login('alice',password),gb.login('alice',password)]);await assert.rejects(gb.resolveSession(la.token));const identityA=await ga.resolveSession(la.token),identityB=await gb.resolveSession(lb.token);assert.equal(identityA.app,'app-alpha');
 const mediaContext=(token,identity)=>context(h,token,{identity,capabilities:['stream.media.upload'],scopes:{wydstream:[{resource:'media'}]}}),ma=h.bind(a,mediaContext(a,identityA)),mb=h.bind(b,mediaContext(b,identityB));
 const [ta,tb]=await Promise.all([ma.invoke('wydstream','1.0.0','create-upload',{resource:'media'}),mb.invoke('wydstream','1.0.0','create-upload',{resource:'media'})]);assert.equal(ta.ok,true,JSON.stringify(ta));assert.equal(tb.ok,true,JSON.stringify(tb));assert.equal((await mb.invoke('wydstream','1.0.0','complete-upload',{resource:'media',id:ta.value.id,token:ta.value.token})).code,'STREAM.NOT_FOUND');assert.equal((await mb.invoke('wydstream','1.0.0','complete-upload',{resource:'media',id:tb.value.id,token:tb.value.token})).code,'STREAM.STATE');
 assert.equal((await invoke(h,a,context(h,a,{identity:identityA,capabilities:[]}), 'wydstore','count',resource)).code,'SEAM.DENIED');await ga.logout(la.token);assert.equal((await gb.resolveSession(lb.token)).app,'app-beta');
 const [sa,sb]=await Promise.all([h.listen(a,0,'127.0.0.1'),h.listen(b,0,'127.0.0.1')]);const ua='http://127.0.0.1:'+sa.address().port,ub='http://127.0.0.1:'+sb.address().port;
 const freshLogin=await ga.login('alice',password);const own=await fetch(ua,{headers:{cookie:'__Host-wydgit-auth='+freshLogin.token}});assert.equal(own.status,200);await own.text();const wrong=await fetch(ub,{headers:{cookie:'__Host-wydgit-auth='+freshLogin.token}});assert.equal(wrong.status,403);await wrong.text();
 const asset=await (await fetch(ub+'/css/site.css')).text();assert.match(asset,/App asset: app-beta/);assert.doesNotMatch(asset,/App asset: app-alpha/);
 const [ra,rb]=await Promise.all([fetch(ua),fetch(ub)]);assert.equal(ra.status,200);assert.equal(rb.status,200);const cookie=ra.headers.get('set-cookie').split(';')[0];await ra.text();await rb.text();const foreign=await fetch(ub+'/?app=app-alpha',{headers:{cookie}});assert.equal(foreign.status,200);assert.notEqual(foreign.headers.get('set-cookie').split(';')[0],cookie);assert.match(await foreign.text(),/app-beta/);
 await h.stop(a);await h.stop(a);assert.throws(()=>h.select('app-alpha'));await assert.rejects(da.invoke('wydstore','1.0.0','get',{...resource,id:'same'}));await assert.rejects(h.activate('app-alpha'));assert.equal((await db.invoke('wydstore','1.0.0','count',resource)).value,1);assert.equal((await fetch(ub)).status,200);await h.stop(b);assert.ok(h.status().every(s=>s.state==='stopped'));await h.dispose();
});
test('inventory rejects identity, root, ownership and policy ambiguity before startup',async t=>{
 const f=await fixture(t);
 for(const change of [c=>c.extra=true,c=>c.schema='other',c=>c.apps.push({...c.apps[0]}),c=>c.apps[1].id='APP-ALPHA',c=>c.apps[1].root=c.apps[0].root,c=>c.apps[0].root='../outside',c=>c.apps[0].root='missing',c=>c.apps[0].id='other',c=>c.apps[0].limits={sewnSteps:10001},c=>c.apps[0].limits={anything:1},c=>c.apps[0].limits={sewnProgramNodes:1}]){const c=structuredClone(f.config);change(c);await assert.rejects(validateAppInventory(c,{root:f.root}),e=>e.code.startsWith('HOST.'));}
 const file=path.join(f.root,'app-alpha/wydgit.config.json'),original=await fs.readFile(file),config=JSON.parse(original);config.libraries[0].options.stores[0].app='app-beta';await fs.writeFile(file,JSON.stringify(config));await assert.rejects(f.start(),{code:'HOST.OWNER'});await fs.writeFile(file,original);
 await fs.symlink(path.join(f.root,'app-alpha'),path.join(f.root,'alias'));const c=structuredClone(f.config);c.apps[0].root='alias';await assert.rejects(validateAppInventory(c,{root:f.root}),{code:'HOST.ROOT'});
});

test('startup failure is isolated, sanitized and terminal; Server Stop failure still retires bindings',async t=>{
 const f=await fixture(t),log=[];
 const h=await f.start({execution:{'app-alpha':{lifecycleHandlers:[{type:'Server.Start',owner:'app-alpha',run:function(){throw Error('private-secret');}}]},'app-beta':{lifecycleHandlers:[{type:'Server.Start',owner:'app-beta',run:function(){log.push('start');}},{type:'Server.Stop',owner:'app-beta',run:function(){log.push('stop');throw Error('secret');}}]}}});
 await assert.rejects(h.activate('app-alpha'),e=>e.code==='HOST.STARTUP'&&!JSON.stringify(e).includes('secret'));
 const b=await h.activate('app-beta'),contextB=context(h,b),bound=h.bind(b,contextB);assert.deepEqual(log,['start']);await assert.rejects(h.activate('app-alpha'));
 await assert.rejects(h.stop(b),{code:'HOST.CLEANUP'});assert.deepEqual(log,['start','stop']);await assert.rejects(bound.invoke('wydstore','1.0.0','count',{store:'main',collection:'records'}));assert.ok(h.status().every(s=>s.state==='failed'));
});
test('accepted HTTP work drains before App stop, while sibling requests and event ordering remain independent',async t=>{
 const f=await fixture(t);f.config.maxPending=1;let entered,release;const started=new Promise(r=>entered=r),pause=new Promise(r=>release=r),log=[];
 const handler=id=>[{type:'Page.Load',owner:'home',run:async function(){log.push(id+':first');assert.equal(this.SERVER.App,id);if(id==='app-alpha'){entered();await pause;}}},{type:'Page.Load',owner:'home',run:function(){log.push(id+':second');}}];
 const h=await f.start({execution:{'app-alpha':{handlers:handler('app-alpha')},'app-beta':{handlers:handler('app-beta')}}});const [a,b]=await Promise.all(['app-alpha','app-beta'].map(id=>h.activate(id)));
 const [sa,sb]=await Promise.all([h.listen(a,0,'127.0.0.1'),h.listen(b,0,'127.0.0.1')]),url=server=>'http://127.0.0.1:'+server.address().port;
 const pending=fetch(url(sa));await started;const overloaded=await fetch(url(sa));assert.equal(overloaded.status,503);await overloaded.text();const stopping=h.stop(a);assert.throws(()=>h.select('app-alpha'));const survivor=await fetch(url(sb));assert.equal(survivor.status,200);await survivor.text();release();const result=await pending;assert.equal(result.status,200);await result.text();await stopping;
 assert.deepEqual(log.filter(v=>v.startsWith('app-alpha')),['app-alpha:first','app-alpha:second']);assert.deepEqual(log.filter(v=>v.startsWith('app-beta')),['app-beta:first','app-beta:second']);await Promise.all([h.stop(b),h.stop(b)]);assert.ok(h.status().every(e=>e.state==='stopped'));
});
test('App limits are immutable reductions; bad publisher/package/scope never inherits sibling grants',async t=>{
 const f=await fixture(t);f.config.apps[0].limits={sewnSteps:20};const h=await f.start(),a=await h.activate('app-alpha'),b=await h.activate('app-beta');
 const low=context(h,a,{limits:{sewnSteps:10}});assert.equal(low.limits.sewnSteps,10);assert.equal(context(h,a,{limits:{sewnSteps:100}}).limits.sewnSteps,20);assert.equal(context(h,b,{limits:{sewnSteps:100}}).limits.sewnSteps,100);
 const resource={store:'main',collection:'records'};
 for(const extra of [{publisher:'other'},{package:'acme/other'},{scopes:{}},{capabilities:[]}])assert.equal((await invoke(h,a,context(h,a,extra),'wydstore','count',resource)).ok,false);
 assert.equal((await h.bind(a,context(h,a)).invoke('wydstore','1.0.0','get',{...resource,app:'app-beta',id:'same'})).ok,false);
});
test('inventory rejects missing contracts, recovery markers and resource escapes without activation',async t=>{
 const f=await fixture(t),dir=path.join(f.root,'app-alpha'),configFile=path.join(dir,'wydgit.config.json'),text=await fs.readFile(configFile);
 await fs.rename(path.join(dir,'content/requirements.json'),path.join(dir,'content/requirements.backup'));await assert.rejects(f.start());await fs.rename(path.join(dir,'content/requirements.backup'),path.join(dir,'content/requirements.json'));
 const config=JSON.parse(text);config.libraries.find(l=>l.id==='wydstore').options.stores[0].root=path.join(f.root,'app-beta/data');await fs.writeFile(configFile,JSON.stringify(config));await assert.rejects(f.start(),{code:'HOST.ROOT'});await fs.writeFile(configFile,text);
 const changed=JSON.parse(text);changed.libraries.find(l=>l.id==='wydgate').bindings[0].app='app-beta';await fs.writeFile(configFile,JSON.stringify(changed));await assert.rejects(f.start(),{code:'HOST.OWNER'});
});

test('stale config fails before authentication and cannot become foreign authority',async t=>{
 const f=await fixture(t),h=await f.start(),a=await h.activate('app-alpha'),b=await h.activate('app-beta'),bound=h.bind(a,context(h,a));
 const file=path.join(f.root,'app-alpha/wydgit.config.json');const config=JSON.parse(await fs.readFile(file));config.libraries.find(l=>l.id==='wydgate').options.app='app-beta';await fs.writeFile(file,JSON.stringify(config));
 await assert.rejects(bound.invoke('wydstore','1.0.0','count',{store:'main',collection:'records'}));assert.equal((await invoke(h,b,context(h,b),'wydstore','count',{store:'main',collection:'records'})).ok,true);for(let n=0;n<40&&h.status()[0].state==='stopping';n++)await new Promise(r=>setTimeout(r,5));assert.equal(h.status()[0].state,'failed');
});
test('shutdown deadline retires a pending Page and a late result cannot resume App authority',async t=>{
 const f=await fixture(t);f.config.shutdownMs=50;let enter,release;const entered=new Promise(r=>enter=r),pause=new Promise(r=>release=r);let late;
 const h=await f.start({execution:{'app-alpha':{handlers:[{type:'Page.Load',owner:'home',run:async function(){enter();await pause;try{this.PAGE.Set('title','late');late='mutated';}catch{late='denied';}}}]}}});const a=await h.activate('app-alpha'),bound=h.bind(a,context(h,a)),server=await h.listen(a,0,'127.0.0.1');const request=fetch('http://127.0.0.1:'+server.address().port).catch(()=>null);await entered;
 await assert.rejects(h.stop(a),{code:'HOST.CLEANUP'});release();await request;for(let n=0;n<30&&!late;n++)await new Promise(r=>setTimeout(r,5));assert.equal(late,'denied');await assert.rejects(bound.invoke('wydstore','1.0.0','count',{store:'main',collection:'records'}));assert.equal(h.status()[0].state,'failed');
});

test('same installed WBasic Taskboard executes independently in both Apps through typed events and real HTTP',async t=>{
 const {build}=await import('../examples/wbasic-taskboard/build.mjs'),{compileDefinitions,loadRepository}=await import('../wydgine/repository.js'),{planPackageInstall,applyPackageInstall}=await import('../wydgine/packages/index.js');
 const f=await fixture(t),core=compileDefinitions(JSON.parse(await fs.readFile('prototypes/objects.json'))),built=await build({definitions:core,verifiedPackages:{'divdev/wbasic-taskboard':'divdev'}}),verifiedPackages={'divdev/wbasic-taskboard':'divdev'};
 for(const [index,id] of ['app-alpha','app-beta'].entries()){
  const root=path.join(f.root,id),packagePath=path.join(root,'source-package');await fs.mkdir(packagePath);const manifest=structuredClone(built.manifest);manifest.resources.sources.select='select.bas';manifest.bindings.push({owner:'taskboard',event:'Page.PreRender',source:'select',kind:'handler'});
  await fs.writeFile(path.join(packagePath,'manifest.json'),JSON.stringify(manifest));for(const [file,text] of Object.entries(built.resources))await fs.writeFile(path.join(packagePath,file),text);await fs.writeFile(path.join(packagePath,'select.bas'),`EVENT Page.PreRender\nCALL Me.SelectPage(${index===0?2:1})\nEND EVENT`);
  const base=loadRepository(root),ids=[];const walk=id=>{ids.push(id);Object.values(base.runtime.get(id).slots).flat().forEach(walk);};walk(base.runtime.rootId);
  await applyPackageInstall(await planPackageInstall({root,packagePath,placement:{page:'home',parent:'home',slot:'sections',index:1},approvals:manifest.permissions,storageMappings:{},verifiedPackages,installationContext:new ExecutionContext({context:'FrontEnd',publisher:'operator',self:'home',app:id,visible:[...ids,...manifest.permissions.visible],editable:[...ids,...manifest.permissions.visible],capabilities:['object.instances.edit']})}));
 }
 const h=await f.start({execution:Object.fromEntries(['app-alpha','app-beta'].map(id=>[id,{verifiedPackages}]))}),tokens=await Promise.all(['app-alpha','app-beta'].map(id=>h.activate(id))),servers=await Promise.all(tokens.map(token=>h.listen(token,0,'127.0.0.1'))),html=await Promise.all(servers.map(async s=>{const response=await fetch('http://127.0.0.1:'+s.address().port);assert.equal(response.status,200);return response.text();}));
 assert.match(html[0],/Verify lifecycle cleanup/);assert.doesNotMatch(html[0],/Write WBasic/);assert.match(html[1],/Write WBasic/);assert.doesNotMatch(html[1],/Verify lifecycle cleanup/);await h.stop(tokens[0]);assert.equal((await fetch('http://127.0.0.1:'+servers[1].address().port)).status,200);
});

test('missing or failing approved implementation cannot activate, while an already healthy sibling continues',async t=>{
 const f=await fixture(t),file=path.join(f.root,'app-alpha/wydgit.config.json'),config=JSON.parse(await fs.readFile(file));config.libraries.find(l=>l.id==='wydfiles').package='@missing/implementation';await fs.writeFile(file,JSON.stringify(config));const h=await f.start(),b=await h.activate('app-beta');await assert.rejects(h.activate('app-alpha'),{code:'HOST.STARTUP'});assert.equal((await invoke(h,b,context(h,b),'wydstore','count',{store:'main',collection:'records'})).ok,true);assert.equal(h.status().find(e=>e.id==='app-alpha').state,'failed');
});
test('recovery state, nested roots and symlinked contracts are rejected during inventory validation',async t=>{
 const f=await fixture(t),dir=path.join(f.root,'app-alpha'),lock=path.join(dir,'content/.package-install.lock');await fs.writeFile(lock,'interrupted');await assert.rejects(f.start());await fs.unlink(lock);
 const outside=path.join(f.root,'outside.txt'),alias=path.join(dir,'public/hardlink.txt');await fs.writeFile(outside,'private');await fs.link(outside,alias);await assert.rejects(f.start(),{code:'HOST.ROOT'});await fs.unlink(alias);
 const source=path.join(dir,'content/requirements.json'),copy=path.join(f.root,'requirements.json');await fs.rename(source,copy);await fs.symlink(copy,source);await assert.rejects(f.start(),{code:'HOST.ROOT'});
});
test('old host-issued contexts cannot be rebound into a new controller with the same canonical App identity',async t=>{
 const f=await fixture(t),first=await f.start(),a=await first.activate('app-alpha'),old=context(first,a);await first.dispose();const next=await f.start(),fresh=await next.activate('app-alpha');assert.throws(()=>next.bind(fresh,old));assert.throws(()=>next.bind(a,context(next,fresh)));assert.throws(()=>next.context(fresh,{...old,app:'app-alpha'}));
});

test('live same-ID handles, methods and event sources cannot cross concurrent App executions',async t=>{
 const {loadRepository}=await import('../wydgine/repository.js'),{memberAdapter}=await import('../wydgine/object-model/members.js'),{EventRegistry}=await import('../wydgine/events/registry.js'),{execute}=await import('../wydgine/sewn/execute.js');
 const f=await fixture(t);let entered,release,foreign;const enteredPromise=new Promise(r=>entered=r),pause=new Promise(r=>release=r);let checked=false;
 const events=()=>new EventRegistry().define('Probe.Tick',{family:'Custom',cancelable:false,fields:{}});
 const makeContext=id=>({pageId,ids})=>new ExecutionContext({context:'FrontEnd',publisher:'same',package:'same/package',app:id,self:pageId,visible:ids,capabilities:['event.custom.raise'],scopes:{events:['Probe.Tick']}});
 const h=await f.start({execution:{'app-alpha':{events:events(),context:makeContext('app-alpha'),handlers:[{type:'Page.Load',owner:'home',run:async function(){foreign=this.ME;entered();await pause;}}]},'app-beta':{events:events(),context:makeContext('app-beta'),handlers:[{type:'Page.Load',owner:'home',run:async function(){
  assert.equal(this.ME.id,foreign.id);const context=memberAdapter(this.ME).context;assert.throws(()=>memberAdapter(foreign,context),{code:'OBJECT.ACCESS'});assert.throws(()=>this.EVENT.Raise('Probe.Tick',foreign,{}));
  const program={schema:'sewn/0.5',body:[{op:'return',value:{op:'memberRead',target:{op:'context',name:'ME'},name:'title',exact:true}}],procedures:{}},prototypeRegistry=loadRepository(path.join(f.root,'app-beta')).registry;assert.equal((await execute(program,{context,prototypeRegistry,scope:{ME:this.ME}})).value,this.ME.properties.title);await assert.rejects(execute(program,{context,prototypeRegistry,scope:{ME:foreign}}),{code:'OBJECT.ACCESS'});
  for(const statement of [{op:'methodCall',target:{op:'context',name:'ME'},name:'MissingMethod',args:[]},{op:'call',target:{op:'context',name:'ME'},method:'related',args:[{op:'literal',value:'parent'}]}])await assert.rejects(execute({schema:'sewn/0.5',body:[statement],procedures:{}},{context,prototypeRegistry,scope:{ME:foreign}}),{code:'OBJECT.ACCESS'});checked=true;
 }}]}}});
 const a=await h.activate('app-alpha'),b=await h.activate('app-beta'),sa=await h.listen(a,0,'127.0.0.1'),sb=await h.listen(b,0,'127.0.0.1');const request=fetch('http://127.0.0.1:'+sa.address().port);await enteredPromise;try{const result=await fetch('http://127.0.0.1:'+sb.address().port);assert.equal(result.status,200);await result.text();assert.equal(checked,true);}finally{release();await (await request).text();}
});

test('a terminal SEWN budget failure in one App does not consume or reset the sibling budget',async t=>{
 const f=await fixture(t);f.config.apps[0].limits={sewnSteps:1};const workflow={schema:'sewn/0.1',body:[{op:'declare',name:'value',value:{op:'literal',value:42}}]};const execution=Object.fromEntries(['app-alpha','app-beta'].map(id=>[id,{handlers:[{type:'Page.Load',owner:'home',workflow}]}]));
 const h=await f.start({execution}),tokens=await Promise.all(['app-alpha','app-beta'].map(id=>h.activate(id))),servers=await Promise.all(tokens.map(token=>h.listen(token,0,'127.0.0.1'))),results=await Promise.all(servers.map(s=>fetch('http://127.0.0.1:'+s.address().port)));assert.equal(results[0].status,500);assert.equal(results[1].status,200);for(const r of results)await r.text();
});
test('bounded startup failure never publishes a late token or resurrects a failed App',async t=>{
 const f=await fixture(t);f.config.startupMs=500;let entered,release;const entering=new Promise(r=>entered=r),pause=new Promise(r=>release=r),trace=[];
 const h=await f.start({execution:{'app-alpha':{lifecycleHandlers:[{type:'Server.Start',owner:'app-alpha',run:async function(){entered();await pause;}},{type:'Server.Stop',owner:'app-alpha',run:function(){trace.push('stop');}}]}}});const starting=h.activate('app-alpha'),denied=assert.rejects(starting,{code:'HOST.STARTUP'});await Promise.race([entering,starting.then(()=>{throw Error('Startup did not pause');})]);const b=await h.activate('app-beta');await denied;assert.throws(()=>h.select('app-alpha'));release();for(let n=0;n<40&&!trace.length;n++)await new Promise(r=>setTimeout(r,5));assert.deepEqual(trace,['stop']);assert.equal(h.status().find(s=>s.id==='app-alpha').state,'failed');assert.equal((await invoke(h,b,context(h,b),'wydstore','count',{store:'main',collection:'records'})).ok,true);
});

test('shared provider implementation factories are allowed, but one mutable provider instance cannot alias Apps',async t=>{
 const {localProvider}=await import('../packages/wydfiles/src/local.js'),f=await fixture(t),shared=await localProvider(path.join(f.root,'app-alpha/files')),factory=()=>shared,adapter={wydfiles:{provider:factory}},h=await f.start({libraryAdapters:{'app-alpha':adapter,'app-beta':adapter}}),a=await h.activate('app-alpha');await assert.rejects(h.activate('app-beta'),{code:'HOST.STARTUP'});assert.equal((await invoke(h,a,context(h,a),'wydfiles','exists',{path:'/safe'})).ok,true);
});

test('a host context factory cannot substitute another App during Page selection',async t=>{
 const f=await fixture(t),h=await f.start({execution:{'app-alpha':{context:({pageId,ids})=>new ExecutionContext({context:'FrontEnd',publisher:'same',app:'app-beta',self:pageId,visible:ids})}}}),a=await h.activate('app-alpha'),s=await h.listen(a,0,'127.0.0.1'),response=await fetch('http://127.0.0.1:'+s.address().port);assert.equal(response.status,400);assert.doesNotMatch(await response.text(),/app-beta|HOST.OWNER|wydgit.config/);
});

test('host validation rejects overlapping remote namespaces and nested App roots before provider startup',async t=>{
 const f=await fixture(t),nested=structuredClone(f.config);nested.apps[1].root='app-alpha/data';await assert.rejects(validateAppInventory(nested,{root:f.root}),{code:'HOST.ROOT'});
 for(const id of ['app-alpha','app-beta']){const file=path.join(f.root,id,'wydgit.config.json'),config=JSON.parse(await fs.readFile(file)),mount=config.libraries.find(l=>l.id==='wydfiles').options.apps[0].mounts[0];delete mount.root;Object.assign(mount,{provider:'s3',endpoint:id==='app-alpha'?'https://storage.example':'https://STORAGE.example/',bucket:'bucket-test',namespace:'same-namespace',region:'us-east-1',credentials:{accessKeyId:'fixture',secretAccessKey:'fixture'}});await fs.writeFile(file,JSON.stringify(config));}
 await assert.rejects(f.start(),{code:'HOST.OWNER'});
});

test('controller pins its inventory and direct listener close retires only that App',async t=>{
 const f=await fixture(t),h=await f.start();f.config.apps[0].root='app-beta';const a=await h.activate('app-alpha'),b=await h.activate('app-beta'),server=await h.listen(a,0,'127.0.0.1');await new Promise(r=>server.close(r));for(let n=0;n<40&&h.status()[0].state==='stopping';n++)await new Promise(r=>setTimeout(r,5));assert.equal(h.status()[0].state,'stopped');assert.throws(()=>h.select('app-alpha'));assert.equal((await invoke(h,b,context(h,b),'wydstore','count',{store:'main',collection:'records'})).ok,true);
});
