import { matchesObjectGrant } from '../seam/context.js';
import { randomBytes,createHash } from 'node:crypto';
import { createDispatcher,safeError,prepareHandlers } from '../events/index.js';
import { freeze,clean,requireThat as check } from '../object-model/validation.js';
import { ExecutionContext } from '../seam/context.js';
export function createLifecycle({app,handlers=[],context=new ExecutionContext({publisher:'wydgit.core',self:app,app})}) {
  handlers=prepareHandlers(handlers);
  check(context.app===app,'EVENT.DENIED','Wrong lifecycle App');
  let started=false,stopped=false,chain=Promise.resolve();const errors=[];
  const emit=(family,type,session)=>{
    chain=chain.catch(()=>{}).then(async()=>{
      const caches=new WeakMap();const handle=(id,guard)=>{check(matchesObjectGrant(context.visible, id),'EVENT.DENIED','Invisible lifecycle owner');let cache=caches.get(guard);if(!cache){cache=new Map();caches.set(guard,cache);}if(!cache.has(id))cache.set(id,Object.freeze({get id(){guard();return id;}}));return cache.get(id);};
      const dispatcher=createDispatcher({handlers,context,handle,exists:id=>matchesObjectGrant(context.visible, id),contexts:()=>({SERVER:Object.freeze({App:app}),...(session?{SESSION:freeze(clean(session))}:{})})});
      try{await dispatcher.dispatch({type:`${family}.${type}`,source:app,target:app,payload:{}});}catch(error){if(errors.length<256)errors.push(safeError(error).toJSON());}finally{dispatcher.close();}
    });return chain;
  };
  return Object.freeze({
    async start(){if(started)return;started=true;await emit('Server','Start');},
    async stop(){if(stopped)return;stopped=true;await emit('Server','Stop');},
    async session(event){check(event.app===app,'EVENT.DENIED','Wrong App');
      // Gate's committed revocation marker (or anonymous resolver ownership) is
      // the terminal ledger. Do not retain an unbounded second Session database.
      await emit('Session',event.type,event.session);
    },errors(){return freeze(clean(errors));}
  });
}
export function createSessionResolver({app,gate,lifecycle,max=1024}) {
  const anonymous=new Map();const digest=value=>createHash('sha256').update(value).digest('hex');
  return Object.freeze({async resolve(cookies) {
    if(cookies['__Host-wydgit-auth']) {
      check(gate,'EVENT.DENIED','Authentication unavailable');const identity=await gate.resolveSession(cookies['__Host-wydgit-auth']);check(identity.app===app,'EVENT.DENIED','Cross-App Session');
      return {view:{id:identity.sessionId,app,authenticated:true,identity},active:()=>identity.expiresAt>Date.now(),async authorize(){const fresh=await gate.resolveSession(cookies['__Host-wydgit-auth']);check(fresh.app===app&&fresh.sessionId===identity.sessionId,'EVENT.DENIED','Session changed');},identity,csrf:digest(cookies['__Host-wydgit-auth']+'csrf'),cookie:null};
    }
    const now=Date.now();for(const [key,entry] of anonymous)if(entry.expiresAt<=now){anonymous.delete(key);await lifecycle.session({app,type:'Timeout',session:{id:entry.id,app,authenticated:false,expiresAt:entry.expiresAt}});await lifecycle.session({app,type:'End',session:{id:entry.id,app,authenticated:false,expiresAt:entry.expiresAt}});}
    const token=cookies['__Host-wydgit-session'];let entry=token&&anonymous.get(digest(token));let cookie=null;
    if(!entry){check(anonymous.size<max,'EVENT.LIMIT','Session capacity');const token=randomBytes(32).toString('hex');entry={id:randomBytes(16).toString('hex'),app,authenticated:false,expiresAt:now+3600000,csrf:randomBytes(32).toString('hex')};anonymous.set(digest(token),entry);cookie=`__Host-wydgit-session=${token}; Path=/; Secure; HttpOnly; SameSite=Lax`;await lifecycle.session({app,type:'Start',session:{id:entry.id,app,authenticated:false,expiresAt:entry.expiresAt}});}
    return {view:{id:entry.id,app,authenticated:false},active:()=>entry.expiresAt>Date.now(),async authorize(){check(entry.expiresAt>Date.now(),'EVENT.DENIED','Session ended');},identity:null,csrf:entry.csrf,cookie};
  }});
}
