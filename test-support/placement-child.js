import fs from 'node:fs/promises';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {planExecutionPlacement,applyPackageOperation} from '../wydgine/packages/index.js';
const [file,stage]=process.argv.slice(2),request=JSON.parse(await fs.readFile(file));
request.installationContext=new ExecutionContext(request.installationContext);
await applyPackageOperation(await planExecutionPlacement(request),{atStage:async reached=>{
 if(reached===stage){process.send({stage});await new Promise(()=>{});}
}});
