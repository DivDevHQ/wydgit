import test from 'node:test';
import assert from 'node:assert/strict';
import {sameInstallationStamp} from '../packages/wydgine/src/engine/packages/installation-stamp.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {lifecycleFixture} from '../test-support/package-lifecycle.js';
import {packageOperation,activatePackages} from '../wydgine/packages/index.js';
import {loadRepository} from '../wydgine/repository.js';
import {checkContext} from '../wydgine/seam/context.js';
const fields=['dev','ino','size','mtimeNs','ctimeNs'];
const stat=()=>({dev:3n,ino:123n,size:500n,mtimeNs:1000000000000000000n,ctimeNs:1000000000000000001n});
const legacy=rows=>rows.map(s=>s?`${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`:'absent').join('|');
test('installation tuple equality matches the old representation for each identity field and absence',()=>{
  const before=[stat(),undefined,stat()];
  assert.equal(sameInstallationStamp(before,[stat(),undefined,stat()]),true);
  for(let index=0;index<before.length;index++)for(const field of fields){
    const after=before.map(s=>s?{...s}:undefined);after[index]??=stat();after[index][field]++;
    assert.equal(sameInstallationStamp(before,after),legacy(before)===legacy(after));
    assert.equal(sameInstallationStamp(before,after),false);
  }
  for(const after of [[stat(),stat(),stat()],[stat(),undefined,undefined],[undefined,undefined,stat()]])assert.equal(sameInstallationStamp(before,after),false);
  assert.equal(sameInstallationStamp([undefined],[undefined]),true);
  assert.equal(sameInstallationStamp([],[]),true);
  assert.equal(sameInstallationStamp(before,[]),false);
});
test('tuple equality preserves nanosecond BigInt precision and ignores only fields the old stamp ignored',()=>{
  const a=stat(),b={...a,ctimeNs:a.ctimeNs+1n},c={...a,nlink:99n};
  assert.equal(Number(a.ctimeNs),Number(b.ctimeNs));assert.equal(sameInstallationStamp([a],[b]),false);
  assert.equal(sameInstallationStamp([a],[c]),true);
});
async function installed(t){
  const f=await lifecycleFixture(t),a=await f.candidate('a');await packageOperation(f.operation('install','acme/a',[a]));
  const bind=()=>activatePackages(loadRepository(f.root),{resolve(){},resolvePackageScopes(){}},f.root).context({pageId:'page-a',session:{},ids:[]});
  return {...f,bind,catalog:path.join(f.root,'content/installed-packages.json')};
}
test('fresh installation stamps reject changed source with restored mtime, and never revive a revoked context',async t=>{
  const f=await installed(t),bytes=await fs.readFile(f.catalog),fixedSeconds=1700000000;
  // Set an exactly representable timestamp before binding; restore exactly the
  // same nanoseconds after a same-length edit. Only ctime in the stamp changes.
  await fs.utimes(f.catalog,fixedSeconds,fixedSeconds);
  const context=f.bind(),before=await fs.stat(f.catalog,{bigint:true});
  checkContext(context);
  const state=JSON.parse(bytes),entry=state.packages[0],source=entry.manifest.resources.prototypes;
  assert.ok(entry.resources[source].includes('package default'));
  const encodedBefore=JSON.stringify(entry.resources[source]);
  const encodedAfter=JSON.stringify(entry.resources[source].replace('package default','Package default'));
  assert.equal(bytes.toString().split(encodedBefore).length,2);
  await fs.writeFile(f.catalog,bytes.toString().replace(encodedBefore,encodedAfter));await fs.utimes(f.catalog,fixedSeconds,fixedSeconds);
  const after=await fs.stat(f.catalog,{bigint:true});assert.equal(after.ino,before.ino);assert.equal(after.size,before.size);
  assert.equal(after.mtimeNs,before.mtimeNs);assert.notEqual(after.ctimeNs,before.ctimeNs);
  assert.throws(()=>checkContext(context),{code:'SEAM.CONTEXT'});
  await fs.writeFile(f.catalog,bytes);assert.throws(()=>checkContext(context),{code:'SEAM.CONTEXT'});checkContext(f.bind());
});
test('fresh installation stamps revalidate byte-identical replacement and reject symlink substitution',async t=>{
  const f=await installed(t),context=f.bind(),bytes=await fs.readFile(f.catalog),before=await fs.stat(f.catalog,{bigint:true});
  await fs.writeFile(f.catalog+'.new',bytes);await fs.rename(f.catalog+'.new',f.catalog);
  assert.notEqual((await fs.stat(f.catalog,{bigint:true})).ino,before.ino);checkContext(context);
  await fs.rename(f.catalog,f.catalog+'.held');await fs.symlink(f.catalog+'.held',f.catalog);
  assert.throws(()=>checkContext(context),{code:'SEAM.CONTEXT'});
  await fs.unlink(f.catalog);await fs.rename(f.catalog+'.held',f.catalog);assert.throws(()=>checkContext(context),{code:'SEAM.CONTEXT'});
});
