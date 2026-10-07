import { check, record, fields, validateData, idValid, equal, json } from './data.js';

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
      check(Array.isArray(collection.records) && collection.records.length <= 10000);
      const ids = new Set();
      for (const entry of collection.records) {
        fields(entry, ['id', 'version', 'data', 'deleted', 'history']);
        check(idValid(entry.id) && !ids.has(entry.id));
        ids.add(entry.id);
        check(Number.isSafeInteger(entry.version) && entry.version >= 1 &&
          typeof entry.deleted === 'boolean' && Array.isArray(entry.history) &&
          entry.history.length === entry.version - 1);
        check(entry.deleted
          ? entry.data === null && entry.version >= 2
          : equal(entry.data, validateData(entry.data, definitions.get(id))));
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

const snapshot = entry => ({id: entry.id, version: entry.version, data: json(entry.data)});
const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

// Operates only on a private, validated document inside the adapter's lock.
export function applyOperation(document, operation, request) {
  const records = document.collections[request.collection].records;
  const entry = records.find(entry => entry.id === request.id);
  if (operation === 'query') {
    const matches = records.filter(entry => !entry.deleted &&
      Object.entries(request.where ?? {}).every(([key, value]) =>
        Object.hasOwn(entry.data, key) && equal(entry.data[key], value)));
    matches.sort(byId);
    return {changed: false, value: matches.slice(0, request.limit ?? 10000).map(snapshot)};
  }
  if (operation === 'create') {
    check(!entry, 'STORE.DUPLICATE_ID');
    check(records.length < 10000, 'STORE.LIMIT');
    const created = {id: request.id, version: 1, data: request.data, deleted: false, history: []};
    records.push(created);
    records.sort(byId);
    return {changed: true, value: snapshot(created)};
  }
  check(entry, 'STORE.NOT_FOUND');
  if (['update', 'delete'].includes(operation)) check(!entry.deleted, 'STORE.CONFLICT');
  else check(operation === 'history' || !entry.deleted, 'STORE.NOT_FOUND');
  if (operation === 'get') return {changed: false, value: snapshot(entry)};
  if (operation === 'history') return {
    changed: false,
    value: [...entry.history, {version: entry.version, data: entry.data, deleted: entry.deleted}]
  };
  check(request.version === entry.version, 'STORE.CONFLICT');
  if (operation === 'update' && equal(entry.data, request.data)) {
    return {changed: false, value: snapshot(entry)};
  }
  check(entry.version < Number.MAX_SAFE_INTEGER, 'STORE.LIMIT');
  entry.history.push({version: entry.version, data: entry.data, deleted: false});
  entry.version++;
  entry.data = operation === 'delete' ? null : request.data;
  entry.deleted = operation === 'delete';
  return {
    changed: true,
    value: entry.deleted ? {id: entry.id, version: entry.version, deleted: true} : snapshot(entry)
  };
}
