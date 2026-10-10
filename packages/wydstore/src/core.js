import { check, StoreError, json, record, fields, schema, idValid, frozen } from './data.js';
import { openJsonAdapter } from './json-adapter.js';
import { normalizeRequest } from './adapter-contract.js';

export function validateStoreConfig(input) {
  let config;
  try {
    config = json(input); fields(config,['stores'],[],'STORE.INVALID_CONFIG');
    check(Array.isArray(config.stores),'STORE.INVALID_CONFIG');
    const ids = new Set();
    for (const store of config.stores) {
      fields(store,['id','app','publisher','package','provider','root','collections'],[],'STORE.INVALID_CONFIG');
      check(idValid(store.id) && idValid(store.app) && typeof store.publisher === 'string' && /^[a-z][a-z0-9.-]*$/.test(store.publisher) && typeof store.package === 'string' && store.package.length > 0 && ['json','sqlite'].includes(store.provider),'STORE.INVALID_CONFIG');
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
  return config;
}

export async function openStores(input) {
  const config = validateStoreConfig(input);
  const stores = new Map();
  for (const definition of config.stores) {
    const definitions = new Map(definition.collections.map(c => [c.id,c.fields]));
    const owner = { app:definition.app, publisher:definition.publisher, package:definition.package, store:definition.id };
    const openAdapter = definition.provider === 'json' ? openJsonAdapter : (await import('./sqlite-adapter.js')).openSqliteAdapter;
    const adapter = await openAdapter(definition.root,owner,definitions);
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
    const store = stores.get(request.store);
    return store.adapter.execute(operation, normalizeRequest(operation, request, store.definitions.get(request.collection)));
  };
  return frozen({authorize,execute});
}
