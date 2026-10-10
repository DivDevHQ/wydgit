// Portable facade: no Node imports, provider settings, or raw service references.
import { check, StoreError, json, frozen, equal, idValid, record } from './data.js';
export { StoreError } from './data.js';
export function createStores(dispatch) {
  const call = async (operation, request) => {
    const result = await dispatch.call('wydstore',operation,request);
    if(!result.ok)throw new StoreError(result.code);
    return result.value;
  };
  return Object.freeze({ get(store) {
    check(idValid(store),'STORE.INVALID_RECORD');
    return Object.freeze({ collection(collection) {
      check(idValid(collection),'STORE.INVALID_RECORD');
      const scope = {store,collection};
      const handle = (snapshot, isNew = false) => {
        const id = snapshot.id;
        let original = isNew ? null : frozen(json(snapshot.data)), current = frozen(json(snapshot.data));
        let version = snapshot.version, deleted = false, busy = false;
        const available = () => check(!deleted && !busy, deleted ? 'STORE.DELETED' : 'STORE.BUSY');
        const result = {
          id,
          get version() { return version; },
          get original() { return original; }, get current() { return current; },
          get dirty() { return !deleted && (isNew || !equal(original,current)); },
          get state() { return deleted ? 'deleted' : isNew ? 'new' : !equal(original,current) ? 'modified' : 'unchanged'; },
          get(name) { return current[name]; },
          set(name,value) {
            available();check(idValid(name) && name !== 'id','STORE.INVALID_FIELD');
            current = frozen(json({...current,[name]:json(value)}));
          },
          reset(name) { available();check(idValid(name) && name !== 'id','STORE.INVALID_FIELD'); const copy = json(current); delete copy[name];current = frozen(copy); },
          async save() {
            available();
            if(!isNew && equal(original,current))return result;
            busy = true;
            try {
              const saved = await call(isNew ? 'create' : 'update',{...scope,id,data:current,...(isNew ? {} : {version})});
              version = saved.version; original = frozen(json(saved.data)); current = original; isNew = false;
              return result;
            } finally { busy = false; }
          },
          async delete() {
            available();check(!isNew,'STORE.NOT_FOUND');busy = true;
            try { const saved = await call('delete',{...scope,id,version}); version = saved.version; current = original; deleted = true; }
            finally { busy = false; }
          }
        };
        return Object.freeze(result);
      };
      return Object.freeze({
        async get(id) { check(idValid(id));return handle(await call('get',{...scope,id})); },
        create(id,data) { check(idValid(id));const copy = json(data);check(record(copy));return handle({id,version:0,data:copy},true); },
        async query(options = {}) { const opts = json(options);check(record(opts) && Object.keys(opts).every(k => ['where','limit'].includes(k)));return Object.freeze((await call('query',{...scope,...opts})).map(value => handle(value))); },
        async history(id) { check(idValid(id));return frozen(await call('history',{...scope,id})); }
      });
    } });
  } });
}
