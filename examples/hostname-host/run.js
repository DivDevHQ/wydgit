import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createMultiAppHost} from '../../wydgine/multi-app.js';
import {provisionHostnameExample} from './setup.js';
import {installTaskboards} from './taskboards.js';
const root=await fs.mkdtemp(path.join(tmpdir(),'wyd-hostnames-'));let host,closing;
const stop=()=>closing??=(async()=>{try{await host?.dispose();}finally{await fs.rm(root,{recursive:true,force:true});}})();
try{
 const inventory=await provisionHostnameExample(root),execution=await installTaskboards(root);
 host=await createMultiAppHost(inventory,{root,execution});for(const app of inventory.apps)await host.activate(app.id);
 const server=await host.listenShared(0,'127.0.0.1'),port=server.address().port;
 for(const name of ['alpha.localhost','beta.localhost','soon.localhost','parked.localhost','new.sites.example.localhost'])console.log(`http://${name}:${port}/`);
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop().catch(()=>{process.exitCode=1;}));
}catch(error){await stop();throw error;}
