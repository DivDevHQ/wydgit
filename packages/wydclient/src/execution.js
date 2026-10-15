// Trusted root-local entry facade. Never registered as a SEWN object.
import {hydrate,ExecutionContext} from '../../../wydgine/object-model/index.js';
import {resolveProperties} from '../../../wydgine/object-model/schema.js';
import {createInstanceController} from '../../../wydgine/execution/instances.js';
import {portableComponent,portablePlacement,portableRenderer} from './portable.js';
import {clean,freeze,check,shape} from './data.js';
export function executionPolicy(value){
  value=clean(value);shape(value,['publisher','package','packageVersion','installation','capabilities','visible','editable','traversal','scopes','limits','actions'],['publisher','installation','actions']);
  check(typeof value.installation==='string'&&value.installation.length>0&&Array.isArray(value.actions)&&value.actions.length<=128&&value.actions.every(a=>typeof a==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(a)),'SEAM.CONTEXT','Invalid execution approval');
  // Validate every grant now. self/app are supplied by the owning root, never the manifest.
  new ExecutionContext({...value,self:'validation',app:'validation'});
  return freeze(value);
}
export async function executableInstances({registry,page,entry,approval,regions,active,boundary,provenance}){
  shape(entry,['id','type','properties'],['id','type']);
  check(typeof entry.id==='string','OBJECT.IDENTITY','Invalid entry identity');
  const definition=registry.get(entry.type);
  check(definition.publisher===approval.publisher&&registry.verifiedPublisher(entry.type)===approval.publisher&&registry.isA(entry.type,'wydgit.core/section'),'SEAM.DENIED','Unapproved entry prototype');
  const source=provenance?.get(entry.type);
  check(!source||source.package===approval.package&&source.packageVersion===approval.packageVersion,'SEAM.DENIED','Signed package version is not approved');
  let count=0;
  const envelope=(id,type,properties={},depth=0)=>{
    check(depth<=32&&++count<=256,'OBJECT.LIMIT','Initial composition bound');
    const d=registry.get(type);check(registry.verifiedPublisher(type)===d.publisher||d.publisher==='wydgit.core','PROTOTYPE.PUBLISHER','Unverified constructed prototype');
    const slots=Object.fromEntries(Object.keys(d.slots).map(k=>[k,[]]));
    for(const child of d.component?.children??[])slots[child.slot].push(envelope(`${id}-${child.name}`,child.type,child.properties,depth+1));
    return {schema:'wydgit/0.2',id,prototype:type,properties:resolveProperties(properties,d),slots,provenance:{publisher:d.publisher,...(approval.package?{package:approval.package}:{}),...(provenance?.get(type)??{}),installation:approval.installation}};
  };
  const child=envelope(entry.id,entry.type,entry.properties);
  const runtime=hydrate({...page,slots:{...page.slots,sections:[child]}},registry,{rootPrototype:'wydgit.core/page'});
  const context=new ExecutionContext({...approval,self:page.id,app:page.id});
  const renderer=portableRenderer({registry,region:regions.bottom,boundary});
  let closed=false;const tokens=new WeakMap(),guard=()=>{active();check(!closed,'OBJECT.ACCESS','Disposed execution root');};
  const controller=createInstanceController({runtime,registry,context,rootId:page.id,runtimeTarget:'client',renderOnInvoke:true,componentPolicy:portableComponent,placementPolicy:portablePlacement,
    canEdit:()=>{guard();return true;},canEmit:()=>{guard();return true;},present:(runtime,ledger)=>{guard();renderer.render(runtime,ledger);}});
  const ref=id=>{const token=Object.freeze(Object.create(null));tokens.set(token,id);return token;};
  const resolve=token=>{guard();const id=tokens.get(token);check(id&&controller.executable(id),'OBJECT.ACCESS','Expected a live local receiver');return id;};
  const safe=async work=>{guard();try{return await work();}catch(error){const code=typeof error.code==='string'?error.code:'EXECUTION.FAILED';check(false,code,'Execution failed');}};
  const api=Object.freeze({
    entry:()=>{guard();check(controller.executable(entry.id),'OBJECT.ACCESS','Inactive entry');return ref(entry.id);},
    children(token,slot){const id=resolve(token),snapshot=controller.snapshot();const find=n=>n.id===id?n:Object.values(n.slots).flat().map(find).find(Boolean);const node=find(snapshot);check(node&&Object.hasOwn(node.slots,slot),'OBJECT.ACCESS','Unknown slot');return Object.freeze(node.slots[slot].map(n=>ref(n.id)));},
    snapshot(token){return controller.inspect(resolve(token));},
    invoke:(token,name,args=[])=>safe(async()=>{check(approval.actions.includes(name),'SEAM.DENIED','Host action not approved');return controller.invoke(resolve(token),name,clean(args));}),
    render:()=>safe(()=>controller.render()),
    unload:()=>safe(()=>controller.unload()),
    activate:()=>safe(()=>controller.activate())
  });
  try{await controller.activate();await controller.page('Start');await controller.page('Initialize');await controller.page('Load');await controller.page('PreRender');guard();}
  catch(error){closed=true;renderer.clear();await controller.dispose().catch(()=>{});throw error;}
  return {api,dispose(){if(closed)return Promise.resolve();closed=true;renderer.clear();return controller.dispose().catch(()=>{});}};
}
