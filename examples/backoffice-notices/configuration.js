// Native configuration example only; never loaded as ordinary package behavior.
import manifest from './manifest.json' with {type:'json'};
export function noticeStore({app,root,provider='json'}){
  return {id:'operations',app,publisher:manifest.publisher,package:manifest.id,provider,root,
    collections:[{id:'notices',fields:manifest.storage[0].fields}],
    authorization:{schema:'wydstore.authorization/1',collections:{notices:{query:{contexts:['BackOffice'],permission:'operations.notices.read'},create:{contexts:['BackOffice'],permission:'operations.notices.write'}}}}};
}
