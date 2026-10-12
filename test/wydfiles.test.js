import test from 'node:test';
import {EventEmitter} from 'node:events';
import {sendTransfer} from '../wydgine/http/transfers.js';
import {permissions} from '../wydgine/packages/manifest.js';
import assert from 'node:assert/strict';
import {mkdtemp,rm,symlink,readdir,readFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {localProvider} from '../packages/wydfiles/src/local.js';
import {s3Provider} from '../packages/wydfiles/src/s3.js';
import {validateOptions,initialize} from '../packages/wydfiles/src/index.js';
import {logicalPath,resolveMount,keyFor,defaults} from '../packages/wydfiles/src/contract.js';
import {loadLibraries} from '../wydgine/libraries/index.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {operation,boundedStream} from '../packages/wydfiles/src/operation.js';
import platform from '../package.json' with {type:'json'};
const caps=['read','write','delete','list'].map(a=>'files.storage.'+a);
const ctx=(extra={})=>new ExecutionContext({app:'app-a',publisher:'acme',package:'acme/demo',principal:'acme/demo',installation:'receipt-a',self:'page',capabilities:caps,scopes:{wydfiles:[{path:'/'}]},...extra});
const temporary=async t=>{const root=await mkdtemp(path.join(os.tmpdir(),'wydfiles-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;};
function simulatedS3(){const objects=new Map(),calls=[];const request=async(url,o)=>{calls.push({url:String(url),...o});const u=new URL(url),key=u.pathname.split('/').slice(3).join('/');if(u.search){const prefix=u.searchParams.get('prefix');const xml='<ListBucketResult><IsTruncated>false</IsTruncated>'+[...objects].map(([k,v])=>`<Contents><Key>${prefix}${k}</Key><Size>${v.length}</Size><ETag>v</ETag></Contents>`).join('')+'</ListBucketResult>';return new Response(xml);}if(o.method==='PUT'){const chunks=[];for await(const c of o.body)chunks.push(c);objects.set(key,Buffer.concat(chunks));return new Response('',{status:200});}if(!objects.has(key))return new Response('',{status:404});const data=objects.get(key);if(o.method==='DELETE'){objects.delete(key);return new Response(null,{status:204});}if(o.method==='HEAD')return new Response(null,{headers:{'content-length':String(data.length),etag:'v'}});const range=o.headers.Range;if(range){const m=/bytes=(\d+)-(\d*)/.exec(range);return new Response(data.subarray(Number(m[1]),m[2]?Number(m[2])+1:undefined),{status:206,headers:{'content-range':`bytes ${Number(m[1])}-${m[2]?Number(m[2]):data.length-1}/${data.length}`,'content-length':String(m[2]?Number(m[2])-Number(m[1])+1:data.length-Number(m[1]))}});}return new Response(data);};return {objects,calls,request};}
const s3config={endpoint:'https://storage.example',bucket:'bucket-test',namespace:'app-a-mount-a',region:'us-east-1',credentials:{accessKeyId:'test-key',secretAccessKey:'test-secret'}};
for(const kind of ['local','s3-simulated'])test(`shared provider conformance: ${kind}`,async t=>{const double=simulatedS3(),provider=kind==='local'?await localProvider(await temporary(t)):s3Provider(s3config,defaults,double.request),key=keyFor('/a');await assert.rejects(()=>provider.stat(key),e=>e.code==='FILES.NOT_FOUND');await provider.write(key,Readable.from([Buffer.from('hello')]),5);assert.equal((await provider.stat(key)).size,5);let opened=await provider.read(key,1,3);let chunks=[];for await(const c of opened.stream)chunks.push(c);await opened.close();assert.equal(Buffer.concat(chunks).toString(),'ell');assert.equal((await provider.inventory(10)).length,1);const copy=keyFor('/copied');opened=await provider.read(key);await provider.write(copy,opened.stream,5);await opened.close();assert.equal((await provider.stat(copy)).size,5);await provider.delete(copy);await provider.write(key,Readable.from([Buffer.from('new')]),3);assert.equal((await provider.stat(key)).size,3);await provider.delete(key);await assert.rejects(()=>provider.delete(key),e=>e.code==='FILES.NOT_FOUND');if(kind==='s3-simulated'){assert.match(double.calls[0].headers.Authorization,/AWS4-HMAC-SHA256/);assert.ok(double.calls.every(c=>c.url.includes('bucket-test')));}});
async function fixture(t,limits={},adapter){const base=await temporary(t);await mkdir(path.join(base,'root'));await mkdir(path.join(base,'media'));const options={schema:'wydfiles.host/1.0',limits,apps:[{app:'app-a',mounts:[{path:'/',provider:'local',root:path.join(base,'root'),permissions:['read','write','delete','list']},{path:'/media',provider:'local',root:path.join(base,'media'),permissions:['read','write','delete','list']}],grants:[{publisher:'acme',package:'acme/demo',principal:'acme/demo',installation:'receipt-a',path:'/',actions:['read','write','delete','list']}]}]};const registry=await loadLibraries({root:path.resolve('.'),platformVersion:platform.version,adapters:adapter?{wydfiles:{provider:adapter}}:{},config:{schema:'wydgit.host/0.1',libraries:[{id:'wydfiles',package:'@wydgit/files',enabled:true,version:'^0.1.0-alpha.1',publisher:'wydgit.core',trust:'canonical',options}]}});const invoke=(op,input,c=ctx())=>registry.bind(c).invoke('wydfiles','1.0.0',op,input);const write=(p,data,c=ctx(),size=Buffer.byteLength(data))=>registry.transfer(c,'wydfiles','write',{path:p,size},{method:'POST',authorize:async()=>{},body:Readable.from([Buffer.from(data)])});const read=async(p,c=ctx(),range)=>{const result=await registry.transfer(c,'wydfiles',range?'read-range':'read',{path:p,...range},{method:'GET',authorize:async()=>{}});try{const chunks=[];for await(const chunk of result.stream)chunks.push(chunk);return Buffer.concat(chunks).toString();}finally{await result.close();}};return {base,registry,invoke,write,read,options};}
test('canonical mounts, binary boundary, copy/move, pagination and denial',async t=>{const f=await fixture(t);await f.write('/media/a','hello');await f.write('/b','world');assert.equal(await f.read('/media/a'),'hello');assert.equal(await f.read('/media/a',ctx(),{start:1,length:3}),'ell');assert.equal((await f.invoke('read',{path:'/b'})).code,'FILES.TRANSFER_REQUIRED');assert.equal((await f.invoke('list',{path:'/',limit:1})).value.nextOffset,1);assert.equal((await f.invoke('copy',{path:'/b',destination:'/c'})).value.atomic,false);assert.equal((await f.invoke('move',{path:'/c',destination:'/d'})).ok,true);assert.equal((await f.invoke('exists',{path:'/c'})).value.exists,false);assert.equal((await f.invoke('copy',{path:'/b',destination:'/media/b'})).code,'FILES.CROSS_MOUNT_DENIED');assert.equal((await f.invoke('mkdir',{path:'/dir'})).code,'FILES.UNSUPPORTED');for(const extra of [{app:'other'},{principal:'other'},{installation:'other'},{package:'other'},{publisher:'other'},{capabilities:[]},{scopes:{wydfiles:[{path:'/media'}]}}]){for(const op of ['exists','stat','list'])assert.ok(['FILES.DENIED','SEAM.DENIED'].includes((await f.invoke(op,{path:'/b'},ctx(extra))).code));}assert.equal((await f.invoke('stat',{path:'/b',app:'other'})).code,'FILES.INVALID_REQUEST');await assert.rejects(()=>f.registry.transfer({},'wydfiles','read',{path:'/b'},{}));const result=await f.invoke('stat',{path:'/b'});assert.ok(!JSON.stringify(result).includes(f.base));assert.equal((await f.invoke('delete',{path:'/b'})).ok,true);});
test('strict logical syntax and mount segment boundaries',()=>{for(const p of ['/../a','/a/../b','/%2e%2e','/a%2fb','/a\\b','//a','/a/','/é','/a\u0000','/a.','/a:b'])assert.throws(()=>logicalPath(p));const mounts=[{path:'/'},{path:'/media'},{path:'/media/photos'}];assert.equal(resolveMount(mounts,'/media/photos/a').path,'/media/photos');assert.equal(resolveMount(mounts,'/media-archive/a').path,'/');});
test('quota, concurrent writes, interruption and symlink confinement',async t=>{const f=await fixture(t,{fileBytes:5,quotaBytes:8});await Promise.all([f.write('/a','1234'),f.write('/b','1234')]);await assert.rejects(()=>f.write('/c','1'),e=>e.code==='FILES.QUOTA');await assert.rejects(()=>f.write('/a','123456'),e=>e.code==='FILES.LIMIT');await assert.rejects(()=>f.write('/a','1',ctx(),4),e=>e.code==='FILES.INTERRUPTED');assert.equal(await f.read('/a'),'1234');assert.equal((await readdir(path.join(f.base,'root'))).filter(n=>n.startsWith('.upload-')).length,0);await f.invoke('delete',{path:'/b'});await symlink(path.join(f.base,'root',keyFor('/a')),path.join(f.base,'root',keyFor('/evil')));assert.equal((await f.invoke('stat',{path:'/evil'})).code,'FILES.STORAGE');await assert.rejects(()=>f.write('/evil','z'));assert.equal(await readFile(path.join(f.base,'root',keyFor('/a')),'utf8'),'1234');});
test('bounded transfer timeout and operation limits',async t=>{const f=await fixture(t,{durationMs:20,transfers:1});const body=new Readable({read(){}});const pending=f.registry.transfer(ctx(),'wydfiles','write',{path:'/slow',size:1},{method:'POST',authorize:async()=>{},body});await assert.rejects(pending,e=>e.code==='FILES.TIMEOUT');await f.write('/ok','x');assert.equal(await f.read('/ok'),'x');});
test('S3 provider failures, redirects, timeout, range downgrade, limits',async()=>{for(const [response,code] of [[()=>new Response('',{status:503}),'FILES.PROVIDER'],[()=>{const e=new Error();e.name='TimeoutError';throw e;},'FILES.TIMEOUT'],[()=>new Response('',{status:404}),'FILES.NOT_FOUND']]){const p=s3Provider(s3config,{...defaults,retries:0},response);await assert.rejects(()=>p.stat(keyFor('/a')),e=>e.code===code);}const p=s3Provider(s3config,defaults,async()=>new Response('abc'));await assert.rejects(()=>p.read(keyFor('/a'),1,2),e=>e.code==='FILES.UNSUPPORTED');assert.throws(()=>s3Provider({...s3config,endpoint:'http://storage.example'},defaults));});

test('host configuration cannot accept ambiguous mounts or inflated limits',async t=>{const f=await fixture(t);const options=structuredClone(f.options);options.apps[0].mounts.push({...options.apps[0].mounts[0]});assert.throws(()=>validateOptions(options));assert.throws(()=>validateOptions({...f.options,limits:{fileBytes:1024**3}}));assert.throws(()=>validateOptions({...f.options,apps:[...f.options.apps,...f.options.apps]}));assert.throws(()=>validateOptions({...f.options,evil:true}));});
test('narrow scopes filter listing and deny private discovery',async t=>{const f=await fixture(t);await f.write('/media/a','a');await f.write('/private','b');const narrow=ctx({scopes:{wydfiles:[{path:'/media'}]}});assert.deepEqual((await f.invoke('list',{path:'/media'},narrow)).value.items.map(i=>i.path),['/media/a']);assert.equal((await f.invoke('exists',{path:'/absent'},narrow)).code,'FILES.DENIED');await assert.rejects(()=>f.write('/private','x',narrow),e=>e.code==='FILES.DENIED');});

test('installer accepts validated logical scopes without relaxing other libraries',()=>{const p={capabilities:[],traversal:[],visible:[],editable:[],scopes:{wydstore:[],wydfiles:['/documents','/']}};assert.deepEqual(permissions(p).scopes.wydfiles,p.scopes.wydfiles);assert.throws(()=>permissions({...p,scopes:{wydstore:[],wydfiles:['/../bad']}}));assert.throws(()=>permissions({...p,scopes:{wydstore:[],wydstream:['/media']}}));});

test('canonical streaming copy/move on simulated S3 and unsupported provider capability',async t=>{const f=await fixture(t,{},()=>s3Provider(s3config,defaults,simulatedS3().request));await f.write('/a','abc');assert.equal((await f.invoke('copy',{path:'/a',destination:'/b'})).value.atomic,false);assert.equal(await f.read('/b'),'abc');assert.equal((await f.invoke('move',{path:'/b',destination:'/c'})).ok,true);assert.equal((await f.invoke('exists',{path:'/b'})).value.exists,false);assert.equal(await f.read('/c'),'abc');const unsupported=await fixture(t,{},async m=>{const p=await localProvider(m.root);return {...p,capabilities:{...p.capabilities,rangeRead:false}};});await unsupported.write('/a','abc');await assert.rejects(()=>unsupported.read('/a',ctx(),{start:0,length:1}),e=>e.code==='FILES.UNSUPPORTED');});

test('zero effective chunks fail before storage, leave no upload, and preserve transfer capacity',async t=>{
 let accesses=0;
 const f=await fixture(t,{transfers:1},async m=>{
  const p=await localProvider(m.root);
  return {...p,async inventory(...args){accesses++;return p.inventory(...args);},async write(...args){accesses++;return p.write(...args);}};
 });
 const zero=ctx({limits:{filesChunkBytes:0,filesRetries:0}});
 await assert.rejects(()=>f.write('/bad','abc',zero),e=>e.code==='FILES.LIMIT'&&!String(e).includes(f.base));
 assert.equal((await f.invoke('stat',{path:'/bad'},zero)).code,'FILES.LIMIT');assert.equal(accesses,0);
 assert.deepEqual(await readdir(path.join(f.base,'root')),[]);assert.deepEqual(await readdir(path.join(f.base,'media')),[]);
 await f.write('/good','abc',ctx({limits:{filesRetries:0,filesChunkBytes:1}}));assert.equal(await f.read('/good'),'abc');
 // Defense at the splitter itself, independent of canonical validation.
 const stream=boundedStream(Readable.from([Buffer.from('x')]),1,{limits:{...defaults,chunkBytes:0},deadline:Infinity});
 await assert.rejects(()=>stream.next(),e=>e.code==='FILES.LIMIT');
});

test('S3 normalized identities reject endpoint aliases while distinct nested mounts activate',async()=>{
 const permissions=['read','write','delete','list'];
 const mount=(endpoint,path,namespace=s3config.namespace)=>({...s3config,endpoint,path,namespace,provider:'s3',permissions});
 const options=mounts=>({schema:'wydfiles.host/1.0',apps:[{app:'app-a',mounts,grants:[]}]});
 for(const alias of ['https://storage.example/','https://STORAGE.EXAMPLE','https://storage.example:443/']){
  await assert.rejects(()=>initialize({root:path.resolve('.'),options:options([mount(s3config.endpoint,'/'),mount(alias,'/media')])}),e=>e.code==='FILES.INVALID_CONFIG');
 }
 const initialized=await initialize({root:path.resolve('.'),options:options([mount('https://STORAGE.EXAMPLE:443/','/'),mount(s3config.endpoint,'/media','distinct')])});
 assert.equal(resolveMount(initialized.context.apps.get('app-a').mounts,'/media/a').path,'/media');
});

for(const [name,headers,status,body,expected] of [
 ['correct',{'content-range':'bytes 1-3/5','content-length':'3'},206,'ell',null],
 ['open ended',{'content-range':'bytes 1-4/5','content-length':'4'},206,'ello',null],
 ['wrong same length',{'content-range':'bytes 0-2/5','content-length':'3'},206,'hel','FILES.RANGE'],
 ['wrong total',{'content-range':'bytes 1-3/6'},206,'ell','FILES.RANGE'],
 ['missing',{},206,'ell','FILES.RANGE'],
 ['malformed',{'content-range':'bytes broken'},206,'ell','FILES.RANGE'],
 ['unsatisfied header',{'content-range':'bytes */5'},206,'ell','FILES.RANGE'],
 ['unsatisfied status',{'content-range':'bytes */5'},416,'','FILES.RANGE'],
 ['invalid boundaries',{'content-range':'bytes 1-5/5'},206,'ell','FILES.RANGE'],
 ['wrong declared length',{'content-range':'bytes 1-3/5','content-length':'2'},206,'ell','FILES.RANGE'],
 ['malformed length',{'content-range':'bytes 1-3/5','content-length':'oops'},206,'ell','FILES.PROVIDER'],
 ['truncated',{'content-range':'bytes 1-3/5','content-length':'3'},206,'el','FILES.INTERRUPTED'],
 ['oversized',{'content-range':'bytes 1-3/5','content-length':'3'},206,'ellx','FILES.LIMIT'],
 ['ignored Range',{},200,'hello','FILES.UNSUPPORTED']
])test(`S3 range response: ${name}`,async()=>{
 let closed=false;const response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from(body));},cancel(){closed=true;}}),{status,headers});
 const p=s3Provider(s3config,defaults,async()=>response);
 if(['truncated','oversized','correct','open ended'].includes(name)){
  // Finite test streams permit exact-length verification at EOF.
  await response.body.cancel();closed=false;
  const finite=s3Provider(s3config,defaults,async()=>new Response(body,{status,headers}));
  const opened=await finite.read(keyFor('/a'),1,name==='open ended'?undefined:3,undefined,5);
  const consume=async()=>{const parts=[];for await(const c of opened.stream)parts.push(c);return Buffer.concat(parts).toString();};
  try{if(expected)await assert.rejects(consume,e=>e.code===expected);else assert.equal(await consume(),body);}finally{await opened.close();}
 }else{await assert.rejects(()=>p.read(keyFor('/a'),1,3,undefined,5),e=>e.code===expected&&!String(e).includes('storage.example'));assert.equal(closed,true);}
});

