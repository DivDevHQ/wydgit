import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import {load} from 'cheerio';
import {actionFixture,plain,catalog} from '../test-support/backoffice.js';
import {createApp} from '../app.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {packageOperation,planPackagePolicy,approvePackagePolicy,applyPackagePolicy} from '../wydgine/packages/index.js';

async function listen(t,f,options={}){
  const app=createApp({root:f.root,libraries:f.libraries,localHostname:'127.0.0.1',logger:{error(){assert.fail('Unexpected HTTP exception');}},...options});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  let stopped=false;const stop=async()=>{if(!stopped){stopped=true;await app.shutdown(server);}};t.after(stop);
  const base='http://127.0.0.1:'+server.address().port,cookie='wydgit-auth='+f.login.token;
  const get=(route='/backoffice',headers={})=>fetch(base+route,{headers:{Cookie:cookie,...headers}});
  const shell=await get(),html=await shell.text(),csrf=load(html)('meta[name="wydgit-backoffice-csrf"]').attr('content');
  const post=(body,headers={},method='POST')=>fetch(base+'/backoffice/api/actions/invoke',{method,headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Wydgit-CSRF':csrf,...headers},body:typeof body==='string'?body:JSON.stringify(body)});
  const discover=async()=>{const response=await get('/backoffice/api/actions');assert.equal(response.status,200,await response.clone().text());return (await response.json()).value.actions;};
  return {app,server,base,cookie,get,post,stop,shell,html,csrf,discover};
}
for(const provider of ['json','sqlite']){
  test(`BOHTTP-01 ${provider}: authenticated shell, bounded discovery and genuine roster invocation`,async t=>{
    const f=await actionFixture(t,provider),h=await listen(t,f);
    assert.equal(h.shell.status,200);assert.equal(h.shell.headers.get('cache-control'),'no-store');assert.equal(h.shell.headers.get('referrer-policy'),'no-referrer');
    assert.match(h.shell.headers.get('content-security-policy'),/script-src 'self'/);assert.doesNotMatch(h.shell.headers.get('content-security-policy'),/unsafe-inline/);
    const $=load(h.html);assert.equal($('header').length,1);assert.equal($('nav[aria-label="BackOffice actions"]').length,1);assert.equal($('#backoffice-content').length,1);assert.equal($('script:not([src])').length,0);assert.equal($('html').attr('data-wyd-theme'),'system');
    assert.match($('header').text(),/Example Site.*boilerplate/);assert.equal(h.html.includes(f.login.token),false);assert.equal(h.html.includes(f.password),false);
    const [action]=await h.discover();assert.equal(action.service,undefined);assert.equal(action.reference.app,'boilerplate');
    const response=await h.post({reference:action.reference,input:{limit:5}});assert.equal(response.status,200,await response.clone().text());
    const result=await response.json();assert.equal(result.value.members[0].id,f.user.membership.id);assert.equal(result.value.total,1);
    assert.doesNotMatch(JSON.stringify(result),/password|credential|token|session|provider|handle|installationContext/i);
    const front=await h.get('/');assert.equal(front.status,200);await front.text();
    const privatePage=await h.get('/administration/');assert.notEqual(privatePage.status,200);await privatePage.text();
    for(const asset of ['/runtime/wydclient/backoffice.js','/backoffice/assets/shell.css']){const r=await h.get(asset);assert.equal(r.status,200);assert.ok((await r.text()).length>100);}
    for(const route of ['/runtime/wydgine/packages/backoffice.js','/backoffice/api/host-policy','/backoffice/AccountAdmin','/backoffice/HostAdmin']){const r=await h.get(route);assert.equal(r.status,404);await r.text();}
  });
  test(`BOHTTP-02 ${provider}: no anonymous, expired, revoked or cross-site authentication`,async t=>{
    const f=await actionFixture(t,provider),h=await listen(t,f);
    for(const route of ['/backoffice','/backoffice/api/actions']){
      const r=await fetch(h.base+route);assert.equal(r.status,401);assert.equal(r.headers.get('set-cookie'),null);await r.text();
    }
    const [a]=await h.discover();
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:[]});
    assert.deepEqual(await h.discover(),[]);let denied=await h.post({reference:a.reference,input:{}});assert.equal(denied.status,403);await denied.text();
    await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['gate.members.manage']});
    await f.gate.manageMember({id:f.user.membership.id,status:'suspended'});
    const revoked=await h.get();assert.equal(revoked.status,401);assert.match(revoked.headers.get('set-cookie'),/wydgit-auth=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0/);await revoked.text();
    await h.stop();await f.gate.manageMember({id:f.user.membership.id,status:'active'});f.login=await f.gate.login('alice',f.password);const fresh=await listen(t,f);
    const now=t.mock.method(Date,'now',()=>f.login.session.expiresAt);const expired=await fresh.get('/backoffice/api/actions');assert.equal(expired.status,401);await expired.text();now.mock.restore();
  });
  test(`BOHTTP-03 ${provider}: lifecycle and contract changes never rebind a browser reference`,async t=>{
    const f=await actionFixture(t,provider);let h=await listen(t,f),[a]=await h.discover();const original=a.reference;await h.stop();
    await f.place('replace');h=await listen(t,f);
    let r=await h.post({reference:original,input:{}});assert.equal(r.status,409);assert.equal((await r.json()).code,'ACTION.STALE');
    [a]=await h.discover();await h.stop();await f.place('relocate','FrontEnd');h=await listen(t,f);assert.deepEqual(await h.discover(),[]);
    r=await h.post({reference:a.reference,input:{}});assert.equal(r.status,409);await r.text();await h.stop();
    await f.place('relocate');await f.place('retire');h=await listen(t,f);assert.deepEqual(await h.discover(),[]);await h.stop();await f.place('replace');
    const m=plain(f.manifest);m.version='0.1.1';m.backofficeActions[0].input.fields.limit.max=25;await fs.writeFile(path.join(f.candidate.packagePath,'manifest.json'),JSON.stringify(m));
    await packageOperation(f.operation('update',[f.candidate]));h=await listen(t,f);[a]=await h.discover();r=await h.post({reference:original,input:{}});assert.equal(r.status,409);await r.text();await h.stop();
    await packageOperation(f.operation('uninstall'));h=await listen(t,f);assert.deepEqual(await h.discover(),[]);await h.stop();
    await packageOperation(f.operation('install',[f.candidate]));h=await listen(t,f);r=await h.post({reference:a.reference,input:{}});assert.equal(r.status,409);await r.text();const [fresh]=await h.discover();
    r=await h.post({reference:fresh.reference,input:{limit:5}});assert.equal(r.status,200);await r.text();
  });
}

