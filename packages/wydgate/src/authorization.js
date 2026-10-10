import { randomUUID } from 'node:crypto';
import { check, fields, displayName, validId } from './validation.js';
export const entityId = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).test(value);
export const permission = value => typeof value === 'string' && value.length <= 128 && /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(value);
export function set(value, valid, max=64) {
  check(Array.isArray(value) && value.length <= max && value.every(valid),'GATE.INVALID_AUTHORIZATION');
  return [...new Set(value)].sort();
}
const required = (values,id,code) => { const value=values.find(value=>value.id===id);check(value,code);return value; };
export function effective(data,userId) {
  const assignment=data.assignments.find(value=>value.userId===userId);
  const groups=data.groups.filter(group=>group.members.includes(userId));
  const roles=[...new Set([...assignment.roles,...groups.flatMap(group=>group.roles)])].sort();
  const permissions=[...new Set([...assignment.permissions,...groups.flatMap(group=>group.permissions),...roles.flatMap(id=>data.roles.find(role=>role.id===id).permissions)])].sort();
  return {userId,roles,groups:groups.map(group=>group.id).sort(),permissions};
}
export function validateAuthorization(data,users) {
  for(const key of ['roles','groups','profiles','assignments'])check(Array.isArray(data[key]));
  check(data.roles.length<=64 && data.groups.length<=64 && data.profiles.length===users.size && data.assignments.length===users.size);
  const roles=new Set(),groups=new Set();
  const canonical=(values,valid,max)=>check(JSON.stringify(values)===JSON.stringify(set(values,valid,max)));
  for(const role of data.roles) {
    fields(role,['id','name','permissions']);check(entityId(role.id,'r')&&!roles.has(role.id));roles.add(role.id);
    displayName(role.name);canonical(role.permissions,permission);
  }
  for(const group of data.groups) {
    fields(group,['id','name','members','roles','permissions']);check(entityId(group.id,'g')&&!groups.has(group.id));groups.add(group.id);
    displayName(group.name);canonical(group.members,id=>users.has(id),256);canonical(group.roles,id=>roles.has(id));canonical(group.permissions,permission);
  }
  for(const [key,keys] of [['assignments',['userId','roles','permissions']],['profiles',['userId','bio']]]) {
    const seen=new Set();
    for(const value of data[key]) {
      fields(value,keys);check(users.has(value.userId)&&!seen.has(value.userId));seen.add(value.userId);
      if(key==='profiles')validateBio(value.bio);
      else {canonical(value.roles,id=>roles.has(id));canonical(value.permissions,permission);}
    }
  }
}
export function validateBio(value) {check(typeof value==='string'&&value.length<=1024&&value.isWellFormed(),'GATE.INVALID_PROFILE');return value;}
export function authorizationOperations({read,mutate,find}) {
  return async (operation,request) => {
    if(['get-profile','get-authorization'].includes(operation)) {
      fields(request,['userId']);check(validId(request.userId));const data=(await read()).data;find(data,request.userId);
      return operation==='get-profile'?data.profiles.find(profile=>profile.userId===request.userId):effective(data,request.userId);
    }
    if(operation==='update-profile') {
      fields(request,['userId','bio']);check(validId(request.userId));validateBio(request.bio);
      return mutate(data=>{find(data,request.userId);const profile=data.profiles.find(profile=>profile.userId===request.userId);profile.bio=request.bio;return profile;});
    }
    if(operation==='assign-user') {
      fields(request,['userId','roles','permissions']);check(validId(request.userId));const permissions=set(request.permissions,permission);
      return mutate(data=>{
        find(data,request.userId);const roles=set(request.roles,id=>data.roles.some(role=>role.id===id));
        Object.assign(data.assignments.find(value=>value.userId===request.userId),{roles,permissions});return effective(data,request.userId);
      });
    }
    const match=/^(create|update|get|delete)-(role|group)$/.exec(operation);
    if(!match)return undefined;
    const [,action,kind]=match,key=kind==='role'?'roles':'groups',prefix=kind==='role'?'r':'g',code=kind==='role'?'GATE.ROLE_NOT_FOUND':'GATE.GROUP_NOT_FOUND';
    const keys=kind==='role'?['name','permissions']:['name','permissions','roles','members'];
    fields(request,action==='create'?keys:['id'],action==='update'?keys:[],'GATE.INVALID_AUTHORIZATION');
    if(action!=='create')check(entityId(request.id,prefix),'GATE.INVALID_AUTHORIZATION');
    if(action==='get')return required((await read()).data[key],request.id,code);
    const patch={};
    if(Object.hasOwn(request,'name'))patch.name=displayName(request.name);
    if(Object.hasOwn(request,'permissions'))patch.permissions=set(request.permissions,permission);
    if(action==='update')check(keys.some(key=>Object.hasOwn(request,key)),'GATE.INVALID_AUTHORIZATION');
    const id=action==='create'?`${prefix}_${randomUUID()}`:request.id;
    return mutate(data=>{
      if(Object.hasOwn(request,'roles'))patch.roles=set(request.roles,id=>data.roles.some(role=>role.id===id));
      if(Object.hasOwn(request,'members'))patch.members=set(request.members,id=>data.users.some(user=>user.id===id),256);
      if(action==='create') {check(data[key].length<64,'GATE.LIMIT');check(!data[key].some(value=>value.id===id),'GATE.CONFLICT');const value={id,...patch};data[key].push(value);return value;}
      const value=required(data[key],id,code);
      if(action==='update'){Object.assign(value,patch);return value;}
      data[key]=data[key].filter(value=>value.id!==id);
      if(kind==='role')for(const assignment of [...data.assignments,...data.groups])assignment.roles=assignment.roles.filter(role=>role!==id);
      return {id,removed:true};
    });
  };
}
