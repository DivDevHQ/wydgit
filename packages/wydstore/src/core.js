import { storeLimits, budget, resultCollector } from './resource-limits.js';
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
      fields(store,['id','app','publisher','package','provider','root','collections'],['principal','installation','limits'],'STORE.INVALID_CONFIG');
      check(idValid(store.id) && idValid(store.app) && typeof store.publisher === 'string' && /^[a-z][a-z0-9.-]*$/.test(store.publisher) && typeof store.package === 'string' && store.package.length > 0 && ['json','sqlite'].includes(store.provider),'STORE.INVALID_CONFIG');
      storeLimits(store.limits);
      check(!ids.has(store.id),'STORE.INVALID_CONFIG'); ids.add(store.id);
      for (const key of ['principal','installation']) check(store[key] === undefined || typeof store[key] === 'string' && store[key].length > 0 && store[key].length <= 256,'STORE.INVALID_CONFIG');
      check(Array.isArray(store.collections),'STORE.INVALID_CONFIG');
      const collections = new Set();
      for (const collection of store.collections) {
        fields(collection,['id','fields'],['schemaId','schemaVersion'],'STORE.INVALID_CONFIG');
        check(idValid(collection.id) && !collections.has(collection.id),'STORE.INVALID_CONFIG');
        collections.add(collection.id); schema(collection.fields);
        check((collection.schemaId === undefined && collection.schemaVersion === undefined) || idValid(collection.schemaId) && Number.isSafeInteger(collection.schemaVersion) && collection.schemaVersion >= 1,'STORE.INVALID_CONFIG');
      }
    }
  } catch { throw new StoreError('STORE.INVALID_CONFIG'); }
  return config;
}

export async function openStores(input, rawCheckJson) {
  const checkJson=(value,limits)=>{try{return rawCheckJson(value,limits);}catch{throw new StoreError('STORE.LIMIT');}};
  const config = validateStoreConfig(input);
  const stores = new Map();
  for (const definition of config.stores) {
    const limits=storeLimits(definition.limits);
    const definitions = new Map(definition.collections.map(c => [c.id,c.fields]));
    const owner = { app:definition.app, publisher:definition.publisher, package:definition.package, store:definition.id, ...Object.fromEntries(['principal','installation'].filter(key => definition[key] !== undefined).map(key => [key,definition[key]])) };
    const metadata = new Map(definition.collections.map(c => [c.id,c]));
    const openAdapter = definition.provider === 'json' ? openJsonAdapter : (await import('./sqlite-adapter.js')).openSqliteAdapter;
    const adapter = await openAdapter(definition.root,owner,definitions,metadata,limits,checkJson);
    stores.set(definition.id,{definition,definitions,adapter,metadata,limits});
  }
  const authorize = (request, caller) => {
    check(record(request) && idValid(request.store) && idValid(request.collection),'STORE.INVALID_RECORD');
    const grants = caller.scopes?.wydstore;
    check(Array.isArray(grants) && grants.some(grant => record(grant) && grant.store === request.store && grant.collection === request.collection),'STORE.DENIED');
    const store = stores.get(request.store); check(store,'STORE.UNKNOWN_STORE');
    check(caller.app === store.definition.app && caller.publisher === store.definition.publisher && caller.package === store.definition.package,'STORE.DENIED');
    check(caller.principal === (store.definition.principal ?? store.definition.package),'STORE.DENIED');
    if (store.definition.installation !== undefined) check(caller.installation === store.definition.installation,'STORE.DENIED');
    check(store.definitions.has(request.collection),'STORE.UNKNOWN_COLLECTION');
    return true;
  };
  const capabilities = {get:'read',query:'read',count:'read',metadata:'read',history:'read',create:'create',update:'write',delete:'delete',transaction:'write'};
  const prepare = (operation, request, caller, policy) => {
    authorize(request,caller);
    check(caller.capabilities.includes(`store.records.${capabilities[operation]}`),'SEAM.DENIED');
    const store=stores.get(request.store),limits=store.limits;
    if(limits.maxDepth<policy.request.maxDepth || limits.maxNodes<policy.request.maxNodes)
      checkJson(request,budget(limits,policy.request.maxBytes,policy.request),'STORE.LIMIT');
    const normalized=normalizeRequest(operation,request,store.definitions.get(request.collection),true);
    normalized.definitions=store.definitions.get(request.collection);
    if(operation==='query'){
      normalized.addQueryResult=resultCollector(checkJson,budget(limits,limits.queryResultBytes,policy.response));
      if(normalized.sort?.length)normalized.addCandidate=normalized.addQueryResult;
    }
    if(operation==='history')normalized.addHistoryResult=resultCollector(checkJson,budget(limits,policy.response.maxBytes,policy.response));
    if (['create','update'].includes(operation)) {
      checkJson(normalized.data,budget(limits,limits.recordBytes),'STORE.LIMIT');
      // Serialize the validated, defaulted record once, reused by SQLite writes.
      if(store.definition.provider==='sqlite')normalized.encodedData=JSON.stringify(normalized.data);
    }
    normalized.checkResult=value=>checkJson(value,budget(limits,policy.response.maxBytes,policy.response),'STORE.LIMIT');
    return normalized;
  };
  // Reuse preparation across authorization/validation/handler, without retaining
  // callers or large requests after dispatch. Only frozen dispatcher inputs enter.
  const prepared=new WeakMap();
  const validate = (operation, raw, caller, policy) => {
    const cached=prepared.get(raw);
    if(cached && cached.operation===operation && cached.caller===caller && cached.policy===policy)return cached.request;
    let request;
    if (operation !== 'transaction') request=prepare(operation,raw,caller,policy);
    else {
      fields(raw,['store','collection','operations']);authorize(raw,caller);
      check(caller.capabilities.includes('store.records.write'),'SEAM.DENIED');
      const limits=stores.get(raw.store).limits;
      check(Array.isArray(raw.operations)&&raw.operations.length>0&&raw.operations.length<=Math.min(limits.maxOperations,caller.limits.storeOperations ?? limits.maxOperations),'STORE.LIMIT');
      if(limits.transactionRequestBytes<policy.request.maxBytes || limits.maxDepth<policy.request.maxDepth || limits.maxNodes<policy.request.maxNodes)
        checkJson(raw,budget(limits,limits.transactionRequestBytes,policy.request),'STORE.LIMIT');
      request={...raw,operations:raw.operations.map(item=>{
        fields(item,['operation','input']);
        check(['get','query','count','history','create','update','delete'].includes(item.operation),'STORE.UNSUPPORTED');
        check(record(item.input));check(item.input.store===undefined||item.input.store===raw.store,'STORE.DENIED');
        const input={store:raw.store,collection:raw.collection,...item.input};
        return {operation:item.operation,request:prepare(item.operation,input,caller,policy)};
      })};
      request.addResult=resultCollector(checkJson,budget(limits,limits.transactionResultBytes,policy.response));
    }
    if (raw && typeof raw==='object') prepared.set(raw,{operation,caller,policy,request});
    return request;
  };
  const execute = async (operation, raw, caller, policy) => {
    try {
      const request=validate(operation,raw,caller,policy),store=stores.get(request.store);
      if (operation==='metadata') {const value=json(store.metadata.get(request.collection));request.checkResult(value);return value;}
      return await store.adapter.execute(operation,request);
    } finally {prepared.delete(raw);}
  };
  return frozen({authorize,execute,validate});
}
