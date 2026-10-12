// Trusted, disposable host demonstration. Never included in portable package resources.
// Run from the repository root: node examples/media/demo.js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {load} from 'cheerio';
import {mediaFixture,png} from '../../test-support/wydstream.js';
import {createHostApp} from '../../app.js';
const cleanup=[];
try {
 const f=await mediaFixture({after:work=>cleanup.push(work)},'JSON',true,true);
 const app=await createHostApp({root:f.root,execution:{gateContext:f.gateContext}}),server=app.listen(0,'127.0.0.1');
 await once(server,'listening');cleanup.push(()=>app.shutdown(server));
 const base='http://127.0.0.1:'+server.address().port,headers={Cookie:'__Host-wydgit-auth='+f.token};
 const page=load(await(await fetch(base+'/',{headers})).text()),action=page('#wydmedia-upload').attr('action');assert.ok(action);
 const samples=[['image.png',png],['tone.wav',await readFile(new URL('../../test-support/media/tone.wav',import.meta.url))]];
 for(const [name,bytes] of samples){
  const form=new FormData();form.append('file',new Blob([bytes]),name);form.append('title',name);
  const response=await fetch(base+action,{method:'POST',headers:{...headers,'X-Wydgit-File-Size':String(bytes.length)},body:form});const uploaded=await response.json();assert.equal(response.status,200,JSON.stringify(uploaded));
  const gallery=load(await(await fetch(base+'/',{headers})).text());assert.match(gallery('#wydmedia-gallery').text(),new RegExp(name.replace('.','\\.')));
  const player=load(await(await fetch(base+'/?media='+uploaded.value.id,{headers})).text());
  const href=player('#wydmedia-player a').attr('href');assert.ok(href);
  const range=await fetch(base+href,{headers:{...headers,Range:'bytes=0-15'}});assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(0,16));
  assert.equal((await fetch(base+href)).status,403);
  console.log(`${name}: uploaded through WydFiles; gallery/player rendered; bytes=0-15 returned 206; anonymous delivery denied (403).`);
 }
 console.log('Local media demonstration passed. Temporary App and storage removed.');
} finally {for(const work of cleanup.reverse())await work();}
