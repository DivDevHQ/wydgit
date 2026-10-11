import { jsonKeys, freeze, record, WydgitError } from '../object-model/validation.js';

const MiB = 1024 * 1024;
export const SERVICE_DEFAULTS = Object.freeze({requestBytes:65536,responseBytes:65536,maxDepth:32,maxNodes:4096});
export const STORE_SERVICE_DEFAULTS = Object.freeze({requestBytes:17*MiB,responseBytes:33*MiB,maxDepth:64,maxNodes:262144});
export const SERVICE_CEILINGS = Object.freeze({requestBytes:33*MiB,responseBytes:65*MiB,maxDepth:64,maxNodes:1048576});
export function serviceLimits(input = {}, defaults = SERVICE_DEFAULTS) {
  if (!record(input) || Object.keys(input).some(key => !Object.hasOwn(SERVICE_CEILINGS,key))) throw new WydgitError('LIBRARY.INVALID_CONFIG','Invalid service limits');
  const result={...defaults,...input};
  for (const [key,value] of Object.entries(result)) if (!Number.isSafeInteger(value) || value < 1 || value > SERVICE_CEILINGS[key]) throw new WydgitError('LIBRARY.INVALID_CONFIG','Invalid service limits');
  return freeze(result);
}
export function effectiveLimits(policy, context) {
  const reduced=(key,grant) => Math.min(policy[key],context.limits?.[grant] ?? policy[key]);
  const maxDepth=reduced('maxDepth','serviceDepth'),maxNodes=reduced('maxNodes','serviceNodes');
  return Object.freeze({
    request:Object.freeze({maxBytes:reduced('requestBytes','serviceRequestBytes'),maxDepth,maxNodes}),
    response:Object.freeze({maxBytes:reduced('responseBytes','serviceResponseBytes'),maxDepth,maxNodes})
  });
}
// Exact UTF-8 size of JSON's string encoding, without allocating an escaped string.
function stringBytes(value, available, fail) {
  let bytes=Buffer.byteLength(value,'utf8')+2;
  if (bytes > available) fail();
  if (/[\u0000-\u001f"\\\ud800-\udfff]/.test(value)) for (let i=0;i<value.length;i++) {
    const c=value.charCodeAt(i);
    if (c===34 || c===92) bytes++;
    else if (c<32) bytes+= [8,9,10,12,13].includes(c) ? 1 : 5;
    else if (c>=0xd800 && c<=0xdbff) {
      const next=value.charCodeAt(i+1);
      if (next>=0xdc00 && next<=0xdfff) i++; else bytes+=3;
    } else if (c>=0xdc00 && c<=0xdfff) bytes+=3;
    if (bytes>available) fail();
  }
  return bytes;
}
// Descriptor inspection happens before reading values. Budgets are checked before
// copying and processing; bytes include all JSON syntax, escapes and UTF-8 values.
export function checkJsonBudget(value, limits, code = 'SERVICE.INVALID_REQUEST') {
  let nodes=0,bytes=0;
  const active=new Set(),fail=()=>{throw new WydgitError(code,'JSON resource limit or invalid value');};
  const add=count=>{bytes+=count;if(bytes>limits.maxBytes)fail();};
  const visit=(item,depth=0)=>{
    if (++nodes>limits.maxNodes || depth>limits.maxDepth) fail();
    if (typeof item==='string') {add(stringBytes(item,limits.maxBytes-bytes,fail));return;}
    if (item===null) {add(4);return;}
    if (typeof item==='boolean') {add(item?4:5);return;}
    if (typeof item==='number') {if(!Number.isFinite(item))fail();add(String(Object.is(item,-0)?0:item).length);return;}
    if (!item || typeof item!=='object' || active.has(item)) fail();
    if(Array.isArray(item) && nodes+item.length>limits.maxNodes)fail();
    const keys=jsonKeys(item),array=Array.isArray(item);
    // Every member requires at least one value node and one encoded byte.
    if (nodes+keys.length>limits.maxNodes || bytes+keys.length>limits.maxBytes) fail();
    active.add(item);add(2);
    for (let i=0;i<keys.length;i++) {
      const key=keys[i];
      if (['__proto__','constructor','prototype'].includes(key)) fail();
      if(i)add(1);
      if(!array){add(stringBytes(key,limits.maxBytes-bytes,fail));add(1);}
      visit(Object.getOwnPropertyDescriptor(item,key).value,depth+1);
    }
    active.delete(item);
  };
  visit(value);return {bytes,nodes};
}
