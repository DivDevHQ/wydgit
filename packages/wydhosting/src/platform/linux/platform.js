// The broker and preflight use the same shipped, administrator-protected matrix.
import fs from 'node:fs';
const matrix=JSON.parse(fs.readFileSync(new URL('../../../broker/platforms.json',import.meta.url),'utf8'));
export function inspectPlatform({platform,arch,distro,pid1,controllers,selinux}) {
 const version=distro.VERSION_ID;
 const lane=matrix.candidates.find(x=>x.id===distro.ID&&typeof version==='string'&&(x.match==='exact'?version===x.version:version.match(new RegExp('^'+x.version+'(?:\\.[0-9]+)?$'))?.[0]===version));
 const prerequisites={linux:platform==='linux',architecture:arch==='x64',distribution:!!lane,systemd:pid1==='systemd',controllers:['cpu','memory','pids'].every(x=>controllers.includes(x)),selinux:!lane?.selinuxRequired||selinux==='enforcing'};
 return {lane:lane?{id:lane.id,version:lane.version,family:lane.family,firewall:lane.firewall}:null,selinux,prerequisites,candidate:Object.values(prerequisites).every(Boolean)};
}
