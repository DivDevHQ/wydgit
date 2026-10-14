import {RE2JS} from './vendor/re2js.js';
import {ensure,fail} from './validate.js';

// A subset gate, not a matcher. It bounds the AST before the dependency compiles
// it, and excludes RE2 extensions and ECMAScript features with different semantics.
const whitespace='\\t\\n\\v\\f\\r \\x{a0}\\x{1680}\\x{2000}-\\x{200a}\\x{2028}\\x{2029}\\x{202f}\\x{205f}\\x{3000}\\x{feff}';
const classes={d:'0-9',w:'A-Za-z0-9_',s:whitespace};
const line=c=>c==='\n'||c==='\r'||c==='\u2028'||c==='\u2029';
function unicode(text,enabled,insensitive){
 for(let i=0;i<text.length;i++){
  const c=text.charCodeAt(i);ensure(!insensitive||c<128,'REGEX');
  if(c>=0xd800&&c<=0xdfff){ensure(enabled&&c<=0xdbff&&i+1<text.length,'REGEX');const low=text.charCodeAt(++i);ensure(low>=0xdc00&&low<=0xdfff,'REGEX');}
 }
}
function patternSubset(pattern,flags,bounds){
 let pos=0,captures=0,endAnchor=false,anchors=false;
 const check=cost=>ensure(cost<=bounds.regexAtoms,'LIMIT');
 const escape=inClass=>{
  ensure(pos<pattern.length,'REGEX');const c=pattern[pos++];
  if(Object.hasOwn(classes,c))return inClass?classes[c]:`[${classes[c]}]`;
  if(['D','W','S'].includes(c)){ensure(!inClass,'REGEX');return `[^${classes[c.toLowerCase()]}]`;}
  if(c==='b')return inClass?'\\x08':'\\b';
  if(c==='B'){ensure(!inClass,'REGEX');return '\\B';}
  if('nrtfv'.includes(c))return '\\'+c;
  if(c==='0'){ensure(!/[0-9]/.test(pattern[pos]??''),'REGEX');return '\\x00';}
  if(c==='x'||c==='u'){
   const size=c==='x'?2:4,hex=pattern.slice(pos,pos+size);ensure(hex.length===size&&/^[0-9a-fA-F]+$/.test(hex),'REGEX');pos+=size;
   const code=parseInt(hex,16);ensure(code<0xd800||code>0xdfff,'REGEX');ensure(!flags.includes('i')||code<128,'REGEX');return `\\x{${hex}}`;
  }
  ensure('\\^$.*+?()[]{}|/-'.includes(c),'REGEX');return c==='/'?'/':'\\'+c;
 };
 function sequence(depth){
  ensure(depth<=bounds.regexDepth,'LIMIT');let out='',cost=0,hasCapture=false;
  while(pos<pattern.length&&pattern[pos]!==')'){
   const c=pattern[pos++];let atom='',size=1,cap=false,assertion=false;
   if(c==='|'){out+='|';cost++;check(cost);continue;}
   if(c==='('){
    let capturing=true;
    if(pattern[pos]==='?'){ensure(pattern.slice(pos,pos+2)==='?:','REGEX');pos+=2;capturing=false;}
    if(capturing)ensure(++captures<=bounds.regexCaptures,'LIMIT');
    const child=sequence(depth+1);ensure(pattern[pos++ ]===')','REGEX');
    atom='('+(capturing?'':'?:')+child.out+')';size=child.cost+2;cap=capturing||child.hasCapture;
   }else if(c==='['){
    atom='[';if(pattern[pos]==='^')atom+=pattern[pos++];const members=[];let count=0;
    while(pos<pattern.length&&pattern[pos]!==']'){
     const ch=pattern[pos++];ensure(ch!=='[','REGEX');
     members.push(ch==='-'?'hyphen':ch==='\\'&&'dws'.includes(pattern[pos]??'')?'set':'single');
     atom+=ch==='\\'?escape(true):ch;count++;
    }
    ensure(count>0&&pattern[pos++ ]===']','REGEX');
    for(let i=1;i<members.length-1;i++)if(members[i]==='hyphen')ensure(members[i-1]==='single'&&members[i+1]==='single','REGEX');
    atom+=']';size=count+1;
   }else if(c==='\\'){atom=escape(false);assertion=atom==='\\b'||atom==='\\B';}
   else if(c==='.')atom=flags.includes('s')?'[\\x00-\\x{10ffff}]':'[^\\n\\r\\x{2028}\\x{2029}]';
   else if(c==='^'||c==='$'){atom=c;assertion=true;anchors=true;if(c==='$')endAnchor=true;}
   else {ensure(!'*+?{}]'.includes(c),'REGEX');atom=c;}
   let repeats=1,expansion=1,quantifier='';const q=pattern[pos];
   if(q==='*'||q==='+'||q==='?'){pos++;quantifier=q;repeats=q==='?'?1:Infinity;}
   else if(q==='{'){
    pos++;let lo='',hi='';while(/[0-9]/.test(pattern[pos]??''))lo+=pattern[pos++];ensure(lo.length>0,'REGEX');
    if(pattern[pos]===','){pos++;while(/[0-9]/.test(pattern[pos]??''))hi+=pattern[pos++];repeats=hi===''?Infinity:Number(hi);}else repeats=Number(lo);
    ensure((lo==='0'||!lo.startsWith('0'))&&(hi===''||hi==='0'||!hi.startsWith('0')),'REGEX');
    ensure(pattern[pos++ ]==='}'&&Number(lo)<=repeats,'REGEX');ensure(Number(lo)<=bounds.regexRepeat&&(repeats===Infinity||repeats<=bounds.regexRepeat),'LIMIT');
    // An unbounded maximum still expands its finite minimum at compilation.
    expansion=repeats===Infinity?Math.max(1,Number(lo)+1):Math.max(1,repeats);
    quantifier='{'+lo+(hi!==''||repeats===Infinity?','+hi:'')+'}';
   }
   if(quantifier){ensure(!assertion&&(!cap||repeats<=1),'REGEX');if(pattern[pos]==='?'){pos++;quantifier+='?';}size=size*expansion+2;}
   cost+=size;check(cost);hasCapture ||= cap;out+=atom+quantifier;
  }
  return {out,cost,hasCapture};
 }
 const result=sequence(0);ensure(pos===pattern.length,'REGEX');
 return {...result,captures,endAnchor,anchors};
}

