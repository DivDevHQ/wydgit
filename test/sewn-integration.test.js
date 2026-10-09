import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../app.js';
import { fixture,modelFixture } from '../test-support/events.js';
import { dehydrate } from '../wydgine/object-model/index.js';
import { definition,load,temp } from '../test-support/wydstore.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createStores } from '@wydgit/store/client';

test('SEWN real GET/POST transport executes isolated Page trees and authorized WydStore persistence exactly once',async t=>{
 const root=await temp(t);for(const dir of ['content','prototypes','public'])await fs.cp(path.join(process.cwd(),dir),path.join(root,dir),{recursive:true});
 const raw=dehydrate(modelFixture().runtime);await fs.rm(path.join(root,'content/pages'),{recursive:true});await fs.mkdir(path.join(root,'content/pages'));await fs.writeFile(path.join(root,'content/pages/home.json'),JSON.stringify(raw.slots.pages[0]));await fs.writeFile(path.join(root,'content/navigation.json'),'[]');raw.slots.pages=[];raw.slots.navigation=[];await fs.writeFile(path.join(root,'content/app.json'),JSON.stringify(raw));
 const store={...definition(await temp(t)),app:raw.id,package:'acme/example'},libraries=await load(store);
 const base=fixture().context,context=new ExecutionContext({...base,capabilities:[...base.capabilities,'store.records.create','store.records.read'],scopes:{...base.scopes,wydstore:[{store:'main',collection:'users'}]}});
 const l=value=>({op:'literal',value}),c=name=>({op:'context',name}),r=(target,key)=>({op:'read',target,key});
 const handlers=[{type:'Page.Load',owner:'home',workflow:{schema:'sewn/0.1',body:[{op:'if',condition:{op:'binary',operator:'=',left:{op:'invoke',target:r(c('REQUEST'),'Query'),method:'Get',args:[l('markdown')]},right:l('1')},then:[{op:'call',target:c('RESPONSE'),method:'WriteMarkdown',args:[l('# Explicit')]},{op:'return',value:l(null)}]}]}}];
 const actions=[{page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',workflow:{schema:'sewn/0.1',body:[{op:'if',condition:r(r(c('ME'),'properties'),'valid'),then:[
 {op:'service',library:'wydstore',method:'create',input:{op:'object',fields:{store:l('main'),collection:l('users'),id:l('submission'),data:{op:'object',fields:{name:{op:'invoke',target:r(c('REQUEST'),'Form'),method:'Get',args:[l('name')]}}}}},into:'result'},
 {op:'if',condition:r({op:'variable',name:'result'},'ok'),then:[{op:'call',target:c('ME'),method:'Replace',args:[l({id:'thanks',type:'wydgit.core/block',properties:{content:{type:'markdown',value:'Thank you'}}})]}]}
 ],else:[{op:'stop',value:l('invalid')}]}]}}];
 let activeContext=context;
 const app=createApp({root,libraries,execution:{context:()=>activeContext,handlers,actions}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});const url=`http://127.0.0.1:${server.address().port}`;
 const get=await fetch(url),html=await get.text(),cookie=get.headers.get('set-cookie').split(';')[0],csrf=/name="_csrf" value="([^"]+)"/.exec(html)[1];assert.equal(get.status,200);assert.match(html,/<form/);
 const post=async(body,token=csrf)=>{const response=await fetch(url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:`_target=form&_action=Submit&_csrf=${token}&${body}`});return {status:response.status,html:await response.text()};};
 const invalid=await post('name=&note=keep');assert.match(invalid.html,/aria-invalid="true"/);assert.match(invalid.html,/value="keep"/);
 const collection=createStores(libraries.bind(context)).get('main').collection('users');assert.equal((await collection.query()).length,0);
 assert.equal((await post('name=No','wrong')).status,403);assert.equal((await collection.query()).length,0);
 activeContext=new ExecutionContext({...context,capabilities:context.capabilities.filter(x=>x!=='store.records.create')});const denied=await post('name=Denied');assert.doesNotMatch(denied.html,/Thank you/);assert.equal((await collection.query()).length,0);activeContext=context;
 const valid=await post('name=Alice');assert.match(valid.html,/Thank you/);assert.doesNotMatch(valid.html,/<form/);assert.equal((await collection.get('submission')).get('name'),'Alice');
 const later=await fetch(url,{headers:{cookie}});assert.match(await later.text(),/<form/);const independent=await fetch(url);assert.match(await independent.text(),/<form/);
 const markdown=await fetch(url+'?markdown=1',{headers:{cookie}});assert.equal(await markdown.text(),'<h1>Explicit</h1>\n');
});
