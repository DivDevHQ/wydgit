import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadLibraries, validateConfig, validateManifest, validateRequirements } from '../wydgine/libraries/index.js';
import { initializeHost } from '../wydgine/host.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { loadRepository } from '../wydgine/repository.js';
import { serialize } from '../wydgine/object-model/index.js';
import { renderSite } from '../wydgine/index.js';
import { createHostApp, projectRoot } from '../app.js';
import platform from '../package.json' with { type: 'json' };
import { manifest as fixtureManifest } from '@wydgit/test-library';

const config = (...libraries) => ({schema:'wydgit.host/0.1',libraries});
const entry = (extra = {}) => ({id:'wydtest',package:'@wydgit/test-library',enabled:true,version:'^1.0.0',publisher:'wydgit.core',trust:'canonical',...extra});
const requirements = (...libraries) => ({schema:'wydgit.requirements/0.1',libraries});
const need = (library='wydtest',version='^1.0.0') => ({library,version});
const load = (configuration = config(entry()), root = projectRoot, required = requirements()) => loadLibraries({config:configuration,requirements:required,root,platformVersion:platform.version});
const code = (fn, expected) => assert.throws(fn,error=>error.code===expected,expected);
const rejects = (fn, expected) => assert.rejects(fn,error=>error.code===expected,expected);
const temp = t => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wyd-library-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'fixture-host',type:'module'}));
 return root;
};
function install(root, {name='@wydgit/test-library',manifest=structuredClone(fixtureManifest),body="service('echo', value => value);",source,version='1.0.0'} = {}) {
 const directory=path.join(root,'node_modules',name);fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name,version,type:'module',exports:{'.':'./index.js','./package.json':'./package.json'}}));
 fs.writeFileSync(path.join(directory,'index.js'),source ?? `export const manifest=${JSON.stringify(manifest)}; export async function register({service}) { ${body} }`);
}

test('workspace package resolves by npm identity and enabled fixture registers frozen metadata and host services', async () => {
 const require=createRequire(path.join(projectRoot,'package.json'));
 const pkg=require('@wydgit/test-library/package.json');assert.equal(pkg.name,'@wydgit/test-library');assert.equal(pkg.version,'1.0.0');
 assert.equal(fs.realpathSync(path.dirname(require.resolve('@wydgit/test-library/package.json'))),path.join(projectRoot,'packages/test-library'));
 const registry=await load();assert.equal(registry.get('wydtest').version,pkg.version);assert.equal(registry.get('wydtest').trust,'canonical');
 assert.deepEqual(registry.capabilities(),[{capability:'test.echo.read',library:'wydtest'}]);
 assert.equal(registry.service('wydtest','echo')('hello'),'hello');
 assert.equal(registry.register,undefined);assert.equal(registry.get('wydtest').register,undefined);
 assert.throws(()=>registry.get('wydtest').capabilities.push('store.records.write'),TypeError);
 assert.throws(()=>registry.list().push({}),TypeError);
 code(()=>registry.service('wydtest','missing'),'LIBRARY.UNKNOWN');code(()=>registry.get('missing'),'LIBRARY.UNKNOWN');
});

test('installed is neither enabled nor required; unconfigured and disabled code is never imported', async t => {
 const root=temp(t);install(root,{source:"throw new Error('must not import');"});
 install(root,{name:'@wydgit/unconfigured',source:"throw new Error('must not scan naming conventions');"});
 assert.deepEqual((await load(config(),root)).list(),[]);
 assert.deepEqual((await load(config(entry({enabled:false})),root)).list(),[]);
 await rejects(()=>load(config(entry()),root),'LIBRARY.IMPORT_FAILED');
 await rejects(()=>load(config(entry({enabled:false})),root,requirements(need())),'LIBRARY.NOT_ENABLED');
 await rejects(()=>load(config(),root,requirements(need())),'LIBRARY.UNKNOWN');
 // Even a missing disabled implementation must never be resolved.
 assert.deepEqual((await load(config(entry({enabled:false,package:'@example/not-present'})),root)).list(),[]);
});

