// Trusted stopped-App adapter contract. Deliberately absent from package exports
// and from the library dispatcher: package code has no lifecycle operation.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { safeRoot } from './local-root.js';
import { validateStoreConfig } from './core.js';
import { check, json, equal } from './data.js';
import { documentContract } from './json-records.js';
import { storeLimits } from './resource-limits.js';

export const storeOwner = definition => ({app:definition.app,publisher:definition.publisher,package:definition.package,store:definition.id,...Object.fromEntries(['principal','installation'].filter(k=>definition[k]!==undefined).map(k=>[k,definition[k]]))});
export const storeName = definition => createHash('sha256').update(JSON.stringify(storeOwner(definition))).digest('hex');
export const storeFile = definition => path.join(definition.root,storeName(definition)+(definition.provider==='json'?'.json':'.sqlite'));
const canonicalHash = value => createHash('sha256').update(JSON.stringify(json(value))).digest('hex');
export const checkpointHash = value => value === null ? null : canonicalHash(value);
const metadata = d => new Map(d.collections.map(c=>[c.id,c]));
export const emptyStore = definition => documentContract(storeOwner(definition),new Map(definition.collections.map(c=>[c.id,c.fields])),metadata(definition)).initial;
function checkJson(value,limits) {
  // Host checkpoints have an additional, smaller aggregate journal ceiling.
  check(Buffer.byteLength(JSON.stringify(json(value)))<=Math.min(limits.maxBytes,4*1024*1024),'STORE.LIMIT');
  return {bytes:Buffer.byteLength(JSON.stringify(value))};
}
async function stat(file) { return fs.lstat(file).catch(e=>{if(e.code!=='ENOENT')throw e;return null;}); }
async function safeFile(file) {const info=await stat(file);check(!info||info.isFile()&&!info.isSymbolicLink()&&info.nlink===1,'STORE.CORRUPT');return info;}
export async function syncStoreDirectory(root) {const h=await fs.open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await h.sync();}finally{await h.close();}}
async function adapter(definition,existingOnly=true,lifecycleId) {
  validateStoreConfig({stores:[definition]});
  const open=definition.provider==='json'?(await import('./json-adapter.js')).openJsonAdapter:(await import('./sqlite-adapter.js')).openSqliteAdapter;
  return open(definition.root,storeOwner(definition),new Map(definition.collections.map(c=>[c.id,c.fields])),metadata(definition),storeLimits(definition.limits),checkJson,{lifecycle:true,existingOnly,lifecycleId});
}
export async function snapshotStore(definition) {
  validateStoreConfig({stores:[definition]});await safeRoot(definition.root);
  const info=await safeFile(storeFile(definition));if(!info)return null;
  return json(await (await adapter(definition)).checkpoint());
}
export async function lockStore(definition,id) {
  await safeRoot(definition.root);
  const file=path.join(definition.root,storeName(definition)+'.lifecycle'),text=JSON.stringify({schema:'wydstore.lifecycle-lock/1',id});
  try {const h=await fs.open(file,'wx',0o600);try{await h.writeFile(text);await h.sync();}finally{await h.close();}await syncStoreDirectory(definition.root);}
  catch(e){if(e.code!=='EEXIST')throw e;const info=await safeFile(file);check(info&&info.size<=1024,'STORE.BUSY');check(await fs.readFile(file,'utf8')===text,'STORE.BUSY');}
  check(!await stat(path.join(definition.root,storeName(definition)+'.lock')),'STORE.BUSY');
}
export async function unlockStore(definition,id) {
  const file=path.join(definition.root,storeName(definition)+'.lifecycle');
  if(!await safeFile(file))return;
  check(await fs.readFile(file,'utf8')===JSON.stringify({schema:'wydstore.lifecycle-lock/1',id}),'STORE.BUSY');
  await fs.unlink(file);await syncStoreDirectory(definition.root);
}

