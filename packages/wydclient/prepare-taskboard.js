// Trusted build tooling only; static consumers load canonical JSON, never this compiler.
import {readFile,writeFile} from 'node:fs/promises';
import {build} from '../../examples/wbasic-taskboard/build.mjs';
import {compileDefinitions} from '../../wydgine/repository.js';
const core=compileDefinitions(JSON.parse(await readFile(new URL('../../prototypes/objects.json',import.meta.url))));
const result=await build({definitions:core,verifiedPackages:{'divdev/wbasic-taskboard':'divdev'}});
await writeFile(new URL('examples/taskboard-manifest.json',import.meta.url),JSON.stringify({schema:'wydgit.registry/0.1',protocol:'0.1',prototypes:result.definitions,entry:{id:'taskboard',type:'divdev/taskboard'}},null,2)+'\n');
