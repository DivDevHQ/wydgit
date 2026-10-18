import { readFileSync, existsSync, lstatSync, realpathSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { clean, record, parse, WydgitError, requireThat as check } from '../object-model/validation.js';
import { LIMITS, validatePackageManifest } from './manifest.js';
import { packageGraph } from './graph.js';
import { copyEnvelope } from '../object-model/schema.js';
import { version } from '../libraries/contracts.js';
export const STATE='content/installed-packages.json';
const present=file=>Boolean(lstatSync(file,{throwIfNoEntry:false}));
export const digest=text=>createHash('sha256').update(text).digest('hex');
export function safeRead(root,relative,max=LIMITS.resource) {
  check(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split('/').some(p=>p==='..'||p==='.'||p.startsWith('.')),'PACKAGE.PATH','Unsafe resource path');
  const base=realpathSync(root);let file=base;
  for(const part of relative.split('/')){file=path.join(file,part);check(!lstatSync(file).isSymbolicLink(),'PACKAGE.PATH','Symlink resource denied');}
  const stat=lstatSync(file);check(stat.isFile()&&stat.nlink===1&&stat.size<=max,'PACKAGE.LIMIT','Invalid or oversized resource');
  check(realpathSync(file).startsWith(base+path.sep),'PACKAGE.PATH','Resource escapes root');return readFileSync(file,'utf8');
}
export function baseFingerprint(root,configText) {
  const names=['content/app.json','content/navigation.json','content/requirements.json','wydgit.config.json','prototypes/objects.json'];
  for(const dir of ['content/pages','content/skins','prototypes'])if(existsSync(path.join(root,dir)))for(const file of readdirSync(path.join(root,dir)).sort())if(file.endsWith('.json'))names.push(dir+'/'+file);
  return digest([...new Set(names)].sort().map(name=>name+'\0'+(name==='wydgit.config.json'&&configText!==undefined?configText:safeRead(root,name,LIMITS.state))).join('\0'));
}
export function checkInstallationRecovery(root) {
  check(!present(path.join(root,'content/.package-recovery.lock')),'PACKAGE.RECOVERY','Recovery in progress or interrupted');
  check(!present(path.join(root,'content/.package-install.lock')),'PACKAGE.RECOVERY','Installation in progress or interrupted; inspect the install lock before startup');
  check(!present(path.join(root,'content/.package-infrastructure.json')),'PACKAGE.RECOVERY','Interrupted infrastructure install; recover saved host state before startup');
  if(present(path.join(root,'content/package-effects.json'))){
    const operation=clean(parse(safeRead(root,'content/package-effects.json',LIMITS.state)));
    check(operation.schema==='wydgit.package-effects/1'&&['COMPLETED','ROLLED_BACK'].includes(operation.status),'PACKAGE.RECOVERY','Resource operation is incomplete or unrecognized');
  }
  if(present(path.join(root,'content/package-operation.json'))){
    const operation=clean(parse(safeRead(root,'content/package-operation.json',LIMITS.state)));
    check(operation.schema==='wydgit.package-operation/1'&&['COMPLETED','FAILED'].includes(operation.status),'PACKAGE.RECOVERY','Lifecycle operation is incomplete or unrecognized; inspect recovery records');
  }
}
export function readInstalledState(root) {
  checkInstallationRecovery(root);
  if(!present(path.join(root,STATE)))return null;
  const state=clean(parse(safeRead(root,STATE,LIMITS.state)));
  return validateInstalledState(root,state);
}
export function validateInstalledState(root,state) {
  try {
  check(record(state)&&['wydgit-installed/0.1','wydgit-installed/0.2'].includes(state.schema)&&Array.isArray(state.packages)&&state.packages.length<=LIMITS.packages&&state.packages.every(p=>record(p)&&record(p.manifest))&&Number.isSafeInteger(state.revision)&&state.revision>0,'PACKAGE.CATALOG','Invalid installed state');
  check(state.baseFingerprint===baseFingerprint(root),'PACKAGE.DRIFT','Base repository changed after installation; reconcile accepted state explicitly');
  check(new Set(state.packages.map(p=>p.manifest.id)).size===state.packages.length,'PACKAGE.CATALOG','Duplicate installed package');
  check(typeof state.app==='string','PACKAGE.CATALOG','Missing accepted App');
  check(state.retained===undefined||Array.isArray(state.retained)&&state.retained.length<=LIMITS.packages&&new Set(state.retained.map(r=>r.entry?.manifest?.id)).size===state.retained.length,'PACKAGE.CATALOG','Invalid retained packages');
  for(const retained of state.retained??[])check(record(retained)&&record(retained.entry)&&Array.isArray(retained.attachments)&&retained.attachments.length<=33&&retained.attachments.every(a=>record(a)&&record(a.placement)&&typeof a.instance==='string'&&Buffer.byteLength(a.instance)<=LIMITS.state)&&!state.packages.some(p=>p.manifest.id===retained.entry.manifest.id),'PACKAGE.CATALOG','Invalid retained installation');
  for(const retained of state.retained??[]){
    const roots=[retained.entry.instance,...(retained.entry.additions??[]).map(a=>JSON.parse(a.instance).id)];
    const snapshots=retained.attachments.map(a=>copyEnvelope(parse(a.instance)));
    check(snapshots.length===roots.length&&snapshots.every((n,i)=>n.id===roots[i]),'PACKAGE.CATALOG','Retained attachment identity differs from receipt');
  }
  for(const entry of [...state.packages,...(state.retained??[]).map(r=>r.entry)]){
    const m=validatePackageManifest(entry.manifest);
    check((entry.reason===undefined||['explicit','automatic'].includes(entry.reason))&&(entry.protected===undefined||typeof entry.protected==='boolean'),'PACKAGE.CATALOG','Invalid lifecycle metadata');
    const paths=[m.resources.prototypes,m.resources.template,...Object.values(m.resources.sources)];
    check(entry.resources&&Object.keys(entry.resources).length===paths.length&&paths.every(file=>typeof entry.resources[file]==='string'&&Buffer.byteLength(entry.resources[file])<=LIMITS.resource),'PACKAGE.CATALOG','Invalid catalog resources');
    check(entry.receipt?.schema==='wydgit-install-receipt/0.1'&&entry.receipt.package===m.id&&entry.receipt.version===m.version,'PACKAGE.CATALOG','Invalid receipt');
    check(entry.state==='installed'&&entry.receipt.publisher===m.publisher&&
      ['instance','instanceIds','installable','placement','libraries','approved','storageMappings'].every(key=>
        Object.hasOwn(entry,key)&&Object.hasOwn(entry.receipt,key)&&JSON.stringify(clean(entry[key]))===JSON.stringify(clean(entry.receipt[key])))&&
      JSON.stringify(clean(entry.receipt.bindings))===JSON.stringify(m.bindings),'PACKAGE.CATALOG','Catalog differs from installation receipt');
    check(paths.every(file=>entry.receipt.resources?.[file]?.sha256===digest(entry.resources[file])),'PACKAGE.DRIFT','Installed resource hash differs from receipt');
    for(const key of ['additions','page','navigation','properties','libraryScopes','compiledSources','migrationLineage'])check(Object.hasOwn(entry,key)===Object.hasOwn(entry.receipt,key)&&(!Object.hasOwn(entry,key)||JSON.stringify(clean(entry[key]))===JSON.stringify(clean(entry.receipt[key]))),'PACKAGE.CATALOG','Initial attachment or migration lineage differs from receipt');
    if(entry.migrationLineage!==undefined){
      const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),observed=new Map();
      check(Array.isArray(entry.migrationLineage)&&entry.migrationLineage.length>0&&entry.migrationLineage.length<=32,'PACKAGE.CATALOG','Invalid migration lineage');
      for(const lineage of entry.migrationLineage){
        check(record(lineage)&&Object.keys(lineage).length===4&&lineage.schema==='wydgit.developer-migration-lineage/1'&&hash(lineage.declaration)&&typeof lineage.sourceReceipt==='string'&&lineage.sourceReceipt.length<=128&&Array.isArray(lineage.steps)&&lineage.steps.length>0&&lineage.steps.length<=32,'PACKAGE.CATALOG','Invalid migration lineage envelope');
        for(const step of lineage.steps){
          check(record(step)&&Object.keys(step).length===6&&typeof step.id==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(step.id)&&hash(step.sha256)&&hash(step.sourceArtifact)&&hash(step.targetArtifact)&&version(step.from)&&version(step.to),'PACKAGE.CATALOG','Invalid migration step evidence');
          check(!observed.has(step.id)||observed.get(step.id)===step.sha256,'PACKAGE.DRIFT','Accepted migration step identity changed');observed.set(step.id,step.sha256);
        }
      }
    }
    for(const key of ['reason','protected'])check(Object.hasOwn(entry,key)===Object.hasOwn(entry.receipt,key)&&(!Object.hasOwn(entry,key)||JSON.stringify(entry[key])===JSON.stringify(entry.receipt[key])),'PACKAGE.CATALOG','Lifecycle metadata differs from receipt');
    check(entry.receipt.dependencies===undefined?!Object.keys(m.dependencies??{}).length:JSON.stringify(clean(entry.receipt.dependencies))===JSON.stringify(clean(m.dependencies??{})),'PACKAGE.CATALOG','Dependency receipt drift');
    check(!(m.staticLibraries||m.interfaces)||entry.compiledSources&&Object.keys(entry.compiledSources).length===Object.keys(m.resources.sources).length&&Object.keys(m.resources.sources).every(id=>Object.hasOwn(entry.compiledSources,id)),'PACKAGE.CATALOG','Missing pinned static-library compilation');
    const definitions=JSON.parse(entry.resources[m.resources.prototypes]);
    check(Array.isArray(definitions)&&definitions.length<=LIMITS.prototypes&&definitions.every(d=>d.publisher===m.publisher&&d.id?.startsWith(m.publisher+'/')),'PACKAGE.CATALOG','Invalid catalog prototypes');
  }
  check(state.schema==='wydgit-installed/0.2'||state.manualReplacement===undefined&&state.replacementHistory===undefined,'PACKAGE.CATALOG','Manual lifecycle requires catalog version 0.2');
  if(state.manualReplacement!==undefined) {
    const m=state.manualReplacement,source=state.packages.find(p=>p.manifest.id===m.package),sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
    check(record(m)&&m.schema==='wydgit.manual-replacement/1'&&typeof m.id==='string'&&source?.receipt.id===m.sourceReceipt&&sha(m.sourceCatalog)&&m.sourceApp===digest(state.app)&&['RETIRED','STAGED','REFERENCES_PREPARED'].includes(m.status),'PACKAGE.CATALOG','Invalid pending manual replacement');
    if(m.preview!==undefined){
      const p=m.preview;
      check(m.previewHash===digest(JSON.stringify(clean(p))),'PACKAGE.CATALOG','Manual replacement preview integrity differs');
      check(record(p)&&Array.isArray(p.artifacts)&&p.artifacts.length>0&&p.artifacts.length<=32&&p.artifacts.every(a=>record(a)&&a.manifest?.id===m.package&&a.manifest?.publisher===source.manifest.publisher&&a.sha256===digest(JSON.stringify(clean({manifest:a.manifest,resources:a.resources}))))&&p.artifacts.some(a=>a.sha256===p.candidate)&&record(p.developerRequest)&&p.request===digest(JSON.stringify(clean(p.developerRequest))),'PACKAGE.CATALOG','Staged artifacts or developer request differ from preview');
      for(const a of p.artifacts)validatePackageManifest(a.manifest);
    }
    check(Object.keys(m).every(k=>['schema','id','package','sourceReceipt','sourceCatalog','sourceApp','status','preview','previewHash'].includes(k)),'PACKAGE.CATALOG','Unknown pending replacement field');
    check(m.status==='RETIRED'?m.preview===undefined:record(m.preview)&&m.preview.schema==='wydgit.manual-replacement-preview/1'&&['candidate','request','approvals','targetApp'].every(k=>sha(m.preview[k]))&&Array.isArray(m.preview.resources)&&Array.isArray(m.preview.references)&&m.preview.references.length===source.instanceIds.length&&m.preview.references.every((r,i)=>r.id===source.instanceIds[i]&&typeof r.fromPrototype==='string'&&typeof r.toPrototype==='string')&&record(m.preview.lineage),'PACKAGE.CATALOG','Invalid staged replacement');
  }
  check(state.replacementHistory===undefined||Array.isArray(state.replacementHistory)&&state.replacementHistory.length<=32&&state.replacementHistory.every(h=>record(h)&&h.schema==='wydgit.manual-replacement/1'&&h.status==='ACTIVATED'&&h.sourceInstallation?.id===h.sourceReceipt&&typeof h.targetReceipt==='string'),'PACKAGE.CATALOG','Invalid replacement history');
  for(const h of state.replacementHistory??[]) {
    check(h.sourceInstallationHash===digest(JSON.stringify(clean(h.sourceInstallation)))&&h.previewHash===digest(JSON.stringify(clean(h.preview))),'PACKAGE.CATALOG','Replacement lineage integrity differs');
    check(Array.isArray(h.reservations)&&h.reservations.length<=LIMITS.packages,'PACKAGE.CATALOG','Missing replacement dependency reservations');
    for(const reservation of h.reservations){
      const entry=state.packages.find(p=>p.manifest.id===reservation.package);
      check(entry&&entry.receipt.id===reservation.receipt&&reservation.artifact===digest(JSON.stringify(clean({manifest:entry.manifest,resources:entry.resources}))),'PACKAGE.RESERVED','Replacement recovery dependency reservation changed');
    }
  }
  packageGraph(state.packages);
  return state;
  }catch(error){if(error instanceof WydgitError)throw error;throw new WydgitError('PACKAGE.CATALOG','Invalid installed or retained package record');}
}
export function stateFingerprint(root) {return present(path.join(root,STATE))?digest(safeRead(root,STATE,LIMITS.state)):null;}
