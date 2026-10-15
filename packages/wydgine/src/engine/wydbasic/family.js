import { parseClass } from './parse.js';
import { parseDefinition } from './class.js';
import { lowerFamily } from '../definitions/family.js';
import { lowerDefinition } from '../definitions/index.js';
import { clean, record, requireThat as check, WydgitError } from '../object-model/validation.js';
import { LIMITS, resourcePath } from '../packages/manifest.js';

// Explicit source map supplied by the host. File labels are diagnostics, not paths
// to be read or executed. The complete result is staged before callers write it.
export function compileFamily(sources,options={}) {
  sources=clean(sources);
  check(record(sources),'WYDBASIC.FAMILY','Expected an explicit file-to-source map');
  const files=Object.keys(sources).sort();
  check(files.length>0&&files.length<=LIMITS.prototypes&&files.every(resourcePath),'WYDBASIC.FAMILY','Invalid source file inventory');
  const locate=(file,operation,location={line:1,column:1,offset:0})=>{try{return operation();}catch(error){if(error instanceof WydgitError)throw new WydgitError(error.code,`${file}: ${error.message}`,{...location,...error.details,file});throw error;}};
  const records=new Map();
  for(const file of files){
    check(typeof sources[file]==='string'&&Buffer.byteLength(sources[file])<=LIMITS.resource,'WYDBASIC.FAMILY','Invalid or oversized source');
    const ast=locate(file,()=>parseClass(sources[file])),metas=ast.metadata.filter(n=>n.name.toLowerCase()==='id');
    check(metas.length===1&&metas[0].value.kind==='literal'&&typeof metas[0].value.value==='string','WYDBASIC.METADATA',`${file}: Family classes require a literal META Id`);
    const id=metas[0].value.value;check(!records.has(id),'WYDBASIC.FAMILY',`${file}: Duplicate prototype identity`);records.set(id,{file,ast});
  }
  const definitions=[...(options.definitions??[])],irs=[],active=new Set(),done=new Set();
  const visit=id=>{
    if(done.has(id)||!records.has(id))return;
    const {file,ast}=records.get(id);check(!active.has(id),'WYDBASIC.CYCLE',`${file}: Family dependency cycle`);active.add(id);
    const dependencies=[ast.parent,...ast.implementations.map(n=>n.id),...ast.children.map(n=>n.prototype),...ast.templates.flatMap(n=>[n.type,n.model]).filter(type=>type!==id),...ast.slotContracts.flatMap(n=>n.accepts.kind==='array'?n.accepts.items.filter(v=>v.kind==='literal'&&typeof v.value==='string').map(v=>v.value).filter(type=>type!==id):[])].filter(Boolean).sort();
    for(const dependency of dependencies)visit(dependency);
    const verifiedPrototypes={...options.registryOptions?.verifiedPrototypes,...Object.fromEntries(irs.map(ir=>[ir.definition.id,ir.definition.publisher]))};
    const ir=locate(file,()=>parseDefinition(sources[file],{...options,definitions,registryOptions:{...options.registryOptions,verifiedPrototypes}}));
    // Validate each class before making it a dependency for the next class.
    locate(file,()=>lowerDefinition(ir,{...options,definitions,registryOptions:{...options.registryOptions,verifiedPrototypes}}),ast.location);
    irs.push(ir);definitions.push(ir.definition);active.delete(id);done.add(id);
  };
  for(const id of [...records.keys()].sort())visit(id);
  return lowerFamily(clean(irs),options);
}
