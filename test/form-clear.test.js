import test from 'node:test';
import assert from 'node:assert/strict';
import {setClearProperty} from '../packages/wydgine/src/engine/execution/form-clear-edit.js';
import {formClearObservation} from '../packages/wydgine/src/engine/execution/form-clear-observation.js';
import {clearFixture,measureClear} from '../test-support/form-clear.js';
import {ExecutionContext,hydrate,dehydrate} from '../wydgine/object-model/index.js';
import {webModel} from '../wydgine/web-model.js';
import {endExecutionContext} from '../wydgine/seam/context.js';

const fields=runtime=>Array.from({length:8},(_,i)=>runtime.get(`field${i}`));
const values=['','',false,null,[],null,[],''];
test('opt-in Clear stages are disjoint, bounded numeric observations, including failures',()=>{
  let clock=0,row;const o=formClearObservation(true,r=>{row=r;},()=>clock);
  o.fields(8);o.measure('traversalMs',()=>{clock+=2;});o.measure('calculationMs',()=>{clock+=3;});
  assert.throws(()=>o.measure('runtimeEditsMs',()=>{clock+=5;throw Error('failure');}));
  o.write();o.write(false);o.finish();assert.equal(row.totalMs,10);assert.equal(row.completed,false);
  assert.equal(row.fields,8);assert.equal(row.propertyWrites,2);assert.equal(row.runtimeEdits,1);
  assert.equal(row.traversalMs+row.calculationMs+row.runtimeEditsMs,10);assert.ok(Object.isFrozen(row));
  assert.equal(formClearObservation(false,()=>assert.fail()),null);assert.equal(formClearObservation(true),null);
  assert.doesNotThrow(()=>formClearObservation(true,()=>{throw Error('private');}).finish());
});
for(const count of [0,2,8,24])for(const changed of [false,true])test(`actual Page Clear: ${count} fields, changed=${changed}`,async()=>{
  const f=clearFixture({count,changed});let after;
  const {result,observations}=await measureClear(f,{render(model){after=model.runtime;return {html:'fixture',status:200};}});
  assert.equal(result.error,null);assert.equal(observations[0].propertyWrites,5*count+1);
  assert.equal(observations[0].fields,count);assert.equal(observations[0].completed,true);
  assert.equal(after.revision,0); // Subsequent Page validation rehydrates without revision metadata.assert.equal(after.get('form').properties.valid,true);
  for(let i=0;i<count;i++){
    const a=after.get(`field${i}`),b=f.model.runtime.get(`field${i}`);
    assert.equal(a.id,b.id);assert.equal(a.prototype,b.prototype);assert.deepEqual(a.provenance,b.provenance);
    assert.deepEqual(a.properties.value,values[i%8]);assert.equal(a.properties.valid,true);
    for(const key of Object.keys(b.properties).filter(k=>!['value','valid','validationMessage','errors','warnings'].includes(k)))assert.deepEqual(a.properties[key],b.properties[key]);
  }
  assert.equal(f.model.runtime.revision,0);
});
test('Clear empties authored values, preserves binding keys, resets validation and repeats without saved-state restoration or synthetic Change events',async()=>{
  const f=clearFixture({count:8,dirtyValidation:true}),order=[];let after,expired;
  const {result,observations}=await measureClear(f,{handlers:[
    {owner:'form',type:'Page.Load',run:function(){
      expired=this.ME;order.push('before');this.ME.FormState('clear');order.push('cleared');
      assert.equal(this.ME.FormState('isValid'),true);assert.deepEqual({...this.ME.FormState('values')},{field0:'',field1:'',field2:false,field3:null,field4:[],field5:null,field6:[]});
      this.ME.FormState('bind',{field0:'last confirmed saved value',field6:['b']});order.push('bound');
      this.ME.FormState('clear');order.push('cleared-again');
    }},...Array.from({length:8},(_,i)=>({owner:`field${i}`,type:'Change',run:function(){order.push('change');}})),
    {owner:'form',type:'Page.PreRender',run:function(){order.push('prerender');assert.equal(this.ME.FormState('values').field0,'');}}
  ],render(model){after=model.runtime;return {html:'fixture',status:200};}});
  assert.equal(result.error,null);assert.equal(observations.length,2);assert.deepEqual(order,['before','cleared','bound','cleared-again','prerender']);
  assert.equal(after.revision,0);assert.deepEqual(fields(after).map(f=>f.properties.value),values);
  for(const field of fields(after)){assert.equal(field.properties.valid,true);assert.equal(field.properties.validationMessage,'');assert.deepEqual(field.properties.errors,[]);assert.deepEqual(field.properties.warnings,[]);}
  assert.throws(()=>expired.FormState('clear'));
});
test('missing values materialize defaults; Clear uses current multiple configuration and null selection empties',async()=>{
  const f=clearFixture({count:8}),raw=dehydrate(f.model.runtime,{includeSensitive:true});
  const children=raw.slots.pages[0].slots.sections[0].slots.blocks[0].slots.blocks[0].slots.children;
  delete children[0].properties.value;
  const runtime=hydrate(raw,f.model.registry),model=webModel(runtime,f.model);let after;
  const {result}=await measureClear({...f,model},{handlers:[{owner:'form',type:'Page.Load',run:function(){
    const selection=this.ME.related('children','blocks')[0].related('children','blocks')[0].related('children','children')[5];
    selection.Set('value',null);selection.Set('multiple',true);this.ME.FormState('clear');
  }}],render(model){after=model.runtime;return {html:'fixture',status:200};}});
  assert.equal(result.error,null);assert.deepEqual(after.get('field5').properties.value,[]);assert.equal(after.get('field0').properties.value,'');
});
for(const denied of ['capability','unchanged-field','form','container','traversal','limit','ended'])test(`unchanged Clear retains ${denied} denial`,async()=>{
  const f=clearFixture({count:8,changed:false});
  const context=new ExecutionContext({...f.context,
    ...(denied==='capability'?{capabilities:[]}:{}),
    ...(denied==='unchanged-field'?{editable:f.context.editable.filter(id=>id!=='field6')}:{}),
    ...(denied==='form'?{editable:f.context.editable.filter(id=>id!=='form')}:{}),
    ...(denied==='container'?{visible:f.context.visible.filter(id=>id!=='wrapper')}:{}),
    ...(denied==='traversal'?{traversal:[]}:{}),...(denied==='limit'?{limits:{formNodes:3}}:{})});
  if(denied==='ended'){endExecutionContext(context);await assert.rejects(measureClear({...f,context}),{code:'SEAM.CONTEXT'});return;}
  const {result}=await measureClear({...f,context});assert.ok(result.error);assert.equal(f.model.runtime.revision,0);
});
test('cancelled Submit preserves explicit Clear effects while suppressing action default; cancelled request cannot Clear',async()=>{
  const f=clearFixture({count:2}),context=new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'app.forms.submit']});let after,calls=0;
  const {result}=await measureClear({...f,context},{csrf:'c'.repeat(64),input:{method:'POST',path:'/',form:'field0=posted&field1=posted',action:{target:'form',type:'Submit',csrf:'c'.repeat(64),payload:{}}},
    handlers:[{owner:'form',type:'Submit',run:function(){this.ME.FormState('clear');this.EVENT.Cancel();}}],
    actions:[{page:'home',target:'form',type:'Submit',method:'POST',capability:'app.forms.submit',run:function(){calls++;}}],
    render(model){after=model.runtime;return {html:'fixture',status:200};}});
  assert.equal(result.error,null);assert.equal(calls,0);assert.equal(after.get('field0').properties.value,'');
  const cancelled=await measureClear(f,{cancelled:()=>true});assert.ok(cancelled.result.error);assert.equal(cancelled.observations.length,0);
});

