import { clean, freeze, record, parse, requireThat as check } from '../object-model/validation.js';
import { fields, version, range, satisfies, validateRequirements } from '../libraries/contracts.js';
import { validObjectGrant, matchesObjectGrant, objectGrantCovers } from '../seam/context.js';
import { isCapability } from '../seam/capabilities.js';
import platform from '../../package.json' with { type: 'json' };
export const LIMITS = Object.freeze({packages:1024,manifest:32768,resource:65536,resources:16,prototypes:64,bindings:64,storage:16,permissions:128,templateNodes:256,templateDepth:32,state:4*1024*1024});
const code='PACKAGE.MANIFEST';
export const qualified = x => typeof x==='string' && x.length<=128 && /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(x);
export const localName = x => typeof x==='string' && /^[a-z][a-z0-9-]{0,63}$/.test(x);
export const resourcePath = x => typeof x==='string' && x.length<=128 && x.split('/').every(part=>/^[a-zA-Z0-9][a-zA-Z0-9_-]*(?:\.[a-zA-Z0-9_-]+)?$/.test(part));
export function list(items,max,predicate,where=code) {
  check(Array.isArray(items)&&items.length<=max&&items.every(predicate)&&new Set(items).size===items.length,where,'Invalid or duplicate declaration');
}
export function permissions(input) {
  const p=clean(input);fields(p,['capabilities','traversal','visible','editable','scopes'],code);
  list(p.capabilities,LIMITS.permissions,isCapability);list(p.traversal,5,x=>['children','parent','root','previousSibling','nextSibling'].includes(x));
  for(const key of ['visible','editable'])list(p[key],LIMITS.templateNodes,x=>validObjectGrant(x)&&x.length<=128);
  check(record(p.scopes),code,'Invalid scopes');
  fields(p.scopes,['wydstore',...(Object.hasOwn(p.scopes,'prototypes')?['prototypes']:[])],code);list(p.scopes.wydstore,LIMITS.storage,localName);
  if(p.scopes.prototypes!==undefined)list(p.scopes.prototypes,LIMITS.prototypes,qualified);
  check(p.editable.every(grant=>objectGrantCovers(p.visible,grant)),code,'Editable objects must be visible');
  return p;
}
export function validatePackageManifest(input) {
  const text=typeof input==='string'?input:JSON.stringify(clean(input));check(Buffer.byteLength(text)<=LIMITS.manifest,code,'Manifest too large');
  const m=clean(parse(text));fields(m,['schema','id','publisher','version','platform','runtime','resources','requires','storage','permissions','bindings','installables'],code);
  check(m.schema==='wydgit-package/0.1',code,'Unsupported package schema');
  check(qualified(m.id)&&m.publisher===m.id.split('/')[0]&&m.publisher!=='wydgit.core',code,'Invalid package/publisher identity');
  check(version(m.version)&&range(m.platform),code,'Invalid version');check(satisfies(platform.version,m.platform),'PACKAGE.VERSION','Incompatible platform');
  list(m.runtime,2,x=>['server','client'].includes(x));check(m.runtime.includes('server'),code,'Server runtime required');
  check(record(m.resources)&&Object.keys(m.resources).length<=LIMITS.resources,code,'Invalid resources');
  fields(m.resources,['prototypes','template','sources'],code);check(resourcePath(m.resources.prototypes)&&resourcePath(m.resources.template)&&record(m.resources.sources),code,'Invalid resource path');
  check(Object.keys(m.resources.sources).every(localName),code,'Invalid source identity');
  const paths=[m.resources.prototypes,m.resources.template,...Object.values(m.resources.sources)];list(paths,LIMITS.resources,resourcePath);check(paths.every(p=>!p.endsWith('.js')&&!p.endsWith('.mjs')&&!p.endsWith('.cjs')),code,'Package JavaScript is forbidden');
  m.requires=validateRequirements(m.requires);check(m.requires.libraries.length<=16,code,'Too many libraries');
  check(Array.isArray(m.storage)&&m.storage.length<=LIMITS.storage,code,'Invalid storage');
  const names=new Set();for(const s of m.storage){fields(s,['name','fields'],code);check(localName(s.name)&&!names.has(s.name)&&record(s.fields)&&Object.keys(s.fields).length<=64,code,'Invalid storage schema');names.add(s.name);
    for(const [name,rule] of Object.entries(s.fields)){check(localName(name)&&name!=='id',code,'Invalid storage field');fields(rule,['type',...['required','default'].filter(k=>Object.hasOwn(rule,k))],code);check(['string','number','boolean','object','array','null'].includes(rule.type)&&(rule.required===undefined||typeof rule.required==='boolean'),code,'Invalid storage type');if(Object.hasOwn(rule,'default')){const type=rule.default===null?'null':Array.isArray(rule.default)?'array':typeof rule.default;check(type===rule.type,code,'Invalid storage default');}}
  }
  m.permissions=permissions(m.permissions);check(m.permissions.scopes.wydstore.every(n=>names.has(n)),code,'Undeclared storage scope');
  check(Array.isArray(m.bindings)&&m.bindings.length<=LIMITS.bindings,code,'Invalid bindings');const bindings=new Set();
  for(const b of m.bindings){fields(b,['owner','event','source','kind',...(b.kind==='action'?['method','capability']:[])],code);check(typeof b.owner==='string'&&matchesObjectGrant(m.permissions.visible,b.owner)&&typeof b.event==='string'&&Object.hasOwn(m.resources.sources,b.source)&&['handler','action'].includes(b.kind),code,'Invalid binding');check(b.kind!=='action'||b.method==='POST'&&m.permissions.capabilities.includes(b.capability),code,'Invalid action');const key=b.owner+':'+b.event;check(!bindings.has(key),code,'Duplicate binding');bindings.add(key);}
  check(Array.isArray(m.installables)&&m.installables.length===1,code,'Exactly one installable supported');fields(m.installables[0],['id','kind'],code);check(localName(m.installables[0].id)&&m.installables[0].kind==='section-template',code,'Invalid installable');
  return freeze(m);
}
