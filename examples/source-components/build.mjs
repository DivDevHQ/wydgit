// Host tooling only. Publisher approval comes from the embedding host.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {compileFamily} from '../../wydgine/wydbasic/index.js';
export async function build({definitions,verifiedPackages,output}) {
  const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
  const sources=Object.fromEntries(await Promise.all(['card.bas','panel.bas'].map(async file=>[file,await readFile(new URL(file,import.meta.url),'utf8')])));
  const result=compileFamily(sources,{manifest,definitions,verifiedPackages,entry:{type:'divdev/source-panel',id:'source-panel'}});
  // Complete validation precedes filesystem output. I/O failure is the caller's
  // staging/publication responsibility; the compiler has no install side effects.
  await mkdir(output,{recursive:true});
  await writeFile(path.join(output,'manifest.json'),JSON.stringify(result.manifest,null,2)+'\n');
  for(const [file,text] of Object.entries(result.resources))await writeFile(path.join(output,file),text);
  return result;
}
