import test from 'node:test';
import assert from 'node:assert/strict';
import { PrototypeRegistry, ExecutionContext, hydrate, dehydrate, serialize } from '../wydgine/object-model/index.js';
import { compile, compilePrototype } from '../wydgine/wydbasic/index.js';
import { execute } from '../wydgine/sewn/execute.js';
import { webModel } from '../wydgine/web-model.js';
const app={id:'wydgit.core/app',publisher:'wydgit.core',properties:{},slots:{items:{accepts:['acme/base'],ordered:true},pages:{accepts:['acme/base'],ordered:true},navigation:{accepts:['acme/base'],ordered:true}}};
const env=(id,prototype,properties={},slots={})=>({schema:'wydgit/0.2',id,prototype,properties,slots,provenance:{}});
const rules={Content:{type:'string',default:'hello'},_public:{type:'string',default:'visible'},secret:{type:'string',default:'SECRET',access:'private'},family:{type:'string',default:'PROTECTED',access:'protected'},shared:{type:'string',default:'FRIEND',access:'friend'},hidden:{type:'string',default:'HIDDEN',hidden:true},hiddenPrivate:{type:'string',default:'PRIVATE-HIDDEN',hidden:true,access:'private'}};
const base=()=>({id:'acme/base',publisher:'acme',friends:['acme/friend'],properties:structuredClone(rules),behavior:compilePrototype(`FUNCTION Own() AS String
RETURN Me.[secret]
END FUNCTION
FUNCTION Family() AS String
RETURN Me.[family]
END FUNCTION
FUNCTION ReadOther(other AS Wydgit) AS String
RETURN other.[shared]
END FUNCTION
FUNCTION SecretMethod() AS String
RETURN "method-secret"
END FUNCTION
FUNCTION CallPrivate() AS String
RETURN Me.SecretMethod()
END FUNCTION
SUB WriteSecret()
Me.[secret] = "changed"
END SUB`),methodRules:{secretmethod:{access:'private'}}});
// Avoid a property/method identity collision in the fixture.
const definitions=()=>{const b=base();b.behavior=compilePrototype(`FUNCTION Own() AS String
RETURN Me.[secret]
END FUNCTION
FUNCTION FamilyValue() AS String
RETURN Me.[family]
END FUNCTION
FUNCTION ReadOther(other AS Wydgit) AS String
RETURN other.[shared]
END FUNCTION
FUNCTION SecretMethod() AS String
RETURN "method-secret"
END FUNCTION
FUNCTION CallPrivate() AS String
RETURN Me.SecretMethod()
END FUNCTION
SUB WriteSecret()
Me.[secret] = "changed"
END SUB`);return [app,b,{id:'acme/derived',publisher:'acme',extends:'acme/base',behavior:compilePrototype(`FUNCTION DerivedFamily() AS String
RETURN Me.FAMILY
END FUNCTION
FUNCTION DerivedSecret() AS String
RETURN Me.[secret]
END FUNCTION
FUNCTION DerivedPrivate() AS String
RETURN Me.[secretmethod]()
END FUNCTION`)},{id:'acme/friend',publisher:'acme',extends:'acme/base',behavior:compilePrototype(`FUNCTION GetShared(other AS Wydgit) AS String
RETURN other.[shared]
END FUNCTION`)},{id:'acme/friend-child',publisher:'acme',extends:'acme/friend',behavior:compilePrototype(`FUNCTION ChildShared(other AS Wydgit) AS String
RETURN other.[shared]
END FUNCTION`)}];};
const verified=defs=>Object.fromEntries(defs.map(d=>[d.id,d.publisher]));
const registry=(defs=definitions(),extra={})=>new PrototypeRegistry(defs,{verifiedPrototypes:verified(defs),...extra});
const ctx=(extra={})=>new ExecutionContext({publisher:'spoofed',app:'app',self:'app',capabilities:['object.instances.construct','object.instances.edit'],scopes:{prototypes:['acme/base','acme/derived','acme/friend','acme/friend-child']},visible:['target'],...extra});
const setup=(type='acme/base',defs=definitions())=>{const reg=registry(defs),context=ctx();const runtime=hydrate(env('app',app.id,{}, {items:[env('target',type)]}),reg);return {reg,context,runtime,scope:{ME:runtime.scope(context,'target')}};};
const run=(source,s)=>execute(compile(source),{scope:s.scope??{},context:s.context??ctx(),prototypeRegistry:s.reg??registry()});
const denied=e=>e.code==='OBJECT.ACCESS';
test('default public, ordinary casing, bracket exact and hidden discoverability through WydBASIC',async()=>{
 const s=setup();assert.equal((await run('RETURN Me.content',s)).value,'hello');assert.equal((await run('RETURN Me.CONTENT',s)).value,'hello');assert.equal((await run('RETURN Me.[Content]',s)).value,'hello');
 await assert.rejects(run('RETURN Me.[content]',s),e=>e.code==='OBJECT.PROPERTY');assert.equal((await run('RETURN Me.[hidden]',s)).value,'HIDDEN');await assert.rejects(run('RETURN Me.hidden',s));assert.equal((await run('RETURN Me._PUBLIC',s)).value,'visible');
 assert.deepEqual(Object.keys(s.scope.ME.properties),['Content','_public']);assert.equal((await run('RETURN Me.Own()',s)).value,'SECRET');assert.equal((await run('RETURN Me.CallPrivate()',s)).value,'method-secret');
});
test('private/protected method frames, derived denial, bracket permissions and spoofed caller metadata',async()=>{
 const s=setup('acme/derived');assert.equal((await run('RETURN Me.Own()',s)).value,'SECRET');assert.equal((await run('RETURN Me.DerivedFamily()',s)).value,'PROTECTED');
 for(const source of ['RETURN Me.[secret]','RETURN Me.[hiddenPrivate]','RETURN Me.SecretMethod()','RETURN Me.DerivedSecret()','RETURN Me.DerivedPrivate()'])await assert.rejects(run(source,s),denied);
 const spoofContext=ctx({publisher:'acme',identity:null}),spoof={...s,context:spoofContext,scope:{ME:s.runtime.scope(spoofContext,'target')}};await assert.rejects(run('RETURN Me.[secret]',spoof),denied);
 await assert.rejects(run('RETURN {"owner":"acme/base","access":"private"}.secret',s));
});
test('draft assignments and legacy Set use the same declaring context and cannot elevate SEAM',async()=>{
 const s={reg:registry(),context:ctx()};const prefix='DIM x AS Wydgit = NEW "acme/derived"("draft")\n';
 assert.equal((await run(prefix+'x.content = "updated"\nRETURN x.[Content]',s)).value,'updated');
 assert.equal((await run(prefix+'CALL x.WriteSecret()\nRETURN x.Own()',s)).value,'changed');
 for(const suffix of ['x.[secret] = "bad"','x.Set("secret", "bad")','x.[hiddenPrivate] = "bad"'])await assert.rejects(run(prefix+suffix,s),denied);
 assert.equal((await run(prefix+'x.[hidden] = "changed"\nRETURN x.[hidden]',s)).value,'changed');
 await assert.rejects(run(prefix+'RETURN x.Own()', {...s,context:ctx({capabilities:[]})}),e=>e.code==='SEAM.DENIED');
});
test('exact and publisher friendship use verified lexical owners, never receiver descendants or caller publisher',async()=>{
 const prefix='DIM target AS Wydgit = NEW "acme/base"("target")\nDIM friend AS Wydgit = NEW "acme/friend"("friend")\n';
 assert.equal((await run(prefix+'RETURN friend.GetShared(target)',{reg:registry()})).value,'FRIEND');
 assert.equal((await run(prefix+'RETURN friend.ReadOther(target)',{reg:registry()})).value,'FRIEND'); // declaring base retains its own access
 await assert.rejects(run('DIM target AS Wydgit = NEW "acme/base"("target")\nDIM friend AS Wydgit = NEW "acme/friend-child"("friend")\nRETURN friend.ChildShared(target)',{reg:registry()}),denied);
 const defs=definitions();defs[1].friends=['acme/*'];assert.equal((await run(prefix+'RETURN friend.GetShared(target)',{reg:registry(defs)})).value,'FRIEND');
 const onlyGrantor={'acme/base':'acme'};await assert.rejects(run(prefix+'RETURN friend.GetShared(target)',{reg:registry(defs,{verifiedPrototypes:onlyGrantor})}),denied);
 assert.throws(()=>new PrototypeRegistry(defs),e=>e.code==='PROTOTYPE.FRIEND');
});
test('friend declarations reject globs, universal, cross-publisher and mismatched publisher claims',()=>{
 for(const friend of ['*','acme/**','acme/f*','other/friend','other/*','ACME/*','acme/','acme/*/x']){const defs=definitions();defs[1].friends=[friend];assert.throws(()=>registry(defs),e=>e.code==='PROTOTYPE.FRIEND');}
 const defs=definitions();defs[2].publisher='other';assert.throws(()=>registry(defs),e=>['PROTOTYPE.IDENTITY','PROTOTYPE.PUBLISHER'].includes(e.code));
 assert.throws(()=>registry(definitions(),{verifiedPrototypes:{'acme/base':'other'}}),e=>e.code==='PROTOTYPE.PUBLISHER');
});
test('friendship is not inherited by grantors or transitive through friends',async()=>{
 const defs=definitions();defs[2].properties={childShared:{type:'string',default:'child',access:'friend'}};defs[3].behavior=compilePrototype('FUNCTION ChildRead(other AS Wydgit) AS String\nRETURN other.[childShared]\nEND FUNCTION');
 await assert.rejects(run('DIM target AS Wydgit = NEW "acme/derived"("target")\nDIM friend AS Wydgit = NEW "acme/friend"("friend")\nRETURN friend.ChildRead(target)',{reg:registry(defs)}),denied);
 defs[3].friends=['acme/friend-child'];defs[3].properties={ownShared:{type:'string',default:'friend-owned',access:'friend'}};
 defs[4].behavior=compilePrototype('FUNCTION Transitive(other AS Wydgit) AS String\nRETURN other.[shared]\nEND FUNCTION');await assert.rejects(run('DIM target AS Wydgit = NEW "acme/base"("target")\nDIM friend AS Wydgit = NEW "acme/friend-child"("friend")\nRETURN friend.Transitive(target)',{reg:registry(defs)}),denied);
});
test('case collisions reject new and inherited names; host-pinned legacy names require exact lookup',async()=>{
 for(const inherited of [false,true]){const defs=definitions();defs[inherited?2:1].properties={...(inherited?{}:defs[1].properties),content:{type:'string',default:'lower'}};assert.throws(()=>registry(defs),e=>e.code==='PROTOTYPE.CASE_COLLISION');}
 const defs=[app,{id:'acme/base',publisher:'acme',properties:{Title:{type:'string',default:'upper'},title:{type:'string',default:'lower'}}}];const reg=registry(defs,{caseCollisionCompatibility:{'acme/base':['Title','title']}}),context=ctx(),runtime=hydrate(env('app',app.id,{}, {items:[env('target','acme/base')]}),reg),s={reg,context,scope:{ME:runtime.scope(context,'target')}};
 await assert.rejects(run('RETURN Me.TITLE',s),e=>e.code==='OBJECT.AMBIGUOUS_MEMBER');assert.equal((await run('RETURN Me.[Title]',s)).value,'upper');assert.equal((await run('RETURN Me.[title]',s)).value,'lower');
});

