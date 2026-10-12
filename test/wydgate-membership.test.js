import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { membershipFixture } from '../test-support/membership.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createGate } from '@wydgit/gate/client';
import { installPackage,planPackageInstall,applyPackageInstall } from '../wydgine/packages/index.js';
const denied=(work,code)=>assert.rejects(work,{code});
for(const provider of ['json','sqlite']) {
 test(`${provider}: membership registration, identity facts, self-service and capability separation`,async t=>{
  const f=await membershipFixture(t,provider),owner=await f.gate.bootstrapOwner({username:'owner',password:f.password});
  assert.equal(owner.membership.role,'owner');await denied(()=>f.gate.bootstrapOwner({username:'another',password:f.password}),'GATE.DENIED');
  const registered=await f.gate.register({username:'alice',password:f.password,displayName:'Alice'});assert.equal(registered.membership.app,'boilerplate');
  await denied(()=>f.gate.register({username:'alice',password:f.password}),'GATE.REGISTRATION_FAILED');
  const login=await f.gate.login('alice',f.password),identity=await f.gate.resolveSession(login.token),self=f.memberGate(identity);
  assert.equal(identity.membershipId,registered.membership.id);assert.equal(identity.membershipRole,'member');
  assert.equal((await self.currentAccount()).id,registered.account.id);assert.equal((await self.currentMembership()).id,registered.membership.id);
  await self.updateAccount('New name');assert.equal((await self.currentAccount()).displayName,'New name');
  await denied(()=>self.listMembers(),'SEAM.DENIED');await denied(()=>self.manageMember({id:registered.membership.id,role:'administrator'}),'SEAM.DENIED');
  await f.gate.manageMember({id:registered.membership.id,role:'administrator'});await denied(()=>f.gate.resolveSession(login.token),'GATE.SESSION_INVALID');const promoted=await f.gate.login('alice',f.password),admin=f.memberGate(await f.gate.resolveSession(promoted.token));await denied(()=>admin.listMembers(),'SEAM.DENIED');
  const context=new ExecutionContext({publisher:'acme',package:'acme/other',installation:'other',self:'widget',app:'other',identity:null,capabilities:['gate.members.manage'],scopes:{wydgate:['boilerplate']}});
  await denied(()=>createGate(f.libraries.bind(context)).listMembers(),'GATE.DENIED');
  assert.equal((await f.gate.listMembers({limit:1})).members.length,1);await denied(()=>f.gate.listMembers({limit:51}),'GATE.INVALID_USER');
  await denied(()=>admin.changeOwnPassword('wrong long passphrase',f.password+'new'),'GATE.AUTH_FAILED');
  await admin.changeOwnPassword(f.password,f.password+'new');await denied(()=>f.gate.resolveSession(login.token),'GATE.SESSION_INVALID');await denied(()=>self.currentAccount(),'GATE.SESSION_INVALID');
  await denied(()=>f.gate.login('alice',f.password),'GATE.AUTH_FAILED');const fresh=await f.gate.login('alice',f.password+'new');
  await f.gate.manageMember({id:registered.membership.id,status:'suspended'});await denied(()=>f.gate.resolveSession(fresh.token),'GATE.SESSION_INVALID');await denied(()=>f.gate.login('alice',f.password+'new'),'GATE.AUTH_FAILED');
  await f.gate.manageMember({id:registered.membership.id,status:'active'});await denied(()=>f.gate.resolveSession(fresh.token),'GATE.SESSION_INVALID');
  const secretFree=JSON.stringify(await f.gate.listMembers());assert.ok(!secretFree.includes(f.password));assert.doesNotMatch(secretFree,/passwordHash|digest|argon2/);
 });
 test(`${provider}: owner claims race atomically and package installation cannot bootstrap`,async t=>{
  const f=await membershipFixture(t,provider);const results=await Promise.allSettled([f.gate.bootstrapOwner({username:'ownerone',password:f.password}),f.gate.bootstrapOwner({username:'ownertwo',password:f.password})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const ctx=new ExecutionContext({...f.gateContext,publisher:'divdev',package:'divdev/membership',principal:'divdev/membership',installation:'package-install'});
  await denied(()=>createGate(f.libraries.bind(ctx)).bootstrapOwner({username:'evilowner',password:f.password}),'GATE.DENIED');assert.equal((await f.gate.listMembers()).total,1);
 });
 test(`${provider}: remote recovery is safely unavailable and exposes no challenge`,async t=>{
  const f=await membershipFixture(t,provider);assert.deepEqual({...await f.gate.requestPasswordReset('unknown')},{accepted:true,available:false});assert.deepEqual({...await f.gate.requestPasswordReset('owner')},{accepted:true,available:false});
 });
}
for(const policy of ['disabled','invitation-only','open'])test(`trusted registration policy ${policy}`,async t=>{
 const f=await membershipFixture(t,'json',policy);const input={username:'alice',password:f.password};
 if(policy==='open')await f.gate.register(input);else await denied(()=>f.gate.register(input),'GATE.REGISTRATION_FAILED');
 if(policy==='invitation-only'){const invitation=await f.gate.inviteMember('alice');await denied(()=>f.gate.register(input),'GATE.REGISTRATION_FAILED');const invited={...input,invitationToken:invitation.token};const results=await Promise.allSettled([f.gate.register(invited),f.gate.register(invited)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);}
});
test('membership installer rejects unapproved grants and rolls back failed activation',async t=>{
 const f=await membershipFixture(t,'json','disabled',false);await denied(()=>installPackage({...f.options,approvals:{...f.manifest.permissions,capabilities:[]}}),'PACKAGE.DENIED');
 const before=await fs.readFile(path.join(f.root,'content/pages/home.json'),'utf8');const plan=await planPackageInstall(f.options);await assert.rejects(applyPackageInstall(plan,{beforeReplace:()=>{throw new Error('injected');}}),/injected/);
 assert.equal(await fs.readFile(path.join(f.root,'content/pages/home.json'),'utf8'),before);await assert.rejects(fs.stat(path.join(f.root,'content/installed-packages.json')),{code:'ENOENT'});
});
test('authentication abuse is bounded without per-username enumeration buckets',async t=>{
 const f=await membershipFixture(t);for(let i=0;i<30;i++)await denied(()=>f.gate.login('unknown','wrong long passphrase'),'GATE.AUTH_FAILED');await denied(()=>f.gate.login('different','wrong long passphrase'),'GATE.RATE_LIMIT');
});
for(const provider of ['json','sqlite'])test(`${provider}: recovery challenges expire, remain private and have one CAS winner`,async t=>{
 const delivered=[];const f=await membershipFixture(t,provider,'open',true,{adapter:{deliverRecovery:async message=>{delivered.push(message);}}});
 await f.gate.register({username:'alice',password:f.password});const session=await f.gate.login('alice',f.password);
 await f.gate.requestPasswordReset('unknown');assert.equal(delivered.length,0);await f.gate.requestPasswordReset('alice');assert.equal(delivered.length,1);
 const first=delivered[0];assert.equal(first.app,'boilerplate');assert.match(first.token,/^[0-9a-f]{64}$/);
 const now=t.mock.method(Date,'now',()=>first.expiresAt);await denied(()=>f.gate.resetPassword(first.token,f.password+'next'),'GATE.RECOVERY_INVALID');now.mock.restore();
 await f.gate.requestPasswordReset('alice');const token=delivered[1].token;
 const attempts=await Promise.allSettled([f.gate.resetPassword(token,f.password+'next'),f.gate.resetPassword(token,f.password+'other')]);assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);assert.equal(attempts.find(a=>a.status==='rejected').reason.code,'GATE.RECOVERY_INVALID');
 await denied(()=>f.gate.resetPassword(token,f.password+'again'),'GATE.RECOVERY_INVALID');await denied(()=>f.gate.resolveSession(session.token),'GATE.SESSION_INVALID');await denied(()=>f.gate.login('alice',f.password),'GATE.AUTH_FAILED');
 const record=await f.libraries.bind(new ExecutionContext({publisher:'wydgit.core',package:'library:wydgate',app:'boilerplate',self:'host',capabilities:['store.records.read'],scopes:{wydstore:[{store:'identity',collection:'directory'}]}})).call('wydstore','get',{store:'identity',collection:'directory',id:'local-identity'});
 assert.equal(record.ok,true);assert.ok(!JSON.stringify(record).includes(token));assert.ok(!JSON.stringify(record).includes(f.password));assert.equal(record.value.data.membership.challenges[0].used,true);
});
test('failed recovery delivery invalidates its challenge without exposing account existence',async t=>{
 let challenge;const f=await membershipFixture(t,'json','open',true,{adapter:{deliverRecovery:async message=>{challenge=message.token;throw new Error('delivery failed');}}});await f.gate.register({username:'alice',password:f.password});
 assert.deepEqual({...await f.gate.requestPasswordReset('alice')},{accepted:true,available:true});await denied(()=>f.gate.resetPassword(challenge,f.password+'next'),'GATE.RECOVERY_INVALID');
});
for(const provider of ['json','sqlite'])test(`${provider}: idle expiry, logout, disablement and spoofed claims fail closed`,async t=>{
 const f=await membershipFixture(t,provider,'open',true,{options:{sessionIdleMs:1000}});await f.gate.register({username:'alice',password:f.password});const login=await f.gate.login('alice',f.password),identity=await f.gate.resolveSession(login.token),self=f.memberGate(identity);
 const now=t.mock.method(Date,'now',(()=>{const expired=Date.now()+1001;return ()=>expired;})());await denied(()=>f.gate.resolveSession(login.token),'GATE.SESSION_INVALID');await denied(()=>self.currentAccount(),'GATE.SESSION_INVALID');now.mock.restore();
 const next=await f.gate.login('alice',f.password),current=f.memberGate(await f.gate.resolveSession(next.token));assert.equal((await current.listSessions()).some(s=>s.id===next.session.id),true);
 await denied(()=>current.revokeOwnSession('s_00000000-0000-4000-8000-000000000000'),'GATE.DENIED');
 const forged=f.memberGate({...identity,sessionId:'s_00000000-0000-4000-8000-000000000000',membershipRole:'owner'});await denied(()=>forged.currentAccount(),'GATE.SESSION_INVALID');await denied(()=>forged.listMembers(),'SEAM.DENIED');
 await current.disableAccount();await denied(()=>f.gate.resolveSession(next.token),'GATE.SESSION_INVALID');await denied(()=>f.gate.login('alice',f.password),'GATE.AUTH_FAILED');
});
test('installed administration needs both a live App administrator fact and a SEAM grant',async t=>{
 const f=await membershipFixture(t);const registered=await f.gate.register({username:'alice',password:f.password});const login=await f.gate.login('alice',f.password),identity=await f.gate.resolveSession(login.token);
 const administration=subject=>createGate(f.libraries.bind(new ExecutionContext({publisher:'divdev',package:'divdev/admin',installation:'admin-receipt',self:'admin',app:'boilerplate',identity:subject,capabilities:['gate.members.manage'],scopes:{wydgate:['boilerplate']}})));
 await denied(()=>administration(null).listMembers(),'GATE.DENIED');await denied(()=>administration(identity).listMembers(),'GATE.DENIED');
 await denied(()=>administration({...identity,membershipRole:'administrator'}).listMembers(),'GATE.DENIED');
 await f.gate.manageMember({id:registered.membership.id,role:'administrator'});const promoted=await f.gate.login('alice',f.password),adminIdentity=await f.gate.resolveSession(promoted.token);assert.equal((await administration(adminIdentity).listMembers()).total,1);
 // Membership facts are reread, even when a once-valid host context is retained.
 await f.gate.manageMember({id:registered.membership.id,role:'member'});await denied(()=>administration(adminIdentity).listMembers(),'GATE.SESSION_INVALID');
});
for(const provider of ['json','sqlite'])test(`${provider}: invitation secrets are required, hashed, expiring and cannot claim another username`,async t=>{
 const f=await membershipFixture(t,provider,'invitation-only');const invitation=await f.gate.inviteMember('alice');const input={username:'alice',password:f.password};
 await denied(()=>f.gate.register(input),'GATE.REGISTRATION_FAILED');await denied(()=>f.gate.register({...input,invitationToken:'0'.repeat(64)}),'GATE.REGISTRATION_FAILED');await denied(()=>f.gate.register({...input,username:'bobby',invitationToken:invitation.token}),'GATE.REGISTRATION_FAILED');
 const now=t.mock.method(Date,'now',()=>invitation.expiresAt);await denied(()=>f.gate.register({...input,invitationToken:invitation.token}),'GATE.REGISTRATION_FAILED');now.mock.restore();
 const replacement=await f.gate.inviteMember('alice');await denied(()=>f.gate.register({...input,invitationToken:invitation.token}),'GATE.REGISTRATION_FAILED');const registered=await f.gate.register({...input,invitationToken:replacement.token});assert.equal(registered.membership.status,'active');
});
test('membership limits and host password policy cannot be raised by registration fields',async t=>{
 const f=await membershipFixture(t,'json','open',true,{options:{membership:{registration:'open',maxMembers:1,passwordMinLength:32}}});await denied(()=>f.gate.register({username:'alice',password:'a short valid passphrase'}),'GATE.INVALID_PASSWORD');await f.gate.register({username:'alice',password:f.password+'extended'});
 await denied(()=>f.gate.register({username:'bobby',password:f.password+'extended'}),'GATE.LIMIT');await denied(()=>f.gate.register({username:'bobby',password:f.password+'extended',maxMembers:1000}),'GATE.INVALID_USER');
});
