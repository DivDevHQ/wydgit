// Standalone trusted host demo. Run: node examples/wydfiles/index.js
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {loadLibraries} from '../../wydgine/libraries/index.js';
import {ExecutionContext} from '../../wydgine/seam/context.js';
import platform from '../../package.json' with {type:'json'};
const base=await mkdtemp(path.join(os.tmpdir(),'wydfiles-demo-'));
try{
 await mkdir(path.join(base,'files'));await mkdir(path.join(base,'media'));
 const actions=['read','write','delete','list'];
 const options={schema:'wydfiles.host/1.0',apps:[{app:'demo',mounts:[{path:'/',provider:'local',root:path.join(base,'files'),permissions:actions},{path:'/media',provider:'local',root:path.join(base,'media'),permissions:actions}],grants:[{publisher:'demo',package:'demo/files',principal:'demo/files',installation:'receipt-demo',path:'/',actions}]}]};
 const registry=await loadLibraries({root:path.resolve(import.meta.dirname,'../..'),platformVersion:platform.version,config:{schema:'wydgit.host/0.1',libraries:[{id:'wydfiles',package:'@wydgit/files',enabled:true,version:'^0.1.0-alpha.1',publisher:'wydgit.core',trust:'canonical',options}]}});
 const context=new ExecutionContext({context:'FrontEnd',app:'demo',publisher:'demo',package:'demo/files',principal:'demo/files',installation:'receipt-demo',self:'page',capabilities:actions.map(a=>'files.storage.'+a),scopes:{wydfiles:[{path:'/'}]}});
 for(const p of ['/documents.txt','/media/example.txt'])await registry.transfer(context,'wydfiles','write',{path:p,size:5},{method:'POST',authorize:async()=>{},body:Readable.from([Buffer.from('hello')])});
 console.log(JSON.stringify(await registry.bind(context).invoke('wydfiles','1.0.0','list',{path:'/'}),null,2));
}finally{await rm(base,{recursive:true,force:true});}
