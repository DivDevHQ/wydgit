// Closed, runtime-neutral contract metadata; identities belong to PrototypeRegistry.
import { clean, freeze, record, requireThat as check } from './validation.js';
import { contractTypes, MAXIMA, doReservedNames } from '../sewn/schema.js';
export const interfaceType = t => typeof t === 'string' && /^interface:[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(t);
export const interfaceKey = d => `interface:${d.id}@${d.version}`;
export function validateInterface(input) {
 const d=clean(input), allowed=['id','publisher','interface','alias','version','signatures'];
 check(record(d)&&Object.keys(d).every(k=>allowed.includes(k))&&d.interface===true,'INTERFACE.DEFINITION','Expected a declaration-only interface');
 check(typeof d.id==='string'&&/^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(d.id)&&d.publisher===d.id.split('/')[0]&&interfaceType(interfaceKey(d)),'INTERFACE.IDENTITY','Invalid exact interface identity');
 check(typeof d.alias==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.alias)&&!contractTypes.some(t=>t.toLowerCase()===d.alias.toLowerCase())&&!doReservedNames.includes(d.alias.toUpperCase())&&!['CAST','IMPLEMENTS','INTERFACE'].includes(d.alias.toUpperCase()),'INTERFACE.IDENTITY','Invalid interface alias');
 check(record(d.signatures)&&Object.keys(d.signatures).length>0&&Object.keys(d.signatures).length<=64,'INTERFACE.DEFINITION','Expected method signatures');
 for(const [name,s] of Object.entries(d.signatures)) {
  check(/^[a-z][a-z0-9_]{0,63}$/.test(name)&&!doReservedNames.includes(name.toUpperCase())&&record(s)&&['function','sub'].includes(s.kind)&&Object.keys(s).every(k=>['kind','params',...(s.kind==='function'?['returns']:[])].includes(k)),'INTERFACE.SIGNATURE','Invalid method signature');
  check(Array.isArray(s.params)&&s.params.length<=MAXIMA.parameters&&s.params.every(t=>contractTypes.includes(t))&&(s.kind!=='function'||contractTypes.includes(s.returns)),'INTERFACE.SIGNATURE','Unsupported method contract');
 }
 return freeze(d);
}
export function sameSignature(signature, procedure) {
 return signature.kind===procedure.kind&&signature.params.length===procedure.params.length&&signature.params.every((t,i)=>t===procedure.params[i].type)&&signature.returns===procedure.returns;
}

// Inspect only grammar-owned type positions, never application JSON fields.
export function interfaceTypes(program) {
 const found=new Set();
 const walk=n=>{if(!n||typeof n!=='object')return;
  if(['cast','implements','declare','set'].includes(n.op)&&interfaceType(n.type))found.add(n.type);
  if(['function','sub'].includes(n.kind)&&Array.isArray(n.params)){for(const p of n.params)if(interfaceType(p.type))found.add(p.type);if(interfaceType(n.returns))found.add(n.returns);}
  if(n.op==='literal')return;Object.values(n).forEach(walk);
 };walk(program);return found;
}