test('S3 effective retry limits and concurrent deadlines are caller-local',async t=>{
 let calls=0;
 const f=await fixture(t,{},()=>s3Provider(s3config,defaults,async()=>{calls++;return new Response('',{status:503});}));
 for(const op of ['stat','exists','list','delete','copy','move']){
  calls=0;const input={path:'/a',...(['copy','move'].includes(op)?{destination:'/b'}:{})};
  assert.equal((await f.invoke(op,input,ctx({limits:{filesRetries:0}}))).code,'FILES.PROVIDER');assert.equal(calls,1,op);
 }
 calls=0;await assert.rejects(()=>f.write('/a','x',ctx({limits:{filesRetries:0}})),e=>e.code==='FILES.PROVIDER');assert.equal(calls,1); // capacity inventory
 calls=0;await assert.rejects(()=>f.read('/a',ctx({limits:{filesRetries:0}})),e=>e.code==='FILES.PROVIDER');assert.equal(calls,1); // metadata
 calls=0;assert.equal((await f.invoke('stat',{path:'/a'},ctx({limits:{filesRetries:1}}))).code,'FILES.PROVIDER');assert.equal(calls,2);
 let arrivals=0;let both;const arrived=new Promise(r=>{both=r;});
 const concurrent=await fixture(t,{},()=>s3Provider(s3config,defaults,async(_url,{signal})=>{
  if(++arrivals===2)both();await arrived;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve(new Response(null,{headers:{'content-length':'1'}})),70);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('aborted secret'));},{once:true});});
 }));
 const [short,long]=await Promise.all([concurrent.invoke('stat',{path:'/a'},ctx({limits:{filesDurationMs:30,filesRetries:0}})),concurrent.invoke('stat',{path:'/a'},ctx({limits:{filesDurationMs:500,filesRetries:0}}))]);
 assert.equal(short.code,'FILES.TIMEOUT');assert.equal(long.ok,true);assert.equal(arrivals,2);
});

