import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createStores } from '@wydgit/store/client';
import { manifest } from '@wydgit/store';
import { project, context, reject, definition, load, temp, fixture, file } from '../test-support/wydstore.js';
const require=createRequire(path.join(project,'packages/wydstore/package.json'));
const Database=require('better-sqlite3');
const withDb=(location,fn)=>{const db=new Database(location,{fileMustExist:true});try{return fn(db);}finally{db.close();}};

test('SQLite workspace dependency initializes a private versioned database without granting authority',async t=>{
 const {root,registry}=await fixture(t,'sqlite'),location=await file(root,'.sqlite');
 assert.equal(require('better-sqlite3/package.json').version,'13.0.3');
 assert.equal(require('./package.json').dependencies['better-sqlite3'],'13.0.3');
 assert.equal((await fs.stat(location)).mode & 0o777,0o600);
 withDb(location,db=>{assert.equal(db.pragma('user_version',{simple:true}),1);assert.deepEqual(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all().map(r=>r.name),['history','metadata','records']);});
 assert.equal(registry.get('wydstore').version,manifest.version);
 const ctx=context({capabilities:[]});assert.equal((await registry.bind(ctx).call('wydstore','query',{store:'main',collection:'users'})).code,'SEAM.DENIED');assert.deepEqual(ctx.capabilities,[]);
 assert.deepEqual(Object.keys(createStores(registry.bind(context()))),['get']);
});

test('SQLite rejects incompatible schemas, metadata and corrupt state without reinitializing',async t=>{
 const mutations=[
  db=>db.pragma('user_version = 99'),
  db=>db.pragma('user_version = 0'),
  db=>db.prepare('UPDATE metadata SET owner = ?').run(JSON.stringify({app:'another'})),
  db=>db.prepare('UPDATE metadata SET collections = ?').run('{}'),
  db=>db.exec('DROP TABLE history'),
  db=>db.exec('CREATE TABLE unexpected (x TEXT)'),
  db=>db.exec("CREATE TRIGGER unexpected AFTER INSERT ON records BEGIN DELETE FROM records; END"),
  db=>db.prepare('UPDATE records SET data = ?').run('{'),
  db=>db.prepare('UPDATE records SET data = ?').run('{"name":"x","info":{"__proto__":{}}}'),
  db=>db.prepare('DELETE FROM history WHERE version = ?').run(1)
 ];
 for(const mutate of mutations){
  const {root,store,collection}=await fixture(t,'sqlite');const item=collection.create('item',{name:'x'});await item.save();item.set('name','y');await item.save();
  const location=await file(root,'.sqlite');withDb(location,mutate);const before=await fs.readFile(location);
  await reject(()=>load(store),'STORE.CORRUPT');assert.deepEqual(await fs.readFile(location),before);
 }
 for(const content of [Buffer.from('not a database'),Buffer.alloc(0)]){
  const {root,store,collection}=await fixture(t,'sqlite'),location=await file(root,'.sqlite');await fs.writeFile(location,content);
  await reject(()=>load(store),'STORE.CORRUPT');await reject(()=>collection.query(),'STORE.CORRUPT');assert.deepEqual(await fs.readFile(location),content);
 }
});

test('SQLite rejects file/sidecar links and URI configuration; errors reveal no paths or SQL',async t=>{
 for(const suffix of ['', '-journal','-wal','-shm']){
  const {root,collection}=await fixture(t,'sqlite'),location=await file(root,'.sqlite');const outside=path.join(await temp(t),'outside');await fs.writeFile(outside,'untouched');
  if(!suffix)await fs.unlink(location);await fs.symlink(outside,location+suffix);
  await assert.rejects(()=>collection.query(),error=>{assert.equal(error.code,'STORE.CORRUPT');assert.doesNotMatch(JSON.stringify(error.toJSON()),/sqlite|SELECT|outside|\/tmp/);return true;});
  assert.equal(await fs.readFile(outside,'utf8'),'untouched');
 }
 const {root,store,collection}=await fixture(t,'sqlite'),location=await file(root,'.sqlite');await fs.link(location,path.join(root,'alias'));await reject(()=>collection.query(),'STORE.CORRUPT');
 for(const changes of [{root:'file:/tmp/db?mode=memory'},{root:':memory:'},{filename:'/tmp/arbitrary.sqlite'},{connection:'file:/tmp/db'}])await reject(()=>load({...store,...changes}),'STORE.INVALID_CONFIG');
});

test('SQLite rollback preserves current record and history when a write fails after history insertion',async t=>{
 const {collection}=await fixture(t,'sqlite');const item=collection.create('item',{name:'old'});await item.save();item.set('name','new');
 const prepare=Database.prototype.prepare;
 const mocked=t.mock.method(Database.prototype,'prepare',function(sql){
  if(sql.startsWith('UPDATE records SET'))return {run(){throw Object.assign(new Error('UPDATE records /private/data.sqlite'),{code:'SQLITE_IOERR'});}};
  return prepare.call(this,sql);
 });
 await reject(()=>item.save(),'STORE.IO');mocked.mock.restore();
 assert.equal(item.version,1);assert.equal(item.original.name,'old');assert.equal(item.dirty,true);
 assert.equal((await collection.get('item')).get('name'),'old');assert.equal((await collection.history('item')).length,1);
 await item.save();assert.equal(item.version,2);assert.equal((await collection.history('item')).length,2);
});

