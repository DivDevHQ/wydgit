import { check, record, fields, validateData, equal } from './data.js';
import { MAX_COLLECTION_RECORDS, MAX_QUERY, byId, snapshot, historical, matches, validateStored, changeRecord } from './adapter-contract.js';

export function documentContract(owner, definitions) {
  const initial = {
    schema: 'wydstore.json/0.1', owner,
    collections: Object.fromEntries([...definitions.keys()].sort().map(id => [id, {records: []}]))
  };
  const validate = document => {
    fields(document, ['schema', 'owner', 'collections']);
    check(document.schema === initial.schema && equal(document.owner, owner) && record(document.collections));
    check(Object.keys(document.collections).length === definitions.size &&
      [...definitions.keys()].every(id => Object.hasOwn(document.collections, id)));
    for (const [id, collection] of Object.entries(document.collections)) {
      fields(collection, ['records']);
      check(Array.isArray(collection.records) && collection.records.length <= MAX_COLLECTION_RECORDS);
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
  if (operation === 'query') {
    return {changed:false, value:records.filter(entry => matches(entry, request.where))
      .sort(byId).slice(0, request.limit ?? MAX_QUERY).map(snapshot)};
  }
  if (['get','history'].includes(operation)) {
    check(entry && (operation === 'history' || !entry.deleted), 'STORE.NOT_FOUND');
    return {changed:false, value:operation === 'get' ? snapshot(entry) : [...entry.history, historical(entry)]};
  }
  const next = changeRecord(operation, request, entry);
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
