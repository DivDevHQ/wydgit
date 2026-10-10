import test from 'node:test';
import assert from 'node:assert/strict';
import { createGate } from '@wydgit/gate/client';
import { manifest } from '@wydgit/gate';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { fixture, secret, gateContext, load, directoryRequest, temp, configuration } from '../test-support/wydgate.js';
const reject=(work,code)=>assert.rejects(work,error=>error.code===code,code);
const plain=value=>JSON.parse(JSON.stringify(value));
const safe=value=>assert.doesNotMatch(JSON.stringify(value),/passwordHash|\$argon2|digest|credentials/);

for(const provider of ['json','sqlite']) {
 test(`${provider}: opaque sessions persist only digests, resolve after reopen, and logout revokes`,async t=>{
  const {gate,storage,config}=await fixture(t,provider);
  const user=await gate.createUser({username:'alice',password:secret});
  const first=await gate.login('ALICE',secret),second=await gate.login('alice',secret);
  assert.match(first.token,/^[0-9a-f]{64}$/);assert.notEqual(first.token,second.token);assert.notEqual(first.session.id,second.session.id);
  assert.equal(first.session.userId,user.id);assert.equal(first.session.expiresAt-first.session.createdAt,3600000);safe(first);
  const identity=await gate.resolveSession(first.token);assert.equal(identity.authenticated,true);assert.equal(identity.sessionId,first.session.id);assert.equal(identity.userId,user.id);safe(identity);
  assert.ok(!JSON.stringify(identity).includes(first.token));assert.ok(Object.isFrozen(identity.permissions));
  const history=await storage.call('wydstore','history',directoryRequest);assert.equal(history.ok,true);
  assert.ok(!JSON.stringify(history).includes(first.token));assert.ok(!JSON.stringify(history).includes(second.token));assert.ok(!JSON.stringify(history).includes(secret));
  const persisted=(await storage.call('wydstore','get',directoryRequest)).value.data.sessions;
  assert.match(persisted[0].digest,/^[a-f0-9]{64}$/);assert.notEqual(persisted[0].digest,first.token);
  const reopened=createGate((await load(config)).bind(gateContext()));assert.deepEqual(await reopened.resolveSession(first.token),identity);
  await gate.logout(first.token);await reject(()=>reopened.resolveSession(first.token),'GATE.SESSION_INVALID');
  assert.equal((await gate.resolveSession(second.token)).userId,user.id);
  await gate.revokeSession(second.session.id);await reject(()=>gate.resolveSession(second.token),'GATE.SESSION_INVALID');
  await reject(()=>gate.resolveSession(first.session.id),'GATE.SESSION_INVALID');await reject(()=>gate.resolveSession('0'.repeat(64)),'GATE.SESSION_INVALID');
 });

 test(`${provider}: expiry boundary, disabled users and password changes invalidate sessions permanently`,async t=>{
  const {gate}=await fixture(t,provider);const user=await gate.createUser({username:'alice',password:secret});
  const session=await gate.login('alice',secret),now=t.mock.method(Date,'now',()=>session.session.expiresAt-1);
  assert.equal((await gate.resolveSession(session.token)).userId,user.id);
  now.mock.mockImplementation(()=>session.session.expiresAt);await reject(()=>gate.resolveSession(session.token),'GATE.SESSION_INVALID');now.mock.restore();
  const active=await gate.login('alice',secret);await gate.updateUser({id:user.id,active:false});
  await reject(()=>gate.login('alice',secret),'GATE.AUTH_FAILED');await reject(()=>gate.resolveSession(active.token),'GATE.SESSION_INVALID');
  await gate.updateUser({id:user.id,active:true});await reject(()=>gate.resolveSession(active.token),'GATE.SESSION_INVALID');
  const next=await gate.login('alice',secret);await gate.changePassword(user.id,'replacement passphrase');await reject(()=>gate.resolveSession(next.token),'GATE.SESSION_INVALID');
  await reject(()=>gate.login('alice',secret),'GATE.AUTH_FAILED');assert.ok((await gate.login('alice','replacement passphrase')).token);
 });

 test(`${provider}: roles, groups and direct permissions combine deterministically and removals are immediate`,async t=>{
  const {gate,config}=await fixture(t,provider);const user=await gate.createUser({username:'alice',password:secret});
  const reader=await gate.createRole({name:'Reader',permissions:['forum.post.read','forum.post.read']}),moderator=await gate.createRole({name:'Moderator',permissions:['forum.post.moderate']});
  assert.match(reader.id,/^r_/);assert.deepEqual(reader.permissions,['forum.post.read']);
  await gate.assignUser({userId:user.id,roles:[reader.id],permissions:['forum.post.write']});
  const group=await gate.createGroup({name:'Staff',members:[user.id],roles:[moderator.id],permissions:['forum.post.read']}),other=await gate.createGroup({name:'Other',members:[user.id],roles:[reader.id],permissions:['forum.topic.read']});
  assert.match(group.id,/^g_/);assert.equal((await gate.getGroup(group.id)).id,group.id);
  const login=await gate.login('alice',secret);
  const expected=['forum.post.moderate','forum.post.read','forum.post.write','forum.topic.read'];
  const auth=await gate.getAuthorization(user.id);assert.deepEqual(auth.permissions,expected);assert.deepEqual(auth.roles,[reader.id,moderator.id].sort());assert.deepEqual(auth.groups,[group.id,other.id].sort());
  assert.deepEqual((await gate.resolveSession(login.token)).permissions,expected);
  const renamed=await gate.updateRole({id:moderator.id,name:'Renamed',permissions:[]});assert.equal(renamed.id,moderator.id);assert.equal((await gate.getRole(moderator.id)).name,'Renamed');
  assert.ok(!(await gate.resolveSession(login.token)).permissions.includes('forum.post.moderate'));
  await gate.updateGroup({id:other.id,members:[]});assert.ok(!(await gate.resolveSession(login.token)).permissions.includes('forum.topic.read'));
  await gate.assignUser({userId:user.id,roles:[],permissions:[]});await gate.deleteGroup(group.id);
  assert.deepEqual((await gate.resolveSession(login.token)).permissions,[]);
  await gate.assignUser({userId:user.id,roles:[reader.id],permissions:[]});await gate.deleteRole(reader.id);
  assert.deepEqual((await gate.getAuthorization(user.id)).roles,[]);await reject(()=>gate.getRole(reader.id),'GATE.ROLE_NOT_FOUND');await reject(()=>gate.getGroup(group.id),'GATE.GROUP_NOT_FOUND');
  const reopened=createGate((await load(config)).bind(gateContext()));assert.deepEqual((await reopened.resolveSession(login.token)).permissions,[]);
 });

 test(`${provider}: minimal profile is separate from credentials and cannot modify identity or authority`,async t=>{
  const {gate,storage}=await fixture(t,provider);const user=await gate.createUser({username:'alice',password:secret,displayName:'Alice'});
  const before=(await storage.call('wydstore','get',directoryRequest)).value.data.credentials;
  assert.deepEqual(plain(await gate.getProfile(user.id)),{userId:user.id,bio:''});
  const profile=await gate.updateProfile({userId:user.id,bio:'A short biography'});assert.equal(profile.userId,user.id);safe(profile);
  const after=(await storage.call('wydstore','get',directoryRequest)).value.data;assert.deepEqual(after.credentials,before);assert.equal(after.profiles[0].bio,'A short biography');assert.ok(!Object.hasOwn(after.users[0],'bio'));
  assert.equal((await gate.getUser(user.id)).displayName,'Alice');assert.deepEqual((await gate.getAuthorization(user.id)).permissions,[]);
  await reject(()=>gate.updateProfile({userId:user.id,bio:'x',permissions:['store.records.write']}),'GATE.INVALID_USER');
  await reject(()=>gate.updateProfile({userId:user.id,bio:'x'.repeat(1025)}),'GATE.INVALID_PROFILE');
 });

 test(`${provider}: concurrent session revocation and authorization changes preserve each other`,async t=>{
  const {gate,config}=await fixture(t,provider),other=createGate((await load(config)).bind(gateContext()));
  const user=await gate.createUser({username:'alice',password:secret}),login=await gate.login('alice',secret);
  const role=await gate.createRole({name:'Author',permissions:['forum.post.write']});
  await Promise.all([gate.logout(login.token),other.assignUser({userId:user.id,roles:[role.id],permissions:[]})]);
  await reject(()=>other.resolveSession(login.token),'GATE.SESSION_INVALID');assert.deepEqual((await gate.getAuthorization(user.id)).permissions,['forum.post.write']);
 });
}

