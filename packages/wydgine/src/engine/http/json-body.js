import {WydgitError} from '../object-model/validation.js';

// Bound raw bytes before JSON parsing; no compressed request amplification. A body
// timeout cancels collection, never a service operation that may already commit.
export async function readBackOfficeJson(stream,requestMs){
  if(!stream)throw new WydgitError('HTTP.REQUEST','Missing JSON');
  const reader=stream.getReader(),chunks=[];let size=0,timer;
  const timedOut=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new WydgitError('HTTP.LIMIT','Body deadline'));void reader.cancel().catch(()=>{});},Math.min(requestMs,15000));});
  try{
    const text=await Promise.race([(async()=>{
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>48000)throw new WydgitError('HTTP.LIMIT','Body limit');chunks.push(value);}
      return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
    })(),timedOut]);
    return JSON.parse(text);
  }finally{clearTimeout(timer);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