test('S3 one deadline spans retries, pagination, stream consumption and non-retrying mutations',async()=>{
 const delay=ms=>new Promise(r=>setTimeout(r,ms));let calls=0;
 const retried=s3Provider(s3config,defaults,async()=>{calls++;await delay(30);return new Response('',{status:503});});
 await assert.rejects(()=>retried.stat(keyFor('/a'),operation({...defaults,durationMs:50,retries:5})),e=>e.code==='FILES.TIMEOUT');assert.equal(calls,2);
 calls=0;const paged=s3Provider(s3config,defaults,async()=>{calls++;await delay(30);return new Response(`<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>${calls}</NextContinuationToken></ListBucketResult>`);});
 await assert.rejects(()=>paged.inventory(10,operation({...defaults,durationMs:50})),e=>e.code==='FILES.TIMEOUT');assert.equal(calls,2);
 let closed=false;const slow=s3Provider(s3config,defaults,async()=>{await delay(30);return new Response(new ReadableStream({cancel(){closed=true;}}),{headers:{'content-length':'1'}});});
 const opened=await slow.read(keyFor('/a'),0,undefined,operation({...defaults,durationMs:50}),1);
 try{await assert.rejects(async()=>{for await(const c of opened.stream)assert.fail('stalled');},e=>e.code==='FILES.TIMEOUT');}finally{await opened.close();}assert.equal(closed,true);
 for(const method of ['PUT','DELETE']){
  let mutations=0;const p=s3Provider(s3config,defaults,async(_url,o)=>{if(o.method==='HEAD')return new Response(null,{headers:{'content-length':'1'}});mutations++;if(o.body)for await(const c of o.body){}return new Response('',{status:503});});
  await assert.rejects(()=>method==='PUT'?p.write(keyFor('/a'),Readable.from([Buffer.from('x')]),1):p.delete(keyFor('/a')),e=>e.code==='FILES.PROVIDER');assert.equal(mutations,1);
 }
});