test('session identity is frozen host context metadata, never runtime authority or a package-minted context',async t=>{
 const {gate,registry}=await fixture(t),user=await gate.createUser({username:'alice',password:secret});
 await gate.assignUser({userId:user.id,roles:[],permissions:['store.records.write']});
 const login=await gate.login('alice',secret),identity=await gate.resolveSession(login.token);
 const context=new ExecutionContext({publisher:'acme',package:'acme/app',self:'widget',app:'appA',identity});
 assert.equal(context.identity.userId,user.id);assert.equal(context.identity.authenticated,true);assert.equal(context.allows('store.records.write'),false);
 assert.deepEqual(context.capabilities,[]);assert.deepEqual(context.traversal,[]);assert.deepEqual(context.visible,['widget']);
 assert.throws(()=>context.identity.permissions.push('gate.roles.manage'),TypeError);
 assert.throws(()=>registry.bind({...context}),error=>error.code==='SEAM.CONTEXT');
 assert.throws(()=>new ExecutionContext({publisher:'acme',self:'widget',app:'appB',identity}),error=>error.code==='SEAM.CONTEXT');
 await gate.assignUser({userId:user.id,roles:[],permissions:[]});assert.deepEqual((await gate.resolveSession(login.token)).permissions,[]);
 assert.deepEqual(context.identity.permissions,['store.records.write']); // Snapshot: host must resolve on each request.
 const privileged=gateContext({capabilities:[...manifest.capabilities,'store.records.write']});
 assert.deepEqual((await createGate(registry.bind(privileged)).getAuthorization(user.id)).permissions,[]);
 const denied=registry.bind(context);assert.equal((await denied.call('wydgate','resolve-session',{token:login.token})).code,'SEAM.DENIED');
});

