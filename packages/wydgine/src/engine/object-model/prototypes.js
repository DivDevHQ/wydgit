import {restrictExecution, checkPlacement} from '../execution/placement.js';
import {validateControlBindings} from '../controls.js';
import {componentContract,validateComponent} from './component-contracts.js';
import { classContracts } from './class-contracts.js';
import {validateInterface,interfaceKey,sameSignature,interfaceTypes} from './interfaces.js';
import { isCapability } from '../seam/capabilities.js';
import { accessOf, validateMember, resolveMember, authorizeMember } from './members.js';
import { validatePresentation } from '../presentation-contract.js';
import { validate } from '../sewn/validate.js';
import { methods as facadeMethods } from '../sewn/bindings.js';
import { clean, freeze, record, requireThat as check } from './validation.js';
const identity = /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/;
export class PrototypeRegistry {
  #definitions = new Map();
  #verified = new Map();
  #interfaces = new Map();
  constructor(definitions, { officialPublishers = ['wydgit.core'], verifiedPrototypes = {}, caseCollisionCompatibility = {} } = {}) {
    for(const [id,publisher] of Object.entries(verifiedPrototypes)){check(identity.test(id)&&id.split('/')[0]===publisher,'PROTOTYPE.PUBLISHER','Invalid trusted publisher binding');this.#verified.set(id,publisher);}
    const raw = new Map();
    for (const input of definitions) {
      const d = clean(input);
      check(identity.test(d.id) && d.publisher === d.id.split('/')[0], 'PROTOTYPE.IDENTITY', 'Invalid prototype identity or publisher');
      check(!raw.has(d.id), 'PROTOTYPE.DUPLICATE', 'Duplicate prototype'); raw.set(d.id, d);
    }
    for(const [id,d] of raw)if(d.interface===true){const contract=validateInterface(d);check(this.#verified.get(id)===d.publisher,'INTERFACE.PUBLISHER','Interface requires verified publisher ownership');this.#interfaces.set(interfaceKey(contract),contract);}
    check(this.#interfaces.size<=64,'INTERFACE.LIMIT','Interface catalog limit');
    const visiting = new Set();
    const resolve = id => {
      if (this.#definitions.has(id)) return this.#definitions.get(id);
      const d = raw.get(id);
      check(d, 'PROTOTYPE.UNKNOWN', `Unknown prototype: ${id}`);
      check(!visiting.has(id), 'PROTOTYPE.CYCLE', 'Inheritance cycle'); visiting.add(id);
      if(d.interface===true){const result=freeze({...this.#interfaces.get(interfaceKey(d)),abstract:true,properties:{},slots:{},methods:{},methodRules:{},ancestors:[]});visiting.delete(id);this.#definitions.set(id,result);return result;}
      check(d.interface===undefined,'INTERFACE.DEFINITION','Invalid interface flag');
      let base;
      if (d.extends !== undefined) {
        check(typeof d.extends === 'string', 'PROTOTYPE.INHERITANCE', 'Single inheritance requires one prototype ID');
        base = resolve(d.extends);
        check(!base.interface,'INTERFACE.DEFINITION','Concrete prototypes cannot inherit interfaces');
        check(base.publisher === d.publisher || (officialPublishers.includes(base.publisher) && base.public === true), 'PROTOTYPE.PUBLISHER', 'Cross-publisher inheritance denied');
      }
      const execution = restrictExecution(d.execution, base?.execution);
      check(d.static===undefined||typeof d.static==='boolean','PROTOTYPE.STATIC','Invalid static flag');
      if(d.static){check(Object.keys(d).every(k=>['id','publisher','public','abstract','static','alias','version','dependencies','properties','slots','methodRules','behavior'].includes(k)),'PROTOTYPE.STATIC','Unsupported static prototype metadata');check(record(d.dependencies??{})&&Object.entries(d.dependencies??{}).every(([id,v])=>identity.test(id)&&typeof v==='string'),'PROTOTYPE.STATIC','Invalid static dependencies');check(d.extends===undefined&&!d.abstract&&!d.friends?.length&&!d.overrides?.length&&!d.presentation&&!d.actions&&Object.keys(d.properties??{}).length===0&&Object.keys(d.slots??{}).length===0,'PROTOTYPE.STATIC','Dedicated static prototypes cannot contain instance state or inheritance');check(typeof d.alias==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.alias)&&typeof d.version==='string'&&/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(d.version),'PROTOTYPE.STATIC','Static prototypes need an alias and exact version');}
      else check(!base?.static&&d.alias===undefined&&d.version===undefined,'PROTOTYPE.STATIC','Static metadata requires a dedicated static prototype');
      check(d.abstract === undefined || typeof d.abstract === 'boolean', 'PROTOTYPE.DEFINITION', 'Invalid abstract flag');
      check(d.public === undefined || typeof d.public === 'boolean', 'PROTOTYPE.DEFINITION', 'Invalid public flag');
      check(record(d.properties ?? {}) && record(d.slots ?? {}), 'PROTOTYPE.DEFINITION', 'Invalid definitions');
      const friends=d.friends??[];
      check(Array.isArray(friends)&&new Set(friends).size===friends.length&&friends.every(x=>typeof x==='string'&&(identity.test(x)||/^[a-z][a-z0-9.-]*\/\*$/.test(x))&&x.split('/')[0]===d.publisher),'PROTOTYPE.FRIEND','Invalid or cross-publisher friendship');
      if(friends.length)check(this.#verified.get(id)===d.publisher,'PROTOTYPE.FRIEND','Friend grants require a verified publisher binding');
      const methodRules={...base?.methodRules};
      check(record(d.methodRules??{})&&Object.keys(d.methodRules??{}).every(name=>Object.hasOwn(d.behavior?.procedures??{},name)),'PROTOTYPE.METHOD','Method rules require locally declared methods');
      const inheritedMethods=base?.methods??{}, methods={...inheritedMethods};
      check(d.overrides===undefined||Array.isArray(d.overrides)&&d.overrides.every(x=>typeof x==='string'),'PROTOTYPE.METHOD','Invalid override declarations');
      let behavior=null;if(d.behavior!==undefined){try{behavior=validate(d.behavior);}catch{check(false,'PROTOTYPE.METHOD','Invalid portable method behavior');}}
      check(d.methods===undefined&&d.behaviorSource===undefined,'PROTOTYPE.METHOD','Behavior must be compiled by trusted setup');
      check(new Set(d.overrides??[]).size===(d.overrides??[]).length,'PROTOTYPE.METHOD','Duplicate overrides');
      check(!behavior||['sewn/0.3','sewn/0.4','sewn/0.5','sewn/0.6','sewn/0.7','sewn/0.8','sewn/0.9','sewn/0.10','sewn/0.11','sewn/0.12','sewn/0.13','sewn/0.14','sewn/0.15','sewn/0.16','sewn/0.17','sewn/0.18'].includes(behavior.schema)&&behavior.body.length===0,'PROTOTYPE.METHOD','Expected portable prototype behavior');
      const linkedNames=new Set(behavior?.libraries?.flatMap(lib=>Object.keys(lib.methods))??[]);
      for(const [name,proc] of Object.entries(behavior?.procedures??{})){
        if(linkedNames.has(name)){check(!d.methodRules?.[name]&&!(d.overrides??[]).includes(name),'PROTOTYPE.STATIC','Linked procedures are not instance methods');continue;}
        check(!Object.keys(facadeMethods.handle).some(x=>x.toLowerCase()===name.toLowerCase()),'PROTOTYPE.METHOD','Method conflicts with kernel facade');
        const old=inheritedMethods[name];
        check(Boolean(old||base?.methodContracts?.[name])===(d.overrides??[]).includes(name),'PROTOTYPE.METHOD','Inherited methods require explicit overrides');
        if(old){check(accessOf(base.methodRules[name])!=='private','PROTOTYPE.ACCESS','Private methods cannot be overridden');const previous=old.behavior.procedures[name];check(previous.kind===proc.kind&&previous.params.length===proc.params.length&&previous.params.every((x,i)=>x.type===proc.params[i].type)&&previous.returns===proc.returns,'PROTOTYPE.METHOD','Incompatible override signature');}
        const rule=d.methodRules?.[name]??{};validateMember(rule);if(d.static)check(['public','private'].includes(accessOf(rule))&&!rule.hidden,'PROTOTYPE.STATIC','Static methods support public/private visibility');
        if(old)check(accessOf(rule)===accessOf(base.methodRules[name])&&(base.methodRules[name].requires??[]).every(cap=>(rule.requires??[]).includes(cap))&&(!base.methodRules[name].hidden||rule.hidden===true),'PROTOTYPE.ACCESS','Override cannot change inherited access or expose hidden members');
        methodRules[name]=rule;methods[name]={owner:id,behavior};
      }
      check((d.overrides??[]).every(name=>Object.hasOwn(behavior?.procedures??{},name)),'PROTOTYPE.METHOD','Override must declare a method');
      const properties = { ...base?.properties, ...d.properties }, slots = { ...base?.slots, ...d.slots };
      const propertyOwners={...base?.propertyOwners};
      for(const [name,rule] of Object.entries(d.properties??{})){
        validateMember(rule);const old=base?.properties[name];
        if(old)check(accessOf(old)!=='private'&&(JSON.stringify(rule.type)===JSON.stringify(old.type)||name==='value'&&['wydgit.core/checkbox','wydgit.core/radio-group','wydgit.core/checkbox-group','wydgit.core/select'].includes(id))&&accessOf(rule)===accessOf(old)&&(old.requires??[]).every(cap=>(rule.requires??[]).includes(cap))&&(!old.required||rule.required===true||Object.hasOwn(rule,'default'))&&(!old.hidden||rule.hidden===true)&&(!old.enum||rule.enum&&rule.enum.every(v=>old.enum.includes(v))),'PROTOTYPE.ACCESS','Incompatible property override');
        // Exact schema overrides retain the inherited property's declaring slot.
        propertyOwners[name]=old?base.propertyOwners[name]:id;
      }
      const names=[...Object.keys(properties),...Object.keys(methods)],groups=new Map();for(const name of names){const key=name.toLowerCase();groups.set(key,[...(groups.get(key)??[]),name]);}
      for(const group of groups.values())if(group.length>1){const allowed=caseCollisionCompatibility[id];check(Array.isArray(allowed)&&new Set(group).size===group.length&&group.every(name=>allowed.includes(name)),'PROTOTYPE.CASE_COLLISION','Case-equivalent member declarations denied');}
      for (const rule of Object.values(properties)) {
        validateMember(rule);
        check(record(rule) && (!Array.isArray(rule.type)||rule.type.length>0)&& (Array.isArray(rule.type)?rule.type:[rule.type]).every(type=>['string','number','boolean','object','array','null'].includes(type)), 'PROTOTYPE.DEFINITION', 'Invalid property rule');
        check(rule.enum === undefined || Array.isArray(rule.enum), 'PROTOTYPE.DEFINITION', 'Invalid enum');
      }
      for (const rule of Object.values(slots)) {
        check(record(rule) && Array.isArray(rule.accepts) && rule.accepts.length > 0 && rule.accepts.every(x => typeof x === 'string'), 'PROTOTYPE.SLOT', 'Slot needs accepted prototypes');
        check(rule.ordered === true && Number.isInteger(rule.min ?? 0) && (rule.min ?? 0) >= 0 && (rule.max === undefined || (Number.isInteger(rule.max) && rule.max >= (rule.min ?? 0))), 'PROTOTYPE.SLOT', 'Invalid ordered slot cardinality');
      }
      const actions={...base?.actions};
      check(record(d.actions??{})&&Object.keys(d.actions??{}).every(name=>name==='Submit'),'PROTOTYPE.ACTION','Only Submit delegation is supported');
      for(const [name,rule] of Object.entries(d.actions??{})){
        check(record(rule)&&Object.keys(rule).length===1&&isCapability(rule.capability),'PROTOTYPE.ACTION','Invalid action declaration');
        check(!actions[name]||actions[name].capability===rule.capability,'PROTOTYPE.ACTION','Inherited action capability cannot change');
        check(d.id==='wydgit.core/form'||base&&(base.id==='wydgit.core/form'||base.ancestors.includes('wydgit.core/form')),'PROTOTYPE.ACTION','Submit delegation requires Form');
        actions[name]=rule;
      }
      const presentation=d.presentation===undefined?base?.presentation:validatePresentation(d.presentation);
      check(record(d.implements??{})&&Object.keys(d.implements??{}).length<=16&&(!d.static||d.implements===undefined),'INTERFACE.IMPLEMENTATION','Invalid implementation metadata');
      if(Object.keys(d.implements??{}).length)check(this.#verified.get(id)===d.publisher,'INTERFACE.PUBLISHER','Implementation requires verified publisher ownership');
      const implementations={...base?.implements,...d.implements};
      if(Object.keys(implementations).length)check(this.#verified.get(id)===d.publisher,'INTERFACE.PUBLISHER','Inherited implementation requires verified publisher ownership');
      for(const [contractId,version] of Object.entries(implementations)){
        const contract=this.interface(`interface:${contractId}@${version}`);
        for(const [name,signature] of Object.entries(contract.signatures)){
          const member=resolveMember({methods,methodRules},'method',name,false),method=methods[member.name];
          check(accessOf(member.rule)==='public'&&!member.rule.hidden&&sameSignature(signature,method.behavior.procedures[member.name]),'INTERFACE.CONFORMANCE','Required public instance signature does not match');
        }
      }
      const declarations=classContracts(d,base,methods,properties);const component=componentContract(d,base);
      const result = freeze({ ...d, ...(execution?{execution}:{}), ...declarations, ...(component?{component}:{}), implements:implementations, ...(presentation?{presentation}:{}), abstract: d.abstract ?? false, properties, propertyOwners, slots, methods, methodRules, friends, actions, ancestors: base ? [base.id, ...base.ancestors] : [] });
      visiting.delete(id); this.#definitions.set(id, result); return result;
    };
    for (const id of raw.keys()) resolve(id);
    for (const d of this.#definitions.values()) for (const slot of Object.values(d.slots)) for (const id of slot.accepts) this.get(id);
    // Default composition must be finite even for manually authored canonical JSON.
    const composing=new Set(),composed=new Set();
    const visitComposition=id=>{check(!composing.has(id),'PROTOTYPE.COMPONENT','Cyclic default composition');if(composed.has(id))return;composing.add(id);for(const child of this.get(id).component?.children??[])visitComposition(child.type);composing.delete(id);composed.add(id);};
    for(const id of this.#definitions.keys())visitComposition(id);
    // Resolve statically known Me calls through each actual prototype, including overrides.
    for(const d of this.#definitions.values()){
      if(d.interface)continue;validateControlBindings(d,this);validateComponent(d,this);if(d.extends&&raw.get(d.id).methodContracts!==undefined){const base=this.get(d.extends);for(const [name,slot] of Object.entries(raw.get(d.id).slots??{})){const old=base.slots[name];if(old)check((slot.min??0)>=(old.min??0)&&(old.max===undefined||slot.max!==undefined&&slot.max<=old.max)&&slot.accepts.every(id=>old.accepts.some(parent=>this.isA(id,parent))),'PROTOTYPE.SLOT','A class cannot weaken inherited slot contracts');}}
      for(const s of Object.values(d.methodContracts??{}))for(const type of [...s.params,s.returns])if(typeof type==='string'&&type.startsWith('interface:'))this.interface(type);
      if(d.behavior)for(const type of interfaceTypes(d.behavior))this.interface(type);
      if(d.static){check(['sewn/0.14','sewn/0.15','sewn/0.16','sewn/0.17','sewn/0.18'].includes(d.behavior?.schema),'PROTOTYPE.STATIC','Static behavior requires sewn/0.14, sewn/0.15 or sewn/0.16');const walk=v=>{if(!v||typeof v!=='object')return;check(!(v.op==='context'&&v.name==='ME'),'PROTOTYPE.STATIC','Static methods have no Me');Object.values(v).forEach(walk);};walk(d.behavior);for(const lib of d.behavior.libraries??[])check(d.dependencies?.[lib.id]===lib.version&&lib.id!==d.id,'PROTOTYPE.STATIC','Linked dependency must be declared');continue;}
      const graph=new Map();
      const walk=(v,edges,behavior)=>{if(!v||typeof v!=='object')return;
        if(['procedureCall','functionCall'].includes(v.op))edges.add(behavior+':'+v.name);
        if(['methodCall','methodValue'].includes(v.op)&&v.target.op==='context'&&v.target.name==='ME'){const abstractName=Object.keys(d.methodContracts??{}).find(n=>(v.exact?n===v.name:n.toLowerCase()===v.name.toLowerCase())&&d.methodContracts[n].abstract);if(d.abstract&&abstractName)return;const lookup=resolveMember(d,'method',v.name,v.exact??false),m=d.methods[lookup.name];check(m,'PROTOTYPE.METHOD','Unknown receiver method');edges.add(m.owner+':'+lookup.name);}
        Object.values(v).forEach(x=>walk(x,edges,behavior));};
      for(const m of Object.values(d.methods))for(const [name,proc] of Object.entries(m.behavior.procedures)){const edges=new Set();walk(proc.body,edges,m.owner);graph.set(m.owner+':'+name,edges);}
      const active=new Set(),done=new Set();const visit=key=>{check(!active.has(key),'PROTOTYPE.METHOD','Recursive method cycle');if(done.has(key))return;active.add(key);for(const next of graph.get(key)??[])visit(next);active.delete(key);done.add(key);};for(const key of graph.keys())visit(key);
    }
    Object.freeze(this);
  }
  get(id) { const d = this.#definitions.get(id); check(d, 'PROTOTYPE.UNKNOWN', `Unknown prototype: ${id}`); return d; }
  method(id, name, caller = null, exact = true, context = null) {
    const definition = this.get(id);
    if(context)checkPlacement({},definition,context);
    check(!definition.static,'PROTOTYPE.STATIC','Static methods require compile-time linking');
    check(Object.hasOwn(definition.methods, name) || !exact, 'PROTOTYPE.METHOD', 'Unknown prototype method');
    const member = resolveMember(definition, 'method', name, exact);
    // A protected virtual slot remains callable from its ancestor declaration.
    // The selected override still executes in its own declaring-class frame.
    if (accessOf(member.rule) === 'protected' && caller && this.isA(member.owner, caller) && Object.hasOwn(this.get(caller).methods, member.name)) {
      authorizeMember(this, { ...member, owner: this.get(caller).methods[member.name].owner }, caller, context);
    } else authorizeMember(this, member, caller, context);
    return { ...definition.methods[member.name], name: member.name };
  }
  interface(type) { const d=this.#interfaces.get(type);check(d,'INTERFACE.UNKNOWN','Unknown or unsupported interface version');return d; }
  resolveInterface(alias, dependencies) {
    const matches=[...this.#interfaces.values()].filter(d=>(d.alias.toLowerCase()===alias.toLowerCase()||d.id===alias)&&dependencies?.[d.id]===d.version);
    check(matches.length===1,'INTERFACE.RESOLUTION','Missing or ambiguous approved interface');return matches[0];
  }
  implements(id,type) {const contract=this.interface(type),d=this.get(id);return !d.interface&&!d.static&&d.implements?.[contract.id]===contract.version;}
  verifiedPublisher(id) { return this.#verified.get(id)??null; }
  isA(id, base) { const d = this.get(id); return id === base || d.ancestors.includes(base); }
}
