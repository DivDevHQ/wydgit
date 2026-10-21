// Disposable human-review environment. Native provisioning/operator controls stay
// in this local process; no operator command is exposed over HTTP or to packages.
import {createInterface} from 'node:readline';
import {b6Fixture} from '../test-support/backoffice-b6.js';
import {b5Http} from '../test-support/backoffice-b5.js';
const provider=process.argv[2]??'json';if(!['json','sqlite'].includes(provider))throw Error('Choose json or sqlite');
const cleanup=[],f=await b6Fixture({after:fn=>cleanup.push(fn)},provider),h=await b5Http({after:fn=>cleanup.push(fn)},f);
console.log(`Disposable ${provider} App: ${h.base}/sign-in/\nWorkspace: ${h.base}/backoffice/pages/workspace\nUsername: alice\nDisposable password: ${f.password}\nLocal operator commands: deny-write, deny-read, deny-page, allow, expire, quit. Do not include passwords in AT evidence.`);
const realNow=Date.now,rl=createInterface({input:process.stdin,output:process.stdout});let closing=false;
async function close(){if(closing)return;closing=true;Date.now=realNow;rl.close();for(const fn of cleanup.reverse())await fn();process.stdin.destroy();}
rl.on('line',async line=>{try{switch(line.trim()){
 case 'deny-write':await f.grant(f.permissions.filter(p=>p!=='content.workspace.write'));break;
 case 'deny-read':await f.grant(f.permissions.filter(p=>p!=='content.workspace.read'));break;
 case 'deny-page':await f.grant(f.permissions.filter(p=>p!=='content.pages.view'));break;
 case 'allow':Date.now=realNow;await f.grant(f.permissions);break;
 case 'expire':Date.now=()=>realNow()+86400001;break;
 case 'quit':await close();return;
 default:console.log('Use deny-write, deny-read, deny-page, allow, expire or quit.');return;
 }console.log('Disposable operator state changed.');}catch(e){console.log('Operator command failed: '+(e.code??'ERROR'));}});
rl.on('close',()=>{void close();});process.once('SIGINT',()=>{void close();});process.once('SIGTERM',()=>{void close();});
