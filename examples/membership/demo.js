// Trusted disposable demonstration: random credentials, temporary App and storage.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { load as html } from 'cheerio';
import { pathToFileURL } from 'node:url';
import { membershipFixture } from '../../test-support/membership.js';
import { createHostApp } from '../../app.js';
export async function demonstrateMembership(t,provider='json',write=()=>{}) {
 const f=await membershipFixture(t,provider);
 const owner=await f.gate.bootstrapOwner({username:'owner',password:f.password});assert.equal(owner.membership.role,'owner');
 const app=await createHostApp({root:f.root,execution:{gateContext:f.gateContext,authenticatedPages:['about']}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>app.shutdown(server));
 const base='http://127.0.0.1:'+server.address().port;
 let response=await fetch(base+'/'),page=html(await response.text());assert.equal(response.status,200);
 const anonymous=response.headers.getSetCookie().find(c=>c.startsWith('__Host-wydgit-session=')).split(';')[0];
 for(const id of ['login','register','logout','account-profile','change-password'])assert.ok(page('#membership-'+id).length);
 assert.equal(page('input[type=password][value]').length,0);assert.equal(page('#membership-login input[type=password]').attr('autocomplete'),'current-password');
 const action=id=>page('#membership-'+id).attr('action');
 const post=(url,values,cookie=anonymous)=>fetch(base+url,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});
 const anonymousLoginAction=action('login');
 let registration=await post(action('register'),{username:'alice',password:f.password,displayName:'Alice'});const registeredText=await registration.text();assert.equal(registration.status,200,registeredText);const duplicate=await post(action('register'),{username:'alice',password:f.password,displayName:'Alice'});assert.equal(duplicate.status,200);assert.equal(await duplicate.text(),registeredText);
 const csrfless=action('login').split('?')[0];assert.equal((await post(csrfless,{username:'alice',password:f.password})).status,403);
 assert.equal((await post(action('login'),{username:'unknown',password:f.password})).status,400);
 response=await post(action('login'),{username:'alice',password:f.password});const loginText=await response.text();assert.equal(response.status,200,loginText);assert.ok(!loginText.includes(f.password));
 const authHeader=response.headers.getSetCookie().find(c=>c.startsWith('__Host-wydgit-auth='));assert.match(authHeader,/Secure; HttpOnly; SameSite=Lax; Max-Age=/);const auth=authHeader.split(';')[0],token=auth.slice(auth.indexOf('=')+1);assert.ok(!loginText.includes(token));
 assert.equal((await fetch(base+'/about/',{headers:{Cookie:auth}})).status,200);assert.equal((await fetch(base+'/about/')).status,403);
 response=await fetch(base+'/',{headers:{Cookie:auth}});page=html(await response.text());
 assert.equal((await post(anonymousLoginAction,{username:'alice',password:f.password},auth)).status,403);
 const oldAuth=auth;response=await post(action('login'),{username:'alice',password:f.password},auth);assert.equal(response.status,200);const rotated=response.headers.getSetCookie().find(c=>c.startsWith('__Host-wydgit-auth=')).split(';')[0];assert.notEqual(rotated,auth);await assert.rejects(f.gate.resolveSession(token),{code:'GATE.SESSION_INVALID'});
 response=await fetch(base+'/',{headers:{Cookie:rotated}});page=html(await response.text());
 assert.equal((await post(action('account-profile'),{displayName:'Changed',role:'administrator'},rotated)).status,400);
 response=await post(action('account-profile'),{displayName:'Updated member'},rotated);assert.equal(response.status,200,await response.text());
 // A former anonymous binding token cannot authorize an authenticated operation.
 assert.equal((await post(action('logout'),{},oldAuth)).status,403);
 response=await post(action('logout'),{},rotated);assert.equal(response.status,200,await response.text());assert.ok(response.headers.getSetCookie().some(c=>c.includes('Max-Age=0')));
 assert.equal((await fetch(base+'/about/',{headers:{Cookie:rotated}})).status,403);
 const cross={...f.gateContext,app:'anotherApp'};const {ExecutionContext}=await import('../../wydgine/seam/context.js');assert.equal((await f.libraries.bind(new ExecutionContext(cross)).invoke('wydgate','1.0.0','list-members',{})).code,'GATE.DENIED');
 write(`${provider}: package installed; owner bootstrapped; registration, login, authenticated page, CSRF rejection, rotation, profile, logout and App isolation passed.`);
 return f;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const cleanup=[];try{await demonstrateMembership({after:work=>cleanup.push(work)},process.argv[2]??'json',console.log);}finally{for(const work of cleanup.reverse())await work();}
}
