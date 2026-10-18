// Trusted local development provisioning. No production credentials or grants.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../../',import.meta.url));
const mapping=(id,options,bindings=[])=>({id,package:'@wydgit/'+({wydstore:'store',wydgate:'gate',wydfiles:'files',wydsearch:'search',wydstream:'stream'})[id],enabled:true,version:({wydstore:'0.1.0-alpha.3',wydgate:'0.1.0-alpha.4',wydsearch:'0.1.0-alpha.2',wydstream:'0.1.0-alpha.2',wydfiles:'0.1.0-alpha.1'})[id],publisher:'wydgit.core',trust:'canonical',options,...(bindings.length?{bindings}:{})});
export async function provisionExample(root){
 const inventory={schema:'wydgit.multi-host/0.1',apps:[]};
 for(const id of ['app-alpha','app-beta']){
  const directory=path.join(root,id);await fs.mkdir(directory);for(const name of ['data','files','media'])await fs.mkdir(path.join(directory,name));
  for(const name of ['content','prototypes','public'])await fs.cp(path.join(project,name),path.join(directory,name),{recursive:true});
  await fs.appendFile(path.join(directory,'public/css/site.css'),'\n/* App asset: '+id+' */\n');
  await fs.symlink(path.join(project,'node_modules'),path.join(directory,'node_modules'),'dir');
  const app=JSON.parse(await fs.readFile(path.join(directory,'content/app.json')));app.id=id;app.properties.title=id;await fs.writeFile(path.join(directory,'content/app.json'),JSON.stringify(app));
  const homeFile=path.join(directory,'content/pages/home.json'),home=JSON.parse(await fs.readFile(homeFile));home.properties.title='Home '+id;await fs.writeFile(homeFile,JSON.stringify(home));
  const directoryFields={schema:{type:'string',required:true},membership:{type:'object'},...Object.fromEntries(['users','credentials','roles','groups','assignments','profiles','sessions'].map(k=>[k,{type:'array',required:true}]))};
  const store=(store,publisher,packageId,fields)=>({id:store,app:id,publisher,package:packageId,provider:'json',root:path.join(directory,'data'),collections:[{id:'records',fields}]});
  const binding=(store,owner)=>({library:'wydstore',app:id,capabilities:['store.records.read','store.records.create','store.records.write'],scopes:{wydstore:[{store,collection:'records'}]}});
  const config={schema:'wydgit.host/0.1',libraries:[
   mapping('wydstore',{stores:[store('main','acme','acme/demo',{name:{type:'string',required:true}}),store('identity','wydgit.core','library:wydgate',directoryFields),store('search','wydgit.core','library:wydsearch',{schemaVersion:{type:'number',required:true},documents:{type:'array',required:true}}),store('media','wydgit.core','library:wydstream',{schemaVersion:{type:'number',required:true},items:{type:'array',required:true}})]}),
   mapping('wydgate',{app:id,store:'identity',collection:'records',membership:{registration:'open'}},[binding('identity')]),
   mapping('wydsearch',{indexes:[{id:'main',app:id,store:'search',collection:'records'}],pageSource:{schema:'wydgit.search-source/0.1',indexes:[{id:'main',pages:['home'],publisher:'acme',package:'acme/demo',principal:'acme/demo'}]}},[binding('search')]),
   mapping('wydstream',{apps:[{app:id,resource:'media',store:'media',collection:'records',root:path.join(directory,'media'),categories:['image']}]},[binding('media')]),
   mapping('wydfiles',{schema:'wydfiles.host/1.0',apps:[{app:id,mounts:[{path:'/',provider:'local',root:path.join(directory,'files'),permissions:['read','write','delete','list']}],grants:[{publisher:'acme',package:'acme/demo',principal:'acme/demo',installation:'same-installation',path:'/',actions:['read','write','delete','list']}]}]})
  ]};
  await fs.writeFile(path.join(directory,'wydgit.config.json'),JSON.stringify(config,null,2)+'\n');inventory.apps.push({id,root:id});
 }
 await fs.writeFile(path.join(root,'host.json'),JSON.stringify(inventory,null,2)+'\n');return inventory;
}
