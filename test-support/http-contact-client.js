// Trusted loopback fixture client, identical in both placements. Never exported to Wydgits.
import assert from 'node:assert/strict';
import http from 'node:http';
import {performance} from 'node:perf_hooks';
export const REQUEST_MS=10000;
// Preparation barrier only: never holds Page execution or provider work.
export function createStartBarrier(parties,{timeoutMs=1000}={}) {
  assert.ok(Number.isInteger(parties)&&parties>0&&parties<=12);
  let resolve,reject,arrived=0,done=false;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const timer=setTimeout(()=>{done=true;reject(Object.assign(new Error('Fixture barrier expired'),{code:'FIXTURE.BARRIER'}));},timeoutMs);
  return Object.freeze({
    wait(){assert.ok(!done&&arrived<parties);arrived++;return promise;},
    release(){assert.equal(arrived,parties);if(!done){done=true;clearTimeout(timer);resolve();}},
    cancel(){if(!done){done=true;clearTimeout(timer);reject(Object.assign(new Error('Fixture barrier cancelled'),{code:'FIXTURE.BARRIER'}));}}
  });
}

// Only loopback and a numeric ephemeral port. Errors, headers and bodies are never
// copied wholesale into artifacts. complete requires the actual client end event.
export function loopbackRequest(port,{index=0,body,cookie,agent,timeoutMs=REQUEST_MS}={}) {
  assert.ok(Number.isInteger(port)&&port>0&&port<=65535);
  const start=performance.now();
  return new Promise(resolve=>{
    let ended=false,response,status=null,outcome=null,bytes=0,parts=[];
    const finish=(complete,timedOut=false)=>{
      if(ended)return;ended=true;clearTimeout(timer);
      resolve({start,end:performance.now(),status,outcome,complete,timedOut,bytes,
        // Private transient setup data; the caller explicitly projects artifacts.
        body:complete?Buffer.concat(parts).toString('utf8'):'',cookie:response?.headers['set-cookie']?.[0]?.split(';')[0]??null});
    };
    const req=http.request({hostname:'127.0.0.1',port,path:'/contact/',method:body===undefined?'GET':'POST',agent,
      headers:{'x-fixture-sequence':String(index),...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(body)})}},res=>{
      response=res;status=res.statusCode;
      const header=res.headers['x-wydgit-operation-outcome'];
      outcome=['committed','not-committed','indeterminate'].includes(header)?header:null;
      res.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024){finish(false);res.destroy();req.destroy();}else parts.push(chunk);});
      res.on('end',()=>finish(res.complete));res.on('error',()=>finish(false));res.on('aborted',()=>finish(false));
    });
    const timer=setTimeout(()=>{finish(false,true);response?.destroy();req.destroy();},timeoutMs);
    req.on('error',()=>finish(false));req.end(body);
  });
}

export const clientRecord=value=>({...Object.fromEntries(['start','end','status','outcome','complete','timedOut','bytes'].map(key=>[key,value[key]])),
  contactAcknowledged:value.complete&&/Thank you/.test(value.body)});


export async function runContactClient({port,concurrency,admissionSpacingMs=0}) {
  assert.ok([1,2,4,8,12].includes(concurrency));
  assert.ok([0,20].includes(admissionSpacingMs));
  const agent=new http.Agent({keepAlive:false,maxSockets:12});let barrier;
  try {
    const initial=await loopbackRequest(port,{agent});
    assert.equal(initial.complete,true);assert.equal(initial.status,200);assert.match(initial.body,/Guestbook/);
    assert.doesNotMatch(initial.body,/id="guestbook-entry-/);assert.ok(initial.cookie);
    const csrf=/name="_csrf" value="([^"]+)"/.exec(initial.body)?.[1];assert.ok(csrf);
    const body=new URLSearchParams({_target:'guestbook-form',_action:'Submit',_csrf:csrf,name:'Concurrency fixture',message:'Bounded Contact concurrency experiment'}).toString();
    barrier=createStartBarrier(concurrency);
    const pending=Array.from({length:concurrency},(_,offset)=>(async()=>{
      await barrier.wait();
      if(admissionSpacingMs&&offset)await new Promise(resolve=>setTimeout(resolve,offset*admissionSpacingMs));
      return {index:offset+1,client:clientRecord(await loopbackRequest(port,{index:offset+1,body,cookie:initial.cookie,agent}))};
    })());
    barrier.release();
    return {setup:clientRecord(initial),requests:await Promise.all(pending)};
  }finally{barrier?.cancel();agent.destroy();}
}
