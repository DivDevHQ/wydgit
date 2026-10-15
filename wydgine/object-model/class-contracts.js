// Language-neutral declaration metadata. No runtime callbacks or authority tokens.
import { clean, freeze, record, requireThat as check } from './validation.js';
import { validateMember } from './members.js';
import { validate } from '../sewn/validate.js';
import { contractTypes, safeKey } from '../sewn/schema.js';
import { sameSignature, interfaceType } from './interfaces.js';
export const lifecycleHooks=Object.freeze(['Init','Preload','Render','Unload','Dispose']);
const nameOK=n=>/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n)&&safeKey(n.toLowerCase());
const methodType=t=>contractTypes.includes(t)||interfaceType(t);
const fields=(v,names)=>record(v)&&Object.keys(v).every(k=>names.includes(k));
export function classContracts(d,base,methods,properties) {
  if(d.methodContracts!==undefined)for(const [name,p] of Object.entries(d.properties??{})) {
    check(!['id','publisher','version',...lifecycleHooks.map(h=>h.toLowerCase())].includes(name.toLowerCase()),'PROTOTYPE.CONTRACT','Reserved platform property');
    check(p.required===undefined||typeof p.required==='boolean','PROTOTYPE.CONTRACT','Invalid required property flag');
    if(Object.hasOwn(p,'default')){const type=p.default===null?'null':Array.isArray(p.default)?'array':typeof p.default;check((Array.isArray(p.type)?p.type:[p.type]).includes(type)&&(!p.enum||p.enum.includes(p.default)),'PROTOTYPE.CONTRACT','Invalid property default');}
  }
  const declared=d.methodContracts??{};
  check(record(declared),'PROTOTYPE.CONTRACT','Invalid method contracts');
  const contracts={...base?.methodContracts};
  for(const [name,s] of Object.entries(declared)) {
    check(nameOK(name)&&fields(s,['kind','params','returns','access','abstract','virtual','requires','hidden'])&&['sub','function'].includes(s.kind)&&Array.isArray(s.params)&&s.params.length<=16&&s.params.every(methodType)&&(s.kind==='function'?methodType(s.returns):s.returns===undefined)&&['public','private','protected','friend'].includes(s.access)&&typeof s.abstract==='boolean'&&typeof s.virtual==='boolean'&&(!s.abstract||s.virtual&&s.access!=='private'),'PROTOTYPE.CONTRACT','Invalid method contract');
    validateMember(s);
    const old=contracts[name],proc=d.behavior?.procedures?.[name];
    if(old)check(old.virtual&&(old.requires??[]).every(c=>(s.requires??[]).includes(c))&&(!old.hidden||s.hidden===true)&&s.access===old.access&&sameSignature(old,{kind:s.kind,params:s.params.map(type=>({type})),returns:s.returns}),'PROTOTYPE.CONTRACT','Nonvirtual or incompatible override');
    check(s.abstract?!proc&&d.abstract===true:proc&&sameSignature(s,proc),'PROTOTYPE.CONTRACT','Method contract does not match implementation');
    if(proc)check((d.methodRules?.[name]?.access??'public')===s.access&&(s.requires??[]).every(c=>(d.methodRules?.[name]?.requires??[]).includes(c))&&(!s.hidden||d.methodRules?.[name]?.hidden===true),'PROTOTYPE.CONTRACT','Method visibility disagrees with contract');
    contracts[name]=s;
  }
  for(const [name,proc] of Object.entries(d.behavior?.procedures??{})) {
    const old=base?.methodContracts?.[name];
    if(old)check(old.virtual&&(old.requires??[]).every(c=>(d.methodRules?.[name]?.requires??[]).includes(c))&&(!old.hidden||d.methodRules?.[name]?.hidden===true)&&sameSignature(old,proc)&&(d.methodRules?.[name]?.access??'public')===old.access,'PROTOTYPE.CONTRACT','Invalid inherited method contract');
    if(old&&!declared[name])contracts[name]={...old,abstract:false};
  }
  for(const [name,s] of Object.entries(contracts)) {
    check(!Object.hasOwn(properties,name),'PROTOTYPE.CONTRACT','Property collides with a method contract');
    if(!d.abstract)check(!s.abstract&&methods[name],'PROTOTYPE.ABSTRACT','Concrete prototype has unimplemented abstract members');
  }
  const events={...base?.events},eventOwners={...base?.eventOwners};
  check(record(d.events??{}),'PROTOTYPE.EVENT','Invalid event contracts');
  for(const [name,e] of Object.entries(d.events??{})) {
    check(nameOK(name)&&!lifecycleHooks.some(h=>h.toLowerCase()===name.toLowerCase())&&fields(e,['access','params'])&&['public','private','protected','friend'].includes(e.access)&&Array.isArray(e.params)&&e.params.length<=16,'PROTOTYPE.EVENT','Invalid event contract');
    const names=new Set();
    for(const p of e.params){check(fields(p,['name','type'])&&Object.keys(p).length===2&&nameOK(p.name)&&!names.has(p.name.toLowerCase())&&['String','Number','Integer','Float','Boolean','Null','Object','Array'].includes(p.type),'PROTOTYPE.EVENT','Invalid event parameter');names.add(p.name.toLowerCase());}
    check(!Object.keys(events).some(n=>n.toLowerCase()===name.toLowerCase()),'PROTOTYPE.EVENT','Inherited events cannot be redeclared');
    events[name]=e;eventOwners[name]=d.id;
  }
  const groups=new Set();
  if(Object.keys(contracts).length||Object.keys(events).length)for(const n of new Set([...Object.keys(properties),...Object.keys(methods),...Object.keys(contracts),...Object.keys(events)])) {
    const lower=n.toLowerCase();check(!groups.has(lower),'PROTOTYPE.CASE_COLLISION','Case-equivalent declarations denied');groups.add(lower);
    check(!(events[n]&&(properties[n]||methods[n]||contracts[n])),'PROTOTYPE.EVENT','Event collides with member');
  }
  const lifecycle={...base?.lifecycle},lifecycleOwners={...base?.lifecycleOwners};
  check(record(d.lifecycle??{}),'PROTOTYPE.LIFECYCLE','Invalid lifecycle hooks');
  for(const [hook,program] of Object.entries(d.lifecycle??{})) {
    check(lifecycleHooks.includes(hook),'PROTOTYPE.LIFECYCLE','Unknown lifecycle hook');
    const behavior=validate(program),entry=behavior.procedures?.[hook.toLowerCase()];
    check(behavior.body.length===0&&entry?.kind==='sub'&&entry.params.length===0,'PROTOTYPE.LIFECYCLE','Lifecycle requires a compiled parameterless SUB');
    lifecycle[hook]=behavior;lifecycleOwners[hook]=d.id;
  }
  if(d.static)check(!d.methodContracts&&!d.events&&!d.lifecycle,'PROTOTYPE.STATIC','Static prototypes have no instance class contracts');
  return freeze(clean({methodContracts:contracts,events,eventOwners,lifecycle,lifecycleOwners}));
}
