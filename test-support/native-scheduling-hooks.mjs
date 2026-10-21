// Strict, opt-in, in-memory source markers. No awaits/reactions/yields added.
import {registerHooks} from 'node:module';
const observer=new URL('./native-scheduling.js',import.meta.url).href;
export function installNativeSchedulingHooks({costs=false}={}){
  return registerHooks({load(url,context,next){
    const result=next(url,context);
    const engine=url.split('/packages/wydgine/src/engine/')[1],store=url.split('/packages/wydstore/src/')[1];
    if(!['execution/completion.js','execution/diagnostics.js',...(costs?['packages/index.js']:[])].includes(engine)&&!['sqlite-adapter.js','json-adapter.js','core.js'].includes(store))return result;
    let source=String(result.source);
    const replace=(before,after)=>{if(source.split(before).length!==2)throw Error('Spike L anchor '+(engine??store)+' '+before.slice(0,60));source=source.replace(before,after);};
    if(engine==='execution/completion.js'){
      replace('const started=now(),row=',"schedulingMark(name+'Start');const started=now(),row=");
      replace('row.maxMs=Math.max(row.maxMs,elapsed);',"row.maxMs=Math.max(row.maxMs,elapsed);schedulingMark(name+'End');");
      replace('effects.push(effect);',"effects.push(effect);schedulingMark('dispatch');");
      replace('()=>work(operation)',"()=>{schedulingMark('workEntry');return work(operation);}");
      replace('pending.add(task);',"schedulingPromise(task,'taskSettlement');pending.add(task);");
      replace('pending.delete(task);',"pending.delete(task);schedulingMark('nativeContinuation');");
    }
    if(engine==='execution/diagnostics.js')replace('resume?.();',"if(name==='service')schedulingMark('pageContinuation');resume?.();");
    if(engine==='packages/index.js'){
      replace('const stamp=()=>files.map(file=>{',"const stamp=()=>schedulingSync('installedStamp',()=>files.map(file=>{");
      replace('return s;\n  });','return s;\n  }));');
    }
    if(store==='core.js')replace('policy.operation?.storeEntry?.();',"schedulingMark('storeEntry');policy.operation?.storeEntry?.();");
    if(store==='sqlite-adapter.js'){
      replace('async function transaction(', 'async function transactionUnobserved(');
      replace('let db,worked;',"if(completion)schedulingMark('providerEntry');let db,worked;");
      replace('preflight?.();worked?.();}}',"preflight?.();worked?.();if(completion)schedulingMark('providerComplete');}}");
      replace('  // Only a newly,',"  function transaction(...args){const promise=transactionUnobserved(...args);if(args[3])schedulingPromise(promise,'providerSettlement');return promise;}\n  // Only a newly,");
    }
    if(store==='json-adapter.js'){
      replace('async function transaction(', 'async function transactionUnobserved(');
      replace("const queued=completion?.stage?.('jsonQueue');", "if(completion)schedulingMark('providerEntry');const queued=completion?.stage?.('jsonQueue');");
      replace('queues.delete(file); }','queues.delete(file);if(completion)schedulingMark(\'providerComplete\'); }');
      replace('  await transaction(() =>',"  function transaction(...args){const promise=transactionUnobserved(...args);if(args[2])schedulingPromise(promise,'providerSettlement');return promise;}\n  await transaction(() =>");
    }
    source='import {schedulingMark,schedulingPromise,schedulingSync} from '+JSON.stringify(observer)+';\n'+source;
    return {...result,source};
  }});
}
