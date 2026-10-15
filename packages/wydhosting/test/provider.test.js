import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createRegistry,emptyRegistry,validateRegistry,plan as rawPlan,compilePool as rawCompilePool,inspectRegistry as rawInspectRegistry,fingerprintApprovedApp} from '../src/index.js';
import {digest} from '../src/contracts.js';
import {validateAppInventory,createMultiAppHost} from '../../../wydgine/trusted/worker.js';
import {provisionExample} from '../../../examples/multi-app/setup.js';
import {run as rawRun} from '../bin/wydhosting.js';
const resources={maxPending:4,httpConcurrent:2,directConcurrent:2,payloadBytes:1048576},limits={sewnSteps:100};
const copy=v=>structuredClone(v);
const trustedRoot='/tmp/wydhosting-intended-fixture';
const plan=(r,q,o={})=>rawPlan(r,q,{fixtureRoot:trustedRoot,...o});
const compilePool=(r,p)=>rawCompilePool(r,p,{fixtureRoot:path.dirname(r.pools[0].base)});
const inspectRegistry=r=>rawInspectRegistry(r,{fixtureRoot:path.dirname(r.pools[0].base)});
const run=args=>rawRun([...args,'--fixture-root',trustedRoot]);
function fixture(root='/tmp/wydhosting-intended-fixture'){
 const r=copy(emptyRegistry('provider'));
 r.plans=['free','paid','dedicated'].map(tier=>({planId:tier,revision:1,tier,maxApps:tier==='free'?1:4,maxPools:tier==='dedicated'?4:1,allowPerApp:tier==='dedicated',resources:copy(resources),limits:copy(limits)}));
 r.accounts=[{accountId:'provider-worker',customerId:null,uid:4000,gid:4000,home:root+'/homes/provider',state:'intended'}];
 r.customers=['alpha','beta'].map(customerId=>({customerId,state:'active',planId:'free',planRevision:1,accountId:null}));
 r.pools=[{poolId:'shared',hostId:'local',mode:'shared',customerId:null,accountId:'provider-worker',base:root+'/execution',capacity:16,generation:1,state:'active',isolation:'shared-process',resources:copy(resources),limits:copy(limits),transport:{mode:'local-http'}}];
 r.apps=['alpha','beta'].map((customerId,i)=>({appId:'app-'+customerId,customerId,source:root+'/sources/'+customerId,snapshot:'0'.repeat(64),approval:'operator-approved',placement:{poolId:'shared',directory:'app-'+customerId,deploymentId:'deployment-'+i,epoch:1,state:'active'},state:'active',role:'tenant',resources:copy(resources),limits:copy(limits),namespaces:[]}));
 r.domains=r.apps.map(a=>({hostname:a.appId+'.localhost',appId:a.appId,customerId:a.customerId,approval:'local-development',evidence:'operator-approval',state:'active',epoch:1,revision:1}));return r;
}
function dedicated(r,tier='paid'){
 r.customers=[{...r.customers[0],planId:tier,accountId:'account-alpha'}];r.accounts.push({accountId:'account-alpha',customerId:'alpha',uid:4001,gid:4001,home:path.dirname(r.pools[0].base)+'/homes/alpha',state:'intended'});
 r.pools[0]={...r.pools[0],mode:tier==='paid'?'dedicated-customer':'dedicated-app',customerId:'alpha',accountId:'account-alpha',isolation:'separate-process-uid-required'};
 r.apps.forEach(a=>a.customerId='alpha');r.domains.forEach(d=>d.customerId='alpha');if(tier==='dedicated'){r.pools.push({...r.pools[0],poolId:'second',base:r.pools[0].base+'-second'});r.apps[1].placement.poolId='second';}return r;
}
const request=(operationId,expectedRevision,actions)=>({schema:'wydhosting.request/1',operationId,expectedRevision,expiresAt:Date.now()+600000,actions});
function registration(r){return ['plans','customers','accounts','pools','apps','domains'].flatMap((key,i)=>r[key].map(record=>({kind:['registerPlan','registerCustomer','assignAccount','registerPool','registerApp','registerDomain'][i],record})));}
async function store(t,options={}){const root=await fs.mkdtemp(path.join(os.tmpdir(),'wydhosting-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.chmod(root,0o700);const registry=createRegistry({directory:root,fixtureRoot:trustedRoot,authorize:()=> 'operator',...options});await registry.initialize('provider');return {root,registry};}
async function real(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'wydhosting-real-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const base=path.join(root,'execution');await fs.mkdir(base);await provisionExample(base);const r=fixture(root);for(const a of r.apps)a.snapshot=await fingerprintApprovedApp(path.join(base,a.placement.directory));return {root,base,r};}
async function files(root){const found=[];async function walk(at){for(const e of await fs.readdir(at,{withFileTypes:true})){const p=path.join(at,e.name);if(e.isSymbolicLink())found.push([path.relative(root,p),'link:'+await fs.readlink(p)]);else if(e.isDirectory())await walk(p);else found.push([path.relative(root,p),(await fs.readFile(p)).toString('base64')]);}}await walk(root);return found;}

test('free unrelated customers share bounded pool; paid multi-App and dedicated per-App policies validate',()=>{for(const r of [fixture(),dedicated(fixture()),dedicated(fixture(),'dedicated')]){r.domains.push({...r.domains[0],hostname:'second.localhost'});assert.equal(validateRegistry(r).apps.length,2);}});
test('closed records reject unknown fields, schemas, references, future and mutable entitlement claims',()=>{
 for(const alter of [r=>r.schema='wydhosting.registry/2',r=>r.customers[0].isAdmin=true,r=>r.apps[0].publisher={operator:true},r=>r.accounts[0].state='provisioned',r=>r.customers[0].planRevision=2,r=>r.plans[0].maxApps=2,r=>r.plans[0].resources.payloadBytes=2**40,r=>r.plans[0].limits={},r=>r.pools[0].hostId='remote',r=>r.pools[0].isolation='enforced',r=>r.apps[0].resources.maxPending=5,r=>r.customers[0].state='retired',r=>r.pools[0].state='retired',r=>{r.apps[0].state='retired';r.apps[0].placement.state='retired';}]){const r=fixture();alter(r);assert.throws(()=>validateRegistry(r));}
});
test('provider-wide identities, roots, domains and account assignments cannot collide or substitute',()=>{
 for(const alter of [r=>r.apps.push(copy(r.apps[0])),r=>r.apps[1].appId='APP-ALPHA',r=>r.pools.push(copy(r.pools[0])),r=>r.customers.push(copy(r.customers[0])),r=>r.domains[1].hostname=r.domains[0].hostname,r=>r.domains[0].customerId='beta',r=>r.apps[0].placement.poolId='unknown',r=>r.apps[0].source=r.apps[1].source+'/child',r=>r.apps[0].placement.directory='../escape',r=>r.pools[0].base='/',r=>r.pools[0].base+='/',r=>r.pools.push({...r.pools[0],poolId:'nested',base:r.pools[0].base+'/nested'}),r=>r.apps[1].placement.directory=r.apps[0].placement.directory,r=>r.customers[0].accountId='provider-worker',r=>r.accounts.push({...r.accounts[0],accountId:'another'})]){const r=fixture();alter(r);assert.throws(()=>validateRegistry(r));}
});
test('free cannot add Apps, paid cannot share customers, high-tier per-App placement remains explicit',()=>{
 const extra=fixture();extra.apps.push({...extra.apps[0],appId:'third',source:'/tmp/third-source',placement:{...extra.apps[0].placement,directory:'third',deploymentId:'third'}});assert.throws(()=>validateRegistry(extra),{code:'HOSTING.ENTITLEMENT'});
 const paid=dedicated(fixture());paid.apps[1].customerId='beta';assert.throws(()=>validateRegistry(paid));const high=dedicated(fixture(),'dedicated');high.apps[1].placement.poolId='shared';assert.throws(()=>validateRegistry(high),{code:'HOSTING.CAPACITY'});
});
test('sixteen total reservations including parking is the capacity ceiling',()=>{
 const r=fixture();r.apps=[];r.customers=[];r.domains=[];for(let i=0;i<17;i++){r.customers.push({...fixture().customers[0],customerId:'c'+i});r.apps.push({...fixture().apps[0],appId:'a'+i,customerId:'c'+i,source:'/tmp/capacity-source-'+i,role:i===0?'parking':'tenant',placement:{poolId:'shared',directory:'a'+i,deploymentId:'d'+i,epoch:1,state:'active'}});}assert.throws(()=>validateRegistry(r),{code:'HOSTING.CAPACITY'});r.apps.pop();assert.equal(validateRegistry(r).apps.length,16);r.pools[0].capacity=17;assert.throws(()=>validateRegistry(r));
});
test('provider-wide remote reservations reject equal or nested namespaces across pools and retired Apps',()=>{
 const r=dedicated(fixture(),'dedicated');const n={endpoint:'https://objects.example/',bucket:'test-bucket',namespace:'tenant'};r.apps[0].namespaces=[n];r.apps[1].namespaces=[{...n,namespace:'tenant/nested'}];assert.throws(()=>validateRegistry(r),{code:'HOSTING.NAMESPACE'});r.apps[1].namespaces[0].namespace='sibling';assert.equal(validateRegistry(r).apps.length,2);
});
test('canonical inventory compiles real approved Apps and preserves resources, routing and service ownership',async t=>{
 const {r,base}=await real(t),inventory=await compilePool(r,'shared');assert.equal(inventory.schema,'wydgit.multi-host/0.1');assert.deepEqual(inventory.apps.map(a=>a.id),['app-alpha','app-beta']);const checked=await validateAppInventory(inventory,{root:base});assert.equal(checked.apps[0].resources.payloadBytes,1048576);assert.equal(checked.routing.routes[0].app,'app-alpha');
 const h=await createMultiAppHost(inventory,{root:base});t.after(()=>h.dispose());const a=await h.activate('app-alpha'),b=await h.activate('app-beta');const c=h.context(a,{publisher:'acme',package:'acme/demo',installation:'same-installation',self:'home',capabilities:['store.records.read'],scopes:{wydstore:[{store:'main',collection:'records'}]}});assert.equal((await h.bind(a,c).invoke('wydstore','1.0.0','count',{store:'main',collection:'records'})).ok,true);assert.throws(()=>h.bind(b,c));
});
test('I0 canonical identity, foreign owner, recovery markers, roots and fingerprints remain authoritative',async t=>{
 const {r,base}=await real(t),file=path.join(base,'app-alpha/wydgit.config.json'),original=await fs.readFile(file),c=JSON.parse(original);c.libraries[0].options.stores[0].app='app-beta';await fs.writeFile(file,JSON.stringify(c));await assert.rejects(compilePool(r,'shared'),{code:'HOST.OWNER'});await fs.writeFile(file,original);
 const changed=copy(r);changed.apps[0].appId='foreign';changed.domains=[];await assert.rejects(compilePool(changed,'shared'),{code:'HOST.IDENTITY'});
 const drift=copy(r);drift.apps[0].snapshot='f'.repeat(64);await assert.rejects(compilePool(drift,'shared'),{code:'HOSTING.SNAPSHOT'});
 await fs.symlink(path.join(base,'app-alpha'),path.join(base,'alias'));const linked=copy(r);linked.apps[0].placement.directory='alias';await assert.rejects(compilePool(linked,'shared'),{code:'HOSTING.ROOT'});
 await fs.link(path.join(base,'app-beta/content/app.json'),path.join(base,'app-alpha/content/linked.json'));await assert.rejects(compilePool(r,'shared'),{code:'HOST.ROOT'});await fs.unlink(path.join(base,'app-alpha/content/linked.json'));await fs.writeFile(path.join(base,'app-alpha/content/.package-install.lock'),'interrupted');await assert.rejects(compilePool(r,'shared'));
});
test('missing staging remains qualification-required and arbitrary source homes never enter inventory',async()=>{const r=fixture('/tmp/wydhosting-not-staged-unique');const inspection=await inspectRegistry(r);assert.equal(inspection.productionReady,false);assert.deepEqual([...inspection.pendingPools],['shared']);await assert.rejects(compilePool(r,'shared'));});
test('inspect validate and plan leave byte-exact provider and canonical App trees untouched',async t=>{
 const {r,root}=await real(t),s=await store(t,{fixtureRoot:root}),before=await files(s.root),appBefore=await files(root);await s.registry.inspect();await s.registry.validate();const p=await s.registry.plan(request('register',0,registration(r)));assert.equal(p.applicable,true);assert.deepEqual(await files(s.root),before);assert.deepEqual(await files(root),appBefore);assert.equal((await s.registry.reconcile(p)).state,'planned-not-authorized');
});
test('authorized apply records only registry intent and reconciles unsupported OS work separately',async t=>{
 const {registry}=await store(t),p=await registry.plan(request('register',0,registration(fixture()))),result=await registry.apply(p);assert.equal(result.revision,1);assert.equal(result.productionReady,false);assert.equal(result.osStatus,'unsupported');assert.ok(result.requiredOperations.includes('LINUX_ACCOUNT_REQUIRED'));assert.equal((await registry.reconcile()).state,'applied-registry-verified');assert.equal((await registry.inspect()).registry.accounts[0].state,'intended');
});
test('digest is not authorization; altered and self-consistently rehashed plans cannot elevate policy',async t=>{
 const {root,registry}=await store(t),p=await registry.plan(request('auth',0,registration(fixture())));const untrusted=createRegistry({directory:root,fixtureRoot:trustedRoot});await assert.rejects(untrusted.apply(p),{code:'HOSTING.UNAUTHORIZED'});const spoof=createRegistry({directory:root,fixtureRoot:trustedRoot,authorize:()=>({isAdmin:true})});await assert.rejects(spoof.apply(p),{code:'HOSTING.UNAUTHORIZED'});
 const altered=copy(p);altered.proposed.customers[0].planId='paid';await assert.rejects(registry.apply(altered),{code:'HOSTING.DIGEST'});const forged=copy(p);forged.requiredOperations=[];const {digest:unused,...body}=forged;forged.digest=digest(body);await assert.rejects(registry.apply(forged),{code:'HOSTING.DIGEST'});
});
test('stale revisions, expired plans, duplicate IDs and replay semantics are explicit',async t=>{
 const {registry}=await store(t),p=await registry.plan(request('once',0,registration(fixture()))),stale=await registry.plan(request('stale',0,registration(fixture())));await registry.apply(p);const replay=await registry.apply(p,{now:p.expiresAt+1});assert.equal(replay.replayed,true);assert.equal((await registry.inspect()).registry.revision,1);await assert.rejects(registry.apply(stale),{code:'HOSTING.STALE'});
 const changed=copy(p);changed.request.expiresAt++;changed.expiresAt++;const {digest:unused,...body}=changed;changed.digest=digest(body);await assert.rejects(registry.apply(changed),{code:'HOSTING.OPERATION_CONFLICT'});
 const q=request('expired',1,[{kind:'setAssignmentState',customerId:'alpha',appId:'app-alpha',state:'suspended'}]);q.expiresAt=1;await assert.rejects(registry.plan(q),{code:'HOSTING.EXPIRED'});
});
test('cooperating writers serialize and only one concurrent expected revision commits',async t=>{const {registry}=await store(t),a=await registry.plan(request('a',0,registration(fixture()))),b=await registry.plan(request('b',0,registration(fixture())));const outcomes=await Promise.allSettled([registry.apply(a),registry.apply(b)]);assert.equal(outcomes.filter(v=>v.status==='fulfilled').length,1);assert.ok(['HOSTING.LOCKED','HOSTING.STALE'].includes(outcomes.find(v=>v.status==='rejected').reason.code));});
test('prepared journal interruption retains old registry, blocks other work and requires reauthorization',async t=>{
 let crash=true;const {root,registry}=await store(t,{checkpoint:phase=>{if(phase==='prepared'&&crash){crash=false;throw Error('simulated interruption');}}}),p=await registry.plan(request('recovery',0,registration(fixture())));await assert.rejects(registry.apply(p));assert.equal((await registry.inspect()).registry.revision,0);assert.equal((await registry.reconcile()).state,'recovery-required');await assert.rejects(registry.plan(request('other',0,registration(fixture()))),{code:'HOSTING.RECOVERY_REQUIRED'});
 const unauthorized=createRegistry({directory:root,fixtureRoot:trustedRoot});await assert.rejects(unauthorized.apply(p),{code:'HOSTING.UNAUTHORIZED'});const restart=createRegistry({directory:root,fixtureRoot:trustedRoot,authorize:()=> 'recovery-operator'});assert.equal((await restart.apply(p)).revision,1);assert.equal((await restart.reconcile(p)).state,'applied-registry-verified');
});
test('lost acknowledgement after commit is recovered by identical replay without double mutation',async t=>{const {registry}=await store(t,{checkpoint:phase=>{if(phase==='committed')throw Error('lost acknowledgement');}}),p=await registry.plan(request('lost',0,registration(fixture())));await assert.rejects(registry.apply(p));assert.equal((await registry.reconcile()).state,'applied-registry-verified');assert.equal((await registry.apply(p)).replayed,true);});
test('corrupt, missing or ambiguous journal state never falls back or silently repairs',async t=>{
 const {root,registry}=await store(t),file=path.join(root,'state.json'),before=await fs.readFile(file);for(const text of ['{','{}',JSON.stringify({...JSON.parse(before),schema:'wydhosting.state/2'}),JSON.stringify({...JSON.parse(before),registry:{...JSON.parse(before).registry,revision:1}})]){await fs.writeFile(file,text);await assert.rejects(registry.inspect());assert.equal(await fs.readFile(file,'utf8'),text);}await fs.writeFile(file,before);await fs.unlink(file);await assert.rejects(registry.inspect(),{code:'HOSTING.CORRUPT'});
});
test('private state refuses symlink, hardlink, unsafe permission and provider/App overlap',async t=>{
 const {root,registry}=await store(t),file=path.join(root,'state.json');await fs.link(file,path.join(root,'alias'));await assert.rejects(registry.inspect(),{code:'HOSTING.CORRUPT'});await fs.unlink(path.join(root,'alias'));await fs.rename(file,path.join(root,'saved'));await fs.symlink(path.join(root,'saved'),file);await assert.rejects(registry.inspect(),{code:'HOSTING.CORRUPT'});await fs.unlink(file);await fs.rename(path.join(root,'saved'),file);await fs.chmod(file,0o644);await assert.rejects(registry.inspect(),{code:'HOSTING.CORRUPT'});await fs.chmod(file,0o600);
 const r=fixture();r.pools[0].base=root+'/execution';await assert.rejects(registry.plan(request('overlap',0,registration(r))),{code:'HOSTING.ROOT'});await fs.writeFile(path.join(root,'writer.lock'),'interrupted',{mode:0o600});const p=await registry.plan(request('lock',0,registration(fixture())));await assert.rejects(registry.apply(p),{code:'HOSTING.LOCKED'});
});
test('cross-customer domain theft and placement substitution fail before apply',async t=>{
 const {registry}=await store(t);await registry.apply(await registry.plan(request('initial',0,registration(fixture()))));
 await assert.rejects(registry.plan(request('theft',1,[{kind:'changeDomain',customerId:'beta',hostname:'app-alpha.localhost',appId:'app-beta',expectedRevision:1,evidence:'fake'}])),{code:'HOSTING.OWNER'});
 await assert.rejects(registry.plan(request('substitute',1,[{kind:'assignPlacement',customerId:'beta',appId:'app-alpha',placement:fixture().apps[0].placement}])),{code:'HOSTING.OWNER'});
});
test('free-to-paid and dedicated placement transitions plan safely and refuse simulated data transfer',async t=>{
 const {registry}=await store(t);await registry.apply(await registry.plan(request('initial',0,registration(fixture()))));const r=dedicated(fixture()),account=r.accounts[1],pool={...r.pools[0],poolId:'paid',base:r.pools[0].base+'-paid'};
 const q=request('upgrade',1,[{kind:'assignAccount',record:account},{kind:'changePlan',customerId:'alpha',planId:'paid',planRevision:1},{kind:'registerPool',record:pool},{kind:'assignPlacement',customerId:'alpha',appId:'app-alpha',placement:{...r.apps[0].placement,poolId:'paid',epoch:2}}]);
 const p=await registry.plan(q);assert.equal(p.applicable,false);assert.ok(p.requiredOperations.includes('STOPPED_MIGRATION_REQUIRED'));assert.equal((await registry.reconcile(p)).state,'awaiting-unsupported-provisioning');await assert.rejects(registry.apply(p),{code:'HOSTING.QUALIFICATION_REQUIRED'});assert.equal((await registry.inspect()).registry.customers[0].planId,'free');
});
test('assignment suspension/retirement reserves identity and domain authority',async t=>{
 const {registry}=await store(t);await registry.apply(await registry.plan(request('initial',0,registration(fixture()))));const p=await registry.plan(request('retire',1,[{kind:'setAssignmentState',customerId:'alpha',appId:'app-alpha',state:'retired'}]));await registry.apply(p);const r=(await registry.inspect()).registry;assert.equal(r.apps[0].state,'retired');assert.equal(r.domains[0].state,'retired');await assert.rejects(registry.plan(request('reuse',2,[{kind:'registerApp',record:fixture().apps[0]}])),{code:'HOSTING.CONFLICT'});
});
test('CLI commands use same validators and demand exact approval, rejecting unknown inputs with sanitized errors',async t=>{
 const {root,registry}=await store(t),q=request('cli',0,registration(fixture())),input=path.join(root,'request.json');await fs.writeFile(input,JSON.stringify(q));const p=await run(['plan','--directory',root,'--input',input]);assert.equal(p.operationId,'cli');const file=path.join(root,'plan.json');await fs.writeFile(file,JSON.stringify(p));await assert.rejects(run(['apply','--directory',root,'--input',file,'--plan','cli','--approve','bad']),{code:'HOSTING.UNAUTHORIZED'});assert.equal((await run(['apply','--directory',root,'--input',file,'--plan','cli','--approve',p.digest])).revision,1);assert.equal((await run(['inspect','--directory',root])).counts.apps,2);assert.equal((await run(['validate','--directory',root])).productionReady,false);assert.equal((await run(['reconcile','--directory',root])).state,'applied-registry-verified');await assert.rejects(run(['serve','--directory',root]));await assert.rejects(run(['inspect','--directory',root,'--isAdmin','true']));
 const child=spawnSync(process.execPath,['packages/wydhosting/bin/wydhosting.js','inspect','--directory','/sensitive/nonexistent'],{encoding:'utf8'});assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/sensitive|ENOENT|stack/);assert.equal((await registry.inspect()).registry.revision,1);
 const link=path.join(root,'wydhosting');await fs.symlink(new URL('../bin/wydhosting.js',import.meta.url),link);const linked=spawnSync(process.execPath,[link,'inspect','--directory',root,'--fixture-root',trustedRoot],{encoding:'utf8'});assert.equal(linked.status,0,linked.stderr);assert.equal(JSON.parse(linked.stdout).revision,1);
});
test('engine never imports provider; root startup and launcher remain independent',async()=>{
 async function scan(root){for(const e of await fs.readdir(root,{withFileTypes:true})){const file=path.join(root,e.name);if(e.isDirectory())await scan(file);else if(file.endsWith('.js'))assert.doesNotMatch(await fs.readFile(file,'utf8'),/(?:import|from).*wydhosting/);}}await scan('wydgine');await scan('packages/wydgine');const p=JSON.parse(await fs.readFile('package.json'));assert.equal(p.scripts.start,'node server.js');
});

test('deterministic plans bind the complete candidate and reject malformed or unsupported actions',async()=>{
 const r=emptyRegistry('provider'),q=request('deterministic',0,registration(fixture())),a=await plan(r,q),b=await plan(r,q);assert.equal(a.digest,b.digest);assert.ok(Object.isFrozen(a.proposed.apps[0]));
 for(const change of [q=>q.isAdmin=true,q=>q.schema='wydhosting.request/2',q=>q.actions=[{kind:'createLinuxUser',username:'root'}],q=>q.actions[0].extra=true,q=>q.expectedRevision=4,q=>q.actions=[],q=>q.expiresAt=Number.MAX_SAFE_INTEGER]){const bad=copy(q);change(bad);await assert.rejects(plan(r,bad));}
});
test('paid customer can add another entitled App and explicitly change domains within the same owner',async t=>{
 const {registry}=await store(t),r=dedicated(fixture());await registry.apply(await registry.plan(request('paid',0,registration(r))));const app={...r.apps[0],appId:'third',source:trustedRoot+'/sources/third-paid-app',placement:{...r.apps[0].placement,directory:'third',deploymentId:'third-paid'}};
 await registry.apply(await registry.plan(request('add-paid',1,[{kind:'registerApp',record:app},{kind:'changeDomain',customerId:'alpha',hostname:'app-alpha.localhost',appId:'third',expectedRevision:1,evidence:'separate-approval'}])));const state=(await registry.inspect()).registry;assert.equal(state.apps.length,3);assert.equal(state.domains[0].appId,'third');assert.equal(state.customers[0].planRevision,1);
 await assert.rejects(registry.plan(request('edit-plan',2,[{kind:'registerPlan',record:{...r.plans[1],maxApps:100}}])),{code:'HOSTING.CONFLICT'});
});
test('higher-tier customer per-App relocation is planned but cannot be applied as registry-only migration',async t=>{
 const {registry}=await store(t),r=dedicated(fixture(),'dedicated');await registry.apply(await registry.plan(request('high',0,registration(r))));const pool={...r.pools[0],poolId:'third',base:r.pools[0].base+'-third'};
 const p=await registry.plan(request('dedicate',1,[{kind:'registerPool',record:pool},{kind:'assignPlacement',customerId:'alpha',appId:'app-alpha',placement:{...r.apps[0].placement,poolId:'third',epoch:2}}]));assert.equal(p.applicable,false);assert.equal(p.proposed.apps[0].placement.epoch,2);await assert.rejects(registry.apply(p),{code:'HOSTING.QUALIFICATION_REQUIRED'});assert.equal((await registry.inspect()).registry.apps[0].placement.poolId,'shared');
});
test('canonical content drift invalidates approved snapshot even when App identity remains the same',async t=>{
 const {r,base}=await real(t);await fs.appendFile(path.join(base,'app-alpha/public/css/site.css'),'\n/* drift */');await assert.rejects(compilePool(r,'shared'),{code:'HOSTING.SNAPSHOT'});
});
test('provider reserves remote namespaces independently of controller boundaries and checks actual service mapping',async t=>{
 const {r,base}=await real(t);for(const a of r.apps){const file=path.join(base,a.placement.directory,'wydgit.config.json'),c=JSON.parse(await fs.readFile(file));const mount=c.libraries.find(l=>l.id==='wydfiles').options.apps[0].mounts[0];delete mount.root;Object.assign(mount,{provider:'s3',endpoint:'https://objects.example/',bucket:'test-bucket',namespace:a.appId});await fs.writeFile(file,JSON.stringify(c));a.snapshot=await fingerprintApprovedApp(path.join(base,a.placement.directory));a.namespaces=[{endpoint:mount.endpoint,bucket:mount.bucket,namespace:mount.namespace}];}
 assert.equal((await compilePool(r,'shared')).apps.length,2);r.apps[0].namespaces=[];await assert.rejects(compilePool(r,'shared'),{code:'HOSTING.NAMESPACE'});
});
test('unsafe source ancestors and linked provider directories are rejected without following authority aliases',async t=>{
 const {root,registry}=await store(t);await fs.mkdir(path.join(root,'target'));await fs.symlink(path.join(root,'target'),path.join(root,'alias'));const r=fixture();r.apps[0].source=path.join(root,'alias','source');await assert.rejects(registry.plan(request('source-link',0,registration(r))));const aliased=createRegistry({directory:path.join(root,'alias')});await assert.rejects(aliased.inspect(),{code:'HOSTING.ROOT'});
});
test('journal corruption and verification failure are explicit; stale writer lock requires operator recovery',async t=>{
 const {root,registry}=await store(t),p=await registry.plan(request('journal',0,registration(fixture())));await registry.apply(p);const file=path.join(root,'state.json'),saved=await fs.readFile(file),e=JSON.parse(saved);delete e.journal;await fs.writeFile(file,JSON.stringify(e));await assert.rejects(registry.reconcile());await fs.writeFile(file,saved);e.journal=[{...JSON.parse(saved).journal[0],state:'unknown'}];await fs.writeFile(file,JSON.stringify(e));await assert.rejects(registry.reconcile());await fs.writeFile(file,saved);await fs.writeFile(path.join(root,'writer.lock'),'crashed',{mode:0o600});assert.equal((await registry.reconcile()).state,'recovery-required');await fs.unlink(path.join(root,'writer.lock'));await fs.chmod(file,0o644);await assert.rejects(registry.reconcile(),{code:'HOSTING.CORRUPT'});
});
test('registry input sizes and record counts are bounded before admission',()=>{
 assert.throws(()=>validateRegistry(' '.repeat(4*1024*1024+1)));const r=fixture();r.domains=Array.from({length:1025},()=>copy(r.domains[0]));assert.throws(()=>validateRegistry(r));const dangerous=JSON.parse('{"__proto__":{}}');assert.throws(()=>validateRegistry(dangerous));
});

test('actual process exit after durable prepare leaves writer lock and resumes only after operator recovery',async t=>{
 const {root,registry}=await store(t),p=await registry.plan(request('process-crash',0,registration(fixture()))),file=path.join(root,'approved-plan.json');await fs.writeFile(file,JSON.stringify(p));
 const module=new URL('../src/registry.js',import.meta.url).href;
 const source=`import fs from 'node:fs/promises';import {createRegistry} from ${JSON.stringify(module)};const r=createRegistry({directory:process.argv[1],fixtureRoot:process.argv[3],authorize:()=> 'crash-operator',checkpoint:phase=>{if(phase==='prepared')process.exit(71);}});await r.apply(JSON.parse(await fs.readFile(process.argv[2])));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',source,root,file,trustedRoot],{encoding:'utf8'});assert.equal(child.status,71,child.stderr);assert.equal((await registry.reconcile()).state,'recovery-required');await assert.rejects(registry.apply(p),{code:'HOSTING.LOCKED'});
 // Child exit is observed. This explicit test operator action is never automatic.
 await fs.unlink(path.join(root,'writer.lock'));assert.equal((await registry.apply(p,{now:p.expiresAt+1000})).revision,1);assert.equal((await registry.reconcile()).state,'applied-registry-verified');
});
test('verification failure after atomic commit cannot become a successful acknowledgement',async t=>{
 const {root,registry}=await store(t,{checkpoint:async phase=>{if(phase==='committed')await fs.chmod(path.join(root,'state.json'),0o644);}}),p=await registry.plan(request('verify-failure',0,registration(fixture())));await assert.rejects(registry.apply(p),{code:'HOSTING.CORRUPT'});await assert.rejects(registry.reconcile(),{code:'HOSTING.CORRUPT'});await fs.chmod(path.join(root,'state.json'),0o600);assert.equal((await registry.apply(p)).replayed,true);
});
test('trusted fixture-root approval cannot be supplied by a registry record or broadened App path',async()=>{
 await assert.rejects(rawInspectRegistry(fixture()),{code:'HOSTING.FIXTURE_ROOT'});const r=fixture();r.pools[0].base='/home/customer/apps';await assert.rejects(rawInspectRegistry(r,{fixtureRoot:trustedRoot}),{code:'HOSTING.ROOT'});
});

test('pending work cannot be hidden by reconciling an older successful operation',async t=>{
 let interrupt=false;const {root,registry}=await store(t,{checkpoint:phase=>{if(interrupt&&phase==='prepared')throw Error('interrupted');}}),p=await registry.plan(request('old',0,registration(fixture())));await registry.apply(p);interrupt=true;const second=await registry.plan(request('pending',1,[{kind:'setAssignmentState',customerId:'alpha',appId:'app-alpha',state:'suspended'}]));await assert.rejects(registry.apply(second));assert.equal((await registry.reconcile(p)).state,'recovery-required');
 const e=JSON.parse(await fs.readFile(path.join(root,'state.json')));e.registry=fixture();e.journal=[];await fs.writeFile(path.join(root,'state.json'),JSON.stringify(e));await assert.rejects(registry.inspect(),{code:'HOSTING.RECOVERY_REQUIRED'});
});
