import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { check, fields } from './validation.js';
import { effective, entityId } from './authorization.js';
export const MAX_TTL=86400000;
const digest = token => createHash('sha256').update(token).digest('hex');
const timestamp = value => Number.isSafeInteger(value)&&value>=0;
export function validateSessions(sessions,users) {
  check(Array.isArray(sessions)&&sessions.length<=1024);
  const ids=new Set(),digests=new Set();
  for(const session of sessions) {
    fields(session,['id','userId','createdAt','expiresAt','revoked','digest']);
    check(entityId(session.id,'s')&&!ids.has(session.id)&&users.has(session.userId)&&timestamp(session.createdAt)&&timestamp(session.expiresAt)&&session.expiresAt>session.createdAt&&session.expiresAt-session.createdAt<=MAX_TTL&&typeof session.revoked==='boolean');
    check(typeof session.digest==='string'&&/^[0-9a-f]{64}$/.test(session.digest)&&!digests.has(session.digest));ids.add(session.id);digests.add(session.digest);
  }
}
export const revokeUser = (data,userId) => { for(const session of data.sessions)if(session.userId===userId)session.revoked=true; };
export function sessionOperations({read,mutate,app,ttl,authenticate}) {
  const lookup=(data,token)=>{
    check(typeof token==='string'&&/^[0-9a-f]{64}$/.test(token),'GATE.SESSION_INVALID');
    const encoded=Buffer.from(digest(token),'hex');
    const session=data.sessions.find(session=>timingSafeEqual(Buffer.from(session.digest,'hex'),encoded));
    const now=Date.now();
    check(session&&!session.revoked&&session.createdAt<=now&&session.expiresAt>now&&data.users.some(user=>user.id===session.userId&&user.active),'GATE.SESSION_INVALID');
    return session;
  };
  return async(operation,request)=>{
    if(operation==='login') {
      fields(request,['username','password']);const verified=await authenticate(request);
      const token=randomBytes(32).toString('hex'),id=`s_${randomUUID()}`,encoded=digest(token);
      return mutate(data=>{
        const user=data.users.find(user=>user.id===verified.user.id),credential=data.credentials.find(value=>value.userId===verified.user.id);
        check(user?.active&&user.username===verified.user.username&&credential?.passwordHash===verified.hash,'GATE.AUTH_FAILED');
        const now=Date.now();data.sessions=data.sessions.filter(session=>!session.revoked&&session.expiresAt>now);
        check(data.sessions.length<1024,'GATE.LIMIT');check(!data.sessions.some(session=>session.id===id||session.digest===encoded),'GATE.CONFLICT');
        const session={id,userId:user.id,createdAt:now,expiresAt:now+ttl,revoked:false,digest:encoded};data.sessions.push(session);
        return {token,session:{id,userId:user.id,createdAt:now,expiresAt:session.expiresAt},user:verified.user};
      });
    }
    if(operation==='resolve-session') {
      fields(request,['token']);const data=(await read()).data,session=lookup(data,request.token);
      return {authenticated:true,app,sessionId:session.id,createdAt:session.createdAt,expiresAt:session.expiresAt,...effective(data,session.userId)};
    }
    if(operation==='logout') {
      fields(request,['token']);return mutate(data=>{const session=lookup(data,request.token);session.revoked=true;return {revoked:true};});
    }
    if(operation==='revoke-session') {
      fields(request,['id']);check(entityId(request.id,'s'),'GATE.SESSION_INVALID');
      return mutate(data=>{const session=data.sessions.find(value=>value.id===request.id);check(session,'GATE.SESSION_INVALID');session.revoked=true;return {revoked:true};});
    }
    return undefined;
  };
}
