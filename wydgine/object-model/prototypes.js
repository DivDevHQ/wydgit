import { validate } from '../sewn/validate.js';
import { methods as facadeMethods } from '../sewn/bindings.js';
import { clean, freeze, record, requireThat as check } from './validation.js';
const identity = /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/;
export class PrototypeRegistry {
  #definitions = new Map();
  constructor(definitions, { officialPublishers = ['wydgit.core'] } = {}) {
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
      const inheritedMethods=base?.methods??{}, methods={...inheritedMethods};
      check(d.overrides===undefined||Array.isArray(d.overrides)&&d.overrides.every(x=>typeof x==='string'&&x===x.toLowerCase()),'PROTOTYPE.METHOD','Invalid override declarations');
      let behavior=null;if(d.behavior!==undefined){try{behavior=validate(d.behavior);}catch{check(false,'PROTOTYPE.METHOD','Invalid portable method behavior');}}
      check(d.methods===undefined&&d.behaviorSource===undefined,'PROTOTYPE.METHOD','Behavior must be compiled by trusted setup');
      check(new Set(d.overrides??[]).size===(d.overrides??[]).length,'PROTOTYPE.METHOD','Duplicate overrides');
      check(!behavior||behavior.schema==='sewn/0.3'&&behavior.body.length===0,'PROTOTYPE.METHOD','Expected portable prototype behavior');
      for(const [name,proc] of Object.entries(behavior?.procedures??{})){
        check(!Object.keys(facadeMethods.handle).some(x=>x.toLowerCase()===name),'PROTOTYPE.METHOD','Method conflicts with kernel facade');
        const old=inheritedMethods[name];
        check(Boolean(old)===(d.overrides??[]).includes(name),'PROTOTYPE.METHOD','Inherited methods require explicit overrides');
        if(old){const previous=old.behavior.procedures[name];check(previous.kind===proc.kind&&previous.params.length===proc.params.length&&previous.params.every((x,i)=>x.type===proc.params[i].type)&&previous.returns===proc.returns,'PROTOTYPE.METHOD','Incompatible override signature');}
        methods[name]={owner:id,behavior};
      }
      check((d.overrides??[]).every(name=>Object.hasOwn(behavior?.procedures??{},name)),'PROTOTYPE.METHOD','Override must declare a method');
      const properties = { ...base?.properties, ...d.properties }, slots = { ...base?.slots, ...d.slots };
      for (const rule of Object.values(properties)) {
        check(record(rule) && (!Array.isArray(rule.type)||rule.type.length>0)&& (Array.isArray(rule.type)?rule.type:[rule.type]).every(type=>['string','number','boolean','object','array','null'].includes(type)), 'PROTOTYPE.DEFINITION', 'Invalid property rule');
        check(rule.enum === undefined || Array.isArray(rule.enum), 'PROTOTYPE.DEFINITION', 'Invalid enum');
      }
      for (const rule of Object.values(slots)) {
        check(record(rule) && Array.isArray(rule.accepts) && rule.accepts.length > 0 && rule.accepts.every(x => typeof x === 'string'), 'PROTOTYPE.SLOT', 'Slot needs accepted prototypes');
        check(rule.ordered === true && Number.isInteger(rule.min ?? 0) && (rule.min ?? 0) >= 0 && (rule.max === undefined || (Number.isInteger(rule.max) && rule.max >= (rule.min ?? 0))), 'PROTOTYPE.SLOT', 'Invalid ordered slot cardinality');
      }
      const result = freeze({ ...d, abstract: d.abstract ?? false, properties, slots, methods, ancestors: base ? [base.id, ...base.ancestors] : [] });
      visiting.delete(id); this.#definitions.set(id, result); return result;
    };
    for (const id of raw.keys()) resolve(id);
    for (const d of this.#definitions.values()) for (const slot of Object.values(d.slots)) for (const id of slot.accepts) this.get(id);
    // Resolve statically known Me calls through each actual prototype, including overrides.
    for(const d of this.#definitions.values()){
      const graph=new Map();
      const walk=(v,edges,behavior)=>{if(!v||typeof v!=='object')return;
        if(['procedureCall','functionCall'].includes(v.op))edges.add(behavior+':'+v.name);
        if(['methodCall','methodValue'].includes(v.op)&&v.target.op==='context'&&v.target.name==='ME'){const m=d.methods[v.name];check(m,'PROTOTYPE.METHOD','Unknown receiver method');edges.add(m.owner+':'+v.name);}
        Object.values(v).forEach(x=>walk(x,edges,behavior));};
      for(const m of Object.values(d.methods))for(const [name,proc] of Object.entries(m.behavior.procedures)){const edges=new Set();walk(proc.body,edges,m.owner);graph.set(m.owner+':'+name,edges);}
      const active=new Set(),done=new Set();const visit=key=>{check(!active.has(key),'PROTOTYPE.METHOD','Recursive method cycle');if(done.has(key))return;active.add(key);for(const next of graph.get(key)??[])visit(next);active.delete(key);done.add(key);};for(const key of graph.keys())visit(key);
    }
    Object.freeze(this);
  }
  get(id) { const d = this.#definitions.get(id); check(d, 'PROTOTYPE.UNKNOWN', `Unknown prototype: ${id}`); return d; }
  method(id,name) { const method=this.get(id).methods[name];check(method,'PROTOTYPE.METHOD','Unknown prototype method');return method; }
  isA(id, base) { const d = this.get(id); return id === base || d.ancestors.includes(base); }
}
