// Trusted transport utilities. Never exposed through a Wydgit handle.
import { requireThat as check } from '../object-model/validation.js';
import Busboy from 'busboy';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
export async function receiveFile(body,headers,limits,consume) {
  if(!body||headers.encoding!=='identity'||!Number.isSafeInteger(limits.fileBytes)||limits.fileBytes<1||!Number.isSafeInteger(limits.durationMs)||limits.durationMs<1||!Array.isArray(limits.fields)||limits.fields.length>16)throw new Error('TRANSFER.INVALID');
  const parser=Busboy({headers:{'content-type':headers.type},limits:{fileSize:limits.fileBytes+1,files:1,fields:limits.fields.length,parts:limits.fields.length+2,fieldSize:1024,fieldNameSize:32}});
  const fields=Object.create(null);let count=0,work,fileStream,failed=false;
  const reject=()=>{if(failed)return;failed=true;queueMicrotask(()=>parser.destroy(new Error('TRANSFER.LIMIT')));};
  for(const name of ['filesLimit','fieldsLimit','partsLimit'])parser.on(name,reject);
  parser.on('field',(name,value,info)=>{if(!limits.fields.includes(name)||Object.hasOwn(fields,name)||info.valueTruncated||info.nameTruncated)reject();else fields[name]=value;});
  parser.on('file',(_name,stream)=>{fileStream=stream;count++;if(count!==1||_name!=='file'){stream.resume();reject();return;}stream.on('limit',reject);work=Promise.resolve().then(()=>consume(stream));work.catch(()=>reject());});
  let bytes=0;
  const source=Readable.fromWeb(body);
  const bounded=async function*(){for await(const chunk of source){bytes+=chunk.length;if(bytes>limits.fileBytes+8192)throw new Error('TRANSFER.LIMIT');yield chunk;}};
  const timer=setTimeout(()=>{source.destroy(new Error('TRANSFER.TIMEOUT'));parser.destroy(new Error('TRANSFER.TIMEOUT'));},limits.durationMs);
  try{await pipeline(bounded(),parser);await work;if(failed||count!==1)throw new Error('TRANSFER.INVALID');return fields;}
  finally{clearTimeout(timer);source.destroy();fileStream?.destroy();parser.destroy();await work?.catch(()=>{});}
}
export async function sendTransfer(result,res,method) {
  check(Number.isInteger(result.status??200)&&(result.status??200)>=200&&(result.status??200)<=599,'TRANSFER.INVALID','Invalid transfer status');
  res.statusCode=result.status??200;
  const entries=Object.entries(result.headers??{});check(entries.length<=16,'TRANSFER.LIMIT','Too many transfer headers');
  for(const [key,value] of entries){
    // Host CSP, cookies and security headers remain locked for transfers too.
    if(!/^(content-type|content-length|accept-ranges|content-range|etag|cache-control|content-disposition|last-modified|vary)$/i.test(key))continue;
    check(typeof value==='string'&&value.length<=1024&&!/[\r\n\u0000]/.test(value),'TRANSFER.INVALID','Invalid transfer header');res.setHeader(key,value);
  }
  const stream=result.stream;
  if(!stream){check(result.body===undefined||typeof result.body==='string'&&Buffer.byteLength(result.body)<=65536,'TRANSFER.LIMIT','Transfer metadata body limit');try{res.end(result.body);}finally{await result.close?.();}return;}
  const closed=()=>stream.destroy();res.once('close',closed);
  try{
    if(method!=='HEAD')for await(const chunk of stream){
      if(res.destroyed)throw new Error('Disconnected');
      if(!res.write(chunk))await new Promise((resolve,reject)=>{const clean=()=>{res.off('drain',done);res.off('close',fail);res.off('error',fail);};const done=()=>{clean();resolve();},fail=()=>{clean();reject(new Error('Disconnected'));};res.once('drain',done);res.once('close',fail);res.once('error',fail);});
    }
    res.end();
  }finally{res.off('close',closed);stream.destroy();await result.close?.();}
}
