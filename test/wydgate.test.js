import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { manifest } from '@wydgit/gate';
import { createGate } from '@wydgit/gate/client';
import { project, secret, fixture, gateContext, storageContext, load, configuration, temp, directoryRequest } from '../test-support/wydgate.js';
const reject=(work,code)=>assert.rejects(work,error=>error.code===code,code);
const safe=value=>assert.doesNotMatch(JSON.stringify(value),/password|argon2|credentials|hash|identity|directory|sqlite|node_modules/i);

for(const provider of ['json','sqlite']) {
 test(`${provider}: Gate creates, finds and renames immutable users while keeping credentials private`,async t=>{
  const {gate,storage,config}=await fixture(t,provider);
  const user=await gate.createUser({username:'  Alice  ',password:secret,displayName:'Alice'});safe(user);
  assert.match(user.id,/^u_/);assert.equal(user.username,'alice');assert.equal(user.active,true);assert.ok(Object.isFrozen(user));
  assert.throws(()=>{user.id='changed';},TypeError);
  assert.equal((await gate.findUserByUsername('ALICE')).id,user.id);
  await reject(()=>gate.createUser({username:'alice',password:secret}),'GATE.USER_EXISTS');
  const updated=await gate.updateUser({id:user.id,username:'alice-renamed',displayName:'New label'});assert.equal(updated.id,user.id);safe(updated);
  await reject(()=>gate.findUserByUsername('alice'),'GATE.USER_NOT_FOUND');
  await reject(()=>gate.authenticate('alice',secret),'GATE.AUTH_FAILED');
  const auth=await gate.authenticate('Alice-Renamed',secret);assert.equal(auth.authenticated,true);assert.equal(auth.user.id,user.id);safe(auth);
  const stored=await storage.call('wydstore','get',directoryRequest);assert.equal(stored.ok,true);assert.ok(!JSON.stringify(stored).includes(secret));
  const credential=stored.value.data.credentials[0];assert.equal(credential.userId,user.id);assert.match(credential.passwordHash,/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
  const reopened=createGate((await load(config)).bind(gateContext()));assert.equal((await reopened.getUser(user.id)).username,'alice-renamed');
  assert.equal((await reopened.authenticate('ALICE-RENAMED',secret)).user.id,user.id);
 });

 test(`${provider}: authentication failures are generic, disabled users fail, and password changes replace only credentials`,async t=>{
  const {gate,storage}=await fixture(t,provider);const user=await gate.createUser({username:'alice',password:secret});
  const errors=[];for(const [name,pw] of [['alice','incorrect password'],['unknown',secret]]){try{await gate.authenticate(name,pw);assert.fail();}catch(e){errors.push(e.toJSON());}}
  assert.deepEqual(errors[0],errors[1]);assert.equal(errors[0].code,'GATE.AUTH_FAILED');safe(errors[0]);
  await gate.updateUser({id:user.id,active:false});await reject(()=>gate.authenticate('alice',secret),'GATE.AUTH_FAILED');
  const disabled=await gate.getUser(user.id);assert.equal(disabled.active,false);assert.equal(disabled.id,user.id);
  await gate.updateUser({id:user.id,active:true});const next='  a different passphrase  ';
  const result=await gate.changePassword(user.id,next);assert.equal(result.id,user.id);safe(result);
  await reject(()=>gate.authenticate('alice',secret),'GATE.AUTH_FAILED');await reject(()=>gate.authenticate('alice',next.trim()),'GATE.AUTH_FAILED');
  assert.equal((await gate.authenticate('alice',next)).user.id,user.id);
  const history=await storage.call('wydstore','history',directoryRequest);assert.equal(history.ok,true);
  assert.ok(history.value.length>1);assert.ok(!JSON.stringify(history).includes(secret));assert.ok(!JSON.stringify(history).includes(next));
 });

 test(`${provider}: Gate capabilities and scopes are explicit and never confer direct credential access`,async t=>{
  const {gate,registry}=await fixture(t,provider);const user=await gate.createUser({username:'alice',password:secret});
  const inputs={'create-user':{username:'other',password:secret},'get-user':{id:user.id},'find-user':{username:'alice'},'update-user':{id:user.id,active:false},authenticate:{username:'alice',password:secret},'change-password':{id:user.id,password:secret}};
  for(const service of manifest.services){
   const context=gateContext({capabilities:manifest.capabilities.filter(cap=>cap!==service.capability)}),before=JSON.stringify(context);
   const result=await registry.bind(context).call('wydgate',service.name,inputs[service.name]);assert.equal(result.code,'SEAM.DENIED');assert.equal(JSON.stringify(context),before);
  }
  for(const extra of [{scopes:{}},{app:'appB'},{scopes:{wydgate:['appB']}}])await reject(()=>createGate(registry.bind(gateContext(extra))).getUser(user.id),'GATE.DENIED');
  const caller=gateContext({capabilities:[...manifest.capabilities,'store.records.read'],scopes:{wydgate:['appA'],wydstore:[{store:'identity',collection:'directory'}]}}),before=JSON.stringify(caller);
  const dispatch=registry.bind(caller);assert.equal((await dispatch.call('wydstore','get',directoryRequest)).code,'STORE.DENIED');
  assert.equal((await dispatch.call('wydstore','history',directoryRequest)).code,'STORE.DENIED');
  assert.equal((await dispatch.call('wydgate','dependency',{library:'wydstore'})).code,'SEAM.DENIED');
  const authOnly=gateContext({capabilities:['gate.credentials.authenticate']});assert.equal((await createGate(registry.bind(authOnly)).authenticate('alice',secret)).user.id,user.id);assert.deepEqual(authOnly.capabilities,['gate.credentials.authenticate']);
  safe(await createGate(dispatch).authenticate('alice',secret));assert.equal(JSON.stringify(caller),before);
  assert.ok(['authenticate','changePassword','createUser','findUserByUsername','getUser','updateUser'].every(name=>typeof createGate(dispatch)[name]==='function'));
 });

 test(`${provider}: concurrent normalized creates and renames preserve username uniqueness`,async t=>{
  const {gate,config,storage}=await fixture(t,provider),other=createGate((await load(config)).bind(gateContext()));
  const results=await Promise.allSettled([gate.createUser({username:'Alice',password:secret}),other.createUser({username:'ALICE',password:secret})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'GATE.USER_EXISTS');
  const a=results.find(r=>r.status==='fulfilled').value,b=await gate.createUser({username:'bobby',password:secret});
  const renamed=await Promise.allSettled([gate.updateUser({id:a.id,username:'shared'}),other.updateUser({id:b.id,username:'shared'})]);
  assert.equal(renamed.filter(r=>r.status==='fulfilled').length,1);assert.equal(renamed.find(r=>r.status==='rejected').reason.code,'GATE.USER_EXISTS');
  const stored=(await storage.call('wydstore','get',directoryRequest)).value.data;
  assert.equal(stored.users.length,2);assert.equal(stored.credentials.length,2);assert.notEqual(stored.credentials[0].passwordHash,stored.credentials[1].passwordHash);
 });
}

test('Gate package declares portable requirements and dependency failures stop initialization',async t=>{
 const require=createRequire(import.meta.url),pkg=require('@wydgit/gate/package.json');assert.equal(pkg.version,'0.1.0-alpha.3');assert.equal(pkg.version,manifest.version);assert.equal(pkg.dependencies.argon2,'0.45.1');
 assert.equal(await fs.realpath(path.dirname(require.resolve('@wydgit/gate/package.json'))),path.join(project,'packages/wydgate'));
 assert.deepEqual(manifest.requirements,{schema:'wydgit.requirements/0.1',libraries:[{library:'wydstore',version:'^0.1.0-alpha.2'}]});
 const root=await temp(t),config=configuration(root);config.libraries.pop();await reject(()=>load(config),'LIBRARY.UNKNOWN');
 const disabled=configuration(root);disabled.libraries[1].enabled=false;await reject(()=>load(disabled),'LIBRARY.NOT_ENABLED');
 const denied=configuration(root);delete denied.libraries[0].bindings;await reject(()=>load(denied),'LIBRARY.DEPENDENCY_DENIED');
 const wrongApp=configuration(root);wrongApp.libraries[0].options.app='appB';await reject(()=>load(wrongApp),'GATE.INVALID_CONFIG');
 const {registry}=await fixture(t),ctx=gateContext({capabilities:[]}),before=JSON.stringify(ctx);assert.equal(registry.get('wydgate').trust,'canonical');assert.equal(JSON.stringify(ctx),before);
 assert.equal((await registry.bind(ctx).call('wydgate','authenticate',{username:'alice',password:secret})).code,'SEAM.DENIED');
});

test('Gate validates usernames, passphrases, updates and hostile input without leaking secrets',async t=>{
 const {gate,registry}=await fixture(t);
 for(const username of ['ab','a'.repeat(33),'a@b','Kelvin',' alice\t','../escape','a b'])await reject(()=>gate.createUser({username,password:secret}),'GATE.INVALID_USERNAME');
 for(const password of ['too short','a'.repeat(129),'\ud800'.repeat(15)])await reject(()=>gate.createUser({username:'alice',password}),'GATE.INVALID_PASSWORD');
 const user=await gate.createUser({username:'alice',password:'😀'.repeat(15)});assert.equal((await gate.authenticate('alice','😀'.repeat(15))).user.id,user.id);
 await reject(()=>gate.updateUser({id:user.id,passwordHash:'malicious'}),'GATE.INVALID_USER');await reject(()=>gate.updateUser({id:'different',active:true}),'GATE.INVALID_USER');
 await reject(()=>gate.createUser({username:'bobby',password:secret,id:user.id}),'GATE.INVALID_USER');
 for(const key of ['__proto__','constructor','prototype']){
  const input=JSON.parse(`{"username":"bobby","password":"${secret}","${key}":{}}`);
  assert.equal((await registry.bind(gateContext()).call('wydgate','create-user',input)).code,'SERVICE.INVALID_REQUEST');
 }
 const accessor={};Object.defineProperty(accessor,'username',{enumerable:true,get(){assert.fail('getter must not run');}});
 await reject(()=>gate.createUser(accessor),'SERVICE.INVALID_REQUEST');
});

test('Gate fails closed on corrupt private credentials and hides storage failures',async t=>{
 const {gate,storage,root}=await fixture(t);await gate.createUser({username:'alice',password:secret});
 const current=(await storage.call('wydstore','get',directoryRequest)).value,data=JSON.parse(JSON.stringify(current.data));
 data.credentials[0].passwordHash='$argon2id$v=19$m=999999999,p=1,t=99$untrusted$hash';
 assert.equal((await storage.call('wydstore','update',{...directoryRequest,version:current.version,data})).ok,true);
 await reject(()=>gate.authenticate('alice',secret),'GATE.IO');await reject(()=>gate.getUser(data.users[0].id),'GATE.IO');
 const filename=(await fs.readdir(root)).find(name=>name.endsWith('.json'));await fs.writeFile(path.join(root,filename),'{');
 try{await gate.findUserByUsername('alice');assert.fail();}catch(e){assert.equal(e.code,'GATE.IO');assert.doesNotMatch(JSON.stringify(e.toJSON()),/\/tmp|identity|directory|sqlite|SELECT|argon2/);}
});

test('authentication rechecks active state and credentials after password verification',async t=>{
 const argon2=(await import('argon2')).default;
 for(const change of ['disable','password']){
  const {gate}=await fixture(t);const user=await gate.createUser({username:'alice',password:secret});
  const verify=argon2.verify;
  const mock=t.mock.method(argon2,'verify',async(...args)=>{
   const result=await verify(...args);
   if(change==='disable')await gate.updateUser({id:user.id,active:false});else await gate.changePassword(user.id,'newer secret passphrase');
   return result;
  });
  await reject(()=>gate.authenticate('alice',secret),'GATE.AUTH_FAILED');mock.mock.restore();
 }
});

test('password hashing is bounded and missing accounts use the same verification work',async t=>{
 const argon2=(await import('argon2')).default,{gate}=await fixture(t);await gate.createUser({username:'alice',password:secret});
 const original=argon2.verify,calls=[];
 let release;const paused=new Promise(resolve=>{release=resolve;});t.after(()=>release());
 const mock=t.mock.method(argon2,'verify',async(...args)=>{calls.push(args[0]);await paused;return original(...args);});
 const first=gate.authenticate('alice','wrong but long password'),second=gate.authenticate('unknown',secret);
 // Attach rejection observers immediately, before releasing the held verification.
 const settled=Promise.allSettled([first,second]);
 for(let i=0;i<100 && calls.length<2;i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(calls.length,2);assert.ok(calls.every(hash=>hash.startsWith('$argon2id$v=19$m=19456,p=1,t=2$')));
 await reject(()=>gate.authenticate('alice',secret),'GATE.BUSY');release();assert.ok((await settled).every(result=>result.status==='rejected'&&result.reason.code==='GATE.AUTH_FAILED'));mock.mock.restore();
});

test('platform and Gate versions are synchronized and canonical App data has no authentication wiring',async()=>{
 const read=async name=>JSON.parse(await fs.readFile(path.join(project,name),'utf8'));
 const [pkg,lock,app]=await Promise.all(['package.json','package-lock.json','content/app.json'].map(read));
 assert.equal(pkg.version,'0.2.0-alpha.8');assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);assert.equal(lock.packages['packages/wydgate'].version,manifest.version);assert.equal(app.properties.revision,'Wydgit 0.2 alpha 8');
 assert.doesNotMatch(JSON.stringify(app),/argon2|password|credential|@wydgit|sqlite|identity/i);
});
