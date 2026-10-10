import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { packageFixture } from '../test-support/packages.js';
import { buildOperatorPolicy, runInstaller } from '../scripts/install-package.js';
const answers=['y','home','home','sections','1',''];
const snapshot=async root=>{
 const result={};
 const walk=async relative=>{for(const item of await fs.readdir(path.join(root,relative),{withFileTypes:true})){const name=path.join(relative,item.name);if(item.isDirectory())await walk(name);else result[name]=await fs.readFile(path.join(root,name),'utf8');}};
 for(const dir of ['content','prototypes','data'])await walk(dir);
 result.config=await fs.readFile(path.join(root,'wydgit.config.json'),'utf8');return result;
};
const output=()=>{let text='';return {stream:new Writable({write(chunk,encoding,done){text+=chunk.toString();done();}}),text:()=>text};};
test('interactive operator policy equals explicit example and produces a valid read-only plan',async t=>{
 const {root,packagePath}=await packageFixture(t),before=await snapshot(root),queue=[...answers];
 const policy=await buildOperatorPolicy({root,packagePath,ask:async()=>queue.shift(),write:()=>{}});
 assert.deepEqual(policy,JSON.parse(await fs.readFile('examples/guestbook-policy.example.json','utf8')));
 const out=output(),result=await runInstaller({args:[packagePath,'--root',root],input:Readable.from([...answers,'n'].join('\n')+'\n'),output:out.stream});
 assert.deepEqual(result.policy,policy);assert.equal(result.receipt,null);assert.match(out.text(),/wydgit-install-plan\/0.1/);assert.match(out.text(),/Apply installation\?/);assert.deepEqual(await snapshot(root),before);
});
test('explicit --approval retains automated --apply installation',async t=>{
 const {root,packagePath}=await packageFixture(t),policyPath=path.join(root,'operator.json');
 await fs.copyFile('examples/guestbook-policy.example.json',policyPath);
 const result=await runInstaller({args:[packagePath,'--root',root,'--approval',policyPath,'--apply'],output:output().stream,ask:()=>{throw Error('Unexpected prompt');}});
 assert.equal(result.receipt.package,'divdev/guestbook');assert.ok(await fs.stat(path.join(root,'content/installed-packages.json')));
});
test('declining package permissions aborts without any repository writes',async t=>{
 const {root,packagePath}=await packageFixture(t),before=await snapshot(root),out=output();
 assert.equal(await runInstaller({args:[packagePath,'--root',root],input:Readable.from('n\n'),output:out.stream}),null);
 assert.match(out.text(),/Installation cancelled/);assert.deepEqual(await snapshot(root),before);
});

test('declining final apply shows the exact plan and leaves repository untouched',async t=>{
 const {root,packagePath}=await packageFixture(t),before=await snapshot(root),queue=[...answers,'n'],out=output();
 const result=await runInstaller({args:[packagePath,'--root',root,'--apply'],ask:async()=>queue.shift(),output:out.stream});
 assert.equal(result.receipt,null);assert.match(out.text(),/wydgit-install-plan\/0.1/);assert.deepEqual(await snapshot(root),before);
});

test('EOF at every interactive approval/choice aborts without writes, including --apply',async t=>{
 for(let count=0;count<=answers.length;count++){
  const {root,packagePath}=await packageFixture(t),before=await snapshot(root);
  await assert.rejects(runInstaller({args:[packagePath,'--root',root,'--apply'],input:Readable.from(answers.slice(0,count).map(a=>a+'\n')),output:output().stream}),{code:'PACKAGE.CLI'});
  assert.deepEqual(await snapshot(root),before);
 }
});

test('malformed and nonexistent unattended policy fail before writing accepted state',async t=>{
 const {root,packagePath}=await packageFixture(t),before=await snapshot(root),policy=path.join(root,'bad-policy.json');
 const malformedPolicy={...JSON.parse(await fs.readFile('examples/guestbook-policy.example.json','utf8')),unexpected:true};
 for(const text of ['{','null','{}','[]','false','0','"policy"',JSON.stringify(malformedPolicy)]){
  await fs.writeFile(policy,text);
  await assert.rejects(runInstaller({args:[packagePath,'--root',root,'--approval',policy,'--apply'],output:output().stream}),text==='{'?SyntaxError:{code:'PACKAGE.POLICY'});
  assert.deepEqual(await snapshot(root),before);
 }
 await assert.rejects(runInstaller({args:[packagePath,'--root',root,'--approval',path.join(root,'missing.json'),'--apply'],output:output().stream}),{code:'ENOENT'});
 assert.deepEqual(await snapshot(root),before);
});