test('canonical S3 deadlines span metadata, capacity, transfer and mutation phases',async t=>{
 const calls=[];
 const f=await fixture(t,{},()=>s3Provider(s3config,defaults,async(url,o)=>{
  calls.push(o.method);await new Promise(r=>setTimeout(r,40));
  if(new URL(url).search)return new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
  if(o.method==='HEAD')return new Response(null,{headers:{'content-length':'1'}});
  if(o.method==='GET')return new Response('x',{headers:{'content-length':'1'}});
  if(o.body)for await(const c of o.body){}
  return new Response(null,{status:204});
 }));
 const limited=ctx({limits:{filesDurationMs:65,filesRetries:0}});
 for(const op of ['list','delete','copy','move']){
  calls.length=0;const result=await f.invoke(op,{path:'/a',...(['copy','move'].includes(op)?{destination:'/b'}:{})},limited);
  assert.equal(result.code,'FILES.TIMEOUT',op);assert.equal(calls.length,2,op);
 }
 calls.length=0;await assert.rejects(()=>f.write('/a','x',limited),e=>e.code==='FILES.TIMEOUT');assert.deepEqual(calls,['GET','GET']); // both mount inventories, no PUT
 calls.length=0;await assert.rejects(()=>f.read('/a',limited),e=>e.code==='FILES.TIMEOUT');assert.deepEqual(calls,['HEAD','GET']);
 assert.equal((await f.invoke('exists',{path:'/a'},ctx({limits:{filesDurationMs:20}}))).code,'FILES.TIMEOUT');
});

