import {open,lstat,realpath,opendir,rename,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {check,capabilities,FilesError} from './contract.js';
export async function localProvider(root){
 const guard=async()=>{check(typeof root==='string'&&path.isAbsolute(root)&&path.normalize(root)===root&&root!==path.parse(root).root,'FILES.INVALID_CONFIG');let p=path.parse(root).root;for(const s of root.slice(p.length).split(path.sep)){p=path.join(p,s);const i=await lstat(p);check(i.isDirectory()&&!i.isSymbolicLink(),'FILES.STORAGE');}check(await realpath(root)===root,'FILES.STORAGE');};await guard();
 const location=async key=>{check(/^(?:[a-f0-9]{2}){1,120}$/.test(key));await guard();return path.join(root,key);};
 const opened=async key=>{const f=await open(await location(key),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const i=await f.stat();check(i.isFile()&&i.nlink===1,'FILES.STORAGE');return {f,i};}catch(e){await f.close();throw e;}};
 return Object.freeze({capabilities,
 async stat(key){try{const {f,i}=await opened(key);await f.close();return {size:i.size,version:createHash('sha256').update(`${i.ino}-${i.mtimeNs??i.mtimeMs}-${i.size}`).digest('hex')};}catch(e){if(e.code==='ENOENT')throw new FilesError('FILES.NOT_FOUND');throw e;}},
 async inventory(limit){await guard();const items=[];let inspected=0;for await(const e of await opendir(root)){check(++inspected<=limit*2+16,'FILES.LIMIT');if(e.name.startsWith('.upload-'))continue;check(/^(?:[a-f0-9]{2}){1,120}$/.test(e.name),'FILES.STORAGE');items.push({key:e.name,...await this.stat(e.name)});check(items.length<=limit,'FILES.LIMIT');}return items;},
 async read(key,start=0,end){const {f,i}=await opened(key);if(start>i.size){await f.close();throw new FilesError('FILES.RANGE');}return {size:i.size,stream:f.createReadStream({autoClose:true,start,...(end===undefined?{}:{end})}),close:()=>f.close().catch(()=>{})};},
 async write(key,stream,size){const target=await location(key),temp=path.join(root,'.upload-'+randomUUID());let f;try{f=await open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);let count=0;for await(const chunk of stream){count+=chunk.length;check(count<=size,'FILES.LIMIT');let offset=0;while(offset<chunk.length){const r=await f.write(chunk,offset,chunk.length-offset);check(r.bytesWritten>0,'FILES.STORAGE');offset+=r.bytesWritten;}}check(count===size,'FILES.INTERRUPTED');await f.sync();await f.close();f=null;await guard();try{const i=await lstat(target);check(i.isFile()&&!i.isSymbolicLink()&&i.nlink===1,'FILES.STORAGE');}catch(e){if(e.code!=='ENOENT')throw e;}await rename(temp,target);}finally{await f?.close();await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}},
 async delete(key){await this.stat(key);await unlink(await location(key));}
 });
}
