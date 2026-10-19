import { openStores } from './core.js';
import { StoreError } from './data.js';
export const manifest = {
  schema:'wydgit.library/0.1', apiVersion:'1.0.0', legacyOperations:['get','query','history','create','update','delete'], id:'wydstore', version:'0.1.0-alpha.6',
  publisher:'wydgit.core', trust:'canonical', platform:'^0.3.0-alpha.20', targets:['server'],
  capabilities:['store.records.read','store.records.create','store.records.write','store.records.delete'],
  services:[
    {name:'count',capability:'store.records.read'}, {name:'metadata',capability:'store.records.read'}, {name:'transaction',capability:'store.records.write'},
    {name:'get',capability:'store.records.read'}, {name:'query',capability:'store.records.read'},
    {name:'history',capability:'store.records.read'}, {name:'create',capability:'store.records.create'},
    {name:'update',capability:'store.records.write'}, {name:'delete',capability:'store.records.delete'}
  ]
};
export const administrativeOperations=Object.freeze(Object.fromEntries(manifest.services.map(({name})=>[name,['get','query','count','metadata','history'].includes(name)?'read':'write'])));
export async function register({service,options,failure,checkJson,authorizeSitePolicy,checkCaller}) {
  const safe = async fn => { try { return await fn(); } catch(error) { throw failure(error instanceof StoreError ? error.code : 'STORE.IO'); } };
  const stores = await safe(() => openStores(options,checkJson,{authorizeSitePolicy,checkCaller}));
  for(const {name} of manifest.services)service(name,
    (request,caller,policy) => safe(() => stores.execute(name,request,caller,policy)),
    {administration:administrativeOperations[name],administrativeAuthorize:(caller,resources)=>safe(()=>stores.authorizeAdministration(name,caller,resources)),presentation:['get','query','count','metadata','history'].includes(name),authorize:(request,caller,policy) => safe(() => { stores.validate(name,request,caller,policy); return true; }), validate:() => true});
}
