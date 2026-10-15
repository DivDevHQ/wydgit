import { requireThat as check } from '../object-model/validation.js';
export const HTTP_DEFAULTS=Object.freeze({headerBytes:8192,headerCount:64,requestMs:120000});
export const HTTP_CEILINGS=Object.freeze({headerBytes:16384,headerCount:128,requestMs:300000});
export function httpPolicy(input={}) {
 check(input&&typeof input==='object'&&!Array.isArray(input),'LIBRARY.INVALID_CONFIG','Invalid HTTP policy');
 const result={...HTTP_DEFAULTS,...input};
 check(Object.keys(result).every(k=>Object.hasOwn(HTTP_DEFAULTS,k)&&Number.isSafeInteger(result[k])&&result[k]>=1&&result[k]<=HTTP_CEILINGS[k]),'LIBRARY.INVALID_CONFIG','HTTP policy exceeds host ceilings');return Object.freeze(result);
}
