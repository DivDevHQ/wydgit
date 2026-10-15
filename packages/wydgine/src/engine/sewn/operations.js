import {ensure} from './validate.js';
import {operationSignatures} from './schema.js';
import {brand,dateTime,external} from './types.js';
import {numeric,numericCheck} from './numeric.js';
export function canonicalConvert(value,type){
 const typed=brand(value);
 if(type==='String'){
  if(typed){ensure(typed.type==='DateTime','TYPE');return external(value);}
  ensure(['string','boolean','number'].includes(typeof value),'TYPE');
  if(typeof value==='number')numericCheck(value,'Float');
  return typeof value==='boolean'?(value?'True':'False'):String(value);
 }
 if(type==='DateTime'){if(typed){ensure(typed.type==='DateTime','TYPE');return value;}return dateTime(value);}
 ensure(!typed,'TYPE');
 if(type==='Boolean'){ensure(typeof value==='boolean'||value==='True'||value==='False','TYPE');return typeof value==='boolean'?value:value==='True';}
 ensure(typeof value==='number'||typeof value==='string','TYPE');
 if(typeof value==='string'){
  ensure(/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value),'TYPE');
  // Bound decimal analysis and reject fractional text rounded into an integer.
  const [mantissa,exponent='0']=value.toLowerCase().split('e');
  const digits=mantissa.replace(/[+.-]/g,''),fraction=(mantissa.split('.')[1]??'').length;
  const shift=Number(exponent)-fraction;
  const nonzero=digits.replace(/^0+/,'');
  const integral=!nonzero||shift>=0||-shift<=digits.length&&/^0*$/.test(digits.slice(digits.length+shift));
  const number=Number(value);numericCheck(number,'Float');
  ensure(!nonzero||number!==0,'TYPE');
  ensure(!Number.isInteger(number)||integral,'TYPE');
  ensure(!integral||Number.isSafeInteger(number),'TYPE');value=number;
 }
 numericCheck(value,type==='Integer'?'Integer':'Float');return value;
}
export function operation(name,args,bounds,tick){
 operationSignatures[name].forEach((type,i)=>type==='String'?ensure(typeof args[i]==='string','TYPE'):numericCheck(args[i],type==='Integer'?'Integer':'Float'));
 const [a,b,c]=args,limit=n=>ensure(Number.isSafeInteger(n)&&n>=0&&n<=bounds.string,'LIMIT');
 if(typeof a==='string'){
  limit(a.length);
  switch(name){
   case 'Length':return a.length;
   case 'Substring':ensure(b>=0&&c>=0&&b<=a.length&&c<=a.length-b,'TYPE');return a.slice(b,b+c);
   case 'IndexOf':return a.indexOf(b);
   case 'LastIndexOf':return a.lastIndexOf(b);
   case 'StartsWith':return a.startsWith(b);
   case 'EndsWith':return a.endsWith(b);
   case 'Contains':return a.includes(b);
   case 'Trim':return a.trim();case 'TrimStart':return a.trimStart();case 'TrimEnd':return a.trimEnd();
   case 'Repeat':ensure(b>=0,'TYPE');limit(a.length*b);return a.repeat(a.length===0?0:b);
   case 'Replace':{
    ensure(b.length>0,'TYPE');let count=0,pos=0,next;
    while((next=a.indexOf(b,pos))!==-1){tick();count++;pos=next+b.length;}
    limit(a.length+count*(c.length-b.length));return a.split(b).join(c);
   }
   case 'ToUpper':case 'ToLower':{
    // Check bounded per-code-point expansions before assembling the output.
    let size=0,work=0;for(const ch of a){if(++work%64===0)tick();size+=(name==='ToUpper'?ch.toUpperCase():ch.toLowerCase()).length;limit(size);}
    const result=name==='ToUpper'?a.toUpperCase():a.toLowerCase();limit(result.length);return result;
   }
  }
 }
 let result;
 switch(name){
  case 'Abs':result=Math.abs(a);break;case 'Floor':result=Math.floor(a);break;case 'Ceiling':result=Math.ceil(a);break;case 'Truncate':result=Math.trunc(a);break;
  case 'Min':result=Math.min(a,b);break;case 'Max':result=Math.max(a,b);break;
  case 'Power':return numeric('^',a,b,'Auto');case 'Sqrt':result=Math.sqrt(a);break;case 'Sign':result=Math.sign(a);break;
  case 'Round':{
   ensure(b>=0&&b<=15,'TYPE');
   // Round the shortest decimal representation exactly with bounded BigInt.
   const [coefficient,exp='0']=Math.abs(a).toString().split('e');
   const fraction=(coefficient.split('.')[1]??'').length;
   const digits=BigInt(coefficient.replace('.','')),shift=Number(exp)-fraction+b;
   if(shift>=0)result=a;
   else {const divisor=10n**BigInt(-shift),rounded=digits/divisor+(digits%divisor*2n>=divisor?1n:0n);result=Number(`${a<0?'-':''}${rounded}e-${b}`);}
   break;
  }
 }
 numericCheck(result,'Float');
 if(Number.isSafeInteger(a)&&args.every(Number.isSafeInteger)&&!['Sqrt'].includes(name))numericCheck(result,'Integer');
 return result===0?0:result;
}

// Only the 0.13 executor dispatches here. Equality is its existing scalar comparator.
export function collectionOperation(name,args,bounds,tick,compare){
 const [a,b,c]=args;
 const string=v=>ensure(typeof v==='string','TYPE');
 const array=v=>ensure(Array.isArray(v),'TYPE');
 const index=v=>{numericCheck(v,'Integer');ensure(v>=0,'TYPE');};
 const comparable=v=>ensure(brand(v)||v===null||['string','number','boolean'].includes(typeof v),'TYPE');
 const elements=n=>ensure(n+1<=bounds.valueNodes,'LIMIT');
 if(['Length','Contains','IndexOf'].includes(name)){
  if(typeof a==='string')return operation(name,args,bounds,tick);
  array(a);
  if(name==='Length')return a.length;
  comparable(b);for(const item of a){tick();comparable(item);}
  for(let i=0;i<a.length;i++){tick();if(compare(a[i],b,'='))return name==='Contains'?true:i;}
  return name==='Contains'?false:-1;
 }
 if(name==='Slice'){array(a);index(b);index(c);const start=Math.min(b,a.length),length=Math.min(c,a.length-start);elements(length);return a.slice(start,start+length);}
 if(name==='Join'){
  array(a);string(b);let size=0;
  for(let i=0;i<a.length;i++){tick();string(a[i]);size+=a[i].length+(i?b.length:0);ensure(size<=bounds.string,'LIMIT');}
  return a.join(b);
 }
 string(a);string(b);
 // Preflight the exact output element count before native literal splitting.
 let count=b===''?a.length:1;
 if(b!==''){let position=0,next;while((next=a.indexOf(b,position))!==-1){tick();count++;elements(count);position=next+b.length;}}
 elements(count);return a.split(b);
}
