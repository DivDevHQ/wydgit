import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {parseArgs} from '../wydgine/launcher/cli.js';
import {defaults,validateLaunchConfig,readLaunchConfig} from '../wydgine/launcher/config.js';
import {validateSelected,discover,choose,selectApp} from '../wydgine/launcher/selection.js';
import {setup,mergeManifest} from '../wydgine/launcher/setup.js';
import {persistFiles} from '../wydgine/launcher/persistence.js';
import {launch} from '../wydgine/launcher/start.js';
import {provisionExample} from '../examples/multi-app/setup.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {PassThrough} from 'node:stream';
import {createTerminal} from '../wydgine/launcher/terminal.js';

const project=fileURLToPath(new URL('../',import.meta.url)),bin=path.join(project,'packages/wydgine/bin/wydgine.js');
const json=v=>JSON.stringify(v,null,2)+'\n';
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-i52-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'apps'));return root;}
async function app(root,name,id=name){const target=path.join(root,'apps',name);await fs.mkdir(target);for(const dir of ['content','prototypes','public'])await fs.cp(path.join(project,dir),path.join(target,dir),{recursive:true});const value=JSON.parse(await fs.readFile(path.join(target,'content/app.json')));value.id=id;value.properties.title='Title '+id;await fs.writeFile(path.join(target,'content/app.json'),json(value));await fs.writeFile(path.join(target,'wydgit.config.json'),json({schema:'wydgit.host/0.1',libraries:[]}));return target;}
function terminal(answers){let output='';return {write(v){output+=v;},async ask(v){output+=v;return answers.length?answers.shift():null;},get output(){return output;}};}
async function localAdapter(root){await fs.mkdir(path.join(root,'node_modules/.bin'),{recursive:true});await fs.symlink(path.join(project,'packages/wydgine'),path.join(root,'node_modules/wydgine'),'dir');await fs.symlink(bin,path.join(root,'node_modules/.bin/wydgine'));}
async function config(root,value=defaults()){await fs.writeFile(path.join(root,'wydgine.local.json'),json(value));}
function child(t,args,{cwd,command=process.execPath}={}){const p=spawn(command,args,{cwd,env:{...process.env,NO_COLOR:'1'},stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);const exited=once(p,'exit');t.after(async()=>{if(p.exitCode===null&&p.signalCode===null){p.kill('SIGKILL');await exited;}});return {p,exited,get out(){return out;},get err(){return err;}};}
async function ready(run){for(let i=0;i<300;i++){const line=run.out.split('\n').find(v=>v.includes('{"ok":true'));if(line)return JSON.parse(line.slice(line.indexOf('{"ok":true')));if(run.p.exitCode!==null)throw new Error(run.err);await new Promise(r=>setTimeout(r,20));}throw new Error('Launcher did not become ready: '+run.err+run.out);}
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;}

