// Closed, data-only developer declarations. This interpreter has no service,
// native callback, host context, provider handle or general SEWN dispatch surface.
import semver from 'semver';
import { clean, freeze, requireThat as check } from '../object-model/validation.js';
import { validId } from '../object-model/schema.js';
import { matchesObjectGrant } from '../seam/context.js';
import { fields, version } from '../libraries/contracts.js';
import { LIMITS, qualified, localName } from './manifest.js';
import { digest } from './state.js';
import { migrationInventory, verifyMigrationOwner } from './migrations.js';
import { storeLifecycle } from './store-lifecycle.js';

const code='PACKAGE.MIGRATION';
const same=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
const hash=value=>digest(JSON.stringify(clean(value)));
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const field=value=>typeof value==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(value)&&!['id','constructor','prototype','__proto__'].includes(value);
const types=['string','number','boolean','object','array','null'];
const type=value=>value===null?'null':Array.isArray(value)?'array':typeof value;
export const migrationContentHash=hash;
export const packageMigrationArtifactHash=entry=>hash({manifest:entry.manifest,resources:entry.resources});
const ceilings=Object.freeze({records:4096,history:16384,bytes:LIMITS.state,mappings:256,steps:32,stagingBytes:LIMITS.state});

function boundedJson(input) {
  const value=clean(input);
  check(Buffer.byteLength(JSON.stringify(value))<=LIMITS.resource,'PACKAGE.LIMIT','Developer migration declaration/request exceeds its byte ceiling');
  return value;
}
function operations(input) {
  check(Array.isArray(input)&&input.length<=64,code,'Invalid bounded operation list');
  for(const operation of input){
    if(operation?.op==='rename'){
      fields(operation,['op','from','to'],code);
      check(field(operation.from)&&field(operation.to)&&operation.from!==operation.to,code,'Invalid lossless rename');
    }else{
      fields(operation,['op','field','value'],code);
      check(operation.op==='default'&&field(operation.field),code,'Only lossless renames and missing-value defaults are supported');
    }
  }
}
function validators(input) {
  fields(input,['before','after'],code);
  for(const predicates of [input.before,input.after]){
    check(Array.isArray(predicates)&&predicates.length<=64,code,'Invalid validator count');
    for(const p of predicates){
      fields(p,['scope','name','field','op',...(['equals','type'].includes(p?.op)?['value']:[])],code);
      check(['storage','instance'].includes(p.scope)&&(p.scope==='storage'?localName(p.name):validId(p.name))&&field(p.field),code,'Invalid validator scope');
      check(['present','absent','equals','type'].includes(p.op)&&(p.op!=='type'||types.includes(p.value)),code,'Unsupported semantic validator');
    }
  }
}
function capabilities(step) {
  const needed=new Set(),predicates=[...step.validators.before,...step.validators.after];
  if(step.logic.storage.length||predicates.some(p=>p.scope==='storage'))needed.add('store.records.read');
  if(step.logic.storage.length)needed.add('store.records.write');
  if(step.logic.instances.length||predicates.some(p=>p.scope==='instance'))needed.add('object.instances.edit');
  return [...needed].sort();
}

