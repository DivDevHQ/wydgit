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
    changePassword:(id,password)=>call('change-password',{id,password})
  });
}
