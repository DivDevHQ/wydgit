// Trusted, pure family build. No filesystem access, downloads or live references.
import { lowerDefinition } from './index.js';
import { PrototypeRegistry } from '../object-model/prototypes.js';
import { resolveProperties, validId } from '../object-model/schema.js';
import { formTree } from '../object-model/forms.js';
import { clean, freeze, record, requireThat as check } from '../object-model/validation.js';
import { LIMITS, validatePackageManifest } from '../packages/manifest.js';

export function lowerFamily(inputs,options={}) {
  const irs=clean(inputs),manifest=validatePackageManifest(options.manifest);
  check(Array.isArray(irs)&&irs.length>0&&irs.length<=LIMITS.prototypes,'DEFINITION.FAMILY','Invalid family size');
  check(irs.every(ir=>record(ir)&&record(ir.definition)),'DEFINITION.FAMILY','Invalid family definition');
  const definitions=irs.map(ir=>ir.definition),ids=definitions.map(d=>d.id);
  check(new Set(ids).size===ids.length,'DEFINITION.FAMILY','Duplicate family identity');
  const external=options.definitions??[],catalog=[...external,...definitions];
  const verifiedPrototypes={...options.registryOptions?.verifiedPrototypes,...Object.fromEntries(ids.map(id=>[id,manifest.publisher]))};
  // Every IR passes the same lowerer; no sibling bypass of package verification.
  const lowered=irs.map(ir=>lowerDefinition(ir,{...options,definitions:catalog.filter(d=>d.id!==ir.definition.id),registryOptions:{...options.registryOptions,verifiedPrototypes}}));
  const registry=new PrototypeRegistry(catalog,{...options.registryOptions,verifiedPrototypes});
  const families=new Map(lowered.map(x=>[x.definition.id,x]));
  const compositions=new Map(),active=new Set();
  const composition=id=>{
    if(compositions.has(id))return compositions.get(id);
    check(!active.has(id),'DEFINITION.CYCLE','Family inheritance/composition cycle');active.add(id);
    const d=registry.get(id),own=families.has(id)?families.get(id).composition??[]:d.component?.children??[];
    const inherited=families.has(id)&&d.extends?composition(d.extends):[];
    const result=[...inherited,...own],names=new Set();
    for(const child of result){check(!names.has(child.name.toLowerCase())&&![...Object.keys(d.properties),...Object.keys(d.methods),...Object.keys(d.events)].some(name=>name.toLowerCase()===child.name.toLowerCase()),'DEFINITION.COMPOSITION','Inherited child name collision');names.add(child.name.toLowerCase());if(families.has(child.type))composition(child.type);}
    active.delete(id);compositions.set(id,result);return result;
  };
  for(const id of ids)composition(id);
  const entry=clean(options.entry);
  check(record(entry)&&Object.keys(entry).every(k=>['type','id','properties'].includes(k))&&families.has(entry.type)&&validId(entry.id),'DEFINITION.ENTRY','Invalid package entry point');
  check(registry.isA(entry.type,'wydgit.core/section'),'DEFINITION.ENTRY','Existing package installer requires a Section entry point');
  let nodes=0;const instanceIds=new Set();
  const expand=(prototype,id,properties,depth=0)=>{
    check(depth<=LIMITS.templateDepth&&++nodes<=LIMITS.templateNodes,'DEFINITION.LIMIT','Package template expansion limit');
    check(validId(id)&&id.length<=128&&!instanceIds.has(id),'DEFINITION.IDENTITY','Invalid or duplicate expanded identity');instanceIds.add(id);
    check(families.has(prototype),'DEFINITION.DEPENDENCY','Installable default instances must be declared in the built family');
    const d=registry.get(prototype),slots=Object.create(null);
    check(!d.abstract&&!d.static&&!d.interface,'DEFINITION.COMPOSITION','Unconstructible template prototype');
    for(const slot of Object.keys(d.slots))slots[slot]=[];
    for(const child of composition(prototype)){
      const rule=d.slots[child.slot];check(rule&&rule.accepts.some(base=>registry.isA(child.type,base)),'DEFINITION.SLOT','Inherited child incompatible with slot');
      slots[child.slot].push(expand(child.type,`${id}-${child.name}`,child.properties,depth+1));
    }
    for(const [slot,rule] of Object.entries(d.slots))check(slots[slot].length>=(rule.min??0)&&slots[slot].length<=(rule.max??Infinity),'DEFINITION.SLOT','Complete template violates cardinality');
    return {schema:'wydgit/0.2',id,prototype,properties:resolveProperties(properties??{},d),slots,provenance:{}};
  };
  const template=expand(entry.type,entry.id,entry.properties);
  formTree(template,registry);
  const ordered=[],emitted=new Set();
  const emit=id=>{if(emitted.has(id)||!families.has(id))return;emitted.add(id);const family=families.get(id),d=family.definition;
    for(const dependency of [d.extends,...Object.keys(d.implements??{}),...(family.composition??[]).map(c=>c.type),...(d.component?.templates??[]).flatMap(t=>[t.type,t.model])].filter(Boolean).sort())emit(dependency);
    ordered.push(d);
  };
  for(const id of [...ids].sort())emit(id);
  const resources={
    [manifest.resources.prototypes]:JSON.stringify(ordered,null,2)+'\n',
    [manifest.resources.template]:JSON.stringify(template,null,2)+'\n'
  };
  for(const text of Object.values(resources))check(Buffer.byteLength(text)<=LIMITS.resource,'DEFINITION.LIMIT','Generated package resource exceeds installer bound');
  return freeze({manifest,definitions:ordered,template,resources});
}
