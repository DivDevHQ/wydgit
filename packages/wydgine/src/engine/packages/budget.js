import { checkContext } from '../seam/context.js';
import { executionBudget } from '../sewn/budget.js';
import { requireThat as check } from '../object-model/validation.js';
const budgets=new WeakMap();
export function createPackageBudget(context,{signal,parentBudget}={}) {
  checkContext(context);
  const parent=parentBudget===undefined?null:executionBudget(parentBudget,context);
  const maxWork=Math.min(65536,context.limits.packageWork??65536);
  const deadline=Date.now()+Math.min(30000,context.limits.packageTimeMs??30000);
  let work=0;
  const token=Object.freeze(Object.create(null));
  budgets.set(token,{context,take(count=1){
    checkContext(context);
    check(!signal?.aborted,'PACKAGE.CANCELLED','Package operation cancelled');
    check(Date.now()<deadline&&Number.isSafeInteger(count)&&count>=0&&(work+=count)<=maxWork,'PACKAGE.LIMIT','Package execution budget exhausted');
    parent?.take('steps',count);
  },snapshot(){return Object.freeze({schema:'wydgit.package-meter/1',work,maxWork,deadline});}});
  return token;
}
export function packageBudget(token,context){const entry=budgets.get(token);check(entry&&entry.context===context,'SEAM.CONTEXT','Expected the owning package budget');return entry;}
export function authorizeLifecycle(context,app){checkContext(context);check(context.app===app&&context.package===null,'PACKAGE.DENIED','Lifecycle requires a host administrative context for this App');context.require('packages.lifecycle.manage');}
