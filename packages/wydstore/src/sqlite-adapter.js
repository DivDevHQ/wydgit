import { budget } from './resource-limits.js';
import Database from 'better-sqlite3';
import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { safeRoot } from './local-root.js';
import { check, StoreError, json, equal } from './data.js';
import { documentContract } from './json-records.js';
import { checkLifecycleLock } from './lifecycle-lock.js';
import { MAX_COLLECTION_RECORDS, snapshot, historical, validateStored, changeRecord, selectRecords, enforceUnique, validateUnique } from './adapter-contract.js';

const MAX_DATA = 16 * 1024 * 1024;
const MAX_HISTORY_RESULT = 10000;
// Fixed platform-owned identifiers and schema, never constructed from input.
const tables = {
  metadata: 'CREATE TABLE metadata (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), owner TEXT NOT NULL, collections TEXT NOT NULL) STRICT',
  records: 'CREATE TABLE records (collection TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version >= 1), data TEXT, deleted INTEGER NOT NULL CHECK(deleted IN (0,1)), PRIMARY KEY(collection,id), CHECK((deleted = 0 AND data IS NOT NULL) OR (deleted = 1 AND data IS NULL))) STRICT',
  history: 'CREATE TABLE history (collection TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version >= 1), data TEXT NOT NULL, PRIMARY KEY(collection,id,version), FOREIGN KEY(collection,id) REFERENCES records(collection,id)) STRICT'
};
const stringify = value => JSON.stringify(json(value));
function parseData(text) {
  check(typeof text === 'string' && Buffer.byteLength(text) <= MAX_DATA, 'STORE.CORRUPT');
  try { return json(JSON.parse(text)); } catch { throw new StoreError('STORE.CORRUPT'); }
}
function providerError(error) {
  if (error instanceof StoreError) return error;
  const code = error?.code ?? '';
  if (code.startsWith('SQLITE_BUSY') || code.startsWith('SQLITE_LOCKED')) return new StoreError('STORE.BUSY');
  if (code === 'SQLITE_FULL' || code === 'SQLITE_TOOBIG') return new StoreError('STORE.LIMIT');
  if (code.startsWith('SQLITE_CORRUPT') || code === 'SQLITE_NOTADB' || code.startsWith('SQLITE_CONSTRAINT') || code === 'SQLITE_ERROR') return new StoreError('STORE.CORRUPT');
  return new StoreError('STORE.IO');
}

