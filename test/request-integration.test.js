import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../app.js';
import { fixture,modelFixture,envelope } from '../test-support/events.js';
import { dehydrate } from '../wydgine/object-model/index.js';
import { definition,load,temp } from '../test-support/wydstore.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createStores } from '@wydgit/store/client';
import { fileCatalog } from '../wydgine/http/files.js';

test('real GET/POST transport executes isolated Page trees and authorized WydStore persistence exactly once',async t=>{
 const root=await temp(t);for(const dir of ['content','prototypes','public'])await fs.cp(path.join(process.cwd(),dir),path.join(root,dir),{recursive:true});
 const raw=dehydrate(modelFixture().runtime);await fs.rm(path.join(root,'content/pages'),{recursive:true});await fs.mkdir(path.join(root,'content/pages'));await fs.writeFile(path.join(root,'content/pages/home.json'),JSON.stringify(raw.slots.pages[0]));await fs.writeFile(path.join(root,'content/navigation.json'),'[]');raw.slots.pages=[];raw.slots.navigation=[];await fs.writeFile(path.join(root,'content/app.json'),JSON.stringify(raw));
 const store={...definition(await temp(t)),app:raw.id,package:'acme/example'},libraries=await load(store);
 const base=fixture().context,context=new ExecutionContext({...base,capabilities:[...base.capabilities,'store.records.create','store.records.read','response.files.send','files.resources.read'],scopes:{...base.scopes,wydstore:[{store:'main',collection:'users'}],files:['report']}});
 const fileRoot=await temp(t);await fs.writeFile(path.join(fileRoot,'report.txt'),'download report');const files=await fileCatalog(fileRoot,[{id:'report',file:'report.txt',type:'text/plain'}]);
 const trace=[];const handlers=[{type:'Page.Load',owner:'home',run:async function(){trace.push(['load',this.SESSION.id]);if(this.REQUEST.Query.Get('markdown'))await this.RESPONSE.WriteMarkdown('# Explicit');if(this.REQUEST.Query.Get('file'))await this.RESPONSE.SendFile(this.FILESYS.Get('report'));}},{type:'Page.Unload',owner:'home',run:function(){trace.push(['unload',this.SESSION.id]);}}];
 const actions=[{page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',run:async function(){const name=this.ME.related('children','blocks')[0].properties.value;const result=await this.SERVICES.Call('wydstore','create',{store:'main',collection:'users',id:'submission',data:{name}});if(result.ok)this.ME.Replace(envelope('thanks','block',{content:{type:'markdown',value:'Thank you'}}));}}];
 const app=createApp({root,libraries,execution:{context:()=>context,handlers,actions,files}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});const url=`http://127.0.0.1:${server.address().port}`;
 const get=await fetch(url),html=await get.text(),cookie=get.headers.get('set-cookie').split(';')[0],csrf=/name="_csrf" value="([^"]+)"/.exec(html)[1];assert.equal(get.status,200);assert.match(html,/<form/);
 const post=async(body,token=csrf)=>{const response=await fetch(url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:`_target=form&_action=Submit&_csrf=${token}&${body}`});return {status:response.status,html:await response.text()};};
 const invalid=await post('name=&note=keep');assert.match(invalid.html,/aria-invalid="true"/);assert.match(invalid.html,/value="keep"/);
 const collection=createStores(libraries.bind(context)).get('main').collection('users');assert.equal((await collection.query()).length,0);
 assert.equal((await post('name=No','wrong')).status,403);assert.equal((await collection.query()).length,0);
 const valid=await post('name=Alice');assert.match(valid.html,/Thank you/);assert.doesNotMatch(valid.html,/<form/);assert.equal((await collection.get('submission')).get('name'),'Alice');
 const later=await fetch(url,{headers:{cookie}});assert.match(await later.text(),/<form/);const independent=await fetch(url);assert.match(await independent.text(),/<form/);
 const markdown=await fetch(url+'?markdown=1',{headers:{cookie}});assert.equal(await markdown.text(),'<h1>Explicit</h1>\n');
 const file=await fetch(url+'?file=1',{headers:{cookie}});assert.equal(await file.text(),'download report');assert.equal(file.headers.get('content-type'),'text/plain');
 assert.equal(trace.filter(x=>x[0]==='load').length,trace.filter(x=>x[0]==='unload').length);
 const ids=trace.filter(x=>x[0]==='load').map(x=>x[1]);assert.equal(ids[0],ids[1]);assert.ok(new Set(ids).size===2);
});

test('authenticated HTTP Page resolves fresh Gate identity; revoked and forged tokens never become Page authority',async t=>{
 const {configuration,gateContext,secret,project}=await import('../test-support/wydgate.js');
 const {loadLibraries}=await import('../wydgine/libraries/index.js');const {createGate}=await import('@wydgit/gate/client');const {default:platform}=await import('../package.json',{with:{type:'json'}});
 const config=configuration(await temp(t));config.libraries[0].options.app='boilerplate';config.libraries[0].bindings[0].app='boilerplate';config.libraries[1].options.stores[0].app='boilerplate';
 const registry=await loadLibraries({config,root:project,platformVersion:platform.version});const gateCtx=gateContext({app:'boilerplate',scopes:{wydgate:['boilerplate']}}),gate=createGate(registry.bind(gateCtx));
 const user=await gate.createUser({username:'alice',password:secret}),login=await gate.login('alice',secret),seen=[];
 const app=createApp({libraries:registry,execution:{gateContext:gateCtx,handlers:[{type:'Page.Load',owner:'home',run:function(){seen.push(this.SESSION.identity.userId);assert.equal(this.SESSION.authenticated,true);assert.throws(()=>this.REQUEST.Cookies.Get('__Host-wydgit-auth'));}}]}});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});const url=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(url,{headers:{cookie:`__Host-wydgit-auth=${login.token}`}});assert.equal(response.status,200);assert.deepEqual(seen,[user.id]);assert.ok(!(await response.text()).includes(login.token));
 await gate.logout(login.token);assert.equal((await fetch(url,{headers:{cookie:`__Host-wydgit-auth=${login.token}`}})).status,400);assert.equal(seen.length,1);
 assert.equal((await fetch(url,{headers:{cookie:'__Host-wydgit-auth=forged'}})).status,400);
});
