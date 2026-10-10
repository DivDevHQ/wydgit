// Internal WydStore contract. Not exported by the package; no provider wiring here.
// execute(operation, request) receives authorized, normalized requests and returns
// JSON snapshots/history. See docs/wydstore.md and the shared conformance suite.
import { check, fields, record, idValid, validateData, equal, json } from './data.js';
export const MAX_COLLECTION_RECORDS = 10000; // Includes tombstones.
export const MAX_QUERY = 10000;
const required = Object.freeze({get:['id'], query:[], history:['id'], create:['id','data'], update:['id','data','version'], delete:['id','version']});
export function normalizeRequest(operation, input, definitions) {
  const request = json(input);
  check(Object.hasOwn(required, operation));
  fields(request, ['store','collection',...required[operation]], operation === 'query' ? ['where','limit'] : []);
  check(idValid(request.store) && idValid(request.collection));
  if (operation !== 'query') check(idValid(request.id));
  if (['update','delete'].includes(operation)) check(Number.isSafeInteger(request.version) && request.version >= 1);
  if (['create','update'].includes(operation)) request.data = validateData(request.data, definitions);
  if (operation === 'query') {
    const where = request.where ?? {};
    check(record(where), 'STORE.INVALID_FIELD');
    for (const [key, value] of Object.entries(where)) {
      check(Object.hasOwn(definitions, key), 'STORE.INVALID_FIELD');
      validateData({[key]:value}, {[key]:definitions[key]});
    }
    check(request.limit === undefined || Number.isSafeInteger(request.limit) && request.limit >= 0 && request.limit <= MAX_QUERY);
  }
  return request;
}
export const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const snapshot = entry => ({id:entry.id, version:entry.version, data:json(entry.data)});
export const historical = entry => ({version:entry.version, data:json(entry.data), deleted:entry.deleted});
export const matches = (entry, where = {}) => !entry.deleted && Object.entries(where).every(([key,value]) => Object.hasOwn(entry.data,key) && equal(entry.data[key],value));
export function validateStored(entry, definitions) {
  check(idValid(entry.id) && Number.isSafeInteger(entry.version) && entry.version >= 1 && typeof entry.deleted === 'boolean');
  check(entry.deleted ? entry.version >= 2 && entry.data === null : equal(entry.data, validateData(entry.data, definitions)));
}
// Called under each adapter's atomic write boundary. Never mutates its input.
export function changeRecord(operation, request, entry) {
  if (operation === 'create') {
    check(!entry, 'STORE.DUPLICATE_ID');
    return {id:request.id, version:1, data:request.data, deleted:false};
  }
  check(entry, 'STORE.NOT_FOUND');
  check(!entry.deleted && request.version === entry.version, 'STORE.CONFLICT');
  if (operation === 'update' && equal(entry.data, request.data)) return null;
  check(entry.version < Number.MAX_SAFE_INTEGER, 'STORE.LIMIT');
  return {id:entry.id, version:entry.version + 1, data:operation === 'delete' ? null : request.data, deleted:operation === 'delete'};
}