export function validateDeveloperMigrationDeclaration(input) {
  const d=boundedJson(input);fields(d,['schema','package','supportedSources','limits','steps'],code);
  check(d.schema==='wydgit.developer-migrations/1'&&qualified(d.package),code,'Unsupported developer migration declaration');
  fields(d.limits,Object.keys(ceilings),code);
  for(const [key,max] of Object.entries(ceilings))check(Number.isSafeInteger(d.limits[key])&&d.limits[key]>0&&d.limits[key]<=max,'PACKAGE.LIMIT','Invalid developer migration bound');
  check(Array.isArray(d.supportedSources)&&d.supportedSources.length>0&&d.supportedSources.length<=32&&d.supportedSources.every(version)&&new Set(d.supportedSources).size===d.supportedSources.length,code,'Invalid exact source support set');
  check(Array.isArray(d.steps)&&d.steps.length>0&&d.steps.length<=32,code,'Invalid developer migration step count');
  const ids=new Set(),edges=new Set(),artifacts=new Map();
  for(const step of d.steps){
    fields(step,['id','from','to','logic','logicHash','validators','validatorsHash','requiredCapabilities'],code);
    check(localName(step.id)&&!ids.has(step.id),code,'Duplicate or invalid migration step identity');ids.add(step.id);
    for(const endpoint of [step.from,step.to]){
      fields(endpoint,['version','artifact'],code);
      check(version(endpoint.version)&&sha(endpoint.artifact),code,'Invalid exact migration endpoint');
      check(!artifacts.has(endpoint.version)||artifacts.get(endpoint.version)===endpoint.artifact,code,'Conflicting artifact identity for one version');artifacts.set(endpoint.version,endpoint.artifact);
    }
    check(semver.gt(step.to.version,step.from.version),code,'Migration edges must increase version without cycles');
    const edge=step.from.version+'\0'+step.to.version;check(!edges.has(edge),code,'Duplicate migration edge');edges.add(edge);
    migrationInventory([step.logic]);
    check(step.logic.package===d.package&&step.logic.from===step.from.version&&step.logic.to===step.to.version,code,'Logic differs from declared identity/versions');
    const stores=new Set(),instances=new Set();
    for(const change of step.logic.storage){
      fields(change,['name','from','to','fields','operations'],code);
      check(localName(change.name)&&!stores.has(change.name)&&Number.isSafeInteger(change.from)&&change.from>0&&change.to===change.from+1,code,'Invalid storage transition');stores.add(change.name);operations(change.operations);
    }
    for(const change of step.logic.instances){
      fields(change,['id','fromPrototype','toPrototype','properties'],code);
      check(validId(change.id)&&!instances.has(change.id)&&qualified(change.fromPrototype)&&change.fromPrototype===change.toPrototype,code,'Developer increment supports fixed-ID property changes only');instances.add(change.id);operations(change.properties);
    }
    validators(step.validators);
    check(sha(step.logicHash)&&step.logicHash===hash(step.logic)&&sha(step.validatorsHash)&&step.validatorsHash===hash(step.validators),'PACKAGE.DRIFT','Migration logic or validator hash differs');
    check(same(step.requiredCapabilities,capabilities(step)),code,'Capabilities must exactly describe this restricted step');
  }
  return freeze(d);
}

function counter(limits,meter) {
  const counts={records:0,history:0,bytes:0,mappings:0,steps:0};
  return {
    take(key,count=1){meter.take();counts[key]+=count;check(counts[key]<=limits[key],'PACKAGE.LIMIT','Developer migration '+key+' bound exhausted');},
    bytes(...values){this.take('bytes',values.reduce((sum,v)=>sum+Buffer.byteLength(JSON.stringify(v)),0));},
    staging(resources,app){meter.take();check(Buffer.byteLength(JSON.stringify([...resources.values()]))+Buffer.byteLength(app)<=limits.stagingBytes,'PACKAGE.LIMIT','Developer migration staging bound exhausted');},
    snapshot(){return {...counts};}
  };
}

// Host-only admission: approvals are exact per-step and cannot be unioned.
export function prepareDeveloperMigration(input,{prior,candidate,loadArtifact,context,meter}) {
  const request=boundedJson(input);fields(request,['schema','declaration','path','approvals','artifacts'],code);
  check(request.schema==='wydgit.developer-migration-request/1',code,'Unsupported developer migration request');
  const declaration=validateDeveloperMigrationDeclaration(request.declaration);
  check(declaration.package===prior.manifest.id&&declaration.package===candidate.manifest.id,'PACKAGE.OWNERSHIP','Developer declaration must match the installed primary package');
  const byId=new Map(declaration.steps.map(step=>[step.id,step]));
  for(const step of declaration.steps)for(const lineage of prior.migrationLineage??[])for(const observed of lineage.steps)check(observed.id!==step.id||observed.sha256===hash(step),'PACKAGE.DRIFT','Migration step identity changed after acceptance');
  check(Array.isArray(request.path)&&request.path.length>0&&request.path.length<=32&&new Set(request.path).size===request.path.length&&request.path.every(id=>byId.has(id)),code,'Select an explicit complete migration path');
  check(Array.isArray(request.approvals)&&request.approvals.length===request.path.length&&Array.isArray(request.artifacts)&&request.artifacts.length<=31,code,'Invalid approval or artifact inventory');
  const approvals=new Map();
  for(const approval of request.approvals){
    fields(approval,['step','sha256','capabilities'],code);
    check(request.path.includes(approval.step)&&!approvals.has(approval.step),code,'Unused or duplicate step approval');approvals.set(approval.step,approval);
  }
  const target=candidate.manifest.version,canReach=(source,seen=new Set())=>{
    meter.take();if(source===target)return true;if(seen.has(source))return false;seen.add(source);
    return declaration.steps.filter(s=>s.from.version===source).some(s=>canReach(s.to.version,seen));
  };
  check(declaration.supportedSources.includes(prior.manifest.version)&&declaration.supportedSources.every(v=>v!==target&&canReach(v)), 'PACKAGE.MIGRATION_ORDER','Declared source support has no complete target path');
  const artifacts=new Map([[candidate.manifest.version,candidate]]),checks=[];
  for(const packagePath of request.artifacts){
    meter.take();check(typeof packagePath==='string',code,'Expected explicit local artifact path');
    const artifact=loadArtifact(packagePath);
    check(artifact.manifest.id===declaration.package&&!artifacts.has(artifact.manifest.version),code,'Duplicate or unrelated intermediate artifact');
    artifacts.set(artifact.manifest.version,artifact);checks.push({packagePath,sha256:packageMigrationArtifactHash(artifact)});
  }
  let source=prior;const selected=[],used=new Set([target]);
  for(const id of request.path){
    meter.take();const step=byId.get(id),approval=approvals.get(id),artifact=artifacts.get(step.to.version);
    check(step.from.version===source.manifest.version&&step.from.artifact===packageMigrationArtifactHash(source)&&artifact&&step.to.artifact===packageMigrationArtifactHash(artifact),'PACKAGE.MIGRATION_ORDER','Path does not match exact source and target artifacts');
    check(approval.sha256===hash(step)&&same(approval.capabilities,step.requiredCapabilities),'PACKAGE.DENIED','Step needs exact separate host approval');
    for(const capability of step.requiredCapabilities)context.require(capability);
    // No compile context or implicit intermediate permission/library approvals.
    for(const entry of [source,artifact])check(!entry.manifest.staticLibraries&&!entry.manifest.interfaces&&!entry.compiledSources,code,'Compiled artifact migration needs a separate contract');
    for(const key of ['permissions','requires','bindings'])check(same(artifact.manifest[key],candidate.manifest[key]),code,'Intermediate grants/requirements must equal the approved target');
    used.add(step.to.version);selected.push({step,artifact});source=artifact;
  }
  check(source===candidate&&artifacts.size===used.size,'PACKAGE.MIGRATION_ORDER','Path must reach the target and use every supplied intermediate artifact');
  const controls=counter(declaration.limits,meter);
  const lineage={schema:'wydgit.developer-migration-lineage/1',declaration:hash(declaration),sourceReceipt:prior.receipt.id,steps:selected.map(({step})=>({id:step.id,sha256:hash(step),from:step.from.version,to:step.to.version,sourceArtifact:step.from.artifact,targetArtifact:step.to.artifact}))};
  return {selected,controls,checks,summary:freeze({declaration, path:request.path,approvals:request.approvals,lineage})};
}

