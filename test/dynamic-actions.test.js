import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {once} from 'node:events';
import {packageFixture} from '../test-support/packages.js';
import {planPackageInstall,applyPackageInstall,validatePackageManifest} from '../wydgine/packages/index.js';
import {createHostApp} from '../app.js';
import {PrototypeRegistry} from '../wydgine/object-model/index.js';
import {renderField} from '../wydgine/form-renderer.js';
import {escapeHtml} from '../wydgine/index.js';

async function fixture(t){
 const f=await packageFixture(t),{root,packagePath,manifest,options}=f;
 const defs=JSON.parse(await fs.readFile(packagePath+'/prototypes.json','utf8'));
 defs[0].behaviorSource=`SUB BuildAction(record AS Object)
 DIM card AS Wydgit
 DIM field AS Wydgit
 SET card = NEW "divdev/entry-action"("dynamic-entry-" & record.id)
 card.recordId = record.id
 card.recordVersion = record.version
 card.label = "Delete " & record.data.name
 SET field = NEW "wydgit.core/hidden-input"("dynamic-entry-" & record.id & "-record")
 field.Set("name", "recordId")
 field.Set("value", record.id)
 card.Insert("blocks", 0, field)
 Me.Insert("blocks", 0, card)
END SUB`;
 defs.push({id:'divdev/entry-action',publisher:'divdev',extends:'wydgit.core/form',actions:{Submit:{capability:'app.forms.submit'}},properties:{recordId:{type:'string',default:''},recordVersion:{type:'number',default:0}},slots:{}});
 const refresh=`EVENT Page.PreRender
 IF NOT REQUEST.IsPost THEN
  DIM result = SERVICES.Call("wydstore", "query", {"store":"entries", "collection":"entries", "limit":20})
  IF result.ok THEN
   FOR EACH record IN result.value
    CALL Me.BuildAction(record)
   NEXT record
  END IF
 END IF
END EVENT`;
 const resolve=`EVENT Page.Resolve
 DIM result = SERVICES.Call("wydstore", "get", {"store":"entries", "collection":"entries", "id":REQUEST.Form.Get("recordId")})
 IF result.ok THEN
  IF REQUEST.Route.target = "dynamic-entry-" & result.value.id THEN
   CALL Me.BuildAction(result.value)
  END IF
 END IF
END EVENT`;
 const remove=`EVENT Submit
 DIM result = SERVICES.Call("wydstore", "delete", {"store":"entries", "collection":"entries", "id":Me.recordId, "version":Me.recordVersion})
 IF result.ok THEN
  Me.Remove()
 END IF
END EVENT`;
 manifest.resources.sources={refresh:'refresh.bas',resolve:'resolve.bas',remove:'remove.bas'};
 manifest.bindings=[{owner:'guestbook',event:'Page.PreRender',source:'refresh',kind:'handler'},{owner:'dynamic-entry-*',event:'Submit',source:'remove',kind:'action',method:'POST',capability:'app.forms.submit',delegation:{type:'divdev/entry-action',root:'guestbook',resolver:'resolve'}}];
 manifest.permissions.visible.push('dynamic-entry-*');manifest.permissions.editable.push('dynamic-entry-*');manifest.permissions.capabilities.push('store.records.delete');manifest.permissions.scopes.prototypes.push('divdev/entry-action','wydgit.core/hidden-input');
 options.approvals=structuredClone(manifest.permissions);
 for(const [name,data] of Object.entries({'manifest.json':manifest,'prototypes.json':defs}))await fs.writeFile(packagePath+'/'+name,JSON.stringify(data));
 for(const [name,source] of Object.entries({'refresh.bas':refresh,'resolve.bas':resolve,'remove.bas':remove}))await fs.writeFile(packagePath+'/'+name,source);
 f.defs=defs;f.resolve=resolve;return f;
}
async function start(t,root){const app=await createHostApp({root});const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>app.shutdown(server));return {app,url:`http://127.0.0.1:${server.address().port}`};}
async function client(url){const r=await fetch(url),html=await r.text();return {html,status:r.status,cookie:r.headers.get('set-cookie').split(';')[0],csrf:/name="_csrf" value="([^"]+)"/.exec(html)[1]};}
async function post(url,c,target,id,extra={}){return fetch(url,{method:'POST',headers:{cookie:c.cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_target:target,_action:'Submit',_csrf:c.csrf,recordId:id,...extra})});}
async function seed(f){const app=await createHostApp({root:f.root});const {activatePackages}=await import('../wydgine/packages/index.js');const {loadRepository}=await import('../wydgine/repository.js');const model=loadRepository(f.root),active=activatePackages(model,app.locals.libraries,f.root),ctx=active.context({pageId:'home',session:{authenticated:false},ids:[]});const result=await app.locals.libraries.bind(ctx).call('wydstore','create',{store:'host-book',collection:'host-entries',id:'a',data:{name:'Alice',message:'Hello'}});assert.equal(result.ok,true);
}

