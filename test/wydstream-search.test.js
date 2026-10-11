import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {load as html} from 'cheerio';
import {mediaFixture,png} from '../test-support/wydstream.js';
import {buildOperatorPolicy} from '../scripts/install-package.js';
import {planOperatorInstall,applyOperatorInstall} from '../scripts/package-infrastructure.js';
import {initializeHost} from '../wydgine/host.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {createHostApp} from '../app.js';
import {mediaSearchSource} from '../packages/wydstream/src/search-source.js';
import {renderComponent} from '../wydgine/components.js';
import {escapeHtml} from '../wydgine/index.js';
import definitions from '../examples/search/prototypes.json' with {type:'json'};
import {safeDestination,destinationWithParameter} from '../wydgine/http/destination.js';

for(const provider of ['JSON','SQLite'])test(`${provider}: uploaded media indexes canonically, renders links, plays/delivers and rechecks visibility`,async t=>{
 const f=await mediaFixture(t,provider);
 // Install ordinary search infrastructure into this disposable media App.
 const packagePath=path.resolve('examples/search'),manifest=JSON.parse(await fs.readFile(path.join(packagePath,'manifest.json')));
 const answers=['y','Create Search Results Page','','','','','home',provider,'y','','n'];
 const policy=await buildOperatorPolicy({root:f.root,packagePath,manifest,ask:async()=>{assert.ok(answers.length);return answers.shift();},write:()=>{}});
 await applyOperatorInstall(await planOperatorInstall({root:f.root,packagePath,manifest,policy,installationContext:policy.installationContext}));
 let libraries,unsafeURL,destination='/?view=gallery&media=old';
 const mediaSource=mediaSearchSource({indexes:[{id:'site',app:f.caller.app,resource:'media',get destination(){return destination;}}],dispatch:caller=>libraries.bind(caller)});
 const source={...mediaSource,async resolve(...args){const document=await mediaSource.resolve(...args);return document&&unsafeURL?{...document,url:unsafeURL}:document;}};
 libraries=await initializeHost({root:f.root,adapters:{wydsearch:{source}}});
 const caller=extra=>new ExecutionContext({...f.editor,capabilities:[...f.editor.capabilities,'search.documents.index','search.documents.read'],scopes:{...f.editor.scopes,wydsearch:[{index:'site',resources:['media']}]},...extra});
 const invoke=(op,input,c=caller())=>libraries.bind(c).invoke('wydsearch','1.0.0',op,{index:'site',...input});
 const form=new FormData();form.append('file',new Blob([png]),'image.png');form.append('title','Needle <b>image</b>');form.append('description','Searchable media metadata');
 const request=new Request('http://localhost',{method:'POST',body:form});
 const uploaded=JSON.parse((await libraries.transfer(f.caller,'wydstream','create-upload',{resource:'media'},{method:'POST',body:request.body,headers:{type:request.headers.get('content-type'),encoding:'identity'},authorize:async()=>{}})).body).value;
 assert.equal(await source.resolve('site',uploaded.id,caller()),null);
 assert.equal((await invoke('index',{id:uploaded.id})).code,'SEARCH.DENIED');
 let item=uploaded;
 const visibility=async value=>{const r=await libraries.bind(f.editor).invoke('wydstream','1.0.0','update',{resource:'media',id:item.id,revision:item.revision,metadata:{visibility:value}});assert.equal(r.ok,true,JSON.stringify(r));item=r.value;};
 await visibility('public');
 const extracted=await source.resolve('site',item.id,caller());assert.equal(extracted.url,'/?view=gallery&media='+item.id);
 assert.equal((await invoke('index',{id:item.id})).ok,true);
 for(const url of ['//evil.test/','javascript:alert(1)','/a?x=%2f','/a?x=%252f','/a?x=%00']){unsafeURL=url;assert.equal((await invoke('index',{id:item.id})).code,'SEARCH.INVALID_DOCUMENT');}unsafeURL=undefined;
 const anonymous=caller({identity:null});
 let found=await invoke('search',{query:'needle metadata'},anonymous);assert.equal(found.ok,true,JSON.stringify(found));assert.equal(found.value.total,1);assert.equal(found.value.results[0].url,extracted.url);
 for(const extra of [{capabilities:['search.documents.index']},{scopes:{wydsearch:[{index:'site',resources:['media']}]}},{principal:'foreign'},{scopes:{...f.editor.scopes,wydsearch:[{index:'site',resources:['other']}]}}])assert.equal((await invoke('index',{id:item.id},caller(extra))).ok,false);
 const app=await createHostApp({root:f.root,execution:{gateContext:f.gateContext},libraryAdapters:{wydsearch:{source}}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.closeAllConnections();await app.shutdown(server);});const base='http://127.0.0.1:'+server.address().port;
 const render=result=>renderComponent({id:'results',index:'site',queryParameter:'q',pageSize:10,showType:true,showSnippet:true,emptyMessage:'Empty',noResultsMessage:'None',presentation:definitions.find(d=>d.id==='divdev/search-results').presentation},{state:'ready',value:{...result.value,query:'needle metadata'}},{q:['needle metadata']},'/search/',escapeHtml);
 const rendered=render(found),view=html(rendered);assert.equal(view('b').length,0);assert.match(rendered,/&amp;media=/);const href=view('.wyd-search-list a').attr('href');assert.equal(href,extracted.url);
 const playerResponse=await fetch(base+href);assert.equal(playerResponse.status,200);const player=html(await playerResponse.text());assert.equal(player('#wydmedia-player img').length,1);const delivery=player('#wydmedia-player img').attr('src');assert.ok(delivery);
 const bytes=await fetch(base+delivery);assert.equal(bytes.status,200);assert.deepEqual(Buffer.from(await bytes.arrayBuffer()),png);
 // The supplied gallery delivery binding also consumes the media query field.
 destination='/_transfer/wydstream/get-delivery/home/wydmedia-gallery?view=gallery';
 assert.equal((await invoke('search',{query:'needle'},anonymous)).value.total,0); // changed URL invalidates stale content
 assert.equal((await invoke('index',{id:item.id})).ok,true);
 found=await invoke('search',{query:'needle'},anonymous);const direct=html(render(found))('.wyd-search-list a').attr('href');assert.equal(direct,destination+'&media='+item.id);
 const delivered=await fetch(base+direct);assert.equal(delivered.status,200);assert.deepEqual(Buffer.from(await delivered.arrayBuffer()),png);
 await visibility('authenticated');assert.equal((await invoke('search',{query:'needle'},anonymous)).value.total,0);assert.equal((await invoke('search',{query:'needle'})).value.total,0);assert.equal((await invoke('index',{id:item.id})).ok,true);assert.equal((await invoke('search',{query:'needle'})).value.total,1);assert.equal((await invoke('search',{query:'needle'},anonymous)).value.total,0);
 const expired=caller({identity:{...f.identity,createdAt:0,expiresAt:1}});assert.equal((await invoke('search',{query:'needle'},expired)).value.total,0);assert.equal((await fetch(base+direct)).status,403);const authenticated=await fetch(base+direct,{headers:{Cookie:'__Host-wydgit-auth='+f.token}});assert.equal(authenticated.status,200);await authenticated.arrayBuffer();
 await visibility('private');assert.equal((await invoke('search',{query:'needle'})).value.total,0);assert.equal(await source.resolve('site',item.id,caller()),null);
});

test('shared destination contract preserves queries, encodes once and rejects unsafe forms',()=>{
 assert.equal(destinationWithParameter('/player/?view=gallery&media=old','media','m-abc'),'/player/?view=gallery&media=m-abc');
 assert.equal(destinationWithParameter('/player/','label','café image'),'/player/?label=caf%C3%A9+image');
 for(const url of ['javascript:alert(1)','https://evil.test/','//evil.test/','/a\\b','/a\n','/%2fattack','/a?x=%2f','/a?x=%5c','/a?x=%00','/a?x=%252f','/a?x=%26','/a?x=%3f','/a?x=%23','/a?x=%3a','/a?x=%','/a?x=%ff','/a?x=1&x=2','/a?x=1#fragment','/a?x=1?y=2'])assert.equal(safeDestination(url),false,url);
});
