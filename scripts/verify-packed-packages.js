// Actual local tarball acceptance. All runtime execution occurs outside this checkout.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const repository=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-i54-packed-'));
assert.ok(!directory.startsWith(repository+path.sep));
const artifacts=path.join(directory,'tarballs');await fs.mkdir(artifacts);
console.log('Evidence directory: '+directory);
async function run(command,args,cwd,{env={},log,allowFailure=false}={}){
 return new Promise((resolve,reject)=>{
  const environment={...process.env};delete environment.NODE_PATH;delete environment.NODE_OPTIONS;
  const child=spawn(command,args,{cwd,env:{...environment,...env},stdio:['ignore','pipe','pipe']});let output='';
  child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
  child.once('error',reject);child.once('exit',async(code,signal)=>{
   try{if(log)await fs.writeFile(path.join(directory,log),output);if(code!==0&&!allowFailure)throw Error(`${command} ${args.join(' ')} failed (${code??signal}); ${log??output}`);resolve({code,output});}catch(error){reject(error);}
  });
 });
}
const packed={};
for(const name of ['wydgine','wydhosting','wydstore','wydgate','wydsearch','wydfiles','wydstream']){
 const result=await run('npm',['pack','--json','--pack-destination',artifacts],path.join(repository,'packages',name));
 const record=JSON.parse(result.output)[0];packed[name]=path.join(artifacts,record.filename);
 assert.ok(record.files.some(f=>f.path==='README.md'),name+' README');
 assert.ok(record.files.some(f=>f.path==='LICENSE'),name+' LICENSE');
 // Every package is private/local verification; no publication occurs.
 assert.ok(!record.files.some(f=>/(^|\/)(test|node_modules|\.git|data)(\/|$)|\.pem$|private.key/.test(f.path)),name+' unexpected package contents');
 await fs.writeFile(path.join(directory,name+'-pack.json'),JSON.stringify(record,null,2));
}
async function consumer(name,packages){
 const root=path.join(directory,name);await fs.mkdir(root);
 await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name:'wydgit',version:'0.3.0-alpha.14',private:true,type:'module',scripts:{start:'wydgine start'}}));
 await run('npm',['install','--no-audit','--no-fund',...packages.map(name=>packed[name])],root,{log:name+'-install.log'});
 const graph=await run('npm',['ls','--all','--json'],root,{log:name+'-dependencies.json'});assert.ok(JSON.parse(graph.output).dependencies.wydgine);
 for(const name of packages)assert.equal((await fs.lstat(path.join(root,'node_modules',name.startsWith('wyd')&&!['wydgine','wydhosting'].includes(name)?'@wydgit/'+name.slice(3):name))).isSymbolicLink(),false);
 await fs.writeFile(path.join(root,'proof-register.mjs'),`import {registerHooks} from 'node:module';\nimport {appendFileSync} from 'node:fs';\nimport {fileURLToPath} from 'node:url';\nconst seen=new Set();\nregisterHooks({resolve(specifier,context,next){const result=next(specifier,context);if(result.url.startsWith('file:')){const file=fileURLToPath(result.url);if(file===${JSON.stringify(repository)}||file.startsWith(${JSON.stringify(repository+'/')}))throw Error('DEVELOPMENT REPOSITORY IMPORT: '+file);if(!seen.has(file)){seen.add(file);appendFileSync(${JSON.stringify(path.join(root,'resolved-paths.log'))},file+'\\n');}}return result;}});\n`);
 return root;
}
const serviceFree=await consumer('service-free',['wydgine']);
for(const name of ['content','prototypes','public'])await fs.cp(path.join(repository,name),path.join(serviceFree,'apps/sample',name),{recursive:true});
await fs.writeFile(path.join(serviceFree,'apps/sample/wydgit.config.json'),JSON.stringify({schema:'wydgit.host/0.1',libraries:[]}));
await fs.copyFile(path.join(repository,'test-support/packed/service-free.mjs'),path.join(serviceFree,'service-free.mjs'));
await run(process.execPath,['--import',path.join(serviceFree,'proof-register.mjs'),'service-free.mjs'],serviceFree,{log:'service-free.log'});
console.log('PASS service-free installed binary, validation, HTTP/assets, restart, closed configuration');
const full=await consumer('five-library',['wydgine','wydstore','wydgate','wydsearch','wydfiles','wydstream']);
const selected=['multi-app','hostname-host','hosting-operations','hardening','guestbook-package','packages','package-infrastructure','wydgate-http','wydstream-http','wydstream-search','wydstream-security','wydsearch-package','wydfiles','wydstore-sqlite','process-supervision'];
async function stage(root){
 await fs.copyFile(path.join(repository,'wydgit.config.json'),path.join(root,'wydgit.config.json'));
 await fs.mkdir(path.join(root,'.fixtures'));
 await run('npm',['install','--save-dev','--no-audit','--no-fund','cheerio@1.0.0'],root,{log:path.basename(root)+'-test-dependencies.log'});
 for(const name of ['content','prototypes','public','examples','test-support'])await fs.cp(path.join(repository,name),path.join(root,name),{recursive:true});
 await fs.mkdir(path.join(root,'test'),{recursive:true});await fs.cp(path.join(repository,'test/fixtures'),path.join(root,'test/fixtures'),{recursive:true});
 // These are independently staged fixture data and tests, never runtime source.
 for(const name of selected)await fs.copyFile(path.join(repository,'test',name+'.test.js'),path.join(root,'test',name+'.test.js'));
 for(const name of ['scripts/install-package.js','scripts/package-infrastructure.js']){await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.copyFile(path.join(repository,name),path.join(root,name));}
 async function rewrite(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await rewrite(file);else if(/\.(js|mjs)$/.test(file)){
  let text=await fs.readFile(file,'utf8');
  text=text.replace(/(['"])(\.\.\/)+wydgine\//g,match=>match.replace('wydgine/','node_modules/wydgine/src/engine/'));
  text=text.replace(/(['"])(\.\.\/)+packages\/wyd(store|gate|search|files|stream)\//g,match=>match.replace(/packages\/wyd(\w+)\//,'node_modules/@wydgit/$1/'));
  text=text.replaceAll('packages/wydstore/package.json','node_modules/@wydgit/store/package.json');
  text=text.replace(/(['"])(\.\.\/)+app\.js\1/g,"'wydgine'");
  // Consumer ancestor resolution replaces the development example's workspace link.
  text=text.replace(/await fs\.symlink\(path\.join\(project,'node_modules'\),path\.join\(directory,'node_modules'\),'dir'\);/g,'');
  await fs.writeFile(file,text);
 }}}
 for(const name of ['test','test-support','examples','scripts'])await rewrite(path.join(root,name));
}
await stage(full);
await run(process.execPath,['--import',path.join(full,'proof-register.mjs'),'--test',...selected.filter(name=>name!=='process-supervision').map(name=>'test/'+name+'.test.js')],full,{log:'five-library-tests.log',env:{TMPDIR:path.join(full,'.fixtures'),NODE_OPTIONS:'--import '+path.join(full,'proof-register.mjs')}});
console.log('PASS installed five-library real-App regression fixtures');
const provider=await consumer('provider',['wydgine','wydhosting']);
await fs.copyFile(path.join(repository,'test-support/packed/provider-cli.mjs'),path.join(provider,'provider-cli.mjs'));
await run(process.execPath,['--import',path.join(provider,'proof-register.mjs'),'provider-cli.mjs'],provider,{log:'provider-bin.log',env:{NODE_OPTIONS:'--import '+path.join(provider,'proof-register.mjs')}});
await run('npm',['install','--no-audit','--no-fund',...['wydstore','wydgate','wydsearch','wydfiles','wydstream'].map(name=>packed[name])],provider,{log:'provider-services-install.log'});
await stage(provider);
const testDirectory=path.join(provider,'packages/wydhosting/test');await fs.mkdir(testDirectory,{recursive:true});
let providerTests=await fs.readFile(path.join(repository,'packages/wydhosting/test/provider.test.js'),'utf8');
providerTests=providerTests.replaceAll("'../src/","'../../../node_modules/wydhosting/src/").replaceAll("'../bin/","'../../../node_modules/wydhosting/bin/").replaceAll("'../../../wydgine/","'../../../node_modules/wydgine/src/engine/").replaceAll("packages/wydhosting/bin/wydhosting.js","node_modules/wydhosting/bin/wydhosting.js").replace("scan('wydgine')","scan('node_modules/wydgine/src')").replace("scan('packages/wydgine')","scan('node_modules/wydgine')");
await fs.writeFile(path.join(testDirectory,'provider.test.js'),providerTests);
// Provider compatibility test checks the historical root command, independently staged.
const manifest=JSON.parse(await fs.readFile(path.join(provider,'package.json')));manifest.scripts.start='node server.js';await fs.writeFile(path.join(provider,'package.json'),JSON.stringify(manifest));
await run(process.execPath,['--import',path.join(provider,'proof-register.mjs'),'--test','packages/wydhosting/test/provider.test.js'],provider,{log:'provider-tests.log',env:{TMPDIR:path.join(provider,'.fixtures'),NODE_OPTIONS:'--import '+path.join(provider,'proof-register.mjs')}});
console.log('PASS installed provider CLI, registry, authorization, replay and inventory fixtures');
await run(process.execPath,['--import',path.join(provider,'proof-register.mjs'),'--test','test/process-supervision.test.js'],provider,{log:'process-supervision.log',env:{TMPDIR:path.join(provider,'.fixtures'),NODE_OPTIONS:'--import '+path.join(provider,'proof-register.mjs')}});
console.log('PASS installed provider supervises actual installed Wydgine worker processes');
for(const root of [serviceFree,full,provider]){
 const paths=(await fs.readFile(path.join(root,'resolved-paths.log'),'utf8')).trim().split('\n');assert.ok(paths.some(file=>file.startsWith(path.join(root,'node_modules/wydgine/src/'))));assert.ok(!paths.some(file=>file.startsWith(repository+'/')));
 // npm must not nest a second, incompatible engine beneath any dependency.
 async function engines(directory){let count=0;for(const entry of await fs.readdir(directory,{withFileTypes:true})){if(!entry.isDirectory())continue;const file=path.join(directory,entry.name);if(entry.name==='wydgine'&&await fs.stat(path.join(file,'package.json')).catch(()=>false))count++;count+=await engines(file);}return count;}
 assert.equal(await engines(path.join(root,'node_modules')),1);
}
await fs.writeFile(path.join(directory,'result.json'),JSON.stringify({ok:true,node:process.version,packages:packed,consumers:[serviceFree,full,provider]},null,2));
console.log('PASS one installed engine per consumer; repository imports rejected by synchronous ESM/CommonJS resolution hook');
