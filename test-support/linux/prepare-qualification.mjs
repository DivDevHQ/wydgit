// Unprivileged build step. Never installs dependencies or executes npm as root.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const destination=process.argv[2],tarballs=process.argv.slice(3,5),caddy=process.argv[5];
if(!destination?.startsWith('/tmp/')||tarballs.length!==2||process.argv.length>6)throw Error('Usage: node prepare-qualification.mjs /tmp/NEW-DIRECTORY wydgine.tgz wydhosting.tgz [verified-caddy-binary]');
await fs.mkdir(destination);const release=path.join(destination,'release');await fs.mkdir(release);
await fs.writeFile(path.join(release,'package.json'),JSON.stringify({private:true,type:'module'}));
function run(exe,args,cwd){const r=spawnSync(exe,args,{cwd,encoding:'utf8',timeout:180000});if(r.status!==0)throw Error(r.stdout+r.stderr);}
run('npm',['install','--ignore-scripts','--no-audit','--no-fund',...tarballs.map(p=>path.resolve(p))],release);
// The release verifier deliberately refuses every symlink, including npm bin links.
await fs.rm(path.join(release,'node_modules/.bin'),{recursive:true,force:true});
for(const dir of ['bin','lib'])await fs.mkdir(path.join(release,dir));
await fs.copyFile(process.execPath,path.join(release,'bin/node'));await fs.chmod(path.join(release,'bin/node'),0o755);
run('cc',['-shared','-fPIC','-Wall','-Wextra','-Werror','-I/usr/include/node',path.join(release,'node_modules/wydgine/native/peercred.c'),'-o',path.join(release,'lib/peercred.node')]);
if(caddy){
 await fs.copyFile(caddy,path.join(release,'bin/caddy'));
 const proxy=path.join(destination,'proxy');await fs.mkdir(proxy);
 run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=a.localhost','-addext','subjectAltName=DNS:a.localhost,DNS:b.localhost','-keyout',path.join(proxy,'edge.key'),'-out',path.join(proxy,'edge.crt')]);
}
const {fingerprintApprovedApp}=await import(pathToFileURL(path.join(release,'node_modules/wydgine/src/trusted/deployment.js')));
const {describeDeployment}=await import(pathToFileURL(path.join(release,'node_modules/wydhosting/src/platform/linux/plan.js')));
const app=path.join(destination,'app');await fs.mkdir(app);
for(const name of ['content','prototypes','public'])await fs.cp(name,path.join(app,name),{recursive:true});
await fs.writeFile(path.join(app,'wydgit.config.json'),JSON.stringify({schema:'wydgit.host/0.1',libraries:[]}));
await fs.writeFile(path.join(destination,'app-description.json'),JSON.stringify({snapshot:await fingerprintApprovedApp(app),descriptor:await describeDeployment(app)}));
const hashes={};async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(entry.isFile())hashes[path.relative(destination,file)]=createHash('sha256').update(await fs.readFile(file)).digest('hex');else throw Error('Nonregular build entry: '+file);}}
await walk(destination);await fs.writeFile(path.join(destination,'sha256.json'),JSON.stringify(hashes,null,2));
console.log(destination);
