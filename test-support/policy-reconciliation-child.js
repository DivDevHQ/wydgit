// Test-only process interruption harness; never exposed by the host API.
import fs from 'node:fs/promises';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {planPackagePolicy,approvePackagePolicy,applyPackagePolicy,recoverPackageEffects} from '../wydgine/packages/index.js';
const [file,stage,action='apply']=process.argv.slice(2),request=JSON.parse(await fs.readFile(file));
request.installationContext=new ExecutionContext(request.installationContext);
const atStage=async reached=>{if(reached===stage){process.send({stage});const response=await new Promise(resolve=>process.once('message',resolve));if(response==='fail')throw Error('Injected lost acknowledgement');}};
await atStage('BEFORE_PLAN');
if(action==='plan'){await planPackagePolicy(request);await atStage('REVIEW');}
else if(action==='approve'){await approvePackagePolicy(await planPackagePolicy(request),{installationContext:request.installationContext,allowExpansion:true},{atStage});await atStage('APPROVED');}
else if(action==='recover')await recoverPackageEffects({...request,atStage});
else await applyPackagePolicy(request,{atStage});
