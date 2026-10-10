import { clean, freeze, record, requireThat as check } from '../object-model/validation.js';
const types=['string','number','boolean','object','array','null','json'];
export class EventRegistry {
  #events=new Map();
  constructor() {
    for(const [family,names] of Object.entries({Server:['Start','Stop'],Session:['Start','Authenticated','Logout','Timeout','End'],Page:['Start','Initialize','Load','Validate','PreRender','Unload'],Client:['Mount','Ready','Unmount']}))
      for(const name of names)this.define(`${family}.${name}`,{family,fields:{},cancelable:false});
    this.define('Activate',{family:'Semantic',cancelable:true,fields:{Command:{type:'string',optional:true}}});
    this.define('Change',{family:'Semantic',cancelable:true,fields:{OldValue:{type:'json'},NewValue:{type:'json'}}});
    this.define('Submit',{family:'Semantic',cancelable:true,fields:{}});
  }
  define(name,input) {
    check(typeof name==='string'&&/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?$/.test(name)&&!this.#events.has(name),'EVENT.INVALID','Invalid event definition');
    const d=clean(input);check(record(d)&&Object.keys(d).every(k=>['family','cancelable','fields'].includes(k))&&['Server','Session','Page','Client','Semantic','Custom'].includes(d.family)&&typeof d.cancelable==='boolean'&&record(d.fields),'EVENT.INVALID','Invalid event schema');
    for(const rule of Object.values(d.fields))check(record(rule)&&Object.keys(rule).every(k=>['type','optional'].includes(k))&&types.includes(rule.type)&&(rule.optional===undefined||typeof rule.optional==='boolean'),'EVENT.INVALID','Invalid payload rule');
    check(['Semantic','Custom'].includes(d.family)||!d.cancelable,'EVENT.INVALID','Lifecycle cannot cancel');
    this.#events.set(name,freeze(d));return this;
  }
  resolve(name){const matches=[...this.#events.keys()].filter(key=>key.toLowerCase()===name.toLowerCase());check(matches.length===1,'EVENT.INVALID','Unknown or ambiguous event');return matches[0];}
  get(name){check(this.#events.has(name),'EVENT.INVALID','Unknown event');return this.#events.get(name);}
  payload(name,input) {
    const value=clean(input),d=this.get(name);check(record(value)&&JSON.stringify(value).length<=16384,'EVENT.LIMIT','Payload limit');
    function depth(v,n=0){check(n<=16,'EVENT.LIMIT','Payload depth');if(v&&typeof v==='object')Object.values(v).forEach(x=>depth(x,n+1));}depth(value);
    check(Object.keys(value).every(k=>Object.hasOwn(d.fields,k)),'EVENT.INVALID','Unknown payload field');
    for(const [key,rule] of Object.entries(d.fields)) {
      if(!Object.hasOwn(value,key)){check(rule.optional===true,'EVENT.INVALID','Missing payload field');continue;}
      const v=value[key],type=v===null?'null':Array.isArray(v)?'array':typeof v;
      check(rule.type==='json'||rule.type===type,'EVENT.INVALID','Invalid payload type');
    }
    return freeze(value);
  }
}
