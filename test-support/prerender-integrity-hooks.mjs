// Explicitly installed only by Spike G workers, before loading the application.
// Strict source anchors fail closed on drift. No production source is written.
import {registerHooks} from 'node:module';
const engine='/packages/wydgine/src/engine/';
const observer=new URL('./prerender-integrity-attribution.js',import.meta.url).href;
const targets=new Set(['object-model/index.js','object-model/mutation.js','object-model/construction.js','packages/index.js',
  'packages/state.js','repository.js','execution/page.js','execution/diagnostics.js','execution/progress.js','seam/context.js']);
export function installAttributionHooks({incrementalValidation=false}={}){
  return registerHooks({load(url,context,next){
    const result=next(url,context),name=url.split(engine)[1];if(!targets.has(name))return result;
    let source=String(result.source);
    const replace=(before,after)=>{if(source.split(before).length!==2)throw Error('Spike G source anchor: '+name);source=source.replace(before,after);};
    const wrap=(fn,stage,methods)=>{
      replace('function '+fn+'(', 'function '+fn+'Unobserved(');
      source+='\nexport function '+fn+'(...args){return gSync('+JSON.stringify(stage)+',()=>'+(methods?'gMethods(':'')+fn+'Unobserved(...args)'+(methods?','+JSON.stringify(methods)+')':'')+');}\n';
      // Keep the original export private; callers and internal recursion use wrapper.
      source=source.replace('export function '+fn+'Unobserved(', 'function '+fn+'Unobserved(');
    };
    if(name==='object-model/index.js'){
      wrap('hydrate','hydrate');wrap('dehydrate','dehydrate');
      replace('const root = visit(input, null, null, 0);','const root = visit(input, null, null, 0);gCount("hydratedNodes",nodes.size);');
      replace('return emit(root);','gCount("copiedNodes",nodes.size);return emit(root);');
    }
    if(name==='object-model/mutation.js'){
      if(incrementalValidation){
        replace('const candidate = dehydrate(validated(working),{includeSensitive:true});','const candidate = gSync("candidateConstruction",()=>dehydrate(validated(working),{includeSensitive:true}));');
        replace('const next = dehydrate(validated(candidate),{includeSensitive:true});','const validatedCandidate = gSync("candidateValidation",()=>validated(candidate));\n    const next = dehydrate(validatedCandidate,{includeSensitive:true});');
        replace('const runtime = hydrate(working, registry, { revision: baseRevision + 1 });','const runtime = gSync("commitValidation",()=>hydrate(working, registry, { revision: baseRevision + 1 }));');
      }
      wrap('createEdit','editSetup',{setProperty:'mutation',resetProperty:'mutation',insertChild:'mutation',remove:'mutation',moveChild:'mutation',replaceChild:'mutation',cloneChild:'mutation',commit:'commit',changes:'changes'});
    }
    if(name==='object-model/construction.js'){
      wrap('construction','draftValidate',{create:'draftCreate',envelope:'draftEnvelope'});
      replace('const validate=(raw,complete=false,depth=0,ids=new Set())=>{','const validate=(raw,complete=false,depth=0,ids=new Set())=>gSync("draftValidate",()=>{gCount("draftValidationNodes");');
      replace('formTree(result,registry);return result;\n  };','formTree(result,registry);return result;\n  });');
      replace('const set=(name,value)=>{','const set=(name,value)=>gSync("draftSet",()=>{');
      replace('update(current,raw);};','update(current,raw);});');
      // Do not wrap draft handles: construction's private WeakMap authenticates them.
    }
    if(name==='repository.js'){wrap('loadRepository','repositoryLoad');wrap('repositoryFromState','repositoryBuild');}
    if(name==='packages/state.js'){
      for(const [fn,stage]of [['readInstalledState','installedRead'],['validateInstalledState','installedStateValidate'],['baseFingerprint','baseFingerprint'],['safeRead','safeRead']])wrap(fn,stage);
    }
    if(name==='packages/index.js'){
      // Private helpers remain private. The wrapper cannot issue authority.
      replace('function guardInstalledExecution(root,entry,context) {','function guardInstalledExecution(root,entry,context) {return gSync("installedBind",()=>guardInstalledExecutionUnobserved(root,entry,context));}\nfunction guardInstalledExecutionUnobserved(root,entry,context) {');
      replace('const stamp=()=>files.map(file=>{','const stamp=()=>gSync("installedStamp",()=>files.map(file=>{');
      if(source.includes("}).join('|');"))replace("}).join('|');","}).join('|'));");
      else replace('return s;\n  });','return s;\n  }));');
      replace('const validate=()=>{','const validate=()=>gSync("installedValidate",()=>{');
      replace("'PACKAGE.STALE','Installation snapshot is no longer current');\n  };","'PACKAGE.STALE','Installation snapshot is no longer current');\n  });");
      replace('const observed=stamp();','gLifetime(context);const observed=stamp();');
    }
    if(name==='execution/page.js'){
      replace('const systemSet=(id,properties)=>{','const systemSet=(id,properties)=>gSync("systemSet",()=>{');
      replace('runtime=hydrate(raw,model.registry);\n  };','runtime=hydrate(raw,model.registry);\n  });');
    }
    if(name==='execution/diagnostics.js'){
      replace('phase(name){progress?', 'phase(name){gPhase(name);gBoundary("phase");progress?');
      replace('const measure=async(name,operation,resume)=>{','const measure=async(name,operation,resume)=>{if(name==="service")gBoundary("serviceBefore");');
      replace('finally{resume?.();add(spans,name,elapsed(since));','finally{if(name==="service")gBoundary("serviceAfter");resume?.();add(spans,name,elapsed(since));');
      replace('finish(meter){','finish(meter){gBoundary("finished");');
    }
    if(name==='execution/progress.js')replace('observation=createLedgerProgress(', 'gDeadline(ledger.deadline);gBoundary("budgetStarted");observation=createLedgerProgress(');
    if(name==='seam/context.js')wrap('checkContext','contextCheck');
    if(['packages/state.js','packages/index.js','repository.js'].includes(name)){
      for(const operation of ['lstatSync','realpathSync','existsSync'])source=source.replaceAll(new RegExp('(?<![\\w])'+operation+'\\(','g'), 'gFs('+JSON.stringify(name)+','+JSON.stringify(operation)+','+operation+',');
    }
    source='import {syncSpan as gSync,count as gCount,phase as gPhase,boundary as gBoundary,budgetDeadline as gDeadline,lifetimeCheck as gLifetime,observedFs as gFs,observeMethods as gMethods} from '+JSON.stringify(observer)+';\n'+source;
    return {...result,source};
  }});
}