test('overrides preserve exact identity, method signature, property types and access contracts',()=>{
 for(const access of ['public','protected','friend']){const defs=definitions();defs[2].overrides=['secretmethod'];defs[2].behavior=compilePrototype('FUNCTION SecretMethod() AS String\nRETURN "bad"\nEND FUNCTION');defs[2].methodRules={secretmethod:{access}};assert.throws(()=>registry(defs),e=>e.code==='PROTOTYPE.ACCESS');}
 const defs=definitions();defs[2].properties={secret:{type:'string',default:'bad',access:'private'}};assert.throws(()=>registry(defs),e=>e.code==='PROTOTYPE.ACCESS');
 for(const change of [{type:'number',default:1},{type:'string',default:'bad',access:'private'}]){const defs=definitions();defs[2].properties={Content:change};assert.throws(()=>registry(defs),e=>e.code==='PROTOTYPE.ACCESS');}
});
test('public serialization, web projection, scoped enumeration and diagnostics exclude nonpublic/hidden values',()=>{
 const s=setup(),raw=dehydrate(s.runtime);assert.deepEqual({...raw.slots.items[0].properties},{Content:'hello',_public:'visible'});
 for(const value of ['SECRET','PROTECTED','FRIEND','HIDDEN']){assert.ok(!serialize(s.runtime).includes(value));assert.ok(!JSON.stringify(s.runtime.get('target')).includes(value));assert.ok(!JSON.stringify(webModel(s.runtime,{registry:s.reg}).site).includes(value));}
 assert.equal(dehydrate(s.runtime,{includeSensitive:true}).slots.items[0].properties.secret,'SECRET');
 const bad=env('app',app.id,{}, {items:[env('target','acme/base',{secret:1})]});assert.throws(()=>hydrate(bad,s.reg),e=>e.code==='OBJECT.PROPERTY'&&!e.message.includes('secret'));
});
test('friendship never grants traversal, visibility, App or installation authority',async()=>{
 const s=setup();await assert.rejects(run('RETURN Me.related("parent").id',s),e=>e.code==='SEAM.TRAVERSAL');
 assert.throws(()=>s.runtime.scope(ctx({visible:[]}), 'target'),e=>e.code==='SEAM.VISIBILITY');
 assert.throws(()=>s.runtime.scope(ctx({app:'other'}),'target'),e=>e.code==='SEAM.CONTEXT');
 // Installation grants are exact instance scopes; a same-publisher context cannot see another install.
 const installContext=ctx({publisher:'acme',installation:'receipt-2',visible:['other-target']});assert.throws(()=>s.runtime.scope(installContext,'target'),e=>e.code==='SEAM.VISIBILITY');
});
test('canonical SEWN member operations share enforcement and old wire grammars stay closed',async()=>{
 const s=setup(),target={op:'context',name:'ME'},member={op:'memberRead',target,name:'Content',exact:false};
 assert.equal((await execute({schema:'sewn/0.5',procedures:{},body:[{op:'return',value:member}]},{scope:s.scope,context:s.context,prototypeRegistry:s.reg})).value,'hello');
 await assert.rejects(execute({schema:'sewn/0.5',procedures:{},body:[{op:'return',value:{...member,name:'secret',exact:true}}]},{scope:s.scope,context:s.context,prototypeRegistry:s.reg}),denied);
 for(const schema of ['sewn/0.1','sewn/0.2','sewn/0.3','sewn/0.4'])await assert.rejects(execute({schema,procedures:{},body:[{op:'return',value:member}]},{scope:s.scope,context:s.context,prototypeRegistry:s.reg}),e=>e.code==='SEWN.INVALID');
});

