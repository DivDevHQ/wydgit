// Trusted test worker holds the same O_EXCL local lock used by the JSON adapter.
import { open, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
let handle,lock;
process.on('message',async message=>{
 if(message.lock){lock=message.lock;handle=await open(lock,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);process.send({ready:true});}
 else{await handle.close();await unlink(lock);process.disconnect();}
});
