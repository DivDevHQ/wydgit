import {CONTROL_SCHEMA,validateControls} from './controls.js';
// Shared canonical presentation validation; renderer adapters impose narrower profiles.
import {clean,requireThat as check} from './object-model/validation.js';
const blocked=new Set(['__proto__','prototype','constructor']);
const tags=new Set(['section','div','p','span','h2','h3','form','label','input','button','ol','ul','li','a','nav','strong','audio','video','source','img']);
const attributes=new Set(['id','class','role','method','action','for','name','type','value','placeholder','href','title','aria-label','src','alt','controls','preload','enctype','accept','required','autocomplete','maxlength']);
const ops=new Set(['concat','eq','not','and','or','if','length','add','subtract','min','max','lt','gt','query','queryValid','integer','parameter','url','trim']);
export function validatePresentation(input){
 const spec=clean(input);if(spec.schema===CONTROL_SCHEMA)return validateControls(spec);let nodes=0;
 const walk=(value,depth=0)=>{check(++nodes<=1024&&depth<=32,'COMPONENT.INVALID','Presentation complexity exceeded');if(value&&typeof value==='object'){
  if(value.op!==undefined)check(ops.has(value.op),'COMPONENT.INVALID','Unsupported expression');
  if(value.get!==undefined)check(typeof value.get==='string'&&value.get.length<=256&&value.get.split('.').length<=16&&value.get.split('.').every(p=>!blocked.has(p)),'COMPONENT.INVALID','Invalid value path');
  if(value.tag!==undefined){check(tags.has(value.tag),'COMPONENT.INVALID','Unsupported element');check(Object.keys(value.attrs??{}).every(a=>attributes.has(a)),'COMPONENT.INVALID','Unsupported attribute');}
  Object.values(value).forEach(v=>walk(v,depth+1));
 }};
 check(spec.schema==='wydgit.presentation/0.1'&&spec.template,'COMPONENT.INVALID','Invalid presentation');
 check(Object.keys(spec).every(k=>['schema','template','request','when','valid','submission','delivery'].includes(k)),'COMPONENT.INVALID','Unknown presentation field');
 for(const binding of [spec.request,spec.submission,spec.delivery].filter(Boolean))check(Object.keys(binding).every(k=>['library','apiVersion','operation','input'].includes(k))&&['library','apiVersion','operation'].every(k=>typeof binding[k]==='string'),'COMPONENT.INVALID','Invalid service binding');
 walk(spec);return spec;
}