test('observation disabled or throwing cannot change Page results and exposes no field data',async()=>{
  const f=clearFixture({count:8});
  const a=await measureClear(f,{observeFormClear(){throw Error('private');}});
  const b=await measureClear(f,{diagnosticProgress:false,observeFormClear(){assert.fail('disabled');}});
  assert.equal(a.result.error,null);assert.equal(b.result.error,null);assert.deepEqual(a.state,b.state);
});

for(const dirtyValidation of [false,true])test(`unchanged-write elision matches canonical sequential edits and revisions (dirty validation=${dirtyValidation})`,async()=>{
  const {formOperation,descendantFields}=await import('../wydgine/object-model/forms.js');
  const f=clearFixture({count:8,changed:true,dirtyValidation}),original=f.model.runtime,results=[];
  for(const skipUnchanged of [false,true]){
    const edit=original.edit(f.context),changes=[];
    formOperation(descendantFields(original,f.model.registry,'form'),f.model.registry,'clear',undefined,(id,p)=>changes.push([id,p]));
    changes.push(['form',{valid:true}]);let applied=0;
    for(const [id,p]of changes)for(const [name,value]of Object.entries(p)){
      const result=skipUnchanged?setClearProperty(edit,original,f.context,id,name,value):edit.setProperty(id,name,value);
      if(skipUnchanged){assert.equal(typeof result,'boolean');if(result)applied++;}else assert.equal(result,undefined);
    }
    if(skipUnchanged)assert.equal(applied,dirtyValidation?40:8);
    assert.throws(()=>skipUnchanged?setClearProperty(edit,original,f.context,'field0','value',77):edit.setProperty('field0','value',77),{code:'MUTATION.INVALID_PROPERTY'});
    const result=edit.commit();assert.equal(result.revision,1);assert.notEqual(result.runtime,original);
    assert.throws(()=>edit.setProperty('form','valid',true),{code:'MUTATION.CLOSED'});
    results.push({state:dehydrate(result.runtime,{includeSensitive:true}),changes:result.changes});
  }
  assert.deepEqual(results[0],results[1]);assert.equal(original.get('field0').properties.value,'authored');
});
test('elided no-op writes still commit a fresh snapshot, check revision conflicts, and preserve no-op revision behavior',()=>{
  const f=clearFixture({count:8,changed:false}),runtime=f.model.runtime,edit=runtime.edit(f.context);
  assert.equal(setClearProperty(edit,runtime,f.context,'field4','value',[]),false);
  assert.equal(setClearProperty(edit,runtime,f.context,'field0','value',''),false);
  assert.throws(()=>edit.commit({currentRevision:9}),{code:'MUTATION.CONFLICT'});
  const result=edit.commit();assert.equal(result.revision,1);assert.deepEqual(result.changes.modified,[]);
  assert.notEqual(result.runtime.get('field0'),runtime.get('field0'));assert.equal(result.runtime.get('field0').id,runtime.get('field0').id);
});
test('elision rejects non-JSON empty arrays and reserved/unknown properties before considering equality',()=>{
  const f=clearFixture({count:8,changed:false}),edit=f.model.runtime.edit(f.context);
  const extended=[];extended.extra=1;
  assert.throws(()=>setClearProperty(edit,f.model.runtime,f.context,'field4','value',extended),{code:'INPUT.JSON'});
  assert.throws(()=>setClearProperty(edit,f.model.runtime,f.context,'field4','__proto__',[]),{code:'INPUT.DANGEROUS_KEY'});
  assert.throws(()=>setClearProperty(edit,f.model.runtime,f.context,'field4','id','field4'),{code:'MUTATION.IDENTITY'});
  assert.throws(()=>setClearProperty(edit,f.model.runtime,f.context,'field4','unknown',null),{code:'MUTATION.INVALID_PROPERTY'});
  assert.deepEqual(edit.commit().changes.modified,[]);
});
test('validation remains explicit after Clear; invalid required empties revalidate deterministically',async()=>{
  const f=clearFixture({count:2});
  const {result}=await measureClear(f,{handlers:[{owner:'form',type:'Page.Load',run:function(){
    const field=this.ME.related('children','blocks')[0].related('children','blocks')[0].related('children','children')[0];
    field.Set('required',true);this.ME.FormState('clear');assert.equal(this.ME.FormState('isValid'),true);
    assert.equal(this.ME.FormState('validate'),false);assert.equal(field.properties.validationMessage,'Required');
    this.ME.FormState('bind',{field0:'bound'});assert.equal(this.ME.FormState('validate'),true);
  }}]});assert.equal(result.error,null);
});
test('each Clear discovers newly inserted fields and forgets removed fields without caching an initialization tree',async()=>{
  const {envelope}=await import('../test-support/events.js');
  const f=clearFixture({count:2}),context=new ExecutionContext({...f.context,visible:[...f.context.visible,'added'],editable:[...f.context.editable,'added']});
  const {result,observations}=await measureClear({...f,context},{handlers:[{owner:'form',type:'Page.Load',run:function(){
    this.ME.FormState('clear');this.ME.Insert('blocks',1,envelope('added','text-input',{name:'added',value:'new'}));
    this.ME.FormState('clear');assert.equal(this.ME.FormState('values').added,'');
    this.ME.related('children','blocks')[1].Remove();this.ME.FormState('clear');assert.equal(Object.hasOwn(this.ME.FormState('values'),'added'),false);
  }}]});assert.equal(result.error,null);assert.deepEqual(observations.map(r=>r.fields),[2,3,2]);
});
