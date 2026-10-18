import fs from 'node:fs/promises';
import path from 'node:path';
import { storedFixture } from './package-effects.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { readInstalledState } from '../wydgine/packages/state.js';
import { inspectPackageMigrationArtifact, migrationContentHash } from '../wydgine/packages/index.js';

export const sealStep=step=>{
  step.logicHash=migrationContentHash(step.logic);step.validatorsHash=migrationContentHash(step.validators);return step;
};
export const approveRequest=request=>{
  request.approvals=request.path.map(id=>{const step=request.declaration.steps.find(s=>s.id===id);return {step:id,sha256:migrationContentHash(step),capabilities:step.requiredCapabilities};});return request;
};
export async function developerFixture(t,provider,{chain=false}={}) {
  const f=await storedFixture(t,provider),source=readInstalledState(f.root).packages[0];
  const endpoint=entry=>({version:entry.manifest.version,artifact:migrationContentHash({manifest:entry.manifest,resources:entry.resources})});
  const inspect=packagePath=>{const {version,artifact}=inspectPackageMigrationArtifact(packagePath);return {version,artifact};};
  const firstFields={text:{type:'string',required:true},label:{type:'string',default:'Imported'}};
  const lastFields={body:{type:'string',required:true},...(chain?{label:{type:'string',default:'Imported'}}:{})};
  const steps=[],artifacts=[];let from=endpoint(source);
  const make=(id,from,to,logic,beforeField,afterField)=>sealStep({id,from,to,logic,logicHash:'',validators:{before:[{scope:'storage',name:'entries',field:beforeField,op:'present'}],after:[{scope:'storage',name:'entries',field:afterField,op:'type',value:'string'}]},validatorsHash:'',requiredCapabilities:['store.records.read','store.records.write']});
  if(chain){
    const intermediate=await f.version('1.1.0',{...f.target,fields:firstFields}),directory=path.join(f.root,'intermediate');
    await fs.cp(intermediate.packagePath,directory,{recursive:true});artifacts.push(directory);
    const to=inspect(directory),logic=f.migration('1.1.0');logic.storage[0].fields=firstFields;logic.storage[0].operations=[{op:'default',field:'label',value:'Imported'}];
    steps.push(make('add-label',from,to,logic,'text','text'));from=to;
  }
  const target={...f.target,schemaVersion:chain?3:2,fields:lastFields},candidate=await f.version('2.0.0',target),logic=f.migration();
  logic.from=from.version;logic.storage[0].from=chain?2:1;logic.storage[0].to=target.schemaVersion;logic.storage[0].fields=lastFields;
  steps.push(make('rename-text',from,inspect(candidate.packagePath),logic,'text','body'));
  const request=approveRequest({schema:'wydgit.developer-migration-request/1',declaration:{schema:'wydgit.developer-migrations/1',package:'acme/a',supportedSources:chain?['1.0.0','1.1.0']:['1.0.0'],limits:{records:4096,history:16384,bytes:4*1024*1024,mappings:256,steps:32,stagingBytes:4*1024*1024},steps},path:steps.map(s=>s.id),approvals:[],artifacts});
  const context=new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'store.records.read','store.records.write']});
  const operation=(extra={})=>f.operation('upgrade','acme/a',[candidate],{installationContext:context,developerMigrations:request,...extra});
  return {...f,newCandidate:f.candidate,context,request,candidate,operation};
}
