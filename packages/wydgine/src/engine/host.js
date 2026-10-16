import { readFile } from 'node:fs/promises';
import path from 'node:path';
import platform from '../../package.json' with { type: 'json' };
import { validateConfig } from './libraries/contracts.js';
import { loadLibraries } from './libraries/index.js';
import { WydgitError } from './object-model/validation.js';
import { checkInstallationRecovery } from './packages/state.js';

export async function initializeHost({ root, implementationRoot=root, lifecycle, adapters, app, guard, observe }) {
  checkInstallationRecovery(root);
  const read = async (relative, code) => {
    try { return await readFile(path.join(root, relative), 'utf8'); }
    catch { throw new WydgitError(code, 'Required host initialization document could not be read'); }
  };
  const config = await read('wydgit.config.json', 'LIBRARY.INVALID_CONFIG');
  const requirements = await read('content/requirements.json', 'LIBRARY.INVALID_REQUIREMENTS');
  validateConfig(config);
  return loadLibraries({config,requirements,root,implementationRoot,platformVersion:platform.version,lifecycle,adapters,app,guard,observe});
}
