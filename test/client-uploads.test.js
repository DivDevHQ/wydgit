import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('generic multipart adapter sends exact size, reports progress, prevents duplicates and cancels requests',async()=>{
 const element=()=>({events:{},hidden:false,setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.events[k]=v;}});
 const file=element();file.files=[{size:6789}];const size=element(),button=element(),children=[],form=element();
 form.action='/_transfer/example/upload/page/widget?_csrf=opaque';form.querySelector=q=>q.includes('type="file"')?file:size;form.querySelectorAll=()=>[button];form.append=(...nodes)=>children.push(...nodes);
 const requests=[];
 class Request {constructor(){this.events={};this.headers={};this.upload=element();requests.push(this);}open(method,url){this.method=method;this.url=url;}setRequestHeader(k,v){this.headers[k]=v;}addEventListener(k,v){this.events[k]=v;}send(body){this.body=body;}abort(){this.status=0;this.events.loadend();}}
 class Data {constructor(form){this.form=form;this.values={};}set(k,v){this.values[k]=v;}}
 const source=await readFile('wydclient/uploads.js','utf8');assert.doesNotMatch(source,/wydstream|wydfiles|media-gallery/);
 runInNewContext(source,{document:{querySelectorAll:()=>[form],createElement:element},XMLHttpRequest:Request,FormData:Data});
 file.events.change();assert.equal(size.value,'6789');let prevented=0;const submit=()=>form.events.submit({preventDefault(){prevented++;}});
 submit();const [progress,status,cancel]=children,r=requests[0];assert.equal(r.method,'POST');assert.equal(r.url,form.action);assert.equal(r.headers['X-Wydgit-File-Size'],'6789');assert.equal(r.body.values.size,'6789');assert.equal(button.disabled,true);
 r.upload.events.progress({lengthComputable:true,loaded:5,total:10});assert.equal(progress.value,50);submit();assert.equal(requests.length,1);
 r.status=200;r.responseText='{"ok":true}';r.events.loadend();assert.match(status.textContent,/Upload complete/);assert.equal(button.disabled,false);assert.equal(progress.hidden,true);
 submit();cancel.events.click();assert.match(status.textContent,/Upload failed/);assert.equal(cancel.hidden,true);assert.equal(button.disabled,false);assert.equal(prevented,3);
});
