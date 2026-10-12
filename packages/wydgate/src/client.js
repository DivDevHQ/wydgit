// Portable facade: no hashing, storage or host runtime imports.
import { GateError } from './validation.js';
export { GateError } from './validation.js';
export function createGate(dispatch) {
  const legacy=new Set(['create-user','get-user','find-user','update-user','authenticate','change-password','login','logout','resolve-session','revoke-session','assign-user','get-authorization','get-profile','update-profile',...['create','get','update','delete'].flatMap(action=>[`${action}-role`,`${action}-group`])]);
  const call=async(name,input)=>{
    const result=legacy.has(name)?await dispatch.call('wydgate',name,input):await dispatch.invoke('wydgate','1.0.0',name,input);
    if(!result.ok)throw new GateError(result.code);
    return result.value;
  };
  return Object.freeze({
    register:input=>call('register',input),
    bootstrapOwner:input=>call('bootstrap-owner',input),
    inviteMember:username=>call('invite-member',{username}),
    currentAccount:()=>call('current-account',{}),
    currentMembership:()=>call('current-membership',{}),
    updateAccount:displayName=>call('update-account',{displayName}),
    updateMembership:displayName=>call('update-membership',{displayName}),
    changeOwnPassword:(currentPassword,password)=>call('change-own-password',{currentPassword,password}),
    disableAccount:()=>call('disable-account',{}),
    joinApp:input=>call('join-app',input??{}),
    leaveApp:()=>call('leave-app',{}),
    listMembers:input=>call('list-members',input??{}),
    manageMember:input=>call('manage-member',input),
    listSessions:()=>call('list-sessions',{}),
    revokeOwnSession:id=>call('revoke-own-session',{id}),
    resetPassword:(token,password)=>call('reset-password',{token,password}),
    requestPasswordReset:username=>call('request-password-reset',{username}),
    createUser:input=>call('create-user',input),
    getUser:id=>call('get-user',{id}),
    findUserByUsername:username=>call('find-user',{username}),
    updateUser:input=>call('update-user',input),
    authenticate:(username,password)=>call('authenticate',{username,password}),
    changePassword:(id,password)=>call('change-password',{id,password}),
    login:(username,password)=>call('login',{username,password}),
    logout:token=>call('logout',{token}),
    resolveSession:token=>call('resolve-session',{token}),
    revokeSession:id=>call('revoke-session',{id}),
    createRole:input=>call('create-role',input),
    getRole:id=>call('get-role',{id}),
    updateRole:input=>call('update-role',input),
    deleteRole:id=>call('delete-role',{id}),
    createGroup:input=>call('create-group',input),
    getGroup:id=>call('get-group',{id}),
    updateGroup:input=>call('update-group',input),
    deleteGroup:id=>call('delete-group',{id}),
    assignUser:input=>call('assign-user',input),
    getAuthorization:userId=>call('get-authorization',{userId}),
    getProfile:userId=>call('get-profile',{userId}),
    updateProfile:input=>call('update-profile',input)
  });
}
