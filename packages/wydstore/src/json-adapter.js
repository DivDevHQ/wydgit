import { safeRoot } from './local-root.js';
import { documentContract, applyOperation } from './json-records.js';
import { open, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { check, StoreError, json } from './data.js';

// Serialize cooperating handles in this process; an exclusive local lock file
// prevents another process from overlapping a read-modify-rename operation.
const queues = new Map();
const safeIO = error => error instanceof StoreError ? error : new StoreError('STORE.IO');
export async function openJsonAdapter(root, owner, definitions) {
  try { await safeRoot(root); } catch (error) { throw error instanceof StoreError ? error : new StoreError('STORE.INVALID_CONFIG'); }
  const { initial, validate } = documentContract(owner,definitions);
  const name = createHash('sha256').update(JSON.stringify(owner)).digest('hex');
  const file = path.join(root, `${name}.json`), lock = path.join(root, `${name}.lock`);
  async function read() {
    let handle;
    try {
      handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const info = await handle.stat(); check(info.isFile() && info.nlink === 1 && info.size <= 16 * 1024 * 1024,'STORE.CORRUPT');
      let data;
      try { data = json(JSON.parse(await handle.readFile('utf8'))); validate(data); }
      catch { throw new StoreError('STORE.CORRUPT'); }
      return data;
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    finally { await handle?.close(); }
  }
  async function write(data) {
    validate(data);
    const text = JSON.stringify(json(data)); check(Buffer.byteLength(text) <= 16 * 1024 * 1024,'STORE.LIMIT');
    const temporary = path.join(root, `${name}.${randomUUID()}.tmp`);
    let handle;
    try {
      handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      await handle.writeFile(text); await handle.sync(); await handle.close(); handle = null;
      await safeRoot(root);
      await rename(temporary, file);
    } finally {
      await handle?.close();
      await unlink(temporary).catch(error => { if(error.code !== 'ENOENT') throw error; });
    }
  }
  async function transaction(operation, initialize = false) {
    const previous = queues.get(file) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      let lockHandle;
      try {
        await safeRoot(root);
        try { lockHandle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
        catch(error) { if(error.code === 'EEXIST') throw new StoreError('STORE.BUSY'); throw error; }
        let data = await read();
        if (data === null) { check(initialize, 'STORE.CORRUPT'); data = json(initial); await write(data); }
        const result = operation(data);
        if (result.changed) await write(data);
        return json(result.value);
      } catch (error) { throw safeIO(error); }
      finally { if(lockHandle) { await lockHandle.close(); await unlink(lock).catch(() => {}); } }
    });
    queues.set(file,next);
    try { return await next; } finally { if(queues.get(file) === next) queues.delete(file); }
  }
  await transaction(() => ({changed:false,value:null}), true);
  return Object.freeze({ execute(operation, request) { return transaction(document => applyOperation(document,operation,request)); } });
}
