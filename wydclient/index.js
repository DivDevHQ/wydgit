import { matchesObjectGrant } from '../wydgine/seam/context.js';
import { formOperation,publicProperties,fieldKind,sensitive,formTree } from '../wydgine/object-model/forms.js';
import { resolveProperties } from '../wydgine/object-model/schema.js';
import { createDispatcher } from '../wydgine/events/index.js';
import { clean,freeze,requireThat as check } from '../wydgine/object-model/validation.js';
import { cookieReader,parseCookies } from '../wydgine/http/input.js';
// Browser primitives are accepted only at this trusted renderer-adapter boundary.
// No native object is passed to handler contexts or payloads.
export function mountClient({nodes,context,handlers=[],readCookies=()=>'',submit=async()=>{},prototypeRegistry}) {
  const supplied=[...nodes],ids=new Set(supplied.map(node=>node.id));
  let ordered=supplied;
  check(ids.size===ordered.length&&ordered.length<=1000,'EVENT.LIMIT','Invalid client tree');
  for(const node of ordered)check(matchesObjectGrant(context.visible, node.id)&&(!node.parent||ids.has(node.parent)&&ordered.findIndex(n=>n.id===node.parent)<ordered.indexOf(node)),'EVENT.DENIED','Invalid client ownership');
  const visit=node=>[node,...supplied.filter(child=>child.parent===node.id).flatMap(visit)];
  ordered=supplied.filter(node=>!node.parent).flatMap(visit);
  if(prototypeRegistry){
    const envelope=node=>({prototype:node.prototype,properties:resolveProperties(node.properties??{},prototypeRegistry.get(node.prototype)),slots:{children:supplied.filter(n=>n.parent===node.id).map(envelope)}});
    for(const root of supplied.filter(n=>!n.parent&&n.prototype)){const raw=envelope(root);formTree(raw,prototypeRegistry);}
    for(const node of ordered)if(node.prototype){node.properties=resolveProperties(node.properties??{},prototypeRegistry.get(node.prototype));if(prototypeRegistry.isA(node.prototype,'wydgit.core/field'))node.controlKind=fieldKind(node.prototype,prototypeRegistry);}
  }
  const semantic=new Map(ordered.map(n=>[n.id,{id:n.id,prototype:n.prototype,properties:clean(n.properties??{})}]));
  let pending=0;
  let active=true,accepting=false,chain=Promise.resolve(),lastError=null;const listeners=[],mounted=[],values=new Map(ordered.map(n=>[n.id,n.properties?.value??n.value??''])),handles=new WeakMap();
  const handle=(id,guard)=>{
    check(ids.has(id)&&matchesObjectGrant(context.visible, id),'EVENT.DENIED','Invisible client object');let cache=handles.get(guard);if(!cache){cache=new Map();handles.set(guard,cache);}
    if(!cache.has(id))cache.set(id,Object.freeze({get id(){guard();check(active,'EVENT.INVALID','Unmounted handle');return id;},get Value(){guard();const n=semantic.get(id);return prototypeRegistry&&n.prototype&&sensitive(n.prototype,prototypeRegistry)?'':freeze(clean(values.get(id)));},get prototype(){guard();const node=ordered.find(n=>n.id===id);check(typeof node.prototype==='string','EVENT.CONTEXT','Client prototype unavailable');return node.prototype;},get properties(){guard();const node=semantic.get(id);return freeze(clean(prototypeRegistry?publicProperties(node,prototypeRegistry):node.properties));},FormState(operation,data){guard();check(active&&prototypeRegistry?.isA(semantic.get(id).prototype,'wydgit.core/form'),'FORM.OPERATION','Receiver must be Form');check(context.traversal.includes('children'),'SEAM.TRAVERSAL','Form traversal denied');const fields=[];let count=0;const walk=id=>{check(++count<=Math.min(1000,context.limits.formNodes??1000),'FORM.LIMIT','Client Form limit');const n=semantic.get(id);check(matchesObjectGrant(context.visible, id),'SEAM.VISIBILITY','Invisible field');if(prototypeRegistry.isA(n.prototype,'wydgit.core/field'))fields.push(n);ordered.filter(n=>n.parent===id).forEach(n=>walk(n.id));};walk(id);const updates=[];const result=formOperation(fields,prototypeRegistry,operation,data,(id,p)=>updates.push([id,p]));if(operation==='validate')updates.push([id,{valid:result}]);if(operation==='clear')updates.push([id,{valid:true}]);if(updates.length){context.require('object.instances.edit');check(updates.every(([id])=>matchesObjectGrant(context.editable, id)),'SEAM.DENIED','Client field edit denied');const resolved=updates.map(([id,p])=>[id,resolveProperties({...semantic.get(id).properties,...p},prototypeRegistry.get(semantic.get(id).prototype))]);for(const [id,p] of resolved){semantic.get(id).properties=p;values.set(id,p.value);const node=ordered.find(n=>n.id===id);if(Object.hasOwn(p,'value'))writeControl(node,p.value);}}return result;}}));return cache.get(id);
  };
  const readControl=node=>{
    if(node.readValue)return clean(node.readValue());
    if(node.controlKind==='checkbox')return Boolean(node.element.checked);
    if(['radio-group','checkbox-group'].includes(node.controlKind)){const selected=Array.from(node.element.querySelectorAll?.('input:checked')??[],o=>o.value);return node.controlKind==='radio-group'?selected[0]??null:selected;}
    if(node.controlKind==='select'&&node.properties?.multiple)return Array.from(node.element.selectedOptions??[],o=>o.value);
    const value=String(node.element.value);return node.controlKind==='select'&&value===''?null:value;
  };
  const writeControl=(node,value)=>{
    if(node.writeValue)node.writeValue(clean(value));
    else if(node.controlKind==='checkbox')node.element.checked=value;
    else if(['radio-group','checkbox-group'].includes(node.controlKind)){for(const o of node.element.querySelectorAll?.('input')??[])o.checked=Array.isArray(value)?value.includes(o.value):value===o.value;}
    else if(node.controlKind==='select'&&node.properties?.multiple){for(const o of node.element.options??[])o.selected=value.includes(o.value);}
    else node.element.value=value??'';
  };
  let privateChange;
  const dispatcher=createDispatcher({prototypeRegistry,reusable:true,runtimeTarget:'client',handlers,context,handle,exists:id=>active&&ids.has(id),contexts:guard=>({CLIENT:Object.freeze({Cookies:cookieReader(context,parseCookies(readCookies()),'client.cookies.read',guard)})}),defaults:{
    Change:async(task,payload)=>{const value=privateChange?.target===task.target?privateChange.value:payload.NewValue;values.set(task.target,value);const node=ordered.find(n=>n.id===task.target);if(prototypeRegistry&&node.prototype){const n=semantic.get(node.id);const p={...n.properties,value};n.properties=resolveProperties(p,prototypeRegistry.get(n.prototype));}writeControl(node,value);},
    Submit:async(task)=>{context.require('client.actions.submit');check(context.scopes.actions?.includes(task.target),'EVENT.DENIED','Client action denied');await submit(freeze({target:task.target,type:'Submit',payload:{}}));}
  }});
  const enqueue=work=>{chain=chain.catch(()=>{}).then(work);return chain;};
  const dispatch=(type,id,payload={},valid=true)=>dispatcher.dispatch({type,source:id,target:id,payload,valid});
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
            if(!accepting||node.properties?.enabled===false&&type==='Change')return;
            // Direct recipients only; nested browser bubbling does not double dispatch.
            if(native.target!==node.element&&!(node.kind==='field'&&['radio-group','checkbox-group'].includes(node.controlKind)&&node.element.contains?.(native.target)))return;
            if(type==='Submit')native.preventDefault();
            if(pending>=64){lastError='EVENT.LIMIT';accepting=false;enqueue(unmount);return;}pending++;
            const proposed=type==='Change'?readControl(node):null;
            enqueue(async()=>{
              pending--;if(!active)return;
              const secret=prototypeRegistry&&node.prototype&&sensitive(node.prototype,prototypeRegistry);const payload=type==='Change'?{OldValue:secret?'':values.get(node.id),NewValue:secret?'':proposed}:{};
              try{privateChange=type==='Change'?{target:node.id,value:proposed}:null;const valid=type==='Submit'&&prototypeRegistry?handle(node.id,()=>{}).FormState('validate'):true;const result=await dispatch(type,node.id,payload,valid);if(type==='Change'&&result.cancelled)writeControl(node,values.get(node.id));}
              catch(error){lastError=error.code??'EVENT.HANDLER_FAILED';if(type==='Change')writeControl(node,values.get(node.id));await unmount();}finally{privateChange=null;}
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
