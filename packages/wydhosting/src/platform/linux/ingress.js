// Native HTTP adapter for a separately credential-checked TLS edge. No public control API.
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {canonicalAuthority} from 'wydgine/trusted/provider';
import {loadPeerCredentials} from 'wydgine/trusted/unix-peer';
import {check,integer,validateRegistry} from '../../contracts.js';
export function createPrivateIngress({registry,supervisor,backend,edgeUid,credentialHelper,onEvent=()=>{}}) {
 check(integer(edgeUid,1)&&edgeUid!==process.getuid(),'HOSTING.INGRESS_POLICY');
 const credentials=loadPeerCredentials(credentialHelper);
 return async(req,res)=>{
  let upstream,workerSocket,poolId=null,generation=null;const requestId=randomUUID();
  const event=code=>{try{onEvent({schema:'wydhosting.ingress-event/1',requestId,poolId,generation,code});}catch{}};
  const deny=status=>{if(res.destroyed)return;res.writeHead(status,{'Cache-Control':'no-store','Connection':'close'});res.end('Request rejected');};
  try {
   check(credentials(req.socket).uid===edgeUid,'HOSTING.INGRESS_PEER');
   const values=name=>{const list=[];for(let i=0;i<req.rawHeaders.length;i+=2)if(req.rawHeaders[i].toLowerCase()===name)list.push(req.rawHeaders[i+1]);return list;};
   check(req.httpVersionMajor===1&&values('host').length===1&&values('x-forwarded-host').length===1&&values('x-forwarded-proto').length===1&&values('x-forwarded-proto')[0]==='https'&&values('forwarded').length===0&&values('x-forwarded-for').length===0&&values('x-forwarded-port').length===0,'HOSTING.INGRESS_HEADERS');
   const host=canonicalAuthority(values('x-forwarded-host')[0]);check(host.authority===canonicalAuthority(values('host')[0]).authority&&(host.port??443)===443,'HOSTING.INGRESS_HEADERS');
   // Never accept request-selected routing destinations or fall back to a sibling.
   const r=validateRegistry((await registry.inspect()).registry);const domain=r.domains.find(d=>d.hostname===host.hostname&&d.state==='active');if(!domain)return deny(421);
   const app=r.apps.find(a=>a.appId===domain.appId&&a.state==='active');if(!app)return deny(503);
   const view=supervisor.inspectPool(app.placement.poolId);if(!view.ready||view.registryRevision!==r.revision){event('INGRESS.NOT_READY');return deny(503);}poolId=app.placement.poolId;generation=view.generation;
   const headers={...req.headers,host:host.authority,'x-forwarded-host':host.authority,'x-forwarded-proto':'https',connection:'close'};
   // RFC hop-by-hop fields must not create a second trust or protocol boundary.
   const nominated=String(req.headers.connection??'').toLowerCase().split(',').map(x=>x.trim());
   check(!nominated.some(x=>['host','origin','cookie','x-forwarded-host','x-forwarded-proto'].includes(x)),'HOSTING.INGRESS_HEADERS');
   for(const name of [...nominated,'proxy-authorization','proxy-authenticate','upgrade','keep-alive','te','trailer','transfer-encoding'])delete headers[name];
   if(req.destroyed||res.destroyed)return;
   workerSocket=await backend.connectIngress(view);
   if(req.destroyed||res.destroyed){workerSocket.destroy();return;}
   if(!supervisor.inspectPool(app.placement.poolId).ready||supervisor.inspectPool(app.placement.poolId).generation!==view.generation){workerSocket.destroy();event('INGRESS.STALE_GENERATION');return deny(503);}
   const agent=new http.Agent({keepAlive:false});agent.createConnection=()=>workerSocket;
   upstream=http.request({method:req.method,path:req.url,headers,agent},response=>{if(response.statusCode>=500)event('INGRESS.WORKER_HTTP');res.writeHead(response.statusCode,response.headers);response.pipe(res);});
   upstream.setTimeout(120000,()=>{event('INGRESS.DEADLINE');upstream.destroy();});upstream.on('error',()=>{event('INGRESS.WORKER_SOCKET');if(res.headersSent)res.destroy();else deny(503);});req.on('aborted',()=>upstream.destroy());res.on('close',()=>{if(!res.writableFinished)upstream.destroy();});req.pipe(upstream);
  }catch(error){workerSocket?.destroy();upstream?.destroy();event(['HOSTING.INGRESS_PEER','HOSTING.INGRESS_HEADERS','HOSTING.INGRESS_PERMISSION','HOSTING.INGRESS_SOCKET','HOSTING.INGRESS_TIMEOUT'].includes(error.code)?error.code:'INGRESS.UNAVAILABLE');if(!res.headersSent)deny(400);else res.destroy();}
 };
}