test('BOHTTP-04: methods, CSRF, origin, JSON/body budgets, closed envelopes, pollution and ambiguous credentials',async t=>{
  const f=await actionFixture(t),h=await listen(t,f),[a]=await h.discover(),body={reference:a.reference,input:{}};
  for(const [headers,status]of [[{'X-Wydgit-CSRF':''},403],[{'X-Wydgit-CSRF':'forged'},403],[{Origin:'https://foreign.test'},400],[{'Content-Type':'text/plain'},415],[{'Content-Type':'application/json; charset=iso-8859-1'},415],[{'Content-Encoding':'gzip'},415],[{Authorization:'Bearer '+f.login.token},400],[{Cookie:h.cookie+'; __Host-wydgit-auth='+f.login.token},400],[{Cookie:h.cookie+'; '+h.cookie},400]]){
    const r=await h.post(body,headers);assert.equal(r.status,status,JSON.stringify(headers));const text=await r.text();assert.equal(text.includes(f.login.token),false);assert.equal(r.headers.get('access-control-allow-origin'),null);
  }
  for(const method of ['PUT','PATCH','DELETE']){const r=await h.post(body,{},method);assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'POST');await r.text();}
  const get=await h.get('/backoffice/api/actions/invoke');assert.equal(get.status,405);await get.text();
  for(const value of ['{',JSON.stringify({...body,app:'foreign'}),JSON.stringify({...body,session:f.login.token}),JSON.stringify({...body,identity:{authenticated:true}}),JSON.stringify({...body,input:{unknown:true}}),JSON.stringify({...body,reference:{...a.reference,revision:'forged'}}),`{"reference":${JSON.stringify(a.reference)},"input":{"__proto__":{"polluted":true}}}`]){
    const r=await h.post(value);assert.ok([400,409].includes(r.status));assert.equal((await r.json()).ok,false);
  }
  assert.equal({}.polluted,undefined);
  const oversized=await h.post(' '.repeat(48001));assert.equal(oversized.status,413);await oversized.text();
  for(const query of ['?session=leak','?app=foreign','?limit=10&limit=1','?offset=-1','?limit=11']){const r=await h.get('/backoffice/api/actions'+query);assert.equal(r.status,400);await r.text();}
  for(const headers of [{Origin:'https://foreign.test'},{'Sec-Fetch-Site':'same-site'},{'Sec-Fetch-Site':'cross-site'}]){const r=await h.get('/backoffice/api/actions',headers);assert.equal(r.status,403);await r.text();}
  const invalidUtf=await fetch(h.base+'/backoffice/api/actions/invoke',{method:'POST',headers:{Cookie:h.cookie,Origin:h.base,'Content-Type':'application/json','X-Wydgit-CSRF':h.csrf},body:Buffer.from([0xff])});assert.equal(invalidUtf.status,400);await invalidUtf.text();
});

