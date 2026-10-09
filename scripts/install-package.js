// Trusted operator tool. Approval JSON is host policy, never package intent.
import fs from 'node:fs/promises';
import path from 'node:path';
import { planPackageInstall, applyPackageInstall } from '../wydgine/packages/index.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
const [packagePath,...args]=process.argv.slice(2),flags={};
for(let i=0;i<args.length;i++){if(args[i]==='--apply')flags.apply=true;else flags[args[i].replace(/^--/,'')]=args[++i];}
if(!packagePath||!flags.approval)throw new Error('Usage: node scripts/install-package.js PACKAGE --approval HOST-POLICY.json [--apply]');
const policy=JSON.parse(await fs.readFile(flags.approval,'utf8'));
const plan=await planPackageInstall({root:path.resolve(flags.root??'.'),packagePath:path.resolve(packagePath),placement:policy.placement,approvals:policy.approvals,storageMappings:policy.storageMappings,installationContext:new ExecutionContext(policy.installationContext)});
console.log(JSON.stringify(plan,null,2));
if(flags.apply)console.log(JSON.stringify(await applyPackageInstall(plan),null,2));
