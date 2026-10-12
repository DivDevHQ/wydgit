import test from 'node:test';
import { demonstrateMembership } from '../examples/membership/demo.js';
for(const provider of ['json','sqlite'])test(`${provider}: real HTTP declarative membership, cookies, CSRF, rotation and revocation`,async t=>{await demonstrateMembership(t,provider);});
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { load as html } from 'cheerio';
import { membershipFixture } from '../test-support/membership.js';
import { createHostApp } from '../app.js';
test('administrator member-list presentation denies anonymous/member callers and renders only approved safe data',async t=>{
 const f=await membershipFixture(t,'json','open',true,{administration:true});const alice=await f.gate.register({username:'alice',password:f.password,displayName:'Alice'});await f.gate.register({username:'bobby',password:f.password,displayName:'Bob <safe>'});
 const app=await createHostApp({root:f.root,execution:{gateContext:f.gateContext}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>app.shutdown(server));const base='http://127.0.0.1:'+server.address().port;
 const anonymous=html(await(await fetch(base+'/')).text());assert.match(anonymous('#membership-member-list').text(),/not authorized/);assert.doesNotMatch(anonymous('#membership-member-list').text(),/Bob/);
 const member=await f.gate.login('alice',f.password),headers={Cookie:'__Host-wydgit-auth='+member.token};const ordinary=html(await(await fetch(base+'/',{headers})).text());assert.match(ordinary('#membership-member-list').text(),/not authorized/);
 await f.gate.manageMember({id:alice.membership.id,role:'administrator'});const admin=await f.gate.login('alice',f.password);headers.Cookie='__Host-wydgit-auth='+admin.token;const response=await fetch(base+'/',{headers}),text=await response.text();assert.equal(response.status,200);const page=html(text);assert.equal(page('#membership-member-list li').length,2);assert.match(page('#membership-member-list').text(),/Bob <safe>/);assert.equal(page('#membership-member-list safe').length,0);assert.ok(!text.includes(admin.token));assert.ok(!text.includes(f.password));
});
