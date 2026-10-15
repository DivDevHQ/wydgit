import fs from 'node:fs/promises';
import path from 'node:path';
import {createOperationalHost} from '../../wydgine/operations.js';
import {provisionHostnameExample} from '../hostname-host/setup.js';
import {installTaskboards} from '../hostname-host/taskboards.js';
const root=path.resolve(process.argv[3]??'.hosting-local');
if(process.argv[2]==='init'){
 await fs.mkdir(root);const inventory=await provisionHostnameExample(root);await installTaskboards(root);
 inventory.apps[0].resources={maxPending:4,payloadBytes:100000000};inventory.apps[1].resources={maxPending:8,payloadBytes:200000000};
 await fs.writeFile(path.join(root,'operations.json'),JSON.stringify({schema:'wydgit.operations/0.1',inventory,optional:[]},null,2)+'\n');
 console.log('Provisioned local hosting profile');
}else if(process.argv[2]==='start'){
 const policy=JSON.parse(await fs.readFile(path.join(root,'operations.json'),'utf8'));
 const execution=Object.fromEntries(['app-alpha','app-beta'].map(id=>[id,{verifiedPackages:{'divdev/wbasic-taskboard':'divdev'}}]));
 const host=await createOperationalHost(policy,{root,execution});host.signals();
 const port=Number(process.argv[4]??8080);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local port');
 const server=await host.start(port,'127.0.0.1');console.log(JSON.stringify({...host.snapshot(),port:server.address().port}));
}else throw new Error('Usage: node examples/hosting-operations/run.js init|start [root] [port]');
