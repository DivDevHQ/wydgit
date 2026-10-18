import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { planOperatorInstall, applyOperatorInstall } from '../scripts/package-infrastructure.js';
import { planPackageOperation, planManualReplacement, applyPackageOperation, recoverPackageEffects } from '../wydgine/packages/index.js';
const request=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
if(request.nativeBoundary){
  const pause=()=>{process.send({stage:request.pauseAt});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);};
  if(request.nativeBoundary==='store-unlock'){
    const original=fs.unlink;
    fs.unlink=async function(file){const result=await original.call(this,file);if(String(file).endsWith('.lifecycle'))pause();return result;};
  }else if(['catalog-rename','config-rename'].includes(request.nativeBoundary)){
    const original=fs.rename,target=request.nativeBoundary==='catalog-rename'?'installed-packages.json':'wydgit.config.json';
    fs.rename=async function(from,to){const result=await original.call(this,from,to);if(String(to).endsWith('/'+target))pause();return result;};
  }else if(request.nativeBoundary==='sqlite-schema'){
    const {default:Database}=await import('better-sqlite3'),original=Database.prototype.exec;
    Database.prototype.exec=function(sql){const value=original.call(this,sql);if(sql.startsWith('CREATE TABLE metadata'))pause();return value;};
  }else if(request.nativeBoundary==='sqlite-replace'){
    const {default:Database}=await import('better-sqlite3'),original=Database.prototype.prepare;
    Database.prototype.prepare=function(sql){const statement=original.call(this,sql);if(sql==='DELETE FROM records'){const run=statement.run;statement.run=function(...args){const result=run.apply(this,args);pause();return result;};}return statement;};
  }else if(request.nativeBoundary==='json-replace'){
    const original=fs.rename;
    fs.rename=async function(from,to){if(/[/\\][a-f0-9]{64}\.[a-f0-9-]{36}\.tmp$/.test(from))pause();return original.call(this,from,to);};
  }
}
syncBuiltinESMExports();
let failed=false;
const atStage=async stage=>{
  if(stage===request.failAt&&!failed){failed=true;throw Error('injected failure');}
  if(stage===request.pauseAt){process.send({stage});await new Promise(()=>{});}
};
// Keep a process alive at the exact durable boundary until its parent kills it.
const keepalive=setInterval(()=>{},1000);
try{
  if(request.kind==='provision'){
    const options={...request.options,installationContext:new ExecutionContext(request.options.installationContext)};
    await applyOperatorInstall(await planOperatorInstall(options),{atStage});
  }else if(request.kind==='manual')await applyPackageOperation(await planManualReplacement({...request.options,installationContext:new ExecutionContext(request.options.installationContext)},{atStage}),{atStage});
  else if(request.kind==='recover')await recoverPackageEffects({...request.options,installationContext:new ExecutionContext(request.options.installationContext),atStage});
  else await applyPackageOperation(await planPackageOperation({...request.options,installationContext:new ExecutionContext(request.options.installationContext)}),{atStage});
}catch(error){process.stderr.write(error.code+': '+error.message+'\n');process.exitCode=1;}
finally{clearInterval(keepalive);}
