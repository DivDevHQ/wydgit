// Bounded declarative host approvals, not executable package lifecycle hooks.
import semver from 'semver';
import { clean, requireThat as check } from '../object-model/validation.js';
import { LIMITS } from './manifest.js';
import { storeLifecycle } from './store-lifecycle.js';
import { fields } from '../libraries/contracts.js';
const equal=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
const name=value=>typeof value==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(value)&&!['constructor','prototype','__proto__','id'].includes(value);

function transform(input,operations,meter) {
  meter.take();const data=clean(input);check(Array.isArray(operations)&&operations.length<=64,'PACKAGE.MIGRATION','Invalid migration operations');
  for(const operation of operations){
    meter.take();
    if(operation.op==='rename') {
      fields(operation,['op','from','to'],'PACKAGE.MIGRATION');
      check(name(operation.from)&&name(operation.to)&&operation.from!==operation.to,'PACKAGE.MIGRATION','Invalid field rename');
      if(Object.hasOwn(data,operation.from)){
        check(!Object.hasOwn(data,operation.to),'PACKAGE.MIGRATION_CONFLICT','Rename would replace an existing value');
        data[operation.to]=data[operation.from];delete data[operation.from];
      }
    }else if(operation.op==='default'){
      fields(operation,['op','field','value'],'PACKAGE.MIGRATION');check(name(operation.field),'PACKAGE.MIGRATION','Invalid field default');
      if(!Object.hasOwn(data,operation.field))data[operation.field]=clean(operation.value);
    }else check(false,'PACKAGE.MIGRATION','Only lossless rename and missing-value defaults are supported');
  }
  return data;
}
export function migrationInventory(input) {
  check(Array.isArray(input)&&input.length<=32,'PACKAGE.MIGRATION','Migration count exceeds the bounded contract');
  const inventory=clean(input);check(Buffer.byteLength(JSON.stringify(inventory))<=LIMITS.resource,'PACKAGE.LIMIT','Migration approvals exceed their byte ceiling');
  for(const step of inventory){
    fields(step,['schema','package','from','to','storage','instances'],'PACKAGE.MIGRATION');
    check(step.schema==='wydgit.package-migration/1'&&semver.valid(step.from)&&semver.valid(step.to)&&semver.gt(step.to,step.from)&&Array.isArray(step.storage)&&step.storage.length<=16&&Array.isArray(step.instances)&&step.instances.length<=256,'PACKAGE.MIGRATION','Invalid migration envelope');
  }
  return inventory;
}
function verifyOwner(store,entry,app) {
  check(store&&store.app===app&&store.publisher===entry.manifest.publisher&&store.package===entry.manifest.id&&(store.principal===undefined||store.principal===entry.manifest.id),'PACKAGE.OWNERSHIP','Storage is not exclusively owned by this package principal');
  check(store.installation===undefined,'PACKAGE.MIGRATION_REQUIRED','Installation-bound storage needs a separately approved identity transition');
}
export async function migratePackage({root,prior,candidate,app,config,resources,migrations,used,meter}) {
  const steps=migrations.filter(step=>step.package===prior.manifest.id);
  check(steps.length,'PACKAGE.MIGRATION_REQUIRED','Storage or instance transition needs an explicit versioned migration');
  let version=prior.manifest.version;
  const schemas=new Map(prior.manifest.storage.map(s=>[s.name,clean(s)]));
  const result=JSON.parse(app),managed=new Set(prior.instanceIds),nodes=new Map();
  const visit=node=>{nodes.set(node.id,node);Object.values(node.slots).flat().forEach(visit);};visit(result);
  const declared=new Set(JSON.parse(prior.resources[prior.manifest.resources.prototypes]).map(p=>p.id));
  for(const step of steps) {
    meter.take();check(step.from===version,'PACKAGE.MIGRATION_ORDER','Migration versions must form one ordered, exact chain');used.add(step);version=step.to;
    const seen=new Set();
    for(const change of step.storage){
      const {snapshotStore,storeFile,emptyStore,validateStoreConfig,validateStoreCheckpoint,storeRecordByteLimit}=await storeLifecycle(root);
      meter.take();fields(change,['name','from','to','fields','operations'],'PACKAGE.MIGRATION');
      const previous=schemas.get(change.name),mapping=prior.storageMappings[change.name];
      check(previous&&mapping&&!seen.has(change.name)&&change.from===(previous.schemaVersion??1)&&change.to===change.from+1,'PACKAGE.MIGRATION_ORDER','Storage versions must advance one version at a time');seen.add(change.name);
      const store=config.libraries.find(l=>l.id==='wydstore'&&l.enabled)?.options?.stores?.find(s=>s.id===mapping.store);
      verifyOwner(store,prior,result.id);
      const collection=store.collections.find(c=>c.id===mapping.collection);
      check(collection&&equal(collection.fields,previous.fields)&&(collection.schemaVersion??1)===change.from&&(previous.schemaId===undefined||collection.schemaId===previous.schemaId),'PACKAGE.MIGRATION_ORDER','Configured storage differs from its source schema');
      const key=storeFile(store);let resource=resources.get(key);
      if(!resource){const before=await snapshotStore(store);resource={beforeDefinition:clean(store),afterDefinition:clean(store),before,after:before};resources.set(key,resource);}
      const next={id:collection.id,fields:clean(change.fields),schemaId:previous.schemaId??change.name,schemaVersion:change.to};
      const target={...clean(store),collections:store.collections.map(c=>c.id===collection.id?next:c)};validateStoreConfig({stores:[target]});
      if(resource.after===null){resource.after=emptyStore(target);}
      const document=clean(resource.after),records=document.collections[collection.id].records;
      let bytes=Buffer.byteLength(JSON.stringify(document));
      const transformRecord=data=>{const transformed=transform(data,change.operations,meter),size=Buffer.byteLength(JSON.stringify(transformed));bytes+=size-Buffer.byteLength(JSON.stringify(data));check(size<=storeRecordByteLimit(store)&&bytes<=LIMITS.state,'PACKAGE.LIMIT','Migrated content exceeds the recovery or record ceiling');return transformed;};
      for(const record of records){
        meter.take();if(!record.deleted)record.data=transformRecord(record.data);
        for(const history of record.history)history.data=transformRecord(history.data);
      }
      document.collections[collection.id].definition=next;
      validateStoreCheckpoint(target,document);
      resource.after=document;resource.afterDefinition=target;
      check(Buffer.byteLength(JSON.stringify([...resources.values()]))<=LIMITS.state,'PACKAGE.LIMIT','Combined adapter checkpoints exceed the recovery ceiling');
      store.collections=target.collections;schemas.set(change.name,{name:change.name,fields:next.fields,schemaId:next.schemaId,schemaVersion:next.schemaVersion});
    }
    const instanceIds=new Set();
    for(const change of step.instances){
      meter.take();fields(change,['id','fromPrototype','toPrototype','properties'],'PACKAGE.MIGRATION');
      const node=nodes.get(change.id);
      check(managed.has(change.id)&&node&&node.prototype===change.fromPrototype&&declared.has(change.fromPrototype)&&typeof change.toPrototype==='string'&&change.toPrototype.startsWith(prior.manifest.publisher+'/')&&!instanceIds.has(change.id),'PACKAGE.OWNERSHIP','Instance transition must match one managed package object');instanceIds.add(change.id);
      node.properties=transform(node.properties,change.properties,meter);node.prototype=change.toPrototype;
    }
  }
  check(version===candidate.manifest.version,'PACKAGE.MIGRATION_ORDER','Migration chain does not end at the approved candidate');
  check(equal([...schemas.values()],candidate.manifest.storage),'PACKAGE.MIGRATION','Migration result differs from the candidate storage declaration');
  return JSON.stringify(result);
}

