// Native transport implementation only; no buffering and no wire-delivery claim.
export function meteredOutput(native,head,meter){
 const denied=()=>{
  if(!native.headersSent){for(const name of ['Content-Length','Content-Range','ETag','Set-Cookie','Transfer-Encoding'])native.removeHeader(name);native.statusCode=503;native.setHeader('Cache-Control','no-store');native.end();}
  else if(!native.writableEnded)native.destroy();
 };
 const send=(chunk,write)=>{
  if(native.destroyed||native.writableEnded)throw Error('Response ended');
  const suppressed=head||[204,304].includes(native.statusCode),body=suppressed?undefined:chunk;
  try{return meter.payload(body===undefined?0:typeof body==='string'?Buffer.byteLength(body):body.byteLength,()=>write(body));}
  catch(error){if(error.code==='HOST.QUOTA')denied();throw error;}
 };
 return Object.freeze({end:chunk=>send(chunk,body=>native.end(body)),write:chunk=>send(chunk,body=>body===undefined?true:native.write(body)),destroy(){if(!native.writableEnded)native.destroy();}});
}
