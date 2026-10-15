// Trusted native interaction adapter. DOM objects remain within this closure.
import {CONTROL_SCHEMA,controlNodes,controlRecord} from '../../../wydgine/controls.js';
import {check} from './data.js';
export {CONTROL_SCHEMA};
export function controlAdapter({region,boundary,dispatch,executable}){
 const drafts=new Map();let current=[],staged=[],busy=false,generation=0,focus=null;
 const owns=el=>{if(!el.isConnected)return false;for(let p=el;p&&p!==region;p=p.parentElement){if(boundary(p))return false;if(p.parentElement===region)return true;}return false;};
 const live=record=>record.generation===generation&&owns(record.element)&&executable(record.id);
 const disable=()=>{for(const r of current)for(const el of r.inputs??[r.element])el.disabled=busy||!executable(r.id);};
 const feedback=(form,message)=>{for(const f of form.fields)f.element.setAttribute('aria-invalid',message?'true':'false');form.status.textContent=message;form.status.setAttribute('role',message?'alert':'status');};
 const listen=(r,type,fn)=>{r.element.addEventListener(type,fn);r.detach??=[];r.detach.push(()=>r.element.removeEventListener(type,fn));};
 const run=async(r,form)=>{
  if(busy||!live(r))return;
  busy=true;disable();if(form)feedback(form,'');
  try{
   await dispatch(r.id,r.spec,ledger=>{
    check(live(r),'CONTROL.STALE','Retired control');ledger.take('steps');
    if(!form)return [];
    check([...form.element.elements].every(el=>form.inputs.includes(el)),'CONTROL.INPUT','Unexpected form fields');
    const raw=Object.fromEntries(form.fields.map(f=>[f.spec.name,f.spec.control==='checkbox'?f.element.checked:f.element.value]));
    const values=controlRecord(form.spec,raw,()=>ledger.take('steps'));
    return [values];
   },()=>check(live(r),'CONTROL.STALE','Retired control'));
   if(form&&(form.spec.reset??'success')==='success'){
    for(const f of form.fields){drafts.delete(f.key);const fresh=current.find(n=>n.key===f.key);if(fresh){fresh.element.value=fresh.initial;fresh.element.checked=fresh.initial===true;}}
   }
  }catch(error){
   // Do not expose application exceptions, authored data or native errors.
   const message=error?.code==='CONTROL.INPUT'?'Check the required fields, lengths and allowed values.':'Action could not be completed.';
   const target=form&&current.find(n=>n.key===form.key);if(target&&live(target))feedback(target,message);
  }finally{busy=false;disable();}
 };
 return {
  begin(){staged=[];focus=null;for(const r of current)if(r.element===region.ownerDocument.activeElement)focus={key:r.key,start:r.element.selectionStart,end:r.element.selectionEnd};},
  build(spec,{id,make,text,read}){
   const render=(s,form=null)=>{
    if(s.tag){const el=make(s.tag);if(Object.hasOwn(s,'text'))text(el,read(s.text));for(const c of s.children??[])el.append(render(c,form));return el;}
    const kind=s.control,key=id+':'+s.name,record={id,key,spec:s,generation:generation+1},el=make(({form:'form',label:'label',status:'p',button:'button',submit:'button',reset:'button',text:'input',textarea:'textarea',checkbox:'input',select:'select'})[kind]);record.element=el;staged.push(record);
    if(kind==='form'){
     el.noValidate=true;el.setAttribute('aria-label',s.label);record.fields=[];record.inputs=[];form=record;
     const legend=make('h3');text(legend,s.label);el.append(legend);
     for(const child of s.children??[])el.append(render(child,form));
     const status=make('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.id=`${region.getAttribute('data-wydclient-context')}-${id}-${s.name}-feedback`;record.status=status;el.append(status);el.setAttribute('aria-describedby',status.id);
     listen(record,'submit',event=>{if(event.target!==el)return;event.preventDefault();void run(record,record);});
     listen(record,'reset',event=>{if(event.target!==el)return;event.preventDefault();if(!live(record)||busy)return;for(const f of record.fields){drafts.delete(f.key);f.element.value=f.initial;f.element.checked=f.initial===true;}feedback(record,'');});
    }else if(['text','textarea','checkbox','select'].includes(kind)){
     const label=make('label');text(label,s.label);label.append(el);
     el.name=s.name;el.required=s.required;el.setAttribute('aria-label',s.label);el.setAttribute('data-wydclient-control',s.name);
     if(kind==='text')el.type='text';if(kind==='checkbox')el.type='checkbox';if(kind==='text'||kind==='textarea')el.maxLength=s.maxLength;
     if(kind==='select')for(const value of s.options){const option=make('option');option.value=value;text(option,value);el.append(option);}
     record.initial=s.value===undefined?(kind==='checkbox'?false:kind==='select'?s.options[0]:''):read(s.value);
     check(kind==='checkbox'?typeof record.initial==='boolean':['string','number'].includes(typeof record.initial),'CONTROL.TYPE','Invalid initial field value');
     const value=drafts.has(key)?drafts.get(key):record.initial;if(kind==='checkbox')el.checked=value;else el.value=String(value);
     form.fields.push(record);form.inputs.push(el);
     listen(record,kind==='checkbox'||kind==='select'?'change':'input',()=>{if(live(record)&&!busy)drafts.set(key,kind==='checkbox'?el.checked:el.value);});return label;
    }else if(['button','submit','reset'].includes(kind)){
     el.type=kind==='submit'?'submit':kind==='reset'?'reset':'button';text(el,s.label);el.setAttribute('data-wydclient-control',s.name);if(form)form.inputs.push(el);
     if(kind==='button')listen(record,'click',event=>{if(event.target!==el)return;event.preventDefault();void run(record);});
    }else {text(el,s.value===undefined?s.label:read(s.value));if(kind==='status'){el.setAttribute('role','status');el.setAttribute('aria-live','polite');}}
    return el;
   };return render(spec.template);
  },
  commit(){for(const r of current)for(const detach of r.detach??[])detach();current=staged;generation++;const valid=new Set(current.map(r=>r.key));for(const key of drafts.keys())if(!valid.has(key))drafts.delete(key);disable();if(focus){const r=current.find(r=>r.key===focus.key);if(r){r.element.focus();if(typeof focus.start==='number'&&r.element.setSelectionRange)r.element.setSelectionRange(focus.start,focus.end);}}},
  clear(){for(const r of [...current,...staged])for(const detach of r.detach??[])detach();current=[];staged=[];drafts.clear();generation++;}
 };
}
