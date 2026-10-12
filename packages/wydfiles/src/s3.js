import aws4 from 'aws4';
import {XMLParser} from 'fast-xml-parser';
import {Readable} from 'node:stream';
import {check,capabilities,FilesError} from './contract.js';
import {operation,within,remaining,boundedStream} from './operation.js';

function endpointFor(config){
 let endpoint;try{endpoint=new URL(config.endpoint);}catch{throw new FilesError('FILES.INVALID_CONFIG');}
 check(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash&&endpoint.pathname==='/','FILES.INVALID_CONFIG');
 check(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket)&&/^[a-zA-Z0-9_-]{1,64}$/.test(config.namespace)&&typeof config.region==='string'&&config.credentials?.accessKeyId&&config.credentials?.secretAccessKey,'FILES.INVALID_CONFIG');
 return endpoint;
}
export function s3Identity(config){return endpointFor(config).origin+'/'+config.bucket+'/'+config.namespace;}
const closeResponse=async response=>{try{await response.body?.cancel();}catch{}};
function declaredLength(response){
 const value=response.headers.get('content-length');if(value===null)return undefined;
 check(/^\d+$/.test(value)&&Number.isSafeInteger(Number(value)),'FILES.PROVIDER');return Number(value);
}
// All requests in a logical operation share immutable limits and one deadline.
export function s3Provider(config,limits,request=fetch){
 const endpoint=endpointFor(config),prefix=config.namespace+'/';
 const parser=new XMLParser({ignoreAttributes:true,processEntities:false,parseTagValue:false});
 const call=async(op,method,key='',query='',headers={},body,size)=>{
  const url=new URL('/'+config.bucket+'/'+(key?prefix+key:'')+query,endpoint);
  const signed=aws4.sign({host:url.host,path:url.pathname+url.search,method,service:'s3',region:config.region,headers:{...headers,'X-Amz-Content-Sha256':'UNSIGNED-PAYLOAD',...(size===undefined?{}:{'Content-Length':String(size)})}},config.credentials);
  for(let attempt=0;;attempt++){
   remaining(op);const controller=new AbortController();
   try{
    const response=await within(async()=>{
     const response=await request(url,{method,headers:signed.headers,body,duplex:'half',redirect:'error',signal:controller.signal});
     try{remaining(op);}catch(e){await closeResponse(response);throw e;}return response;
    },op,()=>controller.abort());
    if(response.ok)return response;
    await closeResponse(response);
    if(response.status===404)throw new FilesError('FILES.NOT_FOUND');
    if(response.status===416)throw new FilesError('FILES.RANGE');
    if(response.status===412||response.status===409)throw new FilesError('FILES.CONFLICT');
    if(response.status>=500&&attempt<op.limits.retries&&['GET','HEAD'].includes(method))continue;
    throw new FilesError('FILES.PROVIDER');
   }catch(e){
    if(e instanceof FilesError)throw e;
    remaining(op);
    if(attempt<op.limits.retries&&['GET','HEAD'].includes(method))continue;
    throw new FilesError(e.name==='TimeoutError'||e.name==='AbortError'?'FILES.TIMEOUT':'FILES.PROVIDER');
   }
  }
 };
 const boundedXML=async(response,op)=>{
  try{const chunks=[];for await(const chunk of boundedStream(response.body,undefined,op,1024*1024))chunks.push(chunk);return Buffer.concat(chunks).toString('utf8');}
  finally{await closeResponse(response);}
 };
 return Object.freeze({capabilities:Object.freeze({...capabilities,atomicReplace:false}),
 async stat(key,op=operation(limits)){
  const r=await call(op,'HEAD',key);
  try{const size=declaredLength(r);check(size!==undefined,'FILES.PROVIDER');return {size,version:r.headers.get('etag')??''};}
  finally{await closeResponse(r);}
 },
 async inventory(limit,op=operation(limits)){
  const items=[];let token,pages=0;const tokens=new Set(),seen=new Set();
  do{
   remaining(op);check(++pages<=limit+1,'FILES.LIMIT');
   const q=new URLSearchParams({'list-type':'2',prefix,'max-keys':String(Math.min(1000,limit+1))});if(token)q.set('continuation-token',token);
   const xml=await boundedXML(await call(op,'GET','','?'+q),op);check(!/<!DOCTYPE|<!ENTITY/i.test(xml),'FILES.PROVIDER');
   const result=parser.parse(xml).ListBucketResult;check(result,'FILES.PROVIDER');
   const entries=result.Contents===undefined?[]:Array.isArray(result.Contents)?result.Contents:[result.Contents];
   for(const entry of entries){
    check(typeof entry.Key==='string'&&entry.Key.startsWith(prefix),'FILES.PROVIDER');const key=entry.Key.slice(prefix.length),size=Number(entry.Size);
    check(/^(?:[a-f0-9]{2}){1,120}$/.test(key)&&Number.isSafeInteger(size)&&size>=0&&!seen.has(key),'FILES.PROVIDER');
    seen.add(key);items.push({key,size,version:entry.ETag??''});check(items.length<=limit,'FILES.LIMIT');
   }
   const next=result.IsTruncated==='true'?result.NextContinuationToken:undefined;
   check(!next||typeof next==='string'&&next.length<=4096&&next!==token&&!tokens.has(next),'FILES.PROVIDER');
   check(result.IsTruncated!=='true'||next,'FILES.PROVIDER');if(next)tokens.add(next);token=next;
  }while(token);
  return items;
 },
 async read(key,start=0,end,op=operation(limits),expectedSize){
  const ranged=start!==0||end!==undefined;
  const r=await call(op,'GET',key,'',ranged?{Range:`bytes=${start}-${end??''}`}:{ });
  let size;
  try{
   const length=declaredLength(r);
   if(ranged){
    check(r.status===206,'FILES.UNSUPPORTED');
    const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(r.headers.get('content-range')??'');check(match,'FILES.RANGE');
    const [first,last,total]=match.slice(1).map(Number);
    check([first,last,total].every(Number.isSafeInteger)&&first===start&&last>=first&&last<total&&(end===undefined?last===total-1:last===end)&&(expectedSize===undefined||total===expectedSize),'FILES.RANGE');
    size=last-first+1;check(length===undefined||length===size,'FILES.RANGE');
   }else{size=expectedSize??length;check(expectedSize===undefined||length===undefined||length===expectedSize,'FILES.PROVIDER');}
   check(r.body,'FILES.PROVIDER');
  }catch(e){await closeResponse(r);throw e;}
  const stream=Readable.from((async function*(){
   try{yield* boundedStream(r.body,size,op);}
   catch(e){throw e instanceof FilesError?e:new FilesError('FILES.PROVIDER');}
  })());
  return {stream,close:async()=>{stream.destroy();await closeResponse(r);}};
 },
 async write(key,stream,size,op=operation(limits)){
  const body=Readable.from(boundedStream(stream,size,op));
  try{const r=await call(op,'PUT',key,'',{'Content-Type':'application/octet-stream'},body,size);await closeResponse(r);}
  finally{body.destroy();stream.destroy?.();}
 },
 async delete(key,op=operation(limits)){await this.stat(key,op);const r=await call(op,'DELETE',key);await closeResponse(r);}
 });
}
