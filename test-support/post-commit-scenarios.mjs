// Deterministic Page/transport differential. Fake provider reports are explicitly
// synthetic; real provider persistence is qualified by operation-completion tests.
import assert from 'node:assert/strict';
import {installDeadlineLedgerHooks} from './deadline-ledger-hooks.mjs';
const baseline=process.argv[2]==='baseline',observed=process.argv[3]!=='off';
if(observed||baseline)installDeadlineLedgerHooks({baseline,observe:observed});
const {createDeadlineLedger}=await import('./deadline-ledger.js');
const {clearFixture,measureClear}=await import('./form-clear.js');
const {WydgitError}=await import('../wydgine/object-model/validation.js');
const {classifyOutcome}=await import('./http-concurrency.js');
const results=[];
for(const mode of ['success','native-failure','deadline-before','deadline-after','canonical-failure','construction-failure','handoff-failure','cancelled']){
  const f=clearFixture(),capture=observed?createDeadlineLedger({request:1}):null;
  let now=Date.now(),cancelled=false,commits=0,retained;
  const original=Date.now;Date.now=()=>now;
  try{
    const libraries={bind(context,operation){return {async call(){operation.begin();if(mode==='native-failure'){operation.cancelled();return {ok:false,code:'STORE.IO'};}commits++;operation.committed();if(mode==='deadline-after')now+=1001;return {ok:true,value:{}};}};}};
    const run=()=>measureClear(f,{libraries,cancelled:()=>cancelled,
      handlers:[{owner:'form',type:'Page.Load',run:async function(){
        retained=this.ME;if(mode==='deadline-before')now+=1001;
        const saved=await this.SERVICES.Call('wydstore','create',{});if(!saved.ok)return;
        if(mode==='canonical-failure')this.ME.Set('valid','invalid');
        if(mode==='cancelled')cancelled=true;
        this.ME.FormState('clear');assert.equal(this.ME.properties.valid,true);
      }}],...(mode==='construction-failure'?{render(){throw new WydgitError('RESPONSE.LIMIT','injected');}}:{})});
    const {result,state}=await (capture?capture.run(run):run());
    assert.throws(()=>retained.id); // Invocation lifetime remains terminal.
    let body='',status=0,transportError=null;
    const port={statusCode:0,destroyed:false,setHeader(){},getHeader(){},end(value){if(mode==='handoff-failure')throw Error('lost');body=value??'';status=this.statusCode;},destroy(){this.destroyed=true;}};
    try{await result.response.send(port);}catch(error){transportError=error.code;}
    const clientClassification=classifyOutcome({complete:transportError===null,status,outcome:result.outcome},{services:result.services,operationOutcome:result.outcome});
    if(mode==='handoff-failure')assert.equal(clientClassification.writeOutcome,'indeterminate');
    const outcome={mode,commits,error:result.error?.code??null,operationOutcome:result.outcome,services:result.services,status,transportError,body,
      clientWriteOutcome:clientClassification.writeOutcome,
      fieldValues:state?state.slots.pages[0].slots.sections[0].slots.blocks[0].slots.blocks[0].slots.children.map(f=>f.properties.value):null};
    if(mode==='success')assert.equal(status,200);
    if(['deadline-after','canonical-failure','construction-failure','cancelled'].includes(mode)){assert.equal(result.outcome,'indeterminate');assert.equal(status,500);assert.match(body,/indeterminate/);assert.equal(commits,1);}
    if(mode==='deadline-before'){assert.equal(commits,0);assert.equal(result.error.code,'SEWN.LIMIT');}
    results.push({outcome,ledger:capture?.finish()??null});
  }finally{Date.now=original;}
}
console.log(JSON.stringify({baseline,observed,results}));
