// Genuine installed application and production web adapter; no injected client,
// intercepted response, fabricated cookie, DOM-dispatched keyboard or pointer fallback.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {b6Fixture,b6ModulesFixture} from '../test-support/backoffice-b6.js';
import {b5Http} from '../test-support/backoffice-b5.js';
import {localBrowser} from '../test-support/local-browser.js';
const firefox=process.env.WYDCLIENT_BROWSER==='firefox',pointerOnly=process.env.WYDCLIENT_FIREFOX_POINTER_ONLY==='1';
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-backoffice-b6-browser-'));
const evidence={ok:false,firefox,pointerOnly,headful:process.env.WYDCLIENT_HEADFUL==='1',providers:[],humanAT:false,limitations:['Human AT, actual zoom, forced colors and touch remain unqualified. No dialog/modal is introduced.']};
console.log('Browser artifacts: '+artifacts);
try{for(const provider of ['json','sqlite']){
 const cleanup=[],t={after:fn=>cleanup.push(fn)};
 try{
  const f=await b6Fixture(t,provider),h=await b5Http(t,f),b=await localBrowser(t,f.root,{firefox});const {evaluate:ev,until,key}=b;
  evidence.browser=b.version;
  const visit=route=>b.navigate(h.base+route);
  const tabTo=async selector=>{for(let n=0;n<150;n++){if(await ev(`document.activeElement.matches(${JSON.stringify(selector)})`))return;await key('Tab');}throw Error('Native Tab cannot reach '+selector);};
  const activate=async selector=>{if(pointerOnly)await b.click(selector);else{await tabTo(selector);await key('Enter');}};
  const enter=async(selector,text)=>{if(pointerOnly)await b.click(selector);else await tabTo(selector);await key('a','KeyA',65,2);await b.protocol('Input.insertText',{text});};
  const waitReady=()=>until("!document.querySelector('.bo-controls[aria-busy=true]')");
  const load='#workspace-editor form:first-of-type button',save='#workspace-editor form:nth-of-type(2)';
  await visit('/sign-in/');evidence.initialFocus=await ev('({hasFocus:document.hasFocus(),hidden:document.hidden,active:document.activeElement.tagName})');
  if(!pointerOnly)assert.equal(evidence.initialFocus.hasFocus,true,'Native keyboard prerequisite: genuine document focus before login');
  await enter('#membership-login [name=username]','alice');await enter('#membership-login [name=password]',f.password);await activate('#membership-login button');await until("document.body.textContent.includes('Submission complete')");
  assert.equal(await ev('document.cookie.includes("wydgit-auth")'),false);
  await visit('/backoffice/pages/workspace');await until("document.querySelectorAll('#workspace-editor form').length===2");
  if(!pointerOnly)assert.equal(await ev('document.hasFocus()'),true,'Native keyboard prerequisite on canonical Page');
  const disabled=await ev(`document.querySelector(${JSON.stringify(save+' > fieldset')}).disabled`);assert.equal(disabled,true);
  if(!pointerOnly){await tabTo('a.skip');await key('Enter');}
  await activate(load);await waitReady();assert.equal(await ev(`document.querySelector(${JSON.stringify(save+' [aria-label=version]')}).value`),'1');
  assert.equal(await ev(`document.querySelector(${JSON.stringify(save+' > fieldset')}).disabled`),false);
  // Native validation and linked error focus; no browser-provided hidden resource.
  await enter(save+' [aria-label=version]','0');await activate(save+' button');await until("!!document.querySelector('[aria-invalid=true]')");
  assert.equal(await ev('document.activeElement.getAttribute("aria-label")'),'version');
  assert.equal(await ev('!!document.getElementById(document.activeElement.getAttribute("aria-describedby").split(" ").at(-1))'),true);
  await enter(save+' [aria-label=version]','1');await enter(save+' [aria-label=title]','Browser layout');
  await enter(save+' textarea','## Browser content\n\nSaved **Markdown**. <script>window.untrusted=true</script>');
  const check=save+' [aria-label=columns]',confirm=save+' [aria-label^=Confirm]';
  if(pointerOnly)await b.click(check);else{await tabTo(check);await key(' ','Space');}
  if(pointerOnly)await b.click(confirm);else{await tabTo(confirm);await key(' ','Space');await key('Tab');assert.equal(await ev('document.activeElement.textContent'),'Save changes');await key('Tab','Tab',9,8);assert.equal(await ev('document.activeElement.getAttribute("aria-label")'),'Confirm Workspace properties and content');}
  await activate(save+' button');await waitReady();assert.equal(await ev(`document.querySelector(${JSON.stringify(save+' [aria-label=version]')}).value`),'2');
  assert.equal(await ev(`document.querySelector(${JSON.stringify(confirm)}).checked`),false);
  assert.equal(await ev('document.activeElement.textContent'),'Result');
  await activate('#workspace-dashboard button');await waitReady();assert.match(await ev("document.querySelector('#workspace-dashboard').textContent"),/Browser layout/);
  assert.equal(await ev("document.querySelectorAll('#workspace-dashboard th[scope=col]').length"),3);
  await visit('/backoffice/pages/workspace');await until("document.querySelectorAll('#workspace-editor form').length===2");assert.match(await ev("document.querySelector('#workspace-preview').className"),/wyd-layout-columns/);assert.equal(await ev("document.querySelector('#workspace-body strong').textContent"),'Markdown');assert.equal(await ev('window.untrusted'),undefined);
  await activate(load);await waitReady();
  // Independent HTTP writer changes the stored revision after editor load.
  const current=await ev("JSON.parse(document.querySelector('meta[name=wydgit-backoffice-bindings]').content)"),csrf=await ev("document.querySelector('meta[name=wydgit-backoffice-csrf]').content");
  const data={title:'Concurrent change',columns:false,body:'Concurrent content'};
  const nativeHtml=await (await h.get('/backoffice/pages/workspace')).text();const nativeCsrf=/<meta name="wydgit-backoffice-csrf" content="([^"]+)"/.exec(nativeHtml)[1];
  const other=await h.post({pageBinding:current.find(b=>b.name==='save'),input:{version:2,data},confirmed:true},nativeCsrf);assert.equal(other.status,200);
  if(pointerOnly)await b.click(confirm);else{await tabTo(confirm);await key(' ','Space');}await activate(save+' button');await waitReady();
  assert.equal(await ev(`document.querySelector(${JSON.stringify(save+' > fieldset')}).disabled`),true);assert.match(await ev("document.querySelector('#workspace-editor [role=alert]').textContent"),/may have taken effect/);
  await activate(load);await waitReady();assert.equal(await ev(`document.querySelector(${JSON.stringify(save+' [aria-label=version]')}).value`),'3');
  const focus=await ev('({active:document.activeElement.textContent,outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth})');
  if(!pointerOnly){assert.equal(focus.outline,'solid');assert.ok(parseFloat(focus.width)>=2);}
  const layouts=[];for(const width of [320,360,768,1280]){await b.protocol('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});const layout=await ev('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(layout.scroll<=width+1,JSON.stringify(layout));layouts.push(layout);if(width===360){const file=path.join(artifacts,provider+'-mobile.png');await b.screenshot(file);const png=await fs.readFile(file);assert.ok(png.readUInt32BE(16)>=340&&png.readUInt32BE(16)<=360,'Mobile PNG must match measured viewport');}}
  const contrast={};const lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>(n/=255)<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
  for(const mode of ['light','dark']){await ev(`document.documentElement.setAttribute('data-wyd-theme',${JSON.stringify(mode)})`);const c=await ev(`(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(save+' textarea')}));return {ink:s.color,paper:s.backgroundColor};})()`);const a=lum(c.ink),z=lum(c.paper);contrast[mode]=(Math.max(a,z)+.05)/(Math.min(a,z)+.05);assert.ok(contrast[mode]>=4.5);await b.screenshot(path.join(artifacts,provider+'-'+mode+'.png'));}
  const audit=await ev("({main:document.querySelectorAll('main').length,unnamed:[...document.querySelectorAll('.bo-controls input,.bo-controls textarea,.bo-controls button')].filter(e=>!(e.getAttribute('aria-label')||e.labels?.length||e.textContent.trim())).length,dialogs:document.querySelectorAll('dialog,[role=dialog]').length})");assert.equal(audit.main,1);assert.equal(audit.unnamed,0);assert.equal(audit.dialogs,0);
  if(!firefox){const tree=await b.protocol('Accessibility.getFullAXTree');assert.ok(tree.nodes.some(n=>n.role?.value==='textbox'&&n.name?.value==='body'));}
  await f.grant(['content.pages.view','content.workspace.read']);if(pointerOnly)await b.click(confirm);else{await tabTo(confirm);await key(' ','Space');}await activate(save+' button');await waitReady();assert.equal(await ev('document.activeElement.textContent'),'Reload Page');
  assert.equal(await ev(`document.querySelector(${JSON.stringify(save+' > fieldset')}).disabled`),true);
  await f.grant(f.permissions);await visit('/backoffice/pages/workspace');await until("document.querySelectorAll('#workspace-editor form').length===2");await activate(load);await waitReady();assert.equal(await ev(`document.querySelector(${JSON.stringify(save+' [aria-label=version]')}).value`),'3');assert.equal(await ev(`document.querySelector(${JSON.stringify(save+' [aria-label=title]')}).value`),'Concurrent change');
  const now=Date.now;try{Date.now=()=>now()+86400001;await activate('#workspace-dashboard button');await waitReady();assert.equal(await ev('document.activeElement.textContent'),'Reload Page');}finally{Date.now=now;}
  evidence.providers.push({provider,reviewPlanBytes:f.reviewBytes,productionClient:true,keyboardOnly:!pointerOnly,disabledUntilLoad:disabled,revision:3,deniedMutationAbsent:true,conflictRequiresReload:true,audit,layouts,contrast,focus,checks:[pointerOnly?'pointer login (skip link not keyboard-qualified)':'native login and skip link','typed load/edit/save with Markdown and layout persistence','linked validation and focus recovery',pointerOnly?'confirmation consumption (no keyboard qualification)':'confirmation consumption and Shift-Tab','explicit dashboard refresh/table','concurrent revision conflict, reload and retained values','live revocation and expiry disable with focused recovery']});
 }finally{for(const fn of cleanup.reverse())await fn();}
}
 const cleanup=[],t={after:fn=>cleanup.push(fn)};
 try{
  const f=await b6ModulesFixture(t),h=await b5Http(t,f),b=await localBrowser(t,f.root,{firefox}),{evaluate:ev,until,key}=b;
  const tabTo=async selector=>{for(let n=0;n<150;n++){if(await ev(`document.activeElement.matches(${JSON.stringify(selector)})`))return;await key('Tab');}throw Error('Native Tab cannot reach '+selector);};
  const activate=async selector=>{if(pointerOnly)await b.click(selector);else{await tabTo(selector);await key('Enter');}};
  await b.navigate(h.base+'/sign-in/');
  for(const [name,value]of [['username','alice'],['password',f.password]]){const selector='#membership-login [name='+name+']';if(pointerOnly)await b.click(selector);else await tabTo(selector);await b.protocol('Input.insertText',{text:value});}
  await activate('#membership-login button');await until("document.body.textContent.includes('Submission complete')");
  evidence.modules=[];
  for(const page of ['members','notices']){await b.navigate(h.base+'/backoffice/pages/'+page);await until("!!document.querySelector('.bo-controls form')");await activate('.bo-controls button[type=submit]');await until("!!document.querySelector('.bo-controls h3')");const text=await ev("document.querySelector('.bo-controls').textContent");assert.match(text,page==='members'?/administratoractive/:/Local qualification/);evidence.modules.push({page,productionClient:true,keyboardOnly:!pointerOnly,actualServiceResult:true});}
 }finally{for(const fn of cleanup.reverse())await fn();}
 evidence.ok=true;}finally{await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({artifacts,...evidence},null,2));}
