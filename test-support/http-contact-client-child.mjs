import {runContactClient} from './http-contact-client.js';
// A dead parent closes IPC even after SIGKILL. This client has no descendants.
process.once('disconnect',()=>process.exit());
process.once('message',async message=>{
  try{
    if(message?.type!=='run')throw Error();
    const value=await runContactClient(message.configuration);
    process.send(value,error=>{if(error)process.exitCode=1;process.disconnect();});
  }catch{process.exitCode=1;process.disconnect();}
});
process.send({type:'ready'});
