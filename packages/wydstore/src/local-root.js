import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { check } from './data.js';

export async function safeRoot(root, observation) {
  check(typeof root === 'string' && path.isAbsolute(root) && path.normalize(root) === root && root !== path.parse(root).root, 'STORE.INVALID_CONFIG');
  let current = path.parse(root).root;
  let ordinal=0;
  for (const segment of root.slice(current.length).split(path.sep)) {
    current = path.join(current, segment);
    const filesystem=observation?.filesystem?.('rootLstat',++ordinal);
    let info;
    filesystem?.start();
    try {
      let pending;
      try { pending=lstat(current); } finally { filesystem?.invoked(); }
      info=await pending;
    } finally { filesystem?.resume(); }
    check(info.isDirectory() && !info.isSymbolicLink(), 'STORE.INVALID_CONFIG');
  }
  check(await realpath(root) === root, 'STORE.INVALID_CONFIG');
}
