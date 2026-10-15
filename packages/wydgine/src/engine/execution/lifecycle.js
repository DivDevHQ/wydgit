import {credentialCookies} from '../http/credential-cookies.js';
import {createExecutionBudget,executionBudget} from '../sewn/budget.js';
import { matchesObjectGrant } from '../seam/context.js';
import { randomBytes,createHash } from 'node:crypto';
import { createDispatcher,safeError,prepareHandlers } from '../events/index.js';
import { freeze,clean,requireThat as check } from '../object-model/validation.js';
import { ExecutionContext } from '../seam/context.js';
export function createLifecycle({app,handlers=[],instances,context=new ExecutionContext({publisher:'wydgit.core',self:app,app})}) {
  handlers=prepareHandlers(handlers);
  check(context.app===app,'EVENT.DENIED','Wrong lifecycle App');
  let started=false,stopped=false,chain=Promise.resolve();const errors=[];
  const emit=(family,type,session)=>{
    chain=chain.catch(()=>{}).then(async()=>{
      const caches=new WeakMap();const handle=(id,guard)=>{check(matchesObjectGrant(context.visible, id),'EVENT.DENIED','Invisible lifecycle owner');let cache=caches.get(guard);if(!cache){cache=new Map();caches.set(guard,cache);}if(!cache.has(id))cache.set(id,Object.freeze({get id(){guard();return id;}}));return cache.get(id);};
      const budget=createExecutionBudget(context);
      const bound=instances?[...handlers,{type:`${family}.${type}`,owner:app,run:async function(){await instances.hostEvent(this.EVENT.Type,{scope:this,budget});}}]:handlers;
      const dispatcher=createDispatcher({budget,handlers:bound,context,handle,exists:id=>matchesObjectGrant(context.visible, id),contexts:()=>({SERVER:Object.freeze({App:app}),...(session?{SESSION:freeze(clean(session))}:{})})});
      try{await dispatcher.dispatch({type:`${family}.${type}`,source:app,target:app,payload:{}});}catch(error){if(errors.length<256)errors.push(safeError(error).toJSON());}finally{dispatcher.close();executionBudget(budget,context).close();}
    });return chain;
  };
  return Object.freeze({
    async start(){check(!stopped,'EVENT.DENIED','Application lifecycle ended');if(started)return;started=true;if(instances)await instances.activate();await emit('Server','Start');},
    async stop(){if(stopped)return;stopped=true;try{await emit('Server','Stop');}finally{if(instances)await instances.dispose();}},
    async session(event){check(!stopped,'EVENT.DENIED','Application lifecycle ended');check(event.app===app,'EVENT.DENIED','Wrong App');
      // Gate's committed revocation marker (or anonymous resolver ownership) is
      // the terminal ledger. Do not retain an unbounded second Session database.
      await emit('Session',event.type,event.session);
    },errors(){return freeze(clean(errors));}
  });
}
export function createSessionResolver({app,gate,lifecycle,max=1024,sessionless=false}) {
  let live=true;const anonymous=new Map();const digest=value=>createHash('sha256').update(value).digest('hex');
  const retire=async key=>{
    const entry=anonymous.get(key);if(!entry)return;
    // Remove authority and release capacity before invoking terminal observers.
    anonymous.delete(key);
    await lifecycle.session({app,type:'End',session:{id:entry.id,app,authenticated:false,expiresAt:entry.expiresAt}});
  };
  return Object.freeze({close(){live=false;anonymous.clear();},async resolve(cookies,{secure=true}={}) {
    const policy=credentialCookies(secure);
    check(live,'EVENT.DENIED','Application Session owner ended');
    if(sessionless)return {view:{id:randomBytes(16).toString('hex'),app,authenticated:false},active:()=>live,async authorize(){check(live,'EVENT.DENIED','Application stopped');},async retire(){},identity:null,csrf:randomBytes(32).toString('hex'),cookie:null};
    if(cookies[policy.auth]) {
      check(gate,'EVENT.DENIED','Authentication unavailable');const identity=await gate.resolveSession(cookies[policy.auth]);check(live&&identity.app===app,'EVENT.DENIED','Cross-App Session');
      return {view:{id:identity.sessionId,app,authenticated:true,identity},active:()=>live&&identity.expiresAt>Date.now(),async authorize(){check(live,'EVENT.DENIED','Application Session owner ended');const fresh=await gate.resolveSession(cookies[policy.auth]);check(live&&fresh.app===app&&fresh.sessionId===identity.sessionId,'EVENT.DENIED','Session changed');return fresh;},retire:()=>retire(cookies[policy.session]&&digest(cookies[policy.session])),identity,csrf:digest(cookies[policy.auth]+'csrf'),cookie:null};
    }
    const now=Date.now();for(const [key,entry] of anonymous)if(entry.expiresAt<=now){anonymous.delete(key);await lifecycle.session({app,type:'Timeout',session:{id:entry.id,app,authenticated:false,expiresAt:entry.expiresAt}});await lifecycle.session({app,type:'End',session:{id:entry.id,app,authenticated:false,expiresAt:entry.expiresAt}});}
    const token=cookies[policy.session];let key=token&&digest(token),entry=anonymous.get(key);let cookie=null;
    if(!entry){check(anonymous.size<max,'EVENT.LIMIT','Session capacity');const token=randomBytes(32).toString('hex');key=digest(token);entry={id:randomBytes(16).toString('hex'),app,authenticated:false,expiresAt:now+3600000,csrf:randomBytes(32).toString('hex')};anonymous.set(key,entry);cookie=policy.serialize('session',token);await lifecycle.session({app,type:'Start',session:{id:entry.id,app,authenticated:false,expiresAt:entry.expiresAt}});}
    return {view:{id:entry.id,app,authenticated:false},active:()=>live&&anonymous.get(key)===entry&&entry.expiresAt>Date.now(),async authorize(){check(anonymous.get(key)===entry&&entry.expiresAt>Date.now(),'EVENT.DENIED','Session ended');},retire:()=>retire(key),identity:null,csrf:entry.csrf,cookie};
  }});
}
