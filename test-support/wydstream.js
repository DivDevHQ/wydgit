import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { packageFixture } from './packages.js';
import { configuration } from './wydgate.js';
import { buildOperatorPolicy } from '../scripts/install-package.js';
import { planOperatorInstall,applyOperatorInstall } from '../scripts/package-infrastructure.js';
import { loadRepository } from '../wydgine/repository.js';
import { ExecutionContext,checkContext } from '../wydgine/seam/context.js';
import { initializeHost } from '../wydgine/host.js';
import { createGate } from '@wydgit/gate/client';
import { activatePackages } from '../wydgine/packages/index.js';
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSpkAAAAASUVORK5CYII=','base64');
export async function mediaFixture(t,provider='JSON',install=true,files=false) {
 const f=await packageFixture(t);f.packagePath=path.resolve('examples/media');f.manifest=JSON.parse(await fs.readFile(path.join(f.packagePath,'manifest.json')));
 const answers=['y','home',provider,'image,audio,video,file','y'];
 f.policy=await buildOperatorPolicy({...f,ask:async()=>answers.shift(),write:()=>{}});
 if(f.policy.infrastructure.media&&!files)f.policy.infrastructure.media.legacyStorage=true;
 const gateRoot=path.join(f.root,'gate');await fs.mkdir(gateRoot);
 const gateConfig=configuration(gateRoot,provider.toLowerCase());
 const store=gateConfig.libraries.find(l=>l.id==='wydstore').options.stores[0];store.app='boilerplate';
 const gate=gateConfig.libraries.find(l=>l.id==='wydgate');gate.options.app='boilerplate';gate.bindings[0].app='boilerplate';
 f.config.libraries.find(l=>l.id==='wydstore').options.stores.push(store);f.config.libraries=f.config.libraries.filter(l=>l.id!=='wydgate');f.config.libraries.push(gate);
 await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify(f.config));
 f.plan=()=>planOperatorInstall({...f,policy:f.policy,installationContext:f.policy.installationContext});
 if(!install)return f;
 f.receipt=await applyOperatorInstall(await f.plan());
 f.libraries=await initializeHost({root:f.root});
 f.gateContext=new ExecutionContext({context:'FrontEnd',publisher:'host',package:'host:gate',app:'boilerplate',self:'home',capabilities:gateConfig.libraries.find(l=>l.id==='wydgate').options?['gate.users.create','gate.users.read','gate.credentials.authenticate','gate.sessions.use','gate.sessions.manage']:[],scopes:{wydgate:['boilerplate']}});
 f.gate=createGate(f.libraries.bind(f.gateContext));
 const user=await f.gate.createUser({username:'alice',password:'long media fixture passphrase'});const login=await f.gate.login('alice','long media fixture passphrase');
 f.user=user;f.token=login.token;f.identity=await f.gate.resolveSession(login.token);
 f.active=activatePackages(loadRepository(f.root),f.libraries,f.root);f.caller=f.active.context({pageId:'home',session:{identity:f.identity},ids:[]});
 f.context=extra=>new ExecutionContext({context:'FrontEnd',...f.caller,capabilities:[...f.caller.capabilities,'stream.media.write','stream.media.delete'],...extra});
 f.editor=f.context({});f.invoke=(op,input={},caller=f.editor)=>f.libraries.bind(caller).invoke('wydstream','1.0.0',op,{resource:'media',...input});
 return f;
}

// Provider-limit/backend tests deliberately edit raw host configuration outside
// installed policy reconciliation. Verify that installation authority is fenced,
// then use an independent native host principal for that provider-only scenario.
// This test helper is never part of an engine/package execution surface.
export function useNativeMediaPolicyFixture(f) {
 const input=JSON.parse(JSON.stringify(f.caller));
 assert.throws(()=>checkContext(f.caller),{code:'SEAM.CONTEXT'});
 f.caller=new ExecutionContext(input);f.editor=f.context({});
}
