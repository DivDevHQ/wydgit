import { pageSearchSource } from './page-source.js';
import { ExecutionContext } from '../../../wydgine/seam/context.js';
import { loadRepository } from '../../../wydgine/repository.js';
import { tokens,normalize,rank,snippet,safeDestination } from './text.js';
const MiB=1024*1024;
const signature=d=>JSON.stringify([d.id,d.resource,d.owner.publisher,d.owner.package,d.owner.principal,d.title,d.body,d.summary,d.url,d.type,d.categories,d.visibility,d.revision,d.schemaVersion]);
export const defaults=Object.freeze({queryBytes:512,documentBytes:16384,batchDocuments:32,documentTokens:2048,queryTokens:16,pageSize:20,resultCount:256,snippetBytes:320,indexBytes:MiB,indexDocuments:256,queryWork:524288});
export const ceilings=Object.freeze({queryBytes:2048,documentBytes:65536,batchDocuments:64,documentTokens:8192,queryTokens:32,pageSize:50,resultCount:1024,snippetBytes:1024,indexBytes:4*MiB,indexDocuments:1024,queryWork:8388608});
export const manifest={schema:'wydgit.library/0.1',id:'wydsearch',version:'0.1.0-alpha.1',apiVersion:'1.0.0',publisher:'wydgit.core',trust:'canonical',platform:'^0.3.0-alpha.1',targets:['server'],requirements:{schema:'wydgit.requirements/0.1',libraries:[{library:'wydstore',version:'^0.1.0-alpha.3'}]},capabilities:['search.documents.index','search.documents.remove','search.index.rebuild','search.documents.read'],services:[{name:'index',capability:'search.documents.index'},{name:'remove',capability:'search.documents.remove'},{name:'reindex',capability:'search.index.rebuild'},...['search','suggest','metadata'].map(name=>({name,capability:'search.documents.read'}))]};
export async function register({service,options,dependency,failure,checkJson,hostContext}) {
 const searchSource=hostContext.source;
 const fail=code=>{throw failure(code);},check=(ok,code='SEARCH.INVALID_REQUEST')=>{if(!ok)fail(code);};
 const keys=(value,required,optional=[])=>check(value&&typeof value==='object'&&!Array.isArray(value)&&required.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>[...required,...optional].includes(k)));
 const id=value=>typeof value==='string'&&/^[a-zA-Z][\w-]{0,127}$/.test(value);
 keys(options,['indexes'],['limits','pageSource']);check(Array.isArray(options.indexes)&&options.indexes.length>0&&options.indexes.length<=16,'SEARCH.INVALID_CONFIG');
 check(options.limits===undefined||options.limits!==null&&typeof options.limits==='object'&&!Array.isArray(options.limits),'SEARCH.INVALID_CONFIG');
 const limits={...defaults,...options.limits};
 check(Object.keys(limits).every(k=>Object.hasOwn(defaults,k)&&Number.isSafeInteger(limits[k])&&limits[k]>=1&&limits[k]<=ceilings[k]),'SEARCH.INVALID_CONFIG');
 check(searchSource&&typeof searchSource.resolve==='function'&&typeof searchSource.list==='function','SEARCH.INVALID_CONFIG');
 const indexes=new Map();
 for(const index of options.indexes){keys(index,['id','app','store','collection']);check(id(index.id)&&id(index.app)&&id(index.store)&&id(index.collection)&&!indexes.has(index.id),'SEARCH.INVALID_CONFIG');indexes.set(index.id,index);}
 const store=dependency('wydstore');
 check([...indexes.values()].every(index=>index.app===store.identity.app),'SEARCH.INVALID_CONFIG');
 const scope=index=>({store:index.store,collection:index.collection});
 const read=async index=>{
  const result=await store.invoke('1.0.0','get',{...scope(index),id:index.id});
  if(result.code==='STORE.NOT_FOUND')return {version:0,data:{documents:[]}};
  check(result.ok,'SEARCH.STORAGE');
  check(result.value.data.schemaVersion===1&&Array.isArray(result.value.data.documents),'SEARCH.STORAGE');
  check(result.value.data.documents.length<=limits.indexDocuments,'SEARCH.LIMIT');
  try{checkJson(result.value.data,{maxBytes:limits.indexBytes,maxNodes:262144,maxDepth:16});}catch{fail('SEARCH.LIMIT');}
  return result.value;
 };
 const authorize=(request,caller)=>{
  check(request&&id(request.index));const index=indexes.get(request.index);
  check(index&&caller.app===index.app&&caller.scopes.wydsearch?.some(grant=>grant.index===index.id),'SEARCH.DENIED');return true;
 };
 const source=async(index,documentId,caller,maintenance=false)=>{
  const current=await searchSource.resolve(index.id,documentId,caller);
  if(!current)return null;
  // Authority is host-derived; request arguments never select ownership or policy.
  check(current.app===index.app&&id(current.resource)&&typeof current.publisher==='string'&&typeof current.package==='string','SEARCH.SOURCE');
  if(maintenance)check(current.publisher===caller.publisher&&current.package===caller.package&&current.principal===caller.principal&&caller.scopes.wydsearch.some(grant=>grant.index===index.id&&Array.isArray(grant.resources)&&grant.resources.includes(current.resource)),'SEARCH.DENIED');
  check(['public','authenticated'].includes(current.visibility),'SEARCH.UNSUPPORTED_POLICY');
  return current;
 };
 const document=(current,documentId)=>{
  keys(current,['app','resource','publisher','package','principal','published','visibility','revision','title','body','url'],['summary','type','categories','allowed']);
  check(typeof current.published==='boolean'&&typeof current.revision==='string'&&current.revision.length>0&&current.revision.length<=128,'SEARCH.SOURCE');
  check(['title','body'].every(k=>typeof current[k]==='string')&&(!current.summary||typeof current.summary==='string')&&safeDestination(current.url),'SEARCH.INVALID_DOCUMENT');
  check(!/[<>]/.test(current.title+current.body+(current.summary??'')),'SEARCH.INVALID_DOCUMENT');
  const categories=current.categories??[];
  check(Array.isArray(categories)&&categories.length<=16&&categories.every(x=>typeof x==='string'&&Buffer.byteLength(x)<=64)&&typeof(current.type??'page')==='string'&&Buffer.byteLength(current.type??'page')<=64,'SEARCH.INVALID_DOCUMENT');
  const value={id:documentId,resource:current.resource,owner:{publisher:current.publisher,package:current.package,principal:current.principal},title:current.title,body:current.body,summary:current.summary??'',url:current.url,type:current.type??'page',categories,visibility:current.visibility,revision:current.revision,schemaVersion:1};
  try{checkJson(value,{maxBytes:limits.documentBytes,maxNodes:4096,maxDepth:8});}catch{fail('SEARCH.LIMIT');}
  check(tokens(value.title+' '+value.body+' '+value.categories.join(' ')).length<=limits.documentTokens,'SEARCH.LIMIT');return value;
 };
 const accessible=(current,caller)=>current?.published===true&&current.allowed===true&&(current.visibility==='public'||caller.identity?.authenticated===true&&caller.identity.expiresAt>Date.now());
 const query=request=>{
  check(typeof request.query==='string'&&Buffer.byteLength(request.query)<=limits.queryBytes,'SEARCH.LIMIT');
  const phrases=[...request.query.matchAll(/"([^"\n]+)"/g)].map(x=>normalize(x[1]));
  check((request.query.match(/"/g)?.length??0)===phrases.length*2);
  const terms=[...new Set(tokens(request.query))];check(terms.length<=limits.queryTokens,'SEARCH.LIMIT');return {terms,phrases};
 };
 const execute=async(name,request,caller,policy)=>{
  authorize(request,caller);const index=indexes.get(request.index);
  const allowed={index:['id'],remove:['id'],reindex:['ids'],search:['query'],suggest:['query'],metadata:[]};
  keys(request,['index',...allowed[name]],['search','suggest'].includes(name)?['type','category','offset','limit']:[]);
  if(['index','remove'].includes(name))check(id(request.id));
  if(name==='reindex')check(Array.isArray(request.ids)&&request.ids.length<=limits.batchDocuments&&request.ids.every(id)&&new Set(request.ids).size===request.ids.length,'SEARCH.LIMIT');
  if(['index','remove','reindex'].includes(name)){
   const ids=name==='reindex'?request.ids:[request.id];
   // Reindex uses explicit bounded source IDs; no unrestricted source enumeration.
   for(let attempt=0;attempt<3;attempt++){
    const saved=await read(index),documents=[...saved.data.documents];let changed=0;
    for(const documentId of ids){
     const current=await source(index,documentId,caller,true);check(current,'SEARCH.DENIED');
     const at=documents.findIndex(d=>d.id===documentId);
     if(at>=0)check(documents[at].owner.publisher===caller.publisher&&documents[at].owner.package===caller.package&&documents[at].owner.principal===caller.principal,'SEARCH.DENIED');
     if(name==='remove'||!current.published){if(at>=0){documents.splice(at,1);changed++;}continue;}
     const next=document(current,documentId);
     if(at<0){documents.push(next);changed++;}else if(signature(documents[at])!==signature(next)){documents[at]=next;changed++;}
    }
    documents.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    check(documents.length<=limits.indexDocuments,'SEARCH.LIMIT');
    const data={schemaVersion:1,documents};
    try{checkJson(data,{maxBytes:limits.indexBytes,maxNodes:262144,maxDepth:16});checkJson({changed},{...policy.response});}catch{fail('SEARCH.LIMIT');}
    if(!changed)return {changed:0};
    const result=await store.invoke('1.0.0','transaction',{...scope(index),operations:[{operation:saved.version?'update':'create',input:{id:index.id,...(saved.version?{version:saved.version}:{}),data}}]});
    if(result.ok)return {changed};
    if(!['STORE.CONFLICT','STORE.DUPLICATE_ID'].includes(result.code))fail(result.code==='STORE.LIMIT'?'SEARCH.LIMIT':'SEARCH.STORAGE');
   }fail('SEARCH.CONFLICT');
  }
  const parsed=name==='metadata'?{terms:[],phrases:[]}:query(request);
  check(request.limit===undefined||Number.isSafeInteger(request.limit)&&request.limit>=1&&request.limit<=limits.pageSize,'SEARCH.LIMIT');
  check(request.offset===undefined||Number.isSafeInteger(request.offset)&&request.offset>=0&&request.offset<=limits.resultCount,'SEARCH.LIMIT');
  for(const key of ['type','category'])check(request[key]===undefined||typeof request[key]==='string'&&Buffer.byteLength(request[key])<=64);
  if(name!=='metadata'&&!parsed.terms.length)return name==='suggest'?{suggestions:[]}:{results:[],total:0};
  const saved=await read(index),results=[];let work=0;
  for(const indexed of saved.data.documents){
   const current=await source(index,indexed.id,caller);
   if(!accessible(current,caller)||current.revision!==indexed.revision||current.resource!==indexed.resource||current.publisher!==indexed.owner.publisher||current.package!==indexed.owner.package||current.principal!==indexed.owner.principal||current.visibility!==indexed.visibility)continue;
   // Revalidate content itself: an incorrectly unchanged source revision cannot
   // expose old text after a permission/content change.
   const fresh=document(current,indexed.id);if(signature(fresh)!==signature(indexed))continue;
   if(request.type&&indexed.type!==request.type||request.category&&!indexed.categories.includes(request.category))continue;
   if(name==='metadata'){results.push(null);continue;}
   work+=tokens(indexed.title+' '+indexed.body+' '+indexed.categories.join(' ')).length*parsed.terms.length;
   check(work<=limits.queryWork,'SEARCH.LIMIT');const score=rank(indexed,parsed);
   if(score)results.push({id:indexed.id,title:indexed.title,url:indexed.url,type:indexed.type,snippet:snippet(indexed,parsed,limits.snippetBytes),score});
  }
  if(name==='metadata')return {apiVersion:'1.0.0',schemaVersion:1,visibleDocuments:results.length};
  results.sort((a,b)=>b.score-a.score||(a.id<b.id?-1:a.id>b.id?1:0));check(results.length<=limits.resultCount,'SEARCH.LIMIT');
  const page=results.slice(request.offset??0,(request.offset??0)+(request.limit??limits.pageSize));
  return name==='suggest'?{suggestions:page.map(({title,url})=>({title,url}))}:{results:page,total:results.length};
 };
 for(const {name} of manifest.services)service(name,(request,caller,policy)=>execute(name,request,caller,policy).catch(error=>{if(error?.code&&['SEARCH.','STORE.'].some(prefix=>error.code.startsWith(prefix)))throw error;throw failure('SEARCH.FAILED');}),{presentation:['search','suggest','metadata'].includes(name),authorize,validate:()=>true});
}

// Trusted canonical implementation hook; ordinary packages cannot supply code.
export function initialize({root,options,adapter}){
 const source=adapter?.source??pageSearchSource(root);
 return {context:{source},async start(libraries){
  for(const resource of source?.refresh??[]){
   const app=loadRepository(root).runtime.rootId;
   const context=new ExecutionContext({...resource,app,self:'search-maintenance',capabilities:['search.index.rebuild'],scopes:{wydsearch:[{index:resource.index,resources:resource.pages}]}});
   const batch=options.limits?.batchDocuments??defaults.batchDocuments;
   for(let offset=0;offset<resource.pages.length;offset+=batch){const result=await libraries.bind(context).invoke('wydsearch','1.0.0','reindex',{index:resource.index,ids:resource.pages.slice(offset,offset+batch)});if(!result.ok)throw new Error('Approved search refresh failed');}
  }
 }};
}

export function resolvePackageScopes({options,app,scopes}){
 if(!Array.isArray(scopes)||!scopes.every(id=>options.indexes?.some(index=>index.id===id&&index.app===app)))throw new Error('Unauthorized index');
 return scopes.map(index=>({index}));
}
