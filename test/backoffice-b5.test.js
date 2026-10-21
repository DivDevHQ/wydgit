import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {load} from 'cheerio';
import {createApp} from '../app.js';
import {b5RecordsFixture,b5Http,b5Binding,b5Publish} from '../test-support/backoffice-b5.js';
import {modulesFixture,noticeManifest} from '../test-support/backoffice-modules.js';
import {adoptionFixture} from '../test-support/backoffice-adoption.js';
import {installMembershipLogin} from '../test-support/backoffice.js';
import {initializeHost} from '../wydgine/host.js';
import {createGate} from '@wydgit/gate/client';
import {reserveStoppedApp} from '../packages/wydgine/src/engine/execution/maintenance.js';
import {STATE} from '../wydgine/packages/state.js';

export function metadata(html){const $=load(html);return {csrf:$('meta[name="wydgit-backoffice-csrf"]').attr('content'),bindings:JSON.parse($('meta[name="wydgit-backoffice-bindings"]').attr('content'))};}
for(const provider of ['json','sqlite']){
  test(`BOB5-01 ${provider}: installed canonical records application CRUD, list/detail, strict scopes and transaction persistence`,async t=>{
    const f=await b5RecordsFixture(t,provider),h=await b5Http(t,f),response=await h.get(),html=await response.text();
    assert.equal(response.status,200,html);assert.match(html,/<form[^>]*id="b5-create"/);assert.match(html,/Records administration/);
    const {csrf,bindings}=metadata(html);assert.equal(bindings.length,3);
    const actions=(await (await h.get('/backoffice/api/actions')).json()).value.actions;
    const invoke=async(name,input,expected=200)=>{const pageBinding=bindings.find(b=>b.name===name);
      const target=pageBinding?{pageBinding,input}:{reference:actions.find(a=>a.name===name).reference,input:{store:'records',collection:name==='archive-get'?'archive':'records',...input}};
      const r=await h.post({...target,confirmed:true},csrf),body=await r.json();assert.equal(r.status,expected,JSON.stringify(body));return body;};
    assert.equal((await invoke('create',{id:'record',data:{text:'original'}})).value.version,1);
    assert.equal((await invoke('get',{id:'record'})).value.data.text,'original');
    assert.deepEqual((await invoke('list',{limit:1,offset:0})).value.map(r=>r.id),['record']);
    assert.deepEqual((await invoke('list',{limit:1,offset:1})).value,[]);
    assert.equal((await h.get('/backoffice/pages/records')).status,200);
    assert.equal((await invoke('update',{id:'record',version:1,data:{text:'updated'}})).value.version,2);
    await invoke('update',{id:'record',version:1,data:{text:'conflicting'}},409);
    for(const input of [{id:'denied',data:{text:10}},{id:'denied',data:{text:'x'.repeat(129)}},{id:'denied',data:{text:'bad'},authority:{trusted:true}},{id:'denied',data:{text:'bad'},collection:'archive'}])await invoke('create',input,400);
    // Fixed-input substitution rejects before dispatch; a raw action still cannot
    // reach another collection or owner with the same action and Gate permissions.
    const create=bindings.find(b=>b.name==='create').reference;
    for(const target of [{store:'records',collection:'archive'},{store:'foreign',collection:'records'}]){
      const r=await h.post({reference:create,input:{...target,id:'denied',data:{text:'bad'}},confirmed:true},csrf);assert.equal(r.status,403);
    }
    const operations=id=>[{operation:'create',input:{id,data:{text:'records'}}},{operation:'create',input:{id,collection:'archive',data:{text:'archive'}}}];
    await invoke('transaction',{operations:[...operations('denied-batch').slice(0,1),{operation:'create',input:{id:'denied-batch',collection:'foreign',data:{text:'foreign'}}}]},403);
    await invoke('get',{id:'denied-batch'},400);await invoke('archive-get',{id:'denied-batch'},400);
    const both=await invoke('transaction',{operations:operations('both')});assert.deepEqual(both.value.map(r=>r.version),[1,1]);
    // Envelope authorization alone is insufficient: reject a denied second member.
    await f.grant(f.permissions.filter(p=>p!=='archive.records.write'));
    await invoke('transaction',{operations:operations('revoked-batch')},403);
    await f.grant(f.permissions);await invoke('get',{id:'revoked-batch'},400);await invoke('archive-get',{id:'revoked-batch'},400);
    assert.equal((await invoke('get',{id:'record'})).value.data.text,'updated');await invoke('get',{id:'denied'},400);
    assert.equal((await invoke('delete',{id:'record',version:2})).value.deleted,true);await invoke('get',{id:'record'},400);
    // Close/reopen actual providers, then restart canonical HTTP and acquire fresh
    // references. Persisted results, including denied IDs, must agree.
    await h.stop();await f.libraries.close();f.libraries=await initializeHost({root:f.root});f.gate=createGate(f.libraries.bind(f.gateContext));
    const restart=await b5Http(t,f),fresh=await restart.get(),data=metadata(await fresh.text());assert.equal(fresh.status,200);
    const current=(await (await restart.get('/backoffice/api/actions')).json()).value.actions;
    for(const [name,id,text] of [['get','both','records'],['archive-get','both','archive']]){
      const r=await restart.post({reference:current.find(a=>a.name===name).reference,input:{store:'records',collection:name==='archive-get'?'archive':'records',id}},data.csrf);assert.equal(r.status,200);assert.equal((await r.json()).value.data.text,text);
    }
    for(const id of ['record','denied','denied-batch','revoked-batch']){
      const r=await restart.post({reference:current.find(a=>a.name==='get').reference,input:{...f.recordInput,id}},data.csrf);assert.equal(r.status,400,id);
    }
  });
  test(`BOB5-02 ${provider}: independent Page/action/service permissions, failed bindings, revoked session, retirement and generation replacement`,async t=>{
    const f=await b5RecordsFixture(t,provider),h=await b5Http(t,f),{csrf,bindings}=metadata(await (await h.get()).text()),save=bindings.find(b=>b.name==='create');
    const write=id=>h.post({pageBinding:save,input:{id,data:{text:'must not persist'}},confirmed:true},csrf);
    for(const permissions of [['content.pages.view'],f.permissions.filter(p=>p!=='content.pages.view'),f.permissions.filter(p=>p!=='content.records.write')]){
      await f.grant(permissions);assert.equal((await write('denied')).status,403);
    }
    await f.grant(f.permissions);
    for(const change of [b=>b.name='missing',b=>b.reference.package=noticeManifest.id,b=>b.reference.installation='foreign',b=>b.reference.generation='stale',b=>b.page.revision='0'.repeat(64)]){
      const altered=structuredClone(save);change(altered);const r=await h.post({pageBinding:altered,input:{id:'denied',data:{text:'forged'}},confirmed:true},csrf);assert.equal(r.status,409);
    }
    await f.gate.logout(f.login.token);assert.equal((await write('denied')).status,401);await h.stop();
    f.login=await f.gate.login('alice',f.password);f.request.session=f.login.token;
    const api=f.framework(),get=(await f.discover(api)).find(a=>a.name==='get');assert.equal((await f.invoke(api,get.reference,{...f.recordInput,id:'denied'})).code,'STORE.NOT_FOUND');
    await f.place('replace');assert.throws(()=>createApp({root:f.root,libraries:f.libraries}),{code:'BACKOFFICE.MIGRATION_REQUIRED'});
    await f.publish();const current=await b5Http(t,f),fresh=metadata(await (await current.get()).text());
    assert.notEqual(fresh.bindings.find(b=>b.name==='create').reference.generation,save.reference.generation);
    const old=await current.post({pageBinding:save,input:{id:'denied',data:{text:'stale'}},confirmed:true},fresh.csrf);assert.equal(old.status,409);await current.stop();
    await f.place('retire');const retired=await b5Http(t,f);assert.equal((await retired.get()).status,404);await retired.stop();
    await f.place('replace');assert.throws(()=>createApp({root:f.root,libraries:f.libraries}),{code:'BACKOFFICE.MIGRATION_REQUIRED'});
    await f.publish();await f.adopt({actions:[],pages:[]});assert.equal(f.inspect().backoffice.status,'revoked');
    assert.throws(()=>createApp({root:f.root,libraries:f.libraries}),{code:'BACKOFFICE.MIGRATION_REQUIRED'});
  });
  test(`BOB5-03 ${provider}: separately installed Members/Notices publish only their reviewed Pages and cannot exchange bindings`,async t=>{
    const f=adoptionFixture(await modulesFixture(t,provider));await installMembershipLogin(f);
    const membersPage={...f.proposal(),key:'members',bindings:[b5Binding(f,'list-members')]};
    const overview={...f.proposal(),key:'members-overview',bindings:[]};
    await f.adopt(f.payload(undefined,[membersPage,overview]));
    f.manifest=noticeManifest;f.operator=f.noticesOperator;adoptionFixture(f);await b5Publish(f,'notices',[b5Binding(f,'list-notices')]);
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.pages.view','gate.members.manage','operations.notices.read']});
    const h=await b5Http(t,f),members=await h.get('/backoffice/pages/members'),notices=await h.get('/backoffice/pages/notices');
    assert.equal(members.status,200);assert.equal(notices.status,200);
    const alias=await h.get('/backoffice/pages/members-overview');assert.equal(alias.status,200);assert.deepEqual(metadata(await alias.text()).bindings,[],'Each key on the same Page needs its own reviewed digest');
    const m=metadata(await members.text()),n=metadata(await notices.text());
    const roster=await h.post({pageBinding:m.bindings[0],input:{limit:5}},m.csrf);assert.equal(roster.status,200);assert.ok((await roster.json()).value.members.length>=1);
    const listed=await h.post({pageBinding:n.bindings[0],input:f.noticesInput},n.csrf);assert.equal(listed.status,200);assert.equal((await listed.json()).value[0].data.title,'Local qualification');
    const forged={...m.bindings[0],reference:n.bindings[0].reference};assert.equal((await h.post({pageBinding:forged,input:f.noticesInput},m.csrf)).status,409);
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['gate.members.manage','operations.notices.read']});
    assert.equal((await h.get('/backoffice/pages/members')).status,403);assert.equal((await h.get('/backoffice/pages/notices')).status,403);
  });
}
test('BOB5-04: abandoned, live and ambiguous local admission mutexes refuse without cleanup or secret disclosure; inspection remains observational',async t=>{
  const f=await b5RecordsFixture(t),file=path.join(f.root,'.wydgine-admission-mutex');
  const child=spawn(process.execPath,['-e',''],{stdio:'ignore'}),pid=child.pid;await once(child,'exit');
  const state=await fs.readFile(path.join(f.root,STATE)),config=await fs.readFile(path.join(f.root,'wydgit.config.json'));
  const cases=[
    [JSON.stringify({schema:'wydgine.local-admission/1',pid:process.pid}),'PACKAGE.BUSY','potentially live'],
    [JSON.stringify({schema:'wydgine.local-admission/1',pid}),'PACKAGE.RECOVERY','abandoned'],
    ['{"secret":"do-not-disclose-diagnostic-secret",','PACKAGE.BUSY','invalid'],
    [JSON.stringify({schema:'unknown',pid}),'PACKAGE.BUSY','invalid'],
    ['null','PACKAGE.BUSY','invalid'],
    [' '.repeat(257),'PACKAGE.BUSY','invalid']
  ];
  for(const [bytes,code,reason] of cases){
    await fs.writeFile(file,bytes,{mode:0o600});
    const diagnostic=e=>{assert.equal(e.code,code);assert.match(e.message,/admission.*mutex/i);assert.match(e.message,new RegExp(reason,'i'));assert.doesNotMatch(e.message,/do-not-disclose|secret|records\/|password/i);return true;};
    assert.throws(()=>reserveStoppedApp(f.root),diagnostic);assert.throws(()=>createApp({root:f.root,libraries:f.libraries}),diagnostic);
    const before=await fs.readFile(file);assert.equal(f.preflight().app,'boilerplate');assert.equal(f.inspect().backoffice.status,'adopted');assert.deepEqual(await fs.readFile(file),before);
    assert.deepEqual(await fs.readFile(path.join(f.root,STATE)),state);assert.deepEqual(await fs.readFile(path.join(f.root,'wydgit.config.json')),config);
    await fs.unlink(file); // Test operator only, after the refusal assertions. Never product cleanup.
  }
  const target=path.join(f.root,'mutex-target');await fs.writeFile(target,cases[0][0]);await fs.symlink(target,file);
  assert.throws(()=>reserveStoppedApp(f.root),e=>e.code==='PACKAGE.BUSY'&&/invalid.*admission.*mutex/i.test(e.message));assert.equal((await fs.lstat(file)).isSymbolicLink(),true);await fs.unlink(file);
  await fs.mkdir(file);assert.throws(()=>reserveStoppedApp(f.root),e=>e.code==='PACKAGE.BUSY'&&/invalid.*admission.*mutex/i.test(e.message));assert.equal((await fs.lstat(file)).isDirectory(),true);await fs.rmdir(file);
  await fs.link(target,file);assert.throws(()=>reserveStoppedApp(f.root),{code:'PACKAGE.BUSY'});assert.equal((await fs.stat(file)).nlink,2);await fs.unlink(file);
  const restarted=await b5Http(t,f);assert.equal((await restarted.get()).status,200);
});