test('BOHTTP-05: exact site binding with identical action IDs and independent cookie origins',async t=>{
  const a=await actionFixture(t,'json'),b=await actionFixture(t,'sqlite',{app:'site-b'}),ha=await listen(t,a),hb=await listen(t,b),[aa]=await ha.discover(),[ab]=await hb.discover();
  assert.equal(aa.id,ab.id);let r=await hb.post({reference:aa.reference,input:{}});assert.equal(r.status,409);await r.text();
  r=await hb.get('/backoffice/api/actions',{Cookie:'wydgit-auth='+a.login.token});assert.equal(r.status,401);await r.text();
  r=await hb.post({reference:ab.reference,input:{}},{'X-Wydgit-CSRF':ha.csrf});assert.equal(r.status,403);await r.text();
  r=await ha.post({reference:aa.reference,input:{}});assert.equal(r.status,200);await r.text();
});

test('BOHTTP-06: approved policy narrowing removes discovery; permission cannot replace SEAM',async t=>{
  const f=await actionFixture(t);let h=await listen(t,f);const [a]=await h.discover();await h.stop();
  const s=catalog(f),e=s.packages[0],grants=plain(e.approved);grants.capabilities=[];
  const host=new ExecutionContext({...f.operator,capabilities:[...f.operator.capabilities,'packages.policy.manage']});
  const plan=await planPackagePolicy({root:f.root,app:'boilerplate',package:e.manifest.id,installation:e.receipt.id,revision:s.revision,packageRevision:e.receipt.revision,policyRevision:0,policy:{grants,stores:[]},installationContext:host});
  const approval=await approvePackagePolicy(plan,{installationContext:host});
  await applyPackagePolicy({root:f.root,app:'boilerplate',package:e.manifest.id,installation:e.receipt.id,revision:approval.revision,packageRevision:e.receipt.revision,policyRevision:0,approval:approval.id,planHash:plan.sha256,installationContext:host});
  h=await listen(t,f);assert.deepEqual(await h.discover(),[]);const r=await h.post({reference:a.reference,input:{}});assert.equal(r.status,409);await r.text();
});