test('administration requires exact capabilities and App scope; client input cannot fix or forge a session',async t=>{
 const {gate,registry}=await fixture(t),user=await gate.createUser({username:'alice',password:secret}),login=await gate.login('alice',secret);
 const requests={login:{username:'alice',password:secret},logout:{token:login.token},'resolve-session':{token:login.token},'revoke-session':{id:login.session.id},'create-role':{name:'Role',permissions:[]},'create-group':{name:'Group',roles:[],members:[],permissions:[]},'assign-user':{userId:user.id,roles:[],permissions:[]},'update-profile':{userId:user.id,bio:'x'}};
 for(const [name,input] of Object.entries(requests)) {
  const capability=manifest.services.find(service=>service.name===name).capability;
  assert.equal((await registry.bind(gateContext({capabilities:manifest.capabilities.filter(value=>value!==capability)})).call('wydgate',name,input)).code,'SEAM.DENIED');
  assert.equal((await registry.bind(gateContext({app:'appB'})).call('wydgate',name,input)).code,'GATE.DENIED');
 }
 for(const extra of [{token:login.token},{sessionId:login.session.id},{userId:user.id},{identity:{authenticated:true}},{expiresAt:Date.now()+999999}]) {
  assert.equal((await registry.bind(gateContext()).call('wydgate','login',{username:'alice',password:secret,...extra})).code,'GATE.INVALID_USER');
 }
 assert.equal((await registry.bind(gateContext()).call('wydgate','create-session',{userId:user.id})).code,'SEAM.DENIED');
 await reject(()=>gate.login('unknown',secret),'GATE.AUTH_FAILED');await reject(()=>gate.login('alice','wrong long password'),'GATE.AUTH_FAILED');
});