for(const mode of ['truncated','oversized','aborted'])test(`S3 range ${mode} after downstream delivery fails and releases capacity`,async t=>{
 let upstreamClosed=false,healthy=false;
 const upstream=new Readable({read(){},destroy(error,done){upstreamClosed=true;done(error);}});
 const f=await fixture(t,{transfers:1},()=>s3Provider(s3config,defaults,async(_url,o)=>{
  if(o.method==='HEAD')return new Response(null,{headers:{'content-length':'5'}});
  return new Response(healthy?'ell':Readable.toWeb(upstream),{status:206,headers:{'content-range':'bytes 1-3/5','content-length':'3'}});
 }));
 const result=await f.registry.transfer(ctx(),'wydfiles','read-range',{path:'/a',start:1,length:3},{method:'GET',authorize:async()=>{}});
 let delivered;const firstWrite=new Promise(resolve=>{delivered=resolve;});
 const res=new EventEmitter();res.destroyed=false;res.ended=false;res.parts=[];res.setHeader=()=>{};
 res.write=chunk=>{res.parts.push(Buffer.from(chunk));delivered();return false;}; // impose downstream backpressure
 res.end=()=>{res.ended=true;};
 const sending=sendTransfer(result,res,'GET');
 const rejected=assert.rejects(sending,e=>e.code===({'truncated':'FILES.INTERRUPTED','oversized':'FILES.LIMIT','aborted':'FILES.PROVIDER'}[mode])&&!String(e).includes('secret'));
 upstream.push(Buffer.from('e'));await firstWrite;
 assert.equal(Buffer.concat(res.parts).toString(),'e');assert.equal(res.ended,false);
 if(mode==='truncated')upstream.push(null);
 if(mode==='oversized'){upstream.push(Buffer.from('llll'));upstream.push(null);}
 if(mode==='aborted')upstream.destroy(new Error('secret upstream endpoint/credential'));
 res.emit('drain');await rejected;
 assert.equal(upstreamClosed,true);assert.equal(res.ended,false); // sender never signals successful completion
 await result.close(); // cleanup is idempotent
 healthy=true;assert.equal(await f.read('/a',ctx(),{start:1,length:3}),'ell'); // single transfer slot recovered
});
