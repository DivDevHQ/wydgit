// Trusted operator tool. Package requests never constitute operator approval.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { validatePackageManifest } from '../wydgine/packages/index.js';
import { safeRead } from '../wydgine/packages/state.js';
import { LIMITS } from '../wydgine/packages/manifest.js';
import { validateConfig, fields } from '../wydgine/libraries/contracts.js';
import { clean, requireThat as check, WydgitError } from '../wydgine/object-model/validation.js';
import { loadRepository } from '../wydgine/repository.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { importNodePackage } from '../wydgine/libraries/node-package.js';
import { planOperatorInstall, applyOperatorInstall, physicalStoreId, storageLocation } from './package-infrastructure.js';
const usage='Usage: node scripts/install-package.js PACKAGE [--approval HOST-POLICY.json] [--apply] [--root SITE]';
const yes=answer=>/^y(?:es)?$/i.test(answer.trim());
const idsOf=node=>[node.id,...Object.values(node.slots).flat().flatMap(idsOf)];
const equal=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));

export async function chooseOne(label,choices,defaultValue,ask,write) {
  check(choices.length>0,'PACKAGE.PLACEMENT','No valid '+label+' choices');
  write(label+':\n'+choices.map((v,i)=>`  ${i+1}. ${v}`).join('\n'));
  const defaultIndex=choices.indexOf(defaultValue),answer=(await ask(`${label}${defaultIndex>=0?` [${defaultIndex+1}]`:''}: `)).trim();
  if(!answer&&defaultIndex>=0)return defaultValue;
  const value=/^\d+$/.test(answer)?choices[Number(answer)-1]:answer;
  check(choices.includes(value),'PACKAGE.PLACEMENT','Choose an available '+label);return value;
}

