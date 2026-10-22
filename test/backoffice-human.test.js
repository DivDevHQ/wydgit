import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {request} from 'node:http';
import {setDefaultResultOrder} from 'node:dns';
setDefaultResultOrder('ipv4first');
import {Window} from 'happy-dom';
import {launch,cleanSession} from '../scripts/backoffice-human.js';
import {cases,password} from '../scripts/backoffice-human/cases.js';
import {evidenceStore,report,validateResult,readJSON,writeJSON} from '../scripts/backoffice-human/evidence.js';
import {guidePage} from '../scripts/backoffice-human/guide.js';
const temp=async t=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-b6h-developer-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;};
// Preserve browser Fetch Metadata exactly; fetch() supplies its own mode header.
const nativeGet=(url,headers={})=>new Promise((resolve,reject)=>{const req=request(url,{headers},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));});req.on('error',reject);req.end();});
const metadata={id:'developer-simulation',purpose:'developer-simulation',commit:'baseline',environment:{orca:'46',screenReaderShortcut:"['<Alt><Super>s']",shortcutConflicts:'Check shortcuts.'},installations:[]};
test('B6H guide uses native named controls, complete protocol and escaped notes',()=>{
 const w=new Window();try{w.document.write(guidePage({metadata,events:[{type:'result',provider:'json',caseId:'ENV-01',notes:'</textarea><script>bad()</script>'}],urls:{json:'http://127.0.0.1:1',sqlite:'http://127.0.0.1:2',modules:'http://127.0.0.1:3'},csrf:'guide-token'}));
 assert.equal(w.document.documentElement.lang,'en');assert.equal(w.document.querySelectorAll('main').length,1);assert.equal(w.document.querySelectorAll('script').length,0);assert.equal(w.document.querySelectorAll('input[type=radio]').length,3);assert.ok(w.document.querySelector('progress'));assert.equal(w.document.querySelector('textarea').value,'</textarea><script>bad()</script>');assert.ok(w.document.querySelector('label[for=notes]'));assert.match(w.document.body.textContent,/qualified human/);assert.match(w.document.body.textContent,/manual success does not resolve B6 automation/);
 assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);assert.ok(cases.some(c=>c.id==='AT-06'));assert.match(guidePage({metadata,events:[],urls:{json:'http://json.localhost:1',modules:'http://modules.localhost:2'},csrf:'test',index:3}),/Load Workspace properties and content/);for(const c of cases){assert.equal(c.criterion,'BO-HTTP-12');assert.ok(c.steps.length&&c.expected);}
 }finally{w.close();}
});
test('B6H evidence retains failure history, validates outcomes, excludes secrets and personal paths',async t=>{
 const root=await temp(t),s=await evidenceStore(root);
 await s.append({type:'result',...validateResult({provider:'json',caseId:'KEY-01',outcome:'fail',notes:'Email owner@example.org /home/somebody/private password=secret '+password,kind:'product-defect'})});
 await s.append({type:'result',...validateResult({provider:'json',caseId:'KEY-01',outcome:'pass',notes:'Second attempt',kind:'observation'})});
 await s.append({type:'http',status:403,method:'POST',route:'/backoffice/api/actions/invoke',cookie:'never-export'});
 const resumed=await evidenceStore(root),r=report(metadata,resumed.events);assert.equal(r.json.attempts.length,2);assert.equal(r.json.attempts[0].outcome,'fail');assert.equal(r.json.counts.pass,1);assert.equal(r.json.counts['not-completed'],cases.length*2-1);assert.match(r.markdown,/Remaining acceptance work/);assert.equal(r.json.acceptance.automationResolved,false);assert.equal(r.json.purpose,'developer-simulation');
 assert.doesNotMatch(JSON.stringify(r),/owner@example|\/home\/somebody|password=secret|never-export|Disposable-B6H/);
 assert.throws(()=>validateResult({provider:'json',caseId:'KEY-01',outcome:'automatic-pass',notes:'',kind:'observation'}));assert.throws(()=>validateResult({provider:'json',caseId:'KEY-01',outcome:'pass',notes:'',kind:'observation',token:'no'}));
 const target=path.join(root,'outside');await fs.writeFile(target,'unchanged');await fs.symlink(target,path.join(root,'metadata.json'));await assert.rejects(writeJSON(path.join(root,'metadata.json'),{}));assert.equal(await fs.readFile(target,'utf8'),'unchanged');
});
test('B6H launcher installs reviewed Pages, records results, resumes, denies safely and cleans runtime only',async t=>{
 const sessionHome=path.join(await temp(t),'sessions-root');let h; t.after(async()=>{await h?.stop();});
 h=await launch({openBrowser:false,sessionHome,purpose:'developer-simulation'});
 assert.equal(h.apps.length,3);for(const a of h.apps)assert.equal(a.server.address().address,'127.0.0.1');
 await assert.rejects(launch({openBrowser:false,sessionHome,purpose:'developer-simulation'}),/EEXIST/);
 assert.ok(h.metadata.installations.every(i=>i.packages.filter(p=>p.id!=='divdev/membership').every(p=>p.adoption?.status==='adopted')));
 assert.ok(h.metadata.installations.filter(i=>i.name!=='modules').every(i=>i.reviewPlanBytes<=65536));
 const guide=await(await fetch(h.base)).text();assert.match(guide,/Let’s try BackOffice/);assert.match(await(await fetch(h.base+'/focus')).text(),/Plain focus check/);
 assert.equal(await new Promise((resolve,reject)=>{const req=request(h.base,{headers:{Host:'attacker.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();}),403);
 const post=async(route,data={},headers={})=>fetch(h.base+route,{method:'POST',headers:{Origin:h.base,'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams({csrf:h.csrf,...data}),redirect:'manual'});
 assert.equal((await post('/control',{provider:'json',index:7,action:'deny-write'},{Origin:'http://attacker.invalid'})).status,403);
 assert.equal((await post('/result',{csrf:'forged',provider:'json',index:0})).status,403);
 assert.equal((await post('/control',{provider:'json',index:7,action:'approve-package'})).status,404);
 for(const provider of ['json','sqlite']){
  const a=h.apps.find(a=>a.name===provider),login=await a.gate.login('alice',password);assert.ok(login.token);
  const auth={Cookie:'wydgit-auth='+login.token};
  const page=await fetch(h.urls[provider]+'/backoffice/pages/workspace',{headers:auth});assert.equal(page.status,200);
  const pageUrl=h.urls[provider]+'/backoffice/pages/workspace',navigation={'Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document','Sec-Fetch-User':'?1'};
  for(const site of ['cross-site','same-site']){
   const headers={...auth,...navigation,'Sec-Fetch-Site':site};
   const entered=await nativeGet(pageUrl,headers);assert.equal(entered.status,200,entered.body);assert.match(entered.body,/wydgit-backoffice-controls/);assert.equal(entered.headers['access-control-allow-origin'],undefined);
   for(const changed of [{'Sec-Fetch-Mode':'cors'},{'Sec-Fetch-Dest':'iframe'},{'Sec-Fetch-User':'?0'},{Origin:'null'},{Origin:'http://foreign.invalid'}]){
    const denied=await nativeGet(pageUrl,{...headers,...changed});assert.equal(denied.status,403);assert.equal(JSON.parse(denied.body).code,'HTTP.ORIGIN');
   }
   const noActivation={...headers};delete noActivation['Sec-Fetch-User'];assert.equal((await nativeGet(pageUrl,noActivation)).status,403);
   assert.equal((await nativeGet(h.urls[provider]+'/backoffice/api/actions',headers)).status,403,'Document metadata must not admit discovery');
  }
  assert.equal((await nativeGet(pageUrl,{...navigation,'Sec-Fetch-Site':'cross-site'})).status,401,'Navigation grants no authentication');

  const w=new Window();w.document.write(await page.text());const meta=JSON.parse(w.document.querySelector('meta[name=wydgit-backoffice-controls]').content),csrf=w.document.querySelector('meta[name=wydgit-backoffice-csrf]').content;w.close();
  const actions=meta.consumers.flatMap(c=>c.actions),save=actions.find(a=>a.operation==='update'),load=actions.find(a=>a.operation==='get'&&a.binding.usage!=='prepare');assert.ok(save&&load);
  const invoke=async(action,input,confirmed=false)=>fetch(h.urls[provider]+'/backoffice/api/actions/invoke',{method:'POST',headers:{...auth,Origin:h.urls[provider],'Content-Type':'application/json','X-Wydgit-CSRF':csrf},body:JSON.stringify({pageBinding:action.binding,input,confirmed})});
  const before=await(await invoke(load,{})).json();assert.ok(before.ok,JSON.stringify(before));
  const forged=await fetch(h.urls[provider]+'/backoffice/api/actions/invoke',{method:'POST',headers:{...auth,...navigation,Origin:h.urls[provider],'Sec-Fetch-Site':'cross-site','Content-Type':'application/json','X-Wydgit-CSRF':csrf},body:JSON.stringify({pageBinding:load.binding,input:{}})});
  assert.equal(forged.status,403);assert.equal((await forged.json()).code,'HTTP.ORIGIN');
  const csrfDenied=await fetch(h.urls[provider]+'/backoffice/api/actions/invoke',{method:'POST',headers:{...auth,Origin:h.urls[provider],'Content-Type':'application/json','X-Wydgit-CSRF':'0'.repeat(64)},body:JSON.stringify({pageBinding:load.binding,input:{}})});assert.equal(csrfDenied.status,403);assert.equal((await csrfDenied.json()).code,'HTTP.CSRF');

  const data={title:'Developer persistence',columns:true,body:'## Developer sample'};
  const saved=await invoke(save,{version:before.value.version,data},true);assert.equal(saved.status,200);assert.equal((await saved.json()).value.data.title,data.title);
  assert.equal((await post('/control',{provider,index:7,action:'deny-write'})).status,303);
  assert.equal((await invoke(save,{version:before.value.version+1,data:{...data,title:'denied'}},true)).status,403);
  assert.equal((await(await invoke(load,{})).json()).value.data.title,data.title);
  assert.equal((await post('/control',{provider,index:8,action:'deny-page'})).status,303);
  assert.equal((await fetch(h.urls[provider]+'/backoffice/pages/workspace',{headers:auth})).status,403);
  const pageDenied=await nativeGet(pageUrl,{...auth,...navigation,'Sec-Fetch-Site':'cross-site'});assert.equal(pageDenied.status,403);assert.equal(JSON.parse(pageDenied.body).code,'PAGE.DENIED','Navigation grants no Page authority');
  assert.equal((await post('/control',{provider,index:8,action:'restore'})).status,303);
 }
 const modules=h.apps.find(a=>a.name==='modules'),login=await modules.gate.login('alice',password);
 for(const page of ['members','notices'])assert.equal((await fetch(h.urls.modules+'/backoffice/pages/'+page,{headers:{Cookie:'wydgit-auth='+login.token}})).status,200);
 for(const outcome of ['fail','pass'])assert.equal((await post('/result',{provider:'json',index:0,caseId:'ENV-01',outcome,notes:'Developer simulation only',kind:'observation',next:'no'})).status,303);
 assert.equal((await post('/result',{provider:'json',index:0,caseId:'ENV-01',outcome:'fixed',notes:'',kind:'observation'})).status,400);
 assert.equal((await post('/focus-event',{},{'Content-Type':'text/plain'})).status,415);
 assert.equal((await fetch(h.base+'/focus-event',{method:'POST',headers:{Origin:h.base,'Content-Type':'application/json'},body:JSON.stringify({csrf:h.csrf,diagnostic:{key:'typed secret'}})})).status,400);
 const probe={hasFocus:false,hidden:false,active:'INPUT',event:'keydown',key:'Tab',trusted:true};
 assert.equal((await fetch(h.base+'/focus-event',{method:'POST',headers:{Origin:h.base,'Content-Type':'application/json'},body:JSON.stringify({csrf:h.csrf,diagnostic:probe})})).status,200);
 const exported=await(await fetch(h.base+'/export')).json();assert.equal(exported.attempts.length,2);assert.equal(exported.purpose,'developer-simulation');assert.ok(exported.diagnostics.some(e=>e.type==='http'&&e.status===403));assert.ok(exported.diagnostics.some(e=>e.type==='focus'&&e.diagnostic.hasFocus===false));assert.ok(exported.diagnostics.some(e=>e.type==='server-error'&&e.reason==='fetch-site'));assert.ok(exported.diagnostics.some(e=>e.type==='server-error'&&e.reason==='origin-mismatch'));assert.doesNotMatch(JSON.stringify(exported),new RegExp(password));
 const id=h.metadata.id,evidence=h.metadata.evidence,oldBase=h.base;await assert.rejects(cleanSession(path.dirname(evidence),{sessionHome}),/Stop/);await h.stop();h=null;
 await assert.rejects(fetch(oldBase,{signal:AbortSignal.timeout(1000)}));
 const configFile=path.join(path.dirname(evidence),'runtime','apps','json','wydgit.config.json'),originalConfig=await fs.readFile(configFile,'utf8'),poisoned=JSON.parse(originalConfig),foreign=path.join(sessionHome,'foreign-provider');await fs.mkdir(foreign);poisoned.libraries.find(l=>l.id==='wydstore').options.stores[0].root=foreign;await fs.writeFile(configFile,JSON.stringify(poisoned));await assert.rejects(launch({openBrowser:false,sessionHome,purpose:'developer-simulation'}),/configuration changed/);assert.deepEqual(await fs.readdir(foreign),[]);await fs.writeFile(configFile,originalConfig);
 h=await launch({openBrowser:false,sessionHome,purpose:'developer-simulation'});assert.equal(h.metadata.id,id);assert.equal(h.store.events.filter(e=>e.type==='result').length,2);
 assert.match(await(await fetch(h.base)).text(),/checked/);
 for(const provider of ['json','sqlite']){const a=h.apps.find(a=>a.name===provider),l=await a.gate.login('alice',password),html=await(await fetch(h.urls[provider]+'/backoffice/pages/workspace',{headers:{Cookie:'wydgit-auth='+l.token}})).text();assert.match(html,/Developer persistence/);}
 await h.stop();h=null;
 const dir=path.dirname(evidence),outside=path.join(sessionHome,'keep');await fs.mkdir(outside);await fs.writeFile(path.join(outside,'witness'),'safe');await fs.symlink(outside,path.join(dir,'runtime','external-link'));
 await cleanSession(dir,{sessionHome});assert.equal(await fs.readFile(path.join(outside,'witness'),'utf8'),'safe');await assert.rejects(fs.stat(path.join(dir,'runtime')));assert.equal((await readJSON(path.join(evidence,'metadata.json'))).cleaned,true);assert.equal((await evidenceStore(evidence)).events.filter(e=>e.type==='result').length,2);
 const meta=await readJSON(path.join(evidence,'metadata.json'));await fs.symlink(outside,path.join(dir,'runtime'));await assert.rejects(cleanSession(dir,{sessionHome}),/Unsafe runtime/);assert.equal(await fs.readFile(path.join(outside,'witness'),'utf8'),'safe');assert.equal(meta.purpose,'developer-simulation');assert.equal(await fs.stat(path.join(sessionHome,'running.json')).catch(e=>e.code),'ENOENT');
});
test('B6H interrupt during provisioning finishes the step, closes resources and retains evidence',{timeout:30000},async t=>{
 const {spawn}=await import('node:child_process'),sessionHome=path.join(await temp(t),'interrupted-root');
 const child=spawn(process.execPath,['--input-type=module','-e',"import {launch} from './scripts/backoffice-human.js'; try{await launch({openBrowser:false,sessionHome:process.argv[1],purpose:'developer-simulation'});}catch(e){if(!e.message.startsWith('Startup stopped'))throw e;console.log('EXPECTED_SAFE_STARTUP_STOP');}",sessionHome],{cwd:path.resolve(import.meta.dirname,'..'),stdio:['ignore','pipe','pipe']});
 t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');});let output='',sent=false;
 child.stdout.on('data',chunk=>{output+=chunk;if(!sent&&output.includes('Preparing disposable json')){sent=true;child.kill('SIGINT');}});child.stderr.on('data',chunk=>{output+=chunk;});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});assert.equal(code,0,output);assert.ok(sent);assert.match(output,/EXPECTED_SAFE_STARTUP_STOP/);
 assert.equal(await fs.stat(path.join(sessionHome,'running.json')).catch(e=>e.code),'ENOENT');const {id}=await readJSON(path.join(sessionHome,'current.json')),dir=path.join(sessionHome,'sessions',id),evidence=path.join(dir,'evidence');assert.ok((await evidenceStore(evidence)).events.some(e=>e.type==='startup-failure'));
 await cleanSession(dir,{sessionHome});assert.ok((await fs.stat(path.join(evidence,'report.json'))).isFile());
});
