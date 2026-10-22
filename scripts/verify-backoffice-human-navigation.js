// Actual Firefox link navigation in a separate developer session. No response
// interception, injected Page adapter, human outcomes or credential/header dumps.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {setDefaultResultOrder} from 'node:dns';
setDefaultResultOrder('ipv4first');
import assert from 'node:assert/strict';
import {launch,cleanSession} from './backoffice-human.js';
import {localBrowser} from '../test-support/local-browser.js';
import {password} from './backoffice-human/cases.js';
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-b6h-navigation-')),sessionHome=path.join(artifacts,'environment'),callbacks=[];
const findings={purpose:'developer-simulation',humanAcceptance:false,firefoxKeyboardQualified:false,requests:[],providers:[]};
let h,b;
try{
 h=await launch({openBrowser:false,sessionHome,purpose:'developer-simulation'});
 for(const a of h.apps)a.server.on('request',(req,res)=>{
  const route=req.url?.split('?')[0];if(!['/sign-in/','/backoffice/pages/workspace','/backoffice/api/actions/invoke'].includes(route))return;
  const request={source:req.headers['x-b6h-probe']==='origin-rejection'?'HTTP security probe':'Firefox',provider:a.name,method:req.method,url:h.urls[a.name]+route,origin:req.headers.origin??null,fetchSite:req.headers['sec-fetch-site']??null,fetchMode:req.headers['sec-fetch-mode']??null,fetchDest:req.headers['sec-fetch-dest']??null,fetchUser:req.headers['sec-fetch-user']??null};
  res.once('finish',()=>findings.requests.push({...request,status:res.statusCode}));
 });
 b=await localBrowser({after:fn=>callbacks.push(fn)},artifacts,{firefox:true});findings.browser=b.version;
 const raw=b.rawProtocol;
 const evaluate=async(context,expression)=>{const r=await raw('script.evaluate',{expression:`(async()=>JSON.stringify(await (${expression})))()`,target:{context},awaitPromise:true});if(r.type==='exception')throw Error('Firefox evaluation failed');return JSON.parse(r.result.value);};
 const wait=async(fn)=>{for(let n=0;n<200;n++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,40));}throw Error('Firefox navigation condition failed');};
 const sample=async url=>{const {contexts}=await raw('browsingContext.getTree',{});return contexts.find(c=>c.url.startsWith(url))?.context;};
 const click=async(context,selector)=>{await raw('browsingContext.activate',{context});const p=await evaluate(context,`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);await raw('input.performActions',{context,actions:[{type:'pointer',id:'sample-mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',...p,origin:'viewport'},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});};
 const type=async(context,selector,text)=>{await click(context,selector);await raw('input.performActions',{context,actions:[{type:'key',id:'sample-keyboard',actions:[{type:'keyDown',value:'\uE009'},{type:'keyDown',value:'a'},{type:'keyUp',value:'a'},{type:'keyUp',value:'\uE009'},...[...text].flatMap(value=>[{type:'keyDown',value},{type:'keyUp',value}])]}]});};
 for(const provider of ['json','sqlite']){
  findings.stage=provider+' sign-in';
  await b.navigate(h.base+'/?provider='+provider+'&index=1');
  await b.click('a.open');let context=await wait(()=>sample(h.urls[provider]+'/sign-in/'));
  await wait(()=>evaluate(context,"document.readyState==='complete'&&!!document.querySelector('#membership-login [name=username]')"));
  await type(context,'#membership-login [name=username]','alice');await type(context,'#membership-login [name=password]',password);await click(context,'#membership-login button');
  await wait(()=>evaluate(context,"document.body.textContent.includes('Submission complete')"));
  findings.stage=provider+' Workspace navigation and editing';
  await b.navigate(h.base+'/?provider='+provider+'&index=3');
  await b.click('a.open');context=await wait(()=>sample(h.urls[provider]+'/backoffice/pages/workspace'));
  await wait(()=>evaluate(context,"document.readyState==='complete'"));
  const failure=await evaluate(context,"(()=>{try{const r=JSON.parse(document.querySelector('#json')?.textContent??document.body.textContent);return {code:r.code,message:r.message};}catch{return document.body.textContent.includes('HTTP.ORIGIN')?{code:'HTTP.ORIGIN',message:'Request origin rejected.'}:null;}})()");
  if(process.argv.includes('--reproduce')){assert.equal(failure?.code,'HTTP.ORIGIN');findings.providers.push({provider,reproduced:failure,serverReason:'Cross-site Fetch Metadata on canonical Page GET was rejected by the !isShell origin guard before authentication/rendering.'});continue;}
  assert.equal(failure,null,JSON.stringify(failure));
  await wait(()=>evaluate(context,"document.querySelectorAll('#workspace-editor form').length===2"));
  assert.equal(await evaluate(context,"document.querySelector('#workspace-editor form:first-of-type button').textContent"),'Load current state');
  await click(context,'#workspace-editor form:first-of-type button');await wait(()=>evaluate(context,"document.querySelector('#workspace-editor [aria-label=title]').value==='Workspace'"));
  const save='#workspace-editor form:last-of-type';
  await type(context,save+' [aria-label=title]','Navigation regression');await type(context,save+' [aria-label=body]','## Retained sample');await click(context,save+' [aria-label=columns]');await click(context,save+' input[type=checkbox][aria-label^=Confirm]');await click(context,save+' button');
  await wait(()=>evaluate(context,"document.querySelector('#workspace-editor').textContent.includes('Action completed.')&&!document.querySelector('#workspace-editor').textContent.includes('Working…')"));
  await raw('browsingContext.reload',{context,wait:'complete'});await wait(()=>evaluate(context,"document.querySelectorAll('#workspace-editor form').length===2"));await click(context,'#workspace-editor form:first-of-type button');
  await wait(()=>evaluate(context,"document.querySelector('#workspace-editor [aria-label=title]').value==='Navigation regression'"));
  assert.equal(await evaluate(context,"document.querySelector('#workspace-editor [aria-label=columns]').checked"),true);
  assert.equal(await evaluate(context,"document.querySelector('#workspace-editor [aria-label=body]').value"),'## Retained sample');
  findings.providers.push({provider,actualGuideLink:true,productionPageBindingLoadSave:true,reloadPersistence:true});
  const blocked=await b.evaluate(`fetch(${JSON.stringify(h.urls[provider]+'/backoffice/pages/workspace')}).then(()=>false,()=>true)`);assert.equal(blocked,true,'Cross-origin browser fetch must remain unreadable');
  // The guide CSP blocks that browser fetch before HTTP. Probe the independent
  // server boundary separately; do not mislabel it as a Firefox request.
  const denied=await fetch(h.urls[provider]+'/backoffice/pages/workspace',{headers:{Origin:h.base,'Sec-Fetch-Site':'cross-site','X-B6H-Probe':'origin-rejection'}});assert.equal(denied.status,403);assert.equal((await denied.json()).code,'HTTP.ORIGIN');
  await wait(()=>h.store.events.some(e=>e.type==='server-error'&&e.provider===provider&&e.reason==='origin-mismatch'));

 }
 for(const request of findings.requests.filter(r=>r.method==='POST')){assert.equal(request.origin,new URL(request.url).origin);assert.equal(request.fetchSite,'same-origin');assert.equal(request.status,200);}
 findings.serverRejections=h.store.events.filter(e=>e.type==='server-error').map(({provider,code,reason})=>({provider,code,reason}));
 findings.ok=true;delete findings.stage;
}finally{
 for(const fn of callbacks.reverse())await fn();await h?.stop();if(h)await cleanSession(path.dirname(h.metadata.evidence),{sessionHome});
 await fs.writeFile(path.join(artifacts,'navigation-result.json'),JSON.stringify(findings,null,2));console.log(JSON.stringify({artifacts,...findings},null,2));
}
