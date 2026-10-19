// Cooperating, same-process host admission only. Offline/native hosts must stop
// other processes themselves; this is not an OS lock or distributed drain lease.
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { requireThat as check } from '../object-model/validation.js';
const executions=new Map(),maintenance=new Set();
export function registerAppExecution(root) {
  root=realpathSync(path.resolve(root));
  check(!maintenance.has(root),'PACKAGE.BUSY','App maintenance is in progress');
  executions.set(root,(executions.get(root)??0)+1);let live=true;
  return ()=>{if(live){live=false;const count=executions.get(root)-1;if(count)executions.set(root,count);else executions.delete(root);}};
}
export function reserveStoppedApp(root) {
  root=realpathSync(path.resolve(root));
  check(!executions.has(root),'PACKAGE.RUNNING','App must be stopped and drained');
  check(!maintenance.has(root),'PACKAGE.BUSY','Conflicting App maintenance');
  maintenance.add(root);return ()=>maintenance.delete(root);
}