test('protected virtual dispatch and friend methods use declaring owners and retain capability requirements',async()=>{
 const defs=definitions();defs[1].behavior=compilePrototype(`FUNCTION Hook() AS String
RETURN "base"
END FUNCTION
FUNCTION Virtual() AS String
RETURN Me.Hook()
END FUNCTION
FUNCTION FriendMethod() AS String
RETURN "friend-method"
END FUNCTION
FUNCTION Guarded() AS String
RETURN "guarded"
END FUNCTION
FUNCTION LexicalGuard() AS String
RETURN Guarded()
END FUNCTION`);defs[1].methodRules={hook:{access:'protected'},friendmethod:{access:'friend'},guarded:{requires:['store.records.read']}};
 defs[2].overrides=['hook'];defs[2].behavior=compilePrototype('FUNCTION Hook() AS String\nRETURN "derived"\nEND FUNCTION');defs[2].methodRules={hook:{access:'protected'}};
 defs[3].behavior=compilePrototype('FUNCTION FriendCall(other AS Wydgit) AS String\nRETURN other.FriendMethod()\nEND FUNCTION');
 const s=setup('acme/derived',defs);assert.equal((await run('RETURN Me.Virtual()',s)).value,'derived');await assert.rejects(run('RETURN Me.Hook()',s),denied);await assert.rejects(run('RETURN Me.FriendMethod()',s),denied);
 assert.equal((await run('DIM x AS Wydgit = NEW "acme/base"("x")\nDIM f AS Wydgit = NEW "acme/friend"("f")\nRETURN f.FriendCall(x)',{reg:registry(defs)})).value,'friend-method');
 for(const method of ['Guarded','LexicalGuard'])await assert.rejects(run('RETURN Me.'+method+'()',s),e=>e.code==='SEAM.DENIED');
 const grantContext=ctx({capabilities:['store.records.read']}),granted={...s,context:grantContext,scope:{ME:s.runtime.scope(grantContext,'target')}};assert.equal((await run('RETURN Me.Guarded()',granted)).value,'guarded');
 defs[2].overrides=['guarded'];defs[2].behavior=compilePrototype('FUNCTION Guarded() AS String\nRETURN "unguarded"\nEND FUNCTION');defs[2].methodRules={};assert.throws(()=>registry(defs),e=>e.code==='PROTOTYPE.ACCESS');
});
test('public-but-SEAM-protected data is absent from generic serialization and requires capability for exact reads',async()=>{
 const defs=definitions();defs[1].properties.controlled={type:'string',default:'CONTROLLED',requires:['store.records.read']};const s=setup('acme/base',defs);
 assert.ok(!serialize(s.runtime).includes('CONTROLLED'));assert.ok(!Object.hasOwn(s.scope.ME.properties,'controlled'));
 await assert.rejects(run('RETURN Me.[controlled]',s),e=>e.code==='SEAM.DENIED');const granted=ctx({capabilities:['store.records.read']});assert.equal((await run('RETURN Me.[controlled]',{...s,context:granted,scope:{ME:s.runtime.scope(granted,'target')}})).value,'CONTROLLED');
});
test('case-preserving canonical method identity and exact bracket invocation',async()=>{
 const defs=[app,{id:'acme/base',publisher:'acme',behavior:{schema:'sewn/0.5',body:[],procedures:{MixedCase:{kind:'function',params:[],returns:'String',body:[{op:'return',value:{op:'literal',value:'exact-method'}}]}}}}];
 const s=setup('acme/base',defs);assert.ok(Object.hasOwn(s.reg.get('acme/base').methods,'MixedCase'));assert.equal((await run('RETURN Me.MIXEDCASE()',s)).value,'exact-method');assert.equal((await run('RETURN Me.[MixedCase]()',s)).value,'exact-method');await assert.rejects(run('RETURN Me.[mixedcase]()',s),e=>e.code==='PROTOTYPE.METHOD');
});

