import fs from 'node:fs/promises';
import path from 'node:path';
import {validateAppInventory} from '../inventory.js';
import {ensure,error,validPath,readLocal} from './config.js';

export const display=value=>String(value).replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,160);
export async function validateSelected(input,{cwd=process.cwd()}={}){
 ensure(validPath(input),'LAUNCH.PATH','Invalid App path');
 const root=path.resolve(cwd,input),base=path.dirname(root);
 try{
  ensure(await fs.realpath(root)===root,'LAUNCH.APP_INVALID','App root must be canonical and unlinked');
  const app=JSON.parse(await readLocal(path.join(root,'content/app.json')));
  const inventory=await validateAppInventory({schema:'wydgit.multi-host/0.1',apps:[{id:app.id,root:path.basename(root)}]},{root:base});
  return {...inventory.apps[0],title:display(app.properties?.title??app.id)};
 }catch(e){if(e.code==='LAUNCH.PATH')throw e;throw error('LAUNCH.APP_INVALID','Selected App failed canonical, package, ownership or recovery validation');}
}
export async function discover(directory){
 const candidates=[];
 try{
  const stat=await fs.lstat(directory);ensure(stat.isDirectory()&&!stat.isSymbolicLink()&&await fs.realpath(directory)===directory,'LAUNCH.DISCOVERY','Apps directory must be canonical');
  for await(const item of await fs.opendir(directory)){
   if(item.name.startsWith('.')||!item.isDirectory()||item.isSymbolicLink())continue;
   candidates.push(item);ensure(candidates.length<=128,'LAUNCH.DISCOVERY_LIMIT','More than 128 candidate directories; supply an explicit App path');
  }
 }catch(e){if(e.code==='ENOENT')return [];if(e.code?.startsWith('LAUNCH.'))throw e;throw error('LAUNCH.DISCOVERY','Could not inspect Apps directory');}
 const apps=[],ids=new Set();
 for(const item of candidates.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
  let app;try{app=await validateSelected(path.join(directory,item.name));}catch{continue;}
  const id=app.id.toLowerCase();ensure(!ids.has(id),'LAUNCH.DUPLICATE_APP','Duplicate canonical App identities; supply an explicit App path');ids.add(id);apps.push(app);
 }
 return apps;
}
export async function choose(apps,terminal){
 ensure(apps.length>0,'APP_SELECTION_REQUIRED','No valid Apps found; supply an explicit existing App path');
 terminal.write('Wydgine — Select Application\n'+apps.map((a,i)=>`  ${i+1}. ${display(a.title)} (${display(a.id)})`).join('\n')+'\n');
 for(let i=0;i<3;i++){
  const answer=await terminal.ask(`Select an application [1-${apps.length}] (q cancels): `);
  if(answer===null||/^(q|quit|cancel)$/i.test(answer.trim()))throw error('LAUNCH.CANCELLED','App selection cancelled');
  if(/^[1-9][0-9]{0,2}$/.test(answer.trim())&&Number(answer)<=apps.length)return validateSelected(apps[Number(answer)-1].root);
  terminal.write('Enter one listed number or q.\n');
 }
 throw error('LAUNCH.SELECTION','Selection retry limit reached');
}
export async function selectApp({appPath,cwd=process.cwd(),config,terminal}){
 const configured=config.value.defaultApp===null?null:await validateSelected(config.value.defaultApp,{cwd:config.base});
 if(appPath!==undefined)return validateSelected(appPath,{cwd});
 if(configured)return configured;
 ensure(terminal,'APP_SELECTION_REQUIRED','Select an App with an explicit path, a configured default, or an interactive terminal');
 return choose(await discover(config.appsDirectory),terminal);
}
