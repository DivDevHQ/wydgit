// Deliberately faulty children used only by harness supervision tests.
const mode=process.argv[2];
process.once('disconnect',()=>process.exit());
if(mode==='parent'){
  const {fork}=await import('node:child_process');
  const {runSeparateClient}=await import('./http-client-process.js');
  let child;
  try{await runSeparateClient({port:12345,concurrency:2,admissionSpacingMs:0},{shutdownMs:25,
    launch:(_entry,_args,options)=>fork(new URL(import.meta.url),['hang'],options),
    onSpawn:c=>{child=c;c.once('message',()=>process.send({pid:c.pid}));}});}
  catch(error){process.send({code:error.code,reaped:child.exitCode!==null||child.signalCode!==null},()=>process.disconnect());}
}else if(mode==='startup')setInterval(()=>{},1000);
else {
  process.send({type:'ready'});
  process.once('message',()=>{
    if(mode==='exit')process.exit(7);
    else if(mode==='protocol')process.send({body:'private cookie path secret'});
    else {process.on('SIGTERM',()=>{});setInterval(()=>{},1000);}
  });
}
