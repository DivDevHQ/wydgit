// Language-neutral semantic controls. Target adaptation never changes SEWN authority.
import {clean,record,WydgitError,requireThat as check} from './object-model/validation.js';
import {resolveMember,accessOf} from './object-model/members.js';
import {fieldValidation} from './object-model/forms.js';
import {canonicalConvert} from './sewn/operations.js';
export const CONTROL_SCHEMA='wydgit.presentation/0.2';
const name=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v.toLowerCase());
const shape=(v,keys,required=[])=>check(record(v)&&Object.keys(v).every(k=>keys.includes(k))&&required.every(k=>Object.hasOwn(v,k)),'CONTROL.INVALID','Invalid semantic control metadata');
export const wellFormed=value=>typeof value==='string'&&[...value].every(c=>{const n=c.codePointAt(0);return n<0xD800||n>0xDFFF;});
const scalar=v=>v===null||['string','boolean','number'].includes(typeof v);
export function controlValue(value){check(scalar(value)||record(value)&&Object.keys(value).length===1&&typeof value.get==='string'&&/^properties\.[A-Za-z][A-Za-z0-9_]*$/.test(value.get),'CONTROL.INVALID','Expected scalar literal or exact property binding');}
export function validateControls(spec){
 check(JSON.stringify(spec).length<=65536,'CONTROL.LIMIT','Presentation size exceeded');
 shape(spec,['schema','target','template'],['schema','target','template']);check(spec.schema===CONTROL_SCHEMA&&spec.target==='client','CONTROL.TARGET','Semantic controls require explicit client target');
 const identities=new Set();let count=0,fields=0;
 const walk=(n,depth=0,form=null)=>{
  check(depth<=16&&++count<=256,'CONTROL.LIMIT','Control presentation bound');
  if(n.tag){shape(n,['tag','text','children'],['tag']);check(['section','div','p','span','h2','h3','strong','ul','ol','li'].includes(n.tag),'CONTROL.INVALID','Unsupported structure');if(Object.hasOwn(n,'text'))controlValue(n.text);}
  else {
   shape(n,['control','name','label','value','type','required','maxLength','options','action','children','reset'],['control','name','label']);
   check(name(n.name)&&!identities.has(n.name)&&wellFormed(n.label)&&n.label.length>0&&n.label.length<=256,'CONTROL.IDENTITY','Invalid control name or label');identities.add(n.name);
   check(['label','status','button','form','text','textarea','checkbox','select','submit','reset'].includes(n.control),'CONTROL.INVALID','Unknown control');
   if(n.control==='form'){check(!form,'CONTROL.INVALID','Nested forms are unsupported');form=new Set();check(['success','manual'].includes(n.reset??'success'),'CONTROL.INVALID','Invalid reset policy');}
   if(['text','textarea','checkbox','select'].includes(n.control)){
    check(form&&++fields<=64&&!form.has(n.name),'CONTROL.INVALID','Fields need a form and unique names');form.add(n.name);
    check(['String','Boolean','Integer','Float'].includes(n.type)&&typeof n.required==='boolean'&&Number.isSafeInteger(n.maxLength)&&n.maxLength>=1&&n.maxLength<=4096,'CONTROL.INVALID','Field requires explicit bounded value contract');
    check(n.control==='checkbox'?n.type==='Boolean':n.control==='select'||n.control==='textarea'?n.type==='String':n.type!=='Boolean','CONTROL.INVALID','Incompatible control value type');
    if(n.control==='select')check(Array.isArray(n.options)&&n.options.length>0&&n.options.length<=64&&new Set(n.options).size===n.options.length&&n.options.every(o=>wellFormed(o)&&o.length>0&&o.length<=128),'CONTROL.INVALID','Invalid finite options');else check(n.options===undefined,'CONTROL.INVALID','Options only belong to selects');
    if(n.value!==undefined){controlValue(n.value);if(!record(n.value)){check(n.type==='Boolean'?typeof n.value==='boolean':n.type==='String'?wellFormed(n.value):['number','string'].includes(typeof n.value),'CONTROL.TYPE','Invalid initial field type');if(['Integer','Float'].includes(n.type))canonicalConvert(n.value,n.type);}}
   }else check(['type','required','maxLength','options'].every(k=>n[k]===undefined),'CONTROL.INVALID','Unexpected field contract');
   if(['form','button'].includes(n.control)){shape(n.action,['method'],['method']);check(name(n.action.method),'CONTROL.ACTION','Explicit method action required');}else check(n.action===undefined,'CONTROL.ACTION','Unexpected action binding');
   if(['submit','reset'].includes(n.control))check(form,'CONTROL.INVALID','Submit/reset require a form');
   if(['label','status'].includes(n.control)&&n.value!==undefined)controlValue(n.value);
   check(n.children===undefined||n.control==='form','CONTROL.INVALID','Only forms contain controls');
   if(['button','form','submit','reset'].includes(n.control))check(n.value===undefined,'CONTROL.INVALID','This control cannot bind a value');
   if(n.control!=='form')check(n.reset===undefined,'CONTROL.INVALID','Reset policy belongs to form');
  }
  check(n.children===undefined||Array.isArray(n.children),'CONTROL.INVALID','Invalid control children');
  for(const child of n.children??[])walk(child,depth+1,form);
 };walk(spec.template);return spec;
}
export function controlNodes(spec){const out=[];const walk=n=>{if(n.control)out.push(n);for(const c of n.children??[])walk(c);};walk(spec.template);return out;}
export function validateControlBindings(d,registry){
 if(d.presentation?.schema!==CONTROL_SCHEMA)return;
 validateControls(d.presentation);
 const visit=n=>{try{
  for(const v of [n.text,n.value].filter(v=>record(v))){const member=resolveMember(d,'property',v.get.slice(11),true);check(accessOf(member.rule)==='public'&&!member.rule.hidden&&!member.rule.requires?.length&&['string','number','boolean'].includes(member.rule.type),'CONTROL.ACCESS','Display bindings require public scalar properties');if(n.type)check(member.rule.type===({String:'string',Boolean:'boolean',Integer:'number',Float:'number'})[n.type],'CONTROL.TYPE','Initial field binding type differs');}
  if(n.action){const resolved=registry.method(d.id,n.action.method,null,false),proc=resolved.behavior.procedures[resolved.name];check(accessOf(d.methodRules[resolved.name]??{})==='public'&&!d.methodRules[resolved.name]?.hidden&&proc.kind==='sub'&&proc.params.length===(n.control==='form'?1:0)&&(n.control!=='form'||proc.params[0].type==='Object'),'CONTROL.ACTION','Action requires a public SUB with the declared payload signature');}
  for(const c of n.children??[])visit(c);
 }catch(error){if(error instanceof WydgitError&&!error.details.definition)throw new WydgitError(error.code,error.message,{...error.details,definition:d.id,member:n.control?'control:'+n.name:'presentation'});throw error;}
 };visit(d.presentation.template);
}
// Complete record validation precedes every application call. No partial property edits.
export function controlRecord(form,raw,tick=()=>{}){
 check(record(raw),'CONTROL.INPUT','Expected a field record');const fields=controlNodes({template:form}).filter(n=>['text','textarea','checkbox','select'].includes(n.control));
 check(Object.keys(raw).length===fields.length&&Object.keys(raw).every(key=>fields.some(f=>f.name===key)),'CONTROL.INPUT','Unexpected or missing form fields');
 const result=Object.create(null);
 for(const f of fields){tick();const value=raw[f.name];
  if(f.type==='Boolean')check(typeof value==='boolean','CONTROL.INPUT','Invalid checkbox value');
  else check(wellFormed(value)&&value.length<=8192&&[...value].length<=f.maxLength,'CONTROL.INPUT','Invalid or overlong text');
  const rule={value,required:f.required,maxLength:f.maxLength,options:(f.options??[]).map(v=>({value:v,label:v,enabled:true}))};
  const validation=fieldValidation(f.control==='checkbox'?'checkbox':f.control==='select'?'select':'text-input',rule);
  check(validation.valid,'CONTROL.INPUT',`${f.label}: ${validation.validationMessage}`);
  try{result[f.name]=['Integer','Float'].includes(f.type)?canonicalConvert(value,f.type):value;}catch{check(false,'CONTROL.INPUT',`${f.label}: Invalid number`);}
 }return clean(result);
}
