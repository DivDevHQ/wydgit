import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { parseMap,parseCookies,requestFacade,cookieReader } from '../wydgine/http/input.js';
import { createResponse } from '../wydgine/http/response.js';
import { fileCatalog } from '../wydgine/http/files.js';
import { Transport } from '../test-support/events.js';
import { temp } from '../test-support/wydstore.js';
const ctx=(extra={})=>new ExecutionContext({publisher:'acme',self:'page',capabilities:['request.cookies.read','response.headers.write','response.cookies.write','response.markdown.write','response.files.send','files.resources.read'],scopes:{headers:['cache-control','content-type','set-cookie','content-security-policy'],cookies:[{name:'theme',path:'/'},{name:'__Host-wydgit-auth',path:'/'}],files:['report']},...extra});
const rejects=(fn,code)=>assert.rejects(fn,e=>e.code===code);

test('bounded request maps preserve repeated values, reject malformed keys/encoding and hide raw cookies',()=>{
 const request=requestFacade({method:'POST',path:'/',query:'tag=a&tag=b',form:'name=Alice',cookies:parseCookies('theme=dark; __Host-wydgit-auth=secret')},ctx());
 assert.equal(request.IsPost,true);assert.equal(request.Form.Get('name'),'Alice');assert.equal(request.Query.Get('missing'),null);assert.deepEqual(request.Query.GetAll('tag'),['a','b']);assert.throws(()=>request.Query.Get('tag'),e=>e.code==='REQUEST.INVALID');
 assert.equal(request.Cookies.Get('theme'),'dark');assert.throws(()=>request.Cookies.Get('__Host-wydgit-auth'),e=>e.code==='SEAM.DENIED');assert.equal(request.socket,undefined);assert.equal(request.headers,undefined);
 for(const value of ['constructor=x','prototype=x','__proto__=x','name=%ZZ','name=%C0%AF'])assert.throws(()=>parseMap(value));assert.throws(()=>parseMap('x'.repeat(33000)));
 assert.throws(()=>parseCookies('theme=a; theme=b'));assert.throws(()=>parseCookies('theme=%0d%0aInjected'));
 assert.throws(()=>cookieReader(ctx({capabilities:[]}),{},'request.cookies.read').Get('theme'),e=>e.code==='SEAM.DENIED');
});

test('response state, protected headers, named cookies and no partial commit on denial',async()=>{
 const response=createResponse(ctx()),r=response.facade();r.Headers.Set('Cache-Control','no-store');
 for(const name of ['Content-Type','cOnTeNt-SeCuRiTy-PoLiCy','Set-Cookie','Connection','Location','Transfer-Encoding','X-Frame-Options'])assert.throws(()=>r.Headers.Set(name,'unsafe'),e=>e.code==='RESPONSE.DENIED');
 assert.throws(()=>r.Headers.Remove('Content-Security-Policy'));assert.throws(()=>r.Headers.Set('Cache-Control','ok\r\nx: injected'));
 r.Cookies.Set('theme','dark');r.Cookies.Delete('theme');assert.throws(()=>r.Cookies.Set('__Host-wydgit-auth','forged'));
 for(const options of [{Domain:'other.test'},{Path:'/other'},{Secure:false},{HttpOnly:false},{SameSite:'None'},{MaxAge:-1}])assert.throws(()=>r.Cookies.Set('theme','x',options));
 assert.equal(response.state,'Open');await r.WriteMarkdown('# Hello');assert.equal(response.state,'Committed');assert.throws(()=>r.Headers.Set('Cache-Control','x'),e=>e.code==='RESPONSE.STATE');await rejects(()=>r.WriteMarkdown('again'),'RESPONSE.STATE');
 const transport=new Transport();await response.send(transport);assert.equal(response.state,'Complete');assert.match(transport.getHeader('set-cookie')[0],/theme=; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=0/);assert.match(transport.text,/<h1>Hello/);
 const denied=createResponse(ctx({capabilities:[]}));await rejects(()=>denied.facade().WriteMarkdown('x'),'SEAM.DENIED');assert.equal(denied.state,'Open');await denied.close();
});

test('file response uses approved resources, rejects paths/forgeries/active types and closes streams',async t=>{
 const root=await temp(t);await fs.writeFile(path.join(root,'report.txt'),'safe report');
 const files=await fileCatalog(root,[{id:'report',file:'report.txt',type:'text/plain'}]),context=ctx(),handle=files.get('report',context),response=createResponse(context);
 await rejects(()=>response.facade().SendFile('/etc/passwd'),'FILE.DENIED');await rejects(()=>response.facade().SendFile({id:'report'}),'FILE.DENIED');
 await rejects(()=>response.facade().SendFile(handle,{Filename:'../escape'}),'RESPONSE.INVALID');await rejects(()=>response.facade().SendFile(handle,{Disposition:'inline'}),'RESPONSE.DENIED');await rejects(()=>response.facade().SendFile(handle,{type:'text/html'}),'RESPONSE.INVALID');assert.equal(response.state,'Open');
 await response.facade().SendFile(handle,{Filename:'report.txt'});const transport=new Transport();await response.send(transport);assert.equal(transport.text,'safe report');assert.equal(transport.getHeader('content-type'),'text/plain');assert.equal(response.state,'Complete');
 const stale=createResponse(context);files.close();await rejects(()=>stale.facade().SendFile(handle),'FILE.DENIED');
 const active=await fileCatalog(root,[{id:'report',file:'report.txt',type:'text/html'}]);const output=createResponse(context);await output.facade().SendFile(active.get('report',context));const safe=new Transport();await output.send(safe);assert.equal(safe.getHeader('content-type'),'application/octet-stream');assert.match(safe.getHeader('content-disposition'),/^attachment/);
 const failed=createResponse(context);await failed.facade().SendFile(active.get('report',context));const broken=new Transport();broken.destroyed=true;await rejects(()=>failed.send(broken),'RESPONSE.IO');assert.equal(failed.state,'Complete');
 await fs.writeFile(path.join(root,'large'),Buffer.alloc(16*1024*1024+1));const big=await fileCatalog(root,[{id:'report',file:'large'}]);await rejects(()=>createResponse(context).facade().SendFile(big.get('report',context)),'FILE.LIMIT');
 await assert.rejects(()=>fileCatalog(root,[{id:'bad',file:'../secret'}]));
 const noRead=ctx({capabilities:['response.files.send']});assert.throws(()=>active.get('report',noRead),e=>e.code==='SEAM.DENIED');
 const noSend=ctx({capabilities:['files.resources.read']});await rejects(()=>createResponse(noSend).facade().SendFile(active.get('report',noSend)),'SEAM.DENIED');
});
