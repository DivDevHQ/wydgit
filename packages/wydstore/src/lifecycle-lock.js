// Internal host lifecycle barrier. No canonical request can bypass it.
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { check } from './data.js';
export async function checkLifecycleLock(root, name, lifecycle = false, completion) {
  if (lifecycle) return;
  const observation = completion?.continuation?.('sqliteLifecycleLstat');
  let marker;
  observation?.start();
  try {
    let pending;
    try { pending = lstat(path.join(root, name + '.lifecycle')); }
    finally { observation?.invoked?.(); }
    marker = await pending.catch(error => {
      // This is the existing Promise rejection reaction, NOT a raw fs callback.
      observation?.recoveryEntry();
      try {
        if (error.code !== 'ENOENT') throw error;
        observation?.enoent();
        return null;
      } finally { observation?.complete(); }
    });
  } finally { observation?.resume(); }
  try { check(!marker, 'STORE.BUSY'); }
  finally { observation?.validated(); }
}
