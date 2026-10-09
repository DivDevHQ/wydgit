import { EventRegistry } from '../events/registry.js';
import { parse,parseModule } from './parse.js';
import { fail } from './errors.js';
import { validate } from '../sewn/validate.js';
import { contextNames, safeKey, reservedNames, MAXIMA, sourceTypes } from '../sewn/schema.js';
import { reads, methods } from '../sewn/bindings.js';
const types=sourceTypes;
const literal=value=>({op:'literal',value});
const typeOf=value=>value===null?'Null':Array.isArray(value)?'Array':({string:'String',number:'Number',boolean:'Boolean',object:'Object'})[typeof value];
const defaults={String:'',Number:0,Boolean:false,Null:null,Array:[],Object:{},Wydgit:null};
const canonical=(list,name)=>list.find(x=>x.toLowerCase()===name.toLowerCase());
export function compile(source) { return compileAst(parse(source)); }
// Event resolution is injected by preparation; standalone callers provide a registry.
export function compilePrototype(source) { return compileAst(parseModule(source),null,true); }
export function compileModule(source,{registry=new EventRegistry()}={}) { return compileAst(parseModule(source),registry); }
// Public compilation starts from source; AST lowering remains an internal stage.
function compileAst(ast,registry,prototype=false) {
  if(prototype&&ast.events.length)fail('TYPE','Prototype modules cannot declare EVENT blocks.',ast.events[0].location);
  let symbols=new Map();let declared=new Set();const procedures=Object.create(null),declarations=new Map(),graph=new Map();let current=null;const modern=ast.kind==='module';let objects=prototype;
  const error=(n,code,message)=>fail(code,message,n.location);
  const checkType=(n,actual,expected)=>{if(expected!=='Unknown'&&actual!=='Unknown'&&actual!==expected)error(n,'TYPE',`Expected ${expected}, received ${actual}.`);};
  const key=(n,k)=>{if(!safeKey(k.toLowerCase()))error(n,'UNSUPPORTED',`Reserved member '${k}'.`);return k;};
  const reserve=(n,name,type)=>{const id=name.toLowerCase();if(!/^[a-z_][a-z0-9_]{0,63}$/.test(id))error(n,'NAME','Variable names must contain at most 64 ASCII letters, digits or underscores.');if(reservedNames.includes(name.toUpperCase())||contextNames.includes(name.toUpperCase())||id==='services'||!safeKey(id))error(n,'NAME',`Reserved name '${name}'.`);if(declared.has(id))error(n,'NAME',`Duplicate declaration '${name}'.`);declared.add(id);symbols.set(id,{type,kind:type==='Wydgit'?'handle':null});return id;};
  const value=(sewn,type='Unknown',kind=null)=>({sewn,type,kind});
  let expressionDepth=0;
  function expression(n) {
    if(++expressionDepth>32)error(n,'COMPILE','Expression nesting exceeds SEWN limits.');
    try{return lowerExpression(n);}finally{expressionDepth--;}
  }
  function lowerExpression(n) {
    switch(n.kind) {
      case 'construct':{if(!/^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(n.prototype))error(n,'NAME','NEW requires a qualified prototype identity.');objects=true;const id=expression(n.id);checkType(n,id.type,'String');return value({op:'construct',type:n.prototype,id:id.sewn},'Wydgit','handle');}
      case 'literal':return value(literal(n.value),typeOf(n.value));
      case 'name':{const context=n.name.toUpperCase();if(contextNames.includes(context))return value({op:'context',name:context},['ME','PAGE'].includes(context)?'Wydgit':context==='SESSION'?'Object':'Facade',['ME','PAGE'].includes(context)?'handle':context==='SESSION'?null:context);if(context==='SERVICES')error(n,'UNSUPPORTED','SERVICES is available only through Call.');const s=symbols.get(n.name.toLowerCase());if(!s)error(n,'NAME',`Unknown variable '${n.name}'.`);return {...value({op:'variable',name:n.name.toLowerCase()},s.type,s.kind),element:s.element};}
      case 'array':{const items=n.items.map(expression);if(items.some(x=>x.kind))error(n,'TYPE','Array literals require JSON values.');return value({op:'array',items:items.map(x=>x.sewn)},'Array');}
      case 'object':{const fields=Object.create(null);for(const f of n.fields){key(f,f.key);if(Object.hasOwn(fields,f.key))error(f,'NAME',`Duplicate object key '${f.key}'.`);const v=expression(f.value);if(v.kind)error(f,'TYPE','Objects require JSON values.');fields[f.key]=v.sewn;}return value({op:'object',fields},'Object');}
      case 'member':{const target=expression(n.target);key(n,n.key);let name=n.key,type='Unknown',kind=null;
        if(target.kind){name=canonical(reads[target.kind]??[],name);if(!name)error(n,'UNSUPPORTED',`Unsupported ${target.kind} member '${n.key}'.`);
          if(['Query','Form'].includes(name)){kind='map';type='Facade';}else if(name==='Cookies'){kind=target.kind==='RESPONSE'?'cookieWrite':'cookieRead';type='Facade';}else if(name==='Headers'){kind='headers';type='Facade';}else if(['Source','Target'].includes(name)){kind='handle';type='Wydgit';}else if(['IsPost','Cancelable','Cancelled','Handled'].includes(name))type='Boolean';else if(['properties','Payload','Route'].includes(name))type='Object';else if(name==='Status')type='Number';else if(name!=='Value'&&!['OldValue','NewValue'].includes(name))type='String';
        }else if(!['Object','Unknown'].includes(target.type))error(n,'TYPE','Member reads require an Object or facade.');
        return value({op:'read',target:target.sewn,key:name},type,kind);}
      case 'invoke':{
        if(n.target.kind==='name'&&n.target.name.toUpperCase()==='NEWID'){if(n.args.length)error(n,'TYPE','NewId takes no arguments.');objects=true;return value({op:'newId'},'String');}
        if(n.target.kind==='name'&&modern)return procedureCall(n,'function');
        if(modern){const svc=service(n);if(svc)return value({...svc,op:'serviceCall'},'Object');}
        if(n.target.kind!=='member')error(n,'UNSUPPORTED','Only safe facade methods can be called.');const target=expression(n.target.target);key(n,n.target.key);const method=canonical(Object.keys(methods[target.kind]??{}),n.target.key);if(!method){if(target.kind!=='handle')error(n,'UNSUPPORTED',`Unsupported method '${n.target.key}'.`);objects=true;return value({op:'methodValue',target:target.sewn,name:n.target.key.toLowerCase(),args:n.args.map(x=>expression(x).sewn)});}const args=n.args.map(expression),arity=methods[target.kind][method];if(args.length<arity[0]||args.length>arity[1])error(n,'TYPE',`Invalid argument count for ${method}.`);args.forEach((v,i)=>{if(v.kind&&!(method==='Move'&&i===0||method==='Raise'&&i===1||method==='Insert'&&i===2||method==='Replace'&&i===0))error(n,'TYPE','This argument requires JSON data.');});
        let type='Unknown',kind=null;if(method==='related'){const relation=n.args[0];if(relation.kind!=='literal'||typeof relation.value!=='string')error(n,'TYPE','related requires a literal relationship.');if(relation.value==='children')type='Array';else{type='Wydgit';kind='handle';}}else if(['Set','Insert','Remove','Replace','Move','Cancel','Raise','WriteMarkdown','Delete'].includes(method))type='Null';else if(method==='GetAll')type='Array';
        return {...value({op:'invoke',target:target.sewn,method,args:args.map(x=>x.sewn)},type,kind),...(method==='related'&&type==='Array'?{element:'Wydgit'}:{})};}
      case 'unary':{const v=expression(n.value);checkType(n,v.type,n.operator==='NOT'?'Boolean':'Number');return value(n.operator==='NOT'?{op:'not',value:v.sewn}:n.operator==='+'?v.sewn:{op:'binary',operator:'-',left:literal(0),right:v.sewn},n.operator==='NOT'?'Boolean':'Number');}
      case 'binary':{const a=expression(n.left),b=expression(n.right),op=n.operator;if(a.kind||b.kind)error(n,'TYPE','Operators require JSON scalar values.');let type='Boolean';if(['AND','OR'].includes(op)){checkType(n,a.type,'Boolean');checkType(n,b.type,'Boolean');}else if(['+','-','*','/','&'].includes(op)){type=op==='&'?'String':'Number';checkType(n,a.type,type);checkType(n,b.type,type);}else{for(const v of [a,b])if(['Array','Object'].includes(v.type))error(n,'TYPE','Comparison requires scalar values.');if(!['=','<>'].includes(op)&&a.type!=='Unknown'&&b.type!=='Unknown'&&(a.type!==b.type||!['Number','String'].includes(a.type)))error(n,'TYPE','Ordering requires matching Numbers or Strings.');}return value({op:'binary',operator:op==='<>'?'!=':op==='&'?'concat':op,left:a.sewn,right:b.sewn},type);}
      default:error(n,'COMPILE','Unknown expression.');
    }
  }
  function procedureCall(n,kind){
    if(n.kind!=='invoke'||n.target.kind!=='name')error(n,'SYNTAX','CALL requires a named SUB invocation.');
    const name=n.target.name.toLowerCase(),proc=declarations.get(name);if(!proc)error(n,'NAME',`Unknown procedure '${n.target.name}'.`);
    if(proc.procedureKind!==kind)error(n,'TYPE',kind==='sub'?'A FUNCTION must be used as an expression.':'A SUB cannot be used as an expression.');
    if(n.args.length!==proc.params.length)error(n,'TYPE',`Wrong argument count for '${proc.name}'.`);
    const args=n.args.map(expression);args.forEach((arg,i)=>{if(!(proc.params[i].type==='Wydgit'&&arg.type==='Null'))checkType(n,arg.type,proc.params[i].type);if(arg.kind&&proc.params[i].type!=='Wydgit')error(n,'TYPE','Parameter requires portable data.');});
    if(current)graph.get(current.name.toLowerCase()).add(name);
    return value({op:kind==='sub'?'procedureCall':'functionCall',name,args:args.map(x=>x.sewn)},proc.returns??'Null',proc.returns==='Wydgit'?'handle':null);
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
      }else if(n.kind==='procedureCall'&&n.value.target?.kind==='name'){out.push(procedureCall(n.value,'sub').sewn);}
      else if(n.kind==='call'||n.kind==='procedureCall') {const svc=service(n.value);if(svc)out.push(svc);else{const v=expression(n.value);if(v.sewn.op==='methodValue'){out.push({...v.sewn,op:'methodCall'});continue;}if(v.sewn.op!=='invoke')error(n,'UNSUPPORTED','Expected method call.');out.push({op:'call',target:v.sewn.target,method:v.sewn.method,args:v.sewn.args});}}
      else if(n.kind==='if') {const condition=expression(n.condition);checkType(n,condition.type,'Boolean');const before=new Map(symbols);const then=body(n.then,inLoop);symbols=new Map(before);const otherwise=body(n.else,inLoop);symbols=before;out.push({op:'if',condition:condition.sewn,then,...(otherwise.length?{else:otherwise}:{})});}
      else if(n.kind==='forEach') {const items=expression(n.items);checkType(n,items.type,'Array');const before=new Map(symbols);const name=reserve(n,n.name,items.element??'Unknown');const children=body(n.body,true);symbols=before;out.push({op:'forEach',name,items:items.sewn,body:children});}
      else {
        if(current){
          if(n.kind==='stop')error(n,'UNSUPPORTED','STOP is workflow-only; use RETURN in a procedure.');
          if(current.procedureKind==='sub'&&n.value)error(n,'TYPE','A SUB must not return a value.');
          if(current.procedureKind==='function'&&!n.value)error(n,'TYPE','A FUNCTION must return a value.');
          if(n.value){const v=expression(n.value);if(!(current.returns==='Wydgit'&&v.type==='Null'))checkType(n,v.type,current.returns);if(v.kind&&current.returns!=='Wydgit')error(n,'TYPE','Result requires portable data.');out.push({op:'return',value:v.sewn});}
          else out.push({op:'return'});continue;
        }
        if(n.kind==='return'&&!n.value)error(n,'SYNTAX','Workflow RETURN requires a value.');
        const v=n.value?expression(n.value):value(literal(null),'Null');if(v.kind)error(n,'TYPE','RETURN/STOP requires JSON data.');out.push({op:n.kind,...(n.kind==='return'||n.value?{value:v.sewn}:{})});}
    }
    return out;
  }
  const validated=program=>{try{return validate(program);}catch{error(ast,'COMPILE','Generated workflow exceeds or violates canonical SEWN validation bounds.');}};
  if(!modern){const lowered=body(ast.body);return validated({schema:objects?'sewn/0.3':'sewn/0.1',...(objects?{procedures:{}}:{}),body:lowered});}
  for(const proc of ast.procedures){
    if(proc.params.length>MAXIMA.parameters)error(proc.params[MAXIMA.parameters],'COMPILE','Procedure parameter count exceeds SEWN limits.');
    const id=reserve(proc,proc.name,'Null');if(!/^[a-z][a-z0-9_]*$/.test(id))error(proc,'NAME','Procedure names must start with a letter.');
    proc.params=proc.params.map(param=>{const type=canonical(types,param.type);if(!type)error(param,'TYPE',`Unknown parameter type '${param.type}'.`);return {...param,type};});
    if(proc.returns){const type=canonical(types,proc.returns);if(!type)error(proc,'TYPE',`Unknown result type '${proc.returns}'.`);proc.returns=type;}
    declarations.set(id,proc);graph.set(id,new Set());
  }
  const reset=()=>{symbols=new Map();declared=new Set();};
  const returns=nodes=>nodes.some(n=>n.kind==='return'||n.kind==='if'&&returns(n.then)&&returns(n.else));
  for(const [id,proc] of declarations){reset();current=proc;for(const param of proc.params)reserve(param,param.name,param.type);
    const lowered=body(proc.body);if(proc.procedureKind==='function'&&!returns(proc.body))error(proc,'TYPE','FUNCTION may reach its end without a result.');
    procedures[id]={kind:proc.procedureKind,params:proc.params.map(p=>({name:p.name.toLowerCase(),type:p.type})),...(proc.returns?{returns:proc.returns}:{}),body:lowered};
  }
  current=null;
  const visited=new Set(),active=new Set();const visit=id=>{if(active.has(id))error(declarations.get(id),'NAME','Recursive procedure cycle is not supported.');if(visited.has(id))return;active.add(id);for(const next of graph.get(id))visit(next);active.delete(id);visited.add(id);};for(const id of graph.keys())visit(id);
  const eventNames=new Set(),events=[];
  for(const event of ast.events){
    let type;try{type=registry?.resolve(event.type);}catch{error(event,'NAME',`Unknown or ambiguous event '${event.type}'.`);}if(!type)error(event,'NAME','Module compilation requires an event registry.');
    if(eventNames.has(type))error(event,'NAME',`Duplicate EVENT '${type}'.`);eventNames.add(type);reset();const lowered=body(event.body);events.push({type,workflow:validated({schema:objects?'sewn/0.3':'sewn/0.2',procedures,body:lowered})});
  }
  // Even a declaration-only module is validated.
  const behavior=validated({schema:objects?'sewn/0.3':'sewn/0.2',procedures,body:[]});
  if(prototype)return behavior;
  return Object.freeze({events:Object.freeze(events.map(Object.freeze))});
}
