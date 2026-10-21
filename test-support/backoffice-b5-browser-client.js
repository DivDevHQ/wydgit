// Explicit test-only trusted presentation adapter for the published B4b contract.
// Frozen WydClient has no automatic bound-Page intent adapter. This function runs
// in the real browser, on the canonical document, and submits real HTTP requests.
// It receives no native authority, operator context, password or session token.
export function mountB5IntentClient(){
  const form=document.querySelector('#b5-create');
  const bindings=JSON.parse(document.querySelector('meta[name="wydgit-backoffice-bindings"]').content);
  const csrf=document.querySelector('meta[name="wydgit-backoffice-csrf"]').content;
  const status=document.createElement('p');status.id='b5-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');form.append(status);
  const announce=(message,error=false)=>{status.setAttribute('role',error?'alert':'status');status.setAttribute('aria-live',error?'assertive':'polite');status.textContent=message;};
  form.addEventListener('input',event=>{const field=event.target;if(field.validity.valid){field.removeAttribute('aria-invalid');const error=document.getElementById(field.getAttribute('aria-describedby'));if(error)error.textContent='';field.removeAttribute('aria-describedby');}});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(form.dataset.pending==='true')return;
    const data=new FormData(form),pageBinding=bindings.find(b=>b.name==='create');
    if(!pageBinding){announce('This action is not authorized. Reload the Page to review access.',true);return;}
    form.dataset.pending='true';form.setAttribute('aria-busy','true');const button=form.querySelector('button');button.disabled=true;announce('Saving record…');
    try{
      const response=await fetch('/backoffice/api/actions/invoke',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Wydgit-CSRF':csrf},body:JSON.stringify({pageBinding,input:{id:data.get('id'),data:{text:data.get('text')}},confirmed:data.get('confirmed')==='true'})});
      const result=await response.json();form.dataset.httpStatus=String(response.status);form.dataset.outcome=response.headers.get('X-Wydgit-Action-Outcome');
      announce(result.ok?'Record created.':result.message,!result.ok);
    }catch{form.dataset.outcome='uncertain';announce('Delivery is uncertain. Inspect records before making another change.',true);}
    finally{form.dataset.pending='false';form.removeAttribute('aria-busy');button.disabled=false;}
  });
}
