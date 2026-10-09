// Portable semantic field rules. No host, transport or presentation dependencies.
import { clean, requireThat as check } from './validation.js';
export const sensitive = (type, registry) => registry.isA(type, 'wydgit.core/password-input');
export function fieldKind(type, registry) {
  return ['password-input','text-area','checkbox','radio-group','checkbox-group','select','text-input'].find(k=>registry.isA(type,`wydgit.core/${k}`)) ?? 'text-input';
}
export function emptyValue(kind,p) { return kind==='checkbox'?false:kind==='checkbox-group'||kind==='select'&&p.multiple?[]:['radio-group','select'].includes(kind)?null:''; }
export function fieldValidation(kind,p) {
  const v=p.value, multi=kind==='checkbox-group'||kind==='select'&&p.multiple;
  const choice=['radio-group','checkbox-group','select'].includes(kind);
  let message='';
  if(kind==='checkbox'?typeof v!=='boolean':choice?multi?!Array.isArray(v)||v.some(x=>typeof x!=='string')||new Set(v).size!==v.length:v!==null&&typeof v!=='string':typeof v!=='string')message='Invalid value type';
  else if(choice&&(multi?v:v===null?[]:[v]).some(x=>!p.options.some(o=>o.value===x&&o.enabled)))message='Invalid selection';
  else if(p.required&&(kind==='checkbox'?!v:multi?v.length===0:typeof v==='string'?!v.trim():v===null))message='Required';
  else if(typeof v==='string'&&p.maxLength!=null&&Array.from(v).length>p.maxLength)message='Character limit exceeded';
  return {valid:!message,validationMessage:message,errors:message?[message]:[],warnings:[]};
}
export function fieldConfiguration(p) {
  check(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(p.name)&&!['constructor','prototype'].includes(p.name),'FORM.NAME','Invalid field name');
  check(p.maxLength==null||Number.isSafeInteger(p.maxLength)&&p.maxLength>=0,'FORM.CONFIG','Invalid character limit');
  if(p.options){const seen=new Set();for(const o of p.options){check(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===3&&typeof o.value==='string'&&o.value.length>0&&typeof o.label==='string'&&typeof o.enabled==='boolean'&&!seen.has(o.value),'FORM.OPTIONS','Invalid options');seen.add(o.value);}}
}
export function descendantFields(runtime,registry,id,context) {
  const out=[];let count=0;
  const walk=id=>{check(++count<=Math.min(10000,context?.limits.formNodes??10000),'FORM.LIMIT','Field traversal limit');if(context)check(context.visible.includes(id),'SEAM.VISIBILITY','Invisible Form descendant');const n=runtime.get(id);if(registry.isA(n.prototype,'wydgit.core/field'))out.push(n);for(const key of Object.keys(n.slots).sort())n.slots[key].forEach(walk);};walk(id);return out;
}
export function formOperation(fields,registry,operation,data,set) {
  check(['validate','isValid','values','bind','clear'].includes(operation),'FORM.OPERATION','Unknown Form operation');
  const names=new Set();for(const f of fields){fieldConfiguration(f.properties);check(!names.has(f.properties.name),'FORM.NAME','Duplicate field name');names.add(f.properties.name);}
  if(operation==='values'){const out=Object.create(null);for(const f of fields)if(!sensitive(f.prototype,registry))out[f.properties.name]=clean(f.properties.value);return out;}
  if(operation==='isValid')return fields.every(f=>f.properties.valid);
  if(operation==='bind'){
    const input=clean(data);check(input&&!Array.isArray(input)&&typeof input==='object','FORM.BIND','Expected binding object');
    check(Object.keys(input).every(k=>names.has(k)),'FORM.BIND','Unknown binding key');
    const updates=fields.filter(f=>Object.hasOwn(input,f.properties.name)).map(f=>{const value=input[f.properties.name],p={...f.properties,value};const result=fieldValidation(fieldKind(f.prototype,registry),p);check(!['Invalid value type','Invalid selection'].includes(result.validationMessage),'FORM.BIND','Incompatible field value');return [f.id,{value}];});updates.forEach(([id,p])=>set(id,p));return null;
  }
  if(operation==='clear'){fields.forEach(f=>set(f.id,{value:emptyValue(fieldKind(f.prototype,registry),f.properties),valid:true,validationMessage:'',errors:[],warnings:[]}));return null;}
  let valid=true;for(const f of fields){const result=fieldValidation(fieldKind(f.prototype,registry),f.properties);set(f.id,result);valid&&=result.valid;}return valid;
}
// Shared canonical invariant, also used by private construction drafts.
export function formTree(raw,registry,inside=false) {
  const form=registry.isA(raw.prototype,'wydgit.core/form');check(!(inside&&form),'FORM.NESTED','Nested Forms are forbidden');
  if(registry.isA(raw.prototype,'wydgit.core/field')&&raw.properties.name!==undefined)fieldConfiguration(raw.properties);
  Object.values(raw.slots).flat().forEach(child=>formTree(child,registry,inside||form));
  if(form){const names=new Set();const walk=n=>{if(registry.isA(n.prototype,'wydgit.core/field')){check(!names.has(n.properties.name),'FORM.NAME','Duplicate field name');names.add(n.properties.name);}Object.values(n.slots).flat().forEach(walk);};walk(raw);}
}

export function publicProperties(node,registry) { return sensitive(node.prototype,registry)?Object.freeze({...node.properties,value:''}):node.properties; }

export function fieldOwner(runtime,registry,id) {
  let owner=null;
  const walk=(current,form)=>{const n=runtime.get(current);if(registry.isA(n.prototype,'wydgit.core/form'))form=n.id;if(current===id)owner=form;for(const children of Object.values(n.slots))children.forEach(child=>walk(child,form));};
  walk(runtime.rootId,null);return owner;
}
