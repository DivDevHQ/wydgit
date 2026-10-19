import fs from 'node:fs/promises';
import path from 'node:path';
import { createGate } from '@wydgit/gate/client';
import { createStores } from '@wydgit/store/client';
import { configuration, load, gateContext, storageContext, directoryRequest } from './wydgate.js';
import { temp, caps, context, definition } from './wydstore.js';

export const readPermission = 'content.records.read';
export const writePermission = 'content.records.write';
export const permissions = [readPermission,writePermission,'content.history.read','content.schema.read'];
export const siteAuthorization = (collection='users') => {
  const read={contexts:['FrontEnd','BackOffice'],permission:readPermission};
  const write={contexts:['BackOffice'],permission:writePermission};
  const published={contexts:['FrontEnd','BackOffice'],public:true};
  return {schema:'wydstore.authorization/1',collections:{
    [collection]:{get:read,query:read,count:read,create:write,update:write,delete:write,transaction:write,
      history:{contexts:['BackOffice'],permission:'content.history.read'},
      metadata:{contexts:['BackOffice'],permission:'content.schema.read'}},
    published:{get:published,query:published,count:published}
  }};
};
export async function scopedFixture(t,provider='json',app='appA') {
  const root=await temp(t),gateRoot=path.join(root,'gate'),storeRoot=path.join(root,'content');
  await fs.mkdir(gateRoot);await fs.mkdir(storeRoot);
  const config=configuration(gateRoot,provider,{registration:'open'});
  const gate=config.libraries[0],identityStore=config.libraries[1].options.stores[0];
  gate.options.app=app;gate.bindings[0].app=app;identityStore.app=app;
  const store=definition(storeRoot,provider);store.app=app;
  store.collections.push({id:'published',fields:store.collections[0].fields});
  // Provision seed content before activating the trusted operation policy.
  config.libraries[1].options.stores.push(store);
  const seed=await load(config),seedContext=context({app,scopes:{wydstore:[{store:'main',collection:'users'},{store:'main',collection:'published'}]}});
  for(const collection of ['users','published']) {
    const result=await seed.bind(seedContext).call('wydstore','create',{store:'main',collection,id:'record',data:{name:app}});
    if(!result.ok)throw Error(result.code);
  }
  await seed.close();store.authorization=siteAuthorization();
  const registry=await load(config);t.after(()=>registry.close());
  const operator=gateContext({app,scopes:{wydgate:[app]}}),gateApi=createGate(registry.bind(operator));
  const password='scoped policy test passphrase';
  const registered=await gateApi.register({username:'alice',password});
  const role=await gateApi.createRole({name:'Editor',permissions});
  await gateApi.assignUser({userId:registered.account.id,roles:[role.id],permissions:[]});
  const login=await gateApi.login('alice',password),identity=await gateApi.resolveSession(login.token);
  const caller=(extra={})=>context({context:'BackOffice',app,identity,installation:'installed-content',
    scopes:{wydstore:[{store:'main',collection:'users'},{store:'main',collection:'published'}]},...extra});
  const services=(extra={})=>registry.bind(caller(extra));
  const collection=(extra={})=>createStores(services(extra)).get('main').collection('users');
  const storage=registry.bind(storageContextWithApp(app));
  return {root,app,provider,config,registry,gate:gateApi,registered,role,login,identity,caller,services,collection,storage,
    input:{store:'main',collection:'users',id:'record'},directoryRequest,caps};
}
export function storageContextWithApp(app) {
  const original=storageContext();
  return context({...original,app});
}
