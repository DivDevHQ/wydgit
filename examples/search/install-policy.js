// Trusted operator choices only, consumed by the existing package plan/apply path.
import { ExecutionContext } from '../../wydgine/seam/context.js';
import { requireThat as check } from '../../wydgine/object-model/validation.js';
import { pagePath } from '../../wydgine/index.js';
import { validQueryParameter } from './config.js';
const yes=answer=>/^y(?:es)?$/i.test(answer.trim());
const envelope=(id,prototype,properties={},slots={})=>({schema:'wydgit/0.2',id,prototype,properties,slots,provenance:{}});
export async function searchPackagePolicy({model,manifest,config,ask,write,chooseOne}) {
 const app=model.runtime.rootId,index=manifest.permissions.scopes.wydsearch[0];
 const choice=await chooseOne('Results Page',[...model.pages.keys(),'Create Search Results Page'],model.pages.has('search')?'search':'Create Search Results Page',ask,write);
 let page,pageId=choice;
 if(choice==='Create Search Results Page'){
  pageId=(await ask('New Page ID [search]: ')).trim()||'search';
  const slug=(await ask('New Page slug [search]: ')).trim()||'search';
  check(!model.pages.has(pageId)&&/^[a-z][a-z0-9-]*$/.test(pageId)&&/^[a-z][a-z0-9-]*$/.test(slug),'PACKAGE.PLACEMENT','Choose a new safe Page ID and slug');
  page=envelope(pageId,'wydgit.core/page',{title:'Search',slug},{});
 }
 const destination=page?'/'+page.properties.slug+'/':pagePath(model.pages.get(pageId),model.site);
 const parameter=(await ask('Query parameter [q]: ')).trim()||'q';check(validQueryParameter(parameter),'PACKAGE.POLICY','Invalid query parameter');
 const size=Number((await ask('Results per page [10]: ')).trim()||10);check(Number.isSafeInteger(size)&&size>=1&&size<=50,'PACKAGE.POLICY','Results per page must be bounded');
 const eligible=[...model.pages.values()].filter(p=>p.published!==false&&p.id!==pageId).map(p=>p.id);
 write('Explicitly approved PUBLIC source Pages: '+eligible.join(', '));
 const selection=(await ask('Public Page IDs to index (comma-separated; empty selects listed Pages): ')).trim();
 const pages=selection?selection.split(',').map(s=>s.trim()):eligible;
 check(pages.length>0&&pages.every(id=>eligible.includes(id))&&new Set(pages).size===pages.length,'PACKAGE.POLICY','Choose existing public Pages');
 const existing=config.libraries.find(l=>l.id==='wydsearch')?.options?.indexes?.find(i=>i.id===index);
 const search={index,pages};
 if(!existing){search.provider=(await chooseOne('WydStore provider',['JSON','SQLite'],'JSON',ask,write)).toLowerCase();search.location='.wydgit-data/search-'+index;}
 write('Proposed canonical search infrastructure: '+JSON.stringify(search));
 if(!yes(await ask('Approve canonical WydSearch/WydStore enablement and search infrastructure? [y/N] ')))return null;
 const additions=[];
 const targets=(await ask('Add independent Search Bars to existing Pages (comma-separated IDs, empty for none): ')).trim();
 if(targets)for(const [i,id] of targets.split(',').map(x=>x.trim()).entries()){
  check(model.pages.has(id)&&id!==pageId,'PACKAGE.PLACEMENT','Choose an existing Page');
  const placeholder=(await ask(`Placeholder for ${id} [Search this site]: `)).trim()||'Search this site';
  additions.push({placement:{page:id,parent:id,slot:'sections',index:0},instance:envelope('wydsearch-header-'+i,'divdev/search-section',{position:'header'},{blocks:[envelope('wydsearch-bar-'+i,'divdev/search-bar',{destination,placeholder,queryParameter:parameter})]})});
 }
 const placement={page:pageId,parent:pageId,slot:'sections',index:page?0:model.runtime.get(pageId).slots.sections.length};
 let navigation;
 if(model.navigation.length&&yes(await ask('Add a Search link to existing App navigation? [y/N] '))){const id=await chooseOne('Navigation',model.navigation.map(n=>n.id),model.navigation[0].id,ask,write);navigation={id,label:'Search'};}
 const ids=[];for(const id of [app,...model.pages.keys()]){const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(id);}
 const grants=[...new Set([...ids,...manifest.permissions.visible,...(page?[pageId]:[])])];
 return {placement,approvals:JSON.parse(JSON.stringify(manifest.permissions)),storageMappings:{},...(page?{page}:{}),...(navigation?{navigation}:{}),...(additions.length?{additions}:{}),properties:{'wydsearch-bar':{destination,queryParameter:parameter},'wydsearch-results':{queryParameter:parameter,pageSize:size}},infrastructure:{enableWydstore:true,stores:[],search},installationContext:new ExecutionContext({publisher:'operator',app,self:app,capabilities:['object.instances.edit'],visible:grants,editable:grants})};
}
