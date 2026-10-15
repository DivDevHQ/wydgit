// Narrow same-site search/source link contract. Paths are literal; query values
// are decoded exactly once for validation and serialized by URLSearchParams.
const parameter=value=>typeof value==='string'&&/^[a-z_][a-z0-9_-]{0,31}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
export function safeDestination(value){
 if(typeof value!=='string'||value.length>1024||/[\\\u0000-\u0020\u007f<>#]/.test(value))return false;
 const [pathname,query,...extra]=value.split('?');
 if(extra.length||!/^\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]*\/?$/.test(pathname)||pathname.includes('//'))return false;
 if(query===undefined)return true;
 if(!query)return false;
 const pairs=query.split('&');if(pairs.length>16)return false;
 const names=new Set();
 for(const pair of pairs){
  const match=/^([^=]+)=([^=]*)$/.exec(pair);if(!match||!parameter(match[1])||names.has(match[1]))return false;
  names.add(match[1]);
  let decoded;try{decoded=decodeURIComponent(match[2].replace(/\+/g,' '));}catch{return false;}
  // Reject encoded delimiters, controls, nested escapes and URL-like values.
  if(/[\\\u0000-\u001f\u007f<>/:?&#=%]/.test(decoded))return false;
 }
 return true;
}
export function destinationWithParameter(destination,name,value){
 if(!safeDestination(destination)||!parameter(name)||typeof value!=='string')throw new TypeError('Invalid destination');
 const [pathname,query]=destination.split('?'),params=new URLSearchParams(query);
 params.set(name,value);
 const result=pathname+'?'+params.toString();
 if(!safeDestination(result))throw new TypeError('Invalid destination');
 return result;
}
