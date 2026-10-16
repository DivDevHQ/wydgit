import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';
import {ExecutionContext,checkContext} from '../wydgine/seam/context.js';
import {ExecutionContext as installedContext} from 'wydgine/trusted/services';
import {createHostApp} from 'wydgine';
import {createApp as legacyApp,createHostApp as legacyHost} from '../app.js';
import {createHostApp as trustedHostApp} from 'wydgine/trusted/worker';
import * as provider from 'wydgine/trusted/provider';
import {validateAppInventory} from '../wydgine/inventory.js';
import engine from 'wydgine/package.json' with {type:'json'};
import hosting from '../packages/wydhosting/package.json' with {type:'json'};

test('package and historical imports preserve one authority graph and exact prerelease compatibility',async()=>{
 assert.throws(()=>legacyApp({root:null}),TypeError);await assert.rejects(legacyHost({root:null}),TypeError);await assert.rejects(createHostApp({root:null}),TypeError);
 assert.equal(ExecutionContext,installedContext);assert.equal(createHostApp,trustedHostApp);assert.equal(provider.validateAppInventory,validateAppInventory);
 const context=new installedContext({publisher:'acme',self:'home'});checkContext(context);assert.ok(Object.isFrozen(context));assert.throws(()=>checkContext({...context}),{code:'SEAM.CONTEXT'});
 assert.equal(hosting.dependencies.wydgine,engine.version);assert.ok(!engine.dependencies?.wydhosting);
 assert.equal(semver.satisfies(engine.version,hosting.dependencies.wydgine),true);
 assert.equal(semver.satisfies('0.3.0-alpha.15',hosting.dependencies.wydgine),false);
 assert.equal(semver.satisfies(engine.version,'^0.3.0'),false);
});
test('legacy engine consists exclusively of re-exports and cross-package integrations use approved exports',async()=>{
 async function files(root){const found=[];for(const entry of await fs.readdir(root,{withFileTypes:true})){const file=path.join(root,entry.name);if(entry.isDirectory())found.push(...await files(file));else if(file.endsWith('.js'))found.push(file);}return found;}
 for(const file of await files('wydgine'))assert.match((await fs.readFile(file,'utf8')).replace("// Preserve the historical repository-default embedding entry.\nexport {createHostApp} from '../../app.js';\n",''),/^\/\/ Historical import compatibility; one canonical engine module\.\nexport \* from ['"][^'"]+['"];\n$/);
 for(const name of ['wydhosting','wydsearch','wydstream'])for(const file of await files('packages/'+name+'/src')){
  const text=await fs.readFile(file,'utf8');assert.doesNotMatch(text,/\.\.\/\.\.\/\.\.\/wydgine\//);
  for(const match of text.matchAll(/from\s*['"]wydgine([^'"]*)['"]/g))assert.ok((name==='wydhosting'?['/trusted/provider','/trusted/protocol']:['/trusted/services']).includes(match[1]));
 }
 const root=path.resolve('packages/wydgine');
 for(const file of await files(root)){
  const text=await fs.readFile(file,'utf8');assert.doesNotMatch(text,/from\s*['"][^'"]*wydhosting|import\s*\(['"][^'"]*wydhosting/);
  for(const match of text.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g))assert.ok(path.resolve(path.dirname(file),match[1]).startsWith(root+path.sep),file+': '+match[1]);
 }
});
