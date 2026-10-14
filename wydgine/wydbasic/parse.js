import { tokenize } from './tokenize.js';
import { fail } from './errors.js';
// AST nodes retain spelling and token locations; no executor consumes this tree.
export function parse(source,{module=false,interfaceDeclaration=false,classDeclaration=false}={}) {
  const tokens=tokenize(source);let index=0,depth=0;
  const token=()=>tokens[index],is=v=>['identifier','symbol'].includes(token().kind)&&String(token().value).toUpperCase()===v;
  const take=()=>tokens[index++],eat=v=>is(v)?take():null;
  const expect=v=>{if(!is(v))fail('SYNTAX',`Expected '${v}'.`,token().location);return take();};
  const identifier=()=>{if(token().kind!=='identifier')fail('SYNTAX','Expected identifier.',token().location);return take();};
  const node=(kind,start,fields={})=>({kind,location:start.location,end:tokens[index-1].end,...fields});
  const blank=()=>{while(token().kind==='newline')take();};
  const endLine=()=>{if(!['newline','eof'].includes(token().kind))fail('SYNTAX','Expected end of line.',token().location);blank();};
  const precedence={OR:0,XOR:1,AND:2,'=':3,'<>':3,'<':3,'<=':3,'>':3,'>=':3,'&':4,'+':5,'-':5,'*':6,'/':6,'\\':6,MOD:6,'^':8};
  function expression(min=0) {
    if(++depth>32)fail('SYNTAX','Expression nesting limit.',token().location);
    const start=take();let left;
    if(start.kind==='identifier'&&String(start.value).toUpperCase()==='NEW'){const proto=take();if(proto.kind!=='string')fail('TYPE','NEW requires a literal qualified prototype identity.',proto.location);expect('(');const id=expression();expect(')');left=node('construct',start,{prototype:proto.value,id});}
    else if(['string','number'].includes(start.kind))left=node('literal',start,{value:start.value});
    else if(['TRUE','FALSE','NULL'].includes(String(start.value).toUpperCase()))left=node('literal',start,{value:start.value.toUpperCase()==='NULL'?null:start.value.toUpperCase()==='TRUE'});
    else if(start.value==='('){left=expression();expect(')');}
    else if(['NOT','-','+'].includes(String(start.value).toUpperCase()))left=node('unary',start,{operator:start.value.toUpperCase(),value:expression(start.value.toUpperCase()==='NOT'?3:7)});
    else if(start.value==='['){const items=[];blank();if(!is(']'))do{blank();items.push(expression());blank();}while(eat(','));expect(']');left=node('array',start,{items});}
    else if(start.value==='{'){const fields=[];blank();if(!is('}'))do{blank();const key=take();if(key.kind!=='string')fail('SYNTAX','Object keys must be strings.',key.location);expect(':');blank();fields.push({key:key.value,location:key.location,value:expression()});blank();}while(eat(','));expect('}');left=node('object',start,{fields});}
    else if(start.kind==='identifier')left=node('name',start,{name:start.value});
    else fail('SYNTAX','Expected expression.',start.location);
    while(true) {
      if(eat('.')){const exact=!!eat('[');const key=identifier();if(exact)expect(']');left=node('member',start,{target:left,key:key.value,keyLocation:key.location,exact});continue;}
      if(eat('[')){const position=expression();expect(']');left=node('index',start,{target:left,index:position});continue;}
      if(eat('(')){const args=[];blank();if(!is(')'))do{blank();args.push(expression());blank();}while(eat(','));expect(')');left=node('invoke',start,{target:left,args});continue;}
      if(min<=3&&eat('IS')){const negate=!!eat('NOT');if(eat('NULL'))left=node('isNull',start,{value:left,negate});else left=node('identity',start,{left,right:expression(4),negate});continue;}
      const op=String(token().value).toUpperCase(),p=['identifier','symbol'].includes(token().kind)?precedence[op]:undefined;if(p===undefined||p<min)break;take();left=node('binary',start,{operator:op,left,right:expression(op==='^'?p:p+1)});
    }
    depth--;return left;
  }
  function block(stops=[],nesting=0) {
    if(nesting>16)fail('SYNTAX','Statement nesting limit.',token().location);
    const body=[];blank();while(token().kind!=='eof'&&!stops.some(is))body.push(statement(nesting));return body;
  }
  function branch(start,nesting) {
    if(nesting>16)fail('SYNTAX','Statement nesting limit.',start.location);
    const condition=expression();expect('THEN');endLine();const then=block(['ELSE','ELSEIF','END'],nesting+1);let otherwise=[];
    if(eat('ELSEIF'))otherwise=[branch(tokens[index-1],nesting+1)];
    else {if(eat('ELSE')){endLine();otherwise=block(['END'],nesting+1);}expect('END');expect('IF');endLine();}
    return node('if',start,{condition,then,else:otherwise});
  }
  function statement(nesting) {
    const start=token();let result;
    if(is('DIM')||is('CONST')) {const constant=take().value.toUpperCase()==='CONST';const name=identifier();let type=null,value=null;if(eat('AS'))type=identifier().value;if(eat('='))value=expression();if(constant&&!value)fail('SYNTAX','CONST requires an initializer.',start.location);result=node(constant?'constant':'declare',start,{name:name.value,type,value});}
    else if(eat('TRY')){endLine();const body=block(['CATCH','FINALLY','END'],nesting+1);let handler=null,cleanup=null;if(eat('CATCH')){const name=identifier();endLine();handler={name:name.value,body:block(['FINALLY','END'],nesting+1)};}if(eat('FINALLY')){endLine();cleanup=block(['END'],nesting+1);}if(!handler&&!cleanup)fail('SYNTAX','TRY requires CATCH or FINALLY.',start.location);expect('END');expect('TRY');endLine();return node('try',start,{body,handler,cleanup});}
    else if(eat('SELECT')){expect('CASE');const value=expression();endLine();const cases=[];let otherwise=null;
      while(eat('CASE')){if(eat('ELSE')){endLine();otherwise=block(['CASE','END'],nesting+1);if(is('CASE'))fail('SYNTAX','CASE ELSE must be last.',token().location);break;}
        const tests=[];do{let operator='=';if(eat('IS')){if(['=','<>','<','<=','>','>='].some(is))operator=take().value;else operator=eat('NOT')?'IS NOT':'IS';}tests.push({operator,value:expression()});}while(eat(','));endLine();cases.push({tests,body:block(['CASE','END'],nesting+1)});
      }if(!cases.length&&otherwise===null)fail('SYNTAX','SELECT requires a CASE.',start.location);expect('END');expect('SELECT');endLine();return node('select',start,{value,cases,else:otherwise});}
    else if(eat('IF'))return branch(start,nesting);
    else if(eat('FOR')){const each=!!eat('EACH'),name=identifier();let fields;
      if(each){expect('IN');fields={items:expression()};}
      else{expect('=');const initial=expression();expect('TO');const end=expression();const step=eat('STEP')?expression():node('literal',start,{value:1});fields={start:initial,end,step};}
      endLine();const body=block(['NEXT'],nesting+1);expect('NEXT');if(token().kind==='identifier'){const next=take();if(next.value.toLowerCase()!==name.value.toLowerCase())fail('NAME','NEXT variable does not match.',next.location);}endLine();return node(each?'forEach':'forNumeric',start,{name:name.value,...fields,body});}
    else if(eat('DO')){const mode=eat('WHILE')?'while':(expect('UNTIL'),'until');const condition=expression();endLine();const body=block(['LOOP'],nesting+1);expect('LOOP');endLine();return node('do',start,{mode,condition,body});}
    else if(eat('EXIT')){const kind=eat('DO')?'exitDo':(expect('FOR'),'exitFor');result=node(kind,start);}
    else if(eat('RETURN'))result=node('return',start,{value:['newline','eof'].includes(token().kind)?null:expression()});
    else if(eat('RAISE')){expect('EVENT');const value=expression();result=node('raiseEvent',start,{value});}
    else if(eat('CALL'))result=node('procedureCall',start,{value:expression()});
    else if(eat('STOP'))result=node('stop',start,{value:['newline','eof'].includes(token().kind)?null:expression()});
    else {const reference=!!eat('SET');if(token().kind==='identifier'&&tokens[index+1].value==='='){const name=take();take();result=node('set',start,{name:name.value,reference,value:expression()});}else{if(reference)fail('SYNTAX','SET requires a variable assignment.',start.location);if(['SUB','FUNCTION','MODULE','EVENT','ASYNC','AWAIT','GOTO','REM','DO','WHILE','SELECT','IMPORT','NEW','TRY','THROW','ON'].some(is)&&tokens[index+1].value!=='.')fail('UNSUPPORTED',`Unsupported statement '${token().value}'.`,start.location);const cursor=index,target=expression(4);if(target.kind==='index'&&is('='))fail('UNSUPPORTED','Indexed assignment is read-only.',start.location);if(target.kind==='member'&&eat('='))result=node('memberSet',start,{target,value:expression()});else{index=cursor;result=node('call',start,{value:expression()});}}}
    endLine();return result;
  }
  const location={line:1,column:1,offset:0};
  const imports=[];blank();
  while(eat('WITH')) {
    const start=tokens[index-1];expect('LIBRARY');let id='';
    while(!['newline','eof'].includes(token().kind))id+=String(take().value);
    if(!/^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(id))fail('NAME','WITH LIBRARY requires a lowercase publisher-qualified identity.',start.location);
    imports.push(node('library',start,{id}));endLine();
  }
  const modifiers=()=>{const values=[];while(['PUBLIC','PRIVATE','PROTECTED','FRIEND','MUSTINHERIT','MUSTOVERRIDE','VIRTUAL','OVERRIDE','REQUIRED','HIDDEN'].some(is)){const t=take();const v=t.value.toLowerCase();if(values.includes(v))fail('SYNTAX','Duplicate modifier.',t.location);values.push(v);}return values;};
  let className=null,classModifiers=[],parent=null;
  const metadata=[],properties=[],contracts=[],implementations=[],children=[];
  let presentation=null;
  function child(slot=null) {
    const start=expect('CHILD'),name=identifier();expect('AS');const prototype=take();
    if(prototype.kind!=='string')fail('SYNTAX','CHILD requires an exact quoted prototype ID.',prototype.location);
    if(slot===null){expect('INTO');slot=identifier().value;}
    endLine();const initializers=[];
    while(!is('END')){const p=expect('PROPERTY'),key=identifier();expect('=');initializers.push(node('initializer',p,{name:key.value,value:expression()}));endLine();}
    expect('END');expect('CHILD');endLine();return node('child',start,{name:name.value,prototype:prototype.value,slot,initializers});
  }
  function presentationParts(nesting=0) {
    if(nesting>16)fail('SYNTAX','Presentation nesting exceeds 16.',token().location);
    const parts=[];
    while(!is('END')){
      const start=token();
      if(eat('CONTENT')||eat('HEADING')){const role=String(start.value).toUpperCase();parts.push(node('presentationText',start,{role,value:expression()}));endLine();}
      else if(eat('REPEAT')){const name=identifier();expect('IN');const value=expression();expect('LIMIT');const limit=expression();endLine();const body=presentationParts(nesting+1);expect('END');expect('REPEAT');endLine();parts.push(node('presentationRepeat',start,{name:name.value,value,limit,body}));}
      else fail('SYNTAX','Presentation supports CONTENT, HEADING and bounded REPEAT.',start.location);
    }
    return parts;
  }
  if(classDeclaration){classModifiers=modifiers();expect('CLASS');className=identifier().value;
    if(eat('EXTENDS')){if(token().kind==='string')parent=take().value;else{parent='';while(!['newline','eof'].includes(token().kind))parent+=String(take().value);}}endLine();}
  let interfaceName=null;if(interfaceDeclaration){expect('INTERFACE');interfaceName=identifier().value;endLine();}
  if(!module){const body=block();return {kind:'program',location,body,imports};}
  const procedures=[],events=[];blank();
  while(token().kind!=='eof'&&!((interfaceDeclaration||classDeclaration)&&is('END'))){
    const start=token(),mods=classDeclaration?modifiers():[];
    if(classDeclaration&&is('CHILD')){if(mods.length)fail('SYNTAX','CHILD has no access modifiers.',start.location);children.push(child());continue;}
    if(classDeclaration&&eat('SLOT')){if(mods.length)fail('SYNTAX','SLOT has no access modifiers.',start.location);const slot=identifier().value;endLine();while(is('CHILD'))children.push(child(slot));expect('END');expect('SLOT');endLine();continue;}
    if(classDeclaration&&eat('PRESENTATION')){if(mods.length||presentation)fail('SYNTAX','Declare one unmodified PRESENTATION block.',start.location);expect('SERVER');endLine();const parts=presentationParts();expect('END');expect('PRESENTATION');endLine();presentation=node('presentation',start,{target:'server',parts});continue;}
    if(classDeclaration&&eat('META')){const name=identifier();expect('=');metadata.push(node('metadata',start,{name:name.value,value:expression(),modifiers:mods}));endLine();continue;}
    if(classDeclaration&&eat('IMPLEMENTS')){const id=take();if(id.kind!=='string')fail('SYNTAX','IMPLEMENTS requires an exact quoted interface ID.',id.location);implementations.push(node('implementation',start,{id:id.value,modifiers:mods}));endLine();continue;}
    if(classDeclaration&&eat('PROPERTY')){const name=identifier();expect('AS');const type=identifier();const value=eat('=')?expression():null;const enumeration=eat('ENUM')?expression():null,requires=eat('REQUIRES')?expression():null;properties.push(node('property',start,{name:name.value,type:type.value,value,enumeration,requires,modifiers:mods}));endLine();continue;}
    if(is('SUB')||is('FUNCTION')){
      const kind=take().value.toUpperCase(),name=identifier(),params=[];expect('(');blank();
      if(!is(')'))do{blank();const param=identifier();expect('AS');const type=identifier();params.push(node('parameter',param,{name:param.value,type:type.value}));blank();}while(eat(','));expect(')');
      let returns=null;if(kind==='FUNCTION'){expect('AS');returns=identifier().value;}const requires=classDeclaration&&eat('REQUIRES')?expression():null;endLine();
      const body=interfaceDeclaration||mods.includes('mustoverride')?[]:block(['END']);if(!interfaceDeclaration&&!mods.includes('mustoverride')){expect('END');expect(kind);endLine();}procedures.push(node('procedure',start,{name:name.value,procedureKind:kind.toLowerCase(),params,returns,body,requires,modifiers:mods}));
    }else if(classDeclaration&&eat('EVENT')){
      const name=identifier(),params=[];expect('(');blank();if(!is(')'))do{blank();const param=identifier();expect('AS');const type=identifier();params.push(node('parameter',param,{name:param.value,type:type.value}));blank();}while(eat(','));expect(')');endLine();contracts.push(node('eventContract',start,{name:name.value,params,modifiers:mods}));
    }else if(!interfaceDeclaration&&eat('EVENT')){
      const name=identifier();let type=name.value;if(eat('.'))type+='.'+identifier().value;endLine();
      const body=block(['END']);expect('END');expect('EVENT');endLine();events.push(node('event',start,{type,body}));
    }else fail('SYNTAX',classDeclaration?'Class bodies contain metadata, properties, methods and event signatures.':'Modules contain only SUB, FUNCTION and EVENT declarations.',start.location);
  }
  if(interfaceDeclaration){expect('END');expect('INTERFACE');endLine();if(token().kind!=='eof'||imports.length)fail('SYNTAX','Interfaces contain signatures only.',token().location);}
  if(classDeclaration){expect('END');expect('CLASS');endLine();if(token().kind!=='eof')fail('SYNTAX','One class per source file; no top-level executable code.',token().location);return {kind:'class',location,name:className,modifiers:classModifiers,parent,metadata,properties,contracts,implementations,procedures,events,imports,children,presentation};}
  return {kind:'module',location,procedures,events,imports,interfaceName};
}

export const parseModule=source=>parse(source,{module:true});

export const parseClass=source=>parse(source,{module:true,classDeclaration:true});
