import { createDispatcher } from '../wydgine/events/index.js';
import { clean,freeze,requireThat as check } from '../wydgine/object-model/validation.js';
import { cookieReader,parseCookies } from '../wydgine/http/input.js';
// Browser primitives are accepted only at this trusted renderer-adapter boundary.
// No native object is passed to handler contexts or payloads.
export function mountClient({nodes,context,handlers=[],readCookies=()=>'',submit=async()=>{}}) {
  const supplied=[...nodes],ids=new Set(supplied.map(node=>node.id));
  let ordered=supplied;
  check(ids.size===ordered.length&&ordered.length<=1000,'EVENT.LIMIT','Invalid client tree');
  for(const node of ordered)check(context.visible.includes(node.id)&&(!node.parent||ids.has(node.parent)&&ordered.findIndex(n=>n.id===node.parent)<ordered.indexOf(node)),'EVENT.DENIED','Invalid client ownership');
  const visit=node=>[node,...supplied.filter(child=>child.parent===node.id).flatMap(visit)];
  ordered=supplied.filter(node=>!node.parent).flatMap(visit);
  let pending=0;
  let active=true,accepting=false,chain=Promise.resolve(),lastError=null;const listeners=[],mounted=[],values=new Map(ordered.map(n=>[n.id,n.value??''])),handles=new WeakMap();
  const handle=(id,guard)=>{
    check(ids.has(id)&&context.visible.includes(id),'EVENT.DENIED','Invisible client object');let cache=handles.get(guard);if(!cache){cache=new Map();handles.set(guard,cache);}
    if(!cache.has(id))cache.set(id,Object.freeze({get id(){guard();check(active,'EVENT.INVALID','Unmounted handle');return id;},get Value(){guard();return freeze(clean(values.get(id)));}}));return cache.get(id);
  };
  const dispatcher=createDispatcher({reusable:true,runtimeTarget:'client',handlers,context,handle,exists:id=>active&&ids.has(id),contexts:guard=>({CLIENT:Object.freeze({Cookies:cookieReader(context,parseCookies(readCookies()),'client.cookies.read',guard)})}),defaults:{
    Change:async(task,payload)=>{values.set(task.target,payload.NewValue);ordered.find(n=>n.id===task.target).element.value=payload.NewValue;},
    Submit:async(task)=>{context.require('client.actions.submit');check(context.scopes.actions?.includes(task.target),'EVENT.DENIED','Client action denied');await submit(freeze({target:task.target,type:'Submit',payload:{}}));}
  }});
  const enqueue=work=>{chain=chain.catch(()=>{}).then(work);return chain;};
  const dispatch=(type,id,payload={})=>dispatcher.dispatch({type,source:id,target:id,payload});
  const unmount=async()=>{
    if(!active)return;accepting=false;for(const [el,name,fn] of listeners)el.removeEventListener(name,fn);listeners.length=0;
    for(const id of [...mounted].reverse())try{await dispatch('Client.Unmount',id);}catch(error){lastError=error.code??'EVENT.HANDLER_FAILED';}
    active=false;dispatcher.close();
  };
  const ready=enqueue(async()=>{
    try {
      for(const node of ordered){mounted.push(node.id);await dispatch('Client.Mount',node.id);}
      for(const node of ordered)await dispatch('Client.Ready',node.id);
      for(const node of ordered) {
        const adapt=(nativeName,type)=>{
          const fn=native=>{
            if(!accepting)return;
            // Direct recipients only; nested browser bubbling does not double dispatch.
            if(native.target!==node.element)return;
            if(type==='Submit')native.preventDefault();
            if(pending>=64){lastError='EVENT.LIMIT';accepting=false;enqueue(unmount);return;}pending++;
            const proposed=type==='Change'?String(node.element.value):null;
            enqueue(async()=>{
              pending--;if(!active)return;
              const payload=type==='Change'?{OldValue:values.get(node.id),NewValue:proposed}:{};
              try{const result=await dispatch(type,node.id,payload);if(type==='Change'&&result.cancelled)node.element.value=values.get(node.id);}
              catch(error){lastError=error.code??'EVENT.HANDLER_FAILED';if(type==='Change')node.element.value=values.get(node.id);await unmount();}
            });
          };node.element.addEventListener(nativeName,fn);listeners.push([node.element,nativeName,fn]);
        };
        if(node.kind==='form')adapt('submit','Submit');else if(node.kind==='field')adapt('change','Change');else adapt('click','Activate');
      }
      accepting=true;
    }catch(error){await unmount();throw error;}
  });
  return Object.freeze({ready,idle:()=>chain,unmount:()=>enqueue(unmount),error:()=>lastError});
}
