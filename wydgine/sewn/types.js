import {ensure} from './validate.js';
import {contractTypes} from './schema.js';
// Brands are private runtime provenance, never recognized from JSON keys.
const brands=new WeakMap();
const make=(type,value)=>{const token=Object.freeze(Object.assign(Object.create(null),{type,value}));brands.set(token,{type,value});return token;};
export const brand=value=>value&&typeof value==='object'?brands.get(value):undefined;
export function descriptor(type){ensure(contractTypes.includes(type),'TYPE');return make('DataType',type);}
export function dateTime(text){
 ensure(typeof text==='string'&&/^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text),'TYPE');
 const ms=Date.parse(text);ensure(Number.isInteger(ms)&&Math.abs(ms)<=8640000000000000&&new Date(ms).toISOString()===text,'TYPE');return make('DateTime',ms);
}
export function observable(value){const typed=brand(value);if(typed)return typed.type;return value===null?'Null':Array.isArray(value)?'Array':typeof value==='number'?(ensure(Number.isFinite(value),'TYPE'),Number.isSafeInteger(value)?'Integer':'Float'):({string:'String',boolean:'Boolean',object:'Object'})[typeof value];}
export function contract(value,type){const actual=observable(value);ensure(type==='Scalar'?['String','Integer','Float','Boolean','DateTime'].includes(actual):actual===type,'TYPE');return value;}
export const external=value=>brand(value)?.type==='DateTime'?new Date(brand(value).value).toISOString():brand(value)?.type==='DataType'?{schema:'sewn.type/0.11',type:brand(value).value}:value;
