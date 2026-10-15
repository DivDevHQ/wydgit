// Trusted host tooling: explicit independent publisher approval is required.
import {readFile} from 'node:fs/promises';
import {compileFamily} from '../../wydgine/wydbasic/index.js';
export async function build(options) {
 const files=['task-record.bas','task-model.bas','task-card.bas','task-list.bas','navigation.bas','taskboard.bas'];
 const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
 const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,await readFile(new URL(file,import.meta.url),'utf8')])));
 return compileFamily(sources,{...options,manifest,entry:{id:'taskboard',type:'divdev/taskboard'}});
}
