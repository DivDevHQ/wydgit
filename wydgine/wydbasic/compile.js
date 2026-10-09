import { parse } from './parse.js';
import { fail } from './errors.js';
import { validate } from '../sewn/validate.js';
import { contextNames, safeKey } from '../sewn/schema.js';
import { reads, methods } from '../sewn/bindings.js';
const reservedWords=['DIM','AS','SET','IF','THEN','ELSE','ELSEIF','END','FOR','EACH','IN','NEXT','RETURN','STOP','TRUE','FALSE','NULL','AND','OR','NOT','SUB','FUNCTION','MODULE','ASYNC','AWAIT','GOTO','REM','DO','LOOP','WHILE','SELECT','IMPORT','NEW','TRY','CATCH','THROW','ON'];
const types=['String','Number','Boolean','Null','Array','Object','Wydgit'];
const literal=value=>({op:'literal',value});
const typeOf=value=>value===null?'Null':Array.isArray(value)?'Array':({string:'String',number:'Number',boolean:'Boolean',object:'Object'})[typeof value];
const defaults={String:'',Number:0,Boolean:false,Null:null,Array:[],Object:{},Wydgit:null};
const canonical=(list,name)=>list.find(x=>x.toLowerCase()===name.toLowerCase());
export function compile(source) { return compileAst(parse(source)); }
// Public compilation starts from source; AST lowering remains an internal stage.
function compileAst(ast) {
  let symbols=new Map();const declared=new Set();
  const error=(n,code,message)=>fail(code,message,n.location);
  const checkType=(n,actual,expected)=>{if(expected!=='Unknown'&&actual!=='Unknown'&&actual!==expected)error(n,'TYPE',`Expected ${expected}, received ${actual}.`);};
  const key=(n,k)=>{if(!safeKey(k.toLowerCase()))error(n,'UNSUPPORTED',`Reserved member '${k}'.`);return k;};
  const reserve=(n,name,type)=>{const id=name.toLowerCase();if(!/^[a-z_][a-z0-9_]{0,63}$/.test(id))error(n,'NAME','Variable names must contain at most 64 ASCII letters, digits or underscores.');if(reservedWords.includes(name.toUpperCase())||contextNames.includes(name.toUpperCase())||id==='services'||!safeKey(id))error(n,'NAME',`Reserved name '${name}'.`);if(declared.has(id))error(n,'NAME',`Duplicate declaration '${name}'.`);declared.add(id);symbols.set(id,{type,kind:type==='Wydgit'?'handle':null});return id;};
  const value=(sewn,type='Unknown',kind=null)=>({sewn,type,kind});
  let expressionDepth=0;
  function expression(n) {
    if(++expressionDepth>32)error(n,'COMPILE','Expression nesting exceeds SEWN limits.');
    try{return lowerExpression(n);}finally{expressionDepth--;}
  }
  function lowerExpression(n) {
    switch(n.kind) {
      case 'literal':return value(literal(n.value),typeOf(n.value));
      case 'name':{const context=n.name.toUpperCase();if(contextNames.includes(context))return value({op:'context',name:context},['ME','PAGE'].includes(context)?'Wydgit':context==='SESSION'?'Object':'Facade',['ME','PAGE'].includes(context)?'handle':context==='SESSION'?null:context);if(context==='SERVICES')error(n,'UNSUPPORTED','SERVICES is available only through Call.');const s=symbols.get(n.name.toLowerCase());if(!s)error(n,'NAME',`Unknown variable '${n.name}'.`);return {...value({op:'variable',name:n.name.toLowerCase()},s.type,s.kind),element:s.element};}
      case 'array':{const items=n.items.map(expression);if(items.some(x=>x.kind))error(n,'TYPE','Array literals require JSON values.');return value({op:'array',items:items.map(x=>x.sewn)},'Array');}
      case 'object':{const fields=Object.create(null);for(const f of n.fields){key(f,f.key);if(Object.hasOwn(fields,f.key))error(f,'NAME',`Duplicate object key '${f.key}'.`);const v=expression(f.value);if(v.kind)error(f,'TYPE','Objects require JSON values.');fields[f.key]=v.sewn;}return value({op:'object',fields},'Object');}
      case 'member':{const target=expression(n.target);key(n,n.key);let name=n.key,type='Unknown',kind=null;
        if(target.kind){name=canonical(reads[target.kind]??[],name);if(!name)error(n,'UNSUPPORTED',`Unsupported ${target.kind} member '${n.key}'.`);
          if(['Query','Form'].includes(name)){kind='map';type='Facade';}else if(name==='Cookies'){kind=target.kind==='RESPONSE'?'cookieWrite':'cookieRead';type='Facade';}else if(name==='Headers'){kind='headers';type='Facade';}else if(['Source','Target'].includes(name)){kind='handle';type='Wydgit';}else if(['IsPost','Cancelable','Cancelled','Handled'].includes(name))type='Boolean';else if(['properties','Payload','Route'].includes(name))type='Object';else if(name==='Status')type='Number';else if(name!=='Value'&&!['OldValue','NewValue'].includes(name))type='String';
        }else if(!['Object','Unknown'].includes(target.type))error(n,'TYPE','Member reads require an Object or facade.');
        return value({op:'read',target:target.sewn,key:name},type,kind);}
      case 'invoke':{if(n.target.kind!=='member')error(n,'UNSUPPORTED','Only safe facade methods can be called.');const target=expression(n.target.target);key(n,n.target.key);const method=canonical(Object.keys(methods[target.kind]??{}),n.target.key);if(!method)error(n,'UNSUPPORTED',`Unsupported method '${n.target.key}'.`);const args=n.args.map(expression),arity=methods[target.kind][method];if(args.length<arity[0]||args.length>arity[1])error(n,'TYPE',`Invalid argument count for ${method}.`);args.forEach((v,i)=>{if(v.kind&&!(method==='Move'&&i===0||method==='Raise'&&i===1))error(n,'TYPE','This argument requires JSON data.');});
        let type='Unknown',kind=null;if(method==='related'){const relation=n.args[0];if(relation.kind!=='literal'||typeof relation.value!=='string')error(n,'TYPE','related requires a literal relationship.');if(relation.value==='children')type='Array';else{type='Wydgit';kind='handle';}}else if(['Set','Insert','Remove','Replace','Move','Cancel','Raise','WriteMarkdown','Delete'].includes(method))type='Null';else if(method==='GetAll')type='Array';
        return {...value({op:'invoke',target:target.sewn,method,args:args.map(x=>x.sewn)},type,kind),...(method==='related'&&type==='Array'?{element:'Wydgit'}:{})};}
      case 'unary':{const v=expression(n.value);checkType(n,v.type,n.operator==='NOT'?'Boolean':'Number');return value(n.operator==='NOT'?{op:'not',value:v.sewn}:n.operator==='+'?v.sewn:{op:'binary',operator:'-',left:literal(0),right:v.sewn},n.operator==='NOT'?'Boolean':'Number');}
      case 'binary':{const a=expression(n.left),b=expression(n.right),op=n.operator;if(a.kind||b.kind)error(n,'TYPE','Operators require JSON scalar values.');let type='Boolean';if(['AND','OR'].includes(op)){checkType(n,a.type,'Boolean');checkType(n,b.type,'Boolean');}else if(['+','-','*','/','&'].includes(op)){type=op==='&'?'String':'Number';checkType(n,a.type,type);checkType(n,b.type,type);}else{for(const v of [a,b])if(['Array','Object'].includes(v.type))error(n,'TYPE','Comparison requires scalar values.');if(!['=','<>'].includes(op)&&a.type!=='Unknown'&&b.type!=='Unknown'&&(a.type!==b.type||!['Number','String'].includes(a.type)))error(n,'TYPE','Ordering requires matching Numbers or Strings.');}return value({op:'binary',operator:op==='<>'?'!=':op==='&'?'concat':op,left:a.sewn,right:b.sewn},type);}
      default:error(n,'COMPILE','Unknown expression.');
    }
  }
  function service(n) {
    if(n?.kind!=='invoke'||n.target.kind!=='member'||n.target.target.kind!=='name'||n.target.target.name.toUpperCase()!=='SERVICES')return null;
    if(n.target.key.toUpperCase()!=='CALL'||n.args.length!==3)error(n,'UNSUPPORTED','Use SERVICES.Call(library, method, input).');
    const [library,method,input]=n.args;if([library,method].some(x=>x.kind!=='literal'||typeof x.value!=='string'))error(n,'TYPE','Service library and method must be literal strings.');
    if(!/^[a-z][a-z0-9-]*$/.test(library.value)||!safeKey(method.value.toLowerCase())||!method.value)error(n,'UNSUPPORTED','Invalid canonical service identity.');const v=expression(input);if(v.kind)error(n,'TYPE','Service input requires JSON data.');return {op:'service',library:library.value,method:method.value,input:v.sewn};
  }
  function body(nodes,inLoop=false) {
    const out=[];
    for(const n of nodes) {
      if(n.kind==='declare') {
        if(inLoop)error(n,'UNSUPPORTED','DIM inside FOR EACH is deferred; SEWN declarations live for the invocation.');
        const svc=service(n.value);let v=n.value&&!svc?expression(n.value):null;
        const explicit=n.type&&canonical(types,n.type);if(n.type&&!explicit)error(n,'TYPE',`Unknown type '${n.type}'.`);
        const type=explicit??(svc?'Object':v?.type);if(!type||type==='Facade')error(n,'TYPE','Declaration requires a data type or initializer.');
        if(explicit==='Wydgit'&&v?.type==='Unknown')error(n,'TYPE','A Wydgit initializer requires a known handle or NULL.');
        if(explicit&&v&&!(explicit==='Wydgit'&&v.type==='Null'))checkType(n,v.type,explicit);
        const name=reserve(n,n.name,type);if(v?.element)symbols.get(name).element=v.element;if(svc){if(type!=='Object')error(n,'TYPE','Service result is an Object.');out.push({...svc,into:name});}else out.push({op:'declare',name,value:v?.sewn??literal(defaults[type])});
      }else if(n.kind==='set') {
        const s=symbols.get(n.name.toLowerCase());if(!s)error(n,'NAME',`Unknown variable '${n.name}'.`);if(n.reference!==(s.type==='Wydgit'))error(n,'TYPE',s.type==='Wydgit'?'Wydgit assignment requires SET.':'SET requires a Wydgit variable.');
        const v=expression(n.value);if(s.type==='Wydgit'&&v.type==='Unknown')error(n,'TYPE','SET requires a known handle or NULL.');if(!(s.type==='Wydgit'&&v.type==='Null'))checkType(n,v.type,s.type);if(s.type!=='Wydgit'&&v.kind)error(n,'TYPE','Reference requires a Wydgit variable.');out.push({op:'set',name:n.name.toLowerCase(),value:v.sewn});
      }else if(n.kind==='call') {const svc=service(n.value);if(svc)out.push(svc);else{const v=expression(n.value);if(v.sewn.op!=='invoke')error(n,'UNSUPPORTED','Expected method call.');out.push({op:'call',target:v.sewn.target,method:v.sewn.method,args:v.sewn.args});}}
      else if(n.kind==='if') {const condition=expression(n.condition);checkType(n,condition.type,'Boolean');const before=new Map(symbols);const then=body(n.then,inLoop);symbols=new Map(before);const otherwise=body(n.else,inLoop);symbols=before;out.push({op:'if',condition:condition.sewn,then,...(otherwise.length?{else:otherwise}:{})});}
      else if(n.kind==='forEach') {const items=expression(n.items);checkType(n,items.type,'Array');const before=new Map(symbols);const name=reserve(n,n.name,items.element??'Unknown');const children=body(n.body,true);symbols=before;out.push({op:'forEach',name,items:items.sewn,body:children});}
      else {const v=n.value?expression(n.value):value(literal(null),'Null');if(v.kind)error(n,'TYPE','RETURN/STOP requires JSON data.');out.push({op:n.kind,...(n.kind==='return'||n.value?{value:v.sewn}:{})});}
    }
    return out;
  }
  const program={schema:'sewn/0.1',body:body(ast.body)};
  try{return validate(program);}catch{error(ast,'COMPILE','Generated workflow exceeds or violates canonical SEWN validation bounds.');}
}
