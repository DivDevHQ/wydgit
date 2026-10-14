import {regexOperationSignatures,doReservedNames,regexSignatures} from '../sewn/schema.js';
import {libraryScope,createLinker} from '../static-libraries/index.js';
import {constantTypes} from '../sewn/schema.js';
import {operationSignatures,conversionTargets} from '../sewn/schema.js';
import { EventRegistry } from '../events/registry.js';
import { parse,parseModule } from './parse.js';
import { fail } from './errors.js';
import { validate } from '../sewn/validate.js';
import { contextNames, safeKey, selectionReservedNames as reservedNames, MAXIMA, sourceTypes } from '../sewn/schema.js';
import { reads, methods } from '../sewn/bindings.js';
const types=[...sourceTypes,'Integer','Float','Scalar','DataType','DateTime'];
const numericTypes=['Number','Integer','Float'];
const literal=value=>({op:'literal',value});
const typeOf=value=>value===null?'Null':Array.isArray(value)?'Array':({string:'String',number:'Number',boolean:'Boolean',object:'Object'})[typeof value];
const defaults={String:'',Number:0,Integer:0,Float:0,Boolean:false,Null:null,Array:[],Object:{},Wydgit:null};
const canonical=(list,name)=>list.find(x=>x.toLowerCase()===name.toLowerCase());
export function compile(source,options={}) { return compileAst(parse(source),null,false,options); }
// Event resolution is injected by preparation; standalone callers provide a registry.
export function compilePrototype(source,options={}) { return compileAst(parseModule(source),null,true,options); }
export function compileModule(source,{registry=new EventRegistry(),...options}={}) { return compileAst(parseModule(source),registry,false,options); }
// Public compilation starts from source; AST lowering remains an internal stage.
function compileAst(ast,registry,prototype=false,options={}) {
  const imported=libraryScope(ast.imports??[],options),linker=createLinker((ast.procedures??[]).map(p=>p.name.toLowerCase()),imported.resolve),staticMode=options.static===true;
  const linked=staticMode||ast.imports?.length>0;
  if(prototype&&ast.events.length)fail('TYPE','Prototype modules cannot declare EVENT blocks.',ast.events[0].location);
  let symbols=new Map();let declared=new Set();const procedures=Object.create(null),declarations=new Map(),graph=new Map();let current=null;const modern=ast.kind==='module';let objects=prototype,versioned=false,members=false,control=false,conversion=false,exceptions=false,selection=false,numeric=false,contracts=false,operations=false,collections=false,regex=false,conditional=false;
  const error=(n,code,message)=>fail(code,message,n.location);
  const checkType=(n,actual,expected)=>{if(expected!=='Unknown'&&actual!=='Unknown'&&actual!==expected&&!(expected==='Scalar'&&['String','Number','Integer','Float','Boolean','DateTime'].includes(actual))&&!(numericTypes.includes(actual)&&numericTypes.includes(expected)))error(n,'TYPE',`Expected ${expected}, received ${actual}.`);};
  const key=(n,k)=>{if(!safeKey(k.toLowerCase()))error(n,'UNSUPPORTED',`Reserved member '${k}'.`);return k;};
  const reserve=(n,name,type)=>{const id=name.toLowerCase();if(!/^[a-z_][a-z0-9_]{0,63}$/.test(id))error(n,'NAME','Variable names must contain at most 64 ASCII letters, digits or underscores.');if((doReservedNames.includes(name.toUpperCase())&&!(staticMode&&['CSTR','VAL'].includes(name.toUpperCase())))||['ISINTEGER','ISSAFEINTEGER','TYPEOF','SCALAR','DATATYPE','DATETIME'].includes(name.toUpperCase())||(reservedNames.includes(name.toUpperCase())&&!(staticMode&&['CSTR','VAL'].includes(name.toUpperCase())))||contextNames.includes(name.toUpperCase())||id==='services'||!safeKey(id))error(n,'NAME',`Reserved name '${name}'.`);if(imported.aliases.has(id))error(n,'NAME','Library alias conflicts with a local declaration.');if(declared.has(id))error(n,'NAME',`Duplicate declaration '${name}'.`);declared.add(id);symbols.set(id,{type,kind:type==='Wydgit'?'handle':null});return id;};
  const constrain=(n,v,type)=>{if(collections&&sourceTypes.includes(type)&&type!=='Wydgit')return {op:'typeCheck',type,value:v};if(['Scalar','DataType','DateTime'].includes(type)){contracts=true;return {op:'typeCheck',type,value:v};}if(!['Integer','Float'].includes(type))return v;numeric=true;if(v.op==='literal'&&!(type==='Integer'?Number.isSafeInteger(v.value):typeof v.value==='number'&&Number.isFinite(v.value)))error(n,'TYPE',`Invalid ${type} value.`);return {op:'numericCheck',type,value:v};};
  const value=(sewn,type='Unknown',kind=null)=>({sewn,type,kind});
  let expressionDepth=0,numericContext=false;
  const constrainedExpression=(n,type)=>{const previous=numericContext;numericContext=['Integer','Float'].includes(type)?type:false;try{return expression(n);}finally{numericContext=previous;}};
  function expression(n) {
    if(++expressionDepth>32)error(n,'COMPILE','Expression nesting exceeds SEWN limits.');
    try{return lowerExpression(n);}finally{expressionDepth--;}
  }
  function lowerExpression(n) {
    switch(n.kind) {
      case 'identity':{selection=true;const a=expression(n.left),b=expression(n.right);for(const v of [a,b])if(v.type!=='Null'&&v.kind!=='handle')error(n,'TYPE','Identity requires Wydgit references or NULL.');return value({op:'identity',left:a.sewn,right:b.sewn,negate:n.negate},'Boolean');}
      case 'isNull':{control=true;const v=expression(n.value);if(v.kind&&v.kind!=='handle')error(n,'TYPE','Null tests require data or a Wydgit reference.');return value({op:'isNull',value:v.sewn,negate:n.negate},'Boolean');}
      case 'construct':{if(!/^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(n.prototype))error(n,'NAME','NEW requires a qualified prototype identity.');objects=true;const id=expression(n.id);checkType(n,id.type,'String');return value({op:'construct',type:n.prototype,id:id.sewn},'Wydgit','handle');}
      case 'literal':return value(literal(n.value),typeof n.value==='number'&&numericContext?(numericContext==='Float'?'Float':Number.isSafeInteger(n.value)?'Integer':'Float'):typeOf(n.value));
      case 'name':{const descriptor=canonical(types,n.name);if(descriptor&&!symbols.has(n.name.toLowerCase())){contracts=true;return value({op:'typeLiteral',type:descriptor},'DataType');}const context=n.name.toUpperCase();if(staticMode&&context==='ME')error(n,'TYPE','Static procedures have no Me.');if(contextNames.includes(context))return value({op:'context',name:context},['ME','PAGE'].includes(context)?'Wydgit':context==='SESSION'?'Object':'Facade',['ME','PAGE'].includes(context)?'handle':context==='SESSION'?null:context);if(context==='SERVICES')error(n,'UNSUPPORTED','SERVICES is available only through Call.');const s=symbols.get(n.name.toLowerCase());if(!s)error(n,'NAME',`Unknown variable '${n.name}'.`);return {...value({op:'variable',name:n.name.toLowerCase()},s.type,s.kind),element:s.element};}
      case 'array':{const items=n.items.map(expression);if(items.some(x=>x.kind))error(n,'TYPE','Array literals require JSON values.');return value({op:'array',items:items.map(x=>x.sewn)},'Array');}
      case 'object':{const fields=Object.create(null);for(const f of n.fields){key(f,f.key);if(Object.hasOwn(fields,f.key))error(f,'NAME',`Duplicate object key '${f.key}'.`);const v=expression(f.value);if(v.kind)error(f,'TYPE','Objects require JSON values.');fields[f.key]=v.sewn;}return value({op:'object',fields},'Object');}
      case 'index':{collections=true;const target=expression(n.target),position=constrainedExpression(n.index,'Integer');checkType(n,target.type,'Array');checkType(n,position.type,'Integer');if(target.kind||target.element==='Wydgit')error(n,'TYPE','Indexed reads require portable data arrays.');if(position.sewn.op==='literal'&&(!Number.isSafeInteger(position.sewn.value)||position.sewn.value<0))error(n,'TYPE','Index must be a nonnegative safe Integer.');return value({op:'index',target:target.sewn,index:position.sewn});}
      case 'member':{const target=expression(n.target);key(n,n.key);let name=n.key,type='Unknown',kind=null;
        if(target.kind==='handle'&&(n.exact||!canonical(reads.handle,n.key))){members=true;return value({op:'memberRead',target:target.sewn,name:n.key,exact:n.exact===true});}
        if(target.kind){name=canonical(reads[target.kind]??[],name);if(!name)error(n,'UNSUPPORTED',`Unsupported ${target.kind} member '${n.key}'.`);
          if(['Query','Form'].includes(name)){kind='map';type='Facade';}else if(name==='Cookies'){kind=target.kind==='RESPONSE'?'cookieWrite':'cookieRead';type='Facade';}else if(name==='Headers'){kind='headers';type='Facade';}else if(['Source','Target'].includes(name)){kind='handle';type='Wydgit';}else if(['IsPost','Cancelable','Cancelled','Handled'].includes(name))type='Boolean';else if(['properties','Payload','Route'].includes(name))type='Object';else if(name==='Status')type='Number';else if(name!=='Value'&&!['OldValue','NewValue'].includes(name))type='String';
        }else if(!['Object','Unknown'].includes(target.type))error(n,'TYPE','Member reads require an Object or facade.');
        return value({op:'read',target:target.sewn,key:name},type,kind);}
      case 'invoke':{
        const local=n.target.kind==='name'&&declarations.has(n.target.name.toLowerCase());
        const candidate=local||n.target.kind==='name'&&canonical(Object.keys(regexSignatures),n.target.name)?null:imported.lookup(n.target);
        if(n.target.kind==='member'&&n.target.target.kind==='name'&&imported.aliases.has(n.target.target.name.toLowerCase())&&symbols.has(n.target.target.name.toLowerCase()))error(n,'NAME','Library alias conflicts with a local declaration.');
        if(local&&['CSTR','VAL'].includes(n.target.name.toUpperCase()))return procedureCall(n,'function');
        if(candidate)return staticCall(n,'function',candidate);
        if(n.target.kind==='name'&&n.target.name.toUpperCase()==='CONVERT'){
          operations=true;if(n.args.length!==2)error(n,'TYPE','Convert requires two arguments.');
          const target=expression(n.args[1]);if(target.sewn.op!=='typeLiteral'||!conversionTargets.includes(target.sewn.type))error(n,'TYPE','Convert requires a supported static DataType descriptor.');
          const arg=expression(n.args[0]),type=target.sewn.type;
          const allowed=type==='String'?['String',...numericTypes,'Boolean','DateTime']:numericTypes.includes(type)?['String',...numericTypes]:type==='Boolean'?['String','Boolean']:['String','DateTime'];
          if(arg.kind||!['Unknown','Scalar',...allowed].includes(arg.type))error(n,'TYPE','Unsupported conversion input.');
          return value({op:'convert',mode:'canonical',type,value:arg.sewn},type);
        }
        if(n.target.kind==='name'){
          const name=canonical(Object.keys(regexOperationSignatures),n.target.name);
          if(name){if(Object.hasOwn(regexSignatures,name)){regex=true;collections=true;}operations=true;const signature=regexOperationSignatures[name];if(n.args.length!==signature.length)error(n,'TYPE','Invalid canonical operation arity.');
            const args=n.args.map(expression),shared=['Length','Contains','IndexOf'].includes(name);
            const extended=['Slice','Join','Split'].includes(name)||shared&&args[0].type!=='String';if(extended)collections=true;
            args.forEach((arg,i)=>{
              if(arg.kind||arg.element==='Wydgit')error(n,'TYPE','Canonical operations require portable data.');
              const expected=shared&&!extended?operationSignatures[name][i]:signature[i];
              if(expected==='Collection'){if(!['String','Array','Unknown'].includes(arg.type))error(n,'TYPE','Expected String or Array.');}
              else if(expected==='Value'){if(['Array','Object','Wydgit','Facade'].includes(arg.type))error(n,'TYPE','Collection search requires a comparable scalar.');}
              else checkType(n,arg.type,expected);
              if(expected==='Integer'&&arg.sewn.op==='literal'&&!Number.isSafeInteger(arg.sewn.value))error(n,'TYPE','Integer argument required.');
            });
            const result=name==='RegexMatch'?'Unknown':name==='RegexTest'?'Boolean':['RegexMatches','RegexSplit'].includes(name)?'Array':name==='RegexReplace'?'String':['Length','IndexOf','LastIndexOf','Sign'].includes(name)?'Integer':['StartsWith','EndsWith','Contains'].includes(name)?'Boolean':['Split','Slice'].includes(name)?'Array':name==='Join'||signature[0]==='String'?'String':name==='Sqrt'?'Float':name==='Power'?'Number':args.every(x=>x.type==='Integer')?'Integer':'Number';
            return {...value({op:'operation',name,args:args.map(x=>x.sewn)},result),...(signature[0]==='Number'?{numeric:true}:{})};
          }
        }

        if(n.target.kind==='name'&&['TYPEOF','DATETIME'].includes(n.target.name.toUpperCase())){contracts=true;if(n.args.length!==1)error(n,'TYPE','Intrinsic requires one argument.');const arg=expression(n.args[0]);const inspect=n.target.name.toUpperCase()==='TYPEOF';if(inspect){if(arg.kind&&arg.kind!=='handle')error(n,'TYPE','TypeOf requires data or a Wydgit reference.');}else checkType(n,arg.type,'String');return value({op:inspect?'typeOf':'dateTime',value:arg.sewn},inspect?'DataType':'DateTime');}
        if(n.target.kind==='name'&&['ISINTEGER','ISSAFEINTEGER'].includes(n.target.name.toUpperCase())){if(n.args.length!==1)error(n,'TYPE','Numeric predicate requires one argument.');numeric=true;const arg=expression(n.args[0]);if(arg.kind)error(n,'TYPE','Numeric predicates require portable data.');return value({op:'numericPredicate',predicate:n.target.name.toUpperCase()==='ISINTEGER'?'IsInteger':'IsSafeInteger',value:arg.sewn},'Boolean');}
        if(n.target.kind==='name'&&['CSTR','VAL'].includes(n.target.name.toUpperCase())){
          const method=n.target.name.toUpperCase();if(n.args.length!==1)error(n,'TYPE',method+' requires exactly one argument.');
          const arg=expression(n.args[0]),allowed=method==='CSTR'?['String','Number','Integer','Float','Boolean','Unknown']:['String','Number','Integer','Float','Unknown'];
          if(arg.kind||!allowed.includes(arg.type))error(n,'TYPE',method+' requires primitive data.');
          conversion=true;const type=method==='CSTR'?'String':'Number';return value({op:'convert',type,value:arg.sewn},type);
        }
        if(n.target.kind==='name'&&n.target.name.toUpperCase()==='NEWID'){if(n.args.length)error(n,'TYPE','NewId takes no arguments.');objects=true;return value({op:'newId'},'String');}
        if(n.target.kind==='name'&&(modern||linked))return procedureCall(n,'function');
        if(modern){const svc=service(n);if(svc)return value({...svc,op:svc.op==='canonicalService'?'canonicalServiceCall':'serviceCall'},'Object');}
        if(n.target.kind!=='member')error(n,'UNSUPPORTED','Only safe facade methods can be called.');const target=expression(n.target.target);key(n,n.target.key);const method=n.target.exact?null:canonical(Object.keys(methods[target.kind]??{}),n.target.key);if(!method){if(target.kind!=='handle')error(n,'UNSUPPORTED',`Unsupported method '${n.target.key}'.`);objects=true;if(n.target.exact)members=true;return value({op:'methodValue',target:target.sewn,name:n.target.exact?n.target.key:n.target.key.toLowerCase(),...(n.target.exact?{exact:true}:{}),args:n.args.map(x=>expression(x).sewn)});}const args=n.args.map(expression),arity=methods[target.kind][method];if(args.length<arity[0]||args.length>arity[1])error(n,'TYPE',`Invalid argument count for ${method}.`);args.forEach((v,i)=>{if(v.kind&&!(method==='Move'&&i===0||method==='Raise'&&i===1||method==='Insert'&&i===2||method==='Replace'&&i===0))error(n,'TYPE','This argument requires JSON data.');});
        let type='Unknown',kind=null;if(method==='related'){const relation=n.args[0];if(relation.kind!=='literal'||typeof relation.value!=='string')error(n,'TYPE','related requires a literal relationship.');if(relation.value==='children')type='Array';else{type='Wydgit';kind='handle';}}else if(['Set','Insert','Remove','Replace','Move','Cancel','Raise','WriteMarkdown','Delete'].includes(method))type='Null';else if(method==='GetAll')type='Array';
        return {...value({op:'invoke',target:target.sewn,method,args:args.map(x=>x.sewn)},type,kind),...(method==='related'&&type==='Array'?{element:'Wydgit'}:{})};}
      case 'unary':{const v=expression(n.value);checkType(n,v.type,n.operator==='NOT'?'Boolean':'Number');if(numericContext&&n.operator!=='NOT'&&v.sewn.op==='literal')return value(literal(n.operator==='-'?-v.sewn.value:v.sewn.value),v.type);return {...value(n.operator==='NOT'?{op:'not',value:v.sewn}:n.operator==='+'?v.sewn:{op:(['Integer','Float'].includes(v.type)||v.numeric)?'numeric':'binary',operator:'-',left:literal(0),right:v.sewn,...((['Integer','Float'].includes(v.type)||v.numeric)?{type:['Integer','Float'].includes(v.type)?v.type:'Auto'}:{})},n.operator==='NOT'?'Boolean':numericTypes.includes(v.type)?v.type:'Number'),...(n.operator!=='NOT'&&v.numeric?{numeric:true}:{})};}
      case 'binary':{const a=expression(n.left),b=expression(n.right),op=n.operator;if(a.kind||b.kind)error(n,'TYPE','Operators require JSON scalar values.');const computed=numericBinary(n,a,b);if(computed)return computed;let type='Boolean';if(['AND','OR'].includes(op)){checkType(n,a.type,'Boolean');checkType(n,b.type,'Boolean');}else if(['+','-','*','/','&'].includes(op)){type=op==='&'?'String':'Number';checkType(n,a.type,type);checkType(n,b.type,type);}else{if([a.type,b.type].includes('DateTime')&&a.type!==b.type&&![a.type,b.type].includes('Unknown')&&![a.type,b.type].includes('Null'))error(n,'TYPE','DateTime comparison requires DateTime.');for(const v of [a,b])if(['Array','Object'].includes(v.type))error(n,'TYPE','Comparison requires scalar values.');if(!['=','<>'].includes(op)&&a.type!=='Unknown'&&b.type!=='Unknown'&&(a.type!==b.type&&!(numericTypes.includes(a.type)&&numericTypes.includes(b.type))||![...numericTypes,'String','DateTime'].includes(a.type)))error(n,'TYPE','Ordering requires matching Numbers or Strings.');}return value({op:'binary',operator:op==='<>'?'!=':op==='&'?'concat':op,left:a.sewn,right:b.sewn},type);}
      default:error(n,'COMPILE','Unknown expression.');
    }
  }
  function numericBinary(n,a,b) {
    const op=n.operator;
    if(op==='XOR') {
      numeric=true;checkType(n,a.type,'Boolean');checkType(n,b.type,'Boolean');
      return value({op:'xor',left:a.sewn,right:b.sewn},'Boolean');
    }
    const integerOnly=['MOD','\\'].includes(op);
    const checked=integerOnly||op==='^'||['+','-','*','/'].includes(op)&&
      (numericContext||a.numeric||b.numeric||[a.type,b.type].some(t=>['Integer','Float'].includes(t)));
    if(!checked)return null;
    numeric=true;checkType(n,a.type,'Number');checkType(n,b.type,'Number');
    if(integerOnly&&[a,b].some(v=>v.sewn.op==='literal'&&!Number.isSafeInteger(v.sewn.value)))
      error(n,'TYPE','Integer operands required.');
    const category=v=>v.type==='Number'&&v.sewn.op==='literal'?(Number.isSafeInteger(v.sewn.value)?'Integer':'Float'):v.type;
    const categories=[a,b].map(category);
    const type=integerOnly?'Integer':op==='/'?'Float':op==='^'?'Auto':
      categories.includes('Float')?'Float':categories.every(t=>t==='Integer')?'Integer':'Auto';
    return {...value({op:'numeric',operator:op,left:a.sewn,right:b.sewn,type},type==='Auto'?'Number':type),numeric:true};
  }
  function procedureCall(n,kind){
    if(n.kind!=='invoke'||n.target.kind!=='name')error(n,'SYNTAX','CALL requires a named SUB invocation.');
    const name=n.target.name.toLowerCase(),proc=declarations.get(name);if(!proc){const candidate=imported.lookup(n.target);if(candidate)return staticCall(n,kind,candidate);}if(!proc)error(n,'NAME',`Unknown procedure '${n.target.name}'.`);
    if(proc.procedureKind!==kind)error(n,'TYPE',kind==='sub'?'A FUNCTION must be used as an expression.':'A SUB cannot be used as an expression.');
    if(n.args.length!==proc.params.length)error(n,'TYPE',`Wrong argument count for '${proc.name}'.`);
    const args=n.args.map((arg,i)=>constrainedExpression(arg,proc.params[i].type));args.forEach((arg,i)=>{if(!(proc.params[i].type==='Wydgit'&&arg.type==='Null'))checkType(n,arg.type,proc.params[i].type);if(arg.kind&&proc.params[i].type!=='Wydgit')error(n,'TYPE','Parameter requires portable data.');});
    if(current)graph.get(current.name.toLowerCase()).add(name);
    return value({op:kind==='sub'?'procedureCall':'functionCall',name,args:args.map((x,i)=>constrain(n.args[i],x.sewn,proc.params[i].type))},proc.returns??'Null',proc.returns==='Wydgit'?'handle':null);
  }
  function staticCall(n,kind,candidate){
    const proc=candidate.definition.behavior.procedures[candidate.name];
    if(proc.kind!==kind)error(n,'TYPE','Invalid static invocation kind.');
    if(n.args.length!==proc.params.length)error(n,'TYPE','Invalid static argument count.');
    const args=n.args.map((arg,i)=>constrainedExpression(arg,proc.params[i].type));
    args.forEach((arg,i)=>{if(!(proc.params[i].type==='Wydgit'&&arg.type==='Null'))checkType(n,arg.type,proc.params[i].type);if(arg.kind&&proc.params[i].type!=='Wydgit')error(n,'TYPE','Static parameter requires portable data.');});
    return value({op:kind==='sub'?'procedureCall':'functionCall',name:linker.link(candidate.definition,candidate.name),args:args.map(x=>x.sewn)},proc.returns??'Null',proc.returns==='Wydgit'?'handle':null);
  }
  function service(n) {
    if(n?.kind!=='invoke'||n.target.kind!=='member'||n.target.target.kind!=='name'||n.target.target.name.toUpperCase()!=='SERVICES')return null;
    const canonical=n.target.key.toUpperCase()==='INVOKE';
    if(canonical?n.args.length!==4:n.target.key.toUpperCase()!=='CALL'||n.args.length!==3)error(n,'UNSUPPORTED','Use SERVICES.Call(library, method, input) or SERVICES.Invoke(library, apiVersion, method, input).');
    const [library,apiVersion,method,input]=canonical?n.args:[n.args[0],null,n.args[1],n.args[2]];
    if(canonical){if(apiVersion.kind!=='literal'||typeof apiVersion.value!=='string'||!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(apiVersion.value))error(n,'TYPE','Service API version must be an exact literal version.');versioned=true;}if([library,method].some(x=>x.kind!=='literal'||typeof x.value!=='string'))error(n,'TYPE','Service library and method must be literal strings.');
    if(!/^[a-z][a-z0-9-]*$/.test(library.value)||!safeKey(method.value.toLowerCase())||!method.value)error(n,'UNSUPPORTED','Invalid canonical service identity.');const v=expression(input);if(v.kind)error(n,'TYPE','Service input requires JSON data.');return {op:canonical?'canonicalService':'service',...(canonical?{apiVersion:apiVersion.value}:{}),library:library.value,method:method.value,input:v.sewn};
  }
  function body(nodes,inLoop=false,inDo=false) {
    const out=[];
    for(const n of nodes) {
      if(n.kind==='declare'||n.kind==='constant') {
        const immutable=n.kind==='constant';if(immutable)collections=true;
        if(inLoop||inDo)error(n,'UNSUPPORTED','Declarations inside loops are deferred; SEWN declarations live for the invocation.');
        const svc=service(n.value);let v=n.value&&!svc?constrainedExpression(n.value,canonical(types,n.type??'')):null;
        const explicit=n.type&&canonical(types,n.type);if(n.type&&!explicit)error(n,'TYPE',`Unknown type '${n.type}'.`);
        const type=explicit??(svc?'Object':v?.type);if(!type||type==='Facade')error(n,'TYPE','Declaration requires a data type or initializer.');
        if(explicit==='Wydgit'&&v?.type==='Unknown')error(n,'TYPE','A Wydgit initializer requires a known handle or NULL.');
        if(explicit&&v&&!(explicit==='Wydgit'&&v.type==='Null'))checkType(n,v.type,explicit);
        if(immutable&&(!constantTypes.includes(type)||v?.kind||svc))error(n,'TYPE','CONST requires a scalar or descriptor initializer.');
        if(['Scalar','DataType','DateTime'].includes(type)&&!v)error(n,'TYPE',type+' requires an initializer.');const name=reserve(n,n.name,type);if(immutable)symbols.get(name).immutable=true;if(v?.element)symbols.get(name).element=v.element;if(svc){if(type!=='Object')error(n,'TYPE','Service result is an Object.');out.push({...svc,into:name});}else out.push({op:immutable?'constant':'declare',name,...(immutable?{type}:{}),value:constrain(n,v?.sewn??literal(defaults[type]),type)});
      }else if(n.kind==='select'){selection=true;const selector=expression(n.value);if(selector.kind&&selector.kind!=='handle'||['Array','Object'].includes(selector.type))error(n,'TYPE','Selection requires a scalar or Wydgit reference.');const before=new Map(symbols);const cases=n.cases.map(branch=>{symbols=new Map(before);const tests=branch.tests.map(test=>{const v=expression(test.value),identity=test.operator.startsWith('IS');if(identity){for(const x of [selector,v])if(x.type!=='Null'&&x.kind!=='handle')error(n,'TYPE','Identity cases require Wydgit references or NULL.');}else{if([selector.type,v.type].includes('DateTime')&&selector.type!==v.type&&![selector.type,v.type].includes('Unknown')&&![selector.type,v.type].includes('Null'))error(n,'TYPE','DateTime comparison requires DateTime.');if(selector.kind||v.kind||['Array','Object'].includes(v.type))error(n,'TYPE','Value cases require scalars.');if(!['=','<>'].includes(test.operator)&&selector.type!=='Unknown'&&v.type!=='Unknown'&&(selector.type!==v.type&&!(numericTypes.includes(selector.type)&&numericTypes.includes(v.type))||![...numericTypes,'String','DateTime'].includes(v.type)))error(n,'TYPE','Ordering requires matching Numbers or Strings.');}return {operator:test.operator==='<>'?'!=':test.operator,value:v.sewn};});return {tests,body:body(branch.body,inLoop,inDo)};});symbols=new Map(before);const otherwise=n.else===null?null:body(n.else,inLoop,inDo);symbols=before;out.push({op:'select',value:selector.sewn,cases,...(otherwise!==null?{else:otherwise}:{})});
      }else if(n.kind==='try'){exceptions=true;const before=new Map(symbols),children=body(n.body,inLoop,inDo);symbols=new Map(before);let handler;if(n.handler){const name=reserve(n,n.handler.name,'Object');handler={name,body:body(n.handler.body,inLoop,inDo)};declared.delete(name);symbols=new Map(before);}const cleanup=n.cleanup===null?null:body(n.cleanup,inLoop,inDo);symbols=before;out.push({op:'try',body:children,...(handler?{catch:handler}:{}),...(cleanup!==null?{finally:cleanup}:{})});
      }else if(n.kind==='do'){conditional=true;collections=true;const condition=expression(n.condition);checkType(n,condition.type,'Boolean');if(condition.kind)error(n,'TYPE','DO requires Boolean data.');const before=new Map(symbols);const children=body(n.body,inLoop,true);symbols=before;out.push({op:'do',mode:n.mode,condition:condition.sewn,body:children});
      }else if(n.kind==='exitDo'){if(!inDo)error(n,'TYPE','EXIT DO requires an enclosing DO in this procedure.');conditional=true;out.push({op:'exitDo'});
      }else if(n.kind==='exitFor'){if(!inLoop)error(n,'TYPE','EXIT FOR requires an enclosing FOR in this procedure.');control=true;out.push({op:'exitFor'});
      }else if(n.kind==='memberSet'){const target=expression(n.target.target);if(target.kind!=='handle')error(n,'TYPE','Member assignment requires a Wydgit reference.');key(n,n.target.key);const v=expression(n.value);if(v.kind)error(n,'TYPE','Property values require JSON data.');members=true;out.push({op:'memberSet',target:target.sewn,name:n.target.key,exact:n.target.exact===true,value:v.sewn});
      }else if(n.kind==='set') {
        const s=symbols.get(n.name.toLowerCase());if(!s)error(n,'NAME',`Unknown variable '${n.name}'.`);if(s.immutable)error(n,'TYPE','Cannot rebind an immutable name.');if(n.reference!==(s.type==='Wydgit'))error(n,'TYPE',s.type==='Wydgit'?'Wydgit assignment requires SET.':'SET requires a Wydgit variable.');
        const v=constrainedExpression(n.value,s.type);if(s.type==='Wydgit'&&v.type==='Unknown')error(n,'TYPE','SET requires a known handle or NULL.');if(!(s.type==='Wydgit'&&v.type==='Null'))checkType(n,v.type,s.type);if(s.type!=='Wydgit'&&v.kind)error(n,'TYPE','Reference requires a Wydgit variable.');out.push({op:'set',name:n.name.toLowerCase(),value:constrain(n,v.sewn,s.type)});
      }else if(n.kind==='procedureCall'&&n.value.target?.kind==='member'&&imported.lookup(n.value.target)){out.push(staticCall(n.value,'sub',imported.lookup(n.value.target)).sewn);}
      else if(n.kind==='procedureCall'&&n.value.target?.kind==='name'){out.push(procedureCall(n.value,'sub').sewn);}
      else if(n.kind==='call'||n.kind==='procedureCall') {const svc=service(n.value);if(svc)out.push(svc);else{const v=expression(n.value);if(v.sewn.op==='methodValue'){out.push({...v.sewn,op:'methodCall'});continue;}if(v.sewn.op!=='invoke')error(n,'UNSUPPORTED','Expected method call.');out.push({op:'call',target:v.sewn.target,method:v.sewn.method,args:v.sewn.args});}}
      else if(n.kind==='if') {const condition=expression(n.condition);checkType(n,condition.type,'Boolean');const before=new Map(symbols);const then=body(n.then,inLoop,inDo);symbols=new Map(before);const otherwise=body(n.else,inLoop,inDo);symbols=before;out.push({op:'if',condition:condition.sewn,then,...(otherwise.length?{else:otherwise}:{})});}
      else if(n.kind==='forNumeric') {collections=true;
        const args=[n.start,n.end,n.step].map(x=>constrainedExpression(x,'Integer'));args.forEach(arg=>{checkType(n,arg.type,'Number');if(arg.kind)error(n,'TYPE','Numeric loop requires numbers.');});
        if(args[2].sewn.op==='literal'&&args[2].sewn.value===0)error(n,'TYPE','STEP must be nonzero.');
        const before=new Map(symbols),name=reserve(n,n.name,args.every(v=>v.type==='Integer')?'Integer':args.some(v=>v.type==='Float')?'Float':'Number');symbols.get(name).immutable=true;
        const children=body(n.body,true,inDo);symbols=before;declared.delete(name);out.push({op:'forNumeric',name,start:args[0].sewn,end:args[1].sewn,step:args[2].sewn,body:children});
      }
      else if(n.kind==='forEach') {const items=expression(n.items);checkType(n,items.type,'Array');const before=new Map(symbols);const name=reserve(n,n.name,items.element??'Unknown');const children=body(n.body,true,inDo);symbols=before;out.push({op:'forEach',name,items:items.sewn,body:children});}
      else {
        if(current){
          if(n.kind==='stop')error(n,'UNSUPPORTED','STOP is workflow-only; use RETURN in a procedure.');
          if(current.procedureKind==='sub'&&n.value)error(n,'TYPE','A SUB must not return a value.');
          if(current.procedureKind==='function'&&!n.value)error(n,'TYPE','A FUNCTION must return a value.');
          if(n.value){const v=constrainedExpression(n.value,current.returns);if(!(current.returns==='Wydgit'&&v.type==='Null'))checkType(n,v.type,current.returns);if(v.kind&&current.returns!=='Wydgit')error(n,'TYPE','Result requires portable data.');out.push({op:'return',value:constrain(n,v.sewn,current.returns)});}
          else out.push({op:'return'});continue;
        }
        if(n.kind==='return'&&!n.value)error(n,'SYNTAX','Workflow RETURN requires a value.');
        const v=n.value?expression(n.value):value(literal(null),'Null');if(v.kind)error(n,'TYPE','RETURN/STOP requires JSON data.');out.push({op:n.kind,...(n.kind==='return'||n.value?{value:v.sewn}:{})});}
    }
    return out;
  }
  const validated=program=>{try{return linked?linker.finish(program):validate(program);}catch{error(ast,'COMPILE','Generated workflow exceeds or violates canonical SEWN validation bounds.');}};
  if(!modern){const lowered=body(ast.body);return validated({schema:conditional?'sewn/0.16':regex?'sewn/0.15':collections?'sewn/0.13':operations?'sewn/0.12':contracts?'sewn/0.11':numeric?'sewn/0.10':selection?'sewn/0.9':exceptions?'sewn/0.8':conversion?'sewn/0.7':control?'sewn/0.6':members?'sewn/0.5':versioned?'sewn/0.4':objects?'sewn/0.3':'sewn/0.1',...((objects||versioned||members||control||conversion||exceptions||selection||numeric||contracts||operations||collections||regex)?{procedures:{}}:{}),body:lowered});}
  for(const proc of ast.procedures){
    if(proc.params.length>MAXIMA.parameters)error(proc.params[MAXIMA.parameters],'COMPILE','Procedure parameter count exceeds SEWN limits.');
    const id=reserve(proc,proc.name,'Null');if(!/^[a-z][a-z0-9_]*$/.test(id))error(proc,'NAME','Procedure names must start with a letter.');
    proc.params=proc.params.map(param=>{const type=canonical(types,param.type);if(!type)error(param,'TYPE',`Unknown parameter type '${param.type}'.`);if(['Scalar','DataType','DateTime'].includes(type))contracts=true;if(['Integer','Float'].includes(type))numeric=true;return {...param,type};});
    if(proc.returns){const type=canonical(types,proc.returns);if(!type)error(proc,'TYPE',`Unknown result type '${proc.returns}'.`);if(['Scalar','DataType','DateTime'].includes(type))contracts=true;if(['Integer','Float'].includes(type))numeric=true;proc.returns=type;}
    declarations.set(id,proc);graph.set(id,new Set());
  }
  const reset=()=>{symbols=new Map();declared=new Set();};
  const returns=nodes=>nodes.some(n=>n.kind==='return'||n.kind==='select'&&n.else!==null&&returns(n.else)&&n.cases.every(b=>returns(b.body))||n.kind==='if'&&returns(n.then)&&returns(n.else)||n.kind==='try'&&(n.cleanup&&returns(n.cleanup)||returns(n.body)&&(!n.handler||returns(n.handler.body))));
  for(const [id,proc] of declarations){reset();current=proc;for(const param of proc.params)reserve(param,param.name,param.type);
    const lowered=body(proc.body);if(proc.procedureKind==='function'&&!returns(proc.body))error(proc,'TYPE','FUNCTION may reach its end without a result.');
    procedures[id]={kind:proc.procedureKind,params:proc.params.map(p=>({name:p.name.toLowerCase(),type:p.type})),...(proc.returns?{returns:proc.returns}:{}),body:lowered};
  }
  current=null;
  const visited=new Set(),active=new Set();const visit=id=>{if(active.has(id))error(declarations.get(id),'NAME','Recursive procedure cycle is not supported.');if(visited.has(id))return;active.add(id);for(const next of graph.get(id))visit(next);active.delete(id);visited.add(id);};if(!linked)for(const id of graph.keys())visit(id);
  const eventNames=new Set(),events=[];
  for(const event of ast.events){
    let type;try{type=registry?.resolve(event.type);}catch{error(event,'NAME',`Unknown or ambiguous event '${event.type}'.`);}if(!type)error(event,'NAME','Module compilation requires an event registry.');
    if(eventNames.has(type))error(event,'NAME',`Duplicate EVENT '${type}'.`);eventNames.add(type);reset();const lowered=body(event.body);events.push({type,workflow:validated({schema:conditional?'sewn/0.16':regex?'sewn/0.15':collections?'sewn/0.13':operations?'sewn/0.12':contracts?'sewn/0.11':numeric?'sewn/0.10':selection?'sewn/0.9':exceptions?'sewn/0.8':conversion?'sewn/0.7':control?'sewn/0.6':members?'sewn/0.5':versioned?'sewn/0.4':objects?'sewn/0.3':'sewn/0.2',procedures,body:lowered})});
  }
  // Even a declaration-only module is validated.
  const behavior=validated({schema:conditional?'sewn/0.16':regex?'sewn/0.15':collections?'sewn/0.13':operations?'sewn/0.12':contracts?'sewn/0.11':numeric?'sewn/0.10':selection?'sewn/0.9':exceptions?'sewn/0.8':conversion?'sewn/0.7':control?'sewn/0.6':members?'sewn/0.5':versioned?'sewn/0.4':objects?'sewn/0.3':'sewn/0.2',procedures,body:[]});
  if(prototype)return behavior;
  return Object.freeze({events:Object.freeze(events.map(Object.freeze))});
}
