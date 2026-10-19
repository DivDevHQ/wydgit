import { gateTransport } from './transport.js';
import { openGate } from './core.js';
import { GateError } from './validation.js';
export const manifest = {
  schema:'wydgit.library/0.1',id:'wydgate',version:'0.1.0-alpha.7',apiVersion:'1.0.0',
  publisher:'wydgit.core',trust:'canonical',platform:'^0.3.0-alpha.20',targets:['server'],
  requirements:{schema:'wydgit.requirements/0.1',libraries:[{library:'wydstore',version:'^0.1.0-alpha.2'}]},
  capabilities:['gate.users.read','gate.users.create','gate.users.update','gate.credentials.authenticate','gate.credentials.manage','gate.sessions.use','gate.sessions.manage','gate.roles.manage','gate.groups.manage','gate.accounts.use','gate.members.use','gate.members.manage','gate.members.bootstrap','gate.registration.use'],
  services:[
    ...['current-account','update-account','change-own-password','disable-account','list-sessions','revoke-own-session'].map(name=>({name,capability:'gate.accounts.use'})),
    ...['current-membership','update-membership','join-app','leave-app'].map(name=>({name,capability:'gate.members.use'})),
    ...['list-members','manage-member','invite-member'].map(name=>({name,capability:'gate.members.manage'})),
    {name:'bootstrap-owner',capability:'gate.members.bootstrap'},
    ...['register','request-password-reset','reset-password','browser-register'].map(name=>({name,capability:'gate.registration.use'})),
    {name:'browser-login',capability:'gate.credentials.authenticate'},
    {name:'browser-logout',capability:'gate.sessions.use'},
    {name:'browser-profile',capability:'gate.accounts.use'},
    {name:'browser-password',capability:'gate.accounts.use'},
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
manifest.legacyOperations=['create-user','get-user','find-user','update-user','authenticate','change-password','login','logout','resolve-session','revoke-session',...['create','get','update','delete'].flatMap(action=>[`${action}-role`,`${action}-group`]),'assign-user','get-authorization','get-profile','update-profile'];
export const administrativeOperations=Object.freeze({'list-members':'read','manage-member':'write'});
export function resolvePackageScopes({options,app,scopes}) {
  if(options.app!==app||!Array.isArray(scopes)||scopes.length!==1||scopes[0]!=='current-app')throw new GateError('GATE.DENIED');return [app];
}
export function initialize({adapter}) {
  if(adapter!==undefined&&(!adapter||typeof adapter.deliverRecovery!=='function'))throw new GateError('GATE.INVALID_CONFIG');
  return {context:Object.freeze({deliverRecovery:adapter?.deliverRecovery})};
}
export async function register({service,transport,options,dependency,failure,lifecycle,hostContext,sitePolicy,checkCaller,withIdentity}) {
  const safe=async work=>{try{return await work();}catch(error){throw failure(error instanceof GateError?error.code:'GATE.IO');}};
  const gate=await safe(()=>openGate(options,dependency('wydstore'),lifecycle,hostContext,checkCaller));
  sitePolicy((caller,required)=>safe(()=>gate.evaluateSitePolicy(caller,required)));
  for(const {name} of manifest.services)service(name,
    (request,caller)=>safe(()=>gate.execute(name,request,caller)),
    {authorize:(request,caller)=>safe(()=>gate.authorize(request,caller)),validate:()=>true,presentation:name==='list-members',
      ...(administrativeOperations[name]?{administration:administrativeOperations[name],administrativeAuthorize:caller=>safe(async()=>{await gate.execute('list-members',{limit:1},caller);return true;})}:{})});
  for(const name of ['browser-login','browser-register','browser-logout','browser-profile','browser-password'])transport(name,gateTransport({gate,name,safe,withIdentity}));
}