test('config rejects duplicates, paths, builtins, unknown fields, unsafe JSON and unapproved trust before importing', () => {
 code(()=>validateConfig(config(entry(),entry())),'LIBRARY.DUPLICATE');
 code(()=>validateConfig(JSON.stringify(config(entry(),entry()))),'LIBRARY.DUPLICATE');
 for(const packageName of ['../library','/tmp/library','file:///tmp/library','https://example.com/module.js','node:fs','fs','@wydgit/test-library/subpath','@wydgit/test-library@1.0.0'])code(()=>validateConfig(config(entry({package:packageName}))),'LIBRARY.INVALID_CONFIG');
 for(const input of ['{',{},null,[],{schema:'wydgit.host/0.1',libraries:{wydtest:entry()}},config({...entry(),permissions:['*']}),config(entry({enabled:'yes'})),config(entry({version:'garbage'})),JSON.parse('{"schema":"wydgit.host/0.1","libraries":[],"__proto__":{}}')])code(()=>validateConfig(input),'LIBRARY.INVALID_CONFIG');
 code(()=>validateConfig(config(entry({trust:'ordinary'}))),'LIBRARY.UNTRUSTED');
 code(()=>validateConfig(config(entry({publisher:'imposter'}))),'LIBRARY.UNTRUSTED');
 assert.equal(validateConfig(config(entry({enabled:false}))).libraries[0].enabled,false);
});

test('missing packages and failing imports emit structured errors without host paths or stack payloads', async t => {
 const root=temp(t);
 await rejects(()=>load(config(entry()),root),'LIBRARY.NOT_INSTALLED');
 install(root,{source:"throw new Error('/private/host/secrets');"});
 try {await load(config(entry()),root);assert.fail('must fail');} catch(error) {
  assert.deepEqual(error.toJSON(),{ok:false,code:'LIBRARY.IMPORT_FAILED',message:'Configured package could not be imported',details:{}});
  assert.doesNotMatch(JSON.stringify(error),/private|node_modules|stack|wyd-library-/);
 }
});

test('strict descriptors reject wrong schemas, capabilities, services and policy injection', () => {
 for(const change of [m=>m.schema='other',m=>m.capabilities=['*'],m=>m.capabilities=['store.read'],m=>m.capabilities=['store.records.read.extra'],m=>m.version='next',m=>m.platform='banana',m=>m.targets=['native'],m=>m.services.push(m.services[0]),m=>m.services[0].capability='unlisted.action.read',m=>m.capabilities.push('store.records.read'),m=>m.grants=['store.records.write']]) {
  const manifest=structuredClone(fixtureManifest);change(manifest);code(()=>validateManifest(manifest),'LIBRARY.INVALID_MANIFEST');
 }
 let called=false;const m=structuredClone(fixtureManifest);Object.defineProperty(m,'id',{enumerable:true,get(){called=true;throw Error('secret');}});
 code(()=>validateManifest(m),'LIBRARY.INVALID_MANIFEST');assert.equal(called,false);
 code(()=>validateManifest({...fixtureManifest,trust:'ordinary'}),'LIBRARY.UNTRUSTED');
});

test('loader rejects malformed exports and identity mismatch', async t => {
 const root=temp(t);install(root,{source:'export const manifest = {};'});
 await rejects(()=>load(config(entry()),root),'LIBRARY.INVALID_MANIFEST');
 const other=temp(t);install(other,{manifest:{...fixtureManifest,id:'other'}});
 await rejects(()=>load(config(entry()),other),'LIBRARY.IDENTITY_MISMATCH');
});

