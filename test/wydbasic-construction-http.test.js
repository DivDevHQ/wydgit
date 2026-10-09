import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../app.js';
import {modelFixture,fixture} from '../test-support/events.js';
import {dehydrate,ExecutionContext} from '../wydgine/object-model/index.js';
import {temp} from '../test-support/wydstore.js';

test('real HTTP EVENT Submit constructs a draft, dispatches portable inherited/overridden behavior and renders only the local request tree',async t=>{
 const root=await temp(t);for(const dir of ['content','prototypes','public'])await fs.cp(path.join(process.cwd(),dir),path.join(root,dir),{recursive:true});
 const raw=dehydrate(modelFixture().runtime);await fs.rm(path.join(root,'content/pages'),{recursive:true});await fs.mkdir(path.join(root,'content/pages'));await fs.writeFile(path.join(root,'content/pages/home.json'),JSON.stringify(raw.slots.pages[0]));await fs.writeFile(path.join(root,'content/navigation.json'),'[]');raw.slots.pages=[];raw.slots.navigation=[];await fs.writeFile(path.join(root,'content/app.json'),JSON.stringify(raw));
 const base=fixture().context;const context=new ExecutionContext({...base,visible:[...base.visible,'result-panel'],editable:[...base.editable,'result-panel'],capabilities:[...base.capabilities,'object.instances.construct'],scopes:{...base.scopes,prototypes:['acme/important-message-panel']}});
 const handlers=[{owner:'section',source:'form',wydBasicModule:`EVENT Submit
 DIM panel AS Wydgit
 SET panel = NEW "acme/important-message-panel"("result-panel")
 CALL panel.SetMessage(REQUEST.Form.Get("name"))
 IF panel.HasMessage() THEN
  Me.Insert("blocks", 0, panel)
 END IF
END EVENT`}];
 const actions=[{page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',wydBasicModule:'EVENT Submit\nEND EVENT'}];
 let activeContext=context;const app=createApp({root,execution:{context:()=>activeContext,handlers,actions}});const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});const url=`http://127.0.0.1:${server.address().port}`;
 const first=await fetch(url),html=await first.text(),cookie=first.headers.get('set-cookie').split(';')[0],csrf=/name="_csrf" value="([^"]+)"/.exec(html)[1];assert.equal(first.status,200);
 const post=token=>fetch(url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:`_target=form&_action=Submit&_csrf=${token}&name=Resources`});
 assert.equal((await post('forged')).status,403);
 const rendered=await post(csrf);assert.equal(rendered.status,200);assert.match(await rendered.text(),/Important: Resources/);
 activeContext=new ExecutionContext({...context,capabilities:context.capabilities.filter(x=>x!=='object.instances.construct')});const denied=await post(csrf);assert.equal(denied.status,403);assert.doesNotMatch(await denied.text(),/Important: Resources/);activeContext=context;
 for(const response of await Promise.all([fetch(url,{headers:{cookie}}),fetch(url)])){assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/Important: Resources/);}
});
