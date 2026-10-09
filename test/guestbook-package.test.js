import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { createHostApp } from '../app.js';
import { planPackageInstall, applyPackageInstall } from '../wydgine/packages/index.js';
import { loadRepository } from '../wydgine/repository.js';
import { packageFixture } from '../test-support/packages.js';

test('ordinary Guestbook: uninstalled → plan → install → normal host → POST → restart persistence',async t=>{
 const {root,options}=await packageFixture(t);assert.throws(()=>loadRepository(root).runtime.get('guestbook'));
 const plan=await planPackageInstall(options);assert.deepEqual(await fs.readdir(path.join(root,'data')),[]);
 await applyPackageInstall(plan);
 const start=async()=>{const app=await createHostApp({root});const server=app.listen(0,'127.0.0.1');await once(server,'listening');return {app,server,url:`http://127.0.0.1:${server.address().port}`};};
 let host=await start();t.after(()=>host.app.shutdown(host.server));
 const first=await fetch(host.url),html=await first.text();assert.equal(first.status,200);assert.match(html,/Guestbook/);
 const cookie=first.headers.get('set-cookie').split(';')[0],csrf=/name="_csrf" value="([^"]+)"/.exec(html)[1];
 const post=async(name,message,token=csrf)=>{const r=await fetch(host.url,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_target:'guestbook-form',_action:'Submit',_csrf:token,name,message})});return {status:r.status,html:await r.text()};};
 assert.equal((await post('Alice','bad','forged')).status,403);
 const invalid=await post(' ','keep this');assert.match(invalid.html,/aria-invalid="true"/);assert.match(invalid.html,/keep this/);
 const long=await post('Ada','x'.repeat(2001));assert.match(long.html,/aria-invalid="true"/);
 for(let i=0;i<2;i++){const saved=await post('Alice','Hello guestbook');assert.equal(saved.status,200);assert.match(saved.html,/Thank you/);assert.match(saved.html,/Alice — Hello guestbook/);assert.match(saved.html,/<textarea[^>]*><\/textarea>/);}
 for(const result of await Promise.all([post('Bob','Second'),post('Carol','Third')]))assert.match(result.html,/Thank you/);
 await host.app.shutdown(host.server);host=await start();const persisted=await (await fetch(host.url)).text();for(const value of ['Alice — Hello guestbook','Bob — Second','Carol — Third'])assert.ok(persisted.includes(value));
 assert.equal(persisted.split('Alice — Hello guestbook').length-1,2);
 for(const file of ['install.js','host.js','server.js'])await assert.rejects(fs.stat(new URL('../examples/guestbook/'+file,import.meta.url)),{code:'ENOENT'});
});
