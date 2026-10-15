(async()=>{
 const result=document.getElementById('h3-result');
 try{
  const first=document.getElementById('first'),second=document.getElementById('second');
  const a=WydClient.mount({root:first,policy:taskboardPolicy}),b=WydClient.mount({root:second,policy:taskboardPolicy});
  const ready=await Promise.all([a.ready(),b.ready()]);if(ready.some(r=>!r.ok))throw Error(JSON.stringify(ready));
  const ea=a.execution(),eb=b.execution(),ra=ea.entry(),rb=eb.entry();
  if(ea.snapshot(ra).id!==eb.snapshot(rb).id)throw Error('fixture IDs must collide');
  let denied=false;try{await eb.invoke(ra,'SelectPage',[2]);}catch{denied=true;}if(!denied)throw Error('foreign receiver');
  await ea.invoke(ra,'SelectPage',[2]);if(eb.snapshot(rb).properties.CurrentPage!==1)throw Error('shared state');
  const pending=ea.invoke(ra,'SelectPage',[1]);a.unmount();await pending.catch(()=>{});
  denied=false;try{ea.snapshot(ra);}catch{denied=true;}if(!denied)throw Error('stale root');
  await eb.invoke(rb,'SelectPage',[2]);if(!second.textContent.includes('Verify lifecycle cleanup'))throw Error('survivor');
  const remount=WydClient.mount({root:first,policy:taskboardPolicy});if(!(await remount.ready()).ok)throw Error('remount');
  denied=false;try{await remount.execution().invoke(ra,'SelectPage',[2]);}catch{denied=true;}if(!denied)throw Error('old token remount');
  remount.unmount();b.unmount();result.textContent='PASS '+JSON.stringify({independent:true,foreignDenied:true,pendingUnmount:true,survivor:true,remountDenied:true,teardown:true});
 }catch(error){result.textContent='FAIL '+error.message;}
})();
