// Operator-only contract. Never registered as a canonical library service.
export const lifecycleSchema='wydstore.lifecycle/1';
export { safeRoot } from './local-root.js';
export { validateStoreConfig } from './core.js';
export { emptyStore, discardStoreTemporary, snapshotStore, replaceStore, checkpointHash, storeName, storeOwner, storeFile, lockStore, unlockStore } from './lifecycle.js';
import { documentContract } from './json-records.js';
import { storeOwner } from './lifecycle.js';
import { storeLimits } from './resource-limits.js';
export const storeRecordByteLimit = definition => storeLimits(definition.limits).recordBytes;
export function validateStoreCheckpoint(definition,document) {
  return documentContract(storeOwner(definition),new Map(definition.collections.map(c=>[c.id,c.fields])),new Map(definition.collections.map(c=>[c.id,c]))).validate(document);
}
