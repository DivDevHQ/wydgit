// Count early-rejection visits as well as successful whole-tree validations.
// The G hydratedNodes counter records only trees whose structural visit finishes.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {clearFixture} from './form-clear.js';
import {createPageEdit as after} from '../packages/wydgine/src/engine/execution/canonical-edit.js';
const [output]=process.argv.slice(2);if(!output)throw Error('Usage: incremental-validation-visits.mjs NEW_JSON');
const historical=JSON.parse(gunzipSync(await fs.readFile(new URL('./http-canonical-mutation-spike-h-source-2026-10-20.json.gz',import.meta.url))));
const helper='packages/wydgine/src/engine/execution/canonical-edit.js',source=historical.micros.find(m=>m.label==='after').sources[helper],base=new URL('../'+helper,import.meta.url);
const relocated=source.replaceAll("from '../object-model/", "from '"+new URL('../object-model/',base).href);
const {createPageEdit:before}=await import('data:text/javascript;base64,'+Buffer.from(relocated).toString('base64'));
const rows=[];
for(const [label,factory] of [['before',before],['after',after]])for(const invalid of [false,true]){
 const f=clearFixture({count:64});let lookups=0;
 // Observer-only forwarding: hydration calls get exactly once per visited node;
 // isA/Form/serialization helpers use the unchanged real registry internally.
 const registry=Object.freeze({get(id){lookups++;return f.model.registry.get(id);},isA:(...args)=>f.model.registry.isA(...args)});
 const edit=factory(f.model.runtime,f.context,registry),operations=[];
 for(let i=0;i<16;i++){
  const start=lookups;let code=null;
  try{edit.setProperty('field'+i,'label',invalid?false:'changed '+i);}catch(error){code=error.code;}
  assert.equal(code,invalid?'MUTATION.INVALID_PROPERTY':null);
  // One additional get is the setter's declared-property lookup, not hydration.
  const visits=lookups-start-1;assert.equal(visits,invalid?i+6:69);operations.push({target:'field'+i,code,visits});
 }
 const start=lookups,next=edit.commit(),commitVisits=lookups-start;
 assert.equal(commitVisits,invalid||label==='before'?69:0);
 rows.push({label,invalid,operations,commitVisits,totalVisits:operations.reduce((n,o)=>n+o.visits,commitVisits),revision:next.revision});
}
const sources={before:source,after:await fs.readFile(base,'utf8'),probe:await fs.readFile(new URL(import.meta.url),'utf8')};
await fs.writeFile(output,JSON.stringify({schema:'wydgine.spike-i-validation-visits/1',rows,sources,hashes:Object.fromEntries(Object.entries(sources).map(([name,value])=>[name,createHash('sha256').update(value).digest('hex')]))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,rows:rows.map(({label,invalid,totalVisits})=>({label,invalid,totalVisits}))}));
