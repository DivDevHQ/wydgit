// Explicit inventory; paths are constrained to the build configuration's directory.
import {readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildClientPackage,signClientPackage} from '../wydgine/wydbasic/client-package.js';
import {compileDefinitions} from '../wydgine/repository.js';
import {resourcePath} from '../wydgine/packages/manifest.js';
import {requireThat as check} from '../wydgine/object-model/validation.js';
export async function buildClientFromConfig(configPath,output,{verifiedPackages,signing,libraries,registryOptions}={}){
 const absolute=resolve(configPath),base=await realpath(dirname(absolute)),config=JSON.parse(await readFile(absolute,'utf8'));
 check(Object.keys(config).every(k=>['target','manifest','sources','entry'].includes(k))&&config.target==='client'&&Array.isArray(config.sources)&&config.sources.length>0&&config.sources.length<=64&&new Set(config.sources).size===config.sources.length&&config.sources.every(resourcePath),'PACKAGE.BUILD','Invalid explicit CLIENT source inventory');
 const sources={};for(const file of config.sources){const path=await realpath(resolve(base,file)),rel=relative(base,path);check(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'PACKAGE.BUILD','Source escapes build directory');sources[file]=await readFile(path,'utf8');}
 const definitions=compileDefinitions(JSON.parse(await readFile(new URL('../prototypes/objects.json',import.meta.url),'utf8')));
 const result=buildClientPackage(sources,{target:'client',manifest:config.manifest,entry:config.entry,definitions,verifiedPackages,libraries,registryOptions});
 const signed=signing?signClientPackage(result,signing):null,registry=signed?.registry??result.registry;
 await mkdir(output,{recursive:true});
 await writeFile(resolve(output,'package.json'),result.packageText);
 await writeFile(resolve(output,'registry.json'),JSON.stringify(registry,null,2)+'\n');
 await writeFile(resolve(output,'integrity.json'),JSON.stringify({id:result.payload.id,version:result.payload.version,integrity:result.integrity,clientVersion:result.clientVersion},null,2)+'\n');
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [config,output,publisher]=process.argv.slice(2);check(config&&output&&publisher,'PACKAGE.BUILD','Usage: node scripts/build-client-package.js CONFIG OUTPUT TRUSTED_PUBLISHER');
 const metadata=JSON.parse(await readFile(config,'utf8'));check(metadata.manifest.publisher===publisher,'PACKAGE.PUBLISHER','Independent local publisher approval differs');
 await buildClientFromConfig(config,output,{verifiedPackages:{[metadata.manifest.id]:publisher}});
}
