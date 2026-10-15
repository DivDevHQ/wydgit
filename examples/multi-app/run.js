// Two explicit host-selected loopback listeners. No hostname routing or deployment.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {provisionExample} from './setup.js';
import {createMultiAppHost} from '../../wydgine/multi-app.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'wydgit-two-apps-'));
let host,stopping;
const stop=()=>stopping??=(async()=>{try{await host?.dispose();}finally{await fs.rm(root,{recursive:true,force:true});}})();
try{
 const config=await provisionExample(root);host=await createMultiAppHost(config,{root});
 for(const id of ['app-alpha','app-beta']){const token=await host.activate(id),server=await host.listen(token,0,'127.0.0.1');console.log(`${id}: http://127.0.0.1:${server.address().port}/`);}
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop().catch(()=>{process.exitCode=1;}));
}catch{await stop();console.error('Multi-App example failed');process.exitCode=1;}
