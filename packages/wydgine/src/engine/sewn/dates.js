import {ensure} from './validate.js';
import {brand,dateTime} from './types.js';
import {dateSignatures} from './schema.js';
const DAY=86400000,MAX=8640000000000000;
const elapsed={millisecond:1,second:1000,minute:60000,hour:3600000};
const leap=y=>y%4===0&&(y%100!==0||y%400===0);
const days=(y,m)=>[31,leap(y)?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
const checked=n=>{ensure(Number.isSafeInteger(n)&&Math.abs(n)<=MAX,'TYPE');return n;};
const instant=n=>dateTime(new Date(checked(n)).toISOString());
// UTC setters avoid Date.UTC's special treatment of years 0 through 99.
function local(y,m,d,h=0,min=0,s=0,ms=0){
 ensure(Number.isSafeInteger(y)&&m>=1&&m<=12&&d>=1&&d<=days(y,m)&&h>=0&&h<24&&min>=0&&min<60&&s>=0&&s<60&&ms>=0&&ms<1000,'TYPE');
 const date=new Date(0);date.setUTCFullYear(y,m-1,d);date.setUTCHours(h,min,s,ms);return checked(date.getTime());
}
function offset(zone){
 if(zone==='UTC')return 0;
 ensure(/^[+-]\d{2}:\d{2}$/.test(zone),'TYPE');const h=Number(zone.slice(1,3)),m=Number(zone.slice(4));
 ensure(h<=23&&m<=59&&zone!=='-00:00','TYPE');return (zone[0]==='-'?-1:1)*(h*60+m)*60000;
}
function parts(ms,off){const d=new Date(checked(ms+off));return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes(),second:d.getUTCSeconds(),millisecond:d.getUTCMilliseconds(),dayOfWeek:d.getUTCDay()};}
export function dateOperation(name,args,bounds,tick){
 dateSignatures[name].forEach((type,i)=>ensure(type==='DateTime'?brand(args[i])?.type==='DateTime':type==='Integer'?Number.isSafeInteger(args[i]):typeof args[i]==='string','TYPE'));
 const limit=(s,key)=>ensure(s.length<=bounds[key]&&s.length<=bounds.string,'LIMIT');
 const zone=args.at(-1);limit(zone,'dateZone');const off=offset(zone);tick();
 const [a,b,c]=args,ms=brand(a)?.value;
 if(name==='ParseDate'){
  limit(a,'dateInput');limit(b,'dateFormat');ensure(b==='iso','TYPE');
  const match=/^(\d{4}|[+-]\d{6})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|[+-]\d{2}:\d{2})$/.exec(a);ensure(match,'TYPE');
  const [,y,m,d,h,min,s,f,z]=match;ensure(y!=='-000000'&&(y.length===4||Number(y)<0||Number(y)>9999),'TYPE');const parsedOffset=z==='Z'?0:offset(z);ensure(parsedOffset===off,'TYPE');
  return instant(local(Number(y),Number(m),Number(d),Number(h),Number(min),Number(s),Number(f))-parsedOffset);
 }
 const p=parts(ms,off);
 if(name==='DatePart'){ensure(Object.hasOwn(p,b),'TYPE');return p[b];}
 if(name==='DateAdd'){
  let result;
  if(Object.hasOwn(elapsed,b)){const delta=c*elapsed[b];ensure(Number.isSafeInteger(delta),'TYPE');result=ms+delta;}
  else if(b==='day'||b==='week'){const delta=c*(b==='week'?7:1)*DAY;ensure(Number.isSafeInteger(delta),'TYPE');result=ms+delta;}
  else {ensure(b==='month'||b==='year','TYPE');const total=p.year*12+p.month-1+c*(b==='year'?12:1);ensure(Number.isSafeInteger(total),'TYPE');const y=Math.floor(total/12),m=total-y*12+1;result=local(y,m,Math.min(p.day,days(y,m)),p.hour,p.minute,p.second,p.millisecond)-off;}
  return instant(result);
 }
 if(name==='DateDiff'){
  const finish=brand(b).value;const unit=c;let result;
  if(Object.hasOwn(elapsed,unit))result=Number((BigInt(finish)-BigInt(ms))/BigInt(elapsed[unit]));
  else {const q=parts(finish,off);ensure(['day','week','month','year'].includes(unit),'TYPE');
   const dayDiff=Math.floor((finish+off)/DAY)-Math.floor((ms+off)/DAY);
   result=unit==='day'?dayDiff:unit==='week'?Math.trunc(dayDiff/7):unit==='month'?(q.year-p.year)*12+q.month-p.month:q.year-p.year;
  }
  ensure(Number.isSafeInteger(result),'TYPE');return result===0?0:result;
 }
 limit(b,'dateFormat');
 const pad=(v,n)=>String(v).padStart(n,'0');
 const year=p.year>=0&&p.year<=9999?pad(p.year,4):`${p.year<0?'-':'+'}${pad(Math.abs(p.year),6)}`;
 const tokens={yyyy:year,MM:pad(p.month,2),dd:pad(p.day,2),HH:pad(p.hour,2),mm:pad(p.minute,2),ss:pad(p.second,2),SSS:pad(p.millisecond,3),XXX:off===0?'+00:00':zone};
 if(b==='iso'){const result=`${year}-${tokens.MM}-${tokens.dd}T${tokens.HH}:${tokens.mm}:${tokens.ss}.${tokens.SSS}${off===0?'Z':zone}`;limit(result,'dateOutput');return result;}
 let result='',count=0;
 for(let i=0;i<b.length;){tick();const token=Object.keys(tokens).find(t=>b.startsWith(t,i));if(token){ensure(++count<=bounds.dateTokens,'LIMIT');result+=tokens[token];i+=token.length;}else {ensure(' -/:.,T'.includes(b[i]),'TYPE');result+=b[i++];}limit(result,'dateOutput');}
 return result;
}
