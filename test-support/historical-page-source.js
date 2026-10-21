// Reconstruct only the historical FrontEnd path, allowing B4b's explicit server
// BackOffice branches. The entire resulting source must equal the hashed archive;
// unrelated execution, deadline, completion and guard changes still fail the pin.
export function historicalFrontEndPageSource(source){
  return source.replace('serviceMappings,backoffice,csrf','serviceMappings,csrf')
    .replace(/  const compositionOnly=context\.context==='BackOffice'[\s\S]*?  const contexts=guard=>/, '  const contexts=guard=>')
    .replace('SERVICES:compositionOnly?serviceFacade(guard):Object.freeze(', 'SERVICES:Object.freeze(')
    .replace('services:compositionOnly?undefined:contexts(rootGuard).SERVICES','services:contexts(rootGuard).SERVICES')
    .replace("const receiver=options.scope.ME,id=receiver.id;if(compositionOnly)options={...options,scope:{...options.scope,SERVICES:serviceFacade(()=>{check(receiver.id===id,'ACTION.DENIED','Expired receiver');},delegates(document)?undefined:id)}};", 'const id=options.scope.ME.id;')
    .replace('context,compositionOnly?undefined:libraries,session,presentationLedger','context,libraries,session,presentationLedger');
}
