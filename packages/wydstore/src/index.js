import { openStores } from './core.js';
import { StoreError } from './data.js';
export const manifest = {
  schema:'wydgit.library/0.1', id:'wydstore', version:'0.1.0-alpha.2',
  publisher:'wydgit.core', trust:'canonical', platform:'^0.2.0-alpha.5', targets:['server'],
  capabilities:['store.records.read','store.records.create','store.records.write','store.records.delete'],
  services:[
    {name:'get',capability:'store.records.read'}, {name:'query',capability:'store.records.read'},
    {name:'history',capability:'store.records.read'}, {name:'create',capability:'store.records.create'},
    {name:'update',capability:'store.records.write'}, {name:'delete',capability:'store.records.delete'}
  ]
};
export async function register({service,options,failure}) {
  const safe = async fn => { try { return await fn(); } catch(error) { throw failure(error instanceof StoreError ? error.code : 'STORE.IO'); } };
  const stores = await safe(() => openStores(options));
  for(const {name} of manifest.services)service(name,
    (request,caller) => safe(() => stores.execute(name,request,caller)),
    {authorize:(request,caller) => safe(() => stores.authorize(request,caller))});
}