test('authorization rejects hostile permissions, unknown references, nested groups and identity changes atomically',async t=>{
 const {gate,storage}=await fixture(t),user=await gate.createUser({username:'alice',password:secret});
 const role=await gate.createRole({name:'Role',permissions:[]}),group=await gate.createGroup({name:'Group',roles:[],members:[],permissions:[]});
 const before=(await storage.call('wydstore','get',directoryRequest)).value;
 for(const permission of ['*','forum.*.read','Forum.post.read','forum.post','a.b.c.d','a'.repeat(129)])await reject(()=>gate.createRole({name:'x',permissions:[permission]}),'GATE.INVALID_AUTHORIZATION');
 await reject(()=>gate.assignUser({userId:user.id,roles:[group.id],permissions:[]}),'GATE.INVALID_AUTHORIZATION');
 await reject(()=>gate.updateGroup({id:group.id,members:[group.id]}),'GATE.INVALID_AUTHORIZATION');
 await reject(()=>gate.updateGroup({id:group.id,groups:[group.id]}),'GATE.INVALID_AUTHORIZATION');
 await reject(()=>gate.updateRole({id:role.id,newId:'changed'}),'GATE.INVALID_AUTHORIZATION');
 for(const key of ['__proto__','constructor','prototype'])await reject(()=>gate.updateProfile(JSON.parse(`{"userId":"${user.id}","bio":"x","${key}":true}`)),'SERVICE.INVALID_REQUEST');
 assert.deepEqual((await storage.call('wydstore','get',directoryRequest)).value,before);
});

test('login cannot commit a session if account or credential changes after verification',async t=>{
 const argon2=(await import('argon2')).default;
 for(const change of ['disable','password']) {
  const {gate,storage}=await fixture(t),user=await gate.createUser({username:'alice',password:secret});
  const verify=argon2.verify,mock=t.mock.method(argon2,'verify',async(...args)=>{
   const value=await verify(...args);
   if(change==='disable')await gate.updateUser({id:user.id,active:false});else await gate.changePassword(user.id,'a newer test passphrase');return value;
  });
  await reject(()=>gate.login('alice',secret),'GATE.AUTH_FAILED');mock.mock.restore();
  assert.deepEqual((await storage.call('wydstore','get',directoryRequest)).value.data.sessions,[]);
 }
});

test('strict TTL configuration and incompatible directory schema fail closed without reset',async t=>{
 for(const sessionTtlMs of [0,-1,86400001,1.5,'1000',null]) {
  const config=configuration(await temp(t));config.libraries[0].options.sessionTtlMs=sessionTtlMs;await reject(()=>load(config),'GATE.INVALID_CONFIG');
 }
 const config=configuration(await temp(t));config.libraries[0].options.sessionTtlMs=2500;
 const gate=createGate((await load(config)).bind(gateContext()));await gate.createUser({username:'alice',password:secret});
 const login=await gate.login('alice',secret);assert.equal(login.session.expiresAt-login.session.createdAt,2500);
 const current=await fixture(t),snapshot=(await current.storage.call('wydstore','get',directoryRequest)).value,data=plain(snapshot.data);data.schema='wydgate.local/0.1';
 assert.equal((await current.storage.call('wydstore','update',{...directoryRequest,version:snapshot.version,data})).ok,true);
 await reject(()=>load(current.config),'GATE.IO');assert.equal((await current.storage.call('wydstore','get',directoryRequest)).value.data.schema,'wydgate.local/0.1');
});

