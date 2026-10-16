import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createOperationalHost} from 'wydgine/trusted/worker';
import {loadPeerCredentials} from 'wydgine/trusted/unix-peer';
import {createStreamPeer} from 'wydgine/trusted/stream-peer';
import {bounds,validateBootstrap,revision} from 'wydgine/trusted/protocol';
import {describeDeployment,linuxPreflight,planFirewall,applyFirewall,createLinuxBackend} from 'wydhosting';
import {digest} from 'wydhosting/contracts';
const {inspectPlatform}=await import(new URL('./src/platform/linux/platform.js',import.meta.resolve('wydhosting/package.json')));
const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-linux-tests-'));
const helper=path.join(root,'peercred.node');
const native=fileURLToPath(new URL('./native/peercred.c',import.meta.resolve('wydgine/package.json')));
const compile=spawnSync('cc',['-shared','-fPIC','-Wall','-Wextra','-Werror','-I/usr/include/node',native,'-o',helper],{encoding:'utf8'});
assert.equal(compile.status,0,compile.stderr);
const credentials=loadPeerCredentials(helper);
test.after(async()=>{await fs.rm(root,{recursive:true,force:true});});
const request=(socketPath,headers={})=>new Promise((resolve,reject)=>{const q=http.get({socketPath,headers:{Host:'alpha.localhost','X-Forwarded-Host':'alpha.localhost','X-Forwarded-Proto':'https',...headers},timeout:5000},response=>{let body='';response.on('data',c=>body+=c);response.on('end',()=>resolve({status:response.statusCode,body,headers:response.headers}));});q.on('error',reject);q.on('timeout',()=>q.destroy(Error('HTTP timeout')));});
async function privateHost(t,uid=process.getuid()){
 const base=await fs.mkdtemp(path.join(root,'host-'));for(const name of ['content','prototypes','public'])await fs.cp(name,path.join(base,'app',name),{recursive:true});await fs.writeFile(path.join(base,'app/wydgit.config.json'),JSON.stringify({schema:'wydgit.host/0.1',libraries:[]}));
 const inventory={schema:'wydgit.multi-host/0.1',apps:[{id:'boilerplate',root:'app'}],routing:{schema:'wydgit.routing/0.1',transport:{mode:'private-unix',uid},routes:[{hostname:'alpha.localhost',app:'boilerplate',state:'active',approval:'local-development'}]}};
 const host=await createOperationalHost({schema:'wydgit.operations/0.1',inventory,optional:[]},{root:base,peerCredentials:credentials});const socketPath=path.join(base,'http.sock');await host.start(socketPath);t.after(()=>host.shutdown());return {host,socketPath,base};
}
test('Linux primitive attack suite: actual current-UID filesystem and Unix sockets; no administrative commands',()=>{
 const result=spawnSync('python3',['test-support/linux/verify.py',fileURLToPath(new URL('./broker',import.meta.resolve('wydhosting/package.json')))],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stderr,/Ran 28 tests/);
});
test('preflight requires explicit EL10 identity, kernel prerequisites and enforcing SELinux',()=>{
 const environment={platform:'linux',arch:'x64',distro:{ID:'almalinux',VERSION_ID:'10.2'},pid1:'systemd',controllers:['cpu','memory','pids'],selinux:'enforcing'};
 assert.equal(inspectPlatform(environment).candidate,true);assert.equal(inspectPlatform(environment).lane.firewall,'firewalld');
 for(const distro of [{ID:'rhel',VERSION_ID:'10'},{ID:'rhel',VERSION_ID:'10.1'},{ID:'ubuntu',VERSION_ID:'24.04'},{ID:'debian',VERSION_ID:'13'}])assert.equal(inspectPlatform({...environment,distro}).candidate,true);
 for(const change of [{platform:'darwin'},{arch:'arm64'},{pid1:'container-init'},{controllers:['cpu','pids']},{selinux:'permissive'},{selinux:'unavailable'},...['9.6','11','10evil','10.2.1','10\n'].map(VERSION_ID=>({distro:{ID:'almalinux',VERSION_ID}})),...['rocky','fedora','mint'].map(ID=>({distro:{ID,ID_LIKE:'rhel',VERSION_ID:'10'}}))])assert.equal(inspectPlatform({...environment,...change}).candidate,false,JSON.stringify(change));
});
test('native helper obtains kernel peer PID/UID/GID on real Unix connections',async t=>{
 const filename=path.join(root,'peer.sock');const server=net.createServer(socket=>{assert.deepEqual(credentials(socket),{pid:process.pid,uid:process.getuid(),gid:process.getgid()});socket.end();});await new Promise(r=>server.listen(filename,r));t.after(()=>new Promise(r=>server.close(r)));
 const socket=net.connect(filename);await new Promise((resolve,reject)=>{socket.once('connect',()=>{assert.deepEqual(credentials(socket),{pid:process.pid,uid:process.getuid(),gid:process.getgid()});resolve();});socket.once('error',reject);});socket.destroy();assert.throws(()=>credentials({}),{code:'WORKER.PEER'});
});
test('actual private Unix HTTP preserves exact HTTPS routing and rejects unknown or foreign destinations',async t=>{
 const {socketPath}=await privateHost(t);const response=await request(socketPath);assert.equal(response.status,200,response.body);assert.equal((await request(socketPath,{'X-Forwarded-Host':'foreign.localhost'})).status,421);assert.equal((await request(socketPath,{'X-Forwarded-Host':'unknown.localhost'})).status,421);
 assert.ok(!response.headers['access-control-allow-origin']);
});
test('actual private Unix HTTP refuses spoofed proxy headers and TLS scheme confusion',async t=>{
 const {socketPath}=await privateHost(t);
 for(const headers of [{'X-Forwarded-Proto':'http'},{Forwarded:'host=alpha.localhost'},{'X-Forwarded-For':'127.0.0.1'},{'X-Forwarded-Port':'443'},{'X-Forwarded-Host':'alpha.localhost,foreign.localhost'}])assert.equal((await request(socketPath,headers)).status,400);
});
test('kernel credential gate closes a real same-UID caller when a different ingress UID is required',async t=>{
 const {socketPath}=await privateHost(t,process.getuid()+1);await assert.rejects(request(socketPath));
});
test('private Unix endpoint closes on retirement, with no TCP listener or fallback',async t=>{
 const {socketPath,host}=await privateHost(t);await host.shutdown();await assert.rejects(request(socketPath));
});
test('byte manifest covers execution content, rejects links, and does not copy writable data',async t=>{
 const {base}=await privateHost(t);await fs.mkdir(path.join(base,'app/data'));await fs.writeFile(path.join(base,'app/data/private'),'private');const descriptor=await describeDeployment(path.join(base,'app'));assert.ok(descriptor.files.some(f=>f.path==='content/app.json'));assert.ok(!descriptor.files.some(f=>f.path.startsWith('data/')));
 await fs.symlink('/etc/passwd',path.join(base,'app/public/unsafe'));await assert.rejects(describeDeployment(path.join(base,'app')),{code:'HOSTING.ROOT'});
});
test('preflight and installed setup inspect without privilege or filesystem mutation',async()=>{
 const value=await linuxPreflight();assert.equal(value.productionReady,false);assert.equal(value.privilegedQualification,'not-executed');
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('./bin/wydhosting.js',import.meta.resolve('wydhosting/package.json'))),'setup'],{encoding:'utf8',timeout:5000});assert.equal(result.status,0,result.stderr);const output=JSON.parse(result.stdout);assert.deepEqual(output.mutations,[]);assert.equal(output.state,'inspected');
});
test('firewall preview requires explicit administration paths and independent recovery; live apply refuses',()=>{
 const input={manager:'ufw',administration:[{source:'192.0.2.1',port:2222},{source:'2001:db8::1',port:2223}],publicPorts:[80,443],recovery:{channel:'vm-console',independentlyVerified:true}};
 const plan=planFirewall(input);assert.equal(plan.applySupported,false);assert.equal(plan.flushUnrelatedRules,false);assert.equal(plan.administration[0].port,2222);assert.throws(applyFirewall,{code:'HOSTING.FIREWALL_UNQUALIFIED'});
 for(const change of [{manager:'firewalld'},{administration:[]},{publicPorts:[3000]},{recovery:{channel:'ssh',independentlyVerified:true}}])assert.throws(()=>planFirewall({...input,...change}));
});
test('inherited stream codec enforces fragmented frames, message bounds and connection closure',async t=>{
 const filename=path.join(root,'frames.sock');let receive,closed;const got=new Promise(r=>receive=r),ended=new Promise(r=>closed=r);const server=net.createServer(socket=>{const peer=createStreamPeer(socket);peer.on('message',receive);peer.on('disconnect',closed);});await new Promise(r=>server.listen(filename,r));t.after(()=>new Promise(r=>server.close(r)));
 const socket=net.connect(filename);socket.write('{"ok":');socket.write('true}\n');assert.deepEqual(await got,{ok:true});socket.write('x'.repeat(bounds.messageBytes+1));await ended;socket.destroy();
});
test('Linux bootstrap refuses public listener substitution and unknown control data',()=>{
 const listener={mode:'private-unix',path:'/run/wydhosting/workers/12345678-1234-1234-1234-123456789abc/http.sock',uid:process.getuid()},inventory={apps:[{id:'alpha'}],routing:{transport:{mode:'private-unix',uid:process.getuid()}}};
 const b={providerId:'provider',poolId:'pool',workerId:'worker',generation:'generation',epoch:1,registryRevision:1,root:'/var/lib/wydhosting/pools/pool/generations/1',inventory,snapshots:{alpha:'a'.repeat(64)},execution:{},optional:[],listener,startupMs:1000,shutdownMs:1000};b.configurationRevision=revision({root:b.root,inventory,snapshots:b.snapshots,execution:b.execution,optional:b.optional,listener});validateBootstrap(b);
 for(const change of [x=>x.listener={host:'127.0.0.1',port:3000},x=>x.listener.path='/tmp/customer/socket',x=>x.listener.uid++,x=>x.command='eval',x=>x.epoch=0]){const bad=structuredClone(b);change(bad);assert.throws(()=>validateBootstrap(bad));}
});
test('unavailable broker, foreign pools and unsupported operations fail without a subprocess fallback',async()=>{
 const body={schema:'wydhosting.linux-approval/1',providerId:'provider',registryRevision:1,registryDigest:'a'.repeat(64),providerUid:process.getuid(),providerGid:process.getgid(),pools:[{poolId:'pool'}]};const approval={...body,policyRevision:digest(body),qualification:'unqualified',activation:'manual-review-required'};
 const backend=createLinuxBackend({approval,credentialHelper:helper,socketPath:path.join(root,'absent.sock'),timeoutMs:100});await assert.rejects(backend.operation('eval','pool'));await assert.rejects(backend.operation('stage','foreign'));await assert.rejects(backend.operation('stage','pool'),{code:'HOSTING.BROKER_UNAVAILABLE'});
});
test('forged local broker cannot impersonate root even with matching policy revision',async t=>{
 const filename=path.join(root,'fake-broker.sock'),server=net.createServer(socket=>{socket.on('error',()=>{});socket.end('{"ok":true}\n');});await new Promise(r=>server.listen(filename,r));t.after(()=>new Promise(r=>server.close(r)));
 const body={schema:'wydhosting.linux-approval/1',providerId:'provider',registryRevision:1,registryDigest:'a'.repeat(64),providerUid:process.getuid(),providerGid:process.getgid(),pools:[{poolId:'pool'}]};const backend=createLinuxBackend({approval:{...body,policyRevision:digest(body),qualification:'unqualified',activation:'manual-review-required'},credentialHelper:helper,socketPath:filename});await assert.rejects(backend.operation('stage','pool'),{code:'HOSTING.BROKER_PEER'});
});

