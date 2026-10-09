import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import platform from '../package.json' with { type: 'json' };
import { loadLibraries } from './libraries/index.js';
import { WydgitError } from './object-model/validation.js';

export async function initializeHost({ root, lifecycle }) {
  if(existsSync(path.join(root,'content/.package-infrastructure.json')))throw new WydgitError('PACKAGE.RECOVERY','Interrupted infrastructure install; recover saved host state before startup');
  const read = async (relative, code) => {
    try { return await readFile(path.join(root, relative), 'utf8'); }
    catch { throw new WydgitError(code, 'Required host initialization document could not be read'); }
  };
  const config = await read('wydgit.config.json', 'LIBRARY.INVALID_CONFIG');
  const requirements = await read('content/requirements.json', 'LIBRARY.INVALID_REQUIREMENTS');
  return loadLibraries({ config, requirements, root, platformVersion: platform.version, lifecycle });
}
