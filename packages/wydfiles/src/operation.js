import {Readable} from 'node:stream';
import {performance} from 'node:perf_hooks';
import {check,FilesError} from './contract.js';

export function operation(limits){
 check(Number.isSafeInteger(limits.chunkBytes)&&limits.chunkBytes>0,'FILES.LIMIT');
 check(Number.isSafeInteger(limits.durationMs)&&limits.durationMs>0,'FILES.LIMIT');
 return Object.freeze({limits:Object.freeze({...limits}),deadline:performance.now()+limits.durationMs});
}
export function remaining(op){const ms=op.deadline-performance.now();check(ms>0,'FILES.TIMEOUT');return ms;}
export async function within(work,op,cancel=()=>{}){
 const ms=remaining(op);let timer;
 try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{cancel();reject(new FilesError('FILES.TIMEOUT'));},Math.ceil(ms));})]);}
 finally{clearTimeout(timer);}
}
export async function* boundedStream(stream,size,op,maxBytes=op.limits.fileBytes){
 check(Number.isSafeInteger(op.limits.chunkBytes)&&op.limits.chunkBytes>0,'FILES.LIMIT');
 if(typeof stream?.getReader==='function')stream=Readable.fromWeb(stream);
 let count=0;const iterator=stream[Symbol.asyncIterator]();
 try{
  while(true){
   const step=await within(()=>iterator.next(),op,()=>stream.destroy?.());if(step.done)break;
   const chunk=step.value;check(Buffer.isBuffer(chunk)||chunk instanceof Uint8Array,'FILES.INVALID_REQUEST');
   count+=chunk.length;check(count<=maxBytes&&(size===undefined||count<=size),'FILES.LIMIT');
   for(let at=0;at<chunk.length;at+=op.limits.chunkBytes){remaining(op);yield chunk.subarray(at,at+op.limits.chunkBytes);}
  }
  check(size===undefined||count===size,'FILES.INTERRUPTED');
 }finally{stream.destroy?.();}
}
