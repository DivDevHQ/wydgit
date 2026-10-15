import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { requireThat as check, WydgitError } from '../object-model/validation.js';
const resources=new WeakMap();
// Host-only catalog. No package-facing paths or generic filesystem API.
export async function fileCatalog(root,entries) {
  check(path.isAbsolute(root)&&await realpath(root)===root,'FILE.INVALID','Invalid approved root');
  const approved=new Map();
  for(const entry of entries) {
    check(/^[A-Za-z][\w-]*$/.test(entry.id)&&!approved.has(entry.id)&&typeof entry.file==='string'&&!path.isAbsolute(entry.file)&&entry.file.split(/[\\/]/).every(x=>x&&x!=='.'&&x!=='..'),'FILE.INVALID','Invalid file mapping');
    const filename=path.join(root,entry.file);check(await realpath(filename)===filename,'FILE.INVALID','File link denied');approved.set(entry.id,{filename,type:entry.type??'application/octet-stream'});
  }
  let active=true;
  return Object.freeze({get(id,context,guard=()=>{}){
    guard();context.require('files.resources.read');check(active&&context.scopes.files?.includes(id)&&approved.has(id),'FILE.DENIED','File denied');
    const handle=Object.freeze({get id(){guard();check(active,'FILE.DENIED','Stale file handle');return id;}});resources.set(handle,{...approved.get(id),context,guard,valid:()=>active});return handle;
  },close(){active=false;}});
}
export async function openResource(handle,context) {
  const resource=resources.get(handle);check(resource&&resource.context===context&&resource.valid(),'FILE.DENIED','Invalid file handle');resource.guard();context.require('files.resources.read');
  check(context.scopes.files?.includes(handle.id),'FILE.DENIED','File denied');let file;
  try {
    check(await realpath(resource.filename)===resource.filename,'FILE.DENIED','File link denied');
    file=await open(resource.filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const stat=await file.stat();
    check(stat.isFile()&&stat.nlink===1&&stat.size<=16*1024*1024,'FILE.LIMIT','File limit');
    // Never inline active content, and never accept a caller MIME override.
    const type=['text/plain','application/pdf','image/png','image/jpeg'].includes(resource.type)?resource.type:'application/octet-stream';
    return {file,size:stat.size,type};
  } catch(error){await file?.close();throw new WydgitError(error instanceof WydgitError?error.code:'FILE.IO','File unavailable');}
}
