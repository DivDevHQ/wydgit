import { open,lstat,realpath,link,unlink,opendir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
const valid=id=>typeof id==='string'&&/^m-[a-f0-9]{32}$/.test(id);
// Root is operator-provisioned, never derived from uploaded filenames.
export async function localProvider(root) {
  async function guard(){
    if(typeof root!=='string'||!path.isAbsolute(root)||path.normalize(root)!==root||root===path.parse(root).root)throw new Error('Unsafe root');
    let cursor=path.parse(root).root;
    for(const part of root.slice(cursor.length).split(path.sep)){cursor=path.join(cursor,part);const stat=await lstat(cursor);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe root');}
    if(await realpath(root)!==root)throw new Error('Unsafe root');
  }
  await guard();
  const location=async(id,staging=false)=>{if(!valid(id))throw new Error('Invalid object');await guard();return path.join(root,id+(staging?'.part':'.bin'));};
  return Object.freeze({
    async stage(id){return open(await location(id,true),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);},
    async finalize(id){const source=await location(id,true),destination=await location(id);const info=await lstat(source);if(!info.isFile()||info.isSymbolicLink())throw new Error('Unsafe staging');try{await link(source,destination);}catch(error){
      if(error.code!=='EEXIST')throw error;
      const target=await lstat(destination);
      if(!target.isFile()||target.isSymbolicLink()||target.dev!==info.dev||target.ino!==info.ino||target.nlink!==2||info.nlink!==2)throw error;
    }await unlink(source);},
    async read(id){const file=await open(await location(id),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const stat=await file.stat();if(!stat.isFile()||stat.nlink!==1)throw new Error('Unsafe object');return {file,size:stat.size};}catch(error){await file.close();throw error;}},
    async remove(id,staging=false){try{await unlink(await location(id,staging));}catch(error){if(error.code!=='ENOENT')throw error;}},
    async objects(limit=512){await guard();const objects=[];let inspected=0;for await(const entry of await opendir(root)){if(++inspected>limit)throw new Error('Object limit');const name=entry.name;if(/^m-[a-f0-9]{32}\.(bin|part)$/.test(name))objects.push({id:name.slice(0,34),staging:name.endsWith('.part')});}return objects;}
  });
}
