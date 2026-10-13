import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,compileModule} from '../wydgine/wydbasic/index.js';
import {execute} from '../wydgine/sewn/execute.js';
import {validate} from '../wydgine/sewn/validate.js';
import {ExecutionContext} from '../wydgine/object-model/index.js';
const context=new ExecutionContext({publisher:'acme',self:'home'});
const run=async(source,scope={})=>(await execute(compile(source),{context,scope})).value;
test('numeric contracts, boundaries, dynamic assignments and compatibility',async()=>{
 for(const type of ['Integer','Float','Number'])assert.equal(await run(`DIM x AS ${type}=42.0\nRETURN x`),42);
 for(const x of ['9007199254740991','-9007199254740991'])assert.equal(await run(`DIM x AS Integer=${x}\nRETURN x`),Number(x));
 for(const x of ['42.5','9007199254740992','"42"','TRUE'])assert.throws(()=>compile(`DIM x AS Integer=${x}`));
 assert.equal(await run('DIM x=0\nx=Val("0.5")\nRETURN x'),0.5);
 assert.equal(compile('DIM x=0\nx=x+1\nRETURN x').schema,'sewn/0.1');
 await assert.rejects(run('DIM x AS Integer=0\nx=Val("0.5")'),{code:'SEWN.TYPE'});
 await assert.rejects(run('DIM x AS Integer=SESSION.x',{SESSION:{x:0.5}}),{code:'SEWN.TYPE'});
 assert.equal(await run('DIM x AS Float=SESSION.x\nRETURN x',{SESSION:{x:42}}),42);
});
test('operators, signs, precedence, exact integers and finite floats',async()=>{
 for(const [expr,result] of [['17 MOD 5',2],['-17 MOD 5',-2],['17 MOD -5',2],['17 \\ 5',3],['-17 \\ 5',-3],['17 \\ -5',-3],['2 ^ 3 ^ 2',512],['-2 ^ 2',-4],['(-2) ^ 3',-8],['2 ^ -2',0.25],['0 ^ 0',1],['9 ^ 0.5',3]])assert.equal(await run(`RETURN ${expr}`),result);
 assert.equal(await run('RETURN -10 MOD 5'),0); // Canonical JSON normalizes signed zero.
 for(const expr of ['1 MOD 0','1 \\ 0','2 ^ 53','(-2) ^ 0.5','10 ^ 1000'])await assert.rejects(run(`RETURN ${expr}`),{code:'SEWN.TYPE'});
 for(const expr of ['9007199254740991 + 1','9007199254740991 * 2','9007199254740991 * 9007199254740991 - 9007199254740991 * 9007199254740991'])await assert.rejects(run(`DIM x AS Integer=${expr}`),{code:'SEWN.TYPE'});
 assert.equal(await run('DIM a AS Integer=17\nDIM b AS Integer=5\nRETURN a/b'),3.4);
 for(const expr of ['1.5 MOD 1','TRUE XOR 1','"2" ^ 2'])assert.throws(()=>compile(`RETURN ${expr}`));
 assert.deepEqual(await run('RETURN [FALSE XOR FALSE,FALSE XOR TRUE,TRUE XOR FALSE,TRUE XOR TRUE,TRUE OR TRUE XOR TRUE,TRUE XOR TRUE AND FALSE]'),[false,true,true,false,true,true]);
 assert.equal(await run('RETURN FALSE AND Val("bad")=1'),false);
 assert.equal(await run('RETURN TRUE OR Val("bad")=1'),true);
});
test('predicates use JavaScript value classification without coercion',async()=>{
 for(const [input,i,s] of [['42',true,true],['42.0',true,true],['42.5',false,false],['9007199254740992',true,false],['"42"',false,false],['TRUE',false,false],['NULL',false,false],['[]',false,false],['{}',false,false]])assert.deepEqual(await run(`RETURN [IsInteger(${input}),IsSafeInteger(${input})]`),[i,s]);
 assert.deepEqual(await run('RETURN [IsInteger(SESSION.x),IsSafeInteger(SESSION.x)]',{SESSION:{x:9007199254740992}}),[true,false]);
 assert.throws(()=>compile('RETURN IsInteger()'));
 assert.throws(()=>compile('DIM IsInteger=1'));
 assert.throws(()=>compile('DIM x AS Integer=-0.5'));
 assert.equal(await run('RETURN isSAFEinteger(42)'),true);
});
test('new closed grammar, older versions and procedure contracts',async()=>{
 const p=compile('DIM x AS Integer=2 ^ 8\nRETURN IsSafeInteger(x)');assert.equal(p.schema,'sewn/0.10');assert.deepEqual(validate(p),p);
 for(let n=1;n<=9;n++)assert.throws(()=>validate({...p,schema:`sewn/0.${n}`}));
 const mod=compileModule('FUNCTION F(x AS Integer) AS Float\nRETURN x/2\nEND FUNCTION\nEVENT Page.Load\nRETURN F(3)\nEND EVENT');assert.equal((await execute(mod.events[0].workflow,{context,scope:{}})).value,1.5);
 const bad=compileModule('FUNCTION F(x AS Integer) AS Integer\nRETURN x\nEND FUNCTION\nEVENT Page.Load\nRETURN F(Val("0.5"))\nEND EVENT');await assert.rejects(execute(bad.events[0].workflow,{context,scope:{}}),{code:'SEWN.TYPE'});
 const tiny=new ExecutionContext({publisher:'acme',self:'home',limits:{sewnSteps:1}});await assert.rejects(execute(p,{context:tiny,scope:{}}),{code:'SEWN.LIMIT'});
});

