import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { check } from './data.js';

export async function safeRoot(root) {
  check(typeof root === 'string' && path.isAbsolute(root) && path.normalize(root) === root && root !== path.parse(root).root, 'STORE.INVALID_CONFIG');
  let current = path.parse(root).root;
  for (const segment of root.slice(current.length).split(path.sep)) {
    current = path.join(current, segment);
    const info = await lstat(current);
    check(info.isDirectory() && !info.isSymbolicLink(), 'STORE.INVALID_CONFIG');
  }
  check(await realpath(root) === root, 'STORE.INVALID_CONFIG');
}
