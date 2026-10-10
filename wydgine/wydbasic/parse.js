import { tokenize } from './tokenize.js';
import { fail } from './errors.js';
// AST nodes retain spelling and token locations; no executor consumes this tree.
export function parse(source,{module=false}={}) {
  const tokens=tokenize(source);let index=0,depth=0;
  const token=()=>tokens[index],is=v=>['identifier','symbol'].includes(token().kind)&&String(token().value).toUpperCase()===v;
  const take=()=>tokens[index++],eat=v=>is(v)?take():null;
  const expect=v=>{if(!is(v))fail('SYNTAX',`Expected '${v}'.`,token().location);return take();};
  const identifier=()=>{if(token().kind!=='identifier')fail('SYNTAX','Expected identifier.',token().location);return take();};
  const node=(kind,start,fields={})=>({kind,location:start.location,end:tokens[index-1].end,...fields});
  const blank=()=>{while(token().kind==='newline')take();};
  const endLine=()=>{if(!['newline','eof'].includes(token().kind))fail('SYNTAX','Expected end of line.',token().location);blank();};
  const precedence={OR:1,AND:2,'=':3,'<>':3,'<':3,'<=':3,'>':3,'>=':3,'&':4,'+':5,'-':5,'*':6,'/':6};
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
      if(eat('.')){const key=identifier();left=node('member',start,{target:left,key:key.value,keyLocation:key.location});continue;}
      if(eat('(')){const args=[];blank();if(!is(')'))do{blank();args.push(expression());blank();}while(eat(','));expect(')');left=node('invoke',start,{target:left,args});continue;}
      const op=String(token().value).toUpperCase(),p=['identifier','symbol'].includes(token().kind)?precedence[op]:undefined;if(p===undefined||p<min)break;take();left=node('binary',start,{operator:op,left,right:expression(p+1)});
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
    if(eat('DIM')) {const name=identifier();let type=null,value=null;if(eat('AS'))type=identifier().value;if(eat('='))value=expression();result=node('declare',start,{name:name.value,type,value});}
    else if(eat('IF'))return branch(start,nesting);
    else if(eat('FOR')){expect('EACH');const name=identifier();expect('IN');const items=expression();endLine();const body=block(['NEXT'],nesting+1);expect('NEXT');if(token().kind==='identifier'){const next=take();if(next.value.toLowerCase()!==name.value.toLowerCase())fail('NAME','NEXT variable does not match.',next.location);}endLine();return node('forEach',start,{name:name.value,items,body});}
    else if(eat('RETURN'))result=node('return',start,{value:['newline','eof'].includes(token().kind)?null:expression()});
    else if(eat('CALL'))result=node('procedureCall',start,{value:expression()});
    else if(eat('STOP'))result=node('stop',start,{value:['newline','eof'].includes(token().kind)?null:expression()});
    else {const reference=!!eat('SET');if(token().kind==='identifier'&&tokens[index+1].value==='='){const name=take();take();result=node('set',start,{name:name.value,reference,value:expression()});}else{if(reference)fail('SYNTAX','SET requires a variable assignment.',start.location);if(['SUB','FUNCTION','MODULE','EVENT','ASYNC','AWAIT','GOTO','REM','DO','WHILE','SELECT','IMPORT','NEW','TRY','THROW','ON'].some(is)&&tokens[index+1].value!=='.')fail('UNSUPPORTED',`Unsupported statement '${token().value}'.`,start.location);result=node('call',start,{value:expression()});}}
    endLine();return result;
  }
  const location={line:1,column:1,offset:0};
  if(!module){const body=block();return {kind:'program',location,body};}
  const procedures=[],events=[];blank();
  while(token().kind!=='eof'){
    const start=token();
    if(is('SUB')||is('FUNCTION')){
      const kind=take().value.toUpperCase(),name=identifier(),params=[];expect('(');blank();
      if(!is(')'))do{blank();const param=identifier();expect('AS');const type=identifier();params.push(node('parameter',param,{name:param.value,type:type.value}));blank();}while(eat(','));expect(')');
      let returns=null;if(kind==='FUNCTION'){expect('AS');returns=identifier().value;}endLine();
      const body=block(['END']);expect('END');expect(kind);endLine();procedures.push(node('procedure',start,{name:name.value,procedureKind:kind.toLowerCase(),params,returns,body}));
    }else if(eat('EVENT')){
      const name=identifier();let type=name.value;if(eat('.'))type+='.'+identifier().value;endLine();
      const body=block(['END']);expect('END');expect('EVENT');endLine();events.push(node('event',start,{type,body}));
    }else fail('SYNTAX','Modules contain only SUB, FUNCTION and EVENT declarations.',start.location);
  }
  return {kind:'module',location,procedures,events};
}

export const parseModule=source=>parse(source,{module:true});
