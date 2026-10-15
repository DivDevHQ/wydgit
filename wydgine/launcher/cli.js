import path from 'node:path';
import {readLaunchConfig,validateLaunchConfig,validPath,ensure} from './config.js';
import {selectApp} from './selection.js';
import {createTerminal,confirm} from './terminal.js';
import {persistFiles} from './persistence.js';
import {setup} from './setup.js';
import {launch,installSignals} from './start.js';

export const usage='Usage: wydgine setup [--directory <absolute-path>]\n       wydgine start [app-path] [--config <path>]\n       wydgine validate [app-path]\n       wydgine --help\n';
export function parseArgs(args){
 ensure(Array.isArray(args)&&args.length<=6&&args.every(a=>typeof a==='string'&&a.length>0&&a.length<=4096&&!/[\x00-\x1f\x7f]/.test(a)),'LAUNCH.USAGE','Invalid or oversized arguments');
 if(args.length===1&&['--help','-h'].includes(args[0]))return {command:'help'};
 const [command,...rest]=args;ensure(['setup','start','validate'].includes(command),'LAUNCH.USAGE','Explicit setup, start or validate command required');
 const result={command};
 for(let i=0;i<rest.length;i++){
  const arg=rest[i];
  if(arg.startsWith('-')){
   const key=arg==='--config'&&command==='start'?'config':arg==='--directory'&&command==='setup'?'directory':null;
   ensure(key&&!Object.hasOwn(result,key),'LAUNCH.USAGE','Unknown, duplicate or contradictory option');
   const value=rest[++i];ensure(validPath(value)&&!value.startsWith('-'),'LAUNCH.USAGE','Option requires a path');result[key]=value;
  }else {ensure(command!=='setup'&&!Object.hasOwn(result,'appPath')&&validPath(arg),'LAUNCH.USAGE','Unexpected positional argument');result.appPath=arg;}
 }
 ensure(!result.directory||path.isAbsolute(result.directory),'LAUNCH.USAGE','Setup directory must be absolute');return result;
}
export async function main(args=process.argv.slice(2)){
 let terminal;
 try{
  const options=parseArgs(args);if(options.command==='help'){process.stdout.write(usage);return;}
  if(process.stdin.isTTY&&process.stdout.isTTY)terminal=createTerminal();
  if(options.command==='setup'){await setup({...options,terminal});return;}
  const config=await readLaunchConfig(options),selected=await selectApp({...options,config,terminal});
  if(options.command==='validate'){process.stdout.write(JSON.stringify({ok:true,app:selected.id})+'\n');return;}
  if(terminal&&options.appPath===undefined&&config.value.defaultApp===null&&await confirm(terminal,'Save this selection as the default App?')){
   const value=validateLaunchConfig({...config.value,defaultApp:path.relative(config.base,selected.root)||'.'});
   await persistFiles([{file:config.file,before:config.text,after:JSON.stringify(value,null,2)+'\n'}]);
  }
  terminal?.close();terminal=null;
  let interrupted=false;
  const deadline=setTimeout(()=>{process.stderr.write('{"ok":false,"code":"LAUNCH.START_TIMEOUT","message":"Startup deadline exceeded"}\n');process.exit(1);},30000);
  let interruptTimer;
  const interrupt=()=>{interrupted=true;interruptTimer??=setTimeout(()=>process.exit(1),5000);};
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,interrupt);
  let runtime;
  try{runtime=await launch(selected,config.value.listener);}finally{clearTimeout(deadline);clearTimeout(interruptTimer);for(const signal of ['SIGINT','SIGTERM'])process.off(signal,interrupt);}
  const stop=installSignals(runtime);
  if(interrupted){await stop();return;}
  process.stdout.write(JSON.stringify({ok:true,app:runtime.id,pid:process.pid,listener:runtime.server.address()})+'\n');
 }catch(e){
  const known=['APP_SELECTION_REQUIRED','LAUNCH.'];const code=typeof e.code==='string'&&known.some(prefix=>e.code.startsWith(prefix))?e.code:'LAUNCH.FAILED';
  process.stderr.write(JSON.stringify({ok:false,code,message:code===e.code?e.message:'Launcher operation failed'})+'\n');if(code==='LAUNCH.USAGE')process.stderr.write(usage);process.exitCode=code==='LAUNCH.CANCELLED'?130:1;
 }finally{terminal?.close();}
}