test('BOHTTP-07: actual write requires confirmation and timeout may follow committed side effects',async t=>{
  const f=await actionFixture(t,'json',{edit:m=>{const a=m.backofficeActions[0];a.id='manage-member';a.service.operation='manage-member';a.effect='write';a.confirmation='Confirm the membership change';a.input={type:'object',fields:{id:{type:'string',maxLength:64},status:{type:'string',maxLength:16}}};a.output=a.output.fields.members.items;}});
  const target=await f.gate.register({username:'bob',password:f.password});let calls=0;
  const real=f.libraries,libraries={...real,bind(context,operation){const bound=real.bind(context,operation);return {...bound,async invoke(...args){calls++;const result=await bound.invoke(...args);await new Promise(r=>setTimeout(r,1100));return result;}};}};
  const h=await listen(t,f,{libraries}),[a]=await h.discover(),body={reference:a.reference,input:{id:target.membership.id,status:'suspended'}};
  const missing=await h.post(body);assert.equal(missing.status,400);assert.equal((await missing.json()).code,'ACTION.CONFIRMATION');assert.equal(calls,0);
  const changed=await h.post({...body,confirmed:true});assert.equal(changed.status,503);assert.equal((await changed.json()).code,'SEWN.LIMIT');assert.equal(calls,1);assert.equal(changed.headers.get('x-wydgit-action-outcome'),'uncertain');
  const members=await f.gate.listMembers({limit:20});assert.equal(members.members.find(m=>m.id===target.membership.id).status,'suspended');
});

test('BOHTTP-08: unbound standalone ingress cannot expose protected BackOffice',async t=>{
  const f=await actionFixture(t),h=await listen(t,f,{localHostname:undefined});assert.equal(h.shell.status,503);const r=await h.get('/');assert.equal(r.status,200);await r.text();
});

test('BOHTTP-09: browser-form login to real generic UI and member table; hostile text is escaped',async t=>{
  const attack='<img src=x onerror=alert(1)>',f=await actionFixture(t,'json',{edit:m=>{m.backofficeActions[0].title=attack;m.backofficeActions[0].description=attack;},configure:async f=>{const file=path.join(f.root,'content/app.json'),app=JSON.parse(await fs.readFile(file));app.properties.title=attack;await fs.writeFile(file,JSON.stringify(app));}});
  const directory=path.resolve('examples/membership'),manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json')));
  const ids=[...f.operator.visible,...manifest.permissions.visible,'page-login'],operator=new ExecutionContext({...f.operator,visible:ids,editable:ids});
  await packageOperation({root:f.root,package:manifest.id,action:'install',installationContext:operator,candidates:[{packagePath:directory,approvals:manifest.permissions,storageMappings:{},placement:{page:'page-login',parent:'page-login',slot:'sections',index:0},page:{schema:'wydgit/0.2',id:'page-login',prototype:'wydgit.core/page',properties:{title:'Sign in',slug:'sign-in'},slots:{},provenance:{}}}]});
  await f.gate.register({username:'bob',password:f.password,displayName:attack});
  const h=await listen(t,f),page=await fetch(h.base+'/sign-in/'),html=await page.text(),cookie=page.headers.getSetCookie()[0].split(';')[0],login=load(html)('#membership-login').attr('action');
  const signedIn=await fetch(h.base+login,{method:'POST',headers:{Cookie:cookie,Origin:h.base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'alice',password:f.password})});
  assert.equal(signedIn.status,200,await signedIn.clone().text());const auth=signedIn.headers.getSetCookie().find(c=>c.startsWith('wydgit-auth=')).split(';')[0];
  assert.match(signedIn.headers.getSetCookie().find(c=>c.startsWith('wydgit-auth=')),/Path=\/; HttpOnly; SameSite=Lax; Max-Age=/);assert.equal((await signedIn.text()).includes(f.password),false);
  const opened=await fetch(h.base+'/backoffice',{headers:{Cookie:auth}}),source=await opened.text();assert.equal(opened.status,200);assert.equal(load(source)('header img').length,0);assert.ok(source.includes('&lt;img'));
  const {Window}=await import('happy-dom'),{mountBackOffice}=await import('../wydclient/backoffice.js');
  const w=new Window({url:h.base+'/backoffice',settings:{disableJavaScriptEvaluation:true,disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});t.after(()=>w.happyDOM.close());w.document.write(source);
  let invoked;const finished=new Promise(r=>invoked=r);
  const ui=mountBackOffice({document:w.document,fetch:async(url,options)=>{const response=await fetch(h.base+url,{...options,headers:{...options.headers,Cookie:auth,...(options.method==='POST'?{Origin:h.base}:{})}});if(url.includes('invoke')){await response.clone().arrayBuffer();setTimeout(invoked,0);}return response;}});
  await ui.ready;const button=w.document.querySelector('nav button');assert.equal(button.textContent,attack);button.click();
  const pending=finished;w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await pending;
  assert.match(w.document.getElementById('bo-status').textContent,/completed/);assert.ok(w.document.querySelector('tbody').textContent.includes(attack));assert.equal(w.document.querySelectorAll('img').length,0);
  assert.equal(w.document.querySelectorAll('tbody tr').length,2);
});

