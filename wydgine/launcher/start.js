import {createHostApp} from '../../app.js';
import {validateSelected} from './selection.js';
import {error} from './config.js';

export async function launch(selected,listener){
 // Revalidate after interaction and immediately before trusted initialization.
 const fresh=await validateSelected(selected.root);
 if(fresh.id!==selected.id||fresh.snapshot!==selected.snapshot)throw error('LAUNCH.APP_CHANGED','App changed after selection; select it again');
 let app,server;
 try{
  app=await createHostApp({root:fresh.root,appId:fresh.id,strictStartup:true,logger:{error(){}}});
  server=app.listen(listener.port,listener.host);
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  return {app,server,id:fresh.id};
 }catch(cause){
  try{if(server?.listening)await app.shutdown(server);else await app?.stop();}catch{}
  if(cause.code==='EADDRINUSE')throw error('LAUNCH.LISTENER_IN_USE','Configured listener is already in use; assign a distinct port');
  throw error('LAUNCH.START_FAILED','App startup or listener failed; check approved services and listener availability');
 }
}
export function installSignals(runtime,{processObject=process,shutdownMs=5000}={}){
 let stopping;
 const stop=()=>stopping??=(async()=>{
  const timer=setTimeout(()=>{runtime.server.closeAllConnections();processObject.exit(1);},shutdownMs);timer.unref();
  try{await runtime.app.shutdown(runtime.server);}catch{processObject.exitCode=1;}finally{clearTimeout(timer);for(const s of ['SIGINT','SIGTERM'])processObject.off(s,stop);}
 })();
 for(const signal of ['SIGINT','SIGTERM'])processObject.on(signal,stop);
 return stop;
}
