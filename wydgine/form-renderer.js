// Web-only projection of semantic controls.
export function renderField(f,escape,claim=()=>{}) {
  if(f.visible===false)return '';
  const e=escape,id=`wyd-field-${f.id}`,message=`${id}-error`,kind=f.controlKind??'text-input';
  const common=` name="${e(f.name)}" data-wydgit="${e(f.id)}"${f.enabled===false?' disabled':''}${f.required?' required':''}${f.valid===false?` aria-invalid="true" aria-describedby="${e(message)}"`:''}`;
  claim(id);if(f.valid===false)claim(message);
  const options=f.options??[],multi=kind==='checkbox-group'||kind==='select'&&f.multiple;
  const selected=v=>multi?Array.isArray(f.value)&&f.value.includes(v):f.value===v;
  const error=f.valid===false?`<p class="wyd-validation" id="${e(message)}" role="alert">${e(f.validationMessage||f.errors?.[0]||'Invalid value')}</p>`:'';
  if(['radio-group','checkbox-group'].includes(kind)){options.forEach((_,i)=>claim(`${id}-${i}`));return `<fieldset class="wyd-field wyd-${kind}" id="${e(id)}" data-wydgit="${e(f.id)}"${f.enabled===false?' disabled':''}${f.required?' aria-required="true"':''}${f.valid===false?` aria-invalid="true" aria-describedby="${e(message)}"`:''}><legend>${e(f.label)}</legend>${options.map((o,i)=>`<div class="wyd-option"><label class="wyd-field-label" for="${e(id)}-${i}">${e(o.label)}</label><input class="wyd-${kind==='radio-group'?'radio':'checkbox'}" id="${e(id)}-${i}" type="${kind==='radio-group'?'radio':'checkbox'}"${common.replace(' required','').replace(' disabled','')} value="${e(o.value)}"${o.enabled&&f.enabled!==false?'':' disabled'}${selected(o.value)?' checked':''}></div>`).join('')}${error}</fieldset>`;}
  let control;
  const hint=f.placeholder==null?'':` placeholder="${e(f.placeholder)}"`,limit=f.maxLength==null?'':` maxlength="${f.maxLength}"`;
  if(kind==='select')control=`<select class="wyd-select wyd-input" id="${e(id)}"${common}${f.multiple?' multiple':''}>${f.multiple?'':`<option value=""${f.value===null?' selected':''}></option>`}${options.map(o=>`<option value="${e(o.value)}"${o.enabled?'':' disabled'}${selected(o.value)?' selected':''}>${e(o.label)}</option>`).join('')}</select>`;
  else if(kind==='text-area')control=`<textarea class="wyd-textarea wyd-input" id="${e(id)}"${common}${hint}${limit}>${e(f.value)}</textarea>`;
  else control=`<input class="${kind==='checkbox'?'wyd-checkbox':'wyd-input'}" id="${e(id)}" type="${kind==='checkbox'?'checkbox':kind==='password-input'?'password':'text'}"${common}${kind==='checkbox'?` value="true"${f.value?' checked':''}`:` value="${kind==='password-input'?'':e(f.value)}"${hint}${limit}`}>`;
  return `<div class="wyd-field${kind==='checkbox'?' wyd-field-checkbox':''}"><label class="wyd-field-label" for="${e(id)}">${e(f.label)}${f.required?'<span class="wyd-required"> (required)</span>':''}</label>${control}${error}</div>`;
}