test('CLI grammar is closed, bounded and explicit',()=>{
 for(const args of [['setup'],['setup','--directory','/tmp'],['start'],['start','apps/ü space','--config','conf.json'],['validate','/tmp/app'],['--help']])assert.ok(parseArgs(args));
 for(const args of [[],['app'],['start','--port','3'],['start','a','b'],['setup','x'],['validate','--config','x'],['start','--config','a','--config','b'],['start','--config'],['setup','--directory','relative'],['start',''],['start','x'.repeat(4097)],['--help','start'],['start','--config','--help']])assert.throws(()=>parseArgs(args),{code:'LAUNCH.USAGE'});
});
test('closed configuration rejects unsupported schema, HTML, paths and listeners',()=>{
 for(const mutate of [v=>v.extra=1,v=>v.schema='wydgine.launch/2',v=>v.setup.enabled=true,v=>v.listener.port=0,v=>v.listener.port='3000',v=>v.listener.host='localhost',v=>v.listener.host='127.0.0.1\n',v=>v.defaultApp='',v=>v.appsDirectory='\0',v=>v.listener.extra=1]){const v=defaults();mutate(v);assert.throws(()=>validateLaunchConfig(v));}
 assert.equal(validateLaunchConfig(defaults()).listener.port,3000);
});
test('terminal handles EOF, bounded input and queued ordinary lines',async()=>{
 const input=new PassThrough(),output=new PassThrough(),term=createTerminal(input,output);input.end('1\n');assert.equal(await term.ask('select'),'1');assert.equal(await term.ask('next'),null);term.close();
 const oversized=new PassThrough(),other=createTerminal(oversized,output);oversized.write('x'.repeat(4097));await assert.rejects(other.ask('select'),{code:'LAUNCH.INPUT_LIMIT'});other.close();
});
test('selection resolves explicit cwd and config base, never package root or INIT_CWD',async t=>{
 const root=await fixture(t),a=await app(root,'ü space','alpha'),b=await app(root,'beta');
 assert.equal((await validateSelected('apps/ü space',{cwd:root})).id,'alpha');assert.equal((await validateSelected(a)).root,a);
 await fs.mkdir(path.join(root,'settings'));const v={...defaults(),appsDirectory:'../apps',defaultApp:'../apps/beta'};await fs.writeFile(path.join(root,'settings/launch.json'),json(v));
 const c=await readLaunchConfig({cwd:root,config:'settings/launch.json'});assert.equal(c.appsDirectory,path.join(root,'apps'));
 assert.equal((await selectApp({config:c})).root,b);assert.equal((await selectApp({appPath:'apps/ü space',cwd:root,config:c})).root,a);
 await assert.rejects(selectApp({appPath:'missing',cwd:root,config:c}),{code:'LAUNCH.APP_INVALID'});
 await assert.rejects(selectApp({config:await readLaunchConfig({cwd:root})}),{code:'APP_SELECTION_REQUIRED'});
 await config(root,{...defaults(),schema:'unknown'});await assert.rejects(readLaunchConfig({cwd:root}));
 await config(root,{...defaults(),defaultApp:'missing'});await assert.rejects(selectApp({appPath:a,config:await readLaunchConfig({cwd:root})}),{code:'LAUNCH.APP_INVALID'});
});
test('discovery, one/multiple selection, bounded retries, EOF, cancel and duplicates',async t=>{
 const root=await fixture(t),a=await app(root,'a');let apps=await discover(path.join(root,'apps'));assert.equal(apps.length,1);
 const term=terminal(['1']);assert.equal((await choose(apps,term)).id,'a');assert.match(term.output,/Select an application/);
 for(const input of [[null],['q'],['bad','0','999']])await assert.rejects(choose(apps,terminal(input)));
 await app(root,'b');apps=await discover(path.join(root,'apps'));assert.equal((await choose(apps,terminal(['x','2']))).id,'b');
 await app(root,'.hidden','hidden');await fs.symlink(a,path.join(root,'apps/link'));await fs.mkdir(path.join(root,'apps/invalid'));assert.equal((await discover(path.join(root,'apps'))).length,2);
 await app(root,'alias','a');await assert.rejects(discover(path.join(root,'apps')),{code:'LAUNCH.DUPLICATE_APP'});
});
test('discovery refuses overflow without truncation and unsafe roots/recovery',async t=>{
 const root=await fixture(t),a=await app(root,'a');await fs.symlink(a,path.join(root,'alias'));await assert.rejects(validateSelected(path.join(root,'alias')));
 await fs.link(path.join(a,'content/app.json'),path.join(a,'content/linked'));await assert.rejects(validateSelected(a));await fs.unlink(path.join(a,'content/linked'));
 await fs.writeFile(path.join(a,'content/installed-packages.json'),'{}');await assert.rejects(validateSelected(a));
 for(let i=0;i<128;i++)await fs.mkdir(path.join(root,'apps','empty'+i));await assert.rejects(discover(path.join(root,'apps')),{code:'LAUNCH.DISCOVERY_LIMIT'});
});
test('installation recovery markers reject selected Apps before launch',async t=>{
 const root=await fixture(t),a=await app(root,'a');await fs.writeFile(path.join(a,'content/.package-install.lock'),'interrupted');await assert.rejects(validateSelected(a),{code:'LAUNCH.APP_INVALID'});
});
test('selection is revalidated after prompting and again before launch',async t=>{
 const root=await fixture(t),a=await app(root,'a'),selected=await validateSelected(a);
 const term=terminal(['1']);const ask=term.ask;term.ask=async p=>{await fs.writeFile(path.join(a,'wydgit.config.json'),'{}');return ask(p);};await assert.rejects(choose([selected],term));await assert.rejects(launch(selected,defaults().listener));
});
test('atomic persistence backs up exact originals and rejects stale review',async t=>{
 const root=await fixture(t),file=path.join(root,'local.json');await fs.writeFile(file,'old');
 const backups=await persistFiles([{file,before:'old',after:'new'}]);assert.equal(await fs.readFile(file,'utf8'),'new');assert.equal(await fs.readFile(backups[0],'utf8'),'old');assert.equal((await fs.stat(file)).mode&0o777,0o600);
 await assert.rejects(persistFiles([{file,before:'old',after:'oops'}]),{code:'LAUNCH.CONFLICT'});assert.equal(await fs.readFile(file,'utf8'),'new');assert.ok(!(await fs.readdir(root)).some(n=>n.endsWith('.tmp')));
 await fs.writeFile(path.join(root,'.wydgine-setup.lock'),'');await assert.rejects(persistFiles([{file,before:'new',after:'oops'}]),{code:'LAUNCH.CONFLICT'});await fs.unlink(path.join(root,'.wydgine-setup.lock'));
 await assert.rejects(persistFiles([{file,before:'new',after:'partial'},{file:path.join(root,'absent/second.json'),before:null,after:'second'}]),{code:'LAUNCH.SAVE_FAILED'});assert.equal(await fs.readFile(file,'utf8'),'partial');assert.ok(!(await fs.readdir(root)).includes('.wydgine-setup.lock'));
});
test('ordinary Linux TTY selects a single App, requests default consent and launches',async t=>{
 const root=await fixture(t),selected=await app(root,'a');const port=await freePort();await config(selected,{...defaults(),appsDirectory:'..',listener:{host:'127.0.0.1',port}});
 const run=child(t,['-qefc',`${process.execPath} ${bin} start`,'/dev/null'],{cwd:selected,command:'script'});
 for(let i=0;i<300&&!run.out.includes('Select an application');i++)await new Promise(r=>setTimeout(r,20));assert.match(run.out,/Select an application/);run.p.stdin.write('1\ny\n');
 const result=await ready(run);assert.equal(result.app,'a');assert.match(run.out,/Save this selection/);assert.equal(JSON.parse(await fs.readFile(path.join(selected,'wydgine.local.json'))).defaultApp,'.');process.kill(result.pid,'SIGTERM');assert.equal((await run.exited)[0],0);
});
test('actual setup command runs in a TTY and prepares consumer npm start',async t=>{
 const root=await fixture(t);await app(root,'a');await localAdapter(root);
 const run=child(t,['-qefc',`${process.execPath} ${bin} setup`,'/dev/null'],{cwd:root,command:'script'});
 for(let i=0;i<300&&!run.out.includes('Apps directory');i++)await new Promise(r=>setTimeout(r,20));assert.match(run.out,/Apps directory/);run.p.stdin.write('\npath\napps/a\n\n\ny\n');assert.equal((await run.exited)[0],0,run.err+run.out);assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'))).scripts.start,'wydgine start');
});
test('historical root npm start still serves the sample and shuts down',async t=>{
 const port=await freePort(),p=spawn('npm',['start','--','apps/ignored'],{cwd:project,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},detached:true,stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',v=>output+=v);const exited=once(p,'exit');t.after(()=>{try{process.kill(-p.pid,'SIGKILL');}catch{}});
 for(let i=0;i<300&&!output.includes(`http://127.0.0.1:${port}`);i++)await new Promise(r=>setTimeout(r,20));assert.match(output,/Wydgit 0\.3\.0-alpha\.17/);assert.equal((await fetch(`http://127.0.0.1:${port}`)).status,200);process.kill(-p.pid,'SIGTERM');await exited;
});
test('manifest merge preserves metadata/scripts, rejects malformed/conflicts, exact verified version',()=>{
 const source=json({name:'kept',custom:{a:1},scripts:{test:'keep',start:'old'},dependencies:{other:'1'}});
 assert.throws(()=>mergeManifest(source,'0.3.0-alpha.17'),{code:'LAUNCH.SCRIPT_CONFLICT'});
 const result=mergeManifest(source,'0.3.0-alpha.17',{replaceStart:true});assert.equal(result.scripts.test,'keep');assert.equal(result.dependencies.other,'1');assert.deepEqual({...result.custom},{a:1});assert.equal(result.scripts.start,'wydgine start');assert.ok(!result.scripts.install&&!result.scripts.postinstall);
 for(const text of ['bad','[]','{"scripts":[]}','{"scripts":null}','{"dependencies":false}','{"scripts":{"test":2}}'])assert.throws(()=>mergeManifest(text,'0.3.0-alpha.17'));assert.throws(()=>mergeManifest(null,'invented'));assert.throws(()=>mergeManifest('{"scripts":{"start":""}}','0.3.0-alpha.17'),{code:'LAUNCH.SCRIPT_CONFLICT'});
});
test('setup fresh, rerun, default preservation, review refusal, conflicting script refusal and backups',async t=>{
 const root=await fixture(t);await app(root,'a');await localAdapter(root);
 const fresh=terminal(['','path','apps/a','','','y']);await setup({directory:root,terminal:fresh});assert.match(fresh.output,/App creation is not implemented/);
 const first=await fs.readFile(path.join(root,'wydgine.local.json'),'utf8');assert.equal(JSON.parse(first).defaultApp,'apps/a');assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'))).scripts.start,'wydgine start');
 await setup({directory:root,terminal:terminal(['','','','','y'])});assert.equal(await fs.readFile(path.join(root,'wydgine.local.json'),'utf8'),first);assert.equal((await fs.readdir(root)).filter(n=>n.includes('.backup-')).length,2);
 await assert.rejects(setup({directory:root,terminal:terminal(['','','','','n'])}),{code:'LAUNCH.CANCELLED'});assert.equal(await fs.readFile(path.join(root,'wydgine.local.json'),'utf8'),first);
 await fs.writeFile(path.join(root,'package.json'),json({scripts:{start:'custom',test:'keep'}}));await assert.rejects(setup({directory:root,terminal:terminal(['','','','','n'])}),{code:'LAUNCH.CANCELLED'});assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'))).scripts.start,'custom');
 await assert.rejects(setup({directory:root,terminal:terminal(['','','','0'])}),{code:'LAUNCH.LISTENER'});
});
test('headless CLI fails closed, validates canonical App and sanitizes errors',async t=>{
 const root=await fixture(t);await app(root,'a');
 for(const [args,code] of [[['start'],'APP_SELECTION_REQUIRED'],[['start','missing/private-secret'],'LAUNCH.APP_INVALID'],[['validate','apps/a'],null],[['setup'],'LAUNCH.TTY_REQUIRED']]){const run=child(t,[bin,...args],{cwd:root});run.p.stdin.end();const [status]=await run.exited;assert.equal(status,code?1:0,run.err);if(code)assert.match(run.err,new RegExp(code));assert.doesNotMatch(run.err,/private-secret|node_modules/);}
 await config(root,{...defaults(),setup:{enabled:true}});const run=child(t,[bin,'start','apps/a'],{cwd:root});assert.equal((await run.exited)[0],1);assert.match(run.err,/LAUNCH.UNSUPPORTED/);
});
test('real independent processes, npm subdirectory cwd/forwarding, collision, HTTP identity and signals',async t=>{
 const root=await fixture(t);await app(root,'a');await app(root,'ü space','beta');await localAdapter(root);await fs.writeFile(path.join(root,'package.json'),json({private:true,scripts:{start:'wydgine start'}}));await fs.mkdir(path.join(root,'subdir'));
 const p1=await freePort(),p2=await freePort();await config(root,{...defaults(),listener:{host:'127.0.0.1',port:p1},defaultApp:'apps/a'});await fs.writeFile(path.join(root,'second.json'),json({...defaults(),listener:{host:'127.0.0.1',port:p2}}));
 const one=child(t,[bin,'start'],{cwd:root}),two=child(t,['start','--','apps/ü space','--config','second.json'],{cwd:path.join(root,'subdir'),command:'npm'});
 assert.equal((await ready(one)).app,'a');const npmReady=await ready(two);assert.equal(npmReady.app,'beta');t.after(()=>{try{process.kill(npmReady.pid,'SIGKILL');}catch{}});
 for(const [port,id,other] of [[p1,'a','beta'],[p2,'beta','a']]){const response=await fetch(`http://127.0.0.1:${port}`);assert.equal(response.status,200);const text=await response.text();assert.ok(text.includes('Title '+id));assert.ok(!text.includes('Title '+other));const asset=await fetch(`http://127.0.0.1:${port}/runtime/wydclient/uploads.js`);assert.equal(asset.status,200);}
 const collision=child(t,[bin,'start','apps/ü space'],{cwd:root});assert.equal((await collision.exited)[0],1);assert.match(collision.err,/LAUNCH.LISTENER_IN_USE/);
 one.p.kill('SIGTERM');assert.equal((await one.exited)[0],0);
 process.kill(npmReady.pid,'SIGTERM');assert.equal((await two.exited)[0],0);
 const direct=child(t,[bin,'start','apps/ü space','--config','second.json'],{cwd:root});
 if((await ready(direct)).app!=='beta')assert.fail('Wrong App');direct.p.kill('SIGINT');assert.equal((await direct.exited)[0],0);
});
test('CLI selected real five-library App retains services and startup failure cleanup',async t=>{
 const root=await fixture(t);await provisionExample(root);const selected=await validateSelected(path.join(root,'app-alpha')),port=await freePort();const running=await launch(selected,{host:'127.0.0.1',port});try{assert.equal(running.app.locals.libraries.list().length,5);assert.equal((await fetch(`http://127.0.0.1:${port}`)).status,200);const ctx=new ExecutionContext({context:'FrontEnd',publisher:'acme',package:'acme/demo',app:'app-alpha',self:'home',capabilities:['store.records.read'],scopes:{wydstore:[{store:'main',collection:'records'}]}});assert.equal((await running.app.locals.libraries.bind(ctx).invoke('wydstore','1.0.0','count',{store:'main',collection:'records'})).value,0);}finally{await running.app.shutdown(running.server);}
 const configFile=path.join(root,'app-alpha/wydgit.config.json'),v=JSON.parse(await fs.readFile(configFile));v.libraries[0].version='999.0.0';await fs.writeFile(configFile,json(v));const invalid=await validateSelected(path.join(root,'app-alpha'));await assert.rejects(launch(invalid,{host:'127.0.0.1',port}),{code:'LAUNCH.START_FAILED'});const s=net.createServer();s.listen(port,'127.0.0.1');await once(s,'listening');await new Promise(r=>s.close(r));
});
