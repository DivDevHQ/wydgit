import { matchesObjectGrant } from '../seam/context.js';
import { descendantFields,formOperation,fieldKind,fieldValidation,publicProperties } from '../object-model/forms.js';
import { hydrate,dehydrate } from '../object-model/index.js';
import { clean,freeze,requireThat as check } from '../object-model/validation.js';
import { createDispatcher,EventRegistry,safeError,prepareHandlers,prepareAction } from '../events/index.js';
import { requestFacade,parseMap } from '../http/input.js';
import { createResponse } from '../http/response.js';
import { webModel } from '../web-model.js';
import { renderSite,errorDocument } from '../index.js';

export async function executePage({model,pageId,session,input,context,handlers=[],actions=[],events=new EventRegistry(),files,libraries,serviceMappings,csrf,render=renderSite}) {
  handlers=prepareHandlers(handlers,events);actions=actions.map(record=>prepareAction(record,events));
  check(context.app===session.view.app&&session.active(),'EVENT.DENIED','Invalid owning Session');
  check((context.identity?.sessionId??null)===(session.identity?.sessionId??null),'EVENT.DENIED','Wrong Session identity');
  let runtime=hydrate(dehydrate(model.runtime,{includeSensitive:true}),model.registry),alive=true,writable=true,unloading=false;
  const ledger=[],initialized=new Set(),archive=new Map(),errors=[];let failure;
  const response=createResponse(context),requestData={...input,route:{page:pageId}};
  const tree=(state=runtime)=>{const ids=[];const walk=id=>{ids.push(id);for(const slot of Object.keys(state.get(id).slots).sort())state.get(id).slots[slot].forEach(walk);};walk(pageId);return ids;};
  const reserved=new Set(tree());
  const exists=id=>tree().includes(id);
  const caches=new WeakMap(),ownedHandles=new WeakSet();
  const handle=(id,invocation=()=>{})=>{
    let cache=caches.get(invocation);if(!cache){cache=new Map();caches.set(invocation,cache);}if(cache.has(id))return cache.get(id);
    const guard=()=>{invocation();check(alive&&matchesObjectGrant(context.visible, id)&&(exists(id)||unloading&&archive.has(id)),'EVENT.DENIED','Stale or invisible Page handle');};
    guard();
    const node=()=>exists(id)?runtime.get(id):archive.get(id);
    const edit=(operation,...args)=>{
      guard();check(writable&&!unloading&&response.state==='Open'&&exists(id),'EVENT.DENIED','Tree is read-only');
      if(operation==='moveChild')check(exists(args[0]),'EVENT.DENIED','Parent outside Page');
      for(const old of tree())if(initialized.has(old))archive.set(old,runtime.get(old));
      const session=runtime.edit(context);session[operation](id,...args);const next=session.commit().runtime;
      // Never detach the lifecycle root or move content outside its Page.
      check(next.get(pageId).prototype===runtime.get(pageId).prototype,'EVENT.DENIED','Page root immutable');
      const oldIds=new Set(tree()),added=tree(next).filter(value=>!oldIds.has(value));
      check(added.every(value=>!reserved.has(value)),'MUTATION.IDENTITY','Request IDs cannot be reused');added.forEach(value=>reserved.add(value));runtime=next;
    };
    const result=Object.freeze({get id(){guard();return id;},get prototype(){guard();return node().prototype;},get properties(){guard();return publicProperties(node(),model.registry);},
      FormState(operation,data){guard();check(model.registry.isA(node().prototype,'wydgit.core/form'),'FORM.OPERATION','Receiver must be Form');check(context.traversal.includes('children'),'SEAM.TRAVERSAL','Form traversal denied');const fields=descendantFields(runtime,model.registry,id,context);check(fields.every(f=>matchesObjectGrant(context.visible, f.id)),'SEAM.VISIBILITY','Invisible Form field');const changes=[];const value=formOperation(fields,model.registry,operation,data,(id,p)=>changes.push([id,p]));if(operation==='validate')changes.push([id,{valid:value}]);if(operation==='clear')changes.push([id,{valid:true}]);if(changes.length){guard();check(writable&&!unloading&&response.state==='Open','EVENT.DENIED','Tree is read-only');const edit=runtime.edit(context);for(const [id,p] of changes)for(const [key,v] of Object.entries(p))edit.setProperty(id,key,v);runtime=edit.commit().runtime;}return value;},
      related(relation,slot){guard();check(exists(id),'EVENT.DENIED','Removed object');const related=runtime.scope(context,id).related(relation,slot);const wrap=value=>{check(exists(value.id),'EVENT.DENIED','Outside Page');return handle(value.id,invocation);};return Array.isArray(related)?Object.freeze(related.map(wrap)):related?wrap(related):null;},
      Set(name,value){edit('setProperty',name,value);},Insert(slot,index,envelope){edit('insertChild',slot,index,envelope);},Remove(){check(id!==pageId,'EVENT.DENIED','Page root immutable');edit('remove');},Replace(envelope){check(id!==pageId,'EVENT.DENIED','Page root immutable');edit('replaceChild',envelope);},Move(parent,slot,index){check(ownedHandles.has(parent),'EVENT.DENIED','Foreign handle');check(id!==pageId,'EVENT.DENIED','Page root immutable');edit('moveChild',parent.id,slot,index);}
    });ownedHandles.add(result);cache.set(id,result);return result;
  };
  const rootGuard=()=>{};
  const request=requestFacade(requestData,context);
  const contexts=guard=>({PAGE:handle(pageId,guard),SESSION:freeze(clean(session.view)),REQUEST:requestFacade(requestData,context,guard),RESPONSE:response.facade(guard),SERVER:Object.freeze({App:context.app}),
    FILESYS:Object.freeze({Get(id){guard();check(files,'FILE.DENIED','No approved files');return files.get(id,context,guard);}}),
    SERVICES:Object.freeze({async Call(library,name,input){guard();await session.authorize();guard();check(libraries,'SEAM.DENIED','No services');if(library==='wydstore'&&serviceMappings){const mapping=serviceMappings[input?.store];check(mapping&&input.collection===input.store,'PACKAGE.STORAGE','Unknown logical storage resource');input={...input,...mapping};}return libraries.bind(context).call(library,name,input);}})
  });
  const action=actions.find(a=>a.page===pageId&&a.target===input.action?.target&&a.type===input.action?.type);
  const defaults={};
  if(action)defaults[action.type]=async()=>{
    context.require(action.capability);await session.authorize();
    // Default is a trusted registered adapter; receives the same safe contexts, no grants.
    const dispatcher=createDispatcher({prototypeRegistry:model.registry,registry:events,handlers:[{type:action.type,owner:action.target,...(action.workflow!==undefined?{workflow:action.workflow}:{run:action.run})}],context,handle,contexts,exists});
    try{await dispatcher.dispatch({type:action.type,source:action.target,target:action.target,payload:input.action.payload??{}});}finally{dispatcher.close();}
  };
  const dispatcher=createDispatcher({prototypeRegistry:model.registry,registry:events,handlers,context,handle,contexts,exists,canRaise:id=>initialized.has(id),defaults,completed:()=>response.explicit,identifiers:{session:session.view.id,page:pageId}});
  const dispatch=(type,id,payload={},valid=true)=>dispatcher.dispatch({type,source:type.startsWith('Page.')?pageId:id,target:id,payload,valid});
  const initialize=async()=>{
    let rounds=0;
    while(true){const pending=tree().filter(id=>!initialized.has(id));if(!pending.length||response.explicit)return;check(++rounds<=32&&ledger.length+pending.length<=10000,'EVENT.LIMIT','Initialization limit');
      for(const id of pending){if(!exists(id))continue;initialized.add(id);if(!ledger.includes(id))ledger.push(id);archive.set(id,runtime.get(id));await dispatch('Page.Initialize',id);if(response.explicit)return;}
    }
  };
  const phase=async name=>{const snapshot=tree();for(const id of snapshot){if(exists(id)){await dispatch(`Page.${name}`,id);if(response.explicit)return;}}await initialize();};
  const systemSet=(id,properties)=>{
    // Trusted input binding only touches declared semantic fields, not arbitrary data.
    const raw=dehydrate(runtime,{includeSensitive:true});const walk=node=>{if(node.id===id)Object.assign(node.properties,properties);Object.values(node.slots).flat().forEach(walk);};walk(raw);runtime=hydrate(raw,model.registry);
  };
  try {
    check(exists(pageId),'EVENT.INVALID','Page missing');
    if(input.method==='POST') {
      check(action&&action.method==='POST'&&exists(action.target)&&matchesObjectGrant(context.visible, action.target),'EVENT.DENIED','Action denied');
      check(input.action.csrf===csrf&&typeof csrf==='string'&&csrf.length>=32,'REQUEST.FORGERY','Invalid action origin');
      check(session.active(),'EVENT.DENIED','Session ended');events.payload(action.type,input.action.payload??{});
    } else check(!input.action,'EVENT.DENIED','GET cannot invoke action');
    ledger.push(pageId);archive.set(pageId,runtime.get(pageId));
    await dispatch('Page.Start',pageId);
    if(!response.explicit)await initialize();
    if(!response.explicit) {
      if(input.method==='POST') {
        const values=parseMap(input.form),fields=model.registry.isA(runtime.get(action.target).prototype,'wydgit.core/form')?descendantFields(runtime,model.registry,action.target):[];
        check(Object.keys(values).every(name=>['_action','_target','_csrf'].includes(name)||(action.type==='Change'&&name==='value')||fields.some(f=>f.properties.name===name)),'REQUEST.INVALID','Forbidden submitted field');
        if(action.type==='Change')check(Object.keys(values).every(name=>['_action','_target','_csrf','value'].includes(name)),'REQUEST.INVALID','Forbidden Change field');
        for(const field of fields){if(!field.properties.enabled)continue;const kind=fieldKind(field.prototype,model.registry),all=request.Form.GetAll(field.properties.name);let value;
          if(kind==='checkbox')value=all.length>0;
          else if(kind==='checkbox-group'||kind==='select'&&field.properties.multiple)value=all;
          else {check(all.length<=1,'REQUEST.INVALID','Multiple values for single field');value=all[0]??(['radio-group','select'].includes(kind)?null:'');}
          if(kind==='select'&&!field.properties.multiple&&value==='')value=null;systemSet(field.id,{value});
        }
      }
      await phase('Load');
    }
    if(!response.explicit) {
      for(const id of tree())if(model.registry.isA(runtime.get(id).prototype,'wydgit.core/field')){
        const field=runtime.get(id);systemSet(id,fieldValidation(fieldKind(field.prototype,model.registry),field.properties));
      }
      for(const id of tree())if(model.registry.isA(runtime.get(id).prototype,'wydgit.core/form'))systemSet(id,{valid:descendantFields(runtime,model.registry,id).every(field=>field.properties.valid),errors:[],warnings:[]});
      await phase('Validate');
      for(const id of tree())if(model.registry.isA(runtime.get(id).prototype,'wydgit.core/form'))systemSet(id,{valid:runtime.get(id).properties.valid&&descendantFields(runtime,model.registry,id).every(child=>child.properties.valid)});
    }
    if(!response.explicit&&input.action) {
      context.require(action.capability);await session.authorize();
      await dispatch(action.type,action.target,input.action.payload??{},action.type!=='Submit'||runtime.get(action.target).properties.valid!==false);
      await initialize();
    }
    if(!response.explicit)await phase('PreRender');
    writable=false;
    if(!response.explicit){const result=await render(webModel(runtime,model),input.path,{csrf});response.tree(result.html,result.status);}
  }catch(error){failure=safeError(error);}
  finally {
    writable=false;unloading=true;response.beginCleanup();dispatcher.close();
    const cleanup=createDispatcher({prototypeRegistry:model.registry,registry:events,handlers,context,handle,contexts,exists:id=>exists(id)||archive.has(id)});
    for(const id of [...ledger].reverse())try{await cleanup.dispatch({type:'Page.Unload',source:pageId,target:id,payload:{}});}catch(error){errors.push(safeError(error).toJSON());}
    cleanup.close();alive=false;
  }
  if(failure&&response.state==='Open')response.tree(errorDocument(),failure.code==='EVENT.DENIED'||failure.code==='SEAM.DENIED'||failure.code==='REQUEST.FORGERY'?403:500);
  return {response,error:failure?.toJSON()??null,cleanupErrors:errors};
}
