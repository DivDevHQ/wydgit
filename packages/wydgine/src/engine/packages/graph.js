import semver from 'semver';
import { requireThat as check, freeze } from '../object-model/validation.js';
import { LIMITS, qualified } from './manifest.js';

// Recomputed from accepted manifests. Reference counts are never authority.
export function packageGraph(packages) {
  check(Array.isArray(packages)&&packages.length<=LIMITS.packages,'PACKAGE.LIMIT','Package graph ceiling');
  const nodes=new Map(),reverse=new Map();
  for(const entry of packages){
    const id=entry.manifest.id;
    check(!nodes.has(id),'PACKAGE.CONFLICT','Duplicate package identity');
    nodes.set(id,entry);reverse.set(id,[]);
    if(entry.reason!==undefined)check(['explicit','automatic'].includes(entry.reason),'PACKAGE.CATALOG','Invalid installation reason');
    if(entry.protected!==undefined)check(typeof entry.protected==='boolean','PACKAGE.CATALOG','Invalid protection');
  }
  for(const entry of packages)for(const [id,range] of Object.entries(entry.manifest.dependencies??{})){
    const dependency=nodes.get(id);
    check(dependency,'PACKAGE.DEPENDENCY','Required package is missing');
    check(semver.satisfies(dependency.manifest.version,range),'PACKAGE.CONFLICT','Incompatible package dependency');
    reverse.get(id).push(entry.manifest.id);
  }
  // Iterative DFS bounds stack use even at the installed-package ceiling.
  const done=new Set(),active=new Set(),order=[];
  for(const id of nodes.keys()){
    const stack=[[id,false]];
    while(stack.length){const [next,exit]=stack.pop();if(exit){active.delete(next);done.add(next);order.push(next);continue;}if(done.has(next))continue;
      check(!active.has(next),'PACKAGE.CYCLE','Circular package dependency');active.add(next);stack.push([next,true]);
      for(const child of Object.keys(nodes.get(next).manifest.dependencies??{}))stack.push([child,false]);
    }
  }
  return {nodes,reverse,order};
}
export const protectedPackage=entry=>entry.protected===true||entry.manifest.publisher==='wydgit.core';
export function removalOrder(packages,id,{prune=true,reserved=[]}={}) {
  check(qualified(id),'PACKAGE.IDENTITY','Invalid package identity');
  const graph=packageGraph(packages),entry=graph.nodes.get(id);
  check(entry,'PACKAGE.NOT_INSTALLED','Package is not installed');
  check(!reserved.includes(id),'PACKAGE.RESERVED','A replacement recovery reservation retains this dependency');
  check(!protectedPackage(entry),'PACKAGE.PROTECTED','Protected package cannot be removed');
  check(graph.reverse.get(id).length===0,'PACKAGE.DEPENDENTS','Installed packages require this package');
  const remaining=new Map(graph.nodes),removed=[id];remaining.delete(id);
  // Prune only dependencies reachable from this operation, never unrelated debris.
  const eligible=new Set(),visit=[id];
  while(visit.length)for(const dep of Object.keys(graph.nodes.get(visit.pop()).manifest.dependencies??{}))if(!eligible.has(dep)){eligible.add(dep);visit.push(dep);}
  if(prune)for(const dep of [...graph.order].reverse()){
    const candidate=remaining.get(dep);if(!eligible.has(dep)||!candidate||candidate.reason!=='automatic'||protectedPackage(candidate)||reserved.includes(dep))continue;
    if([...remaining.values()].some(p=>Object.hasOwn(p.manifest.dependencies??{},dep)))continue;
    remaining.delete(dep);removed.push(dep);
  }
  packageGraph([...remaining.values()]);return freeze(removed);
}
