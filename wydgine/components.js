// Bounded declarative presentation. No executable source, raw HTML or authority.
import { clean, requireThat as check } from './object-model/validation.js';
import { parseMap } from './http/input.js';
import { presentationPolicy } from './presentation-policy.js';
import { checkContext,matchesObjectGrant } from './seam/context.js';
const blocked=new Set(['__proto__','prototype','constructor']);
const tags=new Set(['section','div','p','span','h2','h3','form','label','input','button','ol','ul','li','a','nav','strong']);
const attributes=new Set(['id','class','role','method','action','for','name','type','value','placeholder','href','title','aria-label']);
const ops=new Set(['concat','eq','not','and','or','if','length','add','subtract','min','max','lt','gt','query','queryValid','integer','parameter','url','trim']);
const localURL=value=>{
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020<>]/.test(value))return false;
 const pathname=value.split(/[?#]/)[0];return !/%(?:2f|5c|00)/i.test(pathname);
};
const parameter=value=>typeof value==='string'&&/^[a-z][a-z0-9_-]{0,31}$/.test(value)&&!blocked.has(value);
export function validatePresentation(input){
 const spec=clean(input);let nodes=0;
 const walk=(value,depth=0)=>{check(++nodes<=1024&&depth<=32,'COMPONENT.INVALID','Presentation complexity exceeded');if(value&&typeof value==='object'){
  if(value.op!==undefined)check(ops.has(value.op),'COMPONENT.INVALID','Unsupported expression');
  if(value.get!==undefined)check(typeof value.get==='string'&&value.get.length<=256&&value.get.split('.').length<=16&&value.get.split('.').every(p=>!blocked.has(p)),'COMPONENT.INVALID','Invalid value path');
  if(value.tag!==undefined){check(tags.has(value.tag),'COMPONENT.INVALID','Unsupported element');check(Object.keys(value.attrs??{}).every(a=>attributes.has(a)),'COMPONENT.INVALID','Unsupported attribute');}
  Object.values(value).forEach(v=>walk(v,depth+1));
 }};
 check(spec.schema==='wydgit.presentation/0.1'&&spec.template,'COMPONENT.INVALID','Invalid presentation');
 check(Object.keys(spec).every(k=>['schema','template','request','when','valid'].includes(k)),'COMPONENT.INVALID','Unknown presentation field');
 if(spec.request)check(Object.keys(spec.request).every(k=>['library','apiVersion','operation','input'].includes(k))&&['library','apiVersion','operation'].every(k=>typeof spec.request[k]==='string'),'COMPONENT.INVALID','Invalid service binding');
 walk(spec);return spec;
}
export function evaluate(value,env,budget={steps:0}){
 check(++budget.steps<=32768,'COMPONENT.LIMIT','Expression budget exceeded');
 if(value===null||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map(v=>evaluate(v,env,budget));
 if(Object.hasOwn(value,'get')){let current=env;for(const key of value.get.split('.')){check(!blocked.has(key),'COMPONENT.INVALID','Unsafe path');current=current&&Object.hasOwn(current,key)?current[key]:undefined;}if(typeof current==='string')check(Buffer.byteLength(current)<=65536,'COMPONENT.LIMIT','Expression value too large');return current;}
 if(!value.op)return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,evaluate(v,env,budget)]));
 const ev=v=>evaluate(v,env,budget),args=()=>value.args.map(ev),numbers=()=>{const values=args();check(values.every(v=>typeof v==='number'&&Number.isFinite(v)),'COMPONENT.INVALID','Expected numeric operands');return values;};
 switch(value.op){
 case 'if':return ev(value.test)?ev(value.then):ev(value.else);
 case 'and':return value.args.every(v=>Boolean(ev(v)));
 case 'or':return value.args.some(v=>Boolean(ev(v)));
 case 'not':return !ev(value.value??value.args?.[0]);
 case 'concat':{const parts=args().map(v=>String(v??''));check(parts.reduce((n,v)=>n+Buffer.byteLength(v),0)<=65536,'COMPONENT.LIMIT','Expression value too large');return parts.join('');}
 case 'eq':{const [a,b]=args();return a===b;}
 case 'length':return ev(value.value)?.length??0;
 case 'add':{const [a,b]=numbers();check(Number.isFinite(a+b),'COMPONENT.INVALID','Invalid numeric result');return a+b;}
 case 'subtract':{const [a,b]=numbers();check(Number.isFinite(a-b),'COMPONENT.INVALID','Invalid numeric result');return a-b;}
 case 'min':return Math.min(...numbers());case 'max':return Math.max(...numbers());
 case 'lt':{const [a,b]=numbers();return a<b;}case 'gt':{const [a,b]=numbers();return a>b;}
 case 'trim':return String(ev(value.value)??'').trim();
 case 'parameter':return parameter(ev(value.value));
 case 'query':{const values=env.query[ev(value.name)];return values?.length===1?values[0]:'';}
 case 'queryValid':{const values=env.query[ev(value.name)];return !values||values.length===1;}
 case 'integer':{const text=ev(value.value);if(text==='')return value.default??0;check(typeof text==='string'&&/^\d{1,5}$/.test(text),'COMPONENT.INVALID','Invalid integer');const n=Number(text);check(n>=(value.min??0)&&n<=(value.max??99999),'COMPONENT.INVALID','Integer outside range');return n;}
 case 'url':{const pathname=ev(value.path),params=ev(value.params);check(localURL(pathname),'COMPONENT.INVALID','Unsafe destination');const pairs=Array.isArray(params)?params:Object.entries(params);check(pairs.length<=128&&pairs.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>['string','number'].includes(typeof v)))&&pairs.reduce((n,p)=>n+Buffer.byteLength(String(p[0]))+Buffer.byteLength(String(p[1])),0)<=8192,'COMPONENT.LIMIT','URL budget exceeded');return pathname+'?'+new URLSearchParams(pairs);}
 default:check(false,'COMPONENT.INVALID','Unsupported expression');
 }
}
// Tokens and mutable counters remain kernel-private, never properties or handles.
const presentationLedgers=new WeakMap();
export function createPresentationLedger(context,pageId,settings={}){
 checkContext(context);const policy=presentationPolicy(settings),token=Object.freeze(Object.create(null));
 presentationLedgers.set(token,{context,pageId,limit:Math.min(policy.componentRequests,context.limits.componentRequests??policy.componentRequests),attempts:0,budget:{steps:0}});
 return token;
}
export async function prepareComponents(model,pageId,input,context,libraries,session,ledger){
 checkContext(context);const execution=presentationLedgers.get(ledger);check(execution&&execution.context===context&&execution.pageId===pageId,'SEAM.CONTEXT','Expected owning Page presentation ledger');
 const states=new Map(),query=parseMap(input.query??''),budget=execution.budget;
 const walk=async node=>{if(node.presentation){let state={state:'empty'};const spec=node.presentation,env={properties:node,id:node.id,query};try{
  if(spec.valid&&!evaluate(spec.valid,env,budget))throw new Error('Invalid component input');
  if(spec.request&&(!spec.when||evaluate(spec.when,env,budget))){state={state:'error'};if(execution.attempts<execution.limit&&matchesObjectGrant(context.visible,node.id)&&libraries){execution.attempts++;await session.authorize();const result=await libraries.bindPresentation(context).invoke(spec.request.library,spec.request.apiVersion,spec.request.operation,evaluate(spec.request.input,env,budget));await session.authorize();state=result.ok?{state:'ready',value:result.value}:{state:'error'};}}
 }catch{state={state:'error'};}states.set(node.id,state);}
 for(const slot of ['sections','blocks','children','fields'])for(const child of node[slot]??[])await walk(child);};
 await walk(model.pages.get(pageId));return {states,query};
}
export function renderComponent(node,state,query,path,escape,skin='',claim=()=>{},budget={steps:0,elements:0,bytes:0}){
 const spec=node.presentation,env={properties:node,id:node.id,data:state??{state:'error'},query,path};
 const ids=new Set(),escaped=value=>{const text=String(value??'');check(Buffer.byteLength(text)<=65536,'COMPONENT.LIMIT','Displayed value too large');return escape(text);};
 const ev=v=>evaluate(v,env,budget);
 const render=(part,depth=0)=>{check(++budget.elements<=2048&&depth<=32,'COMPONENT.LIMIT','Render complexity exceeded');if(part.if!==undefined&&!ev(part.if))return '';
  if(part.each){const values=ev(part.each.in);check(Array.isArray(values)&&values.length<=256&&parameter(part.each.as),'COMPONENT.LIMIT','Invalid repeated data');return values.map(value=>{const old=env[part.each.as];env[part.each.as]=value;try{return render({...part,each:undefined},depth+1);}finally{env[part.each.as]=old;}}).join('');}
  check(tags.has(part.tag),'COMPONENT.INVALID','Unsupported element');const attrs=Object.entries(part.attrs??{}).map(([key,expression])=>{check(attributes.has(key),'COMPONENT.INVALID','Unsafe attribute');const value=ev(expression);if(value===undefined||value===null)return '';if(key==='id'){check(typeof value==='string'&&/^[a-zA-Z][\w-]*$/.test(value)&&!ids.has(value),'COMPONENT.INVALID','Invalid or duplicate anchor');ids.add(value);claim(value);}if(['href','action'].includes(key))check(localURL(value),'COMPONENT.INVALID','Unsafe destination');if(key==='method')check(value==='get','COMPONENT.INVALID','Only GET forms supported');return ` ${key}="${escaped(value)}"`;}).join('');
  const body=(part.text!==undefined?escaped(ev(part.text)):'')+(part.children??[]).map(child=>render(child,depth+1)).join('');const html=`<${part.tag}${attrs}${part===spec.template?skin:''}>${body}${['input'].includes(part.tag)?'':`</${part.tag}>`}`;
  budget.bytes+=Buffer.byteLength(html);check(budget.bytes<=1024*1024,'COMPONENT.LIMIT','Render byte budget exceeded');return html;
 };return render(spec.template);
}
