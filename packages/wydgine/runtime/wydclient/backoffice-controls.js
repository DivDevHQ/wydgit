// Trusted web projection of reviewed canonical Page bindings. This module never
// resolves a resource, chooses a service, grants authority or evaluates markup.
import {backOfficePresentation,matchesValue} from './backoffice.js';

export function mountBackOfficeControls({document,fetch:request}){
  const metadata=document.querySelector('meta[name="wydgit-backoffice-controls"]');
  if(!metadata)return [];
  const controls=JSON.parse(metadata.content),csrf=document.querySelector('meta[name="wydgit-backoffice-csrf"]')?.content;
  if(controls.schema!=='wydgit.backoffice-controls/1'||!Array.isArray(controls.consumers)||controls.consumers.length>32)return [];
  return controls.consumers.map((consumer,index)=>{
    const host=document.getElementById(consumer.id);
    if(!host||!document.querySelector('main')?.contains(host)||host.closest('form'))return;
    const {node,api,field,output}=backOfficePresentation({document,fetch:request,prefix:`bo-${index}-`});
    const root=node('section',undefined,{class:'bo-controls','aria-label':consumer.actions[0]?.title??'Installed Page controls'}),status=node('p','Ready.',{role:'status','aria-live':'polite'});
    host.append(root);root.append(status);let busy=false,expired=false;
    const say=(text,error=false)=>{status.textContent=text;status.setAttribute('role',error?'alert':'status');status.setAttribute('aria-live',error?'assertive':'polite');};
    const lock=value=>{busy=value;root.setAttribute('aria-busy',String(value));for(const e of root.querySelectorAll(':scope > form > fieldset'))e.disabled=value||expired||e.dataset.awaitLoad==='true';};
    const invoke=async(action,input,confirmed)=>{
      const response=await api('/backoffice/api/actions/invoke',{method:'POST',headers:{'Content-Type':'application/json','X-Wydgit-CSRF':csrf},body:JSON.stringify({pageBinding:action.binding,input,...(confirmed?{confirmed:true}:{})})});
      if(!matchesValue(response.value,action.output))throw Error('Invalid result');return response.value;
    };
    function failure(error,write){
      if(error.status===401||error.status===403||error.code==='ACTION.STALE'){
        expired=true;say('Your session, Page or action access changed. Reload this Page to review current access.',true);
        const reload=node('a','Reload Page',{href:document.location.pathname});root.append(reload);reload.focus();
      }else say(write?(error.outcome==='rejected'?'The change was rejected before execution. Check inputs and access.':'The change could not be verified and may have taken effect. Load current state before submitting again.'):(error.code==='STORE.CONFLICT'?'The record changed. Load its current revision.':'The request could not be completed. Check inputs or load current state.'),true);
    }
    function actionForm(action,{onResult,onError,caption=action.title}={}){
      const form=node('form',undefined,{novalidate:'','aria-label':caption}),box=node('fieldset'),legend=node('legend',caption),inputs=field(action.input,'Properties');
      const run=node('button',action.effect==='write'?'Save changes':action.operation==='query'?'Refresh dashboard':'Load current state',{type:'submit',class:'wyd-submit'}),result=node('section',undefined,{'aria-label':caption+' result'});
      box.append(legend,inputs.element);let confirm;
      if(action.effect==='write'){
        const label=node('label',undefined,{class:'bo-confirm'});confirm=node('input',undefined,{type:'checkbox','aria-label':'Confirm '+caption});label.append(confirm,document.createTextNode(action.confirmation));box.append(label);
        const changed=e=>{if(e.target!==confirm)confirm.checked=false;};form.addEventListener('input',changed);form.addEventListener('change',changed);
      }
      box.append(run);form.append(box);root.append(node('h2',caption),form,result);
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(busy||expired||box.disabled)return;
        let input;try{input=inputs.read();if(confirm&&!confirm.checked)throw Object.assign(Error(),{control:confirm});}
        catch(error){say('Check field limits and confirm each change.',true);error.control?.focus();return;}
        const confirmed=confirm?.checked;if(confirm)confirm.checked=false;lock(true);say('Working…');result.replaceChildren();
        try{const value=await invoke(action,input,confirmed);onResult?.(value);const title=node('h3','Result',{tabindex:-1});result.append(title,output(value));title.focus();say('Action completed.');}
        catch(error){onError?.();failure(error,action.effect==='write');}
        finally{lock(false);if(!expired&&status.getAttribute('role')==='alert')run.focus();}
      });
      return {inputs,box,run,result,form};
    }
    // get/update pairs must target the same reviewed fixed record. No path map,
    // caller-supplied resource or opaque result becomes a new invocation selector.
    const load=consumer.actions.find(a=>a.operation==='get'),save=consumer.actions.find(a=>a.operation==='update');
    const editor=load&&save&&load.effect==='read'&&save.effect==='write'&&
      JSON.stringify(load.fixedInput)===JSON.stringify(save.fixedInput)&&typeof load.fixedInput.id==='string'&&
      Object.keys(load.input.fields).length===0&&Object.keys(save.input.fields).sort().join(',')==='data,version'&&
      load.output.type==='object'&&save.input.fields.data&&save.input.fields.version&&
      JSON.stringify(load.output.fields.data)===JSON.stringify(save.input.fields.data)&&JSON.stringify(load.output.fields.version)===JSON.stringify(save.input.fields.version);
    if(editor){
      let editing;
      actionForm(load,{caption:'Load '+save.title,onResult:value=>{
        if(!matchesValue({data:value.data,version:value.version},save.input))throw Error('Invalid editor result');
        editing.inputs.write({data:value.data,version:value.version});delete editing.box.dataset.awaitLoad;editing.box.disabled=false;
      }});
      editing=actionForm(save,{onResult:value=>{editing.inputs.write({data:value.data,version:value.version});},onError:()=>{editing.box.dataset.awaitLoad='true';}});
      editing.box.dataset.awaitLoad='true';editing.box.disabled=true;
      for(const a of consumer.actions.filter(a=>a!==load&&a!==save))actionForm(a);
    }else for(const action of consumer.actions)actionForm(action);
    if(!consumer.actions.length)say('No actions are available for your current access.',true);
    return {root};
  });
}
if(typeof document!=='undefined')mountBackOfficeControls({document,fetch:globalThis.fetch.bind(globalThis)});
