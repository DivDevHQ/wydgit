// Browser adapter for generic, single-file multipart submission semantics.
// Packages supply declarative forms; no package code or provider identity runs here.
for (const form of document.querySelectorAll('form[enctype="multipart/form-data"]')) {
 const file = form.querySelector('input[type="file"][name="file"]');
 if (!file) continue;
 const sizeField=form.querySelector('input[name="size"]');
 file.addEventListener('change',()=>{if(sizeField)sizeField.value=String(file.files[0]?.size??'');});
 const status = document.createElement('p'); status.setAttribute('role','status');
 const progress = document.createElement('progress'); progress.max = 100;
 progress.setAttribute('aria-label','Upload progress'); progress.hidden = true;
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel upload';cancel.hidden=true;
 form.append(progress,status,cancel);let activeRequest;
 cancel.addEventListener('click',()=>activeRequest?.abort());
 form.addEventListener('submit', event => {
  if(activeRequest){event.preventDefault();return;}
  if (!file.files.length) return;
  event.preventDefault();
  const request = new XMLHttpRequest(), buttons = [...form.querySelectorAll('button[type="submit"]')];
  buttons.forEach(button => button.disabled = true);
  progress.hidden = false; progress.value = 0; status.textContent = 'Uploading…';
  activeRequest=request;cancel.hidden=false;
  request.open('POST',form.action);
  request.setRequestHeader('Accept','application/json');
  request.setRequestHeader('X-Wydgit-File-Size',String(file.files[0].size));
  request.upload.addEventListener('progress', e => { if(e.lengthComputable)progress.value=100*e.loaded/e.total; });
  request.addEventListener('loadend', () => {
   activeRequest=undefined;cancel.hidden=true;buttons.forEach(button => button.disabled = false);
   let ok=false;try{ok=request.status>=200&&request.status<300&&JSON.parse(request.responseText).ok===true;}catch{}
   status.textContent=ok?'Upload complete. Reload to view your uploaded file.':'Upload failed. Retry with a supported file within the upload limit.';
   progress.hidden=true;
  });
  const data=new FormData(form);if(sizeField)data.set('size',String(file.files[0].size));
  request.send(data);
 });
}
