import {clean, freeze, record, requireThat as check} from '../object-model/validation.js';
import {checkJsonBudget} from '../libraries/limits.js';
import {isCapability} from '../seam/capabilities.js';

const code='ACTION.DECLARATION';
const name=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(x);
const field=x=>/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const text=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max&&x.isWellFormed()&&!/[\u0000-\u001f]/.test(x);
export const ACTION_LIMITS=Object.freeze({maxBytes:32768,maxDepth:12,maxNodes:2048});
export function checkActionCount(entries) {
  check(entries.reduce((count,e)=>count+(e.executionPlacement?.context==='BackOffice'&&e.executionPlacement.status==='active'?(e.manifest.backofficeActions?.length??0):0),0)<=256,code,'Site action limit exceeded');
}
function keys(value,required,optional=[]) {
  check(record(value)&&required.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>[...required,...optional].includes(k)),code,'Invalid action contract fields');
}
// Deliberately small closed JSON contract, not JSON Schema or executable validators.
export function valueContract(value,depth=0) {
  check(depth<=6,code,'Contract nesting limit');
  check(record(value),code,'Expected value contract');
  const type=value.type;
  if(type==='object') {
    keys(value,['type','fields'],['optional']);check(record(value.fields)&&Object.keys(value.fields).length<=32&&Object.keys(value.fields).every(field),code,'Invalid fields');
    const optional=value.optional??[];
    check(Array.isArray(optional)&&new Set(optional).size===optional.length&&optional.every(k=>Object.hasOwn(value.fields,k)),code,'Invalid optional fields');
    Object.values(value.fields).forEach(v=>valueContract(v,depth+1));
  } else if(type==='array') {
    keys(value,['type','items','maxItems']);check(Number.isSafeInteger(value.maxItems)&&value.maxItems>=0&&value.maxItems<=256,code,'Invalid array bound');valueContract(value.items,depth+1);
  } else if(type==='string') {
    keys(value,['type','maxLength']);check(Number.isSafeInteger(value.maxLength)&&value.maxLength>=0&&value.maxLength<=4096,code,'Invalid string bound');
  } else if(type==='integer') {
    keys(value,['type','min','max']);check(Number.isSafeInteger(value.min)&&Number.isSafeInteger(value.max)&&value.min<=value.max,code,'Invalid integer bounds');
  } else {keys(value,['type']);check(['boolean','null'].includes(type),code,'Unsupported value contract');}
  return value;
}
export function matchesContract(value,contract) {
  switch(contract.type) {
    case 'object':return record(value)&&Object.keys(value).every(k=>Object.hasOwn(contract.fields,k))&&Object.entries(contract.fields).every(([k,c])=>Object.hasOwn(value,k)?matchesContract(value[k],c):(contract.optional??[]).includes(k));
    case 'array':return Array.isArray(value)&&value.length<=contract.maxItems&&value.every(v=>matchesContract(v,contract.items));
    case 'string':return typeof value==='string'&&value.isWellFormed()&&value.length<=contract.maxLength;
    case 'integer':return Number.isSafeInteger(value)&&value>=contract.min&&value<=contract.max;
    case 'boolean':return typeof value==='boolean';
    case 'null':return value===null;
    default:return false;
  }
}
export function actionDeclarations(input,manifest) {
  checkJsonBudget(input,ACTION_LIMITS,code);
  const actions=clean(input);check(Array.isArray(actions)&&actions.length<=32,code,'Invalid action list');const ids=new Set();
  for(const a of actions) {
    keys(a,['id','owner','title','description','category','context','permission','capability','scopes','service','effect','input','output'],['confirmation']);
    check(name(a.id)&&!ids.has(a.id),code,'Invalid or duplicate action ID');ids.add(a.id);
    check(typeof a.owner==='string'&&manifest.permissions.visible.includes(a.owner),code,'Action owner requires exact declared visibility');
    check(text(a.title,128)&&text(a.description,512)&&name(a.category)&&a.context==='BackOffice',code,'Invalid action metadata or context');
    check(isCapability(a.permission)&&isCapability(a.capability)&&manifest.permissions.capabilities.includes(a.capability),code,'Invalid permission or capability requirement');
    check(record(a.scopes)&&Object.keys(a.scopes).length>0&&Object.entries(a.scopes).every(([provider,values])=>name(provider)&&Array.isArray(values)&&values.length>0&&new Set(values).size===values.length&&values.every(v=>manifest.permissions.scopes[provider]?.includes(v))),code,'Action scopes must be declared requirements');
    keys(a.service,['library','apiVersion','operation']);check(name(a.service.library)&&name(a.service.operation)&&/^\d+\.\d+\.\d+$/.test(a.service.apiVersion)&&manifest.requires.libraries.some(l=>l.library===a.service.library)&&Object.hasOwn(a.scopes,a.service.library),code,'Invalid fixed service binding');
    check(['read','write'].includes(a.effect)&&(a.confirmation===undefined||text(a.confirmation,256))&&(a.effect!=='write'||a.confirmation!==undefined),code,'Mutations require confirmation metadata');
    valueContract(a.input);valueContract(a.output);check(a.input.type==='object',code,'Action input must be an object');
  }
  return freeze(actions);
}
