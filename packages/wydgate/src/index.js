import { openGate } from './core.js';
import { GateError } from './validation.js';
export const manifest = {
  schema:'wydgit.library/0.1',id:'wydgate',version:'0.1.0-alpha.1',
  publisher:'wydgit.core',trust:'canonical',platform:'^0.2.0-alpha.6',targets:['server'],
  requirements:{schema:'wydgit.requirements/0.1',libraries:[{library:'wydstore',version:'^0.1.0-alpha.2'}]},
  capabilities:['gate.users.read','gate.users.create','gate.users.update','gate.credentials.authenticate','gate.credentials.manage'],
  services:[
    {name:'create-user',capability:'gate.users.create'},
    {name:'get-user',capability:'gate.users.read'},
    {name:'find-user',capability:'gate.users.read'},
    {name:'update-user',capability:'gate.users.update'},
    {name:'authenticate',capability:'gate.credentials.authenticate'},
    {name:'change-password',capability:'gate.credentials.manage'}
  ]
};
export async function register({service,options,dependency,failure}) {
  const safe=async work=>{try{return await work();}catch(error){throw failure(error instanceof GateError?error.code:'GATE.IO');}};
  const gate=await safe(()=>openGate(options,dependency('wydstore')));
  for(const {name} of manifest.services)service(name,
    (request,caller)=>safe(()=>gate.execute(name,request,caller)),
    {authorize:(request,caller)=>safe(()=>gate.authorize(request,caller))});
}
