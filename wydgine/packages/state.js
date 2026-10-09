import { readFileSync, existsSync, lstatSync, realpathSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { clean, requireThat as check } from '../object-model/validation.js';
import { LIMITS, validatePackageManifest } from './manifest.js';
export const STATE='content/installed-packages.json';
export const digest=text=>createHash('sha256').update(text).digest('hex');
export function safeRead(root,relative,max=LIMITS.resource) {
  check(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split('/').some(p=>p==='..'||p==='.'||p.startsWith('.')),'PACKAGE.PATH','Unsafe resource path');
  const base=realpathSync(root);let file=base;
  for(const part of relative.split('/')){file=path.join(file,part);check(!lstatSync(file).isSymbolicLink(),'PACKAGE.PATH','Symlink resource denied');}
  const stat=lstatSync(file);check(stat.isFile()&&stat.nlink===1&&stat.size<=max,'PACKAGE.LIMIT','Invalid or oversized resource');
  check(realpathSync(file).startsWith(base+path.sep),'PACKAGE.PATH','Resource escapes root');return readFileSync(file,'utf8');
}
export function baseFingerprint(root) {
  const names=['content/app.json','content/navigation.json','content/requirements.json','wydgit.config.json','prototypes/objects.json'];
  for(const dir of ['content/pages','content/skins','prototypes'])if(existsSync(path.join(root,dir)))for(const file of readdirSync(path.join(root,dir)).sort())if(file.endsWith('.json'))names.push(dir+'/'+file);
  return digest([...new Set(names)].sort().map(name=>name+'\0'+safeRead(root,name,LIMITS.state)).join('\0'));
}
export function readInstalledState(root) {
  if(!existsSync(path.join(root,STATE)))return null;
  const state=clean(JSON.parse(safeRead(root,STATE,LIMITS.state)));
  check(state.schema==='wydgit-installed/0.1'&&Array.isArray(state.packages)&&state.packages.length<=32&&Number.isSafeInteger(state.revision)&&state.revision>0,'PACKAGE.CATALOG','Invalid installed state');
  check(state.baseFingerprint===baseFingerprint(root),'PACKAGE.DRIFT','Base repository changed after installation; reconcile accepted state explicitly');
  check(new Set(state.packages.map(p=>p.manifest.id)).size===state.packages.length,'PACKAGE.CATALOG','Duplicate installed package');
  check(typeof state.app==='string','PACKAGE.CATALOG','Missing accepted App');
  for(const entry of state.packages){
    const m=validatePackageManifest(entry.manifest);
    const paths=[m.resources.prototypes,m.resources.template,...Object.values(m.resources.sources)];
    check(entry.resources&&Object.keys(entry.resources).length===paths.length&&paths.every(file=>typeof entry.resources[file]==='string'&&Buffer.byteLength(entry.resources[file])<=LIMITS.resource),'PACKAGE.CATALOG','Invalid catalog resources');
    check(entry.receipt?.schema==='wydgit-install-receipt/0.1'&&entry.receipt.package===m.id&&entry.receipt.version===m.version,'PACKAGE.CATALOG','Invalid receipt');
    check(paths.every(file=>entry.receipt.resources?.[file]?.sha256===digest(entry.resources[file])),'PACKAGE.DRIFT','Installed resource hash differs from receipt');
    const definitions=JSON.parse(entry.resources[m.resources.prototypes]);
    check(Array.isArray(definitions)&&definitions.length<=LIMITS.prototypes&&definitions.every(d=>d.publisher===m.publisher&&d.id?.startsWith(m.publisher+'/')),'PACKAGE.CATALOG','Invalid catalog prototypes');
  }
  return state;
}
export function stateFingerprint(root) {return existsSync(path.join(root,STATE))?digest(safeRead(root,STATE,LIMITS.state)):null;}
