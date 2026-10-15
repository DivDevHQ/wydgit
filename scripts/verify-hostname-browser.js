// Local-only real Chrome + TLS proxy acceptance. No deployed credentials/certificates.
import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createMultiAppHost} from '../wydgine/multi-app.js';
import {provisionHostnameExample} from '../examples/hostname-host/setup.js';
import {installTaskboards} from '../examples/hostname-host/taskboards.js';
const root=await fs.mkdtemp(path.join(tmpdir(),'wyd-routing-browser-')),browser=process.env.WYDCLIENT_CHROME??'google-chrome';
let host,proxy,chromeProcess,ws;const calls=new Map();let sequence=0;
try{
 const config=await provisionHostnameExample(root),execution=await installTaskboards(root);
 const profile=path.join(root,'chrome');await fs.mkdir(profile);
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(root,'key.pem'),'-out',path.join(root,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:alpha.localhost,DNS:beta.localhost,DNS:soon.localhost'],{stdio:'ignore'});
 let upstream;
 // Test reverse proxy strips all visitor proxy metadata; derives scheme from its own TLS socket.
 proxy=https.createServer({key:await fs.readFile(path.join(root,'key.pem')),cert:await fs.readFile(path.join(root,'cert.pem'))},(req,res)=>{
  const address=upstream?.address();if(!address){res.writeHead(503);res.end();return;}
  const headers={};for(const name of ['cookie','origin','content-type','content-length','accept','range','if-none-match'])if(req.headers[name])headers[name]=req.headers[name];
  headers['x-forwarded-host']=req.headers.host;headers['x-forwarded-proto']='https';
  const output=http.request({hostname:'127.0.0.1',port:address.port,path:req.url,method:req.method,headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
  output.on('error',()=>{res.writeHead(502);res.end();});req.pipe(output);res.on('close',()=>output.destroy());
 });
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const tlsPort=proxy.address().port;
 config.routing.transport={mode:'trusted-proxy',peers:['127.0.0.1'],port:tlsPort};
 host=await createMultiAppHost(config,{root,execution});for(const app of config.apps)await host.activate(app.id);upstream=await host.listenShared(0,'127.0.0.1');
 chromeProcess=spawn(browser,['--headless','--disable-gpu','--no-proxy-server','--ignore-certificate-errors','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let stderr='';const timer=setTimeout(()=>reject(Error('Chrome timeout')),15000);chromeProcess.once('error',reject);chromeProcess.stderr.on('data',chunk=>{stderr+=chunk;const m=/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(stderr);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});});
 const tabs=await(await fetch(endpoint+'/json/list')).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data),entry=calls.get(m.id);if(entry){clearTimeout(entry.timer);calls.delete(m.id);m.error?entry.reject(Error(JSON.stringify(m.error))):entry.resolve(m.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{calls.delete(id);reject(Error(method+' timeout'));},15000);calls.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}console.error(await evaluate('document.body.innerText'));throw Error('Browser condition failed: '+expression);};
 const navigate=async(hostname,text)=>{await cdp('Page.navigate',{url:`https://${hostname}:${tlsPort}/`});await until(`location.hostname===${JSON.stringify(hostname)}&&document.body.textContent.includes(${JSON.stringify(text)})`);};
 const click=async selector=>{const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
 await cdp('Page.enable');await cdp('Network.enable');
 await navigate('alpha.localhost','Verify lifecycle cleanup');assert.equal(await evaluate('location.protocol'),'https:');
 const alpha=(await cdp('Network.getCookies')).cookies.find(c=>c.name==='__Host-wydgit-session');assert.ok(alpha&&alpha.secure&&alpha.httpOnly);assert.equal(alpha.domain,'alpha.localhost');assert.equal(await evaluate('document.cookie'),'');
 await click('[name=Name]');await cdp('Input.insertText',{text:'Alpha native browser'});await click('button[type=submit]');await until("document.body.textContent.includes('Submitted through SEWN')");assert.equal(await evaluate('document.querySelector("[name=Name]").value'),'Alpha native browser');assert.equal(await evaluate('location.hostname'),'alpha.localhost');
 const alphaCss=await evaluate("fetch('/css/site.css').then(r=>r.text())");assert.match(alphaCss,/App asset: app-alpha/);
 console.log('PASS HTTPS alpha: installed WBasic Taskboard, native form/SEWN, host-only Secure HttpOnly cookie, own asset');
 await navigate('beta.localhost','Write WBasic');const beta=(await cdp('Network.getCookies')).cookies.find(c=>c.name==='__Host-wydgit-session');assert.ok(beta&&beta.secure&&beta.httpOnly);assert.equal(beta.domain,'beta.localhost');assert.notEqual(beta.value,alpha.value);assert.equal(await evaluate('document.querySelector("[name=Name]").value'),'');
 await click('[name=Name]');await cdp('Input.insertText',{text:'Beta native browser'});await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await until("document.body.textContent.includes('Submitted through SEWN')");assert.equal(await evaluate('document.querySelector("[name=Name]").value'),'Beta native browser');
 console.log('PASS HTTPS beta: separate credential and draft; native keyboard submission; no cross-host redirect');
 await navigate('soon.localhost','Coming Soon');assert.equal((await cdp('Network.getCookies')).cookies.length,0);assert.equal(await evaluate('document.querySelectorAll("form").length'),0);
 await navigate('new.sites.example.localhost','This site is parked.');assert.equal((await cdp('Network.getCookies')).cookies.length,0);console.log('PASS HTTPS parking: known and approved-zone ordinary Wydgit pages without cookies');
 await cdp('Page.navigate',{url:`https://unrelated.localhost:${tlsPort}/`});await until("location.hostname==='unrelated.localhost'&&document.body.textContent.includes('Request rejected')");assert.equal((await cdp('Network.getCookies')).cookies.length,0);console.log('PASS unrelated hostname rejected without tenant credentials or redirect');
 await host.dispose();config.routing.transport={mode:'local-http'};host=await createMultiAppHost(config,{root,execution});for(const app of config.apps)await host.activate(app.id);upstream=await host.listenShared(0,'127.0.0.1');await cdp('Network.clearBrowserCookies');
 await cdp('Page.navigate',{url:'http://alpha.localhost:'+upstream.address().port+'/'});await until("location.protocol==='http:'&&document.body.textContent.includes('Verify lifecycle cleanup')");const localAlpha=(await cdp('Network.getCookies')).cookies.find(c=>c.name==='wydgit-session');assert.ok(localAlpha&&localAlpha.httpOnly&&!localAlpha.secure);assert.equal(localAlpha.domain,'alpha.localhost');
 await cdp('Page.navigate',{url:'http://beta.localhost:'+upstream.address().port+'/'});await until("location.protocol==='http:'&&document.body.textContent.includes('Write WBasic')");const localBeta=(await cdp('Network.getCookies')).cookies.find(c=>c.name==='wydgit-session');assert.ok(localBeta&&!localBeta.secure&&localBeta.value!==localAlpha.value);assert.equal(localBeta.domain,'beta.localhost');console.log('PASS local HTTP: explicit development credentials obey prefix and host-only isolation');
 console.log(execFileSync(browser,['--version'],{encoding:'utf8'}).trim());console.log('5 routing browser fixtures passed; actual local TLS termination, ephemeral test certificate validation exception only.');
}finally{
 ws?.close();for(const entry of calls.values())clearTimeout(entry.timer);
 if(chromeProcess){chromeProcess.kill('SIGTERM');await new Promise(r=>{if(chromeProcess.exitCode!==null)r();else{chromeProcess.once('exit',r);setTimeout(()=>{chromeProcess.kill('SIGKILL');r();},3000).unref();}});}
 if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}await host?.dispose();await fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:100});
}
