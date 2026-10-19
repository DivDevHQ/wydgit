import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {packageFixture} from '../test-support/packages.js';
import {createHostApp} from '../app.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {loadRepository} from '../wydgine/repository.js';
import {compile} from '../wydgine/wydbasic/index.js';

for(const resource of ['steps','serviceCalls','timeMs'])test(`HTTPREL: genuine ${resource} exhaustion is classified privately after publication`,async t=>{
 const f=await packageFixture(t),records=[];
 await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify({schema:'wydgit.host/0.1',libraries:[]}));
 const appId=loadRepository(f.root).runtime.rootId;
 let now=Date.now();if(resource==='timeMs')t.mock.method(Date,'now',()=>now);
 const handlers=resource==='serviceCalls'?[{type:'Page.Load',owner:'home',workflow:compile('DIM value AS Object = SERVICES.Call("wydstore","get",{})')}]:resource==='timeMs'?[{type:'Page.Load',owner:'home',run:function(){now+=1001;}}]:[{type:'Page.Load',owner:'home',workflow:compile('RETURN 1')}];
 const app=await createHostApp({root:f.root,logger:{error(){}},execution:{handlers,
  context:({ids,pageId})=>new ExecutionContext({context:'FrontEnd',publisher:'wydgit.core',app:appId,self:pageId,visible:ids,limits:resource==='timeMs'?{}:{[resource==='steps'?'sewnSteps':'sewnServiceCalls']:0}}),
  observeHttp:value=>records.push(value)}});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>app.shutdown(server));
 const response=await fetch(`http://127.0.0.1:${server.address().port}/?private-query=private-value`,{headers:{cookie:'private-cookie=private-value'}}),body=await response.text();
 assert.equal(response.status,500);assert.equal(records.length,1);
 const record=records[0];assert.equal(record.schema,'wydgine.http-diagnostics/1');assert.equal(record.pageAdmitted,true);
 assert.equal(record.failure.code,'SEWN.LIMIT');assert.equal(record.meter.exhaustion.resource,resource);assert.equal(record.meter.exhaustion.limit,resource==='timeMs'?1000:0);
 assert.equal(record.headersPublished,true);assert.equal(record.responseEnded,true);assert.equal(record.services.admitted,0);assert.equal(record.services.nativeStarted,0);assert.equal(record.operationOutcome,'not-committed');
 assert.ok(record.eventLoop.activeMs>=0&&record.eventLoop.idleMs>=0);assert.ok(Object.isFrozen(record)&&Object.isFrozen(record.services));
 assert.ok(JSON.stringify(record).length<10000);assert.doesNotMatch(JSON.stringify(record)+body,/private-value|private-query|private-cookie/);assert.equal(JSON.stringify(record).includes(f.root),false);
 assert.doesNotMatch(body,/diagnostics|exhaustion|timeLimitMs|SEWN.LIMIT/);
});

test('HTTPREL: preadmission rejection and throwing observers preserve sanitized HTTP behavior',async t=>{
 const f=await packageFixture(t),records=[];
 await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify({schema:'wydgit.host/0.1',libraries:[]}));
 const app=await createHostApp({root:f.root,execution:{observeHttp:value=>{records.push(value);throw Error('private-observer');}}});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>app.shutdown(server));const url=`http://127.0.0.1:${server.address().port}/`;
 const rejected=await fetch(url,{headers:{cookie:'theme=a; theme=b'}});assert.equal(rejected.status,400);await rejected.text();
 assert.equal(records.length,1);assert.equal(records[0].pageAdmitted,false);assert.equal(records[0].meter,null);assert.equal(records[0].failure.phase,'session');assert.equal(records[0].operationOutcome,'unknown');
 const success=await fetch(url);assert.equal(success.status,200);assert.doesNotMatch(await success.text(),/private-observer/);assert.equal(records.length,2);assert.equal(records[1].failure,null);assert.equal(records[1].meter.exhaustion,null);
});
