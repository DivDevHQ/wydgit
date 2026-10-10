import { formTree,publicProperties } from './forms.js';
// Invocation-local builders. This module never creates a canonical runtime or stores data.
import { checkContext } from '../seam/context.js';
import { clean,freeze,requireThat as check } from './validation.js';
import { validId,resolveProperties,copyEnvelope } from './schema.js';
export function construction(registry,context,bounds,guard) {
  checkContext(context);
  const drafts=new WeakMap(),roots=new Set();let created=0,operations=0;
  const tick=()=>{guard();check(++operations<=bounds.constructionOperations,'SEWN.LIMIT','Construction limit');};
  const requireScope=type=>{context.require('object.instances.construct');check(Array.isArray(context.scopes.prototypes)&&context.scopes.prototypes.includes(type),'SEAM.DENIED','Prototype construction denied');};
  const state=handle=>{guard();const s=drafts.get(handle);check(s&&!s.consumed,'OBJECT.CONSTRUCTION','Stale construction handle');return s;};
  const validate=(raw,complete=false,depth=0,ids=new Set())=>{
    check(depth<=bounds.draftDepth&&ids.size<bounds.draftNodes,'SEWN.LIMIT','Draft graph limit');
    check(validId(raw.id)&&!ids.has(raw.id),'OBJECT.CONSTRUCTION','Invalid or duplicate draft identity');ids.add(raw.id);
    const def=registry.get(raw.prototype);check(!def.abstract&&!registry.isA(def.id,'wydgit.core/app'),'OBJECT.CONSTRUCTION','Prototype cannot be constructed');
    const properties=resolveProperties(raw.properties,def,{incomplete:!complete});
    const slots=Object.create(null);for(const key of Object.keys(raw.slots))check(Object.hasOwn(def.slots,key),'OBJECT.UNKNOWN_SLOT','Unknown draft slot');
    for(const [key,rule] of Object.entries(def.slots)){
      const children=raw.slots[key]??[];check(Array.isArray(children)&&children.length<=(rule.max??Infinity)&&(!complete||children.length>=(rule.min??0)),'OBJECT.CARDINALITY','Draft cardinality');
      slots[key]=children.map(child=>{check(rule.accepts.some(base=>registry.isA(child.prototype,base)),'OBJECT.CHILD_TYPE','Draft child type');return validate(child,complete,depth+1,ids);});
    }
    const result={schema:'wydgit/0.2',id:raw.id,prototype:def.id,properties,slots,provenance:{}};formTree(result,registry);return result;
  };
  const size=(candidate,excluded)=>{let total=0,nodes=0;const count=raw=>{nodes++;Object.values(raw.slots).flat().forEach(count);};for(const root of roots){if(root===excluded)continue;const raw=root===candidate?.state?candidate.raw:root.raw;total+=JSON.stringify(raw).length;count(raw);}check(nodes<=bounds.draftNodes,'SEWN.LIMIT','Draft node limit');check(total<=bounds.constructionSize,'SEWN.LIMIT','Construction size limit');};
  const update=(s,raw,excluded)=>{raw=validate(raw);size({state:s,raw},excluded);s.raw=raw;};
  const consume=s=>{s.consumed=true;s.raw=null;roots.delete(s);};
  return Object.freeze({
    has:handle=>drafts.has(handle),
    create(type,id){tick();check(registry,'OBJECT.CONSTRUCTION','Construction unavailable');requireScope(type);check(++created<=bounds.drafts,'SEWN.LIMIT','Draft count limit');
      const s={raw:validate({id,prototype:type,properties:{},slots:{}}),consumed:false};
      const handle=Object.freeze({get id(){return state(handle).raw.id;},get prototype(){return state(handle).raw.prototype;},get properties(){return freeze(clean(publicProperties(state(handle).raw,registry)));},
        Set(name,value){tick();const s=state(handle),raw=copyEnvelope(s.raw);check(Object.hasOwn(registry.get(raw.prototype).properties,name),'OBJECT.PROPERTY','Unknown draft property');raw.properties[name]=clean(value);update(s,raw);},
        Insert(slot,index,child){tick();const s=state(handle),c=state(child);check(s!==c,'OBJECT.CONSTRUCTION','Draft cycle');const raw=copyEnvelope(s.raw);check(Object.hasOwn(raw.slots,slot),'OBJECT.UNKNOWN_SLOT','Unknown draft slot');check(Number.isSafeInteger(index)&&index>=0&&index<=raw.slots[slot].length,'MUTATION.INDEX','Invalid draft index');raw.slots[slot].splice(index,0,validate(c.raw,true));update(s,raw,c);consume(c);}
      });drafts.set(handle,s);roots.add(s);try{size();}catch(error){roots.delete(s);throw error;}return handle;
    },
    envelope(handle){tick();return validate(state(handle).raw,true);},
    consume(handle){consume(state(handle));},
    check(handle){state(handle);},
    close(){for(const s of roots)consume(s);roots.clear();}
  });
}
