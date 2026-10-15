import {ensure,error} from './config.js';

// One small bounded line buffer; no readline history or terminal dependencies.
export function createTerminal(input=process.stdin,output=process.stdout){
 let buffer='',lines=[],waiter,ended=false,failed=false;
 const deliver=()=>{if(waiter&&(lines.length||ended||failed)){const w=waiter;waiter=null;failed?w.reject(error('LAUNCH.INPUT_LIMIT','Terminal input limit exceeded')):w.resolve(lines.length?lines.shift():null);}};
 const data=chunk=>{
  buffer+=chunk.toString('utf8');
  if(buffer.length>4096||lines.length>32){failed=true;input.pause();deliver();return;}
  let at;while((at=buffer.indexOf('\n'))!==-1){lines.push(buffer.slice(0,at).replace(/\r$/,''));buffer=buffer.slice(at+1);if(lines.length>32){failed=true;break;}}deliver();
 };
 const end=()=>{ended=true;if(buffer){lines.push(buffer);buffer='';}deliver();};
 input.setEncoding('utf8');input.on('data',data);input.on('end',end);input.on('error',end);input.resume();
 return {write:text=>output.write(text),async ask(prompt){output.write(prompt);ensure(!waiter,'LAUNCH.INPUT','Concurrent prompts are unsupported');if(failed)throw error('LAUNCH.INPUT_LIMIT','Terminal input limit exceeded');if(lines.length)return lines.shift();if(ended)return null;return new Promise((resolve,reject)=>{waiter={resolve,reject};});},close(){input.off('data',data);input.off('end',end);input.off('error',end);input.pause();}};
}
export async function confirm(terminal,prompt){const answer=await terminal.ask(prompt+' [y/N]: ');return answer!==null&&/^y(es)?$/i.test(answer.trim());}
