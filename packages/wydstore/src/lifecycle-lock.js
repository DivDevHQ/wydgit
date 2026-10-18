// Internal host lifecycle barrier. No canonical request can bypass it.
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { check } from './data.js';
export async function checkLifecycleLock(root, name, lifecycle = false) {
  if (lifecycle) return;
  const marker = await lstat(path.join(root, name + '.lifecycle')).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  check(!marker, 'STORE.BUSY');
}
