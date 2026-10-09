import { hydrate,dehydrate } from '../object-model/index.js';
import { clean,freeze,requireThat as check } from '../object-model/validation.js';
import { createDispatcher,EventRegistry,safeError,prepareHandlers,prepareAction } from '../events/index.js';
import { requestFacade,parseMap } from '../http/input.js';
import { createResponse } from '../http/response.js';
import { webModel } from '../web-model.js';
import { renderSite,errorDocument } from '../index.js';

export async function executePage({model,pageId,session,input,context,handlers=[],actions=[],events=new EventRegistry(),files,libraries,csrf,render=renderSite}) {
  handlers=prepareHandlers(handlers,events);actions=actions.map(record=>prepareAction(record,events));
  check(context.app===session.view.app&&session.active(),'EVENT.DENIED','Invalid owning Session');
  check((context.identity?.sessionId??null)===(session.identity?.sessionId??null),'EVENT.DENIED','Wrong Session identity');
  let runtime=hydrate(dehydrate(model.runtime),model.registry),alive=true,writable=true,unloading=false;
  const ledger=[],initialized=new Set(),archive=new Map(),errors=[];let failure;
  const response=createResponse(context),requestData={...input,route:{page:pageId}};
  const tree=(state=runtime)=>{const ids=[];const walk=id=>{ids.push(id);for(const slot of Object.keys(state.get(id).slots).sort())state.get(id).slots[slot].forEach(walk);};walk(pageId);return ids;};
  const reserved=new Set(tree());
  const exists=id=>tree().includes(id);
  const caches=new WeakMap(),ownedHandles=new WeakSet();
  const handle=(id,invocation=()=>{})=>{
    let cache=caches.get(invocation);if(!cache){cache=new Map();caches.set(invocation,cache);}if(cache.has(id))return cache.get(id);
    const guard=()=>{invocation();check(alive&&context.visible.includes(id)&&(exists(id)||unloading&&archive.has(id)),'EVENT.DENIED','Stale or invisible Page handle');};
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
    const result=Object.freeze({get id(){guard();return id;},get prototype(){guard();return node().prototype;},get properties(){guard();return node().properties;},
      related(relation,slot){guard();check(exists(id),'EVENT.DENIED','Removed object');const related=runtime.scope(context,id).related(relation,slot);const wrap=value=>{check(exists(value.id),'EVENT.DENIED','Outside Page');return handle(value.id,invocation);};return Array.isArray(related)?Object.freeze(related.map(wrap)):related?wrap(related):null;},
      Set(name,value){edit('setProperty',name,value);},Insert(slot,index,envelope){edit('insertChild',slot,index,envelope);},Remove(){check(id!==pageId,'EVENT.DENIED','Page root immutable');edit('remove');},Replace(envelope){check(id!==pageId,'EVENT.DENIED','Page root immutable');edit('replaceChild',envelope);},Move(parent,slot,index){check(ownedHandles.has(parent),'EVENT.DENIED','Foreign handle');check(id!==pageId,'EVENT.DENIED','Page root immutable');edit('moveChild',parent.id,slot,index);}
    });ownedHandles.add(result);cache.set(id,result);return result;
  };
  const rootGuard=()=>{};
  const request=requestFacade(requestData,context);
  const contexts=guard=>({PAGE:handle(pageId,guard),SESSION:freeze(clean(session.view)),REQUEST:requestFacade(requestData,context,guard),RESPONSE:response.facade(guard),SERVER:Object.freeze({App:context.app}),
    FILESYS:Object.freeze({Get(id){guard();check(files,'FILE.DENIED','No approved files');return files.get(id,context,guard);}}),
    SERVICES:Object.freeze({async Call(library,name,input){guard();await session.authorize();guard();check(libraries,'SEAM.DENIED','No services');return libraries.bind(context).call(library,name,input);}})
  });
  const action=actions.find(a=>a.page===pageId&&a.target===input.action?.target&&a.type===input.action?.type);
  const defaults={};
  if(action)defaults[action.type]=async()=>{
    context.require(action.capability);await session.authorize();
    // Default is a trusted registered adapter; receives the same safe contexts, no grants.
    const dispatcher=createDispatcher({registry:events,handlers:[{type:action.type,owner:action.target,...(action.workflow!==undefined?{workflow:action.workflow}:{run:action.run})}],context,handle,contexts,exists});
    try{await dispatcher.dispatch({type:action.type,source:action.target,target:action.target,payload:input.action.payload??{}});}finally{dispatcher.close();}
  };
  const dispatcher=createDispatcher({registry:events,handlers,context,handle,contexts,exists,canRaise:id=>initialized.has(id),defaults,completed:()=>response.explicit,identifiers:{session:session.view.id,page:pageId}});
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
    const raw=dehydrate(runtime);const walk=node=>{if(node.id===id)Object.assign(node.properties,properties);Object.values(node.slots).flat().forEach(walk);};walk(raw);runtime=hydrate(raw,model.registry);
  };
  try {
    check(exists(pageId),'EVENT.INVALID','Page missing');
    if(input.method==='POST') {
      check(action&&action.method==='POST'&&exists(action.target)&&context.visible.includes(action.target),'EVENT.DENIED','Action denied');
      check(input.action.csrf===csrf&&typeof csrf==='string'&&csrf.length>=32,'REQUEST.FORGERY','Invalid action origin');
      check(session.active(),'EVENT.DENIED','Session ended');events.payload(action.type,input.action.payload??{});
    } else check(!input.action,'EVENT.DENIED','GET cannot invoke action');
    ledger.push(pageId);archive.set(pageId,runtime.get(pageId));
    await dispatch('Page.Start',pageId);
    if(!response.explicit)await initialize();
    if(!response.explicit) {
      for(const id of tree())if(model.registry.isA(runtime.get(id).prototype,'wydgit.core/form')){
        const names=runtime.get(id).slots.fields.map(child=>runtime.get(child).properties.name);
        check(names.every(name=>/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)&&!['constructor','prototype'].includes(name))&&new Set(names).size===names.length,'REQUEST.INVALID','Invalid semantic field names');
      }
      if(input.method==='POST') {
        const values=parseMap(input.form),fields=runtime.get(action.target).slots.fields??[];
        check(Object.keys(values).every(name=>['_action','_target','_csrf'].includes(name)||(action.type==='Change'&&name==='value')||fields.some(id=>runtime.get(id).properties.name===name)),'REQUEST.INVALID','Forbidden submitted field');
        if(action.type==='Change')check(Object.keys(values).every(name=>['_action','_target','_csrf','value'].includes(name)),'REQUEST.INVALID','Forbidden Change field');
        for(const id of fields){const field=runtime.get(id),value=request.Form.Get(field.properties.name)??'';systemSet(id,{value});}
      }
      await phase('Load');
    }
    if(!response.explicit) {
      for(const id of tree())if(model.registry.isA(runtime.get(id).prototype,'wydgit.core/field')) {
        const field=runtime.get(id).properties,errors=field.required&&!field.value.trim()?['Required']:[];systemSet(id,{valid:!errors.length,errors,warnings:[]});
      }
      for(const id of tree())if(model.registry.isA(runtime.get(id).prototype,'wydgit.core/form'))systemSet(id,{valid:(runtime.get(id).slots.fields??[]).every(child=>runtime.get(child).properties.valid),errors:[],warnings:[]});
      await phase('Validate');
      for(const id of tree())if(model.registry.isA(runtime.get(id).prototype,'wydgit.core/form'))systemSet(id,{valid:runtime.get(id).properties.valid&&(runtime.get(id).slots.fields??[]).every(child=>runtime.get(child).properties.valid)});
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
    const cleanup=createDispatcher({registry:events,handlers,context,handle,contexts,exists:id=>exists(id)||archive.has(id)});
    for(const id of [...ledger].reverse())try{await cleanup.dispatch({type:'Page.Unload',source:pageId,target:id,payload:{}});}catch(error){errors.push(safeError(error).toJSON());}
    cleanup.close();alive=false;
  }
  if(failure&&response.state==='Open')response.tree(errorDocument(),failure.code==='EVENT.DENIED'||failure.code==='SEAM.DENIED'||failure.code==='REQUEST.FORGERY'?403:500);
  return {response,error:failure?.toJSON()??null,cleanupErrors:errors};
}