export async function openSqliteAdapter(root, owner, definitions, metadata, limits, checkJson, {lifecycle = false, existingOnly = false} = {}) {
  try { await safeRoot(root); } catch { throw new StoreError('STORE.INVALID_CONFIG'); }
  const name = createHash('sha256').update(JSON.stringify(owner)).digest('hex');
  const file = path.join(root, `${name}.sqlite`);
  const persisted = new Map([...definitions].map(([id,fields]) => [id,metadata?.get(id).schemaId ? metadata.get(id) : fields]));
  const collections = Object.fromEntries([...persisted].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0));
  async function inspectFiles(observation) {
    try {
    await safeRoot(root);
    // SQLite owns these sidecars. Reject links before the native driver opens any.
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      let info;
      try { info = await lstat(file + suffix); }
      catch (error) { if (error.code === 'ENOENT' && suffix) continue; if(error.code === 'ENOENT') throw new StoreError('STORE.CORRUPT'); throw error; }
      check(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, 'STORE.CORRUPT');
      check(info.size <= limits.sqliteDatabaseBytes, 'STORE.LIMIT');
    }
    } finally { observation?.complete(); }
  }
  function validateMetadata(db) {
    check(db.pragma('user_version', {simple:true}) === 1, 'STORE.CORRUPT');
    check(db.pragma('journal_mode', {simple:true}) === 'delete' && db.pragma('page_size', {simple:true}) === 4096, 'STORE.CORRUPT');
    const objects = db.prepare('SELECT name, type, sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name').all();
    check(objects.length === 3 && objects.every(row => row.type === 'table' && Object.hasOwn(tables,row.name) && row.sql === tables[row.name]), 'STORE.CORRUPT');
    const rows = db.prepare('SELECT singleton, owner, collections FROM metadata').all();
    check(rows.length === 1 && rows[0].singleton === 1 && equal(parseData(rows[0].owner),owner), 'STORE.CORRUPT');
    check(equal(parseData(rows[0].collections),collections),[...metadata.values()].some(item => item.schemaId) ? 'STORE.SCHEMA_INCOMPATIBLE' : 'STORE.CORRUPT');
  }
  function decode(row) {
    if (!row) return undefined;
    check(definitions.has(row.collection) && [0,1].includes(row.deleted), 'STORE.CORRUPT');
    const entry = {id:row.id, version:row.version, deleted:row.deleted === 1, data:row.data === null ? null : parseData(row.data)};
    try { validateStored(entry, definitions.get(row.collection)); }
    catch { throw new StoreError('STORE.CORRUPT'); }
    entry.encodedData=row.data;
    return entry;
  }
  function historyRows(db, collection, entry, includeValues, addResult) {
    const count = db.prepare('SELECT count(*) AS count, min(version) AS first, max(version) AS last FROM history WHERE collection = ? AND id = ?').get(collection,entry.id);
    check(count.count === entry.version - 1 && (count.count === 0 || count.first === 1 && count.last === entry.version - 1), 'STORE.CORRUPT');
    if (!includeValues) return;
    check(entry.version <= MAX_HISTORY_RESULT, 'STORE.LIMIT');
    const result = [];
    let bytes = 0;
    for (const row of db.prepare('SELECT collection,id,version,data,0 AS deleted FROM history WHERE collection = ? AND id = ? ORDER BY version').iterate(collection,entry.id)) {
      bytes += Buffer.byteLength(row.data);
      check(bytes <= limits.historyDataBytes, 'STORE.LIMIT');
      const value=historical(decode(row));addResult(value);result.push(value);
    }
    bytes += Buffer.byteLength(entry.encodedData ?? 'null');
    check(bytes <= limits.historyDataBytes, 'STORE.LIMIT');
    const current=historical(entry);addResult(current);result.push(current);
    return result;
  }
  function validateAll(db) {
    check(db.pragma('quick_check', {simple:true}) === 'ok', 'STORE.CORRUPT');
    check(db.pragma('foreign_key_check').length === 0, 'STORE.CORRUPT');
    const counts = new Map();
    for (const row of db.prepare('SELECT collection,id,version,data,deleted FROM records').iterate()) {
      const entry = decode(row);
      counts.set(row.collection,(counts.get(row.collection) ?? 0) + 1);
      check(counts.get(row.collection) <= MAX_COLLECTION_RECORDS, 'STORE.LIMIT');
      historyRows(db,row.collection,entry,false);
    }
    for (const [collection,fields] of definitions) validateUnique(db.prepare('SELECT collection,id,version,data,deleted FROM records WHERE collection = ?').all(collection).map(decode),fields);
    for (const row of db.prepare('SELECT collection,id,version,data,0 AS deleted FROM history').iterate()) decode(row);
  }
  function execute(db, operation, request) {
    if (operation === '$checkpoint') {
      validateAll(db);
      const document = documentContract(owner,definitions,metadata).initial;
      for (const row of db.prepare('SELECT collection,id,version,data,deleted FROM records ORDER BY collection,id').all()) {
        const entry = decode(row);
        const history = db.prepare('SELECT version,data FROM history WHERE collection = ? AND id = ? ORDER BY version').all(row.collection,row.id).map(h=>({version:h.version,data:parseData(h.data),deleted:false}));
        document.collections[row.collection].records.push({id:entry.id,version:entry.version,data:entry.data,deleted:entry.deleted,history});
      }
      checkJson(document,{maxBytes:limits.sqliteDatabaseBytes,maxDepth:64,maxNodes:Number.MAX_SAFE_INTEGER});
      return json(document);
    }
    if (operation === '$replace') {
      const {document,collections:target} = request;
      const contract = documentContract(owner,new Map(target.map(c=>[c.id,c.fields])),new Map(target.map(c=>[c.id,c])));
      contract.validate(document);
      db.prepare('DELETE FROM history').run();
      db.prepare('DELETE FROM records').run();
      const persisted = Object.fromEntries([...target].sort((a,b)=>a.id<b.id?-1:1).map(c=>[c.id,c.schemaId?c:c.fields]));
      db.prepare('UPDATE metadata SET collections = ? WHERE singleton = 1').run(stringify(persisted));
      for (const [collection,value] of Object.entries(document.collections)) for (const entry of value.records) {
        db.prepare('INSERT INTO records (collection,id,version,data,deleted) VALUES (?,?,?,?,?)').run(collection,entry.id,entry.version,entry.deleted?null:stringify(entry.data),Number(entry.deleted));
        for (const h of entry.history) db.prepare('INSERT INTO history (collection,id,version,data) VALUES (?,?,?,?)').run(collection,entry.id,h.version,stringify(h.data));
      }
      return null;
    }
    if (['query','count'].includes(operation)) {
      const rows=db.prepare('SELECT collection,id,version,data,deleted FROM records WHERE collection = ? ORDER BY id COLLATE BINARY').iterate(request.collection);
      try {
        function* decoded(){for(const row of rows)yield decode(row);}
        const result=selectRecords(decoded(),request,operation === 'count',true);
        if(operation==='query')checkJson(result,budget(limits,limits.queryResultBytes),'STORE.LIMIT');
        return result;
      } finally {rows.return();}
    }
    const entry = decode(db.prepare('SELECT collection,id,version,data,deleted FROM records WHERE collection = ? AND id = ?').get(request.collection,request.id));
    if (entry) historyRows(db,request.collection,entry,false);
    if (operation === 'get' || operation === 'history') {
      check(entry && (operation === 'history' || !entry.deleted), 'STORE.NOT_FOUND');
      return operation === 'get' ? snapshot(entry) : historyRows(db,request.collection,entry,true,request.addHistoryResult);
    }
    const next = changeRecord(operation,request,entry);
    if (next && ['create','update'].includes(operation) && Object.values(request.definitions).some(rule=>rule.unique)) enforceUnique(db.prepare('SELECT collection,id,version,data,deleted FROM records WHERE collection = ?').all(request.collection).map(decode),request,request.definitions);
    if (!next) return snapshot(entry);
    const data = next.deleted ? null : request.encodedData;
    check(data === null || Buffer.byteLength(data) <= limits.recordBytes, 'STORE.LIMIT');
    if (operation === 'create') {
      const {count} = db.prepare('SELECT count(*) AS count FROM records WHERE collection = ?').get(request.collection);
      check(count < MAX_COLLECTION_RECORDS, 'STORE.LIMIT');
      db.prepare('INSERT INTO records (collection,id,version,data,deleted) VALUES (?,?,?,?,?)').run(request.collection,next.id,next.version,data,0);
    } else {
      db.prepare('INSERT INTO history (collection,id,version,data) VALUES (?,?,?,?)').run(request.collection,entry.id,entry.version,entry.encodedData);
      const {changes} = db.prepare('UPDATE records SET version = ?, data = ?, deleted = ? WHERE collection = ? AND id = ? AND version = ? AND deleted = 0').run(next.version,data,Number(next.deleted),request.collection,next.id,entry.version);
      check(changes === 1, 'STORE.CONFLICT');
    }
    return next.deleted ? {id:next.id, version:next.version, deleted:true} : snapshot(next);
  }
  async function transaction(operation, request, initialize = false, completion) {
    let db,worked;const preflight=completion?.stage?.('sqlitePreflight');
    const observation=completion?.continuation?.('sqliteInspectFiles');
    try {
      observation?.start();
      const inspection=inspectFiles(observation);
      observation?.awaiting();
      try { await inspection; } finally { observation?.resume(); }
      const lifecycleStage=completion?.stage?.('sqliteLifecycle');
      try { await checkLifecycleLock(root,name,lifecycle,completion); } finally { lifecycleStage?.(); }
      completion?.check();
      preflight?.();worked=completion?.stage?.('sqliteTransaction');
      db = new Database(file, {fileMustExist:true, timeout:1000});
      db.pragma('trusted_schema = OFF');
      db.pragma('foreign_keys = ON');
      db.pragma('synchronous = FULL');
      const run = db.transaction(() => {
        validateMetadata(db);
        if (initialize) { validateAll(db); return null; }
        // This fixed provider ceiling is independent of JSON's document limit.
        check(db.pragma(`max_page_count = ${limits.sqliteDatabaseBytes/4096}`,{simple:true}) <= limits.sqliteDatabaseBytes/4096,'STORE.LIMIT');
        const result=operation==='transaction' ? request.operations.map(item=>{
          const value=execute(db,item.operation,item.request);request.addResult(value);return value;
        }) : execute(db,operation,request);
        if(!operation.startsWith('$') && operation!=='transaction')request.checkResult(result);
        // Throwing here rolls back the entire synchronous transaction. After
        // return the native COMMIT cannot be interrupted by a JavaScript timer.
        try{completion?.check();}catch(error){completion?.cancelled();throw error;}
        return result;
      });
      if(initialize || ['get','query','count','history','$checkpoint'].includes(operation))return run.deferred();
      completion?.begin();
      let value;
      value=run.immediate();
      completion?.committed();return value;
    } catch (error) { throw providerError(error); }
    finally {try{if (db) { try { db.close(); } catch { throw new StoreError('STORE.IO'); } }}finally{preflight?.();worked?.();}}
  }
  // Only a newly, exclusively created file may be initialized. An existing empty
  // or incompatible database is never silently reinitialized.
  let created = false, handle;
  try {
    await checkLifecycleLock(root,name,lifecycle);
    if (!existingOnly) {
    try {
      handle = await open(file,constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,0o600);
      created = true;
    } catch(error) { if(error.code !== 'EEXIST') throw error; }
    finally { await handle?.close(); }
    }
    if (created) {
      await inspectFiles();
      const db = new Database(file,{fileMustExist:true,timeout:1000});
      try {
        db.pragma('trusted_schema = OFF');
        db.pragma('page_size = 4096');
        db.pragma(`max_page_count = ${limits.sqliteDatabaseBytes/4096}`);
        db.transaction(() => {
          for (const ddl of Object.values(tables)) db.exec(ddl);
          db.prepare('INSERT INTO metadata (singleton,owner,collections) VALUES (?,?,?)').run(1,stringify(owner),stringify(collections));
          db.pragma('user_version = 1');
        }).immediate();
      } finally { db.close(); }
    }
    await transaction(null,null,true);
  } catch (error) { throw providerError(error); }
  return Object.freeze({
    checkpoint() { return transaction('$checkpoint',null); },
    replace(document,collections) { return transaction('$replace',{document,collections}); },
    execute(operation,request,completion) { return transaction(operation,request,false,completion); }
  });
}
