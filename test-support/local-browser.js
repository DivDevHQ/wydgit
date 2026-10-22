// Local browser process/protocol plumbing only. No network interception, cookies
// manufactured by the driver, or changes to the authoritative application runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {firefoxProtocol} from '../scripts/firefox-protocol.js';
export async function localBrowser(t,root,{firefox=false}={}){
  const binary=firefox?(process.env.WYDCLIENT_FIREFOX??'firefox'):(process.env.WYDCLIENT_CHROME??'google-chrome');
  const version=execFileSync(binary,['--version'],{encoding:'utf8'}).trim(),profile=path.join(root,'b5-browser-profile');
  await fs.mkdir(profile);if(firefox)await fs.writeFile(path.join(profile,'user.js'),'user_pref("focusmanager.testmode", '+(process.env.WYDCLIENT_FIREFOX_FOCUS_TESTMODE==='0'?'false':'true')+');\n');
  const child=spawn(binary,firefox?[...(process.env.WYDCLIENT_HEADFUL==='1'?[]:['--headless']),'--no-remote','--profile',profile,'--remote-debugging-port=0','about:blank']:
    ['--headless','--disable-gpu','--no-proxy-server','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let ws,sequence=0;const calls=new Map();
  t.after(async()=>{ws?.close();for(const e of calls.values())clearTimeout(e.timer);child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)r();else{child.once('exit',r);setTimeout(()=>{child.kill('SIGKILL');r();},3000).unref();}});await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
  const endpoint=await new Promise((resolve,reject)=>{let stderr='';const timer=setTimeout(()=>reject(Error('Browser startup timeout')),15000);child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(Error('Browser exited before endpoint'));});child.stderr.on('data',chunk=>{stderr+=chunk;const m=(firefox?/WebDriver BiDi listening on ws:\/\/127\.0\.0\.1:(\d+)/:/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//).exec(stderr);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});});
  const tabs=firefox?null:await(await fetch(endpoint+'/json/list')).json();
  ws=new WebSocket(firefox?endpoint.replace('http:','ws:')+'/session':tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data),e=calls.get(m.id);if(e){clearTimeout(e.timer);calls.delete(m.id);m.error?e.reject(Error(JSON.stringify(m.error))):e.resolve(m.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{calls.delete(id);reject(Error(method+' timeout'));},15000);calls.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const protocol=firefox?await firefoxProtocol(send):send;
  const evaluate=async expression=>{const r=await protocol('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error('Browser evaluation failed: '+JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async expression=>{for(let i=0;i<240;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error('Browser condition failed: '+expression);};
  const navigate=async url=>{await protocol('Page.navigate',{url});await protocol('Page.bringToFront');if(firefox&&process.env.WYDCLIENT_HEADFUL==='1'){const windows=execFileSync('xdotool',['search','--onlyvisible','--pid',String(child.pid)],{encoding:'utf8'}).trim().split('\n');execFileSync('xdotool',['windowfocus','--sync',windows.at(-1)]);}await until("document.readyState==='complete'");};
  const click=async selector=>{await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await protocol('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await protocol('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
  const key=async(key,code=key,windowsVirtualKeyCode=({Tab:9,Enter:13,' ':32})[key]??0,modifiers=0)=>{await protocol('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,modifiers,...(key==='Enter'?{text:'\r'}:{})});await protocol('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode,modifiers});};
  await protocol('Page.enable');await protocol('Network.enable');
  await protocol('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  return {version,protocol,rawProtocol:send,evaluate,until,navigate,click,key,type:async(selector,text)=>{await click(selector);await protocol('Input.insertText',{text});},async screenshot(file){
    await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const clip=await evaluate('({x:0,y:0,width:Math.max(innerWidth,document.documentElement.scrollWidth),height:document.documentElement.scrollHeight,scale:1})');
    const {data}=await protocol('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await fs.writeFile(file,Buffer.from(data,'base64'));
  }};
}
