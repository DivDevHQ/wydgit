import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ensure,error,readLocal} from './config.js';

// Each file is atomically replaced; a two-file setup is not a transaction.
// Preflight both revisions, retain exact private backups and report partial failure.
export async function persistFiles(changes){
 const lockFile=path.join(path.dirname(changes[0].file),'.wydgine-setup.lock');let lock;
 try{lock=await fs.open(lockFile,'wx',0o600);}catch{throw error('LAUNCH.CONFLICT','Setup is locked; verify no setup process is active before removing .wydgine-setup.lock');}
 try{return await replaceFiles(changes);}finally{await lock.close();await fs.unlink(lockFile);}
}
async function replaceFiles(changes){
 const backups=[];let replaced=0;
 for(const change of changes)ensure(await readLocal(change.file,{optional:true})===change.before,'LAUNCH.CONFLICT','Files changed since review; run setup again');
 try{
  for(const change of changes){
   const temporary=path.join(path.dirname(change.file),'.wydgine-'+randomUUID()+'.tmp');let handle;
   try{
    handle=await fs.open(temporary,'wx',0o600);await handle.writeFile(change.after);await handle.sync();await handle.close();handle=null;
    ensure(await readLocal(change.file,{optional:true})===change.before,'LAUNCH.CONFLICT','Files changed since review; run setup again');
    if(change.before!==null){const backup=change.file+'.backup-'+randomUUID();const b=await fs.open(backup,'wx',0o600);try{await b.writeFile(change.before);await b.sync();}finally{await b.close();}backups.push(backup);}
    await fs.rename(temporary,change.file);
    replaced++;
    const directory=await fs.open(path.dirname(change.file),'r');try{await directory.sync();}finally{await directory.close();}
   }finally{await handle?.close();await fs.rm(temporary,{force:true});}
  }
  return backups;
 }catch(e){if(e.code==='LAUNCH.CONFLICT'&&replaced===0)throw e;throw error('LAUNCH.SAVE_FAILED','Setup save incomplete; inspect configuration and package.json, restore .backup-* files if needed, then rerun setup');}
}
