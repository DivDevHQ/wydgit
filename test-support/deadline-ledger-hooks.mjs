// Explicit worker opt-in, strict anchors. No source files are overwritten.
import {registerHooks} from 'node:module';
const observer=new URL('./deadline-ledger.js',import.meta.url).href;
const engine='/packages/wydgine/src/engine/';
export function installDeadlineLedgerHooks({costs=false,baseline=false,observe=true}={}){
  return registerHooks({load(url,context,next){
    const result=next(url,context),name=url.split(engine)[1];
    if(!(observe?['sewn/budget.js','execution/completion.js','execution/page.js','execution/diagnostics.js','http/pipeline.js','http/response.js',...(costs||baseline?['packages/index.js']:[]),...(costs?['object-model/index.js','object-model/mutation.js']:[])]:['execution/page.js','packages/index.js']).includes(name))return result;
    let source=String(result.source);
    const replace=(before,after)=>{if(source.split(before).length!==2)throw Error('Spike K anchor: '+name+' '+before.slice(0,60));source=source.replace(before,after);};
    // Exactly reverse the retained diff. Evidence verifies these bytes against
    // git show 1277d456:packages/.../packages/index.js before starting a series.
    if(baseline&&name==='packages/index.js'){
      replace('  // Resolve immutable names once; every stamp still obtains fresh metadata.\n','');
      replace("'content/package-operation.json'].map(file=>path.join(root,file));","'content/package-operation.json'];");
      replace('lstatSync(file,{bigint:true,throwIfNoEntry:false})','lstatSync(path.join(root,file),{bigint:true,throwIfNoEntry:false})');
    }
    if(!observe)return {...result,source};
    if(name==='sewn/budget.js'){
      replace('const assert=()=>{','deadlineStart(started,end);\n  const assert=()=>{');
      replace('const now=Date.now();if(!live)','const now=Date.now();deadlineCheck(now,end,live);if(!live)');
    }
    if(name==='execution/completion.js'){
      replace("effects.push(effect);","effects.push(effect);deadlineMark('nativeDispatch');");
      replace("effect.state='indeterminate';","effect.state='indeterminate';deadlineMark('nativeBegin');");
      replace("committed(){effect.state='committed';}","committed(){effect.state='committed';deadlineMark('nativeCommit');}");
      replace("cancelled(){if(effect.state==='indeterminate')effect.state='none';}", "cancelled(){if(effect.state==='indeterminate'){effect.state='none';deadlineMark('nativeCancelled');}}");
      replace("pending.delete(task);","pending.delete(task);deadlineMark('nativeSettlement');");
    }
    if(name==='execution/diagnostics.js'){
      replace('phase=name;phaseStarted=performance.now();', 'phase=name;phaseStarted=performance.now();deadlinePhase(name);');
      replace('add(spans,name,elapsed(since));progress?', "add(spans,name,elapsed(since));if(name==='service')deadlineMark('pageContinuation');progress?");
    }
    if(name==='execution/page.js'){
      replace('const executionLedger=createObservedExecutionBudget(', 'deadlineArm();\n  const executionLedger=createObservedExecutionBudget(');
      replace("const end=operation==='clear'?completion.pageClear():undefined;","if(operation==='clear')deadlineMark('clearEntry');\n        const end=operation==='clear'?completion.pageClear():undefined;");
      replace('observation?.finish();end?.();',"observation?.finish();end?.();if(operation==='clear')deadlineMark('clearExit');");
      // All three existing canonical assignment sites; no candidate is marked
      // published until assignment has actually executed.
      replace('runtime=next;\n    };',"runtime=next;deadlineMark('canonicalPublication');\n    };");
      replace("runtime=measure('commitMs',()=>edit.commit().runtime);","runtime=measure('commitMs',()=>edit.commit().runtime);deadlineMark('canonicalPublication');");
      replace('onRuntime:next=>{runtime=next;}','onRuntime:next=>{runtime=next;deadlineMark(\'canonicalPublication\');}');
      replace('return {response,error:failure?.toJSON()',"deadlineMark('pageComplete');\n  return {response,error:failure?.toJSON()");
      replace('if(!response.explicit){const projection=webModel(runtime,model);',"if(!response.explicit){deadlineMark('outputConstruction');const projection=webModel(runtime,model);");
      replace('response.tree(result.html,result.status);}',"response.tree(result.html,result.status);deadlineMark('outputConstructed');}");
      if(costs){replace('const tree=(state=runtime)=>{','const tree=(state=runtime)=>deadlineSync(\'pageTree\',()=>{');replace('return ids;};','return ids;});');}
    }
    if(name==='http/pipeline.js'){
      replace("observation?.phase('publication');","observation?.phase('publication');deadlineMark('responsePreparation');");
      replace("await result.response.send(res,req.method==='HEAD');","await result.response.send(res,req.method==='HEAD');deadlineMark('responseSendComplete');");
    }
    if(name==='http/response.js'){
      replace('if(head){res.end();return;}',"deadlineMark('responsePrepared');if(head){res.end();return;}");
      replace('} else res.end(body);',"} else {res.end(body);deadlineMark('responseHandoff');}");
    }
    if(costs&&name==='packages/index.js'){
      replace('const stamp=()=>files.map(file=>{',"const stamp=()=>deadlineSync('installedStamp',()=>files.map(file=>{");
      replace('return s;\n  });','return s;\n  }));');
    }
    if(costs&&['object-model/index.js','object-model/mutation.js'].includes(name)){
      for(const [fn,stage]of name.endsWith('/index.js')?[['hydrate','hydrate'],['dehydrate','dehydrate']]:[['createEdit','mutation']]){
        replace('export function '+fn+'(', 'function '+fn+'Unobserved(');
        source+='\nexport function '+fn+'(...args){return deadlineSync('+JSON.stringify(stage)+',()=>'+fn+'Unobserved(...args));}\n';
      }
    }
    source='import {deadlineArm,deadlineStart,deadlineCheck,deadlineMark,deadlinePhase,deadlineSync} from '+JSON.stringify(observer)+';\n'+source;
    return {...result,source};
  }});
}
