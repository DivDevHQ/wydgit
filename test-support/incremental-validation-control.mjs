// Alternating hot control for the early small-tree timing regression. No hooks.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {clearFixture} from './form-clear.js';
import {createPageEdit as after} from '../packages/wydgine/src/engine/execution/canonical-edit.js';
import {distribution} from './scheduling-attribution.js';
const [output]=process.argv.slice(2);if(!output)throw Error('Usage: incremental-validation-control.mjs NEW_JSON');
const helper='packages/wydgine/src/engine/execution/canonical-edit.js';
const historical=JSON.parse(gunzipSync(await fs.readFile(new URL('./http-canonical-mutation-spike-h-source-2026-10-20.json.gz',import.meta.url))));
const source=historical.micros.find(m=>m.label==='after').sources[helper];
// Preserve the H function body; relocate its imports to the very same modules
// used by I. This is a test-only isolated module, never a changed runtime file.
const base=new URL('../'+helper,import.meta.url),relocated=source.replaceAll("from '../object-model/", "from '"+new URL('../object-model/',base).href);
const {createPageEdit:before}=await import('data:text/javascript;base64,'+Buffer.from(relocated).toString('base64'));
const rows=[];
for(const fields of [2,64])for(const individual of [false,true]){
 const f=clearFixture({count:fields}),samples=[];
 function run(factory){
  let runtime=f.model.runtime,edit;
  const start=performance.now();
  // Include setup inside the total bracket for both publication contracts.
  if(!individual)edit=factory(runtime,f.context,f.model.registry);
  for(let i=0;i<16;i++){
   if(individual)edit=factory(runtime,f.context,f.model.registry);
   edit.setProperty('field'+i%fields,'label','changed '+i);
   if(individual){runtime=edit.commit().runtime;assert.equal(runtime.scope(f.context,'field'+i%fields).properties.label,'changed '+i);}else edit.changes();
  }
  if(!individual)runtime=edit.commit().runtime;
  const totalMs=performance.now()-start;assert.equal(runtime.revision,individual?16:1);return totalMs;
 }
 for(let round=-20;round<27;round++){
  const pair={round};for(const label of round%2?['after','before']:['before','after'])pair[label]=run(label==='before'?before:after);
  if(round>=0)samples.push(pair);
 }
 rows.push({fields,nodes:fields+5,individual,warmups:20,samples,before:distribution(samples.map(s=>s.before)),after:distribution(samples.map(s=>s.after)),pairedDeltaMs:distribution(samples.map(s=>s.after-s.before))});
}
const sources={before:source,after:await fs.readFile(base,'utf8'),probe:await fs.readFile(new URL(import.meta.url),'utf8')};
await fs.writeFile(output,JSON.stringify({schema:'wydgine.spike-i-hot-control/1',node:process.version,sources,hashes:Object.fromEntries(Object.entries(sources).map(([name,value])=>[name,createHash('sha256').update(value).digest('hex')])),rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,rows:rows.length}));
