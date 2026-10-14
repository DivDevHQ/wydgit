// Small shared definition IR: canonical data plus frontend source locations.
// Future frontends supply validated SEWN, never callbacks or source evaluators.
import { interfaceTypes } from '../object-model/interfaces.js';
import { PrototypeRegistry } from '../object-model/prototypes.js';
import { clean, freeze, record, requireThat as check } from '../object-model/validation.js';
import { validatePackageManifest } from '../packages/manifest.js';
export function lowerDefinition(input,{manifest,verifiedPackages={},definitions=[],registryOptions={}}={}) {
  const ir=clean(input);
  check(record(ir)&&ir.schema==='wydgit.definition/0.19'&&Object.keys(ir).every(k=>['schema','definition','metadata','locations'].includes(k)),'DEFINITION.INVALID','Invalid definition IR');
  check(JSON.stringify(ir).length<=262144&&record(ir.definition)&&record(ir.metadata),'DEFINITION.INVALID','Invalid or oversized definition IR');
  const m=validatePackageManifest(manifest),d=ir.definition;
  check(verifiedPackages[m.id]===m.publisher,'DEFINITION.PUBLISHER','Build requires independently verified package publisher');
  check(d.publisher===m.publisher&&typeof d.id==='string'&&d.id.startsWith(m.publisher+'/'),'DEFINITION.IDENTITY','Prototype identity differs from trusted package');
  check(Object.keys(ir.metadata??{}).every(k=>['publisher','version','id'].includes(k)),'DEFINITION.METADATA','Unsupported metadata');
  for(const [k,v] of Object.entries(ir.metadata??{}))check(v===(k==='id'?d.id:m[k]),'DEFINITION.METADATA','Source metadata conflicts with build manifest');
  check(Object.keys(d).every(k=>['id','publisher','public','abstract','extends','properties','slots','behavior','methodRules','methodContracts','overrides','implements','events','lifecycle','friends','dependencies'].includes(k)),'DEFINITION.INVALID','Unsupported canonical field');
  for(const [id,v] of Object.entries(d.implements??{}))check(m.interfaces?.[id]===v,'DEFINITION.DEPENDENCY','Interface must match manifest pin');
  for(const [id,v] of Object.entries(d.dependencies??{}))check(({...m.interfaces,...m.staticLibraries})[id]===v,'DEFINITION.DEPENDENCY','Dependency must match manifest pin');
  const verifiedPrototypes={...registryOptions.verifiedPrototypes,[d.id]:m.publisher};
  new PrototypeRegistry([...definitions,d],{...registryOptions,verifiedPrototypes});
  for(const program of [d.behavior,...Object.values(d.lifecycle??{})].filter(Boolean)) {
    for(const lib of program.libraries??[])check(m.staticLibraries?.[lib.id]===lib.version,'DEFINITION.DEPENDENCY','Linked library differs from manifest pin');
    for(const type of interfaceTypes(program)){const [id,version]=type.slice('interface:'.length).split('@');check(m.interfaces?.[id]===version,'DEFINITION.DEPENDENCY','Interface reference differs from manifest pin');}
  }
  for(const signature of Object.values(d.methodContracts??{}))for(const type of [...signature.params,signature.returns])if(typeof type==='string'&&type.startsWith('interface:')){const [id,version]=type.slice('interface:'.length).split('@');check(m.interfaces?.[id]===version,'DEFINITION.DEPENDENCY','Abstract interface reference differs from manifest pin');}

  // Package metadata stays in the existing manifest, never in instance properties.
  return freeze(clean({definition:d,manifest:m}));
}
