#!/usr/bin/env node
// Keep prerequisites readable even when the checkout has not installed dependencies.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function launch(options){return (await import('./backoffice-human/launcher.js')).launch(options);}
export async function cleanSession(...args){return (await import('./backoffice-human/launcher.js')).cleanSession(...args);}
async function main(){
 const [major,minor]=process.versions.node.split('.').map(Number);
 if(major<24||major===24&&minor<21)throw Error('Use Node 24.21.0 or newer, as required by this repository.');
 try{for(const name of ['hono','@wydgit/gate/client','better-sqlite3','argon2'])import.meta.resolve(name);}
 catch{throw Error('Repository dependencies are missing. Run npm ci once in this checkout, then retry. No sudo is needed.');}
 await (await import('./backoffice-human/launcher.js')).main();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error('Human test environment: '+(e.code??e.message));process.exitCode=1;});
