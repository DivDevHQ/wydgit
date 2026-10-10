// Separate process exercises real SQLite locking, not just event-loop sequencing.
import { load, context } from './wydstore.js';
import { createStores } from '@wydgit/store/client';
let item;
process.on('message',async message=>{
 try {
  if(message.store){
   const registry=await load(message.store);
   item=await createStores(registry.bind(context())).get('main').collection('users').get('item');
   process.send({ready:true});
  } else {
   if(message.operation==='delete')await item.delete();else{item.set('name',message.name);await item.save();}
   process.send({ok:true},()=>process.disconnect());
  }
 }catch(error){process.send({ok:false,code:error.code},()=>process.disconnect());}
});
