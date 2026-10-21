// Passive diagnostics only: never focus a control or dispatch a keyboard event.
const csrf=document.querySelector('meta[name=csrf]').content;
let pending=Promise.resolve();
function capture(event){
 const key=event.type==='keydown'?({Tab:'Tab',Enter:'Enter',' ':'Space',Escape:'Escape',F6:'F6'}[event.key]):'';
 if(event.type==='keydown'&&!key)return; // Never capture typed text or credentials.
 const tag=document.activeElement?.tagName??'OTHER';
 const diagnostic={hasFocus:document.hasFocus(),hidden:document.hidden,active:['BODY','INPUT','BUTTON','A','TEXTAREA','SELECT','HTML'].includes(tag)?tag:'OTHER',event:event.type,key,trusted:event.isTrusted};
 document.getElementById('diagnostic').textContent=`Document focus: ${diagnostic.hasFocus}; visible: ${!diagnostic.hidden}; active: ${diagnostic.active}; last event: ${diagnostic.event} ${key}.`;
 pending=pending.then(()=>fetch('/focus-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf,diagnostic})})).catch(()=>{document.getElementById('diagnostic').textContent+=' Evidence could not be saved; describe this in the guide.';});
}
window.addEventListener('load',capture);
window.addEventListener('focus',capture,true);
window.addEventListener('blur',capture,true);
document.addEventListener('visibilitychange',capture);
document.addEventListener('keydown',capture);
