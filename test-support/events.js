import { loadRepository } from '../wydgine/repository.js';
import { hydrate,dehydrate } from '../wydgine/object-model/index.js';
import { webModel } from '../wydgine/web-model.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { executePage } from '../wydgine/execution/page.js';
import { EventEmitter } from 'node:events';
export const envelope=(id,kind,properties={},slots={})=>({schema:'wydgit/0.2',id,prototype:`wydgit.core/${kind}`,properties,slots,provenance:{}});
export function modelFixture(){const base=loadRepository(process.cwd()),raw=dehydrate(base.runtime);raw.slots.pages=[envelope('home','page',{title:'Test',slug:''},{sections:[envelope('section','section',{}, {blocks:[envelope('form','form',{}, {blocks:[envelope('name','field',{name:'name',label:'Name',required:true}),envelope('note','field',{name:'note',label:'Note'})]})]})]})];raw.properties.home='home';raw.slots.navigation=[];return webModel(hydrate(raw,base.registry),base);}
export const session={view:{id:'sessionA',app:'app',authenticated:false},active:()=>true,authorize:async()=>{}};
export function fixture(extra={}){
 const model=modelFixture(),app=model.runtime.rootId,ids=['home','section','form','name','note','thanks','extra'];
 const context=new ExecutionContext({publisher:'acme',package:'acme/example',self:'home',app,visible:ids,editable:ids,traversal:['children','parent'],capabilities:['object.instances.edit','response.markdown.write','response.status.write','response.headers.write','response.cookies.write','request.cookies.read','event.custom.raise','app.forms.submit'],scopes:{events:['Cart.Added'],cookies:[{name:'theme',path:'/'}],headers:['cache-control']},...extra});
 return {model,context,session:{...session,view:{...session.view,app}}};
}
export class Transport extends EventEmitter {
 constructor(){super();this.headers=new Map();this.chunks=[];this.destroyed=false;}
 setHeader(key,value){this.headers.set(key.toLowerCase(),value);}getHeader(key){return this.headers.get(key.toLowerCase());}
 write(value){this.chunks.push(Buffer.from(value));return true;}end(value){if(value)this.write(value);this.complete=true;}destroy(){this.destroyed=true;this.emit('close');}
 get text(){return Buffer.concat(this.chunks).toString();}
}
export async function runPage(options={}){
 const base=fixture(),input={method:'GET',path:'/',cookies:{theme:'dark'},...options.input};
 const result=await executePage({...base,pageId:'home',csrf:'c'.repeat(64),...options,input});const transport=new Transport();await result.response.send(transport);return {...result,transport};
}
