// Shared approved-deployment fingerprint, used by provider approval and worker bootstrap.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {snapshotAppConfiguration} from '../engine/inventory.js';
import {clean} from '../engine/object-model/validation.js';
const fail=code=>Object.assign(new Error('Provider operation refused'),{code});
const check=(ok,code)=>{if(!ok)throw fail(code);};
const absolute=v=>typeof v==='string'&&path.isAbsolute(v)&&path.resolve(v)===v&&v!=='/'&&!/[\x00-\x1f\x7f\\]/.test(v)&&!v.split('/').includes('..');
const digest=v=>createHash('sha256').update(JSON.stringify(clean(v))).digest('hex');
// Trusted fixture roots must be inaccessible to hostile concurrent OS writers.
// These checks refuse links; they are not descriptor-relative Linux staging.
export async function safePath(target,{missing=false}={}){
 check(absolute(target),'HOSTING.ROOT');let at=path.parse(target).root;
 for(const part of target.slice(at.length).split(path.sep)){
  at=path.join(at,part);let s;try{s=await fs.lstat(at);}catch(e){if(missing&&e.code==='ENOENT')return false;throw fail('HOSTING.ROOT');}
  check(!s.isSymbolicLink()&&(s.isDirectory()||(at===target&&s.isFile()&&s.nlink===1)),'HOSTING.ROOT');
 }
 return true;
}
export async function fingerprintApprovedApp(root){
 await safePath(root);const entries=[];let count=0,bytes=0;
 async function walk(relative,depth=0){
  check(depth<=32&&++count<=8192,'HOSTING.SNAPSHOT');const file=path.join(root,relative);await safePath(file);const stat=await fs.lstat(file);
  if(stat.isDirectory()){for(const name of (await fs.readdir(file)).sort())await walk(relative+'/'+name,depth+1);}
  else{bytes+=stat.size;check(stat.isFile()&&stat.nlink===1&&stat.size<=16*1024*1024&&bytes<=128*1024*1024,'HOSTING.SNAPSHOT');entries.push([relative,digest((await fs.readFile(file)).toString('base64'))]);}
 }
 for(const relative of ['content','prototypes','public','wydgit.config.json'])await walk(relative);
 return digest({configuration:snapshotAppConfiguration(root),entries});
}
