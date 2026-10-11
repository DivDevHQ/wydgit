import aws4 from 'aws4';
import {XMLParser} from 'fast-xml-parser';
import {Readable} from 'node:stream';
import {check,capabilities,FilesError} from './contract.js';
// Small signer + bounded XML parser; no provider credentials cross this host API.
export function s3Provider(config,limits,request=fetch){
 const endpoint=new URL(config.endpoint);check(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash&&endpoint.pathname==='/','FILES.INVALID_CONFIG');
 check(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket)&&/^[a-zA-Z0-9_-]{1,64}$/.test(config.namespace)&&typeof config.region==='string'&&config.credentials?.accessKeyId&&config.credentials?.secretAccessKey,'FILES.INVALID_CONFIG');
 const prefix=config.namespace+'/';const parser=new XMLParser({ignoreAttributes:true,processEntities:false,parseTagValue:false});
 const call=async(method,key='',query='',headers={},body,size)=>{
  const url=new URL('/'+config.bucket+'/'+(key?prefix+key:'')+query,endpoint);
  const signed=aws4.sign({host:url.host,path:url.pathname+url.search,method,service:'s3',region:config.region,headers:{...headers,'X-Amz-Content-Sha256':'UNSIGNED-PAYLOAD',...(size===undefined?{}:{'Content-Length':String(size)})}},config.credentials);
  for(let attempt=0;;attempt++){
   try{const response=await request(url,{method,headers:signed.headers,body,duplex:'half',redirect:'error',signal:AbortSignal.timeout(limits.durationMs)});
    if(response.ok)return response;
    await response.body?.cancel();if(response.status===404)throw new FilesError('FILES.NOT_FOUND');if(response.status===412||response.status===409)throw new FilesError('FILES.CONFLICT');if(response.status>=500&&attempt<limits.retries&&['GET','HEAD'].includes(method))continue;throw new FilesError('FILES.PROVIDER');
   }catch(e){if(e instanceof FilesError)throw e;if(attempt<limits.retries&&['GET','HEAD'].includes(method))continue;throw new FilesError(e.name==='TimeoutError'||e.name==='AbortError'?'FILES.TIMEOUT':'FILES.PROVIDER');}
  }
 };
 const bounded=async response=>{let n=0;const chunks=[];for await(const chunk of Readable.fromWeb(response.body)){n+=chunk.length;check(n<=1024*1024,'FILES.LIMIT');chunks.push(chunk);}return Buffer.concat(chunks).toString('utf8');};
 return Object.freeze({capabilities:Object.freeze({...capabilities,atomicReplace:false}),
 async stat(key){const r=await call('HEAD',key);const size=Number(r.headers.get('content-length'));check(Number.isSafeInteger(size)&&size>=0,'FILES.PROVIDER');return {size,version:r.headers.get('etag')??''};},
 async inventory(limit){const items=[];let token,pages=0;const tokens=new Set();const seen=new Set();do{check(++pages<=limit+1,'FILES.LIMIT');const q=new URLSearchParams({'list-type':'2',prefix,'max-keys':String(Math.min(1000,limit+1))});if(token)q.set('continuation-token',token);const xml=await bounded(await call('GET','','?'+q));check(!/<!DOCTYPE|<!ENTITY/i.test(xml),'FILES.PROVIDER');const result=parser.parse(xml).ListBucketResult;check(result,'FILES.PROVIDER');const entries=result.Contents===undefined?[]:Array.isArray(result.Contents)?result.Contents:[result.Contents];for(const entry of entries){check(typeof entry.Key==='string'&&entry.Key.startsWith(prefix),'FILES.PROVIDER');const key=entry.Key.slice(prefix.length),size=Number(entry.Size);check(/^(?:[a-f0-9]{2}){1,120}$/.test(key)&&Number.isSafeInteger(size)&&size>=0&&!seen.has(key),'FILES.PROVIDER');seen.add(key);items.push({key,size,version:entry.ETag??''});check(items.length<=limit,'FILES.LIMIT');}const next=result.IsTruncated==='true'?result.NextContinuationToken:undefined;check(!next||typeof next==='string'&&next.length<=4096&&next!==token,'FILES.PROVIDER');check(result.IsTruncated!=='true'||next,'FILES.PROVIDER');check(!next||!tokens.has(next),'FILES.PROVIDER');if(next)tokens.add(next);token=next;}while(token);return items;},
 async read(key,start=0,end){const r=await call('GET',key,'',start||end!==undefined?{Range:`bytes=${start}-${end??''}`}:{ });if((start||end!==undefined)&&r.status!==206){await r.body?.cancel();throw new FilesError('FILES.UNSUPPORTED');}return {stream:Readable.fromWeb(r.body),close:()=>r.body?.cancel().catch(()=>{})};},
 async write(key,stream,size){const r=await call('PUT',key,'',{'Content-Type':'application/octet-stream'},stream,size);await r.body?.cancel();},
 async delete(key){await this.stat(key);const r=await call('DELETE',key);await r.body?.cancel();}
 });
}
