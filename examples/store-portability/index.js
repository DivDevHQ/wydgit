// Trusted test/host fixture: supply only a caller-bound dispatch and logical IDs.
// The same application logic uses either host-selected adapter.
import { createStores } from '@wydgit/store/client';
export async function demonstrateStore(dispatch, store = 'main', collection = 'users') {
 const users=createStores(dispatch).get(store).collection(collection);
 await users.transaction([
  {operation:'create',input:{id:'ada',data:{name:'Ada',score:10}}},
  {operation:'create',input:{id:'grace',data:{name:'Grace',score:20}}}
 ]);
 return {
  count:await users.count({filter:{field:'score',op:'gte',value:10}}),
  names:(await users.query({sort:[{field:'score',direction:'desc'}],limit:2})).map(user=>user.get('name'))
 };
}
