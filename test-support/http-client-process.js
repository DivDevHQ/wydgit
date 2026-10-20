// Test infrastructure only. Fixed Node entry point, no shell or user command.
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('./http-contact-client-child.mjs',import.meta.url));
const failure=code=>Object.assign(new Error(code),{code});

export function validateClientResult(value,concurrency) {
  const keys=(v,names)=>assert.deepEqual(Object.keys(v).sort(),names.sort());
  const record=v=>{
    keys(v,['start','end','status','outcome','complete','timedOut','bytes','contactAcknowledged']);
    for(const key of ['start','end','bytes'])assert.ok(Number.isFinite(v[key])&&v[key]>=0);
    assert.ok(v.end>=v.start);assert.ok(v.status===null||Number.isInteger(v.status)&&v.status>=100&&v.status<=599);
    assert.ok([null,'committed','not-committed','indeterminate'].includes(v.outcome));
    for(const key of ['complete','timedOut','contactAcknowledged'])assert.equal(typeof v[key],'boolean');
  };
  keys(value,['setup','requests']);record(value.setup);assert.equal(value.requests.length,concurrency);
  value.requests.forEach((v,i)=>{keys(v,['index','client']);assert.equal(v.index,i+1);record(v.client);});
  return value;
}

export async function runSeparateClient(configuration,{signal,startupMs=5000,executionMs=25000,shutdownMs=1000,launch=fork,onSpawn=()=>{}}={}) {
  assert.ok(Number.isInteger(configuration.port)&&configuration.port>0&&configuration.port<=65535);
  assert.ok([1,2,4,8,12].includes(configuration.concurrency));
  assert.ok([0,20].includes(configuration.admissionSpacingMs));
  if(signal?.aborted)throw failure('CLIENT.CANCELLED');
  return new Promise((resolve,reject)=>{
    let child,timer,killTimer,reapTimer,reason,result,ready=false,closed=false,stderrBytes=0;
    const stop=code=>{
      reason??=code;if(closed)return;
      clearTimeout(timer);child?.kill('SIGTERM');
      if(!killTimer)killTimer=setTimeout(()=>child?.kill('SIGKILL'),shutdownMs);
      if(!reapTimer)reapTimer=setTimeout(()=>finish(failure('CLIENT.REAP')),shutdownMs+5000);
    };
    const cancel=()=>stop('CLIENT.CANCELLED');
    const finish=error=>{
      clearTimeout(timer);clearTimeout(killTimer);clearTimeout(reapTimer);
      signal?.removeEventListener('abort',cancel);process.off('SIGTERM',cancel);process.off('SIGINT',cancel);
      if(error)reject(error);else resolve({...result,supervision:{exitCode:0,reaped:true,stderrBytes}});
    };
    try {child=launch(entry,[],{stdio:['ignore','ignore','pipe','ipc'],serialization:'json',execArgv:[],env:{LANG:'C.UTF-8'}});}
    catch{finish(failure('CLIENT.SPAWN'));return;}
    timer=setTimeout(()=>stop('CLIENT.STARTUP_TIMEOUT'),startupMs);
    signal?.addEventListener('abort',cancel,{once:true});process.on('SIGTERM',cancel);process.on('SIGINT',cancel);
    child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;if(stderrBytes>8192)stop('CLIENT.OUTPUT_BOUND');});
    child.on('error',()=>stop('CLIENT.SPAWN'));
    child.on('message',message=>{
      try{
        if(!ready){assert.deepEqual(message,{type:'ready'});ready=true;clearTimeout(timer);
          timer=setTimeout(()=>stop('CLIENT.TIMEOUT'),executionMs);
          child.send({type:'run',configuration:{port:configuration.port,concurrency:configuration.concurrency,admissionSpacingMs:configuration.admissionSpacingMs}},error=>{if(error)stop('CLIENT.PROTOCOL');});
        }else{assert.ok(!result);assert.equal(JSON.stringify(message).length<=32768,true);
          result=validateClientResult(message,configuration.concurrency);}
      }catch{stop('CLIENT.PROTOCOL');}
    });
    child.once('close',(code)=>{closed=true;finish(reason?failure(reason):code!==0?failure('CLIENT.EXIT'):!result?failure('CLIENT.PROTOCOL'):null);});
    onSpawn(child);
    if(signal?.aborted)cancel();
  });
}
