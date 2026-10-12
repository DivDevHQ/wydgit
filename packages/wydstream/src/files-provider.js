// Trusted bridge: all physical I/O, confinement, quotas and range validation stay
// in WydFiles. Publication is a metadata transition, never an object rename.
import { Readable } from 'node:stream';
export function filesMediaProvider(files,root) {
 const location=id=>{if(!/^m-[a-f0-9]{32}$/.test(id))throw new Error('Invalid media ID');return root+'/assets/'+id;};
 const result=async(name,input,limits)=>{const r=await files.invoke('1.0.0',name,input,limits);if(!r.ok){const e=new Error('Media storage unavailable');e.code=r.code==='FILES.NOT_FOUND'?'ENOENT':r.code;throw e;}return r.value;};
 return Object.freeze({
  async write(id,body,size,limits){await files.transfer('write',{path:location(id),size},{method:'POST',body,authorize:async()=>{}},limits);},
  async finalize(){},
  async read(id,limits={}){
   const head=await files.transfer('read',{path:location(id)},{method:'HEAD',authorize:async()=>{}},limits).catch(e=>{if(e.code==='FILES.NOT_FOUND')e={code:'ENOENT'};throw e;});
   const size=Number(head.headers['Content-Length']);let closed=false,opened,stream;
   const close=async()=>{closed=true;stream?.destroy();await opened?.close();};
   const file={close,createReadStream({start=0,end=size-1}={}){
    stream=Readable.from((async function*(){try{
     if(closed)throw new Error('Closed media read');
     opened=await files.transfer('read-range',{path:location(id),start,length:end-start+1},{method:'GET',authorize:async()=>{}},limits);
     if(closed){await opened.close();throw new Error('Closed media read');}
     for await(const chunk of opened.stream)yield chunk;
    }finally{await opened?.close();}})());return stream;
   }};
   return {size,file};
  },
  async remove(id,staging=false,limits){if(staging)return;try{await result('delete',{path:location(id)},limits);}catch(e){if(e.code!=='ENOENT')throw e;}},
  async objects(limit,limits){const items=[];let offset=0;do{const page=await result('list',{path:root+'/assets',offset,limit:Math.min(20,limits?.filesPageSize??20,limit-items.length)},limits);for(const i of page.items){const id=i.path.slice((root+'/assets/').length);if(/^m-[a-f0-9]{32}$/.test(id))items.push({id,staging:false});}if(page.nextOffset===null)break;if(items.length>=limit)throw new Error('Media object limit');offset=page.nextOffset;}while(true);return items;}
 });
}
