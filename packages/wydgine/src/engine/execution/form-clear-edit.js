import {checkContext,matchesObjectGrant} from '../seam/context.js';
import {clean,requireThat as check} from '../object-model/validation.js';

// Server Page Clear only. Its generated patch writes each property once, against
// this current canonical pre-Clear runtime. Never use this as a general edit API
// or compare against an initialization/saved snapshot. The Page owns session
// lifetime/read-only guards and a single fresh edit/commit around the whole Clear.
export function setClearProperty(edit,runtime,context,id,name,value) {
  checkContext(context);
  check(context.capabilities.includes('object.instances.edit')&&matchesObjectGrant(context.visible,id)&&matchesObjectGrant(context.editable,id),
    'MUTATION.DENIED','Mutation denied');
  const properties=runtime.get(id).properties,next=clean(value),before=properties[name];
  // An identical existing property is already schema validated. Clear's only
  // container proposals are fresh empty arrays; no deep comparison or cache.
  if(Object.hasOwn(properties,name)&&(before===next||
    Array.isArray(before)&&Array.isArray(next)&&before.length===0&&next.length===0))return false;
  edit.setProperty(id,name,value);return true;
}
