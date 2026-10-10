// Fault-injection process: die after native writes but before transaction commit.
import Database from 'better-sqlite3';
process.once('message',({file})=>{
 const db=new Database(file,{fileMustExist:true});
 db.exec('BEGIN IMMEDIATE');
 db.prepare('INSERT INTO history (collection,id,version,data) SELECT collection,id,version,data FROM records WHERE id = ?').run('item');
 db.prepare('UPDATE records SET version = 2, data = ? WHERE id = ?').run('{"active":true,"name":"uncommitted"}','item');
 process.send({ready:true});
});
