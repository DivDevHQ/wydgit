// Optional host-only provider, resolved through its approved package export from
// the App installation. Importing Wydgine does not require WydStore or SQLite.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { safeRead } from './state.js';
import { validateConfig } from '../libraries/contracts.js';
import { WydgitError } from '../object-model/validation.js';
export async function storeLifecycle(root) {
  try {
    const mapping=validateConfig(safeRead(root,'wydgit.config.json')).libraries.find(l=>l.id==='wydstore');
    if(mapping?.package!=='@wydgit/store'||mapping.publisher!=='wydgit.core'||mapping.trust!=='canonical')throw Error('Unqualified provider');
    const require=createRequire(path.join(root,'package.json'));
    const provider=await import(pathToFileURL(require.resolve('@wydgit/store/trusted/lifecycle')).href);
    if(provider.lifecycleSchema!=='wydstore.lifecycle/1')throw Error('Unsupported contract');return provider;
  }catch { throw new WydgitError('PACKAGE.STORAGE','The canonical WydStore host checkpoint provider is unavailable'); }
}