// Replace an entire owned store, retaining all history. The caller holds its
// durable barrier and has already compared the checkpoint under that barrier.
export async function discardStoreTemporary(definition,id) {
  if(definition.provider!=='json')return;
  check(/^[a-f0-9-]{36}$/.test(id),'STORE.CORRUPT');
  const file=path.join(definition.root,storeName(definition)+'.'+id+'.tmp');
  if(await safeFile(file)){await fs.unlink(file);await syncStoreDirectory(definition.root);}
}
async function discardScratch(definition,id) {
  const scratch=path.join(definition.root,`.package-store-${id}-${definition.id}`);
  if(!await stat(scratch))return;
  await safeRoot(scratch);const name=path.basename(storeFile(definition));
  for(const entry of await fs.readdir(scratch)) {
    check([name,name+'-journal',name+'-wal',name+'-shm',storeName(definition)+'.lock'].includes(entry)||new RegExp('^'+storeName(definition)+'\\.[a-f0-9-]{36}\\.tmp$').test(entry),'STORE.CORRUPT');
    await safeFile(path.join(scratch,entry));await fs.unlink(path.join(scratch,entry));
  }
  await fs.rmdir(scratch);await syncStoreDirectory(definition.root);
}
export async function replaceStore(beforeDefinition,afterDefinition,document,id,atStage) {
  const definition=afterDefinition??beforeDefinition;
  check(/^[a-f0-9-]{36}$/.test(id),'STORE.CORRUPT');
  validateStoreConfig({stores:[definition]});
  if(beforeDefinition&&afterDefinition)check(equal(storeOwner(beforeDefinition),storeOwner(afterDefinition))&&beforeDefinition.root===afterDefinition.root&&beforeDefinition.provider===afterDefinition.provider,'STORE.DENIED');
  await safeRoot(definition.root);
  if(document===null) {
    // No directory deletion. Unknown files and SQLite sidecars are never swept.
    for(const suffix of ['-journal','-wal','-shm'])check(!await stat(storeFile(definition)+suffix),'STORE.BUSY');
    if(await safeFile(storeFile(definition)))await fs.unlink(storeFile(definition));
    await discardStoreTemporary(definition,id);await discardScratch(definition,id);await syncStoreDirectory(definition.root);return;
  }
  if(await safeFile(storeFile(definition))) {
    await discardStoreTemporary(definition,id);
    await (await adapter(beforeDefinition??afterDefinition,true,id)).replace(document,afterDefinition.collections);
    return;
  }
  // Initialize privately; a process killed inside native schema creation cannot
  // leave an accepted, empty database. Only this operation's unexposed scratch
  // file can be rebuilt on retry. Unknown files/links veto the retry.
  const scratch=path.join(definition.root,`.package-store-${id}-${definition.id}`);
  await fs.mkdir(scratch,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
  await safeRoot(scratch);
  const staged={...definition,root:scratch},name=path.basename(storeFile(staged));
  for(const entry of await fs.readdir(scratch)) {
    check([name,name+'-journal',name+'-wal',name+'-shm',storeName(staged)+'.lock'].includes(entry)||new RegExp('^'+storeName(staged)+'\\.[a-f0-9-]{36}\\.tmp$').test(entry),'STORE.CORRUPT');
    await safeFile(path.join(scratch,entry));await fs.unlink(path.join(scratch,entry));
  }
  const opened=await adapter(staged,false,id);await atStage?.('STORE_SCHEMA');await opened.replace(document,definition.collections);
  check(equal(await opened.checkpoint(),document),'STORE.CORRUPT');
  const h=await fs.open(storeFile(staged),'r');try{await h.sync();}finally{await h.close();}
  await atStage?.('STORE_STAGED');
  await fs.rename(storeFile(staged),storeFile(definition));await syncStoreDirectory(definition.root);
  await fs.rmdir(scratch);await syncStoreDirectory(definition.root);
}