test('trust comes from host approval, not package claims or naming conventions', async t => {
 const root=temp(t);install(root,{manifest:{...fixtureManifest,trust:'ordinary'}});
 await rejects(()=>load(config(entry()),root),'LIBRARY.UNTRUSTED');
 const approved=temp(t);install(approved,{name:'@acme/runtime',manifest:{...fixtureManifest,id:'acmeservice',publisher:'acme',trust:'approved'}});
 const mapping=entry({id:'acmeservice',package:'@acme/runtime',publisher:'acme',trust:'approved'});
 const registry=await load(config(mapping),approved);assert.equal(registry.get('acmeservice').trust,'approved');
 await rejects(()=>load(config({...mapping,publisher:'wydgit.core',trust:'canonical'}),approved),'LIBRARY.UNTRUSTED');
 const wrong=temp(t);install(wrong,{manifest:{...fixtureManifest,publisher:'other'}});
 await rejects(()=>load(config(entry()),wrong),'LIBRARY.UNTRUSTED');
});

test('package, descriptor, host-approved, platform and target compatibility are independently checked', async t => {
 const mismatch=temp(t);install(mismatch,{manifest:{...fixtureManifest,version:'1.1.0'}});
 await rejects(()=>load(config(entry()),mismatch),'LIBRARY.VERSION_MISMATCH');
 const hostRange=temp(t);install(hostRange,{source:"throw new Error('version must be checked before import');"});
 await rejects(()=>load(config(entry({version:'^2.0.0'})),hostRange),'LIBRARY.VERSION_MISMATCH');
 const platformMismatch=temp(t);install(platformMismatch,{manifest:{...fixtureManifest,platform:'>=9.0.0'}});
 await rejects(()=>load(config(entry()),platformMismatch),'LIBRARY.VERSION_MISMATCH');
 const client=temp(t);install(client,{manifest:{...fixtureManifest,targets:['client']}});
 await rejects(()=>load(config(entry()),client),'LIBRARY.TARGET_MISMATCH');
 const both=temp(t);install(both,{manifest:{...fixtureManifest,targets:['client','server']}});assert.equal((await load(config(entry()),both)).list().length,1);
});

test('requirements are portable, strict and resolved with standard semver prerelease behavior', async t => {
 const registry=await load(config(entry()),projectRoot,requirements(need()));
 assert.equal(registry.resolve(requirements(need('wydtest','>=1 <2')))[0].version,'1.0.0');
 code(()=>registry.resolve(requirements(need('wydtest','^2'))),'LIBRARY.VERSION_MISMATCH');
 code(()=>registry.resolve(requirements(need('wydstore'))),'LIBRARY.UNKNOWN');
 const disabled=await load(config(entry({enabled:false})));code(()=>disabled.resolve(requirements(need())),'LIBRARY.NOT_ENABLED');
 for(const input of [requirements({...need(),package:'@wydgit/test-library'}),requirements(need('@wydgit/store')),requirements(need('wydtest','')),requirements(need('wydtest','latest'))])code(()=>validateRequirements(input),'LIBRARY.INVALID_REQUIREMENTS');
 code(()=>validateRequirements(requirements(need(),need())),'LIBRARY.DUPLICATE');
 const prerelease=temp(t);install(prerelease,{version:'1.1.0-beta.1',manifest:{...fixtureManifest,version:'1.1.0-beta.1'}});
 const beta=await load(config(entry({version:'1.1.0-beta.1'})),prerelease);
 code(()=>beta.resolve(requirements(need('wydtest','^1.0.0'))),'LIBRARY.VERSION_MISMATCH');
 assert.equal(beta.resolve(requirements(need('wydtest','^1.1.0-beta.1'))).length,1);
});

test('duplicate capability providers and requirement mismatches fail before any registration', async t => {
 const root=temp(t);install(root,{body:"throw new Error('must not register');"});
 install(root,{name:'@wydgit/second',manifest:{...fixtureManifest,id:'second'},body:"throw new Error('must not register');"});
 await rejects(()=>load(config(entry(),entry({id:'second',package:'@wydgit/second'})),root),'LIBRARY.DUPLICATE');
 await rejects(()=>load(config(entry()),root,requirements(need('wydtest','^2'))),'LIBRARY.VERSION_MISMATCH');
});

