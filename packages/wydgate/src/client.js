// Portable facade: no hashing, storage or host runtime imports.
import { GateError } from './validation.js';
export { GateError } from './validation.js';
export function createGate(dispatch) {
  const call=async(name,input)=>{
    const result=await dispatch.call('wydgate',name,input);
    if(!result.ok)throw new GateError(result.code);
    return result.value;
  };
  return Object.freeze({
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