test('bound object handles cannot be reused across execution contexts, Apps or installations',async()=>{
 const s=setup();for(const context of [ctx({app:'another'}),ctx({installation:'another-install'}),ctx()])await assert.rejects(run('RETURN Me.Own()',{...s,context}),denied);
});

test('installer requires independent publisher verification, retains private persistence and enforces Page member adapters',async t=>{
 const {packageFixture}=await import('../test-support/packages.js'),fs=await import('node:fs/promises'),path=await import('node:path');
 const {planPackageInstall,applyPackageInstall}=await import('../wydgine/packages/index.js'),{loadRepository}=await import('../wydgine/repository.js');
 const {executePage}=await import('../wydgine/execution/page.js'),{renderSite}=await import('../wydgine/index.js');
 const {root,packagePath,options}=await packageFixture(t),file=path.join(packagePath,'prototypes.json'),defs=JSON.parse(await fs.readFile(file,'utf8'));
 defs[0].friends=['divdev/*'];defs[0].properties={internal:{type:'string',default:'INSTALL-SECRET',access:'private'},shared:{type:'string',default:'INSTALL-FRIEND',access:'friend'}};
 defs[0].behaviorSource+='\nSUB UpdateInternal()\nMe.[internal] = "PAGE-SECRET"\nEND SUB';
 defs[1].behaviorSource+='\nFUNCTION Peek(other AS Wydgit) AS String\nRETURN other.[shared]\nEND FUNCTION';
 await fs.writeFile(file,JSON.stringify(defs));await assert.rejects(planPackageInstall(options),e=>e.code==='PROTOTYPE.FRIEND');
 const verifiedPackages={'divdev/guestbook':'divdev'},plan=await planPackageInstall({...options,verifiedPackages});await applyPackageInstall(plan);
 assert.throws(()=>loadRepository(root),e=>e.code==='PROTOTYPE.FRIEND');assert.throws(()=>loadRepository(root,{verifiedPackages:{'divdev/guestbook':'acme'}}),e=>e.code==='PROTOTYPE.FRIEND');
 const model=loadRepository(root,{verifiedPackages}),context=new ExecutionContext({publisher:'divdev',package:'divdev/guestbook',installation:'receipt',app:model.runtime.rootId,self:'guestbook-form',visible:['guestbook','home']});
 const value=await execute(compile('RETURN Me.Peek(Page)'),{context,prototypeRegistry:model.registry,scope:{ME:model.runtime.scope(context),PAGE:model.runtime.scope(context,'guestbook')}});assert.equal(value.value,'INSTALL-FRIEND');
 assert.equal(model.runtime.get('guestbook').properties.internal,'INSTALL-SECRET');assert.ok(!serialize(model.runtime).includes('INSTALL-SECRET'));
 const ids=[];const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk('home');
 const pageContext=new ExecutionContext({publisher:'divdev',app:model.runtime.rootId,self:'guestbook',visible:ids,editable:['guestbook'],capabilities:['object.instances.edit']});let observed;
 const result=await executePage({model,pageId:'home',context:pageContext,session:{view:{app:model.runtime.rootId},active:()=>true,authorize:async()=>{}},input:{method:'GET',path:'/'},handlers:[{owner:'guestbook',type:'Page.Load',wydBasic:'CALL Me.UpdateInternal()'}],render(projection,url,transport){observed=projection.runtime.get('guestbook').properties.internal;assert.ok(!JSON.stringify(projection.pages.get('home')).includes('PAGE-SECRET'));return renderSite(projection,url,transport);}});
 assert.equal(result.error,null);assert.equal(observed,'PAGE-SECRET');assert.equal(model.runtime.get('guestbook').properties.internal,'INSTALL-SECRET');await result.response.close();
});