test('private ingress connection verifies the real worker listener PID and UID before sending HTTP',async t=>{
 const filename=path.join(root,'identity.sock');const server=net.createServer(socket=>socket.on('error',()=>{}));await new Promise(r=>server.listen(filename,r));const connections=new Set();server.on('connection',socket=>{connections.add(socket);socket.once('close',()=>connections.delete(socket));});t.after(async()=>{for(const socket of connections)socket.destroy();await new Promise(r=>server.close(r));});
 const body={schema:'wydhosting.linux-approval/1',providerId:'provider',registryRevision:1,registryDigest:'a'.repeat(64),providerUid:process.getuid(),providerGid:process.getgid(),pools:[{poolId:'pool'}]};const backend=createLinuxBackend({approval:{...body,policyRevision:digest(body),qualification:'unqualified',activation:'manual-review-required'},credentialHelper:helper});
 const cgroup=(await fs.readFile('/proc/self/cgroup','utf8')).trim().slice(3),status=await fs.readFile('/proc/self/stat','utf8'),startTime=status.slice(status.lastIndexOf(') ')+2).split(/\s+/)[19];
 const view={ready:true,endpoint:filename,service:{uid:process.getuid(),pid:process.pid,cgroup,startTime}};const socket=await backend.connectIngress(view);socket.destroy();
 for(const service of [{...view.service,uid:process.getuid()+1},{...view.service,pid:process.pid+1},{...view.service,cgroup:'/foreign'},{...view.service,startTime:'0'}])await assert.rejects(backend.connectIngress({...view,service}),{code:'HOSTING.INGRESS_PEER'});
 await assert.rejects(backend.connectIngress({...view,ready:false}));
});
test('raw inherited frames refuse duplicate keys, invalid UTF-8 and noncanonical encodings',async t=>{
 let n=0;for(const payload of [Buffer.from('{"a":1,"a":2}\n'),Buffer.from([255,10]),Buffer.from('{ "a":1}\n')]){
  const filename=path.join(root,'bad-frame-'+(++n)+'.sock');let finish;const closed=new Promise(r=>finish=r);const server=net.createServer(socket=>{const peer=createStreamPeer(socket);peer.on('message',()=>assert.fail('Invalid raw frame accepted'));peer.on('disconnect',finish);});await new Promise(r=>server.listen(filename,r));const socket=net.connect(filename);socket.on('error',()=>{});socket.write(payload);await closed;socket.destroy();await new Promise(r=>server.close(r));
 }
});

