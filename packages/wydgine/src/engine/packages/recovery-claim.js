// Lamport-style admission for recovery only. Dead claims are ignored; a live
// chooser or an earlier ticket makes this attempt fail BUSY. Thus reclaiming a
// dead recovery marker never races another reclaimer. Kernel death releases
// liveness without deleting another process's lock based on a stale read.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireThat as check } from '../object-model/validation.js';
const live=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}};
export async function claimRecovery(root,id) {
  const directory=path.join(root,'content'),prefix=`.package-recovery-claim-${id}-`,name=prefix+process.pid+'-'+randomUUID()+'.json',mine=path.join(directory,name);
  const h=await fs.open(mine,'wx',0o600);try{await h.writeFile('{"ticket":0}');await h.sync();}finally{await h.close();}
  const claims=async()=>{
    const names=(await fs.readdir(directory)).filter(n=>n.startsWith(prefix)&&n.endsWith('.json'));
    check(names.length<=128,'PACKAGE.BUSY','Too many outstanding recovery claims');
    const entries=[];
    for(const n of names){
      const match=n.slice(prefix.length).match(/^(\d+)-[a-f0-9-]{36}\.json$/);check(match,'PACKAGE.RECOVERY','Unknown recovery claim');
      const pid=Number(match[1]);check(Number.isSafeInteger(pid)&&pid>0,'PACKAGE.RECOVERY','Invalid recovery claimant');
      if(!live(pid))continue;
      let file;
      try{file=await fs.open(path.join(directory,n),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const stat=await file.stat();check(stat.isFile()&&stat.nlink===1&&stat.size<=128,'PACKAGE.RECOVERY','Unsafe recovery claim');const value=JSON.parse(await file.readFile('utf8'));check(Number.isSafeInteger(value.ticket)&&value.ticket>=0,'PACKAGE.RECOVERY','Invalid recovery ticket');entries.push({name:n,ticket:value.ticket});}
      catch(e){if(e.code!=='ENOENT')throw e;}finally{await file?.close();}
    }
    return entries;
  };
  try{
    const first=await claims();check(!first.some(c=>c.name!==name&&c.ticket===0),'PACKAGE.BUSY','Another recovery is choosing its ticket');
    const ticket=Math.max(0,...first.map(c=>c.ticket))+1;check(Number.isSafeInteger(ticket),'PACKAGE.BUSY','Recovery ticket exhausted');
    const temporary=mine+'.tmp',file=await fs.open(temporary,'wx',0o600);try{await file.writeFile(JSON.stringify({ticket}));await file.sync();}finally{await file.close();}await fs.rename(temporary,mine);
    const second=await claims();check(!second.some(c=>c.name!==name&&(c.ticket===0||c.ticket<ticket||c.ticket===ticket&&c.name<name)),'PACKAGE.BUSY','Another recovery holds the earlier ticket');
    // Remove only this operation's dead claimants after gaining admission.
    for(const n of (await fs.readdir(directory)).filter(n=>n.startsWith(prefix)&&n.endsWith('.json'))){const match=n.slice(prefix.length).match(/^(\d+)-[a-f0-9-]{36}\.json$/);if(match&&!live(Number(match[1])))await fs.unlink(path.join(directory,n)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
    return async()=>fs.unlink(mine);
  }catch(e){await fs.unlink(mine).catch(()=>{});throw e;}
}
