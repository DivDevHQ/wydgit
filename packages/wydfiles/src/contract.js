export class FilesError extends Error { constructor(code){super(code);this.code=code;} }
export const check=(ok,code='FILES.INVALID_REQUEST')=>{if(!ok)throw new FilesError(code);};
export const defaults=Object.freeze({fileBytes:8*1024**2,quotaBytes:64*1024**2,chunkBytes:64*1024,pageSize:20,objects:256,transfers:2,durationMs:60000,retries:2,crossMount:false});
export const ceilings=Object.freeze({fileBytes:64*1024**2,quotaBytes:1024**3,chunkBytes:1024**2,pageSize:100,objects:4096,transfers:8,durationMs:300000,retries:5});
export function policy(input={}) {check(input&&typeof input==='object'&&!Array.isArray(input),'FILES.INVALID_CONFIG');check(Object.keys(input).every(k=>Object.hasOwn(defaults,k)),'FILES.INVALID_CONFIG');const value={...defaults,...input};for(const k of Object.keys(ceilings))check(Number.isSafeInteger(value[k])&&value[k]>=(k==='retries'?0:1)&&value[k]<=ceilings[k],'FILES.INVALID_CONFIG');check(typeof value.crossMount==='boolean','FILES.INVALID_CONFIG');return Object.freeze(value);}
// Deliberately canonical ASCII syntax: no decoding, Unicode aliases or platform separators.
export function logicalPath(value){check(typeof value==='string'&&Buffer.byteLength(value)<=120&&/^\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*)?$/.test(value)&&!value.split('/').some(s=>s.endsWith('.')||s==='.'||s==='..'),'FILES.INVALID_PATH');return value;}
export const covers=(scope,value)=>scope==='/'||value===scope||value.startsWith(scope+'/');
export function resolveMount(mounts,value){logicalPath(value);const mount=[...mounts].sort((a,b)=>b.path.length-a.path.length).find(m=>covers(m.path,value));check(mount,'FILES.DENIED');return mount;}
export const capabilities=Object.freeze({rangeRead:true,streamRead:true,streamWrite:true,atomicReplace:true,serverSideCopy:false,directorySemantics:false,multipartUpload:false,maxObjectSize:ceilings.fileBytes});
export function fields(value,required,optional=[]){check(value&&typeof value==='object'&&!Array.isArray(value)&&required.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>[...required,...optional].includes(k)));}
export const keyFor=value=>Buffer.from(logicalPath(value)).toString('hex');
export function pathFor(key){check(/^(?:[a-f0-9]{2})+$/.test(key),'FILES.STORAGE');const p=Buffer.from(key,'hex').toString('utf8');logicalPath(p);check(keyFor(p)===key,'FILES.STORAGE');return p;}
