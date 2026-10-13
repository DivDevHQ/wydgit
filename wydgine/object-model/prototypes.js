import { isCapability } from '../seam/capabilities.js';
import { accessOf, validateMember, resolveMember, authorizeMember } from './members.js';
import { validatePresentation } from '../components.js';
import { validate } from '../sewn/validate.js';
import { methods as facadeMethods } from '../sewn/bindings.js';
import { clean, freeze, record, requireThat as check } from './validation.js';
const identity = /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/;
export class PrototypeRegistry {
  #definitions = new Map();
  #verified = new Map();
  constructor(definitions, { officialPublishers = ['wydgit.core'], verifiedPrototypes = {}, caseCollisionCompatibility = {} } = {}) {
    for(const [id,publisher] of Object.entries(verifiedPrototypes)){check(identity.test(id)&&id.split('/')[0]===publisher,'PROTOTYPE.PUBLISHER','Invalid trusted publisher binding');this.#verified.set(id,publisher);}
    const raw = new Map();
    for (const input of definitions) {
      const d = clean(input);
      check(identity.test(d.id) && d.publisher === d.id.split('/')[0], 'PROTOTYPE.IDENTITY', 'Invalid prototype identity or publisher');
      check(!raw.has(d.id), 'PROTOTYPE.DUPLICATE', 'Duplicate prototype'); raw.set(d.id, d);
    }
    const visiting = new Set();
    const resolve = id => {
      if (this.#definitions.has(id)) return this.#definitions.get(id);
      const d = raw.get(id);
      check(d, 'PROTOTYPE.UNKNOWN', `Unknown prototype: ${id}`);
      check(!visiting.has(id), 'PROTOTYPE.CYCLE', 'Inheritance cycle'); visiting.add(id);
      let base;
      if (d.extends !== undefined) {
        check(typeof d.extends === 'string', 'PROTOTYPE.INHERITANCE', 'Single inheritance requires one prototype ID');
        base = resolve(d.extends);
        check(base.publisher === d.publisher || (officialPublishers.includes(base.publisher) && base.public === true), 'PROTOTYPE.PUBLISHER', 'Cross-publisher inheritance denied');
      }
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
      check(!behavior||['sewn/0.3','sewn/0.4','sewn/0.5','sewn/0.6','sewn/0.7'].includes(behavior.schema)&&behavior.body.length===0,'PROTOTYPE.METHOD','Expected portable prototype behavior');
      for(const [name,proc] of Object.entries(behavior?.procedures??{})){
        check(!Object.keys(facadeMethods.handle).some(x=>x.toLowerCase()===name.toLowerCase()),'PROTOTYPE.METHOD','Method conflicts with kernel facade');
        const old=inheritedMethods[name];
        check(Boolean(old)===(d.overrides??[]).includes(name),'PROTOTYPE.METHOD','Inherited methods require explicit overrides');
        if(old){check(accessOf(base.methodRules[name])!=='private','PROTOTYPE.ACCESS','Private methods cannot be overridden');const previous=old.behavior.procedures[name];check(previous.kind===proc.kind&&previous.params.length===proc.params.length&&previous.params.every((x,i)=>x.type===proc.params[i].type)&&previous.returns===proc.returns,'PROTOTYPE.METHOD','Incompatible override signature');}
        const rule=d.methodRules?.[name]??{};validateMember(rule);
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
      const result = freeze({ ...d, ...(presentation?{presentation}:{}), abstract: d.abstract ?? false, properties, propertyOwners, slots, methods, methodRules, friends, actions, ancestors: base ? [base.id, ...base.ancestors] : [] });
      visiting.delete(id); this.#definitions.set(id, result); return result;
    };
    for (const id of raw.keys()) resolve(id);
    for (const d of this.#definitions.values()) for (const slot of Object.values(d.slots)) for (const id of slot.accepts) this.get(id);
    // Resolve statically known Me calls through each actual prototype, including overrides.
    for(const d of this.#definitions.values()){
      const graph=new Map();
      const walk=(v,edges,behavior)=>{if(!v||typeof v!=='object')return;
        if(['procedureCall','functionCall'].includes(v.op))edges.add(behavior+':'+v.name);
        if(['methodCall','methodValue'].includes(v.op)&&v.target.op==='context'&&v.target.name==='ME'){const lookup=resolveMember(d,'method',v.name,v.exact??false),m=d.methods[lookup.name];check(m,'PROTOTYPE.METHOD','Unknown receiver method');edges.add(m.owner+':'+lookup.name);}
        Object.values(v).forEach(x=>walk(x,edges,behavior));};
      for(const m of Object.values(d.methods))for(const [name,proc] of Object.entries(m.behavior.procedures)){const edges=new Set();walk(proc.body,edges,m.owner);graph.set(m.owner+':'+name,edges);}
      const active=new Set(),done=new Set();const visit=key=>{check(!active.has(key),'PROTOTYPE.METHOD','Recursive method cycle');if(done.has(key))return;active.add(key);for(const next of graph.get(key)??[])visit(next);active.delete(key);done.add(key);};for(const key of graph.keys())visit(key);
    }
    Object.freeze(this);
  }
  get(id) { const d = this.#definitions.get(id); check(d, 'PROTOTYPE.UNKNOWN', `Unknown prototype: ${id}`); return d; }
  method(id, name, caller = null, exact = true, context = null) {
    const definition = this.get(id);
    check(Object.hasOwn(definition.methods, name) || !exact, 'PROTOTYPE.METHOD', 'Unknown prototype method');
    const member = resolveMember(definition, 'method', name, exact);
    // A protected virtual slot remains callable from its ancestor declaration.
    // The selected override still executes in its own declaring-class frame.
    if (accessOf(member.rule) === 'protected' && caller && this.isA(member.owner, caller) && Object.hasOwn(this.get(caller).methods, member.name)) {
      authorizeMember(this, { ...member, owner: this.get(caller).methods[member.name].owner }, caller, context);
    } else authorizeMember(this, member, caller, context);
    return { ...definition.methods[member.name], name: member.name };
  }
  verifiedPublisher(id) { return this.#verified.get(id)??null; }
  isA(id, base) { const d = this.get(id); return id === base || d.ancestors.includes(base); }
}
