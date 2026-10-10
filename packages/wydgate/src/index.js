import { openGate } from './core.js';
import { GateError } from './validation.js';
export const manifest = {
  schema:'wydgit.library/0.1',id:'wydgate',version:'0.1.0-alpha.3',
  publisher:'wydgit.core',trust:'canonical',platform:'^0.2.0-alpha.8',targets:['server'],
  requirements:{schema:'wydgit.requirements/0.1',libraries:[{library:'wydstore',version:'^0.1.0-alpha.2'}]},
  capabilities:['gate.users.read','gate.users.create','gate.users.update','gate.credentials.authenticate','gate.credentials.manage','gate.sessions.use','gate.sessions.manage','gate.roles.manage','gate.groups.manage'],
  services:[
    {name:'create-user',capability:'gate.users.create'},
    {name:'get-user',capability:'gate.users.read'},
    {name:'find-user',capability:'gate.users.read'},
    {name:'update-user',capability:'gate.users.update'},
    {name:'authenticate',capability:'gate.credentials.authenticate'},
    {name:'change-password',capability:'gate.credentials.manage'},
    {name:'login',capability:'gate.credentials.authenticate'},
    {name:'logout',capability:'gate.sessions.use'},
    {name:'resolve-session',capability:'gate.sessions.use'},
    {name:'revoke-session',capability:'gate.sessions.manage'},
    ...['create','get','update','delete'].map(action=>({name:`${action}-role`,capability:'gate.roles.manage'})),
    ...['create','get','update','delete'].map(action=>({name:`${action}-group`,capability:'gate.groups.manage'})),
    {name:'assign-user',capability:'gate.roles.manage'},
    {name:'get-authorization',capability:'gate.users.read'},
    {name:'get-profile',capability:'gate.users.read'},
    {name:'update-profile',capability:'gate.users.update'}
  ]
};
export async function register({service,options,dependency,failure,lifecycle}) {
  const safe=async work=>{try{return await work();}catch(error){throw failure(error instanceof GateError?error.code:'GATE.IO');}};
  const gate=await safe(()=>openGate(options,dependency('wydstore'),lifecycle));
  for(const {name} of manifest.services)service(name,
    (request,caller)=>safe(()=>gate.execute(name,request,caller)),
    {authorize:(request,caller)=>safe(()=>gate.authorize(request,caller))});
}
