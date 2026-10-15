// Real Chrome acceptance through native CDP mouse/keyboard input. Never distributed.
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,extname,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {signClientPackage} from '../../wydgine/wydbasic/client-package.js';
const root=fileURLToPath(new URL('./',import.meta.url)),pkg=JSON.parse(await readFile(root+'package.json')),bundle='/dist/wydgit-client-'+pkg.version+'.min.js';
const policyText=await readFile(root+'examples/interactive-host.js','utf8'),localRegistry=JSON.parse(await readFile(root+'examples/interactive/registry.json')),packageText=await readFile(root+'examples/interactive/package.json','utf8');
const signed=signClientPackage({payload:JSON.parse(packageText),registry:localRegistry,integrity:'sha256-'+createHash('sha256').update(packageText).digest('base64')},{privateKey:generateKeyPairSync('ed25519').privateKey,keyId:'ephemeral-chrome',url:'/examples/interactive/package.json'});
const signedHost=`globalThis.WydClientConfig={trustedKeys:${JSON.stringify([signed.key])},execution:{publisher:'divdev',package:'divdev/taskboard-client',packageVersion:'0.1.0',installation:'chrome-signed',actions:['nextpage','submittask','cleartasks'],capabilities:['object.instances.edit','object.instances.construct','event.custom.raise'],traversal:['children'],visible:['taskboard','taskboard-*'],editable:['taskboard','taskboard-*'],scopes:{prototypes:['divdev/task-card'],events:['pagechanged']}}};`;
const signedHTML=`<!doctype html><html><head><meta charset="utf-8"><title>Signed native Taskboard</title><link rel="wydgit-manifest" href="/signed-registry.json"><script src="/signed-host.js"></script><script defer src="${bundle}"></script></head><body><main id="host-content">Signed package host</main></body></html>`;
const artifacts=new Set(),server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
 const dynamic={'/signed.html':['text/html',signedHTML],'/signed-host.js':['text/javascript',signedHost],'/signed-registry.json':['application/json',JSON.stringify(signed.registry)]};
 if(dynamic[path]){res.setHeader('Content-Type',dynamic[path][0]);res.end(dynamic[path][1]);return;}
 if(path.startsWith('/dist/'))artifacts.add(path);
 const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(404);res.end();return;}
 try{res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.html':'text/html'})[extname(file)]??'text/plain');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,profile=await mkdtemp(join(tmpdir(),'wydclient-h4-chrome-')),browser=process.env.WYDCLIENT_CHROME??'google-chrome';
let chromeProcess,ws;const calls=new Map();let sequence=0;
try{
 chromeProcess=spawn(browser,['--headless','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let stderr='';const timer=setTimeout(()=>reject(Error('Chrome debugging endpoint timeout')),15000);chromeProcess.once('error',reject);chromeProcess.stderr.on('data',chunk=>{stderr+=chunk;const m=/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(stderr);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});});
 const tabs=await (await fetch(endpoint+'/json/list')).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data),entry=calls.get(m.id);if(entry){clearTimeout(entry.timer);calls.delete(m.id);m.error?entry.reject(Error(JSON.stringify(m.error))):entry.resolve(m.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{calls.delete(id);reject(Error(method+' timed out'));},15000);calls.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 const until=async expression=>{for(let i=0;i<120;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error('Condition did not complete: '+expression);};
 const click=async selector=>{const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
 const key=async(value,code,vk,modifiers=0)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:value,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers,...(value==='Enter'?{text:'\r'}:{})});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:value,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers});};
 const type=async(selector,value)=>{await click(selector);await key('a','KeyA',65,2);await cdp('Input.insertText',{text:value});};
 const field=n=>`[name="${n}"]`,control=n=>`[data-wydclient-control="${n}"]`;
 await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 const timings=[];
 for(const path of ['/examples/interactive.html','/signed.html']){
  artifacts.clear();const start=Date.now();await cdp('Page.navigate',{url:origin+path});await until("globalThis.WydClient?.state==='ready'&&document.querySelector('form')");const bootstrapMs=Date.now()-start;
  assert.deepEqual([...artifacts],[bundle]);assert.equal(await evaluate("document.querySelector('form').getAttribute('aria-label')"),'NewTask');
  const action=Date.now();await click(control('Next'));await until("document.body.textContent.includes('Verify lifecycle cleanup')&&!document.body.textContent.includes('Write WBasic')");const navigationMs=Date.now()-action;
  await click(control('Save'));await until("document.querySelector('form [role=alert]')");assert.equal(await evaluate("document.querySelector('[name=Title]').getAttribute('aria-invalid')"),'true');
  await type(field('Title'),'Keyboard task');await key('Enter','Enter',13);await until("document.body.textContent.includes('Added: Keyboard task')");assert.equal(await evaluate("document.querySelector('[name=Title]').value"),'');
  await type(field('Title'),'Mouse task');await type(field('Notes'),'Native textarea');await click(field('Complete'));await click(field('State'));await key('End','End',35);await key('Enter','Enter',13);assert.equal(await evaluate("document.querySelector('[name=State]').value"),'Complete');assert.equal(await evaluate("document.querySelector('[name=Complete]').checked"),true);await click(control('Save'));await until("document.body.textContent.includes('Added: Mouse task Native textarea')");
  assert.ok(await evaluate("[...document.querySelectorAll('label')].some(e=>e.textContent.includes('Task title')&&e.querySelector('input'))"));
  await type(field('Title'),'Retained draft');await click(control('Next'));await until("document.body.textContent.includes('Write WBasic')");assert.equal(await evaluate("document.querySelector('[name=Title]').value"),'Retained draft');await click(control('Reset'));assert.equal(await evaluate("document.querySelector('[name=Title]').value"),'');
  await evaluate('WydClient.execution().unload()');assert.equal(await evaluate("document.querySelector('[data-wydclient-control=Next]').disabled"),true);await evaluate('WydClient.execution().activate()');await click(control('Next'));await until("document.body.textContent.includes('Verify lifecycle cleanup')");
  timings.push({path,bootstrapMs,navigationMs});console.log('PASS '+path+': native mouse, keyboard Enter, validation, all fields, rerender drafts, reset and lifecycle');
 }
 artifacts.clear();await cdp('Page.navigate',{url:origin+'/examples/interactive-embedded.html'});await until("globalThis.taskboards?.length===2&&taskboards.every(h=>h.state==='ready')");assert.deepEqual([...artifacts],[bundle]);
 await type('#first '+field('Title'),'First draft');await type('#second '+field('Title'),'Second draft');await click('#first '+control('Next'));await until("document.querySelector('#first').textContent.includes('Verify lifecycle cleanup')");assert.ok(await evaluate("document.querySelector('#second').textContent.includes('Write WBasic')"));assert.equal(await evaluate("document.querySelector('#second [name=Title]').value"),'Second draft');
 await evaluate("globalThis.oldButton=document.querySelector('#first [data-wydclient-control=Next]');taskboards[0].unmount()");await click('#second '+control('Save'));await until("document.querySelector('#second').textContent.includes('Added: Second draft')");
 await evaluate("taskboards[0]=WydClient.mount({root:document.querySelector('#first'),policy:interactivePolicy});taskboards[0].ready()");await until("taskboards[0].state==='ready'");await evaluate('oldButton.click()');assert.ok(await evaluate("document.querySelector('#first').textContent.includes('Write WBasic')"));assert.equal(await evaluate("document.querySelector('#first [name=Title]').value"),'');await evaluate('taskboards.forEach(h=>h.unmount())');assert.equal(await evaluate("document.querySelectorAll('form').length"),0);
 console.log('PASS embedded: independent drafts/actions, survivor, remount and stale controls');console.log(execFileSync(browser,['--version'],{encoding:'utf8'}).trim());console.log(JSON.stringify({fixtures:3,timings}));
}finally{
 ws?.close();for(const c of calls.values()){clearTimeout(c.timer);c.reject(Error('Closed'));}if(chromeProcess){chromeProcess.kill('SIGTERM');await new Promise(r=>{if(chromeProcess.exitCode!==null)r();else{chromeProcess.once('exit',r);setTimeout(()=>{chromeProcess.kill('SIGKILL');r();},3000).unref();}});}await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});
}
