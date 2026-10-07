import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensure, version, satisfies } from './contracts.js';
import { WydgitError } from '../object-model/validation.js';

// Called only with validated, host-approved config entries. There is no scan or
// fallback. Package exports must expose "." and "./package.json".
export async function importNodePackage(entry, root) {
  const require = createRequire(resolve(root, 'package.json'));
  let metadataPath, entryPath;
  try {
    metadataPath = require.resolve(`${entry.package}/package.json`);
    entryPath = require.resolve(entry.package);
  } catch {
    throw new WydgitError('LIBRARY.NOT_INSTALLED', 'Configured package is not resolvable');
  }
  let metadata;
  try { metadata = JSON.parse(await readFile(metadataPath, 'utf8')); }
  catch { throw new WydgitError('LIBRARY.INVALID_MANIFEST', 'Unreadable implementation package metadata'); }
  ensure(metadata?.name === entry.package && version(metadata?.version), 'LIBRARY.INVALID_MANIFEST', 'Invalid implementation package identity');
  ensure(satisfies(metadata.version, entry.version), 'LIBRARY.VERSION_MISMATCH', 'Installed package is outside the host-approved version range');
  let module;
  try { module = await import(pathToFileURL(entryPath).href); }
  catch { throw new WydgitError('LIBRARY.IMPORT_FAILED', 'Configured package could not be imported'); }
  return { module, packageVersion: metadata.version };
}
