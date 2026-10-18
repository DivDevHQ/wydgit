import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { load as html } from 'cheerio';
import { temp,project } from '../test-support/wydstore.js';
import { createSearchExample,searchContext,owner,refreshSearch } from '../examples/testsearch/setup.js';
import { loadLibraries } from '../wydgine/libraries/index.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createApp } from '../app.js';
import { renderComponent,prepareComponents,createPresentationLedger } from '../wydgine/components.js';
import definitions from '../examples/search/prototypes.json' with {type:'json'};
const presentation=kind=>definitions.find(d=>d.id==='divdev/'+kind).presentation;
function renderSearch(node,state,query,path,escape){const properties={pageSize:state?.pageSize??10,queryParameter:'q',submitLabel:'Search',showType:true,showSnippet:true,emptyMessage:'Enter a search term to find pages.',noResultsMessage:'No matching pages found.',...node};return renderComponent({...properties,presentation:presentation(node.prototype)},state?{state:state.state,value:state}:undefined,{q:[state?.query??query]},path,escape);}
const prepareSearch=prepareComponents;
import { escapeHtml } from '../wydgine/index.js';
import { initializeHost } from '../wydgine/host.js';
import { pageSearchSource } from '../packages/wydsearch/src/page-source.js';
import platform from '../package.json' with {type:'json'};
import { defaults,ceilings } from '@wydgit/search';
async function custom(t,provider,limits={}) {
 const demo=await createSearchExample(await temp(t),provider);
 demo.config.libraries[0].options.stores[0].root=await temp(t);
 demo.config.libraries[1].options.limits=limits;
 const documents=new Map();
 const source={list:()=>[...documents.keys()],resolve:(_index,id,caller)=>{const value=documents.get(id);return value?{...value,allowed:value.allowed!==false&&(value.visibility!=='authenticated'||caller.identity?.authenticated===true)}:null;}};
 const libraries=await loadLibraries({config:demo.config,root:project,platformVersion:platform.version,adapters:{wydsearch:{source}}});
 const maint=searchContext(null,true),dispatch=libraries.bind(maint);
 const invoke=(name,input={},context=maint)=>libraries.bind(context).invoke('wydsearch','1.0.0',name,{index:'site',...input});
 const put=(id,data={})=>documents.set(id,{app:'boilerplate',resource:id,...owner,published:true,visibility:'public',revision:'1',title:'Wydgit',body:'Portable text',url:'/getting-started/',...data});
 // Use the explicit host resource grants in the example.
 return {...demo,libraries,documents,put,invoke,dispatch,source};
}
for(const provider of ['json','sqlite']) {
 test(`${provider}: search indexing is idempotent, ranked, Unicode-aware, filtered and paginated`,async t=>{
  const f=await custom(t,provider);
  f.put('getting-started',{title:'CAFÉ Wydgit',body:'portable secure application',categories:['docs']});
  f.put('security',{title:'Permissions',body:'café wydgit portable secure application',categories:['docs']});
  f.put('libraries',{title:'Wydgit',body:'café portable application',type:'reference'});
  assert.equal((await f.invoke('reindex',{ids:['getting-started','security','libraries']})).value.changed,3);
  assert.equal((await f.invoke('index',{id:'getting-started'})).value.changed,0);
  let result=(await f.invoke('search',{query:'cafe\u0301 WYDGIT',limit:1})).value;
  assert.equal(result.total,3);assert.equal(result.results[0].id,'getting-started');
  assert.equal((await f.invoke('search',{query:'café wydgit',limit:1,offset:1})).value.results[0].id,'libraries');
  assert.equal((await f.invoke('search',{query:'"portable secure"',category:'docs'})).value.total,2);
  assert.equal((await f.invoke('search',{query:'"secure portable"'})).value.total,0);
  assert.equal((await f.invoke('search',{query:'wydgit',type:'reference'})).value.total,1);
  f.documents.get('libraries').body='changed';f.documents.get('libraries').revision='2';
  assert.equal((await f.invoke('search',{query:'wydgit'})).value.total,2);
  assert.equal((await f.invoke('index',{id:'libraries'})).value.changed,1);
  assert.equal((await f.invoke('remove',{id:'libraries'})).value.changed,1);
  assert.equal((await f.invoke('remove',{id:'libraries'})).value.changed,0);
  assert.equal((await f.invoke('metadata')).value.visibleDocuments,2);
 });
 test(`${provider}: protected data contributes nothing to results, ranking, suggestions or metadata`,async t=>{
  const f=await custom(t,provider);
  f.put('getting-started',{title:'Public wydgit'});f.put('security',{title:'Secret wydgit',body:'secret secret',visibility:'authenticated'});
  f.put('libraries',{title:'Forbidden wydgit',allowed:false});f.put('draft',{published:false,title:'Draft wydgit'});
  assert.equal((await f.invoke('reindex',{ids:['getting-started','security','libraries','draft']})).ok,true);
  const anonymous=searchContext();
  const identity={authenticated:true,app:'boilerplate',userId:'u',sessionId:'s',createdAt:Date.now()-100,expiresAt:Date.now()+100000,roles:[],groups:[],permissions:[]};
  const authenticated=searchContext(identity);
  const expired=searchContext({...identity,createdAt:0,expiresAt:1});
  assert.equal((await f.invoke('search',{query:'secret'},expired)).value.total,0);
  for(const caller of [anonymous,authenticated]){
   const search=(await f.invoke('search',{query:'wydgit'},caller)).value;
   assert.equal(search.total,caller===anonymous?1:2);
   assert.doesNotMatch(JSON.stringify(search),/Forbidden|Draft/);
   assert.equal((await f.invoke('metadata',{},caller)).value.visibleDocuments,search.total);
   assert.equal((await f.invoke('suggest',{query:'wydgit'},caller)).value.suggestions.length,search.total);
  }
  f.documents.get('security').allowed=false;
  assert.equal((await f.invoke('search',{query:'secret'},authenticated)).value.total,0);
  assert.equal((await f.invoke('metadata',{},authenticated)).value.visibleDocuments,1);
  const principal=new ExecutionContext({context:'FrontEnd',...authenticated,principal:'intruder',scopes:{wydsearch:[{index:'different'}]}});
  assert.equal((await f.invoke('metadata',{},principal)).code,'SEARCH.DENIED');
  f.documents.get('getting-started').published=false;
  assert.equal((await f.invoke('search',{query:'wydgit'},authenticated)).value.total,0);
 });
 test(`${provider}: ownership, scopes, capabilities and host limits cannot be spoofed`,async t=>{
  const f=await custom(t,provider);f.put('getting-started');
  for(const extra of [{app:'other'},{principal:'intruder'},{package:'other/package'},{publisher:'other'},{scopes:{}}]){
   const caller=new ExecutionContext({context:'FrontEnd',...searchContext(null,true),...extra});
   for(const operation of ['index','remove','reindex'])assert.equal((await f.invoke(operation,operation==='reindex'?{ids:['getting-started']}:{id:'getting-started'},caller)).code,'SEARCH.DENIED');
  }
  assert.equal((await f.invoke('search',{query:'wydgit'},new ExecutionContext({context:'FrontEnd',...searchContext(),app:'other'}))).code,'SEARCH.DENIED');
  for(const operation of ['index','remove','reindex'])assert.equal((await f.invoke(operation,operation==='reindex'?{ids:['getting-started']}:{id:'getting-started'},searchContext())).code,'SEAM.DENIED');
  assert.equal((await f.invoke('index',{id:'getting-started',principal:owner.principal})).code,'SEARCH.INVALID_REQUEST');
  assert.equal((await f.invoke('search',{query:'wydgit',limits:{queryBytes:999999}})).code,'SEARCH.INVALID_REQUEST');
  assert.equal((await f.invoke('search',{query:'☃'.repeat(200)})).code,'SEARCH.LIMIT');
  assert.equal((await f.invoke('search',{query:Array.from({length:17},(_,i)=>'term'+i).join(' ')})).code,'SEARCH.LIMIT');
  assert.equal((await f.invoke('search',{query:'wydgit',limit:21})).code,'SEARCH.LIMIT');
  assert.equal((await f.invoke('reindex',{ids:Array.from({length:33},(_,i)=>'d'+i)})).code,'SEARCH.LIMIT');
  f.put('security',{visibility:'roles'});assert.equal((await f.invoke('index',{id:'security'})).code,'SEARCH.UNSUPPORTED_POLICY');
  f.put('security',{url:'javascript:alert(1)'});assert.equal((await f.invoke('index',{id:'security'})).code,'SEARCH.INVALID_DOCUMENT');
  f.put('security',{body:'x'.repeat(17000)});assert.equal((await f.invoke('index',{id:'security'})).code,'SEARCH.LIMIT');
  assert.equal((await f.invoke('metadata')).value.visibleDocuments,0);
 });
 test(`${provider}: document title, body and summary accept harmless markup-like plain text`,async t=>{
  const f=await custom(t,provider),text='<img src=x onerror="alert(1)"><script>needle</script>';
  f.put('security',{title:text,body:text,summary:text});
  assert.equal((await f.invoke('index',{id:'security'})).ok,true);
  const result=(await f.invoke('search',{query:'needle'})).value;
  assert.equal(result.total,1);
  const rendered=html(renderSearch({prototype:'search-results'},{state:'ready',...result,query:'needle',offset:0,pageSize:10},'','/search/',escapeHtml));
  assert.equal(rendered('img,script,[onerror]').length,0);
  assert.equal(rendered('.wyd-search-list a').text(),text);
  assert.equal(rendered('.wyd-search-list li p:last-child').text(),text);
 });
 test(`${provider}: bounded reindex rollback and actual service response policy prevent writes`,async t=>{
  const f=await custom(t,provider);f.put('getting-started');f.put('security',{url:'javascript:alert(1)'});
  assert.equal((await f.invoke('reindex',{ids:['getting-started','security']})).code,'SEARCH.INVALID_DOCUMENT');
  assert.equal((await f.invoke('metadata')).value.visibleDocuments,0);
  const tiny=new ExecutionContext({context:'FrontEnd',...searchContext(null,true),limits:{serviceResponseBytes:1}});
  assert.equal((await f.invoke('index',{id:'getting-started'},tiny)).code,'SEARCH.LIMIT');
  assert.equal((await f.invoke('metadata')).value.visibleDocuments,0);
  for(const limits of [{queryBytes:ceilings.queryBytes+1},{queryBytes:0},{unexpected:1},null,[]]){
   f.config.libraries[1].options.limits=limits;
   await assert.rejects(()=>loadLibraries({config:f.config,root:project,platformVersion:platform.version,adapters:{wydsearch:{source:f.source}}}));
  }
  f.config.libraries[1].options.limits={};f.config.libraries[1].options.indexes[0].app='other';
  await assert.rejects(()=>loadLibraries({config:f.config,root:project,platformVersion:platform.version,adapters:{wydsearch:{source:f.source}}}));
 });
 test(`${provider}: concurrent indexing preserves both writers and deleted sources stay undiscoverable`,async t=>{
  const f=await custom(t,provider);f.put('getting-started');f.put('security');
  const outcomes=await Promise.all(['getting-started','security'].map(id=>f.invoke('index',{id})));
  assert.ok(outcomes.every(result=>result.ok));assert.equal((await f.invoke('metadata')).value.visibleDocuments,2);
  f.documents.delete('security');
  assert.equal((await f.invoke('metadata')).value.visibleDocuments,1);
  assert.equal((await f.invoke('suggest',{query:'wydgit'})).value.suggestions.length,1);
  f.put('security',{published:false});assert.equal((await f.invoke('remove',{id:'security'})).value.changed,1);
  assert.equal((await f.invoke('metadata')).value.visibleDocuments,1);
 });
 test(`${provider}: token, index, work and snippet policies are independent bounded host controls`,async t=>{
  const f=await custom(t,provider,{documentTokens:8,indexDocuments:1,queryWork:1,snippetBytes:12});
  f.put('getting-started',{body:'a b c d e f g h i'});assert.equal((await f.invoke('index',{id:'getting-started'})).code,'SEARCH.LIMIT');
  f.put('getting-started',{body:'café portable'});assert.equal((await f.invoke('index',{id:'getting-started'})).ok,true);
  f.put('security');assert.equal((await f.invoke('index',{id:'security'})).code,'SEARCH.LIMIT');
  assert.equal((await f.invoke('metadata')).value.visibleDocuments,1);
  assert.equal((await f.invoke('search',{query:'wydgit'})).code,'SEARCH.LIMIT');
  f.config.libraries[1].options.limits={snippetBytes:12};
  const registry=await loadLibraries({config:f.config,root:project,platformVersion:platform.version,adapters:{wydsearch:{source:f.source}}});
  const result=await registry.bind(searchContext()).invoke('wydsearch','1.0.0','search',{index:'site',query:'café'});
  assert.ok(Buffer.byteLength(result.value.results[0].snippet)<=12);
 });
 test(`${provider}: Page extraction decodes once, refreshes old indexes and bounds decoded documents`,async t=>{
  const f=await createSearchExample(await temp(t),provider);
  const edit=async markdown=>{
   const location=path.join(f.root,'content/installed-packages.json'),state=JSON.parse(await fs.readFile(location)),tree=JSON.parse(state.app);
   const walk=node=>{if(node.id==='getting-started')node.properties.description='';if(node.id==='getting-started-body')node.properties.content={type:'markdown',value:markdown};Object.values(node.slots).flat().forEach(walk);};
   walk(tree);state.app=JSON.stringify(tree);await fs.writeFile(location,JSON.stringify(state));
  };
  const source=pageSearchSource(f.root),invoke=(libraries,name,input)=>libraries.bind(searchContext(null,true)).invoke('wydsearch','1.0.0',name,{index:'site',...input});
  await edit('Fish & chips; x < y');
  const decoded=source.resolve('site','getting-started');
  assert.match(decoded.body,/Fish & chips; x < y/);
  // Seed the persisted pre-fix representation through the same service/store path.
  const legacy={...source,resolve:(index,id)=>{const current=source.resolve(index,id);return id==='getting-started'?{...current,body:current.body.replaceAll('&','&amp;').replaceAll('<','&lt;'),revision:'pre-fix'}:current;}};
  const old=await loadLibraries({config:f.config,root:project,platformVersion:platform.version,adapters:{wydsearch:{source:legacy}}});
  assert.equal((await invoke(old,'search',{query:'amp lt'})).value.total,1);
  assert.equal((await invoke(f.libraries,'search',{query:'Fish'})).value.total,0);
  const restarted=await initializeHost({root:f.root});
  assert.equal((await invoke(restarted,'index',{id:'getting-started'})).value.changed,0);
  const result=(await invoke(restarted,'search',{query:'Fish'})).value;
  assert.equal(result.total,1);assert.match(result.results[0].snippet,/fish & chips; x < y/);
  const rendered=html(renderSearch({prototype:'search-results'},{state:'ready',...result,query:'Fish',offset:0,pageSize:10},'','/search/',escapeHtml));
  assert.match(rendered('.wyd-search-list li p:last-child').text(),/fish & chips; x < y/);
  for(const query of ['amp','lt'])assert.equal((await invoke(restarted,'search',{query})).value.total,0);
  await edit('Named &copy; numeric &#233; hex &#x1F41F; Unicode café. Literal `&amp;` and &amp;amp;.\n\nalpha\n\nbeta\n\n`<img src=x onerror="alert(1)"><script>needle</script>`');
  const current=source.resolve('site','getting-started');
  assert.notEqual(current.revision,decoded.revision);
  assert.match(current.body,/Named © numeric é hex 🐟 Unicode café/);
  assert.match(current.body,/Literal &amp; and &amp;/);
  assert.match(current.body,/alpha\s+beta/);
  assert.equal((await invoke(restarted,'reindex',{ids:['getting-started']})).value.changed,1);
  assert.equal((await invoke(restarted,'reindex',{ids:['getting-started']})).value.changed,0);
  for(const query of ['café','alpha beta','needle'])assert.equal((await invoke(restarted,'search',{query})).value.total,1);
  assert.equal((await invoke(restarted,'search',{query:'alphabeta'})).value.total,0);
  const hostile=(await invoke(restarted,'search',{query:'needle'})).value;
  const safe=html(renderSearch({prototype:'search-results'},{state:'ready',...hostile,query:'needle',offset:0,pageSize:10},'','/search/',escapeHtml));
  assert.equal(safe('img,script,[onerror]').length,0);assert.match(safe('.wyd-search-list li p:last-child').text(),/<img src=x onerror=/);
  await edit('&#233; '.repeat(20));
  const limited=async limits=>loadLibraries({config:{...f.config,libraries:f.config.libraries.map(l=>l.id==='wydsearch'?{...l,options:{...l.options,limits}}:l)},root:project,platformVersion:platform.version,adapters:{wydsearch:{source:{...source,refresh:undefined}}}});
  assert.equal((await invoke(await limited({documentTokens:8}),'index',{id:'getting-started'})).code,'SEARCH.LIMIT');
  assert.equal((await invoke(await limited({documentBytes:600}),'index',{id:'getting-started'})).ok,true);
  assert.equal((await invoke(await limited({documentBytes:400}),'index',{id:'getting-started'})).code,'SEARCH.LIMIT');
  await edit('&#233; '.repeat(3000));
  assert.equal((await invoke(restarted,'index',{id:'getting-started'})).code,'SEARCH.LIMIT');
  await edit('x'.repeat(65537));assert.throws(()=>source.resolve('site','getting-started'),/Search source size/);
 });
 test(`${provider}: native Search Bar GET submission renders ranked results, pagination, themes and refreshed content`,async t=>{
  const root=await temp(t),f=await createSearchExample(root,provider);
  const app=createApp({root,libraries:f.libraries});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
  const base='http://127.0.0.1:'+server.address().port;
  const initial=html(await(await fetch(base+'/search/')).text());
  assert.match(initial('.wyd-search-results').text(),/Enter a search term/);
  const form=initial('form[role=search]');assert.equal(form.attr('method'),'get');assert.equal(form.find('input').attr('name'),'q');
  const submitted=new URL(form.attr('action'),base);submitted.search=new URLSearchParams({q:'Wydgit'});
  const response=await fetch(submitted),page=html(await response.text());assert.equal(response.status,200);
  assert.equal(page('.wyd-search-list li').length,2);assert.equal(page('.wyd-search-list li a').first().text(),'Getting Started with Wydgit');
  assert.doesNotMatch(page('.wyd-search-results').text(),/Secret|draft credentials/);
  const next=page('.wyd-search-pagination a').attr('href');assert.equal(new URL(next,base).searchParams.get('q'),'Wydgit');
  const later=html(await(await fetch(new URL(next,base))).text());assert.equal(later('.wyd-search-list li').length,2);
  assert.match(await(await fetch(base+'/css/site.css')).text(),/wyd-form-inline/);
  assert.match(await(await fetch(base+'/css/skins.css')).text(),/data-wyd-theme="dark"/);
  assert.equal(page('html').attr('data-wyd-theme'),'dark');
  // Simulate accepted owner edits to the installed App snapshot, then restart transport.
  const editAccepted=async(id,values)=>{const location=path.join(root,'content/installed-packages.json'),state=JSON.parse(await fs.readFile(location));const tree=JSON.parse(state.app);const walk=node=>{if(node.id===id)Object.assign(node.properties,values);Object.values(node.slots).flat().forEach(walk);};walk(tree);state.app=JSON.stringify(tree);await fs.writeFile(location,JSON.stringify(state));};
  await editAccepted('security',{title:'Updated Wydgit Security'});
  assert.equal((await f.libraries.bind(searchContext()).invoke('wydsearch','1.0.0','search',{index:'site',query:'Security'})).value.total,0);
  assert.equal((await refreshSearch(f.libraries)).ok,true);
  assert.match(JSON.stringify((await f.libraries.bind(searchContext()).invoke('wydsearch','1.0.0','search',{index:'site',query:'Security'})).value),/Updated Wydgit Security/);

 });
}
test('UI safely encodes Unicode queries, rejects unsafe destinations and escapes result text',()=>{
 const node={id:'search',prototype:'search-bar',destination:'/search/',placeholder:'Find',label:'Search'};
 const form=html(renderSearch(node,null,'café & Wydgit','/search/',escapeHtml));assert.equal(form('input').attr('value'),'café & Wydgit');
 assert.throws(()=>renderSearch({...node,destination:'//evil.test'},null,'','/',escapeHtml));
 const rendered=html(renderSearch({...node,prototype:'search-results'},{state:'ready',query:'<script>',results:[{title:'<img>',snippet:'<script>',type:'<b>',url:'/safe/'}],total:2,offset:0,pageSize:1},'','/search/',escapeHtml));
 assert.equal(rendered('script,img,b').length,0);assert.equal(new URL(rendered('nav a').attr('href'),'https://example.test').searchParams.get('q'),'<script>');
});
test('native Results composition has a bounded aggregate service-call budget',async()=>{
 const page={sections:[{blocks:Array.from({length:8},(_,i)=>({id:'search-'+i,prototype:'block',presentation:presentation('search-results'),index:'site',queryParameter:'q',pageSize:2}))}]};
 let calls=0;const libraries={bindPresentation:()=>({invoke:async()=>{calls++;return {ok:true,value:{results:[],total:0}};}})};
 for(const [componentRequests,expected] of [[100,4],[1,1],[0,0]]){
  calls=0;const context=new ExecutionContext({context:'FrontEnd',...searchContext(),limits:{componentRequests}});
  await prepareSearch({pages:new Map([['search',page]])},'search',{query:'q=wydgit'},context,libraries,{authorize:async()=>{}},createPresentationLedger(context,'search'));
  assert.equal(calls,expected);
 }
});
