import {serverComponent} from '../execution/component-target.js';
// Small shared definition IR: canonical data plus frontend source locations.
// Future frontends supply validated SEWN, never callbacks or source evaluators.
import { interfaceTypes } from '../object-model/interfaces.js';
import { PrototypeRegistry } from '../object-model/prototypes.js';
import { clean, freeze, record, requireThat as check, WydgitError } from '../object-model/validation.js';
import { validatePackageManifest,validateComponentPlatform } from '../packages/manifest.js';
import { resolveProperties } from '../object-model/schema.js';
import { resolveMember } from '../object-model/members.js';
export function lowerDefinition(input,{manifest,verifiedPackages={},definitions=[],registryOptions={}}={}) {
  const ir=clean(input);
  check(record(ir),'DEFINITION.INVALID','Invalid definition IR');
  const extended=ir.schema==='wydgit.definition/0.20';
  check(record(ir)&&['wydgit.definition/0.19','wydgit.definition/0.20'].includes(ir.schema)&&Object.keys(ir).every(k=>['schema','definition','metadata','locations',...(extended?['composition']:[])].includes(k)),'DEFINITION.INVALID','Invalid definition IR');
  check(JSON.stringify(ir).length<=262144&&record(ir.definition)&&record(ir.metadata),'DEFINITION.INVALID','Invalid or oversized definition IR');
  const m=validatePackageManifest(manifest),d=ir.definition;validateComponentPlatform(m,[d]);
  check(verifiedPackages[m.id]===m.publisher,'DEFINITION.PUBLISHER','Build requires independently verified package publisher');
  check(d.publisher===m.publisher&&typeof d.id==='string'&&d.id.startsWith(m.publisher+'/'),'DEFINITION.IDENTITY','Prototype identity differs from trusted package');
  check(Object.keys(ir.metadata??{}).every(k=>['publisher','version','id'].includes(k)),'DEFINITION.METADATA','Unsupported metadata');
  for(const [k,v] of Object.entries(ir.metadata??{}))check(v===(k==='id'?d.id:m[k]),'DEFINITION.METADATA','Source metadata conflicts with build manifest');
  check(Object.keys(d).every(k=>['id','publisher','public','abstract','extends','properties','slots','behavior','methodRules','methodContracts','overrides','implements','events','lifecycle','friends','dependencies',...(extended?['presentation','component']:[])].includes(k)),'DEFINITION.INVALID','Unsupported canonical field');
  for(const [id,v] of Object.entries(d.implements??{}))check(m.interfaces?.[id]===v,'DEFINITION.DEPENDENCY','Interface must match manifest pin');
  for(const [id,v] of Object.entries(d.dependencies??{}))check(({...m.interfaces,...m.staticLibraries})[id]===v,'DEFINITION.DEPENDENCY','Dependency must match manifest pin');
  const verifiedPrototypes={...registryOptions.verifiedPrototypes,[d.id]:m.publisher};
  let registry;try{registry=new PrototypeRegistry([...definitions,d],{...registryOptions,verifiedPrototypes});}catch(error){
    if(error instanceof WydgitError&&error.details.definition===d.id){const location=Object.entries(ir.locations?.members??{}).find(([name])=>name.toLowerCase()===error.details.member?.toLowerCase())?.[1];if(location)throw new WydgitError(error.code,error.message,{...error.details,...location});}throw error;
  }
  validateComponentPlatform(m,[registry.get(d.id)]);
  if(extended)serverComponent(registry.get(d.id),registry);
  const effectivePresentation=registry.get(d.id).presentation;
  if(effectivePresentation){
    check(!m.runtime.includes('client'),'DEFINITION.TARGET','Server presentation requires a server-only build');
    const inspect=value=>{if(!value||typeof value!=='object')return;if(typeof value.get==='string'&&value.get.startsWith('properties.')){
      const name=value.get.slice('properties.'.length),member=resolveMember(registry.get(d.id),'property',name,true);
      check(!name.includes('.')&&(member.rule.access??'public')==='public'&&!member.rule.hidden&&!member.rule.requires?.length,'DEFINITION.ACCESS','Presentation cannot expose restricted properties');
    }Object.values(value).forEach(inspect);};inspect(effectivePresentation);
  }
  const composition=extended?ir.composition??[]:[];
  check(Array.isArray(composition)&&composition.length<=256,'DEFINITION.COMPOSITION','Invalid composition');
  const names=new Set(),counts=new Map(),owner=registry.get(d.id);
  for(const child of composition){
    check(record(child)&&Object.keys(child).length===4&&['name','type','slot','properties'].every(k=>Object.hasOwn(child,k)),'DEFINITION.COMPOSITION','Invalid child declaration');
    check(typeof child.name==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(child.name)&&!['constructor','prototype','__proto__'].includes(child.name.toLowerCase())&&!names.has(child.name.toLowerCase()),'DEFINITION.COMPOSITION','Invalid or duplicate child name');names.add(child.name.toLowerCase());
    check(![...Object.keys(owner.properties),...Object.keys(owner.methods),...Object.keys(owner.events)].some(n=>n.toLowerCase()===child.name.toLowerCase()),'DEFINITION.COMPOSITION','Child name collides with member');
    check(typeof child.slot==='string'&&Object.hasOwn(owner.slots,child.slot),'DEFINITION.SLOT','Unknown canonical child slot');
    const target=registry.get(child.type),slot=owner.slots[child.slot];
    check(!target.abstract&&!target.static&&!target.interface&&target.id!==d.id,'DEFINITION.COMPOSITION','Invalid child prototype');
    check(target.publisher===m.publisher,'DEFINITION.DEPENDENCY','Installable children must be package-owned; source cannot approve foreign dependencies');
    check(slot&&slot.accepts.some(id=>registry.isA(target.id,id)),'DEFINITION.SLOT','Child is incompatible with its declared slot');
    const count=(counts.get(child.slot)??0)+1;counts.set(child.slot,count);check(count<=(slot.max??Infinity),'DEFINITION.SLOT','Child count exceeds slot maximum');
    check(record(child.properties),'DEFINITION.COMPOSITION','Invalid child properties');
    for(const name of Object.keys(child.properties)){const member=resolveMember(target,'property',name,true);check((member.rule.access??'public')==='public'&&!member.rule.hidden&&!member.rule.requires?.length,'DEFINITION.ACCESS','Child initializer cannot write restricted properties');}
    resolveProperties(child.properties,target);
  }
  for(const program of [d.behavior,...Object.values(d.lifecycle??{})].filter(Boolean)) {
    for(const lib of program.libraries??[])check(m.staticLibraries?.[lib.id]===lib.version,'DEFINITION.DEPENDENCY','Linked library differs from manifest pin');
    for(const type of interfaceTypes(program)){const [id,version]=type.slice('interface:'.length).split('@');check(m.interfaces?.[id]===version,'DEFINITION.DEPENDENCY','Interface reference differs from manifest pin');}
  }
  for(const signature of Object.values(d.methodContracts??{}))for(const type of [...signature.params,signature.returns])if(typeof type==='string'&&type.startsWith('interface:')){const [id,version]=type.slice('interface:'.length).split('@');check(m.interfaces?.[id]===version,'DEFINITION.DEPENDENCY','Abstract interface reference differs from manifest pin');}

  // Package metadata stays in the existing manifest, never in instance properties.
  return freeze(clean({definition:d,manifest:m,...(extended?{composition}: {})}));
}
