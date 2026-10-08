import path from 'node:path';
import { loadLibraries } from '../wydgine/libraries/index.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createGate } from '@wydgit/gate/client';
import { manifest } from '@wydgit/gate';
import platform from '../package.json' with {type:'json'};
import { temp } from './wydstore.js';
export { temp } from './wydstore.js';
export const project=path.resolve(import.meta.dirname,'..');
export const secret='a long test passphrase';
export const gateContext=(extra={})=>new ExecutionContext({publisher:'acme',package:'acme/app',app:'appA',self:'widget',capabilities:manifest.capabilities,scopes:{wydgate:['appA']},...extra});
export const storageContext=()=>new ExecutionContext({publisher:'wydgit.core',package:'library:wydgate',app:'appA',self:'host-test',capabilities:['store.records.read','store.records.create','store.records.write'],scopes:{wydstore:[{store:'identity',collection:'directory'}]}});
export function configuration(root,provider='json') {
 return {schema:'wydgit.host/0.1',libraries:[
  {id:'wydgate',package:'@wydgit/gate',enabled:true,version:'^0.1.0-alpha.1',publisher:'wydgit.core',trust:'canonical',
   options:{app:'appA',store:'identity',collection:'directory'},
   bindings:[{library:'wydstore',app:'appA',capabilities:['store.records.read','store.records.create','store.records.write'],scopes:{wydstore:[{store:'identity',collection:'directory'}]}}]},
  {id:'wydstore',package:'@wydgit/store',enabled:true,version:'^0.1.0-alpha.2',publisher:'wydgit.core',trust:'canonical',
   options:{stores:[{id:'identity',app:'appA',publisher:'wydgit.core',package:'library:wydgate',provider,root,
    collections:[{id:'directory',fields:{schema:{type:'string',required:true},users:{type:'array',required:true},credentials:{type:'array',required:true}}}]}]}}
 ]};
}
export const load=config=>loadLibraries({config,root:project,platformVersion:platform.version});
export async function fixture(t,provider='json') {
 const root=await temp(t),config=configuration(root,provider),registry=await load(config),context=gateContext();
 return {root,config,registry,context,gate:createGate(registry.bind(context)),storage:registry.bind(storageContext())};
}
export const directoryRequest={store:'identity',collection:'directory',id:'local-identity'};