test('dynamic native Form: GET creates exact target, POST resolves under delegation, hidden input round-trip, deletion persists',async t=>{
 const f=await fixture(t);await applyPackageInstall(await planPackageInstall(f.options));await seed(f);
 const h=await start(t,f.root),c=await client(h.url);assert.equal(c.status,200);assert.match(c.html,/type="hidden"[^>]*name="recordId"[^>]*value="a"/);assert.match(c.html,/Delete Alice/);
 const forged=await post(h.url,{...c,csrf:'forged'},'dynamic-entry-a','a');assert.equal(forged.status,403);
 const mismatch=await post(h.url,c,'dynamic-entry-wrong','a');assert.equal(mismatch.status,403);
 const missing=await post(h.url,c,'dynamic-entry-missing','missing');assert.equal(missing.status,403);
 const unknownField=await post(h.url,c,'dynamic-entry-a','a',{evil:'x'});assert.equal(unknownField.status,500);
 const removed=await post(h.url,c,'dynamic-entry-a','a');assert.equal(removed.status,200);assert.doesNotMatch(await removed.text(),/Delete Alice/);
 assert.equal((await post(h.url,c,'dynamic-entry-a','a')).status,403);
 const restart=await start(t,f.root);assert.doesNotMatch((await client(restart.url)).html,/Delete Alice/);
});

test('manifest rejects wildcard without prototype delegation and overlapping routing; prototype refuses capability weakening',async t=>{
 const f=await fixture(t);const m=structuredClone(f.manifest);delete m.bindings[1].delegation;assert.throws(()=>validatePackageManifest(m),{code:'PACKAGE.MANIFEST'});
 const overlap=structuredClone(f.manifest);overlap.bindings.push({...overlap.bindings[1],owner:'dynamic-entry-a-*'});assert.throws(()=>validatePackageManifest(overlap),{code:'PACKAGE.MANIFEST'});
 const defs=[{id:'wydgit.core/form',publisher:'wydgit.core',public:true,properties:{},slots:{}},{id:'divdev/a',publisher:'divdev',extends:'wydgit.core/form',actions:{Submit:{capability:'app.forms.submit'}},properties:{},slots:{}},{id:'divdev/b',publisher:'divdev',extends:'divdev/a',actions:{Submit:{capability:'other.forms.submit'}},properties:{},slots:{}}];assert.throws(()=>new PrototypeRegistry(defs),{code:'PROTOTYPE.ACTION'});
 f.defs.at(-1).actions={};await fs.writeFile(f.packagePath+'/prototypes.json',JSON.stringify(f.defs));await assert.rejects(planPackageInstall(f.options),{code:'PACKAGE.BINDING'});
});

test('resolver cannot mutate services; no handler runs after failed resolution',async t=>{
 const f=await fixture(t);await fs.writeFile(f.packagePath+'/resolve.bas',f.resolve.replace('"get"','"delete"'));await applyPackageInstall(await planPackageInstall(f.options));await seed(f);const h=await start(t,f.root),c=await client(h.url);assert.equal((await post(h.url,c,'dynamic-entry-a','a')).status,403);assert.match((await client(h.url)).html,/Delete Alice/);
});

