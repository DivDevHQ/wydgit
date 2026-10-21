#!/usr/bin/env node
// Trusted local developer tooling. No native operator authority enters a package,
// production route, browser Page binding or the shareable evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {constants} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {once} from 'node:events';
import {b6Fixture,b6ModulesFixture} from '../../test-support/backoffice-b6.js';
import {initializeHost} from '../../wydgine/host.js';
import {ExecutionContext} from '../../wydgine/seam/context.js';
import {createGate} from '@wydgit/gate/client';
import {manifest as gateManifest} from '@wydgit/gate';
import {createApp} from '../../app.js';
import {readInstalledState} from '../../wydgine/packages/state.js';
import {startGuide} from './guide.js';
import {stamp,readJSON,writeJSON,evidenceStore,exportReport} from './evidence.js';
import {password} from './cases.js';
export const project=path.resolve(import.meta.dirname,'../..');
export const home=path.join(project,'.backoffice-human');
function command(binary,args){try{return execFileSync(binary,args,{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}).trim();}catch{return 'Unavailable';}}
export async function environment(){
 let release='Unknown OS';try{release=(/^PRETTY_NAME="?([^"\n]+)/m.exec(await fs.readFile('/etc/os-release','utf8'))??[])[1]??release;}catch{}
 const conflicts=[];for(const schema of ['org.cinnamon.desktop.keybindings.wm','org.cinnamon.desktop.keybindings.media-keys']){
  const data=command('gsettings',['list-recursively',schema]);if(data==='Unavailable')continue;
  for(const line of data.split('\n'))if(/<(?:Alt|Shift|Super)>/.test(line)&&(/<Alt><Shift>[hHmMfF]/.test(line)||/<Alt><Super>s|<Super><Alt>s/.test(line)))conflicts.push(line.split(' ').slice(0,2).join(' '));
 }
 return {os:release,kernel:os.release(),arch:os.arch(),node:process.version,desktop:command('cinnamon',['--version']),sessionType:['x11','wayland'].includes(process.env.XDG_SESSION_TYPE)?process.env.XDG_SESSION_TYPE:'unknown',firefox:command('firefox',['--version']),orca:command('orca',['--version']),screenReaderShortcut:command('gsettings',['get','org.cinnamon.desktop.keybindings.media-keys','screenreader']),shortcutConflicts:conflicts.length?'Potential desktop bindings to check: '+conflicts.join(', ')+'. Use Orca Learn Mode to confirm.':'No matching standard Cinnamon shortcut conflict detected, or settings unavailable. Custom bindings and actual key handling need a human check.'};
}
async function directory(dir){try{await fs.mkdir(dir,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink()||await fs.realpath(dir)!==dir)throw Error('Unsafe disposable directory');}
async function baseDirectory(homeDirectory=home){
 const home=homeDirectory;await directory(home);const marker=path.join(home,'owner.json');try{if((await readJSON(marker)).schema!=='wydgit.backoffice-human-root/1')throw Error('Unrecognized test root');}catch(e){if(e.code!=='ENOENT')throw e;const entries=await fs.readdir(home);if(entries.length)throw Error('Test root has no ownership marker');await writeJSON(marker,{schema:'wydgit.backoffice-human-root/1'});}await directory(path.join(home,'sessions'));}
async function sessionDirectory(id,homeDirectory=home){const home=homeDirectory;if(!/^human-[0-9TZa-f-]+$/.test(id))throw Error('Invalid session identifier');const dir=path.join(home,'sessions',id);await directory(dir);return dir;}
async function lock(homeDirectory=home){
 const home=homeDirectory;
 const file=path.join(home,'running.json');const handle=await fs.open(file,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);return {file,handle};
}
async function running(homeDirectory=home){const home=homeDirectory;try{return await readJSON(path.join(home,'running.json'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function current(id){return sessionDirectory(id??(await readJSON(path.join(home,'current.json'))).id,home);}
export async function cleanSession(dir,{sessionHome=home}={}){
 const home=sessionHome;
 let guard;try{guard=await lock(home);}catch(e){if(e.code==='EEXIST')throw Error('Stop the environment before cleanup; running.json is present');throw e;}
 await guard.handle.writeFile(JSON.stringify({pid:process.pid,cleanup:true})+'\n');await guard.handle.close();
 try{
 const metadata=await readJSON(path.join(dir,'evidence','metadata.json'));
 if(path.dirname(dir)!==path.join(home,'sessions')||path.basename(dir)!==metadata.id||await fs.realpath(dir)!==dir)throw Error('Unsafe session root');
 const runtime=path.join(dir,'runtime');const stat=await fs.lstat(runtime).catch(e=>{if(e.code!=='ENOENT')throw e;});
 if(stat){if(!stat.isDirectory()||stat.isSymbolicLink()||await fs.realpath(runtime)!==runtime)throw Error('Unsafe runtime root');const marker=await readJSON(path.join(runtime,'owner.json'));if(marker.session!==metadata.id)throw Error('Wrong runtime owner');await fs.rm(runtime,{recursive:true});}
 // Evidence is deliberately never removed, including metadata and failed attempts.
 metadata.cleaned=true;await writeJSON(path.join(dir,'evidence','metadata.json'),metadata);
 }finally{await fs.unlink(guard.file);}
}
export async function launch({openBrowser=true,sessionHome=home,purpose='human-acceptance'}={}){
 const home=sessionHome;
 await baseDirectory(home);
 const env=await environment();if(Number(process.versions.node.split('.')[0])<24||Number(process.versions.node.split('.')[0])===24&&Number(process.versions.node.split('.')[1])<21)throw Error('Node 24.21.0 or newer is required; use the repository-supported Node installation');
 await import('better-sqlite3');
 if(env.firefox==='Unavailable')console.log('Firefox is unavailable. Install Firefox through Linux Mint Software Manager before native Firefox tests; the guide will still start.');
 if(env.orca==='Unavailable')console.log('Orca is missing. If you approve installing it, run: sudo apt install orca. Keyboard testing can proceed meanwhile.');
 const guard=await lock(home);let guide,store,metadata,dir,browser,closing=false,initialized=false,stopRequested=false;const apps=[];
 const signalStop=()=>{if(!initialized){stopRequested=true;console.log('Stopping after the current installation step finishes…');return;}void stop().catch(()=>{console.error('Shutdown could not finish. Ownership lock retained; do not clean this session.');process.exitCode=1;});};
 // Write ownership immediately, including during provisioning. Never signal a PID
 // read from disk: stop uses the live guide with its per-launch secret instead.
 await guard.handle.writeFile(JSON.stringify({pid:process.pid,starting:true})+'\n');await guard.handle.close();
 const stop=async()=>{if(closing)return;closing=true;try{
  if(browser&&browser.exitCode===null){browser.kill('SIGTERM');await Promise.race([once(browser,'exit').catch(()=>{}),new Promise(r=>{const timer=setTimeout(()=>{if(browser.exitCode===null)browser.kill('SIGKILL');r();},4000);timer.unref();})]);}
  await guide?.stop();for(const a of apps.reverse()){await a.app.shutdown(a.server);await a.libraries.close();}
  if(store&&metadata){await store.append({type:'shutdown'});await exportReport(metadata.evidence,metadata,store.events);}
 await fs.unlink(guard.file);process.removeListener('SIGINT',signalStop);process.removeListener('SIGTERM',signalStop);console.log('Disposable servers stopped. Saved evidence retained.');
 }catch(error){console.error('Shutdown failed; disposable ownership lock retained.');throw error;}};
 process.on('SIGINT',signalStop);process.on('SIGTERM',signalStop);
 try{
  let id;try{id=(await readJSON(path.join(home,'current.json'))).id;dir=await sessionDirectory(id,home);metadata=await readJSON(path.join(dir,'evidence','metadata.json'));if(metadata.cleaned){metadata=null;}else if(!metadata.ready){throw Error('The previous installation stopped before it was ready. Run npm run backoffice:human-test -- cleanup, then start again. Evidence will be preserved.');}}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!metadata){
   id='human-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);dir=await sessionDirectory(id,home);await directory(path.join(dir,'evidence'));await directory(path.join(dir,'runtime'));await directory(path.join(dir,'runtime','apps'));
   await writeJSON(path.join(dir,'runtime','owner.json'),{session:id});
   metadata={schema:'wydgit.backoffice-human-session/1',purpose,id,created:stamp(),commit:command('git',['rev-parse','HEAD']),environment:env,evidence:path.join(dir,'evidence'),installations:[],ready:false};
   await writeJSON(path.join(home,'current.json'),{id});await writeJSON(path.join(metadata.evidence,'metadata.json'),metadata);
  }
  if(metadata.schema!=='wydgit.backoffice-human-session/1'||metadata.evidence!==path.join(dir,'evidence'))throw Error('Invalid session metadata');
  await directory(path.join(dir,'evidence'));await directory(path.join(dir,'runtime'));await directory(path.join(dir,'runtime','apps'));
  if((await readJSON(path.join(dir,'runtime','owner.json'))).session!==metadata.id)throw Error('Wrong runtime owner');
  store=await evidenceStore(metadata.evidence);await store.append({type:'launch',commit:command('git',['rev-parse','HEAD']),dirty:command('git',['status','--porcelain']).length>0,environment:env});
  const urls={};
  for(const name of ['json','sqlite','modules']){
   if(stopRequested)throw Error('Startup stopped; evidence retained. Use cleanup before starting a fresh sample.');
   const root=path.join(dir,'runtime','apps',name);let libraries,identity;
   if(!metadata.ready){
    const callbacks=[],t={disposableRoot:root,disposablePassword:password,after:fn=>callbacks.push(fn)};
    console.log('Preparing disposable '+name+' installation and reviewed Page approvals…');
    let f;try{f=await(name==='modules'?b6ModulesFixture(t):b6Fixture(t,name));}catch(e){for(const close of callbacks.reverse())await close();throw e;}
    libraries=f.libraries;identity=f.user.account.id;
    const state=readInstalledState(root),config=JSON.parse(await fs.readFile(path.join(root,'wydgit.config.json')));
    metadata.installations.push({name,configurationSha256:createHash('sha256').update(await fs.readFile(path.join(root,'wydgit.config.json'))).digest('hex'),reviewPlanBytes:f.reviewBytes??null,packages:state.packages.map(p=>({id:p.manifest.id,version:p.manifest.version,receipt:p.receipt.id,policyRevision:p.policyRevision??0,adoption:p.backoffice??p.policy?.backoffice??null})),providers:config.libraries.find(l=>l.id==='wydstore').options.stores.map(s=>({id:s.id,provider:s.provider,app:s.app,collections:s.collections.map(c=>c.id)}))});
    await writeJSON(path.join(root,'human-identity.json'),{userId:identity});
   }else{
    await directory(root);
    const configBytes=await fs.readFile(path.join(root,'wydgit.config.json'));
    if(createHash('sha256').update(configBytes).digest('hex')!==metadata.installations.find(i=>i.name===name)?.configurationSha256)throw Error('Disposable configuration changed. Refusing to open providers; preserve evidence and use cleanup.');
    const config=JSON.parse(configBytes);
    for(const store of config.libraries.find(l=>l.id==='wydstore').options.stores){if(!store.root.startsWith(root+path.sep)||await fs.realpath(store.root)!==store.root)throw Error('Disposable provider root escaped its App');}
    libraries=await initializeHost({root});identity=(await readJSON(path.join(root,'human-identity.json'))).userId;
   }
   if(stopRequested){await libraries.close();throw Error('Startup stopped; evidence retained. Use cleanup before starting a fresh sample.');}
   const gate=createGate(libraries.bind(new ExecutionContext({context:'FrontEnd',publisher:'host',package:'host:gate',self:'home',app:'boilerplate',capabilities:gateManifest.capabilities,scopes:{wydgate:['boilerplate'],wydgateBootstrap:['boilerplate']}})));
   const logger={error(value){let code='HTTP.INTERNAL';try{const e=JSON.parse(value);if(typeof e.code==='string'&&/^[A-Z][A-Z0-9_.]{1,63}$/.test(e.code))code=e.code;}catch{}void store.append({type:'server-error',provider:name,code}).catch(()=>{});}};
   let app;try{app=createApp({root,libraries,localHostname:name+'.localhost',logger});}catch(e){await libraries.close();throw e;}
   let server;try{server=app.listen(0,'127.0.0.1');await once(server,'listening');}catch(e){await app.stop();await libraries.close();throw e;}urls[name]='http://'+name+'.localhost:'+server.address().port;
   server.on('request',(req,res)=>{const route=req.url?.split('?')[0];if(!/^\/backoffice\/(?:pages\/(?:workspace|members|notices)|api\/actions(?:\/invoke)?)$/.test(route??''))return;res.once('finish',()=>{void store.append({type:'http',provider:name,route,method:['GET','POST'].includes(req.method)?req.method:'OTHER',status:res.statusCode}).catch(()=>{});});});
   apps.push({name,root,libraries,gate,identity,app,server});
  }
  metadata.ready=true;await writeJSON(path.join(metadata.evidence,'metadata.json'),metadata);
  const csrf=randomBytes(32).toString('hex');
  const profile=path.join(dir,'runtime','firefox');await directory(profile);
  const open=()=>{
   if(env.firefox==='Unavailable')return;
   if(browser&&browser.exitCode===null&&browser.signalCode===null)return;
   browser=spawn('firefox',['--no-remote','--profile',profile,guide.base+'/'],{stdio:'ignore'});browser.on('error',()=>{console.log('Firefox could not open. Use the printed Firefox command.');});browser.on('exit',code=>{if(code&&!closing)console.log('Firefox exited. Reopen with: npm run backoffice:human-test -- firefox');});
   console.log('Disposable Firefox process: '+browser.pid+'; no remote debugging or profile preference overrides.');
  };
  guide=await startGuide({metadata,store,urls,csrf,onStop:signalStop,onOpen:()=>open(),operator:async(provider,action)=>{const a=apps.find(a=>a.name===provider),permissions=['content.pages.view','content.workspace.read','content.workspace.write'].filter(p=>action==='deny-write'?p!=='content.workspace.write':action==='deny-page'?p!=='content.pages.view':true);await a.gate.assignUser({userId:a.identity,roles:[],permissions});}});
  await writeJSON(guard.file,{id:metadata.id,pid:process.pid,base:guide.base,csrf,urls});
  initialized=true;if(stopRequested){await stop();return;}
  console.log(`\nBackOffice human test is ready.\nGuide: ${guide.base}/\nFirefox: ${env.firefox}\nOrca: ${env.orca} (speech is not yet confirmed)\nSession: ${metadata.id}\nDisposable runtime and browser profile: ${path.join(dir,'runtime')}\nEvidence (kept on cleanup): ${metadata.evidence}\nServer PID: ${process.pid}; all four HTTP listeners use 127.0.0.1.\nJSON Workspace: ${urls.json}/backoffice/pages/workspace\nSQLite Workspace: ${urls.sqlite}/backoffice/pages/workspace\nMembers/Notices: ${urls.modules}/backoffice/pages/members\nSign-in credentials are shown in the guide.\nStop: Ctrl+C, or npm run backoffice:human-test -- stop\nResume: npm run backoffice:human-test\nExport: npm run backoffice:human-test -- export\nCleanup runtime only (after stopping): npm run backoffice:human-test -- cleanup\n`);
  console.log(`Open isolated Firefox: npm run backoffice:human-test -- firefox\n`);
  if(openBrowser&&(process.env.DISPLAY||process.env.WAYLAND_DISPLAY))open();
  return {metadata,store,urls,base:guide.base,csrf,stop,open,apps};
 }catch(e){if(store)await store.append({type:'startup-failure',code:typeof e.code==='string'?e.code:'STARTUP.FAILED'});await stop();throw e;}
}
export async function main(){
 process.umask(0o077);process.chdir(project);
 const [action,...args]=process.argv.slice(2);if(args.length||action&&!['--no-browser','stop','cleanup','export','firefox'].includes(action))throw Error('Use npm run backoffice:human-test [-- stop|export|cleanup|firefox|--no-browser]');
 if(!action||action==='--no-browser'){await launch({openBrowser:action!=='--no-browser'});return;}
 await baseDirectory();const state=await running();
 if(action==='stop'){
  if(!state){console.log('Already stopped. Evidence retained.');return;}
  if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(state.base??''))throw Error('Startup is incomplete. Use Ctrl+C in its terminal. For a crashed launcher, see the recovery section of the guide.');
  const health=await fetch(state.base+'/health',{signal:AbortSignal.timeout(3000)});if((await health.json()).id!==state.id)throw Error('Session identity mismatch; no process was signalled');
  const response=await fetch(state.base+'/stop',{method:'POST',headers:{Origin:state.base,'Content-Type':'application/json'},body:JSON.stringify({csrf:state.csrf}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Stop refused');await response.text();
  for(let n=0;n<100;n++){if(!(await running())){console.log('Disposable servers stopped. Evidence retained.');return;}await new Promise(r=>setTimeout(r,100));}
  throw Error('Shutdown has not finished; leave the session intact and check its launcher terminal');
 }
 const dir=await current(),metadata=await readJSON(path.join(dir,'evidence','metadata.json'));
 if(action==='cleanup'){await cleanSession(dir);console.log('Disposable runtime removed. Evidence preserved: '+metadata.evidence);return;}
 if(action==='export'){
  if(state?.base){const response=await fetch(state.base+'/export',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Export failed');await response.text();}
  else{const store=await evidenceStore(metadata.evidence);await exportReport(metadata.evidence,metadata,store.events);}
  console.log('Shareable report: '+path.join(metadata.evidence,'report.md')+'\nMachine-readable report: '+path.join(metadata.evidence,'report.json')+'\nInspect notes before sharing; raw evidence and browser profiles remain private.');return;
 }
 if(!state?.base||state.id!==metadata.id)throw Error('Start the environment first');
 // Ask the running owner to open its own browser, so it can stop that exact child.
 // This action is sent only to the guide with a live per-launch secret.
 const response=await fetch(state.base+'/open-firefox',{method:'POST',headers:{Origin:state.base,'Content-Type':'application/json'},body:JSON.stringify({csrf:state.csrf}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Firefox open request failed');console.log(await response.text());
}