test('BOHTTP-10: trusted HTTPS ingress retains Secure host cookies and exact public origin',async t=>{
  const f=await actionFixture(t),{createServer}=await import('node:http'),{validateRouting,resolveRoute,bindRequestRoute}=await import('../wydgine/http/routing.js');
  const config=validateRouting({schema:'wydgit.routing/0.1',transport:{mode:'trusted-proxy',peers:['127.0.0.1']},routes:[{hostname:'admin.example.test',app:'boilerplate',state:'active',approval:'operator-domain'}]},['boilerplate']);
  const app=createApp({root:f.root,libraries:f.libraries}),server=createServer((req,res)=>{try{const route=resolveRoute(config,req);if(!route)throw Error();bindRequestRoute(req,route);app.handle(req,res);}catch{res.statusCode=400;res.end('Request rejected');}});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>app.shutdown(server));const base='http://127.0.0.1:'+server.address().port;
  const headers={'X-Forwarded-Host':'admin.example.test','X-Forwarded-Proto':'https',Cookie:'__Host-wydgit-auth='+f.login.token};
  const shell=await fetch(base+'/backoffice',{headers});assert.equal(shell.status,200);const csrf=load(await shell.text())('meta[name="wydgit-backoffice-csrf"]').attr('content');
  const list=await fetch(base+'/backoffice/api/actions',{headers}),[action]=(await list.json()).value.actions;
  const invoked=await fetch(base+'/backoffice/api/actions/invoke',{method:'POST',headers:{...headers,Origin:'https://admin.example.test','Content-Type':'application/json','X-Wydgit-CSRF':csrf},body:JSON.stringify({reference:action.reference,input:{}})});assert.equal(invoked.status,200);await invoked.text();
  const wrong=await fetch(base+'/backoffice/api/actions/invoke',{method:'POST',headers:{...headers,Origin:'https://sibling.example.test'}});assert.equal(wrong.status,400);await wrong.text();
  const invalid=await fetch(base+'/backoffice',{headers:{...headers,Cookie:'__Host-wydgit-auth=invalid'}});assert.equal(invalid.status,401);const deletion=invalid.headers.get('set-cookie');assert.match(deletion,/__Host-wydgit-auth=; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=0/);assert.doesNotMatch(deletion,/Domain=/);await invalid.text();
});

test('BOHTTP-11: explicit native demo installation uses reviewed grants and creates no Gate accounts',async t=>{
  const f=await actionFixture(t,'json',{install:false}),{installMembers}=await import('../examples/backoffice-members/install.js');
  const before=await f.gate.listMembers({limit:50});
  await assert.rejects(installMembers({root:f.root,approvals:{...f.manifest.permissions,capabilities:[]}}));
  await installMembers({root:f.root,approvals:f.manifest.permissions});
  assert.deepEqual(await f.gate.listMembers({limit:50}),before);
  const h=await listen(t,f),[action]=await h.discover();const result=await h.post({reference:action.reference,input:{}});assert.equal(result.status,200);assert.equal((await result.json()).value.total,before.total);
  await h.stop();let started=0;
  assert.throws(()=>createApp({root:f.root,libraries:f.libraries,localHostname:'public.example.com',lifecycle:{start(){started++;return Promise.resolve();},async stop(){}}}),{code:'HOST.ROUTING'});
  assert.equal(started,0,'invalid development ingress must reject before lifecycle startup');
});

