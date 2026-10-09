import { randomUUID } from 'node:crypto';
import { passwords, validHash } from './passwords.js';
import { GateError, check, fields, username, displayName, password, validId, safeUser } from './validation.js';
import { validateAuthorization, authorizationOperations } from './authorization.js';
import { validateSessions, sessionOperations, revokeUser, MAX_TTL } from './sessions.js';
const MAX_USERS = 256;
const directoryId = 'local-identity';
const storageId = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(value) && !['constructor','prototype','__proto__'].includes(value);

// Users and credentials remain separate logical data, committed as one record.
// This keeps uniqueness, rename and credential replacement atomic on both stores.
function directory(snapshot) {
  try {
    check(snapshot.id === directoryId && Number.isSafeInteger(snapshot.version) && snapshot.version >= 1);
    const data=snapshot.data;
    fields(data,['schema','users','credentials','roles','groups','assignments','profiles','sessions']);
    check(data.schema === 'wydgate.local/0.2' && Array.isArray(data.users) && Array.isArray(data.credentials) && data.users.length <= MAX_USERS && data.credentials.length === data.users.length);
    const ids=new Set(),names=new Set();
    for(const user of data.users) {
      fields(user,['id','username','displayName','active']);
      check(validId(user.id) && !ids.has(user.id) && username(user.username) === user.username && !names.has(user.username) && typeof user.active === 'boolean');
      displayName(user.displayName);ids.add(user.id);names.add(user.username);
    }
    const credentials=new Set();
    for(const credential of data.credentials) {
      fields(credential,['userId','passwordHash']);
      check(ids.has(credential.userId) && !credentials.has(credential.userId) && validHash(credential.passwordHash));
      credentials.add(credential.userId);
    }
    validateAuthorization(data,ids);validateSessions(data.sessions,ids);
    return snapshot;
  } catch { throw new GateError('GATE.IO'); }
}
function storeError(code) {
  return new GateError(({ 'STORE.CONFLICT':'GATE.CONFLICT', 'STORE.BUSY':'GATE.BUSY', 'STORE.LIMIT':'GATE.LIMIT' })[code] ?? 'GATE.IO');
}
export async function openGate(options, storage, lifecycle = async () => {}) {
  fields(options,['app','store','collection'],['sessionTtlMs'],'GATE.INVALID_CONFIG');
  check(storageId(options.app) && storageId(options.store) && storageId(options.collection),'GATE.INVALID_CONFIG');
  check(storage.identity?.app === options.app && storage.identity.publisher === 'wydgit.core' && storage.identity.library === 'wydgate','GATE.INVALID_CONFIG');
  const ttl=Object.hasOwn(options,'sessionTtlMs')?options.sessionTtlMs:3600000;
  check(Number.isSafeInteger(ttl)&&ttl>=1&&ttl<=MAX_TTL,'GATE.INVALID_CONFIG');
  const scope={store:options.store,collection:options.collection,id:directoryId};
  const call=(operation,extra={})=>storage.call(operation,{...scope,...extra});
  const read=async()=>{
    const result=await call('get');if(!result.ok)throw storeError(result.code);
    return directory(result.value);
  };
  const initial=await call('get');
  if(!initial.ok) {
    if(initial.code !== 'STORE.NOT_FOUND')throw storeError(initial.code);
    const created=await call('create',{data:{schema:'wydgate.local/0.2',users:[],credentials:[],roles:[],groups:[],assignments:[],profiles:[],sessions:[]}});
    if(!created.ok && created.code !== 'STORE.DUPLICATE_ID')throw storeError(created.code);
  }
  await read();
  const hashing=await passwords();
  const authorize=(_request,caller)=>{
    check(caller.app === options.app && Array.isArray(caller.scopes?.wydgate) && caller.scopes.wydgate.includes(options.app),'GATE.DENIED');
    return true;
  };
  const mutate=async (change, reason='End')=>{
    for(let attempt=0;attempt<3;attempt++) {
      const current=await read(),data=JSON.parse(JSON.stringify(current.data));
      const value=change(data);
      directory({id:directoryId,version:current.version,data});
      const result=await call('update',{version:current.version,data});
      if(result.ok){
        const notifications=[];
        for(const session of data.sessions) {
          const before=current.data.sessions.find(old=>old.id===session.id);
          if(!before)notifications.push(['Start',session],['Authenticated',session]);
          else if(!before.revoked&&session.revoked){if(reason==='Logout'||reason==='Timeout')notifications.push([reason,session]);notifications.push(['End',session]);}
        }
        for(const [type,session] of notifications)try{await lifecycle({type,app:options.app,session:{id:session.id,userId:session.userId,createdAt:session.createdAt,expiresAt:session.expiresAt,authenticated:!session.revoked}});}catch{/* Committed state stays terminal; subsequent cleanup notifications still run. */}
        return value;
      }
      if(result.code !== 'STORE.CONFLICT')throw storeError(result.code);
    }
    throw new GateError('GATE.CONFLICT');
  };
  const find=(data,id)=>{const user=data.users.find(user=>user.id === id);check(user,'GATE.USER_NOT_FOUND');return user;};
  const authenticate=async request=>{
    fields(request,['username','password']);
    let name;
    try {name=username(request.username);password(request.password);}catch{throw new GateError('GATE.AUTH_FAILED');}
    const current=await read(),user=current.data.users.find(user=>user.username===name);
    const credential=user&&current.data.credentials.find(value=>value.userId===user.id);
    const verified=await hashing.verify(request.password,credential?.passwordHash);
    check(verified&&user?.active,'GATE.AUTH_FAILED');
    const fresh=await read(),latest=fresh.data.users.find(value=>value.id===user.id);
    const latestCredential=fresh.data.credentials.find(value=>value.userId===user.id);
    check(latest?.active&&latest.username===name&&latestCredential?.passwordHash===credential.passwordHash,'GATE.AUTH_FAILED');
    return {user:safeUser(latest),hash:credential.passwordHash};
  };
  const sessions=sessionOperations({read,mutate,app:options.app,ttl,authenticate});
  const authorization=authorizationOperations({read,mutate,find});
  const execute=async(operation,request,caller)=>{
    authorize(request,caller);
    if((await read()).data.sessions.some(session=>!session.revoked&&session.expiresAt<=Date.now()))
      await mutate(data=>{for(const session of data.sessions)if(!session.revoked&&session.expiresAt<=Date.now())session.revoked=true;return null;},'Timeout');
    if(operation==='authenticate'){const result=await authenticate(request);return {authenticated:true,user:result.user};}
    const session=await sessions(operation,request);if(session!==undefined)return session;
    const access=await authorization(operation,request);if(access!==undefined)return access;
    if(operation === 'create-user') {
      fields(request,['username','password'],['displayName']);
      const name=username(request.username),label=displayName(Object.hasOwn(request,'displayName') ? request.displayName : '');password(request.password);
      const encoded=await hashing.hash(request.password),id=`u_${randomUUID()}`;
      return mutate(data=>{
        check(!data.users.some(user=>user.username === name),'GATE.USER_EXISTS');
        check(data.users.length < MAX_USERS,'GATE.LIMIT');check(!data.users.some(user=>user.id === id),'GATE.CONFLICT');
        const user={id,username:name,displayName:label,active:true};
        data.users.push(user);data.credentials.push({userId:id,passwordHash:encoded});
        data.profiles.push({userId:id,bio:''});data.assignments.push({userId:id,roles:[],permissions:[]});return safeUser(user);
      });
    }
    if(operation === 'find-user') {
      fields(request,['username']);const name=username(request.username),current=await read();
      const user=current.data.users.find(user=>user.username === name);check(user,'GATE.USER_NOT_FOUND');return safeUser(user);
    }
    if(operation === 'get-user') {
      fields(request,['id']);check(validId(request.id));return safeUser(find((await read()).data,request.id));
    }
    if(operation === 'update-user') {
      fields(request,['id'],['username','displayName','active']);check(validId(request.id));
      const patch={};
      if(Object.hasOwn(request,'username'))patch.username=username(request.username);
      if(Object.hasOwn(request,'displayName'))patch.displayName=displayName(request.displayName);
      if(Object.hasOwn(request,'active')){check(typeof request.active === 'boolean');patch.active=request.active;}
      check(Object.keys(patch).length > 0);
      return mutate(data=>{
        const user=find(data,request.id);
        if(patch.username)check(!data.users.some(other=>other.id !== user.id && other.username === patch.username),'GATE.USER_EXISTS');
        Object.assign(user,patch);if(patch.active===false)revokeUser(data,user.id);return safeUser(user);
      });
    }
    if(operation === 'change-password') {
      fields(request,['id','password']);check(validId(request.id));password(request.password);
      // Credential management is a distinct, explicitly granted administrative action.
      find((await read()).data,request.id);
      const encoded=await hashing.hash(request.password);
      return mutate(data=>{
        const user=find(data,request.id);
        data.credentials.find(credential=>credential.userId === user.id).passwordHash=encoded;revokeUser(data,user.id);return safeUser(user);
      });
    }
    throw new GateError('GATE.INVALID_USER');
  };
  return Object.freeze({authorize,execute});
}
