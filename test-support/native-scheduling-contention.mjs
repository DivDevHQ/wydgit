// Synthetic native reports are NOT durable commits. Real Pages, unchanged 1000ms
// ledger and real SEWN interpreter. Pressure is test-only, bounded and opt-in.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {setImmediate as immediate} from 'node:timers/promises';
import {clearFixture,measureClear} from './form-clear.js';
const mode=process.argv[2]??'spin120';
if(!['spin120','spin1100','microtasks','workflow'].includes(mode))throw Error('Unknown experiment');
const fixtures=Array.from({length:4},()=>clearFixture()),rows=[],events=[];
const pressureCallbacks=[];
let admitted=0,release;const barrier=new Promise(resolve=>release=resolve);
const mark=(request,name)=>events.push({request,name,atMs:performance.now()});
const tasks=fixtures.map((f,index)=>{
  const request=index+1;
  const libraries={bind(context,operation){return {async call(){operation.begin();mark(request,'providerEntry');
    if(++admitted===4)setImmediate(release);await barrier;
    operation.committed();mark(request,'syntheticProviderComplete');return {ok:true,value:{}};}};}};
  const startMs=performance.now();let meter;
  return measureClear(f,{libraries,observe:row=>{meter=row.meter;},handlers:[{owner:'form',type:'Page.Load',run:async function(){
    await this.SERVICES.Call('wydstore','create',{});mark(request,'pageContinuation');
    if(request===1){
      mark(request,'pressureStart');const scheduledMs=performance.now();pressureCallbacks.push(immediate().then(()=>({scheduledMs,entryMs:performance.now()})));
      if(mode.startsWith('spin')){const end=performance.now()+Number(mode.slice(4));while(performance.now()<end){/* bounded competing synchronous work */}}
      if(mode==='microtasks')for(let n=0;n<250000;n++)await Promise.resolve();
      if(mode!=='workflow')mark(request,'pressureEnd');
    }
    this.ME.Set('valid',true);mark(request,'setterComplete');
  }},...(request===1&&mode==='workflow'?[{owner:'form',type:'Page.Load',workflow:{schema:'sewn/0.1',body:[{op:'declare',name:'x',value:{op:'literal',value:0}},{op:'forEach',name:'i',items:{op:'literal',value:Array.from({length:900},(_,i)=>i)},body:[{op:'set',name:'x',value:{op:'literal',value:1}}]}]}},{owner:'form',type:'Page.Load',run:function(){mark(request,'pressureEnd');}}]:[])]}).then(async({result})=>{mark(request,'pageComplete');let status;await result.response.send({setHeader(){},getHeader(){},set statusCode(value){status=value;},end(){}});rows.push({request,startMs,endMs:performance.now(),status,error:result.error?.code??null,outcome:result.outcome,services:result.services,meter});});
});
const scheduled=performance.now();const callback=immediate().then(()=>({scheduledMs:scheduled,entryMs:performance.now()}));
await Promise.all(tasks);const scheduling=await callback;const pressureScheduling=await Promise.all(pressureCallbacks);
assert.equal(rows.length,4);assert.ok(rows.every(r=>r.services.pending===0));
console.log(JSON.stringify({mode,syntheticNativeReports:true,rows:rows.sort((a,b)=>a.request-b.request),events,scheduling,pressureScheduling}));
