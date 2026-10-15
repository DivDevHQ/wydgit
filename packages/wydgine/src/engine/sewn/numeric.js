import {ensure} from './validate.js';
export function numericCheck(value,type){ensure(typeof value==='number'&&(type==='Integer'?Number.isSafeInteger(value):Number.isFinite(value)),'TYPE');return value;}
// BigInt is confined to bounded exact verification; all public values are Numbers.
export function numeric(operator,a,b,type){
 numericCheck(a,'Float');numericCheck(b,'Float');
 const integers=Number.isSafeInteger(a)&&Number.isSafeInteger(b);
 const integerOnly=['MOD','\\'].includes(operator);
 const exact=integers&&(integerOnly||type!=='Float'&&(['+','-','*'].includes(operator)||operator==='^'&&b>=0));
 if(integerOnly)ensure(integers&&b!==0,'TYPE');
 if(exact){
  const x=BigInt(a),y=BigInt(b);let v;
  if(operator==='^'){
   // Nontrivial integral powers outside this bound necessarily exceed the range.
   if(a===0){v=b===0?1n:0n;}else if(a===1)v=1n;else if(a===-1)v=b%2===0?1n:-1n;
   else {ensure(b<=53,'TYPE');v=x**y;}
  }else v=operator==='+'?x+y:operator==='-'?x-y:operator==='*'?x*y:operator==='MOD'?x%y:x/y;
  ensure(v>=-9007199254740991n&&v<=9007199254740991n,'TYPE');return operator==='MOD'&&v===0n&&(a<0||Object.is(a,-0))?-0:Number(v);
 }
 ensure(type!=='Integer'||integers,'TYPE');
 const v=operator==='+'?a+b:operator==='-'?a-b:operator==='*'?a*b:operator==='/'?a/b:operator==='^'?a**b:NaN;
 numericCheck(v,type==='Integer'?'Integer':'Float');return v;
}
