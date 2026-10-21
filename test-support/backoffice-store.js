// Real installed foundation fixture, deliberately without an application UI.
import fs from 'node:fs/promises';
import path from 'node:path';
import {actionFixture} from './backoffice.js';
import {initializeHost} from '../wydgine/host.js';
import {createGate} from '@wydgit/gate/client';

export async function storeActionFixture(t,provider='json',{edit=()=>{},configure=async()=>{}}={}) {
  const data={type:'object',fields:{text:{type:'string',maxLength:128}}};
  const target={store:{type:'string',maxLength:64},collection:{type:'string',maxLength:64},id:{type:'string',maxLength:64}};
  const version={type:'integer',min:1,max:100};
  const capabilities={get:'store.records.read',create:'store.records.create',update:'store.records.write',delete:'store.records.delete'};
  const f=await actionFixture(t,provider,{edit:m=>{
    m.permissions.capabilities=Object.values(capabilities);m.permissions.scopes={wydstore:['records']};
    m.requires.libraries.push({library:'wydstore',version:'^0.1.0-alpha.5'});
    m.storage=[{name:'records',fields:{text:{type:'string'}}}];
    const base=m.backofficeActions[0];
    m.backofficeActions=Object.entries(capabilities).map(([operation,capability])=>({
      ...base,id:operation,title:operation+' record',permission:operation==='get'?'content.action.read':'content.action.write',
      capability,scopes:{wydstore:['records']},service:{library:'wydstore',apiVersion:'1.0.0',operation},
      effect:operation==='get'?'read':'write',...(operation==='get'?{}:{confirmation:'Confirm record change'}),
      input:{type:'object',fields:{...target,...(['create','update'].includes(operation)?{data}:{}),...(['update','delete'].includes(operation)?{version}:{})}},
      output:{type:'object',fields:operation==='delete'?{id:target.id,version,deleted:{type:'boolean'}}:{id:target.id,version,data}}
    }));
    edit(m);
  },configure:async f=>{
    await f.libraries.close();const root=path.join(f.root,'records');await fs.mkdir(root);
    f.config.libraries.find(l=>l.id==='wydstore').options.stores.push({
      id:'records',app:'boilerplate',publisher:'divdev',package:'divdev/backoffice-members',provider,root,
      collections:[{id:'records',fields:{text:{type:'string'}}}],
      authorization:{schema:'wydstore.authorization/1',collections:{records:Object.fromEntries(Object.keys(capabilities).map(op=>[op,{
        contexts:['BackOffice'],permission:op==='get'?'content.records.read':'content.records.write'
      }]))}}
    });
    f.candidate.storageMappings={records:{store:'records',collection:'records'}};
    await configure(f);
    await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify(f.config));
    f.libraries=await initializeHost({root:f.root});f.gate=createGate(f.libraries.bind(f.gateContext));
  }});
  f.storePermissions=['content.action.read','content.action.write','content.records.read','content.records.write'];
  await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:f.storePermissions});
  f.recordInput={store:'records',collection:'records',id:'record'};
  return f;
}