// All reads come from receipt-established snapshots; validators see values only.
export async function validateDeveloperPredicates({predicates,root,entry,app,config,resources,meter,controls,context}) {
  const nodes=new Map();const visit=node=>{meter.take();nodes.set(node.id,node);Object.values(node.slots).flat().forEach(visit);};visit(JSON.parse(app));
  for(const p of predicates){
    meter.take();let values=[];
    if(p.scope==='instance'){
      check(entry.instanceIds.includes(p.name)&&nodes.has(p.name),'PACKAGE.OWNERSHIP','Validator instance is outside the managed scope');
      check(matchesObjectGrant(context.visible,p.name)&&matchesObjectGrant(context.editable,p.name),'SEAM.DENIED','Validator instance is outside host object scope');
      controls.take('mappings');values=[nodes.get(p.name).properties];
    }else{
      controls.take('mappings');
      const mapping=entry.storageMappings[p.name];check(entry.manifest.storage.some(s=>s.name===p.name)&&mapping,'PACKAGE.OWNERSHIP','Validator collection is outside the declared scope');
      const store=config.libraries.find(l=>l.id==='wydstore'&&l.enabled)?.options?.stores?.find(s=>s.id===mapping.store);
      verifyMigrationOwner(store,entry,JSON.parse(app).id);
      const {storeFile,snapshotStore,emptyStore}=await storeLifecycle(root);const key=storeFile(store);let resource=resources.get(key);
      if(!resource){const before=await snapshotStore(store);resource={beforeDefinition:clean(store),afterDefinition:clean(store),before,after:before};resources.set(key,resource);}
      const document=resource.after??emptyStore(store);
      check(document.collections[mapping.collection],'PACKAGE.OWNERSHIP','Validator mapping has no owned collection');controls.bytes(document);
      for(const record of document.collections[mapping.collection].records){
        controls.take('records');if(!record.deleted)values.push(record.data);
        for(const history of record.history){controls.take('history');if(history.data!==null)values.push(history.data);}
      }
    }
    for(const value of values){
      meter.take();controls.bytes(value);const present=Object.hasOwn(value,p.field);
      const valid=p.op==='present'?present:p.op==='absent'?!present:p.op==='type'?present&&type(value[p.field])===p.value:present&&same(value[p.field],p.value);
      check(valid,'PACKAGE.MIGRATION_VALIDATION','Developer semantic validation failed');
    }
    controls.staging(resources,app);
  }
}
