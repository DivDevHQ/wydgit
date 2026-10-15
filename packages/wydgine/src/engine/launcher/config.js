import fs from 'node:fs/promises';
import path from 'node:path';
import {isIP} from 'node:net';
import {constants} from 'node:fs';
import {clean,record,WydgitError} from '../object-model/validation.js';

export const error=(code,message)=>new WydgitError(code,message);
export const ensure=(condition,code,message)=>{if(!condition)throw error(code,message);};
export const defaults=()=>({schema:'wydgine.launch/1',appsDirectory:'apps',defaultApp:null,listener:{host:'127.0.0.1',port:3000},setup:{enabled:false}});
export function validPath(value){return typeof value==='string'&&value.length>0&&value.length<=4096&&value.trim()===value&&!/[\x00-\x1f\x7f]/.test(value);}
const shape=(value,keys)=>ensure(record(value)&&keys.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>keys.includes(k)),'LAUNCH.INVALID_CONFIG','Invalid launcher configuration fields');
export function validateLaunchConfig(input){
 try{
  const v=clean(input);shape(v,['schema','appsDirectory','defaultApp','listener','setup']);
  ensure(v.schema==='wydgine.launch/1','LAUNCH.SCHEMA','Unsupported launcher schema');
  ensure(validPath(v.appsDirectory)&&(v.defaultApp===null||validPath(v.defaultApp)),'LAUNCH.INVALID_CONFIG','Invalid launcher path');
  shape(v.listener,['host','port']);
  ensure(typeof v.listener.host==='string'&&isIP(v.listener.host)!==0&&Number.isSafeInteger(v.listener.port)&&v.listener.port>=1&&v.listener.port<=65535,'LAUNCH.LISTENER','Listener requires a literal IP and port 1–65535');
  shape(v.setup,['enabled']);ensure(typeof v.setup.enabled==='boolean','LAUNCH.INVALID_CONFIG','Invalid setup setting');
  ensure(!v.setup.enabled,'LAUNCH.UNSUPPORTED','HTML setup is not implemented; use the terminal setup command');return v;
 }catch(e){if(e instanceof WydgitError&&e.code.startsWith('LAUNCH.'))throw e;throw error('LAUNCH.INVALID_CONFIG','Invalid launcher configuration');}
}
// No-follow bounded reads also protect setup's unrelated manifest metadata.
export async function readLocal(file,{optional=false,max=65536}={}){
 let handle;
 try{
  const stat=await fs.lstat(file);ensure(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=max,'LAUNCH.FILE','Unsafe or oversized local configuration file');
  handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);const opened=await handle.stat();ensure(opened.ino===stat.ino&&opened.dev===stat.dev&&opened.isFile()&&opened.nlink===1,'LAUNCH.FILE','Local configuration changed');
  const text=await handle.readFile('utf8');ensure(Buffer.byteLength(text)<=max,'LAUNCH.FILE','Local configuration too large');return text;
 }catch(e){if(optional&&e.code==='ENOENT')return null;if(e instanceof WydgitError)throw e;throw error('LAUNCH.FILE','Could not read local configuration');}finally{await handle?.close();}
}
export async function readLaunchConfig({cwd=process.cwd(),config}={}){
 ensure(config===undefined||validPath(config),'LAUNCH.PATH','Invalid configuration path');
 const file=path.resolve(cwd,config??'wydgine.local.json');const text=await readLocal(file,{optional:config===undefined});let value;
 try{value=validateLaunchConfig(text===null?defaults():JSON.parse(text));}catch(e){if(e instanceof WydgitError)throw e;throw error('LAUNCH.INVALID_CONFIG','Malformed launcher configuration');}
 return {file,text,value,base:path.dirname(file),appsDirectory:path.resolve(path.dirname(file),value.appsDirectory)};
}
