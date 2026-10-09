import { clean, freeze, requireThat as check } from '../object-model/validation.js';
export const reservedCookie=name=>/^__Host-wydgit-|^wydgit-|^__Secure-wydgit-/i.test(name);
const forbidden=new Set(['__proto__','prototype','constructor']);
export function parseMap(text='') {
  check(typeof text==='string'&&text.length<=32768,'REQUEST.LIMIT','Input limit');
  const out=Object.create(null);let count=0;
  const decode=value=>{try{return decodeURIComponent(value.replace(/\+/g,' '));}catch{check(false,'REQUEST.INVALID','Malformed encoding');}};
  for(const pair of text.split('&').filter(Boolean)) {
    check(++count<=128,'REQUEST.LIMIT','Too many values');const i=pair.indexOf('='),name=decode(i<0?pair:pair.slice(0,i)),value=decode(i<0?'':pair.slice(i+1));
    check(name.length>0&&name.length<=128&&!forbidden.has(name)&&!/[\x00-\x1f\x7f]/.test(name)&&value.length<=8192&&!/\x00/.test(value),'REQUEST.INVALID','Invalid input');
    (out[name]??=[]).push(value);
  }
  return freeze(out);
}
export function parseCookies(text='') {
  check(typeof text==='string'&&text.length<=8192,'REQUEST.LIMIT','Cookie limit');const out=Object.create(null);
  for(const item of text.split(';').filter(x=>x.trim())) {
    const i=item.indexOf('='),name=item.slice(0,i).trim();check(i>0&&/^[A-Za-z0-9_-]{1,64}$/.test(name)&&!forbidden.has(name)&&!Object.hasOwn(out,name),'REQUEST.INVALID','Invalid cookie');
    try{out[name]=decodeURIComponent(item.slice(i+1).trim());}catch{check(false,'REQUEST.INVALID','Invalid cookie encoding');}
    check(out[name].length<=4096&&!/[\x00-\x1f\x7f]/.test(out[name]),'REQUEST.INVALID','Invalid cookie value');
  }return freeze(out);
}
export function cookieReader(context,cookies,capability,guard=()=>{}) {
  return Object.freeze({Get(name){guard();context.require(capability);check(typeof name==='string'&&!forbidden.has(name)&&!reservedCookie(name)&&context.scopes.cookies?.some(x=>x.name===name),'SEAM.DENIED','Cookie denied');return Object.hasOwn(cookies,name)?cookies[name]:null;}});
}
export function requestFacade({method,path,route={},query='',form='',cookies={}},context,guard=()=>{}) {
  check(['GET','HEAD','POST'].includes(method)&&typeof path==='string'&&path.startsWith('/')&&path.length<=2048&&!/[\x00-\x1f\x7f]/.test(path),'REQUEST.INVALID','Invalid request');
  const map=data=>Object.freeze({Get(name){guard();const values=data[name];check(!values||values.length===1,'REQUEST.INVALID','Ambiguous repeated input');return values?.[0]??null;},GetAll(name){guard();return data[name]??Object.freeze([]);}});
  const q=parseMap(query),f=parseMap(form),r=freeze(clean(route));
  return Object.freeze({get Method(){guard();return method;},get Path(){guard();return path;},get Route(){guard();return r;},get IsPost(){guard();return method==='POST';},Query:map(q),Form:map(f),Cookies:cookieReader(context,cookies,'request.cookies.read',guard)});
}