test('packaged Linux operator resources are complete and match authoritative repository guides when present',async()=>{
 const packageRoot=path.dirname(fileURLToPath(import.meta.resolve('wydhosting/package.json'))),names=['README.md','linux-support-matrix.md','broker-security.md','accounts-and-filesystem.md','deployment-staging.md','service-and-cgroups.md','private-ingress.md','firewall-and-recovery.md','verification.md'];
 for(const name of names){const shipped=await fs.readFile(path.join(packageRoot,'docs',name),'utf8');assert.ok(shipped.length>100);const source=await fs.readFile(path.join('docs/milestones/0.3-I5.6',name),'utf8').catch(()=>null);if(source!==null)assert.equal(shipped,source);}
 for(const name of ['broker/broker.py','broker/security.py','broker/worker.py','templates/wydhosting-broker.socket','templates/wydhosting-broker@.service','templates/wydhosting-provider.service','templates/wydhosting-broker.slice','templates/Caddyfile'])assert.equal((await fs.stat(path.join(packageRoot,name))).isFile(),true);
});

test('explicit trusted implementation root loads all five canonical libraries outside App source ancestry',async t=>{
 const {provisionExample}=await import('../examples/multi-app/setup.js');const {createHostApp}=await import('wydgine');const {ExecutionContext}=await import('wydgine/trusted/services');
 const base=await fs.mkdtemp(path.join(root,'services-'));await provisionExample(base);const appRoot=path.join(base,'app-alpha');await fs.rm(path.join(appRoot,'node_modules'),{recursive:true,force:true});
 const fake=path.join(appRoot,'node_modules/@wydgit/store');await fs.mkdir(fake,{recursive:true});await fs.writeFile(path.join(fake,'package.json'),JSON.stringify({name:'@wydgit/store',version:'0.1.0-alpha.3',type:'module',exports:{'.':'./index.js','./package.json':'./package.json'}}));await fs.writeFile(path.join(fake,'index.js'),"throw new Error('Upload-selected implementation must never load');\n");
 const app=await createHostApp({root:appRoot,appId:'app-alpha',implementationRoot:process.cwd()});t.after(()=>app.stop());
 const context=new ExecutionContext({publisher:'acme',package:'acme/demo',app:'app-alpha',self:'home',capabilities:['store.records.read'],scopes:{wydstore:[{store:'main',collection:'records'}]}});
 assert.equal((await app.locals.libraries.bind(context).invoke('wydstore','1.0.0','count',{store:'main',collection:'records'})).value,0);await app.stop();
 // No fallback from a missing trusted root to upload node_modules.
 await assert.rejects(createHostApp({root:appRoot,implementationRoot:path.join(base,'absent')}),{code:'LIBRARY.NOT_INSTALLED'});
});

test('provider edge rejects a real unauthorized Unix peer before registry or worker access and sanitizes diagnostics',async t=>{
 const {createPrivateIngress}=await import('wydhosting');let inspected=0,connected=0;const events=[];
 const server=http.createServer(createPrivateIngress({registry:{inspect(){inspected++;}},supervisor:{},backend:{connectIngress(){connected++;}},edgeUid:process.getuid()+1,credentialHelper:helper,onEvent:e=>events.push(e)}));const filename=path.join(root,'edge-denial.sock');await new Promise(r=>server.listen(filename,r));t.after(()=>new Promise(r=>server.close(r)));
 assert.equal((await request(filename,{Cookie:'private-session-must-not-be-logged'})).status,400);assert.equal(inspected,0);assert.equal(connected,0);assert.equal(events[0].code,'HOSTING.INGRESS_PEER');assert.doesNotMatch(JSON.stringify(events),/private-session|cookie|rawHeaders|stack/);
});