test('corrupt authorization and session references fail closed and reveal no private state',async t=>{
 for(const corrupt of [data=>data.sessions[0].digest='bad',data=>data.groups.push({id:'g_bad'}),data=>data.assignments[0].roles.push('missing')]) {
  const {gate,storage}=await fixture(t);await gate.createUser({username:'alice',password:secret});const login=await gate.login('alice',secret);
  const snapshot=(await storage.call('wydstore','get',directoryRequest)).value,data=plain(snapshot.data);corrupt(data);
  assert.equal((await storage.call('wydstore','update',{...directoryRequest,version:snapshot.version,data})).ok,true);
  await reject(()=>gate.resolveSession(login.token),'GATE.IO');await reject(()=>gate.getAuthorization(data.users[0].id),'GATE.IO');
 }
});


test('login CAS retry rejects a credential disabled between verification and session insertion',async t=>{
 const {openGate}=await import('../packages/wydgate/src/core.js');
 const {gate,storage}=await fixture(t),user=await gate.createUser({username:'alice',password:secret});
 let interfered=false;
 const internal=await openGate({app:'appA',store:'identity',collection:'directory'}, {
  identity:{app:'appA',publisher:'wydgit.core',library:'wydgate'},
  async call(operation,input) {
   if(operation==='update'&&input.data.sessions.length&&!interfered){interfered=true;await gate.updateUser({id:user.id,active:false});}
   return storage.call('wydstore',operation,input);
  }
 });
 await reject(()=>internal.execute('login',{username:'alice',password:secret},gateContext()),'GATE.AUTH_FAILED');
 assert.equal(interfered,true);assert.deepEqual((await storage.call('wydstore','get',directoryRequest)).value.data.sessions,[]);
});

test('session capacity fails without mutation; expired and revoked entries are pruned only on login',async t=>{
 const {randomUUID,createHash}=await import('node:crypto');
 const {gate,storage}=await fixture(t),user=await gate.createUser({username:'alice',password:secret});
 const current=(await storage.call('wydstore','get',directoryRequest)).value,data=plain(current.data),now=Date.now();
 data.sessions=Array.from({length:1024},(_,i)=>({id:`s_${randomUUID()}`,userId:user.id,createdAt:now,expiresAt:now+3600000,revoked:false,digest:createHash('sha256').update(String(i)).digest('hex')}));
 assert.equal((await storage.call('wydstore','update',{...directoryRequest,version:current.version,data})).ok,true);
 const before=(await storage.call('wydstore','get',directoryRequest)).value;
 await reject(()=>gate.login('alice',secret),'GATE.LIMIT');assert.deepEqual((await storage.call('wydstore','get',directoryRequest)).value,before);
 await gate.revokeSession(data.sessions[0].id);const login=await gate.login('alice',secret);
 assert.equal((await gate.resolveSession(login.token)).userId,user.id);
 assert.equal((await storage.call('wydstore','get',directoryRequest)).value.data.sessions.length,1024);
});

for(const provider of ['json','sqlite'])test(`${provider}: concurrent logins and revocations preserve both accepted session changes`,async t=>{
 const {gate,config,storage}=await fixture(t,provider);await gate.createUser({username:'alice',password:secret});
 const other=createGate((await load(config)).bind(gateContext()));
 const [a,b]=await Promise.all([gate.login('alice',secret),other.login('alice',secret)]);
 assert.notEqual(a.token,b.token);assert.notEqual(a.session.id,b.session.id);
 assert.equal((await other.resolveSession(a.token)).sessionId,a.session.id);assert.equal((await gate.resolveSession(b.token)).sessionId,b.session.id);
 await Promise.all([gate.logout(a.token),other.revokeSession(b.session.id)]);
 for(const token of [a.token,b.token])await reject(()=>gate.resolveSession(token),'GATE.SESSION_INVALID');
 const directory=(await storage.call('wydstore','get',directoryRequest)).value.data;
 assert.equal(directory.sessions.length,2);assert.ok(directory.sessions.every(s=>s.revoked));assert.ok(!JSON.stringify(directory).includes(a.token));assert.ok(!JSON.stringify(directory).includes(b.token));
});
