#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRegistry} from '../src/registry.js';
import {safePath} from '../src/adapter.js';
import {check,fail,validateRegistry} from '../src/contracts.js';

export async function run(args){
 const [command,...rest]=args;check(['inspect','validate','plan','apply','reconcile'].includes(command),'HOSTING.USAGE');const options={};
 for(let i=0;i<rest.length;i+=2){check(['--directory','--fixture-root','--input','--plan','--approve'].includes(rest[i])&&rest[i+1]&&!rest[i+1].startsWith('--')&&!Object.hasOwn(options,rest[i]),'HOSTING.USAGE');options[rest[i]]=rest[i+1];}
 check(options['--directory'],'HOSTING.USAGE');
 const allowed=command==='apply'?['--directory','--fixture-root','--input','--plan','--approve']:['plan','reconcile'].includes(command)?['--directory','--fixture-root','--input']:[ '--directory','--fixture-root'];check(Object.keys(options).every(k=>allowed.includes(k)),'HOSTING.USAGE');
 const registry=createRegistry({directory:path.resolve(options['--directory']),fixtureRoot:options['--fixture-root']?path.resolve(options['--fixture-root']):undefined,authorize:p=>{check(options['--approve']===p.digest,'HOSTING.UNAUTHORIZED');return 'local-operator';}});
 let input;if(options['--input']){const file=path.resolve(options['--input']);await safePath(file);const s=await fs.stat(file);check(s.isFile()&&s.size<=4*1024*1024);input=JSON.parse(await fs.readFile(file,'utf8'));}
 if(command==='inspect'){const {registry:r,generation}=await registry.inspect();validateRegistry(r);return {schema:r.schema,revision:r.revision,generation,counts:Object.fromEntries(['customers','plans','accounts','pools','apps','domains'].map(k=>[k,r[k].length])),productionReady:false};}
 if(command==='validate')return registry.validate();
 if(command==='plan'){check(input,'HOSTING.USAGE');return registry.plan(input);}
 if(command==='apply'){check(input&&options['--plan']===input.operationId&&options['--approve'],'HOSTING.USAGE');return registry.apply(input);}
 return registry.reconcile(input??null);
}
const entry=process.argv[1]?await fs.realpath(process.argv[1]).catch(()=>null):null;
if(entry===fileURLToPath(import.meta.url))run(process.argv.slice(2)).then(value=>process.stdout.write(JSON.stringify(value,null,2)+'\n')).catch(e=>{const code=e.code?.startsWith('HOSTING.')?e.code:fail().code;process.stderr.write(JSON.stringify({ok:false,code,message:'Provider operation refused'})+'\n');process.exitCode=1;});
