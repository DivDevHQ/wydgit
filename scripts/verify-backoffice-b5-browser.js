// Real installed canonical Pages and browser intents; no mocked HTTP or runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {b5RecordsFixture,b5TaskboardFixture,b5Http} from '../test-support/backoffice-b5.js';
import {mountB5IntentClient} from '../test-support/backoffice-b5-browser-client.js';
import {localBrowser} from '../test-support/local-browser.js';
const firefox=process.env.WYDCLIENT_BROWSER==='firefox',pointerOnly=firefox&&process.env.WYDCLIENT_FIREFOX_POINTER_ONLY==='1';
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-backoffice-b5-browser-'));
console.log('Browser artifacts: '+artifacts);
const evidence={ok:false,firefox,pointerOnly,providers:[],limitations:['Human assistive technology, speech, actual zoom/forced-colors/touch remain unverified.','Bound intent integration uses an explicit trusted test client, not a shipped frozen WydClient feature.']};
try{
 for(const provider of ['json','sqlite']){
  const cleanup=[],t={after:fn=>cleanup.push(fn)};
  try{
   const f=await b5RecordsFixture(t,provider),h=await b5Http(t,f),b=await localBrowser(t,f.root,{firefox});
   evidence.browser=b.version;const {evaluate:ev,until,navigate,click,key,type}=b,checks=[];
   const visit=route=>navigate(h.base+route);
   const tabTo=async selector=>{for(let i=0;i<50;i++){if(await ev(`document.activeElement.matches(${JSON.stringify(selector)})`))return;await key('Tab');}throw Error('Native Tab could not reach '+selector);};
   const enterText=async(selector,text)=>{if(firefox)await type(selector,text);else{await tabTo(selector);await b.protocol('Input.insertText',{text});}};
   const activate=async selector=>{if(firefox)await click(selector);else{await tabTo(selector);await key('Enter');}};
   await visit('/backoffice/pages/records');assert.match(await ev('document.body.textContent'),/HTTP.AUTHENTICATION/);
   await visit('/sign-in/');await enterText('#membership-login [name=username]','alice');await enterText('#membership-login [name=password]',f.password);await activate('#membership-login button');await until("document.body.textContent.includes('Submission complete')");
   assert.equal(await ev('document.cookie.includes("wydgit-auth")'),false);
   await visit('/backoffice/pages/records');assert.equal(await ev("!!document.querySelector('#b5-create')"),true);
   assert.equal(await ev('document.querySelectorAll("main h1").length'),1);
   await ev(`(${mountB5IntentClient.toString()})()`);
   if(!pointerOnly)assert.equal(await ev('document.hasFocus()'),true,'Native keyboard qualification requires actual document focus');
   checks.push('Real Gate form login, HttpOnly session, canonical installed Page with approved read preparation');
   // Error association is emitted by the existing native semantic Form renderer.
   const audit=await ev(`(()=>({main:document.querySelectorAll('main').length,headings:[...document.querySelectorAll('main h1,main h2')].map(e=>e.textContent),unnamed:[...document.querySelectorAll('main input:not([type=hidden]),main button')].filter(e=>!(e.labels?.length||e.getAttribute('aria-label')||e.textContent.trim())).length,errors:[...document.querySelectorAll('main [aria-invalid=true]')].every(e=>!!document.getElementById(e.getAttribute('aria-describedby'))),dialogs:document.querySelectorAll('dialog,[role=dialog]').length}))()`);
   assert.equal(audit.main,1);assert.equal(audit.unnamed,0);assert.equal(audit.errors,true);assert.equal(audit.dialogs,0);
   if(!firefox){await b.protocol('Accessibility.enable');const tree=await b.protocol('Accessibility.getFullAXTree');assert.ok(tree.nodes.some(n=>n.role?.value==='main'));assert.ok(tree.nodes.some(n=>n.role?.value==='textbox'&&n.name?.value.includes('Record ID')));}
   if(!firefox){
    await tabTo('a.skip');assert.ok(await ev("document.activeElement.getBoundingClientRect().top>=0"));await key('Enter');
    await activate('#b5-create button');assert.equal(await ev("document.activeElement.name"),'id');
    assert.equal(await ev("document.activeElement.validity.valueMissing"),true);assert.equal(await ev("document.querySelector('#b5-create').dataset.httpStatus"),undefined);
    checks.push('Keyboard-only login, skip link and native invalid-required submission with linked errors and no HTTP mutation');
   }
   await enterText('#b5-create [name=id]','browser-record');await enterText('#b5-create [name=text]','Browser persisted record');
   const focus=[];
   if(pointerOnly)await click('#b5-create [name=confirmed]');else{
    await key('Tab');focus.push(await ev('document.activeElement.name'));assert.equal(focus.at(-1),'confirmed');await key(' ','Space');
    await key('Tab');focus.push(await ev('document.activeElement.textContent'));assert.equal(focus.at(-1),'Create record');
    if(!firefox){await key('Tab','Tab',9,8);assert.equal(await ev('document.activeElement.name'),'confirmed');await key('Tab');}
    const indicator=await ev("(()=>{const s=getComputedStyle(document.activeElement);return {style:s.outlineStyle,width:parseFloat(s.outlineWidth),color:s.outlineColor};})()");assert.notEqual(indicator.style,'none');assert.ok(indicator.width>=2);checks.push('Native Tab order text → confirmation → submit, Space confirmation, visible focus outline');
   }
   if(pointerOnly)await click('#b5-create button');else await key('Enter');
   await until("document.querySelector('#b5-create').dataset.pending==='false'");
   assert.equal(await ev("document.querySelector('#b5-create').dataset.httpStatus"),'200');assert.equal(await ev("document.querySelector('#b5-create').dataset.outcome"),'completed');assert.equal(await ev("document.querySelector('#b5-status').textContent"),'Record created.');
   checks.push('Native semantic form submits exact published binding, real CSRF, explicit confirmation and protected create');
   const layouts=[],contrast={};
   const luminance=c=>{const [r,g,b]=c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
   const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
   for(const mode of ['light','dark']){
    await ev(`document.documentElement.setAttribute('data-wyd-theme',${JSON.stringify(mode)})`);
    const colors=await ev("(()=>{const main=getComputedStyle(document.querySelector('main')),field=getComputedStyle(document.querySelector('[name=text]')),button=getComputedStyle(document.querySelector('#b5-create button'));return {ink:main.color,paper:main.backgroundColor,input:field.color,background:field.backgroundColor,button:button.color,buttonBackground:button.backgroundColor};})()");
    // Main may be transparent; its inherited paper comes from the body skin.
    colors.paper=await ev("getComputedStyle(document.body).backgroundColor");
    contrast[mode]={text:ratio(colors.ink,colors.paper),input:ratio(colors.input,colors.background),button:ratio(colors.button,colors.buttonBackground)};
    for(const value of Object.values(contrast[mode]))assert.ok(value>=4.5,mode+' measured text contrast '+value);
    await b.screenshot(path.join(artifacts,provider+'-'+mode+'.png'));
   }
   for(const [width,height] of [[320,800],[360,800],[768,1024],[1280,900]]){
    await b.protocol('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    const layout=await ev('({width:innerWidth,documentWidth:document.documentElement.scrollWidth})');assert.ok(layout.documentWidth<=width+1,JSON.stringify(layout));layouts.push(layout);
    if(width===360){const file=path.join(artifacts,provider+'-mobile.png');await b.screenshot(file);const png=await fs.readFile(file),pixels=png.readUInt32BE(16);assert.ok(pixels>=340&&pixels<=360,'Mobile capture must reflect the measured viewport, got '+pixels);}
   }
   await b.protocol('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
   // A current Page and retained descriptor do not preserve revoked action authority.
   await ev("document.querySelector('[name=id]').value='browser-denied'");await f.grant(['content.pages.view','content.action.read','content.records.read']);
   if(pointerOnly)await click('#b5-create button');else{await ev("document.querySelector('#b5-create button').focus()");await key('Enter');}
   await until("document.querySelector('#b5-create').dataset.pending==='false'&&document.querySelector('#b5-create').dataset.httpStatus==='403'");
   assert.equal(await ev("document.querySelector('#b5-status').getAttribute('role')"),'alert');
   await f.grant(f.permissions);
   // Genuine canonical navigation and approved detail binding; no native Store read.
   await click('main a[href="/backoffice/pages/records#b5-create"]');await until("location.hash==='#b5-create'&&document.readyState==='complete'");
   // Reload through the real approved preparation to observe stored content.
   await visit('/backoffice/pages/records');assert.match(await ev("document.querySelector('#b5-records').textContent"),/browser-record.*Browser persisted record/);
   const reads=await ev(`(async()=>{const bindings=JSON.parse(document.querySelector('meta[name="wydgit-backoffice-bindings"]').content),csrf=document.querySelector('meta[name="wydgit-backoffice-csrf"]').content;const rows=[];for(const id of ['browser-record','browser-denied']){const r=await fetch('/backoffice/api/actions/invoke',{method:'POST',headers:{'Content-Type':'application/json','X-Wydgit-CSRF':csrf},body:JSON.stringify({pageBinding:bindings.find(b=>b.name==='get'),input:{id}})});rows.push({status:r.status,body:await r.json()});}return rows;})()`);
   assert.equal(reads[0].status,200);assert.equal(reads[0].body.value.data.text,'Browser persisted record');assert.equal(reads[0].body.value.version,1);assert.equal(reads[1].status,400);
   checks.push('Retained intent after live action/service revocation denied; independent detail binding proves one success and absent denied record');
   await f.grant(f.storePermissions);await visit('/backoffice/pages/records');assert.match(await ev('document.body.textContent'),/PAGE.DENIED/);
   await f.grant(f.permissions);await visit('/backoffice/pages/missing');assert.match(await ev('document.body.textContent'),/PAGE.NOT_FOUND/);
   await visit('/administration/');assert.equal(await ev("!!document.querySelector('#b5-create')"),false);
   await visit('/backoffice/pages/records?app=forged');assert.match(await ev('document.body.textContent'),/HTTP.REQUEST/);
   await visit('/backoffice/pages/records');await f.gate.logout(f.login.token);
   // Browser login used its own real Session, separate from fixture's native one.
   const realNow=Date.now;try{Date.now=()=>realNow()+86400001;await visit('/backoffice/pages/records');assert.match(await ev('document.body.textContent'),/HTTP.AUTHENTICATION/);}finally{Date.now=realNow;}
   checks.push('Missing/unauthorized Page, public alternate ingress, forged query and expired genuine browser Session denied');
   await h.stop();await f.place('retire');const retired=await b5Http(t,f);
   await navigate(retired.base+'/sign-in/');await type('#membership-login [name=username]','alice');await type('#membership-login [name=password]',f.password);await click('#membership-login button');await until("document.body.textContent.includes('Submission complete')");
   await navigate(retired.base+'/backoffice/pages/records');assert.match(await ev('document.body.textContent'),/PAGE.NOT_FOUND/);await retired.stop();
   await f.place('replace');await f.publish();const replacement=await b5Http(t,f);await navigate(replacement.base+'/backoffice/pages/records');assert.equal(await ev("!!document.querySelector('#b5-create')"),true);
   const reload=await ev(`(async()=>{const s=await fetch('/backoffice/api/actions');const d=await s.json(),a=d.value.actions.find(a=>a.name==='get');const r=await fetch('/backoffice/api/actions/invoke',{method:'POST',headers:{'Content-Type':'application/json','X-Wydgit-CSRF':d.csrf},body:JSON.stringify({reference:a.reference,input:{store:'records',collection:'records',id:'browser-record'}})});return {status:r.status,value:(await r.json()).value};})()`);assert.equal(reload.status,200);assert.equal(reload.value.version,1);
   checks.push('Stopped retirement removes Page; fresh replacement/review/restart retains exactly one persisted mutation');
   evidence.providers.push({provider,checks,audit,focus,layouts,contrast,mutation:{createdVersion:1,deniedAbsent:true,restartVersion:1}});
  }finally{for(const fn of cleanup.reverse())await fn();}
 }
 const cleanup=[],t={after:fn=>cleanup.push(fn)};
 try{
  const f=await b5TaskboardFixture(t),h=await b5Http(t,f),b=await localBrowser(t,f.root,{firefox});
  await b.navigate(h.base+'/sign-in/');await b.type('#membership-login [name=username]','alice');await b.type('#membership-login [name=password]',f.password);await b.click('#membership-login button');await b.until("document.body.textContent.includes('Submission complete')");
  await b.navigate(h.base+'/backoffice/pages/taskboard');
  assert.match(await b.evaluate('document.body.textContent'),/Verify lifecycle cleanup/);assert.doesNotMatch(await b.evaluate('document.body.textContent'),/Write WBasic/);
  assert.deepEqual(await b.evaluate("JSON.parse(document.querySelector('meta[name=wydgit-backoffice-bindings]').content)"),[]);
  await b.screenshot(path.join(artifacts,'taskboard.png'));evidence.taskboard={canonicalRoute:'/backoffice/pages/taskboard',installed:true,informational:true,bindings:0,repeatedChildrenRendered:true};
 }finally{for(const fn of cleanup.reverse())await fn();}
 evidence.ok=true;
}finally{await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({artifacts,...evidence},null,2));}