export async function buildOperatorPolicy({root,packagePath,ask,write}) {
  const manifest=validatePackageManifest(safeRead(packagePath,'manifest.json',LIMITS.manifest));
  write(`Package: ${manifest.id}\nVersion: ${manifest.version}\nPublisher: ${manifest.publisher}\nInstallable: ${manifest.installables[0].id}`);
  write('Requires:\n'+manifest.requires.libraries.map(r=>`  ${r.library} ${r.version}`).join('\n'));
  for(const [heading,values] of [['Requested capabilities',manifest.permissions.capabilities],['Requested traversal',manifest.permissions.traversal],['Requested object visibility',manifest.permissions.visible],['Requested object editability',manifest.permissions.editable]])write(`${heading}:\n${values.map(v=>'  '+v).join('\n')}`);
  write('Requested resource/prototype scopes:\n'+JSON.stringify(manifest.permissions.scopes,null,2));
  write('Logical storage requirements:\n'+JSON.stringify(manifest.storage,null,2));
  if(!yes(await ask("Approve the package's requested authority? [y/N] ")))return null;

  const model=loadRepository(root),app=model.runtime.rootId;
  const config=JSON.parse(JSON.stringify(validateConfig(safeRead(root,'wydgit.config.json'))));
  const infrastructure={enableWydstore:false,stores:[]};
  for(const required of manifest.requires.libraries){
    const library=config.libraries.find(l=>l.id===required.library);
    check(library,'PACKAGE.LIBRARY',`Required canonical library is not installed: ${required.library} ${required.version}`);
    await importNodePackage(library,root);
    if(!library.enabled){
      check(library.id==='wydstore'&&library.package==='@wydgit/store'&&library.trust==='canonical','PACKAGE.LIBRARY','Only installed canonical WydStore enablement is supported');
      write(`${manifest.id} requires WydStore ${required.version}. WydStore is installed but disabled.`);
      if(!yes(await ask('Enable WydStore? [y/N] ')))return null;
      infrastructure.enableWydstore=true;library.enabled=true;
    }
  }
  write(`Install ${manifest.installables[0].id}`);
  const defaultPage=model.runtime.get(app).properties.home??[...model.pages.keys()][0];
  const page=await chooseOne('Page',[...model.pages.keys()],defaultPage,ask,write);
  const slotNames=id=>{const node=model.runtime.get(id),definition=model.registry.get(node.prototype);return Object.keys(node.slots).filter(slot=>definition.slots[slot].accepts.some(base=>model.registry.isA('wydgit.core/section',base)));};
  const parents=[];const walk=id=>{if(slotNames(id).length)parents.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(page);
  const parent=await chooseOne('Parent',parents,parents.includes(page)?page:parents[0],ask,write);
  const node=model.runtime.get(parent),slots=slotNames(parent),slot=await chooseOne('Slot',slots,slots[0],ask,write);
  const defaultIndex=node.slots[slot].length,answer=(await ask(`Index [${defaultIndex}, end]: `)).trim();
  check(answer===''||/^\d+$/.test(answer),'PACKAGE.PLACEMENT','Index must be an integer');
  const placement={page,parent,slot,index:answer===''?defaultIndex:Number(answer)};

  const library=config.libraries.find(l=>l.id==='wydstore'),stores=library?.options?.stores??[],storageMappings={};
  for(const resource of manifest.storage){
    write(`Logical storage: ${resource.name}`);
    const mappings=stores.filter(s=>s.app===app&&s.publisher===manifest.publisher&&s.package===manifest.id).flatMap(s=>(s.collections??[]).filter(c=>equal(c.fields,resource.fields)).map(c=>({store:s.id,collection:c.id})));
    write('Compatible storage mappings:');
    let mapping;
    if(mappings.length===1){
      write(`  1. ${mappings[0].store} / ${mappings[0].collection}\n  2. Create new storage`);
      const selection=(await ask('Use this mapping? [Y/n] (n creates new storage) ')).trim();
      check(selection===''||yes(selection)||/^n(?:o)?$/i.test(selection),'PACKAGE.STORAGE','Choose reuse or new storage');
      if(selection===''||yes(selection))mapping=mappings[0];
    }else if(mappings.length>1){
      const choices=[...mappings.map(m=>`${m.store} / ${m.collection}`),'Create new storage'];
      const selected=await chooseOne('Mapping',choices,null,ask,write);
      mapping=mappings[choices.indexOf(selected)];
    }
    if(!mapping){
      const provider=await chooseOne('WydStore provider',['JSON','SQLite'],'JSON',ask,write);
      write('Storage location: .wydgit-data/');
      const useDefault=(await ask('Use default? [Y/n] ')).trim();
      check(useDefault===''||yes(useDefault)||/^n(?:o)?$/i.test(useDefault),'PACKAGE.PATH','Choose default or custom location');
      const location=useDefault===''||yes(useDefault)?'.wydgit-data':(await ask('Site-relative runtime data location: ')).trim();
      storageLocation(root,location);
      const id=physicalStoreId(manifest.id)+'-'+resource.name;
      check(!stores.some(s=>s.id===id),'PACKAGE.STORAGE','Generated store ID already exists; choose compatible reuse');
      const request={id,provider:provider.toLowerCase(),location:location+'/'+id,collections:[{id:resource.name,fields:JSON.parse(JSON.stringify(resource.fields))}]};
      write(`Provision ${provider} storage: ${request.location} (${id} / ${resource.name})`);
      if(!yes(await ask('Approve this host storage provisioning? [y/N] ')))return null;
      infrastructure.stores.push(request);mapping={store:id,collection:resource.name};
    }
    storageMappings[resource.name]=mapping;
  }
  // Prospective attachment authority is separate from runtime package grants.
  // Grant only the selected parent/slot occupants and incoming object IDs/patterns.
  const template=JSON.parse(safeRead(packagePath,manifest.resources.template));
  const objectGrants=[...new Set([parent,...node.slots[slot],...idsOf(template),...manifest.permissions.visible,...manifest.permissions.editable])];
  return {...(infrastructure.enableWydstore||infrastructure.stores.length?{infrastructure}:{}),placement,approvals:JSON.parse(JSON.stringify(manifest.permissions)),storageMappings,installationContext:{publisher:'operator',app,self:parent,capabilities:['object.instances.edit'],visible:objectGrants,editable:objectGrants}};
}

export async function runInstaller({args=process.argv.slice(2),input=stdin,output=stdout,ask}={}) {
  const [packageInput,...rest]=args,flags={};
  check(packageInput&&!packageInput.startsWith('--'),'PACKAGE.CLI',usage);
  for(let i=0;i<rest.length;i++){
    if(rest[i]==='--apply'){flags.apply=true;continue;}
    check(['--approval','--root'].includes(rest[i])&&rest[i+1]&&!rest[i+1].startsWith('--'),'PACKAGE.CLI',usage);
    flags[rest[i].slice(2)]=rest[++i];
  }
  const root=path.resolve(flags.root??'.'),packagePath=path.resolve(packageInput),write=text=>output.write(text+'\n');
  let reader;
  try {
    if(!flags.approval&&!ask){
      reader=createInterface({input,output,terminal:Boolean(input.isTTY&&output.isTTY)});
      const lines=reader[Symbol.asyncIterator]();
      ask=async prompt=>{output.write(prompt);const line=await lines.next();check(!line.done,'PACKAGE.CLI','Input ended; installation aborted');return line.value;};
    }
    const policy=flags.approval?JSON.parse(await fs.readFile(flags.approval,'utf8')):await buildOperatorPolicy({root,packagePath,ask,write});
    if(flags.approval)fields(policy,['placement','approvals','storageMappings','installationContext',...(policy?.infrastructure!==undefined?['infrastructure']:[])],'PACKAGE.POLICY');
    if(!policy){write('Installation cancelled. No changes made.');return null;}
    const manifest=validatePackageManifest(safeRead(packagePath,'manifest.json',LIMITS.manifest));
    const resolved=await planOperatorInstall({root,packagePath,manifest,policy,installationContext:new ExecutionContext(policy.installationContext)}),{plan}=resolved;
    write('Installation plan\nPackage: '+plan.package+' '+plan.version+'\nInfrastructure:\n'+JSON.stringify(resolved.infrastructure,null,2)+'\nStorage:\n'+JSON.stringify(plan.storageMappings,null,2)+'\nPlacement:\n'+JSON.stringify(plan.placement,null,2)+'\nExpected changes: installed package catalog / accepted App'+(resolved.hostConfig?', wydgit.config.json / WydStore runtime data':''));
    write(JSON.stringify(plan,null,2));
    const apply=flags.approval?Boolean(flags.apply):yes(await ask('Apply installation? [y/N] '));
    const receipt=apply?await applyOperatorInstall(resolved):null;
    if(receipt)write(JSON.stringify(receipt,null,2));else write('Installation cancelled. No changes made.');
    return {policy,plan,receipt};
  } finally {reader?.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  runInstaller().catch(error=>{console.error(JSON.stringify(error instanceof WydgitError?error.toJSON():{ok:false,code:'PACKAGE.CLI',message:'Package installation failed',details:{}}));process.exitCode=1;});
}
