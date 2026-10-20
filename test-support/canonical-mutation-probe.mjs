// Manual Spike H capture. Run alone, once per source version, with a new output.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const [output,label,mode='off']=process.argv.slice(2);
if(!output||!label||!['off','on'].includes(mode))throw Error('Usage: canonical-mutation-probe.mjs NEW_FILE LABEL off|on');
if(mode==='on'){
  const {installAttributionHooks}=await import('./prerender-integrity-hooks.mjs');installAttributionHooks();
}
const {createSynchronousAttribution}=await import('./prerender-integrity-attribution.js');
const {clearFixture,measureClear,summarize}=await import('./form-clear.js');
const {createPageEdit}=await import('../packages/wydgine/src/engine/execution/canonical-edit.js');
const {dehydrate}=await import('../wydgine/object-model/index.js');
const files=['packages/wydgine/src/engine/execution/canonical-edit.js','packages/wydgine/src/engine/execution/page.js','packages/wydgine/src/engine/object-model/index.js','packages/wydgine/src/engine/object-model/mutation.js','packages/wydgine/src/engine/object-model/schema.js','test-support/canonical-mutation-probe.mjs'];
const sources=Object.fromEntries(await Promise.all(files.map(async p=>[p,await fs.readFile(p,'utf8')])));
const hashes=Object.fromEntries(files.map(p=>[p,createHash('sha256').update(sources[p]).digest('hex')]));
const cases=[];
for(const fields of [2,64])for(const mutations of [1,16])for(const changed of [false,true])for(const shape of ['string','object','array'])for(const individual of [false,true]){
 const f=clearFixture({count:fields}),rows=[];
 const name=shape==='string'?'label':shape==='object'?'format':'warnings';
 function run(round){
  let runtime=f.model.runtime;const capture=mode==='on'?createSynchronousAttribution():null;let editMs=0,commits=0;
  const work=()=>{
   let edit=individual?null:createPageEdit(runtime,f.context,f.model.registry);
   for(let i=0;i<mutations;i++){
    const id='field'+i%fields,current=runtime.get(id).properties[name];
    // Each standalone setter is committed and immediately read. Session edits
    // expose only changes() until commit, exactly as the existing API specifies.
    if(individual)edit=createPageEdit(runtime,f.context,f.model.registry);
    const value=changed?(shape==='string'?'Changed '+i:shape==='object'?{nested:{items:[i,{ok:true}]}}:['warning '+i]):current;
    const since=performance.now();edit.setProperty(id,name,value);editMs+=performance.now()-since;
    if(individual){runtime=edit.commit().runtime;commits++;assert.equal(JSON.stringify(runtime.scope(f.context,id).properties[name]),JSON.stringify(value));}
    else edit.changes();
   }
   if(!individual){runtime=edit.commit().runtime;commits++;}
  };
  const start=performance.now();if(capture)capture.run(work);else work();const totalMs=performance.now()-start;
  assert.equal(runtime.revision,f.model.runtime.revision+commits);assert.equal(f.model.runtime.get('field0').properties.label,'Field 0');
  return {round,totalMs,editMs,commits,...(capture?{attribution:capture.finish()}:{})};
 }
 for(let i=0;i<3;i++)run(0);for(let i=1;i<=9;i++)rows.push(run(i));
 const raw=dehydrate(f.model.runtime);let nodes=0;const visit=n=>{nodes++;Object.values(n.slots).flat().forEach(visit);};visit(raw);
 cases.push({fields,nodes,canonicalBytes:Buffer.byteLength(JSON.stringify(raw)),mutations,changed,shape,individual,warmups:3,metrics:{totalMs:summarize(rows.map(r=>r.totalMs)),editMs:summarize(rows.map(r=>r.editMs))},rows});
}
const clear=[];
for(const fields of [2,24])for(const changed of [false,true]){
 const fixture=clearFixture({count:fields,changed}),rows=[];
 for(let i=0;i<12;i++){
  const c=mode==='on'?createSynchronousAttribution():null,start=performance.now();
  const result=c?await c.run(()=>measureClear(fixture)):await measureClear(fixture);
  assert.equal(result.result.error,null);if(i>=3)rows.push({totalMs:performance.now()-start,...result.observations[0],...(c?{attribution:c.finish()}:{})});
 }
 clear.push({fields,changed,rows,metrics:Object.fromEntries(['totalMs','runtimeEditsMs','commitMs'].map(k=>[k,summarize(rows.map(r=>r[k]))]))});
}
await fs.writeFile(output,JSON.stringify({schema:'wydgine.canonical-mutation-spike-h/1',label,mode,node:process.version,hashes,sources,cases,clear},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,label,mode,cases:cases.length,clear:clear.length}));
