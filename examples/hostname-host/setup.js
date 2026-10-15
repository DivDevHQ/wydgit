// Explicit trusted local fixture: no discovery, grants or production credentials.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {provisionExample} from '../multi-app/setup.js';
const project=fileURLToPath(new URL('../../',import.meta.url));
export async function provisionHostnameExample(root){
 const inventory=await provisionExample(root),id='platform-parking',directory=path.join(root,id);
 await fs.mkdir(directory);for(const name of ['content','prototypes','public'])await fs.cp(path.join(project,name),path.join(directory,name),{recursive:true});
 const appFile=path.join(directory,'content/app.json'),app=JSON.parse(await fs.readFile(appFile));app.id=id;app.properties.title='Wydgit parking';app.properties.home='parked';
 // Retain the ordinary canonical App and page slot representation.
 const home=JSON.parse(await fs.readFile(path.join(directory,'content/pages/home.json')));
 await fs.rm(path.join(directory,'content/pages'),{recursive:true});await fs.mkdir(path.join(directory,'content/pages'));
 for(const [slug,title,message] of [['parked','Parked','This site is parked.'],['coming-soon','Coming Soon','A new website is on its way.'],['under-construction','Under Construction','This site is under construction.'],['unavailable','Temporarily Unavailable','Please return later.']]){
  const page=structuredClone(home);page.id=slug;page.properties={...page.properties,title,slug,description:message};page.slots.sections=[{schema:'wydgit/0.2',id:slug+'-section',prototype:'wydgit.core/section',properties:{},slots:{blocks:[{schema:'wydgit/0.2',id:slug+'-message',prototype:'wydgit.core/block',properties:{content:{type:'markdown',value:'# '+title+'\n\n'+message}},slots:{},provenance:{}}]},provenance:{}}];
  await fs.writeFile(path.join(directory,'content/pages',slug+'.json'),JSON.stringify(page,null,2)+'\n');
 }

 await fs.writeFile(appFile,JSON.stringify(app,null,2)+'\n');
 await fs.writeFile(path.join(directory,'content/navigation.json'),'[]');
 await fs.writeFile(path.join(directory,'wydgit.config.json'),JSON.stringify({schema:'wydgit.host/0.1',libraries:[]}));
 // No source behavior or service dependencies are needed for this ordinary App.
 await fs.writeFile(path.join(directory,'content/requirements.json'),JSON.stringify({schema:'wydgit.requirements/0.1',libraries:[]}));
 inventory.apps.push({id,root:id});inventory.routing={schema:'wydgit.routing/0.1',transport:{mode:'local-http'},routes:[
  {hostname:'alpha.localhost',app:'app-alpha',state:'active',approval:'local-development'},
  {hostname:'beta.localhost',app:'app-beta',state:'active',approval:'local-development'},
  {hostname:'soon.localhost',app:id,state:'coming-soon',approval:'local-development'},
  {hostname:'parked.localhost',app:id,state:'parked',approval:'local-development'}
 ],unknown:{policy:'park-approved-zone',app:id,zones:['sites.example.localhost']}};
 await fs.writeFile(path.join(root,'host.json'),JSON.stringify(inventory,null,2)+'\n');return inventory;
}
