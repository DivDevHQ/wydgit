// Trusted operator helper; never loaded as ordinary package executable source.
import { ExecutionContext } from '../../wydgine/seam/context.js';
export async function mediaPackagePolicy({model,manifest,config,ask,write,chooseOne}) {
 const app=model.runtime.rootId,resource=manifest.permissions.scopes.wydstream[0],page=await chooseOne('Media Page',[...model.pages.keys()],model.site.home,ask,write);
 const existing=config.libraries.find(l=>l.id==='wydstream'&&l.enabled)?.options?.apps?.find(a=>a.app===app&&a.resource===resource);
 const infrastructure={enableWydstore:true,stores:[]};
 if(!existing){
  const provider=(await chooseOne('Metadata provider',['JSON','SQLite'],'JSON',ask,write)).toLowerCase();
  const categories=(await ask('Allowed media categories [image,audio,video,file]: ')).trim()||'image,audio,video,file';
  infrastructure.media={resource,provider,metadataLocation:'.wydgit-data/media-metadata',binaryLocation:'.wydgit-data/media-binary',categories:categories.split(',').map(x=>x.trim())};
  write('Proposed App-scoped media infrastructure: '+JSON.stringify(infrastructure.media));
  if(!/^y(?:es)?$/i.test((await ask('Approve WydStream/WydStore/WydFiles enablement and media provisioning? [y/N] ')).trim()))return null;
 }
 const ids=[];const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(app);
 const grants=[...ids,...manifest.permissions.visible];
 return {placement:{page,parent:page,slot:'sections',index:model.runtime.get(page).slots.sections.length},approvals:structuredClone(manifest.permissions),storageMappings:{},properties:{'wydmedia-upload':{acceptedCategories:existing?.categories??infrastructure.media.categories,accept:(existing?.categories??infrastructure.media.categories).map(c=>c==='file'?'.pdf,.zip':c+'/*').join(',')}},infrastructure,installationContext:new ExecutionContext({context:'FrontEnd',publisher:'operator',app,self:app,capabilities:['object.instances.edit'],visible:grants,editable:grants})};
}