test('registration is narrow, complete, poison-on-error and sealed after success', async t => {
 for(const body of ["throw new Error('/host/private');",'',"service('other',()=>{});","service('echo',42);","service('echo',()=>{});service('echo',()=>{});","try {service('other',()=>{});} catch {} service('echo',()=>{});"]) {
  const root=temp(t);install(root,{body});
  await rejects(()=>load(config(entry()),root),'LIBRARY.REGISTRATION_FAILED');
 }
 const root=temp(t);install(root,{body:"service('echo', () => service('echo', () => 'late'));"});
 const registry=await load(config(entry()),root);code(()=>registry.service('wydtest','echo')(),'LIBRARY.REGISTRATION_FAILED');
 assert.deepEqual(registry.capabilities(),[{capability:'test.echo.read',library:'wydtest'}]);
});

test('loading services never changes execution context grants, visibility, traversal or mutation authority', async () => {
 const context=new ExecutionContext({publisher:'ordinary',self:'object'}),before=JSON.stringify(context);
 const registry=await load();assert.equal(registry.capabilities().length,1);assert.equal(JSON.stringify(context),before);
 code(()=>context.require('test.echo.read'),'SEAM.DENIED');assert.equal(context.allows('object.instances.edit'),false);
 assert.deepEqual(context.visible,['object']);assert.deepEqual(context.traversal,[]);assert.deepEqual(context.editable,[]);
});

test('load order and registry inspection are deterministic regardless of config order', async t => {
 const root=temp(t);install(root);
 install(root,{name:'@acme/second',manifest:{...fixtureManifest,id:'another',capabilities:['test.second.read'],services:[{name:'echo',capability:'test.second.read'}]}});
 const other=entry({id:'another',package:'@acme/second'});
 assert.deepEqual((await load(config(entry(),other),root)).list().map(x=>x.id),['another','wydtest']);
 assert.deepEqual((await load(config(other,entry()),root)).capabilities(),(await load(config(entry(),other),root)).capabilities());
});

test('host initialization fails closed for required infrastructure; demo has no implementation leakage', async t => {
 const root=temp(t);fs.mkdirSync(path.join(root,'content'));
 fs.writeFileSync(path.join(root,'wydgit.config.json'),JSON.stringify(config(entry())));
 fs.writeFileSync(path.join(root,'content/requirements.json'),JSON.stringify(requirements(need())));
 await rejects(()=>initializeHost({root}),'LIBRARY.NOT_INSTALLED');
 await rejects(()=>createHostApp({root}),'LIBRARY.NOT_INSTALLED');
 fs.writeFileSync(path.join(root,'wydgit.config.json'),JSON.stringify(config(entry({enabled:false}))));
 await rejects(()=>initializeHost({root}),'LIBRARY.NOT_ENABLED');
 fs.writeFileSync(path.join(root,'wydgit.config.json'),'{');await rejects(()=>initializeHost({root}),'LIBRARY.INVALID_CONFIG');
 assert.deepEqual((await initializeHost({root:projectRoot})).list(),[]);
 assert.deepEqual((await createHostApp()).locals.libraries.list(),[]);
 const model=loadRepository(projectRoot);assert.doesNotMatch(serialize(model.runtime),/node_modules|@wydgit\/test-library|DivDevHQ|file:\/\//);
 for(const route of ['/','/about/','/contact/'])assert.equal(renderSite(model,route).status,200);
});

test('explicit loading never enumerates node_modules or any directory', async t => {
 // Forbid all directory enumeration APIs while actual package resolution,
 // metadata reads and ESM imports proceed through the real loader.
 const promises=await import('node:fs/promises');
 const forbidden=()=>{assert.fail('library loading must not enumerate directories');};
 for(const name of ['readdir','readdirSync','opendir','opendirSync','glob','globSync']) {
  if(typeof fs[name]==='function')t.mock.method(fs,name,forbidden);
 }
 for(const name of ['readdir','opendir','glob']) {
  if(typeof promises.default[name]==='function')t.mock.method(promises.default,name,forbidden);
 }
 assert.equal((await load()).get('wydtest').id,'wydtest');
});