test('SQLite handles genuine simultaneous process writers with atomic stale update and delete conflicts',async t=>{
 const {store,collection}=await fixture(t,'sqlite');await collection.create('item',{name:'original'}).save();
 async function race(operations){
  const children=operations.map(()=>fork(path.join(project,'test-support/sqlite-writer.js'),[],{stdio:['ignore','pipe','pipe','ipc']}));
  t.after(()=>children.forEach(child=>child.kill()));
  const ready=children.map(child=>once(child,'message'));children.forEach(child=>child.send({store}));
  for(const [message] of await Promise.all(ready))assert.equal(message.ready,true);
  const results=children.map(child=>once(child,'message'));children.forEach((child,i)=>child.send({operation:operations[i],name:`writer${i}`}));
  const messages=(await Promise.all(results)).map(([message])=>message);assert.equal(messages.filter(x=>x.ok).length,1);assert.equal(messages.find(x=>!x.ok).code,'STORE.CONFLICT');
  await Promise.all(children.map(child=>child.exitCode===null?once(child,'exit'):Promise.resolve()));
 }
 await race(['update','update']);assert.equal((await collection.get('item')).version,2);
 await race(['delete','delete']);assert.deepEqual((await collection.history('item')).map(h=>h.version),[1,2,3]);
});

test('SQLite busy errors are sanitized and connections are released after failure',async t=>{
 const {root,collection}=await fixture(t,'sqlite'),location=await file(root,'.sqlite');const db=new Database(location);db.exec('BEGIN IMMEDIATE');
 try{await reject(()=>collection.create('item',{name:'x'}).save(),'STORE.BUSY');}finally{db.exec('ROLLBACK');db.close();}
 await collection.create('item',{name:'x'}).save();assert.equal((await collection.get('item')).version,1);
});

test('one registry hosts JSON and SQLite stores through the same scoped facade',async t=>{
 const root=await temp(t),a={...definition(root,'json'),id:'json-main'},b={...definition(root,'sqlite'),id:'sqlite-main'};
 const registry=await load([a,b]),ctx=context({scopes:{wydstore:[{store:a.id,collection:'users'},{store:b.id,collection:'users'}]}}),stores=createStores(registry.bind(ctx));
 for(const store of [a,b])await stores.get(store.id).collection('users').create('same',{name:store.id}).save();
 assert.equal((await stores.get(a.id).collection('users').get('same')).get('name'),a.id);assert.equal((await stores.get(b.id).collection('users').get('same')).get('name'),b.id);
 for(const allowed of [a,b]){
  const restricted=createStores(registry.bind(context({scopes:{wydstore:[{store:allowed.id,collection:'users'}]}})));
  await restricted.get(allowed.id).collection('users').get('same');await reject(()=>restricted.get(allowed===a?b.id:a.id).collection('users').get('same'),'STORE.DENIED');
 }
 assert.deepEqual(ctx.capabilities,['store.records.read','store.records.create','store.records.write','store.records.delete']);
});

test('SQLite exceeds JSON whole-document capacity while enforcing per-record bounds',async t=>{
 const {collection,root}=await fixture(t,'sqlite');
 for(let i=0;i<9;i++)await collection.create(`record${i}`,{name:'x'.repeat(2*1024*1024)}).save();
 assert.ok((await fs.stat(await file(root,'.sqlite'))).size>16*1024*1024);
 assert.equal((await collection.query({limit:1})).length,1);
 const item=await collection.get('record0');item.set('name','x'.repeat(16*1024*1024));await reject(()=>item.save(),'STORE.LIMIT');assert.equal(item.version,1);
 assert.equal((await collection.history('record0')).length,1);
});

test('SQLite history result safeguard never truncates or discards retained versions',async t=>{
 const {root,collection}=await fixture(t,'sqlite');await collection.create('item',{name:'x'}).save();
 withDb(await file(root,'.sqlite'),db=>db.transaction(()=>{
  const insert=db.prepare('INSERT INTO history (collection,id,version,data) VALUES (?,?,?,?)');
  for(let version=1;version<=10000;version++)insert.run('users','item',version,'{"active":true,"name":"x"}');
  db.prepare('UPDATE records SET version = ? WHERE id = ?').run(10001,'item');
 })());
 await reject(()=>collection.history('item'),'STORE.LIMIT');assert.equal((await collection.get('item')).version,10001);
 withDb(await file(root,'.sqlite'),db=>assert.equal(db.prepare('SELECT count(*) AS count FROM history').get().count,10000));
});

test('SQLite recovers accepted state after process death inside an uncommitted transaction',async t=>{
 const {root,store,collection}=await fixture(t,'sqlite');await collection.create('item',{name:'accepted'}).save();
 const child=fork(path.join(project,'test-support/sqlite-crash-writer.js'),[],{stdio:['ignore','pipe','pipe','ipc']});
 t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
 const ready=once(child,'message');child.send({file:await file(root,'.sqlite')});assert.equal((await ready)[0].ready,true);
 const exited=once(child,'exit');child.kill('SIGKILL');await exited;
 const reopened=createStores((await load(store)).bind(context())).get('main').collection('users');
 const item=await reopened.get('item');assert.equal(item.version,1);assert.equal(item.get('name'),'accepted');assert.equal((await reopened.history('item')).length,1);
 item.set('name','after restart');await item.save();assert.equal(item.version,2);
});
