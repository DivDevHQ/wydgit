// Real local Chrome/Firefox qualification. No browser downloads, persistent user profile,
// production credentials, network mocks or public listeners.
import assert from 'node:assert/strict';
import {firefoxProtocol} from './firefox-protocol.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {installMembershipLogin} from '../test-support/backoffice.js';
import {modulesFixture} from '../test-support/backoffice-modules.js';
import {reviewFixture} from '../test-support/backoffice-enforcement.js';
import {createApp} from '../app.js';
const cleanup=[],t={after:fn=>cleanup.push(fn)},isFirefox=process.env.WYDCLIENT_BROWSER==='firefox',pointerOnly=isFirefox&&process.env.WYDCLIENT_FIREFOX_POINTER_ONLY==='1',browser=isFirefox?(process.env.WYDCLIENT_FIREFOX??'firefox'):(process.env.WYDCLIENT_CHROME??'google-chrome');
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-backoffice-browser-'));
console.log('Browser artifacts: '+artifacts);
let chrome,ws,sequence=0;const calls=new Map(),evidence={browser:execFileSync(browser,['--version'],{encoding:'utf8'}).trim(),viewports:[],checks:[],screenshots:[]};
try{
 const f=await modulesFixture(t);await installMembershipLogin(f);await reviewFixture(f);
 await f.gate.register({username:'reader',password:f.password,displayName:'Disposable reader'});
 const app=createApp({root:f.root,libraries:f.libraries,localHostname:'127.0.0.1'}),server=app.listen(0,'127.0.0.1');await once(server,'listening');
 cleanup.push(()=>app.shutdown(server));const base='http://127.0.0.1:'+server.address().port;
 if(isFirefox)server.on('request',(req,res)=>{if(req.url==='/backoffice/api/actions/invoke')res.once('finish',()=>console.log(JSON.stringify({qualification:'Firefox invocation',status:res.statusCode,originMatches:req.headers.origin===base,originNull:req.headers.origin==='null',fetchSite:req.headers['sec-fetch-site']})));});
 await fs.mkdir(path.join(f.root,'browser-profile'),{recursive:true});
 cleanup.push(()=>fs.rm(path.join(f.root,'browser-profile'),{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 if(isFirefox)await fs.writeFile(path.join(f.root,'browser-profile/user.js'),'user_pref("focusmanager.testmode", true);\n');
 chrome=spawn(browser,isFirefox?['--headless','--no-remote','--profile',path.join(f.root,'browser-profile'),'--remote-debugging-port=0','about:blank']:['--headless','--disable-gpu','--no-proxy-server','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+path.join(f.root,'browser-profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let stderr='';const timer=setTimeout(()=>reject(Error('Browser startup timeout')),15000);chrome.once('error',reject);chrome.once('exit',()=>{clearTimeout(timer);reject(Error('Browser exited before debugging endpoint'));});chrome.stderr.on('data',chunk=>{stderr+=chunk;const m=(isFirefox?/WebDriver BiDi listening on ws:\/\/127\.0\.0\.1:(\d+)/:/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//).exec(stderr);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});});
 const tabs=isFirefox?null:await(await fetch(endpoint+'/json/list')).json();ws=new WebSocket(isFirefox?endpoint.replace('http:','ws:')+'/session':tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data),entry=calls.get(m.id);if(entry){clearTimeout(entry.timer);calls.delete(m.id);m.error?entry.reject(Error(JSON.stringify(m.error))):entry.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{calls.delete(id);reject(Error(method+' timeout'));},15000);calls.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const cdp=isFirefox?await firefoxProtocol(send):send;
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error('Browser evaluation failed');return r.result.value;};
 const until=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}await shot('failed-condition');throw Error('Browser condition failed: '+expression);};
 const navigate=async(route,condition)=>{await cdp('Page.navigate',{url:base+route});await until(`document.readyState==='complete'&&(${condition})`);};
 const click=async selector=>{await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
 const key=async(key,code=key,windowsVirtualKeyCode=key==='Tab'?9:key==='Enter'?13:32)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r'}:{})});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});};
 const type=async(selector,text)=>{await click(selector);await cdp('Input.insertText',{text});};
 const shot=async(name,full=false)=>{const layout=full?(await cdp('Page.getLayoutMetrics')).cssContentSize:null;const {data}=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,...(layout?{clip:{x:0,y:0,width:layout.width,height:Math.min(2600,layout.height),scale:1}}:{})});await fs.writeFile(path.join(artifacts,name+'.png'),Buffer.from(data,'base64'));evidence.screenshots.push(name+'.png');};
 await cdp('Page.enable');await cdp('Network.enable');if(!isFirefox)await cdp('Accessibility.enable');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 const login=async username=>{await navigate('/sign-in/',"!!document.querySelector('#membership-login')");await type('#membership-login [name=username]',username);await type('#membership-login [name=password]',f.password);await click('#membership-login button');await until("document.body.textContent.includes('Submission complete')");await navigate('/backoffice',"document.getElementById('bo-status')?.textContent.includes('Select an action')||document.getElementById('bo-status')?.textContent.includes('No actions')");};
 await login('alice');assert.equal(await evaluate("document.querySelectorAll('nav button').length"),2);evidence.checks.push('Gate form login, authenticated shell and installed discovery');
 const cookies=(await cdp('Network.getCookies')).cookies;assert.ok(cookies.some(c=>c.name==='wydgit-auth'&&c.httpOnly));assert.equal(await evaluate('document.cookie.includes("wydgit-auth")'),false);
 // Use native key events to activate navigation and submit a genuine service call.
 if(isFirefox)await click('main h1');
 await evaluate("document.querySelector('nav button').focus()");if(pointerOnly)await click('nav button');else{assert.equal(await evaluate('document.hasFocus()'),true,'Native keyboard qualification requires document focus');await key('Enter');}await until("!!document.querySelector('form')");
 if(pointerOnly)await evaluate("document.querySelector('[aria-label=\"Include limit\"]').focus()");else await key('Tab');assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"),'Include limit');await click('[aria-label="Include limit"]');await type('[aria-label="limit"]','5');
 await evaluate("document.querySelector('button[type=submit]').focus()");if(pointerOnly)await click('button[type=submit]');else await key('Enter');await until("document.getElementById('bo-status').textContent==='Action completed.'");
 assert.equal(await evaluate("document.querySelectorAll('tbody tr').length"),2);assert.equal(await evaluate("document.querySelectorAll('th[scope=col]').length"),6);evidence.checks.push(pointerOnly?'Pointer navigation/invocation, real roster and DOM focus targets/table semantics; native keyboard unqualified':'Keyboard navigation and invocation, real member roster result, table semantics');
 await evaluate("document.querySelector('#bo-action h2').scrollIntoView({block:'start'})");await shot('member-roster');
 const audit=await evaluate(`(()=>({landmarks:{main:document.querySelectorAll('main').length,nav:document.querySelectorAll('nav[aria-label]').length},headings:document.querySelectorAll('main h1').length,unlabelled:[...document.querySelectorAll('input,select,textarea,button')].filter(e=>!e.disabled&&!e.getAttribute('aria-label')&&!e.labels?.length&&!e.textContent.trim()).length,status:document.querySelector('#bo-status').getAttribute('role')}))()`);
 assert.deepEqual(audit,{landmarks:{main:1,nav:1},headings:1,unlabelled:0,status:'status'});evidence.accessibility=audit;
 if(!isFirefox){const tree=await cdp('Accessibility.getFullAXTree');assert.ok(tree.nodes.some(n=>n.role?.value==='main'));assert.ok(tree.nodes.some(n=>n.role?.value==='table'));}evidence.checks.push(isFirefox?'Firefox DOM landmarks, native table semantics and labelled controls (no accessibility-tree claim)':'Chrome accessibility tree contains main and table; native controls have names');
 for(const [width,height] of [[360,800],[768,1024],[1280,900],[1920,1080],[320,800]]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const layout=await evaluate(`(()=>{const main=document.querySelector('main').getBoundingClientRect(),nav=document.querySelector('nav').getBoundingClientRect(),table=document.querySelector('.bo-table');return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,mainWidth:main.width,navWidth:nav.width,tableScrolls:table.scrollWidth>table.clientWidth,tableWidth:table.clientWidth,tableContentWidth:table.scrollWidth,columns:table.querySelectorAll('th').length};})()`);
  assert.ok(layout.documentWidth<=width+1,JSON.stringify(layout));assert.ok(layout.mainWidth>0&&layout.navWidth>0);evidence.viewports.push(layout);if(width===360){assert.equal(layout.tableScrolls,true,'Mobile roster must scroll within its named region');await evaluate("document.querySelector('.bo-table').focus()");if(pointerOnly){const p=await evaluate("(()=>{const r=document.querySelector('.bo-table').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+30)};})()");await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:200,deltaY:0});}else await key('ArrowRight','ArrowRight',39);await until("document.querySelector('.bo-table').scrollLeft>0");await evaluate("document.querySelector('.bo-table').scrollLeft=0");await shot('mobile',true);}
 }
 evidence.checks.push('360/768/1280/1920 responsive layout and 320 CSS-pixel reflow; wide table scroll remains local');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 for(const mode of ['light','dark','system']){
  await evaluate(`(()=>{const e=document.querySelector('#bo-theme');e.value=${JSON.stringify(mode)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  if(!isFirefox)await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate("document.documentElement.getAttribute('data-wyd-theme')"),mode);
  const colors=await evaluate("(()=>{const s=getComputedStyle(document.querySelector('main'));return Object.fromEntries(['paper','surface','ink','muted','link','primary','primary-text','focus','input-background','input-text','input-border'].map(k=>[k,s.getPropertyValue('--'+k).trim()]));})()");
  const lum=hex=>{if(hex.length===4)hex='#'+[...hex.slice(1)].map(c=>c+c).join('');const parts=hex.slice(1).match(/.{2}/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*parts[0]+.7152*parts[1]+.0722*parts[2];};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const contrasts=Object.fromEntries([['ink','paper'],['muted','paper'],['muted','surface'],['link','paper'],['primary-text','primary'],['input-text','input-background']].map(([a,b])=>[a+'/'+b,ratio(colors[a],colors[b])]));
  for(const value of Object.values(contrasts))assert.ok(value>=4.5,mode+' text contrast '+value);
  assert.ok(ratio(colors['input-border'],colors['input-background'])>=3,mode+' input border contrast');
  evidence.contrast??={};evidence.contrast[mode]=contrasts;
  const scheme=await evaluate("getComputedStyle(document.documentElement).colorScheme");assert.equal(scheme,mode==='system'?(isFirefox?(await evaluate("matchMedia('(prefers-color-scheme: dark)').matches")?'dark':'light'):'dark'):mode);
  if(mode!=='system')await shot('desktop-'+mode,true);
 }
 if(!isFirefox){await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});assert.equal(await evaluate("getComputedStyle(document.documentElement).colorScheme"),'light');}
 evidence.checks.push(isFirefox?'Explicit light/dark theme switching and actual system preference; no media emulation':'Light/dark theme switching and system dark preference; reduced-motion preference enabled');
 await click('nav button[data-action$="/list-notices"]');await type('[aria-label="store"]','operations');await type('[aria-label="collection"]','notices');await type('[aria-label="limit"]','5');
 await click('[aria-label="Include sort"]');await evaluate("document.querySelector('[aria-label=\"Add item to sort\"]').focus()");if(pointerOnly)await click('[aria-label="Add item to sort"]');else await key('Enter');await click('[aria-label="Add item to sort"]');assert.equal(await evaluate("document.querySelector('[aria-label=\"Add item to sort\"]').disabled"),true);
 await click('[aria-label="Remove sort item 1"]');await type('[aria-label="field"]','title');await type('[aria-label="direction"]','asc');await evaluate("document.querySelector('button[type=submit]').focus()");if(pointerOnly)await click('button[type=submit]');else await key('Enter');await until("document.getElementById('bo-status').textContent==='Action completed.'");assert.equal(await evaluate("document.querySelector('tbody').textContent.includes('Local qualification')"),true);
 evidence.checks.push(pointerOnly?'Independent notices module, pointer array add/remove/max and genuine sorted query':'Second independently installed Store module, native keyboard array add/remove/max and genuine sorted query through the same shell');
 await click('#bo-refresh');await until("document.getElementById('bo-status').textContent==='Select an action.'");assert.equal(await evaluate("document.activeElement.id"),'bo-refresh');assert.equal(await evaluate("document.querySelector('form')===null"),true);
 await click('nav button');await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['operations.notices.read']});await click('button[type=submit]');await until("document.getElementById('bo-status').textContent.includes('access has changed')");await shot('access-error');await click('#bo-refresh');await until("document.querySelectorAll('nav button').length===1");assert.equal(await evaluate("document.querySelector('nav button').textContent"),'Operational notices');
 evidence.checks.push('Refresh clears selection; revoked permission rejects real invocation and clears stale display');
 const logout=async()=>{await navigate('/sign-in/',"!!document.querySelector('#membership-logout')");await click('#membership-logout button');await until("document.body.textContent.includes('Submission complete')");assert.equal(await evaluate("fetch('/backoffice/api/actions').then(r=>r.status)"),401);};
 await logout();await login('reader');assert.equal(await evaluate("document.querySelectorAll('nav button').length"),0);assert.match(await evaluate("document.getElementById('bo-status').textContent"),/No actions/);await logout();
 evidence.checks.push('Gate logout revokes BackOffice; valid member without administrative permission sees zero actions');
 if(isFirefox){await login('alice');const realNow=Date.now,expired=realNow()+86400001;try{Date.now=()=>expired;await click('#bo-refresh');await until("document.getElementById('bo-status').getAttribute('role')==='alert'");assert.equal(await evaluate("fetch('/backoffice/api/actions').then(r=>r.status)"),401);}finally{Date.now=realNow;}evidence.checks.push('Controlled session expiry rejects refresh, announces an alert and denies discovery');}
 evidence.limitations=pointerOnly?['Firefox headless document focus unavailable: native keyboard and accessibility-tree qualification remain open','System preference observed only; no Firefox media emulation','No human assistive-technology or actual zoom/touch qualification']:[];
 evidence.ok=true;await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({ok:true,artifacts,...evidence},null,2));
}finally{
 ws?.close();for(const entry of calls.values())clearTimeout(entry.timer);
 if(chrome){chrome.kill('SIGTERM');await new Promise(r=>{if(chrome.exitCode!==null)r();else{chrome.once('exit',r);setTimeout(()=>{chrome.kill('SIGKILL');r();},3000).unref();}});}
 for(const fn of cleanup.reverse())await fn();
}
