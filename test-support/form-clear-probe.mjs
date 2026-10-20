// Serial single-Page benchmark. Run alone, once per implementation. No HTTP/load.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {clearFixture,measureClear,summarize} from './form-clear.js';
const [output,label]=process.argv.slice(2);
if(!output||!label)throw Error('Usage: node test-support/form-clear-probe.mjs NEW_FILE LABEL');
const files=['packages/wydgine/src/engine/execution/page.js','packages/wydgine/src/engine/execution/form-clear-observation.js','packages/wydgine/src/engine/object-model/mutation.js','packages/wydgine/src/engine/execution/form-clear-edit.js','test-support/form-clear.js','test-support/form-clear-probe.mjs'];
const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const cases=[];
for(const count of [0,2,8,24])for(const changed of [false,true]){
  const fixture=clearFixture({count,changed}),rows=[];let finalFields;
  for(let i=0;i<19;i++){
    const {result,observations,state}=await measureClear(fixture);
    assert.equal(result.error,null);assert.equal(observations.length,1);assert.equal(observations[0].completed,true);
    const fields=state.slots.pages[0].slots.sections[0].slots.blocks[0].slots.blocks[0].slots.children;
    assert.equal(fields.length,count);finalFields=fields;
    // Input fixture is reused unchanged: each execution owns an isolated tree.
    if(i>=4)rows.push(observations[0]);
  }
  const metrics=Object.fromEntries(['totalMs','traversalMs','calculationMs','editSetupMs','runtimeEditsMs','commitMs','propertyWrites','runtimeEdits'].map(key=>[key,summarize(rows.map(row=>row[key]))]));
  cases.push({count,changed,changedFields:changed?count:0,finalFields,warmups:4,repetitions:15,metrics,rows});
  console.log(JSON.stringify({label,count,changed,metrics}));
}
await fs.writeFile(output,JSON.stringify({schema:'wydgine.form-clear-benchmark/1',label,node:process.version,clock:'performance.now',shape:'Page > Form > Section > Block > typed fields, plus unchanged repository App metadata',hashes,cases},null,2)+'\n',{flag:'wx'});