test('hidden-input emits escaped native control, visibility omission and disabled semantics remain',()=>{
 const f={id:'h',name:'recordId',value:'"<script>',controlKind:'hidden-input',enabled:true,visible:true};const html=renderField(f,escapeHtml);assert.match(html,/type="hidden"/);assert.match(html,/&quot;&lt;script&gt;/);assert.doesNotMatch(html,/<label|<script>/);assert.equal(renderField({...f,visible:false},escapeHtml),'');assert.match(renderField({...f,enabled:false},escapeHtml),/ disabled/);
});

test('ID prefix cannot route an unrelated prototype even when it declares Submit',async t=>{
 const f=await fixture(t);f.defs.push({...f.defs.at(-1),id:'divdev/wrong-action'});f.defs[0].behaviorSource=f.defs[0].behaviorSource.replace('NEW "divdev/entry-action"','NEW "divdev/wrong-action"');f.manifest.permissions.scopes.prototypes.push('divdev/wrong-action');f.options.approvals=structuredClone(f.manifest.permissions);
 await fs.writeFile(f.packagePath+'/prototypes.json',JSON.stringify(f.defs));await fs.writeFile(f.packagePath+'/manifest.json',JSON.stringify(f.manifest));await applyPackageInstall(await planPackageInstall(f.options));await seed(f);const h=await start(t,f.root),c=await client(h.url);assert.equal((await post(h.url,c,'dynamic-entry-a','a')).status,403);assert.match((await client(h.url)).html,/Delete Alice/);
});

test('hidden value is ordinary validated untrusted data; no authority comes from the control',async t=>{
 const f=await fixture(t);f.defs[0].behaviorSource=f.defs[0].behaviorSource.replace('field.Set("value", record.id)','field.Set("value", record.id)\n field.Set("required", TRUE)\n field.Set("maxLength", 1)');await fs.writeFile(f.packagePath+'/prototypes.json',JSON.stringify(f.defs));await applyPackageInstall(await planPackageInstall(f.options));await seed(f);const h=await start(t,f.root),c=await client(h.url);
 assert.equal((await post(h.url,c,'dynamic-entry-a','a',{recordId:'other'})).status,403);assert.match((await client(h.url)).html,/Delete Alice/);
});

test('delegation is bound to installation and Page, with no write capability acquired by routing',async t=>{
 const f=await fixture(t);f.manifest.permissions.capabilities=f.manifest.permissions.capabilities.filter(c=>c!=='store.records.delete');f.options.approvals=structuredClone(f.manifest.permissions);await fs.writeFile(f.packagePath+'/manifest.json',JSON.stringify(f.manifest));await applyPackageInstall(await planPackageInstall(f.options));await seed(f);const h=await start(t,f.root),c=await client(h.url);
 const denied=await post(h.url,c,'dynamic-entry-a','a');assert.equal(denied.status,200);assert.match(await denied.text(),/Delete Alice/);assert.match((await client(h.url)).html,/Delete Alice/);
 const {loadRepository}=await import('../wydgine/repository.js');const {initializeHost}=await import('../wydgine/host.js');const {activatePackages}=await import('../wydgine/packages/index.js');const {ExecutionContext}=await import('../wydgine/seam/context.js');const {executePage}=await import('../wydgine/execution/page.js');
 const model=loadRepository(f.root),libraries=await initializeHost({root:f.root}),active=activatePackages(model,libraries,f.root),session={view:{app:'boilerplate',authenticated:false},identity:null,active:()=>true,authorize:async()=>{}};
 const original=active.context({pageId:'home',session:session.view,ids:[]}),context=new ExecutionContext({context:'FrontEnd',...original,installation:'unrelated'});
 const result=await executePage({model,pageId:'home',session,context,input:{method:'POST',path:'/',form:'recordId=a',action:{target:'dynamic-entry-a',type:'Submit',csrf:c.csrf}},csrf:c.csrf,handlers:active.handlers,actions:active.actions,libraries,serviceMappings:model.installed.packages[0].storageMappings});assert.equal(result.error.code,'EVENT.DENIED');
 const another=await post(h.url+'/about',c,'dynamic-entry-a','a');assert.ok([403,404,405].includes(another.status));
});
