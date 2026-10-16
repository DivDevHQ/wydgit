// Development-only packaging mirror; runtime never reads the repository docs tree.
import fs from 'node:fs/promises';
import path from 'node:path';
const source='docs/milestones/0.3-I5.6',destination='packages/wydhosting/docs';
await fs.mkdir(destination,{recursive:true});
for(const name of await fs.readdir(source))if(name.endsWith('.md'))await fs.copyFile(path.join(source,name),path.join(destination,name));
