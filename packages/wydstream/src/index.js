import path from 'node:path';
import { randomBytes,createHash,timingSafeEqual } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { localProvider } from './local-provider.js';
import { receiveFile } from '../../../wydgine/http/transfers.js';
const MiB=1024*1024;
export const defaults=Object.freeze({fileBytes:8*MiB,quotaBytes:64*MiB,stagingBytes:16*MiB,uploads:2,deliveries:8,durationMs:60000,retentionMs:900000,pageSize:20,items:128,metadataBytes:2048});
export const ceilings=Object.freeze({fileBytes:64*MiB,quotaBytes:1024*MiB,stagingBytes:128*MiB,uploads:8,deliveries:32,durationMs:300000,retentionMs:3600000,pageSize:40,items:256,metadataBytes:4096});
const declarations=[['create-upload','upload'],['complete-upload','upload'],['get','read'],['list','read'],['update','write'],['delete','delete'],['get-delivery','read'],['reconcile','repair']];
export const manifest={schema:'wydgit.library/0.1',id:'wydstream',version:'0.1.0-alpha.1',apiVersion:'1.0.0',publisher:'wydgit.core',trust:'canonical',platform:'^0.3.0-alpha.1',targets:['server'],requirements:{schema:'wydgit.requirements/0.1',libraries:[{library:'wydstore',version:'^0.1.0-alpha.3'}]},capabilities:[...new Set(declarations.map(([,action])=>'stream.media.'+action))],services:declarations.map(([name,action])=>({name,capability:'stream.media.'+action}))};
export const metadataFields={schemaVersion:{type:'number',required:true},items:{type:'array',required:true}};
const identifier=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(v);
const mediaId=v=>typeof v==='string'&&/^m-[a-f0-9]{32}$/.test(v);
const hash=v=>createHash('sha256').update(v).digest('hex');
const supported=new Map([['image/png','image'],['image/jpeg','image'],['image/gif','image'],['image/webp','image'],['audio/mpeg','audio'],['audio/wav','audio'],['audio/ogg','audio'],['audio/flac','audio'],['video/mp4','video'],['video/webm','video'],['application/pdf','file'],['application/zip','file'],['audio/ogg; codecs=opus','audio']]);
export function validateOptions(options) {
 const limits={...defaults,...options?.limits};
 if(options?.limits!==undefined&&(!options.limits||typeof options.limits!=='object'||Array.isArray(options.limits)))throw new Error('Invalid media limits');
 if(!options||Object.keys(options).some(k=>!['apps','limits'].includes(k))||!Array.isArray(options.apps)||options.apps.length!==1||!Object.keys(limits).every(k=>Object.hasOwn(defaults,k)&&Number.isSafeInteger(limits[k])&&limits[k]>=1&&limits[k]<=ceilings[k]))throw new Error('Invalid media policy');
 for(const config of options.apps){
  const required=['app','resource','store','collection','root','categories'];
  if(!config||!required.every(k=>Object.hasOwn(config,k))||Object.keys(config).some(k=>![...required,'uploadPermission'].includes(k))||![config.app,config.resource,config.store,config.collection].every(identifier)||typeof config.root!=='string'||!path.isAbsolute(config.root)||!Array.isArray(config.categories)||config.categories.length<1||config.categories.length>4||new Set(config.categories).size!==config.categories.length||!config.categories.every(c=>['image','audio','video','file'].includes(c))||config.uploadPermission!==undefined&&(typeof config.uploadPermission!=='string'||config.uploadPermission.length<1||config.uploadPermission.length>128))throw new Error('Invalid media resource');
 }
}
export async function initialize({root,options,adapter}) {
  validateOptions(options);
  const providers=new Map();
  if(!Array.isArray(options.apps)||options.apps.length!==1)throw new Error('One App activation per registry is currently supported');
  for(const config of options.apps){if(root&&(['public','content','prototypes','node_modules'].some(name=>config.root===path.join(root,name)||config.root.startsWith(path.join(root,name)+path.sep))||config.root===root))throw new Error('Unsafe media location');if(providers.has(config.app))throw new Error('Duplicate App');providers.set(config.app,adapter?.provider?await adapter.provider(config):await localProvider(config.root));}
  return {context:{providers}};
}
export function resolvePackageScopes({options,app,scopes}) {
  if(!Array.isArray(scopes)||scopes.length!==1||!options.apps?.some(config=>config.app===app&&config.resource===scopes[0]))throw new Error('Unauthorized media resource');
  return scopes.map(resource=>({resource}));
}
export async function register({service,transport,options,dependency,failure,hostContext,checkJson}) {
  const fail=code=>{throw failure(code);},check=(ok,code='STREAM.INVALID_REQUEST')=>{if(!ok)fail(code);};
  const keys=(v,required,optional=[])=>check(v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>[...required,...optional].includes(k)));
  keys(options,['apps'],['limits']);
  const limits={...defaults,...options.limits};check(Object.keys(limits).every(k=>Object.hasOwn(defaults,k)&&Number.isSafeInteger(limits[k])&&limits[k]>=1&&limits[k]<=ceilings[k]),'STREAM.INVALID_CONFIG');
  const store=dependency('wydstore'),apps=new Map();
  for(const config of options.apps){
    keys(config,['app','resource','store','collection','root','categories'],['uploadPermission']);
    check([config.app,config.resource,config.store,config.collection].every(identifier)&&config.app===store.identity.app&&Array.isArray(config.categories)&&config.categories.length>0&&config.categories.every(c=>['image','audio','video','file'].includes(c))&&(!config.uploadPermission||typeof config.uploadPermission==='string'),'STREAM.INVALID_CONFIG');
    apps.set(config.app,{...config,provider:hostContext.providers.get(config.app),active:new Set(),deliveryCount:0,ledgerQueue:Promise.resolve()});
  }
  const authorize=(request,caller)=>{check(request&&identifier(request.resource));const config=apps.get(caller.app);check(config&&request.resource===config.resource&&caller.scopes.wydstream?.some(g=>g.resource===config.resource),'STREAM.DENIED');return true;};
  const alive=caller=>caller.identity?.authenticated===true&&caller.identity.app===caller.app&&caller.identity.expiresAt>Date.now();
  const owner=(item,caller)=>item.app===caller.app&&item.publisher===caller.publisher&&item.package===caller.package&&item.principal===caller.principal&&item.installation===caller.installation&&item.creator===caller.identity?.userId&&alive(caller);
  const accessible=(item,caller)=>item.app===caller.app&&item.state==='ready'&&(item.visibility==='public'||item.visibility==='authenticated'&&alive(caller)||item.visibility==='private'&&owner(item,caller));
  const publicItem=item=>{const {tokenHash,sessionId,reserved,categories,expiresAt,...value}=item;return value;};
  const configFor=(request,caller)=>{authorize(request,caller);return apps.get(caller.app);};
  const read=async config=>{
    const result=await store.invoke('1.0.0','get',{store:config.store,collection:config.collection,id:'media-ledger'});
    if(result.code==='STORE.NOT_FOUND')return {version:0,data:{schemaVersion:1,items:[]}};
    check(result.ok&&result.value.data.schemaVersion===1&&Array.isArray(result.value.data.items)&&result.value.data.items.length<=limits.items,'STREAM.STORAGE');return result.value;
  };
  const mutateNow=async(config,change)=>{
    for(let attempt=0;attempt<5;attempt++){
      const saved=await read(config),items=structuredClone(saved.data.items),value=change(items);
      const result=await store.invoke('1.0.0','transaction',{store:config.store,collection:config.collection,operations:[{operation:saved.version?'update':'create',input:{id:'media-ledger',...(saved.version?{version:saved.version}:{}),data:{schemaVersion:1,items}}}]});
      if(result.ok)return value;
      if(!['STORE.CONFLICT','STORE.DUPLICATE_ID'].includes(result.code))fail('STREAM.STORAGE');
    }fail('STREAM.CONFLICT');
  };
  const mutate=(config,change)=>{const next=config.ledgerQueue.then(()=>mutateNow(config,change));config.ledgerQueue=next.catch(()=>{});return next;};
  const find=(items,id)=>{check(mediaId(id));const item=items.find(i=>i.id===id);check(item,'STREAM.NOT_FOUND');return item;};
  const metadata=input=>{
    keys(input,[],['title','description','displayName','tags','visibility']);
    for(const name of ['title','description','displayName'])check(input[name]===undefined||typeof input[name]==='string'&&!/[\u0000-\u001f\u007f]/.test(input[name]));
    check(input.tags===undefined||Array.isArray(input.tags)&&input.tags.length<=16&&input.tags.every(tag=>typeof tag==='string'&&Buffer.byteLength(tag)<=64));
    check(input.visibility===undefined||['public','authenticated','private'].includes(input.visibility));
    try{checkJson(input,{maxBytes:limits.metadataBytes,maxNodes:128,maxDepth:4});}catch{fail('STREAM.LIMIT');}
    return input;
  };
  const response=(value,policy)=>{if(policy)try{checkJson(value,policy.response);}catch{fail('STREAM.LIMIT');}return value;};
  const create=async(request,caller,policy)=>{
    const config=configFor(request,caller);keys(request,['resource'],['metadata','maxBytes','categories']);
    check(alive(caller)&&(!config.uploadPermission||caller.identity.permissions.includes(config.uploadPermission)),'STREAM.DENIED');
    check(request.maxBytes===undefined||Number.isSafeInteger(request.maxBytes)&&request.maxBytes>=1,'STREAM.INVALID_REQUEST');
    const maxBytes=Math.min(limits.fileBytes,caller.limits.mediaFileBytes??limits.fileBytes,request.maxBytes??limits.fileBytes);
    check(Number.isSafeInteger(maxBytes)&&maxBytes>=1,'STREAM.LIMIT');
    const categories=request.categories??config.categories;check(Array.isArray(categories)&&categories.length>0&&categories.length<=4&&new Set(categories).size===categories.length&&categories.every(c=>config.categories.includes(c)),'STREAM.DENIED');
    const token=randomBytes(32).toString('hex'),now=Date.now(),id='m-'+randomBytes(16).toString('hex');
    const item={id,app:caller.app,publisher:caller.publisher,package:caller.package,principal:caller.principal,installation:caller.installation,creator:caller.identity.userId,sessionId:caller.identity.sessionId,resource:config.resource,type:'',mime:'',size:0,hash:'',title:'',description:'',displayName:'',tags:[],visibility:'private',...metadata(request.metadata??{}),state:'pending',createdAt:now,updatedAt:now,expiresAt:Math.min(now+limits.retentionMs,caller.identity.expiresAt),revision:1,reserved:maxBytes,tokenHash:hash(token),categories};
    const ticket=response({id,token,maxBytes,expiresAt:item.expiresAt},policy);
    await mutate(config,items=>{
      check(items.length<Math.min(limits.items,caller.limits.mediaItems??limits.items),'STREAM.LIMIT');
      const pending=items.filter(i=>['pending','uploading','staged','committing'].includes(i.state));
      check(pending.length<Math.min(limits.uploads,caller.limits.mediaUploads??limits.uploads),'STREAM.LIMIT');
      check(pending.reduce((n,i)=>n+i.reserved,0)+maxBytes<=Math.min(limits.stagingBytes,caller.limits.mediaStagingBytes??limits.stagingBytes),'STREAM.QUOTA');
      check(items.reduce((n,i)=>n+(i.state==='ready'?i.size:i.reserved),0)+maxBytes<=Math.min(limits.quotaBytes,caller.limits.mediaQuotaBytes??limits.quotaBytes),'STREAM.QUOTA');items.push(item);
    });
    return ticket;
  };
  const tokenOwner=(item,request,caller)=>{check(owner(item,caller)&&item.sessionId===caller.identity.sessionId&&item.expiresAt>Date.now()&&typeof request.token==='string'&&/^[a-f0-9]{64}$/.test(request.token)&&timingSafeEqual(Buffer.from(item.tokenHash,'hex'),Buffer.from(hash(request.token),'hex')),'STREAM.DENIED');};
  const complete=async(request,caller,policy)=>{
    const config=configFor(request,caller);keys(request,['resource','id','token'],['metadata']);
    await mutate(config,items=>{const item=find(items,request.id);tokenOwner(item,request,caller);check(item.state==='staged','STREAM.STATE');check(item.size<=Math.min(limits.fileBytes,caller.limits.mediaFileBytes??limits.fileBytes),'STREAM.LIMIT');check(config.categories.includes(item.type),'STREAM.UNSUPPORTED_MEDIA');response(publicItem({...item,...metadata(request.metadata??{}),state:'ready',reserved:0,revision:item.revision+2}),policy);Object.assign(item,metadata(request.metadata??{}),{state:'committing',updatedAt:Date.now(),revision:item.revision+1});});
    await config.provider.finalize(request.id);
    return mutate(config,items=>{const item=find(items,request.id);tokenOwner(item,request,caller);check(item.state==='committing','STREAM.STATE');item.state='ready';item.reserved=0;item.revision++;item.updatedAt=Date.now();return publicItem(item);});
  };
  const retire=async(config,id)=>{
    await config.provider.remove(id,true);await config.provider.remove(id);
    await mutate(config,items=>{const at=items.findIndex(i=>i.id===id);if(at>=0)items.splice(at,1);});
  };
  const repair=async config=>{
    const saved=await read(config);let changed=0;
    for(const item of saved.data.items){
      if(config.active.has(item.id))continue;
      if(item.state==='deleting'||item.state==='failed'||['pending','uploading','staged'].includes(item.state)&&item.expiresAt<=Date.now()){await retire(config,item.id);changed++;continue;}
      if(item.state==='committing'){
        let object;
        // Retry publication first, including a link made before staging unlink failed.
        try{await config.provider.finalize(item.id);}catch(error){if(error.code!=='ENOENT')throw error;}
        try{object=await config.provider.read(item.id);}catch(error){if(error.code==='ENOENT'){await retire(config,item.id);changed++;continue;}throw error;}
        try{check(object.size===item.size,'STREAM.STORAGE');const digest=createHash('sha256');for await(const chunk of object.file.createReadStream({autoClose:false}))digest.update(chunk);check(digest.digest('hex')===item.hash,'STREAM.STORAGE');}finally{await object.file.close();}
        await mutate(config,items=>{const current=find(items,item.id);if(current.state==='committing'){current.state='ready';current.reserved=0;current.updatedAt=Date.now();current.revision++;}});changed++;
      }
      if(item.state==='ready'){
        try{const object=await config.provider.read(item.id);await object.file.close();check(object.size===item.size,'STREAM.STORAGE');}catch(error){if(error.code!=='ENOENT')throw error;await mutate(config,items=>{const current=find(items,item.id);if(current.state==='ready'){current.state='missing';current.updatedAt=Date.now();current.revision++;}});changed++;}
      }
    }
    // Only opaque provider-owned names; bounded by the App's item ceiling.
    const objects=await config.provider.objects(limits.items*2);check(objects.length<=limits.items*2,'STREAM.LIMIT');
    const current=await read(config),known=new Set(current.data.items.map(i=>i.id));
    for(const object of objects)if(!known.has(object.id)){await config.provider.remove(object.id,object.staging);changed++;}
    return {changed};
  };
  const execute=async(name,request,caller,policy)=>{
    const config=configFor(request,caller);
    if(name==='create-upload')return create(request,caller,policy);
    if(name==='complete-upload')return complete(request,caller,policy);
    if(name==='reconcile'){keys(request,['resource']);check(caller.principal==='host:media-repair','STREAM.DENIED');return repair(config);}
    if(name==='list'){
      keys(request,['resource'],['type','offset','limit']);check(request.type===undefined||request.type===''||['image','audio','video','file'].includes(request.type));
      const limit=request.limit??limits.pageSize,offset=request.offset??0;check(Number.isSafeInteger(limit)&&limit>=1&&limit<=Math.min(limits.pageSize,caller.limits.mediaPageSize??limits.pageSize)&&Number.isSafeInteger(offset)&&offset>=0&&offset<=limits.items,'STREAM.LIMIT');
      const saved=await read(config),items=saved.data.items.filter(i=>accessible(i,caller)&&(!request.type||i.type===request.type));
      return {items:items.slice(offset,offset+limit).map(publicItem),total:items.length};
    }
    keys(request,['resource','id'],name==='update'?['revision','metadata']:name==='delete'?['revision']:[]);
    const saved=await read(config),item=find(saved.data.items,request.id);
    if(['get','get-delivery'].includes(name)){check(accessible(item,caller),'STREAM.DENIED');return publicItem(item);}
    check(owner(item,caller)&&item.state==='ready','STREAM.DENIED');check(Number.isSafeInteger(request.revision)&&request.revision===item.revision,'STREAM.CONFLICT');
    if(name==='update')return mutate(config,items=>{const current=find(items,request.id);check(current.state==='ready'&&current.revision===request.revision,'STREAM.CONFLICT');const next={...current,...metadata(request.metadata),updatedAt:Date.now(),revision:current.revision+1};response(publicItem(next),policy);Object.assign(current,next);return publicItem(current);});
    response({deleted:true},policy);await mutate(config,items=>{const current=find(items,request.id);check(current.state==='ready'&&current.revision===request.revision,'STREAM.CONFLICT');current.state='deleting';current.revision++;current.updatedAt=Date.now();});
    await retire(config,request.id);return {deleted:true};
  };
  const safe=async work=>{try{return await work();}catch(error){if(error.code?.startsWith('STREAM.'))throw error;if(error.message?.startsWith('TRANSFER.'))fail(error.message==='TRANSFER.LIMIT'?'STREAM.LIMIT':'STREAM.INVALID_REQUEST');fail('STREAM.STORAGE');}};
  for(const {name} of manifest.services)service(name,(request,caller,policy)=>safe(()=>execute(name,request,caller,policy)),{presentation:['get','list','get-delivery'].includes(name),authorize,validate:()=>true});
  const upload=async(request,caller,port,policy,existing=false)=>safe(async()=>{
    const config=configFor(request,caller);check(port.method==='POST','STREAM.DENIED');const current=await port.authorize();if(config.uploadPermission)check(current?.permissions?.includes(config.uploadPermission),'STREAM.DENIED');
    let ticket;
    if(existing){keys(request,['resource','id','token']);const saved=await read(config),item=find(saved.data.items,request.id);tokenOwner(item,request,caller);check(item.state==='pending','STREAM.STATE');check(saved.data.items.reduce((n,i)=>n+(i.state==='ready'?i.size:i.reserved),0)<=Math.min(limits.quotaBytes,caller.limits.mediaQuotaBytes??limits.quotaBytes),'STREAM.QUOTA');
      check(saved.data.items.length<=Math.min(limits.items,caller.limits.mediaItems??limits.items),'STREAM.LIMIT');
      const pending=saved.data.items.filter(i=>['pending','uploading','staged','committing'].includes(i.state));
      check(pending.length<=Math.min(limits.uploads,caller.limits.mediaUploads??limits.uploads)&&pending.reduce((n,i)=>n+i.reserved,0)<=Math.min(limits.stagingBytes,caller.limits.mediaStagingBytes??limits.stagingBytes),'STREAM.LIMIT');
      ticket={id:item.id,token:request.token,maxBytes:Math.min(item.reserved,limits.fileBytes,caller.limits.mediaFileBytes??limits.fileBytes),categories:item.categories.filter(c=>config.categories.includes(c))};check(ticket.maxBytes>=1&&ticket.categories.length>0,'STREAM.DENIED');}
    else ticket=await create(request,caller,policy);
    const input={resource:request.resource,id:ticket.id,token:ticket.token};check(!config.active.has(ticket.id),'STREAM.STATE');config.active.add(ticket.id);
    let file,admitted=false;
    try{
      await mutate(config,items=>{const item=find(items,ticket.id);tokenOwner(item,input,caller);check(item.state==='pending','STREAM.STATE');item.state='uploading';item.revision++;});admitted=true;
      file=await config.provider.stage(ticket.id);let size=0,sample=Buffer.alloc(0),digest=createHash('sha256');
      const fields=await receiveFile(port.body,port.headers,{fileBytes:ticket.maxBytes,fields:['title','description'],durationMs:Math.min(limits.durationMs,caller.limits.mediaDurationMs??limits.durationMs)},async stream=>{
        for await(const chunk of stream){size+=chunk.length;check(size<=ticket.maxBytes,'STREAM.LIMIT');digest.update(chunk);if(sample.length<8192)sample=Buffer.concat([sample,chunk.subarray(0,8192-sample.length)]);let at=0;while(at<chunk.length){const written=await file.write(chunk,at,chunk.length-at);check(written.bytesWritten>0,'STREAM.STORAGE');at+=written.bytesWritten;}}
      });
      check((await file.stat()).size===size,'STREAM.STORAGE');await file.sync();await file.close();file=null;const current=await port.authorize();if(config.uploadPermission)check(current?.permissions?.includes(config.uploadPermission),'STREAM.DENIED');
      check(size>0,'STREAM.INVALID_MEDIA');let detected;
      // Treat ZIP containers as opaque attachments. The general detector otherwise
      // inflates ZIP metadata, which must never run on attacker-supplied archives.
      const zip=sample.length>=4&&sample[0]===0x50&&sample[1]===0x4b&&((sample[2]===3&&sample[3]===4)||(sample[2]===5&&sample[3]===6)||(sample[2]===7&&sample[3]===8));
      try{detected=zip?{mime:'application/zip'}:await fileTypeFromBuffer(sample);}catch{fail('STREAM.INVALID_MEDIA');}
      check(detected&&supported.has(detected.mime),'STREAM.UNSUPPORTED_MEDIA');const category=supported.get(detected.mime);
      check((ticket.categories??request.categories??config.categories).includes(category),'STREAM.UNSUPPORTED_MEDIA');
      const contentHash=digest.digest('hex');
      await mutate(config,items=>{const item=find(items,ticket.id);tokenOwner(item,input,caller);check(item.state==='uploading','STREAM.STATE');Object.assign(item,{state:'staged',size,mime:detected.mime,type:category,hash:contentHash,revision:item.revision+1});});
      if(policy)try{checkJson({...input,metadata:fields},policy.request);}catch{fail('STREAM.LIMIT');}
      const result=await complete({...input,metadata:fields},caller,policy);return {headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify({ok:true,value:result})};
    }catch(error){
      await file?.close();
      // Committing files are recoverable; other failures safely release reservations.
      const saved=await read(config),item=saved.data.items.find(i=>i.id===ticket.id);
      if(admitted&&item&&item.state!=='committing'&&item.state!=='ready')await retire(config,ticket.id);
      throw error;
    }finally{config.active.delete(ticket.id);}
  });
  transport('create-upload',upload);
  transport('complete-upload',(request,caller,port,policy)=>upload(request,caller,port,policy,true));
  transport('get-delivery',(request,caller,port)=>safe(async()=>{
    const config=configFor(request,caller);check(['GET','HEAD'].includes(port.method),'STREAM.DENIED');await port.authorize();const item=await execute('get-delivery',request,caller);
    check(config.deliveryCount<Math.min(limits.deliveries,caller.limits.mediaDeliveries??limits.deliveries),'STREAM.LIMIT');config.deliveryCount++;
    let file,released=false;const close=async()=>{if(released)return;released=true;config.deliveryCount--;await file?.close();};
    try{
      const opened=await config.provider.read(item.id);file=opened.file;check(opened.size===item.size,'STREAM.STORAGE');await port.authorize();
      // Check current metadata again after opening; no snapshot policy bypass.
      const fresh=await execute('get-delivery',request,caller);check(fresh.revision===item.revision,'STREAM.CONFLICT');
      const etag='"'+item.hash+'"',headers={'Content-Type':item.mime,'Content-Length':String(item.size),'Accept-Ranges':'bytes','ETag':etag,'Cache-Control':item.visibility==='public'?'public, max-age=0, must-revalidate':'private, no-store','Content-Disposition':(item.type==='file'?'attachment':'inline')+'; filename="'+item.id+'"','X-Content-Type-Options':'nosniff'};
      if(port.headers.ifNoneMatch===etag){delete headers['Content-Length'];await close();return {status:304,headers};}
      let start=0,end=item.size-1,status=200;
      if(port.headers.range&&(!port.headers.ifRange||port.headers.ifRange===etag)){
        const match=/^bytes=(\d*)-(\d*)$/.exec(port.headers.range);let invalid=!match||!match[1]&&!match[2];
        if(!invalid){if(!match[1]){const suffix=Number(match[2]);invalid=!Number.isSafeInteger(suffix)||suffix===0;start=Math.max(0,item.size-suffix);}else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));invalid=![start,end].every(Number.isSafeInteger)||start>end||start>=item.size;}}
        if(invalid){headers['Content-Range']='bytes */'+item.size;headers['Content-Length']='0';await close();return {status:416,headers};}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${item.size}`;headers['Content-Length']=String(end-start+1);
      }
      if(port.method==='HEAD'){await close();return {status,headers};}
      return {status,headers,stream:file.createReadStream({autoClose:false,start,end}),close};
    }catch(error){await close();throw error;}
  }));
}
