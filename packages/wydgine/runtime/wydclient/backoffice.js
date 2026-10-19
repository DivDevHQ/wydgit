// Trusted WydClient web presentation adapter. Contributed contracts are data;
// no package markup, scripts, native contexts or service handles enter this UI.
export function matchesValue(value,contract,depth=0){
  if(depth>6||!contract)return false;
  switch(contract.type){
    case 'object':return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>!['__proto__','constructor','prototype'].includes(k)&&Object.hasOwn(contract.fields,k))&&Object.entries(contract.fields).every(([k,c])=>Object.hasOwn(value,k)?matchesValue(value[k],c,depth+1):(contract.optional??[]).includes(k));
    case 'array':return Array.isArray(value)&&value.length<=contract.maxItems&&value.every(v=>matchesValue(v,contract.items,depth+1));
    case 'string':return typeof value==='string'&&value.isWellFormed()&&value.length<=contract.maxLength;
    case 'integer':return Number.isSafeInteger(value)&&value>=contract.min&&value<=contract.max;
    case 'boolean':return typeof value==='boolean';
    case 'null':return value===null;
    default:return false;
  }
}

export function mountBackOffice({document,fetch:request}){
  const nav=document.getElementById('bo-navigation'),content=document.getElementById('bo-action'),status=document.getElementById('bo-status'),refresh=document.getElementById('bo-refresh'),theme=document.getElementById('bo-theme');
  let csrf=document.querySelector('meta[name="wydgit-backoffice-csrf"]')?.content,version=0,busy=false,actions=[];
  const node=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  const say=text=>{status.textContent=text;};
  const selectTheme=()=>document.documentElement.setAttribute('data-wyd-theme',theme.value);
  theme.addEventListener('change',selectTheme);
  const lock=value=>{busy=value;refresh.disabled=value;for(const b of nav.querySelectorAll('button'))b.disabled=value;};
  const clear=()=>{version++;actions=[];nav.replaceChildren();content.replaceChildren(node('h1','Site administration'),node('p','Select an installed action to begin.'));};
  const api=async(url,options={})=>{
    const response=await request(url,{...options,credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error'});
    // Server bounds bytes. Bound collection here as well if a proxy/host returns
    // an unexpected document. No raw response/error text is inserted into DOM.
    const reader=response.body.getReader(),chunks=[];let bytes=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;if((bytes+=value.byteLength)>66560)throw Error('Response limit');chunks.push(value);}}
    finally{void reader.cancel().catch(()=>{});}
    const all=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength;}
    const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));
    if(!response.ok||result.ok!==true){const error=Error('BackOffice request failed');error.code=result.code;error.status=response.status;throw error;}
    return result;
  };
  function field(contract,label){
    const group=node('div',undefined,{class:'bo-field'}),caption=node('label',label);group.append(caption);
    let control,read;
    if(contract.type==='object'){
      const box=node('fieldset'),legend=node('legend',label),children=[];box.append(legend);caption.remove();
      for(const [name,c]of Object.entries(contract.fields)){
        const child=field(c,name),optional=(contract.optional??[]).includes(name);let include;
        if(optional){const row=node('label',undefined,{class:'bo-optional'});include=node('input',undefined,{type:'checkbox','aria-label':`Include ${name}`});row.append(include,document.createTextNode(` Include ${name} (optional)`));const disabled=node('fieldset');disabled.disabled=true;disabled.append(child.element);include.addEventListener('change',()=>disabled.disabled=!include.checked);box.append(row,disabled);}
        else box.append(child.element);
        children.push({name,child,include});
      }
      group.append(box);read=()=>Object.fromEntries(children.filter(c=>!c.include||c.include.checked).map(c=>[c.name,c.child.read()]));
    }else if(contract.type==='null'){control=node('output','null');read=()=>null;}
    else if(contract.type==='array'){
      control=node('textarea',undefined,{'aria-label':label,rows:4,maxlength:48000});control.value='[]';
      group.append(node('small',`JSON array · up to ${contract.maxItems} items. Each item: ${JSON.stringify(contract.items)}`));read=()=>JSON.parse(control.value);
    }else{
      control=node('input',undefined,{type:contract.type==='boolean'?'checkbox':contract.type==='integer'?'number':'text','aria-label':label});
      if(contract.type==='integer'){control.min=String(contract.min);control.max=String(contract.max);control.step='1';control.required=true;}
      if(contract.type==='string')control.maxLength=contract.maxLength;
      read=()=>contract.type==='boolean'?control.checked:contract.type==='integer'?(control.value===''?NaN:Number(control.value)):control.value;
    }
    if(control){caption.append(control);}
    return {element:group,read};
  }
  function output(value){
    if(value===null||typeof value!=='object')return node('span',value===null?'null':String(value));
    if(Array.isArray(value)){
      if(!value.length)return node('p','No results.');
      const objectRows=value.every(v=>v&&typeof v==='object'&&!Array.isArray(v));
      if(objectRows){
        const columns=[...new Set(value.flatMap(v=>Object.keys(v)))],wrap=node('div',undefined,{class:'bo-table',tabindex:0}),table=node('table'),head=node('thead'),tr=node('tr'),body=node('tbody');
        table.append(node('caption','Action results'));for(const k of columns)tr.append(node('th',k,{scope:'col'}));head.append(tr);table.append(head,body);
        for(const row of value){const line=node('tr');for(const k of columns){const cell=node('td');cell.append(Object.hasOwn(row,k)?output(row[k]):node('span','—'));line.append(cell);}body.append(line);}wrap.append(table);return wrap;
      }
      const list=node('ol');for(const item of value){const li=node('li');li.append(output(item));list.append(li);}return list;
    }
    const list=node('dl');for(const [k,v]of Object.entries(value)){list.append(node('dt',k));const dd=node('dd');dd.append(output(v));list.append(dd);}if(!list.children.length)return node('p','No values.');return list;
  }
  function select(action){
    if(busy)return;const selected=++version;content.replaceChildren();
    for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-current',b.dataset.action===action.id?'page':'false');
    const form=node('form'),inputs=field(action.input,'Inputs'),result=node('section',undefined,{'aria-label':'Action result'}),run=node('button',action.effect==='write'?'Confirm and run':'Run action',{type:'submit',class:'wyd-submit'});
    content.append(node('p',`${action.category} · ${action.effect==='write'?'Changes site data':'Read only'}`,{class:'bo-eyebrow'}),node('h1',action.title),node('p',action.description),form,result);
    form.append(inputs.element);let confirm;
    if(action.confirmation){const label=node('label',undefined,{class:'bo-confirm'});confirm=node('input',undefined,{type:'checkbox',required:'','aria-label':'Confirm action'});label.append(confirm,document.createTextNode(action.confirmation));form.append(label);}
    form.append(run);say('Ready. Access is checked again when you run this action.');
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy||selected!==version)return;
      let input;try{input=inputs.read();if(!matchesValue(input,action.input)||confirm&&!confirm.checked)throw Error();}
      catch{say('Check your inputs against the field limits and confirmation.');return;}
      lock(true);run.disabled=true;result.replaceChildren();say('Running action…');
      // Consume confirmation on every attempt. A failed response may follow a
      // committed write; there is deliberately no retry or reference rebinding.
      const confirmed=confirm?.checked;if(confirm)confirm.checked=false;
      try{
        const response=await api('/backoffice/api/actions/invoke',{method:'POST',headers:{'Content-Type':'application/json','X-Wydgit-CSRF':csrf},body:JSON.stringify({reference:action.reference,input,...(confirmed?{confirmed:true}:{})})});
        if(selected!==version)return;
        if(!matchesValue(response.value,action.output))throw Error('Invalid output');
        result.append(node('h2','Result'),output(response.value));say('Action completed.');
      }catch(error){
        if(error.code==='ACTION.STALE'){clear();say('This action is no longer available. Refresh actions and select it again.');}
        else if(error.status===401||error.status===403){clear();say('Your session or access has changed. Sign in again or refresh actions.');}
        else say(action.effect==='write'?'The change could not be verified. It may have taken effect. Inspect current state before submitting again.':'The action could not be completed. Check your inputs or refresh actions.');
      }finally{lock(false);run.disabled=false;}
    });
  }
  async function discover(){
    if(busy)return;clear();const current=version;lock(true);say('Loading available actions…');
    try{
      const found=[];let offset=0,total;
      do{
        const page=await api('/backoffice/api/actions?offset='+offset+'&limit=10');
        if(current!==version)return;
        if(page.value.schema!=='wydgit.backoffice-discovery/1'||page.value.offset!==offset||!Number.isSafeInteger(page.value.total)||page.value.total<0||page.value.total>256||!Array.isArray(page.value.actions)||page.value.actions.length>10)throw Error('Invalid discovery');
        csrf=page.csrf;total=page.value.total;found.push(...page.value.actions);offset+=10;
      }while(offset<total);
      actions=found;
      for(const category of [...new Set(actions.map(a=>a.category))]){
        const section=node('section'),list=node('ul');section.append(node('h3',category),list);nav.append(section);
        for(const action of actions.filter(a=>a.category===category)){const li=node('li'),button=node('button',action.title,{type:'button','data-action':action.id});button.addEventListener('click',()=>select(action));li.append(button);list.append(li);}
      }
      say(actions.length?'Select an action.':'No actions are available for your current access. Installed modules and current permissions determine this list.');
    }catch(error){clear();say(error.status===401?'Your session has ended. Sign in to this site again.':error.status===403?'Access denied. Your current permissions do not allow this request.':error.code==='ACTION.STALE'?'The site changed. Reload BackOffice after the host restarts.':'Actions could not be loaded. Use Refresh to try again.');}
    finally{lock(false);}
  }
  refresh.addEventListener('click',discover);
  // Cached privilege displays are cleared on leaving and rediscovered on return.
  const visibility=()=>{if(document.hidden){clear();say('Actions cleared while this tab was inactive. Refresh to continue.');}else if(!busy)void discover();};
  document.addEventListener('visibilitychange',visibility);
  return {ready:discover(),refresh:discover};
}
if(typeof document!=='undefined'&&document.getElementById('bo-navigation'))mountBackOffice({document,fetch:globalThis.fetch.bind(globalThis)});