test('member assignment parses a complete boolean/comparison RHS without changing array grammar',async()=>{
 const defs=definitions();defs[1].properties.flag={type:'boolean',default:false};const s={reg:registry(defs)};assert.equal((await run('DIM x AS Wydgit = NEW "acme/base"("x")\nx.FLAG = 1 = 1 AND TRUE\nRETURN [x.flag, x.[Content]]',s)).value[0],true);
});

test('generic Change payloads and returned event envelopes redact hidden and SEAM-protected values',async()=>{
 const {createDispatcher}=await import('../wydgine/events/index.js');
 for(const metadata of [{hidden:true},{access:'private'},{access:'protected'},{access:'friend'},{requires:['store.records.read']}]){
  const defs=definitions();defs[1].properties.value={type:'string',default:'VALUE-SECRET',...metadata};const s=setup('acme/base',defs);let captured;
  const dispatcher=createDispatcher({prototypeRegistry:s.reg,context:s.context,handle:id=>s.runtime.scope(s.context,id),handlers:[{owner:'target',type:'Change',run:function(){captured=this.EVENT.Payload;}}]});
  const result=await dispatcher.dispatch({type:'Change',source:'target',target:'target',payload:{OldValue:'VALUE-SECRET',NewValue:'NEW-SECRET'}});dispatcher.close();
  assert.deepEqual({...captured},{OldValue:'',NewValue:''});assert.ok(!JSON.stringify(result.envelope).includes('SECRET'));
 }
});

test('exact property schema overrides retain declaring ownership for inherited protected and friend slots',async()=>{
 const defs=definitions();defs[2].properties={family:{type:'string',default:'derived-default',access:'protected'},shared:{type:'string',default:'derived-friend',access:'friend'}};const s=setup('acme/derived',defs);
 assert.equal(s.reg.get('acme/derived').propertyOwners.family,'acme/base');assert.equal((await run('RETURN Me.FamilyValue()',s)).value,'derived-default');
 assert.equal((await run('DIM target AS Wydgit = NEW "acme/derived"("target")\nDIM friend AS Wydgit = NEW "acme/friend"("friend")\nRETURN friend.GetShared(target)',{reg:registry(defs)})).value,'derived-friend');
});
