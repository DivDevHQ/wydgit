import { check, StoreError, json, record, fields, schema, validateData, idValid, frozen } from './data.js';
import { openJsonAdapter } from './json-adapter.js';

export async function openStores(input) {
  let config;
  try {
    config = json(input); fields(config,['stores'],[],'STORE.INVALID_CONFIG');
    check(Array.isArray(config.stores),'STORE.INVALID_CONFIG');
    const ids = new Set();
    for (const store of config.stores) {
      fields(store,['id','app','publisher','package','provider','root','collections'],[],'STORE.INVALID_CONFIG');
      check(idValid(store.id) && idValid(store.app) && typeof store.publisher === 'string' && /^[a-z][a-z0-9.-]*$/.test(store.publisher) && typeof store.package === 'string' && store.package.length > 0 && store.provider === 'json','STORE.INVALID_CONFIG');
      check(!ids.has(store.id),'STORE.INVALID_CONFIG'); ids.add(store.id);
      check(Array.isArray(store.collections),'STORE.INVALID_CONFIG');
      const collections = new Set();
      for (const collection of store.collections) {
        fields(collection,['id','fields'],[],'STORE.INVALID_CONFIG');
        check(idValid(collection.id) && !collections.has(collection.id),'STORE.INVALID_CONFIG');
        collections.add(collection.id); schema(collection.fields);
      }
    }
  } catch { throw new StoreError('STORE.INVALID_CONFIG'); }
  const stores = new Map();
  for (const definition of config.stores) {
    const definitions = new Map(definition.collections.map(c => [c.id,c.fields]));
    const owner = { app:definition.app, publisher:definition.publisher, package:definition.package, store:definition.id };
    const adapter = await openJsonAdapter(definition.root,owner,definitions);
    stores.set(definition.id,{definition,definitions,adapter});
  }
  const authorize = (request, caller) => {
    check(record(request) && idValid(request.store) && idValid(request.collection),'STORE.INVALID_RECORD');
    const grants = caller.scopes?.wydstore;
    check(Array.isArray(grants) && grants.some(grant => record(grant) && grant.store === request.store && grant.collection === request.collection),'STORE.DENIED');
    const store = stores.get(request.store); check(store,'STORE.UNKNOWN_STORE');
    check(caller.app === store.definition.app && caller.publisher === store.definition.publisher && caller.package === store.definition.package,'STORE.DENIED');
    check(store.definitions.has(request.collection),'STORE.UNKNOWN_COLLECTION');
    return true;
  };
  const execute = async (operation, raw, caller) => {
    const request = json(raw); authorize(request,caller);
    const required = ['store','collection'];
    const perOperation = { get:['id'], history:['id'], query:[], create:['id','data'], update:['id','data','version'], delete:['id','version'] };
    check(Object.hasOwn(perOperation,operation),'STORE.INVALID_RECORD');
    fields(request,[...required,...perOperation[operation]],operation === 'query' ? ['where','limit'] : []);
    if(operation !== 'query')check(idValid(request.id),'STORE.INVALID_RECORD');
    if(['update','delete'].includes(operation))check(Number.isSafeInteger(request.version) && request.version >= 1,'STORE.INVALID_RECORD');
    const store = stores.get(request.store), definitions = store.definitions.get(request.collection);
    let data;
    if(['create','update'].includes(operation))data = validateData(request.data,definitions);
    if(operation === 'query') {
      const where = request.where ?? {}; check(record(where),'STORE.INVALID_FIELD');
      for(const [key,value] of Object.entries(where)) {
        check(Object.hasOwn(definitions,key),'STORE.INVALID_FIELD');
        validateData({[key]:value},{[key]:definitions[key]});
      }
      check(request.limit === undefined || Number.isSafeInteger(request.limit) && request.limit >= 0 && request.limit <= 10000,'STORE.INVALID_RECORD');
    }
    return store.adapter.execute(operation,{...request,...(data === undefined ? {} : {data})});
  };
  return frozen({authorize,execute});
}
