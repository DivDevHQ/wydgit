import { parseClass } from './parse.js';
import { compileAst } from './compile.js';
import { fail } from './errors.js';
import { lowerDefinition } from '../definitions/index.js';
import { lifecycleHooks } from '../object-model/class-contracts.js';
import { PrototypeRegistry } from '../object-model/prototypes.js';
import { clean, freeze } from '../object-model/validation.js';
import { interfaceType } from '../object-model/interfaces.js';
import { contractTypes, safeKey } from '../sewn/schema.js';
import { resolveMember } from '../object-model/members.js';
const types={string:'string',number:'number',boolean:'boolean',object:'object',array:'array',null:'null'};
const canonicalType=t=>({string:'String',number:'Number',integer:'Integer',float:'Float',boolean:'Boolean',object:'Object',array:'Array',null:'Null'})[t.toLowerCase()];
const error=(n,code,message)=>fail(code,message,n.location);
function literal(n) {
  if(n.kind==='literal')return n.value;
  if(n.kind==='unary'&&['-','+'].includes(n.operator)&&n.value.kind==='literal'&&typeof n.value.value==='number')return n.operator==='-'?-n.value.value:n.value.value;
  if(n.kind==='array')return n.items.map(literal);
  if(n.kind==='object'){const result=Object.create(null);for(const f of n.fields){if(!safeKey(f.key.toLowerCase())||Object.hasOwn(result,f.key))error(f,'NAME','Reserved or duplicate default key.');result[f.key]=literal(f.value);}return result;}
  error(n,'TYPE','Metadata and property defaults require deterministic JSON literals.');
}
function modifiers(n,allowed) {
  if(n.modifiers.some(m=>!allowed.includes(m)))error(n,'SYNTAX','Unsupported declaration modifier.');
  const access=n.modifiers.filter(m=>['public','private','protected','friend'].includes(m));
  if(access.length>1)error(n,'SYNTAX','Choose one access modifier.');
  return access[0]??'public';
}
export function parseDefinition(source,options={}) {
  if(options.static===true)fail('UNSUPPORTED','Static libraries retain the existing compilePrototype API.');
  const ast=parseClass(source),access=modifiers(ast,['public','private','mustinherit']);
  if(ast.name.toLowerCase()==='wydgit')error(ast,'NAME','Wydgit is the reserved abstract platform contract.');
  const metadata=Object.create(null);
  for(const n of ast.metadata){modifiers(n,[]);const name=n.name.toLowerCase();if(!['id','publisher','version'].includes(name)||Object.hasOwn(metadata,name))error(n,'METADATA','Unsupported or duplicate META field.');metadata[name]=literal(n.value);}
  const id=metadata.id??options.id,publisher=options.manifest?.publisher;
  if(typeof id!=='string'||!id.startsWith(publisher+'/'))error(ast,'METADATA','META Id (or build id) must identify a prototype in the manifest publisher namespace.');
  if(options.id!==undefined&&options.id!==id)error(ast,'METADATA','Source and build prototype IDs disagree.');
  const definitions=options.definitions??[],registry=new PrototypeRegistry(definitions,options.registryOptions);
  const parent=ast.parent?.toLowerCase()==='wydgit'?null:ast.parent;
  let base;if(parent)base=registry.get(parent);
  const d={id,publisher,public:access==='public',abstract:ast.modifiers.includes('mustinherit'),...(parent?{extends:parent}:{}),properties:Object.create(null),slots:{},methodRules:Object.create(null),methodContracts:Object.create(null),overrides:[],implements:Object.create(null),events:Object.create(null),lifecycle:Object.create(null)};
  const names=new Set();
  const reserve=n=>{const name=n.name.toLowerCase();if(!safeKey(name)||names.has(name))error(n,'NAME','Reserved or colliding class member.');names.add(name);};
  for(const n of ast.properties){reserve(n);if(['id','publisher','version',...lifecycleHooks.map(h=>h.toLowerCase())].includes(n.name.toLowerCase()))error(n,'NAME','Reserved platform identity or lifecycle property.');const access=modifiers(n,['public','private','protected','friend','required','hidden']),type=types[n.type.toLowerCase()];if(!type)error(n,'TYPE','Property type must be String, Number, Boolean, Object, Array or Null; stronger language-only contracts cannot be persisted.');
    const rule={type,access,...(n.modifiers.includes('required')?{required:true}:{}),...(n.modifiers.includes('hidden')?{hidden:true}:{})};
    if(n.value){const value=literal(n.value),actual=value===null?'null':Array.isArray(value)?'array':typeof value;if(actual!==type)error(n,'TYPE','Property default does not match its canonical JSON type.');rule.default=value;}
    if(n.enumeration){const values=literal(n.enumeration);if(!['string','number','boolean','null'].includes(type)||!Array.isArray(values)||!values.length||values.some(v=>(v===null?'null':Array.isArray(v)?'array':typeof v)!==type)||Object.hasOwn(rule,'default')&&!values.includes(rule.default))error(n,'TYPE','ENUM requires matching literal values and a permitted default.');rule.enum=values;}
    if(n.requires)rule.requires=literal(n.requires);
    d.properties[n.name]=rule;
  }
  const propertyTable={...base?.properties,...d.properties};
  if(ast.presentation){
    if(options.manifest?.runtime?.includes('client'))error(ast.presentation,'TARGET','PRESENTATION SERVER requires a server-only package; H2 cannot execute presentation bindings.');
    const binding=(n,locals=new Map())=>{
      if(n.kind==='literal'&&['string','number','boolean'].includes(typeof n.value))return {value:n.value,type:typeof n.value};
      if(n.kind==='name'&&locals.has(n.name.toLowerCase()))return {value:{get:n.name.toLowerCase()},type:locals.get(n.name.toLowerCase())};
      if(n.kind==='member'&&n.target.kind==='name'&&n.target.name.toLowerCase()==='me'){
        let member;try{member=resolveMember({properties:propertyTable,propertyOwners:{}},'property',n.key,n.exact===true);}catch{error(n,'NAME','Unknown or ambiguous presentation property.');}
        if((member.rule.access??'public')!=='public'||member.rule.hidden||member.rule.requires?.length)error(n,'ACCESS','Presentation requires a public discoverable property without capability requirements.');
        return {value:{get:`properties.${member.name}`},type:member.rule.type};
      }
      if(n.kind==='array'){const values=n.items.map(v=>binding(v,locals));return {value:values.map(v=>v.value),type:'array',element:values.length&&values.every(v=>v.type===values[0].type)?values[0].type:null};}
      error(n,'TYPE','Presentation accepts scalar literals, typed Me properties and scalar repeat items; executable expressions are unsupported.');
    };
    const parts=(nodes,locals=new Map(),depth=0)=>{if(depth>16)error(ast.presentation,'LIMIT','Presentation repetition nesting exceeds 16.');return nodes.map(n=>{
      if(n.kind==='presentationText'){const b=binding(n.value,locals);if(!['string','number','boolean'].includes(b.type))error(n,'TYPE','CONTENT and HEADING require String, Number or Boolean.');return {tag:n.role==='HEADING'?'h2':'p',text:b.value};}
      const source=binding(n.value,locals),limit=literal(n.limit),name=n.name.toLowerCase();
      if(limit!==256)error(n,'LIMIT','Server presentation uses the canonical 256-item bound; specify LIMIT 256.');
      if(source.type!=='array'||!source.element||!['string','number','boolean'].includes(source.element))error(n,'TYPE','REPEAT currently requires a homogeneous scalar literal array; persisted Array properties lack element contracts.');
      if(source.value.length>limit)error(n,'LIMIT','Repeated data exceeds its declared bound.');
      if(locals.has(name)||['properties','data','query','id','path','csrf','transfer','constructor','prototype','__proto__'].includes(name)||!/^[a-z][a-z0-9_-]{0,31}$/.test(name))error(n,'NAME','Reserved or duplicate repeat context.');
      return {tag:'div',each:{in:source.value,as:name},children:parts(n.body,new Map([...locals,[name,source.element]]),depth+1)};
    });};
    d.presentation={schema:'wydgit.presentation/0.1',template:{tag:'section',children:parts(ast.presentation.parts)}};
  }
  const composition=ast.children.map(n=>{reserve(n);const properties=Object.create(null);for(const p of n.initializers){if(Object.hasOwn(properties,p.name))error(p,'NAME','Duplicate child initializer.');properties[p.name]=literal(p.value);}return {name:n.name,type:n.prototype,slot:n.slot,properties};});
  for(const n of ast.contracts){reserve(n);const access=modifiers(n,['public','private','protected','friend']);d.events[n.name]={access,params:n.params.map(p=>{const type=canonicalType(p.type);if(!type)error(p,'TYPE','Event payload requires a portable data type.');return {name:p.name,type};})};}
  for(const n of ast.implementations){modifiers(n,[]);const version=options.manifest?.interfaces?.[n.id];if(!version||Object.hasOwn(d.implements,n.id))error(n,'TYPE','IMPLEMENTS requires a unique exact manifest interface dependency.');d.implements[n.id]=version;}
  const resolveType=t=>{const builtin=contractTypes.find(v=>v.toLowerCase()===t.toLowerCase());if(builtin)return builtin;if(interfaceType(t)){registry.interface(t);return t;}const contract=registry.resolveInterface(t,options.manifest?.interfaces);return `interface:${contract.id}@${contract.version}`;};
  const methods=[],hooks=[];
  for(const n of ast.procedures){reserve(n);if(new Set(n.params.map(p=>p.name.toLowerCase())).size!==n.params.length)error(n,'NAME','Duplicate method parameter.');const access=modifiers(n,['public','private','protected','friend','virtual','override','mustoverride','hidden']);
    if(n.modifiers.filter(m=>['virtual','override','mustoverride'].includes(m)).length>1)error(n,'SYNTAX','Choose one method dispatch modifier.');
    const hook=lifecycleHooks.find(h=>h.toLowerCase()===n.name.toLowerCase());
    if(hook){if(n.requires||n.modifiers.includes('hidden'))error(n,'TYPE','Lifecycle hook annotations are not ordinary method rules.');if(access!=='protected'||!n.modifiers.includes('override')||n.procedureKind!=='sub'||n.params.length)error(n,'TYPE','Lifecycle declarations require PROTECTED OVERRIDE SUB Hook().');hooks.push([hook,n]);continue;}
    const name=n.name.toLowerCase(),old=base?.methods[name]||base?.methodContracts?.[name];
    if(Boolean(old)!==n.modifiers.includes('override'))error(n,'TYPE','Inherited methods require OVERRIDE; new methods cannot use it.');
    if(n.modifiers.includes('override'))d.overrides.push(name);
    const abs=n.modifiers.includes('mustoverride');
    const signature={kind:n.procedureKind,params:n.params.map(p=>resolveType(p.type)),...(n.returns?{returns:resolveType(n.returns)}:{}),access,abstract:abs,virtual:abs||n.modifiers.includes('virtual')||n.modifiers.includes('override')};
    if(n.requires)signature.requires=literal(n.requires);if(n.modifiers.includes('hidden'))signature.hidden=true;
    d.methodContracts[name]=signature;
    if(!abs){methods.push(n);d.methodRules[name]={access,...(signature.requires?{requires:signature.requires}:{}),...(signature.hidden?{hidden:true}:{})};}
    else if(!d.abstract)error(n,'TYPE','MUSTOVERRIDE requires a MUSTINHERIT class.');
  }
  // Class bodies deliberately reject the old dynamic string event facade.
  // Typed emission needs a host-bound declaration identity and shared execution budget.
  const inspect=n=>{if(!n||typeof n!=='object')return;if(n.kind==='invoke'&&n.target.kind==='member'&&n.target.target.kind==='name'&&n.target.target.name.toLowerCase()==='event'&&n.target.key.toLowerCase()==='raise')error(n,'UNSUPPORTED','Class event emission cannot use the string EVENT.Raise facade.');Object.values(n).forEach(inspect);};
  ast.procedures.forEach(inspect);
  if(ast.events.length)error(ast.events[0],'UNSUPPORTED','Class EVENT declarations are signatures, not workflow handlers.');
  const compileOptions={...options,prototypeRegistry:registry,dependencies:{...options.manifest?.staticLibraries,...options.manifest?.interfaces},classDefinition:{id,publisher,verifiedPublisher:options.verifiedPackages?.[options.manifest?.id]===publisher,events:{...base?.events,...d.events},properties:propertyTable,propertyOwners:{...base?.propertyOwners,...Object.fromEntries(Object.keys(d.properties).map(n=>[n,base?.propertyOwners[n]??id]))},methods:{...base?.methods,...Object.fromEntries(Object.entries(d.methodContracts).map(([name,s])=>[name,{owner:id,signature:s}]))},methodRules:{...base?.methodRules,...d.methodRules}}};
  const module=procedures=>({kind:'module',location:ast.location,procedures,events:[],imports:ast.imports});
  d.behavior=compileAst(module(methods),null,true,compileOptions);
  for(const [hook,n] of hooks)d.lifecycle[hook]=compileAst(module([n]),null,true,compileOptions);
  return freeze(clean({schema:composition.length||ast.presentation?'wydgit.definition/0.20':'wydgit.definition/0.19',definition:d,metadata,...(composition.length?{composition}:{}),locations:{declaration:ast.location,members:Object.fromEntries([...ast.properties,...ast.procedures,...ast.contracts,...ast.children].map(n=>[n.name,n.location])),metadata:Object.fromEntries(ast.metadata.map(n=>[n.name,n.location]))}}));
}
export function compileClass(source,options={}) {const ir=parseDefinition(source,options);try{return lowerDefinition(ir,options);}catch(e){fail('DEFINITION',e.message,ir.locations.declaration);}}