// All invocations in one executor, including linked libraries, share this counter.
export function regexOperation(bounds,tick){
 let used=0;
 const spend=work=>{
  ensure(Number.isSafeInteger(work)&&work>=0&&work<=bounds.regexWork-used,'LIMIT');used+=work;
  // Reserve the entire worst-case NFA search BEFORE entering synchronous code.
  // Every 128 work units also spends an ordinary shared SEWN execution step.
  for(let i=0;i<Math.ceil(work/128);i++)tick();
 };
 return (name,args)=>{
  args.forEach(v=>ensure(typeof v==='string','TYPE'));
  const [text,pattern]=args,flags=args[name==='RegexReplace'?3:2];
  ensure(pattern.length<=bounds.regexPattern&&text.length<=bounds.regexInput,'LIMIT');
  spend(pattern.length*pattern.length+text.length+flags.length+1);
  const seen=new Set();for(const flag of flags){ensure('gimsu'.includes(flag)&&!seen.has(flag),'REGEX');seen.add(flag);}
  unicode(text,seen.has('u'),seen.has('i'));unicode(pattern,seen.has('u'),seen.has('i'));
  const subset=patternSubset(pattern,flags,bounds);
  // RE2's multiline anchors use LF. Fail closed for other ECMAScript separators.
  if(subset.anchors&&seen.has('m'))ensure(!text.includes('\r')&&!text.includes('\u2028')&&!text.includes('\u2029'),'REGEX');
  // RE2's non-multiline $ does not have ECMAScript's final-newline alternative.
  if(subset.endAnchor&&!seen.has('m'))ensure(text.length===0||!line(text.at(-1)),'REGEX');
  spend((subset.cost+1)**2*4);
  let compiled;
  try{compiled=RE2JS.compile(subset.out,RE2JS.DISABLE_UNICODE_GROUPS|(seen.has('i')?RE2JS.CASE_INSENSITIVE:0)|(seen.has('m')?RE2JS.MULTILINE:0));}catch{fail('REGEX');}
  const engine=compiled.re2(),instructions=compiled.programSize();
  ensure(instructions<=bounds.regexInstructions&&compiled.groupCount()===subset.captures,'LIMIT');
  // Pinned implementation integration: bypass DFA, memoized backtracking,
  // prefilter and one-pass optimizations. Only the deduplicated Thompson NFA runs.
  // No native RegExp, translator, replacement callbacks or engine object escapes.
  engine.executeEngine=(input,pos,anchor,ncap)=>engine.doExecuteNFA(input,pos,anchor,ncap);
  const matcher=compiled.matcher(text),groups=subset.captures;
  let position=0,matches=0,nodes=name==='RegexMatches'||name==='RegexSplit'?1:0,output=0,last=0;
  const result=[],parts=[],outputLimit=Math.min(bounds.string,bounds.regexOutput);
  const allocate=(units,count=0)=>{ensure(output+units<=outputLimit&&nodes+count<=bounds.valueNodes,'LIMIT');spend(units+count);output+=units;nodes+=count;};
  const append=piece=>{allocate(piece.length);parts.push(piece);};
  const appendRange=(start,end)=>{allocate(end-start);parts.push(text.slice(start,end));};
  const field=(start,end)=>{allocate(end-start,1);ensure(result.length<bounds.regexMatches+1,'LIMIT');result.push(text.slice(start,end));};
  const first=name==='RegexTest'||name==='RegexMatch'||name==='RegexReplace'&&!seen.has('g');
  while(position<=text.length){
   // Both find and lazy capture loading may scan the entire remaining suffix.
   // 16 covers two passes, two queues, class searches (<=256 ranges), capture copies.
   spend((text.length-position+1)*instructions*(2*groups+2)*16);
   if(!matcher.find(position))break;
   ensure(++matches<=bounds.regexMatches,'LIMIT');tick();const start=matcher.start(),end=matcher.end();
   if(name==='RegexTest')return true;
   if(name==='RegexMatch'||name==='RegexMatches'){
    allocate(end-start,5+groups);const captures=[];
    for(let i=1;i<=groups;i++){const begin=matcher.start(i),finish=matcher.end(i);allocate(begin<0?0:finish-begin);captures.push(begin<0?null:text.slice(begin,finish));}
    const match={value:text.slice(start,end),index:start,groups:captures};
    if(name==='RegexMatch')return match;result.push(match);
   }else if(name==='RegexReplace'){appendRange(last,start);append(args[2]);last=end;}
   else {field(last,start);last=end;}
   if(first)break;
   // Explicit portable progress: one UTF-16 unit, or a full code point with u.
   position=end===start?end+(seen.has('u')&&text.codePointAt(end)>0xffff?2:1):end;
  }
  if(name==='RegexTest')return false;
  if(name==='RegexMatch')return null;
  if(name==='RegexMatches')return result;
  if(name==='RegexSplit'){field(last,text.length);return result;}
  appendRange(last,text.length);return parts.join('');
 };
}
