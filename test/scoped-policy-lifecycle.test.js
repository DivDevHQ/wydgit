import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createGate } from '@wydgit/gate/client';
import { createStores } from '@wydgit/store/client';
import { scopedFixture, siteAuthorization, permissions } from '../test-support/scoped-policy.js';
import { configuration, gateContext, load } from '../test-support/wydgate.js';
import { storedFixture } from '../test-support/package-effects.js';
import { writeJson } from '../test-support/package-lifecycle.js';
import { ExecutionContext, checkContext } from '../wydgine/seam/context.js';
import { initializeHost } from '../wydgine/host.js';
import { executionPlacement, acquirePackageExecution, packageOperation } from '../wydgine/packages/index.js';
import { readInstalledState } from '../wydgine/packages/state.js';

for(const provider of ['json','sqlite']) {
  test(`STO-02/05 GAT-03 ${provider}: real process restart preserves site policy and revocation`,async t=>{
    const f=await scopedFixture(t,provider),file=path.join(f.root,'request.json');
    const restart=async caller=>{
      await writeJson(file,{config:f.config,caller,input:f.input});
      const child=spawnSync(process.execPath,['test-support/scoped-policy-child.js',file],{encoding:'utf8',timeout:15000});
      assert.equal(child.status,0,child.stderr);return JSON.parse(child.stdout);
    };
    assert.equal((await restart(f.caller())).value.data.name,f.app);
    await f.gate.updateRole({id:f.role.id,permissions:[]});
    assert.equal((await restart(f.caller())).code,'STORE.DENIED');
    await f.gate.updateRole({id:f.role.id,permissions});
    assert.equal((await restart(f.caller({app:'foreign',identity:null}))).code,'STORE.DENIED');
    await f.gate.logout(f.login.token);
    assert.equal((await restart(f.caller())).code,'STORE.DENIED');
  });

  test(`CTX-06 LIF-01 STO-01/05 ${provider}: placed, replaced, relocated, retired and reinstalled storage authority`,async t=>{
    let user,identity,login;
    const native=gateContext({app:'boilerplate',scopes:{wydgate:['boilerplate']}});
    const f=await storedFixture(t,provider,{configure:async(config,root,store)=>{
      const gateRoot=path.join(root,'gate');await fs.mkdir(gateRoot);
      const gateConfig=configuration(gateRoot,provider,{registration:'open'}),gateEntry=gateConfig.libraries[0],identityStore=gateConfig.libraries[1].options.stores[0];
      gateEntry.options.app='boilerplate';gateEntry.bindings[0].app='boilerplate';identityStore.app='boilerplate';
      config.libraries=config.libraries.filter(l=>l.id!=='wydgate');config.libraries.push(gateEntry);
      config.libraries.find(l=>l.id==='wydstore').options.stores.push(identityStore);
      const policy=siteAuthorization('records');delete policy.collections.published;store.authorization=policy;
      const provisioning=await load(config),gate=createGate(provisioning.bind(native));
      try {
        user=await gate.register({username:'alice',password:'lifecycle policy passphrase'});
        await gate.assignUser({userId:user.account.id,roles:[],permissions});
        login=await gate.login('alice','lifecycle policy passphrase');identity=await gate.resolveSession(login.token);
      } finally {await provisioning.close();}
      return {identity,seedContext:new ExecutionContext({context:'BackOffice',publisher:'acme',package:'acme/a',
        app:'boilerplate',self:'host-seed',identity,capabilities:['store.records.read','store.records.create','store.records.write'],
        scopes:{wydstore:[{store:'store-a',collection:'records'}]}})};
    }});
    const libraries=await initializeHost({root:f.root});t.after(()=>libraries.close());
    const gate=createGate(libraries.bind(native));
    const operator=new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'packages.placement.manage','packages.placement.relocate']});
    const req=action=>{const s=readInstalledState(f.root),entry=s.packages.find(e=>e.manifest.id==='acme/a');return {
      root:f.root,app:'boilerplate',package:'acme/a',installation:entry.receipt.id,revision:s.revision,action,
      context:'BackOffice',installationContext:operator};};
    const acquire=(subject=identity)=>{const request=req('place'),entry=readInstalledState(f.root).packages.find(e=>e.manifest.id==='acme/a');
      return acquirePackageExecution({...request,generation:entry.executionPlacement.generation,self:'pkg-a',identity:subject});};
    await executionPlacement(req('place'));
    const caller=acquire(),service=libraries.bind(caller);
    const data=createStores(service).get('store-a').collection('records'),record=await data.get('content');
    assert.equal(record.current.text,'Customer edit');
    assert.equal((await libraries.bind(acquire(null)).call('wydstore','get',f.input)).code,'STORE.DENIED');
    const noSeam=new ExecutionContext({...caller,capabilities:[]});
    assert.equal((await libraries.bind(noSeam).call('wydstore','get',f.input)).code,'SEAM.DENIED');
    record.set('text','Authorized own-site edit');await record.save();
    const before=JSON.stringify(await data.history('content'));
    await gate.assignUser({userId:user.account.id,roles:[],permissions:[]});
    await assert.rejects(()=>data.history('content'),{code:'STORE.DENIED'});
    await gate.assignUser({userId:user.account.id,roles:[],permissions});
    await executionPlacement(req('replace'));
    assert.throws(()=>checkContext(caller),{code:'SEAM.CONTEXT'});
    await assert.rejects(()=>service.call('wydstore','get',f.input),{code:'SEAM.CONTEXT'});
    record.set('text','obsolete write');await assert.rejects(()=>record.save(),{code:'SEAM.CONTEXT'});
    let fresh=acquire();assert.equal(JSON.stringify(await createStores(libraries.bind(fresh)).get('store-a').collection('records').history('content')),before);
    await executionPlacement({...req('relocate'),context:'FrontEnd'});
    assert.throws(()=>checkContext(fresh),{code:'SEAM.CONTEXT'});fresh=acquire();assert.equal(fresh.context,'FrontEnd');
    assert.equal((await libraries.bind(fresh).call('wydstore','get',f.input)).ok,true);
    assert.equal((await libraries.bind(fresh).call('wydstore','update',{...f.input,version:3,data:{text:'FrontEnd denied'}})).code,'STORE.DENIED');
    await executionPlacement(req('relocate'));fresh=acquire();
    const next=await f.version('1.1.0');await packageOperation(f.operation('update','acme/a',[next],{installationContext:operator}));
    assert.throws(()=>checkContext(fresh),{code:'SEAM.CONTEXT'});fresh=acquire();
    assert.equal((await libraries.bind(fresh).call('wydstore','get',f.input)).value.data.text,'Authorized own-site edit');
    await executionPlacement(req('retire'));assert.throws(()=>checkContext(fresh),{code:'SEAM.CONTEXT'});assert.throws(acquire);
    await packageOperation(f.operation('uninstall','acme/a',[],{installationContext:operator}));
    const candidate=await f.version('1.1.0');candidate.serverPlacement={app:'boilerplate',context:'BackOffice'};
    await packageOperation(f.operation('install','acme/a',[candidate],{installationContext:operator}));
    const final=acquire();checkContext(final);
    assert.equal(JSON.stringify(await createStores(libraries.bind(final)).get('store-a').collection('records').history('content')),before);
    // A fresh service process loads retained policy/data without an old decision.
    const restarted=await initializeHost({root:f.root});t.after(()=>restarted.close());
    assert.equal((await restarted.bind(final).call('wydstore','get',f.input)).value.data.text,'Authorized own-site edit');
    await gate.logout(login.token);
    assert.equal((await restarted.bind(final).call('wydstore','get',f.input)).code,'STORE.DENIED');
    assert.throws(()=>checkContext(caller),{code:'SEAM.CONTEXT'});
  });
}
