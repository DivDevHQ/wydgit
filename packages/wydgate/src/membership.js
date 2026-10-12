import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { check, fields, username, password, displayName, safeUser } from './validation.js';
import { revokeUser } from './sessions.js';
import { entityId } from './authorization.js';

const statuses=['active','suspended','left'];
const roles=['owner','administrator','member'];
export function membershipConfiguration(input) {
  if(input===undefined)return null;
  fields(input,[],['registration','maxMembers','passwordMinLength','bootstrapPrincipal','recoveryTtlMs','invitationTtlMs'],'GATE.INVALID_CONFIG');
  const config={registration:'disabled',maxMembers:256,passwordMinLength:15,bootstrapPrincipal:'host:gate',recoveryTtlMs:900000,invitationTtlMs:86400000,...input};
  check(['disabled','invitation-only','open'].includes(config.registration)&&Number.isSafeInteger(config.maxMembers)&&config.maxMembers>=1&&config.maxMembers<=256&&Number.isSafeInteger(config.passwordMinLength)&&config.passwordMinLength>=15&&config.passwordMinLength<=128&&Number.isSafeInteger(config.invitationTtlMs)&&config.invitationTtlMs>=1&&config.invitationTtlMs<=86400000&&Number.isSafeInteger(config.recoveryTtlMs)&&config.recoveryTtlMs>=1&&config.recoveryTtlMs<=900000&&typeof config.bootstrapPrincipal==='string'&&config.bootstrapPrincipal.startsWith('host:')&&config.bootstrapPrincipal.length<=128,'GATE.INVALID_CONFIG');
  return Object.freeze(config);
}
export function validateMembership(state,accounts) {
  fields(state,['schema','app','members','invitations','audit','bootstrapped'],['challenges']);
  check(state.schema==='wydgate.membership/1'&&typeof state.app==='string'&&typeof state.bootstrapped==='boolean'&&Array.isArray(state.members)&&state.members.length<=256&&Array.isArray(state.invitations)&&state.invitations.length<=256&&Array.isArray(state.audit)&&state.audit.length<=128);
  const ids=new Set(),users=new Set();
  for(const member of state.members){
    fields(member,['id','app','accountId','status','role','displayName']);
    check(entityId(member.id,'m')&&!ids.has(member.id)&&member.app===state.app&&accounts.has(member.accountId)&&!users.has(member.accountId)&&statuses.includes(member.status)&&roles.includes(member.role));displayName(member.displayName);ids.add(member.id);users.add(member.accountId);
  }
  for(const entry of state.invitations){fields(entry,['username','digest','createdAt','expiresAt']);check(username(entry.username)===entry.username&&/^[a-f0-9]{64}$/.test(entry.digest)&&Number.isSafeInteger(entry.createdAt)&&entry.createdAt>=0&&Number.isSafeInteger(entry.expiresAt)&&entry.expiresAt>entry.createdAt&&entry.expiresAt-entry.createdAt<=86400000);}
  if(Object.hasOwn(state,'challenges')){check(Array.isArray(state.challenges)&&state.challenges.length<=128);const challenges=new Set();for(const c of state.challenges){fields(c,['id','accountId','digest','createdAt','expiresAt','used']);check(entityId(c.id,'c')&&!challenges.has(c.id)&&accounts.has(c.accountId)&&/^[a-f0-9]{64}$/.test(c.digest)&&Number.isSafeInteger(c.createdAt)&&c.createdAt>=0&&Number.isSafeInteger(c.expiresAt)&&c.expiresAt>c.createdAt&&c.expiresAt-c.createdAt<=900000&&typeof c.used==='boolean');challenges.add(c.id);}}
  check(new Set(state.invitations.map(i=>i.username)).size===state.invitations.length);
  for(const entry of state.audit){fields(entry,['at','event','accountId']);check(Number.isSafeInteger(entry.at)&&entry.at>=0&&typeof entry.event==='string'&&entry.event.length<=64&&(entry.accountId===null||accounts.has(entry.accountId)));}
  check(state.members.filter(m=>m.role==='owner').length<=1);
}
export function membershipOperations({read,mutate,find,hashing,authenticate,app,config,rate,idle,deliverRecovery}) {
  const state=data=>{check(config,'GATE.DISABLED');data.membership??={schema:'wydgate.membership/1',app,members:[],invitations:[],audit:[],bootstrapped:false};check(data.membership.app===app,'GATE.DENIED');return data.membership;};
  const audit=(data,event,accountId=null)=>{const s=state(data);s.audit.push({at:Date.now(),event,accountId});s.audit=s.audit.slice(-128);};
  const subject=(data,caller)=>{
    const identity=caller.identity,now=Date.now();check(identity?.authenticated&&identity.app===app,'GATE.DENIED');
    const session=data.sessions.find(s=>s.id===identity.sessionId&&s.userId===identity.userId);
    check(session&&!session.revoked&&session.expiresAt>now&&session.createdAt<=now&&(session.lastSeenAt??session.createdAt)<=now&&now-(session.lastSeenAt??session.createdAt)<idle,'GATE.SESSION_INVALID');
    const user=find(data,session.userId);check(user.active,'GATE.SESSION_INVALID');
    const member=state(data).members.find(m=>m.accountId===user.id);
    check(!member||member.status==='active','GATE.DENIED');return {user,member};
  };
  const current=(data,caller)=>{const result=subject(data,caller);check(result.member,'GATE.DENIED');return result;};
  const admin=(data,caller)=>{if(caller.installation!==null){const {member}=current(data,caller);check(['owner','administrator'].includes(member.role),'GATE.DENIED');}};
  const add=(data,user,role='member')=>{const s=state(data);check(s.members.length<config.maxMembers,'GATE.LIMIT');const member={id:`m_${randomUUID()}`,app,accountId:user.id,status:'active',role,displayName:user.displayName};s.members.push(member);return member;};
  const invitation=(s,name,token)=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&s.invitations.some(i=>i.username===name&&i.createdAt<=Date.now()&&i.expiresAt>Date.now()&&i.digest===createHash('sha256').update(token).digest('hex'));
  const policyPassword=value=>{password(value);check([...value].length>=config.passwordMinLength,'GATE.INVALID_PASSWORD');};
  return async(operation,request,caller)=>{
    if(!['register','bootstrap-owner','invite-member','join-app','current-account','current-membership','update-account','update-membership','leave-app','disable-account','change-own-password','list-members','manage-member','list-sessions','revoke-own-session','request-password-reset','reset-password'].includes(operation))return undefined;
    check(config,'GATE.DISABLED');
    if(operation==='request-password-reset'){
      fields(request,['username']);rate('recovery');if(!deliverRecovery)return {accepted:true,available:false};
      let name;try{name=username(request.username);}catch{return {accepted:true,available:true};}
      const account=(await read()).data.users.find(u=>u.username===name&&u.active);
      if(account){const token=randomBytes(32).toString('hex'),digest=createHash('sha256').update(token).digest('hex'),id=`c_${randomUUID()}`,createdAt=Date.now(),expiresAt=createdAt+config.recoveryTtlMs;
        await mutate(data=>{check(find(data,account.id).active,'GATE.AUTH_FAILED');const s=state(data);s.challenges=(s.challenges??[]).filter(c=>!c.used&&c.expiresAt>Date.now()&&c.accountId!==account.id);check(s.challenges.length<128,'GATE.LIMIT');s.challenges.push({id,accountId:account.id,digest,createdAt,expiresAt,used:false});audit(data,'recovery-request',account.id);return null;});
        try{await deliverRecovery(Object.freeze({app,accountId:account.id,username:name,token,expiresAt}));}
        catch{await mutate(data=>{const challenge=state(data).challenges?.find(c=>c.id===id);if(challenge)challenge.used=true;return null;});}
      }
      return {accepted:true,available:true};
    }
    if(operation==='reset-password'){
      fields(request,['token','password']);rate('recovery');check(deliverRecovery,'GATE.DISABLED');check(typeof request.token==='string'&&/^[a-f0-9]{64}$/.test(request.token),'GATE.RECOVERY_INVALID');policyPassword(request.password);
      const digest=createHash('sha256').update(request.token).digest('hex');
      const lookup=data=>{const c=state(data).challenges?.find(c=>c.digest===digest);check(c&&!c.used&&c.createdAt<=Date.now()&&c.expiresAt>Date.now()&&find(data,c.accountId).active,'GATE.RECOVERY_INVALID');return c;};
      lookup((await read()).data);const hash=await hashing.hash(request.password);
      return mutate(data=>{const c=lookup(data);c.used=true;data.credentials.find(v=>v.userId===c.accountId).passwordHash=hash;for(const other of state(data).challenges)if(other.accountId===c.accountId)other.used=true;revokeUser(data,c.accountId);audit(data,'password-reset',c.accountId);return {changed:true};});
    }
    if(operation==='register'||operation==='bootstrap-owner'){
      fields(request,['username','password'],operation==='register'?['displayName','invitationToken']:['displayName']);rate('registration');
      if(operation==='bootstrap-owner')check(caller.package===config.bootstrapPrincipal&&caller.principal===config.bootstrapPrincipal&&caller.installation===null&&caller.scopes?.wydgateBootstrap?.includes(app),'GATE.DENIED');
      const name=username(request.username),label=displayName(request.displayName??'');policyPassword(request.password);
      const hash=await hashing.hash(request.password),id=`u_${randomUUID()}`;
      return mutate(data=>{
        const s=state(data);
        if(operation==='bootstrap-owner')check(!s.bootstrapped&&!s.members.some(m=>m.role==='owner'),'GATE.DENIED');
        else check(config.registration==='open'||config.registration==='invitation-only'&&invitation(s,name,request.invitationToken),'GATE.REGISTRATION_FAILED');
        check(!data.users.some(u=>u.username===name),'GATE.REGISTRATION_FAILED');check(data.users.length<256,'GATE.LIMIT');
        const user={id,username:name,displayName:label,active:true};data.users.push(user);data.credentials.push({userId:id,passwordHash:hash});data.profiles.push({userId:id,bio:''});data.assignments.push({userId:id,roles:[],permissions:[]});
        const member=add(data,user,operation==='bootstrap-owner'?'owner':'member');s.invitations=s.invitations.filter(i=>i.username!==name);if(operation==='bootstrap-owner')s.bootstrapped=true;
        audit(data,operation,id);return {account:safeUser(user),membership:member};
      });
    }
    if(operation==='invite-member'){
      fields(request,['username']);const name=username(request.username),token=randomBytes(32).toString('hex'),digest=createHash('sha256').update(token).digest('hex'),createdAt=Date.now(),expiresAt=createdAt+config.invitationTtlMs;
      return mutate(data=>{admin(data,caller);const s=state(data);s.invitations=s.invitations.filter(i=>i.username!==name&&i.expiresAt>Date.now());check(s.invitations.length<256,'GATE.LIMIT');s.invitations.push({username:name,digest,createdAt,expiresAt});audit(data,'invitation');return {invited:true,token,expiresAt};});
    }
    if(operation==='list-members'){
      fields(request,[],['offset','limit']);const offset=request.offset??0,limit=request.limit??20;
      check(Number.isSafeInteger(offset)&&offset>=0&&offset<=256&&Number.isSafeInteger(limit)&&limit>=1&&limit<=50);
      const data=(await read()).data;admin(data,caller);const s=state(data);return {members:s.members.slice(offset,offset+limit),offset,limit,total:s.members.length};
    }
    if(operation==='manage-member'){
      fields(request,['id'],['status','role']);check(entityId(request.id,'m')&&Object.keys(request).length>1);if(request.status!==undefined)check(statuses.includes(request.status));if(request.role!==undefined)check(['member','administrator'].includes(request.role));
      return mutate(data=>{admin(data,caller);const member=state(data).members.find(m=>m.id===request.id);check(member&&member.role!=='owner','GATE.DENIED');if(request.status!==undefined)member.status=request.status;if(request.role!==undefined)member.role=request.role;if(member.status!=='active'||request.role!==undefined)revokeUser(data,member.accountId);audit(data,'member-status',member.accountId);return member;});
    }
    if(operation==='change-own-password'){
      fields(request,['currentPassword','password']);policyPassword(request.password);
      const before=(await read()).data,{user}=subject(before,caller);const verified=await authenticate({username:user.username,password:request.currentPassword});const hash=await hashing.hash(request.password);
      return mutate(data=>{const {user}=subject(data,caller),credential=data.credentials.find(c=>c.userId===user.id);check(credential.passwordHash===verified.hash,'GATE.AUTH_FAILED');credential.passwordHash=hash;revokeUser(data,user.id);audit(data,'password-change',user.id);return {changed:true};});
    }
    if(operation==='update-account'||operation==='update-membership'){
      fields(request,['displayName']);const label=displayName(request.displayName);
      return mutate(data=>{const {user,member}=current(data,caller);if(operation==='update-account'){user.displayName=label;return safeUser(user);}member.displayName=label;return member;});
    }
    if(operation==='revoke-own-session'){
      fields(request,['id']);check(entityId(request.id,'s'));
      return mutate(data=>{const {user}=subject(data,caller),session=data.sessions.find(s=>s.id===request.id&&s.userId===user.id);check(session,'GATE.DENIED');session.revoked=true;audit(data,'session-revoked',user.id);return {revoked:true};});
    }
    fields(request,[],operation==='join-app'?['invitationToken']:[]);
    if(operation==='join-app')return mutate(data=>{const {user,member}=subject(data,caller);check(!member,'GATE.DENIED');const s=state(data);check(config.registration==='open'||config.registration==='invitation-only'&&invitation(s,user.username,request.invitationToken),'GATE.DENIED');s.invitations=s.invitations.filter(i=>i.username!==user.username);const result=add(data,user);audit(data,'join',user.id);return result;});
    if(operation==='disable-account'||operation==='leave-app')return mutate(data=>{const {user,member}=current(data,caller);check(member.role!=='owner','GATE.DENIED');if(operation==='disable-account')user.active=false;else member.status='left';revokeUser(data,user.id);audit(data,operation,user.id);return {disabled:true};});
    const data=(await read()).data,{user,member}=subject(data,caller);
    if(operation==='current-account')return safeUser(user);
    if(operation==='current-membership'){check(member,'GATE.DENIED');return member;}
    if(operation==='list-sessions')return data.sessions.filter(s=>s.userId===user.id&&!s.revoked&&s.expiresAt>Date.now()).map(({id,createdAt,expiresAt})=>({id,createdAt,expiresAt}));
  };
}