export async function planPhysicalPurge({root,entry,state,config,authorization,resources,meter}) {
  check(authorization?.package===entry.manifest.id&&authorization.content===true&&Object.keys(authorization).length===2,'PACKAGE.PURGE_UNSUPPORTED','Physical purge needs explicit package-specific content authorization');
  const {snapshotStore,storeFile}=await storeLifecycle(root);
  const mapped=new Map();
  for(const mapping of Object.values(entry.storageMappings)){const collections=mapped.get(mapping.store)??new Set();collections.add(mapping.collection);mapped.set(mapping.store,collections);}
  const library=config.libraries.find(l=>l.id==='wydstore'&&l.enabled);
  check(mapped.size===new Set(entry.manifest.storage.map(s=>entry.storageMappings[s.name]?.store)).size,'PACKAGE.OWNERSHIP','Incomplete physical ownership mapping');
  for(const [id,collections] of mapped){
    meter.take();const store=library?.options?.stores?.find(s=>s.id===id);verifyOwner(store,entry,JSON.parse(state.app).id);
    check(store.collections.length===collections.size&&store.collections.every(c=>collections.has(c.id)),'PACKAGE.OWNERSHIP','Unmapped collections must be retained');
    check(![...state.packages,...state.retained.map(r=>r.entry)].some(other=>other!==entry&&Object.values(other.storageMappings).some(m=>m.store===id)),'PACKAGE.OWNERSHIP','Another installation retains a storage reference');
    check(!config.libraries.some(l=>(l.bindings??[]).some(b=>(b.scopes?.wydstore??[]).some(s=>s.store===id))),'PACKAGE.OWNERSHIP','A runtime library retains a storage reference');
    for(const requirement of entry.manifest.storage){const mapping=entry.storageMappings[requirement.name];if(mapping.store===id){const collection=store.collections.find(c=>c.id===mapping.collection);check(collection&&equal(collection.fields,requirement.fields),'PACKAGE.OWNERSHIP','Retained schema ownership differs from configured content');}}
    const before=await snapshotStore(store);resources.set(storeFile(store),{beforeDefinition:clean(store),afterDefinition:null,before,after:null});
    check(Buffer.byteLength(JSON.stringify([...resources.values()]))<=LIMITS.state,'PACKAGE.LIMIT','Combined purge checkpoints exceed the recovery ceiling');
    library.options.stores=library.options.stores.filter(s=>s!==store);
  }
}
