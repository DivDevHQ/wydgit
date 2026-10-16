// Trusted host configuration and native HTTP boundary; never a portable API.
import {domainToASCII} from 'node:url';
import {isIP} from 'node:net';
import {clean,freeze,record,requireThat as check} from '../object-model/validation.js';
const requireRoute=(ok)=>check(ok,'HOST.ROUTING','Invalid routing configuration or authority');
const shape=(v,required,optional=[])=>requireRoute(record(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>[...required,...optional].includes(k)));
export function canonicalAuthority(value){
 requireRoute(typeof value==='string'&&value.length>0&&value.length<=512&&!/[\s\x00-\x20\x7f/@\\?#%,]/u.test(value));
 let name,port=null;
 if(value.startsWith('[')){
  const match=/^\[([^\]]+)\](?::([0-9]+))?$/.exec(value);requireRoute(match&&isIP(match[1])===6);
  name=new URL('http://['+match[1]+']/').hostname;port=match[2]??null;
 }else{
  const parts=value.split(':');requireRoute(parts.length<=2);[name,port=null]=parts;
  requireRoute(name.length>0);if(name.endsWith('.'))name=name.slice(0,-1);
  const original=name.toLowerCase();name=domainToASCII(name).toLowerCase();requireRoute(name.length>0&&name.length<=253);
  // DNS labels only. Reject URL parsers' shortened, octal and hexadecimal IP forms.
  requireRoute(name.split('.').every(label=>label.length<=63&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)));
  if(/^[0-9.]+$/.test(name))requireRoute(original===name&&isIP(name)===4&&name.split('.').every(x=>x===String(Number(x))));
 }
 if(port!==null){requireRoute(/^[1-9][0-9]{0,4}$/.test(port)&&Number(port)<=65535);port=Number(port);}
 return Object.freeze({hostname:name,port,authority:name+(port===null?'':':'+port)});
}
const local=name=>name==='localhost'||name.endsWith('.localhost')||name.endsWith('.test')||name==='127.0.0.1'||name==='[::1]';
const hostName=value=>{const result=canonicalAuthority(value);requireRoute(result.port===null);return result.hostname;};
export function validateRouting(input,apps){
 const config=clean(input);shape(config,['schema','transport','routes'],['unknown']);
 requireRoute(config.schema==='wydgit.routing/0.1'&&Buffer.byteLength(JSON.stringify(config))<=65536&&Array.isArray(config.routes)&&config.routes.length>0&&config.routes.length<=256);
 shape(config.transport,['mode'],['peers','port','uid']);const transport=config.transport;
 requireRoute(['local-http','trusted-proxy','private-unix'].includes(transport.mode));
 if(transport.mode==='private-unix')requireRoute(Number.isSafeInteger(transport.uid)&&transport.uid>0&&!Object.hasOwn(transport,'peers'));
 else requireRoute(!Object.hasOwn(transport,'uid'));
 if(transport.mode==='local-http')requireRoute(!Object.hasOwn(transport,'peers')&&!Object.hasOwn(transport,'port'));
 else {if(transport.mode==='trusted-proxy')requireRoute(Array.isArray(transport.peers)&&transport.peers.length>0&&transport.peers.length<=16&&transport.peers.every(p=>typeof p==='string'&&isIP(p))&&new Set(transport.peers).size===transport.peers.length);if(transport.port!==undefined)requireRoute(Number.isInteger(transport.port)&&transport.port>0&&transport.port<=65535);}
 const seen=new Set();const routes=config.routes.map(entry=>{
  shape(entry,['hostname','app','state','approval']);requireRoute(apps.includes(entry.app)&&['active','parked','coming-soon','under-construction','unavailable'].includes(entry.state)&&['operator-domain','platform-domain','local-development'].includes(entry.approval));
  const hostname=hostName(entry.hostname);requireRoute(entry.approval!=='local-development'||local(hostname));requireRoute(!seen.has(hostname));seen.add(hostname);
  if(transport.mode==='local-http')requireRoute(local(hostname)&&entry.approval==='local-development');
  return {...entry,hostname};
 });
 let unknown=Object.hasOwn(config,'unknown')?config.unknown:{policy:'reject'};requireRoute(record(unknown));
 if(unknown.policy==='reject')shape(unknown,['policy']);
 else{
  shape(unknown,['policy','app','zones']);requireRoute(unknown.policy==='park-approved-zone'&&apps.includes(unknown.app)&&Array.isArray(unknown.zones)&&unknown.zones.length>0&&unknown.zones.length<=16);
  unknown={...unknown,zones:unknown.zones.map(zone=>{const name=hostName(zone);requireRoute(!isIP(name)&&!name.startsWith('[')&&name.split('.').length>=3&&(transport.mode!=='local-http'||local(name)));return name;})};
  requireRoute(new Set(unknown.zones).size===unknown.zones.length);
 }
 // An App cannot be both a tenant and a parking credential owner.
 const parking=new Set(routes.filter(r=>r.state!=='active').map(r=>r.app));if(unknown.policy!=='reject')parking.add(unknown.app);
 requireRoute(routes.filter(r=>r.state==='active').every(r=>!parking.has(r.app)));
 return freeze({...config,transport,routes,unknown,parking:[...parking]});
}
export function resolveRoute(config,request){
 // Inspect raw headers before Hono/WHATWG normalization loses duplicates.
 const values=name=>{const result=[];for(let i=0;i<request.rawHeaders.length;i+=2)if(request.rawHeaders[i].toLowerCase()===name)result.push(request.rawHeaders[i+1]);return result;};
 const hosts=values('host');requireRoute(hosts.length===1&&/^[\x21-\x7e]+$/.test(hosts[0])&&request.httpVersionMajor===1);
 const wire=canonicalAuthority(hosts[0]);let effective=wire,scheme='http';
 const forwarded=['forwarded','x-forwarded-host','x-forwarded-proto','x-forwarded-port','x-forwarded-for'];
 if(config.transport.mode==='local-http')requireRoute(forwarded.every(name=>values(name).length===0)&&!request.socket.encrypted);
 else{
  requireRoute((config.transport.mode==='private-unix'?unixPeers.get(request.socket)?.uid===config.transport.uid:config.transport.peers.includes(request.socket.remoteAddress))&&!values('forwarded').length&&!values('x-forwarded-port').length&&!values('x-forwarded-for').length);
  const hosts=values('x-forwarded-host'),protocols=values('x-forwarded-proto');requireRoute(hosts.length===1&&/^[\x21-\x7e]+$/.test(hosts[0])&&protocols.length===1&&protocols[0]==='https');
  effective=canonicalAuthority(hosts[0]);scheme='https';requireRoute((effective.port??443)===(config.transport.port??443));
 }
 requireRoute(typeof request.url==='string'&&request.url.length<=4096&&!/[\x00-\x20\x7f\\]/.test(request.url));
 if(!request.url.startsWith('/')){
  const match=/^(https?):\/\/([^/]+)(\/.*)?$/.exec(request.url);requireRoute(match&&match[1]===(request.socket.encrypted?'https':'http')&&canonicalAuthority(match[2]).authority===wire.authority);
 }else requireRoute(!request.url.startsWith('//'));
 const route=config.routes.find(r=>r.hostname===effective.hostname)??(config.unknown.policy==='park-approved-zone'&&config.unknown.zones.some(z=>effective.hostname===z||effective.hostname.endsWith('.'+z))?{app:config.unknown.app,state:'parked'}:null);
 if(!route)return null;
 const port=effective.port,origin=scheme+'://'+effective.hostname+((port===null||port===(scheme==='https'?443:80))?'':':'+port);
 // Origin checks supplement session-bound CSRF; same-site sibling hosts are not origins.
 if(!['GET','HEAD'].includes(request.method)){
  const origins=values('origin');requireRoute(origins.length===1&&origins[0]===origin);
 }
 return freeze({app:route.app,state:route.state,hostname:effective.hostname,origin,secure:scheme==='https',parking:route.state!=='active'});
}

const bindings=new WeakMap();
const unixPeers=new WeakMap();
// Native host composition only; never derived from headers or portable objects.
export function bindUnixPeer(socket,peer){unixPeers.set(socket,Object.freeze({...peer}));}
export function bindRequestRoute(request,route){bindings.set(request,route);}
export function requestRoute(request){return bindings.get(request);}
