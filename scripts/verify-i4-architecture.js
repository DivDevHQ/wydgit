// Disposable I4 design evidence. Not a launcher, installer or supervisor.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHostApp} from '../app.js';
import {validateAppInventory} from '../wydgine/multi-app.js';
import {provisionHostnameExample} from '../examples/hostname-host/setup.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-i4-'));
let app,server;
try {
 const inventory=await provisionHostnameExample(root);
 // Service-free canonical App: no multi-App controller is constructed.
 app=await createHostApp({root:path.join(root,'platform-parking'),appId:'platform-parking'});
 server=app.listen(0,'127.0.0.1');
 await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 const response=await fetch(`http://127.0.0.1:${server.address().port}/`);
 assert.equal(response.status,200);assert.match(await response.text(),/Parked/);
 await app.shutdown(server);server=null;app=null;
 console.log('PASS explicit-root standalone initialization and HTTP cleanup without controller');
 await validateAppInventory(inventory,{root});
 await fs.symlink(path.join(root,'platform-parking'),path.join(root,'alias'));
 const linked=structuredClone(inventory);linked.apps.find(a=>a.id==='platform-parking').root='alias';
 await assert.rejects(validateAppInventory(linked,{root}),e=>e.code==='HOST.ROOT');
 const oversized={schema:inventory.schema,apps:Array.from({length:17},(_,i)=>({id:`app-${i}`,root:`app-${i}`}))};
 await assert.rejects(validateAppInventory(oversized,{root}),e=>e.code==='HOST.INVALID');
 console.log('PASS canonical inventory; symlink alias and 17-App inventory rejected');
 const consumer=path.join(root,'consumer');await fs.mkdir(consumer);
 const dependency=path.join(root,'mock-engine');await fs.mkdir(dependency);
 await fs.writeFile(path.join(dependency,'package.json'),JSON.stringify({name:'wydgine',version:'0.0.0',bin:{wydgine:'cli.cjs'},scripts:{setup:'node cli.cjs setup'}}));
 await fs.writeFile(path.join(dependency,'cli.cjs'),`#!/usr/bin/env node\nconsole.log(JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()}));\n`,{mode:0o755});
 const write=manifest=>fs.writeFile(path.join(consumer,'package.json'),JSON.stringify(manifest));
 const run=(args,cwd=consumer)=>execFileSync('npm',['--silent',...args],{cwd,encoding:'utf8',env:{...process.env,npm_config_cache:path.join(root,'npm-cache'),npm_config_offline:'true'},stdio:['ignore','pipe','pipe']});
 await write({private:true});
 run(['install','--ignore-scripts','--install-links','--package-lock=false','--no-audit','--no-fund',dependency]);
 assert.ok((await fs.lstat(path.join(consumer,'node_modules/.bin/wydgine'))).isSymbolicLink());
 assert.throws(()=>run(['run','setup'])); // Dependency scripts are not inherited.
 await write({private:true,scripts:{start:'wydgine start','start:hosting':'wydgine hosting-fixture'},dependencies:{wydgine:'0.0.0'}});
 assert.deepEqual(JSON.parse(run(['start','--','apps/brained.com'])),{args:['start','apps/brained.com'],cwd:consumer});
 const nested=path.join(consumer,'nested');await fs.mkdir(nested);
 assert.equal(JSON.parse(run(['start','--','apps/libundance.com'],nested)).cwd,consumer);
 assert.deepEqual(JSON.parse(run(['exec','--no','--','wydgine','setup'])).args,['setup']);
 assert.deepEqual(JSON.parse(run(['run','start:hosting'])).args,['hosting-fixture']);
 console.log('PASS local bin, npm exec setup, local scripts, argument forwarding and package-root cwd; dependency setup not inherited');
 console.log('4 architecture validation groups passed; mock CLI proves npm mechanics only, not future Wydgine CLI.');
} finally {
 if(server?.listening)await app.shutdown(server);else await app?.stop();
 await fs.rm(root,{recursive:true,force:true});
}
