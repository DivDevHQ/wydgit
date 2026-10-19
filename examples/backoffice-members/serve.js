// Private loopback demonstration host for an already provisioned App.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHostApp} from 'wydgine';
export async function serveMembers(root,port=3100){
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port must be 1–65535');
  const app=await createHostApp({root:path.resolve(root),localHostname:'localhost',strictStartup:true});
  const server=app.listen(port,'127.0.0.1');
  try{await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});}
  catch(error){await app.stop();throw error;}
  return {app,server};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [root,port='3100',...extra]=process.argv.slice(2);if(!root||extra.length)throw Error('Usage: node examples/backoffice-members/serve.js APP_ROOT [PORT]');
  const {app,server}=await serveMembers(root,Number(port));
  console.log(`Sign in through your site's membership page, then open http://localhost:${port}/backoffice`);
  let stopping;const stop=()=>stopping??=app.shutdown(server).catch(()=>{process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,stop);
}
