// Test-only WebDriver BiDi bridge for the shared local browser journey.
// https://developer.mozilla.org/en-US/docs/Web/WebDriver/How_to/Create_BiDi_connection
// No downloaded driver, privileged browser context or persistent profile.
export async function firefoxProtocol(send){
 await send('session.new',{capabilities:{}});
 const {contexts}=await send('browsingContext.getTree',{}),context=contexts[0].context;
 await send('browsingContext.activate',{context});
 const evaluate=async expression=>{
  const r=await send('script.evaluate',{expression:`(async()=>JSON.stringify(await (${expression})))()`,target:{context},awaitPromise:true});
  if(r.type==='exception')throw Error('Firefox evaluation failed');
  return r.result.type==='undefined'?undefined:JSON.parse(r.result.value);
 };
 const actions=values=>send('input.performActions',{context,actions:values});
 return async(method,p={})=>{
  switch(method){
   case 'Page.enable':case 'Network.enable':return {};
   case 'Runtime.evaluate':return {result:{value:await evaluate(p.expression)}};
   case 'Page.navigate':return send('browsingContext.navigate',{context,url:p.url,wait:'complete'});
   case 'Network.getCookies':return send('storage.getCookies',{partition:{type:'context',context}});
   case 'Emulation.setDeviceMetricsOverride':return send('browsingContext.setViewport',{context,viewport:{width:p.width,height:p.height},devicePixelRatio:p.deviceScaleFactor});
   case 'Page.getLayoutMetrics':return {cssContentSize:await evaluate('({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})')};
   case 'Page.captureScreenshot':return send('browsingContext.captureScreenshot',{context,origin:p.captureBeyondViewport?'document':'viewport'});
   case 'Input.dispatchMouseEvent':if(p.type==='mouseWheel')return actions([{type:'wheel',id:'wheel',actions:[{type:'scroll',x:p.x,y:p.y,deltaX:p.deltaX,deltaY:p.deltaY,duration:0,origin:'viewport'}]}]);return actions([{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(p.x),y:Math.round(p.y),duration:0,origin:'viewport'},{type:p.type==='mousePressed'?'pointerDown':'pointerUp',button:0}]}]);
   case 'Input.dispatchKeyEvent':{
    const value=({Tab:'\uE004',Enter:'\uE007',ArrowRight:'\uE014'})[p.key]??p.key;
    return actions([{type:'key',id:'keyboard',actions:[{type:p.type==='keyDown'?'keyDown':'keyUp',value}]}]);
   }
   case 'Input.insertText':return actions([{type:'key',id:'keyboard',actions:[...p.text].flatMap(value=>[{type:'keyDown',value},{type:'keyUp',value}])}]);
   default:throw Error('Unsupported Firefox qualification command: '+method);
  }
 };
}
