(async()=>{
 const result=document.getElementById('h3-result');
 try{
  const start=performance.now(),ready=await WydClient.ready();if(!ready.ok)throw Error(JSON.stringify(ready));
  const bootstrapMs=performance.now()-start,e=WydClient.execution(),root=e.entry(),list=e.children(root,'blocks')[1],old=e.children(list,'blocks');
  if(!document.body.textContent.includes('Write WBasic')||old.length!==2)throw Error('initial list');
  await e.invoke(root,'SelectPage',[1]);
  if(e.children(list,'blocks').some((ref,index)=>e.snapshot(ref).id!==e.snapshot(old[index]).id||e.snapshot(ref).properties.InitCount!==1))throw Error('retained keyed identity');
  document.getElementById('next').onclick=async()=>{await e.invoke(root,'SelectPage',[2]);};
  const action=performance.now();await e.invoke(root,'SelectPage',[2]);await e.render();const executionMs=performance.now()-action;
  if(e.snapshot(root).properties.CurrentPage!==2||!document.body.textContent.includes('Verify lifecycle cleanup')||document.body.textContent.includes('Write WBasic'))throw Error('SEWN update');
  for(const ref of old){let denied=false;try{e.snapshot(ref);}catch{denied=true;}if(!denied)throw Error('removed reference');}
  await e.unload();await e.activate();
  const report={bootstrapMs,executionMs,initial:2,updated:1,typedEvent:true,lifecycle:true,staleReferences:true,retainedKeys:true};
  result.textContent='PASS '+JSON.stringify(report);
 }catch(error){result.textContent='FAIL '+error.message;}
})();
