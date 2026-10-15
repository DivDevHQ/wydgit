// Trusted local demonstration: exclusive stopped JSON resources, no live migration.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createOperationalHost} from '../../wydgine/operations.js';
import {restoreLocalApp} from '../../wydgine/relocation.js';
import {createMultiAppHost} from '../../wydgine/multi-app.js';
import {provisionHostnameExample} from '../hostname-host/setup.js';
import {installTaskboards} from '../hostname-host/taskboards.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-relocation-demo-'));let a,b;
try{
 const source=path.join(root,'host-a'),destination=path.join(root,'host-b');await fs.mkdir(source);await fs.mkdir(destination);
 const inventory=await provisionHostnameExample(source),execution=await installTaskboards(source);
 a=await createOperationalHost({schema:'wydgit.operations/0.1',inventory,optional:[]},{root:source,execution});await a.start(0,'127.0.0.1');
 const old=a.controller.select('app-alpha');await a.controller.stop(old);const snapshot=path.join(root,'snapshot');await a.controller.snapshotApp('app-alpha',snapshot);
 const verifiedPackages={'divdev/wbasic-taskboard':'divdev'};const entry=await restoreLocalApp(snapshot,{root:destination,directory:'alpha',app:'app-alpha',verifiedPackages});
 // Destination provisioning supplies dependencies; executable dependencies never travel in a snapshot.
 await fs.symlink(fileURLToPath(new URL('../../node_modules',import.meta.url)),path.join(destination,'alpha/node_modules'),'dir');
 const routing={schema:'wydgit.routing/0.1',transport:{mode:'local-http'},routes:[{hostname:'alpha.localhost',app:'app-alpha',state:'active',approval:'local-development'}],unknown:{policy:'reject'}};
 b=await createMultiAppHost({schema:'wydgit.multi-host/0.1',apps:[entry],routing},{root:destination,execution:{'app-alpha':{verifiedPackages}}});await b.activate('app-alpha');const server=await b.listenShared(0,'127.0.0.1');
 const response=await new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port:server.address().port,headers:{Host:'alpha.localhost'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));}).on('error',reject));if(response.status!==200||!response.body.includes('Verify lifecycle cleanup'))throw Error('Relocation execution failed');
 console.log('Stopped App restored and installed WBasic executed under newly approved destination routing.');
}finally{try{await a?.shutdown();}finally{try{await b?.dispose();}finally{await fs.rm(root,{recursive:true,force:true});}}}
