import {validatePresentation} from './presentation-contract.js';
export {validatePresentation} from './presentation-contract.js';
// Bounded declarative presentation. No executable source, raw HTML or authority.
import { clean, requireThat as check } from './object-model/validation.js';
import { parseMap } from './http/input.js';
import { presentationPolicy } from './presentation-policy.js';
import { checkContext,matchesObjectGrant } from './seam/context.js';
const blocked=new Set(['__proto__','prototype','constructor']);
const tags=new Set(['section','div','p','span','h2','h3','form','label','input','button','ol','ul','li','a','nav','strong','audio','video','source','img']);
const attributes=new Set(['id','class','role','method','action','for','name','type','value','placeholder','href','title','aria-label','src','alt','controls','preload','enctype','accept','required','autocomplete','maxlength']);
const ops=new Set(['concat','eq','not','and','or','if','length','add','subtract','min','max','lt','gt','query','queryValid','integer','parameter','url','trim']);
const localURL=value=>{
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020<>]/.test(value))return false;
 const pathname=value.split(/[?#]/)[0];return !/%(?:2f|5c|00)/i.test(pathname);
};
const parameter=value=>typeof value==='string'&&/^[a-z][a-z0-9_-]{0,31}$/.test(value)&&!blocked.has(value);
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
export function renderComponent(node,state,query,path,escape,skin='',claim=()=>{},budget={steps:0,elements:0,bytes:0},transport={}){
 check(node.presentation?.schema!=='wydgit.presentation/0.2','COMPONENT.TARGET','Client control presentation has no HTTP mapping');
 const spec=node.presentation,env={properties:node,id:node.id,csrf:transport.csrf??'',transfer:transport.path??'',data:state??{state:'error'},query,path};
 const ids=new Set(),escaped=value=>{const text=String(value??'');check(Buffer.byteLength(text)<=65536,'COMPONENT.LIMIT','Displayed value too large');return escape(text);};
 const ev=v=>evaluate(v,env,budget);
 const render=(part,depth=0)=>{check(++budget.elements<=2048&&depth<=32,'COMPONENT.LIMIT','Render complexity exceeded');if(part.if!==undefined&&!ev(part.if))return '';
  if(part.each){const values=ev(part.each.in);check(Array.isArray(values)&&values.length<=256&&parameter(part.each.as),'COMPONENT.LIMIT','Invalid repeated data');return values.map(value=>{const old=env[part.each.as];env[part.each.as]=value;try{return render({...part,each:undefined},depth+1);}finally{env[part.each.as]=old;}}).join('');}
  check(tags.has(part.tag),'COMPONENT.INVALID','Unsupported element');const attrs=Object.entries(part.attrs??{}).map(([key,expression])=>{check(attributes.has(key),'COMPONENT.INVALID','Unsafe attribute');let value=ev(expression);if(part===spec.template&&key==='class'&&transport.classes)value=[value,transport.classes].filter(Boolean).join(' ');if(value===undefined||value===null)return '';if(key==='value'&&part.tag==='input'&&ev(part.attrs?.type)==='password')return ' value=""';if(key==='autocomplete')check(['username','nickname','current-password','new-password','off'].includes(value),'COMPONENT.INVALID','Invalid autofill hint');if(key==='maxlength')check(Number.isSafeInteger(value)&&value>=1&&value<=8192,'COMPONENT.INVALID','Invalid character bound');if(key==='id'){check(typeof value==='string'&&/^[a-zA-Z][\w-]*$/.test(value)&&!ids.has(value),'COMPONENT.INVALID','Invalid or duplicate anchor');ids.add(value);claim(value);}if(['href','action','src'].includes(key))check(localURL(value),'COMPONENT.INVALID','Unsafe destination');if(key==='action'&&part.tag==='form'&&ev(part.attrs.method)==='post')check(value.split('?')[0]===transport.path,'COMPONENT.INVALID','Submission must use its approved endpoint');if(key==='method')check((value==='get'||value==='post'&&spec.submission),'COMPONENT.INVALID','Unapproved form method');if(['controls','required'].includes(key))return value===true?` ${key}`:'';if(key==='enctype')check(value==='multipart/form-data'&&spec.submission,'COMPONENT.INVALID','Invalid encoding');if(key==='preload')check(['none','metadata'].includes(value),'COMPONENT.INVALID','Invalid preload');return ` ${key}="${escaped(value)}"`;}).join('');
  const body=(part.text!==undefined?escaped(ev(part.text)):'')+(part.children??[]).map(child=>render(child,depth+1)).join('');const fixedClasses=part===spec.template&&transport.classes&&!Object.hasOwn(part.attrs??{},'class')?` class="${escaped(transport.classes)}"`:'';const html=`<${part.tag}${attrs}${fixedClasses}${part===spec.template?skin:''}>${body}${['input','source','img'].includes(part.tag)?'':`</${part.tag}>`}`;
  budget.bytes+=Buffer.byteLength(html);check(budget.bytes<=1024*1024,'COMPONENT.LIMIT','Render byte budget exceeded');return html;
 };return render(spec.template);
}
