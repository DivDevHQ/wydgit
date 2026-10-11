import fs from 'node:fs/promises';
import path from 'node:path';
import { ExecutionContext } from '../../wydgine/seam/context.js';
import { pageSearchSource } from '../../packages/wydsearch/src/page-source.js';
import { loadLibraries } from '../../wydgine/libraries/index.js';
import platform from '../../package.json' with {type:'json'};
import { planOperatorInstall,applyOperatorInstall } from '../../scripts/package-infrastructure.js';
import { loadRepository } from '../../wydgine/repository.js';
export const owner={publisher:'wydgit.core',package:'host:site-search',principal:'host:site-search'};
export const pageIds=['getting-started','security','libraries','portability','draft'];
const envelope=(id,prototype,properties={},slots={})=>({schema:'wydgit/0.2',id,prototype:'wydgit.core/'+prototype,properties,slots,provenance:{}});
export function searchContext(identity=null,maintenance=false) {
 return new ExecutionContext({...owner,app:'boilerplate',self:'search',identity,visible:['search-*'],capabilities:['search.documents.read',...(maintenance?['search.documents.index','search.documents.remove','search.index.rebuild']:[])],scopes:{wydsearch:[{index:'site',...(maintenance?{resources:pageIds}:{})}]}});
}
export async function createSearchExample(root,provider='json') {
 const project=path.resolve(import.meta.dirname,'../..');
 for(const directory of ['content','prototypes','public'])await fs.cp(path.join(project,directory),path.join(root,directory),{recursive:true});
 // Demo keeps one host-owned principal per Page and uses only native routes.
 await fs.rm(path.join(root,'content/pages'),{recursive:true});await fs.mkdir(path.join(root,'content/pages'));
 const pages=[['getting-started','Getting Started with Wydgit','Learn to build reusable Wydgits and customize your website. Wydgit makes site composition portable.'],['security','Wydgit Security and Permissions','How site owners control access to platform capabilities.'],['libraries','Canonical Libraries','Explore WydStore, WydSearch, WydStream, and other Wydgit platform services.'],['portability','Portable Wydgit applications','Use portable Wydgit application logic with JSON or SQLite storage.'],['draft','Secret unpublished Wydgit draft','Secret draft credentials should never appear in search.']];
 for(const [id,title,body] of pages){const page=envelope(id,'page',{title,slug:id,description:body,searchable:true,published:id!=='draft'},{sections:[envelope(id+'-section','section',{}, {blocks:[envelope(id+'-body','block',{content:{type:'markdown',value:'# '+title+'\n\n'+body}})]})]});await fs.writeFile(path.join(root,'content/pages/'+id+'.json'),JSON.stringify(page));}
 const app=JSON.parse(await fs.readFile(path.join(root,'content/app.json'),'utf8'));app.properties.home='getting-started';app.properties.tagline='';app.properties.footer='Portable search powered by WydSearch';app.properties.themeMode='dark';app.properties.skin='search-demo';await fs.writeFile(path.join(root,'content/app.json'),JSON.stringify(app));
 await fs.writeFile(path.join(root,'content/skins/search-demo.json'),JSON.stringify({id:'search-demo',prototype:'skin',title:'Search demo',tokens:{'body-size':'14px','content-width':'748px','section-space':'16px'},darkTokens:{paper:'#181818',surface:'#181818',ink:'#ffffff',muted:'#aaaaaa',line:'#292929',link:'#0099ff',primary:'#ffffff','primary-text':'#222222'}}));
 await fs.writeFile(path.join(root,'content/navigation.json'),'[]');
 await fs.symlink(path.join(project,'node_modules'),path.join(root,'node_modules'),'dir');
 const initial={schema:'wydgit.host/0.1',libraries:[{id:'wydstore',package:'@wydgit/store',enabled:false,version:'^0.1.0-alpha.3',publisher:'wydgit.core',trust:'canonical',options:{stores:[]}}]};
 await fs.writeFile(path.join(root,'wydgit.config.json'),JSON.stringify(initial));
 const packagePath=path.join(project,'examples/search'),manifest=JSON.parse(await fs.readFile(path.join(packagePath,'manifest.json')));
 const model=loadRepository(root),ids=[];const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(model.runtime.rootId);
 const installationContext=new ExecutionContext({publisher:'operator',app:'boilerplate',self:'boilerplate',capabilities:['object.instances.edit'],visible:[...ids,'search','wydsearch','wydsearch-*'],editable:[...ids,'search','wydsearch','wydsearch-*']});
 const policy={installationContext,placement:{page:'search',parent:'search',slot:'sections',index:0},page:envelope('search','page',{title:'Search',slug:'search'}),approvals:manifest.permissions,storageMappings:{},properties:{'wydsearch-bar':{placeholder:'Search Wydgit'},'wydsearch-results':{pageSize:2}},additions:pageIds.map((id,i)=>({placement:{page:id,parent:id,slot:'sections',index:0},instance:{...envelope('wydsearch-header-'+i,'section',{position:'header'},{blocks:[{...envelope('wydsearch-bar-'+i,'search-bar',{destination:'/search/',placeholder:'Search Wydgit'}),prototype:'divdev/search-bar'}]}),prototype:'divdev/search-section'}})),infrastructure:{enableWydstore:true,stores:[],search:{index:'site',pages:pageIds,provider,location:'.wydgit-data/search-site'}}};
 await applyOperatorInstall(await planOperatorInstall({root,packagePath,manifest,policy,installationContext}));
 const config=JSON.parse(await fs.readFile(path.join(root,'wydgit.config.json')));config.libraries.sort((a,b)=>a.id==='wydstore'?-1:b.id==='wydstore'?1:0);
 const libraries=await loadLibraries({config,root:project,platformVersion:platform.version,adapters:{wydsearch:{source:pageSearchSource(root)}}});
 const result=await refreshSearch(libraries);if(!result.ok)throw new Error(result.code);
 return {root,libraries,config};
}
export const refreshSearch=libraries=>libraries.bind(searchContext(null,true)).invoke('wydsearch','1.0.0','reindex',{index:'site',ids:pageIds});
