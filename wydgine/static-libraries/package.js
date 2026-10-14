// Development-directory installation into an authorized build context. This uses
// the existing portable prototype-package envelope and host verification mapping;
// it neither signs packages nor grants runtime capabilities.
import { safeRead } from '../packages/state.js';
import { qualified, LIMITS } from '../packages/manifest.js';
import { fields, version } from '../libraries/contracts.js';
import { clean, freeze, requireThat as check } from '../object-model/validation.js';
import { StaticLibraryRegistry } from './index.js';
const installations=new WeakSet();
export function installStaticLibraryDirectory(directory,{verifiedPackages={},installed=[]}={}) {
  check(Array.isArray(installed)&&installed.length<=64&&installed.every(p=>installations.has(p)),'PACKAGE.STATIC','Expected previously approved directory installations');
  const pkg=clean(JSON.parse(safeRead(directory,'prototypes.json',LIMITS.resource)));
  fields(pkg,['schema','id','publisher','version','prototypes'],'PACKAGE.STATIC');
  check(pkg.schema==='wydgit.prototype-package/0.1'&&qualified(pkg.id)&&pkg.publisher===pkg.id.split('/')[0]&&version(pkg.version),'PACKAGE.STATIC','Invalid static prototype package');
  check(verifiedPackages[pkg.id]===pkg.publisher,'PACKAGE.UNTRUSTED','Host must verify/approve the package publisher');
  check(Array.isArray(pkg.prototypes)&&pkg.prototypes.length>0&&pkg.prototypes.length<=LIMITS.prototypes&&pkg.prototypes.every(d=>d&&d.static===true&&qualified(d.id)&&d.publisher===pkg.publisher&&d.id.startsWith(pkg.publisher+'/')&&d.version===pkg.version),'PACKAGE.STATIC','Invalid static package namespace or version');
  const verifiedPrototypes=Object.fromEntries(pkg.prototypes.map(d=>[d.id,pkg.publisher]));
  const catalog=new Map();
  for(const d of [...installed.flatMap(p=>p.definitions),...pkg.prototypes]){const prior=catalog.get(d.id);check(!prior||JSON.stringify(clean(prior))===JSON.stringify(clean(d)),'PACKAGE.STATIC','Conflicting installed static definition');catalog.set(d.id,d);}
  const definitions=[...catalog.values()];
  const bindings=Object.assign({},...installed.map(p=>p.verifiedPrototypes),verifiedPrototypes);
  const libraries=new StaticLibraryRegistry(definitions,{verifiedPrototypes:bindings});
  const result=freeze({package:pkg.id,version:pkg.version,definitions,verifiedPrototypes:bindings,libraries});installations.add(result);return result;
}
