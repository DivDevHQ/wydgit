// Manual bounded diagnostic: no Wydgit imports, native addon, or host changes.
// node test-support/linux/node-async-repro.mjs [plain|child|node-child|unix]
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
const mode=process.argv[2]??'plain';
assert.ok(['plain','child','node-child','unix'].includes(mode));
console.log(JSON.stringify({mode,node:process.version,executable:process.execPath,
 uid:process.getuid(),gid:process.getgid(),cwd:process.cwd(),
 options:process.env.NODE_OPTIONS??null,nodePath:process.env.NODE_PATH??null,
 status:(await fs.readFile('/proc/self/status','utf8')).split('\n').filter(s=>/^(NoNewPrivs|Seccomp)/.test(s))}));
test('bounded '+mode+' control',async()=>{
 await Promise.resolve();
 if(mode==='child'){
  const result=spawnSync('python3',['-c',
   'import socket\na,b=socket.socketpair()\ntry:\n a.sendall(b"probe")\n print("stream sendall permitted")\nexcept OSError as e:\n print(type(e).__name__,e.errno)\nfinally:\n a.close();b.close()'],{encoding:'utf8',timeout:3000});
  console.log(JSON.stringify({status:result.status,signal:result.signal,stdout:result.stdout,stderr:result.stderr}));
  assert.equal(result.status,0);
 }
 if(mode==='node-child'){
  const result=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['-e','console.log("probe")'],{stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
   child.once('error',reject);child.once('close',(status,signal)=>resolve({status,signal,stdout,stderr}));
  });
  console.log(JSON.stringify(result));assert.equal(result.status,0);assert.equal(result.stdout,'probe\n');
 }
 if(mode==='unix'){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-node-async-'));
  const server=net.createServer(socket=>socket.destroy());
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(path.join(directory,'probe.sock'),resolve);});}
  finally{if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await fs.rm(directory,{recursive:true,force:true});}
 }
});
