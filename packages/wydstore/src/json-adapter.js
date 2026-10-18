import { budget } from './resource-limits.js';
import { safeRoot } from './local-root.js';
import { documentContract, applyOperation } from './json-records.js';
import { open, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { check, StoreError, json } from './data.js';
import { checkLifecycleLock } from './lifecycle-lock.js';

// Serialize cooperating handles in this process; an exclusive local lock file
// prevents another process from overlapping a read-modify-rename operation.
const queues = new Map();
const safeIO = error => error instanceof StoreError ? error : new StoreError('STORE.IO');
export async function openJsonAdapter(root, owner, definitions, metadata, limits, checkJson, {lifecycle = false, existingOnly = false, lifecycleId} = {}) {
  try { await safeRoot(root); } catch (error) { throw error instanceof StoreError ? error : new StoreError('STORE.INVALID_CONFIG'); }
  const { initial, validate } = documentContract(owner,definitions,metadata);
  const name = createHash('sha256').update(JSON.stringify(owner)).digest('hex');
  const file = path.join(root, `${name}.json`), lock = path.join(root, `${name}.lock`);
  async function read() {
    let handle;
    try {
      handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const info = await handle.stat(); check(info.isFile() && info.nlink === 1,'STORE.CORRUPT');
      check(info.size <= limits.jsonDocumentBytes,'STORE.LIMIT');
      let data;
      try { data = JSON.parse(await handle.readFile('utf8'));
        checkJson(data,{maxBytes:limits.jsonDocumentBytes,maxDepth:64,maxNodes:Number.MAX_SAFE_INTEGER});
        validate(data); }
      catch (error) { if (error.code === 'STORE.SCHEMA_INCOMPATIBLE') throw error; throw new StoreError('STORE.CORRUPT'); }
      return data;
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    finally { await handle?.close(); }
  }
  async function write(data, completion, validator = validate) {
    // Retain the legacy whole-document depth limit without cloning the document.
    checkJson(data,{maxBytes:limits.jsonDocumentBytes,maxDepth:64,maxNodes:Number.MAX_SAFE_INTEGER});
    validator(data);
    const text = JSON.stringify(data); check(Buffer.byteLength(text) <= limits.jsonDocumentBytes,'STORE.LIMIT');
    const temporary = path.join(root, `${name}.${lifecycleId ?? randomUUID()}.tmp`);
    let handle;
    try {
      handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      await handle.writeFile(text); await handle.sync(); await handle.close(); handle = null;
      await safeRoot(root);
      completion?.begin();
      await rename(temporary, file);
      const directory=await open(root,constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try{await directory.sync();}finally{await directory.close();}
      completion?.committed();
    } finally {
      await handle?.close();
      await unlink(temporary).catch(error => { if(error.code !== 'ENOENT') throw error; });
    }
  }
  async function transaction(operation, initialize = false, completion) {
    const previous = queues.get(file) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      let lockHandle;
      try {
        completion?.check();
        await safeRoot(root);
        await checkLifecycleLock(root,name,lifecycle);
        try { if(!lifecycle)lockHandle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
        catch(error) { if(error.code === 'EEXIST') throw new StoreError('STORE.BUSY'); throw error; }
        let data = await read();
        if (data === null) { check(initialize, 'STORE.CORRUPT'); data = json(initial); await write(data); }
        completion?.check();
        const result = operation(data);
        if (result.changed) await write(result.document ?? data,completion,result.validate);
        return result.value;
      } catch (error) { throw safeIO(error); }
      finally { if(lockHandle) { await lockHandle.close(); await unlink(lock).catch(() => {}); } }
    });
    queues.set(file,next);
    try { return await next; } finally { if(queues.get(file) === next) queues.delete(file); }
  }
  await transaction(() => ({changed:false,value:null}), !existingOnly);
  const checkOperation=(operation,value)=>{
    if(operation==='query')checkJson(value,budget(limits,limits.queryResultBytes),'STORE.LIMIT');
    if(operation==='history'){
      let bytes=0;
      for(const entry of value){bytes+=checkJson(entry.data,budget(limits,limits.historyDataBytes),'STORE.LIMIT').bytes;check(bytes<=limits.historyDataBytes,'STORE.LIMIT');}
    }
  };
  return Object.freeze({
    checkpoint() { return transaction(document => ({changed:false,value:json(document)})); },
    replace(document, collections) {
      const target = documentContract(owner,new Map(collections.map(c=>[c.id,c.fields])),new Map(collections.map(c=>[c.id,c])));
      target.validate(document);
      return transaction(() => ({changed:true,value:null,document:json(document),validate:target.validate}));
    },
    execute(operation, request, completion) { return transaction(document => {
      if (operation !== 'transaction') {
        const result=applyOperation(document,operation,request);
        checkOperation(operation,result.value);
        request.checkResult(result.value);return result;
      }
      const results=request.operations.map(item => {
        const result=applyOperation(document,item.operation,item.request);
        checkOperation(item.operation,result.value);
        request.addResult(result.value);
        return result;
      });
      return {changed:results.some(item => item.changed),value:results.map(item => item.value)};
    },false,completion); } });
}
