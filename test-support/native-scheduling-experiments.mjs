// Fixed independent Spike L experiments; no Contact workload or failure search.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile);
export function isolatedSyscalls(text,value){
  const rows=[],pending=new Map();let unmatched=0;
  for(let line of text.split('\n')){
    const unfinished=/^(\d+)\s+.*<unfinished \.\.\.>$/.exec(line);
    if(unfinished){pending.set(unfinished[1],line.replace(/<unfinished \.\.\.>$/,''));continue;}
    const resumed=/^(\d+)\s+\d+\.\d+ <\.\.\. (?:statx|newfstatat) resumed>(.*)$/.exec(line);
    if(resumed){const prefix=pending.get(resumed[1]);pending.delete(resumed[1]);if(!prefix){unmatched++;continue;}line=prefix+resumed[2];}
    const match=/^\d+\s+(\d+\.\d+) (?:statx|newfstatat)\(.*?"[^"]*\/spikef-(\d+)\.lifecycle".*?= -1 ENOENT .* <([\d.]+)>$/.exec(line);
    if(!match)continue;
    const request=Number(match[2]),call=value.probe.calls.find(c=>c.request===request),resource=call?.resources[0];
    const startMs=Number(match[1])*1000-value.clock.timeOriginMs,durationMs=Number(match[3])*1000;
    rows.push({request,startMs,durationMs,approximateSyscallEndToCallbackMs:resource?resource.firstBeforeMs-startMs-durationMs:null,
      initToCallbackMs:resource?resource.firstBeforeMs-resource.initMs:null});
  }
  return {clock:'strace realtime bridged by performance.timeOrigin: approximate order/delivery interval only; syscall duration is strace -T elapsed',unmatched:unmatched+pending.size,rows};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const directory=process.argv[2];if(!directory)throw Error('Usage: native-scheduling-experiments.mjs NEW_DIRECTORY');await fs.mkdir(directory,{recursive:false});
  const options={timeout:45000,maxBuffer:8*1024*1024};
  for(let round=1;round<=3;round++){
    for(const mode of round%2?['spin120','spin1100','microtasks','workflow']:['workflow','microtasks','spin1100','spin120']){
      const {stdout,stderr}=await exec(process.execPath,['test-support/native-scheduling-contention.mjs',mode],options);
      await fs.writeFile(path.join(directory,`contention-${mode}-${round}.json`),JSON.stringify({exitCode:0,value:JSON.parse(stdout),stderr})+'\n');
    }
    for(const pressureMs of round%2?[0,120]:[120,0]){
      const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-spikel-syscall-'));
      try{
        const trace=path.join(scratch,'trace');
        const {stdout,stderr}=await exec('strace',['-f','-qq','-ttt','-T','-s','4096','-e','trace=statx,newfstatat','-o',trace,process.execPath,
          'test-support/scheduling-attribution-probe.mjs','--worker',JSON.stringify({kind:'isolated',concurrency:12,scheduling:true,pressureMs,generation:round})],options);
        const value=JSON.parse(stdout);value.syscallEvidence=isolatedSyscalls(await fs.readFile(trace,'utf8'),value);
        if(value.syscallEvidence.rows.length!==12)throw Error('Incomplete syscall correlation');
        await fs.writeFile(path.join(directory,`isolated-${pressureMs}-${round}.json`),JSON.stringify({exitCode:0,value,stderr})+'\n');
      }finally{await fs.rm(scratch,{recursive:true,force:true});}
    }
    const {stdout,stderr}=await exec(process.execPath,['test-support/native-scheduling-calibration.mjs'],options);
    await fs.writeFile(path.join(directory,`calibration-${round}.json`),JSON.stringify({exitCode:0,value:JSON.parse(stdout),stderr})+'\n');
  }
}
