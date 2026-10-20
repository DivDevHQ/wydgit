import {loadRepository} from '../wydgine/repository.js';
import {hydrate,dehydrate,ExecutionContext} from '../wydgine/object-model/index.js';
import {webModel} from '../wydgine/web-model.js';
import {executePage} from '../wydgine/execution/page.js';
import {envelope} from './events.js';

const options=[{value:'a',label:'A',enabled:true},{value:'b',label:'B',enabled:true}];
const kinds=['text-input','text-area','checkbox','radio-group','checkbox-group','select','select','password-input'];
export function clearFixture({count=2,changed=true,dirtyValidation=false}={}) {
  const base=loadRepository(process.cwd()),raw=dehydrate(base.runtime);
  const fields=Array.from({length:count},(_,i)=>{
    const kind=kinds[i%kinds.length],multiple=i%8===6;
    const choice=['radio-group','checkbox-group','select'].includes(kind);
    const empty=kind==='checkbox'?false:kind==='checkbox-group'||multiple?[]:choice?null:'';
    const value=changed?(kind==='checkbox'?true:kind==='checkbox-group'||multiple?['a']:choice?'a':'authored'):empty;
    return envelope(`field${i}`,kind,{name:`field${i}`,value,...(choice?{options}:{}),...(kind==='select'?{multiple}:{}),
      ...(dirtyValidation?{valid:false,validationMessage:'Required',errors:['Required'],warnings:['warning']}:{}),label:`Field ${i}`});
  });
  raw.slots.pages=[envelope('home','page',{title:'Clear fixture',slug:''},{sections:[envelope('form','form',{},
    {blocks:[envelope('layout','section',{}, {blocks:[envelope('wrapper','block',{content:{type:'markdown',value:'Fields'}},{children:fields})]})]})]})];
  raw.slots.navigation=[];raw.properties.home='home';
  const runtime=hydrate(raw,base.registry),ids=[];
  const walk=n=>{ids.push(n.id);Object.values(n.slots).flat().forEach(walk);};walk(raw);
  const context=new ExecutionContext({context:'FrontEnd',publisher:'fixture',self:'home',app:runtime.rootId,visible:ids,editable:ids,
    traversal:['children','parent'],capabilities:['object.instances.edit']});
  return {model:webModel(runtime,base),context,pageId:'home',session:{view:{id:'fixture',app:runtime.rootId,authenticated:false},active:()=>true,authorize:async()=>{}}};
}
export async function measureClear(fixture,extra={}) {
  const observations=[];let state;
  const result=await executePage({...fixture,input:{method:'GET',path:'/'},diagnosticProgress:true,
    observeFormClear:row=>observations.push(row),handlers:[{owner:'form',type:'Page.Load',run:function(){this.ME.FormState('clear');}}],
    render(model){state=dehydrate(model.runtime);return {html:'fixture',status:200};},...extra});
  return {result,observations,state};
}
export function summarize(values) {
  const sorted=[...values].sort((a,b)=>a-b);
  return {min:sorted[0],median:sorted[Math.floor(sorted.length/2)],p90:sorted[Math.ceil(sorted.length*.9)-1],max:sorted.at(-1)};
}
