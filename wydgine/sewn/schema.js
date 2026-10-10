// Runtime-neutral closed grammar. Every operand is a structured expression.
export const SCHEMA='sewn/0.1';
export const MAXIMA=Object.freeze({steps:10000,expressionDepth:32,nesting:16,iterations:1000,variables:64,valueNodes:4096,string:16384,serviceCalls:32,procedureCalls:256,procedureDepth:16,parameters:16,drafts:64,draftDepth:32,draftNodes:256,constructionOperations:512,constructionSize:65536,timeMs:1000,programNodes:8192,programSize:65536});
export const statements=Object.freeze({declare:['name','value'],set:['name','value'],if:['condition','then','else?'],forEach:['name','items','body'],call:['target','method','args','into?'],service:['library','method','input','into?'],return:['value'],stop:['value?']});
export const expressions=Object.freeze({array:['items'],object:['fields'],literal:['value'],variable:['name'],context:['name'],read:['target','key'],invoke:['target','method','args'],binary:['operator','left','right'],not:['value']});
export const operators=['=','!=','<','<=','>','>=','AND','OR','+','-','*','/','concat'];
export const contextNames=['ME','EVENT','REQUEST','RESPONSE','SESSION','PAGE','SERVER','CLIENT'];
export const safeKey=k=>typeof k==='string'&&!['__proto__','constructor','prototype'].includes(k);

// 0.1 stays closed and unchanged; these operations belong only to 0.2.
export const PROCEDURE_SCHEMA='sewn/0.2';
export const sourceTypes=Object.freeze(['String','Number','Boolean','Null','Array','Object','Wydgit']);
export const procedureStatements=Object.freeze({...statements,procedureCall:['name','args'],return:['value?']});
export const procedureExpressions=Object.freeze({...expressions,functionCall:['name','args'],serviceCall:['library','method','input']});
export const reservedNames=Object.freeze([...contextNames,'SERVICES','NEWID','DIM','AS','SET','IF','THEN','ELSE','ELSEIF','END','FOR','EACH','IN','NEXT','RETURN','STOP','TRUE','FALSE','NULL','AND','OR','NOT','SUB','FUNCTION','CALL','EVENT','MODULE','ASYNC','AWAIT','GOTO','REM','DO','LOOP','WHILE','SELECT','TRY','CATCH','THROW','ON','CLASS','NEW','IMPORT','BYREF','OPTIONAL','PARAMARRAY','PROCESS','GLOBALTHIS','WINDOW','DOCUMENT','REQUIRE','EVAL','FS','CHILD_PROCESS']);

export const OBJECT_SCHEMA='sewn/0.3';
export const objectStatements=Object.freeze({...procedureStatements,methodCall:['target','name','args']});
export const objectExpressions=Object.freeze({...procedureExpressions,methodValue:['target','name','args'],construct:['type','id'],newId:[]});
