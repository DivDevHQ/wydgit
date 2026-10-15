import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
const require=createRequire(import.meta.url);
for(const name of ['wydhosting','@wydgit/store','@wydgit/gate'])assert.throws(()=>require.resolve(name));
const config={schema:'wydgine.launch/1',appsDirectory:'apps',defaultApp:'apps/sample',listener:{host:'127.0.0.1',port:3000},setup:{enabled:false}};
const env={...process.env,NODE_OPTIONS:'--import '+process.cwd()+'/proof-register.mjs'};
const bin='./node_modules/.bin/wydgine';
assert.match(execFileSync(bin,['--help'],{env,encoding:'utf8'}),/wydgine/);
execFileSync(bin,['validate','apps/sample'],{env,stdio:'pipe'});
for(let restart=0;restart<2;restart++){
 const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');config.listener.port=reserve.address().port;await new Promise(r=>reserve.close(r));
 await fs.writeFile('wydgine.local.json',JSON.stringify(config));
 // npm invokes the actual installed bin and the configured App persists across restarts.
 const child=spawn('npm',['start'],{env,detached:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>output+=v);const exited=once(child,'exit');
 try{
  let ready=false;for(let i=0;i<400;i++){if(output.includes('"ok":true')){ready=true;break;}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,20));}assert.ok(ready,output);
  const url='http://127.0.0.1:'+config.listener.port;
  const response=await fetch(url);assert.equal(response.status,200);assert.match(await response.text(),/Wydgit/);
  const pending=['/runtime/wydclient/uploads.js','/runtime/wydclient/index.js'],seen=new Set();
  while(pending.length){const pathname=pending.shift();if(seen.has(pathname))continue;seen.add(pathname);const res=await fetch(url+pathname);assert.equal(res.status,200,pathname);const source=await res.text();const relative=pathname.slice('/runtime/'.length);const file=await fs.realpath(relative.startsWith('wydgine/')?'node_modules/wydgine/src/engine/'+relative.slice(8):'node_modules/wydgine/runtime/'+relative);assert.ok(file.startsWith(process.cwd()+'/node_modules/wydgine/'));assert.equal(source,await fs.readFile(file,'utf8'));await fs.appendFile('asset-paths.log',file+'\n');assert.doesNotMatch(source,/['"]node:|privateKey|child_process/);for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g))pending.push(new URL(match[1],url+pathname).pathname);}
  assert.ok(seen.has('/runtime/wydgine/seam/context.js'));
  assert.equal((await fetch(url+'/runtime/wydgine/host.js')).status,404);
  const readyLine=output.split('\n').find(line=>line.startsWith('{"ok":true'));process.kill(JSON.parse(readyLine).pid,'SIGTERM');assert.equal((await exited)[0],0,output);
 }finally{if(child.exitCode===null&&child.signalCode===null){process.kill(-child.pid,'SIGKILL');await exited;}}
}
await fs.writeFile('wydgine.local.json','{"schema":"hostile"}');assert.throws(()=>execFileSync(bin,['start'],{env,stdio:'pipe'}));
await fs.unlink('wydgine.local.json');assert.throws(()=>execFileSync(bin,['start'],{env,stdio:'pipe'}));
assert.throws(()=>execFileSync(bin,['start','--config','absent.json'],{env,stdio:'pipe'}));
console.log('PASS actual installed service-free CLI: HTTP/browser closure, restart and invalid/missing configuration fail closed');
