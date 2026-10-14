import { PrototypeRegistry } from '../object-model/prototypes.js';
import { clean, requireThat as check } from '../object-model/validation.js';
import { validate } from '../sewn/validate.js';
import { STATIC_SCHEMA, REGEX_SCHEMA, regexReservedNames } from '../sewn/schema.js';

// Host-issued verified publisher bindings are the existing prototype trust boundary.
// Installation/availability never constitutes an import or a grant of authority.
export class StaticLibraryRegistry {
  #registry;
  constructor(definitions, options = {}) {
    check(Array.isArray(definitions)&&definitions.length<=64,'LIBRARY.LIMIT','Static library catalog limit exceeded');
    this.#registry = new PrototypeRegistry(definitions, options);
    const graph=new Map(definitions.filter(d=>d.static).map(d=>[d.id,Object.keys(d.dependencies??{})]));
    const visiting=new Set(),done=new Set();
    const visit=id=>{check(!visiting.has(id),'LIBRARY.CYCLE','Unsupported package dependency cycle');if(done.has(id))return;visiting.add(id);for(const next of graph.get(id)??[]){check(graph.has(next),'LIBRARY.MISSING',`Missing dependency: ${next}`);visit(next);}visiting.delete(id);done.add(id);};
    for(const id of graph.keys())visit(id);
    for(const d of definitions.filter(d=>d.static))for(const [id,version] of Object.entries(d.dependencies??{}))this.resolve(id,version);
    Object.freeze(this);
  }
  resolve(id, version) {
    check(typeof version==='string','LIBRARY.DEPENDENCY',`Undeclared dependency: ${id}`);
    let definition;
    try { definition=this.#registry.get(id); } catch { check(false,'LIBRARY.MISSING',`Missing library: ${id}`); }
    check(definition.static,'LIBRARY.STATIC',`Not a static library: ${id}`);
    check(this.#registry.verifiedPublisher(id)===definition.publisher,'LIBRARY.TRUST',`Unverified library publisher: ${id}`);
    check(definition.version===version,'LIBRARY.VERSION',`Unsupported library version: ${id}@${version}`);
    return definition;
  }
}

export function libraryScope(imports, {libraries, dependencies={}}={}) {
  const aliases=new Map(),exports=new Map(),definitions=[];
  for(const {id} of imports){
    check(!definitions.some(d=>d.id===id),'LIBRARY.ALIAS',`Duplicate library import: ${id}`);
    check(libraries instanceof StaticLibraryRegistry,'LIBRARY.MISSING',`Missing library resolver: ${id}`);
    const d=libraries.resolve(id,dependencies[id]),alias=d.alias.toLowerCase();
    check(!regexReservedNames.includes(d.alias.toUpperCase())&&!aliases.has(alias),'LIBRARY.ALIAS',`Ambiguous or reserved library alias: ${d.alias}`);
    // Every prelinked dependency must still be explicitly approved by the build host.
    for(const [id,version] of Object.entries(d.dependencies??{}))libraries.resolve(id,dependencies[id]===version?version:undefined);
    for(const dep of d.behavior.libraries??[]){
      check(dep.id!==d.id,'LIBRARY.CYCLE','Cyclic library dependency');
      libraries.resolve(dep.id,dependencies[dep.id]);
      check(dep.version===dependencies[dep.id],'LIBRARY.VERSION','Transitive dependency version mismatch');
    }
    aliases.set(alias,d);definitions.push(d);
    for(const name of Object.keys(d.behavior.procedures)){
      if((d.behavior.libraries??[]).some(lib=>Object.hasOwn(lib.methods,name)))continue;
      if((d.methodRules[name]?.access??'public')==='public')exports.set(name.toLowerCase(),[...(exports.get(name.toLowerCase())??[]),{definition:d,name}]);
    }
  }
  return {
    aliases,
    resolve:id=>libraries.resolve(id,dependencies[id]),
    lookup(target){
      if(target.kind==='name'){
        const candidates=exports.get(target.name.toLowerCase())??[];
        check(candidates.length<=1,'LIBRARY.AMBIGUOUS',`Ambiguous function: ${target.name}`);
        return candidates[0]??null;
      }
      if(target.kind!=='member'||target.target.kind!=='name'||!aliases.has(target.target.name.toLowerCase()))return null;
      const definition=aliases.get(target.target.name.toLowerCase());
      const name=Object.keys(definition.behavior.procedures).find(n=>n.toLowerCase()===target.key.toLowerCase()&&!definition.behavior.libraries.some(lib=>Object.hasOwn(lib.methods,n)));
      check(name,'LIBRARY.EXPORT',`Unknown export: ${definition.alias}.${target.key}`);
      check((definition.methodRules[name]?.access??'public')==='public','LIBRARY.PRIVATE',`Private export: ${definition.alias}.${target.key}`);
      return {definition,name};
    }
  };
}

// Portable linked procedures have no runtime resolver. Rewriting walks only the
// closed, validated SEWN representation and includes the referenced call closure.
export function createLinker(reserved=[],resolve=null) {
  let regex=false;
  const procedures=Object.create(null),libraries=new Map(),targets=new Map();
  const record=(id,version,alias)=>{
    if(libraries.has(id))check(libraries.get(id).version===version,'LIBRARY.VERSION','Conflicting linked versions');
    else libraries.set(id,{id,version,alias,methods:Object.create(null)});
    return libraries.get(id);
  };
  function link(definition,name,internal=false){
    if(definition.behavior.schema===REGEX_SCHEMA)regex=true;
    check(internal||(definition.methodRules[name]?.access??'public')==='public','LIBRARY.PRIVATE','Private static export');
    const imported=(definition.behavior.libraries??[]).find(lib=>Object.hasOwn(lib.methods,name));
    if(imported){const canonical=resolve(imported.id),method=imported.methods[name].name;check(canonical.version===imported.version,'LIBRARY.VERSION','Linked dependency version mismatch');check(Object.hasOwn(canonical.behavior.procedures,method)&&(canonical.methodRules[method]?.access??'public')==='public'&&!(canonical.behavior.libraries??[]).some(lib=>Object.hasOwn(lib.methods,method)),'LIBRARY.PRIVATE','Invalid transitive export');return link(canonical,method);}
    const key=definition.id+'@'+definition.version+':'+name;
    if(targets.has(key))return targets.get(key);
    let index=targets.size,target='lib'+index;while(reserved.includes(target)||Object.hasOwn(procedures,target)||[...targets.values()].includes(target))target='lib'+(++index);targets.set(key,target);
    const rule={name,access:definition.methodRules[name]?.access??'public',requires:definition.methodRules[name]?.requires??[]};
    record(definition.id,definition.version,definition.alias).methods[target]=clean(rule);
    const rewrite=v=>{
      if(Array.isArray(v))return v.map(rewrite);
      if(!v||typeof v!=='object')return v;
      const out=Object.fromEntries(Object.entries(v).map(([k,x])=>[k,rewrite(x)]));
      if(['functionCall','procedureCall'].includes(v.op))out.name=link(definition,v.name,true);
      return out;
    };
    procedures[target]=rewrite(definition.behavior.procedures[name]);
    return target;
  }
  return {link,finish(program){
    const occupied=new Set(Object.keys(program.procedures??{}));
    check(Object.keys(procedures).every(n=>!occupied.has(n)),'LIBRARY.NAME','Local procedure collides with linked procedure identity');
    return validate({...program,schema:regex||program.schema===REGEX_SCHEMA?REGEX_SCHEMA:STATIC_SCHEMA,procedures:{...program.procedures,...procedures},libraries:[...libraries.values()].sort((a,b)=>a.id.localeCompare(b.id))});
  }};
}
