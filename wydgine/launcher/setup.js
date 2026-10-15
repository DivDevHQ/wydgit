import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import metadata from '../../packages/wydgine/package.json' with {type:'json'};
import {clean,record} from '../object-model/validation.js';
import {readLaunchConfig,readLocal,validateLaunchConfig,validPath,ensure,error} from './config.js';
import {discover,choose,validateSelected,display} from './selection.js';
import {persistFiles} from './persistence.js';
import {confirm} from './terminal.js';

const json=value=>JSON.stringify(value,null,2)+'\n';
export function mergeManifest(text,version,{replaceStart=false}={}){
 let value;try{value=text===null?{name:'my-wydgine-installation',private:true}:JSON.parse(text);value=clean(value);}catch{throw error('LAUNCH.MANIFEST','Invalid consumer package.json');}
 ensure(record(value)&&['scripts','dependencies','devDependencies'].every(field=>!Object.hasOwn(value,field)||record(value[field])),'LAUNCH.MANIFEST','Invalid consumer package.json fields');
 ensure(!value.scripts||Object.values(value.scripts).every(v=>typeof v==='string'),'LAUNCH.MANIFEST','Invalid consumer scripts');
 for(const field of ['dependencies','devDependencies'])ensure(!value[field]||Object.values(value[field]).every(v=>typeof v==='string'&&v.length>0),'LAUNCH.MANIFEST','Invalid consumer dependencies');
 ensure(!value.scripts||!Object.hasOwn(value.scripts,'start')||value.scripts.start==='wydgine start'||replaceStart,'LAUNCH.SCRIPT_CONFLICT','Existing start script requires explicit replacement approval');
 ensure(!value.devDependencies?.wydgine,'LAUNCH.MANIFEST','Move the verified Wydgine dependency from devDependencies explicitly before setup');
 ensure(typeof version==='string'&&version===metadata.version,'LAUNCH.VERSION','Verified local engine version required');
 return {...value,scripts:{...value.scripts,start:'wydgine start'},dependencies:{...value.dependencies,wydgine:version}};
}
export async function verifiedVersion(directory){
 // At this phase accept only the actual private adapter, never a remote guess.
 try{
  const installed=path.join(directory,'node_modules/wydgine');
  ensure(await fs.realpath(installed)===fileURLToPath(new URL('../../packages/wydgine/',import.meta.url)).replace(/\/$/,''),'LAUNCH.VERSION','Use the verified local development adapter');
  const value=JSON.parse(await readLocal(path.join(installed,'package.json')));
  ensure(value.name==='wydgine'&&value.version===metadata.version&&value.bin?.wydgine==='./bin/wydgine.js','LAUNCH.VERSION','Unverified local engine package');return value.version;
 }catch{throw error('LAUNCH.VERSION','Verified local Wydgine adapter is required in this installation; see I5.2 development instructions');}
}
async function prompt(terminal,label,current){
 const answer=await terminal.ask(`${label} [${display(current)}]: `);ensure(answer!==null,'LAUNCH.CANCELLED','Setup cancelled');return answer.trim()||current;
}
export async function setup({directory=process.cwd(),terminal}){
 ensure(terminal,'LAUNCH.TTY_REQUIRED','Setup requires an interactive terminal');ensure(validPath(directory)&&path.isAbsolute(directory),'LAUNCH.PATH','Setup directory must be absolute');
 ensure(await fs.realpath(directory)===directory,'LAUNCH.PATH','Setup directory must exist and be canonical');
 const version=await verifiedVersion(directory),config=await readLaunchConfig({cwd:directory}),manifestFile=path.join(directory,'package.json'),manifestText=await readLocal(manifestFile,{optional:true});
 // Validate manifest before offering any changes, including script conflict approval.
 let manifest;try{manifest=mergeManifest(manifestText,version);}catch(e){if(e.code!=='LAUNCH.SCRIPT_CONFLICT')throw e;mergeManifest(manifestText,version,{replaceStart:true});}
 terminal.write(`Installation: ${display(directory)}\nConfiguration: ${display(config.file)}\nConfigure an existing canonical App. App creation is not implemented.\n`);
 const value=structuredClone(config.value);
 value.appsDirectory=await prompt(terminal,'Apps directory',value.appsDirectory);ensure(validPath(value.appsDirectory),'LAUNCH.PATH','Invalid Apps directory');
 const mode=await prompt(terminal,'Default App: keep, select, path, or none','keep');
 if(mode==='select'){const selected=await choose(await discover(path.resolve(directory,value.appsDirectory)),terminal);value.defaultApp=path.relative(directory,selected.root)||'.';}
 else if(mode==='path')value.defaultApp=await prompt(terminal,'Existing App path',value.defaultApp??'');
 else if(mode==='none')value.defaultApp=null;
 else ensure(mode==='keep','LAUNCH.INPUT','Unknown default App choice');
 if(value.defaultApp!==null)await validateSelected(value.defaultApp,{cwd:directory});
 value.listener.host=await prompt(terminal,'Listener IP',value.listener.host);
 const port=await prompt(terminal,'Listener port',String(value.listener.port));ensure(/^[0-9]{1,5}$/.test(port),'LAUNCH.LISTENER','Invalid listener port');value.listener.port=Number(port);validateLaunchConfig(value);
 if(!manifest){ensure(await confirm(terminal,'Replace the existing conflicting start script with "wydgine start"?'),'LAUNCH.CANCELLED','Start script preserved; setup cancelled');manifest=mergeManifest(manifestText,version,{replaceStart:true});}
 terminal.write(`Proposed launcher configuration:\n${json(value)}Consumer package.json: preserve unrelated metadata; set scripts.start="wydgine start" and dependencies.wydgine="${version}".\nExisting files receive private .backup-* copies.\n`);
 ensure(await confirm(terminal,'Save this configuration and consumer manifest (overwrite existing files)?'),'LAUNCH.CANCELLED','Setup cancelled; files unchanged');
 const backups=await persistFiles([{file:config.file,before:config.text,after:json(value)},{file:manifestFile,before:manifestText,after:json(manifest)}]);
 terminal.write(`Saved. ${backups.length} backup(s) beside the original files; restore those files if recovery is needed.\nStart from this installation directory with npm start.\nDevelopment adapter only: retain the repository engine closure; no independent npm installation is verified.\n`);
}