// The clock advances only at explicit barriers; no sleep guesses decide outcomes.
function actionBarrier(f,{before=false,fail=false}={}){
  const real=f.libraries;let enter,release,calls=0;
  const entered=new Promise(r=>enter=r),held=new Promise(r=>release=r);
  const libraries={...real,bind(context,operation){const bound=real.bind(context,operation);return {...bound,async invoke(...args){
    calls++;if(before){enter();await held;}
    const result=fail?{ok:false,code:'SERVICE.FAILED',message:'secret /native/path',details:{secret:true}}:await bound.invoke(...args);
    if(!before){enter();await held;}return result;
  }};}};
  return {libraries,entered,release,calls:()=>calls};
}

test('BOREL-01: expired native admission and genuine service budget exhaustion dispatch no operation',async t=>{
  const f=await actionFixture(t),api=f.framework(),[a]=await f.discover(api);let started=0;
  const expired=await api.invoke({...f.request,reference:a.reference,input:{}},{deadline:0,onStart:()=>started++});
  assert.equal(expired.code,'SEWN.LIMIT');assert.equal(started,0);
  const h=await listen(t,f,{contextPolicy:c=>new ExecutionContext({...c,limits:{sewnServiceCalls:0}})}),[fresh]=await h.discover();
  const response=await h.post({reference:fresh.reference,input:{}});assert.equal(response.status,503);
  assert.equal((await response.json()).code,'SEWN.LIMIT');assert.equal(response.headers.get('x-wydgit-action-outcome'),'rejected');
});

test('BOREL-02: HTTP deadline crosses authorization before service admission, rather than starting late work',async t=>{
  const f=await actionFixture(t),real=f.libraries;let advance=()=>{},calls=0;
  const libraries={...real,async authorizeSitePolicy(...args){const value=await real.authorizeSitePolicy(...args);advance();return value;},bind(c,op){const b=real.bind(c,op);return {...b,invoke(...args){calls++;return b.invoke(...args);}};}};
  const h=await listen(t,f,{libraries}),[a]=await h.discover();const now=Date.now();let clock=now;
  t.mock.method(Date,'now',()=>clock);advance=()=>{clock=now+120001;};
  const r=await h.post({reference:a.reference,input:{}});assert.equal(r.status,503);assert.equal((await r.json()).code,'HTTP.DEADLINE');
  assert.equal(calls,0);assert.equal(r.headers.get('x-wydgit-action-outcome'),'rejected');
});

for(const expired of [false,true])test(`BOREL-03: asynchronous read ${expired?'after':'before'} unchanged deadline, one service charge`,async t=>{
  const f=await actionFixture(t),barrier=actionBarrier(f);t.after(barrier.release);
  const h=await listen(t,f,{libraries:barrier.libraries,contextPolicy:c=>new ExecutionContext({...c,limits:{sewnServiceCalls:1}})}),[a]=await h.discover();let clock=Date.now();t.mock.method(Date,'now',()=>clock);
  const pending=h.post({reference:a.reference,input:{}});await barrier.entered;if(expired)clock+=1001;barrier.release();
  const r=await pending;assert.equal(r.status,expired?503:200);assert.equal(r.headers.get('x-wydgit-action-outcome'),expired?'uncertain':'completed');
  const result=await r.json();assert.equal(result.ok,!expired);if(expired){assert.equal(result.code,'SEWN.LIMIT');assert.deepEqual(result.details,{});}assert.equal(barrier.calls(),1);
});

test('BOREL-04: failed read sanitizes host details and concurrent siblings retain independent budgets',async t=>{
  const f=await actionFixture(t),barrier=actionBarrier(f,{fail:true});t.after(barrier.release);
  const h=await listen(t,f,{libraries:barrier.libraries}),[a]=await h.discover();
  const pending=h.post({reference:a.reference,input:{}});await barrier.entered;barrier.release();const bad=await pending;
  assert.equal(bad.status,503);const result=await bad.json();assert.deepEqual(result.details,{});assert.equal(JSON.stringify(result).includes('secret'),false);
  await h.stop();const fresh=await listen(t,f),[next]=await fresh.discover();
  const responses=await Promise.all(Array.from({length:8},()=>fresh.post({reference:next.reference,input:{limit:1}})));
  assert.ok(responses.some(r=>r.status===200),'At least one sibling completes');
  for(const r of responses){assert.ok([200,503].includes(r.status),'Contention is availability failure, never revoked authentication');assert.equal(r.headers.get('set-cookie'),null);const result=await r.json();if(r.status===200)assert.equal(r.headers.get('x-wydgit-action-outcome'),'completed');else assert.equal(result.code,'SERVICE.FAILED');}
});

