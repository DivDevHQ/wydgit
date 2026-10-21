// Disposable installed-process qualification, no production migration.
import {createHostApp} from '../app.js';
const [root,verified]=process.argv.slice(2);
try{
  const app=await createHostApp({root,localHostname:'127.0.0.1',execution:{verifiedPackages:JSON.parse(verified??'{}')},logger:{error(){}}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  process.send({port:server.address().port});
  process.once('message',async()=>{await app.shutdown(server);process.disconnect();});
}catch(error){process.send({code:error.code??'FAILED'});process.disconnect();}
