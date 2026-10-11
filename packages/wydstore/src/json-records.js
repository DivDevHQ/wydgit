import { check, record, fields, validateData, equal } from './data.js';
import { MAX_COLLECTION_RECORDS, byId, snapshot, historical, validateStored, changeRecord, selectRecords, enforceUnique, validateUnique } from './adapter-contract.js';

export function documentContract(owner, definitions, metadata) {
  const initial = {
    schema: 'wydstore.json/0.1', owner,
    collections: Object.fromEntries([...definitions.keys()].sort().map(id => [id, {records: [], ...(metadata ? {definition:metadata.get(id)} : {})}]))
  };
  const validate = document => {
    fields(document, ['schema', 'owner', 'collections']);
    check(document.schema === initial.schema && equal(document.owner, owner) && record(document.collections));
    check(Object.keys(document.collections).length === definitions.size &&
      [...definitions.keys()].every(id => Object.hasOwn(document.collections, id)));
    for (const [id, collection] of Object.entries(document.collections)) {
      fields(collection, ['records'], ['definition']);
      if (collection.definition !== undefined || metadata?.get(id).schemaId) check(collection.definition !== undefined && equal(collection.definition,metadata.get(id)),'STORE.SCHEMA_INCOMPATIBLE');
      check(Array.isArray(collection.records) && collection.records.length <= MAX_COLLECTION_RECORDS);
      validateUnique(collection.records,definitions.get(id));
      const ids = new Set();
      for (const entry of collection.records) {
        fields(entry, ['id', 'version', 'data', 'deleted', 'history']);
        validateStored(entry, definitions.get(id));
        check(!ids.has(entry.id));
        ids.add(entry.id);
        check(Array.isArray(entry.history) && entry.history.length === entry.version - 1);
        entry.history.forEach((prior, i) => {
          fields(prior, ['version', 'data', 'deleted']);
          check(prior.version === i + 1 && prior.deleted === false &&
            equal(prior.data, validateData(prior.data, definitions.get(id))));
        });
      }
    }
  };
  return {initial, validate};
}

// Operates only on a private, validated document inside the adapter's lock.
export function applyOperation(document, operation, request) {
  const records = document.collections[request.collection].records;
  const entry = records.find(entry => entry.id === request.id);
  if (['query','count'].includes(operation)) return {changed:false,value:selectRecords(records,request,operation === 'count')};
  if (['get','history'].includes(operation)) {
    check(entry && (operation === 'history' || !entry.deleted), 'STORE.NOT_FOUND');
    if(operation==='get')return {changed:false,value:snapshot(entry)};
    const values=[];
    for(const prior of entry.history){request.addHistoryResult(prior);values.push(prior);}
    const current=historical(entry);request.addHistoryResult(current);values.push(current);
    return {changed:false,value:values};
  }
  const next = changeRecord(operation, request, entry);
  if (next && ['create','update'].includes(operation)) enforceUnique(records,request,request.definitions);
  if (!next) return {changed:false, value:snapshot(entry)};
  if (operation === 'create') {
    check(records.length < MAX_COLLECTION_RECORDS, 'STORE.LIMIT');
    records.push({...next, history:[]});
    records.sort(byId);
  } else {
    entry.history.push(historical(entry));
    Object.assign(entry, next);
  }
  return {changed:true, value:next.deleted ? {id:next.id, version:next.version, deleted:true} : snapshot(next)};
}