test('BOREL-05: real disconnect retains admitted I/O and App drain until the service settles',async t=>{
  const f=await actionFixture(t),barrier=actionBarrier(f);t.after(barrier.release);
  const h=await listen(t,f,{libraries:barrier.libraries}),[a]=await h.discover(),http=await import('node:http');
  let client;const closed=new Promise(resolve=>h.server.once('request',(_req,res)=>res.once('close',resolve)));
  const body=JSON.stringify({reference:a.reference,input:{}});
  const pending=new Promise(resolve=>{client=http.request(h.base+'/backoffice/api/actions/invoke',{method:'POST',headers:{Cookie:h.cookie,Origin:h.base,'Content-Type':'application/json','X-Wydgit-CSRF':h.csrf,'Content-Length':Buffer.byteLength(body)}},()=>assert.fail('Aborted request published a response'));client.once('error',resolve);client.end(body);});
  await barrier.entered;client.destroy();await pending;await closed;
  let stopped=false;const stop=h.stop().then(()=>stopped=true);await new Promise(r=>setImmediate(r));assert.equal(stopped,false);
  await assert.rejects(f.place('replace'),{code:'PACKAGE.RUNNING'});barrier.release();await stop;assert.equal(barrier.calls(),1);
  await f.place('replace');
});

for(const code of ['GATE.CONFLICT','GATE.BUSY','GATE.IO'])test(`BOREL-06: ${code} during authentication preserves credential and reports service unavailability`,async t=>{
  const f=await actionFixture(t),real=f.libraries;let unavailable=false;
  const libraries={...real,bind(c,op){const b=real.bind(c,op);return {...b,call(...args){if(unavailable&&args[0]==='wydgate'&&args[1]==='resolve-session')return {ok:false,code};return b.call(...args);}};}};
  const h=await listen(t,f,{libraries});unavailable=true;const r=await h.get('/backoffice/api/actions');
  assert.equal(r.status,503);assert.equal(r.headers.get('set-cookie'),null);assert.equal((await r.json()).code,'SERVICE.FAILED');
  unavailable=false;assert.equal((await h.discover()).length,1);
});

test('BOREL-07: expiration while canonical service admission is pending rejects before its handler begins',async t=>{
  const f=await actionFixture(t),barrier=actionBarrier(f,{before:true});t.after(barrier.release);
  const h=await listen(t,f,{libraries:barrier.libraries}),[a]=await h.discover();let clock=Date.now();t.mock.method(Date,'now',()=>clock);
  const pending=h.post({reference:a.reference,input:{}});await barrier.entered;clock+=1001;barrier.release();
  const r=await pending;assert.equal(r.status,503);assert.equal((await r.json()).code,'SEWN.LIMIT');assert.equal(r.headers.get('x-wydgit-action-outcome'),'rejected');
});

for(const provider of ['json','sqlite'])test(`GATECONT HTTP ${provider}: concurrent discovery and mixed invocation recover without cookie deletion`,async t=>{
 const f=await actionFixture(t,provider),h=await listen(t,f),[action]=await h.discover();
 for(const mixed of [false,true]){
  const responses=await Promise.all(Array.from({length:8},(_,i)=>mixed&&i%2?h.post({reference:action.reference,input:{limit:1}}):h.get('/backoffice/api/actions')));
  assert.ok(responses.some(r=>r.status===200));
  for(const response of responses){
   assert.ok([200,503].includes(response.status));assert.equal(response.headers.get('set-cookie'),null);
   const result=await response.json();assert.equal(result.ok,response.status===200);if(!result.ok)assert.equal(result.code,'SERVICE.FAILED');
  }
  assert.equal((await h.discover()).length,1,'Same credential recovers after bounded contention');
 }
 await f.gate.logout(f.login.token);const revoked=await h.get('/backoffice/api/actions');assert.equal(revoked.status,401);await revoked.text();
});
