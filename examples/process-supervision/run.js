import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createSupervisor} from 'wydhosting';
import {provisionPools} from './setup.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-process-demo-'));
let supervisor;
try{
 const fixture=await provisionPools(root);supervisor=await createSupervisor(fixture);
 const shared=await supervisor.startPool('shared',{execution:fixture.execution}),dedicated=await supervisor.startPool('dedicated');
 for(const [worker,hostname] of [[shared,'alpha.localhost'],[shared,'beta.localhost'],[dedicated,'gamma.localhost']]){
  await new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port:worker.port,headers:{Host:hostname},timeout:5000},r=>{r.resume();r.on('end',()=>r.statusCode===200?resolve():reject(Error('HTTP fixture failed')));}).on('error',reject).on('timeout',function(){this.destroy(Error('HTTP deadline'));});});
 }
 console.log(JSON.stringify(supervisor.health(),null,2));
}finally{await supervisor?.shutdown();await fs.rm(root,{recursive:true,force:true});}
