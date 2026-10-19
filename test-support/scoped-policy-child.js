// Disposable native test host. No production service exposes these inputs.
import fs from 'node:fs/promises';
import { load } from './wydgate.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
const request=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const registry=await load(request.config);
try {
  const result=await registry.bind(new ExecutionContext(request.caller)).invoke('wydstore','1.0.0',request.operation??'get',request.input);
  process.stdout.write(JSON.stringify(result));
} finally {await registry.close();}
