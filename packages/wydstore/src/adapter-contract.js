// Internal WydStore contract. Not exported by the package; no provider wiring here.
// execute(operation, request) receives authorized, normalized requests and returns
// JSON snapshots/history. See docs/wydstore.md and the shared conformance suite.
import { check, fields, record, idValid, validateData, equal, json } from './data.js';
export const MAX_COLLECTION_RECORDS = 10000; // Includes tombstones.
export const MAX_QUERY = 10000;
const required = Object.freeze({get:['id'], query:[], history:['id'], create:['id','data'], update:['id','data','version'], delete:['id','version'], count:[], metadata:[]});
export function normalizeRequest(operation, input, definitions, copied = false) {
  const request = {...input};
  check(Object.hasOwn(required, operation));
  fields(request, ['store','collection',...required[operation]], ['query','count'].includes(operation) ? ['where','filter','sort','offset','limit'] : []);
  check(idValid(request.store) && idValid(request.collection));
  if (!['query','count','metadata'].includes(operation)) check(idValid(request.id));
  if (['update','delete'].includes(operation)) check(Number.isSafeInteger(request.version) && request.version >= 1);
  if (['create','update'].includes(operation)) request.data = validateData(request.data, definitions, !copied);
  if (['query','count'].includes(operation)) {
    const where = request.where === undefined ? {} : request.where;
    check(record(where), 'STORE.INVALID_FIELD');
    for (const [key, value] of Object.entries(where)) {
      check(Object.hasOwn(definitions, key), 'STORE.INVALID_FIELD');
      validateData({[key]:value}, {[key]:definitions[key]}, !copied);
    }
    validateQuery(request, definitions);
    check(request.limit === undefined || Number.isSafeInteger(request.limit) && request.limit >= 0 && request.limit <= MAX_QUERY);
  }
  return request;
}
export const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const snapshot = entry => ({id:entry.id, version:entry.version, data:entry.data});
export const historical = entry => ({version:entry.version, data:entry.data, deleted:entry.deleted});
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

export function validateQuery(request, definitions) {
  let nodes = 0;
  const visit = (filter, depth = 0) => {
    check(++nodes <= 64 && depth <= 8, 'STORE.LIMIT');
    check(record(filter), 'STORE.INVALID_QUERY');
    if (Object.hasOwn(filter,'and') || Object.hasOwn(filter,'or')) {
      const key = Object.hasOwn(filter,'and') ? 'and' : 'or';
      fields(filter,[key],[],'STORE.INVALID_QUERY');
      check(Array.isArray(filter[key]) && filter[key].length > 0 && filter[key].length <= 16,'STORE.INVALID_QUERY');
      filter[key].forEach(child => visit(child,depth+1)); return;
    }
    fields(filter,['field','op','value'],[],'STORE.INVALID_QUERY');
    check(Object.hasOwn(definitions,filter.field) && ['eq','ne','lt','lte','gt','gte'].includes(filter.op),'STORE.INVALID_QUERY');
    validateData({[filter.field]:filter.value},{[filter.field]:definitions[filter.field]});
    check(['eq','ne'].includes(filter.op) || ['number','string'].includes(definitions[filter.field].type),'STORE.INVALID_QUERY');
  };
  if (request.filter !== undefined) visit(request.filter);
  check(request.offset === undefined || Number.isSafeInteger(request.offset) && request.offset >= 0 && request.offset <= MAX_QUERY,'STORE.INVALID_QUERY');
  if (request.sort !== undefined) {
    check(Array.isArray(request.sort) && request.sort.length <= 8,'STORE.INVALID_QUERY');
    const seen = new Set();
    for (const item of request.sort) {
      fields(item,['field','direction'],[],'STORE.INVALID_QUERY');
      check(Object.hasOwn(definitions,item.field) && ['string','number','boolean','null'].includes(definitions[item.field].type) && ['asc','desc'].includes(item.direction) && !seen.has(item.field),'STORE.INVALID_QUERY');
      seen.add(item.field);
    }
  }
}
function predicate(data, filter) {
  if (!filter) return true;
  if (filter.and) return filter.and.every(child => predicate(data,child));
  if (filter.or) return filter.or.some(child => predicate(data,child));
  if (!Object.hasOwn(data,filter.field)) return false;
  const a=data[filter.field], b=filter.value;
  return ({eq:()=>equal(a,b),ne:()=>!equal(a,b),lt:()=>a<b,lte:()=>a<=b,gt:()=>a>b,gte:()=>a>=b})[filter.op]();
}
export function selectRecords(records, request, count = false, ordered = false) {
  const sorting=Boolean(request.sort?.length),selected=[];
  let found=0;
  const limit=request.limit ?? MAX_QUERY,offset=request.offset ?? 0;
  if(!count && limit===0)return [];
  // SQLite supplies a streaming ID-ordered iterator. JSON sorts lightweight
  // references within its already-loaded, capacity-bounded store document.
  const source=!count && !sorting && !ordered ? [...records].sort(byId) : records;
  for(const entry of source) {
    if(!matches(entry,request.where) || !predicate(entry.data,request.filter))continue;
    if(count){found++;continue;}
    if(sorting){request.addCandidate(snapshot(entry));selected.push(entry);continue;}
    if(found++<offset)continue;
    const value=snapshot(entry);request.addQueryResult(value);
    selected.push(value);if(selected.length===limit)break;
  }
  if(count)return found;
  if(!sorting)return selected;
  selected.sort((a,b) => {
    for (const {field,direction} of request.sort) {
      const hasA=Object.hasOwn(a.data,field), hasB=Object.hasOwn(b.data,field);
      const x=a.data[field], y=b.data[field];
      const order=hasA !== hasB ? (hasA ? 1 : -1) : !hasA || equal(x,y) ? 0 : x<y ? -1 : 1;
      if (order) return direction === 'desc' ? -order : order;
    }
    return byId(a,b);
  });
  return selected.slice(offset,offset+limit).map(snapshot);
}
export function enforceUnique(records, request, definitions) {
  for (const [field, rule] of Object.entries(definitions)) {
    if (!rule.unique || !Object.hasOwn(request.data,field)) continue;
    check(!records.some(entry => !entry.deleted && entry.id !== request.id && Object.hasOwn(entry.data,field) && equal(entry.data[field],request.data[field])), 'STORE.UNIQUE');
  }
}
export function validateUnique(records, definitions) {
  for (const [field,rule] of Object.entries(definitions)) {
    if (!rule.unique) continue;
    const values=new Set();
    for (const entry of records) {
      if (entry.deleted || !Object.hasOwn(entry.data,field)) continue;
      const value=JSON.stringify(json(entry.data[field]));
      check(!values.has(value),'STORE.CORRUPT'); values.add(value);
    }
  }
}
