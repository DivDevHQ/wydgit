import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import { compile, compileModule } from '../wydgine/wydbasic/index.js';
import { validate } from '../wydgine/sewn/validate.js';
import { runInstaller } from '../scripts/install-package.js';
import { packageFixture } from '../test-support/packages.js';
import { createHostApp } from '../app.js';
import { loadRepository } from '../wydgine/repository.js';

test('seeded hostile WydBASIC inputs fail with structured diagnostics and bounded pathological expressions',()=>{
 const alphabet=['RETURN','DIM','x','=','(',')','[',']','{','}',',','"x"','1','+','.','CALL','SUB','END','\n'];let seed=18;
 for(let i=0;i<2000;i++){
  let source='';for(let j=0;j<20;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;source+=alphabet[seed%alphabet.length]+' ';}
  for(const compiler of [compile,compileModule])try{compiler(source);}catch(error){assert.match(error.code,/^WYDBASIC\./);assert.ok(Number.isInteger(error.details.line));assert.ok(Number.isInteger(error.details.column));}
 }
 for(const source of ['RETURN '+'('.repeat(1000)+'1'+')'.repeat(1000),'RETURN '+Array(10000).fill('1').join('+'),'RETURN "unterminated','x'.repeat(65537),'RETURN Me.'+Array(5000).fill('properties').join('.')]){
  assert.throws(()=>compile(source),e=>/^WYDBASIC\./.test(e.code));
 }
});

test('every SEWN schema rejects dangerous keys, oversize programs and excessive nesting before execution',()=>{
 for(const schema of ['sewn/0.1','sewn/0.2','sewn/0.3']){
  const program={schema,...(schema==='sewn/0.1'?{}:{procedures:{}}),body:[]};
  for(const body of [[{op:'eval',source:'process.exit()'}],[{op:'return',value:{op:'literal',value:'x'.repeat(65537)}}],JSON.parse('[{"op":"return","value":{"op":"literal","value":{"__proto__":{}}}}]')])assert.throws(()=>validate({...program,body}),e=>/^SEWN\./.test(e.code));
  let value={op:'literal',value:true};for(let i=0;i<100;i++)value={op:'not',value};assert.throws(()=>validate({...program,body:[{op:'return',value}]}),{code:'SEWN.LIMIT'});
 }
});

for(const provider of ['JSON','SQLite'])test(`${provider}: clean interactive Contact install, concurrent HTTP submissions, restart and explicit base-site cleanup`,async t=>{
 const f=await packageFixture(t),configPath=path.join(f.root,'wydgit.config.json');
 // Start from the shipped disabled-library configuration, with no generated state.
 const baseline=await fs.readFile('wydgit.config.json','utf8');await fs.writeFile(configPath,baseline);
 let host;
 const stop=async()=>{if(host){const current=host;host=null;await current.app.shutdown(current.server);}};t.after(stop);
 const start=async()=>{const app=await createHostApp({root:f.root}),server=app.listen(0,'127.0.0.1');await once(server,'listening');host={app,server,url:`http://127.0.0.1:${server.address().port}`};};
 await start();for(const route of ['/','/about/','/contact/']){const response=await fetch(host.url+route);assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/Guestbook/);}await stop();
 const answers=['y','y','contact','contact','sections','0',provider,'','y','y'];let transcript='';
 const installed=await runInstaller({args:[f.packagePath,'--root',f.root,'--apply'],input:Readable.from(answers.map(a=>a+'\n')),output:{write:s=>{transcript+=s;}}});
 assert.equal(installed.receipt.placement.page,'contact');assert.match(transcript,/Apply installation\?/);assert.match(transcript,/Approve this host storage provisioning/);
 await start();const first=await fetch(host.url+'/contact/'),html=await first.text();assert.match(html,/Guestbook/);assert.match(html,/wyd-form/);
 const cookie=first.headers.get('set-cookie').split(';')[0],csrf=/name="_csrf" value="([^"]+)"/.exec(html)[1];
 const post=async(name,message)=>{const response=await fetch(host.url+'/contact/',{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_target:'guestbook-form',_action:'Submit',_csrf:csrf,name,message})});assert.equal(response.status,200);return response.text();};
 assert.match(await post(' ','retain invalid'),/aria-invalid="true"/);
 for(const response of await Promise.all(['Ada','Grace','Linus','Margaret'].map(name=>post(name,'Hello **world** <script>unsafe()</script>')))){assert.match(response,/Thank you/);assert.doesNotMatch(response,/<script>/);}
 assert.doesNotMatch(await (await fetch(host.url)).text(),/Guestbook/);
 await stop();await start();const persisted=await (await fetch(host.url+'/contact/')).text();for(const name of ['Ada','Grace','Linus','Margaret'])assert.match(persisted,new RegExp(name+' —'));
 await stop();
 // Fixture cleanup is deliberate restoration, not a supported uninstall API.
 await fs.writeFile(configPath,baseline);await fs.unlink(path.join(f.root,'content/installed-packages.json'));await fs.rm(path.join(f.root,'.wydgit-data'),{recursive:true});
 assert.equal(loadRepository(f.root).installed,null);assert.equal((await fs.readdir(path.join(f.root,'content'))).some(n=>n.includes('package')),false);
 await assert.rejects(fs.stat(path.join(f.root,'.wydgit-data')),{code:'ENOENT'});
 await start();for(const route of ['/','/about/','/contact/']){const response=await fetch(host.url+route);assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/Guestbook|guestbook-entry|guestbook-form/);}await stop();
});
