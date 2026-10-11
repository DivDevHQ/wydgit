import { check, fields, frozen } from './data.js';
const MiB=1024*1024;
export const DEFAULTS=frozen({recordBytes:16*MiB,queryResultBytes:32*MiB,historyDataBytes:32*MiB,
  transactionRequestBytes:17*MiB,transactionResultBytes:33*MiB,jsonDocumentBytes:16*MiB,
  sqliteDatabaseBytes:256*MiB,maxDepth:64,maxNodes:262144,maxOperations:64});
// SQLite's 4 GiB ceiling is a current v0.3 host policy, not an architectural limit.
export const CEILINGS=frozen({...DEFAULTS,queryResultBytes:64*MiB,historyDataBytes:64*MiB,
  transactionRequestBytes:33*MiB,transactionResultBytes:65*MiB,jsonDocumentBytes:64*MiB,
  sqliteDatabaseBytes:4*1024*MiB,maxNodes:1048576});
export function storeLimits(input={}) {
  fields(input,[],Object.keys(DEFAULTS),'STORE.INVALID_CONFIG');
  const result={...DEFAULTS,...input};
  for(const [key,value] of Object.entries(result)) check(Number.isSafeInteger(value)&&value>=1&&value<=CEILINGS[key],'STORE.INVALID_CONFIG');
  check(result.sqliteDatabaseBytes%4096===0,'STORE.INVALID_CONFIG');
  return frozen(result);
}
export function budget(limits,maxBytes,service) {
  return {maxBytes:Math.min(maxBytes,service?.maxBytes ?? maxBytes),
    maxDepth:Math.min(limits.maxDepth,service?.maxDepth ?? limits.maxDepth),
    maxNodes:Math.min(limits.maxNodes,service?.maxNodes ?? limits.maxNodes)};
}

// Account for an array incrementally without rescanning prior results.
export function resultCollector(checkJson,limits) {
  let bytes=2,nodes=1,count=0;
  return value=>{
    const stats=checkJson(value,{maxBytes:limits.maxBytes-bytes-(count?1:0),
      maxNodes:limits.maxNodes-nodes,maxDepth:limits.maxDepth-1},'STORE.LIMIT');
    bytes+=stats.bytes+(count?1:0);nodes+=stats.nodes;count++;
  };
}
