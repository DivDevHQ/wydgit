import { fail } from './errors.js';
export function tokenize(source) {
  if(typeof source !== 'string' || source.length > 65536) fail('SYNTAX','Expected source text of at most 65,536 characters.');
  const tokens=[];let offset=0,line=1,column=1;
  const location=()=>({offset,line,column});
  const advance=()=>{const c=source[offset++];if(c==='\n'){line++;column=1;}else column++;return c;};
  const add=(kind,value,start)=>tokens.push({kind,value,location:start,end:location()});
  while(offset<source.length) {
    const start=location(),c=source[offset];
    if(c===' '||c==='\t'||c==='\r'){advance();continue;}
    if(c==="'"){while(offset<source.length&&source[offset]!=='\n')advance();continue;}
    if(c==='\n'){advance();add('newline','\n',start);continue;}
    if(c==='"') {
      advance();let value='',closed=false;
      while(offset<source.length&&source[offset]!=='\n') {const x=advance();if(x==='"'){if(source[offset]==='"'){advance();value+='"';}else{closed=true;break;}}else value+=x;}
      if(!closed)fail('SYNTAX','Unterminated string.',start);add('string',value,start);continue;
    }
    if(/[0-9]/.test(c)){let value='';while(/[0-9]/.test(source[offset]??''))value+=advance();if(source[offset]==='.'&&/[0-9]/.test(source[offset+1]??'')){value+=advance();while(/[0-9]/.test(source[offset]??''))value+=advance();}const n=Number(value);if(!Number.isFinite(n))fail('TYPE','Number must be finite.',start);add('number',n,start);continue;}
    if(/[A-Za-z_]/.test(c)){let value='';while(/[A-Za-z0-9_]/.test(source[offset]??''))value+=advance();add('identifier',value,start);continue;}
    const pair=source.slice(offset,offset+2);if(['<>','<=','>='].includes(pair)){advance();advance();add('symbol',pair,start);continue;}
    if('=<>+-*/&().,[]{}:'.includes(c)){advance();add('symbol',c,start);continue;}
    fail('SYNTAX',`Unexpected character '${c}'.`,start);
  }
  add('eof','',location());return tokens;
}
