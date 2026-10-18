// Crash harness: no production fault-injection or subprocess API is exposed.
import fs from 'node:fs/promises';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { planPackageOperation, applyPackageOperation } from '../wydgine/packages/index.js';
const [requestFile,stage]=process.argv.slice(2),options=JSON.parse(await fs.readFile(requestFile,'utf8'));
options.installationContext=new ExecutionContext(options.installationContext);
const plan=await planPackageOperation(options);
await applyPackageOperation(plan,{atStage:async reached=>{if(reached===stage){process.send({stage:reached});await new Promise(resolve=>process.on('message',resolve));}}});