test('independent numeric wire operations, malformed shapes and shared limits',async()=>{
 const l=value=>({op:'literal',value}),doc=value=>({schema:'sewn/0.10',procedures:{},body:[{op:'return',value}]}),wire=(operator,a,b,type='Auto')=>({op:'numeric',operator,left:l(a),right:l(b),type});
 const evalWire=(value,ctx=context,scope={})=>execute(doc(value),{context:ctx,scope});
 for(const [op,a,b,result] of [['+',2,3,5],['-',2,3,-1],['*',3,7,21],['MOD',-17,5,-2],['\\',-17,5,-3],['^',-1,9007199254740991,-1],['^',0,9007199254740991,0],['^',1,9007199254740991,1]])assert.equal((await evalWire(wire(op,a,b))).value,result);
 assert.equal((await evalWire(wire('+',9007199254740991,1,'Float'))).value,9007199254740992);
 for(const expr of [wire('+',9007199254740991,1),wire('*',9007199254740991,2),wire('*',Number.MAX_VALUE,2,'Float'),wire('/',1,0,'Float'),wire('^',Number.MAX_VALUE,2),wire('MOD',1.5,1),wire('\\',9007199254740992,1),wire('+','1',1),{op:'xor',left:l(1),right:l(false)},{op:'numericCheck',type:'Integer',value:l(0.5)}])await assert.rejects(evalWire(expr),{code:'SEWN.TYPE'});
 for(const expr of [{...wire('+',1,2),type:'Number'},{...wire('+',1,2),operator:'eval'},{...wire('+',1,2),extra:true},{op:'numericCheck',type:'Number',value:l(1)},{op:'numericPredicate',predicate:'TypeOf',value:l(1)},{op:'xor',left:l(true)}])assert.throws(()=>validate(doc(expr)),{code:'SEWN.INVALID'});
 for(let n=1;n<=9;n++)for(const expr of [wire('+',1,2),{op:'numericCheck',type:'Integer',value:l(1)},{op:'numericPredicate',predicate:'IsInteger',value:l(1)},{op:'xor',left:l(true),right:l(false)}]){const p={...doc(expr),schema:`sewn/0.${n}`};if(n===1)delete p.procedures;assert.throws(()=>validate(p),{code:'SEWN.INVALID'});}
 const deep={op:'numericPredicate',predicate:'IsInteger',value:l(1)};
 await assert.rejects(evalWire(deep,new ExecutionContext({publisher:'acme',self:'home',limits:{sewnExpressionDepth:0}})),{code:'SEWN.LIMIT'});
 for(const op of ['numericCheck','numericPredicate'])await assert.rejects(evalWire({op,...(op==='numericCheck'?{type:'Integer'}:{predicate:'IsInteger'}),value:{op:'context',name:'ME'}},context,{ME:{id:'home'}}),{code:'SEWN.TYPE'});
});

test('authorized service values, single evaluation, diagnostics and numeric selections',async()=>{
 const source='DIM result=SERVICES.Call("test","read",{})\nDIM n AS Integer=result.value\nRETURN [IsInteger(n),CStr(n),n]';let calls=0;
 assert.deepEqual(await run(source,{SERVICES:{Call(){calls++;return {value:42};}}}),[true,'42',42]);assert.equal(calls,1);
 await assert.rejects(run(source,{SERVICES:{Call(){return {value:42.5};}}}),{code:'SEWN.TYPE'});
 assert.equal(await run('DIM n AS Integer=2\nSELECT CASE n\nCASE IS >= 2.0\nRETURN TRUE\nCASE ELSE\nRETURN FALSE\nEND SELECT'),true);
 assert.throws(()=>compile('DIM n AS Integer=0.5'),e=>e.code==='WYDBASIC.TYPE'&&e.details.line===1);
 assert.throws(()=>compileModule('FUNCTION F(n AS Integer) AS Integer\nRETURN n\nEND FUNCTION\nEVENT Page.Load\nRETURN F(0.5)\nEND EVENT'),{code:'WYDBASIC.TYPE'});
 assert.equal(await run('DIM a AS Integer=9007199254740991\nDIM b AS Integer=1\nRETURN (a-b)+b'),9007199254740991);
 await assert.rejects(run('DIM a AS Integer=9007199254740991\nDIM b AS Integer=1\nRETURN (a+b)-b'),{code:'SEWN.TYPE'});
 await assert.rejects(run('DIM a AS Integer=9007199254740991\nRETURN (a+0)+1'),{code:'SEWN.TYPE'});
 await assert.rejects(run('RETURN (2 ^ 52)+4503599627370496'),{code:'SEWN.TYPE'});
 assert.equal(await run('DIM f AS Float=9007199254740991+1\nRETURN f'),9007199254740992);
});
