import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalAuthority,validateRouting,resolveRoute} from '../wydgine/http/routing.js';
const apps=['alpha','beta','parking'];
const configuration=()=>({schema:'wydgit.routing/0.1',transport:{mode:'local-http'},routes:[{hostname:'alpha.test',app:'alpha',state:'active',approval:'local-development'},{hostname:'beta.test',app:'beta',state:'active',approval:'local-development'},{hostname:'soon.test',app:'parking',state:'coming-soon',approval:'local-development'}],unknown:{policy:'park-approved-zone',app:'parking',zones:['sites.example.test']}});
const request=(host,extra={})=>({rawHeaders:['Host',host],httpVersionMajor:1,method:'GET',url:'/',socket:{remoteAddress:'127.0.0.1'},...extra});
test('canonical authorities normalize DNS case, one trailing dot, IDNA and IPv6; ports remain explicit',()=>{
 for(const [input,expected] of [['EXAMPLE.test.','example.test'],['0x-demo.test','0x-demo.test'],['bücher.test','xn--bcher-kva.test'],['[0:0:0:0:0:0:0:1]:8000','[::1]:8000'],['127.0.0.1:80','127.0.0.1:80']])assert.equal(canonicalAuthority(input).authority,expected);
 for(const input of ['', ' ', 'a..test','a.test..','a_test','-a.test','a-.test','a/test','a@test','a?x','a#x','a%2etest','a\\test','a:0','a:65536','a:080','a:-1','a:','a:1:2','127.1','0177.0.0.1','0x7f000001','123','[::1%lo]','[nope]','a\n.test','x'.repeat(64)+'.test'])assert.throws(()=>canonicalAuthority(input),{code:'HOST.ROUTING'},input);
});
test('registry is closed and rejects alias collisions, foreign Apps, unsafe zones, profiles and mixed parking ownership',()=>{
 const validated=validateRouting(configuration(),apps);assert.ok(Object.isFrozen(validated.routes));
 for(const change of [c=>c.extra=true,c=>c.unknown=null,c=>c.schema='next',c=>c.routes.push({...c.routes[0],hostname:'ALPHA.TEST.'}),c=>c.routes[0].app='foreign',c=>c.routes[0].hostname='*.test',c=>c.routes[0].hostname='alpha.test:80',c=>c.routes[0].approval='unverified',c=>c.routes[0].extra=1,c=>c.routes[0].hostname='public.com',c=>c.unknown.zones=['com'],c=>c.unknown.zones=['co.uk'],c=>c.unknown.zones=['*.example.test'],c=>c.unknown.app='alpha',c=>c.transport.peers=['127.0.0.1'],c=>c.transport.mode='automatic']){const c=configuration();change(c);assert.throws(()=>validateRouting(c,apps),{code:'HOST.ROUTING'});}
});
test('exact routes and complete label approved zones resolve; unrelated and malicious suffixes reject',()=>{
 const c=validateRouting(configuration(),apps);
 assert.equal(resolveRoute(c,request('ALPHA.TEST.:8123')).app,'alpha');assert.equal(resolveRoute(c,request('soon.test')).state,'coming-soon');
 assert.equal(resolveRoute(c,request('new.sites.example.test')).app,'parking');assert.equal(resolveRoute(c,request('sites.example.test')).parking,true);
 for(const host of ['unrelated.test','evil-sites.example.test','sites.example.test.evil.test','evilalpha.test'])assert.equal(resolveRoute(c,request(host)),null);
});
test('raw duplicates, absolute-form mismatch, forged proxy claims and cross-origin submissions fail before App selection',()=>{
 const c=validateRouting(configuration(),apps);
 assert.equal(resolveRoute(c,request('alpha.test',{url:'http://alpha.test/path'})).app,'alpha');
 for(const extra of [{rawHeaders:[]},{rawHeaders:['Host','alpha.test','HOST','beta.test']},{url:'http://beta.test/'},{url:'//beta.test/'},{url:'https://alpha.test/'},{httpVersionMajor:2},{rawHeaders:['Host','alpha.test','X-Forwarded-Host','beta.test']},{method:'POST'},{method:'POST',rawHeaders:['Host','alpha.test','Origin','http://beta.test']}])assert.throws(()=>resolveRoute(c,request('alpha.test',extra)),{code:'HOST.ROUTING'});
 assert.equal(resolveRoute(c,request('alpha.test',{method:'POST',rawHeaders:['Host','alpha.test','Origin','http://alpha.test']})).app,'alpha');
});
test('HTTPS origin requires exact approved native proxy peer and a single HTTPS forwarded authority',()=>{
 const config=configuration();config.transport={mode:'trusted-proxy',peers:['127.0.0.1']};const c=validateRouting(config,apps);
 const req=request('internal.test',{rawHeaders:['Host','internal.test','X-Forwarded-Host','alpha.test','X-Forwarded-Proto','https']});
 const route=resolveRoute(c,req);assert.equal(route.origin,'https://alpha.test');assert.equal(route.secure,true);
 for(const extra of [{socket:{remoteAddress:'127.0.0.2'}},{rawHeaders:[...req.rawHeaders,'Forwarded','host=beta.test']},{rawHeaders:[...req.rawHeaders,'X-Forwarded-Host','beta.test']},{rawHeaders:['Host','internal.test','X-Forwarded-Host','alpha.test','X-Forwarded-Proto','http']},{rawHeaders:['Host','internal.test','X-Forwarded-Host','alpha.test:444','X-Forwarded-Proto','https']}])assert.throws(()=>resolveRoute(c,{...req,...extra}),{code:'HOST.ROUTING'});
});
