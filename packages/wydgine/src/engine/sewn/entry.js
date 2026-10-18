import {checkPlacement} from '../execution/placement.js';
// Host-only entry tokens; canonical definitions and SEWN cannot create them.
import {memberAdapter} from '../object-model/members.js';
import {checkContext} from '../seam/context.js';
import {clean,requireThat as check} from '../object-model/validation.js';
const entries=new WeakMap();
export function createExecutionEntry({registry,context,handle,kind='method',name,args=[],caller=null}) {
 checkContext(context);const adapter=memberAdapter(handle,context);check(adapter,'OBJECT.ACCESS','Expected a live bound receiver');const node=adapter.node(),d=registry.get(node.prototype);let program,owner,method;checkPlacement(node,d,context);
 if(kind==='hook'){program=d.lifecycle[name];owner=d.lifecycleOwners[name];check(program&&owner,'PROTOTYPE.LIFECYCLE','Unknown lifecycle hook');method=name.toLowerCase();}
 else {check(kind==='method','OBJECT.ACCESS','Invalid entry kind');const resolved=registry.method(node.prototype,name,caller,false,context);program=resolved.behavior;owner=resolved.owner;method=resolved.name;}
 const token=Object.freeze(Object.create(null));entries.set(token,{registry,context,handle,program,owner,name:method,args:clean(args)});return token;
}
export function executionEntry(token,registry,context){const entry=entries.get(token);check(entry&&entry.registry===registry&&entry.context===context,'OBJECT.ACCESS','Invalid execution entry');memberAdapter(entry.handle,context).node();return entry;}
